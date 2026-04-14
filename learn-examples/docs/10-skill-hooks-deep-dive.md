# Skill Hooks 进阶：源码解析

> 本文档对应 2026-04-14 学习内容，3 个核心概念。

---

## 1. Hook 本质：事件驱动的拦截器

### 核心定义

Hook = **事件驱动的拦截器注册机制**。当 Claude Code 运行过程中发生特定事件时，对应的 Hook 被触发执行，通过 **exit code** 表达干预意图。

```
事件发生 → 查找注册的 Hook → 执行 Hook（5 种方式）→ 根据 exit code 决定后续行为
```

### Hook 和 Skill 的关系

Skill 是 Hook 的**主要使用者**。Skill 在 `SKILL.md` frontmatter 中声明的 `hooks:` 字段，会被翻译成 `settings.json` 中的 Hook 配置，在 Skill fork 的子 agent 环境中生效。

### Exit Code 机制（核心）

每个 Hook 命令执行完后，返回一个 exit code：

| exit code | 含义 | 行为 |
|-----------|------|------|
| `0` | 成功/放行 | stdout 被处理，事件继续 |
| `2` | 阻断/阻止 | 显示 stderr 给 LLM，当前操作被阻止 |
| 其他 | 警告但继续 | stderr 仅显示给用户，操作继续执行 |

### Exit Code 应用示例

| Hook 事件 | exit = 0 | exit = 2 | 其他 |
|-----------|----------|----------|------|
| **PreToolUse** | 继续执行工具 | 阻止工具调用 | stderr 给用户，继续执行 |
| **PreCompact** | stdout 追加为压缩指令 | 阻止压缩 | 继续压缩 |
| **PermissionRequest** | 使用 hook 返回的决定 | 拒绝权限 | stderr 给用户 |

### 关键洞察：Exit Code = 2 的阻断语义

Exit code = 2 让 Hook 成为一个**有条件的安全门**。它不是直接修改行为，而是通过 exit code 发出信号，由 Claude Code 决定是否阻断。

---

## 2. 执行时机：权限检查之后，工具执行之前

### 关键顺序

```
用户授权（permissions.ts 权限系统）  ← 第一道门：决定"能不能调用"
        ↓
PreToolUse / PostToolUse hook        ← 第二道门：工具前后的额外检查
        ↓
工具实际执行（tool.call()）
```

**Hook 不替代权限系统**——权限系统先于 hook 执行。如果权限系统拒绝（用户点"No"），hook 根本不会被触发。

### PermissionRequest 的特殊性

`PermissionRequest` hook 在**权限对话框层面**拦截，比 PreToolUse 更早：

```
用户触发危险操作
        ↓
权限系统决定需要弹框（ask）
        ↓
PermissionRequest hook 触发（替代对话框）
        ↓
hook 返回 hookSpecificOutput = { allow: true/false }
        ↓
对话框不显示，直接执行或拒绝
```

---

## 3. Hook 类型体系：5 种执行方式

### 概览

| 类型 | 说明 | 常用场景 |
|------|------|---------|
| `command` | 执行外部脚本 | 安全检查、lint、格式化 |
| `prompt` | 调用 LLM 决策 | PermissionRequest 自动化授权 |
| `agent` | 启动子 agent 处理 | 复杂多步推理场景 |
| `http` | 发 HTTP 请求 | 调用外部 API（审计、通知） |
| `callback` | 内部回调 | Built-in hook（plugin 用） |

### command 类型

```yaml
hooks:
  preToolUse:
    - matcher: "Bash*"
      hooks:
        - command: ./hooks/validate.sh
          shell: bash          # 可选，默认 bash
          timeout: 5000        # 可选，超时 ms
          if: "Bash(git *)"   # 可选，条件匹配
```

数据通过 **stdin JSON** 传入，脚本返回 exit code。

### prompt 类型（最灵活）

```yaml
hooks:
  PermissionRequest:
    - matcher: "Bash(rm *)"
      hooks:
        - prompt: |
            你是一个安全助手。评估以下命令是否安全：
            {{ctx.tool_name}}: {{ctx.tool_input.command}}

            返回 JSON：
            {"hookSpecificOutput":{"allow":true}}
            或
            {"hookSpecificOutput":{"allow":false,"reason":"..."}}
```

`{{ctx}}` 是内置变量，注入当前事件的上下文信息。prompt hook 能返回 **hookSpecificOutput**（结构化决策），而不只是 exit code。

### agent 类型

用于复杂场景——Hook 本身需要多步推理或调用多个工具时：

```yaml
hooks:
  PostToolUse:
    - matcher: "Bash(test*)"
      hooks:
        - agent:
            agentType: general-purpose
            allowed-tools: [Read, Grep]
            prompt: |
              分析以下测试输出，找出失败原因：
              {{ctx.tool_response}}
```

---

## 4. SKILL.md 中的 Hooks 声明

### 完整语法

```yaml
hooks:
  preToolUse:              # 小写，内部映射到 PreToolUse
    - matcher: "Bash*"
      hooks:
        - command: "echo '即将执行: ${TOOL_NAME}'"
          once: false      # 是否只执行一次
  postToolUse:
    - matcher: "Edit*"
      hooks:
        - command: "git diff"
  preCompact:              # 压缩前
  postCompact:             # 压缩后
```

### once 字段

```yaml
hooks:
  preToolUse:
    - matcher: "Bash(git commit*)"
      hooks:
        - command: ./hooks/commit-msg-check.sh
          once: true       # 执行一次后自动移除
```

`once: true` 的 hook 在执行一次后自动移除，常用于"第一次执行某操作时做一次检查"。

### 命名映射

SKILL.md 中用小写事件名（`preToolUse`），内部存储到 `settings.json` 时转成大写（`PreToolUse`）。

---

## 5. Hook 事件全景图（28 个事件）

### 🔧 工具执行类
- `PreToolUse` — 工具执行前（可修改参数、阻止执行）
- `PostToolUse` — 工具执行后（可修改结果）
- `PostToolUseFailure` — 工具执行失败
- `PermissionDenied` — 自动模式分类器拒绝工具调用

### 👤 用户交互类
- `UserPromptSubmit` — 用户提交 prompt 时（可阻止/修改）
- `PermissionRequest` — 权限对话框弹出时（hook 可决定授权）

### 🤖 Agent / 子任务类
- `SubagentStart` — 子 agent 启动时
- `SubagentStop` — 子 agent 结束前
- `TeammateIdle` — Teammate 进入空闲时
- `TaskCreated` — 任务创建时
- `TaskCompleted` — 任务完成时

### 📋 会话生命周期类
- `SessionStart` — 会话启动时
- `SessionEnd` — 会话结束时
- `PreCompact` — 上下文压缩前（可阻止压缩）
- `PostCompact` — 上下文压缩后
- `Stop` — Claude 结束响应前
- `StopFailure` — API 错误导致轮次结束时

### 🌐 MCP / 外部交互类
- `Elicitation` — MCP server 请求用户输入时
- `ElicitationResult` — 用户响应 MCP elicitation 后
- `Notification` — 通知发送时

### ⚙️ 系统配置类
- `ConfigChange` — 配置文件变更时
- `InstructionsLoaded` — CLAUDE.md 或规则文件加载时
- `CwdChanged` — 工作目录变更时
- `FileChanged` — 监控的文件变更时
- `WorktreeCreate` / `WorktreeRemove` — Git worktree 操作时
- `Setup` — Repo 初始化/维护时

---

## 6. 设计模式与最佳实践

### 模式 1：安全检查（PreToolUse + command）

```yaml
hooks:
  preToolUse:
    - matcher: "Bash(rm*)"
      hooks:
        - command: ./hooks/safety-check.sh
          timeout: 3000
```

### 模式 2：自动化权限决策（PermissionRequest + prompt）

```yaml
hooks:
  PermissionRequest:
    - matcher: "Bash(git push*)"
      hooks:
        - prompt: |
            评估以下 git push 是否安全：{{ctx.tool_input.command}}
```

### 模式 3：审计日志（PostToolUse + http）

```yaml
hooks:
  postToolUse:
    - matcher: "*"
      hooks:
        - http:
            url: https://audit.company.com/hooks
            method: POST
```

### 模式 4：一次性初始化（Setup + once）

```yaml
hooks:
  setup:
    - matcher: "init"
      hooks:
        - command: ./hooks/init-check.sh
          once: true
```

---

## 7. 关键源文件索引

| 文件 | 内容 |
|------|------|
| `src/utils/hooks/hooksConfigManager.ts` | Hook 事件元数据、groupHooksByEventAndMatcher、exit code 语义定义 |
| `src/utils/hooks/hooksSettings.ts` | Hook 配置加载、getAllHooks、sortMatchersByPriority、source 优先级 |
| `src/utils/hooks/hookEvents.ts` | Hook 执行事件系统（started/progress/response） |
| `src/utils/hooks/registerSkillHooks.ts` | Skill frontmatter hooks 注册 |
| `src/utils/hooks/sessionHooks.ts` | Session 级别 hooks 管理 |
| `src/utils/hooks/registerFrontmatterHooks.ts` | Agent frontmatter hooks 注册 |
| `src/utils/hooks/execPromptHook.ts` | prompt 类型 hook 执行 |
| `src/utils/hooks/execAgentHook.ts` | agent 类型 hook 执行 |
| `src/utils/hooks/execHttpHook.ts` | http 类型 hook 执行 |
| `src/utils/hooks/postSamplingHooks.ts` | sampling 后置 hook |

---

## 8. 待深入主题（下次继续）

- [ ] Hook 执行管道（hook 是如何被调用的，优先级、串链机制）
- [ ] HookContext 上下文对象（skillId、agentId、messages 等）
- [ ] Hooks 与权限系统交互
- [ ] 工具链拦截案例（BeforeToolsHook 修改工具参数）
- [ ] Hooks 组合与冲突处理（多个 Skill 声明同名 Hook 时的执行顺序）
- [ ] InstructionsLoaded / ConfigChange 详解
- [ ] SubagentStart / SubagentStop 详解
