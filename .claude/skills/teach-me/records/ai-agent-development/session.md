# Session: AI Agent Development

- Level: 初学者 → 进阶（全栈背景，基础 API 经验）
- Started: 2026-04-07
- Completed: 2026-04-07
- Learning Material: claude-code 逆向工程项目

## Concepts

1. ✅ LLM API 基础回顾（流式响应）— 理解了 yield 粒度是 content_block
9. ✅ 流式响应（SSE）— 实践完成：buffer 处理跨 chunk、delta 累积、实时输出
2. ✅ Tool/Function Calling 机制 — 理解了 ReAct 模式、needsFollowUp 信号
3. ✅ Agentic Loop（Thought → Action → Observation）— 理解了 while(true) 结构
4. ✅ 工具系统设计 — 实践完成：添加 getTimeTool
5. ✅ 多轮对话状态管理 — 实践完成：多轮 REPL 循环
6. ✅ Context 工程 — 实践完成：System Prompt 模块化 + Token 预算
7. ✅ 权限与安全机制 — 理解了沙箱隔离、权限模式
8. ✅ Multi-Agent 模式 — 理解了 Orchestrator-Worker 架构

## Practice Tasks

- [x] 添加 getTimeTool 到 learn-examples/01-minimal-agent.ts
- [x] 修改 callLLM 识别时间请求
- [x] 实现多轮 REPL 对话
- [x] 添加 System Prompt 模块化
- [x] 添加 Token 预算监控

## Misconceptions

- ~~"每个 delta 都 yield"~~ → 实际是每个 content_block 完成时 yield

## Key Learnings

1. **Agentic Loop 本质**：while(true) + needsFollowUp 信号
2. **状态管理**：messages 数组是 LLM 的"记忆"，每次都要完整发送
3. **Token 预算**：5 级压缩管道（Budget → Snip → Micro → Collapse → Auto）
4. **权限安全**：默认拒绝 + 沙箱隔离 + 规则引擎
5. **Multi-Agent**：Orchestrator 分配任务 → Worker 执行 → 结果合并

## Next Steps（可选进阶）

- [x] ~~接入真实 LLM API~~ ✅ 已完成
- [x] ~~流式响应~~ ✅ 已完成
- [x] ~~Memory 持久化~~ ✅ 已完成（JSONL + Compaction + 摘要）
- [ ] 更复杂的 Multi-Agent 协作

## Log

- [2026-04-07] 诊断完成：全栈背景，基础 API 经验，Agent 概念刚接触
- [2026-04-07] 概念 1-3 完成：流式响应、Tool Calling、Agentic Loop
- [2026-04-07] 实践：添加 getTimeTool
- [2026-04-07] 概念 4-5 完成：工具系统、多轮对话
- [2026-04-07] 概念 6 完成：Context 工程（System Prompt + Token 预算）
- [2026-04-07] 概念 7 完成：权限与安全机制
- [2026-04-07] 概念 8 完成：Multi-Agent 模式
- [2026-04-07] 🎉 全部 8 个核心概念学习完成！
- [2026-04-08] 概念 9 完成：流式响应（SSE 解析、delta 累积、实时输出）
- [2026-04-09] 概念 10 完成：Memory 持久化（JSONL 追加写入 + Compaction 压缩 + 摘要，参考 Claude Code 三层方案）

## Log

- [2026-04-07] 诊断完成：全栈背景，基础 API 经验，Agent 概念刚接触
- [2026-04-07] 概念 1-3 完成：流式响应、Tool Calling、Agentic Loop
- [2026-04-07] 实践：添加 getTimeTool
- [2026-04-07] 概念 4-5 完成：工具系统、多轮对话
- [2026-04-07] 概念 6 完成：Context 工程（System Prompt + Token 预算）
- [2026-04-07] 概念 7 完成：权限与安全机制
- [2026-04-07] 概念 8 完成：Multi-Agent 模式
- [2026-04-07] 🎉 全部 8 个核心概念学习完成！
