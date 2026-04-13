# Skill Fork 子 Agent 与内置子 Agent 的关系

> 来自 teach-me 学习会话中的深度问答

## 问题

> Skill 执行管道中，fork 模式会 fork 一个子 agent，这个子 agent 和 Claude Code 的子 agent（explore、plan agent、General agent、Verification Agent 以及 Teammates）有关系吗？

## 核心结论

**它们是同一个机制，共享同一个底层引擎 `runAgent()`**。

```
                    ┌─────────────────────────────────┐
                    │         runAgent()               │
                    │   (统一的 agent 循环引擎)          │
                    └────────────┬────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
 SkillTool fork              AgentTool              Teammates / InProcessRunner
 (executeForkedSkill)    (explore/plan/general/    (inProcessRunner.ts)
                          verification agents)
```

---

## 详细解析

### 1. 调用链对比

| 调用方 | 入口函数 | agentDefinition 来源 |
|--------|---------|-------------------|
| SkillTool fork | `executeForkedSkill()` → `runAgent()` | 从 SKILL.md frontmatter 的 `agent:` 字段构建 |
| AgentTool explore | `runAgent()` 直接调用 | 预定义的 `explore` agent 类型 |
| AgentTool plan | `runAgent()` 直接调用 | 预定义的 `plan` agent 类型 |
| AgentTool verification | `runAgent()` 直接调用 | 预定义的 `verification` agent 类型 |
| Teammates | `inProcessRunner.ts` → `runAgent()` | 预定义的 `teammate` agent 类型 |

**所有调用方最终都落在同一个 `runAgent()` 函数上**，区别只是传入的参数不同。

### 2. Skill fork 的 agent 决定过程

```typescript
// src/utils/forkedAgent.ts - prepareForkedCommandContext()
export async function prepareForkedCommandContext(
  command: PromptCommand,
  args: string,
  context: ToolUseContext,
): Promise<PreparedForkedContext> {
  // ...

  // 使用 SKILL.md frontmatter 的 agent 字段，默认 general-purpose
  const agentTypeName = command.agent ?? 'general-purpose'
  const agents = context.options.agentDefinitions.activeAgents
  const baseAgent =
    agents.find(a => a.agentType === agentTypeName) ??
    agents.find(a => a.agentType === 'general-purpose') ??
    agents[0]

  // ...
}
```

**如果没有在 SKILL.md 中指定 `agent:` 字段，默认用 `general-purpose`**。

### 3. 共享的基础设施

无论哪个调用方，最终都通过 `createSubagentContext()` 创建子 agent 上下文：

```typescript
// src/utils/forkedAgent.ts - createSubagentContext()
export function createSubagentContext(
  parentContext: ToolUseContext,
  overrides?: SubagentContextOverrides,
): ToolUseContext {
  return {
    // 文件读取缓存 — 克隆以隔离
    readFileState: cloneFileStateCache(...),

    // 子 agent 默认不弹权限提示
    getAppState: () => ({
      ...state,
      toolPermissionContext: {
        ...state.toolPermissionContext,
        shouldAvoidPermissionPrompts: true,  // ← 关键标志
      },
    }),

    // 每个子 agent 有独立的 ID
    agentId: overrides?.agentId ?? createAgentId(),

    // 嵌套深度递增（用于 telemetry）
    queryTracking: {
      chainId: randomUUID(),
      depth: (parentContext.queryTracking?.depth ?? -1) + 1,
    },
  }
}
```

### 4. 唯一区别

| 维度 | Skill fork | 内置子 agent |
|------|-----------|-------------|
| **agent 定义来源** | SKILL.md frontmatter 动态构建 | `agentDefinitions` 预定义 |
| **allowed-tools** | frontmatter 的 `allowed-tools` 字段 | agent 定义中硬编码 |
| **system prompt** | SKILL.md 的内容通过 `getPromptForCommand()` 获取 | 预定义的 system prompt |
| **effort** | frontmatter 的 `effort` 字段 | agent 定义中配置 |

---

## 为什么设计成这样？

Claude Code 的子 agent 系统是一个**通用的 agent 执行框架**，Skill 系统是一个**配置驱动的 skill 封装**。

当 Skill 需要 fork 模式时，它本质上就是想"运行一个独立的 agent"，所以直接复用已有的 `runAgent()` 引擎是最合理的设计：

1. **代码复用**：不需要为 Skill 再写一套 agent 执行逻辑
2. **一致性**：Skill fork 和内置 agent 的行为完全一致（同样的工具调用、同样的消息处理）
3. **隔离性**：复用 `createSubagentContext()` 确保子 agent 不会干扰父 agent

---

## 关键源码文件

| 文件 | 作用 |
|------|------|
| `src/tools/AgentTool/runAgent.ts` | 统一的 agent 循环引擎（248 行开始） |
| `src/utils/forkedAgent.ts` | `createSubagentContext()` + `prepareForkedCommandContext()` |
| `src/tools/SkillTool/SkillTool.ts` | `executeForkedSkill()` — Skill fork 入口 |
| `src/utils/swarm/inProcessRunner.ts` | Teammates 的 runner，底层也调用 `runAgent()` |

---

## 结论

Skill fork 模式本质上就是**用 skill 的配置动态创建一个临时的小型 agent**，然后把它当作子 agent 运行。它和 explore/plan/teammate 这些内置 agent 的区别仅仅是**来源不同**（动态 vs 预定义），**执行机制完全相同**。
