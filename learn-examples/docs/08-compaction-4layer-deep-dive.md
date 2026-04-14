# Compaction 4层渐进管道详解

> 来源：AI Agent 开发复习会话（2026-04-13）
> 关键词：Context Window 管理、Token 预算、Compaction、Microcompact、SessionMemory

---

## 核心概念：什么是 Compaction？

当 conversation 累积的 Token 数量接近 Context Window 上限时，需要对历史消息进行压缩，释放空间给新的对话内容。Claude Code 采用**渐进式 4 层管道**，从轻到重，层层递进。

---

## 4层管道的完整顺序

```
Microcompact → SessionMemory → Autocompact → Reactive
   (最轻)         (轻)          (重)         (最重)
```

---

## 第一层：Microcompact（单消息原地替换）

### 触发条件
- 单条 `tool_result` 消息的字符长度超过阈值（具体阈值由代码定义）

### 核心行为
在**单条消息内部**，用简短的 placeholder 原地替换掉冗长的 tool_result 内容。

### 示例

```json
// 原始消息
{
  "role": "tool",
  "content": "Here's the file content: 5000 bytes of full code with all the implementation details..."
}

// Microcompact 之后
{
  "role": "tool",
  "content": "[tool_result:ReadFileTool /path/file.txt — 5000 chars, truncated]"
}
```

### 设计意图
- **最轻量**：不需要调用 LLM，不丢失消息结构
- **保留格式**：只压缩 content，保留 tool_result 的消息骨架
- **原地替换**：不移动消息位置，不改变 conversation 结构

---

## 第二层：SessionMemory（跨边界批量转移）

### 触发条件
- 当 Microcompact 不够用（单条替换后仍然接近临界）
- 或者 conversation 累积了多个 compactBoundary 标记

### 核心行为
把**从某个历史边界开始的所有 tool_result**，整体提取到一个独立存储文件（通常是 `.claude/sessions/{sessionId}/memory/` 下的文件），然后在 conversation 中用一个摘要引用替代。

### 示例

```
// 原始 conversation（简化表示）
msg[5]: user question
msg[6]: assistant thought
msg[7]: tool_call(readFile /path/a.txt)
msg[8]: tool_result(2000 chars)     ← SessionMemory 提取
msg[9]: tool_call(readFile /path/b.txt)
msg[10]: tool_result(3000 chars)    ← SessionMemory 提取
msg[11]: assistant response

// SessionMemory 之后
msg[5]: user question
msg[6]: assistant thought
msg[7]: tool_call(readFile /path/a.txt)
msg[8]: [SessionMemory: 2 tool_results extracted to .claude/sessions/xxx/memory/20240413.json]
msg[9]: tool_call(readFile /path/b.txt)
msg[10]: [SessionMemory: (see above)]
msg[11]: assistant response
```

### 提取到独立文件的内容
独立文件保存原始的 tool_result 内容，并生成一个摘要：

```json
{
  "extractedAt": "2026-04-13T10:00:00Z",
  "boundary": "msg[7]-msg[10]",
  "summary": "读取了 2 个文件: /path/a.txt (2000 chars), /path/b.txt (3000 chars)",
  "originals": [
    { "msgIndex": 8, "tool": "ReadFileTool", "path": "/path/a.txt", "chars": 2000 },
    { "msgIndex": 10, "tool": "ReadFileTool", "path": "/path/b.txt", "chars": 3000 }
  ]
}
```

### 设计意图
- **跨边界**：不局限于单条消息，而是清理一整段历史
- **可恢复**：原始内容存在独立文件中，不会彻底丢失
- **摘要引用**：让 LLM 仍能感知"这里曾经有过什么"

---

## 第三层：Autocompact（LLM 摘要压缩）

### 触发条件
- 当 SessionMemory 仍不够用
- Token 预算已经非常紧张

### 核心行为
调用 LLM 对指定范围的消息进行**生成式摘要**，用一段自然语言摘要替代原有的多条消息内容。

### 示例

```
// 原始（20条消息）
msg[1]-msg[20]: 完整的历史对话

// Autocompact 之后
msg[1]: [Summary: 用户问了一个关于 Python decorator 的问题。
  Agent 解释了装饰器的基本概念，展示了 @staticmethod 和 @classmethod 的用法。
  用户追问了两者的区别，Agent 给出了具体例子并写了代码演示...]
msg[2]-[20]: [collapsed]
```

### 与 SessionMemory 的区别

| 维度 | SessionMemory | Autocompact |
|------|--------------|-------------|
| 操作 | 提取到外部文件 | 摘要留在 conversation 内 |
| 内容保留 | 完整原始内容 | 语义摘要（不可恢复） |
| LLM 调用 | 不需要 | 需要 |
| 粒度 | tool_result 批量转移 | 任意消息范围 |

---

## 第四层：Reactive（最后一搏）

### 触发条件
- 前三层都无法解决问题
- 通常是 `prompt_too_long` 错误后的紧急处理

### 核心行为
Claude Code 的 Claude Team / Enterprise 版本可能会触发某种 Post-To-Long（PTL）错误响应，Reactive 层做最后的清理。

### 状态
目前是 stub（存根实现），具体行为未完全恢复。

---

## preservePriority：压缩时的优先级顺序

当需要决定"哪些内容应该被优先保留"时，Claude Code 使用以下优先级（从高到低）：

```
1. Plan（计划相关内容）
2. 近期 assistant 消息（保持连贯性）
3. tool_result（工具执行结果）
4. 用户意图（用户原始请求）
5. 其他文本
```

**system prompt 不参与压缩**，每次都会完整保留并 prepend 到 conversation 最前面。

---

## 与5级触发分层的关系

这是两个不同维度的概念，容易混淆：

| 维度 | 5级触发分层 | 4层操作分层 |
|------|------------|------------|
| 描述的是 | **触发阈值的严重程度** | **执行什么压缩操作** |
| 举例 | Budget（90%）、Snip（95%）、Micro（98%）、Collapse（99%）、Auto（100%+） | Microcompact、SessionMemory、Autocompact、Reactive |
| 关系 | 触发严重程度越低 | 越轻量操作；严重程度越高 | 越重操作 |

---

## 4层渐进管道的协作流程

```
用户输入 → Token 计数 →

  90%: Budget 警告
    ↓
  95%: Snip（简单截断）
    ↓
  98%: Microcompact（单条 tool_result 原地替换）
    ↓
  99%: SessionMemory（跨边界 tool_result 批量转移）
    ↓
  ~100%: Autocompact（LLM 摘要）
    ↓
  Error: Reactive（最后一搏）
```

**设计原则**：先轻后重，能省则省。优先用不需要 LLM 的轻量操作，在迫不得已时才动用重型武器（LLM 摘要）。

---

## 与 demo 实现（learn-examples/04-multi-agent.ts）的对应

demo 的 Compaction 实现已经升级为 4 层管道：

- **Microcompact**：`compactMessages()` 中的 `replaceToolResultsWithPlaceholder()` 逻辑
- **SessionMemory**：`compactMessages()` 中的 `extractToExternalMemory()` 逻辑
- **Autocompact**：通过 LLM API 调用生成摘要
- **Reactive**：待实现（stub）

参考：`e:\code\claude-code\learn-examples\04-multi-agent.ts` 中的 `compactMessages()` 函数。
