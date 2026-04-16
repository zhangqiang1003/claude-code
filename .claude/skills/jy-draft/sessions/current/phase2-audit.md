# Phase 2 审计报告：Electron 应用骨架

> 基于 `DMVideo/frontend` 参考代码的交叉验证
> 审计时间：2026-04-16
> 审计范围：plan.md §2.1–§2.9 vs `references/DMVideo/frontend/` 实际代码

---

## 一、审计方法

对照三层信息源进行交叉验证：

| 层级 | 来源 | 描述 |
|------|------|------|
| **L1 需求** | plan.md Phase 2 + 已确认需求摘要 | 目标决策 |
| **L2 计划** | plan.md §2.1–§2.9 | 具体实施计划 |
| **L3 实际** | `references/DMVideo/frontend/` 代码 | 可复用的参考实现 |

审计维度：遗漏、不一致、错误、风险。

---

## 二、关键发现总览

| 编号 | 严重度 | 领域 | 问题摘要 |
|------|--------|------|----------|
| F1 | **P0** | 架构 | IPC 通道设计严重不足（计划 20 个 vs 实际 100+ 个） |
| F2 | **P0** | 架构 | MCP 传输协议不一致（计划 HTTP/SSE vs 实际 stdio） |
| F3 | **P0** | 架构 | 已有 MCP Server（数据访问层）未纳入计划 |
| F4 | **P1** | 目录结构 | 缺少 pipeline/、ffmpeg/、typings/ 目录 |
| F5 | **P1** | 核心模块 | 6 个 core/ 模块未列出（httpClient、draftApi、interceptor 等） |
| F6 | **P1** | 状态管理 | 缺少 config store 和 auth store |
| F7 | **P1** | 生命周期 | Python MCP Server 的启停管理未设计 |
| F8 | **P2** | 构建 | V8 字节码、环境配置、日志系统等未详细设计 |
| F9 | **P2** | 验证清单 | 部分验证项引用不存在的 IPC 通道 |
| F10 | **P2** | UI | Element Plus 依赖和自定义协议未提及 |

---

## 三、逐项详细分析

### 3.1 F1：IPC 通道设计严重不足（P0）

**计划定义**（§2.4）：~20 个 IPC 通道，分 5 类。

**实际 DMVideo**（`preload.ts`）：**100+ 个 IPC 通道**，分 17 个类别。

#### 遗漏类别清单

| 类别 | 实际通道数 | 计划覆盖 | 说明 |
|------|-----------|---------|------|
| 数据库操作（db:*） | 30+ | ❌ 完全遗漏 | 材料库/素材库/作品库/配置/音色克隆/初始化配置 |
| FFmpeg（ffmpeg:*） | 12 | ❌ 完全遗漏 | 视频信息、音频提取、分割、转码、截图 |
| 对话框（dialog:*） | 6 | ❌ 完全遗漏 | 文件选择、目录选择、保存、消息弹窗 |
| Token 计费（token:*） | 10+ | ❌ 完全遗漏 | 积分生成、扣减、查询 |
| OSS 存储（oss:*） | 8 | ❌ 完全遗漏 | 文件上传/删除/URL 获取 |
| Token 配置（token-config:*） | 8 | ❌ 完全遗漏 | API Key/STS 临时凭证管理 |
| 百炼 AI（bailian:*） | 10+ | ⚠️ 部分 | 计划只覆盖 chat，遗漏图像/视频分析 |
| 百炼语音（bailian-audio:*） | 12 | ⚠️ 部分 | 计划只覆盖 TTS/ASR，遗漏语音克隆/预设音色 |
| 视频匹配（video-match:*） | 6 | ❌ 完全遗漏 | 内容哈希、关键词匹配 |
| 视频分析（video-analysis:*） | 12+ | ⚠️ 部分 | 计划只覆盖 analyze，遗漏批量分析/进度回调 |
| 草稿 API（draft-api:*） | 30+ | ⚠️ 拟替代 | 计划用 MCP 替代，但过渡路径未设计 |
| 文生视频（text-to-video:*） | 7 | ❌ 完全遗漏 | 任务创建/启动/取消/进度 |
| 智能分割（smart-split:*） | 10+ | ❌ 完全遗漏 | 分析/执行/分类/异步批处理 |
| 微信登录（wechat-auth:*） | 4 | ❌ 遗漏 | Phase 2 可不需要，但架构应预留 |
| QQ 登录（qq-auth:*） | 4 | ❌ 遗漏 | 同上 |
| 飞书同步（feishu:*） | 7 | ❌ 遗漏 | 同上 |
| HTTP 客户端（http:*） | 8 | ❌ 完全遗漏 | 通用 HTTP 请求代理 |

#### 关键问题

**计划假设所有草稿操作通过 MCP 通道（`mcp:call-tool`）完成**，但 DMVideo 实际上将每个草稿 API 操作暴露为独立 IPC 通道（`draft-api:create-video-info`、`draft-api:modify-video-infos` 等）。

这带来一个架构决策：

- **方案 A**：保持计划设计，IPC 只暴露粗粒度 `mcp:call-tool`，渲染层自行构造 MCP 参数
- **方案 B**：像 DMVideo 一样，每个操作暴露独立 IPC 通道，主进程内部调用 MCP Client

**建议**：方案 A 更符合 JY Draft 的 Agent 架构。渲染层（REPL UI）只负责展示，Agent 运行在主进程中直接调用 MCP Client，不需要经过 IPC 中转。但 AI 调用的 chat/completion 通道仍需暴露给渲染层（用于 REPL 显示）。

### 3.2 F2：MCP 传输协议不一致（P0）

**计划**（§2.5 + §1.1 技术决策）：
```typescript
await this.client.connect({
  transport: 'sse',
  url: serverUrl,
  headers: { 'X-API-Key': apiKey }
});
```

**DMVideo 实际**（`mcp/index.ts` L454）：
```typescript
const transport = new StdioServerTransport();
await this.server.connect(transport);
```

#### 分析

1. DMVideo 使用 **stdio** 传输，因为它是一个 MCP **Server** 供外部 Claude Code 调用
2. JY Draft 的架构是 Electron 作为 MCP **Client** 连接 Python MCP Server
3. 对于 Electron ↔ Python 本地通信，两种方案各有利弊：

| 传输方式 | 优点 | 缺点 |
|---------|------|------|
| **stdio** | 低延迟、简单可靠 | 需要管理 Python 子进程的 stdin/stdout |
| **HTTP/SSE** | 支持远程部署、跨网络 | 需要端口管理、CORS 配置 |

**建议**：Phase 2 应同时支持 stdio 和 HTTP/SSE：
- 默认 stdio（Electron 直接 spawn Python MCP Server，通过管道通信）
- 可选 HTTP/SSE（用于远程部署或调试场景）
- 参考现有 Python 后端启动逻辑（`main.ts` L268-326）适配 MCP Server

### 3.3 F3：已有 MCP Server 未纳入计划（P0）

**DMVideo 已有**：`src/main/mcp/index.ts` — 一个完整的 MCP **Server**（22 个工具），基于 stdio 传输。

**工具清单**：

| 类别 | 工具 |
|------|------|
| 材料库-文案 | add_material_text, get_material_text_list, delete_material_text |
| 材料库-视频 | add_material_video, get_material_video_list, delete_material_video |
| 材料库-作品地址 | add_material_url, get_material_url_list, delete_material_url |
| 素材库-文案 | add_draft_text, get_draft_text_list, delete_draft_text |
| 素材库-视频 | add_draft_video, get_draft_video_list, update_draft_video_analysis, delete_draft_video |
| 作品库 | add_work, get_work_list, update_work_stats, delete_work |
| 配置 | get_config, set_config, get_all_configs |

**关键问题**：这个 MCP Server 暴露的是 **SQLite 数据访问层**（通过 `this.db.*` 直接调用数据库方法），不是草稿生成层。

**架构影响**：

```
JY Draft 需要「两个」MCP Server/能力：

1. MCP Server A（数据访问）— 复用 DMVideo 已有的，供外部 Claude Code 调用
   - 素材 CRUD
   - 配置管理

2. MCP Server B（草稿生成）— Phase 1 新建的 Python MCP Server
   - 草稿创建/保存/导出
   - 素材片段操作
   - 时间线生成
```

**建议**：Phase 2 应明确保留现有 Node.js MCP Server（数据访问），同时新增 MCP Client 连接 Python MCP Server（草稿生成）。或者将两者合并为一个 Python MCP Server。

### 3.4 F4：目录结构遗漏（P1）

**计划遗漏的目录/文件**：

| 遗漏项 | 路径 | 重要性 | 说明 |
|--------|------|--------|------|
| pipeline/ | `src/main/pipeline/` | 高 | 步骤编排系统（TTS→ASR→匹配→草稿→审核→生成） |
| ffmpeg/ | `src/main/ffmpeg/` | 高 | 视频处理（提取/分割/转码/截图） |
| typings/ | `src/main/typings/` | 高 | draftApi.ts 的类型定义（镜像 Python schemas.py） |
| scripts/ | `scripts/` | 中 | build.js、dev-server.js、build-all.js |
| .env.* | 根目录 | 中 | 环境变量配置文件 |
| renderer/package.json | `src/renderer/package.json` | 低 | DMVideo 有独立的渲染进程 package.json |

**同时，计划有冗余设计**：

```
计划：
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── mcp/
│       └── client.ts        ← 冗余？与 src/main/mcp/ 重复
├── src/
│   ├── main/
│   │   ├── index.ts          ← 为什么不是 main.ts？
│   │   ├── mcp/
│   │   │   └── client.ts     ← 又一个 MCP client？
```

**建议**：采用 DMVideo 的扁平结构，不创建顶层 `electron/` 目录。所有主进程代码在 `src/main/`。

### 3.5 F5：core/ 模块遗漏（P1）

**计划列出 6 个模块**，实际 `core/` 有 **20 个文件**：

| 文件 | 计划是否列出 | 用途 | Phase 2 是否需要 |
|------|-------------|------|-----------------|
| bailian.ts | ✅ | 百炼 AI 文本/视觉 | 是 |
| bailianAudio.ts | ✅ | 百炼 TTS/ASR | 是 |
| videoAnalysis.ts | ✅ | 视频分析 | 是 |
| videoMatch.ts | ✅ | 关键词匹配 | 是 |
| oss.ts | ✅ | OSS 上传 | 是 |
| pipeline/ | ✅ | 步骤编排 | 是 |
| **httpClient.ts** | ❌ | Axios HTTP 客户端 | **是** — draftApi.ts 的基础 |
| **draftApi.ts** | ❌ | 草稿 API HTTP 调用 | **可能** — MCP 替代后作为降级方案 |
| **tokenAesCrypto.ts** | ❌ | AES 加解密 | **是** — config 表加密存储依赖 |
| **interceptor.ts** | ❌ | DB 字段加密拦截 | **是** — database/index.ts 导入 |
| **crypto.ts** | ❌ | 通用加密工具 | **是** — interceptor.ts 依赖 |
| **tokenApi.ts** | ❌ | 积分计费 API | 可能 |
| **tokenConfig.ts** | ❌ | API Key/STS 管理 | **是** — bailian.ts 需要 API Key |
| **clientIdentity.ts** | ❌ | 客户端标识 | 可能 |
| **feishuBitable.ts** | ❌ | 飞书多维表格 | 后期 |
| **wechatAuth.ts** | ❌ | 微信登录 | 后期 |
| **qqAuth.ts** | ❌ | QQ 登录 | 后期 |
| **clientInfo.ts** | ❌ | 客户端信息 | 后期 |
| **place.json** | ❌ | 省市区数据 | 可能 |
| **debug.ts** | ❌ | 调试工具 | 可能 |

**关键遗漏**：`httpClient.ts`、`tokenAesCrypto.ts`、`interceptor.ts`、`crypto.ts`、`tokenConfig.ts` 这 5 个是核心依赖链：

```
database/index.ts → imports { encryptionInterceptor } from '../core'
encryptionInterceptor → imports from crypto.ts + tokenAesCrypto.ts
bailianUtil → imports apiKey from tokenConfig.ts
httpClient → used by draftApi.ts, tokenApi.ts, etc.
```

如果跳过这些模块，`database/index.ts` 的复用就无法实现。

### 3.6 F6：Pinia Store 设计遗漏（P1）

**计划定义 3 个 store**：
- `conversation.ts` — REPL 对话历史（新增，正确）
- `draft.ts` — 草稿状态（新增）
- `material.ts` — 素材状态（新增）

**DMVideo 已有 2 个 store**：
- `config.ts` — 配置管理（视频路径、API 设置等）
- `auth.ts` — 认证状态

**遗漏分析**：

1. **config store**：DMVideo 的配置 store 在应用启动时从 SQLite 加载配置（`getAllConfigs()`），Pinia 管理运行时状态。JY Draft 至少需要 `video_root_path`、`jianying_draft_path` 等配置。如果不在 store 中管理，每次读取配置都需要 IPC 调用。

2. **auth store**：虽然 QQ 扫码登录是后期需求，但 store 的基础结构（token 管理、登录状态）应在 Phase 2 就设计好，否则后期改动较大。

**建议补充**：
- `config.ts` — 从 SQLite 同步配置到 Pinia
- `auth.ts` — 预留登录状态（Phase 2 可为空实现）

### 3.7 F7：Python MCP Server 生命周期管理（P1）

**DMVideo 的 Python 后端管理**（`main.ts` L268-326）：
- 生产环境自动 spawn Python 进程（exe 优先，py 脚本次之）
- Windows 上使用 `taskkill /f /t` 强制终止进程树
- 在 5 个退出事件中清理：`window-all-closed`、`before-quit`、`will-quit`、`process.exit`、`SIGINT/SIGTERM`

**计划缺失**：没有描述如何管理 Phase 1 的 Python MCP Server 进程。

**需要设计**：
1. Python MCP Server 的启动方式（exe / python script / 嵌入式）
2. stdio 模式下，Electron 作为 parent process 管理 Python 子进程
3. HTTP/SSE 模式下，需要端口发现和健康检查
4. 异常恢复（Python 进程崩溃后自动重启？）
5. 优雅退出（等待进行中的 MCP 调用完成）

### 3.8 F8：构建系统与基础设施（P2）

**遗漏的基础设施**：

| 项目 | DMVideo 实现 | 计划覆盖 |
|------|-------------|---------|
| 日志系统 | 按日期分割日志文件，级别过滤，渲染层日志转发 | ❌ 未提及 |
| 环境配置 | `.env.development` / `.env.production` | ❌ 未提及 |
| V8 字节码 | bytenode 编译主进程代码 | ❌ 仅验证清单提到 |
| 自定义协议 | `local-video://` 用于本地视频播放 | ❌ 未提及 |
| CSP 安全头 | `script-src 'self'; media-src 'self' local-video: blob: data:` | ❌ 未提及 |
| 硬件加速 | `app.disableHardwareAcceleration()` 解决 Windows GPU 崩溃 | ❌ 未提及 |
| 窗口闪烁 | `show: false` + `ready-to-show` 模式 | ❌ 未提及 |
| DevTools | 开发模式自动打开，生产模式禁用 | ❌ 未提及 |

**日志系统**尤其重要——Agent 运行时的大量调试信息需要持久化记录。

### 3.9 F9：验证清单问题（P2）

| 编号 | 问题 | 修正建议 |
|------|------|---------|
| P2.3 | "调用 `list_filter_presets`" — 这是 Phase 1 的 MCP Tool，不在 Phase 2 IPC 设计中 | 改为调用 `mcp:list-tools` 后验证列表包含 `list_filter_presets` |
| P5.2 | "调用 `add_videos` 通过 MCP" — 但 IPC 只有 `draft:create/save/generate/list` | 补充 `draft:add-videos` IPC 或明确走 `mcp:call-tool` |
| P6.3 | "草稿预览卡片" — DraftCard.vue 无设计规范 | 补充卡片内容规范（轨道数、时长、分辨率等） |
| P3.1-P3.4 | Bailian AI 需要先配置 API Key 才能测试 | 补充 API Key 配置验证步骤 |

### 3.10 F10：UI 框架依赖（P2）

**DMVideo 使用 Element Plus**（`element-plus: ^2.8.8`）：
- `el-container`, `el-aside`, `el-header`, `el-main`
- `el-menu`, `el-tabs`, `el-table`, `el-form`
- `el-input`, `el-select`, `el-slider`, `el-button`
- `el-dialog`, `el-card`, `el-tag`, `el-progress`
- 中文本地化（`zhCn`）

**计划未提及 Element Plus**，但保留的 Vue 视图代码依赖它。

**建议**：明确 UI 框架选择：
- 如果保留 Element Plus → 需要在 REPL 组件中也使用（保持一致性）
- 如果 REPL 使用独立 UI 库 → 需要处理样式冲突

---

## 四、架构决策建议

基于以上发现，建议 Phase 2 进行以下架构调整：

### 4.1 双 MCP 架构

```
Electron Main Process
├── MCP Server (Node.js, stdio)  ← 复用 DMVideo 已有的，外部 Claude Code 可调用
│   └── 工具：素材CRUD / 配置管理 / 作品管理
│
├── MCP Client (Node.js → Python)
│   ├── stdio 模式（默认）：spawn Python 子进程
│   └── HTTP/SSE 模式（可选）：远程连接
│   └── 连接到：Phase 1 Python MCP Server
│       └── 工具：草稿生成 / 素材片段 / 时间线 / 特效
│
└── IPC Bridge → Renderer (Vue REPL)
```

### 4.2 精简 IPC 设计

**建议 IPC 通道分类**：

```typescript
// 1. REPL 对话（渲染层 ↔ 主进程）
'repl:send-message': (message: string) => Promise<AssistantResponse>
'repl:stream-response': (callback) => void  // SSE-like 推送
'repl:get-history': () => Promise<Message[]>

// 2. AI 能力（主进程直接调用，不暴露给渲染层）
//    Agent 在主进程中直接调用 bailian / MCP Client

// 3. 配置管理
'config:get': (key: string) => Promise<string | null>
'config:set': (key: string, value: string) => Promise<void>
'config:get-all': () => Promise<Record<string, string>>

// 4. 素材管理（主进程 → SQLite）
'material:add': (type: string, data: any) => Promise<any>
'material:list': (type: string, filter?: any) => Promise<any[]>
'material:delete': (type: string, ids: number[]) => Promise<void>

// 5. 对话框
'dialog:open-directory': () => Promise<string | null>
'dialog:open-file': (filters?: any) => Promise<string[] | null>

// 6. 窗口管理
'window:minimize': () => void
'window:maximize': () => void
'window:close': () => void

// 7. FFmpeg（Phase 2 后期）
'ffmpeg:get-video-info': (filePath: string) => Promise<VideoInfo>
'ffmpeg:extract-audio': (videoPath: string) => Promise<string>

// 8. 事件推送（主进程 → 渲染层）
'on:agent-progress': (callback) => void
'on:tool-call': (callback) => void
'on:draft-updated': (callback) => void
```

关键变化：
- **减少 IPC 通道数量**（20→30 个，而非 100+ 个）
- **草稿操作不经过 IPC**，Agent 在主进程直接调用 MCP Client
- **渲染层只负责展示和用户输入**，不直接操控草稿

### 4.3 修正后的目录结构

```
jy-draft/
├── src/
│   ├── main/                         # Electron 主进程
│   │   ├── main.ts                   # 入口（Electron 窗口 + 进程管理）
│   │   ├── preload.ts                # 安全 API 桥接
│   │   ├── core/                     # 【复用 DMVideo】AI + 基础能力
│   │   │   ├── index.ts              # 统一导出
│   │   │   ├── httpClient.ts         # HTTP 客户端（Axios 封装）
│   │   │   ├── bailian.ts            # 百炼 AI
│   │   │   ├── bailianAudio.ts       # 百炼语音
│   │   │   ├── videoAnalysis.ts      # 视频分析
│   │   │   ├── videoMatch.ts         # 视频匹配
│   │   │   ├── oss.ts               # OSS 上传
│   │   │   ├── tokenAesCrypto.ts     # AES 加解密
│   │   │   ├── interceptor.ts        # DB 加密拦截
│   │   │   ├── crypto.ts            # 通用加密
│   │   │   ├── tokenConfig.ts        # API Key 管理
│   │   │   └── debug.ts             # 调试工具
│   │   ├── database/                 # 【复用 DMVideo】SQLite
│   │   │   └── index.ts             # 表结构 + CRUD
│   │   ├── pipeline/                 # 【复用 DMVideo】步骤编排
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   └── steps/               # 各 Pipeline 步骤
│   │   ├── ffmpeg/                   # 【复用 DMVideo】视频处理
│   │   │   └── index.ts
│   │   ├── mcp/
│   │   │   ├── server.ts            # MCP Server（数据访问，复用 DMVideo）
│   │   │   └── client.ts            # MCP Client（草稿生成，连接 Phase 1）
│   │   ├── agent/                    # 【新增】AI Agent 核心
│   │   │   ├── index.ts             # Agent 编排器
│   │   │   ├── queryEngine.ts       # 对话管理
│   │   │   └── context.ts           # 上下文构建
│   │   ├── ipc/                      # IPC 通道
│   │   │   └── index.ts             # 注册所有 IPC handler
│   │   └── typings/                  # 类型定义
│   │       └── draftApi.ts           # 草稿 API 类型（镜像 Python schemas）
│   └── renderer/                     # Vue 渲染进程
│       ├── index.html
│       ├── src/
│       │   ├── App.vue
│       │   ├── main.ts
│       │   ├── router/
│       │   │   └── index.ts
│       │   ├── stores/               # Pinia
│       │   │   ├── conversation.ts   # REPL 对话
│       │   │   ├── config.ts         # 应用配置
│       │   │   └── draft.ts          # 草稿状态
│       │   ├── views/
│       │   │   └── REPL.vue          # 主视图（REPL 界面）
│       │   └── components/
│       │       ├── layout/
│       │       │   └── MainLayout.vue
│       │       ├── repl/
│       │       │   ├── ChatWindow.vue
│       │       │   ├── MessageList.vue
│       │       │   ├── MessageItem.vue
│       │       │   └── PromptInput.vue
│       │       └── draft/
│       │           └── DraftCard.vue
│       └── package.json
├── scripts/                          # 构建脚本
│   ├── build.js
│   ├── build-all.js
│   └── dev-server.js
├── .env.development
├── .env.production
├── package.json
└── vite.config.ts
```

---

## 五、修正后的实施步骤

基于以上发现，建议调整 §2.7 的实施步骤：

| 步骤 | 内容 | 调整说明 |
|------|------|---------|
| 1 | 初始化 vite-electron 项目 | 采用 DMVideo 实际目录结构，不用顶层 `electron/` |
| 2 | 集成 core 模块（20 个文件） | **扩展**：包含 httpClient、crypto、interceptor、tokenConfig 等 |
| 3 | 集成 database 模块 | 不变 |
| 4 | 集成 ffmpeg 模块 | **新增** |
| 5 | 集成 pipeline 模块 | **新增**（从 DMVideo 复制步骤编排框架） |
| 6 | 集成 typings 模块 | **新增**（draftApi.ts 类型定义） |
| 7 | 实现 MCP Server（数据访问） | **新增**（复用 DMVideo mcp/index.ts） |
| 8 | 实现 MCP Client（草稿生成） | 调整为 stdio 优先 + HTTP/SSE 可选 |
| 9 | 实现 Agent 核心 | **新增**（查询引擎、上下文构建、工具调用编排） |
| 10 | 实现 IPC 通道层 | 重新设计，精简为 ~30 个通道 |
| 11 | 实现 Electron 主进程入口 | 包含 Python 进程管理、日志、环境配置 |
| 12 | 搭建 REPL UI | 补充 Element Plus 依赖 |
| 13 | 实现 Pinia Store | 补充 config store |
| 14 | 集成测试 | 修正验证清单 |

---

## 六、风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| MCP 传输协议选择不当导致架构返工 | 中 | 高 | 同时支持 stdio 和 HTTP/SSE |
| core 模块依赖链断裂导致复用失败 | 高 | 高 | 先跑通 database/index.ts 的导入测试 |
| Python 进程管理跨平台兼容性 | 中 | 中 | 复用 DMVideo 已有的进程管理代码 |
| REPL UI 复杂度超预期 | 低 | 低 | 先实现基础对话，迭代增强 |
| Agent 核心设计延迟 | 中 | 高 | Phase 2 先实现框架，Phase 3 填充逻辑 |

---

## 七、与 Phase 1 审计的关联

Phase 1 审计（`phase1-audit.md`）的以下发现与 Phase 2 直接相关：

1. **Phase 1 修正后 34 个 Tool**：Phase 2 的 MCP Client 需要支持所有 34 个 Tool 的调用
2. **流程断裂问题**（Phase 1 §3.1）：Phase 2 的 Agent 需要处理效果生成→添加到草稿的合并调用
3. **草稿状态读取缺失**（Phase 1 §3.2）：Phase 2 需要设计草稿状态的缓存和展示机制
4. **参数描述不充分**（Phase 1 §4）：Phase 2 的 `typings/draftApi.ts` 需要与 Python schemas.py 完全对应
