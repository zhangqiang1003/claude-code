# Session: Agent Loop 深度复习

- Level: 进阶（已掌握基础结构，今日深度复习）
- Started: 2026-04-23
- Status: in progress

## Concepts

### Group: 核心结构
1. 🔵 Loop 的基本结构（while + 终止条件）
2. ⬜ stop_reason 信号体系（end_turn / tool_use / max_tokens）
3. ⬜ Tool Call 在 Loop 中的位置（请求 → 执行 → 注入）

### Group: 状态管理
4. ⬜ messages 数组的演化（每轮如何增长）
5. ⬜ tool_result 的注入时机与格式

### Group: 边界与异常
6. ⬜ 无限循环防护（max_iterations / token budget）
7. ⬜ 并行 Tool Call 处理

## Misconceptions
（待记录）

## Learner Questions
（待记录）

## Spaced Review
- Loop 基本结构: due 2026-04-30
- stop_reason 体系: due 2026-04-30

## Log
- [2026-04-23] 会话开始，复习 Agentic Loop（档案显示 due 2026-04-24）
