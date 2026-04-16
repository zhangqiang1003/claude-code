# JY Draft Plan 待优化点分析

> 生成时间：2026-04-15
> 分析范围：Phase 1 ~ Phase 5 全部任务

---

## 跨阶段通用优化（影响全局）

### G1. 缺少统一的日志基础设施

**现状**：plan.md 未提及任何日志策略。
**问题**：MCP Server（Python）+ Electron 主进程（Node）+ 渲染进程（Vue）三层的日志没有统一方案，调试和线上问题排查困难。
**建议**：
- MCP Server：Python `logging` 模块，按模块分级（DEBUG/INFO/WARN/ERROR），输出到 `~/.jy-draft/logs/mcp-server.log`
- Electron 主进程：参考 Claude Code `src/utils/log.ts`（内存 error buffer 100 条 + 文件日志 + session 组织），输出到 `~/.jy-draft/logs/main.log`
- 渲染进程：Vue console → 通过 IPC 转发到主进程日志
- **新增任务**：Phase 2 增加 `P2.10 日志基础设施`（预估 150 行）

### G2. 缺少统一的配置管理方案

**现状**：配置散落在 SQLite `config` 表、`.env`、代码常量中。
**问题**：API Key、MCP Server URL、模型选择、输出目录等配置没有统一管理，优先级不清晰。
**建议**：
```
配置优先级：环境变量 > 用户配置（SQLite config 表）> 默认值（代码常量）
```
- **新增文件**：`src/main/config/index.ts` — 统一配置读取器
- **配置项清单**：`ai_model`、`ai_api_key`、`ai_api_base`、`mcp_server_url`、`mcp_api_key`、`video_root_path`、`jianying_draft_path`、`output_folder`、`language`、`permission_mode`

### G3. 缺少 i18n 基础设施

**现状**：plan.md 提到"多语言支持（中文+英文）"但未设计实现方案。
**问题**：所有 UI 文本、错误消息、AI prompt 都硬编码中文，后期国际化成本高。
**建议**：
- Phase 2 搭建时就引入 `vue-i18n`
- 错误消息（ErrorCode）从一开始就用 i18n key
- System Prompt 模板支持语言切换
- **新增任务**：Phase 2 增加 `P2.11 i18n 初始化`（预估 80 行）

### G4. 缺少性能监控 / 健康检查

**现状**：没有 API 调用耗时、MCP 响应时间、内存占用等监控。
**问题**：上线后无法定位性能瓶颈。
**建议**：
- QueryEngine 记录每次 API 调用耗时（参考 Claude Code `src/services/api/logging.ts`）
- MCP Client 记录每次 callTool 耗时
- StatusBar 显示最近一次 API 延迟
- **新增类型**：`PerformanceMetric { operation: string, durationMs: number, timestamp: number }`

---

## Phase 1：MCP Server 改造

### P1-O1. MCP Tool 输入校验 Schema 缺失

**现状**：`tools.py` 定义了 Tool 名称和描述，但未定义 JSON Schema 校验。
**问题**：客户端传入非法参数（如 `width: "abc"`）直接导致 Python 运行时错误，返回 500 而非友好错误。
**建议**：
- 每个 MCP Tool 增加 `inputSchema`（JSON Schema），在 handler 入口校验
- 参考 `pydantic` 的 `BaseModel` 自动生成 Schema
- 校验失败返回标准错误：`{ "error": { "code": "INVALID_INPUT", "message": "width must be integer" } }`

### P1-O2. MCP Server 缺少速率限制

**现状**：无速率限制，单客户端可无限调用。
**问题**：如果 AI 进入死循环（反复调 Tool），会瞬间打满 MCP Server。
**建议**：
- 增加 per-session 速率限制（如 60 次/分钟）
- 超限时返回 `{ "error": { "code": "RATE_LIMITED", "message": "Too many requests" } }`
- 参考 Claude Code `src/services/api/withRetry.ts` 的限流处理模式

### P1-O3. MCP Server 缺少优雅关闭

**现状**：未设计 server 关闭流程。
**问题**：Electron 退出时 MCP Server 可能正在处理请求，强制关闭导致数据损坏。
**建议**：
- 实现 graceful shutdown：收到 SIGINT/SIGTERM → 停止接受新请求 → 等待进行中请求完成（超时 10s）→ 退出

### P1-O4. MCP Server 健康检查不完整

**现状**：`GET /health` 返回 `{"status": "ok"}`，未检查下游依赖。
**建议**：
- `/health` 检查：Python 版本、核心模块加载、临时目录可写
- `/health/detail` 返回：当前活跃 draft 数、内存占用、uptime

### P1-O5. 缺少草稿操作的事务性保证

**现状**：`save_draft` → `generate_jianying_draft` 两步操作无事务。
**问题**：如果 `save_draft` 成功但 `generate_jianying_draft` 失败，状态不一致。
**建议**：
- MCP Server 内部增加草稿状态追踪
- `generate_jianying_draft` 失败时不影响已保存的草稿
- 客户端 DraftManager 应处理异常场景的状态回退

### P1-O6. 缺少 MCP Server 启动方式说明

**现状**：未说明 MCP Server 如何与 Electron 一起启动和生命周期管理。
**建议**：
- Electron 主进程启动时 spawn MCP Server 子进程
- 通过 stdout/stderr 监听启动成功信号
- 崩溃时自动重启（最多 3 次，间隔 5s）
- **新增任务**：Phase 2 增加 `P2.12 MCP Server 生命周期管理`

---

## Phase 2：Electron 应用骨架

### P2-O1. 缺少 Electron 安全加固

**现状**：preload.ts 和 IPC 通道设计中未提及安全措施。
**问题**：Electron 默认配置存在安全风险（nodeIntegration、contextIsolation 等）。
**建议**：
```typescript
// electron/main.ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,     // 必须开启
    nodeIntegration: false,     // 必须关闭
    sandbox: true,              // 启用沙箱
    webSecurity: true,          // 启用同源策略
  },
})
```
- preload.ts 通过 `contextBridge.exposeInMainWorld` 暴露受控 API
- 禁止 `eval()`、`new Function()`
- CSP (Content Security Policy) 配置

### P2-O2. 缺少单实例锁

**现状**：未设计多实例防护。
**问题**：用户双击打开多个实例，导致 SQLite 数据库锁冲突和 MCP Server 端口冲突。
**建议**：
```typescript
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    mainWindow.restore()
    mainWindow.focus()
  })
}
```

### P2-O3. 缺少窗口状态持久化

**现状**：窗口关闭后重新打开回到默认大小和位置。
**建议**：
- 记录窗口 `bounds`（x, y, width, height）和 `isMaximized` 到 SQLite `config` 表
- 启动时恢复上次的窗口状态

### P2-O4. 缺少 MCP Client 重连机制

**现状**：`JYMCPClient` 只有一次 `connect()`，无重连。
**问题**：MCP Server 崩溃重启后客户端无法恢复。
**建议**：
```typescript
class JYMCPClient {
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  private async reconnect(): Promise<void> {
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      try {
        await this.connect()
        this.reconnectAttempts = 0
        return
      } catch {
        this.reconnectAttempts++
        await sleep(2000 * this.reconnectAttempts) // 指数退避
      }
    }
    throw new Error('MCP Server unreachable after max retries')
  }
}
```

### P2-O5. 缺少未处理异常兜底

**现状**：未设计全局异常处理。
**建议**：参考 Claude Code `src/utils/gracefulShutdown.ts`：
```typescript
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error)
  mainWindow?.webContents.send('app:error', { message: error.message })
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason)
})
```

### P2-O6. IPC 通道缺少类型安全

**现状**：`IPC_CHANNELS` 只是接口定义，运行时无校验。
**建议**：
- 使用 TypeScript 泛型约束 IPC 调用
- preload 暴露的 API 增加 Zod schema 运行时校验

### P2-O7. 缺少 Electron DevTools 控制

**建议**：
- 开发模式：自动打开 DevTools
- 生产模式：不打开 DevTools，可通过快捷键（Ctrl+Shift+I）打开

---

## Phase 3.1：Permission System

### P3.1-O1. 缺少默认权限规则列表

**现状**：定义了权限类型和检查流程，但未列出默认规则。
**问题**：开发时不知道哪些 Tool 应该默认询问、默认放行还是默认拒绝。
**建议**：
```typescript
// 默认规则（source: 'default'）
const DEFAULT_RULES: PermissionRule[] = [
  // 读操作默认放行
  { toolName: 'list_drafts', behavior: 'allow' },
  { toolName: 'get_draft', behavior: 'allow' },
  { toolName: 'list_materials', behavior: 'allow' },
  { toolName: 'list_filter_presets', behavior: 'allow' },

  // 写操作默认询问
  { toolName: 'create_draft', behavior: 'ask' },
  { toolName: 'add_videos', behavior: 'ask' },
  { toolName: 'save_draft', behavior: 'ask' },
  { toolName: 'export_draft', behavior: 'ask' },
  { toolName: 'generate_video_filter', behavior: 'ask' },

  // 危险操作默认询问
  { toolName: 'delete_draft', behavior: 'ask' },
]
```

### P3.1-O2. 权限弹窗缺少超时机制

**现状**：权限弹窗等待用户选择，无超时。
**问题**：用户离开电脑，权限弹窗无限等待，后续操作阻塞。
**建议**：
- 权限弹窗增加 60 秒超时
- 超时后默认拒绝（安全优先）
- 显示倒计时提示

### P3.1-O3. 缺少权限变更通知

**现状**：权限模式切换后，QueryEngine 不知道。
**问题**：从 `default` 切换到 `acceptAll` 模式时，正在等待权限的请求不会自动释放。
**建议**：
- PermissionManager 发出 `modeChanged` 事件
- PermissionGuard 监听事件，重新评估等待中的请求

---

## Phase 3.2：MaterialManager

### P3.2-O1. 缺少素材去重策略

**现状**：`P3.2.7` 提到"文件名重复检测"，但仅基于文件名。
**建议**：
- 文件名去重（已有）
- 增加文件大小 + 修改时间作为快速去重（不计算 hash，性能优先）
- 可选：计算 MD5/SHA256 hash（后台任务，不阻塞导入）

### P3.2-O2. 缺少素材并发操作保护

**建议**：
- SQLite 层面使用事务（`BEGIN IMMEDIATE`）
- 应用层面使用乐观锁（`updated_at` 检查）

### P3.2-O3. 回收站 7 天自动清理缺少实现方式

**问题**：Electron 没有原生的 cron 能力。
**建议**：
- 使用 `setInterval` 每小时检查一次（桌面应用不一定在凌晨运行）
- 应用启动时也执行一次检查

### P3.2-O4. 缺少大文件处理策略

**建议**：
- 元数据提取使用子进程（避免阻塞主进程）
- 设置超时（30s），超时后跳过，标记为"元数据待提取"
- 导入进度显示（文件大小百分比）

---

## Phase 3.3：DraftManager

### P3.3-O1. 缺少草稿自动保存

**现状**：草稿只在用户/AI 显式调用 `saveDraft` 时保存。
**问题**：应用崩溃时丢失未保存的操作。
**建议**：
- 每 5 分钟自动调用 `saveDraft`（如果状态为 EDITING）
- 或在每次素材变更后自动保存
- StatusBar 显示"已自动保存"提示

### P3.3-O2. 版本回滚流程缺少细节

**现状**：`rollbackVersion` 未说明 MCP 侧的重建方式。
**建议**：
- 方案 B（安全）：回滚 = 创建新草稿 + 复制旧版本 JSON 到新草稿的 output_folder
- Phase 5 后期再实现 `import_jianying_draft` 真正的 JSON 反向构建

### P3.3-O3. 缺少草稿 JSON 校验

**建议**：
- 导出后立即校验 JSON 必需字段（`id`、`tracks`、`materials`）
- 校验失败返回错误 + 部分成功的文件路径

### P3.3-O4. 缺少导入已有剪映草稿的能力（后期）

**建议**：Phase 5 或后期增加 `import_jianying_draft` MCP Tool

---

## Phase 3.4：QueryEngine

### P3.4-O1. ⚠️ Compaction 管道缺少完整的 5 级触发分层

**现状**：plan.md 定义了 5 个阈值常量，但 `checkAndCompact()` 只处理 3 个分支（MICRO/SESSION/AUTO），缺少 L1（BudgetWarn）和 L2（SNIP）的处理逻辑。
**问题**：Token 从 90% 到 98% 之间没有任何渐进处理，直接跳到 Microcompact，缺少预警和轻量截断。

**建议：5 级触发分层处理**

```
Token 使用率    级别       动作                           成本     侵入性
─────────────────────────────────────────────────────────────────────────
< 90%          L0-正常    无动作                         —        —
≥ 90%          L1-预警    BudgetWarn（通知 UI，不压缩）    0        无
≥ 95%          L2-截断    Snip（简单截断长 tool_result）   0        低
≥ 98%          L3-微压    Microcompact（原地替换 placeholder）0     中
≥ 99%          L4-外存    SessionMemory（提取到外部文件）    0       高
≥ 100%         L5-摘要    Autocompact（LLM 摘要压缩）      高       最高
```

**改进后的代码**：

```typescript
// core/queryEngine/context.ts

const CONTEXT_THRESHOLDS = {
  BUDGET_WARN: 0.90,   // L1: 90% — 预警
  SNIP:        0.95,   // L2: 95% — 简单截断
  MICRO:       0.98,   // L3: 98% — Microcompact
  SESSION:     0.99,   // L4: 99% — SessionMemory
  AUTO:        1.00,   // L5: 100% — Autocompact
}

export class ConversationManager {
  private onContextWarning?: (ratio: number, level: string) => void

  /** 检查并执行对应级别的压缩 */
  private async checkAndCompact(): Promise<void> {
    await this.recountTokens()
    const ratio = this.totalTokens / this.maxTokens

    // L1: 预警（≥90%）— 通知 UI 显示上下文使用率警告，不执行压缩
    if (ratio >= CONTEXT_THRESHOLDS.BUDGET_WARN) {
      this.onContextWarning?.(ratio, 'BUDGET_WARN')
      // 仅在 StatusBar 显示黄色警告，不做任何压缩
    }

    // L2: 简单截断（≥95%）— 截断超长 tool_result 到最大字符数
    if (ratio >= CONTEXT_THRESHOLDS.SNIP) {
      await this.snip()
      // snip 后重新计算 ratio，可能已经降到 95% 以下
      await this.recountTokens()
      if (this.totalTokens / this.maxTokens < CONTEXT_THRESHOLDS.MICRO) return
    }

    // L3: Microcompact（≥98%）— 将 tool_result 替换为 placeholder
    if (ratio >= CONTEXT_THRESHOLDS.MICRO) {
      await this.microcompact()
      await this.recountTokens()
      if (this.totalTokens / this.maxTokens < CONTEXT_THRESHOLDS.SESSION) return
    }

    // L4: SessionMemory（≥99%）— 批量提取到外部文件
    if (ratio >= CONTEXT_THRESHOLDS.SESSION) {
      await this.sessionMemory()
      await this.recountTokens()
      if (this.totalTokens / this.maxTokens < CONTEXT_THRESHOLDS.AUTO) return
    }

    // L5: Autocompact（≥100%）— LLM 摘要压缩（最后手段）
    if (ratio >= CONTEXT_THRESHOLDS.AUTO) {
      await this.autocompact()
    }
  }

  /** L2: Snip — 简单截断超长的 tool_result 内容 */
  private async snip(): Promise<void> {
    const MAX_TOOL_RESULT_CHARS = 2000  // L2 截断阈值
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i]
      if (msg.role !== 'tool') continue

      const blocks = Array.isArray(msg.content) ? msg.content : []
      for (const block of blocks) {
        if (block.type === 'tool_result' && typeof block.content === 'string') {
          if (block.content.length > MAX_TOOL_RESULT_CHARS) {
            const original = block.content.length
            block.content = block.content.slice(0, MAX_TOOL_RESULT_CHARS)
              + `\n...[snipped ${original - MAX_TOOL_RESULT_CHARS} chars]`
          }
        }
      }
    }
  }

  /** L3: Microcompact — 原地替换 tool_result 为 placeholder */
  private async microcompact(): Promise<void> {
    const MICRO_MAX_CHARS = 500  // L3 替换阈值（比 L2 更激进）
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i]
      if (msg.role !== 'tool') continue

      const blocks = Array.isArray(msg.content) ? msg.content : []
      for (const block of blocks) {
        if (block.type === 'tool_result' && typeof block.content === 'string') {
          if (block.content.length > MICRO_MAX_CHARS) {
            const chars = block.content.length
            block.content = `[tool_result: ${msg.metadata?.toolName} — ${chars} chars, compacted]`
          }
        }
      }
    }
  }

  /** L4: SessionMemory — 批量 tool_result 提取到外部文件（保持不变） */
  // ...（与 plan.md 原有实现相同）

  /** L5: Autocompact — LLM 摘要压缩（保持不变） */
  // ...（与 plan.md 原有实现相同）

  /** 每级压缩后重新计算 token */
  private async recountTokens(): Promise<void> {
    this.totalTokens = await this.countTokens(this.messages)
  }
}
```

**5 级分层的关键设计原则**：

1. **逐级升级，不跳级**：每级执行后重新计算 ratio，如果降到下一级阈值以下则停止
2. **成本递增**：L1-L4 零 API 成本（纯本地操作），L5 需要 LLM 调用（有成本）
3. **信息损失递增**：L1 无损 → L2 保留前 N 字符 → L3 丢失细节 → L4 丢失全文 → L5 只保留摘要
4. **UI 联动**：L1 触发时 StatusBar 变黄提示，L3+ 触发时变红警告

### P3.4-O2. 缺少查询中断/取消机制 ⚠️ 严重

**现状**：plan.md 完全没有提及如何中断正在进行的查询。
**问题**：AI 在长循环中反复调 Tool 时，用户无法停止。必须强制关闭应用。
**建议**：参考 Claude Code `src/query.ts` 使用 `AbortController`：
```typescript
class QueryEngine {
  private abortController: AbortController | null = null

  cancelCurrentQuery(): void {
    this.abortController?.abort('user-cancel')
    this.abortController = null
  }

  async sendMessageStream(message: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    this.abortController = new AbortController()
    const combinedSignal = signal ?? this.abortController.signal

    for await (const event of streamQuery(message, ctx, combinedSignal)) {
      if (combinedSignal.aborted) {
        yield { type: 'done', reason: 'cancelled' }
        return
      }
      yield event
    }
  }
}
```
- REPL 增加中断按钮（Esc 键或 Ctrl+C）
- 中断时优雅处理：已完成 Tool 结果保留，未执行 Tool 取消
- **新增任务**：`P3.4.15 查询中断与取消`

### P3.4-O3. 缺少模型降级/回退策略

**现状**：AI 模型配置为单一模型，无降级。
**问题**：主模型不可用时（限流、宕机），用户完全无法使用。
**建议**：参考 Claude Code `src/services/api/claude.ts` 的模型降级：
```typescript
const MODEL_FALLBACK_CHAIN: Record<string, string[]> = {
  'glm-4-flash': ['glm-4-flash', 'glm-3-turbo'],
  'minimax-abab-6.5': ['minimax-abab-6.5', 'minimax-abab-5.5'],
}
```
- **新增任务**：`P3.4.16 模型降级与回退`

### P3.4-O4. 流式响应的 tool_calls 参数增量解析过于简化

**现状**：每次 delta 都尝试 `JSON.parse`，无法处理跨 chunk 的参数累积。
**建议**：
```typescript
interface PendingToolCall {
  id: string
  name: string
  argsBuffer: string    // 累积参数字符串
  resolved: boolean
}

// chunk 结束时解析完整参数
if (chunk.choices[0]?.finish_reason === 'tool_calls') {
  for (const pc of pendingCalls) {
    try {
      pc.resolvedInput = JSON.parse(pc.argsBuffer)
    } catch {
      pc.resolvedInput = {}  // 降级为空对象
    }
  }
}
```

### P3.4-O5. 缺少 Token 用量追踪与显示

**建议**：参考 Claude Code `src/services/api/logging.ts`：
```typescript
interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost?: number
}
```
- StatusBar 显示累计 token 用量

### P3.4-O6. 流式事件通过 IPC 传递的设计不完整

**问题**：渲染进程刷新后丢失事件，多窗口同时接收。
**建议**：
- 增加 sessionId 隔离不同会话的事件
- 渲染进程维护本地缓冲区（最多 1000 条消息）
- 考虑使用 Electron `MessagePort` 替代 `ipcRenderer.send`

### P3.4-O7. Tool 并行执行的依赖检测算法过于简单

**现状**：只检查 `draft_id` 是否相同。
**建议**：按操作类型判断（读-读可并行，写-写必须串行）：
```typescript
const WRITE_TOOLS = ['add_videos', 'add_audios', 'add_texts', 'save_draft', 'delete_draft']
const READ_TOOLS = ['get_draft', 'list_drafts', 'list_filter_presets']

function hasDependency(block: ToolUseBlock, allBlocks: ToolUseBlock[]): boolean {
  const isWrite = WRITE_TOOLS.includes(block.name)
  if (!isWrite) return false
  return allBlocks.some(b =>
    b.id !== block.id &&
    WRITE_TOOLS.includes(b.name) &&
    b.input.draft_id === block.input.draft_id
  )
}
```

### P3.4-O8. System Prompt 缺少工具使用示例

**建议**：关键工具（`add_videos`、`generate_video_filter`）必须提供 few-shot 示例。

### P3.4-O9. 缺少查询超时保护

**建议**：
- 单次 API 调用超时：60 秒
- 单次 ReAct 循环最大轮次：20 轮
- 整个查询最大时长：5 分钟
- 超时后返回"查询超时"消息

---

## Phase 4：基础设施与发布

### P4-O1. 缺少 CI/CD 流水线设计

**建议**：GitHub Actions — lint + test + build + upload artifact

### P4-O2. 缺少自动更新机制

**建议**：参考 Claude Code `src/utils/autoUpdater.ts`，使用 `electron-updater`

### P4-O3. 错误处理缺少差异化恢复策略

**建议**：
```typescript
const ERROR_RECOVERY_STRATEGY: Record<ErrorCode, RecoveryStrategy> = {
  MCP_DRAFT_NOT_FOUND:   { action: 'retry_create', maxRetries: 1 },
  MCP_AUTH_FAILED:       { action: 'reconfigure', maxRetries: 0 },
  AI_API_ERROR:          { action: 'retry', maxRetries: 2, delay: 3000 },
  AI_RATE_LIMIT:         { action: 'retry', maxRetries: 3, delay: 10000, fallbackModel: true },
}
```

### P4-O4. REPL 错误展示缺少可操作性

**建议**：每种错误附带操作按钮（"重新配置 Key"、"重试"、"创建新草稿"等）

### P4-O5. @素材引用缺少与 AI 消息的集成细节

**建议**：
- `@` 引用在发送给 AI 前，展开为结构化文本：
  ```
  原始：帮我添加 @[video:E:\test.mp4] 到草稿
  展开：帮我添加 [素材引用: type=video, path=E:\test.mp4, duration=30s, resolution=1920x1080] 到草稿
  ```

---

## Phase 5：特效/滤镜/关键帧

### P5-O1. 特效缺少预览能力（预留接口）

**建议**：预留 `preview_video_filter(filter_name, intensity, video_path): preview_image_url`

### P5-O2. 特效缺少撤销机制

**建议**：
- 维护特效操作栈（类似 undo stack）
- `remove_video_filter(filter_id)` MCP Tool
- 结合草稿版本管理，至少支持"撤销上一步特效操作"

### P5-O3. AI 推荐缺少用户偏好学习

**建议**：
- 记录用户选择历史到 SQLite
- 推荐时加权：`confidence = base_confidence * (1 + preference_bonus)`
- 简单实现：`user_preference` 表

### P5-O4. 关键帧 AI 描述缺少时间线上下文

**建议**：
- System Prompt 注入当前草稿素材时长信息
- `time_offset` 用百分比（如"前 10% 的时长"），由 MCP Server 转换为微秒

### P5-O5. 确认超时（30 秒）可能过短

**建议**：改为 60 秒，超时前 10 秒显示倒计时警告

---

## 汇总：新增/修改任务清单

### 新增任务

| 编号 | 阶段 | 任务 | 优先级 |
|------|------|------|--------|
| P2.10 | Phase 2 | 日志基础设施 | A |
| P2.11 | Phase 2 | i18n 初始化 | B |
| P2.12 | Phase 2 | MCP Server 生命周期管理（spawn + 崩溃重启） | A |
| P3.1.9 | Phase 3.1 | 默认权限规则定义 | B |
| P3.4.15 | Phase 3.4 | 查询中断与取消（AbortController） | **S** |
| P3.4.16 | Phase 3.4 | 模型降级与回退策略 | A |
| P4.6.1 | Phase 4 | CI/CD 流水线 | B |
| P4.6.2 | Phase 4 | 自动更新机制 | B |

### 关键修改

| 编号 | 修改内容 |
|------|----------|
| **P3.4.4** | **补全 5 级触发分层：L1-BudgetWarn → L2-Snip → L3-Microcompact → L4-SessionMemory → L5-Autocompact** |
| P1.3 | 增加 MCP Tool inputSchema 校验 |
| P2.5 | 增加 Electron 安全加固（contextIsolation 等） |
| P2.6 | MCP Client 增加重连机制 |
| P3.4.9 | 改进 tool_calls 参数增量解析（argsBuffer 累积模式） |
| P3.4.10 | 增加查询超时保护（20 轮 / 5 分钟） |
| P3.4.13 | REPL 增加中断按钮（Esc / Ctrl+C） |
| P4.3.5 | 差异化错误恢复策略 |
| P5.5.3 | 确认超时改为 60 秒 |
