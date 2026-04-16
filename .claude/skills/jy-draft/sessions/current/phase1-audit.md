# Phase 1 审计报告：MCP Server 改造

> 审计时间：2026-04-16
> 审计依据：`references/DMVideo/backend/core/api/schemas.py` + `router.py` + `main.py` + `core/draft/__init__.py`
> 审计目标：交叉验证 plan.md Phase 1 规划与 DMVideo 参考代码的完整性

---

## 一、核心发现：三层不对齐

```
schemas.py 定义了 42 个 Pydantic Model
router.py + main.py 只暴露了 27 个端点
plan.md 只规划了 22 个 MCP Tool
```

这导致 MCP Tool 设计与实际代码能力存在显著偏差。

---

## 二、REST 端点与 MCP Tool 逐项对照

### 2.1 已对齐（13 个）

以下端点同时有 Schema、REST 路由和 MCP Tool 规划，可以直接包装：

| REST 端点 | Schema | MCP Tool |
|-----------|--------|----------|
| `POST /api/draft/create` | `CreateDraftRequest` | `create_draft` |
| `POST /api/draft/delete` | `DeleteDraftRequest` | `delete_draft` |
| `GET /api/draft/template/{id}` | — | `get_template` |
| `POST /api/draft/jianying/generate` | `GenerateJianyingDraftRequest` | `generate_jianying_draft` |
| `POST /api/draft/add_videos` | `AddVideosRequest` | `add_videos` |
| `POST /api/draft/add_audios` | `AddAudiosRequest` | `add_audios` |
| `POST /api/draft/add_texts` | `AddTextsRequest` | `add_texts` |
| `POST /api/draft/video/info` | `VideoInfoRequest` | `create_video_info` |
| `POST /api/draft/audio/info` | `AudioInfoRequest` | `create_audio_info` |
| `POST /api/draft/text/info` | `TextInfoRequest` | `create_text_info` |
| `POST /api/draft/timelines/generate` | `TimelineRequest` | `generate_timelines` |
| `POST /api/draft/timelines/generate_by_audio` | `TimelineByAudioRequest` | `generate_timelines_by_audio` |

### 2.2 有 Schema、有 MCP Tool、但没有 REST 路由（6 个）

这些 Tool 的 Schema 已定义，路由未实现，MCP 层需要**直接调用 `core/draft/` 和 `pjy/` 底层函数**：

| MCP Tool | Schema（schemas.py 行号） | REST 路由 | 实现策略 |
|----------|:---:|:---:|------|
| `save_draft` | `SaveDraftRequest` L37-48 | 无 | 需实现保存逻辑 |
| `generate_video_effect` | `GenerateEffectRequest` L458-463 | 无 | 调用 pjy 元数据生成 |
| `generate_video_filter` | `GenerateFilterRequest` L473-478 | 无 | 调用 pjy 元数据生成 |
| `generate_audio_effect` | `GenerateAudioEffectRequest` L504-509 | 无 | 调用 pjy 音频特效 |
| `generate_keyframe` | `GenerateKeyframeRequest` L488-494 | 无 | 调用 pjy 关键帧 |
| `generate_audio_keyframe` | `GenerateAudioKeyframeRequest` L512-517 | 无 | 调用 pjy 音频关键帧 |

### 2.3 有 MCP Tool、但既没 Schema 也没 REST 路由（3 个）

需要从 pjy 元数据模块直接读取：

| MCP Tool | pjy 模块 | 实现策略 |
|----------|---------|------|
| `list_filter_presets` | `pjy/metadata/filter_meta.py` | 遍历 FilterType 枚举 |
| `list_video_effect_presets` | `pjy/metadata/video_scene_effect.py` | 遍历 VideoSceneEffectType 枚举 |
| `generate_transition` | `pjy/metadata/transition_meta.py` | 调用 transition 生成逻辑 |

> **注意**：`generate_transition` 在 plan 中归类为"特效/滤镜生成"，但 schemas.py 中没有对应的 Request/Response 模型。

### 2.4 有 REST 路由和 Schema、但没有 MCP Tool（14 个 — 遗漏）

#### P0 — Phase 1 必须补充（编辑闭环关键路径）

| REST 端点 | Schema | 遗漏原因 | 影响 |
|-----------|--------|---------|------|
| `GET /draft/content/{id}` (main.py L136) | 无 | plan 未规划 | Agent 无法读取草稿状态，无法做迭代编辑 |
| `POST /api/draft/video/modify` | `ModifyVideoInfosRequest` L256-282 | plan 未规划 | 无法修改视频段属性 |
| `POST /api/draft/audio/modify` | `ModifyAudioInfosRequest` L328-341 | plan 未规划 | 无法修改音频段属性 |
| `POST /api/draft/text/modify` | `ModifyTextInfosRequest` L390-406 | plan 未规划 | 无法修改文本段属性 |

#### P1 — Phase 1 强烈建议补充

| REST 端点 | Schema | 用途 |
|-----------|--------|------|
| `POST /api/draft/video/concat` | `ConcatVideoInfosRequest` L237-240 | 合并视频段数组 |
| `POST /api/draft/audio/concat` | `ConcatAudioInfosRequest` L315-318 | 合并音频段数组 |
| `POST /api/draft/text/concat` | `ConcatTextInfosRequest` L377-380 | 合并文本段数组 |
| `POST /api/draft/video/swap` | `SwapVideoSegmentRequest` L249-253 | 交换视频段位置 |
| `POST /api/draft/audio/swap` | `SwapAudioSegmentRequest` L321-325 | 交换音频段位置 |
| `POST /api/draft/text/swap` | `SwapTextSegmentRequest` L383-387 | 交换文本段位置 |

#### P2 — 可推迟到 Phase 2

| REST 端点 | Schema | 用途 |
|-----------|--------|------|
| `POST /api/draft/video/by_timelines` | `VideoInfosByTimelinesRequest` L231-234 | 批量从时间线创建视频 |
| `POST /api/draft/audio/by_timelines` | `AudioInfosByTimelinesRequest` L309-312 | 批量从时间线创建音频 |
| `POST /api/draft/text/by_timelines` | `TextInfosByTimelinesRequest` L371-374 | 批量从时间线创建文本 |
| `GET /draft/export/{id}` (main.py L157) | 无 | 完整草稿数据导出 |

---

## 三、流程断裂问题

### 3.1 效果添加到草稿的环节缺失

`schemas.py` 定义了以下 Schema，用于将已生成的效果 ID 添加到草稿：

| Schema | 行号 | 用途 | REST 路由 | MCP Tool |
|--------|------|------|:---:|:---:|
| `AddEffectsRequest` | L85-97 | 将 effect_ids 添加到草稿 | 无 | **无** |
| `AddFiltersRequest` | L100-112 | 将 filter_ids 添加到草稿 | 无 | **无** |
| `AddKeyframesRequest` | L115-127 | 将 keyframe_ids 添加到草稿 | 无 | **无** |
| `AddAudioEffectsRequest` | L130-142 | 将 audio effect_ids 添加到草稿 | 无 | **无** |
| `AddAudioKeyframesRequest` | L145-157 | 将 audio keyframe_ids 添加到草稿 | 无 | **无** |

**断裂链路**：
```
generate_video_effect → 返回 effect_ids → ???
                                              ↑ 无 add_effects MCP Tool
                                              ↑ 无 REST 路由
```

**解决方案**：两种选择：
1. **合并方案**：让 `generate_video_effect` 等工具同时完成生成+添加，直接修改草稿缓存中的数据
2. **拆分方案**：新增 `add_effects` / `add_filters` / `add_keyframes` 等 5 个 MCP Tool

建议采用**合并方案**，减少 Tool 数量，简化 AI Agent 调用链路。

### 3.2 草稿状态读取缺失

当前 MCP Tool 只有"写"没有"读"。AI Agent 无法：
- 查看当前草稿有哪些素材
- 查看素材的时间线位置
- 获取当前草稿的完整状态

`core/draft/__init__.py` 导出了以下函数但未被使用：
- `get_video_tracks` / `get_all_videos`
- `get_audio_tracks` / `get_all_audios`
- `get_text_tracks` / `get_all_texts`

`main.py` 有 `GET /draft/content/{id}` 和 `GET /draft/export/{id}` 但 plan 未规划 MCP Tool。

---

## 四、参数描述不充分

### 4.1 `create_video_info` — 实际 22 个参数，plan 未展开

`VideoInfoRequest`（schemas.py L196-220）完整参数列表：

```python
# 基础参数
material_url: str                    # 素材 URL
target_timerange: Dict[str, int]     # 目标时间范围 {start, duration} 微秒
source_timerange: Dict[str, int]     # 源时间范围 {start, duration} 微秒

# 播放控制
speed: float                         # 0.1~42.0
volume: float                        # 默认 1.0
change_pitch: bool                   # 变速是否改变音调

# 素材信息
material_name, material_type, width, height
material_duration, local_material_id, uniform_scale

# 画面控制
crop_settings: Dict                  # 裁剪（四角坐标）
clip_settings: Dict                  # 位置/缩放/旋转/翻转/透明度
background_filling: Dict             # 背景填充 {type, blur, color}
mask: Dict                           # 遮罩 {type, center_x/y, size, rotation, feather, invert}

# 音频
fade: Dict                           # 淡入淡出 {in_duration, out_duration} 微秒

# 效果
effects: List[Dict]                  # [{type, params}]
filters: List[Dict]                  # [{type, intensity}]
transition: Dict                     # {type, duration}
animations: Dict                     # {intro, outro, group}
keyframes: List[Dict]                # [{property, time_offset, value}]
```

Plan 中 `create_video_info(material_url: string, options?: VideoOptions)` 的 `VideoOptions` 没有展开这些参数。AI Agent 无法知道可以传哪些参数。

### 4.2 `create_audio_info` — 实际 10 个参数

`AudioInfoRequest`（schemas.py L287-298）：
- material_url, target_timerange, source_timerange, speed, volume, change_pitch
- material_name, fade, effects, keyframes

### 4.3 `create_text_info` — 实际 14 个参数

`TextInfoRequest`（schemas.py L346-360）：
- content, target_timerange, style, font, clip_settings, uniform_scale
- border, background, shadow, bubble, effect, animations, keyframes

### 4.4 建议

MCP Tool 的参数描述应与 schemas.py 保持一致，为 AI Agent 提供完整的调用文档。建议在 Tool 的 `description` 字段中列出所有可用参数及其含义。

---

## 五、其他发现

### 5.1 贴纸 Schema 已定义但无路由无 Tool

schemas.py L409-453 定义了：
- `StickerInfoRequest` — 创建贴纸
- `StickerInfoResponse` — 贴纸响应
- `ConcatStickerInfosRequest` — 拼接贴纸
- `ModifyStickerInfosRequest` — 修改贴纸

但 `router.py` 和 `main.py` 中没有对应的 REST 路由，plan 中也没有 MCP Tool。可推迟到 Phase 2。

### 5.2 `save_draft` 的 `client_id` 参数

`schemas.py` L40：
```python
client_id: Annotated[int, Doc("剪映小程序客户端编号，默认值：10000")] = 10000
```

在 MCP 单租户模式下此参数无实际意义。建议：
- MCP Tool 中移除此参数
- 或改为可选参数，默认值 10000

### 5.3 handlers 目录分工不均

Plan 中 4 个 handler 文件的工作量分布：

| 文件 | Tool 数量 | 包含的 Tool 类别 |
|------|:---:|------|
| `draft.py` | 5 | 草稿管理 |
| `material.py` | **11** | 素材添加 + 信息创建 + 时间线 + 音频特效 + 关键帧 |
| `effect.py` | 6 | 特效/滤镜生成 |
| `preset.py` | 3 | 预设查询 |

`material.py` 承载了过多职责，建议按功能拆分：

```
handlers/
├── draft.py      # 草稿管理 (5)
├── material.py   # 素材添加到草稿 (3)
├── segment.py    # 素材信息创建 + 修改 (6+4)
├── timeline.py   # 时间线操作 (2)
├── effect.py     # 特效/滤镜生成+添加 (6)
├── preset.py     # 预设查询 (3+2)
└── keyframe.py   # 关键帧 (2)
```

### 5.4 错误处理策略缺失

Plan 未定义 MCP Tool 的统一错误返回格式。建议：

```python
# 成功
{"code": 0, "message": "success", ...}
# 失败
{"code": -1, "message": "draft not found: xxx"}
```

与 `ApiResponse`（schemas.py L16-19）保持一致。

### 5.5 草稿缓存管理未说明

`core/draft/generate/draft_cache.py` 有缓存过期机制（7 天默认）。Plan 中未说明：
- MCP 场景下过期策略是否需要调整
- 缓存淘汰时 MCP Tool 如何响应
- 是否需要 `list_drafts` 工具查看当前缓存中的草稿

---

## 六、修正后的 Tool 设计建议

### 总览

| 层级 | Tool 来源 | 数量 | 实现难度 |
|------|---------|:---:|------|
| Layer 1 | 包装已有 REST 路由 | 13 | 低 |
| Layer 2 | 补齐 REST 路由遗漏 | 10 | 低（P0: 4, P1: 6） |
| Layer 3 | 直接调用底层模块 | 6 | 中 |
| Layer 4 | 预设查询（读 pjy/metadata/） | 5 | 低 |
| **合计** | | **34** | |

### 完整 Tool 清单

#### 草稿管理（7 个）

| Tool | Layer | 优先级 | 数据源 |
|------|:---:|:---:|------|
| `create_draft` | L1 | P0 | REST `POST /api/draft/create` |
| `delete_draft` | L1 | P0 | REST `POST /api/draft/delete` |
| `get_template` | L1 | P0 | REST `GET /api/draft/template/{id}` |
| `save_draft` | L3 | P0 | 直接调用 `core/draft`（无 REST 路由） |
| `generate_jianying_draft` | L1 | P0 | REST `POST /api/draft/jianying/generate` |
| `get_draft_content` | **L2 新增** | **P0** | REST `GET /draft/content/{id}` |
| `list_drafts` | **L2 新增** | **P0** | 调用 `draft_cache` 枚举缓存 |

#### 素材添加到草稿（3 个）

| Tool | Layer | 优先级 | 数据源 |
|------|:---:|:---:|------|
| `add_videos` | L1 | P0 | REST `POST /api/draft/add_videos` |
| `add_audios` | L1 | P0 | REST `POST /api/draft/add_audios` |
| `add_texts` | L1 | P0 | REST `POST /api/draft/add_texts` |

#### 素材信息创建（3 个）

| Tool | Layer | 优先级 | 数据源 |
|------|:---:|:---:|------|
| `create_video_info` | L1 | P0 | REST `POST /api/draft/video/info` |
| `create_audio_info` | L1 | P0 | REST `POST /api/draft/audio/info` |
| `create_text_info` | L1 | P0 | REST `POST /api/draft/text/info` |

#### 素材修改（3 个）— **新增 P0**

| Tool | Layer | 优先级 | 数据源 |
|------|:---:|:---:|------|
| `video_modify` | **L2 新增** | **P0** | REST `POST /api/draft/video/modify` |
| `audio_modify` | **L2 新增** | **P0** | REST `POST /api/draft/audio/modify` |
| `text_modify` | **L2 新增** | **P0** | REST `POST /api/draft/text/modify` |

#### 素材拼接/交换（6 个）— **新增 P1**

| Tool | Layer | 优先级 | 数据源 |
|------|:---:|:---:|------|
| `video_concat` | **L2 新增** | P1 | REST `POST /api/draft/video/concat` |
| `audio_concat` | **L2 新增** | P1 | REST `POST /api/draft/audio/concat` |
| `text_concat` | **L2 新增** | P1 | REST `POST /api/draft/text/concat` |
| `video_swap` | **L2 新增** | P1 | REST `POST /api/draft/video/swap` |
| `audio_swap` | **L2 新增** | P1 | REST `POST /api/draft/audio/swap` |
| `text_swap` | **L2 新增** | P1 | REST `POST /api/draft/text/swap` |

#### 时间线操作（2 个）

| Tool | Layer | 优先级 | 数据源 |
|------|:---:|:---:|------|
| `generate_timelines` | L1 | P0 | REST `POST /api/draft/timelines/generate` |
| `generate_timelines_by_audio` | L1 | P0 | REST `POST /api/draft/timelines/generate_by_audio` |

#### 特效/滤镜生成（6 个）

| Tool | Layer | 优先级 | 数据源 |
|------|:---:|:---:|------|
| `generate_video_effect` | L3 | P1 | 直接调用 `pjy/metadata/`（无 REST） |
| `generate_video_filter` | L3 | P1 | 直接调用 `pjy/metadata/`（无 REST） |
| `generate_transition` | L3 | P1 | 直接调用 `pjy/metadata/transition_meta.py` |
| `generate_audio_effect` | L3 | P1 | 直接调用 `pjy/metadata/`（无 REST） |
| `generate_keyframe` | L3 | P1 | 直接调用 `pjy/keyframe.py`（无 REST） |
| `generate_audio_keyframe` | L3 | P1 | 直接调用 `pjy/keyframe.py`（无 REST） |

> **重要**：这 6 个 Tool 必须采用**合并方案**——生成效果的同时将其添加到草稿缓存中，避免 add_effects 流程断裂。

#### 预设查询（5 个）

| Tool | Layer | 优先级 | 数据源 |
|------|:---:|:---:|------|
| `list_filter_presets` | L4 | P1 | `pjy/metadata/filter_meta.py` |
| `list_video_effect_presets` | L4 | P1 | `pjy/metadata/video_scene_effect.py` + `video_character_effect.py` |
| `list_transition_presets` | L4 | P1 | `pjy/metadata/transition_meta.py` |
| `list_font_presets` | **L4 新增** | P1 | `pjy/metadata/font_meta.py` |
| `list_video_animation_presets` | **L4 新增** | P2 | `pjy/metadata/video_intro.py` + `video_outro.py` + `video_group_animation.py` |

---

## 七、Phase 1 开发实施建议

### 7.1 优先级排序

```
Phase 1-A（最小可用）: Layer 1 全部 13 个 Tool
  └─ 实现方式：MCP Server 包装 REST 路由
  └─ 交付物：可通过 MCP 创建草稿、添加素材、生成剪映文件

Phase 1-B（编辑闭环）: Layer 2 P0 的 4 个 Tool
  └─ get_draft_content, list_drafts, video_modify, audio_modify, text_modify
  └─ 交付物：AI Agent 可读取并修改已有草稿

Phase 1-C（增强操作）: Layer 2 P1 的 6 个 Tool
  └─ concat/swap 系列
  └─ 交付物：支持素材重排和合并

Phase 1-D（效果能力）: Layer 3 + Layer 4 的 11 个 Tool
  └─ 特效/滤镜/关键帧生成 + 预设查询
  └─ 交付物：完整的效果能力
```

### 7.2 开发注意事项

1. **参数完整性**：每个 MCP Tool 的 `inputSchema` 应与 `schemas.py` 中的 Pydantic Model 完全对应，不能简化
2. **合并方案**：Layer 3 的 6 个 Tool 必须同时完成"生成+添加到草稿"，不能拆分
3. **handlers 拆分**：按上述建议拆为 6-7 个 handler 文件，避免 `material.py` 过大
4. **错误格式**：统一使用 `{"code": 0/-1, "message": "..."}` 格式
5. **save_draft**：移除 `client_id` 或改为可选参数（默认 10000）
