# Session: SSE 流式传输错误处理
- Level: intermediate
- Started: 2026-04-24

## Concepts
### Group: 错误捕获机制
1. ✅ AsyncIterator 异常传播 (mastered)
2. ✅ try-catch 捕获流错误 (mastered)
3. ✅ 流中断检测（空流、不完整流）(mastered)

### Group: 错误分类与处理策略
4. ✅ 用户中断 vs 超时 vs 网络错误 (mastered)
5. ✅ 流式降级到非流式（fallback）(mastered)
6. ⬜ 重试机制（withRetry）

### Group: 可靠性保障
7. ⬜ 空闲超时看门狗（idle timeout watchdog）
8. ✅ 流完整性校验（message_start + content_block_stop + stop_reason）(mastered)
9. ⬜ 清理资源（stream cleanup）

## Misconceptions
- [try-catch 作用范围] 初期认为"只捕获 stream 迭代器的错误" → 源码验证后更正为"捕获整个 try 块内的所有错误（迭代器、循环体、循环后代码）"

## Learner Questions

## Spaced Review
- [AsyncIterator 异常传播] — 2026-05-01
- [流完整性校验逻辑] — 2026-05-01
- [用户中断 vs SDK 超时区分] — 2026-05-01
- [fallback 机制的权衡] — 2026-05-01

## Log
- [2026-04-24 00:00] Diagnosed: intermediate
- [2026-04-24 00:00] 已掌握：SSE 协议基础、Claude Code 流式响应格式、AsyncIterator 异常传播
- [2026-04-24 00:00] Concept 1: started
- [2026-04-24 00:10] Concept 1-3: mastered（错误捕获机制）
- [2026-04-24 00:15] Concept 4-5: mastered（错误分类与 fallback）
- [2026-04-24 00:20] Concept 8: mastered（流完整性校验）
- [2026-04-24 00:25] 综合练习通过：网络中断场景、SDK 超时场景
