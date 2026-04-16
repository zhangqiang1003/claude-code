# JY Draft 功能需求分析：重难点 + Claude Code 借鉴映射

> 生成时间：2026-04-15

## 一、重难点梳理

### 难度评级标准
- **S级（极高）**：架构级决策，实现复杂度高，影响全局
- **A级（高）**：核心业务逻辑，需深入理解 Claude Code 实现细节
- **B级（中）**：独立功能模块，可参照已有代码实现
- **C级（低）**：工具类/UI 组件，实现相对直接

---

### S级重难点（4 项）

#### S1. QueryEngine ReAct 循环（Phase 3.4）

- **难度原因**：整个系统的"大脑"。需实现完整的 ReAct 循环（AI 自主决定调 Tool 还是回复用户）、流式响应处理、Function Calling 协议、Tool 并行/串行编排、权限集成。Claude Code 的 `query.ts`（1773 行）+ `QueryEngine.ts`（1320 行）= **3093 行**核心代码，涉及大量边界条件。
- **关键挑战**：
  - 流式 tool_calls 参数的增量解析（partial JSON 积累）
  - ReAct 循环的终止条件判断
  - 异步流式事件（AsyncGenerator）在 Electron IPC 中的传递
  - Tool 并行执行时的依赖检测算法

#### S2. 4 层 Compaction 管道（Phase 3.4.4）

- **难度原因**：长对话场景下必须压缩上下文，否则 token 超限。Claude Code 实现了 Microcompact → SessionMemory → Autocompact → Reactive 四层渐进管道，每层的触发条件和压缩策略不同。
- **关键挑战**：
  - Token 计数的准确性（需 tiktoken 或近似算法）
  - Autocompact 需要 LLM 二次调用生成摘要（额外成本+延迟）
  - preservePriority（保留优先级）策略的设计

#### S3. 权限系统全链路集成（Phase 3.1 + 3.4）

- **难度原因**：Claude Code 的权限系统极为复杂：`src/utils/permissions/` 有 **10221 行**代码，`src/components/permissions/` 有 **10988 行** UI 代码。JY Draft 虽简化到 3 级来源（default/user/session），但与 QueryEngine 的集成点（Tool 调用前拦截、拒绝处理、会话过期）仍需全链路打通。
- **关键挑战**：
  - PermissionGuard 在 ReAct 循环中的正确挂载点
  - 权限拒绝后 AI 感知（tool_result 返回拒绝原因，AI 理解并调整策略）
  - Electron IPC 异步权限弹窗（主进程→渲染进程→用户选择→回主进程）

#### S4. API 多模型适配层（Phase 3.4.2）

- **难度原因**：需支持 MiniMax / GLM / bailian 三种 API，Function Calling 格式不完全一致。Claude Code 的 OpenAI 兼容层（`src/services/api/openai/`）有 **1308 行**专门处理消息格式转换、工具转换和流适配。
- **关键挑战**：
  - 不同模型的 tool_calls delta 格式差异
  - thinking block 的有无（部分模型不支持）
  - 流式响应的 chunk 结构不一致

---

### A级重难点（6 项）

#### A1. MCP Server 改造（Phase 1）

- DMVideo backend 从 FastAPI HTTP API 改造为 MCP Tools。需保留原有业务逻辑，增加 MCP 协议层、API Key 认证缓存。涉及 9 步实现、10+ 个 MCP Tool。

#### A2. MaterialInfo 构建器（Phase 3.3.4）

- Electron 端提取视频/音频/图片元数据（需 ffprobe/sharp），构建 MCP 格式的 Info 对象。不同素材类型的元数据字段差异大。

#### A3. REPL 流式消息渲染（Phase 3.4.13）

- ChatWindow 需实时显示流式文本 + Tool 调用状态 + Tool 结果，同时支持虚拟滚动。Claude Code 的 REPL.tsx 有 **6314 行**，PromptInput 有 **6153 行**。

#### A4. 特效 AI 语义匹配（Phase 5.1）

- 100+ 滤镜预设、600+ 视频特效预设的语义搜索映射。用户说"复古电影感"需匹配多个预设并给出推荐。

#### A5. @素材引用系统（Phase 4.4）

- 输入框中的 autocomplete 交互（@ 触发、模糊搜索、引用插入），加上消息解析时的引用提取和 AI 理解。

#### A6. Electron MCP Client 集成（Phase 2）

- MCP Client 通过 HTTP/SSE 连接 MCP Server，在 Electron 主进程中管理连接生命周期，通过 IPC 暴露给渲染进程。

---

### B级（9 项）

- B1. 草稿状态机（Phase 3.3.1）— 5 状态 + 转换表
- B2. SQLite 数据库设计（Phase 2.3 + 3.2.2 + 3.3.2）— 多表 + 索引
- B3. MaterialManager 22 个子任务（Phase 3.2）— CRUD + 回收站 + 批量操作
- B4. DraftManager 13 个子任务（Phase 3.3）— CRUD + 版本管理
- B5. 关键帧 MCP（Phase 5.2）— 9 种属性动画
- B6. 音频特效 MCP（Phase 5.3）— 变声特效
- B7. 转场 MCP（Phase 5.4）— 内容分析推荐
- B8. 统一确认流程（Phase 5.5）— 先描述再执行
- B9. Windows 打包（Phase 4.5）— electron-builder

---

## 二、Claude Code 业务逻辑借鉴映射表

### Phase 3.4 QueryEngine 相关

| JY Draft 任务 | 借鉴 Claude Code 文件 | 行数 | 借鉴内容 |
|---|---|---|---|
| P3.4.1 消息结构 | `src/types/message.ts` | 174 行 | UserMessage / AssistantMessage / ToolResult 消息类型层次，ContentBlock 联合类型 |
| P3.4.2 API 适配层 | `src/services/api/openai/convertMessages.ts` | 305 行 | Anthropic content blocks → OpenAI tool_calls 格式转换 |
| P3.4.2 API 适配层 | `src/services/api/openai/convertTools.ts` | 123 行 | Tool schema → OpenAI function calling schema |
| P3.4.2 API 适配层 | `src/services/api/openai/streamAdapter.ts` | 375 行 | 流式 delta → 内部消息格式适配 |
| P3.4.2 API 适配层 | `src/services/api/openai/index.ts` | 442 行 | OpenAI 兼容层入口（认证、请求构建、错误处理） |
| P3.4.2 API 适配层 | `src/services/api/openai/modelMapping.ts` | 63 行 | 模型名映射 |
| P3.4.2 API 适配层 | `src/services/api/gemini/` 全目录 | 1506 行 | Gemini 兼容层全套（client + 消息转换 + 工具转换 + 流适配） |
| P3.4.3 System Prompt | `src/context.ts` | 189 行 | 动态构建系统提示词（git status、日期、CLAUDE.md 加载） |
| P3.4.4 Compaction 管道 | `src/query.ts`（压缩相关部分） | ~400 行 | Microcompact / Autocompact 触发阈值、preservePriority、token 计数 |
| P3.4.5 Tool 注册 | `src/tools.ts` | 392 行 | Tool 注册表模式、条件加载、feature flag 集成 |
| P3.4.5 Tool 注册 | `src/Tool.ts` | 798 行 | Tool 接口定义（Tool type）、findToolByName、toolMatchesName |
| P3.4.6 Tool 执行器 | `src/query.ts` 第 800-1200 行 | ~400 行 | Tool 调用编排、并行执行、结果收集 |
| P3.4.7 权限集成 | `src/utils/permissions/permissions.ts` | 1486 行 | 权限检查核心流程：Mode 检查 → 规则匹配 → 决策返回 |
| P3.4.7 权限集成 | `src/utils/permissions/PermissionMode.ts` | 141 行 | PermissionMode 类型定义、模式切换逻辑 |
| P3.4.7 权限集成 | `src/utils/permissions/PermissionRule.ts` | 40 行 | 规则结构定义 |
| P3.4.7 权限集成 | `src/utils/permissions/permissionRuleParser.ts` | 198 行 | 规则解析和匹配 |
| P3.4.8 权限拒绝处理 | `src/utils/permissions/permissionExplainer.ts` | 250 行 | 生成友好的权限拒绝说明 |
| P3.4.9 流式响应 | `src/services/api/claude.ts`（流处理部分） | ~800 行 | SSE 流解析、BetaRawMessageStreamEvent 处理、content_block_delta 解析 |
| P3.4.10 QueryEngine 主类 | `src/QueryEngine.ts` | 1320 行 | 对话状态管理、compaction 触发、attribution、turn 级记账 |
| P3.4.10 QueryEngine 主类 | `src/query.ts` | 1773 行 | query() 主函数 — API 调用构建、流处理、Tool 循环 |
| P3.4.11 IPC Query 通道 | `src/screens/REPL.tsx` 第 1-200 行 | ~200 行 | REPL 与 QueryEngine 的交互模式（sendMessage / stream） |
| P3.4.12 Conversation Store | `src/state/AppState.tsx` | 200 行 | 集中状态定义（messages、tools、permissions、mcpConnections） |
| P3.4.12 Conversation Store | `src/state/AppStateStore.ts` | 569 行 | 默认状态、store 工厂函数 |
| P3.4.12 Conversation Store | `src/state/store.ts` | 34 行 | Zustand-style createStore 模式 |

### Phase 3.4 REPL UI 相关

| JY Draft 任务 | 借鉴 Claude Code 文件 | 行数 | 借鉴内容 |
|---|---|---|---|
| P3.4.13 REPL 组件 | `src/screens/REPL.tsx` | 6314 行 | 完整 REPL（用户输入、消息展示、Tool 权限提示、快捷键） |
| P3.4.13 REPL 组件 | `src/components/PromptInput/PromptInput.tsx` | 3175 行 | 输入框（多行、命令历史、快捷键、@提及） |
| P3.4.13 REPL 组件 | `src/components/Messages.tsx` | 1162 行 | 消息列表渲染（虚拟滚动、不同消息类型） |
| P3.4.13 REPL 组件 | `src/components/MessageRow.tsx` | 366 行 | 单条消息渲染（UserMessage / AssistantMessage / ToolResult） |

### Phase 3.1 权限系统相关

| JY Draft 任务 | 借鉴 Claude Code 文件 | 行数 | 借鉴内容 |
|---|---|---|---|
| P3.1 权限系统（全量参考） | `src/utils/permissions/` 全目录 | 10221 行 | 完整权限系统：Mode / Rule / Classifier / FileSystem 验证 / Shell 规则匹配 |
| P3.1 权限 UI（全量参考） | `src/components/permissions/` 全目录 | 10988 行 | 权限弹窗 UI（Bash / File / Edit / Plan 等 10+ 种权限请求组件） |
| P3.1.3 权限核心逻辑 | `src/utils/permissions/permissions.ts` 第 1-300 行 | ~300 行 | checkPermission 核心流程：Mode → 规则匹配 → Decision |
| P3.1.3 权限核心逻辑 | `src/utils/permissions/filesystem.ts` | 1778 行 | 文件系统权限验证（路径匹配、glob 支持） |
| P3.1.5 权限弹窗 UI | `src/components/permissions/PermissionDialog.tsx` | 54 行 | 权限弹窗容器 |
| P3.1.5 权限弹窗 UI | `src/components/permissions/BashPermissionRequest/` | 799 行 | Bash 命令权限请求弹窗（最接近 JY Draft 的 Tool 权限场景） |

### 其他借鉴

| JY Draft 任务 | 借鉴 Claude Code 文件 | 行数 | 借鉴内容 |
|---|---|---|---|
| API Key 认证 | `src/services/api/bootstrap.ts` | 141 行 | API 认证引导流程 |
| 错误处理 | `src/services/api/errors.ts` | 1207 行 | 错误类型定义、重试策略、错误恢复 |
| 错误处理 | `src/services/api/withRetry.ts` | 822 行 | 带重试的 API 调用封装 |
| 状态持久化 | `src/bootstrap/state.ts` | — | 模块级单例（sessionId、CWD、projectRoot、tokenCounts） |
| Ink 框架概念 | `packages/@ant/ink/` 全目录 | 27883 行 | 终端 UI 框架（JY Draft 用 Vue，但虚拟滚动、主题等概念可借鉴） |
| Agent 系统（后期参考） | `src/tools/AgentTool/` | 1231 行 | 4 种内置 agent（explore/plan/generalPurpose/claudeCodeGuide） |

---

## 三、代码量估算

| 借鉴范围 | Claude Code 行数 | JY Draft 预估行数（简化版） |
|---|---|---|
| QueryEngine + query 主循环 | 3093 行 | ~1500 行 |
| API 适配层（3 模型） | 2814 行 | ~1200 行 |
| 权限系统 | 10221 行 + 10988 行 | ~2000 行（大幅简化） |
| REPL UI | 6314 行 + 6153 行 | ~3000 行（Vue 重写） |
| State Management | 1307 行 | ~500 行 |
| 错误处理 | 2029 行 | ~500 行 |
| MCP Server（Python） | — | ~2000 行 |
| MaterialManager + DraftManager | — | ~3000 行 |
| 特效/滤镜/关键帧 | — | ~1500 行 |
| **总计** | — | **~15200 行** |

---

## 四、风险最高的 Top 3 任务

1. **QueryEngine ReAct 循环**（S1）— 3093 行参考代码，需深刻理解流式处理和 Tool 编排
2. **权限全链路集成**（S3）— 涉及 10+ 个模块的交叉集成，Electron IPC 异步弹窗
3. **4 层 Compaction**（S2）— 长对话场景容易出 bug，测试困难，需额外 LLM 调用成本
