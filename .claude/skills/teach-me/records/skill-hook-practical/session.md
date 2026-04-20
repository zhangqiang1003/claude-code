# Session: Skill Hook 实战工作坊

- Level: 进阶（已完成理论学习）
- Started: 2026-04-20
- Learning Material: claude-code 源码 + 实际场景设计

## 场景清单

### Group: 安全防护
1. ✅ 拦截危险 Bash 命令（已实现）
   - 使用 command hook + if 条件过滤
   - rm -rf / 或 /home → exit 2（阻止）
   - git push --force → exit 1（警告）
   - curl | sh → exit 2（阻止 RCE）
   - 输出格式：简单用 exit code，详细用 JSON

### Group: 开发流程
2. ✅ 自动检查 commit 前的代码规范（已实现）
   - 使用 PreToolUse: Bash + command hook
   - 自动检测包管理器（bun/npm/yarn/pnpm）
   - 检测 --no-verify 绕过并阻止
   - lint + format:check + test 三合一检查

### Group: 业务逻辑
3. ⬜ 非工作时间敏感操作确认

## 实现进度

- [x] 场景 1：危险 Bash 命令拦截 ✅
- [x] 场景 2：commit 前代码检查 ✅
- [ ] 场景 3：非工作时间确认

## Log

- [2026-04-20] 开始实战工作坊：3 个真实场景设计
- [2026-04-20] 场景 1 完成：危险 Bash 命令拦截（command hook + if 过滤 + exit code）
- [2026-04-20] 场景 2 完成：commit 前代码检查（PreToolUse + 自动检测包管理器 + 检测 --no-verify）
