# 贴纸 API

> 模块：剪映数据插件 - 贴纸处理
> 更新时间：2026-03-13

---

## 1. sticker_info 自动创建贴纸信息

### 功能说明
根据贴纸 resource_id 和参数，自动创建一段贴纸素材信息。

### 1.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| resource_id | String | 是 | 贴纸 resource_id |
| target_time_start | Integer | 否 | 片段在轨道上的开始时间（微秒） |
| target_time_duration | Integer | 否 | 片段在轨道上的时长（微秒） |
| clip_alpha | Number | 否 | 贴纸透明度，0-1，默认 1.0 |
| clip_flip_horizontal | Boolean | 否 | 是否水平翻转，默认 false |
| clip_flip_vertical | Boolean | 否 | 是否垂直翻转，默认 false |
| clip_rotation | Number | 否 | 顺时针旋转角度（度），默认 0 |
| clip_scale_x | Number | 否 | 水平缩放比例，默认 1.0 |
| clip_scale_y | Number | 否 | 垂直缩放比例，默认 1.0 |
| clip_transform_x | Number | 否 | 水平位移（百分比），默认 0 |
| clip_transform_y | Number | 否 | 垂直位移（百分比），默认 -0.8 |

### 1.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| sticker_infos | String | 贴纸素材信息（JSON 字符串） |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 1.3 请求示例

```json
{
    "resource_id": "1234",
    "target_time_start": 0,
    "target_time_duration": 1000000,
    "clip_alpha": 0.2,
    "clip_flip_horizontal": false,
    "clip_flip_vertical": false,
    "clip_rotation": 0,
    "clip_scale_x": 1.0,
    "clip_scale_y": 1.0,
    "clip_transform_x": 0.2
}
```

### 1.4 响应示例

```json
{
    "code": 0,
    "message": "Success",
    "segment_ids": [
        "b7a13fbb-9873-4c45-a5f4-757309ee7d83"
    ],
    "sticker_infos": "[{\"id\":\"b7a13fbb-9873-4c45-a5f4-757309ee7d83\",\"resource_id\":\"1234\",\"target_timerange\":{\"duration\":1000000,\"start\":0},\"clip_settings\":{\"alpha\":0.2,\"flip_horizontal\":false,\"flip_vertical\":false,\"rotation\":0,\"scale_x\":1,\"scale_y\":1,\"transform_x\":0.2,\"transform_y\":0}}]"
}
```

---

## 2. modify_sticker_infos 修改贴纸信息

### 功能说明
修改一个贴纸素材信息，指定修改贴纸素材片段的基本信息。

### 2.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| segment_index | Array | 是 | 要修改的素材片段索引，如 `[1,2,3,5]` |
| target_time_start | Integer | 否 | 片段在轨道上的开始时间（微秒） |
| target_time_duration | Integer | 否 | 片段在轨道上的时长（微秒） |
| clip_alpha | Number | 否 | 贴纸透明度，0-1 |
| clip_flip_horizontal | Boolean | 否 | 是否水平翻转 |
| clip_flip_vertical | Boolean | 否 | 是否垂直翻转 |
| clip_rotation | Number | 否 | 旋转角度（度） |
| clip_scale_x | Number | 否 | 水平缩放比例 |
| clip_scale_y | Number | 否 | 垂直缩放比例 |
| clip_transform_x | Number | 否 | 水平位移（百分比） |
| clip_transform_y | Number | 否 | 垂直位移（百分比） |
| sticker_infos | String | 是 | 贴纸素材信息 |

### 2.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| sticker_infos | String | 修改后的贴纸素材信息 |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 2.3 请求示例

```json
{
  "segment_index": [1, 5],
  "sticker_infos": "[{\"id\":\"cfe094eb-f4cc-4f97-bab3-2fac2173e5eb\",\"resource_id\":\"1234\",\"target_timerange\":{\"duration\":1000000,\"start\":0}}]",
  "target_time_start": 100000,
  "target_time_duration": 4000000,
  "clip_alpha": 0.1,
  "clip_flip_horizontal": false,
  "clip_flip_vertical": true,
  "clip_scale_x": 2
}
```

### 2.4 响应示例

```json
{
    "code": 0,
    "message": "Success",
    "segment_ids": [
        "cfe094eb-f4cc-4f97-bab3-2fac2173e5eb"
    ],
    "sticker_infos": "[{\"id\":\"cfe094eb-f4cc-4f97-bab3-2fac2173e5eb\",\"resource_id\":\"1234\",\"target_timerange\":{\"duration\":4000000,\"start\":100000},\"clip_settings\":{\"alpha\":0.1,\"flip_horizontal\":false,\"flip_vertical\":true,\"rotation\":0,\"scale_x\":2,\"scale_y\":1,\"transform_x\":0,\"transform_y\":0}}]"
}
```

---

## 3. concat_sticker_infos 拼接两个贴纸素材信息

### 功能说明
将两个贴纸素材信息拼接成一个新的贴纸素材信息。

### 3.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sticker_infos1 | String | 是 | 待拼接的第一个贴纸素材 |
| sticker_infos2 | String | 是 | 待拼接的第二个贴纸素材 |

### 3.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| sticker_infos | String | 拼接后的贴纸素材 |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 3.3 请求示例

```json
{
  "sticker_infos1": "[{\"clip_settings\":{\"alpha\":0.2},\"id\":\"cfe094eb-f4cc-4f97-bab3-2fac2173e5eb\",\"resource_id\":\"1234\",\"target_timerange\":{\"duration\":1000000,\"start\":100000}}]",
  "sticker_infos2": "[{\"clip_settings\":{\"alpha\":0.2},\"id\":\"cfe094eb-f4cc-4f97-bab3-2fac2173e5eb\",\"resource_id\":\"1234\",\"target_timerange\":{\"duration\":1000000,\"start\":100000}}]"
}
```

### 3.4 响应示例

```json
{
    "code": 0,
    "message": "成功",
    "segment_ids": [
        "cfe094eb-f4cc-4f97-bab3-2fac2173e5eb",
        "cfe094eb-f4cc-4f97-bab3-2fac2173e5eb"
    ],
    "sticker_infos": "[{\"clip_settings\":{\"alpha\":0.2},\"id\":\"cfe094eb-f4cc-4f97-bab3-2fac2173e5eb\",\"resource_id\":\"1234\",\"target_timerange\":{\"duration\":1000000,\"start\":100000}},{\"clip_settings\":{\"alpha\":0.2},\"id\":\"cfe094eb-f4cc-4f97-bab3-2fac2173e5eb\",\"resource_id\":\"1234\",\"target_timerange\":{\"duration\":1000000,\"start\":1100000}}]"
}
```

---

## 📝 注意事项

1. 时间单位统一为**微秒**（μs）
2. `1 秒 = 1,000,000 微秒`
3. 位移参数使用**百分比**表示（相对于画面尺寸）
4. 透明度范围：0.0（完全透明）~ 1.0（完全不透明）
5. segment_index 从 **1** 开始计数
6. 默认垂直位移 `transform_y` 为 `-0.8`（参考剪映默认布局）
7. 缩放比例 1.0 = 原始大小
8. **resource_id** 需要从剪映素材库中获取，可通过模板草稿提取
