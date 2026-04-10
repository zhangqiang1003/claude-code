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
10. ✅ Memory 持久化 — 实践完成：JSONL + Compaction + 摘要
11. ✅ Human-in-the-Loop 权限系统 — 实践完成：三元决策 + 规则匹配 + 管道 + 交互提示 + 模式切换
12. ✅ Context Window 管理 & Compaction — 实践完成：Token 追踪 + 阈值触发 + LLM 摘要压缩 + 优先级保留

## Practice Tasks

- [x] 添加 getTimeTool 到 learn-examples/01-minimal-agent.ts
- [x] 修改 callLLM 识别时间请求
- [x] 实现多轮 REPL 对话
- [x] 添加 System Prompt 模块化
- [x] 添加 Token 预算监控
- [x] 为 04-multi-agent.ts 添加完整权限系统（6 个概念）
- [x] 为 04-multi-agent.ts 添加 Compaction 系统（Token 追踪 + 自动压缩 + /compact 命令）

## Misconceptions

- ~~"每个 delta 都 yield"~~ → 实际是每个 content_block 完成时 yield
- ~~"Always Allow 只在当前会话生效"~~ → 实际持久化到配置文件（.claude/settings.json），下次启动仍生效
- ~~"工具调用进队列，用户确认后出队执行"~~ → 实际用 await 同步阻塞（Promise 天然是"断点"）
- ~~"压缩就是截断删掉旧消息"~~ → 实际用 LLM 生成摘要替代旧消息（保留语义），Claude Code 更是用 4 层渐进管道

## Key Learnings

1. **Agentic Loop 本质**：while(true) + needsFollowUp 信号
2. **状态管理**：messages 数组是 LLM 的"记忆"，每次都要完整发送
3. **Token 预算**：5 级压缩管道（Budget → Snip → Micro → Collapse → Auto）
4. **权限安全**：默认拒绝 + 沙箱隔离 + 规则引擎
5. **Multi-Agent**：Orchestrator 分配任务 → Worker 执行 → 结果合并
6. **HITL 权限系统**：三元决策（allow/deny/ask）+ deny 优先管道 + 模式转换 + await 暂停
7. **Compaction**：渐进式 4 层管道（Microcompact → SessionMemory → Autocompact → Reactive），先轻后重，能省则省

## Next Steps（可选进阶）

- [x] ~~接入真实 LLM API~~ ✅ 已完成
- [x] ~~流式响应~~ ✅ 已完成
- [x] ~~Memory 持久化~~ ✅ 已完成（JSONL + Compaction + 摘要）
- [x] ~~Human-in-the-Loop 权限系统~~ ✅ 已完成
- [x] ~~Context Window 管理 & Compaction~~ ✅ 已完成
- [ ] MCP (Model Context Protocol) — Agent 能力热插拔

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
- [2026-04-10] 概念 11 完成：Human-in-the-Loop 权限系统（6 个子概念全部掌握 + 实践集成到 04-multi-agent.ts）
- [2026-04-10] 概念 12 完成：Context Window 管理 & Compaction（Token 追踪 + 阈值触发 + LLM 摘要 + 优先级保留 + Claude Code 4 层管道分析）
