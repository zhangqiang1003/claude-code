# Session: MCP (Model Context Protocol)

- Level: 初学者（有 Tool Calling 经验 + OpenAI Plugin 经验 + Bash 经验）
- Started: 2026-04-13
- Completed: 2026-04-13（未完成，暂停于诊断阶段）
- Learning Material: claude-code MCP 源码 + MCP 官方协议规范

## Concepts

1. ✅ MCP 协议概述（掌握）
   - 协议目标：创建与模型无关的开放标准
   - Client-Server 双进程模型，JSON-RPC 2.0
   - Tools / Resources / Prompts 三类能力
   - initialize 握手：双向能力交换
2. ✅ MCP Server 工作机制（掌握）
   - stdio 为主要通信方式（子进程持久运行）
   - HTTP + SSE 为可选方式
   - 双向通信：双方都可主动发消息
   - sampling 能力：Server 可主动请求 Client
   - 配置存储在项目 .claude/mcp.json
3. ✅ Claude Code 的 MCPTool 实现（掌握）
   - fetchToolsForClient() 获取 MCP tools
   - 工具名格式：mcp__<serverName>__<toolName>
   - call() 通过 stdio JSON-RPC 发送 tools/call
   - checkPermissions() 返回 passthrough（权限继承）
4. ✅ MCP 工具发现流程（掌握）
   - tools/list 动态获取工具列表
   - resources/list 动态获取资源列表
   - notifications/toolListChanged 支持动态变更
5. ✅ MCP vs OpenAI Plugin 对比（掌握）
   - MCP 动态发现 vs Plugin 静态声明
   - MCP 双向通信 vs Plugin 单向请求-响应
   - MCP 子进程 stdio vs Plugin HTTP 接口
6. ✅ MCP Security Model（掌握）
   - 子进程权限等于 Claude Code 权限
   - 信任链基于用户手动添加
   - Server 配置可审计，工具调用经过权限检查

## Misconceptions

- （暂无）

## Learner Questions

- （暂无）

## Spaced Review

- （暂无）

## Log

- [2026-04-13] 诊断会话：用户有 Tool Calling 经验、OpenAI Plugin 经验（直接 API 调用）、Bash 调用经验；未接触过 Claude Code 的 /mcp 命令或 MCPTool 源码；MCP 概览介绍后，暂停学习
- [2026-04-14] 继续学习：
  - 概念 1 完成：MCP 协议概述（核心设计目标、Client-Server 模型、握手协议）
  - 概念 2 完成：MCP Server 工作机制（stdio 通信、双向消息流、sampling 能力、.claude/mcp.json 配置）
  - 概念 3 完成：Claude Code MCPTool 实现（fetchToolsForClient、mcp__ 前缀、call() 执行流程、passthrough 权限）
  - 概念 4 完成：MCP 工具发现流程（tools/list 动态发现、notifications/toolListChanged 动态变更）
  - 概念 5 完成：MCP vs OpenAI Plugin 对比（动态 vs 静态、双向 vs 单向、开放 vs 厂商私有）
  - 概念 6 完成：MCP Security Model（子进程权限等于 Claude Code、信任链基于用户添加、可审计可移除）
