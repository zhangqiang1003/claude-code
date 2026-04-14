# Session: Skill Hooks 进阶

- Level: Hooks 初学者（有 Skill 系统基础，无 Hooks 经验）
- Started: 2026-04-14
- Learning Material: claude-code 源码（src/utils/hooks/）+ SKILL.md 规范

## Concepts

### Group: Hooks 基础架构
1. ✅ Hooks 概述（掌握）
   - Hook = 事件驱动的拦截器，通过 exit code 表达意图
   - exit code 0 = 放行，2 = 阻止，其他 = 警告但继续
   - 权限检查先于 hook 执行，hook 是额外的安全层
   - 28 个事件覆盖工具/Agent/会话/MCP/系统配置五大类
2. ✅ Hook 类型体系（5 种执行方式）（掌握）
   - command（脚本）、prompt（LLM 决策）、agent（子 agent）
   - http（API 请求）、callback（内部回调）
   - prompt hook 可返回 hookSpecificOutput 结构化决策
3. ⬜ Hook 执行管道（调用时机、优先级、串链机制）

### Group: Hooks 声明与实现
4. ✅ SKILL.md Hooks 声明（掌握）
   - frontmatter hooks 语法、matcher、once 字段
   - 小写事件名（preToolUse）→ settings.json 大写映射（PreToolUse）
5. ⬜ hooks.ts 源码分析
6. ⬜ HookContext 上下文对象

### Group: 高级应用
7. ⬜ Hooks 与权限系统交互
8. ⬜ 工具链拦截案例
9. ⬜ Hooks 组合与冲突处理

## Misconceptions

- 初期混淆：Prompt hook 让 LLM 授权自己 → LLM 既是运动员又是裁判，过于宽松 → 澄清：prompt hook 用于自动化决策，权限系统仍有 UI 兜底

## Learner Questions

- （暂无）

## Spaced Review

- [Hooks 概述 + 类型体系 + SKILL.md 声明]: due 2026-04-21

## Log

- [2026-04-14] 诊断：用户知道 Hooks 是生命周期扩展点，无具体类型使用经验
- [2026-04-14] 概念 1 完成：Hooks 概述（本质、exit code 机制、执行时机）
- [2026-04-14] 概念 2 完成：Hook 类型体系（command/prompt/agent/http/callback）
- [2026-04-14] 概念 4 完成：SKILL.md Hooks 声明（语法、matcher、once）
- [2026-04-14] 综合练习：团队 rm 命令安全确认设计 → PermissionRequest + prompt hook
- [2026-04-14] 文档已输出：learn-examples/docs/10-skill-hooks-deep-dive.md
