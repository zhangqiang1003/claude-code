# JY Draft 技术方案

> 更新时间：2026-04-15

## 需求理解

### 用户场景
- 用户通过自然语言描述想要的视频内容
- 用户本地上传视频/音频/图片素材
- AI Agent 自动编排素材，生成剪映草稿 JSON
- 用户可在剪映中打开编辑，或通过 MCP 调用剪映能力

### 核心功能
1. **自然语言交互** — 用户描述视频需求
2. **本地素材管理** — 用户上传/选择本地素材（Windows本地路径如 `E:\device.png`）
3. **AI 编排** — Agent 理解意图，调用 Tools 生成草稿
4. **剪映集成** — 通过 MCP 调用剪映能力

### 核心功能范围（Phase 1）
- ✅ 视频素材添加
- ✅ 音频素材添加
- ✅ 文本/字幕添加
- ✅ 贴纸、特效、滤镜、关键帧
- ✅ TTS 语音合成（bailian，已对接）
- ✅ 语音识别（bailian，用于语音指令和字幕生成）

### AI 视频理解能力
1. **短视频分析（2-10s）** → AI 提取文本 → 用于匹配视频素材
2. **长视频分析（几分钟~几十分钟）** → AI 分析 → 智能分割成短素材片段
3. **分割存储方案**：
   - 切割成独立文件
   - 存放路径：`原视频目录/smaterSplit/<yyyy-mm-dd>/`
   - 命名规则：`源文件名_<xxxx序号>.后缀`（序号4位，不足补0）
4. **向量数据库用途**：
   - 视频文本 → 素材检索
   - 自然语言 → 语义搜索素材

### 素材存储
- 用户创建本地文件夹
- 按业务分子文件夹：`/<yyyy-mm-dd>/` 存放素材（视频、图片、音频）
- 后期可扩展云端同步

### 用户认证
- 现阶段：QQ 扫码登录
- 后端已上线，有完整参考代码
- 后期实现时提供对接文档

### 权限控制
- 敏感操作需用户确认
- 支持记住授权/拒绝

### 技术约束
- 桌面应用：Electron
- 后端调用：MCP（Model Context Protocol）
- 后端改造：DMVideo backend → MCP Server

### GUI 界面功能
- 草稿列表 + 素材管理
- AI 对话（增强 REPL）
- 预览窗口 + 时间线编辑
- 特效面板 + 多轨编辑

### 草稿 JSON 结构
- 分层支持：核心字段必填，高级字段可选

### 数据备份
- 手动备份：用户手动导出/导入 JSON
- 后期可扩展云端备份

### SQLite 数据存储（完整）
- 草稿完整数据（JSON + 元数据）
- 素材索引信息
- AI 分析结果（视频文本、分割片段信息）
- 版本历史

### AI 模型能力（全能力）
- 对话（Chat Completion）
- 视觉（Vision - 图片/视频理解）
- 语音（语音识别）
- Embedding（向量检索）

### Agent 系统
- 完整 Agent 系统
- 多 Agent 协作（Orchestrator + Worker）
- Task/SubAgent 任务管理
- 规划模式（Plan Mode）

### 离线支持
- 必须在线（所有功能需要网络连接）

---

## 技术架构

### 整体架构（参考 Claude Code）

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron App                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   REPL UI   │  │   State     │  │   Permission        │ │
│  │  (交互界面)  │  │  Management │  │   System           │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │             │
│  ┌──────┴────────────────┴─────────────────────┴──────────┐ │
│  │                    QueryEngine                          │ │
│  │              (对话管理 + Tool 调用编排)                  │ │
│  └──────┬────────────────────────────────────────┬────────┘ │
│         │                                        │           │
│  ┌──────┴──────┐                          ┌───────┴────────┐ │
│  │   Tools    │                          │   MCP Client  │ │
│  │  (本地操作) │                          │               │ │
│  └────────────┘                          └───────┬────────┘ │
│                                                   │           │
└───────────────────────────────────────────────────┼───────────┘
                                                    │
                                            ┌───────┴────────┐
                                            │   MCP Server   │
                                            │ (DMVideo改造)  │
                                            └───────┬────────┘
                                                    │
                                            ┌───────┴────────┐
                                            │ 剪映草稿生成   │
                                            │ (JSON输出)     │
                                            └───────────────┘
```

### 核心模块

#### 1. MCP Server（DMVideo Backend 改造）

**改造内容**：
- 将 DMVideo backend API 封装为 MCP Tools
- 支持：create_draft, add_videos, add_audios, add_texts, add_stickers, save_draft 等
- 素材来源：本地文件路径 → 上传到可访问地址 或 本地路径直接引用

**MCP Tools 设计**：
```typescript
// 草稿管理
create_draft(width: number, height: number): draft_id
save_draft(draft_id: string): draft_url

// 素材添加
add_videos(draft_id: string, video_infos: VideoInfo[]): void
add_audios(draft_id: string, audio_infos: AudioInfo[]): void
add_texts(draft_id: string, text_infos: TextInfo[]): void
add_stickers(draft_id: string, sticker_infos: StickerInfo[]): void

// 特效与滤镜
add_video_effects(draft_id: string, effect_ids: string[][]): void
add_video_filters(draft_id: string, filter_ids: string[][]): void
add_keyframes(draft_id: string, keyframe_ids: string[][]): void

// 音频特效
add_audio_effects(draft_id: string, effect_ids: string[][]): void
add_audio_keyframes(draft_id: string, keyframe_ids: string[][]): void
```

#### 2. Electron 桌面应用

**前端（Renderer）**：
- Vue 3 + TypeScript
- REPL 风格交互界面（参考 Claude Code 的交互体验）
- 素材管理面板（上传、预览、管理本地素材）
- 草稿预览/编辑
- 多语言支持（i18n）

**后端（Main）**：
- MCP Client 连接
- 文件系统操作（读取本地素材）
- Electron IPC 通信

#### 3. QueryEngine（参考 Claude Code）

**职责**：
- 管理对话状态
- 解析用户意图
- 编排 Tool 调用顺序
- 处理 Tool 结果，返回给用户

#### 4. Tool System

**本地 Tools（MCP Client 调用）**：
```typescript
// 素材相关
upload_local_material(path: string): material_url
list_local_materials(): Material[]

// AI 素材生成（bailian 平台）
tts_generate(text: string, voice?: string): AudioResult  // TTS 语音合成
speech_recognize(audio_path: string): string             // 语音识别

// 草稿相关
create_draft(config: DraftConfig): draft_id
save_draft(draft_id: string): draft_url

// 状态相关
get_draft_state(draft_id: string): DraftState
update_draft_state(draft_id: string, state: Partial<DraftState>): void
```

**MCP Tools（通过 MCP 调用 DMVideo）**：
- 所有 DMVideo backend API 对应的 Tool

#### 5. State Management

**结构**：
```typescript
interface JYAppState {
  currentDraft: DraftState | null;
  materials: Material[];
  conversation: Message[];
  permissions: PermissionState;
  mcpConnections: MCPConnection[];
}
```

**持久化**：
- 会话状态存储在 `~/.jy-draft/sessions/`
- 草稿 JSON 存储在 `~/.jy-draft/drafts/`

#### 6. Permission System

参考 Claude Code 的 Tool 权限机制：
- 敏感操作（如文件上传、网络请求）需要用户确认
- 支持记住授权/拒绝

---

## 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 桌面框架 | Electron | 用户偏好 |
| 前端框架 | Vue 3 + TypeScript | 用户偏好 |
| MCP SDK | @modelcontextprotocol/sdk | 官方 SDK |
| AI 模型 | MiniMax / GLM / bailian | 用户偏好优先支持 MiniMax 和 GLM |
| 构建工具 | vite-electron | Vite + Electron 现代化开发体验 |
| 状态管理 | Pinia | Vue 官方推荐，TS 支持好 |
| TTS | bailian | 已对接，参考 `references/DMVideo/frontend/src/main/core/bailianAudio.ts` |
| i18n | vue-i18n | 多语言支持（中文 + 英文）|
| 向量数据库 | LanceDB | Electron 友好，本地向量存储 |
| 数据库 | SQLite | 本地草稿管理、版本历史 |

---

## 开发阶段划分

### Phase 1：MCP Server 改造

> **重要**：基于 `references/DMVideo/backend` 已有业务代码进行开发与增强

#### 1.1 技术决策

| 问题 | 决策 |
|------|------|
| 通信方式 | HTTP/SSE（支持独立部署） |
| 认证方式 | API Key（缓存认证，10分钟有效） |
| 素材路径校验 | 客户端（Electron）校验，MCP Server 不校验 |
| 素材元数据获取 | 客户端处理，MCP Server 不处理 |
| 特效/滤镜预设 | 复用 `pjy/metadata/` 已有预设 |
| 多租户 | 不支持，每客户端独立 MCP Server |
| output_folder | 客户端配置 |

#### 1.2 改造目录结构

```
references/DMVideo/backend/
├── core/
│   ├── api/              # 现有 HTTP API（保持不变）
│   ├── draft/           # 现有草稿逻辑（保持不变）
│   ├── mcp/             # 【新增】MCP 层
│   │   ├── __init__.py
│   │   ├── server.py    # MCP Server 主类
│   │   ├── tools.py     # MCP Tool 定义
│   │   ├── auth.py      # API Key 认证（缓存机制）
│   │   └── handlers/    # Tool 处理器
│   │       ├── __init__.py
│   │       ├── draft.py     # 草稿管理
│   │       ├── material.py  # 素材操作
│   │       ├── effect.py    # 特效/滤镜
│   │       └── preset.py    # 预设查询
│   └── ...
├── pjy/
│   └── metadata/        # 现有预设元数据（复用）
│       ├── filter_meta.py
│       ├── video_scene_effect.py
│       ├── transition_meta.py
│       └── ...
└── ...
```

#### 1.3 MCP Tool 接口设计

```typescript
// ==================== 草稿管理 ====================
create_draft(width: number, height: number): { draft_id, message }
save_draft(draft_id: string, client_id?: number): { draft_id, draft_url, message }
delete_draft(draft_id: string): { code, message }
get_template(draft_id: string): { template_data }
generate_jianying_draft(draft_id: string, output_folder: string, draft_name?: string, fps?: number): { folder_path, draft_content }

// ==================== 素材操作 ====================
add_videos(draft_id: string, video_infos: VideoInfo[], mute?: boolean, track_name?: string): { code, message }
add_audios(draft_id: string, audio_infos: AudioInfo[], mute?: boolean, track_name?: string): { code, message }
add_texts(draft_id: string, text_infos: TextInfo[], track_name?: string): { code, message }

// ==================== 素材信息创建 ====================
create_video_info(material_url: string, options?: VideoOptions): VideoInfo
create_audio_info(material_url: string, options?: AudioOptions): AudioInfo
create_text_info(content: string, options?: TextOptions): TextInfo

// ==================== 时间线操作 ====================
generate_timelines(timeline_segment: number[] | TimelineSegmentItem[]): { target }
generate_timelines_by_audio(audio_urls: string[]): { target }

// ==================== 特效/滤镜/转场查询（复用 metadata） ====================
list_filter_presets(): { filters: FilterPreset[] }
list_video_effect_presets(): { effects: EffectPreset[] }
list_transition_presets(): { transitions: TransitionPreset[] }

// ==================== 特效/滤镜生成 ====================
generate_video_effect(effect_type_name: string, params?: number[], segment_ids?: string[], segment_index?: number[]): { effect_ids }
generate_video_filter(filter_type_name: string, intensity?: number, segment_ids?: string[], segment_index?: number[]): { filter_ids }
generate_transition(transition_type_name: string, duration?: number): { transition_id }

// ==================== 音频特效 ====================
generate_audio_effect(audio_ids: string[], effect_type: string, params?: number[], segment_index?: number[]): { effect_ids }

// ==================== 关键帧 ====================
generate_keyframe(segment_ids: string[], property: string, time_offset: number[], value: number[], segment_index: number[]): { keyframe_ids }
generate_audio_keyframe(audio_ids: string[], time_offset: number[], volume: number[], segment_index: number[]): { keyframe_ids }
```

#### 1.4 API Key 认证流程

```
┌─────────────────────────────────────────────────────────────┐
│                    API Key 认证流程                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  客户端                              MCP Server              │
│    │                                    │                   │
│    │  POST /mcp                        │                   │
│    │  Header: X-API-Key: <key>         │                   │
│    │───────────────────────────────────►│                   │
│    │                                    │                   │
│    │                          检查缓存（10分钟有效）         │
│    │                                    │                   │
│    │◄──────────────────────────────────│                   │
│    │  200 OK / 401 Unauthorized         │                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

```python
# core/mcp/auth.py
from datetime import datetime, timedelta
from typing import Optional

class APIKeyAuth:
    """API Key 认证（缓存机制）"""

    def __init__(self, cloud_verify_url: Optional[str] = None):
        self.cloud_verify_url = cloud_verify_url
        self._cache: dict = {}  # {api_key: (is_valid, expire_time)}

    def verify(self, api_key: str) -> bool:
        """验证 API Key（优先使用缓存，10分钟有效）"""
        now = datetime.now()

        # 检查缓存
        if api_key in self._cache:
            is_valid, expire_time = self._cache[api_key]
            if now < expire_time:
                return is_valid

        # 缓存过期或不存在，进行验证
        is_valid = self._verify_remote(api_key)

        # 缓存结果（10分钟有效）
        self._cache[api_key] = (is_valid, now + timedelta(minutes=10))
        return is_valid

    def _verify_remote(self, api_key: str) -> bool:
        """调用云端 API 验证（预留接口）"""
        # TODO: 后续实现云端验证
        # if self.cloud_verify_url:
        #     response = httpx.post(self.cloud_verify_url, json={"api_key": api_key})
        #     return response.json().get("valid", False)
        return True  # 开发阶段默认放行

    def generate_key(self) -> str:
        """生成新的 API Key（用于客户端配置）"""
        import uuid
        return f"jyd_{uuid.uuid4().hex[:24]}"
```

#### 1.5 依赖项

```
# 已有依赖（保持）
fastapi>=0.104.0
uvicorn>=0.24.0
pydantic>=2.0.0
pymediainfo>=5.0.0
imageio>=2.0.0

# 新增依赖
httpx>=0.25.0          # API Key 云端验证（预留）
python-multipart>=0.0.6
```

#### 1.6 实现步骤

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | 在 `core/mcp/` 下创建 MCP 层基础结构 |  |
| 2 | 实现 API Key 认证模块 `auth.py`（缓存机制） | 云端 API 接口（预留） |
| 3 | 实现 MCP Server 主类 `server.py`（支持 stdio + HTTP/SSE） | |
| 4 | 实现草稿管理 Tool 处理器 `handlers/draft.py` | 复用 `core/draft/` |
| 5 | 实现素材操作 Tool 处理器 `handlers/material.py` | 复用 `core/api/router.py` |
| 6 | 实现特效/滤镜查询 `handlers/preset.py` | 复用 `pjy/metadata/` |
| 7 | 实现特效/滤镜生成 `handlers/effect.py` | 复用 `pjy/metadata/` |
| 8 | 编写单元测试 |  |
| 9 | MCP 连接测试（stdio 模式 + HTTP 模式） |  |

#### 1.7 复用关系

| 新增模块 | 复用已有代码 |
|----------|-------------|
| `core/mcp/server.py` | 参考 `mcp/server.py` 实现，改为调用 `core/api/router.py` |
| `core/mcp/handlers/draft.py` | 复用 `core/draft/__init__.py` 中的 `create_draft`, `save_draft` |
| `core/mcp/handlers/material.py` | 复用 `core/api/router.py` 中的素材处理逻辑 |
| `core/mcp/handlers/preset.py` | 复用 `pjy/metadata/filter_meta.py`, `video_scene_effect.py` |
| `core/mcp/handlers/effect.py` | 复用 `pjy/metadata/effect_meta.py` 中的特效生成逻辑 |

#### 1.8 功能验证清单

##### 1.8.1 草稿管理

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T1.1 | create_draft | 调用 `create_draft(width=1920, height=1080)` | 返回 `draft_id`，长度 32 位 |
| T1.2 | save_draft | 调用 `save_draft(draft_id=xxx)` | 返回 `draft_url`，格式 `https://draft.dmaodata.cn/draft/...` |
| T1.3 | delete_draft | 调用 `delete_draft(draft_id=xxx)` | 返回 `code=0` |
| T1.4 | get_template | 调用 `get_template(draft_id=xxx)` | 返回完整的 `template_data` JSON |
| T1.5 | generate_jianying_draft | 调用 `generate_jianying_draft(draft_id, output_folder)` | 生成 `draft_content.json` 和 `draft_meta_info.json` |

##### 1.8.2 素材操作

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T2.1 | add_videos | 调用 `add_videos(draft_id, [video_info])` | 返回 `code=0` |
| T2.2 | add_audios | 调用 `add_audios(draft_id, [audio_info])` | 返回 `code=0` |
| T2.3 | add_texts | 调用 `add_texts(draft_id, [text_info])` | 返回 `code=0` |

##### 1.8.3 素材信息创建

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T3.1 | create_video_info | 调用 `create_video_info(material_url="file:///E:/video/a.mp4")` | 返回完整的 `video_infos` JSON 字符串 |
| T3.2 | create_audio_info | 调用 `create_audio_info(material_url="file:///E:/audio/b.mp3")` | 返回完整的 `audio_infos` JSON 字符串 |
| T3.3 | create_text_info | 调用 `create_text_info(content="测试文本")` | 返回完整的 `text_infos` JSON 字符串 |

##### 1.8.4 时间线操作

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T4.1 | generate_timelines | 调用 `generate_timelines([3000000, 5000000])` | 返回 `target` 包含时间线数据 |
| T4.2 | generate_timelines_by_audio | 调用 `generate_timelines_by_audio([audio_url])` | 自动分析音频时长生成时间线 |

##### 1.8.5 特效/滤镜查询

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T5.1 | list_filter_presets | 调用 `list_filter_presets()` | 返回 220+ 滤镜预设列表 |
| T5.2 | list_video_effect_presets | 调用 `list_video_effect_presets()` | 返回 600+ 视频特效预设列表 |
| T5.3 | list_transition_presets | 调用 `list_transition_presets()` | 返回转场预设列表 |

##### 1.8.6 特效/滤镜生成

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T6.1 | generate_video_effect | 调用 `generate_video_effect("抖动", [50])` | 返回 `effect_ids` 列表 |
| T6.2 | generate_video_filter | 调用 `generate_video_filter("黑白", 80)` | 返回 `filter_ids` 列表 |
| T6.3 | generate_transition | 调用 `generate_transition("淡入淡出", 500000)` | 返回 `transition_id` |

##### 1.8.7 音频特效

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T7.1 | generate_audio_effect | 调用 `generate_audio_effect(audio_ids, "大叔")` | 返回 `effect_ids` 列表 |

##### 1.8.8 关键帧

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T8.1 | generate_keyframe | 调用 `generate_keyframe(segment_ids, "KFTypePositionX", [0], [100], [1])` | 返回 `keyframe_ids` 列表 |
| T8.2 | generate_audio_keyframe | 调用 `generate_audio_keyframe(audio_ids, [0], [1.0], [1])` | 返回 `audio_keyframe_ids` 列表 |

##### 1.8.9 认证机制

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T9.1 | API Key 缓存 | 连续两次调用验证，第二次应命中缓存 | 第二次不调用远程验证 |
| T9.2 | API Key 过期 | 10分钟后再次调用 | 重新进行远程验证（预留） |
| T9.3 | 无效 Key | 传入无效 Key | 返回 `401 Unauthorized` |

##### 1.8.10 通信模式

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| T10.1 | stdio 模式 | 通过 stdin/stdout 发送 JSON-RPC 请求 | 正常响应 |
| T10.2 | HTTP/SSE 模式 | POST `/mcp` 端点 | 正常响应 |
| T10.3 | Health 检查 | GET `/health` | 返回 `{"status": "ok"}` |

### Phase 2：Electron 应用骨架

> **重要**：基于 `references/DMVideo/frontend` 已有业务代码进行开发
> - 许可证：闭源，不商用
> - Vue 视图代码保留但不显示功能页面
> - SQLite 表结构和加解密逻辑直接继承

#### 2.1 技术决策

| 问题 | 决策 |
|------|------|
| 构建工具 | vite-electron（直接复用 DMVideo vite.config.js） |
| 渲染框架 | Vue 3 + TypeScript（直接复用） |
| 状态管理 | Pinia（直接复用） |
| 数据库 | SQLite（继承 `database/index.ts` 表结构 + `tokenAesCrypto` 加解密） |
| AI 能力 | bailian（直接复用 `core/bailian.ts`） |
| MCP 通信 | HTTP/SSE（Phase 1 决策） |
| 主进程职责 | 核心业务逻辑（可编译字节码保护） |
| REPL 布局 | 底部面板 + 可拖拽调整高度 |

#### 2.2 目录结构设计

```
jy-draft/
├── electron/
│   ├── main.ts              # Electron 主进程入口
│   ├── preload.ts           # 预加载脚本（桥接 IPC）
│   └── mcp/
│       └── client.ts         # MCP Client 实现
├── src/
│   ├── main/                      # Electron 主进程
│   │   ├── index.ts               # vite-electron 主进程入口
│   │   ├── core/                  # 【复用 DMVideo】AI 能力
│   │   │   ├── bailian.ts         # 文本对话、图像理解、视频分析
│   │   │   ├── bailianAudio.ts    # TTS/ASR
│   │   │   ├── videoAnalysis.ts   # 视频分析 + 智能分割
│   │   │   ├── videoMatch.ts      # 关键词匹配视频时间线
│   │   │   ├── oss.ts             # OSS 上传
│   │   │   └── pipeline/          # 步骤编排 + 断点续传
│   │   ├── database/              # 【复用 DMVideo】SQLite 表结构
│   │   │   └── index.ts          # 表结构 + 加解密
│   │   ├── mcp/                   # MCP Client
│   │   │   └── client.ts
│   │   └── ipc/                   # IPC 通道
│   │       └── channels.ts
│   └── renderer/                   # Vue 渲染进程
│       ├── REPL/                   # REPL UI 组件
│       │   ├── ChatWindow.vue
│       │   ├── MessageList.vue
│       │   ├── MessageItem.vue
│       │   ├── PromptInput.vue
│       │   └── DraftCard.vue
│       ├── components/             # 通用组件（保留 Vue 代码，暂不显示）
│       ├── stores/                 # Pinia 状态管理
│       │   ├── conversation.ts
│       │   ├── draft.ts
│       │   └── material.ts
│       └── views/                  # 保留 Vue 代码（暂不显示）
│           ├── draft/
│           ├── material/
│           └── works/
├── package.json
└── vite.config.ts
```

#### 2.3 SQLite 表结构（直接继承）

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `material_text` | 材料库-文案 | content, source |
| `material_video` | 材料库-视频 | file_path, duration, keywords |
| `material_url` | 材料库-作品地址 | url, platform, title |
| `draft_text` | 素材库-文案 | content, source_id |
| `draft_video` | 素材库-视频 | file_path, keywords, use_count |
| `draft_video_keyword` | 视频关键词关联 | video_id, keyword |
| `works` | 作品库 | file_path, platform_url |
| `config` | **配置存储** | key, value（API Key 等加密存储） |
| `voice_clone` | 语音克隆 | voice_id, voice_model_id |
| `text_to_video_task` | 文生视频任务 | draft_text_id, tts/asr/keywords/timelines |
| `material_video_analysis_result` | 视频分析结果 | material_video_id, segments |
| `init_config` | 初始化配置 | init_param, status |
| `place` | 地点数据 | id, parent_id, name |

**加解密逻辑**（`tokenAesCrypto`）：
- AES-128-CBC 与 Java 服务端兼容
- 用于 `config.api_token` 等敏感字段加密存储

#### 2.4 IPC 通道设计

```typescript
// src/main/ipc/channels.ts
export const IPC_CHANNELS = {
  // MCP 连接
  'mcp:connect': (serverUrl: string, apiKey: string) => Promise<void>,
  'mcp:disconnect': () => void,
  'mcp:call-tool': (name: string, args: object) => Promise<unknown>,
  'mcp:list-tools': () => Promise<Tool[]>,

  // AI 能力（复用 core/）
  'ai:chat': (messages: ChatMessage[]) => Promise<ChatResult>,
  'ai:tts': (text: string, voice?: string) => Promise<TtsResult>,
  'ai:asr': (audioPath: string) => Promise<AsrResult>,
  'ai:analyze-video': (videoPath: string) => Promise<VideoAnalysisResult>,
  'ai:analyze-video-segments': (videoPath: string) => Promise<SegmentsResult>,

  // 草稿（通过 MCP）
  'draft:create': (width: number, height: number) => Promise<string>,
  'draft:save': (draftId: string) => Promise<string>,
  'draft:generate': (draftId: string, outputFolder: string) => Promise<string>,
  'draft:list': () => Promise<Draft[]>,

  // 素材（复用 database/）
  'material:add-video': (filePath: string) => Promise<MaterialVideo>,
  'material:add-text': (content: string) => Promise<MaterialText>,
  'material:list': (type: 'video' | 'text' | 'url') => Promise<Material[]>,

  // 配置（复用 database/config 表）
  'config:get': (key: string) => Promise<string | null>,
  'config:set': (key: string, value: string) => Promise<void>,
  'config:get-api-key': () => Promise<string>,  // 自动解密
  'config:set-api-key': (apiKey: string) => Promise<void>,  // 自动加密

  // 窗口管理
  'window:minimize': () => void,
  'window:maximize': () => void,
  'window:close': () => void,
};
```

#### 2.5 MCP Client 实现

```typescript
// src/main/mcp/client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export class JYMCPClient {
  private client: Client;
  private connected: boolean = false;

  async connect(serverUrl: string, apiKey: string): Promise<void> {
    await this.client.connect({
      transport: 'sse',
      url: serverUrl,
      headers: { 'X-API-Key': apiKey }
    });
    this.connected = true;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) throw new Error('MCP Client not connected');
    return this.client.callTool(name, args);
  }

  async listTools(): Promise<Tool[]> {
    return this.client.listTools();
  }

  disconnect(): void {
    this.client.close();
    this.connected = false;
  }
}
```

#### 2.6 REPL UI 布局

```
┌─────────────────────────────────────────────────────────────┐
│  JY Draft                                    [草稿] [设置]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  对话区域（可滚动）                                    │   │
│  │  - AI 响应                                          │   │
│  │  - Tool 调用结果                                     │   │
│  │  - 草稿预览卡片                                      │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  > 请输入...                                  [发送] [⚙]   │
├─────────────────────────────────────────────────────────────┤
│  素材面板（可折叠）                                          │
└─────────────────────────────────────────────────────────────┘
```

#### 2.7 实现步骤

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | 初始化 vite-electron 项目（基于 DMVideo vite.config.js） | |
| 2 | 集成 DMVideo core 模块（copy + 路径调整） | |
| 3 | 集成 DMVideo database 模块（SQLite 表结构 + 加解密） | |
| 4 | 实现 IPC 通道层 | 步骤 2, 3 |
| 5 | 实现 MCP Client | Phase 1 MCP Server |
| 6 | 实现 Electron 主进程入口 | 步骤 4, 5 |
| 7 | 搭建 REPL UI 框架 | |
| 8 | 实现 REPL 组件（ChatWindow, PromptInput, MessageList） | |
| 9 | 实现 Pinia Store | |
| 10 | 集成测试 | |

#### 2.8 复用关系

| 新增模块 | 复用已有代码 |
|----------|-------------|
| `src/main/core/*` | `references/DMVideo/frontend/src/main/core/*` |
| `src/main/database/*` | `references/DMVideo/frontend/src/main/database/*` |
| `src/main/pipeline/*` | `references/DMVideo/frontend/src/main/pipeline/*` |
| `src/main/mcp/client.ts` | 参考 `@modelcontextprotocol/sdk` |
| `src/main/ipc/channels.ts` | 新增，封装 core + MCP 调用 |
| `src/renderer/REPL/*` | 新增 Vue 组件 |
| `src/renderer/stores/*` | 新增 Pinia Store |

#### 2.9 功能验证清单

##### 2.9.1 项目初始化

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P1.1 | vite-electron 启动 | 执行 `npm run dev` | Electron 窗口正常打开，REPL 界面显示 |
| P1.2 | SQLite 数据库初始化 | 首次启动后检查数据库文件 | `jy-draft.db` 创建成功，包含所有表 |
| P1.3 | 配置表初始化 | 查询 `config` 表 | 包含 `video_root_path`, `jianying_draft_path`, `api_token` 等默认配置 |
| P1.4 | DMVideo core 模块加载 | 启动后检查日志 | 无模块加载错误 |

##### 2.9.2 MCP Client

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P2.1 | MCP 连接 | 调用 `mcp:connect` | 成功连接到 Phase 1 MCP Server |
| P2.2 | MCP 断开 | 调用 `mcp:disconnect` | 连接正常关闭 |
| P2.3 | 调用 MCP Tool | 调用 `mcp:call-tool` 执行 `list_filter_presets` | 返回滤镜预设列表 |
| P2.4 | 工具列表查询 | 调用 `mcp:list-tools` | 返回所有可用 Tools |

##### 2.9.3 AI 能力（复用 bailian）

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P3.1 | 文本对话 | 发送 "你好" | 返回 AI 响应 |
| P3.2 | TTS 语音合成 | 调用 `ai:tts`，text="测试文本" | 返回音频文件路径 |
| P3.3 | ASR 语音识别 | 调用 `ai:asr`，传入音频文件 | 返回识别文本 |
| P3.4 | 视频分析 | 调用 `ai:analyze-video` | 返回视频分析结果（关键词/摘要） |

##### 2.9.4 素材管理

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P4.1 | 添加视频素材 | 调用 `material:add-video`，传入本地视频路径 | 返回素材信息（时长、分辨率等） |
| P4.2 | 添加文案素材 | 调用 `material:add-text`，传入文本内容 | 返回素材记录 |
| P4.3 | 素材列表查询 | 调用 `material:list`，type="video" | 返回视频素材列表 |
| P4.4 | 数据库持久化 | 添加素材后重启应用 | 素材数据从数据库恢复 |

##### 2.9.5 草稿管理

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P5.1 | 创建草稿 | 调用 `draft:create`，width=1920, height=1080 | 返回 draft_id |
| P5.2 | 添加视频到草稿 | 调用 `add_videos` 通过 MCP | 视频添加到草稿时间线 |
| P5.3 | 保存草稿 | 调用 `draft:save` | 返回 draft_url |
| P5.4 | 生成剪映草稿 | 调用 `draft:generate` | 在 output_folder 生成 draft_content.json |

##### 2.9.6 REPL UI

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P6.1 | 对话显示 | 发送消息后 | 消息正确显示在对话区域 |
| P6.2 | 消息类型区分 | 发送不同类型消息 | AI 消息、用户消息、Tool 结果样式不同 |
| P6.3 | 草稿预览卡片 | 调用草稿相关 Tool 后 | 显示草稿预览卡片 |
| P6.4 | 发送消息 | 输入文本后点击发送 | 消息发送到 AI 处理 |
| P6.5 | 快捷键支持 | 按 Enter 发送 | 消息正常发送 |
| P6.6 | 素材面板折叠 | 点击折叠按钮 | 素材面板正确折叠/展开 |

##### 2.9.7 配置管理

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P7.1 | 读取配置 | 调用 `config:get`，key="video_root_path" | 返回配置值 |
| P7.2 | 写入配置 | 调用 `config:set` | 配置正确保存到数据库 |
| P7.3 | API Key 加密存储 | 调用 `config:set-api-key` 后直接查看数据库 | 数据库中 value 字段为加密值 |
| P7.4 | API Key 解密读取 | 调用 `config:get-api-key` | 返回解密后的原始 API Key |
| P7.5 | 配置持久化 | 修改配置后重启应用 | 配置值保持不变 |

##### 2.9.8 窗口管理

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P8.1 | 最小化 | 调用 `window:minimize` | 窗口最小化到任务栏 |
| P8.2 | 最大化/还原 | 调用 `window:maximize` | 窗口最大化，再次调用还原 |
| P8.3 | 关闭 | 调用 `window:close` | 窗口关闭，应用退出 |

##### 2.9.9 Electron 构建

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| P9.1 | 开发构建 | 执行 `npm run dev` | 开发模式正常启动 |
| P9.2 | 生产构建 | 执行 `npm run build` | 生成可执行文件 |
| P9.3 | 打包验证 | 运行打包后的 .exe | 功能与开发模式一致 |
| P9.4 | 业务代码保护 | 检查打包产物 | 业务 JS 代码被混淆/压缩 |

### Phase 3：核心功能（共 48 个交付任务）

> **任务拆分原则**：每个任务独立可交付、可测试、可 code review

#### Phase 3.1 Permission System（8 tasks）

> **设计参考**：Claude Code Permission System（简化版）
> **核心原则**：按 Tool 名称 + 内容匹配，不是按资源路径

##### 3.1.1 类型设计

```typescript
// 权限模式（全局设置，影响所有权限检查）
export type PermissionMode =
  | 'default'    // 按规则询问（默认）
  | 'acceptAll'  // 接受所有
  | 'denyAll'    // 拒绝所有
  | 'auto'       // AI 自动判断（预留）

// 权限行为
export type PermissionBehavior = 'allow' | 'deny' | 'ask'

// 规则来源（优先级：session > user > default）
export type PermissionRuleSource = 'default' | 'user' | 'session'

// 规则值
export type PermissionRuleValue = {
  toolName: string           // 工具名称
  ruleContent?: string       // 内容匹配（可选），用于精细控制
}

// 权限规则
export type PermissionRule = {
  source: PermissionRuleSource
  behavior: PermissionBehavior
  value: PermissionRuleValue
}

// 权限决策
export type PermissionDecision =
  | { behavior: 'allow', updatedInput?: unknown }
  | { behavior: 'deny', message: string }
  | { behavior: 'ask', message: string, options: PermissionOption[] }

// 权限选项
export type PermissionOption =
  | { type: 'allowOnce', label: string }           // 仅本次允许
  | { type: 'allowSession', label: string }         // 本次会话允许
  | { type: 'deny', label: string }                // 拒绝

// 权限请求（渲染进程展示用）
export interface PermissionRequest {
  toolName: string
  input: unknown
  description: string
  timestamp: number
}
```

##### 3.1.2 数据库表设计

```sql
CREATE TABLE permission_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,           -- 工具名称（如 Read、Bash、mcp_call_tool）
  rule_content TEXT,                  -- 内容匹配（可选，如 npm install）
  behavior TEXT NOT NULL,            -- allow/deny/ask
  source TEXT NOT NULL,              -- default/user/session
  created_at INTEGER NOT NULL,       -- 创建时间戳
  expires_at INTEGER                  -- 过期时间戳（可选，session 规则需要）
);

CREATE INDEX idx_permission_rules_tool ON permission_rules(tool_name);
CREATE INDEX idx_permission_rules_source ON permission_rules(source);

CREATE TABLE permission_mode (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT NOT NULL DEFAULT 'default',  -- default/acceptAll/denyAll/auto
  updated_at INTEGER NOT NULL
);
```

##### 3.1.3 任务拆解

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P3.1.1 | 权限类型定义 | `types/permission.ts` | - | Mode/Behavior/Rule/Decision/Option 接口定义完成 |
| P3.1.2 | 权限存储表 | `database/migrations/` | P3.1.1 | permission_rules + permission_mode 表创建成功 |
| P3.1.3 | 权限核心逻辑 | `permissions/manager.ts` | P3.1.2 | checkPermission() 实现：Mode 检查 → 规则匹配 → 返回决策 |
| P3.1.4 | IPC 权限通道 | `ipc/permission.ts` | P3.1.3 | check / request / response 三个通道正常工作 |
| P3.1.5 | 权限弹窗 UI | `components/PermissionDialog.vue` | P3.1.4 | 弹窗显示，三个选项（允许本次/本次会话/拒绝） |
| P3.1.6 | 权限规则管理 | `permissions/rules.ts` | P3.1.3 | 规则添加（按来源）、过期清理、本次会话规则自动过期 |
| P3.1.7 | 权限 Store | `stores/permission.ts` | P3.1.5, P3.1.6 | pendingRequests、showDialog、currentMode 状态正确 |
| P3.1.8 | 集成测试 | `__tests__/permission/` | P3.1.7 | 正常授权/拒绝/记住/会话过期全流程通过 |

##### 3.1.4 核心检查流程

```
Tool 调用请求
     │
     ▼
PermissionManager.checkPermission(toolName, input)
     │
     ├──► 1. 检查全局 Mode
     │    ├── 'acceptAll' → 返回 allow
     │    └── 'denyAll' → 返回 deny
     │
     ├──► 2. 规则匹配（优先级：session > user > default）
     │    ├── 匹配条件：toolName 相等 AND (ruleContent 为空 OR 内容相等)
     │    └── 命中规则 → 返回对应 behavior
     │
     └──► 3. 无匹配规则 → 返回 ask（显示弹窗）

用户选择后：
- allowOnce → 执行 Tool，不存储规则
- allowSession → 执行 Tool，存储 session 规则（应用关闭时清除）
- deny → 不执行 Tool
```

##### 3.1.5 与 Claude Code 的差异

| 维度 | Claude Code | JY Draft |
|------|-------------|----------|
| 存储 | settings JSON 文件 | SQLite |
| 规则内容 | 支持 glob 模式 | 精确匹配（简化） |
| 来源分层 | 6 级 | 3 级（default/user/session） |
| AI 分类器 | 有（auto 模式） | 预留（第一版不实现） |
| Feedback | Tab 键添加反馈 | 不需要 |
| 导出/导入 | 支持 | 不需要 |

**验收标准**：Tool 调用时弹窗正常显示，本次会话记住的规则在应用关闭前持续生效

---

#### Phase 3.X 权限集成说明

> 本说明阐述 Permission System（Phase 3.1）如何与 Phase 3.2/3.3/3.4 集成

##### X.1 权限检查介入点

所有 Tool 调用在执行前必须经过 PermissionManager 统一检查：

```
Tool 调用请求（QueryEngine / 直接调用）
         │
         ▼
PermissionManager.checkPermission(toolName, input)
         │
         ├──► allow → 执行 Tool
         ├──► deny → 返回拒绝原因（不执行 Tool）
         └──► ask → 弹窗等待用户选择
                   ├──► allowOnce → 执行 Tool（不存储规则）
                   ├──► allowSession → 执行 Tool（存储 session 规则）
                   └──► deny → 返回拒绝原因（不执行 Tool）
```

##### X.2 各模块权限需求

| 模块 | Tool 调用 | 需要权限检查的场景 |
|------|----------|-------------------|
| **MaterialManager** | addVideo / addAudio / addImage | 用户本地文件路径首次使用 |
| | deleteMaterial | 删除用户素材文件 |
| | scanDirectory | 扫描用户指定目录 |
| **DraftManager** | createDraft | 首次在指定目录创建草稿 |
| | addVideoToDraft / addAudioToDraft | 添加用户素材到草稿 |
| | exportDraft | 导出草稿到用户指定目录 |
| **QueryEngine** | mcp_call_tool | 所有 MCP Tool 调用前统一检查 |
| | uploadMaterial | 上传用户素材到云端 |

##### X.3 权限拒绝时的处理策略

```
Tool 调用被权限系统拒绝后：
1. 记录拒绝日志（toolName、reason、timestamp）
2. 根据拒绝来源处理：
   ├──► 用户主动拒绝 → 返回友好提示，引导用户去设置页面修改权限
   ├──► session 规则过期 → 提示用户需要重新授权
   └──► denyAll 模式 → 提示用户当前为拒绝所有模式，需切换
3. 拒绝信息反馈给 AI（如果通过 QueryEngine 调用）
4. UI 显示权限被拒的状态
```

##### X.4 权限与 MCP Client 的交互

```typescript
// IPC 层统一封装权限检查
ipcRenderer.invoke('permission:check', toolName, input).then(decision => {
  switch (decision.behavior) {
    case 'allow':
      return executeTool(toolName, input)
    case 'deny':
      return { error: decision.message }
    case 'ask':
      return showPermissionDialog(toolName, input, decision.options)
  }
})
```

##### X.5 权限 Store 与 UI 联动

```
┌─────────────────────────────────────────────────────────────┐
│                     PermissionStore                         │
├─────────────────────────────────────────────────────────────┤
│  state:                                                     │
│    - mode: 'default' | 'acceptAll' | 'denyAll' | 'auto'   │
│    - pendingRequests: PermissionRequest[]                  │
│    - showDialog: boolean                                    │
│    - currentRequest: PermissionRequest | null               │
│                                                              │
│  actions:                                                   │
│    - checkPermission(toolName, input) → Promise<Decision>   │
│    - requestPermission(toolName, input) → void（显示弹窗）  │
│    - resolvePermission(requestId, option) → void            │
│    - setMode(mode) → void                                   │
└─────────────────────────────────────────────────────────────┘
```

**关键约束**：QueryEngine 不能绕过 PermissionStore 直接调用 MCP Client

---

#### Phase 3.2 MaterialManager（22 tasks）

> **需求确认**：素材来源仅本地文件；不支持标签分类；回收站+7天清理；使用统计；视频缩略图；批量删除/移动/描述；重命名+别名；文件名重复检测；递归扫描；多种排序；预览播放；存储统计；收藏功能；复制导入

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P3.2.1 | 目录结构设计 | `config/storage.ts` | - | 素材根目录、日期分目录、drafts 目录配置完成 |
| P3.2.2 | 数据库表设计 | `database/migrations/` | - | material_video/audio/image 表创建成功（含软删除、别名、描述、收藏、统计字段） |
| P3.2.3 | 路径工具函数 | `utils/path.ts` | - | normalizePath/toFileUrl 处理 Windows/macOS 差异，支持文件复制 |
| P3.2.4 | 视频元数据提取 | `core/material/video.ts` | P3.2.3 | 提取 duration/width/height/fps/codec 正确 |
| P3.2.5 | 音频元数据提取 | `core/material/audio.ts` | P3.2.3 | 提取 duration/sampleRate/channels/codec 正确 |
| P3.2.6 | 图片素材处理 | `core/material/image.ts` | P3.2.3 | 提取 width/height/size 正确 |
| P3.2.7 | 添加素材 API | `core/material/manager.ts` | P3.2.4~6 | addVideo/addAudio/addImage 存入 SQLite 成功，支持文件名重复检测 |
| P3.2.8 | 素材列表查询 | `core/material/query.ts` | P3.2.7 | 分页查询、类型过滤、多种排序（时间/名称/使用次数）正常 |
| P3.2.9 | 素材搜索 | `core/material/search.ts` | P3.2.7 | 关键词搜索（文件名、路径、别名）正确 |
| P3.2.10 | 素材删除（软删除） | `core/material/delete.ts` | P3.2.8 | 软删除到回收站，不立即删除文件 |
| P3.2.11 | 回收站管理 | `core/material/trash.ts` | P3.2.10 | 回收站列表、恢复、彻底删除、7天自动清理 |
| P3.2.12 | 目录扫描 | `core/material/scanner.ts` | P3.2.7 | 自动识别目录下素材并导入，支持递归扫描 |
| P3.2.13 | 批量操作 | `core/material/batch.ts` | P3.2.8 | 批量删除、批量移动（移动文件）、批量设置描述 |
| P3.2.14 | 视频缩略图 | `core/material/thumbnail.ts` | P3.2.4 | 为视频生成缩略图用于列表预览 |
| P3.2.15 | 素材预览 | `core/material/preview.ts` | P3.2.4~6 | 查看元数据信息、视频预览播放、图片预览 |
| P3.2.16 | 别名与描述 | `core/material/alias.ts` | P3.2.7 | 别名设置（用于显示和搜索）、描述字段（用户备注 + AI 描述） |
| P3.2.17 | 收藏功能 | `core/material/favorite.ts` | P3.2.8 | 收藏/取消收藏、收藏列表单独展示 |
| P3.2.18 | 存储统计 | `core/material/storageStats.ts` | P3.2.7 | 显示已使用空间大小统计 |
| P3.2.19 | 导入功能 | `core/material/import.ts` | P3.2.3 | 复制导入（从其他位置复制素材到素材库） |
| P3.2.20 | IPC 素材通道 | `ipc/material.ts` | P3.2.7~19 | add-video/list/delete/batch/import 通道正常工作 |
| P3.2.21 | Material Store | `stores/material.ts` | P3.2.20 | materials、trash、favorites、storageStats、loading、filters 状态正确 |
| P3.2.22 | 集成测试 | `__tests__/material/` | P3.2.21 | 添加/查询/搜索/删除/回收站/批量/导入全流程通过 |

##### 3.2.A 数据库表扩展字段

```sql
-- material_video / material_audio / material_image 表扩展
ALTER TABLE material_video ADD COLUMN alias TEXT;           -- 别名（显示名称 + 搜索）
ALTER TABLE material_video ADD COLUMN description TEXT;      -- 用户备注
ALTER TABLE material_video ADD COLUMN ai_description TEXT;   -- AI 自动描述
ALTER TABLE material_video ADD COLUMN is_favorite INTEGER DEFAULT 0;  -- 是否收藏
ALTER TABLE material_video ADD COLUMN use_count INTEGER DEFAULT 0;     -- 使用次数统计
ALTER TABLE material_video ADD COLUMN is_deleted INTEGER DEFAULT 0;    -- 软删除标记
ALTER TABLE material_video ADD COLUMN deleted_at INTEGER;             -- 删除时间戳
ALTER TABLE material_video ADD COLUMN thumbnail_path TEXT;             -- 缩略图路径
```

##### 3.2.B 素材导入流程

```
用户选择导入素材
         │
         ▼
扫描用户选择的文件/目录
         │
         ▼
检查文件名是否与当前文件夹重复
         │
         ├──► 不重复 → 复制到素材库目录 → 添加到数据库
         │
         └──► 重复 → 提示用户选择：
                   ├──► 覆盖原有文件
                   ├──► 重命名后添加
                   └──► 取消导入
```

##### 3.2.C 回收站清理策略

```
定时任务（每天凌晨检查）
         │
         ▼
查询 deleted_at < (now - 7天) 的记录
         │
         ▼
彻底删除文件 + 删除数据库记录
```

**验收标准**：本地视频文件能正确提取元数据并存储，列表查询支持分页/排序/搜索，回收站7天后自动清理

---

#### Phase 3.3 DraftManager（13 tasks）

> **设计决策汇总**（2026-04-15 深度讨论确认）：
>
> | 决策维度 | 方案 |
> |----------|------|
> | 草稿状态机 | 方案A：5 状态（EMPTY/EDITING/SAVED/EXPORTED/ARCHIVED） |
> | 数据模型 | 方案C：引用+导出解析（存素材 ID，导出时解析为文件路径） |
> | 数据库表 | 方案A：统一关联表（draft_main + draft_materials + draft_versions） |
> | MCP 交互 | 方案B：即时创建（每次操作同步 MCP，本地 SQLite 做备份） |
> | MaterialInfo 构建 | 方案A：客户端构建（Electron 提取元数据，构建完整 Info） |
> | 特效/滤镜 | 延后到 Phase 4（第一版只做基础素材：视频/音频/文本） |
> | 保存/导出 | 方案A：分离（save → MCP Server, export → 剪映 JSON）+ 版本管理 |
> | 列表查询 | 全功能：排序 + 状态过滤 + 关键词搜索 + 统计信息 |

##### 3.3.1 草稿状态机

```typescript
// types/draft.ts

/** 草稿状态（5 种） */
export enum DraftStatus {
  EMPTY    = 'EMPTY',     // 创建后无素材
  EDITING  = 'EDITING',   // 有素材，编辑中
  SAVED    = 'SAVED',     // 已保存到 MCP Server
  EXPORTED = 'EXPORTED',  // 已导出为剪映 JSON
  ARCHIVED = 'ARCHIVED',  // 已归档（不活跃）
}

/** 允许的状态转换 */
export const DRAFT_TRANSITIONS: Record<DraftStatus, DraftStatus[]> = {
  EMPTY:    [DraftStatus.EDITING, DraftStatus.ARCHIVED],
  EDITING:  [DraftStatus.SAVED, DraftStatus.EDITING, DraftStatus.ARCHIVED],
  SAVED:    [DraftStatus.EDITING, DraftStatus.EXPORTED, DraftStatus.ARCHIVED],
  EXPORTED: [DraftStatus.EDITING, DraftStatus.SAVED, DraftStatus.ARCHIVED],
  ARCHIVED: [DraftStatus.EDITING],  // 恢复归档
}

/** 素材类型 */
export type MaterialType = 'video' | 'audio' | 'text'

/** 草稿配置 */
export interface DraftConfig {
  name: string
  width: number     // 默认 1920
  height: number    // 默认 1080
  fps?: number      // 默认 30
  outputFolder?: string  // 导出目录
  description?: string  // 用户描述
}

/** 草稿统计 */
export interface DraftStats {
  videoCount: number
  audioCount: number
  textCount: number
  totalDuration: number  // 微秒
}
```

**状态转换图**：

```
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  ▼                                                      │
EMPTY ──(addMaterial)──► EDITING ◄─────────────────────┐ │
  │                         │                           │ │
  │                   (saveDraft)                       │ │
  │                         │                           │ │
  │                         ▼                           │ │
  │                       SAVED ──(addMaterial)─────────┘ │
  │                         │                             │
  │                   (exportDraft)                       │
  │                         │                             │
  │                         ▼                             │
  │                     EXPORTED ──(addMaterial)──► EDITING
  │                         │
  │                   (archive)
  │                         │
  └─────────────────────► ARCHIVED ──(restore)──► EDITING
```

##### 3.3.2 数据库表设计

```sql
-- ==================== 草稿主表 ====================
CREATE TABLE draft_main (
  id TEXT PRIMARY KEY,                    -- UUID（客户端生成）
  name TEXT NOT NULL,                     -- 草稿名称
  status TEXT NOT NULL DEFAULT 'EMPTY',   -- DraftStatus 枚举值
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  fps INTEGER NOT NULL DEFAULT 30,
  mcp_draft_id TEXT,                      -- MCP Server 返回的 draft_id
  output_folder TEXT,                     -- 导出目录
  thumbnail_path TEXT,                    -- 缩略图路径
  description TEXT,                       -- 用户/AI 描述
  video_count INTEGER DEFAULT 0,          -- 视频素材数
  audio_count INTEGER DEFAULT 0,          -- 音频素材数
  text_count INTEGER DEFAULT 0,           -- 文本素材数
  total_duration INTEGER DEFAULT 0,       -- 总时长（微秒）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  exported_at INTEGER                     -- 最后导出时间
);

CREATE INDEX idx_draft_main_status ON draft_main(status);
CREATE INDEX idx_draft_main_updated ON draft_main(updated_at);

-- ==================== 草稿素材关联表 ====================
CREATE TABLE draft_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id TEXT NOT NULL REFERENCES draft_main(id) ON DELETE CASCADE,
  material_type TEXT NOT NULL,            -- video/audio/text
  material_id TEXT,                       -- 引用素材库 ID（可选，AI 生成的无）
  material_url TEXT NOT NULL,             -- 实际文件路径/URL
  track_name TEXT,                        -- 轨道名（可选）
  track_index INTEGER DEFAULT 0,          -- 轨道索引
  segment_index INTEGER DEFAULT 0,        -- 片段索引
  sort_order INTEGER DEFAULT 0,           -- 排序权重
  duration INTEGER,                       -- 时长（微秒）
  start_offset INTEGER DEFAULT 0,         -- 在时间线上的起始偏移（微秒）
  extra_data TEXT,                        -- JSON：MCP 返回的附加数据
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_draft_materials_draft ON draft_materials(draft_id);
CREATE INDEX idx_draft_materials_type ON draft_materials(material_type);

-- ==================== 草稿版本表 ====================
CREATE TABLE draft_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id TEXT NOT NULL REFERENCES draft_main(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,        -- 自增版本号
  folder_path TEXT NOT NULL,              -- 导出文件夹路径
  file_count INTEGER DEFAULT 0,           -- 包含的文件数
  total_size INTEGER DEFAULT 0,           -- 总大小（字节）
  note TEXT,                              -- 版本备注（用户/AI）
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_draft_versions_draft ON draft_versions(draft_id);
CREATE UNIQUE INDEX idx_draft_versions_unique ON draft_versions(draft_id, version_number);
```

##### 3.3.3 任务拆解（13 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P3.3.1 | 草稿状态机与类型 | `types/draft.ts` | - | DraftStatus 5枚举 + DRAFT_TRANSITIONS 转换表 + DraftConfig/DraftStats 接口 |
| P3.3.2 | 草稿数据库表 | `database/migrations/` | P3.3.1 | draft_main + draft_materials + draft_versions 表创建成功 |
| P3.3.3 | 创建草稿 | `core/draft/create.ts` | P3.3.1~2 | createDraft(config) → MCP create_draft → 存储 mcp_draft_id → 本地状态 EMPTY |
| P3.3.4 | MaterialInfo 构建器 | `core/draft/materialInfo.ts` | P3.3.1 | buildVideoInfo/buildAudioInfo/buildTextInfo：Electron 提取元数据 → 构建 MCP 格式 Info |
| P3.3.5 | 添加素材（统一） | `core/draft/addMaterial.ts` | P3.3.3, P3.3.4 | addMaterial(draftId, type, infos) → MCP add_* → 更新本地 draft_materials + 状态 → EDITING |
| P3.3.6 | 草稿保存 | `core/draft/save.ts` | P3.3.5 | saveDraft(draftId) → MCP save_draft → 状态更新为 SAVED |
| P3.3.7 | 草稿导出 | `core/draft/export.ts` | P3.3.6 | exportDraft(draftId) → MCP generate_jianying_draft → 保存到 output_folder → 状态 EXPORTED |
| P3.3.8 | 草稿版本管理 | `core/draft/version.ts` | P3.3.7 | 每次导出自增版本号、记录文件夹路径；listVersions / rollbackVersion 正常 |
| P3.3.9 | 草稿列表 | `core/draft/list.ts` | P3.3.2 | listDrafts({sort, filter, search, page}) 返回含统计信息的草稿列表 |
| P3.3.10 | 草稿删除 | `core/draft/delete.ts` | P3.3.3 | deleteDraft(draftId) → MCP delete_draft → 删除本地记录 + 级联删除素材和版本 |
| P3.3.11 | IPC 草稿通道 | `ipc/draft.ts` | P3.3.3~10 | create/save/generate/list/delete/addMaterial 通道正常工作 |
| P3.3.12 | Draft Store | `stores/draft.ts` | P3.3.11 | currentDraft、draftList、versions、isLoading 状态正确 |
| P3.3.13 | 集成测试 | `__tests__/draft/` | P3.3.12 | 创建→添加素材→保存→导出→版本管理全流程通过 |

##### 3.3.4 核心流程详解

###### A. 创建草稿流程

```
用户/AI: "创建一个 1920x1080 的草稿，名字叫'生日祝福'"
         │
         ▼
DraftManager.createDraft({ name: "生日祝福", width: 1920, height: 1080 })
         │
         ├──► 1. 生成 UUID 作为本地 draft_id
         ├──► 2. 调 MCP create_draft(1920, 1080)
         │        └──► 返回 mcp_draft_id
         ├──► 3. 插入 draft_main 表（status=EMPTY, mcp_draft_id）
         └──► 4. 返回 { draft_id, mcp_draft_id, status: EMPTY }
```

###### B. 添加素材流程

```
用户/AI: "添加 E:\videos\birthday.mp4 到草稿"
         │
         ▼
DraftManager.addMaterial(draft_id, 'video', [
  { material_url: 'file:///E:/videos/birthday.mp4' }
])
         │
         ├──► 1. 状态检查（EMPTY/EDITING 才能添加）
         ├──► 2. 调 buildVideoInfo(material_url) → VideoInfo
         │        ├── Electron 读取文件元数据（duration/width/height/fps）
         │        └── 构建 MCP 格式的 VideoInfo JSON
         ├──► 3. 调 MCP add_videos(mcp_draft_id, [videoInfo])
         ├──► 4. 插入 draft_materials 表
         ├──► 5. 更新 draft_main（video_count++, total_duration）
         ├──► 6. 状态转换：EMPTY → EDITING（或保持 EDITING）
         └──► 7. 返回 { success: true }
```

###### C. 保存+导出流程

```
用户/AI: "保存并导出草稿"
         │
         ▼
DraftManager.saveDraft(draft_id)
         │
         ├──► 1. 状态检查（EDITING 才能保存）
         ├──► 2. 调 MCP save_draft(mcp_draft_id)
         └──► 3. 状态转换：EDITING → SAVED
                  │
                  ▼
DraftManager.exportDraft(draft_id)
         │
         ├──► 1. 状态检查（SAVED 才能导出）
         ├──► 2. 调 MCP generate_jianying_draft(mcp_draft_id, output_folder)
         │        └──► 生成 draft_content.json + draft_meta_info.json
         ├──► 3. 插入 draft_versions（version_number 自增）
         ├──► 4. 更新 draft_main（exported_at, status=EXPORTED）
         └──► 5. 返回 { folder_path, version_number }
```

###### D. 版本回滚流程

```
用户/AI: "回滚到版本 1"
         │
         ▼
DraftManager.rollbackVersion(draft_id, 1)
         │
         ├──► 1. 查询 draft_versions 获取 v1 的 folder_path
         ├──► 2. 读取 v1 的 draft_content.json
         ├──► 3. 重新创建草稿（新 draft_id 或覆盖当前）
         ├──► 4. 根据 v1 的 JSON 重建素材关联
         └──► 5. 返回 { new_draft_id, restored_from_version: 1 }
```

##### 3.3.5 MaterialInfo 构建器接口

```typescript
// core/draft/materialInfo.ts

/** 视频素材元数据（Electron 端提取） */
export interface VideoMaterialMeta {
  material_url: string        // file:///E:/videos/test.mp4
  duration: number            // 微秒
  width: number
  height: number
  fps: number
  codec?: string
}

/** 构建 MCP 格式的 VideoInfo */
export function buildVideoInfo(meta: VideoMaterialMeta, options?: {
  mute?: boolean
  volume?: number
  start_time?: number         // 微秒，裁剪起始
  end_time?: number           // 微秒，裁剪结束
}): string  // 返回 JSON 字符串

/** 构建 MCP 格式的 AudioInfo */
export function buildAudioInfo(meta: AudioMaterialMeta, options?: {
  volume?: number
  start_time?: number
  end_time?: number
}): string

/** 构建 MCP 格式的 TextInfo */
export function buildTextInfo(content: string, options?: {
  font_size?: number
  font_color?: string
  duration?: number           // 微秒
  position?: { x: number, y: number }
}): string
```

**元数据提取方式**（Electron 端）：
- 视频：`ffprobe` 或 `fluent-ffmpeg` 提取 duration/width/height/fps/codec
- 音频：`ffprobe` 提取 duration/sampleRate/channels/codec
- 图片：`sharp` 或 `image-size` 提取 width/height
- 文本：无需提取，用户/AI 指定内容和样式参数

##### 3.3.6 IPC 通道设计

```typescript
// ipc/draft.ts
export const DRAFT_IPC_CHANNELS = {
  // 草稿 CRUD
  'draft:create': (config: DraftConfig) => Promise<DraftInfo>,
  'draft:delete': (draftId: string) => Promise<void>,
  'draft:get':    (draftId: string) => Promise<DraftInfo | null>,
  'draft:list':   (query: DraftListQuery) => Promise<PaginatedResult<DraftInfo>>,

  // 素材操作
  'draft:add-material': (draftId: string, type: MaterialType, items: MaterialItem[]) => Promise<void>,

  // 保存/导出
  'draft:save':   (draftId: string) => Promise<void>,
  'draft:export': (draftId: string) => Promise<ExportResult>,

  // 版本管理
  'draft:list-versions':  (draftId: string) => Promise<DraftVersion[]>,
  'draft:rollback':       (draftId: string, versionNumber: number) => Promise<DraftInfo>,

  // 统计
  'draft:stats': (draftId: string) => Promise<DraftStats>,
}

interface DraftListQuery {
  page?: number
  pageSize?: number
  sort?: 'created_at' | 'updated_at' | 'name'
  sortOrder?: 'asc' | 'desc'
  status?: DraftStatus        // 过滤状态
  keyword?: string            // 搜索名称/描述
}

interface ExportResult {
  folderPath: string
  versionNumber: number
  fileCount: number
  totalSize: number
}
```

##### 3.3.7 Draft Store 设计

```typescript
// stores/draft.ts

export interface DraftState {
  // 当前编辑的草稿
  currentDraft: DraftInfo | null
  currentMaterials: DraftMaterial[]

  // 草稿列表
  drafts: DraftInfo[]
  totalDrafts: number
  listQuery: DraftListQuery

  // 版本历史
  versions: DraftVersion[]

  // 加载状态
  isLoading: boolean
  isExporting: boolean
  error: string | null
}

export const useDraftStore = defineStore('draft', {
  state: (): DraftState => ({ ... }),
  actions: {
    async createDraft(config: DraftConfig): Promise<DraftInfo>,
    async deleteDraft(draftId: string): Promise<void>,
    async addMaterial(type: MaterialType, items: MaterialItem[]): Promise<void>,
    async saveCurrentDraft(): Promise<void>,
    async exportCurrentDraft(): Promise<ExportResult>,
    async listDrafts(query?: Partial<DraftListQuery>): Promise<void>,
    async loadVersions(draftId: string): Promise<void>,
    async rollbackVersion(versionNumber: number): Promise<void>,
    async loadDraft(draftId: string): Promise<void>,  // 设为 currentDraft
  },
  getters: {
    draftStats: (state): DraftStats | null => { ... },
    canSave: (state): boolean => state.currentDraft?.status === 'EDITING',
    canExport: (state): boolean => state.currentDraft?.status === 'SAVED',
  },
})
```

##### 3.3.8 与 Phase 3.1（权限）的集成

| 操作 | 需要权限检查 | 说明 |
|------|:----:|------|
| createDraft | ✓ | 首次在目录创建 |
| addMaterial | ✓ | 访问用户本地文件 |
| saveDraft | ✗ | MCP Server 内部操作 |
| exportDraft | ✓ | 写入文件到用户目录 |
| deleteDraft | ✓ | 删除草稿数据 |
| rollbackVersion | ✗ | 内部操作 |

##### 3.3.9 功能验证清单

| 编号 | 功能 | 验证方法 | 预期结果 |
|------|------|----------|----------|
| D1.1 | 创建草稿 | createDraft({ name: "test", width: 1920, height: 1080 }) | draft_main 记录 + mcp_draft_id + status=EMPTY |
| D1.2 | 创建草稿（MCP 失败） | MCP Server 未启动时创建 | 返回错误，本地无记录 |
| D2.1 | 添加视频 | addMaterial(draft_id, 'video', [{ url: "file:///E:/test.mp4" }]) | draft_materials 记录 + video_count=1 + status=EDITING |
| D2.2 | 添加音频 | addMaterial(draft_id, 'audio', [{ url: "file:///E:/test.mp3" }]) | draft_materials 记录 + audio_count=1 |
| D2.3 | 添加文本 | addMaterial(draft_id, 'text', [{ content: "Hello" }]) | draft_materials 记录 + text_count=1 |
| D2.4 | 批量添加 | addMaterial(draft_id, 'video', [url1, url2, url3]) | 3 条记录，sort_order 正确 |
| D3.1 | 保存草稿 | saveDraft(draft_id) | MCP save_draft 成功 + status=SAVED |
| D3.2 | 导出草稿 | exportDraft(draft_id) | 生成 draft_content.json + draft_meta_info.json + status=EXPORTED |
| D3.3 | 版本自增 | 连续导出两次 | version_number 为 1, 2 |
| D4.1 | 版本回滚 | rollbackVersion(draft_id, 1) | 草稿恢复到 v1 状态 |
| D5.1 | 草稿列表（全部） | listDrafts({}) | 返回所有草稿含统计 |
| D5.2 | 按状态过滤 | listDrafts({ status: 'EXPORTED' }) | 只返回已导出的草稿 |
| D5.3 | 关键词搜索 | listDrafts({ keyword: "生日" }) | 返回匹配的草稿 |
| D5.4 | 排序 | listDrafts({ sort: 'updated_at', sortOrder: 'desc' }) | 按更新时间倒序 |
| D6.1 | 删除草稿 | deleteDraft(draft_id) | 级联删除 materials + versions + MCP delete |
| D7.1 | 状态转换（正常） | EMPTY → EDITING → SAVED → EXPORTED | 每步转换正确 |
| D7.2 | 状态转换（非法） | EMPTY → SAVED 直接跳转 | 抛出状态错误 |
| D7.3 | 重新编辑 | EXPORTED → EDITING（添加新素材） | 状态正确回退 |

**验收标准**：能生成可被剪映打开的 draft_content.json

---

#### Phase 3.4 QueryEngine（13 tasks）

> **设计决策汇总**（2026-04-15 深度讨论确认）：
>
> | 决策维度 | 方案 |
> |----------|------|
> | 对话循环 | 方案A：ReAct 循环（AI 自主决定调 Tool 还是回复用户） |
> | 意图识别 | 方案A：LLM Function Calling（Tool 注册为 functions，意图+选择一步完成） |
> | 上下文管理 | 4 层渐进管道（Microcompact → SessionMemory → Autocompact → Reactive） |
> | 消息结构 | Claude Code 同款：内部 Anthropic content blocks + API 适配层转 OpenAI 格式 |
> | 流式响应 | 方案A：文本流式 + Tool 整体（参数积累完再执行） |
> | Tool 编排 | 方案C：混合模式（独立操作可并行，有依赖的按顺序） |
> | REPL | 方案A：完整 REPL（ChatWindow + PromptInput + StatusBar + 虚拟滚动） |
> | 错误处理 | 方案A：简单重试（显示错误信息，用户决定是否重试） |
> | System Prompt | 方案A：动态构建（每次 API 调用时组装） |

##### 3.4.1 消息结构

参考 Claude Code `src/types/message.ts`，内部采用 Anthropic content blocks 格式：

```typescript
// types/message.ts

/** 角色类型 */
export type Role = 'system' | 'user' | 'assistant' | 'tool'

/** Content Block 类型 */
export type ContentBlockType =
  | 'text'
  | 'tool_use'      // assistant 输出的 tool_call
  | 'tool_result'   // tool 执行结果
  | 'thinking'      // 思考过程（部分模型支持）
  | 'image'         // 图片内容

/** Text Block */
export interface TextBlock {
  type: 'text'
  text: string
}

/** Tool Use Block（assistant 消息中的 tool_call） */
export interface ToolUseBlock {
  type: 'tool_use'
  id: string           // 唯一 ID，用于关联 tool_result
  name: string         // Tool 名称，如 'add_videos'
  input: Record<string, unknown>  // Tool 输入参数
}

/** Tool Result Block */
export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string  // 关联的 tool_use ID
  content: string      // 执行结果（成功时）或错误信息（失败时）
  is_error?: boolean
}

/** 内部消息格式 */
export interface ConversationMessage {
  id: string
  role: Role
  content: ContentBlock[]  // content blocks 数组（非 string）
  name?: string           // 用于 tool 消息的 tool_name
  timestamp: number
  metadata?: {
    denied?: boolean       // 权限拒绝标记
    toolName?: string     // tool 角色时的 tool 名称
    finishReason?: string  // assistant 的 finish_reason
  }
}

/** API 层消息格式（OpenAI 兼容） */
export interface ApiMessage {
  role: Role
  content: string | null
  name?: string
  tool_calls?: ApiToolCall[]
  tool_call_id?: string
}

export interface ApiToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string  // JSON 字符串
  }
}
```

**与 Claude Code 的差异**：JY Draft 不需要支持 `thinking` block（思考过程），但需要支持 `image` block（用户上传素材图片）。

##### 3.4.2 API 适配层

参考 Claude Code `src/services/api/openai/`，将内部 Anthropic 格式转换为目标 API 格式：

```typescript
// core/queryEngine/apiAdapter.ts

/**
 * 内部消息 → API 格式
 * 核心转换规则：
 * - tool_use block → tool_calls array（OpenAI 格式）
 * - tool_result block → tool message（role: 'tool'）
 * - content blocks 数组 → 合并为 string 或保持 array
 */
export function toApiFormat(messages: ConversationMessage[]): ApiMessage[] {
  const result: ApiMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const toolCalls: ApiToolCall[] = []
      const textParts: string[] = []

      for (const block of msg.content) {
        if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: typeof block.input === 'string'
                ? block.input
                : JSON.stringify(block.input),
            },
          })
        } else if (block.type === 'text') {
          textParts.push(block.text)
        }
      }

      result.push({
        role: 'assistant',
        content: textParts.join('') || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      })
    } else if (msg.role === 'tool') {
      const content = Array.isArray(msg.content)
        ? msg.content.map(b => b.type === 'text' ? b.text : '').join('')
        : (typeof msg.content === 'string' ? msg.content : '')

      result.push({
        role: 'tool',
        tool_call_id: msg.metadata?.toolUseId,
        content,
      })
    } else if (msg.role === 'user' || msg.role === 'system') {
      const content = Array.isArray(msg.content)
        ? msg.content.map(b => b.type === 'text' ? b.text : '').join('')
        : (typeof msg.content === 'string' ? msg.content : '')

      result.push({ role: msg.role, content })
    }
  }
  return result
}

/**
 * API 响应 → 内部格式
 * 核心转换规则：
 * - tool_calls → tool_use blocks
 * - delta 增量 → 合并到已有 block
 */
export function fromApiFormat(response: ApiResponse): ConversationMessage[] {
  // 见 stream.ts 的流式转换逻辑
}
```

##### 3.4.3 System Prompt 动态构建

参考 Claude Code `src/context.ts`，每次 API 调用时动态组装 System Prompt：

```typescript
// core/queryEngine/systemPrompt.ts

export interface SystemPromptContext {
  userInfo?: { name: string; level: 'beginner' | 'pro' }
  currentDraft?: { id: string; name: string; status: DraftStatus; stats: DraftStats }
  availableTools: ToolDefinition[]
  language: 'zh' | 'en'
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const parts: string[] = []

  // 角色定义
  parts.push(`你是 JY Draft 的 AI 助手，可以通过自然语言帮助用户创建和编辑剪映草稿。`)
  parts.push(`当前语言：${ctx.language === 'zh' ? '中文' : 'English'}`)

  // 当前草稿状态
  if (ctx.currentDraft) {
    parts.push(`当前草稿：「${ctx.currentDraft.name}」（${ctx.currentDraft.status}）`)
    parts.push(`素材统计：视频${ctx.currentDraft.stats.videoCount}个，音频${ctx.currentDraft.stats.audioCount}个，文本${ctx.currentDraft.stats.textCount}个`)
  }

  // 可用工具（注册为 functions）
  if (ctx.availableTools.length > 0) {
    parts.push(`\n## 可用工具\n`)
    for (const tool of ctx.availableTools) {
      parts.push(`- ${tool.name}: ${tool.description}`)
    }
  }

  // 约束
  parts.push(`\n## 约束\n`)
  parts.push(`- 敏感操作（如删除文件、访问特定目录）需要用户确认`)
  parts.push(`- 如果权限被拒绝，告知用户原因并提供解决建议`)
  parts.push(`- 所有文件路径使用 Windows 格式，如 E:\\videos\\test.mp4`)

  return parts.join('\n')
}

/** 工具注册为 functions schema */
export function toolsToFunctions(tools: ToolDefinition[]): FunctionDefinition[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,  // JSON Schema
  }))
}
```

##### 3.4.4 对话上下文与 4 层 Compaction

参考 Claude Code 的 4 层渐进管道（Microcompact → SessionMemory → Autocompact → Reactive）：

```typescript
// core/queryEngine/context.ts

const CONTEXT_THRESHOLDS = {
  BUDGET_WARN: 0.9,     // 90%: Budget 警告
  SNIP: 0.95,           // 95%: 简单截断
  MICRO: 0.98,          // 98%: Microcompact
  SESSION: 0.99,        // 99%: SessionMemory
  AUTO: 1.0,            // ~100%: Autocompact
}

export interface ConversationContext {
  messages: ConversationMessage[]
  systemPrompt: string
  totalTokens: number
  maxTokens: number
}

export class ConversationManager {
  private messages: ConversationMessage[] = []
  private sessionMemoryDir: string  // 如 .jy-draft/sessions/{id}/memory/

  async addMessage(msg: ConversationMessage): Promise<void> {
    this.messages.push(msg)
    await this.checkAndCompact()
  }

  /** Token 计数（简化版，实际用 tiktoken 或类似库） */
  private async countTokens(msgs: ConversationMessage[]): Promise<number> {
    const totalChars = msgs.reduce((sum, m) => sum + JSON.stringify(m).length, 0)
    return Math.ceil(totalChars * 0.25)
  }

  /** 检查是否需要 compaction */
  private async checkAndCompact(): Promise<void> {
    const ratio = this.totalTokens / this.maxTokens

    if (ratio >= CONTEXT_THRESHOLDS.AUTO) {
      await this.autocompact()
    } else if (ratio >= CONTEXT_THRESHOLDS.SESSION) {
      await this.sessionMemory()
    } else if (ratio >= CONTEXT_THRESHOLDS.MICRO) {
      await this.microcompact()
    }
  }

  /** Microcompact：单条 tool_result 原地替换为 placeholder */
  private async microcompact(): Promise<void> {
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i]
      if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 500) {
        const chars = msg.content.length
        msg.content = `[tool_result: ${msg.metadata?.toolName} — ${chars} chars, truncated]`
      }
    }
  }

  /** SessionMemory：批量 tool_result 提取到外部文件 */
  private async sessionMemory(): Promise<void> {
    const toExtract: number[] = []
    let extractStart: number | null = null

    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i]
      if (msg.role === 'tool') {
        if (extractStart === null) extractStart = i
        toExtract.push(i)
      } else if (msg.role === 'assistant' && extractStart !== null) {
        break
      }
    }

    if (toExtract.length === 0) return

    const memoryFile = path.join(this.sessionMemoryDir, `${Date.now()}.json`)
    const originals = toExtract.map(i => ({ index: i, message: this.messages[i] }))
    await writeFile(memoryFile, JSON.stringify(originals, null, 2))

    const summary = `已提取 ${toExtract.length} 条 tool_results 到外部存储: ${memoryFile}`
    this.messages = this.messages.filter((_, i) => !toExtract.includes(i))
    this.messages.push({
      id: generateId(),
      role: 'system',
      content: [{ type: 'text', text: `[SessionMemory] ${summary}` }],
      timestamp: Date.now(),
      isMeta: true,
    })
  }

  /** Autocompact：LLM 摘要压缩 */
  private async autocompact(): Promise<void> {
    const summary = await this.llmSummarize(this.messages)

    const keepCount = 5
    const systemMessages = this.messages.filter(m => m.role === 'system')
    const recentMessages = this.messages.slice(-keepCount)

    this.messages = [
      ...systemMessages,
      {
        id: generateId(),
        role: 'system',
        content: [{ type: 'text', text: `[对话摘要] ${summary}` }],
        timestamp: Date.now(),
        isMeta: true,
      },
      ...recentMessages,
    ]
  }
}
```

**preservePriority（压缩优先级）**：
1. Plan（计划相关内容）最高
2. 近期 assistant 消息（保持连贯性）
3. tool_result（工具执行结果）
4. 用户意图（用户原始请求）
5. 其他文本

##### 3.4.5 Tool 注册与定义

```typescript
// core/queryEngine/toolRegistry.ts

export interface ToolDefinition {
  name: string
  description: string
  parameters: JsonSchema  // JSON Schema for function calling
  handler: ToolHandler
  permission?: PermissionLevel
}

export type ToolHandler = (
  input: Record<string, unknown>,
  context: ToolCallContext
) => Promise<ToolResult>

export interface ToolCallContext {
  draftId?: string
  userId: string
  mcpClient: McpClient
}

/** 工具注册表（MCP Tool + 本地 Tool） */
export const toolRegistry = new Map<string, ToolDefinition>()

/** 注册 MCP Tool */
export function registerMcpTool(mcpTool: McpToolSpec): void {
  toolRegistry.set(mcpTool.name, {
    name: mcpTool.name,
    description: mcpTool.description,
    parameters: mcpTool.inputSchema,
    handler: async (input, ctx) => {
      const result = await ctx.mcpClient.callTool(mcpTool.name, input)
      return { success: true, content: JSON.stringify(result) }
    },
  })
}

/** 注册本地 Tool（如状态查询、上下文构建） */
export function registerLocalTool(def: Omit<ToolDefinition, 'handler'> & {
  handler: (input: Record<string, unknown>, ctx: ToolCallContext) => Promise<ToolResult>
}): void {
  toolRegistry.set(def.name, def)
}
```

**初始注册的工具**：
- `create_draft` — 创建新草稿
- `add_videos` — 添加视频素材
- `add_audios` — 添加音频素材
- `add_texts` — 添加文本素材
- `save_draft` — 保存草稿到 MCP Server
- `export_draft` — 导出草稿为剪映 JSON
- `list_drafts` — 列出草稿列表
- `get_draft` — 获取草稿详情
- `delete_draft` — 删除草稿
- `tts_generate` — TTS 语音合成
- `speech_recognize` — 语音识别

##### 3.4.6 Tool 调用执行器

```typescript
// core/queryEngine/toolExecutor.ts

interface ToolExecuteResult {
  success: boolean
  content: string
  error?: string
}

/** 执行单个 Tool 调用 */
export async function executeToolCall(
  block: ToolUseBlock,
  ctx: ToolCallContext,
  permissionGuard: PermissionGuard
): Promise<ToolResultBlock> {
  const result = await permissionGuard.checkAndExecute(
    block.name,
    block.input,
    async () => {
      const handler = toolRegistry.get(block.name)
      if (!handler) {
        throw new Error(`Tool ${block.name} not found`)
      }
      return await handler.handler(block.input, ctx)
    }
  )

  if (result.denied) {
    return {
      type: 'tool_result',
      tool_use_id: block.id,
      content: `【权限被拒绝】${result.reason}`,
      is_error: true,
    }
  }

  return {
    type: 'tool_result',
    tool_use_id: block.id,
    content: typeof result === 'string' ? result : JSON.stringify(result),
  }
}

/** 混合模式：并行执行独立 Tool，有依赖的按顺序 */
export async function executeToolCallsParallel(
  blocks: ToolUseBlock[],
  ctx: ToolCallContext,
  permissionGuard: PermissionGuard
): Promise<ToolResultBlock[]> {
  const independent = blocks.filter(b => !hasDependency(b, blocks))
  const dependent = blocks.filter(b => hasDependency(b, blocks))

  const independentResults = await Promise.all(
    independent.map(b => executeToolCall(b, ctx, permissionGuard))
  )

  const dependentResults: ToolResultBlock[] = []
  for (const b of dependent) {
    dependentResults.push(await executeToolCall(b, ctx, permissionGuard))
  }

  return [...independentResults, ...dependentResults]
}

function hasDependency(block: ToolUseBlock, allBlocks: ToolUseBlock[]): boolean {
  const draftId = block.input.draft_id
  if (!draftId) return false
  return allBlocks.some(b => b.id !== block.id && b.input.draft_id === draftId)
}
```

##### 3.4.7 权限检查集成

```typescript
// core/queryEngine/permissionGuard.ts

export class PermissionGuard {
  constructor(private permissionManager: PermissionManager) {}

  async checkAndExecute<T>(
    toolName: string,
    input: unknown,
    execute: () => Promise<T>
  ): Promise<T | PermissionDeniedResult> {
    const decision = await this.permissionManager.checkPermission(toolName, input)

    switch (decision.behavior) {
      case 'allow':
        return await execute()

      case 'deny':
        return {
          denied: true,
          reason: decision.message,
          toolName,
          log: { toolName, reason: decision.message, timestamp: Date.now() },
        }

      case 'ask':
        throw new PermissionRequiredError(toolName, decision.options)
    }
  }
}
```

##### 3.4.8 权限拒绝处理

```typescript
// core/queryEngine/permissionDeniedHandler.ts

export interface PermissionDeniedResult {
  denied: true
  reason: string
  toolName: string
  log: { toolName: string; reason: string; timestamp: number }
}

export function handlePermissionDenied(
  result: PermissionDeniedResult,
  conversation: ConversationMessage[]
): HandleResult {
  const friendlyMessage = generateFriendlyMessage(result.reason)

  const deniedMessage: ConversationMessage = {
    id: generateId(),
    role: 'tool',
    content: [{ type: 'tool_result', tool_use_id: '', content: `【权限被拒绝】${friendlyMessage}` }],
    metadata: { denied: true, toolName: result.toolName },
    timestamp: Date.now(),
  }

  const strategy = decideNextStrategy(result.reason)

  return { message: deniedMessage, strategy }
}

function decideNextStrategy(reason: string): 'stop' | 'retry_without_tool' | 'suggest_permission_change' {
  if (reason.includes('session') && reason.includes('expired')) return 'suggest_permission_change'
  if (reason.includes('user_denied')) return 'stop'
  if (reason.includes('denyAll')) return 'suggest_permission_change'
  return 'stop'
}
```

##### 3.4.9 流式响应

```typescript
// core/queryEngine/stream.ts

export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_args'; delta: string }
  | { type: 'tool_call_end' }
  | { type: 'tool_result'; id: string; content: string }
  | { type: 'done' }
  | { type: 'error'; error: string }

/** 流式执行 QueryEngine 主循环 */
export async function* streamQuery(
  userMessage: string,
  ctx: QueryContext
): AsyncGenerator<StreamEvent> {
  const messages = ctx.conversationManager.getMessages()

  const systemPrompt = buildSystemPrompt(ctx.systemPromptContext)

  const userMsg: ConversationMessage = {
    id: generateId(),
    role: 'user',
    content: [{ type: 'text', text: userMessage }],
    timestamp: Date.now(),
  }
  messages.push(userMsg)

  let assistantMsg: ConversationMessage | null = null

  while (true) {
    const apiMessages = toApiFormat([...messages])
    const apiResponse = await ctx.apiClient.chat.completions.create({
      model: ctx.model,
      messages: [systemPrompt, ...apiMessages],
      tools: toolsToFunctions([...toolRegistry.values()]),
      stream: true,
    })

    let currentToolUse: ToolUseBlock | null = null
    let textContent: string[] = []

    for await (const chunk of apiResponse) {
      const delta = chunk.choices[0]?.delta

      if (delta.content) {
        yield { type: 'text', delta: delta.content }
        textContent.push(delta.content)
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.id && !currentToolUse) {
            yield { type: 'tool_call_start', id: tc.id, name: tc.function.name }
            currentToolUse = { type: 'tool_use', id: tc.id, name: tc.function.name, input: {} }
          }
          if (tc.function.arguments) {
            yield { type: 'tool_call_args', delta: tc.function.arguments }
            try {
              currentToolUse.input = JSON.parse(tc.function.arguments)
            } catch {
              // partial JSON，继续累积
            }
          }
        }
      }
    }

    if (!assistantMsg) {
      assistantMsg = {
        id: generateId(),
        role: 'assistant',
        content: [{ type: 'text', text: textContent.join('') }],
        timestamp: Date.now(),
      }
    }

    const toolUseBlocks = (assistantMsg.content as ContentBlock[])
      .filter((b): b is ToolUseBlock => b.type === 'tool_use')

    if (toolUseBlocks.length === 0) {
      messages.push(assistantMsg)
      yield { type: 'done' }
      break
    }

    messages.push(assistantMsg)
    const toolResults = await executeToolCallsParallel(toolUseBlocks, ctx, ctx.permissionGuard)

    for (const tr of toolResults) {
      messages.push({
        id: generateId(),
        role: 'tool',
        content: [tr],
        metadata: { toolUseId: tr.tool_use_id, toolName: tr.tool_use_id },
        timestamp: Date.now(),
      })
      yield { type: 'tool_result', id: tr.tool_use_id, content: tr.content }
    }
  }
}
```

##### 3.4.10 QueryEngine 主类

```typescript
// core/queryEngine/index.ts

export class QueryEngine {
  private conversationManager: ConversationManager
  private permissionGuard: PermissionGuard
  private mcpClient: McpClient
  private apiClient: ApiClient

  constructor(config: QueryEngineConfig) {
    this.conversationManager = new ConversationManager({
      maxTokens: config.maxContextTokens,
      sessionMemoryDir: config.sessionDir,
    })
    this.permissionGuard = new PermissionGuard(config.permissionManager)
    this.mcpClient = config.mcpClient
    this.apiClient = config.apiClient
  }

  /** 发送消息（同步版本） */
  async sendMessage(userMessage: string): Promise<ConversationMessage> {
    const ctx = this.buildContext()
    for await (const event of streamQuery(userMessage, ctx)) {
      // 事件处理
    }
    const messages = this.conversationManager.getMessages()
    return messages[messages.length - 1]
  }

  /** 发送消息（流式版本） */
  sendMessageStream(userMessage: string): AsyncGenerator<StreamEvent> {
    const ctx = this.buildContext()
    return streamQuery(userMessage, ctx)
  }

  private buildContext(): QueryContext {
    return {
      conversationManager: this.conversationManager,
      permissionGuard: this.permissionGuard,
      mcpClient: this.mcpClient,
      apiClient: this.apiClient,
      systemPromptContext: {
        availableTools: [...toolRegistry.values()].map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
        language: 'zh',
        currentDraft: this.currentDraft,
      },
      model: 'glm-4-flash',
    }
  }

  private currentDraft?: { id: string; name: string; status: DraftStatus; stats: DraftStats }
}
```

##### 3.4.11 IPC Query 通道

```typescript
// ipc/query.ts

export const QUERY_IPC_CHANNELS = {
  'query:send': (message: string) => Promise<ConversationMessage>,
  'query:send-stream': (message: string) => void,
  'query:get-history': () => Promise<ConversationMessage[]>,
  'query:clear-history': () => Promise<void>,
  'query:get-context': () => Promise<SystemPromptContext>,
}

export function registerQueryIpcHandlers(ipcMain: IpcMain, engine: QueryEngine): void {
  ipcMain.handle('query:send', async (_, message: string) => {
    return await engine.sendMessage(message)
  })

  ipcMain.on('query:send-stream', async (event, message: string) => {
    for await (const streamEvent of engine.sendMessageStream(message)) {
      event.sender.send('query:stream-event', streamEvent)
      if (streamEvent.type === 'done') break
    }
  })

  ipcMain.handle('query:get-history', async () => engine.getHistory())
  ipcMain.handle('query:clear-history', async () => engine.clearHistory())
}
```

##### 3.4.12 Conversation Store

```typescript
// stores/conversation.ts

export interface ConversationState {
  messages: ConversationMessage[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  currentDraftContext: SystemPromptContext | null
}

export const useConversationStore = defineStore('conversation', {
  state: (): ConversationState => ({
    messages: [],
    isLoading: false,
    isStreaming: false,
    error: null,
    currentDraftContext: null,
  }),

  actions: {
    async sendMessage(content: string) {
      this.isLoading = true
      this.error = null
      try {
        const result = await this.invoke('query:send', content)
        this.messages.push({
          id: generateId(), role: 'user',
          content: [{ type: 'text', text: content }], timestamp: Date.now(),
        })
        this.messages.push(result)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Unknown error'
      } finally {
        this.isLoading = false
      }
    },

    startStreamMessage(content: string) {
      this.isStreaming = true
      this.messages.push({
        id: generateId(), role: 'user',
        content: [{ type: 'text', text: content }], timestamp: Date.now(),
      })
      this.invoke('query:send-stream', content)
    },

    clearHistory() {
      this.messages = []
      this.invoke('query:clear-history')
    },
  },

  getters: {
    recentMessages: (state) => state.messages.slice(-20),
    hasError: (state) => state.error !== null,
  },
})
```

##### 3.4.13 REPL 组件

参考 Claude Code REPL 设计（Vue 3 Composition API）：

```vue
<!-- components/REPL/ChatWindow.vue -->
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

interface Props {
  messages: ConversationMessage[]
  isStreaming: boolean
}

const props = defineProps<Props>()
const bottomRef = ref<HTMLElement>()

watch(() => props.messages.length, async () => {
  await nextTick()
  bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
})
</script>

<template>
  <div class="chat-window">
    <VirtualList :items="props.messages" :height="600">
      <template #default="{ item }">
        <MessageRow :key="item.id" :message="item" />
      </template>
    </VirtualList>
    <StreamingIndicator v-if="props.isStreaming" />
    <div ref="bottomRef" />
  </div>
</template>
```

```vue
<!-- components/REPL/MessageRow.vue -->
<script setup lang="ts">
interface Props {
  message: ConversationMessage
}

const props = defineProps<Props>()
</script>

<template>
  <UserMessage v-if="props.message.role === 'user'" :content="props.message.content" />
  <AssistantMessage v-else-if="props.message.role === 'assistant'" :content="props.message.content" />
  <ToolResultMessage v-else-if="props.message.role === 'tool'"
    :content="props.message.content"
    :is-denied="props.message.metadata?.denied" />
</template>
```

```vue
<!-- components/REPL/PromptInput.vue -->
<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  send: [text: string]
  interrupt: []
}>()

const value = ref('')
const history = ref<string[]>([])

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    const text = value.value.trim()
    if (text) {
      emit('send', text)
      history.value.push(text)
      value.value = ''
    }
  } else if (e.key === 'c' && e.ctrlKey) {
    emit('interrupt')
  }
}
</script>

<template>
  <div class="prompt-input">
    <span class="prompt-prefix">❯</span>
    <textarea v-model="value" @keydown="handleKeyDown"
      :disabled="props.disabled" rows="1" autofocus />
  </div>
</template>
```

```vue
<!-- components/REPL/StatusBar.vue -->
<script setup lang="ts">
interface Props {
  draftContext: SystemPromptContext | null
  model: string
  tokenRatio?: number
}

const props = defineProps<Props>()
</script>

<template>
  <div class="status-bar">
    <span v-if="props.draftContext?.currentDraft">
      📝 {{ props.draftContext.currentDraft.name }} ({{ props.draftContext.currentDraft.status }})
    </span>
    <span>{{ props.model }}</span>
    <span v-if="props.tokenRatio !== undefined">
      Context: {{ Math.round(props.tokenRatio * 100) }}%
    </span>
  </div>
</template>
```

##### 3.4.14 任务拆解（13 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P3.4.1 | 消息结构 | `types/message.ts` | - | ConversationMessage + ContentBlock + ApiMessage 接口完成 |
| P3.4.2 | API 适配层 | `core/queryEngine/apiAdapter.ts` | P3.4.1 | toApiFormat / fromApiFormat 转换正确 |
| P3.4.3 | System Prompt 动态构建 | `core/queryEngine/systemPrompt.ts` | P3.4.1 | buildSystemPrompt 正确包含工具列表、草稿状态等 |
| P3.4.4 | 对话上下文与 Compaction | `core/queryEngine/context.ts` | P3.4.1 | 4 层压缩管道正常工作，Token 计数准确 |
| P3.4.5 | Tool 注册与定义 | `core/queryEngine/toolRegistry.ts` | P3.3.3 | MCP Tool + 本地 Tool 正确注册到 registry |
| P3.4.6 | Tool 调用执行器 | `core/queryEngine/toolExecutor.ts` | P3.4.5, P3.1.3 | executeToolCallsParallel 混合模式正常 |
| P3.4.7 | 权限检查集成 | `core/queryEngine/permissionGuard.ts` | P3.1.3, P3.4.6 | Tool 调用前通过 PermissionManager 检查 |
| P3.4.8 | 权限拒绝处理 | `core/queryEngine/permissionDeniedHandler.ts` | P3.4.7 | 拒绝消息友好、可选策略正确 |
| P3.4.9 | 流式响应 | `core/queryEngine/stream.ts` | P3.4.6 | AsyncIterable 流式返回 text/tool_call/tool_result |
| P3.4.10 | QueryEngine 主类 | `core/queryEngine/index.ts` | P3.4.4,6,7,8 | sendMessage / sendMessageStream 正常 |
| P3.4.11 | IPC Query 通道 | `ipc/query.ts` | P3.4.10 | query:send / query:send-stream 通道正常 |
| P3.4.12 | Conversation Store | `stores/conversation.ts` | P3.4.11 | messages / isStreaming / error 状态正确 |
| P3.4.13 | REPL 集成 | `components/REPL/` | P3.4.12 | ChatWindow + PromptInput + StatusBar 完整 |
| P3.4.14 | 集成测试 | `__tests__/queryEngine/` | P3.4.13 | ReAct 循环全流程通过 |

**验收标准**：
- ReAct 循环正常工作：AI 收到消息 → 判断需要调 Tool → 执行 → 收到结果 → 继续或结束
- Function Calling 正常：MCP Tool 注册为 functions，AI 输出 tool_calls 格式正确
- 流式响应正常：文本实时显示，Tool 调用参数完整后才执行
- 权限集成正常：敏感 Tool 被拒绝时，AI 能感知并给出友好提示
- Compaction 正常：长对话自动压缩，不丢关键上下文

---

#### Phase 3 开发顺序（4 轮迭代）

```
第1轮迭代（基础层）
├── P3.1.1 权限基础结构
├── P3.2.1 目录结构设计
├── P3.2.2 数据库表设计
├── P3.3.1 草稿状态机与类型（DraftStatus 5枚举 + DRAFT_TRANSITIONS）
├── P3.3.2 草稿数据库表（draft_main + draft_materials + draft_versions）
└── P3.4.1 消息结构

第2轮迭代（核心逻辑）
├── P3.1.2 权限存储表
├── P3.1.3 权限核心逻辑
├── P3.2.3 路径工具函数
├── P3.2.4~6 素材元数据提取
├── P3.2.7 添加素材 API
├── P3.3.3 创建草稿（MCP create_draft 即时交互）
├── P3.3.4 MaterialInfo 构建器（客户端元数据提取 + Info 构建）
└── P3.4.2 对话上下文

第3轮迭代（IPC 通道）
├── P3.1.4 IPC 权限通道
├── P3.1.6 权限规则管理
├── P3.2.8~12 素材查询/搜索/删除/IPC
├── P3.3.5 添加素材（统一 addMaterial）
├── P3.3.6~7 草稿保存/导出（MCP save + generate_jianying_draft）
├── P3.3.8~10 版本管理/列表/删除
├── P3.4.3~6 System Prompt / Compaction / Tool注册 / 执行器

第4轮迭代（UI + Store + 测试）
├── P3.1.5 权限弹窗 UI
├── P3.1.7 权限 Store
├── P3.2.13 Material Store
├── P3.3.11 IPC 草稿通道
├── P3.3.12 Draft Store
├── P3.4.7~9 权限检查 / 拒绝处理 / 流式响应
├── P3.4.10~12 QueryEngine 主类 / IPC / Conversation Store
├── P3.4.13 REPL 集成
└── P3.1.8 / P3.2.14 / P3.3.13 / P3.4.14 集成测试
```

---

### Phase 4：基础设施与发布（Windows）

> **优先级**：基础设施（测试 + 错误处理 + 路径优化）> 打包发布 > ~~特效/滤镜~~（移至 Phase 5）

#### 4.1 技术决策

| 问题 | 决策 |
|------|------|
| 测试策略 | 真实 API（沙盒），使用 bailian/MiniMax 沙盒 Key |
| AI Key 管理 | 用户自配，App 不内置 Key |
| 特效/滤镜/关键帧 | 移至 Phase 5 |
| 发布平台 | Windows x64 优先，macOS 后续版本 |

---

#### Phase 4.1：核心 ReAct 循环测试（6 tasks）

> 使用真实 AI API（沙盒环境）验证完整 ReAct 循环

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P4.1.1 | 沙盒测试环境搭建 | `.env.sandbox` + `tests/sandbox/` | - | 沙盒 API Key 可用，测试账号可登录 |
| P4.1.2 | QueryEngine 单元测试 | `__tests__/queryEngine/message.test.ts` | P3.4.1 | 消息构建 + API 适配层 + 流式解析通过 |
| P4.1.3 | ToolExecutor 单元测试 | `__tests__/queryEngine/executor.test.ts` | P3.4.6 | 并行/串行执行 + 依赖检测 + 权限模拟通过 |
| P4.1.4 | IPC Query 通道集成测试 | `__tests__/ipc/query.test.ts` | P3.4.11 | send / send-stream 通道正常 |
| P4.1.5 | 权限流程集成测试 | `__tests__/queryEngine/permission.test.ts` | P3.1.7, P3.4.7 | 正常授权/拒绝/记住/会话过期全流程通过 |
| P4.1.6 | 完整 ReAct 循环 E2E 测试 | `__tests__/e2e/react-loop.test.ts` | P4.1.2~5 | AI → Tool → Result → AI → FinalResponse 全流程通过 |

**沙盒测试环境配置**：

```bash
# .env.sandbox
BAILIAN_API_KEY=sandbox_xxx
BAILIAN_API_BASE=https://api-sandbox.bailian.com
MINIMAX_API_KEY=sandbox_xxx
MINIMAX_API_BASE=https://api-sandbox.minimax.io
```

**E2E 测试用例**：

| 用例 | 输入 | 期望 |
|------|------|------|
| U1 | "帮我创建一个 1920x1080 的草稿" | create_draft 被调用，返回 draft_id |
| U2 | "添加 E:\test.mp4 到草稿" | add_videos 被调用，素材路径正确解析 |
| U3 | "草稿里有哪些素材" | get_draft_materials 被调用，返回素材列表 |
| U4 | "保存草稿" | save_draft 被调用，JSON 正确生成 |
| U5 | "删除刚才的草稿" | delete_draft 被调用，确认删除 |

---

#### Phase 4.2：素材路径处理优化（3 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P4.2.1 | Windows 路径规范化工具 | `utils/path.ts` | - | normalize / isAbsolute / resolve 正确处理 Windows 路径 |
| P4.2.2 | MCP Server 路径校验增强 | `core/mcp/handlers/material.py` | P1.3 | 校验失败返回友好错误，不直接崩溃 |
| P4.2.3 | Electron 路径解析统一 | `src/utils/path.ts` | P2.5 | MaterialManager 使用统一路径工具函数 |

**Windows 路径处理规范**：

```typescript
// 正确格式
"E:\\videos\\test.mp4"
"E:/videos/test.mp4"
"file:///E:/videos/test.mp4"

// 工具函数
normalizePath("E:\\videos\\test.mp4") → "E:\\videos\\test.mp4"
toFileUrl("E:\\videos\\test.mp4") → "file:///E:/videos/test.mp4"
fromFileUrl("file:///E:/videos/test.mp4") → "E:\\videos\\test.mp4"
```

---

#### Phase 4.3：错误处理与提示（5 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P4.3.1 | 统一 ErrorCode 枚举 | `types/error.ts` | - | 错误码覆盖 MCP / IPC / UI 各层 |
| P4.3.2 | MCP Server 错误转换 | `core/mcp/errors.py` | P1.3 | 所有异常转换为标准错误格式 |
| P4.3.3 | IPC 层错误传递 | `ipc/errors.ts` | P3.4.11 | 错误通过 IPC 通道正确传递 |
| P4.3.4 | REPL 错误展示组件 | `components/REPL/ErrorMessage.vue` | P3.4.13 | 友好中文提示，非英文原始错误 |
| P4.3.5 | 错误恢复策略 | `core/queryEngine/errorRecovery.ts` | P3.4.8 | Simple Retry：显示错误 + 询问用户是否重试 |

**ErrorCode 枚举设计**：

```typescript
// types/error.ts
export enum ErrorCode {
  // MCP 层错误（服务端）
  MCP_DRAFT_NOT_FOUND = "MCP_DRAFT_NOT_FOUND",      // 草稿不存在
  MCP_MATERIAL_NOT_FOUND = "MCP_MATERIAL_NOT_FOUND", // 素材不存在
  MCP_PATH_INVALID = "MCP_PATH_INVALID",           // 路径无效
  MCP_AUTH_FAILED = "MCP_AUTH_FAILED",            // 认证失败
  MCP_PERMISSION_DENIED = "MCP_PERMISSION_DENIED", // 权限拒绝
  MCP_INTERNAL_ERROR = "MCP_INTERNAL_ERROR",       // 内部错误

  // IPC 层错误（客户端）
  IPC_CONNECTION_FAILED = "IPC_CONNECTION_FAILED",  // IPC 连接失败
  IPC_TIMEOUT = "IPC_TIMEOUT",                     // 调用超时
  IPC_CHANNEL_NOT_FOUND = "IPC_CHANNEL_NOT_FOUND",  // 通道不存在

  // AI 层错误
  AI_API_ERROR = "AI_API_ERROR",                   // API 调用失败
  AI_RATE_LIMIT = "AI_RATE_LIMIT",                 // 限流
  AI_INVALID_RESPONSE = "AI_INVALID_RESPONSE",      // 响应格式错误

  // 通用错误
  UNKNOWN = "UNKNOWN",
}

export interface AppError {
  code: ErrorCode;
  message: string;  // 中文友好提示
  detail?: string; // 英文技术细节
  retryable: boolean;
}
```

**Simple Retry 流程**：

```
Tool 调用失败 → 显示友好错误（中文）→ 询问用户是否重试
                                    │
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
                  重试                           跳过
                    │                               │
              重新执行 Tool                    继续后续流程
```

---

#### Phase 4.4：聊天窗口 @素材引用（2 tasks）

> 用户在 REPL 输入框中输入 `@` 时，弹出素材自动完成列表

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P4.4.1 | @素材自动完成组件 | `components/REPL/MaterialAutocomplete.vue` | P3.4.13, P3.2.13 | 输入 `@` 弹出素材列表，支持模糊搜索 |
| P4.4.2 | 素材引用解析与渲染 | `utils/materialRef.ts` + `components/REPL/MaterialRef.vue` | P4.4.1 | `@[video:test.mp4]` 正确解析并渲染为可点击引用 |

**@素材引用交互流程**：

```
用户输入 "@" → 弹出素材列表（模糊搜索）→ 选择素材 → 插入引用
                                                              ↓
                                                    @[video:E:\test.mp4]
                                                              ↓
用户发送消息 → AI 收到引用 → 解析为实际素材信息 → 执行对应 Tool
```

**素材引用格式设计**：

```typescript
// 引用格式
@[video:E:\videos\test.mp4]
@[audio:E:\music\bgm.mp3]
@[text:字幕内容]
@[material:material_id]

// 解析后的消息结构
interface MessageWithMaterialRef {
  text: "帮我添加 @[video:E:\test.mp4] 到草稿",
  materialRefs: [
    { type: "video", path: "E:\\test.mp4", raw: "@[video:E:\\test.mp4]" }
  ]
}
```

**MaterialAutocomplete 组件**：

```tsx
// 触发：用户输入 @ 字符后
// 显示：浮动下拉列表，显示素材名称 + 路径 + 类型图标
// 搜索：实时模糊匹配素材名称
// 选择：回车或点击选中，插入引用字符串
// 关闭：Esc 或点击外部
```

---

#### Phase 4.5：Windows 打包发布（5 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P4.5.1 | electron-builder 配置 | `electron-builder.yml` | P2.9 | 配置文件正确，支持 Windows |
| P4.5.2 | Windows x64 构建配置 | `package.json` | P4.5.1 | `bunx electron-builder --win` 成功 |
| P4.5.3 | App 图标和名称 | `build/icon.ico` + `productName` | P4.5.1 | 打包后 .exe 显示正确图标和名称 |
| P4.5.4 | 构建脚本 | `scripts/build.sh` / `.bat` | P4.5.2 | 一键构建，输出 `dist/` |
| P4.5.5 | 用户 API Key 配置界面 | `components/Settings/APIKeyConfig.vue` | P2.7 | 用户可填入自己的 Key，App 保存到本地 |

**electron-builder.yml 配置**：

```yaml
# electron-builder.yml
appId: com.jydraft.app
productName: JY Draft
copyright: Copyright © 2024
directories:
  output: dist
  buildResources: build

win:
  target:
    - target: nsis
      arch:
        - x64
  icon: build/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

**用户 API Key 配置界面**：

```
┌─────────────────────────────────────────┐
│  API Key 配置                            │
├─────────────────────────────────────────┤
│                                         │
│  模型提供商：  ○ bailian  ○ MiniMax      │
│                                         │
│  API Key：   [________________________] │
│                                         │
│  API Base：  [________________________] │
│              （可选，默认使用官方地址）      │
│                                         │
│  [保存配置]        [测试连接]             │
│                                         │
└─────────────────────────────────────────┘
```

**构建流程**：

```bash
# 开发构建
bun run build:electron

# Windows 发布构建
bunx electron-builder --win --x64

# 输出
dist/
├── JY Draft Setup 1.0.0.exe  # NSIS 安装包
└── JY Draft-1.0.0.exe        # 独立可执行文件
```

---

#### Phase 4 任务总览（21 tasks）

| Phase | 任务数 | 核心交付 |
|-------|--------|----------|
| P4.1 核心 ReAct 循环测试 | 6 | E2E 测试通过，沙盒验证 |
| P4.2 素材路径处理优化 | 3 | Windows 路径工具 + 统一解析 |
| P4.3 错误处理与提示 | 5 | ErrorCode + 友好提示 + Simple Retry |
| P4.4 @素材引用 | 2 | @触发自动完成 + 引用解析渲染 |
| P4.5 Windows 打包发布 | 5 | .exe 安装包 + Key 配置界面 |
| **合计** | **21** | 可发布 Windows 版本 |

---

#### Phase 4 开发顺序（2 轮迭代）

```
第1轮迭代（测试 + 路径 + 错误）
├── P4.1.1 沙盒测试环境
├── P4.1.2 QueryEngine 单测
├── P4.1.3 ToolExecutor 单测
├── P4.2.1 Windows 路径工具
├── P4.2.2 MCP 路径校验
├── P4.3.1 ErrorCode 枚举
├── P4.3.2 MCP 错误转换
├── P4.3.4 REPL 错误展示
├── P4.3.5 Simple Retry
└── P4.4.1 @素材自动完成

第2轮迭代（集成 + 打包 + 引用）
├── P4.1.4 IPC 通道测试
├── P4.1.5 权限流程测试
├── P4.1.6 E2E ReAct 循环
├── P4.2.3 Electron 路径统一
├── P4.3.3 IPC 错误传递
├── P4.4.2 素材引用解析渲染
├── P4.5.1 electron-builder 配置
├── P4.5.2 Windows x64 构建
├── P4.5.3 App 图标和名称
├── P4.5.4 构建脚本
└── P4.5.5 API Key 配置界面
```

---

### Phase 5：特效/滤镜/关键帧（完整版）

> **用户交互模式**：先描述再执行（AI 描述操作 → 用户确认 → 执行）
> **AI 辅助选择**：AI 理解用户意图 → 推荐 2-3 个选项 → 用户确认
> **UI 策略**：REPL 自然语言优先，Phase 5 末期做最小化特效轨道可视化

#### 5.1 技术决策

| 问题 | 决策 |
|------|------|
| 特效/滤镜/关键帧/转场/音频特效 | Phase 5 全部实现 |
| AI 辅助选择形式 | AI 推荐 2-3 个选项，用户确认后再执行 |
| 用户确认形式 | 先描述再执行（AI 描述操作，用户说「好」或「是」确认） |
| 转场 AI 推荐 | 用户可指定类型，AI 也可根据内容分析推荐，用户确认后应用 |
| 音频特效优先级 | 音频特效（变声）先于音频关键帧（音量动画） |
| 特效 UI | REPL 自然语言控制，Phase 5 末期做最小化特效轨道 |

---

#### Phase 5.1：滤镜/特效 MCP 增强（6 tasks）

> 在 Phase 1 的 MCP handler 基础上升级，增加 AI 语义匹配能力

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.1.1 | 升级 generate_video_filter handler | `core/mcp/handlers/effect.py` | P1.3 | 支持 intensity 参数，支持 segment_ids + segment_index |
| P5.1.2 | 升级 generate_video_effect handler | `core/mcp/handlers/effect.py` | P1.3 | 支持 params 数组，支持多特效叠加 |
| P5.1.3 | list_filter_presets AI 增强 | `core/mcp/handlers/effect.py` | P5.1.1 | 支持语义搜索：「复古」「电影感」「暖色」→ 匹配多个预设 |
| P5.1.4 | list_video_effect_presets AI 增强 | `core/mcp/handlers/effect.py` | P5.1.2 | 支持语义搜索：「故障」「抖动」「模糊」→ 匹配多个预设 |
| P5.1.5 | 滤镜/特效推荐 AI Prompt | `core/ai/effect_recommend.py` | P5.1.3,4 | 用户描述意图 → AI 返回 2-3 个推荐 + 理由 |
| P5.1.6 | 滤镜/特效 MCP 单元测试 | `__tests__/mcp/effect.test.ts` | P5.1.1,2 | 生成/查询/AI 匹配全通过 |

**AI 语义匹配设计**：

```typescript
// 语义搜索映射（滤镜示例）
const filterSemanticMap = {
  "复古": ["复古", "胶片", "回忆", "老照片", "暖色"],
  "电影感": ["电影", "冷色", "对比度", "饱和度", "情绪"],
  "清新": ["奶油", "蓝调", "通透", "明亮"],
  "黑白": ["黑白", "灰度", "复古黑白"],
}

// AI 推荐 Prompt（简化）
const filterRecommendPrompt = `
用户想要：{userIntent}
可选滤镜：{presetList}
请推荐 2-3 个最合适的，给出理由。
格式：1. 滤镜名 - 理由
`
```

**MCP Tool 签名（升级后）**：

```typescript
// 生成滤镜
generate_video_filter(
  filter_type_name: string,      // 可为中文名或英文名
  intensity?: number,              // 0-100，默认 100
  segment_ids?: string[],         // 素材片段 ID
  segment_index?: number[],       // 素材位置（从 1 开始）
)

// AI 推荐滤镜（新增 Tool）
recommend_filters(
  intent: string,                 // 用户意图描述，如「复古电影感」
  context?: string                // 上下文，可选
): { recommendations: FilterRecommendation[] }

interface FilterRecommendation {
  name: string;                  // 滤镜名称
  reason: string;                 // 推荐理由
  confidence: number;             // 置信度 0-1
  preview_url?: string;           // 预览图 URL（如果有）
}
```

---

#### Phase 5.2：关键帧 MCP（4 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.2.1 | 升级 generate_keyframe handler | `core/mcp/handlers/keyframe.py` | P1.3 | 支持全部 9 种属性（位置/缩放/旋转/透明度/饱和度/对比度/亮度/音量） |
| P5.2.2 | 升级 generate_audio_keyframe handler | `core/mcp/handlers/keyframe.py` | P1.3 | 支持音量渐变（渐入/渐出） |
| P5.2.3 | 关键帧属性 AI 描述 | `core/ai/keyframe_describe.py` | P5.2.1 | 「渐入效果」→ `{property: "alpha", time_offset: [0], value: [0→1]}` |
| P5.2.4 | 关键帧 MCP 单元测试 | `__tests__/mcp/keyframe.test.ts` | P5.2.1,2 | 生成/查询/AI 描述全通过 |

**KeyframeProperty 支持的属性**：

| 属性 | 中文名 | 值范围 | 常见用法 |
|------|--------|--------|----------|
| `position_x` | X轴位置 | 像素值 | 左移/右移 |
| `position_y` | Y轴位置 | 像素值 | 上移/下移 |
| `rotation` | 旋转 | 度数 | 顺时针旋转 |
| `scale_x` | X轴缩放 | 0.0-10.0 | 横向拉伸 |
| `scale_y` | Y轴缩放 | 0.0-10.0 | 纵向拉伸 |
| `uniform_scale` | 等比缩放 | 0.0-10.0 | 放大/缩小 |
| `alpha` | 透明度 | 0.0-1.0 | 淡入/淡出 |
| `saturation` | 饱和度 | -1.0-1.0 | 增强/减弱色彩 |
| `contrast` | 对比度 | -1.0-1.0 | 增强/减弱对比 |
| `brightness` | 亮度 | -1.0-1.0 | 增亮/变暗 |
| `volume` | 音量 | 0.0-10.0 | 渐强/渐弱 |

**AI 关键帧描述示例**：

```
用户：「给这段视频加一个淡入效果」
AI 理解：alpha 从 0 渐变到 1
输出：{
  property: "alpha",
  time_offset: [0],
  value: [0, 1],
  segment_index: [1]
}

用户：「让字幕从左边飞进来」
AI 理解：position_x 从 -1920 渐变到 0（假设 1920x1080）
输出：{
  property: "position_x",
  time_offset: [0, 1000000],  // 0-1秒
  value: [-1920, 0],
  segment_index: [1]
}
```

---

#### Phase 5.3：音频特效 MCP（3 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.3.1 | 升级 generate_audio_effect handler | `core/mcp/handlers/audio.py` | P1.3 | 支持大叔/女生/机器人/回音等变声特效 |
| P5.3.2 | 音频变声 AI 推荐 | `core/ai/audio_effect_recommend.py` | P5.3.1 | 「给旁白加一个低沉的声音」→ 推荐「大叔」特效 |
| P5.3.3 | 音频特效 MCP 单元测试 | `__tests__/mcp/audio.test.ts` | P5.3.1,2 | 生成/AI 推荐全通过 |

**音频特效类型**：

| 特效名 | 中文名 | 适用场景 |
|--------|--------|----------|
| `大叔` | 大叔音 | 旁白、讲述 |
| `女生` | 女生音 | 旁白、对话 |
| `机器人` | 机器人音 | 特效、对话 |
| `回音` | 回音效果 | 特效、空间感 |
| `背景音乐增强` | BGM 增强 | 背景音乐 |

---

#### Phase 5.4：转场 MCP（3 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.4.1 | 升级 generate_transition handler | `core/mcp/handlers/transition.py` | P1.3 | 支持转场类型 + 时长参数 |
| P5.4.2 | 转场 AI 内容分析推荐 | `core/ai/transition_recommend.py` | P5.4.1 | AI 分析相邻素材内容，推荐最适合的转场 |
| P5.4.3 | 转场 MCP 单元测试 | `__tests__/mcp/transition.test.ts` | P5.4.1,2 | 生成/AI 推荐全通过 |

**转场推荐逻辑**：

```python
# AI 内容分析推荐（简化版）
def recommend_transition(segment_a, segment_b):
    """
    segment_a: 素材A的元数据 {type: "video"/"image", duration: 微秒, has_audio: bool}
    segment_b: 素材B的元数据
    """
    # 基于素材类型推荐
    if segment_a["type"] == "video" and segment_b["type"] == "image":
        return "推镜"  # 视频 → 图片，用推镜

    if segment_a["type"] == "image" and segment_b["type"] == "video":
        return "叠化"  # 图片 → 视频，用叠化

    # 默认推荐
    return "叠化"
```

**转场预设类型**：

| 转场名 | 中文名 | 适用场景 |
|--------|--------|----------|
| `叠化` | Dissolve | 通用，柔和过渡 |
| `推镜` | Push | 视频→图片/图片→视频 |
| `闪黑` | Flash | 节奏感切换 |
| `旋转` | Rotate | 动感和趣味 |
| `缩放` | Zoom | 强调重点 |

---

#### Phase 5.5：统一确认流程（3 tasks）

> 实现「先描述再执行」的用户体验，所有特效操作统一走此流程

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.5.1 | 统一确认消息格式 | `core/queryEngine/effectConfirmation.ts` | P3.4.8 | 滤镜/特效/关键帧/转场/音频特效统一使用同一种确认格式 |
| P5.5.2 | REPL 推荐展示组件 | `components/REPL/EffectRecommendation.vue` | P5.5.1, P3.4.13 | 显示 AI 推荐列表，用户可输入数字选择或输入自定义 |
| P5.5.3 | 确认超时处理 | `core/queryEngine/effectConfirmation.ts` | P5.5.1 | 30 秒无响应自动取消，提示用户 |

**统一确认消息格式**：

```
┌─────────────────────────────────────────────────────────────┐
│ 🎬 滤镜推荐                                                  │
├─────────────────────────────────────────────────────────────┤
│ 根据「复古电影感」为你推荐以下滤镜：                            │
│                                                             │
│   1. 复古 (confidence: 92%)                                  │
│      └─ 理由：暖色调 + 高对比度，适合怀旧场景                  │
│                                                             │
│   2. 胶片 (confidence: 78%)                                 │
│      └─ 理由：颗粒感 + 偏黄，模拟老电影效果                   │
│                                                             │
│   3. 情绪 (confidence: 65%)                                  │
│      └─ 理由：低饱和度 + 暗角，营造电影氛围                   │
│                                                             │
│ 请输入数字选择（1-3），或输入自定义描述：                       │
└─────────────────────────────────────────────────────────────┘
```

**用户确认流程**：

```
用户：「给视频加一个复古滤镜」
         │
         ▼
AI 理解意图 → 调用 recommend_filters("复古") → 获取推荐列表
         │
         ▼
显示确认界面 → 用户输入「1」选择「复古」
         │
         ▼
AI 调用 generate_video_filter("复古", intensity=80)
         │
         ▼
显示执行结果：「✅ 已为素材[1]应用『复古』滤镜，强度 80%」
```

---

#### Phase 5.6：E2E 测试 + 最小化 UI（3 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P5.6.1 | 特效全流程 E2E 测试 | `__tests__/e2e/effects.test.ts` | P5.1~5 | 滤镜→特效→关键帧→转场→音频特效全流程通过 |
| P5.6.2 | 时间线特效轨道 UI | `components/Timeline/EffectTrack.vue` | P5.6.1 | 最小化版本：显示特效图标，不支持拖拽 |
| P5.6.3 | 特效 REPL 自然语言测试 | `__tests__/e2e/repl-effects.test.ts` | P5.5.2 | 「加复古滤镜」「做淡入效果」「加转场」等自然语言正确执行 |

**EffectTrack 最小化 UI**：

```
┌──────────────────────────────────────────────────────────┐
│ V1  ●───●───●───[🎨复古 80%]───●───[🎬故障]───●───●     │
│ A1  ●───●───●───[🔊渐强]───●───●───●───●───●           │
│ T1  ●───●───[📝字幕]───●───●───●───●───●───●           │
└──────────────────────────────────────────────────────────┘
  └─ 特效轨道只显示特效图标和类型名称，点击弹出详情
```

---

#### Phase 5 任务总览（19 tasks）

| Phase | 任务数 | 核心交付 |
|-------|--------|----------|
| P5.1 滤镜/特效 MCP 增强 | 6 | 100+ 预设可 AI 语义搜索 |
| P5.2 关键帧 MCP | 4 | 9 种属性动画 + AI 描述 |
| P5.3 音频特效 MCP | 3 | 4 种变声特效 + AI 推荐 |
| P5.4 转场 MCP | 3 | 转场生成 + AI 内容分析推荐 |
| P5.5 统一确认流程 | 3 | 先描述再执行 + 推荐展示 |
| P5.6 E2E + 最小化 UI | 3 | 全流程 E2E + 特效轨道 |
| **合计** | **19** | 特效/滤镜/关键帧完整功能 |

---

#### Phase 5 开发顺序（3 轮迭代）

```
第1轮迭代（MCP 核心）
├── P5.1.1 generate_video_filter handler 升级
├── P5.1.2 generate_video_effect handler 升级
├── P5.1.3 list_filter_presets AI 增强
├── P5.1.4 list_video_effect_presets AI 增强
├── P5.2.1 generate_keyframe handler 升级
├── P5.2.2 generate_audio_keyframe handler 升级
├── P5.3.1 generate_audio_effect handler 升级
└── P5.4.1 generate_transition handler 升级

第2轮迭代（AI 推荐 + 确认）
├── P5.1.5 滤镜/特效推荐 AI Prompt
├── P5.1.6 滤镜/特效 MCP 单元测试
├── P5.2.3 关键帧属性 AI 描述
├── P5.2.4 关键帧 MCP 单元测试
├── P5.3.2 音频变声 AI 推荐
├── P5.3.3 音频特效 MCP 单元测试
├── P5.4.2 转场 AI 内容分析推荐
├── P5.4.3 转场 MCP 单元测试
├── P5.5.1 统一确认消息格式
├── P5.5.2 REPL 推荐展示组件
└── P5.5.3 确认超时处理

第3轮迭代（E2E + UI）
├── P5.6.1 特效全流程 E2E 测试
├── P5.6.2 时间线特效轨道 UI
└── P5.6.3 特效 REPL 自然语言测试
```

---

### Phase 6：Skill 系统（参考 Claude Code Skill 架构）

> **借鉴 Claude Code 的 Skill 系统**：Skill 是一种用户可通过 `/slash` 命令触发的、复杂多步骤流程的封装。与 Tool（原子操作）不同，Skill 是 Tool 的消费者，内部可编排多个 Tool 调用来完成复杂任务。JY Draft 将 Skill 系统作为用户扩展能力的核心机制，让用户可以通过自然语言或斜杠命令触发预定义/自定义的视频编辑工作流。

#### 6.1 Skill 系统架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     JY Draft Skill 系统                          │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ Skill 加载器  │   │ Skill 执行器  │   │ Skill 保护（Compaction）│ │
│  │ (发现+解析)   │   │ (inline/fork) │   │ (invokedSkills Map)  │ │
│  └──────┬──────┘   └──────┬───────┘   └──────────┬───────────┘ │
│         │                 │                       │              │
│  ┌──────┴─────────────────┴───────────────────────┴───────────┐ │
│  │                    SkillTool (QueryEngine 集成)              │ │
│  └────────────────────────┬───────────────────────────────────┘ │
│                           │                                      │
│  ┌────────────────────────┴───────────────────────────────────┐ │
│  │             内置 Skills / 用户自定义 Skills                    │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │ /batch   │ │ /analyze │ │ /template│ │ /我的工作流   │  │ │
│  │  │ 批量处理  │ │ 素材分析  │ │ 模板应用 │ │ (用户自定义) │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2 技术决策

| 问题 | 决策 | 说明 |
|------|------|------|
| Skill 执行模式 | inline 为主，fork 可选 | 视频编辑是多轮交互，inline 保留完整上下文；独立批处理可用 fork |
| Skill 存储位置 | `.jy-draft/skills/` | 用户级：`~/.jy-draft/skills/`；项目级：`项目目录/.jy-draft/skills/` |
| Skill 格式 | `SKILL.md`（frontmatter + prompt） | 与 Claude Code 保持一致的 YAML frontmatter 格式 |
| Skill 权限 | 继承 QueryEngine 权限 + `allowed-tools` 白名单 | fork 模式通过白名单限制可用 Tool |
| Skill Hooks | 支持 PreToolUse / PostToolUse / PreCompact / PostCompact 4 种 | 参照 Claude Code 的 Hook 事件体系 |
| Compaction 保护 | `invokedSkills` Map 跟踪活跃 Skill | Skill 内容在对话压缩时保留，不被丢失 |
| 条件激活 | `paths` 字段支持文件模式匹配 | 如 `paths: ["*.mp4"]` 仅在操作视频时激活 |
| 预算控制 | Skill 描述不超过上下文窗口 1% | 参考 Claude Code 的 `formatCommandsWithinBudget()` |

#### 6.3 Skill 目录结构

```
~/.jy-draft/skills/              # 用户级 Skills（全局可用）
├── batch-process/
│   └── SKILL.md                 # 批量处理 Skill
├── smart-analyze/
│   ├── SKILL.md                 # 素材智能分析 Skill
│   └── references/              # 可选：参考资料
│       └── analysis-guide.md
└── my-workflow/
    ├── SKILL.md                 # 用户自定义工作流
    └── records/                 # 可选：会话持久化
        └── session.md

项目目录/.jy-draft/skills/       # 项目级 Skills（项目特定）
├── template-apply/
│   └── SKILL.md                 # 模板应用 Skill
└── auto-subtitle/
    └── SKILL.md                 # 自动字幕 Skill

内置 Skills（打包在应用中）：
app/skills/
├── batch-process/
├── smart-analyze/
├── template-apply/
└── quick-edit/
```

#### 6.4 SKILL.md 格式规范

```yaml
---
# === 基础字段（必须）===
name: batch-process                        # Skill 名称，用于 / 调用
description: "批量处理视频素材..."           # 描述，供 AI 理解何时使用
user-invocable: true                       # 是否允许用户直接调用

# === 执行配置（可选）===
context: inline                            # 执行模式：inline | fork
allowed-tools:                             # 限制可用的 Tool（fork 模式下重要）
  - list_local_materials
  - add_videos
  - save_draft
model: minimax                             # 指定模型（可选，覆盖默认模型）
effort: medium                             # 执行力度：low | medium | high

# === Agent 配置（fork 模式，可选）===
agent:
  agentType: general-purpose               # agent 类型

# === Hooks 配置（可选）===
hooks:
  preToolUse:
    - matcher: "save_draft"
      hooks:
        - command: "echo '即将保存草稿'"
          once: false
  postToolUse:
    - matcher: "add_videos"
      hooks:
        - command: "echo '视频素材已添加'"

# === 条件激活（可选）===
paths:                                     # 当操作匹配的文件时自动建议
  - "*.mp4"
  - "*.mov"
  - "*.avi"
---

# Batch Process Skill（Markdown 正文 = Skill Prompt）

## 使用方式
/batch-process <素材目录>

## 参数
<directory> — 素材目录路径

## 工作流

### Step 1: 扫描素材
使用 `list_local_materials` 扫描指定目录...

### Step 2: 分析素材
对每个视频素材调用 AI 分析...

### Step 3: 排序与分组
根据 AI 分析结果自动排序...

### Step 4: 生成草稿
调用 `create_draft` + `add_videos` ...

## 核心规则
1. 批量操作前必须显示预览列表让用户确认
2. 每个步骤使用 AskUserQuestion 获取用户反馈
...
```

#### 6.5 核心 Skill 设计（内置 4 个）

##### Skill 1：`/batch-process` — 批量处理

```yaml
name: batch-process
description: "批量处理视频素材：扫描目录、AI分析、自动排序、生成草稿。适合一次性处理大量素材。"
user-invocable: true
context: inline
```

**功能**：
1. 扫描用户指定目录的素材
2. AI 分析每个素材（视频内容、时长、分辨率）
3. 按内容相关性自动排序和分组
4. 生成多个草稿或一个合并草稿
5. 支持批量添加滤镜/特效

**交互流程**：
```
用户：/batch-process E:\素材\旅行视频\

Skill：正在扫描目录...找到 23 个视频素材
      ┌──────────────────────────────────┐
      │ 发现 23 个视频素材：              │
      │                                  │
      │ 📁 海滩 (5个)                    │
      │   ├── beach_001.mp4 (0:32)       │
      │   ├── beach_002.mp4 (1:05)       │
      │   └── ...                        │
      │ 📁 城市夜景 (4个)                │
      │   ├── night_001.mp4 (0:45)       │
      │   └── ...                        │
      │ 📁 其他 (14个)                   │
      │                                  │
      │ 请选择处理方式：                  │
      │ 1. 按分组生成多个草稿             │
      │ 2. 合并为一个草稿                 │
      │ 3. 自定义分组                     │
      └──────────────────────────────────┘
```

##### Skill 2：`/smart-analyze` — 素材智能分析

```yaml
name: smart-analyze
description: "深度分析视频/音频素材：内容识别、质量评估、推荐用途。支持单文件和批量分析。"
user-invocable: true
context: inline
paths:
  - "*.mp4"
  - "*.mov"
  - "*.wav"
  - "*.mp3"
```

**功能**：
1. 短视频分析（2-10s）：AI 提取文本描述 → 语义标签
2. 长视频分析：AI 分析内容 → 智能分割建议
3. 音频分析：识别语音内容、音乐类型、音质评估
4. 生成分析报告（保存到 SQLite）
5. 基于分析结果推荐素材用途

##### Skill 3：`/template-apply` — 模板应用

```yaml
name: template-apply
description: "应用预设模板到草稿：Vlog模板、教程模板、产品展示模板等。快速生成结构化视频。"
user-invocable: true
context: inline
allowed-tools:
  - create_draft
  - add_videos
  - add_audios
  - add_texts
  - add_stickers
  - add_video_effects
  - add_video_filters
  - save_draft
```

**内置模板**：
- Vlog 模板：开场动画 + 正文 + 结尾
- 教程模板：标题卡 + 步骤分段 + 字幕
- 产品展示模板：产品特写 + 功能说明 + CTA
- 音乐视频模板：节拍同步 + 转场 + 特效
- 空白模板：从零开始

##### Skill 4：`/quick-edit` — 快速编辑

```yaml
name: quick-edit
description: "快速编辑操作：一键裁剪、拼接、配乐、加字幕。适合简单编辑需求。"
user-invocable: true
context: inline
```

**功能**：
1. 裁剪视频片段（指定起止时间）
2. 拼接多个视频
3. 自动配乐（从素材库或 AI 生成）
4. 自动字幕（语音识别 → 字幕添加）
5. 快速滤镜应用

---

#### Phase 6.1：Skill 基础框架（6 tasks）

> 实现 Skill 系统的核心加载、解析、注册机制

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.1.1 | Skill 类型定义 | `core/skill/types.ts` | P3.4.1 | SkillCommand、SkillFrontmatter、SkillContext 接口完整 |
| P6.1.2 | Frontmatter 解析器 | `core/skill/frontmatterParser.ts` | P6.1.1 | 解析 YAML frontmatter，验证 name/description/context/allowed-tools 等字段 |
| P6.1.3 | Skill 加载器 | `core/skill/loader.ts` | P6.1.2 | 从 3 个来源加载 Skills（内置/用户级/项目级），去重、排序 |
| P6.1.4 | Skill 注册到 Command 系统 | `core/skill/registry.ts` | P6.1.3 | Skill 注册为 slash 命令，`/skill-name` 可被发现 |
| P6.1.5 | SkillTool 定义 | `core/queryEngine/skills/skillTool.ts` | P6.1.4 | SkillTool 作为 Tool 注册到 QueryEngine，AI 可自动推荐 Skill |
| P6.1.6 | Skill 描述预算控制 | `core/skill/budgetFormatter.ts` | P6.1.5 | Skill 描述不超过上下文 1%，超出时智能截断 |

**SkillFrontmatter 类型定义**：

```typescript
// core/skill/types.ts

/** Skill frontmatter 配置 */
export interface SkillFrontmatter {
  name: string                          // Skill 名称
  description: string                   // 描述（供 AI 发现）
  userInvocable: boolean                // 是否允许用户调用
  context?: 'inline' | 'fork'           // 执行模式，默认 inline
  allowedTools?: string[]               // 可用 Tool 白名单
  model?: string                        // 模型覆盖
  effort?: 'low' | 'medium' | 'high'    // 执行力度
  agent?: {
    agentType: string                   // Agent 类型（fork 模式）
  }
  hooks?: SkillHooks                    // Hook 配置
  paths?: string[]                      // 条件激活路径
}

/** Skill Hooks 配置 */
export interface SkillHooks {
  preToolUse?: SkillHookEntry[]
  postToolUse?: SkillHookEntry[]
  preCompact?: SkillHookEntry[]
  postCompact?: SkillHookEntry[]
}

export interface SkillHookEntry {
  matcher: string                       // Tool 名匹配模式
  hooks: Array<{
    command?: string                    // Shell 命令
    once?: boolean                      // 是否只执行一次
  }>
}

/** 已加载的 Skill 命令 */
export interface SkillCommand {
  name: string
  description: string
  filePath: string                      // SKILL.md 文件路径
  content: string                       // SKILL.md 完整内容（Markdown 正文）
  frontmatter: SkillFrontmatter
  source: 'builtin' | 'user' | 'project'  // 来源
}

/** Skill 执行上下文 */
export interface SkillExecutionContext {
  skillCommand: SkillCommand
  args: string                          // 用户传入的参数
  messages: ConversationMessage[]       // 当前对话历史
  toolUseContext: ToolUseContext         // Tool 使用上下文
  agentId?: string                      // Agent ID（fork 模式）
}
```

**Skill 加载器核心逻辑**：

```typescript
// core/skill/loader.ts

/** Skill 加载来源（优先级从高到低） */
const SKILL_SOURCES = [
  { type: 'project', basePath: '.jy-draft/skills/' },   // 项目级
  { type: 'user',    basePath: '~/.jy-draft/skills/' },  // 用户级
  { type: 'builtin', basePath: 'app/skills/' },          // 内置
] as const

export async function loadAllSkills(
  projectRoot: string
): Promise<SkillCommand[]> {
  const skills = new Map<string, SkillCommand>()  // name → skill（去重）

  for (const source of SKILL_SOURCES) {
    const dirPath = resolveSkillDir(source, projectRoot)
    const dirSkills = await loadSkillsFromDir(dirPath, source.type)

    for (const skill of dirSkills) {
      // 高优先级来源覆盖低优先级
      if (!skills.has(skill.name)) {
        skills.set(skill.name, skill)
      }
    }
  }

  return [...skills.values()].sort((a, b) => a.name.localeCompare(b.name))
}

async function loadSkillsFromDir(
  dirPath: string,
  source: SkillCommand['source']
): Promise<SkillCommand[]> {
  const skills: SkillCommand[] = []

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillFile = path.join(dirPath, entry.name, 'SKILL.md')
      if (!await fileExists(skillFile)) continue

      const content = await fs.readFile(skillFile, 'utf-8')
      const frontmatter = parseFrontmatter(content)
      if (!frontmatter?.name) continue

      skills.push({
        name: frontmatter.name,
        description: frontmatter.description || '',
        filePath: skillFile,
        content: extractMarkdownBody(content),
        frontmatter,
        source,
      })
    }
  } catch {
    // 目录不存在，跳过
  }

  return skills
}
```

---

#### Phase 6.2：Skill 执行引擎（5 tasks）

> 实现 Skill 的 inline 和 fork 两种执行模式

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.2.1 | SkillTool.validateInput | `core/queryEngine/skills/skillTool.ts` | P6.1.5 | 验证 Skill 名称存在、格式正确、参数合法 |
| P6.2.2 | SkillTool.checkPermissions | `core/queryEngine/skills/skillTool.ts` | P6.2.1 | 权限规则检查，deny 列表优先于 allow 列表 |
| P6.2.3 | Inline 执行模式 | `core/skill/inlineExecutor.ts` | P6.2.2 | Skill prompt 注入当前对话，`$ARGUMENTS` 替换，`!command` 快捷方式 |
| P6.2.4 | Fork 执行模式 | `core/skill/forkExecutor.ts` | P6.2.2 | 启动独立子 Agent，隔离执行上下文，结果提取返回 |
| P6.2.5 | Fork 子 Agent 上下文隔离 | `core/skill/subagentContext.ts` | P6.2.4 | createSubagentContext：克隆 messages、独立 agentId、shouldAvoidPermissionPrompts |

**Inline 执行流程**（参考 Claude Code `processPromptSlashCommand`）：

```
用户输入 /batch-process E:\素材\
         │
         ▼
SkillTool.call()
         │
         ▼ context === 'inline'
processInlineSkill()
  ├── 读取 SKILL.md 内容
  ├── 替换 $ARGUMENTS → "E:\素材\"
  ├── 替换 !command 快捷方式
  ├── 注册到 invokedSkills Map（Compaction 保护）
  └── 返回 newMessages 注入当前对话
         │
         ▼
Skill prompt 在主 Agent 上下文中执行
  → AI 根据 Skill 指令调用 Tools
  → 保持完整对话上下文
```

**Fork 执行流程**（参考 Claude Code `executeForkedSkill`）：

```
用户输入 /batch-process E:\素材\
         │
         ▼
SkillTool.call()
         │
         ▼ context === 'fork'
executeForkedSkill()
  ├── 从 frontmatter 构建 Agent 定义
  │     ├── agentType: frontmatter.agent?.agentType ?? 'general-purpose'
  │     ├── allowedTools: frontmatter.allowedTools
  │     └── model: frontmatter.model
  ├── prepareForkedCommandContext()
  │     ├── 确定子 Agent 类型
  │     └── 构建 Agent 参数
  └── runAgent()（与内置 Agent 共用引擎）
         │
         ▼
createSubagentContext()
  ├── 克隆 messages（完整对话历史）
  ├── 设置 shouldAvoidPermissionPrompts = true
  ├── 分配独立 agentId / depth++
  └── 应用 allowed-tools 白名单过滤
         │
         ▼
子 Agent 隔离执行 → 结果提取 → 返回主对话
```

**子 Agent 上下文隔离**：

```typescript
// core/skill/subagentContext.ts

export function createSubagentContext(
  parentContext: ToolUseContext,
  skillCommand: SkillCommand
): ToolUseContext {
  return {
    // 克隆 messages（不污染父 Agent）
    messages: [...parentContext.messages],

    // 子 Agent 不弹权限确认
    permissionGuard: {
      ...parentContext.permissionGuard,
      shouldAvoidPermissionPrompts: true,
    },

    // 独立 ID
    agentId: generateAgentId(),

    // 嵌套深度递增
    queryTracking: {
      depth: (parentContext.queryTracking?.depth ?? -1) + 1,
    },

    // 应用 Skill 的 allowed-tools 白名单
    allowedTools: skillCommand.frontmatter.allowedTools
      ?? ['list_local_materials', 'save_draft'],  // 默认安全工具

    // 文件缓存独立
    readFileState: cloneFileStateCache(parentContext),
  }
}
```

---

#### Phase 6.3：Skill Hooks 系统（4 tasks）

> 实现 Skill 级别的事件驱动拦截器

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.3.1 | Hook 注册机制 | `core/skill/hooks/register.ts` | P6.2.3 | SKILL.md frontmatter hooks 注册为 Session 级 hook |
| P6.3.2 | Hook 执行引擎 | `core/skill/hooks/executor.ts` | P6.3.1 | 支持 command 类型 hook，exit code 语义（0=放行，2=阻断） |
| P6.3.3 | PreToolUse / PostToolUse 拦截 | `core/skill/hooks/toolHooks.ts` | P6.3.2 | Tool 调用前/后触发 hook，matcher 匹配 Tool 名 |
| P6.3.4 | PreCompact / PostCompact 保护 | `core/skill/hooks/compactHooks.ts` | P6.3.2 | 压缩前/后触发 hook，保护 Skill 内容不被丢失 |

**Hook 执行顺序**：

```
用户请求 → QueryEngine → PermissionGuard（权限检查）→ PreToolUse Hook → Tool 执行 → PostToolUse Hook → 结果返回
                                                     ↑
                                          权限拒绝则 Hook 不触发
```

**Exit Code 语义**（与 Claude Code 一致）：

| exit code | 含义 | 行为 |
|-----------|------|------|
| `0` | 成功/放行 | stdout 被处理，事件继续 |
| `2` | 阻断/阻止 | 显示 stderr 给 AI，当前操作被阻止 |
| 其他 | 警告但继续 | stderr 仅显示给用户，操作继续执行 |

**Hook 注册示例**：

```typescript
// core/skill/hooks/register.ts

export function registerSkillHooks(
  skillCommand: SkillCommand,
  sessionHooks: SessionHooks
): void {
  const { hooks } = skillCommand.frontmatter
  if (!hooks) return

  // PreToolUse hooks
  if (hooks.preToolUse) {
    for (const entry of hooks.preToolUse) {
      sessionHooks.register('preToolUse', {
        matcher: entry.matcher,
        handler: createCommandHook(entry),
        once: entry.hooks.some(h => h.once),
        source: `skill:${skillCommand.name}`,
      })
    }
  }

  // PostToolUse / PreCompact / PostCompact 类似处理 ...
}
```

---

#### Phase 6.4：Skill Compaction 保护（3 tasks）

> 确保活跃 Skill 在长对话压缩时不丢失

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.4.1 | invokedSkills Map | `core/skill/invokedSkills.ts` | P6.2.3 | 跟踪活跃 Skill，agentId + skillName 唯一标识 |
| P6.4.2 | Compaction 前保护 | `core/skill/compactProtection.ts` | P6.4.1, P3.4.4 | 压缩前检查 invokedSkills，标记 Skill 内容不可压缩 |
| P6.4.3 | Compaction 后恢复 | `core/skill/compactProtection.ts` | P6.4.2 | 压缩后检测被破坏的消息边界，从 invokedSkills 恢复 |

**invokedSkills Map 设计**：

```typescript
// core/skill/invokedSkills.ts

/** 活跃 Skill 跟踪（参考 Claude Code bootstrap/state.ts） */
const invokedSkills = new Map<string, {
  skillName: string
  skillPath: string
  content: string                    // Skill 完整内容
  invokedAt: number                  // 调用时间
  agentId: string | null             // 所属 Agent
}>()

/** 生成唯一 key */
function skillKey(agentId: string | null, skillName: string): string {
  return `${agentId ?? 'main'}:${skillName}`
}

/** Skill 执行时注册 */
export function addInvokedSkill(
  name: string,
  path: string,
  content: string,
  agentId: string | null
): void {
  invokedSkills.set(skillKey(agentId, name), {
    skillName: name,
    skillPath: path,
    content,
    invokedAt: Date.now(),
    agentId,
  })
}

/** Compaction 保护流程 */
export function getInvokedSkillsForAgent(
  agentId: string | null
): Array<{ name: string; content: string }> {
  const result: Array<{ name: string; content: string }> = []
  for (const [key, skill] of invokedSkills) {
    if (key.startsWith(`${agentId ?? 'main'}:`)) {
      result.push({ name: skill.skillName, content: skill.content })
    }
  }
  return result
}
```

---

#### Phase 6.5：内置 Skill 实现（4 个 Skill，8 tasks）

> 实现 4 个内置 Skill 的完整功能

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.5.1 | `/batch-process` Skill 实现 | `app/skills/batch-process/SKILL.md` | P6.2.3 | 扫描→分析→排序→生成草稿全流程通过 |
| P6.5.2 | `/batch-process` 测试 | `__tests__/skills/batch-process.test.ts` | P6.5.1 | 10+ 素材批量处理、分组、确认流程正确 |
| P6.5.3 | `/smart-analyze` Skill 实现 | `app/skills/smart-analyze/SKILL.md` | P6.2.3 | 短视频/长视频/音频分析报告生成正确 |
| P6.5.4 | `/smart-analyze` 测试 | `__tests__/skills/smart-analyze.test.ts` | P6.5.3 | 分析结果保存 SQLite，推荐用途合理 |
| P6.5.5 | `/template-apply` Skill 实现 | `app/skills/template-apply/SKILL.md` | P6.2.3 | Vlog/教程/产品展示模板正确应用 |
| P6.5.6 | `/template-apply` 测试 | `__tests__/skills/template-apply.test.ts` | P6.5.5 | 各模板生成草稿结构符合预期 |
| P6.5.7 | `/quick-edit` Skill 实现 | `app/skills/quick-edit/SKILL.md` | P6.2.3 | 裁剪/拼接/配乐/字幕/滤镜快速操作通过 |
| P6.5.8 | `/quick-edit` 测试 | `__tests__/skills/quick-edit.test.ts` | P6.5.7 | 各快速编辑操作正确执行 |

---

#### Phase 6.6：Skill REPL 集成（4 tasks）

> 在 REPL 界面中集成 Skill 的发现、调用、展示

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.6.1 | Skill 自动补全组件 | `components/REPL/SkillAutocomplete.vue` | P6.1.4, P3.4.13 | 输入 `/` 弹出 Skill 列表，支持模糊搜索 |
| P6.6.2 | Skill 执行进度展示 | `components/REPL/SkillProgress.vue` | P6.2.3 | inline 模式显示当前 Skill 步骤；fork 模式显示进度条 |
| P6.6.3 | Skill 帮助面板 | `components/REPL/SkillHelp.vue` | P6.6.1 | `/help skills` 显示所有可用 Skill 及描述 |
| P6.6.4 | Skill 条件激活提示 | `components/REPL/SkillSuggestion.vue` | P6.1.3, P6.6.1 | 当用户操作匹配 `paths` 时，自动提示关联 Skill |

**Skill 自动补全 UI**（Vue 3 组件）：

```
用户输入：/
         │
         ▼
┌──────────────────────────────────────┐
│ /batch-process  批量处理视频素材       │
│ /smart-analyze  素材智能分析           │
│ /template-apply 应用预设模板           │
│ /quick-edit     快速编辑操作           │
│                                      │
│ ↑↓ 选择  Enter 确认  Esc 取消        │
└──────────────────────────────────────┘
```

**Skill 执行进度展示**（Vue 3 组件）：

```
┌──────────────────────────────────────────────┐
│ 🔧 正在执行 /batch-process                    │
│                                              │
│ ✓ Step 1: 扫描素材 (23个文件)                 │
│ ✓ Step 2: AI 分析 (23/23 完成)                │
│ ● Step 3: 自动排序分组                        │
│ ○ Step 4: 生成草稿                            │
│                                              │
│ ████████████████░░░░░░░ 60%                  │
└──────────────────────────────────────────────┘
```

**Vue 3 组件示例结构**：

```vue
<!-- components/REPL/SkillAutocomplete.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSkillStore } from '@/stores/skill'

const skillStore = useSkillStore()
const searchText = ref('')
const selectedIndex = ref(0)
const visible = ref(false)

const filteredSkills = computed(() => {
  if (!searchText.value) return skillStore.allSkills
  return skillStore.allSkills.filter(s =>
    s.name.includes(searchText.value) ||
    s.description.includes(searchText.value)
  )
})
</script>
```

---

#### Phase 6.7：用户自定义 Skill 管理（5 tasks）

> 允许用户创建、编辑、管理自定义 Skill

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P6.7.1 | Skill 创建引导 | `core/skill/skillCreator.ts` | P6.1.2 | 交互式引导用户创建新 Skill（名称→描述→工作流→保存） |
| P6.7.2 | Skill 管理面板 UI | `components/Skills/SkillManager.vue` | P6.7.1 | 列表展示所有 Skill，支持启用/禁用/编辑/删除 |
| P6.7.3 | Skill 编辑器组件 | `components/Skills/SkillEditor.vue` | P6.7.2 | Markdown 编辑器 + frontmatter 表单 + 实时预览 |
| P6.7.4 | Skill 导入/导出 | `core/skill/skillIO.ts` | P6.7.1 | 支持导出为 `.zip` 和从 `.zip` 导入 Skill |
| P6.7.5 | Skill 市场预留 | `core/skill/skillMarket.ts` | P6.7.4 | API 接口预留（搜索、下载、评分），后期实现 UI |

**Skill 创建引导流程**：

```
用户：/create-skill
         │
         ▼
┌──────────────────────────────────────┐
│ 创建新 Skill                          │
│                                      │
│ Step 1/4: 基本信息                    │
│ 名称：[ my-workflow        ]         │
│ 描述：[ 我的工作流描述...  ]         │
│ 执行模式：○ inline  ○ fork           │
│                                      │
│ [下一步]  [取消]                      │
└──────────────────────────────────────┘
         │
         ▼ (4步引导完成后)
自动生成 SKILL.md → 保存到 ~/.jy-draft/skills/my-workflow/
```

---

#### Phase 6 任务总览（35 tasks）

| Phase | 任务数 | 核心交付 | 难度 |
|-------|--------|----------|------|
| P6.1 Skill 基础框架 | 6 | Skill 加载/解析/注册完整链路 | B |
| P6.2 Skill 执行引擎 | 5 | inline + fork 双模式执行 | A |
| P6.3 Skill Hooks 系统 | 4 | 4 种 Hook 事件拦截 | B |
| P6.4 Skill Compaction 保护 | 3 | invokedSkills Map + 压缩保护 | A |
| P6.5 内置 Skill 实现 | 8 | 4 个内置 Skill + 测试 | B |
| P6.6 Skill REPL 集成 | 4 | 自动补全 + 进度 + 帮助 + 提示 | B |
| P6.7 用户自定义 Skill | 5 | 创建引导 + 管理面板 + 导入导出 | B |
| **合计** | **35** | **Skill 系统完整功能** | |

---

#### Phase 6 开发顺序（4 轮迭代）

```
第1轮迭代（基础框架 + 执行引擎）
├── P6.1.1 Skill 类型定义
├── P6.1.2 Frontmatter 解析器
├── P6.1.3 Skill 加载器
├── P6.1.4 Skill 注册到 Command 系统
├── P6.1.5 SkillTool 定义
├── P6.1.6 Skill 描述预算控制
├── P6.2.1 SkillTool.validateInput
├── P6.2.2 SkillTool.checkPermissions
├── P6.2.3 Inline 执行模式
├── P6.2.4 Fork 执行模式
└── P6.2.5 Fork 子 Agent 上下文隔离

第2轮迭代（Hooks + Compaction 保护）
├── P6.3.1 Hook 注册机制
├── P6.3.2 Hook 执行引擎
├── P6.3.3 PreToolUse / PostToolUse 拦截
├── P6.3.4 PreCompact / PostCompact 保护
├── P6.4.1 invokedSkills Map
├── P6.4.2 Compaction 前保护
└── P6.4.3 Compaction 后恢复

第3轮迭代（内置 Skills + REPL 集成）
├── P6.5.1 /batch-process 实现
├── P6.5.2 /batch-process 测试
├── P6.5.3 /smart-analyze 实现
├── P6.5.4 /smart-analyze 测试
├── P6.5.5 /template-apply 实现
├── P6.5.6 /template-apply 测试
├── P6.5.7 /quick-edit 实现
├── P6.5.8 /quick-edit 测试
├── P6.6.1 Skill 自动补全组件
├── P6.6.2 Skill 执行进度展示
├── P6.6.3 Skill 帮助面板
└── P6.6.4 Skill 条件激活提示

第4轮迭代（用户自定义 + 市场）
├── P6.7.1 Skill 创建引导
├── P6.7.2 Skill 管理面板 UI
├── P6.7.3 Skill 编辑器组件
├── P6.7.4 Skill 导入/导出
└── P6.7.5 Skill 市场预留
```

---

#### Phase 6 借鉴 Claude Code 文件映射

| JY Draft 任务 | 借鉴 Claude Code 文件 | 行数 | 借鉴内容 |
|---|---|---|---|
| P6.1.1 Skill 类型定义 | `src/types/command.ts` | ~100 行 | Command 类型定义、PromptCommand 接口 |
| P6.1.2 Frontmatter 解析 | `src/utils/frontmatterParser.ts` | ~150 行 | YAML frontmatter 解析、验证、字段提取 |
| P6.1.3 Skill 加载器 | `src/skills/loadSkillsDir.ts` | 1087 行 | 多源加载（policy/user/project）、去重、条件激活 |
| P6.1.5 SkillTool 定义 | `packages/builtin-tools/src/tools/SkillTool/SkillTool.ts` | 1110 行 | buildTool 模式、validateInput、checkPermissions |
| P6.1.6 预算控制 | `packages/builtin-tools/src/tools/SkillTool/prompt.ts` | 242 行 | formatCommandsWithinBudget、1% 上下文预算 |
| P6.2.3 Inline 执行 | `src/utils/processUserInput/processSlashCommand.tsx` | 1262 行 | processSlashCommand、消息注入、$ARGUMENTS 替换 |
| P6.2.4 Fork 执行 | `packages/builtin-tools/src/tools/SkillTool/SkillTool.ts` 第 200-400 行 | ~200 行 | executeForkedSkill、子 Agent 启动 |
| P6.2.5 子 Agent 隔离 | `src/utils/forkedAgent.ts` | 690 行 | createSubagentContext、状态隔离、shouldAvoidPermissionPrompts |
| P6.3.1 Hook 注册 | `src/utils/hooks/registerSkillHooks.ts` | 65 行 | frontmatter hooks → session hooks 注册 |
| P6.3.2 Hook 执行 | `src/utils/hooks/hooksConfigManager.ts` | ~300 行 | exit code 语义、事件类型元数据 |
| P6.4.1 invokedSkills | `src/bootstrap/state.ts` 第 300-400 行 | ~100 行 | invokedSkills Map、addInvokedSkill、getInvokedSkillsForAgent |
| P6.4.2-3 Compaction 保护 | `src/services/compact/compact.ts` | ~500 行 | preCompact/postCompact hooks 执行、Skill 内容保护 |

---

## 待确认问题

- [x] 素材路径 → Windows本地路径，如 `E:\device.png`
- [x] AI素材 → TTS(bailian，已对接)，语音识别(bailian)
- [x] 多语言 → 中文 + 英文
- [x] 核心功能 → 视频/音频/文本/贴纸/特效/滤镜/关键帧
- [x] AI模型 → MiniMax / GLM / bailian（全能力API）
- [x] 目标用户 → 外部用户/公开产品
- [x] MCP部署 → 与 Electron 打包在一起
- [x] 交互方式 → GUI + REPL 混合（增强 REPL）
- [x] 输出交付 → 保存到本地文件
- [x] 数据存储 → 本地 SQLite + LanceDB，云端同步预留接口
- [x] 用户认证 → QQ扫码登录（后期实现）
- [x] 权限控制 → 敏感操作需确认
- [x] 历史管理 → SQLite + 版本管理（手动保存）
- [x] 素材管理 → 本地文件夹结构 `/<yyyy-mm-dd>/`
- [x] 视频理解 → 短视频分析(2-10s) + 长视频分割
- [x] 分割存储 → `原视频目录/smaterSplit/<yyyy-mm-dd>/源文件名_<xxxx>.后缀`
- [x] 向量用途 → 素材检索 + 语义搜索
- [x] Agent系统 → 完整 Agent 系统（多Agent + Task + 规划）
- [x] 离线支持 → 必须在线
- [x] JSON结构 → 分层支持（核心必填，高级可选）
- [x] GUI功能 → 完整面板（预览+时间线+特效+多轨）
- [x] REPL能力 → 增强能力（Task/Agent/规划模式）
- [x] 数据备份 → 手动备份（后期扩展云端）

---

## 下一步

1. 确认上述方案是否有问题
2. 回答待确认问题
3. 开始 Phase 1：分析 DMVideo backend API 设计
