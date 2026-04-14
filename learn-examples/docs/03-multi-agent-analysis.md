# Claude Code Multi-Agent 架构分析

> 基于 `src/tools/AgentTool/` 源码逆向分析

## 1. 核心设计思想

Claude Code 的 Multi-Agent 不是独立系统，而是通过**一个特殊的 Tool（AgentTool）** 实现的。

核心模式：**LLM 调用 LLM**

```
用户提问
  → 主 Agent 思考
  → 调用 AgentTool（像调用普通工具一样）
    → 工具内部 spawn 子 Agent
    → 子 Agent 独立运行
    → 结果以 <task-notification> XML 返回
  → 主 Agent 拿到结果，继续思考
  → 可能再次调用 AgentTool 派发新任务
```

主 Agent 并不感知自己在"协调多个 Agent"——它只是在**调用一个工具**。

这里的 spawn 是指 临时创建一个 后台执行的子Agent

---

## 2. 层级式协作架构

```
主 Agent (Orchestrator)
  ├── Explore Agent      搜索专家，严格只读
  ├── Plan Agent         架构师，严格只读
  ├── General Purpose    万能执行者，可读写
  ├── Verification Agent 质量检查
  └── Teammates          同级协作者，可跨进程
```

---

## 3. runAgent()：所有 Agent 的统一执行入口

**核心结论**：Skill fork、内置 Explore/Plan/Verification、Teammates——所有子 agent 最终都调用 `runAgent()` 作为统一入口，执行机制完全相同。

区别仅在于 **agent 定义来源**：
- **内置 agent**：预定义在 `agentDefinitions` 中
- **Skill fork**：由 `SKILL.md` frontmatter 动态构建

```
                          ┌──────────────────────────────────────┐
                          │           runAgent()                  │
                          │     （所有 agent 共享的生成器函数）    │
                          └──────────────┬───────────────────────┘
                                         │
          ┌──────────────────────────────┼──────────────────────────────┐
          │                              │                              │
          ▼                              ▼                              ▼
   ┌─────────────┐              ┌─────────────┐               ┌─────────────┐
   │ Skill fork   │              │  内置 Agent  │               │  Teammate    │
   │ (SKILL.md)   │              │ (explore/    │               │ (async/      │
   │              │              │  plan/...)   │               │  tmux)       │
   └─────────────┘              └─────────────┘               └─────────────┘
          │                              │                              │
          └──────────────────────────────┼──────────────────────────────┘
                                         │
                          ┌──────────────▼──────────────┐
                          │  createSubagentContext()      │
                          │  （共享的隔离机制）           │
                          └─────────────────────────────┘
```

---

## 4. AgentDefinition 完整配置

每个 Agent 本质是一个配置对象（`AgentDefinition`）：

```typescript
// src/tools/AgentTool/built-in/exploreAgent.ts
export const EXPLORE_AGENT: BuiltInAgentDefinition = {
  agentType: 'Explore',                    // 类型标识
  whenToUse: '快速搜索专家...',            // 主 Agent 何时选择它
  disallowedTools: [                       // 工具黑名单
    AGENT_TOOL_NAME,      // 不能再嵌套 spawn agent
    FILE_EDIT_TOOL_NAME,  // 不能编辑文件
    FILE_WRITE_TOOL_NAME, // 不能写文件
  ],
  model: 'haiku',                          // 可用更便宜的模型
  omitClaudeMd: true,                      // 不加载项目指令（省 token）
  getSystemPrompt: () => getExploreSystemPrompt(),  // 专属 prompt
}
```

关键配置维度：

| 字段 | 作用 |
|------|------|
| `agentType` | 类型标识，用于路由 |
| `whenToUse` | 描述"什么场景用我"，帮助主 Agent 选择 |
| `tools` / `disallowedTools` | 控制子 Agent 能用什么工具 |
| `model` | 可以指定不同的模型（如 haiku 更便宜更快） |
| `getSystemPrompt()` | 专属系统提示词，定义角色和行为边界 |
| `permissionMode` | 覆盖父 agent 的权限模式 |
| `isAsync` | 是否为异步 agent（影响 shouldAvoidPermissionPrompts） |
| `hooks` | agent 级别的 session hooks |
| `skills` | 预加载的 skills 列表 |
| `mcpServers` | agent 专属的 MCP servers（附加到父 agent 的 MCP 上） |
| `source` | agent 来源（admin-trusted 判断依据） |
| `maxTurns` | 最大执行轮次限制 |
| `criticalSystemReminder_EXPERIMENTAL` | 关键系统提醒内容 |

---

## 5. 四个内置 Agent 的分工

### 5.1 Explore Agent（搜索专家）

```typescript
agentType: 'Explore'
model: 'haiku'        // 快速便宜
tools: 只读           // Glob, Grep, Read, Bash(只读命令)
```

System Prompt 核心指令：
- "你是文件搜索专家"
- "严格只读模式 — 不能创建、修改、删除任何文件"
- "你应该尽量并行发起多个搜索请求以提高效率"

### 5.2 Plan Agent（架构师）

```typescript
agentType: 'Plan'
model: 'inherit'      // 继承主 Agent 的模型
tools: 只读           // 同 Explore
```

System Prompt 核心指令：
- "你是软件架构师和规划专家"
- "探索代码库并设计实现方案"
- 输出必须包含 "### Critical Files for Implementation"

### 5.3 General Purpose Agent（万能执行者）

```typescript
agentType: 'general-purpose'
model: 未指定（继承默认）
tools: ['*']          // 全部工具，可读写
```

System Prompt 核心指令：
- "你是 Claude Code 的通用 agent"
- "完整完成任务 — 不要过度设计，也不要半途而废"

### 5.4 Verification Agent（质量检查）

```typescript
agentType: 'verification'  // 需要功能开关 VERIFICATION_AGENT
```

独立验证已完成的变更，确保质量。

---

## 6. 工具隔离机制

Claude Code 通过**工具白名单/黑名单**控制每个 Agent 的能力边界。

### 过滤链路（源码视角）

```
AgentDefinition.disallowedTools / allowedTools
        │
        ▼
resolveAgentTools(agentDefinition, availableTools, isAsync)
  ──→ agentToolUtils.ts：遍历可用工具，根据 agentDefinition 过滤
        │
        ▼
过滤后的 resolvedTools 列表
        │
        ▼
传给 query() 执行
```

**关键代码**（`runAgent.ts` 第 500-502 行）：
```typescript
const resolvedTools = useExactTools
  ? availableTools
  : resolveAgentTools(agentDefinition, availableTools, isAsync).resolvedTools
```

### 黑名单配置

```typescript
// Explore 和 Plan Agent 的黑名单
disallowedTools: [
  AGENT_TOOL_NAME,       // 不能再嵌套 spawn agent（防止无限递归）
  FILE_EDIT_TOOL_NAME,   // 不能编辑文件
  FILE_WRITE_TOOL_NAME,  // 不能写文件
  NOTEBOOK_EDIT_TOOL_NAME,
]
```

设计原则：
- **Explore/Plan**：只读，不能改变任何东西
- **General Purpose**：全部权限
- **所有子 Agent**：都不能再 spawn 子 Agent（防止无限递归）

### Skill fork 的 allowed-tools 白名单

Skill fork 使用 `SKILL.md` frontmatter 的 `allowed-tools` 字段限制工具范围：

```yaml
allowed-tools:
  - ReadFileTool
  - GrepTool
  - GlobTool
  # BashTool、WriteFileTool 等危险操作不在列表中，根本不会到达子 agent
```

这在 `runAgent()` 第 469-479 行生效：
```typescript
if (allowedTools !== undefined) {
  toolPermissionContext = {
    ...toolPermissionContext,
    alwaysAllowRules: {
      cliArg: state.toolPermissionContext.alwaysAllowRules.cliArg,
      session: [...allowedTools],  // 白名单覆盖 session 级别规则
    },
  }
}
```

---

## 7. 两种协作模式

### 模式 A — Subagent（短任务，同进程）

```
特点：
- 运行在同一个 Node.js 进程
- 通过 AsyncLocalStorage 隔离状态
- 执行完返回结果后消失
- 适合快速搜索、分析任务
```

上下文结构：
```typescript
SubagentContext: {
  agentId: string,
  parentSessionId?: string,
  agentType: 'subagent',
  subagentName?: string,
  isBuiltIn?: boolean,
}
```

### 模式 B — Teammate（长任务，可跨进程）

```
特点：
- 通过 tmux/iTerm2 分屏可视化
- 每个 Teammate 有自己的终端 pane
- 通过 mailbox 系统通信
- 有自己的颜色标识
- 适合需要长时间并行工作的任务
```

上下文结构：
```typescript
TeammateAgentContext: {
  agentId: string,
  agentName: string,         // 格式: name@teamName
  teamName: string,
  agentColor?: string,       // 颜色标识
  planModeRequired: boolean,
  parentSessionId: string,
  isTeamLead: boolean,
  agentType: 'teammate',
}
```

### isAsync 与权限弹框机制

`runAgent.ts` 第 440-451 行揭示了 `isAsync` 与 `shouldAvoidPermissionPrompts` 的关系：

```typescript
const shouldAvoidPrompts =
  canShowPermissionPrompts !== undefined
    ? !canShowPermissionPrompts
    : agentPermissionMode === 'bubble'
      ? false
      : isAsync  // ← 核心：异步 agent 不弹权限框

if (shouldAvoidPrompts) {
  toolPermissionContext = {
    ...toolPermissionContext,
    shouldAvoidPermissionPrompts: true,
  }
}
```

| Agent 类型 | isAsync | shouldAvoidPermissionPrompts | 权限行为 |
|-----------|---------|---------------------------|---------|
| Skill fork 子 agent | true | true | 不弹框，继承父 agent 决定 |
| Explore / Plan（内置同步） | false | false | **正常弹权限确认框** |
| Teammate（内置异步） | true | true | 不弹框，继承父 agent 决定 |

**关键区分**：

- **同步 agent**（Explore/Plan）：`shouldAvoidPermissionPrompts = false`，调用危险工具时**会弹权限确认框**
- **异步 agent**（Teammate/Skill fork）：`shouldAvoidPermissionPrompts = true`，跳过弹框直接继承父 agent 决定

> 这是 Skill fork 和内置同步 agent 在权限行为上的本质区别——Skill fork 固定不弹框，而 Explore/Plan 同步 agent 正常弹框。

---

## 8. 结果返回机制

子 Agent 完成后，结果以结构化 XML 返回：

```xml
<task-notification>
  <task-id>agent-abc123</task-id>
  <status>completed</status>
  <summary>找到了 3 个相关文件</summary>
  <result>详细的分析报告...</result>
  <usage>
    <total_tokens>1500</total_tokens>
    <tool_uses>5</tool_uses>
    <duration_ms>3200</duration_ms>
  </usage>
</task-notification>
```

主 Agent 将其作为一条"用户消息"接收，然后决定下一步行动。

---

## 9. runAgent() 内部执行流程（源码级）

```
runAgent() 统一入口
  │
  ├── 1. 解析 agentDefinition 配置
  │     └── 获取 allowedTools / disallowedTools / model / hooks / skills / mcpServers
  │
  ├── 2. resolveAgentTools()
  │     └── 根据 agentDefinition 过滤工具列表
  │
  ├── 3. initializeAgentMcpServers()
  │     └── 连接 agent 专属 MCP servers（附加到父 agent 的 MCP 上）
  │
  ├── 4. 省略 ClaudeMd 和 GitStatus（Explore/Plan 优化）
  │     └── shouldOmitClaudeMd = agentDefinition.omitClaudeMd
  │
  ├── 5. createSubagentContext()
  │     ├── 克隆 messages（完整 conversation history）
  │     ├── 分配独立 agentId / depth++
  │     ├── 设置 shouldAvoidPermissionPrompts
  │     └── 应用 allowedTools 白名单
  │
  ├── 6. registerFrontmatterHooks()
  │     └── 注册 agent 级别的 session hooks
  │
  ├── 7. 预加载 skills（从 agentDefinition.skills）
  │     └── 加载 skill 内容加入 initialMessages
  │
  ├── 8. 调用 query() 进入 Agentic Loop
  │     └── 与主循环共用同一套 LLM API 调用
  │
  ├── 9. 子 Agent 完成后，收集所有消息
  │
  ├── 10. 封装为 <task-notification> 返回给主 Agent
  │
  └── 11. 清理资源
        ├── MCP cleanup
        ├── clearSessionHooks
        ├── cloneFileStateCache.clear()
        ├── killShellTasksForAgent
        └── unregisterPerfettoAgent
```

**关键源码文件**：`src/tools/AgentTool/runAgent.ts`（974 行）

---

## 10. Coordinator Mode（高级编排模式）

通过 `COORDINATOR_MODE` 功能开关启用。这是一个更高级的编排模式：

```
Coordinator (编排者)
  ├── 只做理解和规划，不执行具体任务
  ├── 通过 SendMessage 向 Worker 发指令
  ├── Worker 之间不直接通信
  └── Coordinator 收集所有结果后综合输出
```

工具分配：
- Coordinator：AgentTool + SendMessage + TaskStop
- Worker：受限的执行工具集

---

## 11. 关键源文件索引

| 文件 | 内容 |
|------|------|
| `src/tools/AgentTool/runAgent.ts` | **Agent 统一执行入口**（974 行），初始化 MCP、resolveAgentTools、createSubagentContext、query 调用 |
| `src/tools/AgentTool/agentToolUtils.ts` | `resolveAgentTools()` 工具过滤、`result` 收集统计、`<task-notification>` 封装 |
| `src/tools/AgentTool/AgentTool.tsx` | 主工具定义，spawn 逻辑 |
| `src/tools/AgentTool/builtInAgents.ts` | 内置 Agent 注册表 |
| `src/tools/AgentTool/built-in/exploreAgent.ts` | 搜索专家定义 |
| `src/tools/AgentTool/built-in/planAgent.ts` | 架构师定义 |
| `src/tools/AgentTool/built-in/generalPurposeAgent.ts` | 通用执行者定义 |
| `src/tools/AgentTool/loadAgentsDir.ts` | Agent 定义加载（内置 + 自定义） |
| `src/tools/AgentTool/constants.ts` | 常量定义 |
| `src/tools/shared/spawnMultiAgent.ts` | Teammate spawn 逻辑 |
| `src/utils/forkedAgent.ts` | `createSubagentContext()` — Skill fork 和内置 agent 共享的隔离机制 |
| `src/utils/hooks/registerFrontmatterHooks.ts` | agent frontmatter hooks 注册 |
| `src/utils/hooks/sessionHooks.ts` | session hooks 管理（clearSessionHooks） |

---

## 12. 设计精华总结

1. **统一入口**：所有 agent（Skill fork、内置、Teammate）共享 `runAgent()` 统一入口，区别仅在 agent 定义来源
2. **工具化调用**：Multi-Agent 不是独立系统，而是通过 AgentTool 实现，主 Agent 视角就是"调用一个工具"
3. **配置驱动**：每个 Agent 是一个 `AgentDefinition` 对象，定义身份、能力、限制
4. **工具隔离**：通过 `resolveAgentTools()` + `disallowedTools` 精确控制能力边界
5. **模型分层**：轻量任务用 haiku（快且省），重要任务用更强模型
6. **结果结构化**：`<task-notification>` XML 格式统一返回结果和统计
7. **防止递归**：子 Agent 不能再 spawn 子 Agent（`AGENT_TOOL_NAME` 在黑名单中）
8. **权限双重防护**：Skill fork 用 `shouldAvoidPermissionPrompts=true` + `allowed-tools` 白名单；内置同步 agent 正常弹框
9. **隔离机制共享**：`createSubagentContext()` 同时被 Skill fork 和内置 agent 调用，克隆 messages、分配独立上下文
10. **Agent 专属 MCP**：agent 可通过 `mcpServers` frontmatter 添加专属 MCP 连接，附加到父 agent 的 MCP 上
