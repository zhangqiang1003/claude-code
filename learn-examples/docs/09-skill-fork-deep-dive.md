# Skill Fork 深度解析

> 来源：Skill 系统开发复习会话（2026-04-14）
> 关键词：Skill fork、子 agent、runAgent()、createSubagentContext()、shouldAvoidPermissionPrompts、allowed-tools

---

## 核心问题

Skill fork 模式会 fork 一个子 agent，这个子 agent 和 Claude Code 的内置子 agent（explore、plan agent、General agent、Verification Agent 以及 Teammates）是什么关系？

---

## 核心结论

**Skill fork 的子 agent 和内置子 agent 共享同一个底层执行引擎，执行机制完全相同。**

区别仅在于 agent 定义来源：
- **Skill fork** = 用 `SKILL.md` frontmatter 动态构建 agent 定义
- **内置子 agent** = `agentDefinitions` 预定义的 agent 类型

---

## 架构图：共享的底层引擎

```
                    ┌─────────────────────────────────────┐
                    │            runAgent()                │
                    │         （统一执行引擎）              │
                    └──────────┬──────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │  Skill fork  │     │   Explore   │     │  Plan Agent │
   │  (SKILL.md)  │     │  (内置)     │     │   (内置)    │
   └─────────────┘     └─────────────┘     └─────────────┘
          │                                        │
          └────────────────────┬───────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ createSubagentContext()
                    │   （共享的隔离机制）   │
                    └─────────────────────┘
```

---

## Skill fork 执行管道

```
SkillTool.call()
      │
      ▼
processPromptSlashCommand() / executeForkedSkill()
      │
      ▼
runAgent() ←─────────────── 与内置 agent 共用同一入口
      │
      ├── 创建独立执行上下文（createSubagentContext）
      ├── 加载 SKILL.md frontmatter（name, allowed-tools, agent, context...）
      ├── 设置 shouldAvoidPermissionPrompts = true
      └── 分配独立 agentId / token budget
```

---

## createSubagentContext()：共享的隔离机制

`src/utils/forkedAgent.ts` 中的 `createSubagentContext()` 是 Skill fork 和内置子 agent **共同调用**的函数。它做了三件事：

### 1. 克隆 messages（不污染父 agent 状态）

```typescript
// 克隆一份 messages，子 agent 看到的是完整的 conversation 历史
const clonedMessages = readFileState.messages.map(m => ({ ...m }))
```

### 2. 生成独立执行上下文

```typescript
newAgentId = generateAgentId()           // 独立 agentId
queryTracking.depth = parentDepth + 1   // 嵌套深度 +1
shouldAvoidPermissionPrompts = true     // 不弹权限确认
```

### 3. 继承 allowed tools（通过 frontmatter 的 `allowed-tools` 限制）

```typescript
const allowedTools = command.allowedTools ?? ['ReadFileTool', 'GrepTool']
// 白名单之外的工具不会传给子 agent
```

---

## 子 agent 与父 agent 的共享关系

| 维度 | 是否共享 | 说明 |
|------|---------|------|
| **conversation history（完整 messages）** | ✅ 共享 | 子 agent 看到完整的对话历史 |
| **Session 状态（settings, permissions）** | ✅ 共享 | 同一 session 共享 permissionMode 等配置 |
| **工具列表（allowed tools）** | ⚙️ 部分 | 父 agent 通过 `allowed-tools` 白名单决定哪些工具传给子 agent |
| **agentId** | ❌ 独立 | 子 agent 有自己独立的 agentId |
| **queryTracking.depth** | ❌ 独立 | 子 agent 的 depth = 父 agent depth + 1 |
| **shouldAvoidPermissionPrompts** | ❌ 固定为 true | 子 agent 不弹权限确认 |
| **token budget** | ❌ 独立 | 子 agent 有自己的 token 计数和限制 |

### 一句话总结

> Skill fork 的子 agent 和父 agent **共享同一个 conversation 历史**（conversation messages），但有**完全独立的执行上下文**（agentId、depth、token budget）。

---

## 权限机制：双重防护

Skill fork 和内置同步 agent 在 `shouldAvoidPermissionPrompts` 上的区别：

| Agent 类型 | isAsync | shouldAvoidPermissionPrompts | 权限行为 |
|-----------|---------|---------------------------|---------|
| **Skill fork 子 agent** | true | true | 不弹框，继承父 agent 决定 |
| **内置同步 agent（Explore/Plan）** | false | false | 正常弹权限确认框 |
| **内置异步 agent（Teammate）** | true | true | 不弹框，继承父 agent 决定 |

> 关键在 `runAgent.ts` 第 440-451 行：`shouldAvoidPrompts = isAsync`，所以异步 agent 不弹框，同步 agent 正常弹框。

---

## 权限机制：双重防护

Skill fork 的权限控制有两层，缺一不可：

```
用户 ──(permission mode)──→ 父 agent ──(shouldAvoidPermissionPrompts=true)──→ 子 agent
                                      │
                                      └──(allowed-tools 白名单)──→ 实际执行
```

### 第一层：shouldAvoidPermissionPrompts = true

**作用**：跳过弹框，直接继承父 agent 的权限决定。

```typescript
// 伪代码逻辑
if (shouldAvoidPermissionPrompts) {
  if (父agent.hasAllowed(toolName)) {
    return allow  // 直接允许
  } else {
    return deny   // 直接拒绝
  }
}
```

**效果**：子 agent 调用工具时不会暂停等待用户确认。

---

### 第二层：allowed-tools 白名单

**作用**：在工具发现阶段就过滤掉危险工具，白名单之外的工具根本不会传给子 agent。

```yaml
# SKILL.md frontmatter
allowed-tools:
  - ReadFileTool
  - GrepTool
  - GlobTool
  # BashTool、WriteFileTool 等危险操作不在列表中，根本不会到达子 agent
```

**效果**：子 agent 不知道白名单之外的工具存在，即使想调用也做不到。

---

### 两层机制对比

| 控制手段 | 作用层级 | 是否弹框 | 生效时机 |
|---------|---------|---------|---------|
| `shouldAvoidPermissionPrompts: true` | 权限决策层 | 不弹 | 子 agent 尝试调用工具时 |
| `allowed-tools` frontmatter | 工具发现层 | 不可见的过滤 | 子 agent 获取工具列表时 |

---

## 验证场景

### 场景一：子 agent 能否看到父 agent 的完整历史？

✅ **能看到**。子 agent 共享父 agent 的完整 conversation history（克隆的 messages），包括用户最初说的第一句话。

### 场景二：子 agent 调用 BashTool 会弹权限确认框吗？

**不会弹框**。但实际上：

1. 如果 `allowed-tools` 里包含 `BashTool` → `shouldAvoidPermissionPrompts: true` 让它直接继承父 agent 决定，不弹框
2. 如果 `allowed-tools` 里不包含 `BashTool` → `BashTool` 根本不会被传给子 agent，子 agent 不知道这个工具存在

### 场景三：Skill fork 和 Explore agent 的本质区别？

| 维度 | Skill fork | Explore agent |
|------|-----------|---------------|
| agent 定义来源 | SKILL.md frontmatter 动态构建 | `agentDefinitions` 预定义 |
| 触发方式 | `/teach-me` 等 slash 命令 | `/explore` 等内置命令 |
| 工具限制 | `allowed-tools` frontmatter | `allowedTools` 在 agent 定义中 |
| 执行引擎 | `runAgent()` | `runAgent()` |
| 隔离机制 | `createSubagentContext()` | `createSubagentContext()` |

**本质上没有区别**，只是定义方式不同。

---

## Skill fork 的调用链总结

```
用户输入（如 /teach-me）
      │
      ▼
SkillTool.call()
      │
      ▼
executeForkedSkill()
  ├── 从 SKILL.md 读取 frontmatter
  │     ├── name, description, allowed-tools
  │     ├── context: fork
  │     ├── agent: general-purpose
  │     └── hooks: { preToolUse, postToolUse, ... }
  │
      ▼
prepareForkedCommandContext()
  └── 确定 agent 类型（默认 general-purpose）
      │
      ▼
runAgent()
  │
      ▼
createSubagentContext()  ← 与内置子 agent 共用
  ├── 克隆 messages（完整 conversation history）
  ├── 设置 shouldAvoidPermissionPrompts = true
  ├── 分配独立 agentId / depth++
  └── 应用 allowed-tools 白名单过滤工具
      │
      ▼
子 agent 执行任务
  ├── 调用 LLM（使用自己的 token budget）
  ├── 调用工具（权限继承父 agent 决定）
  └── 返回结果给父 agent
```

---

## 参考文件

| 文件 | 说明 |
|------|------|
| `src/tools/SkillTool/SkillTool.ts` | Skill 执行入口，`executeForkedSkill()` 定义 |
| `src/utils/forkedAgent.ts` | `prepareForkedCommandContext()` 和 `createSubagentContext()` |
| `src/utils/hooks/registerSkillHooks.ts` | Skill hooks 注册机制 |
| `.claude/skills/teach-me/SKILL.md` | SKILL.md frontmatter 示例 |
