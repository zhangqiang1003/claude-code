# 关键帧 API

> 模块：剪映数据插件 - 关键帧处理
> 更新时间：2026-03-13

---

## 1. generate_keyframe 生成音频/图片/文本的关键帧

### 功能说明
为音频、图片、文本、视频素材生成关键帧动画。

### 1.1 支持的关键帧属性

| 属性名 | 说明 | 适用素材 | 值范围/说明 |
|--------|------|----------|-------------|
| KFTypePositionX | 水平位置偏移 | 视频/图片/文本/贴纸 | 百分比值（相对于半个画面宽度） |
| KFTypePositionY | 垂直位置偏移 | 视频/图片/文本/贴纸 | 百分比值（相对于半个画面高度） |
| KFTypeRotation | 顺时针旋转角度 | 视频/图片/文本/贴纸 | 角度值（度） |
| KFTypeScaleX | X 轴缩放比例 | 视频/图片/文本/贴纸 | 1.0 为原始大小 |
| KFTypeScaleY | Y 轴缩放比例 | 视频/图片/文本/贴纸 | 1.0 为原始大小 |
| UNIFORM_SCALE | 同时设置 X 轴及 Y 轴缩放比例 | 视频/图片/文本/贴纸 | 1.0 为原始大小 |
| KFTypeAlpha | 透明度 | 视频/图片/文本/贴纸 | 0.0~1.0，1.0 为完全不透明 |
| KFTypeSaturation | 饱和度 | 视频/图片 | -1.0~1.0，0.0 为原始饱和度 |
| KFTypeContrast | 对比度 | 视频/图片 | -1.0~1.0，0.0 为原始对比度 |
| KFTypeBrightness | 亮度 | 视频/图片 | -1.0~1.0，0.0 为原始亮度 |
| KFTypeVolume | 音量 | 音频/视频 | 1.0 为原始音量 |

### 1.2 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| segment_ids | Array | 是 | 素材（音频/图片/文本/视频）片段唯一标识列表 |
| property | String | 是 | 关键帧属性名称（见上表） |
| time_offset | Array | 是 | 相对素材开始时间的偏移量列表（微秒），如 `[1000000,5000000,9000000]` |
| value | Array | 是 | 关键帧的值列表，与 time_offset 一一对应，如 `[20.0,30.0,60.0]` |
| segment_index | Array | 是 | 素材唯一标识位置列表（从 1 开始） |

### 1.3 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| keyframe_ids | Array | 关键帧 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 1.4 请求示例

```json
{
    "segment_ids": ["1234", "42322"],
    "time_offset": [1200000, 20000000],
    "property": "KFTypePositionX",
    "value": [20, 50],
    "segment_index": [1, 2]
}
```

### 1.5 响应示例

```json
{
    "code": 0,
    "keyframe_ids": [
        "cbbbc70d-995c-48f3-9ad0-313001b35255",
        "6236d8fa-06f6-472a-bcbe-279248241009",
        "d0bc8d9a-26fa-4099-9b7c-a470950d41bb",
        "549bc4e2-ee88-42f5-bcd2-63b3c00efbf0"
    ],
    "message": "success"
}
```

---

## 2. generate_keyframe_for_audio 为音频片段生成音量关键帧

### 功能说明
为音频片段生成音量变化的关键帧动画。

### 2.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| audio_ids | Array | 是 | 音频唯一标识列表 |
| time_offset | Array | 是 | 相对音频开始时间的偏移量列表（微秒） |
| volume | Array | 是 | 音量值列表，与 time_offset 一一对应 |
| segment_index | Array | 是 | 音频位置列表（从 1 开始） |

### 2.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| audio_keyframe_ids | Array | 音频关键帧 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 2.3 请求示例

```json
{
    "audio_ids": ["1234"],
    "time_offset": [20333],
    "volume": [0.3],
    "segment_index": [1]
}
```

### 2.4 响应示例

```json
{
    "audio_keyframe_ids": [
        "32f1be51-bbb0-40e3-83da-eca40245413f"
    ],
    "code": 0,
    "message": "success"
}
```

---

## 3. 关键帧使用说明

### 3.1 关键帧插值

关键帧之间会自动进行**线性插值**，实现平滑过渡效果。

**示例**：设置位置动画
```json
{
    "segment_ids": ["video_001"],
    "property": "KFTypePositionX",
    "time_offset": [0, 2000000, 4000000],
    "value": [0, 50, 100],
    "segment_index": [1]
}
```

效果：
- 0ms 时：位置 X = 0%
- 2000ms 时：位置 X = 50%
- 4000ms 时：位置 X = 100%

### 3.2 常用动画组合

| 效果 | 属性组合 | 说明 |
|------|----------|------|
| 位移动画 | KFTypePositionX + KFTypePositionY | 实现画面移动效果 |
| 缩放动画 | KFTypeScaleX + KFTypeScaleY 或 UNIFORM_SCALE | 实现放大/缩小效果 |
| 旋转动画 | KFTypeRotation | 实现旋转效果 |
| 淡入淡出 | KFTypeAlpha | 实现透明度变化 |
| 音量渐变 | KFTypeVolume | 实现音量淡入淡出 |
| 色彩调节 | KFTypeSaturation + KFTypeContrast + KFTypeBrightness | 调节画面色彩 |

### 3.3 位置值说明

位置值单位为**半个画布**：

| 属性 | 计算方式 |
|------|----------|
| KFTypePositionX | `剪映显示值 / 画布宽度` |
| KFTypePositionY | `剪映显示值 / 画布高度` |

**示例**：对于 1920x1080 的画布
- 向右移动 960 像素：`KFTypePositionX = 1.0` (960/960)
- 向上移动 540 像素：`KFTypePositionY = 1.0` (540/540)

---

## 📝 注意事项

1. 时间单位统一为**微秒**（μs）
2. `1 秒 = 1,000,000 微秒`
3. 位置值使用**百分比**表示（相对于半个画面尺寸）
4. segment_index 从 **1** 开始计数
5. 关键帧至少需要 **2 个点**才能形成动画
6. 音量范围：0.0（静音）~ N（可放大音量）
7. **scale_x/scale_y 与 uniform_scale 互斥**，不能同时使用
8. 关键帧会自动按时间排序