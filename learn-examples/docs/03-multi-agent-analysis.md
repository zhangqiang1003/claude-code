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

## 3. Agent 定义的数据结构

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

---

## 4. 四个内置 Agent 的分工

### 4.1 Explore Agent（搜索专家）

```typescript
agentType: 'Explore'
model: 'haiku'        // 快速便宜
tools: 只读           // Glob, Grep, Read, Bash(只读命令)
```

System Prompt 核心指令：
- "你是文件搜索专家"
- "严格只读模式 — 不能创建、修改、删除任何文件"
- "你应该尽量并行发起多个搜索请求以提高效率"

### 4.2 Plan Agent（架构师）

```typescript
agentType: 'Plan'
model: 'inherit'      // 继承主 Agent 的模型
tools: 只读           // 同 Explore
```

System Prompt 核心指令：
- "你是软件架构师和规划专家"
- "探索代码库并设计实现方案"
- 输出必须包含 "### Critical Files for Implementation"

### 4.3 General Purpose Agent（万能执行者）

```typescript
agentType: 'general-purpose'
model: 未指定（继承默认）
tools: ['*']          // 全部工具，可读写
```

System Prompt 核心指令：
- "你是 Claude Code 的通用 agent"
- "完整完成任务 — 不要过度设计，也不要半途而废"

### 4.4 Verification Agent（质量检查）

```typescript
agentType: 'verification'  // 需要功能开关 VERIFICATION_AGENT
```

独立验证已完成的变更，确保质量。

---

## 5. 工具隔离机制

Claude Code 通过**工具白名单/黑名单**控制每个 Agent 的能力边界：

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
- **所有子 Agent**：都不能再 spawn 子 Agent（防止无限嵌套）

---

## 6. 两种协作模式

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

---

## 7. 结果返回机制

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

## 8. Agent 生命周期

```
1. 主 Agent 调用 AgentTool
   ↓
2. 解析 agentType → 找到对应的 AgentDefinition
   ↓
3. 构建 Agent 上下文（system prompt + tools + permissions）
   ↓
4. 创建独立的消息历史（fork 或 新建）
   ↓
5. 调用 query() 运行子 Agent（与主循环相同的 API 调用）
   ↓
6. 子 Agent 完成后，收集所有消息
   ↓
7. 提取最终文本结果 + 统计 token/工具使用
   ↓
8. 封装为 <task-notification> 返回给主 Agent
   ↓
9. 清理资源（MCP 连接、worktree 等）
```

---

## 9. Coordinator Mode（高级编排模式）

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

## 10. 关键源文件索引

| 文件 | 内容 |
|------|------|
| `src/tools/AgentTool/AgentTool.tsx` | 主工具定义，spawn 逻辑 |
| `src/tools/AgentTool/runAgent.ts` | Agent 运行逻辑（初始化 MCP、调用 query） |
| `src/tools/AgentTool/agentToolUtils.ts` | 结果收集、统计、通知封装 |
| `src/tools/AgentTool/builtInAgents.ts` | 内置 Agent 注册表 |
| `src/tools/AgentTool/built-in/exploreAgent.ts` | 搜索专家定义 |
| `src/tools/AgentTool/built-in/planAgent.ts` | 架构师定义 |
| `src/tools/AgentTool/built-in/generalPurposeAgent.ts` | 通用执行者定义 |
| `src/tools/AgentTool/loadAgentsDir.ts` | Agent 定义加载（内置 + 自定义） |
| `src/tools/AgentTool/constants.ts` | 常量定义 |
| `src/tools/shared/spawnMultiAgent.ts` | Teammate spawn 逻辑 |

---

## 11. 设计精华总结

1. **工具化调用**：Multi-Agent 不是独立系统，而是通过 AgentTool 实现，主 Agent 视角就是"调用一个工具"
2. **配置驱动**：每个 Agent 是一个 `AgentDefinition` 对象，定义身份、能力、限制
3. **工具隔离**：通过 `disallowedTools` 精确控制能力边界
4. **模型分层**：轻量任务用 haiku（快且省），重要任务用更强模型
5. **结果结构化**：`<task-notification>` XML 格式统一返回结果和统计
6. **防止递归**：子 Agent 不能再 spawn 子 Agent
7. **简洁优雅**：本质就是 "LLM 调用 LLM"，不需要复杂的多进程调度
