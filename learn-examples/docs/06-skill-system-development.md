# Claude Code Skill 系统开发指南

> 基于 teach-me 技能深度解析，适合想要开发自定义 Skill 的开发者

## 目录

1. [Skill vs Tool：本质区别](#1-skill-vs-tool本质区别)
2. [Skill 目录结构](#2-skill-目录结构)
3. [Skill 执行管道（核心流程）](#3-skill-执行管道核心流程)
4. [SKILL.md 的 frontmatter 字段详解](#4-skillmd-的-frontmatter-字段详解)
5. [Skill Hooks：事件驱动机制](#5-skill-hooks事件驱动机制)
6. [Compaction 中的 Skill 保护机制](#6-compaction-中的-skill-保护机制)
7. [teach-me 的核心设计解析](#7-teach-me-的核心设计解析)
8. [从头开发一个新 Skill](#8-从头开发一个新-skill)
9. [Skill 加载的完整生命周期](#9-skill-加载的完整生命周期)
10. [teach-me 与其他 Skill 的对比](#10-teach-me-与其他-skill-的对比)
11. [关键源码文件索引](#11-关键源码文件索引)

---

## 1. Skill vs Tool：本质区别

| 维度 | Tool | Skill |
|------|------|-------|
| **触发方式** | LLM 通过 `tool_use` 调用执行动作 | LLM 或用户通过 `/slash` 命令触发，执行复杂任务 |
| **执行粒度** | 单一原子操作（读文件、执行命令） | 复杂多步骤流程（学习、代码审查） |
| **返回方式** | `ToolResult` 数据 | 通常展开为 `newMessages`（inline）或启动子 agent（fork） |
| **上下文需求** | 独立使用 | 常需要完整对话上下文 |

**关键区别**：Skill 是 `Tool` 的消费者 — 它内部可以调用多个 Tool 来完成任务。

---

## 2. Skill 目录结构

```
skill-name/
├── SKILL.md              # 核心定义（必须）
├── references/           # 可选：参考资料
│   └── *.md
└── records/              # 可选：会话持久化数据
    └── {topic-slug}/
        └── session.md
```

**teach-me 的实际结构**：

```
.claude/skills/teach-me/
├── SKILL.md              # 教学策略 + 工作流定义
├── references/           # 教学法参考资料
│   └── pedagogy.md
└── records/              # 学习记录（按 topic slug 组织）
    └── ai-agent-development/
        └── session.md
```

---

## 3. Skill 执行管道（核心流程）

Skill 的执行有两种模式，由 frontmatter 的 `context` 字段决定：

```
用户/LLM 调用 /teach-me
         │
         ▼
┌─────────────────────────┐
│    SkillTool.call()     │
│  (validateInput 通过后)   │
└─────────┬───────────────┘
          │
          ▼
    command.context === 'fork' ?
    ┌────┴────┐
    │         │
  YES        NO (inline)
    │         │
    ▼         ▼
executeForkedSkill()  processPromptSlashCommand()
  启动子 agent     展开 prompt 文本为 newMessages
  独立 token 预算  在当前对话中注入消息
```

### Inline 模式（teach-me 使用的模式）

1. `processPromptSlashCommand()` 读取 SKILL.md 内容
2. 替换 `!command` 快捷方式
3. 替换 `$ARGUMENTS` 参数
4. 将展开后的文本作为 `newMessages` 注入当前对话
5. Skill 的指令直接在主 agent 的上下文中执行

### Fork 模式

1. 创建独立的子 agent
2. 分配独立的 token 预算
3. Skill 在隔离环境中运行
4. 结果通过 `extractResultText()` 提取返回

---

## 4. SKILL.md 的 frontmatter 字段详解

```yaml
---
name: teach-me                           # Skill 名称（用于 / 调用）
description: "Personalized 1-on-1..."   # 描述（供 LLM 理解何时使用）
user-invocable: true                    # 是否允许用户直接调用
allowed-tools: [Read, Grep, ...]        # 限制可用的 Tool（可选）
model: opus                             # 指定模型（可选）
context: inline                          # 执行模式：inline | fork
agent:                                   # Agent 配置（可选）
  agentType: ...
  effort: ...
hooks:                                   # 事件钩子（可选）
  preToolUse:
    - matcher: "Bash*"
      hooks:
        - command: "echo pre-hook"
          once: false
paths:                                   # 条件激活路径（可选）
  - "*.py"
  - "**/*.ts"
---
```

### 关键字段详解

| 字段 | 说明 | 示例 |
|------|------|------|
| `name` | Skill 名称，用于 `/` 调用 | `teach-me` |
| `description` | 描述，供 LLM 理解何时使用 | `"Personalized 1-on-1 AI tutor..."` |
| `user-invocable` | 是否允许用户直接调用 | `true` / `false` |
| `allowed-tools` | 限制可用的 Tool 列表 | `[Read, Grep, Glob]` |
| `model` | 指定使用的模型 | `opus`, `sonnet` |
| `context` | 执行模式 | `inline`（当前会话执行）或 `fork`（子 agent） |
| `agent` | Agent 配置 | `agentType`, `effort` 等 |
| `hooks` | 事件钩子 | `preToolUse`, `postToolUse` 等 |
| `paths` | 条件激活路径 | `["*.py", "**/*.ts"]` |
| `effort` |  effort 级别 | `effort: "medium"` |
| `shell` | shell 命令 | `shell: "bash"` |

### context 字段详解

**`context: inline`**（teach-me 使用）：
- 教学是一个持续多轮的对话过程
- 需要保留用户之前的回答作为上下文
- 在同一上下文中继续追问
- 动态调整教学策略

**`context: fork`**（如 commit skill）：
- 启动独立子 agent
- 每次 skill 调用都是全新的上下文
- 适用于独立、不依赖会话历史的场景

---

## 5. Skill Hooks：事件驱动机制

Skill 可以在 frontmatter 中声明钩子，在会话生命周期中的特定事件触发时执行：

```yaml
hooks:
  preToolUse:           # Tool 调用前
    - matcher: "Bash*"
      hooks:
        - command: "echo '即将执行: ${TOOL_NAME}'"
          once: false   # 是否只执行一次
  postToolUse:          # Tool 调用后
    - matcher: "Edit*"
      hooks:
        - command: "git diff"
  preCompact:           # 压缩前
  postCompact:          # 压缩后
```

### Hook 注册流程

1. 解析 frontmatter 中的 `hooks` 配置
2. 对每个事件类型创建 matcher
3. 通过 `addSessionHook()` 注册到会话级别的 hook 系统
4. `once: true` 的 hook 在执行一次后自动移除

### 可用事件类型

| 事件 | 触发时机 |
|------|----------|
| `preToolUse` | Tool 调用前 |
| `postToolUse` | Tool 调用后 |
| `preCompact` | 压缩前 |
| `postCompact` | 压缩后 |

> **注意**：teach-me 目前没有使用 hooks — 它是一个纯 prompt-based skill，所有逻辑都在 prompt 文本中定义。

---

## 6. Compaction 中的 Skill 保护机制

### 问题

当 Context Window 快满时，Claude Code 会压缩旧消息。但如果 skill 的指令被压缩丢失了怎么办？

### 解决方案：`invokedSkills` Map

```typescript
// bootstrap/state.ts
invokedSkills: Map<
  string,                      // key = `${agentId}:${skillName}`
  {
    skillName: string
    skillPath: string
    content: string            // skill 的完整内容
    invokedAt: number
    agentId: string | null
  }
>
```

### 保护流程

**1. Skill 执行时**（`processPromptSlashCommand.tsx`）:
```typescript
addInvokedSkill(skillName, skillPath, content, agentId)
```

**2. Compaction 压缩前**（`compact.ts` → `executePreCompactHooks`）:
- 遍历 `invokedSkills`
- 将 skill 内容标记为"不可压缩"

**3. Compaction 压缩完成后**（`compact.ts` → `executePostCompactHooks`）:
- 检查是否有被压缩破坏的消息边界
- 从 `invokedSkills` 恢复 skill 内容，重新注入

### 关键点

- `records/` 是 SkillTool 写入的外部文件
- Compaction 只操作会话内的消息数组
- 恢复时通过 `session.md` 的路径重新读取
- 同一 agent 的同一 skill 不会重复注册（key 唯一性）

---

## 7. teach-me 的核心设计解析

### 本质

**teach-me 是一个"元控制器"** — 它不直接操作文件，而是通过 prompt 引导 LLM 执行特定的教学策略。

### SKILL.md 的结构

```
# Teach Me (标题)

## Usage（使用方式）
/teach-me Python decorators

## Arguments（参数定义）
<topic>, --level, --resume

## Core Rules（核心规则）
7 条铁律：
1. 最小化说教，用问题引导发现
2. 先诊断再教学
3. 掌握门槛（mastery gate）
4. 每轮 1-2 个问题
5. 耐心+严谨
6. 语言跟随用户
7. 必须用 AskUserQuestion

## Workflow（工作流）
5 步：Parse → Diagnose → Build Concept List → Tutor Loop → Session End

## Step 0-4（各步骤详细指令）
每个步骤的行为规范 + AskUserQuestion 模板

## Session End（会话结束规范）
如何更新 session.md、如何给出结构化总结
```

### teach-me 没有用 `context: fork` 的原因

1. **持续性上下文**：教学是多轮对话，需要保留历史学习记录
2. **动态策略调整**：根据用户回答实时调整问题难度
3. **用户参与感**：在同一会话中追问，用户体验更连贯
4. **状态持久化**：通过 `records/` 目录实现跨会话学习进度保存

---

## 8. 从头开发一个新 Skill

### 假设：开发 `/code-review` skill

#### Step 1: 创建目录结构

```
.claude/skills/code-review/
├── SKILL.md
└── references/
    └── review-checklist.md
```

#### Step 2: 编写 SKILL.md

```yaml
---
name: code-review
description: "Perform a focused code review. Use when asked to review, critique, or analyze code quality."
user-invocable: true
allowed-tools: [Read, Grep, Glob]
context: inline
---

# Code Review Skill

## Usage
/code-review <file-or-function-name>

## Workflow

### Step 1: Gather Context
- Use Grep/Glob to find the target code
- Read the file to understand the code

### Step 2: Analyze
Focus on:
- Correctness (逻辑错误)
- Security (安全漏洞)
- Performance (性能问题)
- Readability (可读性)

### Step 3: Provide Feedback
Use AskUserQuestion to present findings...
```

#### Step 3: 测试与迭代

1. 在 Claude Code 中调用 `/code-review SomeFile.ts`
2. 观察输出是否符合预期
3. 调整 SKILL.md 中的指令

### 关键设计原则

1. **明确边界**：Skill 应该专注于单一领域
2. **使用 AskUserQuestion**：保持用户参与感
3. **处理 `--resume`**：支持会话恢复的 skill 体验更好
4. **持久化重要数据**：用 `records/` 目录存储跨会话状态

---

## 9. Skill 加载的完整生命周期

### 启动阶段

```
loadSkillsDir()
  → 扫描 4 个路径（policySettings → userSettings → projectSettings → --add-dir）
  → 解析 frontmatter
  → 创建 Command 对象
  → 注册到命令系统
```

### 运行阶段

```
用户输入 /teach-me
  → SkillTool.validateInput() 验证存在
  → SkillTool.checkPermissions() 检查权限
  → SkillTool.call() 执行
      → processPromptSlashCommand() (inline)
        → addInvokedSkill() 注册到保护列表
        → 返回 newMessages 注入对话
      → 或 executeForkedSkill() (fork)
        → runAgent() 启动子 agent
```

### Compaction 阶段

```
compact()
  → executePreCompactHooks() 检查 invokedSkills
  → 执行压缩
  → executePostCompactHooks() 恢复 skill 内容
```

---

## 10. teach-me 与其他 Skill 的对比

| Skill | context | allowed-tools | 特点 |
|-------|---------|---------------|------|
| teach-me | inline | 无 | 元控制器，纯 prompt |
| commit | fork | Bash, Edit | 独立子 agent 执行 |
| review-pr | fork | Bash, Read, Grep | API 调用 + 结果分析 |
| simplify | inline | 无 | 代码优化建议 |

### context 分布

| 模式 | 使用场景 | 代表 Skill |
|------|---------|-----------|
| `inline` | 需要持续多轮对话、共享上下文 | teach-me, simplify |
| `fork` | 独立任务、不依赖当前会话历史 | commit, review-pr |

---

## 11. 关键源码文件索引

| 文件 | 作用 |
|------|------|
| `src/skills/loadSkillsDir.ts` | Skill 加载主逻辑：扫描、解析、注册 |
| `src/tools/SkillTool/SkillTool.ts` | Skill 执行入口：validateInput、checkPermissions、call |
| `src/utils/processUserInput/processSlashCommand.tsx` | inline 模式：prompt 展开、!command 替换 |
| `src/bootstrap/state.ts` | invokedSkills Map：skill 内容保护 |
| `src/utils/hooks/registerSkillHooks.ts` | Hook 注册：preToolUse、postToolUse 等 |
| `src/services/compact/compact.ts` | Compaction：invokeSkills 保护机制 |

### 其他相关文件

| 文件 | 作用 |
|------|------|
| `src/commands.ts` | Command 类型定义、findCommand |
| `src/tools/SkillTool/prompt.ts` | Skill 的 prompt 模板 |
| `src/utils/frontmatterParser.ts` | YAML frontmatter 解析 |
| `src/types/command.ts` | Command 相关类型定义 |

---

## 附录：Skill 开发 Checklist

- [ ] 创建 `.claude/skills/{skill-name}/SKILL.md`
- [ ] 填写 frontmatter（name、description、user-invocable）
- [ ] 确定执行模式（inline 或 fork）
- [ ] 编写核心 prompt 内容
- [ ] 确定是否需要 allowed-tools 限制
- [ ] 确定是否需要 hooks
- [ ] 确定是否需要 records/ 持久化
- [ ] 确定是否需要 paths 条件激活
- [ ] 测试 `/skill-name` 调用
- [ ] 验证 --resume 功能（如果需要）
