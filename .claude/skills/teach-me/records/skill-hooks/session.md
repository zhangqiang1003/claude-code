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
3. ✅ Hook 执行管道（掌握，2026-04-20 更正）
   - **并行执行**（通过 all() 函数），不是串链
   - 优先级基于**来源**：localSettings > projectSettings > userSettings > pluginHook
   - exit code=2 阻止工具执行，但不阻止其他 Hook 继续运行
   - exit code=1 警告但继续执行，工具仍会执行
   - 源码：hooks.ts:2883 `for await (const result of all(hookPromises))`

### Group: Hooks 声明与实现
4. ✅ SKILL.md Hooks 声明（掌握）
   - frontmatter hooks 语法、matcher、once 字段
   - 小写事件名（preToolUse）→ settings.json 大写映射（PreToolUse）
5. ✅ hooks.ts 源码分析（掌握）
   - getMatchingHooks() (line 1741) 匹配 Hook
   - all() 函数并行执行（generators.ts:32）
   - exit code=2 阻止工具但不阻止其他 Hook
6. ✅ HookContext 上下文对象（掌握）
   - HookInput：session_id, transcript_path, cwd, permission_mode, agent_id, agent_type + 事件特定字段
   - HookResult：message, blockingError, outcome, permissionBehavior, updatedInput

### Group: 高级应用
7. ✅ Hooks 与权限系统交互（掌握）
   - Hook 返回 permissionBehavior: 'allow'/'deny'/'ask'/'passthrough' 控制权限
   - passthrough = 不干预，让正常权限系统决定
   - PermissionRequest Hook 是权限专用钩子
8. ✅ 工具链拦截案例（掌握）
   - function hook：快速精确，适合已知危险模式
   - prompt hook：灵活智能，适合复杂判断
   - 混合方案：PostToolUse 记录状态，PreToolUse 检查
9. ✅ Hooks 组合与冲突处理（掌握）
   - 优先级：localSettings > projectSettings > userSettings > pluginHook
   - exit code = 2 阻止一切
   - 多个 blocking 错误时取第一个作为主要错误

## Misconceptions

- ~~"Hook 按串链方式执行，A 阻止后 B/C 不执行"~~ → 实际是**并行执行**，exit code=2 阻止工具但不阻止其他 Hook
- 初期混淆：Prompt hook 让 LLM 授权自己 → LLM 既是运动员又是裁判，过于宽松 → 澄清：prompt hook 用于自动化决策，权限系统仍有 UI 兜底

## Learner Questions

- （暂无）

## Spaced Review

- [Hooks 概述 + 类型体系 + SKILL.md 声明]: due 2026-04-27
- [Hook 执行管道 + 源码分析]: due 2026-04-27
- [HookContext + 权限交互 + 工具链拦截 + 冲突处理]: due 2026-05-04

## Log

- [2026-04-14] 诊断：用户知道 Hooks 是生命周期扩展点，无具体类型使用经验
- [2026-04-14] 概念 1 完成：Hooks 概述（本质、exit code 机制、执行时机）
- [2026-04-14] 概念 2 完成：Hook 类型体系（command/prompt/agent/http/callback）
- [2026-04-14] 概念 4 完成：SKILL.md Hooks 声明（语法、matcher、once）
- [2026-04-14] 综合练习：团队 rm 命令安全确认设计 → PermissionRequest + prompt hook
- [2026-04-14] 文档已输出：learn-examples/docs/10-skill-hooks-deep-dive.md
- [2026-04-20] 概念 3 完成：Hook 执行管道（**更正**：并行执行，非串链；优先级基于来源，非 priority 字段）
- [2026-04-20] 概念 5 完成：hooks.ts 源码分析（getMatchingHooks、all() 并行执行、exit code 处理）
- [2026-04-20] 概念 6 完成：HookContext 上下文对象（HookInput + HookResult + ToolUseContext）
- [2026-04-20] 概念 7 完成：Hooks 与权限系统交互（permissionBehavior 四种值 + PermissionRequest Hook）
- [2026-04-20] 概念 8 完成：工具链拦截案例（function hook / prompt hook / 混合方案）
- [2026-04-20] 概念 9 完成：Hooks 组合与冲突处理（来源优先级 + exit code=2 阻止一切）
- [2026-04-20] 🎉 全部 9 个概念学习完成！
