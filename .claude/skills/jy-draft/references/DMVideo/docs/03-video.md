# 视频处理 API

> 模块：剪映数据插件 - 视频/图片处理
> 更新时间：2026-03-13

---

## 1. video_info 自动创建一个视频/图片片段

### 功能说明
根据视频/图片 URL 和参数，自动创建一段视频或图片素材信息。

### 1.1 请求参数

#### 基础参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| video_url | String | 是 | 视频素材的 URL 地址 |
| target_time_start | Integer | 否 | 素材在轨道上的开始时间（微秒），默认 0 |
| target_time_duration | Integer | 否 | 素材在轨道上的时长（微秒） |

#### 播放控制参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| speed | Number | 否 | 播放速度，默认 1.0，取值范围：0.1~42.0 |
| volume | Number | 否 | 音量，默认 1.0（100%） |
| change_pitch | Boolean | 否 | 是否跟随变速改变音调，默认 false |
| source_time_start | Integer | 否 | 截取素材片段的开始时间（微秒） |
| source_time_duration | Integer | 否 | 截取素材片段的时长（微秒） |

#### 图像调节参数（clip_settings）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| alpha | Number | 否 | 不透明度，0.0~1.0，默认 1.0（不透明） |
| flip_horizontal | Boolean | 否 | 是否水平翻转，默认 false |
| flip_vertical | Boolean | 否 | 是否垂直翻转，默认 false |
| rotation | Number | 否 | 顺时针旋转的角度（度），默认 0 |
| scale_x | Number | 否 | 水平缩放比例，默认 1.0 |
| scale_y | Number | 否 | 垂直缩放比例，默认 1.0 |
| transform_x | Number | 否 | 水平位移（单位：半个画布宽），默认 0 |
| transform_y | Number | 否 | 垂直位移（单位：半个画布高），默认 0 |

#### 动画参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| animation_intro_type | String | 否 | 入场动画名称，见下方动画类型表 |
| animation_intro_duration | Integer | 否 | 入场动画时长（微秒） |
| animation_outro_type | String | 否 | 出场动画名称，见下方动画类型表 |
| animation_outro_duration | Integer | 否 | 出场动画时长（微秒） |
| animation_group_type | String | 否 | 组动画名称，见下方动画类型表 |
| animation_group_duration | Integer | 否 | 组动画时长（微秒） |

#### 转场参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| transition_type | String | 否 | 转场类型名称，见下方转场类型表 |
| transition_duration | Integer | 否 | 转场时长（微秒），不指定则使用默认值 |

#### 蒙版参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| mask_type | String | 否 | 蒙版类型，见下方蒙版类型表 |
| mask_center_x | Number | 否 | 蒙版中心 X 坐标（像素），默认 0 |
| mask_center_y | Number | 否 | 蒙版中心 Y 坐标（像素），默认 0 |
| mask_size | Number | 否 | 蒙版主要尺寸（占素材高度比例），默认 0.5 |
| mask_rotation | Number | 否 | 蒙版顺时针旋转角度，默认 0 |
| mask_feather | Number | 否 | 蒙版羽化值，0~100，默认 0 |
| mask_invert | Boolean | 否 | 是否反转蒙版，默认 false |
| mask_rect_width | Number | 否 | 矩形蒙版宽度（占素材宽度比例），仅矩形蒙版有效 |
| mask_round_corner | Number | 否 | 矩形蒙版圆角值，0~100，仅矩形蒙版有效 |

#### 背景填充参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| background_fill_type | String | 否 | 背景填充类型：`blur`（模糊）或 `color`（颜色） |
| background_fill_blur | Number | 否 | 模糊程度，0.0~1.0，剪映四档模糊值：0.0625, 0.375, 0.75, 1.0 |
| background_fill_color | String | 否 | 填充颜色，格式 `#RRGGBBAA` |

#### 音频淡入淡出参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| fade_in_duration | Integer | 否 | 音频淡入时长（微秒），仅对有音轨的视频有效 |
| fade_out_duration | Integer | 否 | 音频淡出时长（微秒），仅对有音轨的视频有效 |

---

### 1.2 蒙版类型

| 类型 | 说明 |
|------|------|
| 线性 | 默认遮挡下方部分 |
| 镜面 | 默认保留两线之间部分 |
| 圆形 | 圆形蒙版 |
| 矩形 | 矩形蒙版，支持圆角设置 |
| 爱心 | 爱心形状蒙版 |
| 星形 | 星形蒙版 |

---

### 1.3 转场类型（部分）

| 类型 | 默认时长 | 是否重叠 |
|------|----------|----------|
| 叠化 | 0.50s | 是 |
| 上移 | 0.50s | 是 |
| 下移 | 0.50s | 是 |
| 左移 | 0.50s | 是 |
| 右移 | 0.50s | 是 |
| 中心旋转 | 0.50s | 否 |
| 放大 | 0.50s | 是 |
| 缩小 | 0.50s | 是 |
| 模糊 | 0.50s | 是 |
| 云朵 | 0.50s | 是 |
| 分割 | 0.50s | 是 |
| 3D空间 | 1.50s | 是 |

> 注：转场应添加在**前面的**片段上

---

### 1.4 视频入场动画类型（部分）

| 类型 | 默认时长 |
|------|----------|
| 渐显 | 0.50s |
| 放大 | 0.50s |
| 缩小 | 0.50s |
| 左移入 | 0.50s |
| 右移入 | 0.50s |
| 上移入 | 0.50s |
| 下移入 | 0.50s |
| 旋转入 | 0.50s |
| 弹入 | 0.50s |

---

### 1.5 视频出场动画类型（部分）

| 类型 | 默认时长 |
|------|----------|
| 渐隐 | 0.50s |
| 放大 | 0.50s |
| 缩小 | 0.50s |
| 左移出 | 0.50s |
| 右移出 | 0.50s |
| 上移出 | 0.50s |
| 下移出 | 0.50s |
| 旋出 | 0.50s |
| 弹出 | 0.50s |

---

### 1.6 组动画类型（部分）

| 类型 | 说明 |
|------|------|
| 组合-放大 | 整体放大效果 |
| 组合-缩小 | 整体缩小效果 |
| 组合-旋转 | 整体旋转效果 |

---

### 1.7 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| video_infos | String | 视频/图片素材信息（JSON 字符串） |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 1.8 请求示例

```json
{
  "video_url": "https://example.com/video.mp4",
  "target_time_start": 0,
  "target_time_duration": 5000000,
  "source_time_start": 150000,
  "source_time_duration": 300000,
  "speed": 1.0,
  "volume": 1.0,
  "alpha": 1.0,
  "scale_x": 1.0,
  "scale_y": 1.0,
  "transform_y": 0,
  "animation_intro_type": "放大",
  "animation_intro_duration": 500000,
  "animation_outro_type": "渐隐",
  "animation_outro_duration": 500000,
  "transition_type": "叠化",
  "transition_duration": 300000,
  "background_fill_type": "blur",
  "background_fill_blur": 0.375,
  "fade_in_duration": 500000,
  "fade_out_duration": 500000
}
```

### 1.9 响应示例

```json
{
    "code": 0,
    "message": "成功",
    "segment_ids": [
        "8846ad8a-c3dd-4ae0-9017-1ac846193b41"
    ],
    "video_infos": "[{\"id\":\"8846ad8a-c3dd-4ae0-9017-1ac846193b41\",\"video_url\":\"https://example.com/video.mp4\",\"speed\":1,\"source_timerange\":{\"start\":150000,\"duration\":300000},\"target_timerange\":{\"start\":0,\"duration\":300000},\"volume\":1,\"alpha\":1,\"flip_horizontal\":false,\"flip_vertical\":false,\"scale_x\":1,\"rotation\":0,\"scale_y\":1}]"
}
```

---

## 2. modify_video_infos 修改视频/图片信息

### 功能说明
修改一个视频/图片素材信息，指定修改视频素材片段的基本信息。

### 2.1 请求参数

参考 `video_info` 的参数，额外需要：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| segment_index | Array | 是 | 要修改的素材片段索引数组（从 1 开始） |
| video_infos | String | 是 | 原视频素材信息（JSON 字符串） |

### 2.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| video_infos | String | 修改后的视频素材信息 |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

---

## 3. video_infos_by_timelines 根据时间线对象创建视频素材信息

### 功能说明
根据输入的时间线数组和视频 URL 列表，批量创建视频素材信息。

### 3.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| timelines | Array | 是 | 时间线数组 |
| timelines.start | Integer | 是 | 开始时间（微秒） |
| timelines.duration | Integer | 是 | 时长（微秒） |
| video_urls | Array | 是 | 视频素材的 URL 列表 |

### 3.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| video_infos | String | 视频素材信息（JSON 字符串） |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 3.3 请求示例

```json
{
    "timelines": [
        {
            "start": 0,
            "duration": 1000000
        },
        {
            "start": 1000000,
            "duration": 1000000
        }
    ],
    "video_urls": ["https://w.mp4", "https://b.mp4"]
}
```

### 3.4 响应示例

```json
{
    "code": 0,
    "message": "成功",
    "segment_ids": [
        "15b3abd3-4f13-4cb8-ab92-d2be948ea59e",
        "2937e0b2-53d5-4296-b0f3-3896e1f9cdeb"
    ],
    "video_infos": "[{\"id\":\"15b3abd3-4f13-4cb8-ab92-d2be948ea59e\",\"target_timerange\":{\"duration\":1000000,\"start\":0},\"source_timerange\":{\"duration\":1000000,\"start\":0},\"video_url\":\"https://w.mp4\"},{\"id\":\"2937e0b2-53d5-4296-b0f3-3896e1f9cdeb\",\"target_timerange\":{\"duration\":1000000,\"start\":1000000},\"source_timerange\":{\"duration\":1000000,\"start\":1000000},\"video_url\":\"https://b.mp4\"}]"
}
```

---

## 4. concat_video_infos 拼接两个视频/图片信息

### 功能说明
将两个视频信息拼接成一个新的视频信息。

### 4.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| video_infos1 | String | 是 | 待拼接的第一个视频素材 |
| video_infos2 | String | 是 | 待拼接的第二个视频素材 |

### 4.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| video_infos | String | 拼接后的视频素材 |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 4.3 请求示例

```json
{
  "video_infos1": "[{\"id\":\"87e3a59f-35f8-4dba-940b-e45f2b5e1fe7\",\"video_url\":\"https://example.com/video1.mp4\",\"speed\":1,\"source_timerange\":{\"start\":3600000,\"duration\":2000000},\"target_timerange\":{\"start\":0,\"duration\":2000000},\"volume\":1,\"alpha\":1,\"scale_x\":1.38,\"scale_y\":1.38}]",
  "video_infos2": "[{\"id\":\"783dfa1c-2dfc-4a73-aa0b-a6bd89faa62a\",\"video_url\":\"https://example.com/video2.mp4\",\"speed\":1,\"source_timerange\":{\"start\":0,\"duration\":9000000},\"target_timerange\":{\"start\":0,\"duration\":9000000},\"transition\":{\"name\":\"叠化\",\"duration\":300000}}]"
}
```

### 4.4 响应示例

```json
{
    "code": 0,
    "message": "成功",
    "segment_ids": [
        "87e3a59f-35f8-4dba-940b-e45f2b5e1fe7",
        "783dfa1c-2dfc-4a73-aa0b-a6bd89faa62a"
    ],
    "video_infos": "[{\"id\":\"87e3a59f-35f8-4dba-940b-e45f2b5e1fe7\",\"video_url\":\"https://example.com/video1.mp4\",\"speed\":1,\"source_timerange\":{\"start\":3600000,\"duration\":2000000},\"target_timerange\":{\"start\":0,\"duration\":2000000},\"scale_x\":1.38,\"scale_y\":1.38},{\"id\":\"783dfa1c-2dfc-4a73-aa0b-a6bd89faa62a\",\"video_url\":\"https://example.com/video2.mp4\",\"speed\":1,\"source_timerange\":{\"start\":0,\"duration\":9000000},\"target_timerange\":{\"start\":2000000,\"duration\":9000000},\"transition\":{\"name\":\"叠化\",\"duration\":300000}}]"
}
```

---

## 5. swap_video_segment_position 交换视频/图片素材片段

### 功能说明
交换一个视频信息中两个视频素材片段的位置。

### 5.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| swap_position | Array | 是 | 交换位置配置数组 |
| swap_position.source_index | Integer | 是 | 源位置（从 1 开始） |
| swap_position.swap_index | Integer | 是 | 交换位置 |
| target_timerange_start | Integer | 否 | 新素材在轨道上的开始时间（微秒），默认 0 |
| video_infos | String | 是 | 视频素材信息 |

### 5.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| video_infos | String | 交换后的视频素材 |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 5.3 请求示例

```json
{
    "video_infos": "[{\"id\":\"1234\",\"video_url\":\"https://a.mp4\",\"target_timerange\":{\"start\":0,\"duration\":5000000}},{\"id\":\"123s4\",\"video_url\":\"https://b.mp4\",\"target_timerange\":{\"start\":5000000,\"duration\":5500000}}]",
    "swap_position": [
        {
            "source_index": 1,
            "swap_index": 2
        }
    ],
    "target_timerange_start": 400000
}
```

### 5.4 响应示例

```json
{
    "code": 0,
    "message": "成功",
    "segment_ids": [
        "123s4",
        "1234"
    ],
    "video_infos": "[{\"id\":\"123s4\",\"video_url\":\"https://b.mp4\",\"target_timerange\":{\"duration\":5500000,\"start\":400000}},{\"id\":\"1234\",\"video_url\":\"https://a.mp4\",\"target_timerange\":{\"duration\":5000000,\"start\":5900000}}]"
}
```

---

## 6. generate_video_effect 生成视频/图片特效

### 功能说明
为视频/图片素材生成特效（如抖动、模糊等）。

### 6.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| effect_type_name | String | 是 | 特效名称（见下方特效类型表） |
| params | Array | 否 | 特效参数列表，取值范围 0~100 |
| segment_ids | Array | 是 | 视频/图片素材唯一标识列表 |
| segment_index | Array | 是 | 素材位置列表（从 1 开始） |

### 6.2 视频场景特效类型（部分）

| 特效名称 | 说明 |
|----------|------|
| 抖动 | 画面抖动效果 |
| 模糊 | 画面模糊效果 |
| 闪白 | 闪白效果 |
| 闪黑 | 闪黑效果 |
| 故障 | 故障艺术效果 |
| RGB分离 | RGB色彩分离效果 |
| 鱼眼 | 鱼眼镜头效果 |
| 波纹 | 水波纹效果 |

### 6.3 视频人物特效类型（部分）

| 特效名称 | 说明 |
|----------|------|
| 磨皮 | 皮肤磨皮效果 |
| 美白 | 皮肤美白效果 |
| 瘦脸 | 瘦脸效果 |
| 大眼 | 放大眼睛效果 |

### 6.4 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| effect_ids | Array | 特效 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 6.5 请求示例

```json
{
    "effect_type_name": "抖动",
    "params": [50],
    "segment_ids": ["1234"],
    "segment_index": [1]
}
```

### 6.6 响应示例

```json
{
    "code": 0,
    "effect_ids": [
        "70ccf290-47b9-44a4-b514-4f41a8adcac1"
    ],
    "message": "success"
}
```

---

## 7. generate_video_filter 生成视频/图片滤镜

### 功能说明
为视频/图片素材生成滤镜（如黑白、复古等）。

### 7.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| filter_type_name | String | 是 | 滤镜名称（见下方滤镜类型表） |
| intensity | Number | 否 | 滤镜强度，0~100，默认 100 |
| segment_ids | Array | 是 | 视频/图片素材唯一标识列表 |
| segment_index | Array | 是 | 素材位置列表（从 1 开始） |

### 7.2 滤镜类型（部分）

| 滤镜名称 | 说明 |
|----------|------|
| 黑白 | 黑白滤镜 |
| 复古 | 复古滤镜 |
| 暖色 | 暖色调滤镜 |
| 冷色 | 冷色调滤镜 |
| 日系 | 日系清新滤镜 |
| 电影 | 电影质感滤镜 |
| 褪色 | 褪色效果滤镜 |
| 高对比 | 高对比度滤镜 |
| 低对比 | 低对比度滤镜 |
| 高饱和 | 高饱和度滤镜 |
| 低饱和 | 低饱和度滤镜 |

### 7.3 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| filter_ids | Array | 滤镜 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 7.4 请求示例

```json
{
    "filter_type_name": "黑白",
    "segment_ids": ["124"],
    "intensity": 80,
    "segment_index": [1]
}
```

### 7.5 响应示例

```json
{
    "code": 0,
    "filter_ids": [
        "f94e8cd7-9336-45e8-8c93-71e779cffeb0"
    ],
    "message": "success"
}
```

---

## 📝 注意事项

1. 时间单位统一为**微秒**（μs），1 秒 = 1,000,000 微秒
2. 位移参数 `transform_x/y` 单位为**半个画布宽/高**
3. 缩放比例 1.0 = 原始大小
4. 透明度范围：0.0（完全透明）~ 1.0（完全不透明）
5. segment_index 从 **1** 开始计数
6. **转场应添加在前面的片段上**
7. **背景填充仅对底层视频轨道上的片段生效**
8. 主视频轨道（最底层视频轨道）上的片段必须从 0s 开始