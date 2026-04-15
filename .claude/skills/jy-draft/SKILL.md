---
name: jy-draft
description: "JianYing (剪映) draft AI agent planning skill. Use when starting a new jy-draft project, discussing technical approach, or designing the AI agent architecture. Invoked via /jy-draft."
---

# JY Draft

AI agent for creating JianYing (剪映) video drafts through natural language.

## Usage

```bash
/jy-draft
/jy-draft 开始一个新项目
/jy-draft 讨论技术方案
```

## Mode

This skill operates in **discussion mode** — the primary goal is to understand requirements and design a technical solution, not execute tasks.

## Current Status

**需求讨论已完成**，详细方案见 `sessions/current/plan.md`

## Workflow

```
启动讨论 → 理解需求 → 分析现有代码 → 讨论技术方案 → 确认方案
```

### Step 1: 理解需求

通过提问了解：

1. **用户场景**：谁会用这个工具？普通用户还是开发者？
2. **核心功能**：自然语言 → 剪映草稿 JSON，核心交互是什么？
3. **素材来源**：视频/音频/图片素材从哪里来？用户上传？URL？AI 生成？
4. **输出形式**：只生成 JSON？还是有配套桌面应用？
5. **与剪映的关系**：是生成草稿让用户在剪映打开，还是直接调用剪映 API？

### 已确认需求摘要

| 维度 | 决策 |
|------|------|
| 目标用户 | 外部用户/公开产品 |
| 桌面框架 | Electron + Vue 3 + TypeScript |
| 构建工具 | vite-electron |
| 状态管理 | Pinia |
| AI 模型 | MiniMax / GLM / bailian（全能力）|
| MCP | 与 Electron 打包，本地一体化 |
| 交互方式 | GUI + REPL 混合（增强 REPL） |
| 输出交付 | 保存本地文件 |
| 数据存储 | SQLite + LanceDB，云端同步预留 |
| 用户认证 | QQ扫码登录（后期） |
| 权限控制 | 敏感操作需确认 |
| 历史管理 | SQLite + 版本管理 |
| 素材管理 | 本地文件夹 `/yyyy-mm-dd/` |
| AI 视频 | 短视频分析 + 长视频分割 |
| Agent 系统 | 完整 Agent（多Agent+Task+规划） |
| 离线支持 | 必须在线 |

### Step 2: 分析现有代码

Reference 代码位于 `references/DMVideo/`：

**Backend (`references/DMVideo/backend/`)**
- `core/draft/` — 草稿核心逻辑
- `core/draft/populate/` — 时间线生成
- `pjy/` — 素材处理（视频、音频、文本、贴纸、关键帧）

**Frontend (`references/DMVideo/frontend/`)**
- Electron 桌面应用结构
- 与 backend 的通信方式

**API Docs (`references/DMVideo/docs/`)**
- 01-07 详细 API 文档

### Step 3: 讨论技术方案

结合 Claude Code 的 AI Agent 思想讨论：

1. **Agent 架构**
   - 单 Agent 还是多 Agent？
   - 如果是多 Agent，如何分工？
   - 参考 Claude Code：Orchestrator + Worker 模式

2. **Tool 设计**
   - 需要哪些 Tool？
   - Tool 的粒度如何划分？
   - 如何从自然语言映射到 Tool 调用？

3. **记忆与状态**
   - 会话状态如何管理？
   - 草稿 JSON 如何持久化？
   - 是否需要版本管理？

4. **上下文管理**
   - 如何处理长对话？
   - 剪映草稿 JSON 的结构是否需要全部放入上下文？

5. **桌面应用**
   - Tauri vs Electron vs 其他？
   - 前端需要哪些功能？

6. **API 调用**
   - 继续用 DMVideo backend API？
   - 还是直接生成 JSON 本地保存？

## Claude Code 架构参考

Claude Code 的关键设计思想：

| 概念 | 说明 |
|------|------|
| **Tool System** | 55+ 个 Tool，如 FileReadTool, BashTool, AgentTool |
| **QueryEngine** | 封装 API 调用，管理对话状态 |
| **Feature Flags** | 功能开关控制，灵活发布 |
| **REPL Screen** | 交互界面，处理用户输入 |
| **State Management** | AppState 集中管理状态 |
| **Permission System** | Tool 调用需要用户授权 |

## 讨论输出

每次讨论后，更新 `.claude/skills/jy-draft/sessions/current/plan.md`：

```markdown
# JY Draft 技术方案

## 需求理解
- 用户场景：
- 核心功能：
- 输出形式：

## 技术方案
### Agent 架构
### Tool 设计
### 状态管理
### 桌面应用

## 待确认问题
- [ ]

## 下一步
- [ ]
```

## 澄清问题模板

在讨论开始时，通过 AskUserQuestion 确认关键问题：

| 问题 | 选项 |
|------|------|
| 核心输出是什么？ | 仅 JSON 文件 / 完整桌面应用 |
| 素材来源？ | 用户上传 / URL / AI 生成 |
| 是否需要调用剪映 API？ | 是，通过 DMVideo backend / 否，本地生成 JSON |
| 目标用户？ | 普通用户 / 开发者 / 内部团队 |

## Core Rules

1. **讨论优先** — 先理解需求，再讨论方案
2. **结合现有代码** — 参考 DMVideo backend/frontend 实现
3. **参考 Claude Code** — 借鉴其 AI Agent 架构思想
4. **渐进式确认** — 每个关键决策点确认后再往下
5. **记录决策** — 所有重要决策写入 plan.md

## Notes

- 当前阶段不实现代码，只讨论和规划
- 所有讨论输出存储在 `.claude/skills/jy-draft/sessions/current/`
- 技术方案确认后，再进入下一个阶段（可能创建新的 skill）
