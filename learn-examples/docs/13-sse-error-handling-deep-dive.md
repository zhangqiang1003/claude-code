# SSE 流式传输错误处理深度解析

## 概述

Claude Code 默认使用 SSE (Server-Sent Events) 进行流式数据传输。本文档深入分析流式传输过程中的错误处理机制，包括错误捕获、分类、降级策略和完整性校验。

## 核心文件

- `src/services/api/claude.ts` — 主要的 SSE 错误处理逻辑（2471-2668 行）
- `src/query.ts` — 上层查询引擎，处理重试和模型降级

## 1. 错误捕获机制

### 1.1 AsyncIterator 异常传播

SSE 流通过 `AsyncIterator` 实现，使用 `for await...of` 循环消费事件：

```typescript
// src/services/api/claude.ts:2200-2471
try {
  for await (const part of stream) {
    // ① stream 迭代器抛出的错误（网络中断、SSE 解析失败）

    switch (part.type) {
      case 'message_start':
        partialMessage = part.message
        break
      case 'content_block_delta':
        // ② 处理事件时的错误
        yield { type: 'stream_event', event: part }
        break
    }
  }

  // ③ 循环结束后的完整性校验
  if (!partialMessage || (newMessages.length === 0 && !stopReason)) {
    throw new Error('Stream ended without receiving any events')
  }
} catch (streamingError) {
  // 捕获 ①②③ 所有位置的错误
  clearStreamIdleTimers()
  // 错误分类与处理...
}
```

**关键点**：
- `try-catch` 捕获整个 `try` 块内的所有同步和异步错误
- 包括迭代器本身的错误、循环体内的错误、循环后的校验错误
- 不仅仅是"stream 迭代器的错误"

### 1.2 错误类型

常见的错误类型：

| 错误类型 | 触发场景 | 来源 |
|---------|---------|------|
| `APIUserAbortError` | 用户按 ESC 或 SDK 超时 | Anthropic SDK |
| `APIConnectionTimeoutError` | 网络超时 | SDK / 自定义 |
| `Error('Stream ended...')` | 流不完整 | 完整性校验 |
| 网络错误 | TCP 连接中断、DNS 失败 | 底层网络栈 |
| SSE 解析错误 | 响应体格式错误 | SDK 解析器 |

## 2. 错误分类与处理策略

### 2.1 用户中断 vs SDK 超时

同样是 `APIUserAbortError`，通过 `signal.aborted` 区分：

```typescript
// src/services/api/claude.ts:2501-2528
if (streamingError instanceof APIUserAbortError) {
  if (signal.aborted) {
    // ① 真正的用户中断（ESC 键）
    logForDebugging(`Streaming aborted by user`)
    throw streamingError  // 直接抛出，不重试
  } else {
    // ② SDK 内部超时（不是用户按的 ESC）
    logForDebugging(`Streaming timeout (SDK abort)`)
    throw new APIConnectionTimeoutError({ message: 'Request timed out' })
  }
}
```

**设计意图**：
- 用户中断：不应该重试，直接终止
- SDK 超时：可以重试或降级到非流式模式

### 2.2 流式降级到非流式（Fallback）

当流式传输失败时，自动降级到非流式模式：

```typescript
// src/services/api/claude.ts:2571-2636
logForDebugging('Error streaming, falling back to non-streaming mode')
didFallBackToNonStreaming = true

if (options.onStreamingFallback) {
  options.onStreamingFallback()
}

logEvent('tengu_streaming_fallback_to_non_streaming', {
  model: options.model,
  error: streamingError instanceof Error ? streamingError.name : String(streamingError),
  attemptNumber,
  fallback_cause: streamIdleAborted ? 'watchdog' : 'other',
})

// 降级到非流式模式
const result = yield* executeNonStreamingRequest(
  { model: options.model, source: options.querySource },
  {
    signal,
    initialConsecutive529Errors: is529Error(streamingError) ? 1 : 0,
    // ↑ 如果流式请求遇到 529 错误，计入重试预算
  },
  paramsFromContext,
  ...
)
```

**Fallback 机制的权衡**：

**优点**：
- 自动恢复，用户无感知
- 非流式模式对网络质量要求更低
- 提高请求成功率

**代价**：
- 重新发送完整 prompt，消耗额外 token
- 用户需要等待完整响应生成完毕（无法实时看到输出）
- 可能导致工具调用重复执行（如果流式模式已经执行了部分工具）

**禁用 Fallback**：

```bash
# 环境变量禁用
export CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK=1

# 或通过 GrowthBook feature flag
tengu_disable_streaming_to_non_streaming_fallback=true
```

禁用场景：
- 启用了流式工具执行（避免重复执行）
- 对 token 成本敏感
- 需要严格的错误处理行为

### 2.3 实际场景示例

**场景 1：网络抖动**

```
用户：请帮我重构这个函数
Claude：正在分析代码...首先我们需要...
[网络中断 - 已输出 30%]
[自动切换到非流式模式]
[稍等片刻]
Claude：正在分析代码...首先我们需要...（完整答案一次性返回）
```

**场景 2：用户中断**

```
用户：请帮我重构这个函数
Claude：正在分析代码...首先我们需要...
[用户按 ESC]
❌ 请求已取消
```

## 3. 流完整性校验

### 3.1 校验逻辑

循环正常退出后，检查流是否完整：

```typescript
// src/services/api/claude.ts:2407-2421
if (!partialMessage || (newMessages.length === 0 && !stopReason)) {
  logForDebugging(
    !partialMessage
      ? 'Stream completed without receiving message_start event'
      : 'Stream completed with message_start but no content blocks completed',
    { level: 'error' }
  )
  logEvent('tengu_stream_no_events', {
    model: options.model,
    request_id: streamRequestId ?? 'unknown',
  })
  throw new Error('Stream ended without receiving any events')
}
```

**检测两种不完整情况**：

1. **完全空流**：`!partialMessage`
   - 连 `message_start` 事件都没收到
   - 可能是代理服务器返回了 200 状态码，但响应体不是 SSE 格式

2. **部分流**：`newMessages.length === 0 && !stopReason`
   - 收到了 `message_start`，但没有完成任何 content block
   - 也没有收到 `message_delta` 中的 `stop_reason`
   - 流在中途断开了

### 3.2 完整流的必要条件

一个完整的 SSE 流必须包含：

| 事件 | 必需性 | 说明 |
|------|--------|------|
| `message_start` | ✅ 必需 | 没有它就是完全空流 |
| `content_block_start` | ⚠️ 条件必需 | 如果有内容输出，必须有 |
| `content_block_delta` | ⚠️ 条件必需 | 实际内容数据 |
| `content_block_stop` | ⚠️ 条件必需 | 完成一个 content block（`newMessages.length++`） |
| `message_delta` (含 `stop_reason`) | ⚠️ 条件必需 | 如果没有完成任何 content block，必须有 `stop_reason` |
| `message_stop` | ❌ 非必需 | 只是流结束标记，缺失不影响完整性 |

**特殊情况**：结构化输出的第二轮

```typescript
// 第一轮：调用 StructuredOutput 工具
message_start
content_block_start (type: tool_use)
content_block_delta (input_json_delta)
content_block_stop
message_delta (stop_reason: tool_use)
message_stop

// 第二轮：返回空响应（end_turn）
message_start
message_delta (stop_reason: end_turn)  // ← 没有 content block，但有 stop_reason
message_stop
```

这种情况下，`newMessages.length === 0` 但 `stopReason === 'end_turn'`，校验通过。

### 3.3 实际场景分析

**场景：网络中断导致流不完整**

```
收到的事件：
message_start          ← partialMessage = true
content_block_start    ← 开始一个 text block
content_block_delta    ← 输出部分内容
content_block_delta    ← 继续输出
[网络断开]

状态检查：
- partialMessage = true
- newMessages.length = 0（没有 content_block_stop，block 未完成）
- stopReason = undefined

校验结果：
if (!partialMessage || (newMessages.length === 0 && !stopReason)) {
//    false      ||  (true                  &&  true)
//    = true  ← 条件满足，抛出错误
  throw new Error('Stream ended without receiving any events')
}

执行路径：
1. for await 循环正常退出（没有抛出异常）
2. 完整性校验主动抛出错误
3. 被 catch (streamingError) 捕获
4. 进入 fallback 逻辑 → 降级到非流式模式
```

## 4. 可靠性保障机制

### 4.1 空闲超时看门狗（Idle Timeout Watchdog）

防止流卡死的机制：

```typescript
// src/services/api/claude.ts:2100-2150
let streamIdleAborted = false
let streamWatchdogFiredAt: number | null = null

function setupStreamIdleWatchdog() {
  const idleTimeoutMs = 60000 // 60 秒无数据则超时

  streamIdleTimer = setTimeout(() => {
    streamWatchdogFiredAt = performance.now()
    streamIdleAborted = true
    stream?.controller.abort()  // 主动中止流
  }, idleTimeoutMs)
}

function clearStreamIdleTimers() {
  if (streamIdleTimer) {
    clearTimeout(streamIdleTimer)
    streamIdleTimer = null
  }
}

// 每次收到数据时重置定时器
for await (const part of stream) {
  clearStreamIdleTimers()
  setupStreamIdleWatchdog()  // 重新开始计时
  // 处理事件...
}
```

**检测逻辑**：

```typescript
// 循环退出后检查是否是看门狗触发的
if (streamIdleAborted) {
  logEvent('tengu_stream_loop_exited_after_watchdog', {
    exit_delay_ms: Math.round(performance.now() - streamWatchdogFiredAt),
    exit_path: 'clean',
  })
  throw new Error('Stream idle timeout - no chunks received')
}
```

### 4.2 资源清理

使用 `finally` 块确保资源释放：

```typescript
// src/services/api/claude.ts:2662-2664
try {
  // 流式处理逻辑...
} catch (streamingError) {
  // 错误处理...
} finally {
  clearStreamIdleTimers()  // 确保定时器被清理
}
```

清理函数：

```typescript
// src/services/api/claude.ts:1571-1577
function cleanup() {
  if (stream) {
    cleanupStream(stream)
    stream = undefined
  }
  if (streamResponse) {
    streamResponse.body?.cancel().catch(() => {})
    streamResponse = undefined
  }
}
```

## 5. 错误处理流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    开始流式请求                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  for await (part of    │
         │       stream)          │
         └────────┬───────────────┘
                  │
                  ├─────► 收到事件 ──► yield 给上层
                  │
                  ├─────► 网络错误 ──► 抛出异常
                  │
                  └─────► 循环正常退出
                           │
                           ▼
                  ┌────────────────────┐
                  │  完整性校验         │
                  │  - partialMessage? │
                  │  - newMessages > 0?│
                  │  - stopReason?     │
                  └────────┬───────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
           校验通过              校验失败
                │                     │
                │              throw Error(...)
                │                     │
                ▼                     ▼
           正常返回          ┌────────────────┐
                            │ catch (error)   │
                            └────────┬────────┘
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                          ▼                     ▼
                  APIUserAbortError        其他错误
                          │                     │
                ┌─────────┴─────────┐           │
                │                   │           │
                ▼                   ▼           │
         signal.aborted?      signal.aborted?   │
            = true              = false         │
                │                   │           │
                ▼                   ▼           ▼
           直接抛出          转换为超时错误   降级到非流式
         （不重试）              │               │
                                 └───────┬───────┘
                                         │
                                         ▼
                              executeNonStreamingRequest()
                                         │
                                         ▼
                                  返回完整响应
```

## 6. 最佳实践

### 6.1 何时禁用 Fallback

```typescript
// 场景 1：流式工具执行
if (streamingToolExecutionEnabled) {
  process.env.CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK = '1'
}

// 场景 2：严格的错误处理
if (requireStrictErrorHandling) {
  process.env.CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK = '1'
}
```

### 6.2 监控和日志

关键事件：

```typescript
// 流式降级
logEvent('tengu_streaming_fallback_to_non_streaming', {
  model,
  error: streamingError.name,
  fallback_cause: 'watchdog' | 'other',
})

// 空流检测
logEvent('tengu_stream_no_events', {
  model,
  request_id,
})

// 看门狗触发
logEvent('tengu_stream_loop_exited_after_watchdog', {
  exit_delay_ms,
  exit_path: 'clean' | 'error',
})
```

### 6.3 错误恢复策略

```typescript
// 1. 用户中断 → 直接终止
if (isUserAbort(error)) {
  throw error
}

// 2. 网络错误 → 降级到非流式
if (isNetworkError(error)) {
  return await executeNonStreamingRequest(...)
}

// 3. 流不完整 → 降级到非流式
if (isIncompleteStream(error)) {
  return await executeNonStreamingRequest(...)
}

// 4. 其他错误 → 重试（由 withRetry 处理）
throw error
```

## 7. 常见问题

### Q1: 为什么不直接失败，而要降级到非流式？

**A**: 用户体验优先。自动恢复比让用户手动重试更友好，即使会消耗额外的 token。

### Q2: Fallback 会导致工具重复执行吗？

**A**: 可能会。如果流式模式已经执行了部分工具调用，降级后可能重复执行。这就是为什么有 `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK` 环境变量。

### Q3: message_stop 不是必需的吗？

**A**: 不是。`message_stop` 只是流结束标记，如果网络在 `message_delta` 之后立即断开，缺少 `message_stop` 不影响已经接收到的完整消息。

### Q4: 如何区分用户按 ESC 和 SDK 超时？

**A**: 通过 `signal.aborted` 标志。用户按 ESC 会设置 `signal.aborted = true`，而 SDK 内部超时不会设置这个标志。

### Q5: 空闲超时是多久？

**A**: 默认 60 秒。如果 60 秒内没有收到任何 SSE 事件，看门狗会主动中止流。

## 8. 相关源码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| 主错误处理逻辑 | `src/services/api/claude.ts` | 2471-2668 |
| 完整性校验 | `src/services/api/claude.ts` | 2407-2421 |
| 用户中断 vs 超时 | `src/services/api/claude.ts` | 2501-2528 |
| Fallback 执行 | `src/services/api/claude.ts` | 2571-2636 |
| 空闲超时看门狗 | `src/services/api/claude.ts` | 2100-2150 |
| 资源清理 | `src/services/api/claude.ts` | 1571-1577, 2662-2664 |
| 非流式请求 | `src/services/api/claude.ts` | 1800-1900 |

## 9. 总结

Claude Code 的 SSE 错误处理采用**多层防御**策略：

1. **AsyncIterator 层**：网络/协议错误直接抛出异常
2. **完整性校验层**：循环正常退出后检测不完整流，主动抛出错误
3. **分类处理层**：区分可恢复错误（fallback）vs 不可恢复错误（用户中断）
4. **降级保障层**：非流式模式作为最后防线，确保请求最终成功

这种设计在**用户体验**和**资源成本**之间取得了平衡，同时提供了灵活的配置选项（禁用 fallback）来适应不同的使用场景。
