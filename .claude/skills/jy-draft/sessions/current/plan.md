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

#### Phase 3.3 DraftManager（14 tasks）

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P3.3.1 | 草稿状态机 | `types/draft.ts` | - | DraftStatus 枚举+状态转换图定义完成 |
| P3.3.2 | 草稿数据库表 | `database/migrations/` | - | draft_main/audio/text 表创建成功 |
| P3.3.3 | 创建草稿 | `core/draft/manager.ts` | P3.3.1~2 | createDraft → MCP → 存储本地状态成功 |
| P3.3.4 | 添加视频素材 | `core/draft/addVideo.ts` | P3.3.3 | MCP add_videos → 更新草稿状态成功 |
| P3.3.5 | 添加音频素材 | `core/draft/addAudio.ts` | P3.3.3 | MCP add_audios → 更新草稿状态成功 |
| P3.3.6 | 添加文本素材 | `core/draft/addText.ts` | P3.3.3 | MCP add_texts → 更新草稿状态成功 |
| P3.3.7 | 添加特效/滤镜 | `core/draft/addEffect.ts` | P3.3.4 | MCP generate_video_effect/add_video_effects 成功 |
| P3.3.8 | 草稿保存 | `core/draft/save.ts` | P3.3.4~6 | MCP save_draft → 状态更新为 SAVED |
| P3.3.9 | 草稿导出 | `core/draft/export.ts` | P3.3.8 | MCP generate_jianying_draft → JSON 保存本地 |
| P3.3.10 | 草稿列表 | `core/draft/list.ts` | P3.3.1 | 分页查询草稿、显示缩略信息正确 |
| P3.3.11 | 草稿版本 | `core/draft/version.ts` | P3.3.9 | 每次导出生成版本记录，支持回滚 |
| P3.3.12 | IPC 草稿通道 | `ipc/draft.ts` | P3.3.3~11 | create/save/generate/list 通道正常工作 |
| P3.3.13 | Draft Store | `stores/draft.ts` | P3.3.12 | currentDraft、draftHistory 状态正确 |
| P3.3.14 | 集成测试 | `__tests__/draft/` | P3.3.13 | 创建→添加素材→保存→导出全流程通过 |

**验收标准**：能生成可被剪映打开的 draft_content.json

---

#### Phase 3.4 QueryEngine（14 tasks）

> **权限集成**：QueryEngine 是 Permission System 的主要调用方，所有 Tool 调用必须经过权限检查

| 编号 | 任务 | 交付物 | 依赖 | 验收标准 |
|------|------|--------|------|----------|
| P3.4.1 | 消息结构 | `types/message.ts` | - | ConversationMessage/ToolCall/ToolResult 接口完成 |
| P3.4.2 | 对话上下文 | `core/queryEngine/context.ts` | P3.4.1 | conversation 数组管理、最大长度限制、截断策略正确 |
| P3.4.3 | 意图识别 Prompt | `core/queryEngine/intentPrompt.ts` | P3.4.1 | 意图识别 Prompt 设计完成 |
| P3.4.4 | 意图解析 | `core/queryEngine/intentParser.ts` | P3.4.3 | bailian 调用 → 解析 JSON → 返回 UserIntent |
| P3.4.5 | Tool 调用封装 | `core/queryEngine/toolCaller.ts` | P3.4.1 | mcpClient.callTool 重试+错误处理正常 |
| P3.4.6 | 结果处理 | `core/queryEngine/resultHandler.ts` | P3.4.5 | 解析 Tool 结果，决定继续调用或结束 |
| P3.4.7 | **权限检查集成** | `core/queryEngine/permissionGuard.ts` | P3.1.3, P3.4.5 | Tool 调用前通过 PermissionManager.checkPermission() 检查 |
| P3.4.8 | **权限拒绝处理** | `core/queryEngine/permissionDeniedHandler.ts` | P3.4.7 | 权限拒绝时返回友好提示给 AI，记录拒绝日志 |
| P3.4.9 | 流式响应 | `core/queryEngine/stream.ts` | P3.4.6 | AsyncIterable<string> 流式返回 AI 响应 |
| P3.4.10 | QueryEngine 主类 | `core/queryEngine/index.ts` | P3.4.2,4,6,7,8 | 整合所有模块，sendMessage 正常工作 |
| P3.4.11 | IPC Query 通道 | `ipc/query.ts` | P3.4.10 | query:send-message 通道正常工作 |
| P3.4.12 | Conversation Store | `stores/conversation.ts` | P3.4.11 | messages、isLoading、error 状态正确 |
| P3.4.13 | REPL 集成 | `components/REPL/` | P3.4.12 | ChatWindow/MessageList/PromptInput 接入 QueryEngine |
| P3.4.14 | 集成测试 | `__tests__/queryEngine/` | P3.4.13 | 对话流程：消息→意图→Tool→结果全流程通过 |

##### 3.4.A 权限检查集成细节（P3.4.7）

```typescript
// core/queryEngine/permissionGuard.ts

export class PermissionGuard {
  constructor(private permissionManager: PermissionManager) {}

  async checkAndExecute<T>(
    toolName: string,
    input: unknown,
    execute: () => Promise<T>
  ): Promise<T | PermissionDeniedResult> {
    // 1. 检查权限
    const decision = await this.permissionManager.checkPermission(toolName, input)

    switch (decision.behavior) {
      case 'allow':
        return await execute()

      case 'deny':
        return {
          denied: true,
          reason: decision.message,
          toolName,
          // 记录拒绝日志
          log: { toolName, reason: decision.message, timestamp: Date.now() }
        }

      case 'ask':
        // 权限弹窗由调用方处理（通过 IPC 到渲染进程）
        // 这里抛出特殊错误，由上层处理弹窗逻辑
        throw new PermissionRequiredError(toolName, decision.options)
    }
  }
}
```

##### 3.4.B 权限拒绝处理细节（P3.4.8）

```typescript
// core/queryEngine/permissionDeniedHandler.ts

export interface PermissionDeniedResult {
  denied: true
  reason: string
  toolName: string
  log: {
    toolName: string
    reason: string
    timestamp: number
    sessionRuleId?: string  // 如果是 session 规则过期，记录规则 ID
  }
}

export function handlePermissionDenied(
  result: PermissionDeniedResult,
  conversation: ConversationMessage[]
): HandleResult {
  // 1. 根据拒绝原因生成用户友好的提示
  const friendlyMessage = generateFriendlyMessage(result.reason)

  // 2. 构造拒绝消息添加到对话历史
  const deniedMessage: ToolResultMessage = {
    id: generateId(),
    role: 'tool',
    toolName: result.toolName,
    content: `【权限被拒绝】${friendlyMessage}`,
    denied: true,
    reason: result.reason,
    timestamp: Date.now()
  }

  // 3. 决定下一步策略
  const strategy = decideNextStrategy(result.reason, conversation)

  return {
    message: deniedMessage,
    strategy,  // 'stop' | 'retry_without_tool' | 'suggest_permission_change'
    suggestion?: strategy === 'suggest_permission_change'
      ? generatePermissionSuggestion(result.toolName)
      : undefined
  }
}

function decideNextStrategy(
  reason: string,
  conversation: ConversationMessage[]
): 'stop' | 'retry_without_tool' | 'suggest_permission_change' {
  // session 规则过期 → 建议用户去设置页面重新授权
  if (reason.includes('session') && reason.includes('expired')) {
    return 'suggest_permission_change'
  }

  // 用户主动拒绝 → 停止当前操作
  if (reason.includes('user_denied')) {
    return 'stop'
  }

  // denyAll 模式 → 提示用户切换模式
  if (reason.includes('denyAll')) {
    return 'suggest_permission_change'
  }

  // 默认：停止当前操作
  return 'stop'
}
```

##### 3.4.C 权限流程与 AI 的交互

```
用户: "帮我添加 E:\videos\test.mp4 到草稿"

       │
       ▼
QueryEngine.sendMessage("帮我添加 E:\videos\test.mp4 到草稿")
       │
       ▼
意图解析 → UserIntent { action: "addVideoToDraft", params: { path: "E:\videos\test.mp4" } }
       │
       ▼
PermissionGuard.checkAndExecute("addVideoToDraft", input, async () => {
  return await mcpClient.callTool("add_videos", input)
})
       │
       ├──► allow → 执行 Tool，返回结果给 AI
       │
       └──► deny → PermissionDeniedResult
                   │
                   ▼
            handlePermissionDenied(result)
                   │
                   ├──► 生成拒绝消息
                   ├──► 添加到对话历史
                   └──► 返回策略（stop / retry / suggest）
                           │
                           ▼
                    AI 收到拒绝消息，决定下一步：
                    - stop: 告诉用户权限被拒，提供解决方案
                    - suggest: 建议用户去设置页面修改权限
```

##### 3.4.D 拒绝日志与统计

```typescript
// stores/permissionDeniedLog.ts

interface PermissionDeniedLog {
  id: string
  toolName: string
  reason: string
  timestamp: number
  userHadSessionRule: boolean  // 用户之前是否有 session 规则
  resultedInUserAction: boolean  // 用户是否采取了行动（如去设置页面）
}

// 用于分析权限拒绝模式，优化用户体验
function analyzeDenialPatterns(logs: PermissionDeniedLog[]): {
  mostDeniedTool: string
  commonReasons: string[]
  sessionRuleExpiryRate: number
} {
  // 统计被拒绝最多的 Tool
  // 统计常见拒绝原因
  // 计算 session 规则过期比例
}
```

**验收标准**：用户发送"帮我创建一个生日祝福视频"，系统能自动完成创建草稿→添加素材→导出

**权限相关验收标准**：
- Tool 调用被拒绝时，用户能看到友好的拒绝原因
- AI 能感知权限被拒，并给出解决建议
- 拒绝日志正确记录，支持后续分析

---

#### Phase 3 开发顺序（4 轮迭代）

```
第1轮迭代（基础层）
├── P3.1.1 权限基础结构
├── P3.2.1 目录结构设计
├── P3.2.2 数据库表设计
├── P3.3.1 草稿状态机
├── P3.3.2 草稿数据库表
└── P3.4.1 消息结构

第2轮迭代（核心逻辑）
├── P3.1.2 权限存储表
├── P3.1.3 权限核心逻辑
├── P3.2.3 路径工具函数
├── P3.2.4~6 素材元数据提取
├── P3.2.7 添加素材 API
├── P3.3.3 创建草稿
└── P3.4.2 对话上下文

第3轮迭代（IPC 通道）
├── P3.1.4 IPC 权限通道
├── P3.1.6 权限规则管理
├── P3.2.8~12 素材查询/搜索/删除/IPC
├── P3.3.4~7 添加各种素材
├── P3.3.8~11 保存/导出/列表/版本
└── P3.4.3~6 意图识别/解析/Tool调用

第4轮迭代（UI + Store + 测试）
├── P3.1.5 权限弹窗 UI
├── P3.1.7 权限 Store
├── P3.2.13 Material Store
├── P3.3.12 IPC 草稿通道
├── P3.3.13 Draft Store
├── P3.4.7~9 流式响应/QueryEngine/IPC
├── P3.4.10~11 Store + REPL集成
└── P3.1.8 / P3.2.14 / P3.3.14 / P3.4.12 集成测试
```

---

### Phase 4：完善与集成
- [ ] 完整对话流程测试
- [ ] 素材路径处理优化
- [ ] 错误处理与提示
- [ ] 打包发布

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
