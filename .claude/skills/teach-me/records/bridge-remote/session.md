# Session: Bridge / Remote

- Level: 初学者（无 Bridge/Remote 经验，但有 MCP 经验）
- Started: 2026-04-14
- Learning Material: claude-code 源码（src/bridge/）+ 文档

## Concepts

1. ✅ Bridge/Remote 概述（掌握）
   - Bridge = 远程控制 Claude Code
   - 两种形态：Anthropic 托管 vs 自托管 RCS
   - Claude Code 不知道自己被远程控制（透明转发）
   - 核心：RCS 作为消息中继
2. ✅ Remote Session 生命周期（掌握）
   - Claude Code 主动连接 RCS（WebSocket）
   - RCS 配对浏览器和 Claude Code
   - 双向消息传递：浏览器 ↔ RCS ↔ Claude Code
3. ✅ Bridge API 与协议（掌握）
   - 专有消息格式（不同于 MCP 的 JSON-RPC）
   - 消息类型：StdoutMessage、ToolResult、PermissionUpdate、SessionStatus
   - WebSocket 双向实时通信
4. ✅ 认证与权限（掌握）
   - 权限检查在 Claude Code 本地执行
   - RCS 转发权限确认消息到浏览器显示
   - 用户确认后 RCS 转发授权结果
5. ✅ Bridge vs MCP 对比（掌握）
   - MCP：工具级控制，开放标准
   - Bridge：应用级控制，专有协议
   - MCP 让 Claude 调用别的工具，Bridge 让用户控制 Claude
6. ✅ Self-hosted RCS（掌握）
   - Docker 容器部署
   - Web UI 控制面板
   - `bun run rcs` 启动

## Misconceptions

- （暂无）

## Learner Questions

- （暂无）

## Spaced Review

- [Bridge 6 子概念]: due 2026-04-21

## Log

- [2026-04-14] 诊断：零基础，但有 MCP 经验作为参考
- [2026-04-14] 6 个概念全部完成：概述、Session 生命周期、Bridge API、认证权限、Bridge vs MCP、自托管 RCS
