# JY Draft 技术方案

> 更新时间：2026-04-16

## 需求理解

### 用户场景
- 用户通过自然语言描述想要的视频内容
- 用户本地上传视频/音频/图片素材
- AI Agent 自动编排素材（通过调用MCP Server 工具），生成剪映草稿 JSON

### 核心功能
1. **自然语言交互** — 用户描述视频需求
2. **本地素材管理** — 用户上传/选择本地素材（Windows本地路径如 `E:\device.png`）
3. **AI 编排** — Agent 理解意图，调用 Tools 生成草稿（基于调用MCP Server）

### 核心功能范围
- ✅ 视频素材添加
- ✅ 音频素材添加
- ✅ 文本/字幕添加
- ✅ 特效、滤镜、关键帧
- ✅ TTS 语音合成（bailian，已对接）
- ✅ 语音识别（bailian，用于语音指令和字幕生成）

### AI 视频理解能力
1. **短视频分析（2-10s）** → AI 提取文本 → 用于匹配视频素材
2. **长视频分析（几分钟~几十分钟）** → AI 分析 → 智能分割成短素材片段
3. **分割存储方案**：
   - 切割成独立文件
   - 存放路径：`原视频目录/smaterSplit/<yyyy-mm-dd>/`
   - 命名规则：`源文件名_<xxxx序号>.后缀`（序号4位，不足补0）
4. **向量数据库用途**：
   - 视频文本 → 素材检索
   - 自然语言 → 语义搜索素材

### 素材存储
- 用户手动指定素材根目录
- 按素材类型分子文件夹：`/videos/` `/audios/` `/images/`
- 后期可扩展云端同步

### 素材检索
- 混合搜索策略：素材标签 + 语义向量
- 标签生成：AI自动分析生成 + 用户手动填写双模式
- 向量数据库：用于语义匹配素材

### 需求描述流程（双模式）
1. **AI引导模式**：用户上传视频素材 → 点击视频分析 → AI主动询问细节 → 生成合适的提示词 → 交由多模态大模型分析 → 得到视频描述
2. **手动填写模式**：用户直接手动填写视频描述

### 素材缺失处理策略（用户自选）
- 暂停等待：告知用户缺什么素材，等用户补充后再继续
- AI占位符：用AI生成的占位内容（如空白视频/静音音频）代替
- 跳过替代：自动跳过找不到的素材，只用能匹配上的素材

### 草稿输出
- 直接输出到剪映工程目录（用户手动指定路径）
- 生成后跳转剪映打开，App内不做编辑

### 版本历史
- 手动保存版本（按钮 + 快捷键）
- 用于回滚：不满意可回退到之前的版本
- 多草稿支持：可管理多个草稿

### 用户认证
- 先匿名使用（第一阶段不实现）
- 后期：QQ 扫码登录（后端已上线，有完整参考代码）

### 权限控制
- 敏感操作需用户确认
- 支持记住授权/拒绝

### 技术约束
- 桌面应用：Electron
- 后端调用：MCP（Model Context Protocol）
- 后端改造：DMVideo backend → MCP Server

### GUI 界面功能
- 草稿列表 + 素材管理
- AI 对话（增强 REPL）
- 生成后跳转到剪映打开（App内不做编辑）
- 不需要草稿预览功能

### 草稿 JSON 结构
- 分层支持：核心字段必填，高级字段可选

### 数据备份
- 手动备份：用户手动导出/导入 JSON
- 后期可扩展云端备份

### SQLite 数据存储（完整）
- 草稿完整数据（JSON + 元数据）
- 素材索引信息
- AI 分析结果（视频文本、分割片段信息）
- 版本历史

### AI 模型能力（全能力）
- 对话（Chat Completion）
- 视觉（Vision - 图片/视频理解）
- 语音（语音识别）
- Embedding（向量检索）

### Agent 系统
- 完整 Agent 系统
- 多 Agent 协作（Orchestrator + Worker）
- Task/SubAgent 任务管理
- 规划模式（Plan Mode）

### 离线支持
- 必须在线（所有功能需要网络连接）

### 错误处理
- AI生成失败（如API超时）：记录失败任务
- 用户可手动重试或查看失败原因
- 不自动无限重试

### 技术风险评估
- **最大风险**：MCP协议对接（MCP Server和Electron的集成复杂度）
- 剪映工程目录格式可能有版本差异
- AI视频理解结果的准确性
- 向量检索可能匹配到不相关素材

### Phase 1 核心交付
- **可调用的MCP Server**：DMVideo backend封装成MCP Tools，可被Claude Code调用
- 验证端到端草稿生成流程
- 本地一体化部署（MCP Server和Electron打包在一起）

---

## 技术架构

> 借鉴 Claude Code 五层架构模型，按职责分离原则重新组织。MCP Server 作为 Sidecar 进程独立于五层之外。
>
> **参考文档（Claude Code 架构深度解析）**：
> 1. [五层架构全景](https://ccb.agent-aura.top/docs/introduction/architecture-overview) — 架构分层与数据流
> 2. [Agentic Loop](https://ccb.agent-aura.top/docs/conversation/the-loop) — AI 自主循环核心机制
> 3. [多轮对话管理](https://ccb.agent-aura.top/docs/conversation/multi-turn) — QueryEngine 会话编排与持久化
> 4. [工具系统设计](https://ccb.agent-aura.top/docs/tools/what-are-tools) — AI 如何从说到做
> 5. [子 Agent 机制](https://ccb.agent-aura.top/docs/agent/sub-agents) — AgentTool 执行链路与隔离架构
> 6. [System Prompt 动态组装](https://ccb.agent-aura.top/docs/context/system-prompt) — AI 工作记忆构建
> 7. [项目记忆系统](https://ccb.agent-aura.top/docs/context/project-memory) — 文件级跨对话记忆架构
> 8. [上下文压缩](https://ccb.agent-aura.top/docs/context/compaction) — Compaction 三层策略与边界机制
> 9. [Token 预算管理](https://ccb.agent-aura.top/docs/context/token-budget) — 上下文窗口动态计算
> 10. [权限模型](https://ccb.agent-aura.top/docs/safety/permission-model) — Allow/Ask/Deny 三级权限体系

### 架构全景

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1 — 交互层 (Interaction Layer)                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │ ChatWindow  │  │ MessageList  │  │ PromptInput  │  │ Draft   │ │
│  │  (对话窗口)  │  │ (消息渲染)   │  │ (用户输入)    │  │ Card    │ │
│  └─────────────┘  └──────────────┘  └──────────────┘  └─────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Material    │  │ Permission   │  │ Pinia Stores │              │
│  │ Panel       │  │ Prompt       │  │ (响应式状态)  │              │
│  └─────────────┘  └──────────────┘  └──────────────┘              │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2 — 编排层 (Orchestration Layer)                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  QueryEngine                                                   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐ │ │
│  │  │ 会话管理  │  │ 费用追踪  │  │ 版本快照   │  │ 模型热切换   │ │ │
│  │  └──────────┘  └──────────┘  └───────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 3 — 核心循环层 (Core Loop Layer)                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Agentic Loop: while(true) {                                   │ │
│  │    ① 上下文预处理 → ② 流式 AI 请求 → ③ Tool 执行 → ④ 终止判断 │ │
│  │  }                                                             │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────┐             │ │
│  │  │ State    │  │ Compaction   │  │ Token       │             │ │
│  │  │ Object   │  │ (三层压缩)   │  │ Budget      │             │ │
│  │  └──────────┘  └──────────────┘  └─────────────┘             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  Multi-Agent 子系统（横切 Layer 3 + Layer 4）                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  AgentTool                                                      │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │ │
│  │  │ Explore  │ │ Draft    │ │ Material │ │ Audio / Plan /   │ │ │
│  │  │ Agent    │ │ Builder  │ │ Analyst  │ │ Fork Agents      │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │ │
│  │  独立工具池 · 独立权限 · 独立 System Prompt · 同步/异步执行     │ │
│  └────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 4 — 工具层 (Tool Layer)                                      │
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────────────┐ │
│  │ Local Tools      │  │ MCP Client     │  │ Permission System  │ │
│  │ ┌──────────────┐ │  │ (Tool Proxy)   │  │ (工具权限管控)      │ │
│  │ │MaterialMgr   │ │  └───────┬────────┘  └────────────────────┘ │
│  │ │DraftManager  │ │          │                                   │
│  │ │AI Tools      │ │          │                                   │
│  │ │(TTS/ASR/视觉)│ │          │                                   │
│  │ └──────────────┘ │          │                                   │
│  └──────────────────┘          │                                   │
├────────────────────────────────┼────────────────────────────────────┤
│  Layer 5 — 通信层 (Communication Layer)                             │
│  ┌──────────────┐  ┌───────────┴──┐  ┌─────────────────────────┐ │
│  │ AI Provider  │  │ MCP HTTP/SSE │  │ System Prompt           │ │
│  │ Adapter      │  │ Client       │  │ Assembler               │ │
│  │(bailian/GLM/ │  │              │  │ (动态组装 + 缓存)        │ │
│  │ MiniMax)     │  │              │  │                         │ │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                            ┌───────┴────────┐
                            │  MCP Server    │  ← Sidecar 进程
                            │ (DMVideo改造)  │     独立于五层之外
                            │ Python 后端    │
                            └───────┬────────┘
                                    │
                            ┌───────┴────────┐
                            │ 剪映草稿 JSON  │
                            │ (文件输出)     │
                            └───────────────┘
```

### Layer 1 — 交互层 (Interaction Layer)

> 参考：Claude Code REPL Screen (`src/screens/REPL.tsx`)

Vue 3 渲染进程，负责用户输入、消息展示、素材管理和权限确认。

**核心组件**：

| 组件 | 职责 | 参考 Claude Code |
|------|------|------------------|
| ChatWindow | 对话主窗口，布局管理 | REPL.tsx (root screen) |
| MessageList | 消息流渲染（用户/助手/工具/系统） | Messages.tsx / MessageRow.tsx |
| PromptInput | 用户输入区（文本 + 快捷键） | PromptInput/ |
| DraftCard | 草稿状态卡片（实时预览） | — (JY Draft 独有) |
| MaterialPanel | 素材管理面板（上传/预览/管理） | — (JY Draft 独有) |
| PermissionPrompt | 工具权限确认弹窗 | permissions/ |

**Pinia Store 设计**：
```typescript
// 会话 Store
const useConversationStore = defineStore('conversation', {
  state: () => ({
    messages: Message[],           // 对话消息列表
    isStreaming: boolean,          // AI 是否正在输出
    activeDraftId: string | null,  // 当前活跃草稿
  }),
})

// 素材 Store
const useMaterialStore = defineStore('material', {
  state: () => ({
    materials: Material[],         // 已导入素材列表（含 video/audio/image/text 四种类型）
    selectedIds: string[],         // 当前选中素材
    trash: Material[],             // 回收站素材
    favorites: Material[],         // 收藏素材
    storageStats: { used: number, byType: Record<string, number> }, // 存储统计
    loading: boolean,              // 加载状态
    filters: { type?: string, sort: string, query: string }, // 过滤条件
    importProgress: { current: number, total: number, currentFile: string } | null, // 导入进度
    analysisResults: Map<string, AnalysisResult>, // 素材 AI 分析结果缓存
  }),
})

// 权限 Store
const usePermissionStore = defineStore('permission', {
  state: () => ({
    mode: PermissionMode,                        // 当前权限模式
    planModeState: PlanModeState,                // Plan Mode 状态
    pendingRequests: PermissionRequest[],         // 待确认请求队列
    showDialog: boolean,                         // 是否显示弹窗
    currentRequest: PermissionRequest | null,     // 当前弹窗请求
    denialMap: Map<string, DenialTrackingState>,  // 拒绝计数追踪
    allowedTools: Set<string>,                    // 已授权工具
    deniedTools: Set<string>,                     // 已拒绝工具
  }),
})
```

**IPC 通信**：Renderer 通过 Electron IPC 与 Main Process 的 QueryEngine 交互，所有 AI 调用、Tool 执行均在 Main Process 完成。

---

### Layer 2 — 编排层 (Orchestration Layer)

> 参考：Claude Code QueryEngine (`src/QueryEngine.ts`)

Electron Main Process 中的核心编排器，管理会话生命周期。

**QueryEngine 职责**：

| 能力 | 说明 | 参考 Claude Code |
|------|------|------------------|
| 会话管理 | submitMessage() 作为 AsyncGenerator，驱动完整对话周期 | QueryEngine.submitMessage() |
| 持久化 | 会话转写存储到 SQLite + JSONL，支持会话恢复 | JSONL transcript 持久化 |
| 费用追踪 | 按模型统计 token 消耗和 API 成本 | cost tracking per model |
| 版本快照 | 草稿 JSON 修改前后快照，支持 diff 和回滚 | file history snapshots |
| 模型热切换 | 对话中途可切换 bailian/GLM/MiniMax | model hot-swap |

**会话持久化结构**：
```
~/.jy-draft/
├── sessions/
│   ├── {session-id}.jsonl     # 会话转写（每行一条消息/事件）
│   └── {session-id}.meta.json # 会话元数据（模型、费用、时间）
├── drafts/
│   ├── {draft-id}/
│   │   ├── current.json       # 当前草稿 JSON
│   │   └── snapshots/         # 版本快照
│   │       ├── v1.json
│   │       └── v2.json
└── materials/
    └── index.db               # SQLite 素材索引
```

---

### Layer 3 — 核心循环层 (Core Loop Layer)

> 参考：Claude Code Agentic Loop (`src/query.ts` queryLoop())

AI Agent 的自主循环引擎，每一轮迭代包含四个阶段。

**循环结构**：
```
while (true) {
  ① 上下文预处理 (Context Preprocessing)
     → token 预算计算 → 压缩决策 → system prompt 组装
  ② 流式 AI 请求 (Streaming API Call)
     → Provider Adapter 发送请求 → 流式接收文本/Tool 调用
  ③ Tool 执行 (Tool Execution)
     → 权限校验 → 执行 Tool → 收集结果
  ④ 终止判断 (Termination Check)
     → 无 Tool 调用 → 结束并返回
     → 有 Tool 调用 → 携带结果回到 ①
}
```

**State Object**：每次迭代携带的不可变状态快照，包含当前草稿 ID、素材列表、对话历史引用等，在迭代间安全传递。

**终止条件**（参考 Claude Code 7 种终止条件）：
- AI 返回纯文本（无 Tool 调用）→ 正常结束
- 达到最大迭代次数限制 → 强制结束
- 用户主动中断 → 取消结束
- Tool 执行抛出不可恢复错误 → 异常结束
- Token 预算耗尽 → 降级结束

**上下文压缩 — 三层策略**（参考 Claude Code Compaction）：

| 层级 | 策略 | 触发条件 | 说明 |
|------|------|----------|------|
| L1 | MicroCompact | 单轮对话过长 | 压缩早期 Tool 调用结果（保留摘要） |
| L2 | Session Compact | 累计 token 接近阈值 | 对历史对话做摘要压缩 |
| L3 | API Summary | 紧急降级 | 调用 AI 生成整段对话的紧凑摘要 |

**Token 预算管理**（参考 Claude Code Token Budget）：

```
┌───────────────────────────────────────────────────┐
│                  上下文窗口 (模型决定)              │
│  ┌─────────────────┬──────────────┬──────────────┐│
│  │  System Prompt   │  压缩后的    │  输出 Token  ││
│  │  (动态组装)      │  对话历史    │  槽位        ││
│  └─────────────────┴──────────────┴──────────────┘│
│                                                   │
│  阈值：                                           │
│  ├─ 警告线 (~83%)  → 触发 L1 MicroCompact         │
│  ├─ 压缩线 (~90%)  → 触发 L2 Session Compact      │
│  └─ 阻塞线 (~98%)  → 触发 L3 API Summary          │
└───────────────────────────────────────────────────┘
```

---

### Layer 4 — 工具层 (Tool Layer)

> 参考：Claude Code Tool System (`src/tools.ts`, `src/tools/`)

统一的 Tool 接口和注册机制，包含本地工具和 MCP 代理工具。

**统一 Tool 接口**：
```typescript
interface JYTool {
  name: string;                          // 工具名称
  description: string;                   // 工具描述（供 AI 理解）
  inputSchema: JSONSchema;               // 输入参数 Schema
  call(input: unknown): Promise<ToolResult>;  // 执行函数
  validateInput?(input: unknown): ValidationResult;  // 输入校验
  checkPermissions?(input: unknown): PermissionResult; // 权限检查
}
```

**本地工具（Electron Main Process 直接执行）**：

| 工具 | 职责 | 是否需权限 |
|------|------|-----------|
| upload_local_material | 导入本地素材到素材库 | 是（文件访问） |
| list_local_materials | 列出已导入素材 | 否 |
| tts_generate | TTS 语音合成（bailian） | 是（API 调用） |
| speech_recognize | 语音识别（bailian） | 是（API 调用） |
| analyze_video | 视频分析（AI 视觉） | 是（API 调用） |
| get_draft_state | 获取当前草稿状态 | 否 |

**MCP 代理工具（通过 MCP Client 转发到 MCP Server）**：

| 工具 | 职责 | 所在位置 |
|------|------|---------|
| create_draft | 创建新草稿 | MCP Server |
| add_videos | 添加视频素材到时间线 | MCP Server |
| add_audios | 添加音频到时间线 | MCP Server |
| add_texts | 添加文字/字幕 | MCP Server |
| add_stickers | 添加贴纸 | MCP Server |
| add_video_effects | 添加视频特效 | MCP Server |
| add_video_filters | 添加视频滤镜 | MCP Server |
| add_keyframes | 添加关键帧动画 | MCP Server |
| add_audio_effects | 添加音频特效 | MCP Server |
| save_draft | 保存草稿 JSON 到文件 | MCP Server |

**权限系统**（参考 Claude Code Permission System — Allow/Ask/Deny 三级体系）：

> 参考文档：[权限模型](https://ccb.agent-aura.top/docs/safety/permission-model)

#### 1. 三种权限行为

每次 Tool 调用，权限系统做出三种裁决之一：

| 行为 | 含义 | 典型场景（JY Draft） |
|------|------|---------------------|
| **Allow** | 自动放行，用户无感知 | `list_local_materials` 查询素材列表 |
| **Ask** | 弹出确认对话框 | `add_videos` 添加视频到时间线 |
| **Deny** | 直接拒绝 | 尝试删除草稿文件 |

```typescript
type PermissionBehavior = 'allow' | 'ask' | 'deny'

interface PermissionResult {
  behavior: PermissionBehavior
  updatedInput?: unknown       // Allow 时可能修正参数
  message?: string             // Ask/Deny 时的提示信息
  suggestions?: string[]       // Ask 时提供的快捷选项
  decisionReason?: string      // 决策原因（用于调试）
}
```

#### 2. 权限规则的来源层级

规则从 5 个来源汇聚，优先级从高到低：

```
1. session    — 用户在当前对话中手动授权（"总是允许"）
2. skill      — Skill 工具的 allowedTools 白名单
3. projectCfg — 项目级配置 .jy-draft/settings.json（团队共享）
4. userCfg    — 用户级配置 ~/.jy-draft/settings.json（跨项目）
5. builtIn    — 内置默认规则（不可覆盖）
```

每个来源维护三个数组：`allowRules`、`askRules`、`denyRules`。

```typescript
interface PermissionRule {
  source: 'session' | 'skill' | 'projectCfg' | 'userCfg' | 'builtIn'
  behavior: PermissionBehavior
  rule: {
    toolName: string           // 如 "add_videos"、"mcp__draft"
    ruleContent?: string       // 如 "mp4"、"drafts/**"
  }
}
```

#### 3. 规则匹配引擎（三维度）

**维度 1 — 工具名匹配**：

```
rule "add_videos"        → 精确匹配 add_videos 工具
rule "mcp__draft"        → 匹配 MCP Server draft 的所有工具
rule "mcp__draft__*"     → 通配符匹配（同上）
```

**维度 2 — 参数模式匹配**（按工具类型）：

```
// 素材操作工具：匹配素材类型
{ toolName: "add_videos", ruleContent: "*.mp4" }  → 匹配 MP4 素材

// 草稿操作工具：匹配草稿路径
{ toolName: "save_draft", ruleContent: "drafts/**" }  → 匹配草稿目录下操作

// API 调用工具：匹配 API 端点
{ toolName: "tts_generate", ruleContent: "bailian/*" }  → 匹配 bailian TTS
```

**维度 3 — MCP Server 级别匹配**：

```
rule "mcp__draft__*"     → Draft Server 所有工具
rule "mcp__effects__*"   → Effects Server 所有工具
```

#### 4. 权限检查完整流程

```
Tool 调用请求
  │
  ├─ 1. Blanket deny 检查
  │     getDenyRule(toolName) → 命中 → deny
  │
  ├─ 2. Blanket allow 检查
  │     getAllowRule(toolName) → 命中 → allow
  │
  ├─ 3. 工具自身 checkPermissions()
  │     各工具有自定义逻辑：
  │     - upload_local_material: 文件路径白名单检查
  │     - tts_generate: API 配额检查
  │     - save_draft: 草稿路径检查
  │     - analyze_video: API 调用成本提示
  │     ↓ 返回 PermissionResult
  │
  ├─ 4. Ask 规则检查
  │     getAskRules() → 命中 → ask
  │
  └─ 5. 默认行为
        根据当前 permissionMode 决定：
        - 'default': 敏感操作逐一确认
        - 'plan':    只能读不能写
        - 'bypass':  全部放行（需显式启用）
```

#### 5. 权限模式

| 模式 | 适用场景 | 行为 | 切换方式 |
|------|---------|------|---------|
| **Default** | 日常使用 | 敏感操作逐一确认 | 默认模式 |
| **Plan Mode** | 探索阶段 | 只能查看素材/草稿，不能修改 | 自动（进入规划时） |
| **Bypass** | 完全信任 | 所有操作自动放行 | `--dangerously-skip-permissions` |

Plan Mode 切换逻辑：

```typescript
// 进入 Plan Mode 时：切换为只读权限
function enterPlanMode(state: AppState): AppState {
  return {
    ...state,
    permissionMode: 'plan',
    // 写操作全部 deny，读操作自动 allow
  }
}

// 退出 Plan Mode 时：恢复之前的权限模式
function exitPlanMode(state: AppState, prevMode: PermissionMode): AppState {
  return { ...state, permissionMode: prevMode }
}
```

#### 6. Denial Tracking（死循环防护）

```typescript
const DENIAL_LIMITS = {
  maxDenialsPerTool: 3,       // 同一工具连续拒绝上限
  cooldownPeriodMs: 30_000,   // 冷却期 30 秒
}
```

当 AI 连续被拒绝同一操作达到上限时：
1. `recordDenial()` 记录拒绝，增加计数
2. `shouldFallbackToPrompting()` 检测到连续拒绝
3. 系统向 AI 注入消息："上次工具调用被拒绝，请改变策略"
4. AI 被迫改变策略，避免反复请求被拒操作

操作成功时调用 `recordSuccess()` 重置计数。

#### 7. JY Draft 场景下的默认权限矩阵

| 工具 | Default 模式 | Plan 模式 |
|------|-------------|----------|
| `list_local_materials` | Allow | Allow |
| `get_draft_state` | Allow | Allow |
| `upload_local_material` | **Ask** | Deny |
| `add_videos` | **Ask** | Deny |
| `add_audios` | **Ask** | Deny |
| `add_texts` | Allow | Deny |
| `add_stickers` | Allow | Deny |
| `add_video_effects` | **Ask** | Deny |
| `save_draft` | **Ask** | Deny |
| `tts_generate` | **Ask** | Deny |
| `speech_recognize` | **Ask** | Deny |
| `analyze_video` | **Ask** | Deny |
| `smart_split_video` | **Ask** | Deny |
| `vector_search_materials` | Allow | Allow |
| `create_draft` | **Ask** | Deny |

---

### Multi-Agent 子系统

> 参考：Claude Code AgentTool (`src/tools/AgentTool/`, `src/tools/AgentTool/runAgent.ts`)
>
> 参考文档：[子 Agent 机制](https://ccb.agent-aura.top/docs/agent/sub-agents) — AgentTool 执行链路与隔离架构

横切于 Layer 3（核心循环层）和 Layer 4（工具层）的子系统。主 Agent 通过 `AgentTool` 派发子 Agent 执行专业任务，子 Agent 拥有独立的工具池、权限上下文和 System Prompt。

#### 1. Agent 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    主 Agent (Orchestrator)                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Agentic Loop                                          │ │
│  │  用户意图 → 分解任务 → 选择 Agent → 派发 → 汇总结果    │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │ AgentTool.call()                    │
│          ┌──────────────┼──────────────┐                     │
│          │              │              │                      │
│   ┌──────┴──────┐ ┌─────┴──────┐ ┌─────┴──────┐             │
│   │ Explore     │ │ Draft      │ │ Material   │             │
│   │ Agent       │ │ Builder    │ │ Analyst    │             │
│   │ (素材探索)   │ │ Agent      │ │ Agent      │             │
│   │             │ │ (草稿构建)  │ │ (素材分析)  │             │
│   └─────────────┘ └────────────┘ └────────────┘             │
│                         │              │                      │
│   ┌─────────────┐ ┌─────┴──────┐ ┌─────┴──────┐             │
│   │ Audio       │ │ Plan       │ │ Fork       │             │
│   │ Agent       │ │ Agent      │ │ Agent      │             │
│   │ (音频处理)   │ │ (规划分析)  │ │ (通用分身)  │             │
│   └─────────────┘ └────────────┘ └────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

#### 2. 命名 Agent 定义

每个专业 Agent 有独立的 System Prompt、工具池和权限模式：

```typescript
interface AgentDefinition {
  name: string                    // Agent 名称
  description: string             // 供主 Agent 理解何时使用
  systemPrompt: string            // Agent 专属 System Prompt
  tools: string[] | '*''          // 可用工具（'*' 表示全部）
  permissionMode: PermissionMode  // 独立权限模式
  requiredMcpServers?: string[]   // 依赖的 MCP Server
}
```

**JY Draft 专业 Agent 列表**：

| Agent | 职责 | System Prompt 要点 | 专用工具 | 权限模式 |
|-------|------|-------------------|---------|---------|
| **ExploreAgent** | 素材探索、项目结构理解 | 专注于信息收集，不修改任何状态 | `list_local_materials`, `get_draft_state`, `analyze_video` | default |
| **MaterialAnalyst** | 素材分析、质量评估、片段推荐 | 理解视频/音频内容特征，推荐最佳片段 | `analyze_video`, `list_local_materials`, `speech_recognize` | default |
| **DraftBuilder** | 草稿构建、时间线编排、素材添加 | 专注构建剪映草稿 JSON，优化时间线 | `create_draft`, `add_*`, `save_draft` | acceptEdits |
| **AudioAgent** | 音频处理、TTS 生成、配乐推荐 | 音频领域的专业处理 | `tts_generate`, `speech_recognize`, `add_audios` | acceptEdits |
| **PlanAgent** | 任务规划、方案设计、需求拆解 | 分析需求后输出结构化方案，不执行修改 | `get_draft_state`, `list_local_materials` | plan |
| **ForkAgent** | 通用分身，继承主 Agent 全部能力 | 继承父 Agent 的完整 System Prompt 和对话历史 | `*`（继承父工具池） | 继承父 |

#### 3. 执行链路

一条 `Agent(prompt="分析素材并生成草稿")` 的完整路径：

```
主 Agent Agentic Loop
  │
  ├─ AI 输出 tool_use: { name: "Agent", prompt: "...", subagent_type: "DraftBuilder" }
  │
  ├─ AgentTool.call() ← 入口
  │    ├─ 1. 解析 effectiveType（命名 Agent or Fork）
  │    ├─ 2. filterDeniedAgents() ← 权限过滤
  │    ├─ 3. 检查 requiredMcpServers ← MCP 依赖验证（最长等 30s）
  │    ├─ 4. assembleToolPool(workerPermissionContext) ← 独立组装工具池
  │    └─ 5. runAgent() ← 核心执行
  │
  ├─ runAgent() 内部
  │    ├─ getAgentSystemPrompt() ← 构建 Agent 专属 System Prompt
  │    ├─ initializeAgentMcpServers() ← Agent 级 MCP 服务器
  │    ├─ query() ← 进入子 Agent 的 Agentic Loop
  │    │    ├─ 消息流逐条 yield
  │    │    └─ recordSidechainTranscript() ← JSONL 持久化
  │    └─ 返回执行结果
  │
  └─ finalizeAgentTool() ← 结果汇总
       ├─ 提取文本内容 + usage 统计
       └─ mapToolResultToToolResultBlockParam() ← 格式化返回主 Agent
```

#### 4. 两种子 Agent 路径

| 维度 | 命名 Agent（指定 subagent_type） | Fork 子进程（未指定 subagent_type） |
|------|-------------------------------|----------------------------------|
| **触发条件** | `subagent_type` 有值 | 用户主动 fork |
| **System Prompt** | Agent 自身的 `systemPrompt` | 继承主 Agent 的完整 System Prompt |
| **工具池** | `assembleToolPool()` 独立组装 | 主 Agent 的原始工具池（`useExactTools: true`） |
| **上下文** | 仅任务描述 prompt | 主 Agent 的完整对话历史 |
| **权限模式** | Agent 定义的 `permissionMode` | `'bubble'`（上浮到主终端确认） |
| **用途** | 专业任务委派 | Prompt Cache 命中率优化 |

#### 5. 工具池的独立组装

子 Agent 不继承主 Agent 的工具限制，工具池完全独立组装：

```typescript
const workerPermissionContext = {
  ...appState.toolPermissionContext,
  mode: selectedAgent.permissionMode ?? 'acceptEdits'
}
const workerTools = assembleToolPool(workerPermissionContext, appState.mcp.tools)
```

关键设计决策：
- **权限模式独立**：子 Agent 使用自身定义的 `permissionMode`，不受主 Agent 当前模式限制
- **MCP 工具继承**：子 Agent 自动获得所有已连接的 MCP 工具
- **Agent 级 MCP 服务器**：可为特定 Agent 额外连接专属 MCP 服务器

#### 6. 生命周期管理：同步 vs 异步

**同步 Agent（前台运行）**：

```
AgentTool.call()
  └─ runAgent() ← 在主 Agent 的 Agentic Loop 中阻塞等待
       └─ 返回结果 → 主 Agent 继续下一轮迭代
```

**异步 Agent（后台运行）**：

```
AgentTool.call()
  ├─ registerAsyncAgent() ← 注册到 AppState.tasks
  └─ runAsyncAgentLifecycle() ← 后台执行（void，火后不管）
       ├─ runAgent() ← 独立 Agentic Loop
       ├─ completeAsyncAgent() ← 标记完成
       └─ enqueueAgentNotification() ← 通知主 Agent
```

异步 Agent 的特点：
- 独立的 `AbortController`，不与主 Agent 共享
- 用户取消主线程不会杀掉后台 Agent
- 通过 TaskUpdate 工具查询进度

**自动后台化**（超过阈值自动切换）：

```typescript
const AUTO_BACKGROUND_MS = 120_000  // 默认 120 秒
// 如果同步 Agent 执行超过 120s，自动转为异步
```

#### 7. Fork 递归防护

Fork 子进程保留 Agent 工具（为了 cache-identical tool defs），但通过两道防线防止递归 fork：

1. **`querySource` 检查**：检测 `context.options.querySource === 'agent:jy-draft:fork'`
2. **消息扫描**：检测 fork 启动标签

#### 8. 结果回传格式

```typescript
// 子 Agent 完成后，结果回传给主 Agent
interface AgentToolResult {
  status: 'completed' | 'async_launched'
  content: string                  // Agent 输出的文本摘要
  usage: {
    totalTokens: number
    toolCalls: number
    duration: number
  }
}
```

对于一次性 Agent（Explore、Plan），usage 统计被省略以节省上下文窗口。

#### 9. JY Draft 典型协作流程

**场景：用户说"帮我用这5个视频素材做一个旅行 Vlog"**

```
用户: "帮我用这5个视频素材做一个旅行 Vlog"
  │
  ├─ 主 Agent 理解意图 → 分解任务
  │
  ├─ 1. ExploreAgent("扫描素材库，列出所有可用的旅行视频")
  │     └─ list_local_materials() → 返回素材列表
  │
  ├─ 2. MaterialAnalyst("分析这5个视频，推荐最佳片段和排列顺序")
  │     ├─ analyze_video() × 5 → 返回每个视频的精彩片段
  │     └─ 输出：推荐的时间线排列方案
  │
  ├─ 3. AudioAgent("为旅行 Vlog 生成背景音乐和转场音效")
  │     └─ tts_generate() → 返回音频素材
  │
  ├─ 4. DraftBuilder("根据以下方案构建完整草稿：...")
  │     ├─ create_draft()
  │     ├─ add_videos() ← 按推荐片段添加
  │     ├─ add_audios() ← 添加背景音乐
  │     ├─ add_texts() ← 添加字幕
  │     └─ save_draft() → 输出草稿 JSON
  │
  └─ 主 Agent 汇总结果 → 向用户展示完成报告
```

---

### Layer 5 — 通信层 (Communication Layer)

> 参考：Claude Code API Layer (`src/services/api/`)

封装所有外部通信，包括 AI Provider API 调用和 MCP 协议通信。

**AI Provider Adapter**：

```
┌──────────────────────────────────────┐
│        AI Provider Interface         │
│  ┌──────────┐  ┌──────────────────┐ │
│  │ bailian  │  │ GLM              │ │
│  │ Adapter  │  │ Adapter          │ │
│  └──────────┘  └──────────────────┘ │
│  ┌──────────┐                       │
│  │ MiniMax  │                       │
│  │ Adapter  │                       │
│  └──────────┘                       │
│                                      │
│  统一能力：                          │
│  ├─ chat (对话)                      │
│  ├─ vision (图像理解)                │
│  ├─ tts (语音合成)                   │
│  ├─ asr (语音识别)                   │
│  └─ embedding (向量嵌入)             │
└──────────────────────────────────────┘
```

**流式响应处理**：所有 Adapter 统一输出 `AsyncGenerator<StreamEvent>`，核心循环层无需关心具体 Provider 差异。

**MCP HTTP/SSE 通信**：
- Electron Main Process 作为 MCP Client
- 通过 HTTP POST 发送请求，SSE 接收响应
- MCP Server 作为 Sidecar 进程随 Electron 启动/关闭

**System Prompt 动态组装**（参考 Claude Code System Prompt 三阶段管线）：

```
Stage 1: getSystemPrompt()
  → 基础身份 + 能力描述 + 工具列表

Stage 2: buildEffectiveSystemPrompt()
  → 注入当前草稿状态 + 素材上下文 + 用户偏好

Stage 3: buildSystemPromptBlocks()
  → 转为 API 请求格式 + 标记缓存边界 (DYNAMIC_BOUNDARY)
```

缓存策略：静态部分（身份、工具描述）标记为可缓存，动态部分（草稿状态、素材列表）每次刷新。

---

### Sidecar — MCP Server

> 独立于五层架构的 Sidecar 进程，由 DMVideo Python 后端改造而来。

**定位**：专注于剪映草稿 JSON 的生成和操作，不处理 AI 推理、不处理 UI。

**核心能力**：

```typescript
// 草稿管理
create_draft(width: number, height: number): draft_id
save_draft(draft_id: string): draft_url

// 素材添加
add_videos(draft_id: string, video_infos: VideoInfo[]): void
add_audios(draft_id: string, audio_infos: AudioInfo[]): void
add_texts(draft_id: string, text_infos: TextInfo[]): void
add_stickers(draft_id: string, sticker_infos: StickerInfo[]): void

// 特效与滤镜
add_video_effects(draft_id: string, effect_ids: string[][]): void
add_video_filters(draft_id: string, filter_ids: string[][]): void
add_keyframes(draft_id: string, keyframe_ids: string[][]): void
add_audio_effects(draft_id: string, effect_ids: string[][]): void
```

**部署方式**：
- 开发模式：独立 Python 进程，stdio 或 HTTP/SSE 通信
- 生产模式：随 Electron 打包，作为 Sidecar 子进程启动

**数据流**：
```
Electron (MCP Client)  →  HTTP/SSE  →  MCP Server (Python)
                                        ├─ 解析 Tool 参数
                                        ├─ 调用 DMVideo core 逻辑
                                        ├─ 生成剪映 JSON
                                        └─ 返回 JSON 或状态
```

---

## 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 桌面框架 | Electron | 用户偏好 |
| 前端框架 | Vue 3 + TypeScript | 用户偏好 |
| MCP SDK | @modelcontextprotocol/sdk | 官方 SDK |
| AI 模型 | MiniMax / GLM / bailian | 用户偏好优先支持 MiniMax 和 GLM |
| 构建工具 | vite-electron | Vite + Electron 现代化开发体验 |
| 状态管理 | Pinia | Vue 官方推荐，TS 支持好 |
| TTS | bailian | 已对接，参考 `references/DMVideo/frontend/src/main/core/bailianAudio.ts` |
| i18n | vue-i18n | 多语言支持（中文 + 英文）|
| 向量数据库 | LanceDB | Electron 友好，本地向量存储 |
| 数据库 | SQLite | 本地草稿管理、版本历史 |

---

## 开发阶段划分

### Phase 1：MCP Server 改造

> **重要**：基于 `references/DMVideo/backend` 已有业务代码进行开发与增强
>
> **审计报告**：[phase1-audit.md](phase1-audit.md) — 基于 `schemas.py` + `router.py` + `main.py` 实际代码的交叉验证结果。
> 开发时请对照审计报告，重点关注：
> - 2.4 节遗漏的 14 个 REST 端点（含 4 个 P0 级 modify 操作）
> - 3.1 节效果添加到草稿的流程断裂问题（建议采用合并方案）
> - 3.2 节草稿状态读取缺失（需补充 `get_draft_content` + `list_drafts`）
> - 4 节参数描述不充分（Tool 的 inputSchema 应与 schemas.py 完全对应）
> - 5.3 节 handlers 拆分建议
> - 六 节修正后的 34 个 Tool 清单与分阶段实施建议

#### 1.1 技术决策

| 问题 | 决策 |
|------|------|
| 通信方式 | HTTP/SSE（支持独立部署） |
| 认证方式 | API Key（缓存认证，10分钟有效） |
| 素材路径校验 | 客户端（Electron）校验，MCP Server 不校验 |
| 素材元数据获取 | 客户端处理，MCP Server 不处理 |
| 特效/滤镜预设 | 复用 `pjy/metadata/` 已有预设 |
| 多租户 | 不支持，每客户端独立 MCP Server |
| output_folder | 客户端配置 |

#### 1.2 改造目录结构

```
references/DMVideo/backend/
├── core/
│   ├── api/              # 现有 HTTP API（保持不变）
│   ├── draft/           # 现有草稿逻辑（保持不变）
│   ├── mcp/             # 【新增】MCP 层
│   │   ├── __init__.py
│   │   ├── server.py    # MCP Server 主类
│   │   ├── tools.py     # MCP Tool 定义
│   │   ├── auth.py      # API Key 认证（缓存机制）
│   │   └── handlers/    # Tool 处理器
│   │       ├── __init__.py
│   │       ├── draft.py     # 草稿管理
│   │       ├── material.py  # 素材操作
│   │       ├── effect.py    # 特效/滤镜
│   │       └── preset.py    # 预设查询
│   └── ...
├── pjy/
│   └── metadata/        # 现有预设元数据（复用）
│       ├── filter_meta.py
│       ├── video_scene_effect.py
│       ├── transition_meta.py
│       └── ...
└── ...
```

#### 1.3 MCP Tool 接口设计

```typescript
// ==================== 草稿管理 ====================
create_draft(width: number, height: number): { draft_id, message }
save_draft(draft_id: string, client_id?: number): { draft_id, draft_url, message }
delete_draft(draft_id: string): { code, message }
get_template(draft_id: string): { template_data }
generate_jianying_draft(draft_id: string, output_folder: string, draft_name?: string, fps?: number): { folder_path, draft_content }

// ==================== 素材操作 ====================
add_videos(draft_id: string, video_infos: VideoInfo[], mute?: boolean, track_name?: string): { code, message }
add_audios(draft_id: string, audio_infos: AudioInfo[], mute?: boolean, track_name?: string): { code, message }
add_texts(draft_id: string, text_infos: TextInfo[], track_name?: string): { code, message }

// ==================== 素材信息创建 ====================
create_video_info(material_url: string, options?: VideoOptions): VideoInfo
create_audio_info(material_url: string, options?: AudioOptions): AudioInfo
create_text_info(content: string, options?: TextOptions): TextInfo

// ==================== 时间线操作 ====================
generate_timelines(timeline_segment: number[] | TimelineSegmentItem[]): { target }
generate_timelines_by_audio(audio_urls: string[]): { target }

// ==================== 特效/滤镜/转场查询（复用 metadata） ====================
list_filter_presets(): { filters: FilterPreset[] }
list_video_effect_presets(): { effects: EffectPreset[] }
list_transition_presets(): { transitions: TransitionPreset[] }

// ==================== 特效/滤镜生成 ====================
generate_video_effect(effect_type_name: string, params?: number[], segment_ids?: string[], segment_index?: number[]): { effect_ids }
generate_video_filter(filter_type_name: string, intensity?: number, segment_ids?: string[], segment_index?: number[]): { filter_ids }
generate_transition(transition_type_name: string, duration?: number): { transition_id }

// ==================== 音频特效 ====================
generate_audio_effect(audio_ids: string[], effect_type: string, params?: number[], segment_index?: number[]): { effect_ids }

// ==================== 关键帧 ====================
generate_keyframe(segment_ids: string[], property: string, time_offset: number[], value: number[], segment_index: number[]): { keyframe_ids }
generate_audio_keyframe(audio_ids: string[], time_offset: number[], volume: number[], segment_index: number[]): { keyframe_ids }
```

#### 1.4 API Key 认证流程

```
┌─────────────────────────────────────────────────────────────┐
│                    API Key 认证流程                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  客户端                              MCP Server              │
│    │                                    │                   │
│    │  POST /mcp                        │                   │
│    │  Header: X-API-Key: <key>         │                   │
│    │───────────────────────────────────►│                   │
│    │                                    │                   │
│    │                          检查缓存（10分钟有效）         │
│    │                                    │                   │
│    │◄──────────────────────────────────│                   │
│    │  200 OK / 401 Unauthorized         │                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

```python
# core/mcp/auth.py
from datetime import datetime, timedelta
from typing import Optional

class APIKeyAuth:
    """API Key 认证（缓存机制）"""

    def __init__(self, cloud_verify_url: Optional[str] = None):
        self.cloud_verify_url = cloud_verify_url
        self._cache: dict = {}  # {api_key: (is_valid, expire_time)}

    def verify(self, api_key: str) -> bool:
        """验证 API Key（优先使用缓存，10分钟有效）"""
        now = datetime.now()

        # 检查缓存
        if api_key in self._cache:
            is_valid, expire_time = self._cache[api_key]
            if now < expire_time:
                return is_valid

        # 缓存过期或不存在，进行验证
        is_valid = self._verify_remote(api_key)

        # 缓存结果（10分钟有效）
        self._cache[api_key] = (is_valid, now + timedelta(minutes=10))
        return is_valid

    def _verify_remote(self, api_key: str) -> bool:
        """调用云端 API 验证（预留接口）"""
        # TODO: 后续实现云端验证
        # if self.cloud_verify_url:
        #     response = httpx.post(self.cloud_verify_url, json={"api_key": api_key})
        #     return response.json().get("valid", False)
        return True  # 开发阶段默认放行

    def generate_key(self) -> str:
        """生成新的 API Key（用于客户端配置）"""
        import uuid
        return f"jyd_{uuid.uuid4().hex[:24]}"
```

#### 1.5 依赖项

```
# 已有依赖（保持）
fastapi>=0.104.0
uvicorn>=0.24.0
pydantic>=2.0.0
pymediainfo>=5.0.0
imageio>=2.0.0

# 新增依赖
httpx>=0.25.0          # API Key 云端验证（预留）
python-multipart>=0.0.6
```

#### 1.6 实现步骤

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | 在 `core/mcp/` 下创建 MCP 层基础结构 |  |
| 2 | 实现 API Key 认证模块 `auth.py`（缓存机制） | 云端 API 接口（预留） |
| 3 | 实现 MCP Server 主类 `server.py`（支持 stdio + HTTP/SSE） | |
| 4 | 实现草稿管理 Tool 处理器 `handlers/draft.py` | 复用 `core/draft/` |
| 5 | 实现素材操作 Tool 处理器 `handlers/material.py` | 复用 `core/api/router.py` |
| 6 | 实现特效/滤镜查询 `handlers/preset.py` | 复用 `pjy/metadata/` |
| 7 | 实现特效/滤镜生成 `handlers/effect.py` | 复用 `pjy/metadata/` |
| 8 | 编写单元测试 |  |
| 9 | MCP 连接测试（stdio 模式 + HTTP 模式） |  |

#### 1.7 复用关系

| 新增模块 | 复用已有代码 |
|----------|-------------|
| `core/mcp/server.py` | 参考 `mcp/server.py` 实现，改为调用 `core/api/router.py` |
| `core/mcp/handlers/draft.py` | 复用 `core/draft/__init__.py` 中的 `create_draft`, `save_draft` |
| `core/mcp/handlers/material.py` | 复用 `core/api/router.py` 中的素材处理逻辑 |
| `core/mcp/handlers/preset.py` | 复用 `pjy/metadata/filter_meta.py`, `video_scene_effect.py` |
| `core/mcp/handlers/effect.py` | 复用 `pjy/metadata/effect_meta.py` 中的特效生成逻辑 |

#### 1.8 功能验证清单

##### 1.8.1 草稿管理

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T1.1 | create_draft | 调用 `create_draft(width=1920, height=1080)` | 返回 `draft_id`，长度 32 位 |
| T1.2 | save_draft | 调用 `save_draft(draft_id=xxx)` | 返回 `draft_url`，格式 `https://draft.dmaodata.cn/draft/...` |
| T1.3 | delete_draft | 调用 `delete_draft(draft_id=xxx)` | 返回 `code=0` |
| T1.4 | get_template | 调用 `get_template(draft_id=xxx)` | 返回完整的 `template_data` JSON |
| T1.5 | generate_jianying_draft | 调用 `generate_jianying_draft(draft_id, output_folder)` | 生成 `draft_content.json` 和 `draft_meta_info.json` |

##### 1.8.2 素材操作

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T2.1 | add_videos | 调用 `add_videos(draft_id, [video_info])` | 返回 `code=0` |
| T2.2 | add_audios | 调用 `add_audios(draft_id, [audio_info])` | 返回 `code=0` |
| T2.3 | add_texts | 调用 `add_texts(draft_id, [text_info])` | 返回 `code=0` |

##### 1.8.3 素材信息创建

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T3.1 | create_video_info | 调用 `create_video_info(material_url="file:///E:/video/a.mp4")` | 返回完整的 `video_infos` JSON 字符串 |
| T3.2 | create_audio_info | 调用 `create_audio_info(material_url="file:///E:/audio/b.mp3")` | 返回完整的 `audio_infos` JSON 字符串 |
| T3.3 | create_text_info | 调用 `create_text_info(content="测试文本")` | 返回完整的 `text_infos` JSON 字符串 |

##### 1.8.4 时间线操作

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T4.1 | generate_timelines | 调用 `generate_timelines([3000000, 5000000])` | 返回 `target` 包含时间线数据 |
| T4.2 | generate_timelines_by_audio | 调用 `generate_timelines_by_audio([audio_url])` | 自动分析音频时长生成时间线 |

##### 1.8.5 特效/滤镜查询

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T5.1 | list_filter_presets | 调用 `list_filter_presets()` | 返回 220+ 滤镜预设列表 |
| T5.2 | list_video_effect_presets | 调用 `list_video_effect_presets()` | 返回 600+ 视频特效预设列表 |
| T5.3 | list_transition_presets | 调用 `list_transition_presets()` | 返回转场预设列表 |

##### 1.8.6 特效/滤镜生成

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T6.1 | generate_video_effect | 调用 `generate_video_effect("抖动", [50])` | 返回 `effect_ids` 列表 |
| T6.2 | generate_video_filter | 调用 `generate_video_filter("黑白", 80)` | 返回 `filter_ids` 列表 |
| T6.3 | generate_transition | 调用 `generate_transition("淡入淡出", 500000)` | 返回 `transition_id` |

##### 1.8.7 音频特效

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T7.1 | generate_audio_effect | 调用 `generate_audio_effect(audio_ids, "大叔")` | 返回 `effect_ids` 列表 |

##### 1.8.8 关键帧

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T8.1 | generate_keyframe | 调用 `generate_keyframe(segment_ids, "KFTypePositionX", [0], [100], [1])` | 返回 `keyframe_ids` 列表 |
| T8.2 | generate_audio_keyframe | 调用 `generate_audio_keyframe(audio_ids, [0], [1.0], [1])` | 返回 `audio_keyframe_ids` 列表 |

##### 1.8.9 认证机制

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T9.1 | API Key 缓存 | 连续两次调用验证，第二次应命中缓存 | 第二次不调用远程验证 |
| T9.2 | API Key 过期 | 10分钟后再次调用 | 重新进行远程验证（预留） |
| T9.3 | 无效 Key | 传入无效 Key | 返回 `401 Unauthorized` |

##### 1.8.10 通信模式

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T10.1 | stdio 模式 | 通过 stdin/stdout 发送 JSON-RPC 请求 | 正常响应 |
| T10.2 | HTTP/SSE 模式 | POST `/mcp` 端点 | 正常响应 |
| T10.3 | Health 检查 | GET `/health` | 返回 `{"status": "ok"}` |

### Phase 2：Electron 应用骨架

> **重要**：基于 `references/DMVideo/frontend` 已有业务代码进行开发
> - 许可证：闭源，不商用
> - Vue 视图代码保留但不显示功能页面
> - SQLite 表结构和加解密逻辑直接继承
>
> **审计报告**：[phase2-audit.md](phase2-audit.md) — 基于 DMVideo 前端实际代码（preload.ts 100+ IPC、core/ 20 模块、mcp/index.ts Server）的交叉验证结果。
> 开发时请对照审计报告，重点关注：
> - §3.1 IPC 通道设计严重不足（计划 20 个 vs 实际 100+ 个，需重新设计精简方案）
> - §3.2 MCP 传输协议不一致（计划 HTTP/SSE vs 实际 stdio，需同时支持）
> - §3.3 已有 Node.js MCP Server（22 个数据访问工具）未纳入计划
> - §3.4–3.5 目录结构和 core 模块遗漏（pipeline/、ffmpeg/、typings/、httpClient 等 6 个核心依赖）
> - §3.7 Python MCP Server 进程生命周期管理缺失
> - §4 架构决策建议（双 MCP 架构 + 精简 IPC + Agent 主进程运行）

#### 2.1 技术决策

| 问题 | 决策 |
|------|------|
| 构建工具 | vite-electron（直接复用 DMVideo vite.config.js） |
| 渲染框架 | Vue 3 + TypeScript（直接复用） |
| 状态管理 | Pinia（直接复用） |
| 数据库 | SQLite（继承 `database/index.ts` 表结构 + `tokenAesCrypto` 加解密） |
| AI 能力 | bailian（直接复用 `core/bailian.ts`），GLM，Minimax |
| MCP 通信 | HTTP/SSE（Phase 1 决策） |
| 主进程职责 | 核心业务逻辑（可编译字节码保护） |
| REPL 布局 | 底部面板 + 可拖拽调整高度 |

#### 2.2 目录结构设计

```
jy-draft/
├── electron/
│   ├── main.ts              # Electron 主进程入口
│   ├── preload.ts           # 预加载脚本（桥接 IPC）
│   └── mcp/
│       └── client.ts         # MCP Client 实现
├── src/
│   ├── main/                      # Electron 主进程
│   │   ├── index.ts               # vite-electron 主进程入口
│   │   ├── core/                  # 【复用 DMVideo】AI 能力
│   │   │   ├── bailian.ts         # 文本对话、图像理解、视频分析
│   │   │   ├── bailianAudio.ts    # TTS/ASR
│   │   │   ├── videoAnalysis.ts   # 视频分析 + 智能分割
│   │   │   ├── videoMatch.ts      # 关键词匹配视频时间线
│   │   │   ├── oss.ts             # OSS 上传
│   │   │   └── pipeline/          # 步骤编排 + 断点续传
│   │   ├── database/              # 【复用 DMVideo】SQLite 表结构
│   │   │   └── index.ts          # 表结构 + 加解密
│   │   ├── mcp/                   # MCP Client
│   │   │   └── client.ts
│   │   └── ipc/                   # IPC 通道
│   │       └── channels.ts
│   └── renderer/                   # Vue 渲染进程
│       ├── REPL/                   # REPL UI 组件
│       │   ├── ChatWindow.vue
│       │   ├── MessageList.vue
│       │   ├── MessageItem.vue
│       │   ├── PromptInput.vue
│       │   └── DraftCard.vue
│       ├── components/             # 通用组件（保留 Vue 代码，暂不显示）
│       ├── stores/                 # Pinia 状态管理
│       │   ├── conversation.ts
│       │   ├── draft.ts
│       │   └── material.ts
│       └── views/                  # 保留 Vue 代码（暂不显示）
│           ├── draft/
│           ├── material/
│           └── works/
├── package.json
└── vite.config.ts
```

#### 2.3 SQLite 表结构（直接继承）

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `material_text` | 材料库-文案 | content, source |
| `material_video` | 材料库-视频 | file_path, duration, keywords |
| `material_url` | 材料库-作品地址 | url, platform, title |
| `draft_text` | 素材库-文案 | content, source_id |
| `draft_video` | 素材库-视频 | file_path, keywords, use_count |
| `draft_video_keyword` | 视频关键词关联 | video_id, keyword |
| `works` | 作品库 | file_path, platform_url |
| `config` | **配置存储** | key, value（API Key 等加密存储） |
| `voice_clone` | 语音克隆 | voice_id, voice_model_id |
| `text_to_video_task` | 文生视频任务 | draft_text_id, tts/asr/keywords/timelines |
| `material_video_analysis_result` | 视频分析结果 | material_video_id, segments |
| `init_config` | 初始化配置 | init_param, status |
| `place` | 地点数据 | id, parent_id, name |

**加解密逻辑**（`tokenAesCrypto`）：
- AES-128-CBC 与 Java 服务端兼容
- 用于 `config.api_token` 等敏感字段加密存储

#### 2.4 IPC 通道设计

```typescript
// src/main/ipc/channels.ts
export const IPC_CHANNELS = {
  // MCP 连接
  'mcp:connect': (serverUrl: string, apiKey: string) => Promise<void>,
  'mcp:disconnect': () => void,
  'mcp:call-tool': (name: string, args: object) => Promise<unknown>,
  'mcp:list-tools': () => Promise<Tool[]>,

  // AI 能力（复用 core/）
  'ai:chat': (messages: ChatMessage[]) => Promise<ChatResult>,
  'ai:tts': (text: string, voice?: string) => Promise<TtsResult>,
  'ai:asr': (audioPath: string) => Promise<AsrResult>,
  'ai:analyze-video': (videoPath: string) => Promise<VideoAnalysisResult>,
  'ai:analyze-video-segments': (videoPath: string) => Promise<SegmentsResult>,

  // 草稿（通过 MCP）
  'draft:create': (width: number, height: number) => Promise<string>,
  'draft:save': (draftId: string) => Promise<string>,
  'draft:generate': (draftId: string, outputFolder: string) => Promise<string>,
  'draft:list': () => Promise<Draft[]>,

  // 素材（复用 database/）
  'material:add-video': (filePath: string) => Promise<MaterialVideo>,
  'material:add-text': (content: string) => Promise<MaterialText>,
  'material:list': (type: 'video' | 'text' | 'url') => Promise<Material[]>,

  // 配置（复用 database/config 表）
  'config:get': (key: string) => Promise<string | null>,
  'config:set': (key: string, value: string) => Promise<void>,
  'config:get-api-key': () => Promise<string>,  // 自动解密
  'config:set-api-key': (apiKey: string) => Promise<void>,  // 自动加密

  // 窗口管理
  'window:minimize': () => void,
  'window:maximize': () => void,
  'window:close': () => void,
};
```

#### 2.5 MCP Client 实现

```typescript
// src/main/mcp/client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export class JYMCPClient {
  private client: Client;
  private connected: boolean = false;

  async connect(serverUrl: string, apiKey: string): Promise<void> {
    await this.client.connect({
      transport: 'sse',
      url: serverUrl,
      headers: { 'X-API-Key': apiKey }
    });
    this.connected = true;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) throw new Error('MCP Client not connected');
    return this.client.callTool(name, args);
  }

  async listTools(): Promise<Tool[]> {
    return this.client.listTools();
  }

  disconnect(): void {
    this.client.close();
    this.connected = false;
  }
}
```

#### 2.6 REPL UI 布局

```
┌─────────────────────────────────────────────────────────────┐
│  JY Draft                                    [草稿] [设置]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  对话区域（可滚动）                                    │   │
│  │  - AI 响应                                          │   │
│  │  - Tool 调用结果                                     │   │
│  │  - 草稿预览卡片                                      │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  > 请输入...                                  [发送] [⚙]   │
├─────────────────────────────────────────────────────────────┤
│  素材面板（可折叠）                                          │
└─────────────────────────────────────────────────────────────┘
```

#### 2.7 实现步骤

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | 初始化 vite-electron 项目（基于 DMVideo vite.config.js） | |
| 2 | 集成 DMVideo core 模块（copy + 路径调整） | |
| 3 | 集成 DMVideo database 模块（SQLite 表结构 + 加解密） | |
| 4 | 实现 IPC 通道层 | 步骤 2, 3 |
| 5 | 实现 MCP Client | Phase 1 MCP Server |
| 6 | 实现 Electron 主进程入口 | 步骤 4, 5 |
| 7 | 搭建 REPL UI 框架 | |
| 8 | 实现 REPL 组件（ChatWindow, PromptInput, MessageList） | |
| 9 | 实现 Pinia Store | |
| 10 | 集成测试 | |

#### 2.8 复用关系

| 新增模块 | 复用已有代码 |
|----------|-------------|
| `src/main/core/*` | `references/DMVideo/frontend/src/main/core/*` |
| `src/main/database/*` | `references/DMVideo/frontend/src/main/database/*` |
| `src/main/pipeline/*` | `references/DMVideo/frontend/src/main/pipeline/*` |
| `src/main/mcp/client.ts` | 参考 `@modelcontextprotocol/sdk` |
| `src/main/ipc/channels.ts` | 新增，封装 core + MCP 调用 |
| `src/renderer/REPL/*` | 新增 Vue 组件 |
| `src/renderer/stores/*` | 新增 Pinia Store |

#### 2.9 功能验证清单

##### 2.9.1 项目初始化

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P1.1 | vite-electron 启动 | 执行 `npm run dev` | Electron 窗口正常打开，REPL 界面显示 |
| P1.2 | SQLite 数据库初始化 | 首次启动后检查数据库文件 | `jy-draft.db` 创建成功，包含所有表 |
| P1.3 | 配置表初始化 | 查询 `config` 表 | 包含 `video_root_path`, `jianying_draft_path`, `api_token` 等默认配置 |
| P1.4 | DMVideo core 模块加载 | 启动后检查日志 | 无模块加载错误 |

##### 2.9.2 MCP Client

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P2.1 | MCP 连接 | 调用 `mcp:connect` | 成功连接到 Phase 1 MCP Server |
| P2.2 | MCP 断开 | 调用 `mcp:disconnect` | 连接正常关闭 |
| P2.3 | 调用 MCP Tool | 调用 `mcp:call-tool` 执行 `list_filter_presets` | 返回滤镜预设列表 |
| P2.4 | 工具列表查询 | 调用 `mcp:list-tools` | 返回所有可用 Tools |

##### 2.9.3 AI 能力（复用 bailian）

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P3.1 | 文本对话 | 发送 "你好" | 返回 AI 响应 |
| P3.2 | TTS 语音合成 | 调用 `ai:tts`，text="测试文本" | 返回音频文件路径 |
| P3.3 | ASR 语音识别 | 调用 `ai:asr`，传入音频文件 | 返回识别文本 |
| P3.4 | 视频分析 | 调用 `ai:analyze-video` | 返回视频分析结果（关键词/摘要） |

##### 2.9.4 素材管理

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P4.1 | 添加视频素材 | 调用 `material:add-video`，传入本地视频路径 | 返回素材信息（时长、分辨率等） |
| P4.2 | 添加文案素材 | 调用 `material:add-text`，传入文本内容 | 返回素材记录 |
| P4.3 | 素材列表查询 | 调用 `material:list`，type="video" | 返回视频素材列表 |
| P4.4 | 数据库持久化 | 添加素材后重启应用 | 素材数据从数据库恢复 |

##### 2.9.5 草稿管理

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P5.1 | 创建草稿 | 调用 `draft:create`，width=1920, height=1080 | 返回 draft_id |
| P5.2 | 添加视频到草稿 | 调用 `add_videos` 通过 MCP | 视频添加到草稿时间线 |
| P5.3 | 保存草稿 | 调用 `draft:save` | 返回 draft_url |
| P5.4 | 生成剪映草稿 | 调用 `draft:generate` | 在 output_folder 生成 draft_content.json |

##### 2.9.6 REPL UI

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P6.1 | 对话显示 | 发送消息后 | 消息正确显示在对话区域 |
| P6.2 | 消息类型区分 | 发送不同类型消息 | AI 消息、用户消息、Tool 结果样式不同 |
| P6.3 | 草稿预览卡片 | 调用草稿相关 Tool 后 | 显示草稿预览卡片 |
| P6.4 | 发送消息 | 输入文本后点击发送 | 消息发送到 AI 处理 |
| P6.5 | 快捷键支持 | 按 Enter 发送 | 消息正常发送 |
| P6.6 | 素材面板折叠 | 点击折叠按钮 | 素材面板正确折叠/展开 |

##### 2.9.7 配置管理

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P7.1 | 读取配置 | 调用 `config:get`，key="video_root_path" | 返回配置值 |
| P7.2 | 写入配置 | 调用 `config:set` | 配置正确保存到数据库 |
| P7.3 | API Key 加密存储 | 调用 `config:set-api-key` 后直接查看数据库 | 数据库中 value 字段为加密值 |
| P7.4 | API Key 解密读取 | 调用 `config:get-api-key` | 返回解密后的原始 API Key |
| P7.5 | 配置持久化 | 修改配置后重启应用 | 配置值保持不变 |

##### 2.9.8 窗口管理

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P8.1 | 最小化 | 调用 `window:minimize` | 窗口最小化到任务栏 |
| P8.2 | 最大化/还原 | 调用 `window:maximize` | 窗口最大化，再次调用还原 |
| P8.3 | 关闭 | 调用 `window:close` | 窗口关闭，应用退出 |

##### 2.9.9 Electron 构建

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P9.1 | 开发构建 | 执行 `npm run dev` | 开发模式正常启动 |
| P9.2 | 生产构建 | 执行 `npm run build` | 生成可执行文件 |
| P9.3 | 打包验证 | 运行打包后的 .exe | 功能与开发模式一致 |
| P9.4 | 业务代码保护 | 检查打包产物 | 业务 JS 代码被混淆/压缩 |

### Phase 3：核心功能（共 48 个交付任务）

> **任务拆分原则**：每个任务独立可交付、可测试、可 code review

#### Phase 3.1 Permission System（12 tasks）

> **设计参考**：Claude Code Permission System（简化版，保留核心安全机制）
> **核心原则**：按 Tool 名称 + 内容模式匹配，与架构设计 Layer 4 权限系统保持一致

##### 3.1.1 类型设计

```typescript
// ─── 权限模式（全局设置，影响所有权限检查）───
export type PermissionMode =
  | 'default'        // 按规则询问（默认）
  | 'plan'           // 只读模式（进入规划时自动切换，写操作全部 deny）
  | 'acceptEdits'    // 接受写操作（子 Agent 专用，如 DraftBuilder）
  | 'acceptAll'      // 接受所有（保留安全兜底检查）
  | 'denyAll'        // 拒绝所有
  | 'bubble'         // 上浮到父级确认（Fork Agent 专用）
  | 'auto'           // AI 自动判断（预留，第一版不实现）

// ─── 权限行为 ───
export type PermissionBehavior = 'allow' | 'deny' | 'ask'

// ─── 规则来源（优先级从高到低）───
export type PermissionRuleSource =
  | 'session'      // 用户在当前对话中手动授权（"本次会话允许"）
  | 'skill'        // Skill 工具的 allowedTools 白名单
  | 'projectCfg'   // 项目级配置 .jy-draft/settings.json（团队共享）
  | 'userCfg'      // 用户级配置 ~/.jy-draft/settings.json（跨项目）
  | 'builtIn'      // 内置默认规则（不可覆盖）

// ─── 规则匹配类型 ───
export type RuleMatchType =
  | 'exact'        // 精确匹配：toolName 完全相等
  | 'glob'         // 通配符匹配：mcp__draft__* 匹配 Draft Server 所有工具
  | 'prefix'       // 前缀匹配：Bash(prefix:git) 匹配 git push 等

// ─── 规则值 ───
export type PermissionRuleValue = {
  toolName: string           // 工具名称（如 "add_videos"、"mcp__draft"）
  ruleContent?: string       // 内容匹配（可选），如 "*.mp4"、"drafts/**"
  matchType?: RuleMatchType  // 匹配方式，默认 'exact'
}

// ─── 权限规则 ───
export type PermissionRule = {
  source: PermissionRuleSource
  behavior: PermissionBehavior
  value: PermissionRuleValue
  description?: string      // 规则描述（用户手动添加时填写，方便后续管理）
}

// ─── 权限决策 ───
export type PermissionDecision =
  | { behavior: 'allow', updatedInput?: unknown }
  | { behavior: 'deny', message: string, decisionReason?: string }
  | { behavior: 'ask', message: string, options: PermissionOption[], suggestions?: string[] }

// ─── 权限选项 ───
export type PermissionOption =
  | { type: 'allowOnce', label: string }           // 仅本次允许
  | { type: 'allowSession', label: string }         // 本次会话允许
  | { type: 'deny', label: string }                // 拒绝本次
  | { type: 'denySession', label: string }         // 本次会话拒绝

// ─── 权限请求（渲染进程展示用）───
export interface PermissionRequest {
  id: string                   // 请求唯一标识（用于 cancel 和 resolve）
  toolName: string
  input: unknown
  description: string          // 人类可读的操作描述
  riskLevel: 'low' | 'medium' | 'high'  // 风险等级
  timestamp: number
}

// ─── Denial Tracking（死循环防护）───
export interface DenialTrackingState {
  toolName: string
  consecutiveDenials: number   // 连续拒绝次数
  totalDenials: number         // 总拒绝次数
  lastDenialAt: number         // 上次拒绝时间戳
}

export const DENIAL_LIMITS = {
  maxConsecutiveDenials: 3,    // 同一工具连续拒绝上限
  maxTotalDenials: 20,         // 总拒绝上限
  cooldownPeriodMs: 30_000,    // 冷却期 30 秒
}

// ─── Plan Mode 状态 ───
export interface PlanModeState {
  isActive: boolean
  prePlanMode: PermissionMode  // 进入 Plan 前的模式，退出时恢复
}

// ─── Tool 级权限检查钩子接口 ───
export interface ToolPermissionCheck {
  checkPermissions(input: unknown, context: PermissionContext): PermissionDecision
}
```

##### 3.1.2 数据库表设计

```sql
CREATE TABLE permission_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,           -- 工具名称（如 add_videos、mcp__draft__*）
  rule_content TEXT,                  -- 内容匹配（可选，如 *.mp4、drafts/**）
  match_type TEXT NOT NULL DEFAULT 'exact',  -- exact/glob/prefix 匹配方式
  behavior TEXT NOT NULL,            -- allow/deny/ask
  source TEXT NOT NULL,              -- builtIn/userCfg/projectCfg/skill/session
  description TEXT,                   -- 规则描述（用户手动添加时填写）
  created_at INTEGER NOT NULL,       -- 创建时间戳
  expires_at INTEGER                  -- 过期时间戳（可选，session 规则需要）
);

CREATE INDEX idx_permission_rules_tool ON permission_rules(tool_name);
CREATE INDEX idx_permission_rules_source ON permission_rules(source);
CREATE INDEX idx_permission_rules_match ON permission_rules(match_type);

CREATE TABLE permission_mode (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT NOT NULL DEFAULT 'default',  -- default/plan/acceptEdits/acceptAll/denyAll/bubble/auto
  pre_plan_mode TEXT,                     -- 进入 Plan Mode 前的模式（用于退出恢复）
  updated_at INTEGER NOT NULL
);

-- Denial Tracking 表（持久化拒绝计数，支持跨对话统计）
CREATE TABLE permission_denial_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  consecutive_denials INTEGER NOT NULL DEFAULT 0,
  total_denials INTEGER NOT NULL DEFAULT 0,
  last_denial_at INTEGER NOT NULL,
  last_reset_at INTEGER NOT NULL DEFAULT 0,  -- 上次成功后重置时间
  UNIQUE(tool_name)
);

CREATE INDEX idx_denial_tracking_tool ON permission_denial_tracking(tool_name);
```

##### 3.1.3 任务拆解

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P3.1.1 | 权限类型定义 | `types/permission.ts` | - | Mode（含 plan/acceptEdits/bubble）/Behavior/Rule/Decision/Option/DenialTracking/PlanModeState 全部定义完成 |
| P3.1.2 | 权限存储表 | `database/migrations/` | P3.1.1 | permission_rules（含 match_type）+ permission_mode（含 pre_plan_mode）+ permission_denial_tracking 三表创建成功 |
| P3.1.3 | 规则匹配引擎 | `permissions/matcher.ts` | P3.1.1 | 三种匹配模式（exact/glob/prefix）正确工作；MCP Server 级别 `mcp__*__*` 通配符匹配正确 |
| P3.1.4 | 权限核心逻辑 | `permissions/manager.ts` | P3.1.3 | checkPermission() 实现：Mode 检查 → Denial Tracking → 规则匹配 → Tool 级钩子 → 返回决策 |
| P3.1.5 | Denial Tracking | `permissions/denialTracking.ts` | P3.1.2 | recordDenial()/recordSuccess()/shouldFallbackToPrompting() 实现正确；达到上限时向 AI 注入策略变更消息 |
| P3.1.6 | Plan Mode 管理 | `permissions/planMode.ts` | P3.1.2 | enterPlanMode()/exitPlanMode() 正确保存/恢复 prePlanMode；Plan 下写操作自动 Deny |
| P3.1.7 | IPC 权限通道 | `ipc/permission.ts` | P3.1.4 | check / request / response / cancel / rulesChanged 五个通道正常工作 |
| P3.1.8 | 权限弹窗 UI | `components/PermissionDialog.vue` | P3.1.7 | 弹窗显示，四个选项（允许本次/本次会话允许/拒绝本次/本次会话拒绝）+ 查看详情展开 |
| P3.1.9 | 权限规则管理 | `permissions/rules.ts` | P3.1.4 | 规则添加（按 5 种来源）、过期清理、session 规则自动过期、规则 CRUD |
| P3.1.10 | 权限 Store | `stores/permission.ts` | P3.1.8, P3.1.9 | pendingRequests、showDialog、currentMode、planModeState、denialMap 状态正确 |
| P3.1.11 | 默认权限矩阵 | `permissions/defaultRules.ts` | P3.1.4 | 13 个工具的 Default + Plan 模式默认规则注册正确（与架构设计 §7 矩阵一致） |
| P3.1.12 | 集成测试 | `__tests__/permission/` | P3.1.10 | 授权/拒绝/记住/会话过期/Denial Tracking 死循环防护/Plan Mode 切换/规则匹配引擎全流程通过 |

##### 3.1.4 核心检查流程

```
Tool 调用请求
     │
     ▼
PermissionManager.checkPermission(toolName, input)
     │
     ├──► 1. 检查全局 Mode
     │    ├── 'plan'        → 写操作直接 deny，读操作 allow
     │    ├── 'denyAll'     → 返回 deny
     │    ├── 'acceptEdits' → 写操作 allow（Sub-Agent 专用，跳过弹窗）
     │    ├── 'acceptAll'   → 跳到安全兜底检查（保留关键安全检查）
     │    ├── 'bubble'      → 上浮到父级 Agent 的权限上下文确认
     │    └── 'default'/'auto' → 继续后续步骤
     │
     ├──► 2. 安全兜底检查（所有模式下都执行）
     │    ├── 危险路径检查（如尝试写入系统目录）
     │    ├── 内置 deny 规则检查（builtIn 级别，不可覆盖）
     │    └── 命中 → 返回 deny + decisionReason
     │
     ├──► 3. 规则匹配（优先级：session > skill > projectCfg > userCfg > builtIn）
     │    ├── 3a. Deny 规则优先匹配
     │    │    匹配引擎（RuleMatcher）：
     │    │    ├── exact: toolName 完全相等 AND (ruleContent 为空 OR 内容相等)
     │    │    ├── glob:  toolName 支持 mcp__draft__* 通配符，ruleContent 支持 *.mp4 模式
     │    │    └── prefix: toolName 前缀匹配，ruleContent 前缀匹配
     │    │    命中 deny 规则 → 返回 deny
     │    │
     │    ├── 3b. Allow 规则匹配
     │    │    命中 allow 规则 → 返回 allow
     │    │
     │    └── 3c. Ask 规则匹配
     │         命中 ask 规则 → 返回 ask（显示弹窗）
     │
     ├──► 4. Tool 级权限检查钩子
     │    ├── tool.checkPermissions(input, context)
     │    ├── upload_local_material: 文件路径白名单检查
     │    ├── tts_generate: API 配额/成本提示
     │    ├── save_draft: 草稿路径安全检查
     │    └── analyze_video: API 调用成本提示
     │    ↓ 返回 PermissionDecision
     │
     ├──► 5. Denial Tracking 检查
     │    ├── shouldFallbackToPrompting(toolName) → 连续拒绝 ≥ 3 次
     │    │   → 注入消息："上次工具调用被拒绝，请改变策略"
     │    │   → AI 被迫改变策略，避免死循环
     │    └── 达到 maxTotalDenials (20) → 强制终止并通知用户
     │
     └──► 6. 无匹配规则 → 返回 ask（显示弹窗）

用户选择后：
- allowOnce   → 执行 Tool，不存储规则，recordSuccess()
- allowSession → 执行 Tool，存储 session 规则（应用关闭时清除），recordSuccess()
- deny        → 不执行 Tool，recordDenial()，返回拒绝原因
- denySession → 不执行 Tool，存储 session deny 规则，recordDenial()
```

##### 3.1.5 与 Claude Code 的差异

| 维度 | Claude Code | JY Draft |
|------|-------------|----------|
| 存储 | settings JSON 文件 | SQLite（含 denial tracking 持久化） |
| 规则匹配 | glob + prefix + 精确 | glob + prefix + 精确（完整对齐） |
| 来源分层 | 7 级 | 5 级（session/skill/projectCfg/userCfg/builtIn） |
| Denial Tracking | 有（consecutive + total 双重计数） | 有（完整对齐） |
| Plan Mode | 有（prePlanMode 保存/恢复） | 有（完整对齐） |
| Sub-Agent 权限 | 有（独立 permissionMode） | 有（acceptEdits/bubble 模式） |
| 安全兜底 | bypass 模式仍保留安全检查 | acceptAll 模式保留安全兜底 |
| Tool 级钩子 | 有（checkPermissions） | 有（ToolPermissionCheck 接口预留） |
| AI 分类器 | 有（auto 模式） | 预留（第一版不实现） |
| Feedback | Tab 键添加反馈 | 不需要 |
| 导出/导入 | 支持 | 不需要 |

**验收标准**：
1. Tool 调用时弹窗正常显示，四个选项（allowOnce/allowSession/deny/denySession）均可工作
2. 本次会话记住的规则（allow 或 deny）在应用关闭前持续生效
3. Denial Tracking 达到连续 3 次拒绝后向 AI 注入策略变更消息
4. Plan Mode 下写操作自动 Deny，退出后恢复之前的模式
5. 规则匹配引擎正确支持 exact/glob/prefix 三种模式
6. MCP Server 级别通配符规则（如 `mcp__draft__*`）正确匹配

---

#### Phase 3.X 权限集成说明

> 本说明阐述 Permission System（Phase 3.1）如何与 Phase 3.2/3.3/3.4 集成

##### X.1 权限检查介入点

所有 Tool 调用在执行前必须经过 PermissionManager 统一检查：

```
Tool 调用请求（QueryEngine / 直接调用）
         │
         ▼
PermissionManager.checkPermission(toolName, input)
         │
         ├──► allow → 执行 Tool，recordSuccess()
         ├──► deny → 返回拒绝原因（不执行 Tool），recordDenial()
         └──► ask → 弹窗等待用户选择
                   ├──► allowOnce → 执行 Tool（不存储规则），recordSuccess()
                   ├──► allowSession → 执行 Tool（存储 session 规则），recordSuccess()
                   ├──► deny → 返回拒绝原因，recordDenial()
                   └──► denySession → 返回拒绝原因，存储 session deny 规则，recordDenial()
```

##### X.2 各模块权限需求

| 模块 | Tool 调用 | 需要权限检查的场景 | Tool 级钩子逻辑 |
|------|----------|-------------------|----------------|
| **MaterialManager** | addVideo / addAudio / addImage / addText | 用户本地文件路径首次使用 | 文件路径白名单检查 + 格式校验（P3.2.4）|
| | deleteMaterial | 删除用户素材文件 | 二次确认 + 草稿引用检查（P3.2.13） |
| | scanDirectory | 扫描用户指定目录 | 目录权限检查 |
| | analyzeVideo | AI 视频分析（API 调用） | API 成本预估 + 结果确认 |
| | smartSplitVideo | 智能分割（生成新文件） | 分割预览确认 + 磁盘空间检查 |
| **DraftManager** | createDraft | 首次在指定目录创建草稿 | 草稿路径安全检查 |
| | addVideoToDraft / addAudioToDraft | 添加用户素材到草稿 | 素材存在性验证 |
| | exportDraft | 导出草稿到用户指定目录 | 输出路径安全检查 |
| **QueryEngine** | mcp_call_tool | 所有 MCP Tool 调用前统一检查 | 按 MCP Server 级别匹配 |
| | uploadMaterial | 上传用户素材到云端 | API 成本预估 |

##### X.3 权限拒绝时的处理策略

```
Tool 调用被权限系统拒绝后：
1. recordDenial() — 更新 Denial Tracking 计数
2. 检查 Denial Tracking：
   ├──► consecutiveDenials ≥ 3 → 向 AI 注入"请改变策略"消息
   └──► totalDenials ≥ 20 → 强制终止，通知用户
3. 根据拒绝来源处理：
   ├──► 用户主动拒绝 → 返回友好提示，引导用户去设置页面修改权限
   ├──► Plan Mode deny → 提示当前为规划模式，写操作不可用
   ├──► session 规则过期 → 提示用户需要重新授权
   └──► denyAll 模式 → 提示用户当前为拒绝所有模式，需切换
4. 拒绝信息反馈给 AI（如果通过 QueryEngine 调用）
5. UI 显示权限被拒的状态
```

##### X.4 权限与 MCP Client 的交互

```typescript
// IPC 层统一封装权限检查
ipcMain.handle('permission:check', async (_event, toolName, input) => {
  const decision = await permissionManager.checkPermission(toolName, input)
  switch (decision.behavior) {
    case 'allow':
      return executeTool(toolName, input)
    case 'deny':
      recordDenial(toolName)
      return { error: decision.message }
    case 'ask':
      // 通过 IPC 让渲染进程显示弹窗
      const userChoice = await showPermissionDialogViaIPC(toolName, input, decision.options)
      if (userChoice.behavior === 'allow') {
        recordSuccess(toolName)
        return executeTool(toolName, input)
      }
      recordDenial(toolName)
      return { error: '用户拒绝了此操作' }
  }
})

// 取消通道：AI 不再需要该 Tool 时可取消等待中的弹窗
ipcMain.handle('permission:cancel', (_event, requestId) => {
  cancelPendingRequest(requestId)
})

// 规则变更通知：用户在设置页修改规则后通知 QueryEngine 刷新缓存
ipcMain.on('permission:rulesChanged', () => {
  permissionManager.refreshRuleCache()
})
```

##### X.5 权限 Store 与 UI 联动

```
┌─────────────────────────────────────────────────────────────┐
│                     PermissionStore                         │
├─────────────────────────────────────────────────────────────┤
│  state:                                                     │
│    - mode: PermissionMode (含 plan/acceptEdits/bubble)     │
│    - planModeState: PlanModeState                           │
│    - pendingRequests: PermissionRequest[]                  │
│    - showDialog: boolean                                    │
│    - currentRequest: PermissionRequest | null               │
│    - denialMap: Map<string, DenialTrackingState>            │
│                                                              │
│  actions:                                                   │
│    - checkPermission(toolName, input) → Promise<Decision>   │
│    - requestPermission(toolName, input) → void（显示弹窗）  │
│    - resolvePermission(requestId, option) → void            │
│    - cancelRequest(requestId) → void                        │
│    - setMode(mode) → void                                   │
│    - enterPlanMode() → void（保存当前 mode，切换为 plan）   │
│    - exitPlanMode() → void（恢复保存的 mode）               │
│    - recordDenial(toolName) → void                          │
│    - recordSuccess(toolName) → void                         │
└─────────────────────────────────────────────────────────────┘
```

##### X.6 Sub-Agent 权限隔离

子 Agent 拥有独立权限模式，不受主 Agent 当前模式限制：

```typescript
// 为子 Agent 构建独立的权限上下文
function createWorkerPermissionContext(
  agent: AgentDefinition,
  parentContext: PermissionContext
): PermissionContext {
  return {
    ...parentContext,
    mode: agent.permissionMode ?? 'acceptEdits',
    // 继承主 Agent 的已连接 MCP 工具
    inheritedMcpTools: parentContext.mcpTools,
  }
}
```

| Agent | permissionMode | 说明 |
|-------|---------------|------|
| ExploreAgent | `default` | 只读探索，按规则询问 |
| MaterialAnalyst | `default` | 分析素材，按规则询问 |
| DraftBuilder | `acceptEdits` | 写操作自动放行 |
| AudioAgent | `acceptEdits` | 写操作自动放行 |
| PlanAgent | `plan` | 只读，写操作全部 deny |
| ForkAgent | `bubble`（继承父） | 上浮到主终端确认 |

**关键约束**：QueryEngine 不能绕过 PermissionStore 直接调用 MCP Client

---

#### Phase 3.2 MaterialManager（30 tasks）

> **需求确认**：素材来源仅本地文件；回收站+7天清理；使用统计；视频缩略图；批量删除/移动/描述；重命名+别名；文件名重复检测；递归扫描；多种排序；预览播放；存储统计；收藏功能；复制导入；**文本/字幕素材类型**；**格式白名单校验**；**内容 Hash 去重**；**LanceDB 向量语义搜索**；**AI 视频分析/智能分割**；**素材-草稿交叉引用完整性**

> **与架构层对齐**：Layer 4 工具层 `upload_local_material` / `list_local_materials` / `analyze_video`；Multi-Agent MaterialAnalyst 前置依赖；Skill `/smart-analyze` 前置依赖

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| **基础结构** |||||
| P3.2.1 | 目录结构设计 | `config/storage.ts` | - | 素材根目录（按类型分 `/videos/` `/audios/` `/images/` `/texts/`）、`smaterSplit/<yyyy-mm-dd>/`、drafts 目录配置完成 |
| P3.2.2 | 数据库表设计 | `database/migrations/` | - | material_video/audio/image/text 四张表 CREATE TABLE 完整定义（含 file_size、created_at、updated_at、软删除、别名、描述、收藏、统计字段） |
| P3.2.3 | 路径工具函数 | `utils/path.ts` | - | normalizePath/toFileUrl/fromFileUrl 处理 Windows/macOS 差异；统一使用 `file_path` 字段名；支持文件复制/移动 |
| P3.2.4 | 格式白名单校验 | `core/material/validator.ts` | P3.2.3 | 视频(MP4/MOV/AVI/GIF)、音频(MP3/WAV)、图片(JPG/PNG) 格式检测与拒绝；文件大小上限校验（视频 1.5GB） |
| **元数据提取** |||||
| P3.2.5 | 视频元数据提取 | `core/material/video.ts` | P3.2.3 | 提取 duration/width/height/fps/codec/file_size 正确 |
| P3.2.6 | 音频元数据提取 | `core/material/audio.ts` | P3.2.3 | 提取 duration/sampleRate/channels/codec/file_size 正确 |
| P3.2.7 | 图片素材处理 | `core/material/image.ts` | P3.2.3 | 提取 width/height/file_size/format 正确 |
| P3.2.8 | 文本素材处理 | `core/material/text.ts` | P3.2.3 | 文本内容存储、字数统计、来源标记（manual/rewrite/extract）正确 |
| **核心 CRUD** |||||
| P3.2.9 | 添加素材 API | `core/material/manager.ts` | P3.2.4~8 | addVideo/addAudio/addImage/addText 存入 SQLite；文件名+内容 Hash 双重去重；导入时自动生成缩略图 |
| P3.2.10 | 素材列表查询 | `core/material/query.ts` | P3.2.9 | 分页查询、类型过滤、多种排序（时间/名称/使用次数/文件大小）正常 |
| P3.2.11 | 关键词搜索 | `core/material/search.ts` | P3.2.9 | 关键词搜索（file_path、别名、描述、ai_description）正确 |
| P3.2.12 | 语义搜索（LanceDB） | `core/material/vectorSearch.ts` | P3.2.11, P3.2.24 | LanceDB 向量索引构建 + embedding 生成 + 混合搜索（关键词+向量）正确；自然语言 → 语义匹配素材 |
| **删除与回收站** |||||
| P3.2.13 | 素材删除（软删除） | `core/material/delete.ts` | P3.2.10 | 软删除到回收站；**删除前检查草稿引用（draft_materials.material_id）**，被引用时提示用户确认 |
| P3.2.14 | 回收站管理 | `core/material/trash.ts` | P3.2.13 | 回收站列表、恢复、彻底删除；应用启动时检查 7 天过期记录并清理（`onAppReady` 触发） |
| **批量与导入** |||||
| P3.2.15 | 目录扫描导入 | `core/material/scanner.ts` | P3.2.9 | 自动识别目录下素材并导入，支持递归扫描，格式过滤 |
| P3.2.16 | 批量操作 | `core/material/batch.ts` | P3.2.10 | 批量删除、批量移动（移动文件+更新引用路径）、批量设置描述 |
| P3.2.17 | 导入功能 | `core/material/import.ts` | P3.2.4 | 复制导入（从其他位置复制素材到素材库）；**IPC 进度回调**（复制进度+元数据提取进度） |
| **展示与交互** |||||
| P3.2.18 | 视频缩略图 | `core/material/thumbnail.ts` | P3.2.5 | 为视频生成缩略图用于列表预览（**导入时自动生成**，存入 thumbnail_path 字段） |
| P3.2.19 | 素材预览 | `core/material/preview.ts` | P3.2.5~8 | 查看元数据信息、视频预览播放、图片预览；**Electron 自定义协议 `jydraft://` 注册**用于本地文件访问 |
| P3.2.20 | 别名与描述 | `core/material/alias.ts` | P3.2.9 | 别名设置（用于显示和搜索）、描述字段（用户备注 + AI 描述） |
| P3.2.21 | 收藏功能 | `core/material/favorite.ts` | P3.2.10 | 收藏/取消收藏、收藏列表单独展示 |
| P3.2.22 | 存储统计 | `core/material/storageStats.ts` | P3.2.9 | 基于 file_size 字段聚合显示已使用空间大小统计（无需遍历文件系统） |
| P3.2.23 | 素材存在性校验 | `core/material/integrity.ts` | P3.2.10 | 检查素材文件是否仍存在；提供"重新索引"功能修复外部移动/删除的文件引用 |
| **LanceDB 向量搜索** |||||
| P3.2.24 | LanceDB 初始化与 Embedding | `core/material/lanceDB.ts` | P3.2.2 | LanceDB 本地初始化；调用 AI Embedding API 生成素材描述向量；向量索引写入/更新/删除 |
| **AI 视频分析** |||||
| P3.2.25 | AI 视频分析（短视频） | `core/material/analysis.ts` | P3.2.5, P3.2.24 | 2-10s 短视频 → AI 多模态提取文本描述 → 写入 ai_description + 生成 embedding 向量 |
| P3.2.26 | AI 智能分割（长视频） | `core/material/smartSplit.ts` | P3.2.25 | 长视频 → AI 场景检测 → FFmpeg 切割 → 存入 `smaterSplit/<yyyy-mm-dd>/`；分析结果存入 material_analysis_result 表 |
| P3.2.27 | 分析结果存储 | `core/material/analysisStore.ts` | P3.2.25 | material_analysis_result 表（关联素材 ID + 分割片段 JSON + AI 描述 + 关键词）CRUD |
| **交叉集成** |||||
| P3.2.28 | 素材-草稿引用计数 | `core/material/referenceCount.ts` | P3.2.9 | 素材被添加到草稿时 use_count+1；从草稿移除时 use_count-1；硬删除时级联清理引用 |
| P3.2.29 | IPC 素材通道 | `ipc/material.ts` | P3.2.9~28 | add-video/add-text/list/delete/batch/import/search/vector-search/analyze 通道正常工作；**含进度回调通道** |
| P3.2.30 | 集成测试 | `__tests__/material/` | P3.2.29 | 添加/查询/搜索/删除/回收站/批量/导入/向量搜索/AI分析/引用计数全流程通过 |

##### 3.2.A 数据库表完整定义

> **字段命名规范**：统一使用 `file_path`（非 `material_url`），与 DMVideo 参考代码保持一致。所有时间字段使用 Unix 毫秒时间戳。

```sql
-- ==================== 视频素材表 ====================
CREATE TABLE material_video (
  id TEXT PRIMARY KEY,                         -- UUID（客户端生成）
  file_name TEXT NOT NULL,                     -- 文件名（含扩展名）
  file_path TEXT NOT NULL,                     -- 绝对路径（规范化后）
  file_size INTEGER NOT NULL DEFAULT 0,        -- 文件大小（字节）
  content_hash TEXT,                           -- 文件内容 SHA-256（去重用）
  file_format TEXT,                            -- 文件格式（mp4/mov/avi/gif）
  duration INTEGER,                            -- 时长（微秒）
  width INTEGER,                               -- 宽度（px）
  height INTEGER,                              -- 高度（px）
  fps REAL,                                    -- 帧率
  codec TEXT,                                  -- 视频编码（h264/h265）
  alias TEXT,                                  -- 别名（显示名称 + 搜索）
  description TEXT,                            -- 用户备注
  ai_description TEXT,                         -- AI 自动描述
  is_favorite INTEGER NOT NULL DEFAULT 0,      -- 是否收藏（0/1）
  use_count INTEGER NOT NULL DEFAULT 0,        -- 被草稿引用次数
  thumbnail_path TEXT,                         -- 缩略图路径
  is_deleted INTEGER NOT NULL DEFAULT 0,       -- 软删除标记（0/1）
  deleted_at INTEGER,                          -- 删除时间戳
  created_at INTEGER NOT NULL,                 -- 创建时间戳
  updated_at INTEGER NOT NULL                  -- 更新时间戳
);

CREATE INDEX idx_material_video_deleted ON material_video(is_deleted);
CREATE INDEX idx_material_video_favorite ON material_video(is_favorite);
CREATE INDEX idx_material_video_hash ON material_video(content_hash);
CREATE INDEX idx_material_video_created ON material_video(created_at);

-- ==================== 音频素材表 ====================
CREATE TABLE material_audio (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  file_format TEXT,                            -- 文件格式（mp3/wav）
  duration INTEGER,                            -- 时长（微秒）
  sample_rate INTEGER,                         -- 采样率
  channels INTEGER,                            -- 声道数
  codec TEXT,                                  -- 音频编码
  alias TEXT,
  description TEXT,
  ai_description TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_material_audio_deleted ON material_audio(is_deleted);
CREATE INDEX idx_material_audio_favorite ON material_audio(is_favorite);
CREATE INDEX idx_material_audio_hash ON material_audio(content_hash);

-- ==================== 图片素材表 ====================
CREATE TABLE material_image (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  file_format TEXT,                            -- 文件格式（jpg/png）
  width INTEGER,
  height INTEGER,
  alias TEXT,
  description TEXT,
  ai_description TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  thumbnail_path TEXT,                         -- 缩略图（图片可生成压缩版）
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_material_image_deleted ON material_image(is_deleted);
CREATE INDEX idx_material_image_hash ON material_image(content_hash);

-- ==================== 文本素材表 ====================
CREATE TABLE material_text (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,                       -- 文本内容
  char_count INTEGER NOT NULL DEFAULT 0,       -- 字数统计
  source TEXT NOT NULL DEFAULT 'manual',       -- 来源：manual/rewrite/extract/ai
  alias TEXT,
  description TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_material_text_deleted ON material_text(is_deleted);

-- ==================== AI 分析结果表 ====================
CREATE TABLE material_analysis_result (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id TEXT NOT NULL,                   -- 关联素材 ID
  material_type TEXT NOT NULL,                 -- 素材类型（video/audio）
  analysis_type TEXT NOT NULL,                 -- 分析类型：description/smart_split/keyword
  result TEXT NOT NULL,                        -- JSON 结果（描述/分割片段/关键词）
  model_used TEXT,                             -- 使用的 AI 模型
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_analysis_material ON material_analysis_result(material_id);
CREATE UNIQUE INDEX idx_analysis_unique ON material_analysis_result(material_id, analysis_type);
```

##### 3.2.B 素材导入流程

```
用户选择导入素材
         │
         ▼
扫描用户选择的文件/目录
         │
         ▼
格式白名单校验（P3.2.4）+ 文件大小校验
         │
         ├──► 格式不支持 → 提示用户跳过或取消
         │
         ▼
计算文件内容 Hash（SHA-256）
         │
         ▼
检查 content_hash 是否与数据库已有记录重复
         │
         ├──► Hash 重复 → 提示用户"已存在相同内容的素材：{已有名称}"
         │                ├──► 跳过
         │                └──► 仍导入（作为副本）
         │
         ▼
检查 file_name 是否与当前文件夹重复
         │
         ├──► 不重复 → 复制到素材库目录
         │
         └──► 重复 → 自动重命名（追加序号：test(1).mp4）
         │
         ▼
复制文件（IPC 进度回调：已复制/总大小）
         │
         ▼
提取元数据（duration/width/height/codec 等）
         │
         ▼
生成缩略图（视频素材自动生成）
         │
         ▼
写入数据库 + 返回素材 ID
```

##### 3.2.C 回收站清理策略

```
Electron app.on('ready') 触发清理检查
         │
         ▼
查询所有素材表中 deleted_at < (now - 7天) AND is_deleted = 1 的记录
         │
         ▼
检查素材是否被草稿引用（draft_materials.material_id）
         │
         ├──► 被引用 → 跳过（仅删除 DB 记录，保留文件引用警告）
         └──► 未引用 → 彻底删除文件 + 删除数据库记录
```

> **实现方式**：不使用 node-cron 或外部定时库。在 Electron Main Process `app.on('ready')` 时执行一次清理检查；同时通过 Pinia Store 暴露 `manualCleanup()` 方法供用户手动触发。

##### 3.2.D 目录结构规范

> 统一三种来源的目录设计矛盾：按类型优先分层，日期仅在智能分割输出中使用。

```
{素材根目录}/                        ← 用户手动指定
├── videos/                          ← 视频素材
│   ├── original/                    ← 原始导入文件
│   └── smaterSplit/                 ← 智能分割输出
│       └── 2026-04-16/              ← 按日期分目录
│           ├── source_name_0001.mp4
│           └── source_name_0002.mp4
├── audios/                          ← 音频素材
├── images/                          ← 图片素材
└── thumbnails/                      ← 缩略图缓存
    ├── {material_id}.jpg            ← 视频/图片缩略图
    └── ...
```

##### 3.2.E LanceDB 向量搜索设计

```typescript
// core/material/lanceDB.ts

interface MaterialVector {
  id: string              // 素材 ID
  materialType: string    // video/audio/image/text
  embedding: number[]     // AI 生成的向量（维度取决于模型）
  text: string            // 用于生成 embedding 的文本（ai_description + alias + description）
}

// 初始化
const lancedb = await connect('~/.jy-draft/vectors/')  // 本地 LanceDB 路径

// 索引操作
await table.add(vectors)       // 添加向量
await table.delete({id})       // 删除向量
await table.update({id, ...})  // 更新向量

// 搜索：混合策略
async function hybridSearch(query: string, options: SearchOptions): Promise<Material[]> {
  // 1. 关键词搜索（SQLite FTS）
  const keywordResults = await keywordSearch(query)
  // 2. 向量语义搜索（LanceDB）
  const queryEmbedding = await generateEmbedding(query)
  const vectorResults = await table.search(queryEmbedding).limit(20)
  // 3. 合并 + 去重 + 排序（RRF 或加权融合）
  return mergeResults(keywordResults, vectorResults)
}
```

**Embedding 生成策略**：
- 素材导入时：`alias + description + ai_description + file_name` → 生成 embedding
- AI 分析完成时：`ai_description` 更新后重新生成 embedding
- 手动修改描述时：实时更新 embedding

##### 3.2.F AI 视频分析与智能分割设计

```typescript
// core/material/analysis.ts

// 短视频分析（2-10s）
async function analyzeShortVideo(materialId: string): Promise<VideoAnalysisResult> {
  // 1. 调用 AI 多模态 API（bailian/GLM）分析视频内容
  // 2. 提取：场景描述、文本内容、情感标签、推荐用途
  // 3. 写入 material_analysis_result 表
  // 4. 更新 material_video.ai_description
  // 5. 生成 embedding 写入 LanceDB
}

// core/material/smartSplit.ts

// 长视频智能分割
async function smartSplitVideo(materialId: string): Promise<SmartSplitResult> {
  // 1. AI 场景检测 → 识别分割点（时间戳列表）
  // 2. 展示分割预览给用户确认（AskUserQuestion）
  // 3. FFmpeg 按分割点切割 → 输出到 smaterSplit/<yyyy-mm-dd>/
  //    命名：源文件名_<xxxx序号>.后缀（序号4位补0）
  // 4. 每个片段作为新素材导入（继承原素材的 AI 描述）
  // 5. 分割结果存入 material_analysis_result（analysis_type='smart_split'）
}

// 分割片段的 result JSON 结构
interface SmartSplitResult {
  sourceMaterialId: string
  segments: Array<{
    startTime: number           // 微秒
    endTime: number             // 微秒
    outputFileName: string      // 输出文件名
    newMaterialId: string       // 新素材 ID
    sceneDescription: string    // AI 场景描述
  }>
}
```

**验收标准**：
1. 本地视频/音频/图片/文本素材能正确提取元数据并存储
2. 列表查询支持分页/排序/搜索（关键词 + 向量语义混合搜索）
3. 回收站应用启动时自动清理 7 天过期记录
4. AI 视频分析能提取短视频描述并生成 embedding
5. 长视频智能分割能切割视频并作为新素材导入
6. 素材删除前检查草稿引用，被引用时提示用户确认
7. 格式白名单校验拒绝不支持的文件格式
8. 导入时自动生成缩略图，支持文件内容 Hash 去重

---

#### Phase 3.3 DraftManager（22 tasks）

> **设计决策汇总**（2026-04-16 深度分析修订）：
>
> | 决策维度 | 方案 |
> |----------|------|
> | 草稿状态机 | 7 状态（EMPTY/EDITING/DIRTY/SAVED/EXPORTED/ERROR/ARCHIVED），增加 DIRTY 和 ERROR |
> | 数据模型 | 引用+导出解析（存素材 ID，导出时解析为文件路径） |
> | 数据库表 | 4 表（draft_main + draft_tracks + draft_materials + draft_versions） |
> | Track 模型 | 一等实体：draft_tracks 表 + TrackType 6 种（video/audio/text/sticker/effect/filter） |
> | Timeline | 基础操作：generate_timelines + reorderSegments + trimSegment + removeSegment |
> | MCP 交互 | 即时创建 + 本地快照兜底（每次 save 导出本地 JSON 快照，MCP 重启可恢复） |
> | MaterialInfo 构建 | 客户端构建（Electron 提取元数据，构建完整 Info） |
> | 素材类型 | 扩展 MaterialType：video/audio/text/sticker/image（为 Phase 5 effect/filter 预留） |
> | 特效/滤镜/关键帧 | 数据模型预留（material_type 枚举可扩展），具体逻辑延后 Phase 5 |
> | 保存/导出 | 分离（save → MCP Server, export → 剪映 JSON）+ 版本管理 |
> | 列表查询 | 全功能：排序 + 状态过滤 + FTS5 关键词搜索 + 统计信息 |

##### 3.3.1 草稿状态机与核心类型

```typescript
// types/draft.ts

/** 草稿状态（7 种） */
export enum DraftStatus {
  EMPTY    = 'EMPTY',     // 创建后无素材
  EDITING  = 'EDITING',   // 有素材，编辑中（与 MCP 同步）
  DIRTY    = 'DIRTY',     // 本地有未保存修改（需要 saveDraft）
  SAVED    = 'SAVED',     // 已保存到 MCP Server
  EXPORTED = 'EXPORTED',  // 已导出为剪映 JSON
  ERROR    = 'ERROR',     // MCP 调用失败 / 导出异常
  ARCHIVED = 'ARCHIVED',  // 已归档（不活跃）
}

/** 允许的状态转换 */
export const DRAFT_TRANSITIONS: Record<DraftStatus, DraftStatus[]> = {
  EMPTY:    [DraftStatus.EDITING, DraftStatus.ARCHIVED],
  EDITING:  [DraftStatus.DIRTY, DraftStatus.SAVED, DraftStatus.EDITING, DraftStatus.ARCHIVED, DraftStatus.ERROR],
  DIRTY:    [DraftStatus.SAVED, DraftStatus.EDITING, DraftStatus.ERROR, DraftStatus.ARCHIVED],
  SAVED:    [DraftStatus.DIRTY, DraftStatus.EDITING, DraftStatus.EXPORTED, DraftStatus.ARCHIVED, DraftStatus.ERROR],
  EXPORTED: [DraftStatus.DIRTY, DraftStatus.EDITING, DraftStatus.SAVED, DraftStatus.ARCHIVED, DraftStatus.ERROR],
  ERROR:    [DraftStatus.EDITING, DraftStatus.DIRTY],  // 可重试恢复
  ARCHIVED: [DraftStatus.EDITING],  // 恢复归档
}

/** 轨道类型（映射 pjy TrackType） */
export enum TrackType {
  VIDEO  = 'video',
  AUDIO  = 'audio',
  TEXT   = 'text',
  STICKER = 'sticker',
  EFFECT = 'effect',   // Phase 5 实现
  FILTER = 'filter',   // Phase 5 实现
}

/** 素材类型（扩展，兼容 Phase 5） */
export type MaterialType = 'video' | 'audio' | 'text' | 'sticker' | 'image'
// Phase 5 扩展: | 'effect' | 'filter' | 'keyframe'

/** 草稿配置 */
export interface DraftConfig {
  name: string
  width: number     // 默认 1920
  height: number    // 默认 1080
  fps?: number      // 默认 30
  outputFolder?: string  // 导出目录
  description?: string  // 用户描述
}

/** 草稿统计 */
export interface DraftStats {
  videoCount: number
  audioCount: number
  textCount: number
  stickerCount: number
  imageCount: number
  totalDuration: number  // 微秒
  trackCount: number
}
```

**状态转换图**：

```
  ┌────────────────────────────────────────────────────────────┐
  │                                                            │
  ▼                                                            │
EMPTY ──(addMaterial)──► EDITING ◄──────────────────────────┐  │
  │                         │ ▲                              │  │
  │                    (local edit)                          │  │
  │                         │ │(saveDraft)                   │  │
  │                         ▼ │                              │  │
  │                       DIRTY ──(saveDraft)──► SAVED       │  │
  │                         │                    │           │  │
  │                    (MCP error)          (addMaterial)    │  │
  │                         │                    │           │  │
  │                         ▼                    ▼           │  │
  │                       ERROR              EDITING ◄───────┘  │
  │                       │   │                                  │
  │                  (retry) (retry)                              │
  │                       │   │                                  │
  │                       ▼   ▼                                  │
  │                     EDITING/DIRTY                            │
  │                                                              │
  │                        SAVED ──(exportDraft)──► EXPORTED     │
  │                                              │               │
  │                    EXPORTED ──(addMaterial)──► DIRTY         │
  │                                              │               │
  │                                        (archive)            │
  │                                              │               │
  └──────────────────────────────────────────► ARCHIVED ──(restore)──► EDITING
```

##### 3.3.2 数据库表设计

```sql
-- ==================== 草稿主表 ====================
CREATE TABLE draft_main (
  id TEXT PRIMARY KEY,                    -- UUID（客户端生成）
  name TEXT NOT NULL,                     -- 草稿名称
  status TEXT NOT NULL DEFAULT 'EMPTY',   -- DraftStatus 枚举值（7 种）
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  fps INTEGER NOT NULL DEFAULT 30,
  mcp_draft_id TEXT,                      -- MCP Server 返回的 draft_id
  output_folder TEXT,                     -- 导出目录
  thumbnail_path TEXT,                    -- 缩略图路径（导出时自动截取第一帧）
  description TEXT,                       -- 用户/AI 描述
  snapshot_path TEXT,                     -- 本地快照路径（JSON，MCP 恢复用）
  error_message TEXT,                     -- ERROR 状态时的错误详情
  video_count INTEGER DEFAULT 0,          -- 视频素材数（反规范化，addMaterial 递增 / removeMaterial 递减）
  audio_count INTEGER DEFAULT 0,
  text_count INTEGER DEFAULT 0,
  sticker_count INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0,       -- 总时长（微秒）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  exported_at INTEGER                     -- 最后导出时间
);

CREATE INDEX idx_draft_main_status ON draft_main(status);
CREATE INDEX idx_draft_main_updated ON draft_main(updated_at);

-- FTS5 全文搜索索引（支持 listDrafts keyword 搜索）
CREATE VIRTUAL TABLE draft_main_fts USING fts5(
  name,
  description,
  content=draft_main,
  content_rowid=rowid
);

-- ==================== 轨道表（一等实体，映射 pjy Track） ====================
CREATE TABLE draft_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id TEXT NOT NULL REFERENCES draft_main(id) ON DELETE CASCADE,
  track_type TEXT NOT NULL,               -- TrackType: video/audio/text/sticker/effect/filter
  track_name TEXT,                        -- 轨道名（可选，默认按 track_type 自动命名）
  track_index INTEGER NOT NULL DEFAULT 0, -- 轨道顺序（render_index 简化版）
  mute INTEGER NOT NULL DEFAULT 0,        -- 0=未静音, 1=静音
  segment_count INTEGER DEFAULT 0,        -- 轨道内片段数（反规范化）
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_draft_tracks_draft ON draft_tracks(draft_id);
CREATE UNIQUE INDEX idx_draft_tracks_unique ON draft_tracks(draft_id, track_type, track_index);

-- ==================== 草稿素材关联表 ====================
CREATE TABLE draft_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id TEXT NOT NULL REFERENCES draft_main(id) ON DELETE CASCADE,
  track_id INTEGER,                       -- 所属轨道（引用 draft_tracks.id，可选用于 Phase 5 effect/filter）
  material_type TEXT NOT NULL,            -- video/audio/text/sticker/image（Phase 5 扩展: effect/filter/keyframe）
  material_id TEXT,                       -- 引用素材库 ID（可选，AI 生成的无）
  material_url TEXT,                      -- 文件路径/URL（NULLABLE：文本/效果/关键帧无文件）
  segment_id TEXT,                        -- 片段 UUID（pjy segment ID，MCP 返回）
  sort_order INTEGER NOT NULL DEFAULT 0,  -- 轨道内排序（批量添加时自动递增）
  duration INTEGER,                       -- 时长（微秒）
  source_start INTEGER DEFAULT 0,         -- 源裁剪起始（微秒，trim 操作修改此值）
  source_end INTEGER,                     -- 源裁剪结束（微秒）
  start_offset INTEGER DEFAULT 0,         -- 时间线上起始偏移（微秒）
  extra_data TEXT,                        -- JSON：{ style?: TextStyle, transform?: ClipSettings, fade?: AudioFade, ... }
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_draft_materials_draft ON draft_materials(draft_id);
CREATE INDEX idx_draft_materials_type ON draft_materials(material_type);
CREATE INDEX idx_draft_materials_track ON draft_materials(track_id);
CREATE INDEX idx_draft_materials_sort ON draft_materials(draft_id, track_id, sort_order);

-- ==================== 草稿版本表 ====================
CREATE TABLE draft_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id TEXT NOT NULL REFERENCES draft_main(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,        -- 自增版本号
  folder_path TEXT NOT NULL,              -- 导出文件夹路径
  snapshot_json TEXT,                     -- 版本快照 JSON（draft_content.json 内容，回滚用）
  material_refs TEXT,                     -- JSON 数组：版本引用的素材 ID 列表（回滚时校验用）
  file_count INTEGER DEFAULT 0,
  total_size INTEGER DEFAULT 0,
  note TEXT,                              -- 版本备注（用户/AI）
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_draft_versions_draft ON draft_versions(draft_id);
CREATE UNIQUE INDEX idx_draft_versions_unique ON draft_versions(draft_id, version_number);
```

##### 3.3.3 任务拆解（22 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P3.3.1 | 草稿状态机与核心类型 | `types/draft.ts` | - | DraftStatus 7枚举 + DRAFT_TRANSITIONS + TrackType 6种 + MaterialType 5种 + DraftConfig/DraftStats |
| P3.3.2 | 草稿数据库表 | `database/migrations/` | P3.3.1 | draft_main + draft_tracks + draft_materials + draft_versions + FTS5 索引创建成功 |
| P3.3.3 | 创建草稿 | `core/draft/create.ts` | P3.3.1~2 | createDraft(config) → MCP create_draft → 存储 mcp_draft_id → 默认轨道创建 → EMPTY |
| P3.3.4 | MaterialInfo 构建器 | `core/draft/materialInfo.ts` | P3.3.1 | buildVideoInfo/buildAudioInfo/buildTextInfo/buildStickerInfo/buildImageInfo |
| P3.3.5 | 轨道管理 | `core/draft/track.ts` | P3.3.2 | createTrack/getTracks/muteTrack/removeTrack + 自动分配 track_index |
| P3.3.6 | 添加素材（统一） | `core/draft/addMaterial.ts` | P3.3.3~5 | addMaterial → 自动分配轨道 → MCP add_* → 更新本地 + 状态 → EDITING |
| P3.3.7 | 移除素材 | `core/draft/removeMaterial.ts` | P3.3.6 | removeMaterial → MCP remove → 反规范化计数递减 → 状态 → DIRTY |
| P3.3.8 | 时间线操作 | `core/draft/timeline.ts` | P3.3.5 | reorderSegments / trimSegment / generateTimelines（duration-based + begin_time/end_time） |
| P3.3.9 | 草稿元数据更新 | `core/draft/update.ts` | P3.3.2 | updateDraft(draftId, { name?, description?, outputFolder? }) |
| P3.3.10 | 草稿缩略图 | `core/draft/thumbnail.ts` | P3.3.3 | exportDraft 后自动截取第一帧 → 保存 thumbnail_path |
| P3.3.11 | 草稿保存 + 本地快照 | `core/draft/save.ts` | P3.3.6 | saveDraft → MCP save_draft + 本地 JSON 快照(snapshot_path) → SAVED |
| P3.3.12 | 草稿导出 | `core/draft/export.ts` | P3.3.11 | exportDraft → MCP generate_jianying_draft → output_folder → 截取缩略图 → EXPORTED |
| P3.3.13 | 草稿版本管理 | `core/draft/version.ts` | P3.3.12 | 导出自增版本 + snapshot_json + material_refs；listVersions / rollbackVersion |
| P3.3.14 | MCP 恢复机制 | `core/draft/recovery.ts` | P3.3.11 | MCP 重连后读 snapshot_path → 重建 MCP 草稿 → 恢复本地状态 |
| P3.3.15 | 草稿列表 | `core/draft/list.ts` | P3.3.2 | listDrafts: 排序 + 状态过滤 + FTS5 搜索 + 分页 + 统计 |
| P3.3.16 | 草稿删除 | `core/draft/delete.ts` | P3.3.3 | deleteDraft → 先标记 status=ARCHIVED → 确认后 MCP delete + 本地 CASCADE |
| P3.3.17 | 草稿计数校验 | `core/draft/countSync.ts` | P3.3.7, P3.3.13 | recalculateCounts → 从 draft_materials 重算反规范化字段 → 修正 draft_main |
| P3.3.18 | IPC 草稿通道 | `ipc/draft.ts` | P3.3.3~17 | 全部 CRUD + Track + Timeline + Recovery 通道正常 |
| P3.3.19 | Draft Store | `stores/draft.ts` | P3.3.18 | currentDraft + tracks + materials + versions + dirty + error 状态正确 |
| P3.3.20 | 草稿复制 | `core/draft/duplicate.ts` | P3.3.6 | duplicateDraft(draftId) → 克隆本地记录 + 新 MCP 草稿 |
| P3.3.21 | FTS 同步触发器 | `database/triggers/` | P3.3.2 | draft_main INSERT/UPDATE/DELETE 时自动同步 draft_main_fts |
| P3.3.22 | 集成测试 | `__tests__/draft/` | P3.3.19 | 全流程：创建→轨道→素材→时间线→保存→导出→版本→回滚→复制→删除 |

##### 3.3.4 核心流程详解

###### A. 创建草稿流程（含默认轨道）

```
用户/AI: "创建一个 1920x1080 的草稿，名字叫'生日祝福'"
         │
         ▼
DraftManager.createDraft({ name: "生日祝福", width: 1920, height: 1080 })
         │
         ├──► 1. 生成 UUID 作为本地 draft_id
         ├──► 2. 调 MCP create_draft(1920, 1080)
         │        ├── 成功 → 返回 mcp_draft_id
         │        └── 失败 → status=ERROR, 记录 error_message，返回错误
         ├──► 3. 插入 draft_main 表（status=EMPTY, mcp_draft_id）
         ├──► 4. 创建默认轨道（映射 pjy TrackType）：
         │        INSERT draft_tracks: (video, index=0), (audio, index=0), (text, index=0)
         │        （sticker/effect/filter 轨道在添加对应素材时按需创建）
         └──► 5. 返回 { draft_id, mcp_draft_id, status: EMPTY, tracks: [video, audio, text] }
```

###### B. 添加素材流程（含轨道分配）

```
用户/AI: "添加 E:\videos\birthday.mp4 到草稿"
         │
         ▼
DraftManager.addMaterial(draft_id, 'video', [
  { material_url: 'file:///E:/videos/birthday.mp4' }
])
         │
         ├──► 1. 状态检查（EMPTY/EDITING/SAVED/EXPORTED → DIRTY 或 EDITING）
         ├──► 2. 查找或创建轨道：
         │        SELECT FROM draft_tracks WHERE draft_id=? AND track_type='video'
         │        └── 不存在 → createTrack(draft_id, 'video') → MCP add_track
         ├──► 3. 调 buildVideoInfo(material_url) → VideoInfo
         │        ├── Electron 读取文件元数据（duration/width/height/fps）
         │        └── 构建 MCP 格式的 VideoInfo JSON
         ├──► 4. 调 MCP add_videos(mcp_draft_id, [videoInfo])
         │        └── 成功 → 获取 segment_id
         │            失败 → status=ERROR, 记录 error_message, 事务回滚
         ├──► 5. 插入 draft_materials 表（track_id, segment_id, sort_order=MAX+1）
         ├──► 6. 更新反规范化字段：
         │        UPDATE draft_main SET video_count=video_count+1, total_duration=total_duration+duration
         │        UPDATE draft_tracks SET segment_count=segment_count+1 WHERE id=track_id
         ├──► 7. 状态转换：EMPTY → EDITING；SAVED/EXPORTED → DIRTY
         └──► 8. 返回 { success: true, segment_id }
```

###### C. 时间线操作流程

```
// C1: 生成时间线（按时长）
DraftManager.generateTimelines(durations: [3000000, 7000000, 2000000])
         │
         └──► 返回 [{ start: 0, duration: 3000000 }, { start: 3000000, duration: 7000000 }, ...]

// C2: 生成时间线（按 begin_time/end_time）
DraftManager.generateTimelines(segments: [{ begin_time: 2300000, end_time: 4600000 }, ...])

// C3: 裁剪片段（trim）
DraftManager.trimSegment(draft_id, material_id, { source_start: 1000000, source_end: 5000000 })
         │
         ├──► 1. 更新 draft_materials SET source_start=?, source_end=?
         ├──► 2. 调 MCP 修改 segment 的 source_timerange
         ├──► 3. 重算 total_duration
         └──► 4. 状态 → DIRTY

// C4: 重排序片段
DraftManager.reorderSegments(draft_id, track_id, newOrder: [id3, id1, id2])
         │
         ├──► 1. UPDATE draft_materials SET sort_order=新序 WHERE id IN (...)
         ├──► 2. MCP 同步排序
         └──► 3. 状态 → DIRTY

// C5: 移除素材
DraftManager.removeMaterial(draft_id, material_id)
         │
         ├──► 1. 查询 material 记录（type, track_id, duration）
         ├──► 2. 调 MCP remove segment
         ├──► 3. DELETE draft_materials WHERE id=?
         ├──► 4. 反规范化递减：video_count-- / audio_count-- / segment_count--
         ├──► 5. 重算 total_duration
         └──► 6. 状态 → DIRTY
```

###### D. 保存 + 导出 + 本地快照流程

```
// 保存（含本地快照）
DraftManager.saveDraft(draft_id)
         │
         ├──► 1. 状态检查（EDITING/DIRTY 才能保存）
         ├──► 2. 调 MCP save_draft(mcp_draft_id)
         ├──► 3. 生成本地快照 JSON：
         │        ├── 查询 draft_tracks + draft_materials
         │        ├── 组装为 { canvas, tracks: [...], materials: [...] } 结构
         │        └── 写入 {userData}/drafts/{draft_id}/snapshot.json
         ├──► 4. UPDATE draft_main SET snapshot_path=?, status=SAVED
         └──► 5. 状态转换：EDITING/DIRTY → SAVED

// 导出
DraftManager.exportDraft(draft_id)
         │
         ├──► 1. 状态检查（SAVED 才能导出）
         ├──► 2. 调 MCP generate_jianying_draft(mcp_draft_id, output_folder)
         │        └──► 生成 draft_content.json + draft_meta_info.json
         ├──► 3. 截取缩略图：FFmpeg 取第一帧 → thumbnail_path
         ├──► 4. 插入 draft_versions（version_number 自增, snapshot_json=导出JSON内容, material_refs=素材ID列表）
         ├──► 5. UPDATE draft_main SET exported_at=now, status=EXPORTED
         └──► 6. 返回 { folder_path, version_number, thumbnail_path }
```

###### E. 版本回滚流程（含素材完整性校验）

```
用户/AI: "回滚到版本 1"
         │
         ▼
DraftManager.rollbackVersion(draft_id, 1)
         │
         ├──► 1. 查询 draft_versions 获取 v1：
         │        SELECT snapshot_json, material_refs FROM draft_versions
         │        WHERE draft_id=? AND version_number=1
         ├──► 2. 素材完整性校验：
         │        ├── 解析 material_refs JSON → material_id[]
         │        ├── 检查每个 material_id 在 material_* 表中是否存在
         │        └── 缺失素材 → 列出警告，询问用户是否继续
         ├──► 3. 清空当前数据：
         │        DELETE FROM draft_materials WHERE draft_id=?
         │        DELETE FROM draft_tracks WHERE draft_id=?
         ├──► 4. 从 snapshot_json 重建：
         │        ├── 解析 tracks[] → INSERT draft_tracks
         │        ├── 解析 materials[] → INSERT draft_materials
         │        └── 重算反规范化字段（recalculateCounts）
         ├──► 5. MCP 重建：调 MCP create_draft + 重新 add 所有素材
         ├──► 6. UPDATE draft_main SET status=EDITING
         └──► 7. 返回 { draft_id, restored_from_version: 1, missing_materials: [...] }
```

###### F. MCP 恢复流程

```
// 场景：MCP Server 重启后，12h 缓存丢失
DraftManager.recoverFromSnapshot(draft_id)
         │
         ├──► 1. 读取 snapshot_path 的本地快照 JSON
         ├──► 2. 调 MCP create_draft(width, height) → 新 mcp_draft_id
         ├──► 3. 按快照顺序重建：
         │        ├── 遍历 tracks → MCP add_track
         │        ├── 遍历 materials → MCP add_videos/audios/texts
         │        └── 每次 add 记录新 segment_id
         ├──► 4. UPDATE draft_main SET mcp_draft_id=新值, status=EDITING
         └──► 5. 返回 { recovered: true, new_mcp_draft_id }
```

###### G. 轨道管理流程

```typescript
// core/draft/track.ts

/** 创建轨道（若不存在） */
async function ensureTrack(draftId: string, trackType: TrackType): Promise<DraftTrack> {
  const existing = await db.get(
    'SELECT * FROM draft_tracks WHERE draft_id = ? AND track_type = ? ORDER BY track_index LIMIT 1',
    [draftId, trackType]
  )
  if (existing) return existing

  const trackIndex = await getNextTrackIndex(draftId, trackType)
  // MCP 侧：轨道在 add_videos/audios/texts 时自动创建，无需显式调用
  return await db.insert('draft_tracks', {
    draft_id: draftId, track_type: trackType,
    track_index: trackIndex, mute: 0, segment_count: 0
  })
}

/** 轨道静音/取消静音 */
async function muteTrack(trackId: number, mute: boolean): Promise<void>

/** 删除空轨道（segment_count === 0） */
async function removeEmptyTrack(trackId: number): Promise<void>
```

###### H. 删除草稿流程（安全两步）

```
DraftManager.deleteDraft(draft_id)
         │
         ├── Step 1: 软删除（用户点击删除时）
         │    ├── UPDATE draft_main SET status='ARCHIVED'
         │    └── 前端从列表移除
         │
         ├── Step 2: 硬删除（用户确认 或 7天后自动清理）
         │    ├── 调 MCP delete_draft(mcp_draft_id)
         │    │   ├── 成功 → 本地 CASCADE DELETE（draft_tracks + draft_materials + draft_versions）
         │    │   └── 失败 → 仅删除本地记录，记录 warning log（MCP 侧缓存会自动过期）
         │    ├── 删除 output_folder 下的导出文件
         │    └── 删除 snapshot_path 快照文件
```

##### 3.3.5 MaterialInfo 构建器接口

```typescript
// core/draft/materialInfo.ts

/** 视频素材元数据（Electron 端提取） */
export interface VideoMaterialMeta {
  material_url: string        // file:///E:/videos/test.mp4
  duration: number            // 微秒
  width: number
  height: number
  fps: number
  codec?: string
}

/** 构建 MCP 格式的 VideoInfo */
export function buildVideoInfo(meta: VideoMaterialMeta, options?: {
  mute?: boolean
  volume?: number
  start_time?: number         // 微秒，裁剪起始
  end_time?: number           // 微秒，裁剪结束
  speed?: number              // 播放速度
  fade_in?: number            // 微秒
  fade_out?: number           // 微秒
}): string  // 返回 JSON 字符串

/** 构建 MCP 格式的 AudioInfo */
export function buildAudioInfo(meta: AudioMaterialMeta, options?: {
  volume?: number
  start_time?: number
  end_time?: number
  speed?: number
  fade_in?: number
  fade_out?: number
}): string

/** 构建 MCP 格式的 TextInfo（完整样式，映射 pjy TextSegment） */
export function buildTextInfo(content: string, options?: {
  font_size?: number          // 默认 8.0（pjy 单位）
  font_color?: [number, number, number]  // RGB 0-1
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: number              // 0=left, 1=center, 2=right
  font_family?: string        // 默认 "PingFang SC"
  duration?: number           // 微秒
  position?: { x: number, y: number }
  border?: { width: number, color: [number, number, number] }
  background?: { color: string, alpha: number, round_radius: number }
  shadow?: { color: string, offset_x: number, offset_y: number, blur: number }
}): string

/** 构建 MCP 格式的 StickerInfo */
export function buildStickerInfo(resourceId: string, options?: {
  duration?: number           // 微秒
  position?: { x: number, y: number }
  scale?: number
}): string

/** 构建 MCP 格式的 ImageInfo（图片作为单帧视频） */
export function buildImageInfo(meta: { url: string, width: number, height: number }, options?: {
  duration?: number           // 微秒，默认 3000000 (3s)
  position?: { x: number, y: number }
  scale?: number
}): string
```

**元数据提取方式**（Electron 端）：
- 视频：`ffprobe` 或 `fluent-ffmpeg` 提取 duration/width/height/fps/codec
- 音频：`ffprobe` 提取 duration/sampleRate/channels/codec
- 图片：`sharp` 或 `image-size` 提取 width/height
- 文本：无需提取，用户/AI 指定内容和样式参数
- 贴纸：resource_id 引用剪映内置贴纸库

##### 3.3.6 IPC 通道设计

```typescript
// ipc/draft.ts
export const DRAFT_IPC_CHANNELS = {
  // 草稿 CRUD
  'draft:create':   (config: DraftConfig) => Promise<DraftInfo>,
  'draft:delete':   (draftId: string, hard?: boolean) => Promise<void>,
  'draft:get':      (draftId: string) => Promise<DraftInfo | null>,
  'draft:list':     (query: DraftListQuery) => Promise<PaginatedResult<DraftInfo>>,
  'draft:update':   (draftId: string, updates: Partial<Pick<DraftConfig, 'name' | 'description' | 'outputFolder'>>) => Promise<void>,
  'draft:duplicate': (draftId: string, newName?: string) => Promise<DraftInfo>,

  // 轨道操作
  'draft:get-tracks': (draftId: string) => Promise<DraftTrack[]>,
  'draft:mute-track': (trackId: number, mute: boolean) => Promise<void>,

  // 素材操作
  'draft:add-material':    (draftId: string, type: MaterialType, items: MaterialItem[]) => Promise<void>,
  'draft:remove-material': (draftId: string, materialId: number) => Promise<void>,

  // 时间线操作
  'draft:generate-timelines': (segments: TimelineSegment[]) => Promise<TimelineSlot[]>,
  'draft:reorder-segments':   (draftId: string, trackId: number, newOrder: number[]) => Promise<void>,
  'draft:trim-segment':       (draftId: string, materialId: number, trim: TrimOptions) => Promise<void>,

  // 保存/导出
  'draft:save':   (draftId: string) => Promise<void>,
  'draft:export': (draftId: string) => Promise<ExportResult>,

  // 版本管理
  'draft:list-versions':  (draftId: string) => Promise<DraftVersion[]>,
  'draft:rollback':       (draftId: string, versionNumber: number) => Promise<RollbackResult>,

  // MCP 恢复
  'draft:recover': (draftId: string) => Promise<RecoveryResult>,

  // 统计
  'draft:stats': (draftId: string) => Promise<DraftStats>,
}

interface DraftListQuery {
  page?: number
  pageSize?: number
  sort?: 'created_at' | 'updated_at' | 'name'
  sortOrder?: 'asc' | 'desc'
  status?: DraftStatus
  keyword?: string
}

interface ExportResult {
  folderPath: string
  versionNumber: number
  fileCount: number
  totalSize: number
  thumbnailPath: string
}

interface RollbackResult {
  draftId: string
  restoredFromVersion: number
  missingMaterials: string[]  // 缺失的素材 ID
}

interface RecoveryResult {
  recovered: boolean
  newMcpDraftId: string
}

interface TrimOptions {
  sourceStart: number   // 微秒
  sourceEnd: number     // 微秒
}

type TimelineSegment =
  | number  // duration 微秒
  | { begin_time: number, end_time: number }

interface TimelineSlot {
  start: number     // 微秒
  duration: number  // 微秒
}
```

##### 3.3.7 Draft Store 设计

```typescript
// stores/draft.ts

export interface DraftState {
  // 当前编辑的草稿
  currentDraft: DraftInfo | null
  currentTracks: DraftTrack[]           // 当前草稿的轨道列表
  currentMaterials: DraftMaterial[]     // 当前草稿的素材列表

  // 草稿列表
  drafts: DraftInfo[]
  totalDrafts: number
  listQuery: DraftListQuery

  // 版本历史
  versions: DraftVersion[]

  // 加载状态
  isLoading: boolean
  isExporting: boolean
  isDirty: boolean                      // 本地有未保存修改
  error: string | null                  // ERROR 状态详情
  mcpConnected: boolean                 // MCP Server 连接状态
}

export const useDraftStore = defineStore('draft', {
  state: (): DraftState => ({ ... }),
  actions: {
    // CRUD
    async createDraft(config: DraftConfig): Promise<DraftInfo>,
    async deleteDraft(draftId: string, hard?: boolean): Promise<void>,
    async updateDraft(draftId: string, updates: Partial<DraftConfig>): Promise<void>,
    async duplicateDraft(draftId: string, newName?: string): Promise<DraftInfo>,
    async loadDraft(draftId: string): Promise<void>,  // 设为 currentDraft + tracks + materials
    async listDrafts(query?: Partial<DraftListQuery>): Promise<void>,

    // 轨道
    async muteTrack(trackId: number, mute: boolean): Promise<void>,

    // 素材
    async addMaterial(type: MaterialType, items: MaterialItem[]): Promise<void>,
    async removeMaterial(materialId: number): Promise<void>,

    // 时间线
    async reorderSegments(trackId: number, newOrder: number[]): Promise<void>,
    async trimSegment(materialId: number, trim: TrimOptions): Promise<void>,

    // 保存/导出
    async saveCurrentDraft(): Promise<void>,
    async exportCurrentDraft(): Promise<ExportResult>,

    // 版本
    async loadVersions(draftId: string): Promise<void>,
    async rollbackVersion(versionNumber: number): Promise<RollbackResult>,

    // MCP 恢复
    async recoverDraft(draftId: string): Promise<RecoveryResult>,
  },
  getters: {
    draftStats: (state): DraftStats | null => { ... },
    canSave: (state): boolean => ['EDITING', 'DIRTY'].includes(state.currentDraft?.status ?? ''),
    canExport: (state): boolean => state.currentDraft?.status === 'SAVED',
    canEdit: (state): boolean => ['EMPTY', 'EDITING', 'DIRTY', 'SAVED', 'EXPORTED'].includes(state.currentDraft?.status ?? ''),
    isDirty: (state): boolean => state.currentDraft?.status === 'DIRTY',
    hasError: (state): boolean => state.currentDraft?.status === 'ERROR',
  },
})
```

##### 3.3.8 与 Phase 3.1（权限）的集成

| 操作 | 需要权限检查 | 权限模式 | 说明 |
|------|:----:|----------|------|
| createDraft | ✗ | - | 创建操作无破坏性 |
| addMaterial | ✗ | - | 访问用户已导入的素材库 |
| removeMaterial | ✓ | Ask | 移除素材需确认 |
| saveDraft | ✗ | - | MCP Server 内部操作 |
| exportDraft | ✓ | Ask | 写入文件到用户目录，需确认路径 |
| updateDraft | ✗ | - | 修改名称/描述无破坏性 |
| deleteDraft | ✓ | Confirm | 软删除→确认硬删除，不可逆操作 |
| rollbackVersion | ✓ | Confirm | 版本回滚可能丢失当前修改 |
| duplicateDraft | ✗ | - | 复制操作无破坏性 |
| muteTrack | ✗ | - | 静音操作可恢复 |
| reorderSegments | ✗ | - | 排序操作可撤销 |
| trimSegment | ✗ | - | 裁剪操作可重新调整 |
| recoverDraft | ✓ | Ask | MCP 恢复可能覆盖当前状态 |

##### 3.3.9 功能验证清单

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| D1.1 | 创建草稿 | createDraft({ name: "test", width: 1920, height: 1080 }) | draft_main + 默认 3 轨道 + status=EMPTY |
| D1.2 | 创建草稿（MCP 失败） | MCP Server 未启动时创建 | status=ERROR + error_message 记录 |
| D2.1 | 添加视频 | addMaterial(draft_id, 'video', [{ url: "file:///E:/test.mp4" }]) | draft_materials + draft_tracks(video) + video_count=1 + EDITING |
| D2.2 | 添加音频 | addMaterial(draft_id, 'audio', [{ url: "file:///E:/test.mp3" }]) | draft_materials + audio_count=1 |
| D2.3 | 添加文本 | addMaterial(draft_id, 'text', [{ content: "Hello" }]) | draft_materials + text_count=1 |
| D2.4 | 添加贴纸 | addMaterial(draft_id, 'sticker', [{ resource_id: "xxx" }]) | draft_materials + sticker_count=1 |
| D2.5 | 添加图片 | addMaterial(draft_id, 'image', [{ url: "file:///E:/test.png" }]) | draft_materials + image_count=1 |
| D2.6 | 批量添加 | addMaterial(draft_id, 'video', [url1, url2, url3]) | 3 条记录，sort_order = 1, 2, 3 |
| D3.1 | 移除素材 | removeMaterial(draft_id, material_id) | video_count-- + segment_count-- + status=DIRTY |
| D3.2 | 裁剪片段 | trimSegment(draft_id, material_id, { source_start: 1000000, source_end: 5000000 }) | source_start/end 更新 + DIRTY |
| D3.3 | 重排序 | reorderSegments(draft_id, track_id, [3, 1, 2]) | sort_order 更新 + DIRTY |
| D4.1 | 保存草稿 | saveDraft(draft_id) | MCP save + 本地 snapshot.json + status=SAVED |
| D4.2 | 导出草稿 | exportDraft(draft_id) | draft_content.json + thumbnail + version=1 + EXPORTED |
| D4.3 | 版本自增 | 连续导出两次 | version_number 为 1, 2 |
| D5.1 | 版本回滚（正常） | rollbackVersion(draft_id, 1) | 草稿恢复到 v1 + missingMaterials=[] |
| D5.2 | 版本回滚（素材缺失） | v1 引用的素材已删除 | missingMaterials=[id1, id2] 警告 |
| D6.1 | MCP 恢复 | MCP 重启后 recoverDraft(draft_id) | 新 mcp_draft_id + 状态恢复为 EDITING |
| D6.2 | MCP 恢复（无快照） | snapshot_path 不存在 | 返回错误，需手动重建 |
| D7.1 | 草稿列表（全部） | listDrafts({}) | 返回所有草稿含统计 |
| D7.2 | 按状态过滤 | listDrafts({ status: 'EXPORTED' }) | 只返回已导出的草稿 |
| D7.3 | FTS5 搜索 | listDrafts({ keyword: "生日" }) | FTS5 搜索 name+description |
| D7.4 | 排序 | listDrafts({ sort: 'updated_at', sortOrder: 'desc' }) | 按更新时间倒序 |
| D8.1 | 软删除 | deleteDraft(draft_id) | status=ARCHIVED |
| D8.2 | 硬删除 | deleteDraft(draft_id, true) | CASCADE 删除 + MCP delete + 文件清理 |
| D9.1 | 状态转换（正常） | EMPTY → EDITING → DIRTY → SAVED → EXPORTED | 每步转换正确 |
| D9.2 | 状态转换（非法） | EMPTY → SAVED 直接跳转 | 抛出 DraftStatusError |
| D9.3 | 重新编辑 | EXPORTED → addMaterial → DIRTY | DIRTY 状态正确 |
| D9.4 | ERROR 恢复 | ERROR → retry saveDraft → SAVED | 从错误恢复 |
| D10.1 | 草稿复制 | duplicateDraft(draft_id, "copy") | 新 draft_id + 相同轨道和素材 |
| D10.2 | 元数据更新 | updateDraft(draft_id, { name: "new name" }) | name 更新 |
| D10.3 | 轨道静音 | muteTrack(track_id, true) | mute=1 + MCP 同步 |

**验收标准**：
1. 能生成可被剪映打开的 draft_content.json
2. MCP 断线后可通过本地快照恢复
3. 反规范化计数与实际素材数一致
4. 版本回滚时检测缺失素材并警告

---

#### Phase 3.4 QueryEngine（20 tasks）

> **设计决策汇总**（2026-04-16 深度分析修订）：
>
> | 决策维度 | 方案 |
> |----------|------|
> | 对话循环 | ReAct 循环 + 完整终止条件（completed/aborted/max_turns/budget_exceeded/error） |
> | 意图识别 | LLM Function Calling（Tool 注册为 functions，意图+选择一步完成） |
> | 上下文管理 | 4 层渐进管道完整实现（Microcompact → SessionMemory → Autocompact → **Reactive Compact**） |
> | 消息结构 | Claude Code 同款：内部 content blocks + API 适配层转 OpenAI 格式 |
> | 流式响应 | 文本流式 + **Streaming Tool Execution**（工具边流边执行，并发安全） |
> | Tool 编排 | 混合模式（concurrency-safe 并行，非安全串行）+ per-tool AbortController |
> | 错误恢复 | 4 层恢复：Withholding → Context Collapse → Reactive Compact → Fallback Model |
> | 会话持久化 | JSONL 格式，支持 session 恢复 + parent UUID 链 |
> | Multi-Agent | AgentTool 集成：独立 tool pool + permission context + depth tracking |
> | System Prompt | 动态构建 + tool JSON Schema + JY 域知识 + 记忆上下文 |
> | REPL | 完整 REPL（ChatWindow + PromptInput + StatusBar + PermissionDialog + VirtualScroll + Progress） |
> | Token Budget | 按 model 动态管理（available = model_max - system_prompt - response_reserve） |
> | Abort 机制 | 层级 AbortController（parent → child → per-tool），WeakRef 防泄漏 |

##### 3.4.1 消息结构与核心类型

参考 Claude Code `src/types/message.ts`，内部采用 content blocks 格式：

```typescript
// types/message.ts

/** 角色类型 */
export type Role = 'system' | 'user' | 'assistant' | 'tool'

/** Content Block 类型 */
export type ContentBlockType =
  | 'text'
  | 'tool_use'      // assistant 输出的 tool_call
  | 'tool_result'   // tool 执行结果
  | 'image'         // 图片内容（用户上传素材图片）

/** Text Block */
export interface TextBlock {
  type: 'text'
  text: string
}

/** Image Block（用户上传图片） */
export interface ImageBlock {
  type: 'image'
  source: {
    type: 'base64'
    media_type: 'image/png' | 'image/jpeg' | 'image/webp'
    data: string  // base64
  }
}

/** Tool Use Block（assistant 消息中的 tool_call） */
export interface ToolUseBlock {
  type: 'tool_use'
  id: string           // UUID v4
  name: string         // Tool 名称，如 'add_videos'
  input: Record<string, unknown>  // Tool 输入参数
}

/** Tool Result Block */
export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ImageBlock

/** 内部消息格式 */
export interface ConversationMessage {
  id: string                // UUID v4
  role: Role
  content: ContentBlock[]   // content blocks 数组（非 string）
  name?: string             // tool 消息的 tool_name
  timestamp: number
  parentUuid?: string       // 用于 JSONL 持久化的 UUID 链
  metadata?: {
    denied?: boolean
    toolName?: string
    finishReason?: string
    isMeta?: boolean        // 系统元消息（compaction summary 等）
    isApiErrorMessage?: boolean
  }
}

/** API 层消息格式（OpenAI 兼容） */
export interface ApiMessage {
  role: Role
  content: string | null
  name?: string
  tool_calls?: ApiToolCall[]
  tool_call_id?: string
}

export interface ApiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

// ---- Agentic Loop 核心类型 ----

/** 循环终止原因 */
export type LoopExitReason =
  | 'completed'             // AI 正常回复，无 tool_use
  | 'aborted_streaming'     // 用户中断（流式阶段）
  | 'aborted_tools'         // 用户中断（tool 执行阶段）
  | 'prompt_too_long'       // 上下文溢出（所有恢复手段都失败）
  | 'max_turns'             // 达到最大 turn 限制
  | 'budget_exceeded'       // Token budget 耗尽
  | 'model_error'           // API 错误（无 fallback 可用）
  | 'stop_hook_prevented'   // Stop hook 阻止继续

/** Loop 返回值 */
export interface LoopResult {
  reason: LoopExitReason
  totalTurns: number
  totalTokens: { input: number; output: number }
  totalCost: number
}

/** 模型配置（per-model token limits） */
export interface ModelConfig {
  id: string                // 'glm-4-flash', 'minimax-01', etc.
  maxContextTokens: number  // 模型上下文窗口
  maxOutputTokens: number   // 单次最大输出
  inputCostPer1k: number    // 每 1k token 输入费用
  outputCostPer1k: number   // 每 1k token 输出费用
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'glm-4-flash':    { id: 'glm-4-flash',    maxContextTokens: 128000, maxOutputTokens: 4096,  inputCostPer1k: 0.0001, outputCostPer1k: 0.0001 },
  'minimax-01':     { id: 'minimax-01',     maxContextTokens: 32000,  maxOutputTokens: 4096,  inputCostPer1k: 0.001,  outputCostPer1k: 0.001 },
  'qwen-plus':      { id: 'qwen-plus',      maxContextTokens: 131072, maxOutputTokens: 8192,  inputCostPerPer1k: 0.002, outputCostPer1k: 0.006 },
}

/** Agentic Loop 配置 */
export interface LoopConfig {
  maxTurns: number          // 默认 50
  abortController: AbortController
  budgetLimit?: number      // Token budget 上限（可选）
  model: string
  fallbackModel?: string    // 备选模型
}
```

##### 3.4.2 API 适配层

参考 Claude Code `src/services/api/openai/`，将内部格式转换为目标 API 格式：

```typescript
// core/queryEngine/apiAdapter.ts

/**
 * 内部消息 → API 格式
 * 转换规则：
 * - tool_use block → tool_calls[] (OpenAI 格式)
 * - tool_result block → tool message (role: 'tool')
 * - image block → OpenAI vision 格式 (content: [{type:"image_url",...}])
 * - 合并相邻同 role 消息（部分 API 要求）
 */
export function toApiFormat(messages: ConversationMessage[]): ApiMessage[] {
  const result: ApiMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const toolCalls: ApiToolCall[] = []
      const textParts: string[] = []

      for (const block of msg.content) {
        if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id, type: 'function',
            function: {
              name: block.name,
              arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input),
            },
          })
        } else if (block.type === 'text') {
          textParts.push(block.text)
        }
      }
      result.push({
        role: 'assistant',
        content: textParts.join('') || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      })

    } else if (msg.role === 'tool') {
      const content = Array.isArray(msg.content)
        ? msg.content.map(b => b.type === 'text' ? b.text : b.type === 'tool_result' ? b.content : '').join('')
        : (typeof msg.content === 'string' ? msg.content : '')
      result.push({ role: 'tool', tool_call_id: msg.metadata?.toolUseId, content })

    } else if (msg.role === 'user') {
      // 处理 image block（OpenAI Vision 格式）
      const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = []
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text') contentParts.push({ type: 'text', text: block.text })
          else if (block.type === 'image') {
            contentParts.push({
              type: 'image_url',
              image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
            })
          }
        }
      } else {
        contentParts.push({ type: 'text', text: String(msg.content) })
      }
      result.push({ role: 'user', content: JSON.stringify(contentParts) })

    } else if (msg.role === 'system') {
      const content = Array.isArray(msg.content)
        ? msg.content.map(b => b.type === 'text' ? b.text : '').join('')
        : (typeof msg.content === 'string' ? msg.content : '')
      result.push({ role: 'system', content })
    }
  }
  return result
}

/** 流式 delta → 内部 block 累积 */
export class StreamingAccumulator {
  private blocks: ContentBlock[] = []
  private currentText = ''
  private currentToolUse: { id: string; name: string; args: string } | null = null

  /** 处理 streaming chunk delta */
  pushDelta(delta: { content?: string; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> }): void {
    if (delta.content) this.currentText += delta.content
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (tc.id && tc.function?.name) {
          this.flushToolUse()
          this.currentToolUse = { id: tc.id, name: tc.function.name, args: '' }
        }
        if (tc.function?.arguments && this.currentToolUse) {
          this.currentToolUse.args += tc.function.arguments
        }
      }
    }
  }

  /** 获取完整 assistant 消息 */
  finalize(): ConversationMessage {
    this.flushToolUse()
    const content: ContentBlock[] = []
    if (this.currentText) content.push({ type: 'text', text: this.currentText })
    content.push(...this.blocks)
    return {
      id: crypto.randomUUID(), role: 'assistant',
      content, timestamp: Date.now(),
      metadata: { finishReason: 'stop' },
    }
  }

  private flushToolUse(): void {
    if (!this.currentToolUse) return
    let input: Record<string, unknown> = {}
    try { input = JSON.parse(this.currentToolUse.args) } catch {}
    this.blocks.push({
      type: 'tool_use', id: this.currentToolUse.id,
      name: this.currentToolUse.name, input,
    })
    this.currentToolUse = null
  }
}
```

##### 3.4.3 System Prompt 动态构建

参考 Claude Code `src/context.ts`，每次 API 调用时动态组装：

```typescript
// core/queryEngine/systemPrompt.ts

export interface SystemPromptContext {
  userInfo?: { name: string; level: 'beginner' | 'pro' }
  currentDraft?: { id: string; name: string; status: DraftStatus; stats: DraftStats }
  availableTools: ToolDefinition[]
  language: 'zh' | 'en'
  currentDate: string               // '2026-04-16'
  memoryContext?: string             // 从记忆系统加载的上下文
  userPreferences?: string           // 用户偏好摘要
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const parts: string[] = []

  // 1. 角色定义
  parts.push(`你是 JY Draft 的 AI 助手，帮助用户通过自然语言创建和编辑剪映（JianYing）视频草稿。`)
  parts.push(`当前语言：${ctx.language === 'zh' ? '中文' : 'English'}`)
  parts.push(`当前日期：${ctx.currentDate}`)

  // 2. JY Draft 域知识
  parts.push(`\n## 剪映草稿知识\n`)
  parts.push(`- 时间单位：微秒（1秒 = 1,000,000 微秒）`)
  parts.push(`- 轨道类型：video / audio / text / sticker / effect / filter`)
  parts.push(`- 草稿状态：EMPTY → EDITING → DIRTY → SAVED → EXPORTED`)
  parts.push(`- 素材引用：通过 material_url（file:///）引用本地文件`)
  parts.push(`- 导出产物：draft_content.json（剪映可直接打开）`)

  // 3. 当前草稿状态
  if (ctx.currentDraft) {
    parts.push(`\n## 当前草稿\n`)
    parts.push(`- 名称：「${ctx.currentDraft.name}」`)
    parts.push(`- 状态：${ctx.currentDraft.status}`)
    parts.push(`- 尺寸：${ctx.currentDraft.stats.width || 1920}x${ctx.currentDraft.stats.height || 1080}`)
    parts.push(`- 素材：视频${ctx.currentDraft.stats.videoCount}个，音频${ctx.currentDraft.stats.audioCount}个，文本${ctx.currentDraft.stats.textCount}个`)
    parts.push(`- 总时长：${Math.round((ctx.currentDraft.stats.totalDuration || 0) / 1000000)}秒`)
  }

  // 4. 记忆上下文
  if (ctx.memoryContext) {
    parts.push(`\n## 记忆上下文\n${ctx.memoryContext}`)
  }

  // 5. 用户偏好
  if (ctx.userPreferences) {
    parts.push(`\n## 用户偏好\n${ctx.userPreferences}`)
  }

  // 6. 约束
  parts.push(`\n## 约束\n`)
  parts.push(`- 敏感操作（删除、覆盖）需要用户确认`)
  parts.push(`- 权限被拒绝时，告知原因并提供替代建议`)
  parts.push(`- 文件路径使用 Windows 格式：E:\\videos\\test.mp4`)
  parts.push(`- 修改草稿后记得保存（save_draft）`)
  parts.push(`- 如果操作失败，尝试恢复或告知用户具体错误`)

  return parts.join('\n')
}

/** 工具注册为 functions schema（含完整 JSON Schema） */
export function toolsToFunctions(tools: ToolDefinition[]): FunctionDefinition[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,  // 完整 JSON Schema，非仅名称
  }))
}
```

##### 3.4.4 对话上下文与 4 层 Compaction（完整实现）

参考 Claude Code 的 4 层渐进管道 + Reactive Compact：

```typescript
// core/queryEngine/context.ts

const CONTEXT_THRESHOLDS = {
  BUDGET_WARN: 0.8,     // 80%: Budget 警告（通知前端）
  SNIP: 0.9,            // 90%: 简单截断最旧消息
  MICRO: 0.93,          // 93%: Microcompact
  SESSION: 0.96,        // 96%: SessionMemory
  AUTO: 0.98,           // 98%: Autocompact
  REACTIVE: 1.0,        // 100%+: Reactive Compact（API 错误触发）
}

export class ConversationManager {
  private messages: ConversationMessage[] = []
  private sessionMemoryDir: string
  private modelConfig: ModelConfig
  private responseReserve = 4096  // 为 response 预留的 token 数

  constructor(config: { modelConfig: ModelConfig; sessionDir: string }) {
    this.modelConfig = config.modelConfig
    this.sessionMemoryDir = path.join(config.sessionDir, 'memory')
  }

  /** 可用 token = 模型上限 - system_prompt - response 预留 */
  get availableTokens(): number {
    const used = this.countTokens(this.messages)
    return this.modelConfig.maxContextTokens - this.responseReserve - used
  }

  get tokenRatio(): number {
    const used = this.countTokens(this.messages)
    return used / (this.modelConfig.maxContextTokens - this.responseReserve)
  }

  /** Token 计数（使用 tiktoken-wasm 或 js-tiktoken） */
  private countTokens(msgs: ConversationMessage[]): number {
    // 生产环境使用 tiktoken；开发阶段可用 JSON.stringify 长度估算
    const text = msgs.map(m => JSON.stringify(m)).join('')
    return Math.ceil(text.length * 0.3)  // 占位，替换为实际 tokenizer
  }

  /** 检查是否需要 compaction */
  async checkAndCompact(): Promise<void> {
    const ratio = this.tokenRatio
    if (ratio >= CONTEXT_THRESHOLDS.AUTO)      await this.autocompact()
    else if (ratio >= CONTEXT_THRESHOLDS.SESSION) await this.sessionMemory()
    else if (ratio >= CONTEXT_THRESHOLDS.MICRO)   await this.microcompact()
    else if (ratio >= CONTEXT_THRESHOLDS.SNIP)    await this.snip()
  }

  /** L0: 简单截断最旧的 non-system 消息 */
  private async snip(): Promise<void> {
    const target = this.messages.length - 10  // 保留最近 10 条
    const systemMsgs = this.messages.filter(m => m.role === 'system' || m.metadata?.isMeta)
    const otherMsgs = this.messages.filter(m => m.role !== 'system' && !m.metadata?.isMeta)
    const removed = otherMsgs.slice(0, otherMsgs.length - target)
    this.messages = [
      ...systemMsgs,
      { id: crypto.randomUUID(), role: 'system', content: [{ type: 'text', text: `[snip] 已移除 ${removed.length} 条旧消息` }], timestamp: Date.now(), metadata: { isMeta: true } },
      ...otherMsgs.slice(-target),
    ]
  }

  /** L1: Microcompact — 长 tool_result 原地替换为摘要 */
  private async microcompact(): Promise<void> {
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i]
      const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      if (msg.role === 'tool' && contentStr.length > 500) {
        const toolName = msg.metadata?.toolName || 'unknown'
        const summary = contentStr.slice(0, 200) + `... [${toolName}: ${contentStr.length} chars → truncated]`
        msg.content = [{ type: 'text', text: summary }]
      }
    }
  }

  /** L2: SessionMemory — 批量 tool_result 提取到外部文件 */
  private async sessionMemory(): Promise<void> {
    const toExtract: number[] = []
    for (let i = 0; i < this.messages.length - 5; i++) {  // 不提取最近 5 条
      if (this.messages[i].role === 'tool') toExtract.push(i)
    }
    if (toExtract.length === 0) return

    const memoryFile = path.join(this.sessionMemoryDir, `${Date.now()}.json`)
    const originals = toExtract.map(i => this.messages[i])
    await fs.mkdir(this.sessionMemoryDir, { recursive: true })
    await writeFile(memoryFile, JSON.stringify(originals, null, 2))

    this.messages = this.messages.filter((_, i) => !toExtract.includes(i))
    this.messages.push({
      id: crypto.randomUUID(), role: 'system',
      content: [{ type: 'text', text: `[SessionMemory] ${originals.length} 条 tool_result 已提取到外部存储` }],
      timestamp: Date.now(), metadata: { isMeta: true },
    })
  }

  /** L3: Autocompact — LLM 摘要压缩（调用 AI 生成摘要） */
  async autocompact(apiClient: ApiClient, model: string): Promise<void> {
    const toSummarize = this.messages.filter(m => m.role !== 'system' && !m.metadata?.isMeta)
    const keepCount = 5

    const summaryPrompt = '请将以下对话历史压缩为简洁摘要，保留：用户意图、已执行操作、草稿当前状态、待办事项。'
    const summary = await callLlmForSummary(apiClient, model, toSummarize, summaryPrompt)

    const systemMessages = this.messages.filter(m => m.role === 'system' || m.metadata?.isMeta)
    const recentMessages = this.messages.slice(-keepCount)

    this.messages = [
      ...systemMessages,
      { id: crypto.randomUUID(), role: 'system',
        content: [{ type: 'text', text: `[对话摘要] ${summary}` }],
        timestamp: Date.now(), metadata: { isMeta: true } },
      ...recentMessages,
    ]
  }

  /** L4: Reactive Compact — API 错误触发（prompt_too_long / media_size） */
  async reactiveCompact(error: ApiError, apiClient: ApiClient, model: string): Promise<boolean> {
    if (error.type === 'prompt_too_long') {
      // 先尝试 autocompact
      await this.autocompact(apiClient, model)
      return this.tokenRatio < 0.9  // 压缩后仍超限则失败
    }
    if (error.type === 'media_size') {
      // 移除最大的 image block
      this.messages = this.messages.map(m => ({
        ...m,
        content: Array.isArray(m.content)
          ? m.content.filter(b => b.type !== 'image')
          : m.content,
      }))
      return true
    }
    return false
  }
}
```

**preservePriority（压缩优先级）**：
1. **Plan 相关**（最高，不可丢弃）
2. **System prompt + 摘要消息**（isMeta=true）
3. **最近 5 条消息**（保持连贯性）
4. **User 原始意图**（优先保留 user 消息）
5. **tool_result**（最优先压缩/提取）

##### 3.4.5 Tool 注册与定义

```typescript
// core/queryEngine/toolRegistry.ts

export interface ToolDefinition {
  name: string
  description: string
  parameters: JsonSchema  // JSON Schema for function calling
  handler: ToolHandler
  permission?: PermissionLevel
  isReadOnly?: (input: Record<string, unknown>) => boolean  // 判断是否为只读操作
}

export type ToolHandler = (
  input: Record<string, unknown>,
  context: ToolCallContext
) => Promise<ToolResult>

export interface ToolCallContext {
  draftId?: string
  userId: string
  mcpClient: McpClient
  abortController: AbortController  // per-tool abort
  toolRegistry: ToolRegistry        // 引用所在 registry（支持子 Agent 独立池）
}

/** Tool Registry（per-engine 实例，支持 Multi-Agent 独立 tool pool） */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  values(): IterableIterator<ToolDefinition> {
    return this.tools.values()
  }

  /** 注册 MCP Tool */
  registerMcpTool(mcpTool: McpToolSpec): void {
    this.tools.set(mcpTool.name, {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: mcpTool.inputSchema,
      isReadOnly: () => mcpTool.name.startsWith('list_') || mcpTool.name.startsWith('get_'),
      handler: async (input, ctx) => {
        const result = await ctx.mcpClient.callTool(mcpTool.name, input)
        return { success: true, content: JSON.stringify(result) }
      },
    })
  }

  /** 创建子集（供 Sub-Agent 使用） */
  createSubset(toolNames: string[]): ToolRegistry {
    const sub = new ToolRegistry()
    for (const name of toolNames) {
      const def = this.tools.get(name)
      if (def) sub.register(def)
    }
    return sub
  }
}
```

**初始注册的工具**：
- `create_draft` — 创建新草稿
- `add_videos` — 添加视频素材
- `add_audios` — 添加音频素材
- `add_texts` — 添加文本素材
- `save_draft` — 保存草稿到 MCP Server
- `export_draft` — 导出草稿为剪映 JSON
- `list_drafts` — 列出草稿列表
- `get_draft` — 获取草稿详情
- `delete_draft` — 删除草稿
- `tts_generate` — TTS 语音合成
- `speech_recognize` — 语音识别

##### 3.4.6 Tool 调用执行器

```typescript
// core/queryEngine/toolExecutor.ts

interface ToolExecuteResult {
  success: boolean
  content: string
  error?: string
}

/** 执行单个 Tool 调用 */
export async function executeToolCall(
  block: ToolUseBlock,
  ctx: ToolCallContext,
  permissionGuard: PermissionGuard
): Promise<ToolResultBlock> {
  const result = await permissionGuard.checkAndExecute(
    block.name,
    block.input,
    async () => {
      const handler = toolRegistry.get(block.name)
      if (!handler) {
        throw new Error(`Tool ${block.name} not found`)
      }
      return await handler.handler(block.input, ctx)
    }
  )

  if (result.denied) {
    return {
      type: 'tool_result',
      tool_use_id: block.id,
      content: `【权限被拒绝】${result.reason}`,
      is_error: true,
    }
  }

  return {
    type: 'tool_result',
    tool_use_id: block.id,
    content: typeof result === 'string' ? result : JSON.stringify(result),
  }
}

/** 混合模式：并行执行独立 Tool，有依赖的按顺序 */
export async function executeToolCallsParallel(
  blocks: ToolUseBlock[],
  ctx: ToolCallContext,
  permissionGuard: PermissionGuard
): Promise<ToolResultBlock[]> {
  const independent = blocks.filter(b => !hasDependency(b, blocks))
  const dependent = blocks.filter(b => hasDependency(b, blocks))

  const independentResults = await Promise.all(
    independent.map(b => executeToolCall(b, ctx, permissionGuard))
  )

  const dependentResults: ToolResultBlock[] = []
  for (const b of dependent) {
    dependentResults.push(await executeToolCall(b, ctx, permissionGuard))
  }

  return [...independentResults, ...dependentResults]
}

function hasDependency(block: ToolUseBlock, allBlocks: ToolUseBlock[]): boolean {
  const draftId = block.input.draft_id
  if (!draftId) return false
  return allBlocks.some(b => b.id !== block.id && b.input.draft_id === draftId)
}
```

##### 3.4.7 权限检查集成

```typescript
// core/queryEngine/permissionGuard.ts

export class PermissionGuard {
  constructor(private permissionManager: PermissionManager) {}

  async checkAndExecute<T>(
    toolName: string,
    input: unknown,
    execute: () => Promise<T>
  ): Promise<T | PermissionDeniedResult> {
    const decision = await this.permissionManager.checkPermission(toolName, input)

    switch (decision.behavior) {
      case 'allow':
        return await execute()

      case 'deny':
        return {
          denied: true,
          reason: decision.message,
          toolName,
          log: { toolName, reason: decision.message, timestamp: Date.now() },
        }

      case 'ask':
        throw new PermissionRequiredError(toolName, decision.options)
    }
  }
}
```

##### 3.4.8 权限拒绝处理

```typescript
// core/queryEngine/permissionDeniedHandler.ts

export interface PermissionDeniedResult {
  denied: true
  reason: string
  toolName: string
  log: { toolName: string; reason: string; timestamp: number }
}

export function handlePermissionDenied(
  result: PermissionDeniedResult,
  conversation: ConversationMessage[]
): HandleResult {
  const friendlyMessage = generateFriendlyMessage(result.reason)

  const deniedMessage: ConversationMessage = {
    id: generateId(),
    role: 'tool',
    content: [{ type: 'tool_result', tool_use_id: '', content: `【权限被拒绝】${friendlyMessage}` }],
    metadata: { denied: true, toolName: result.toolName },
    timestamp: Date.now(),
  }

  const strategy = decideNextStrategy(result.reason)

  return { message: deniedMessage, strategy }
}

function decideNextStrategy(reason: string): 'stop' | 'retry_without_tool' | 'suggest_permission_change' {
  if (reason.includes('session') && reason.includes('expired')) return 'suggest_permission_change'
  if (reason.includes('user_denied')) return 'stop'
  if (reason.includes('denyAll')) return 'suggest_permission_change'
  return 'stop'
}
```

##### 3.4.9 流式响应与 Agentic Loop（完整实现）

参考 Claude Code `query.ts` 的完整 agentic loop：

```typescript
// core/queryEngine/stream.ts

export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_args'; delta: string }
  | { type: 'tool_call_end'; id: string }
  | { type: 'tool_result'; id: string; content: string; is_error?: boolean }
  | { type: 'tool_progress'; id: string; message: string }     // 长时间 tool 进度
  | { type: 'context_compaction'; level: string }               // compaction 事件
  | { type: 'model_switch'; from: string; to: string }          // 模型切换
  | { type: 'budget_warning'; used: number; total: number }     // budget 警告
  | { type: 'done'; result: LoopResult }
  | { type: 'error'; error: string; recoverable: boolean }

/** 流式执行 Agentic Loop 主循环 */
export async function* streamQuery(
  userMessage: string,
  ctx: QueryContext
): AsyncGenerator<StreamEvent> {
  const { conversationManager, loopConfig, apiClient, permissionGuard } = ctx
  const messages = conversationManager.getMessages()
  let currentModel = loopConfig.model
  let turnCount = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // 添加 user 消息
  messages.push({
    id: crypto.randomUUID(), role: 'user',
    content: [{ type: 'text', text: userMessage }],
    timestamp: Date.now(),
  })

  while (true) {
    turnCount++

    // ---- 终止条件检查 ----
    if (turnCount > loopConfig.maxTurns) {
      yield { type: 'done', result: { reason: 'max_turns', totalTurns: turnCount, totalTokens: { input: totalInputTokens, output: totalOutputTokens }, totalCost: 0 } }
      return
    }

    if (loopConfig.abortController.signal.aborted) {
      // 为未完成的 tool 生成合成 result
      yield { type: 'done', result: { reason: 'aborted_streaming', totalTurns: turnCount, totalTokens: { input: totalInputTokens, output: totalOutputTokens }, totalCost: 0 } }
      return
    }

    // ---- Budget 检查 ----
    if (loopConfig.budgetLimit && totalInputTokens + totalOutputTokens > loopConfig.budgetLimit) {
      yield { type: 'done', result: { reason: 'budget_exceeded', totalTurns: turnCount, totalTokens: { input: totalInputTokens, output: totalOutputTokens }, totalCost: 0 } }
      return
    }

    // ---- Compaction ----
    try {
      await conversationManager.checkAndCompact()
    } catch {
      // compaction 失败不阻塞，继续尝试
    }

    // ---- 构建 System Prompt ----
    const systemPrompt = buildSystemPrompt(ctx.systemPromptContext)

    // ---- API 调用（含错误恢复） ----
    let assistantMsg: ConversationMessage
    try {
      const accumulator = new StreamingAccumulator()
      const apiResponse = apiClient.chat.completions.create({
        model: currentModel,
        messages: [{ role: 'system', content: systemPrompt }, ...toApiFormat(messages)],
        tools: toolsToFunctions([...ctx.toolRegistry.values()]),
        stream: true,
      })

      for await (const chunk of apiResponse) {
        // 检查 abort
        if (loopConfig.abortController.signal.aborted) break

        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
          yield { type: 'text', delta: delta.content }
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) yield { type: 'tool_call_start', id: tc.id, name: tc.function?.name || '' }
            if (tc.function?.arguments) yield { type: 'tool_call_args', delta: tc.function.arguments }
          }
        }
        accumulator.pushDelta(delta || {})

        // Token 统计
        if (chunk.usage) {
          totalInputTokens += chunk.usage.prompt_tokens || 0
          totalOutputTokens += chunk.usage.completion_tokens || 0
        }
      }
      assistantMsg = accumulator.finalize()

    } catch (apiError) {
      // ---- 错误恢复 ----
      const error = apiError as ApiError

      // 尝试 Reactive Compact
      if (error.type === 'prompt_too_long' || error.type === 'media_size') {
        const recovered = await conversationManager.reactiveCompact(error, apiClient, currentModel)
        if (recovered) {
          yield { type: 'context_compaction', level: 'reactive' }
          continue  // 重试
        }
      }

      // 尝试 Fallback Model
      if (loopConfig.fallbackModel && currentModel !== loopConfig.fallbackModel) {
        yield { type: 'model_switch', from: currentModel, to: loopConfig.fallbackModel }
        currentModel = loopConfig.fallbackModel
        continue  // 用 fallback 重试
      }

      // 所有恢复失败
      yield { type: 'error', error: error.message, recoverable: false }
      yield { type: 'done', result: { reason: 'model_error', totalTurns: turnCount, totalTokens: { input: totalInputTokens, output: totalOutputTokens }, totalCost: 0 } }
      return
    }

    // ---- 检查 tool_use ----
    messages.push(assistantMsg)
    const toolUseBlocks = (assistantMsg.content as ContentBlock[])
      .filter((b): b is ToolUseBlock => b.type === 'tool_use')

    if (toolUseBlocks.length === 0) {
      // 无 tool_use，正常结束
      yield { type: 'done', result: { reason: 'completed', totalTurns: turnCount, totalTokens: { input: totalInputTokens, output: totalOutputTokens }, totalCost: 0 } }
      return
    }

    // ---- Streaming Tool Execution ----
    const toolExecutor = new StreamingToolExecutor(ctx.toolRegistry, permissionGuard, loopConfig.abortController)

    for (const block of toolUseBlocks) {
      toolExecutor.addTool(block, assistantMsg)
    }

    // 收集结果
    for await (const update of toolExecutor.getResults()) {
      if (update.type === 'progress') {
        yield { type: 'tool_progress', id: update.toolId, message: update.message }
      } else if (update.type === 'result') {
        messages.push({
          id: crypto.randomUUID(), role: 'tool',
          content: [update.result],
          metadata: { toolUseId: update.result.tool_use_id, toolName: update.toolName },
          timestamp: Date.now(),
        })
        yield { type: 'tool_result', id: update.result.tool_use_id, content: update.result.content, is_error: update.result.is_error }
        yield { type: 'tool_call_end', id: update.result.tool_use_id }
      }
    }

    // 继续循环（AI 将看到 tool_result 并决定下一步）
  }
}
```

##### 3.4.9a Streaming Tool Executor

参考 Claude Code `StreamingToolExecutor`：

```typescript
// core/queryEngine/streamingToolExecutor.ts

type ToolStatus = 'queued' | 'executing' | 'completed' | 'yielded'

interface TrackedTool {
  id: string
  block: ToolUseBlock
  status: ToolStatus
  isConcurrencySafe: boolean  // 只读工具可并发
  pendingProgress: string[]
}

export class StreamingToolExecutor {
  private tools: TrackedTool[] = []
  private toolRegistry: Map<string, ToolDefinition>
  private permissionGuard: PermissionGuard
  private abortController: AbortController

  constructor(toolRegistry: Map<string, ToolDefinition>, guard: PermissionGuard, ac: AbortController) {
    this.toolRegistry = toolRegistry
    this.permissionGuard = guard
    this.abortController = ac
  }

  addTool(block: ToolUseBlock, assistantMsg: ConversationMessage): void {
    const def = this.toolRegistry.get(block.name)
    this.tools.push({
      id: block.id, block,
      status: 'queued',
      isConcurrencySafe: def?.isReadOnly?.(block.input) ?? false,
      pendingProgress: [],
    })
    void this.processQueue()
  }

  /** 按依赖和并发安全规则执行 */
  private async processQueue(): Promise<void> {
    const queued = this.tools.filter(t => t.status === 'queued')
    const safeTools = queued.filter(t => t.isConcurrencySafe)
    const unsafeTools = queued.filter(t => !t.isConcurrencySafe)

    // 并发安全的一起跑
    await Promise.all(safeTools.map(t => this.executeOne(t)))
    // 非安全的串行
    for (const t of unsafeTools) {
      if (this.abortController.signal.aborted) break
      await this.executeOne(t)
    }
  }

  private async executeOne(tool: TrackedTool): Promise<void> {
    tool.status = 'executing'
    try {
      const result = await this.permissionGuard.checkAndExecute(
        tool.block.name, tool.block.input,
        async () => {
          const handler = this.toolRegistry.get(tool.block.name)
          if (!handler) throw new Error(`Tool ${tool.block.name} not found`)
          return handler.handler(tool.block.input, this.buildToolContext())
        }
      )
      tool.status = 'completed'
      // result 将通过 getResults() yield
    } catch (e) {
      tool.status = 'completed'
      // error result
    }
  }

  /** 按顺序 yield 结果 */
  async *getResults(): AsyncGenerator<{ type: 'progress' | 'result'; toolId: string; message?: string; result?: ToolResultBlock; toolName?: string }> {
    for (const tool of this.tools) {
      // 等待完成
      while (tool.status !== 'completed') await new Promise(r => setTimeout(r, 50))

      // yield pending progress
      for (const msg of tool.pendingProgress) {
        yield { type: 'progress', toolId: tool.id, message: msg }
      }

      // yield result
      tool.status = 'yielded'
    }
  }

  private buildToolContext(): ToolCallContext { /* ... */ }
}
```

##### 3.4.9b 会话持久化（JSONL）

参考 Claude Code 的 session 持久化：

```typescript
// core/queryEngine/sessionPersistence.ts

export class SessionPersistence {
  private sessionDir: string   // .jy-draft/sessions/{sessionId}/

  constructor(sessionDir: string) {
    this.sessionDir = sessionDir
    fs.mkdirSync(sessionDir, { recursive: true })
  }

  /** 追加消息到 JSONL 文件 */
  async appendMessage(sessionId: string, msg: ConversationMessage): Promise<void> {
    const filePath = path.join(this.sessionDir, sessionId, 'transcript.jsonl')
    const line = JSON.stringify({
      type: msg.role,
      id: msg.id,
      parentUuid: msg.parentUuid,
      content: msg.content,
      metadata: msg.metadata,
      timestamp: msg.timestamp,
    })
    await appendFile(filePath, line + '\n')
  }

  /** 恢复会话 */
  async restoreSession(sessionId: string): Promise<ConversationMessage[]> {
    const filePath = path.join(this.sessionDir, sessionId, 'transcript.jsonl')
    if (!existsSync(filePath)) return []

    const lines = (await readFile(filePath, 'utf-8')).split('\n').filter(Boolean)
    return lines.map(line => {
      const entry = JSON.parse(line)
      return {
        id: entry.id,
        role: entry.type,
        content: entry.content,
        metadata: entry.metadata,
        timestamp: entry.timestamp,
        parentUuid: entry.parentUuid,
      } as ConversationMessage
    })
  }

  /** 列出所有会话 */
  async listSessions(): Promise<Array<{ id: string; createdAt: number; messageCount: number }>> {
    // 扫描 sessionDir 下的子目录
  }

  /** 清理旧会话（7天+） */
  async cleanupOldSessions(maxAgeMs: number = 7 * 24 * 3600 * 1000): Promise<number> {
    // ...
  }
}
```

##### 3.4.9c Multi-Agent 集成

QueryEngine 通过 AgentTool 支持子 Agent 执行：

```typescript
// core/queryEngine/agentTool.ts（在 Tool Registry 中注册）

export const agentToolDefinition: ToolDefinition = {
  name: 'Agent',
  description: '调用子 Agent 执行特定任务（草稿构建、素材分析等）',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '子 Agent 的任务描述' },
      subagent_type: {
        type: 'string',
        enum: ['DraftBuilder', 'MaterialAnalyst', 'ExploreAgent', 'AudioAgent'],
        description: '子 Agent 类型',
      },
    },
    required: ['prompt', 'subagent_type'],
  },
  handler: async (input, ctx) => {
    const { prompt, subagent_type } = input as { prompt: string; subagent_type: string }

    // 1. 获取 Agent 定义（独立 tool pool + permission mode）
    const agentDef = AGENT_DEFINITIONS[subagent_type]

    // 2. 构建独立 tool pool
    const subToolPool = new Map<string, ToolDefinition>()
    for (const toolName of agentDef.tools) {
      const def = ctx.toolRegistry.get(toolName)
      if (def) subToolPool.set(toolName, def)
    }

    // 3. 创建子 QueryEngine（独立 context + permission mode）
    const subEngine = new SubQueryEngine({
      toolPool: subToolPool,
      permissionMode: agentDef.permissionMode,  // e.g., 'acceptEdits'
      parentAbortController: ctx.abortController,
      maxTurns: 20,
      model: ctx.model,
    })

    // 4. 执行并返回结果
    const result = await subEngine.run(prompt)
    return { success: true, content: result }
  },
  isReadOnly: () => false,
}
```

##### 3.4.10 QueryEngine 主类

```typescript
// core/queryEngine/index.ts

export class QueryEngine {
  private conversationManager: ConversationManager
  private permissionGuard: PermissionGuard
  private mcpClient: McpClient
  private apiClient: ApiClient

  constructor(config: QueryEngineConfig) {
    this.conversationManager = new ConversationManager({
      maxTokens: config.maxContextTokens,
      sessionMemoryDir: config.sessionDir,
    })
    this.permissionGuard = new PermissionGuard(config.permissionManager)
    this.mcpClient = config.mcpClient
    this.apiClient = config.apiClient
  }

  /** 发送消息（同步版本） */
  async sendMessage(userMessage: string): Promise<ConversationMessage> {
    const ctx = this.buildContext()
    for await (const event of streamQuery(userMessage, ctx)) {
      // 事件处理
    }
    const messages = this.conversationManager.getMessages()
    return messages[messages.length - 1]
  }

  /** 发送消息（流式版本） */
  sendMessageStream(userMessage: string): AsyncGenerator<StreamEvent> {
    const ctx = this.buildContext()
    return streamQuery(userMessage, ctx)
  }

  private buildContext(): QueryContext {
    return {
      conversationManager: this.conversationManager,
      permissionGuard: this.permissionGuard,
      mcpClient: this.mcpClient,
      apiClient: this.apiClient,
      systemPromptContext: {
        availableTools: [...toolRegistry.values()].map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
        language: 'zh',
        currentDraft: this.currentDraft,
      },
      model: 'glm-4-flash',
    }
  }

  private currentDraft?: { id: string; name: string; status: DraftStatus; stats: DraftStats }
}
```

##### 3.4.11 IPC Query 通道

```typescript
// ipc/query.ts

export const QUERY_IPC_CHANNELS = {
  // 消息
  'query:send':         (message: string) => Promise<ConversationMessage>,
  'query:send-stream':  (message: string) => void,    // → renderer receives stream events
  'query:interrupt':    () => void,                     // 中断当前对话
  'query:abort-tool':   (toolUseId: string) => void,   // 取消特定 tool 执行

  // 会话
  'query:get-history':    () => Promise<ConversationMessage[]>,
  'query:clear-history':  () => Promise<void>,
  'query:list-sessions':  () => Promise<SessionInfo[]>,
  'query:restore-session': (sessionId: string) => Promise<ConversationMessage[]>,
  'query:delete-session':  (sessionId: string) => Promise<void>,

  // 配置
  'query:switch-model':   (model: string) => Promise<void>,
  'query:get-context':    () => Promise<SystemPromptContext>,
  'query:get-cost':       () => Promise<{ inputTokens: number; outputTokens: number; cost: number }>,
  'query:set-system-prompt': (prompt: string) => Promise<void>,
}

export function registerQueryIpcHandlers(ipcMain: IpcMain, engine: QueryEngine): void {
  ipcMain.handle('query:send', async (_, message: string) => {
    return await engine.sendMessage(message)
  })

  ipcMain.on('query:send-stream', async (event, message: string) => {
    for await (const streamEvent of engine.sendMessageStream(message)) {
      event.sender.send('query:stream-event', streamEvent)
      if (streamEvent.type === 'done' || streamEvent.type === 'error') break
    }
  })

  ipcMain.handle('query:interrupt', async () => engine.abort())
  ipcMain.handle('query:switch-model', async (_, model: string) => engine.switchModel(model))
  ipcMain.handle('query:get-cost', async () => engine.getCostInfo())
  ipcMain.handle('query:list-sessions', async () => engine.listSessions())
  ipcMain.handle('query:restore-session', async (_, id: string) => engine.restoreSession(id))
  // ... 其他通道
}
```

##### 3.4.12 Conversation Store

```typescript
// stores/conversation.ts

export interface ConversationState {
  messages: ConversationMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingText: string                // 当前流式累积的文本
  currentToolCalls: Array<{ id: string; name: string; status: 'running' | 'done' | 'error' }>
  error: string | null
  recoverable: boolean                 // 错误是否可恢复

  // 上下文
  currentDraftContext: SystemPromptContext | null
  currentModel: string
  tokenRatio: number                   // 0-1

  // 费用
  inputTokens: number
  outputTokens: number
  estimatedCost: number

  // 会话
  sessionId: string | null
  sessions: SessionInfo[]
}

export const useConversationStore = defineStore('conversation', {
  state: (): ConversationState => ({
    messages: [],
    isLoading: false,
    isStreaming: false,
    streamingText: '',
    currentToolCalls: [],
    error: null,
    recoverable: false,
    currentDraftContext: null,
    currentModel: 'glm-4-flash',
    tokenRatio: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    sessionId: null,
    sessions: [],
  }),

  actions: {
    async sendMessage(content: string) { /* 同步版，处理流式事件更新 state */ },

    startStreamMessage(content: string) {
      this.isStreaming = true
      this.streamingText = ''
      this.currentToolCalls = []
      this.messages.push({
        id: crypto.randomUUID(), role: 'user',
        content: [{ type: 'text', text: content }], timestamp: Date.now(),
      })
      // IPC 注册 stream-event 监听
    },

    /** 处理流式事件（从 IPC stream-event 回调） */
    handleStreamEvent(event: StreamEvent) {
      switch (event.type) {
        case 'text':
          this.streamingText += event.delta
          break
        case 'tool_call_start':
          this.currentToolCalls.push({ id: event.id, name: event.name, status: 'running' })
          break
        case 'tool_result':
          const tc = this.currentToolCalls.find(t => t.id === event.id)
          if (tc) tc.status = event.is_error ? 'error' : 'done'
          break
        case 'budget_warning':
          this.tokenRatio = event.used / event.total
          break
        case 'model_switch':
          this.currentModel = event.to
          break
        case 'done':
          this.isStreaming = false
          // 将 streamingText 推入 messages
          if (this.streamingText) {
            this.messages.push({
              id: crypto.randomUUID(), role: 'assistant',
              content: [{ type: 'text', text: this.streamingText }],
              timestamp: Date.now(),
            })
            this.streamingText = ''
          }
          this.inputTokens += event.result.totalTokens.input
          this.outputTokens += event.result.totalTokens.output
          break
        case 'error':
          this.isStreaming = false
          this.error = event.error
          this.recoverable = event.recoverable
          break
      }
    },

    interrupt() { this.invoke('query:interrupt') },
    clearHistory() { this.messages = []; this.invoke('query:clear-history') },
    switchModel(model: string) { this.invoke('query:switch-model', model) },
  },

  getters: {
    recentMessages: (state) => state.messages.slice(-20),
    hasError: (state) => state.error !== null,
    totalCost: (state) => state.estimatedCost,
    contextPercent: (state) => Math.round(state.tokenRatio * 100),
  },
})
```

##### 3.4.13 REPL 组件

参考 Claude Code REPL 设计（Vue 3 Composition API）：

```vue
<!-- components/REPL/ChatWindow.vue -->
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

interface Props {
  messages: ConversationMessage[]
  isStreaming: boolean
}

const props = defineProps<Props>()
const bottomRef = ref<HTMLElement>()

watch(() => props.messages.length, async () => {
  await nextTick()
  bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
})
</script>

<template>
  <div class="chat-window">
    <VirtualList :items="props.messages" :height="600">
      <template #default="{ item }">
        <MessageRow :key="item.id" :message="item" />
      </template>
    </VirtualList>
    <StreamingIndicator v-if="props.isStreaming" />
    <div ref="bottomRef" />
  </div>
</template>
```

```vue
<!-- components/REPL/MessageRow.vue -->
<script setup lang="ts">
interface Props {
  message: ConversationMessage
}

const props = defineProps<Props>()
</script>

<template>
  <UserMessage v-if="props.message.role === 'user'" :content="props.message.content" />
  <AssistantMessage v-else-if="props.message.role === 'assistant'" :content="props.message.content" />
  <ToolResultMessage v-else-if="props.message.role === 'tool'"
    :content="props.message.content"
    :is-denied="props.message.metadata?.denied" />
</template>
```

```vue
<!-- components/REPL/PromptInput.vue -->
<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  send: [text: string]
  interrupt: []
}>()

const value = ref('')
const history = ref<string[]>([])

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    const text = value.value.trim()
    if (text) {
      emit('send', text)
      history.value.push(text)
      value.value = ''
    }
  } else if (e.key === 'c' && e.ctrlKey) {
    emit('interrupt')
  }
}
</script>

<template>
  <div class="prompt-input">
    <span class="prompt-prefix">❯</span>
    <textarea v-model="value" @keydown="handleKeyDown"
      :disabled="props.disabled" rows="1" autofocus />
  </div>
</template>
```

```vue
<!-- components/REPL/StatusBar.vue -->
<script setup lang="ts">
interface Props {
  draftContext: SystemPromptContext | null
  model: string
  tokenRatio?: number
}

const props = defineProps<Props>()
</script>

<template>
  <div class="status-bar">
    <span v-if="props.draftContext?.currentDraft">
      📝 {{ props.draftContext.currentDraft.name }} ({{ props.draftContext.currentDraft.status }})
    </span>
    <span>{{ props.model }}</span>
    <span v-if="props.tokenRatio !== undefined">
      Context: {{ Math.round(props.tokenRatio * 100) }}%
    </span>
  </div>
</template>
```

##### 3.4.14 任务拆解（20 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P3.4.1 | 消息结构与核心类型 | `types/message.ts` | - | ConversationMessage + ContentBlock + ApiMessage + LoopResult + ModelConfig 完成 |
| P3.4.2 | API 适配层 | `core/queryEngine/apiAdapter.ts` | P3.4.1 | toApiFormat + StreamingAccumulator + image block 处理 |
| P3.4.3 | System Prompt 动态构建 | `core/queryEngine/systemPrompt.ts` | P3.4.1 | buildSystemPrompt 含域知识 + tool JSON Schema + 记忆上下文 |
| P3.4.4 | 对话上下文与 4 层 Compaction | `core/queryEngine/context.ts` | P3.4.1 | 5 层（snip/micro/session/auto/reactive）完整 + per-model token 计算 |
| P3.4.5 | Tool Registry（per-engine 实例） | `core/queryEngine/toolRegistry.ts` | P3.3.3 | ToolRegistry 类 + registerMcpTool + createSubset（子 Agent 用） |
| P3.4.6 | Tool 调用执行器 | `core/queryEngine/toolExecutor.ts` | P3.4.5, P3.1.3 | StreamingToolExecutor: 并发安全并行 + 非安全串行 + per-tool AbortController |
| P3.4.7 | 权限检查集成 | `core/queryEngine/permissionGuard.ts` | P3.1.3, P3.4.6 | checkAndExecute + 连续拒绝追踪（3次→自动 deny） |
| P3.4.8 | 权限拒绝处理 | `core/queryEngine/permissionDeniedHandler.ts` | P3.4.7 | 拒绝消息友好 + 策略选择 + 替代方案建议给 AI |
| P3.4.9 | Agentic Loop + 流式响应 | `core/queryEngine/stream.ts` | P3.4.4,6,7 | streamQuery: 完整终止条件 + abort + budget + error recovery |
| P3.4.10 | 错误恢复 | `core/queryEngine/errorRecovery.ts` | P3.4.4,9 | Reactive Compact + Fallback Model 切换 + Withholding 机制 |
| P3.4.11 | 会话持久化 | `core/queryEngine/sessionPersistence.ts` | P3.4.1 | JSONL 格式 + restoreSession + cleanupOldSessions |
| P3.4.12 | Multi-Agent 集成 | `core/queryEngine/agentTool.ts` | P3.4.5,9 | AgentTool + SubQueryEngine + 独立 tool pool + permission mode |
| P3.4.13 | QueryEngine 主类 | `core/queryEngine/index.ts` | P3.4.4~12 | sendMessage / sendMessageStream + session 恢复 + model 切换 |
| P3.4.14 | IPC Query 通道 | `ipc/query.ts` | P3.4.13 | send/send-stream/interrupt/abort-tool/switch-model/get-cost/list-sessions |
| P3.4.15 | Conversation Store | `stores/conversation.ts` | P3.4.14 | messages + streaming 累积 + cost + draft context + virtual scroll |
| P3.4.16 | REPL: ChatWindow + MessageRow | `components/REPL/` | P3.4.15 | VirtualList + UserMessage + AssistantMessage + ToolResultMessage |
| P3.4.17 | REPL: PromptInput | `components/REPL/PromptInput.vue` | P3.4.15 | Enter 发送 / Ctrl+C 中断 / @ 素材补全 / / skill 触发 |
| P3.4.18 | REPL: StatusBar + PermissionDialog | `components/REPL/` | P3.4.15 | 模型/budget/context% 显示 + 权限确认弹窗 + 进度指示器 |
| P3.4.19 | REPL: 搜索与历史 | `components/REPL/` | P3.4.16 | 对话内搜索 + 输入历史 + session 切换 |
| P3.4.20 | 集成测试 | `__tests__/queryEngine/` | P3.4.19 | 全流程: ReAct loop + error recovery + compaction + session 持久化 + multi-agent |

**验收标准**：
1. ReAct 循环正常：AI 收消息 → 调 Tool → 收结果 → 继续/结束，支持 max_turns + abort
2. Function Calling 正常：MCP Tool 注册为 functions（含完整 JSON Schema），AI 输出 tool_calls 格式正确
3. 错误恢复正常：prompt_too_long → reactive compact → 重试成功；529 → fallback model 切换
4. Streaming Tool Execution 正常：并发安全的 tool 并行执行，非安全的串行
5. Compaction 正常：4 层管道自动触发，长对话压缩后保持关键上下文
6. Session 持久化正常：进程重启后可恢复会话
7. Multi-Agent 正常：主 Agent 调用 DraftBuilder 子 Agent，独立 tool pool + 权限
8. 权限集成正常：敏感 Tool 被拒绝时，AI 能感知并建议替代方案
9. 流式显示正常：文本实时显示，Tool 进度实时更新

---

#### Phase 3 开发顺序（5 轮迭代）

```
第1轮迭代（基础层）
├── P3.1.1 权限基础结构
├── P3.2.1 目录结构设计
├── P3.2.2 数据库表设计（四张素材表 + 分析结果表 + 完整 CREATE TABLE）
├── P3.2.24 LanceDB 初始化与 Embedding
├── P3.3.1 草稿状态机与核心类型（DraftStatus 7枚举 + TrackType 6种 + MaterialType 5种）
├── P3.3.2 草稿数据库表（draft_main + draft_tracks + draft_materials + draft_versions + FTS5）
├── P3.3.21 FTS 同步触发器
└── P3.4.1 消息结构

第2轮迭代（核心逻辑）
├── P3.1.2 权限存储表
├── P3.1.3 权限核心逻辑
├── P3.2.3 路径工具函数
├── P3.2.4 格式白名单校验
├── P3.2.5~8 素材元数据提取（视频/音频/图片/文本）
├── P3.2.9 添加素材 API（含 Hash 去重 + 自动缩略图）
├── P3.3.3 创建草稿（MCP create_draft + 默认轨道）
├── P3.3.4 MaterialInfo 构建器（5 种素材类型 Info 构建）
├── P3.3.5 轨道管理（ensureTrack/muteTrack/removeEmptyTrack）
├── P3.3.9 草稿元数据更新（rename/description/outputFolder）
└── P3.4.2 对话上下文

第3轮迭代（素材 + 时间线 + 保存/导出）
├── P3.1.4 IPC 权限通道
├── P3.1.6 权限规则管理
├── P3.2.10~11 素材查询/排序
├── P3.2.12 语义搜索（LanceDB）
├── P3.2.13~14 素材删除/回收站
├── P3.2.25 AI 视频分析（短视频）
├── P3.2.26 AI 智能分割（长视频）
├── P3.2.27 分析结果存储
├── P3.2.28 素材-草稿引用计数
├── P3.3.6 添加素材（统一 addMaterial + 轨道自动分配）
├── P3.3.7 移除素材（反规范化递减）
├── P3.3.8 时间线操作（generateTimelines/reorder/trim）
├── P3.3.11 草稿保存 + 本地快照（snapshot_path）
├── P3.3.12~13 草稿导出 + 版本管理（snapshot_json + material_refs）
├── P3.3.14 MCP 恢复机制（snapshot → 重建 MCP）
├── P3.3.17 草稿计数校验（recalculateCounts）
├── P3.4.3 System Prompt 动态构建（含域知识 + tool JSON Schema）
├── P3.4.5 Tool Registry（per-engine 实例 + createSubset）
├── P3.4.6 Streaming Tool Executor（并发安全并行 + per-tool AbortController）

第4轮迭代（UI + Store + 测试）
├── P3.1.5 权限弹窗 UI
├── P3.1.7 权限 Store
├── P3.2.15~17 目录扫描/批量操作/导入
├── P3.2.18~23 缩略图/预览/别名/收藏/统计/存在性校验
├── P3.2.29 IPC 素材通道（含进度回调）
├── P3.2.30 Material Store + 集成测试
├── P3.3.10 草稿缩略图（FFmpeg 第一帧截取）
├── P3.3.15 草稿列表（FTS5 搜索 + 统计）
├── P3.3.16 草稿删除（软删除→硬删除两步）
├── P3.3.18 IPC 草稿通道（CRUD + Track + Timeline + Recovery）
├── P3.3.19 Draft Store（含 tracks + materials + dirty + error）
├── P3.3.20 草稿复制
├── P3.4.7~8 权限检查集成 + 连续拒绝追踪 + 拒绝处理
├── P3.4.9 Agentic Loop（完整终止条件 + abort + budget + error recovery）
├── P3.4.10 错误恢复（Reactive Compact + Fallback Model + Withholding）
├── P3.4.11 会话持久化（JSONL + restoreSession）
├── P3.4.12 Multi-Agent 集成（AgentTool + SubQueryEngine）
├── P3.4.13 QueryEngine 主类（session 恢复 + model 切换）
├── P3.4.14 IPC Query 通道（send/interrupt/abort/switch-model/list-sessions）
├── P3.4.15 Conversation Store（streaming 累积 + cost + draft context）
├── P3.4.16~19 REPL 组件（ChatWindow + PromptInput + StatusBar + PermissionDialog + 搜索）
└── P3.1.8 / P3.2.30 / P3.3.22 / P3.4.20 集成测试
```

---

### Phase 4：基础设施与发布（Windows）

> **优先级**：基础设施（测试 + 错误处理 + 路径优化）> 打包发布 > ~~特效/滤镜~~（移至 Phase 5）

#### 4.1 技术决策

| 问题 | 决策 |
|------|------|
| 测试策略 | **双层**：单元测试用 `mock.module()` 隔离（快速/确定/免费）+ E2E 用真实 API 验证（sandbox 或用户提供 Key） |
| Mock 基础设施 | 参考 Claude Code：`tests/mocks/` + `mock.module()` + API Response Fixture + Test Data Factory |
| AI Key 管理 | 用户自配，App 不内置 Key；`.env.sandbox.example` + `.gitignore`（不提交真实 Key） |
| 特效/滤镜/关键帧 | 移至 Phase 5 |
| 发布平台 | Windows x64 优先，macOS 后续版本 |

---

#### Phase 4.1：核心 ReAct 循环测试（14 tasks）

> **双层测试策略**：Mock 驱动的单元/集成测试（覆盖所有子系统） + 真实 API 的 E2E 验证

##### 4.1.1 Mock 基础设施

参考 Claude Code `tests/mocks/` + `mock.module()` 模式：

```typescript
// tests/mocks/api-responses.ts — 预构建 API 响应 fixture

/** 纯文本流式响应 chunks */
export function textStreamChunks(text: string): ApiStreamChunk[] {
  return [{ choices: [{ delta: { content: text } }] }, { choices: [{ delta: {} }] }]
}

/** Tool Call 流式响应 chunks */
export function toolCallStreamChunks(name: string, args: Record<string, unknown>): ApiStreamChunk[] {
  return [
    { choices: [{ delta: { tool_calls: [{ id: 'call_1', function: { name, arguments: '' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } }] },
    { choices: [{ delta: {} }] },
  ]
}

/** Multi-Tool Call 响应 */
export function multiToolCallChunks(calls: Array<{ name: string; args: Record<string, unknown> }>): ApiStreamChunk[]

/** 错误响应 fixture */
export const ERROR_RESPONSES = {
  rate_limit_429: { status: 429, message: 'Rate limit exceeded', type: 'rate_limit' },
  prompt_too_long: { status: 400, message: 'prompt is too long', type: 'prompt_too_long' },
  max_output_tokens: { status: 200, finishReason: 'max_tokens', type: 'max_output_tokens' },
  server_error_500: { status: 500, message: 'Internal server error', type: 'server_error' },
}

/** Mock API Client（替换 mock.module()） */
export function createMockApiClient(responses: ApiStreamChunk[][]): ApiClient {
  let callIndex = 0
  return {
    chat: {
      completions: {
        create: async function* () {
          const chunks = responses[callIndex++] || responses[responses.length - 1]
          for (const chunk of chunks) yield chunk
        },
      },
    },
  } as unknown as ApiClient
}
```

```typescript
// tests/mocks/factories.ts — Test Data Factory

export function createTestMessage(overrides?: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: 'test message' }],
    timestamp: Date.now(),
    ...overrides,
  }
}

export function createTestToolCall(name: string, input: Record<string, unknown>): ToolUseBlock {
  return { type: 'tool_use', id: `call_${Math.random().toString(36).slice(2)}`, name, input }
}

export function createTestConversation(turns: number): ConversationMessage[] {
  const msgs: ConversationMessage[] = []
  for (let i = 0; i < turns; i++) {
    msgs.push(createTestMessage({ role: 'user', content: [{ type: 'text', text: `turn ${i}` }] }))
    msgs.push(createTestMessage({ role: 'assistant', content: [{ type: 'text', text: `reply ${i}` }] }))
  }
  return msgs
}
```

##### 4.1.2 任务拆解（14 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P4.1.1 | Mock 基础设施 | `tests/mocks/api-responses.ts` + `tests/mocks/factories.ts` | - | API Response Fixture + Test Data Factory + createMockApiClient 可用 |
| P4.1.2 | 消息结构 + API 适配 单元测试 | `__tests__/queryEngine/message.test.ts` | P3.4.1, P4.1.1 | toApiFormat(text/tool/image) + StreamingAccumulator(增量累积) + Image Block 转换通过 |
| P4.1.3 | System Prompt 构建测试 | `__tests__/queryEngine/systemPrompt.test.ts` | P3.4.3, P4.1.1 | buildSystemPrompt 输出含域知识 + tool JSON Schema + 草稿状态 + 记忆上下文 |
| P4.1.4 | Tool Registry 测试 | `__tests__/queryEngine/toolRegistry.test.ts` | P3.4.5 | register/get/registerMcpTool/createSubset（子 Agent 独立池）通过 |
| P4.1.5 | Streaming Tool Executor 单元测试 | `__tests__/queryEngine/streamingToolExecutor.test.ts` | P3.4.9a, P4.1.1 | 并发安全并行 + 非安全串行 + per-tool AbortController + progress message + 结果按序输出 |
| P4.1.6 | Compaction 单元测试 | `__tests__/queryEngine/compaction.test.ts` | P3.4.4, P4.1.1 | 5 层（snip/micro/session/auto/reactive）各自正确 + token 计数 + preservePriority 验证 |
| P4.1.7 | Error Recovery 单元测试 | `__tests__/queryEngine/errorRecovery.test.ts` | P3.4.10, P4.1.1 | prompt_too_long → reactive compact → 重试、529 → fallback model、max_output_tokens → token 升级、全失败 → graceful error |
| P4.1.8 | Session Persistence 单元测试 | `__tests__/queryEngine/sessionPersistence.test.ts` | P3.4.11 | appendMessage(JSONL) + restoreSession(恢复) + UUID 链完整性 + cleanupOldSessions(过期清理) |
| P4.1.9 | PermissionGuard + Denial 测试 | `__tests__/queryEngine/permission.test.ts` | P3.1.3, P3.4.7, P4.1.1 | allow/deny/ask + 连续拒绝追踪(3次→auto deny) + 替代方案建议 |
| P4.1.10 | Agentic Loop 核心测试 | `__tests__/queryEngine/agenticLoop.test.ts` | P3.4.9, P4.1.1 | 8 种 LoopExitReason + abort 中断 + budget exceeded + max_turns + error recovery + model switch（全部用 mock） |
| P4.1.11 | Multi-Agent 测试 | `__tests__/queryEngine/multiAgent.test.ts` | P3.4.12, P4.1.1 | AgentTool handler + 子 Agent 独立 tool pool + permission mode 隔离 + abort 传播 |
| P4.1.12 | IPC Query 全通道集成测试 | `__tests__/ipc/query.test.ts` | P3.4.14 | send/send-stream/interrupt/abort-tool/switch-model/list-sessions/restore-session/get-cost 共 14 通道 |
| P4.1.13 | 完整 ReAct 循环 Mock E2E | `__tests__/e2e/react-loop-mock.test.ts` | P4.1.2~11 | Happy path + error path + abort + compaction triggered + model switch（mock API，确定性断言） |
| P4.1.14 | 真实 API E2E 验证 | `__tests__/e2e/react-loop-live.test.ts` | P4.1.13 | 5 个场景（创建/添加/查询/保存/删除）通过真实 AI API（sandbox 或用户提供 Key） |

##### 4.1.3 测试环境配置

```bash
# .env.sandbox.example（提交到 repo，不含真实 Key）
# 复制为 .env.sandbox 并填入真实 Key（已加入 .gitignore）
BAILIAN_API_KEY=your_key_here
BAILIAN_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
MINIMAX_API_KEY=your_key_here
MINIMAX_API_BASE=https://api.minimax.chat/v1
GLM_API_KEY=your_key_here
GLM_API_BASE=https://open.bigmodel.cn/api/paas/v4
```

```typescript
// tests/helpers/sandbox.ts
/** 检查 sandbox 环境是否可用（跳过不可用的 live 测试） */
export function isSandboxAvailable(): boolean {
  return !!(process.env.BAILIAN_API_KEY || process.env.MINIMAX_API_KEY || process.env.GLM_API_KEY)
}

/** describeIfSandbox — 仅在 sandbox 可用时运行 */
export const describeIfSandbox = isSandboxAvailable() ? describe : describe.skip
```

##### 4.1.4 E2E 测试用例（Mock + Live 双版本）

| 用例 | 输入 | Mock 断言 | Live 验证 |
|------|------|-----------|-----------|
| U1 | "创建一个 1920x1080 的草稿" | create_draft tool 被调用，参数 {width:1920, height:1080} | MCP create_draft 成功，返回 draft_id |
| U2 | "添加 E:\test.mp4" | add_videos tool 被调用，path 含 "test.mp4" | 素材记录写入 draft_materials |
| U3 | "草稿里有哪些素材" | get_draft_materials tool 被调用 | 返回素材列表 |
| U4 | "保存草稿" | save_draft tool 被调用 | JSON 文件生成 |
| U5 | "删除刚才的草稿" | delete_draft tool 被调用 + 权限确认触发 | 草稿标记 ARCHIVED |
| U6 | 用户中断（Ctrl+C） | abort 事件发出，LoopResult.reason='aborted_streaming' | — |
| U7 | API 返回 429 | model_switch 事件发出，fallback model 被使用 | — |
| U8 | 长对话触发 compaction | context_compaction 事件发出，preservePriority 正确 | — |
| U9 | Tool 权限被拒绝 | tool_result.is_error=true，AI 收到拒绝消息后给出替代建议 | — |

##### 4.1.5 测试文件结构

```
tests/
├── mocks/
│   ├── api-responses.ts        # API 响应 fixture（text/tool_call/error/multi_tool）
│   ├── factories.ts            # Test Data Factory（createTestMessage/ToolCall/Conversation）
│   └── mock-modules.ts         # mock.module() 统一入口（mockApiClient/mockMcpClient/mockPermissionManager）
├── helpers/
│   └── sandbox.ts              # sandbox 环境检测 + describeIfSandbox
├── __tests__/
│   ├── queryEngine/
│   │   ├── message.test.ts     # 消息结构 + API 适配 + StreamingAccumulator
│   │   ├── systemPrompt.test.ts # System Prompt 构建
│   │   ├── toolRegistry.test.ts # Tool Registry + createSubset
│   │   ├── streamingToolExecutor.test.ts # 并发/串行/abort/progress
│   │   ├── compaction.test.ts  # 5 层 compaction + token 计数
│   │   ├── errorRecovery.test.ts # 4 层 error recovery
│   │   ├── sessionPersistence.test.ts # JSONL 读写 + 恢复 + 清理
│   │   ├── permission.test.ts  # 权限检查 + 连续拒绝 + 拒绝策略
│   │   ├── agenticLoop.test.ts # 核心循环（8 种退出条件）
│   │   └── multiAgent.test.ts  # AgentTool + SubQueryEngine
│   ├── ipc/
│   │   └── query.test.ts       # 14 个 IPC 通道
│   └── e2e/
│       ├── react-loop-mock.test.ts  # Mock E2E（确定性，CI 必跑）
│       └── react-loop-live.test.ts  # Live E2E（需 sandbox Key，CI 可选）
```

---

#### Phase 4.2：素材路径体系（11 tasks）

> **设计原则**：
> 1. 跨平台优先（Windows + macOS），路径工具放在 `packages/shared/` 共享包
> 2. 内部统一使用绝对路径 + 平台原生分隔符，仅在与外部系统交互时转换
> 3. 参考 DMVideo `local_materials.py` 的 `os.path.abspath()` + `os.path.exists()` 双重校验模式
> 4. MCP Server 为 TypeScript（与 Electron 打包），路径处理器也是 `.ts`

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P4.2.1 | 跨平台路径核心工具 | `packages/shared/src/path/core.ts` | - | normalize/resolve/toFileUrl/fromFileUrl/realpath 跨平台正确；symlink/junction 自动解析 |
| P4.2.2 | 剪映 JSON 路径双向映射 | `packages/shared/src/path/jianying.ts` | P4.2.1 | toJianYingPath/fromJianYingPath 双向转换，生成 draft_content.json 中 materials 路径格式正确 |
| P4.2.3 | 路径安全与边界校验 | `packages/shared/src/path/security.ts` | P4.2.1 | isWithinRoot 防路径遍历；UNC `\\server\share` 路径支持；Windows 长路径 `\\?\` 前缀处理 |
| P4.2.4 | 中文/Unicode 路径处理 | `packages/shared/src/path/unicode.ts` | P4.2.1 | 中文路径 `E:\视频\旅行.mp4` → file URL 正确 percent-encoding；macOS UTF-8 NFD/NFC 归一化 |
| P4.2.5 | 文件名清理与大小写统一 | `packages/shared/src/path/sanitize.ts` | - | sanitizeFilename 清理非法字符；Windows 大小写不敏感去重辅助 |
| P4.2.6 | 素材存在性与完整性校验 | `core/material/integrity.ts` | P4.2.1 | existsCheck + staleRefScan 扫描失效引用；校验失败返回 MaterialIntegrityReport |
| P4.2.7 | 剪映草稿目录发现与配置 | `core/draft/draftRoot.ts` | P4.2.1 | 自动发现 Windows/macOS 剪映安装路径下草稿目录；支持用户手动覆盖 |
| P4.2.8 | 路径变更监听与引用更新 | `core/material/pathWatcher.ts` | P4.2.1, P4.2.6 | fs.watch 监听素材移动/重命名；自动更新 DB file_path + 草稿 JSON 引用 |
| P4.2.9 | 缩略图路径生成规则 | `core/material/thumbnailPath.ts` | P4.2.1, P4.2.5 | 缩略图相对素材根目录 `thumbnails/{material_id}.jpg`；路径与素材路径联动 |
| P4.2.10 | MCP Server 路径校验增强 | `core/mcp/handlers/materialPath.ts` | P4.2.1, P4.2.3 | 校验失败返回中文友好错误 + ErrorCode，不崩溃；集成安全校验 |
| P4.2.11 | Electron 集成层 | `src/utils/path.ts` | P4.2.1~P4.2.10 | 统一 re-export + MaterialManager 全量接入；路径工具单入口 |

**路径工具架构（分层）**：

```
packages/shared/src/path/        ← 底层路径原语（纯函数，无 side-effect）
├── core.ts       # P4.2.1 normalize, resolve, toFileUrl, fromFileUrl, realpath
├── jianying.ts   # P4.2.2 toJianYingPath, fromJianYingPath
├── security.ts   # P4.2.3 isWithinRoot, validateMaterialPath, UNC, long path
├── unicode.ts    # P4.2.4 percentEncode, percentDecode, normalizeNFC
└── sanitize.ts   # P4.2.5 sanitizeFilename, normalizeCase

core/material/                    ← 业务层路径逻辑
├── integrity.ts    # P4.2.6 existsCheck, staleRefScan, hashVerify
├── pathWatcher.ts  # P4.2.8 watchMaterialDir, updateReferences
└── thumbnailPath.ts # P4.2.9 generateThumbnailPath

core/draft/
└── draftRoot.ts    # P4.2.7 discoverJianYingDraftRoot, validateDraftRoot

core/mcp/handlers/
└── materialPath.ts # P4.2.10 validateAndResolveMaterialPath

src/utils/path.ts                 ← Electron 集成层（re-export + 适配）
                    # P4.2.11
```

**跨平台路径处理规范**：

```typescript
// ── P4.2.1: 跨平台核心 ──
import { normalize, resolve, isAbsolute } from 'packages/shared/src/path/core'

// Windows
normalizePath("E:\\videos\\test.mp4")     → "E:\\videos\\test.mp4"
normalizePath("E:/videos/test.mp4")       → "E:\\videos\\test.mp4"  // 统一为平台分隔符
normalizePath("C:/Users/中文/视频.mp4")    → "C:\\Users\\中文\\视频.mp4"
toFileUrl("E:\\videos\\test.mp4")         → "file:///E:/videos/test.mp4"
fromFileUrl("file:///E:/videos/test.mp4") → "E:\\videos\\test.mp4"

// macOS
normalizePath("/Users/xxx/video.mp4")     → "/Users/xxx/video.mp4"
toFileUrl("/Users/xxx/video.mp4")         → "file:///Users/xxx/video.mp4"

// UNC 路径 (Windows)
normalizePath("\\\\NAS\\share\\video.mp4") → "\\\\NAS\\share\\video.mp4"
toFileUrl("\\\\NAS\\share\\video.mp4")     → "file://NAS/share/video.mp4"

// Symlink/Junction 自动解析
realpath("C:\\Users\\用户\\Documents\\video.mp4")  → 实际 NTFS 路径

// ── P4.2.2: 剪映 JSON 路径映射 ──
import { toJianYingPath, fromJianYingPath } from 'packages/shared/src/path/jianying'

// 写入 draft_content.json → materials.videos[].path 时的格式
toJianYingPath("E:\\素材\\test.mp4")  → 素材在 JSON 中的标准格式
fromJianYingPath(jsonPath)             → "E:\\素材\\test.mp4" (本地绝对路径)

// ── P4.2.3: 安全校验 ──
import { isWithinRoot, validateMaterialPath } from 'packages/shared/src/path/security'

isWithinRoot("E:\\素材\\test.mp4", "E:\\素材")   → true
isWithinRoot("E:\\..\\etc\\passwd", "E:\\素材")  → false (路径遍历拦截)

// Windows 长路径自动处理
validateMaterialPath("E:\\超长\\嵌套\\...\\250字符以上\\test.mp4")
// → 自动添加 \\?\ 前缀

// ── P4.2.4: Unicode 处理 ──
import { percentEncodePath, normalizeNFC } from 'packages/shared/src/path/unicode'

percentEncodePath("E:\\视频\\旅行素材\\北京.mp4")
// → "file:///E:/%E8%A7%86%E9%A2%91/%E6%97%85%E8%A1%8C%E7%B4%A0%E6%9D%90/%E5%8C%97%E4%BA%AC.mp4"

// macOS NFD→NFC 归一化（避免同文件不同编码导致去重失败）
normalizeNFC("/Users/xxx/café.mp4") → "/Users/xxx/café.mp4" (NFC 统一)

// ── P4.2.5: 文件名清理 ──
import { sanitizeFilename, normalizeCase } from 'packages/shared/src/path/sanitize'

sanitizeFilename('视频: "2024*旅行?.mp4') → '视频_ _2024_旅行_.mp4'
normalizeCase("E:\\VIDEO\\Test.MP4")       → "E:\\video\\test.mp4" (Windows 小写归一化)
```

**剪映草稿目录发现规则（P4.2.7）**：

```
// Windows 常见路径
%LOCALAPPDATA%/JianyingPro/User Data/Projects/com.lveditor.draft
%LOCALAPPDATA%/CapCut/User Data/Projects/com.lveditor.draft         ← 剪映国际版

// macOS 常见路径
~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft
~/Movies/CapCut/User Data/Projects/com.lveditor.draft               ← 国际版

// 发现策略
1. 扫描上述默认路径，取第一个存在的
2. 检查路径下是否有 draft_meta_info.json 文件结构
3. 允许用户在设置中手动覆盖草稿根目录
4. 多版本共存时展示列表让用户选择
```

**路径变更监听策略（P4.2.8）**：

```typescript
// 监听范围
// - 仅监听素材根目录及其子目录
// - 排除 .git/、node_modules/、thumbnails/ 等干扰目录
// - 使用 fs.watch (Electron 主进程) + 防抖 (300ms)

// 素材移动/重命名时的处理流程：
// 1. 检测到 rename/move 事件
// 2. 查找 DB 中旧路径 → 获取关联的 material_id
// 3. 查找所有引用该 material_id 的草稿 JSON
// 4. 批量更新 DB file_path + 草稿 JSON 中 materials.*[].path
// 5. 更新缩略图路径（如果缩略图与素材同目录）
// 6. 发送 IPC 广播通知 UI 刷新

// 素材被删除时的处理：
// - 标记 material.is_deleted = 1（软删除）
// - 保留引用关系，在草稿中标记为"素材缺失"
// - UI 显示黄色警告而非直接移除
```

**素材存在性校验报告（P4.2.6）**：

```typescript
interface MaterialIntegrityReport {
  totalChecked: number
  missing: Array<{ materialId: string; path: string; referencedByDrafts: string[] }>
  moved: Array<{ materialId: string; oldPath: string; newPath: string }>
  corrupted: Array<{ materialId: string; path: string; reason: string }>
}

// 校验时机：
// 1. 打开草稿时自动校验该草稿引用的素材
// 2. 用户手动触发全量扫描（设置面板）
// 3. 素材导入后立即校验新导入项
```

---

#### Phase 4.3：错误处理与提示（11 tasks）

> **设计原则**：对照 DMVideo 后端 10 种自定义异常 + 统一 `{code, message, data}` 响应格式，
> 前端 HttpError 类 + 重试机制，建立完整的错误处理链路。
> 与 P3.4.10（内部错误恢复：Reactive Compact + Fallback Model）互补，
> 本阶段聚焦 **面向用户的错误体验**。

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P4.3.1 | 统一 ErrorCode 枚举（6 大领域） | `types/error.ts` | - | 覆盖 MCP / IPC / AI / Draft / Material / Export 6 大领域 ≥30 个错误码 |
| P4.3.2 | 标准错误响应格式（跨层传递） | `types/errorResponse.ts` | P4.3.1 | MCP → IPC → UI 三层错误传递链格式统一 |
| P4.3.3 | MCP Server 错误转换 | `core/mcp/errors.ts` | P1.3, P4.3.1 | 所有 MCP 异常转为标准 ErrorCode，含断线/重连/版本不兼容 |
| P4.3.4 | IPC 层错误传递 | `ipc/errors.ts` | P3.4.11, P4.3.2 | 错误通过 IPC 通道正确传递，保留 cause chain |
| P4.3.5 | 错误日志基础设施 | `core/telemetry/errorLogger.ts` | P4.3.1 | 结构化错误日志 + 上下文收集 + 按错误码聚合 |
| P4.3.6 | Vue Error Boundary + 全局错误捕获 | `components/common/ErrorBoundary.vue` | - | 组件崩溃不白屏，未处理 Promise 拒绝不丢失 |
| P4.3.7 | 全局错误 Store + Toast 通知 | `stores/error.ts` + `components/common/ToastNotification.vue` | P4.3.1, P4.3.6 | useErrorStore 管理错误队列，Toast 非阻塞提示 |
| P4.3.8 | 分场景错误展示组件 | `components/errors/` | P4.3.7 | REPL / 设置 / 素材面板 / 时间线 / 导出 5 个场景错误组件 |
| P4.3.9 | 用户侧错误恢复体验 | `core/queryEngine/userErrorRecovery.ts` | P3.4.10, P4.3.7 | 分级重试策略 + 恢复建议 + 用户确认流程（不与 P3.4.10 冲突） |
| P4.3.10 | 校验错误格式与展示 | `types/validation.ts` | P4.3.1 | 字段级校验错误 {field, message, value} + 表单内联展示 |
| P4.3.11 | 错误处理集成测试 | `__tests__/errorHandling/` | P4.3.1-P4.3.10 | 错误码映射 + IPC 传递 + Error Boundary + Toast + 重试策略 覆盖 |

**错误处理架构（3 层）**：

```
┌───────────────────────────────────────────────────────────────┐
│ Layer 1 — 类型层 (types/)                                     │
│  types/error.ts          ErrorCode 枚举（6 大领域）+ AppError │
│  types/errorResponse.ts  StandardErrorResponse 跨层格式       │
│  types/validation.ts     ValidationError 字段级校验           │
├───────────────────────────────────────────────────────────────┤
│ Layer 2 — 核心层 (core/)                                      │
│  core/mcp/errors.ts           MCP 异常 → ErrorCode 转换       │
│  core/telemetry/errorLogger.ts 结构化日志 + 聚合              │
│  core/queryEngine/userErrorRecovery.ts 用户侧恢复体验         │
│  ipc/errors.ts                IPC 错误封装 + cause chain      │
├───────────────────────────────────────────────────────────────┤
│ Layer 3 — 表现层 (components/ + stores/)                      │
│  stores/error.ts              useErrorStore 全局错误状态       │
│  components/common/ErrorBoundary.vue    Vue 错误边界          │
│  components/common/ToastNotification.vue Toast 通知           │
│  components/errors/            分场景错误组件目录              │
│    REPLError.vue              REPL 错误（替代旧 ErrorMessage）│
│    SettingsError.vue          设置页错误                       │
│    MaterialError.vue          素材面板错误                     │
│    TimelineError.vue          时间线编辑错误                   │
│    ExportError.vue            导出对话框错误                   │
└───────────────────────────────────────────────────────────────┘
```

**ErrorCode 枚举设计（6 大领域 ≥30 个错误码）**：

```typescript
// types/error.ts — 对照 DMVideo exceptions.py 10 种异常 + plan 架构场景

export enum ErrorCode {
  // ─── MCP 层错误（服务端）─── DMVideo 对应: 全局异常处理器 + 业务 code
  MCP_DRAFT_NOT_FOUND = "MCP_DRAFT_NOT_FOUND",         // 草稿不存在
  MCP_MATERIAL_NOT_FOUND = "MCP_MATERIAL_NOT_FOUND",   // 素材不存在
  MCP_PATH_INVALID = "MCP_PATH_INVALID",               // 路径无效
  MCP_AUTH_FAILED = "MCP_AUTH_FAILED",                  // 认证失败
  MCP_PERMISSION_DENIED = "MCP_PERMISSION_DENIED",      // 权限拒绝
  MCP_INTERNAL_ERROR = "MCP_INTERNAL_ERROR",            // 内部错误
  MCP_CONNECTION_LOST = "MCP_CONNECTION_LOST",          // MCP Server 断线
  MCP_VERSION_MISMATCH = "MCP_VERSION_MISMATCH",        // MCP 版本不兼容
  MCP_STATE_SYNC_FAILED = "MCP_STATE_SYNC_FAILED",      // 重连后状态同步失败

  // ─── IPC 层错误（客户端）─── DMVideo 对应: ipc_handle try/catch 统一
  IPC_CONNECTION_FAILED = "IPC_CONNECTION_FAILED",      // IPC 连接失败
  IPC_TIMEOUT = "IPC_TIMEOUT",                          // 调用超时
  IPC_CHANNEL_NOT_FOUND = "IPC_CHANNEL_NOT_FOUND",      // 通道不存在
  IPC_SERIALIZATION_ERROR = "IPC_SERIALIZATION_ERROR",  // 序列化/反序列化失败

  // ─── AI 层错误 ─── DMVideo 对应: bailian withAuthRetry + httpClient 状态码映射
  AI_API_ERROR = "AI_API_ERROR",                        // API 调用失败
  AI_RATE_LIMIT = "AI_RATE_LIMIT",                      // 限流
  AI_INVALID_RESPONSE = "AI_INVALID_RESPONSE",          // 响应格式错误
  AI_TOKEN_BUDGET_EXCEEDED = "AI_TOKEN_BUDGET_EXCEEDED",// Token 预算耗尽
  AI_MODEL_UNAVAILABLE = "AI_MODEL_UNAVAILABLE",        // 模型不可用

  // ─── 草稿错误 ─── DMVideo 对应: DraftNotFound + DraftStatus.ERROR 状态机
  DRAFT_NOT_FOUND = "DRAFT_NOT_FOUND",                  // 草稿不存在
  DRAFT_CORRUPTED = "DRAFT_CORRUPTED",                  // 草稿 JSON 损坏
  DRAFT_VERSION_INCOMPATIBLE = "DRAFT_VERSION_INCOMPATIBLE",// 剪映版本不兼容
  DRAFT_STATE_INVALID = "DRAFT_STATE_INVALID",          // 状态机非法转换
  DRAFT_EXPORT_FAILED = "DRAFT_EXPORT_FAILED",          // 导出失败

  // ─── 素材/时间线错误 ─── DMVideo 对应: MaterialNotFound, SegmentOverlap, TrackNotFound 等
  MATERIAL_NOT_FOUND = "MATERIAL_NOT_FOUND",            // 素材不存在
  MATERIAL_FORMAT_UNSUPPORTED = "MATERIAL_FORMAT_UNSUPPORTED",// 格式不支持
  MATERIAL_INTEGRITY_FAILED = "MATERIAL_INTEGRITY_FAILED",   // 完整性校验失败
  SEGMENT_OVERLAP = "SEGMENT_OVERLAP",                  // 片段重叠
  TRACK_NOT_FOUND = "TRACK_NOT_FOUND",                  // 轨道不存在
  TRACK_TYPE_MISMATCH = "TRACK_TYPE_MISMATCH",          // 轨道类型不匹配

  // ─── 存储/导出错误 ─── DMVideo 对应: ExportTimeout + 文件系统操作
  STORAGE_DISK_FULL = "STORAGE_DISK_FULL",              // 磁盘空间不足
  STORAGE_PERMISSION_DENIED = "STORAGE_PERMISSION_DENIED",// 文件权限拒绝
  STORAGE_PATH_TOO_LONG = "STORAGE_PATH_TOO_LONG",      // 路径超长
  EXPORT_TIMEOUT = "EXPORT_TIMEOUT",                    // 导出超时
  EXPORT_FFMPEG_FAILED = "EXPORT_FFMPEG_FAILED",        // FFmpeg 合成失败

  // ─── 校验错误 ─── DMVideo 对应: ValueError 参数校验
  VALIDATION_FAILED = "VALIDATION_FAILED",              // 通用校验失败
  VALIDATION_PARAM_INVALID = "VALIDATION_PARAM_INVALID",// 参数无效

  // ─── 通用 ───
  UNKNOWN = "UNKNOWN",
}

// ─── 增强 AppError（对照 DMVideo HttpError + plan DraftState.error）───
export interface AppError {
  code: ErrorCode;
  message: string;        // 中文友好提示（如"草稿不存在，请检查草稿路径"）
  detail?: string;        // 英文技术细节（如"DraftNotFoundException: /path/to/draft"）
  retryable: boolean;     // 是否可重试
  retryStrategy?: RetryStrategy;  // 重试策略（可重试时必填）
  context?: ErrorContext; // 错误上下文
  cause?: AppError;       // 错误链（底层错误）
  timestamp: number;      // 错误发生时间戳
}

export interface ErrorContext {
  operation: string;      // 触发错误的操作（如 "createDraft", "addMaterial"）
  params?: Record<string, unknown>; // 操作参数（脱敏后）
  userId?: string;        // 关联用户
  sessionId?: string;     // 关联会话
  draftId?: string;       // 关联草稿
}

// ─── 分级重试策略（对照 DMVideo 下载重试退避 + ASR MAX_ATTEMPTS）───
export enum RetryStrategy {
  NONE = "none",                  // 不重试（校验错误、权限错误）
  IMMEDIATE = "immediate",        // 立即重试（IPC 超时）
  EXPONENTIAL_BACKOFF = "exponential_backoff", // 指数退避（AI API 限流、MCP 断线）
  USER_CONFIRM = "user_confirm",  // 用户确认后重试（素材完整性失败、导出失败）
  FALLBACK_MODEL = "fallback_model", // 切换模型重试（AI 主模型不可用）
}

// ─── ErrorCode → RetryStrategy 默认映射 ───
export const DEFAULT_RETRY_STRATEGY: Partial<Record<ErrorCode, RetryStrategy>> = {
  [ErrorCode.IPC_TIMEOUT]:                  RetryStrategy.IMMEDIATE,
  [ErrorCode.IPC_CONNECTION_FAILED]:         RetryStrategy.IMMEDIATE,
  [ErrorCode.AI_RATE_LIMIT]:                 RetryStrategy.EXPONENTIAL_BACKOFF,
  [ErrorCode.AI_MODEL_UNAVAILABLE]:          RetryStrategy.FALLBACK_MODEL,
  [ErrorCode.MCP_CONNECTION_LOST]:           RetryStrategy.EXPONENTIAL_BACKOFF,
  [ErrorCode.MATERIAL_INTEGRITY_FAILED]:     RetryStrategy.USER_CONFIRM,
  [ErrorCode.EXPORT_FFMPEG_FAILED]:          RetryStrategy.USER_CONFIRM,
  [ErrorCode.STORAGE_PERMISSION_DENIED]:     RetryStrategy.USER_CONFIRM,
  [ErrorCode.VALIDATION_FAILED]:             RetryStrategy.NONE,
  [ErrorCode.DRAFT_CORRUPTED]:               RetryStrategy.NONE,
}
```

**标准错误响应格式（跨层传递）**：

```typescript
// types/errorResponse.ts — 对照 DMVideo {code: 0, msg, data} 统一格式

// MCP → IPC 标准错误响应
export interface StandardErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;        // 中文友好提示
    detail?: string;        // 英文技术细节
    retryable: boolean;
    retryStrategy?: RetryStrategy;
  };
  meta: {
    timestamp: number;
    requestId: string;      // 请求追踪 ID
    layer: 'mcp' | 'ipc' | 'ui';  // 错误发生层
  };
}

// 成功响应（对照 DMVideo {code: 0, message: "success", data}）
export interface StandardSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta: {
    timestamp: number;
    requestId: string;
  };
}

export type StandardResponse<T = unknown> = StandardSuccessResponse<T> | StandardErrorResponse;
```

**用户侧错误恢复流程（与 P3.4.10 互补）**：

```
P3.4.10 内部恢复（自动，用户不可见）       P4.3.9 用户侧恢复（用户参与）
┌──────────────────────────┐              ┌──────────────────────────┐
│ Reactive Compact          │              │ 内部恢复全部失败时触发    │
│ Fallback Model            │              │                          │
│ Withholding               │              │ 1. 分级重试策略选择       │
│                           │              │ 2. 用户确认对话框         │
│ 成功 → 用户无感知继续      │──失败──→    │ 3. 恢复建议展示          │
│ 失败 → 交给 P4.3.9       │              │ 4. 用户选择重试/跳过/取消 │
└──────────────────────────┘              └──────────────────────────┘

用户侧恢复流程：
Tool 调用失败（P3.4.10 内部恢复已耗尽）
    │
    ├── retryStrategy=IMMEDIATE → 自动重试 1 次 → 仍失败则提示用户
    ├── retryStrategy=EXPONENTIAL_BACKOFF → 自动重试 3 次（间隔 1s/2s/4s）→ 仍失败则提示
    ├── retryStrategy=FALLBACK_MODEL → 切换模型重试 → 仍失败则提示
    ├── retryStrategy=USER_CONFIRM → 直接弹出确认对话框
    └── retryStrategy=NONE → 仅展示错误，不提供重试

用户确认对话框：
┌──────────────────────────────────────────────┐
│  ⚠️ 操作失败                                  │
│                                              │
│  草稿导出失败：FFmpeg 合成超时                 │
│  建议：关闭其他占用 CPU 的程序后重试           │
│                                              │
│  [重试]    [跳过]    [查看详情]               │
└──────────────────────────────────────────────┘
```

**错误日志格式**：

```typescript
// core/telemetry/errorLogger.ts — 对照 DMVideo logger.httpError 结构化日志

interface ErrorLogEntry {
  timestamp: string;           // ISO 8601
  level: 'error' | 'warn';
  code: ErrorCode;
  message: string;
  detail?: string;
  context: ErrorContext;
  // 聚合字段
  fingerprint: string;         // code + operation 哈希，用于错误去重和聚合统计
}

// 写入位置：electron.app.getPath('userData') / logs / error-{date}.log
// 保留策略：保留最近 30 天日志
```

**Toast 通知规范**：

```typescript
// components/common/ToastNotification.vue

type ToastType = 'error' | 'warning' | 'info' | 'success';

interface ToastOptions {
  type: ToastType;
  message: string;             // 中文友好提示
  duration?: number;           // 自动消失时间（ms），error 默认不自动消失
  action?: {
    label: string;             // 操作按钮文案（如"重试"、"查看"）
    handler: () => void;       // 点击回调
  };
}

// 使用示例：
// toast.error({ message: '素材导入失败：文件格式不支持', action: { label: '重试', handler: retry } })
// toast.warning({ message: '磁盘空间不足，剩余 500MB', duration: 5000 })
```

---

#### Phase 4.4：聊天窗口 @素材引用（2 tasks）

> 用户在 REPL 输入框中输入 `@` 时，弹出素材自动完成列表

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P4.4.1 | @素材自动完成组件 | `components/REPL/MaterialAutocomplete.vue` | P3.4.13, P3.2.13 | 输入 `@` 弹出素材列表，支持模糊搜索 |
| P4.4.2 | 素材引用解析与渲染 | `utils/materialRef.ts` + `components/REPL/MaterialRef.vue` | P4.4.1 | `@[video:test.mp4]` 正确解析并渲染为可点击引用 |

**@素材引用交互流程**：

```
用户输入 "@" → 弹出素材列表（模糊搜索）→ 选择素材 → 插入引用
                                                              ↓
                                                    @[video:E:\test.mp4]
                                                              ↓
用户发送消息 → AI 收到引用 → 解析为实际素材信息 → 执行对应 Tool
```

**素材引用格式设计**：

```typescript
// 引用格式
@[video:E:\videos\test.mp4]
@[audio:E:\music\bgm.mp3]
@[text:字幕内容]
@[material:material_id]

// 解析后的消息结构
interface MessageWithMaterialRef {
  text: "帮我添加 @[video:E:\test.mp4] 到草稿",
  materialRefs: [
    { type: "video", path: "E:\\test.mp4", raw: "@[video:E:\\test.mp4]" }
  ]
}
```

**MaterialAutocomplete 组件**：

```tsx
// 触发：用户输入 @ 字符后
// 显示：浮动下拉列表，显示素材名称 + 路径 + 类型图标
// 搜索：实时模糊匹配素材名称
// 选择：回车或点击选中，插入引用字符串
// 关闭：Esc 或点击外部
```

---

#### Phase 4.5：Windows 打包发布（5 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P4.5.1 | electron-builder 配置 | `electron-builder.yml` | P2.9 | 配置文件正确，支持 Windows |
| P4.5.2 | Windows x64 构建配置 | `package.json` | P4.5.1 | `bunx electron-builder --win` 成功 |
| P4.5.3 | App 图标和名称 | `build/icon.ico` + `productName` | P4.5.1 | 打包后 .exe 显示正确图标和名称 |
| P4.5.4 | 构建脚本 | `scripts/build.sh` / `.bat` | P4.5.2 | 一键构建，输出 `dist/` |
| P4.5.5 | 用户 API Key 配置界面 | `components/Settings/APIKeyConfig.vue` | P2.7 | 用户可填入自己的 Key，App 保存到本地 |

**electron-builder.yml 配置**：

```yaml
# electron-builder.yml
appId: com.jydraft.app
productName: JY Draft
copyright: Copyright © 2024
directories:
  output: dist
  buildResources: build

win:
  target:
    - target: nsis
      arch:
        - x64
  icon: build/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

**用户 API Key 配置界面**：

```
┌─────────────────────────────────────────┐
│  API Key 配置                            │
├─────────────────────────────────────────┤
│                                         │
│  模型提供商：  ○ bailian  ○ MiniMax      │
│                                         │
│  API Key：   [________________________] │
│                                         │
│  API Base：  [________________________] │
│              （可选，默认使用官方地址）      │
│                                         │
│  [保存配置]        [测试连接]             │
│                                         │
└─────────────────────────────────────────┘
```

**构建流程**：

```bash
# 开发构建
bun run build:electron

# Windows 发布构建
bunx electron-builder --win --x64

# 输出
dist/
├── JY Draft Setup 1.0.0.exe  # NSIS 安装包
└── JY Draft-1.0.0.exe        # 独立可执行文件
```

---

#### Phase 4 任务总览（43 tasks）

| Phase | 任务数 | 核心交付 |
|-------|--------|----------|
| P4.1 核心 ReAct 循环测试 | 6 | E2E 测试通过，沙盒验证 |
| P4.2 素材路径体系 | 11 | 跨平台路径核心 + 剪映映射 + 安全校验 + 存在性检查 + 目录发现 + 变更监听 |
| P4.3 错误处理与提示 | 11 | 6 领域 ErrorCode + 标准响应格式 + 日志 + Error Boundary + Toast + 分级重试 + 校验错误 |
| P4.4 @素材引用 | 2 | @触发自动完成 + 引用解析渲染 |
| P4.5 Windows 打包发布 | 5 | .exe 安装包 + Key 配置界面 |
| **合计** | **43** | 可发布 Windows 版本 |

---

#### Phase 4 开发顺序（2 轮迭代）

```
第1轮迭代（测试 + 路径基础 + 错误基础）
├── P4.1.1 沙盒测试环境
├── P4.1.2 QueryEngine 单测
├── P4.1.3 ToolExecutor 单测
├── P4.2.1 跨平台路径核心工具
├── P4.2.2 剪映 JSON 路径映射
├── P4.2.3 路径安全与边界校验
├── P4.2.4 中文/Unicode 路径处理
├── P4.2.5 文件名清理与大小写
├── P4.2.6 素材存在性校验
├── P4.2.7 剪映草稿目录发现
├── P4.3.1 ErrorCode 枚举（6 大领域）
├── P4.3.2 标准错误响应格式
├── P4.3.3 MCP 错误转换
├── P4.3.5 错误日志基础设施
├── P4.3.6 Vue Error Boundary
└── P4.4.1 @素材自动完成

第2轮迭代（路径集成 + 错误体验 + 打包 + 引用）
├── P4.1.4 IPC 通道测试
├── P4.1.5 权限流程测试
├── P4.1.6 E2E ReAct 循环
├── P4.2.8 路径变更监听与引用更新
├── P4.2.9 缩略图路径生成
├── P4.2.10 MCP 路径校验增强
├── P4.2.11 Electron 集成层
├── P4.3.4 IPC 错误传递
├── P4.3.7 全局错误 Store + Toast
├── P4.3.8 分场景错误展示组件
├── P4.3.9 用户侧错误恢复体验
├── P4.3.10 校验错误格式与展示
├── P4.3.11 错误处理集成测试
├── P4.4.2 素材引用解析渲染
├── P4.5.1 electron-builder 配置
├── P4.5.2 Windows x64 构建
├── P4.5.3 App 图标和名称
├── P4.5.4 构建脚本
└── P4.5.5 API Key 配置界面
```

---

### Phase 5：特效/滤镜/关键帧（完整版）

> **用户交互模式**：先描述再执行（AI 描述操作 → 用户确认 → 执行）
> **AI 辅助选择**：AI 理解用户意图 → 推荐 2-3 个选项 → 用户确认
> **UI 策略**：REPL 自然语言优先，Phase 5 末期做最小化特效轨道可视化

#### 5.1 技术决策

| 问题 | 决策 |
|------|------|
| 特效/滤镜/关键帧/转场/音频特效 | Phase 5 全部实现 |
| AI 辅助选择形式 | AI 推荐 2-3 个选项，用户确认后再执行 |
| 用户确认形式 | 先描述再执行（AI 描述操作，用户说「好」或「是」确认） |
| 转场 AI 推荐 | 用户可指定类型，AI 也可根据内容分析推荐，用户确认后应用 |
| 音频特效优先级 | 音频特效（变声）先于音频关键帧（音量动画） |
| 特效 UI | REPL 自然语言控制，Phase 5 末期做最小化特效轨道 |

---

#### Phase 5.1：滤镜/特效 MCP 增强（6 tasks）

> 在 Phase 1 的 MCP handler 基础上升级，增加 AI 语义匹配能力

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.1.1 | 升级 generate_video_filter handler | `core/mcp/handlers/effect.py` | P1.3 | 支持 intensity 参数，支持 segment_ids + segment_index |
| P5.1.2 | 升级 generate_video_effect handler | `core/mcp/handlers/effect.py` | P1.3 | 支持 params 数组，支持多特效叠加 |
| P5.1.3 | list_filter_presets AI 增强 | `core/mcp/handlers/effect.py` | P5.1.1 | 支持语义搜索：「复古」「电影感」「暖色」→ 匹配多个预设 |
| P5.1.4 | list_video_effect_presets AI 增强 | `core/mcp/handlers/effect.py` | P5.1.2 | 支持语义搜索：「故障」「抖动」「模糊」→ 匹配多个预设 |
| P5.1.5 | 滤镜/特效推荐 AI Prompt | `core/ai/effect_recommend.py` | P5.1.3,4 | 用户描述意图 → AI 返回 2-3 个推荐 + 理由 |
| P5.1.6 | 滤镜/特效 MCP 单元测试 | `__tests__/mcp/effect.test.ts` | P5.1.1,2 | 生成/查询/AI 匹配全通过 |

**AI 语义匹配设计**：

```typescript
// 语义搜索映射（滤镜示例）
const filterSemanticMap = {
  "复古": ["复古", "胶片", "回忆", "老照片", "暖色"],
  "电影感": ["电影", "冷色", "对比度", "饱和度", "情绪"],
  "清新": ["奶油", "蓝调", "通透", "明亮"],
  "黑白": ["黑白", "灰度", "复古黑白"],
}

// AI 推荐 Prompt（简化）
const filterRecommendPrompt = `
用户想要：{userIntent}
可选滤镜：{presetList}
请推荐 2-3 个最合适的，给出理由。
格式：1. 滤镜名 - 理由
`
```

**MCP Tool 签名（升级后）**：

```typescript
// 生成滤镜
generate_video_filter(
  filter_type_name: string,      // 可为中文名或英文名
  intensity?: number,              // 0-100，默认 100
  segment_ids?: string[],         // 素材片段 ID
  segment_index?: number[],       // 素材位置（从 1 开始）
)

// AI 推荐滤镜（新增 Tool）
recommend_filters(
  intent: string,                 // 用户意图描述，如「复古电影感」
  context?: string                // 上下文，可选
): { recommendations: FilterRecommendation[] }

interface FilterRecommendation {
  name: string;                  // 滤镜名称
  reason: string;                 // 推荐理由
  confidence: number;             // 置信度 0-1
  preview_url?: string;           // 预览图 URL（如果有）
}
```

---

#### Phase 5.2：关键帧 MCP（4 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.2.1 | 升级 generate_keyframe handler | `core/mcp/handlers/keyframe.py` | P1.3 | 支持全部 9 种属性（位置/缩放/旋转/透明度/饱和度/对比度/亮度/音量） |
| P5.2.2 | 升级 generate_audio_keyframe handler | `core/mcp/handlers/keyframe.py` | P1.3 | 支持音量渐变（渐入/渐出） |
| P5.2.3 | 关键帧属性 AI 描述 | `core/ai/keyframe_describe.py` | P5.2.1 | 「渐入效果」→ `{property: "alpha", time_offset: [0], value: [0→1]}` |
| P5.2.4 | 关键帧 MCP 单元测试 | `__tests__/mcp/keyframe.test.ts` | P5.2.1,2 | 生成/查询/AI 描述全通过 |

**KeyframeProperty 支持的属性**：

| 属性 | 中文名 | 值范围 | 常见用法 |
|------|--------|--------|----------|
| `position_x` | X轴位置 | 像素值 | 左移/右移 |
| `position_y` | Y轴位置 | 像素值 | 上移/下移 |
| `rotation` | 旋转 | 度数 | 顺时针旋转 |
| `scale_x` | X轴缩放 | 0.0-10.0 | 横向拉伸 |
| `scale_y` | Y轴缩放 | 0.0-10.0 | 纵向拉伸 |
| `uniform_scale` | 等比缩放 | 0.0-10.0 | 放大/缩小 |
| `alpha` | 透明度 | 0.0-1.0 | 淡入/淡出 |
| `saturation` | 饱和度 | -1.0-1.0 | 增强/减弱色彩 |
| `contrast` | 对比度 | -1.0-1.0 | 增强/减弱对比 |
| `brightness` | 亮度 | -1.0-1.0 | 增亮/变暗 |
| `volume` | 音量 | 0.0-10.0 | 渐强/渐弱 |

**AI 关键帧描述示例**：

```
用户：「给这段视频加一个淡入效果」
AI 理解：alpha 从 0 渐变到 1
输出：{
  property: "alpha",
  time_offset: [0],
  value: [0, 1],
  segment_index: [1]
}

用户：「让字幕从左边飞进来」
AI 理解：position_x 从 -1920 渐变到 0（假设 1920x1080）
输出：{
  property: "position_x",
  time_offset: [0, 1000000],  // 0-1秒
  value: [-1920, 0],
  segment_index: [1]
}
```

---

#### Phase 5.3：音频特效 MCP（3 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.3.1 | 升级 generate_audio_effect handler | `core/mcp/handlers/audio.py` | P1.3 | 支持大叔/女生/机器人/回音等变声特效 |
| P5.3.2 | 音频变声 AI 推荐 | `core/ai/audio_effect_recommend.py` | P5.3.1 | 「给旁白加一个低沉的声音」→ 推荐「大叔」特效 |
| P5.3.3 | 音频特效 MCP 单元测试 | `__tests__/mcp/audio.test.ts` | P5.3.1,2 | 生成/AI 推荐全通过 |

**音频特效类型**：

| 特效名 | 中文名 | 适用场景 |
|--------|--------|----------|
| `大叔` | 大叔音 | 旁白、讲述 |
| `女生` | 女生音 | 旁白、对话 |
| `机器人` | 机器人音 | 特效、对话 |
| `回音` | 回音效果 | 特效、空间感 |
| `背景音乐增强` | BGM 增强 | 背景音乐 |

---

#### Phase 5.4：转场 MCP（3 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.4.1 | 升级 generate_transition handler | `core/mcp/handlers/transition.py` | P1.3 | 支持转场类型 + 时长参数 |
| P5.4.2 | 转场 AI 内容分析推荐 | `core/ai/transition_recommend.py` | P5.4.1 | AI 分析相邻素材内容，推荐最适合的转场 |
| P5.4.3 | 转场 MCP 单元测试 | `__tests__/mcp/transition.test.ts` | P5.4.1,2 | 生成/AI 推荐全通过 |

**转场推荐逻辑**：

```python
# AI 内容分析推荐（简化版）
def recommend_transition(segment_a, segment_b):
    """
    segment_a: 素材A的元数据 {type: "video"/"image", duration: 微秒, has_audio: bool}
    segment_b: 素材B的元数据
    """
    # 基于素材类型推荐
    if segment_a["type"] == "video" and segment_b["type"] == "image":
        return "推镜"  # 视频 → 图片，用推镜

    if segment_a["type"] == "image" and segment_b["type"] == "video":
        return "叠化"  # 图片 → 视频，用叠化

    # 默认推荐
    return "叠化"
```

**转场预设类型**：

| 转场名 | 中文名 | 适用场景 |
|--------|--------|----------|
| `叠化` | Dissolve | 通用，柔和过渡 |
| `推镜` | Push | 视频→图片/图片→视频 |
| `闪黑` | Flash | 节奏感切换 |
| `旋转` | Rotate | 动感和趣味 |
| `缩放` | Zoom | 强调重点 |

---

#### Phase 5.5：统一确认流程（3 tasks）

> 实现「先描述再执行」的用户体验，所有特效操作统一走此流程

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.5.1 | 统一确认消息格式 | `core/queryEngine/effectConfirmation.ts` | P3.4.8 | 滤镜/特效/关键帧/转场/音频特效统一使用同一种确认格式 |
| P5.5.2 | REPL 推荐展示组件 | `components/REPL/EffectRecommendation.vue` | P5.5.1, P3.4.13 | 显示 AI 推荐列表，用户可输入数字选择或输入自定义 |
| P5.5.3 | 确认超时处理 | `core/queryEngine/effectConfirmation.ts` | P5.5.1 | 30 秒无响应自动取消，提示用户 |

**统一确认消息格式**：

```
┌─────────────────────────────────────────────────────────────┐
│ 🎬 滤镜推荐                                                  │
├─────────────────────────────────────────────────────────────┤
│ 根据「复古电影感」为你推荐以下滤镜：                            │
│                                                             │
│   1. 复古 (confidence: 92%)                                  │
│      └─ 理由：暖色调 + 高对比度，适合怀旧场景                  │
│                                                             │
│   2. 胶片 (confidence: 78%)                                 │
│      └─ 理由：颗粒感 + 偏黄，模拟老电影效果                   │
│                                                             │
│   3. 情绪 (confidence: 65%)                                  │
│      └─ 理由：低饱和度 + 暗角，营造电影氛围                   │
│                                                             │
│ 请输入数字选择（1-3），或输入自定义描述：                       │
└─────────────────────────────────────────────────────────────┘
```

**用户确认流程**：

```
用户：「给视频加一个复古滤镜」
         │
         ▼
AI 理解意图 → 调用 recommend_filters("复古") → 获取推荐列表
         │
         ▼
显示确认界面 → 用户输入「1」选择「复古」
         │
         ▼
AI 调用 generate_video_filter("复古", intensity=80)
         │
         ▼
显示执行结果：「✅ 已为素材[1]应用『复古』滤镜，强度 80%」
```

---

#### Phase 5.6：E2E 测试 + 最小化 UI（3 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.6.1 | 特效全流程 E2E 测试 | `__tests__/e2e/effects.test.ts` | P5.1~5 | 滤镜→特效→关键帧→转场→音频特效全流程通过 |
| P5.6.2 | 时间线特效轨道 UI | `components/Timeline/EffectTrack.vue` | P5.6.1 | 最小化版本：显示特效图标，不支持拖拽 |
| P5.6.3 | 特效 REPL 自然语言测试 | `__tests__/e2e/repl-effects.test.ts` | P5.5.2 | 「加复古滤镜」「做淡入效果」「加转场」等自然语言正确执行 |

**EffectTrack 最小化 UI**：

```
┌──────────────────────────────────────────────────────────┐
│ V1  ●───●───●───[🎨复古 80%]───●───[🎬故障]───●───●     │
│ A1  ●───●───●───[🔊渐强]───●───●───●───●───●           │
│ T1  ●───●───[📝字幕]───●───●───●───●───●───●           │
└──────────────────────────────────────────────────────────┘
  └─ 特效轨道只显示特效图标和类型名称，点击弹出详情
```

---

#### Phase 5 任务总览（19 tasks）

| Phase | 任务数 | 核心交付 |
|-------|--------|----------|
| P5.1 滤镜/特效 MCP 增强 | 6 | 100+ 预设可 AI 语义搜索 |
| P5.2 关键帧 MCP | 4 | 9 种属性动画 + AI 描述 |
| P5.3 音频特效 MCP | 3 | 4 种变声特效 + AI 推荐 |
| P5.4 转场 MCP | 3 | 转场生成 + AI 内容分析推荐 |
| P5.5 统一确认流程 | 3 | 先描述再执行 + 推荐展示 |
| P5.6 E2E + 最小化 UI | 3 | 全流程 E2E + 特效轨道 |
| **合计** | **19** | 特效/滤镜/关键帧完整功能 |

---

#### Phase 5 开发顺序（3 轮迭代）

```
第1轮迭代（MCP 核心）
├── P5.1.1 generate_video_filter handler 升级
├── P5.1.2 generate_video_effect handler 升级
├── P5.1.3 list_filter_presets AI 增强
├── P5.1.4 list_video_effect_presets AI 增强
├── P5.2.1 generate_keyframe handler 升级
├── P5.2.2 generate_audio_keyframe handler 升级
├── P5.3.1 generate_audio_effect handler 升级
└── P5.4.1 generate_transition handler 升级

第2轮迭代（AI 推荐 + 确认）
├── P5.1.5 滤镜/特效推荐 AI Prompt
├── P5.1.6 滤镜/特效 MCP 单元测试
├── P5.2.3 关键帧属性 AI 描述
├── P5.2.4 关键帧 MCP 单元测试
├── P5.3.2 音频变声 AI 推荐
├── P5.3.3 音频特效 MCP 单元测试
├── P5.4.2 转场 AI 内容分析推荐
├── P5.4.3 转场 MCP 单元测试
├── P5.5.1 统一确认消息格式
├── P5.5.2 REPL 推荐展示组件
└── P5.5.3 确认超时处理

第3轮迭代（E2E + UI）
├── P5.6.1 特效全流程 E2E 测试
├── P5.6.2 时间线特效轨道 UI
└── P5.6.3 特效 REPL 自然语言测试
```

---

### Phase 6：Skill 系统（参考 Claude Code Skill 架构）

> **借鉴 Claude Code 的 Skill 系统**：Skill 是一种用户可通过 `/slash` 命令触发的、复杂多步骤流程的封装。与 Tool（原子操作）不同，Skill 是 Tool 的消费者，内部可编排多个 Tool 调用来完成复杂任务。JY Draft 将 Skill 系统作为用户扩展能力的核心机制，让用户可以通过自然语言或斜杠命令触发预定义/自定义的视频编辑工作流。

#### 6.1 Skill 系统架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     JY Draft Skill 系统                          │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ Skill 加载器  │   │ Skill 执行器  │   │ Skill 保护（Compaction）│ │
│  │ (发现+解析)   │   │ (inline/fork) │   │ (invokedSkills Map)  │ │
│  └──────┬──────┘   └──────┬───────┘   └──────────┬───────────┘ │
│         │                 │                       │              │
│  ┌──────┴─────────────────┴───────────────────────┴───────────┐ │
│  │                    SkillTool (QueryEngine 集成)              │ │
│  └────────────────────────┬───────────────────────────────────┘ │
│                           │                                      │
│  ┌────────────────────────┴───────────────────────────────────┐ │
│  │             内置 Skills / 用户自定义 Skills                    │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │ /batch   │ │ /analyze │ │ /template│ │ /我的工作流   │  │ │
│  │  │ 批量处理  │ │ 素材分析  │ │ 模板应用 │ │ (用户自定义) │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2 技术决策

| 问题 | 决策 | 说明 |
|------|------|------|
| Skill 执行模式 | inline 为主，fork 可选 | 视频编辑是多轮交互，inline 保留完整上下文；独立批处理可用 fork |
| Skill 存储位置 | `.jy-draft/skills/` | 用户级：`~/.jy-draft/skills/`；项目级：`项目目录/.jy-draft/skills/` |
| Skill 格式 | `SKILL.md`（frontmatter + prompt） | 与 Claude Code 保持一致的 YAML frontmatter 格式 |
| Skill 权限 | 继承 QueryEngine 权限 + `allowed-tools` 白名单 | fork 模式通过白名单限制可用 Tool |
| Skill Hooks | 支持 PreToolUse / PostToolUse / PreCompact / PostCompact 4 种 | 参照 Claude Code 的 Hook 事件体系 |
| Compaction 保护 | `invokedSkills` Map 跟踪活跃 Skill | Skill 内容在对话压缩时保留，不被丢失 |
| 条件激活 | `paths` 字段支持文件模式匹配 | 如 `paths: ["*.mp4"]` 仅在操作视频时激活 |
| 预算控制 | Skill 描述不超过上下文窗口 1% | 参考 Claude Code 的 `formatCommandsWithinBudget()` |

#### 6.3 Skill 目录结构

```
~/.jy-draft/skills/              # 用户级 Skills（全局可用）
├── batch-process/
│   └── SKILL.md                 # 批量处理 Skill
├── smart-analyze/
│   ├── SKILL.md                 # 素材智能分析 Skill
│   └── references/              # 可选：参考资料
│       └── analysis-guide.md
└── my-workflow/
    ├── SKILL.md                 # 用户自定义工作流
    └── records/                 # 可选：会话持久化
        └── session.md

项目目录/.jy-draft/skills/       # 项目级 Skills（项目特定）
├── template-apply/
│   └── SKILL.md                 # 模板应用 Skill
└── auto-subtitle/
    └── SKILL.md                 # 自动字幕 Skill

内置 Skills（打包在应用中）：
app/skills/
├── batch-process/
├── smart-analyze/
├── template-apply/
└── quick-edit/
```

#### 6.4 SKILL.md 格式规范

```yaml
---
# === 基础字段（必须）===
name: batch-process                        # Skill 名称，用于 / 调用
description: "批量处理视频素材..."           # 描述，供 AI 理解何时使用
user-invocable: true                       # 是否允许用户直接调用

# === 执行配置（可选）===
context: inline                            # 执行模式：inline | fork
allowed-tools:                             # 限制可用的 Tool（fork 模式下重要）
  - list_local_materials
  - add_videos
  - save_draft
model: minimax                             # 指定模型（可选，覆盖默认模型）
effort: medium                             # 执行力度：low | medium | high

# === Agent 配置（fork 模式，可选）===
agent:
  agentType: general-purpose               # agent 类型

# === Hooks 配置（可选）===
hooks:
  preToolUse:
    - matcher: "save_draft"
      hooks:
        - command: "echo '即将保存草稿'"
          once: false
  postToolUse:
    - matcher: "add_videos"
      hooks:
        - command: "echo '视频素材已添加'"

# === 条件激活（可选）===
paths:                                     # 当操作匹配的文件时自动建议
  - "*.mp4"
  - "*.mov"
  - "*.avi"
---

# Batch Process Skill（Markdown 正文 = Skill Prompt）

## 使用方式
/batch-process <素材目录>

## 参数
<directory> — 素材目录路径

## 工作流

### Step 1: 扫描素材
使用 `list_local_materials` 扫描指定目录...

### Step 2: 分析素材
对每个视频素材调用 AI 分析...

### Step 3: 排序与分组
根据 AI 分析结果自动排序...

### Step 4: 生成草稿
调用 `create_draft` + `add_videos` ...

## 核心规则
1. 批量操作前必须显示预览列表让用户确认
2. 每个步骤使用 AskUserQuestion 获取用户反馈
...
```

#### 6.5 核心 Skill 设计（内置 4 个）

##### Skill 1：`/batch-process` — 批量处理

```yaml
name: batch-process
description: "批量处理视频素材：扫描目录、AI分析、自动排序、生成草稿。适合一次性处理大量素材。"
user-invocable: true
context: inline
```

**功能**：
1. 扫描用户指定目录的素材
2. AI 分析每个素材（视频内容、时长、分辨率）
3. 按内容相关性自动排序和分组
4. 生成多个草稿或一个合并草稿
5. 支持批量添加滤镜/特效

**交互流程**：
```
用户：/batch-process E:\素材\旅行视频\

Skill：正在扫描目录...找到 23 个视频素材
      ┌──────────────────────────────────┐
      │ 发现 23 个视频素材：              │
      │                                  │
      │ 📁 海滩 (5个)                    │
      │   ├── beach_001.mp4 (0:32)       │
      │   ├── beach_002.mp4 (1:05)       │
      │   └── ...                        │
      │ 📁 城市夜景 (4个)                │
      │   ├── night_001.mp4 (0:45)       │
      │   └── ...                        │
      │ 📁 其他 (14个)                   │
      │                                  │
      │ 请选择处理方式：                  │
      │ 1. 按分组生成多个草稿             │
      │ 2. 合并为一个草稿                 │
      │ 3. 自定义分组                     │
      └──────────────────────────────────┘
```

##### Skill 2：`/smart-analyze` — 素材智能分析

```yaml
name: smart-analyze
description: "深度分析视频/音频素材：内容识别、质量评估、推荐用途。支持单文件和批量分析。"
user-invocable: true
context: inline
paths:
  - "*.mp4"
  - "*.mov"
  - "*.wav"
  - "*.mp3"
```

**功能**：
1. 短视频分析（2-10s）：AI 提取文本描述 → 语义标签
2. 长视频分析：AI 分析内容 → 智能分割建议
3. 音频分析：识别语音内容、音乐类型、音质评估
4. 生成分析报告（保存到 SQLite）
5. 基于分析结果推荐素材用途

##### Skill 3：`/template-apply` — 模板应用

```yaml
name: template-apply
description: "应用预设模板到草稿：Vlog模板、教程模板、产品展示模板等。快速生成结构化视频。"
user-invocable: true
context: inline
allowed-tools:
  - create_draft
  - add_videos
  - add_audios
  - add_texts
  - add_stickers
  - add_video_effects
  - add_video_filters
  - save_draft
```

**内置模板**：
- Vlog 模板：开场动画 + 正文 + 结尾
- 教程模板：标题卡 + 步骤分段 + 字幕
- 产品展示模板：产品特写 + 功能说明 + CTA
- 音乐视频模板：节拍同步 + 转场 + 特效
- 空白模板：从零开始

##### Skill 4：`/quick-edit` — 快速编辑

```yaml
name: quick-edit
description: "快速编辑操作：一键裁剪、拼接、配乐、加字幕。适合简单编辑需求。"
user-invocable: true
context: inline
```

**功能**：
1. 裁剪视频片段（指定起止时间）
2. 拼接多个视频
3. 自动配乐（从素材库或 AI 生成）
4. 自动字幕（语音识别 → 字幕添加）
5. 快速滤镜应用

---

#### Phase 6.1：Skill 基础框架（6 tasks）

> 实现 Skill 系统的核心加载、解析、注册机制

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.1.1 | Skill 类型定义 | `core/skill/types.ts` | P3.4.1 | SkillCommand、SkillFrontmatter、SkillContext 接口完整 |
| P6.1.2 | Frontmatter 解析器 | `core/skill/frontmatterParser.ts` | P6.1.1 | 解析 YAML frontmatter，验证 name/description/context/allowed-tools 等字段 |
| P6.1.3 | Skill 加载器 | `core/skill/loader.ts` | P6.1.2 | 从 3 个来源加载 Skills（内置/用户级/项目级），去重、排序 |
| P6.1.4 | Skill 注册到 Command 系统 | `core/skill/registry.ts` | P6.1.3 | Skill 注册为 slash 命令，`/skill-name` 可被发现 |
| P6.1.5 | SkillTool 定义 | `core/queryEngine/skills/skillTool.ts` | P6.1.4 | SkillTool 作为 Tool 注册到 QueryEngine，AI 可自动推荐 Skill |
| P6.1.6 | Skill 描述预算控制 | `core/skill/budgetFormatter.ts` | P6.1.5 | Skill 描述不超过上下文 1%，超出时智能截断 |

**SkillFrontmatter 类型定义**：

```typescript
// core/skill/types.ts

/** Skill frontmatter 配置 */
export interface SkillFrontmatter {
  name: string                          // Skill 名称
  description: string                   // 描述（供 AI 发现）
  userInvocable: boolean                // 是否允许用户调用
  context?: 'inline' | 'fork'           // 执行模式，默认 inline
  allowedTools?: string[]               // 可用 Tool 白名单
  model?: string                        // 模型覆盖
  effort?: 'low' | 'medium' | 'high'    // 执行力度
  agent?: {
    agentType: string                   // Agent 类型（fork 模式）
  }
  hooks?: SkillHooks                    // Hook 配置
  paths?: string[]                      // 条件激活路径
}

/** Skill Hooks 配置 */
export interface SkillHooks {
  preToolUse?: SkillHookEntry[]
  postToolUse?: SkillHookEntry[]
  preCompact?: SkillHookEntry[]
  postCompact?: SkillHookEntry[]
}

export interface SkillHookEntry {
  matcher: string                       // Tool 名匹配模式
  hooks: Array<{
    command?: string                    // Shell 命令
    once?: boolean                      // 是否只执行一次
  }>
}

/** 已加载的 Skill 命令 */
export interface SkillCommand {
  name: string
  description: string
  filePath: string                      // SKILL.md 文件路径
  content: string                       // SKILL.md 完整内容（Markdown 正文）
  frontmatter: SkillFrontmatter
  source: 'builtin' | 'user' | 'project'  // 来源
}

/** Skill 执行上下文 */
export interface SkillExecutionContext {
  skillCommand: SkillCommand
  args: string                          // 用户传入的参数
  messages: ConversationMessage[]       // 当前对话历史
  toolUseContext: ToolUseContext         // Tool 使用上下文
  agentId?: string                      // Agent ID（fork 模式）
}
```

**Skill 加载器核心逻辑**：

```typescript
// core/skill/loader.ts

/** Skill 加载来源（优先级从高到低） */
const SKILL_SOURCES = [
  { type: 'project', basePath: '.jy-draft/skills/' },   // 项目级
  { type: 'user',    basePath: '~/.jy-draft/skills/' },  // 用户级
  { type: 'builtin', basePath: 'app/skills/' },          // 内置
] as const

export async function loadAllSkills(
  projectRoot: string
): Promise<SkillCommand[]> {
  const skills = new Map<string, SkillCommand>()  // name → skill（去重）

  for (const source of SKILL_SOURCES) {
    const dirPath = resolveSkillDir(source, projectRoot)
    const dirSkills = await loadSkillsFromDir(dirPath, source.type)

    for (const skill of dirSkills) {
      // 高优先级来源覆盖低优先级
      if (!skills.has(skill.name)) {
        skills.set(skill.name, skill)
      }
    }
  }

  return [...skills.values()].sort((a, b) => a.name.localeCompare(b.name))
}

async function loadSkillsFromDir(
  dirPath: string,
  source: SkillCommand['source']
): Promise<SkillCommand[]> {
  const skills: SkillCommand[] = []

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillFile = path.join(dirPath, entry.name, 'SKILL.md')
      if (!await fileExists(skillFile)) continue

      const content = await fs.readFile(skillFile, 'utf-8')
      const frontmatter = parseFrontmatter(content)
      if (!frontmatter?.name) continue

      skills.push({
        name: frontmatter.name,
        description: frontmatter.description || '',
        filePath: skillFile,
        content: extractMarkdownBody(content),
        frontmatter,
        source,
      })
    }
  } catch {
    // 目录不存在，跳过
  }

  return skills
}
```

---

#### Phase 6.2：Skill 执行引擎（5 tasks）

> 实现 Skill 的 inline 和 fork 两种执行模式

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.2.1 | SkillTool.validateInput | `core/queryEngine/skills/skillTool.ts` | P6.1.5 | 验证 Skill 名称存在、格式正确、参数合法 |
| P6.2.2 | SkillTool.checkPermissions | `core/queryEngine/skills/skillTool.ts` | P6.2.1 | 权限规则检查，deny 列表优先于 allow 列表 |
| P6.2.3 | Inline 执行模式 | `core/skill/inlineExecutor.ts` | P6.2.2 | Skill prompt 注入当前对话，`$ARGUMENTS` 替换，`!command` 快捷方式 |
| P6.2.4 | Fork 执行模式 | `core/skill/forkExecutor.ts` | P6.2.2 | 启动独立子 Agent，隔离执行上下文，结果提取返回 |
| P6.2.5 | Fork 子 Agent 上下文隔离 | `core/skill/subagentContext.ts` | P6.2.4 | createSubagentContext：克隆 messages、独立 agentId、shouldAvoidPermissionPrompts |

**Inline 执行流程**（参考 Claude Code `processPromptSlashCommand`）：

```
用户输入 /batch-process E:\素材\
         │
         ▼
SkillTool.call()
         │
         ▼ context === 'inline'
processInlineSkill()
  ├── 读取 SKILL.md 内容
  ├── 替换 $ARGUMENTS → "E:\素材\"
  ├── 替换 !command 快捷方式
  ├── 注册到 invokedSkills Map（Compaction 保护）
  └── 返回 newMessages 注入当前对话
         │
         ▼
Skill prompt 在主 Agent 上下文中执行
  → AI 根据 Skill 指令调用 Tools
  → 保持完整对话上下文
```

**Fork 执行流程**（参考 Claude Code `executeForkedSkill`）：

```
用户输入 /batch-process E:\素材\
         │
         ▼
SkillTool.call()
         │
         ▼ context === 'fork'
executeForkedSkill()
  ├── 从 frontmatter 构建 Agent 定义
  │     ├── agentType: frontmatter.agent?.agentType ?? 'general-purpose'
  │     ├── allowedTools: frontmatter.allowedTools
  │     └── model: frontmatter.model
  ├── prepareForkedCommandContext()
  │     ├── 确定子 Agent 类型
  │     └── 构建 Agent 参数
  └── runAgent()（与内置 Agent 共用引擎）
         │
         ▼
createSubagentContext()
  ├── 克隆 messages（完整对话历史）
  ├── 设置 shouldAvoidPermissionPrompts = true
  ├── 分配独立 agentId / depth++
  └── 应用 allowed-tools 白名单过滤
         │
         ▼
子 Agent 隔离执行 → 结果提取 → 返回主对话
```

**子 Agent 上下文隔离**：

```typescript
// core/skill/subagentContext.ts

export function createSubagentContext(
  parentContext: ToolUseContext,
  skillCommand: SkillCommand
): ToolUseContext {
  return {
    // 克隆 messages（不污染父 Agent）
    messages: [...parentContext.messages],

    // 子 Agent 不弹权限确认
    permissionGuard: {
      ...parentContext.permissionGuard,
      shouldAvoidPermissionPrompts: true,
    },

    // 独立 ID
    agentId: generateAgentId(),

    // 嵌套深度递增
    queryTracking: {
      depth: (parentContext.queryTracking?.depth ?? -1) + 1,
    },

    // 应用 Skill 的 allowed-tools 白名单
    allowedTools: skillCommand.frontmatter.allowedTools
      ?? ['list_local_materials', 'save_draft'],  // 默认安全工具

    // 文件缓存独立
    readFileState: cloneFileStateCache(parentContext),
  }
}
```

---

#### Phase 6.3：Skill Hooks 系统（4 tasks）

> 实现 Skill 级别的事件驱动拦截器

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.3.1 | Hook 注册机制 | `core/skill/hooks/register.ts` | P6.2.3 | SKILL.md frontmatter hooks 注册为 Session 级 hook |
| P6.3.2 | Hook 执行引擎 | `core/skill/hooks/executor.ts` | P6.3.1 | 支持 command 类型 hook，exit code 语义（0=放行，2=阻断） |
| P6.3.3 | PreToolUse / PostToolUse 拦截 | `core/skill/hooks/toolHooks.ts` | P6.3.2 | Tool 调用前/后触发 hook，matcher 匹配 Tool 名 |
| P6.3.4 | PreCompact / PostCompact 保护 | `core/skill/hooks/compactHooks.ts` | P6.3.2 | 压缩前/后触发 hook，保护 Skill 内容不被丢失 |

**Hook 执行顺序**：

```
用户请求 → QueryEngine → PermissionGuard（权限检查）→ PreToolUse Hook → Tool 执行 → PostToolUse Hook → 结果返回
                                                     ↑
                                          权限拒绝则 Hook 不触发
```

**Exit Code 语义**（与 Claude Code 一致）：

| exit code | 含义 | 行为 |
|-----------|------|------|
| `0` | 成功/放行 | stdout 被处理，事件继续 |
| `2` | 阻断/阻止 | 显示 stderr 给 AI，当前操作被阻止 |
| 其他 | 警告但继续 | stderr 仅显示给用户，操作继续执行 |

**Hook 注册示例**：

```typescript
// core/skill/hooks/register.ts

export function registerSkillHooks(
  skillCommand: SkillCommand,
  sessionHooks: SessionHooks
): void {
  const { hooks } = skillCommand.frontmatter
  if (!hooks) return

  // PreToolUse hooks
  if (hooks.preToolUse) {
    for (const entry of hooks.preToolUse) {
      sessionHooks.register('preToolUse', {
        matcher: entry.matcher,
        handler: createCommandHook(entry),
        once: entry.hooks.some(h => h.once),
        source: `skill:${skillCommand.name}`,
      })
    }
  }

  // PostToolUse / PreCompact / PostCompact 类似处理 ...
}
```

---

#### Phase 6.4：Skill Compaction 保护（3 tasks）

> 确保活跃 Skill 在长对话压缩时不丢失

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.4.1 | invokedSkills Map | `core/skill/invokedSkills.ts` | P6.2.3 | 跟踪活跃 Skill，agentId + skillName 唯一标识 |
| P6.4.2 | Compaction 前保护 | `core/skill/compactProtection.ts` | P6.4.1, P3.4.4 | 压缩前检查 invokedSkills，标记 Skill 内容不可压缩 |
| P6.4.3 | Compaction 后恢复 | `core/skill/compactProtection.ts` | P6.4.2 | 压缩后检测被破坏的消息边界，从 invokedSkills 恢复 |

**invokedSkills Map 设计**：

```typescript
// core/skill/invokedSkills.ts

/** 活跃 Skill 跟踪（参考 Claude Code bootstrap/state.ts） */
const invokedSkills = new Map<string, {
  skillName: string
  skillPath: string
  content: string                    // Skill 完整内容
  invokedAt: number                  // 调用时间
  agentId: string | null             // 所属 Agent
}>()

/** 生成唯一 key */
function skillKey(agentId: string | null, skillName: string): string {
  return `${agentId ?? 'main'}:${skillName}`
}

/** Skill 执行时注册 */
export function addInvokedSkill(
  name: string,
  path: string,
  content: string,
  agentId: string | null
): void {
  invokedSkills.set(skillKey(agentId, name), {
    skillName: name,
    skillPath: path,
    content,
    invokedAt: Date.now(),
    agentId,
  })
}

/** Compaction 保护流程 */
export function getInvokedSkillsForAgent(
  agentId: string | null
): Array<{ name: string; content: string }> {
  const result: Array<{ name: string; content: string }> = []
  for (const [key, skill] of invokedSkills) {
    if (key.startsWith(`${agentId ?? 'main'}:`)) {
      result.push({ name: skill.skillName, content: skill.content })
    }
  }
  return result
}
```

---

#### Phase 6.5：内置 Skill 实现（4 个 Skill，8 tasks）

> 实现 4 个内置 Skill 的完整功能

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.5.1 | `/batch-process` Skill 实现 | `app/skills/batch-process/SKILL.md` | P6.2.3 | 扫描→分析→排序→生成草稿全流程通过 |
| P6.5.2 | `/batch-process` 测试 | `__tests__/skills/batch-process.test.ts` | P6.5.1 | 10+ 素材批量处理、分组、确认流程正确 |
| P6.5.3 | `/smart-analyze` Skill 实现 | `app/skills/smart-analyze/SKILL.md` | P6.2.3 | 短视频/长视频/音频分析报告生成正确 |
| P6.5.4 | `/smart-analyze` 测试 | `__tests__/skills/smart-analyze.test.ts` | P6.5.3 | 分析结果保存 SQLite，推荐用途合理 |
| P6.5.5 | `/template-apply` Skill 实现 | `app/skills/template-apply/SKILL.md` | P6.2.3 | Vlog/教程/产品展示模板正确应用 |
| P6.5.6 | `/template-apply` 测试 | `__tests__/skills/template-apply.test.ts` | P6.5.5 | 各模板生成草稿结构符合预期 |
| P6.5.7 | `/quick-edit` Skill 实现 | `app/skills/quick-edit/SKILL.md` | P6.2.3 | 裁剪/拼接/配乐/字幕/滤镜快速操作通过 |
| P6.5.8 | `/quick-edit` 测试 | `__tests__/skills/quick-edit.test.ts` | P6.5.7 | 各快速编辑操作正确执行 |

---

#### Phase 6.6：Skill REPL 集成（4 tasks）

> 在 REPL 界面中集成 Skill 的发现、调用、展示

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.6.1 | Skill 自动补全组件 | `components/REPL/SkillAutocomplete.vue` | P6.1.4, P3.4.13 | 输入 `/` 弹出 Skill 列表，支持模糊搜索 |
| P6.6.2 | Skill 执行进度展示 | `components/REPL/SkillProgress.vue` | P6.2.3 | inline 模式显示当前 Skill 步骤；fork 模式显示进度条 |
| P6.6.3 | Skill 帮助面板 | `components/REPL/SkillHelp.vue` | P6.6.1 | `/help skills` 显示所有可用 Skill 及描述 |
| P6.6.4 | Skill 条件激活提示 | `components/REPL/SkillSuggestion.vue` | P6.1.3, P6.6.1 | 当用户操作匹配 `paths` 时，自动提示关联 Skill |

**Skill 自动补全 UI**（Vue 3 组件）：

```
用户输入：/
         │
         ▼
┌──────────────────────────────────────┐
│ /batch-process  批量处理视频素材       │
│ /smart-analyze  素材智能分析           │
│ /template-apply 应用预设模板           │
│ /quick-edit     快速编辑操作           │
│                                      │
│ ↑↓ 选择  Enter 确认  Esc 取消        │
└──────────────────────────────────────┘
```

**Skill 执行进度展示**（Vue 3 组件）：

```
┌──────────────────────────────────────────────┐
│ 🔧 正在执行 /batch-process                    │
│                                              │
│ ✓ Step 1: 扫描素材 (23个文件)                 │
│ ✓ Step 2: AI 分析 (23/23 完成)                │
│ ● Step 3: 自动排序分组                        │
│ ○ Step 4: 生成草稿                            │
│                                              │
│ ████████████████░░░░░░░ 60%                  │
└──────────────────────────────────────────────┘
```

**Vue 3 组件示例结构**：

```vue
<!-- components/REPL/SkillAutocomplete.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSkillStore } from '@/stores/skill'

const skillStore = useSkillStore()
const searchText = ref('')
const selectedIndex = ref(0)
const visible = ref(false)

const filteredSkills = computed(() => {
  if (!searchText.value) return skillStore.allSkills
  return skillStore.allSkills.filter(s =>
    s.name.includes(searchText.value) ||
    s.description.includes(searchText.value)
  )
})
</script>
```

---

#### Phase 6.7：用户自定义 Skill 管理（5 tasks）

> 允许用户创建、编辑、管理自定义 Skill

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.7.1 | Skill 创建引导 | `core/skill/skillCreator.ts` | P6.1.2 | 交互式引导用户创建新 Skill（名称→描述→工作流→保存） |
| P6.7.2 | Skill 管理面板 UI | `components/Skills/SkillManager.vue` | P6.7.1 | 列表展示所有 Skill，支持启用/禁用/编辑/删除 |
| P6.7.3 | Skill 编辑器组件 | `components/Skills/SkillEditor.vue` | P6.7.2 | Markdown 编辑器 + frontmatter 表单 + 实时预览 |
| P6.7.4 | Skill 导入/导出 | `core/skill/skillIO.ts` | P6.7.1 | 支持导出为 `.zip` 和从 `.zip` 导入 Skill |
| P6.7.5 | Skill 市场预留 | `core/skill/skillMarket.ts` | P6.7.4 | API 接口预留（搜索、下载、评分），后期实现 UI |

**Skill 创建引导流程**：

```
用户：/create-skill
         │
         ▼
┌──────────────────────────────────────┐
│ 创建新 Skill                          │
│                                      │
│ Step 1/4: 基本信息                    │
│ 名称：[ my-workflow        ]         │
│ 描述：[ 我的工作流描述...  ]         │
│ 执行模式：○ inline  ○ fork           │
│                                      │
│ [下一步]  [取消]                      │
└──────────────────────────────────────┘
         │
         ▼ (4步引导完成后)
自动生成 SKILL.md → 保存到 ~/.jy-draft/skills/my-workflow/
```

---

#### Phase 6 任务总览（35 tasks）

| Phase | 任务数 | 核心交付 | 难度 |
|-------|--------|----------|------|
| P6.1 Skill 基础框架 | 6 | Skill 加载/解析/注册完整链路 | B |
| P6.2 Skill 执行引擎 | 5 | inline + fork 双模式执行 | A |
| P6.3 Skill Hooks 系统 | 4 | 4 种 Hook 事件拦截 | B |
| P6.4 Skill Compaction 保护 | 3 | invokedSkills Map + 压缩保护 | A |
| P6.5 内置 Skill 实现 | 8 | 4 个内置 Skill + 测试 | B |
| P6.6 Skill REPL 集成 | 4 | 自动补全 + 进度 + 帮助 + 提示 | B |
| P6.7 用户自定义 Skill | 5 | 创建引导 + 管理面板 + 导入导出 | B |
| **合计** | **35** | **Skill 系统完整功能** | |

---

#### Phase 6 开发顺序（4 轮迭代）

```
第1轮迭代（基础框架 + 执行引擎）
├── P6.1.1 Skill 类型定义
├── P6.1.2 Frontmatter 解析器
├── P6.1.3 Skill 加载器
├── P6.1.4 Skill 注册到 Command 系统
├── P6.1.5 SkillTool 定义
├── P6.1.6 Skill 描述预算控制
├── P6.2.1 SkillTool.validateInput
├── P6.2.2 SkillTool.checkPermissions
├── P6.2.3 Inline 执行模式
├── P6.2.4 Fork 执行模式
└── P6.2.5 Fork 子 Agent 上下文隔离

第2轮迭代（Hooks + Compaction 保护）
├── P6.3.1 Hook 注册机制
├── P6.3.2 Hook 执行引擎
├── P6.3.3 PreToolUse / PostToolUse 拦截
├── P6.3.4 PreCompact / PostCompact 保护
├── P6.4.1 invokedSkills Map
├── P6.4.2 Compaction 前保护
└── P6.4.3 Compaction 后恢复

第3轮迭代（内置 Skills + REPL 集成）
├── P6.5.1 /batch-process 实现
├── P6.5.2 /batch-process 测试
├── P6.5.3 /smart-analyze 实现
├── P6.5.4 /smart-analyze 测试
├── P6.5.5 /template-apply 实现
├── P6.5.6 /template-apply 测试
├── P6.5.7 /quick-edit 实现
├── P6.5.8 /quick-edit 测试
├── P6.6.1 Skill 自动补全组件
├── P6.6.2 Skill 执行进度展示
├── P6.6.3 Skill 帮助面板
└── P6.6.4 Skill 条件激活提示

第4轮迭代（用户自定义 + 市场）
├── P6.7.1 Skill 创建引导
├── P6.7.2 Skill 管理面板 UI
├── P6.7.3 Skill 编辑器组件
├── P6.7.4 Skill 导入/导出
└── P6.7.5 Skill 市场预留
```

---

#### Phase 6 借鉴 Claude Code 文件映射

| JY Draft 任务 | 借鉴 Claude Code 文件 | 行数 | 借鉴内容 |
|---|---|---|---|
| P6.1.1 Skill 类型定义 | `src/types/command.ts` | ~100 行 | Command 类型定义、PromptCommand 接口 |
| P6.1.2 Frontmatter 解析 | `src/utils/frontmatterParser.ts` | ~150 行 | YAML frontmatter 解析、验证、字段提取 |
| P6.1.3 Skill 加载器 | `src/skills/loadSkillsDir.ts` | 1087 行 | 多源加载（policy/user/project）、去重、条件激活 |
| P6.1.5 SkillTool 定义 | `packages/builtin-tools/src/tools/SkillTool/SkillTool.ts` | 1110 行 | buildTool 模式、validateInput、checkPermissions |
| P6.1.6 预算控制 | `packages/builtin-tools/src/tools/SkillTool/prompt.ts` | 242 行 | formatCommandsWithinBudget、1% 上下文预算 |
| P6.2.3 Inline 执行 | `src/utils/processUserInput/processSlashCommand.tsx` | 1262 行 | processSlashCommand、消息注入、$ARGUMENTS 替换 |
| P6.2.4 Fork 执行 | `packages/builtin-tools/src/tools/SkillTool/SkillTool.ts` 第 200-400 行 | ~200 行 | executeForkedSkill、子 Agent 启动 |
| P6.2.5 子 Agent 隔离 | `src/utils/forkedAgent.ts` | 690 行 | createSubagentContext、状态隔离、shouldAvoidPermissionPrompts |
| P6.3.1 Hook 注册 | `src/utils/hooks/registerSkillHooks.ts` | 65 行 | frontmatter hooks → session hooks 注册 |
| P6.3.2 Hook 执行 | `src/utils/hooks/hooksConfigManager.ts` | ~300 行 | exit code 语义、事件类型元数据 |
| P6.4.1 invokedSkills | `src/bootstrap/state.ts` 第 300-400 行 | ~100 行 | invokedSkills Map、addInvokedSkill、getInvokedSkillsForAgent |
| P6.4.2-3 Compaction 保护 | `src/services/compact/compact.ts` | ~500 行 | preCompact/postCompact hooks 执行、Skill 内容保护 |

---

## 待确认问题

- [x] 素材路径 → Windows本地路径，如 `E:\device.png`
- [x] AI素材 → TTS(bailian，已对接)，语音识别(bailian)
- [x] 多语言 → 中文 + 英文
- [x] 核心功能 → 视频/音频/文本/贴纸/特效/滤镜/关键帧
- [x] AI模型 → MiniMax / GLM / bailian（全能力API）
- [x] 目标用户 → 外部用户/公开产品
- [x] MCP部署 → 与 Electron 打包在一起
- [x] 交互方式 → GUI + REPL 混合（增强 REPL）
- [x] 输出交付 → 保存到本地文件
- [x] 数据存储 → 本地 SQLite + LanceDB，云端同步预留接口
- [x] 用户认证 → QQ扫码登录（后期实现）
- [x] 权限控制 → 敏感操作需确认
- [x] 历史管理 → SQLite + 版本管理（手动保存）
- [x] 素材管理 → 本地文件夹结构 `/<yyyy-mm-dd>/`
- [x] 视频理解 → 短视频分析(2-10s) + 长视频分割
- [x] 分割存储 → `原视频目录/smaterSplit/<yyyy-mm-dd>/源文件名_<xxxx>.后缀`
- [x] 向量用途 → 素材检索 + 语义搜索
- [x] Agent系统 → 完整 Agent 系统（多Agent + Task + 规划）
- [x] 离线支持 → 必须在线
- [x] JSON结构 → 分层支持（核心必填，高级可选）
- [x] GUI功能 → 完整面板（预览+时间线+特效+多轨）
- [x] REPL能力 → 增强能力（Task/Agent/规划模式）
- [x] 数据备份 → 手动备份（后期扩展云端）

---

## 下一步

1. 确认上述方案是否有问题
2. 回答待确认问题
3. 开始 Phase 1：分析 DMVideo backend API 设计
