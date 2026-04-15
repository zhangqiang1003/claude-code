# 文本处理 API

> 模块：剪映数据插件 - 文本处理
> 更新时间：2026-03-13

---

## 1. text_info 自动创建一个文本片段

### 功能说明
根据文本内容和样式参数，自动创建一段文本素材信息。

### 1.1 请求参数

#### 基础参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | String | 是 | 文本内容 |
| font | String | 否 | 字体名称，默认系统字体 |
| target_time_start | Integer | 否 | 片段在轨道上的开始时间（微秒） |
| target_time_duration | Integer | 否 | 片段在轨道上的时长（微秒） |

#### 样式参数（style_）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| style_size | Number | 否 | 字体大小，默认 8.0 |
| style_bold | Boolean | 否 | 是否加粗，默认 false |
| style_italic | Boolean | 否 | 是否斜体，默认 false |
| style_underline | Boolean | 否 | 是否加下划线，默认 false |
| style_color | Array | 否 | 字体颜色 RGB 值，如 `[255,255,255]`，默认白色 |
| style_alpha | Number | 否 | 字体不透明度，0-1，默认 1 |
| style_align | Integer | 否 | 对齐方式：0=左对齐，1=居中，2=右对齐，默认 0 |
| style_vertical | Boolean | 否 | 是否为竖排文本，默认 false |
| style_letter_spacing | Integer | 否 | 字符间距，默认 0 |
| style_line_spacing | Integer | 否 | 行间距，默认 0 |
| style_auto_wrapping | Boolean | 否 | 是否自动换行，默认 false |
| style_max_line_width | Number | 否 | 每行最大宽度占比，0-1，默认 0.82 |

#### 裁剪参数（clip_）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| clip_alpha | Number | 否 | 文本透明度，0-1，默认 1.0 |
| clip_flip_horizontal | Boolean | 否 | 是否水平翻转，默认 false |
| clip_flip_vertical | Boolean | 否 | 是否垂直翻转，默认 false |
| clip_rotation | Number | 否 | 顺时针旋转角度（度），默认 0 |
| clip_scale_x | Number | 否 | 水平缩放比例，默认 1.0 |
| clip_scale_y | Number | 否 | 垂直缩放比例，默认 1.0 |
| clip_transform_x | Number | 否 | 水平位移（百分比），默认 0 |
| clip_transform_y | Number | 否 | 垂直位移（百分比），默认 0 |

#### 边框参数（border_）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| border_alpha | Number | 否 | 边框不透明度，0-1，默认 1.0 |
| border_color | Array | 否 | 边框颜色 RGB 值，如 `[0,0,0]`，默认黑色 |
| border_width | Number | 否 | 边框宽度，0-100，默认 0 |

#### 背景参数（background_）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| background_color | String | 否 | 背景颜色，#RRGGBB 格式 |
| background_style | Integer | 否 | 背景样式：1 或 2，默认 1 |
| background_alpha | Number | 否 | 背景不透明度，0-1，默认 1.0 |
| background_round_radius | Number | 否 | 背景圆角半径，0-1，默认 0.0 |
| background_height | Number | 否 | 背景高度占比，0-1，默认 0.14 |
| background_width | Number | 否 | 背景宽度占比，0-1，默认 0.14 |
| background_horizontal_offset | Number | 否 | 背景水平偏移，0-1，默认 0.5 |
| background_vertical_offset | Number | 否 | 背景垂直偏移，0-1，默认 0.5 |

#### 动画参数（animation_）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| animation_intro_type | String | 否 | 文本入场动画名称 |
| animation_intro_duration | Integer | 否 | 入场动画时长（微秒），默认 500000（0.5 秒） |
| animation_outro_type | String | 否 | 文本出场动画名称 |
| animation_outro_duration | Integer | 否 | 出场动画时长（微秒），默认 500000（0.5 秒） |
| animation_loop_type | String | 否 | 文本循环动画名称 |

#### 特效参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bubble_resource_id | String | 否 | 气泡效果 resource_id |
| bubble_effect_id | String | 否 | 气泡效果 effect_id |
| font_effect_id | String | 否 | 字体效果 effect_id |

### 1.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| text_infos | String | 文本素材信息（JSON 字符串） |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 1.3 请求示例

```json
{
    "text": "这是一个文本",
    "font": "微软雅黑",
    "target_time_start": 500000,
    "target_time_duration": 6000000,
    "style_size": 8.0,
    "style_bold": true,
    "style_italic": false,
    "style_underline": false,
    "style_color": [128, 255, 0],
    "style_alpha": 0.5,
    "style_align": 1,
    "style_vertical": true,
    "style_letter_spacing": 2,
    "style_line_spacing": 0,
    "style_auto_wrapping": true,
    "style_max_line_width": 1,
    "clip_alpha": 0.5,
    "clip_flip_horizontal": false,
    "clip_flip_vertical": false,
    "clip_rotation": 0.0,
    "clip_scale_x": 1.0,
    "clip_scale_y": 1.0,
    "clip_transform_x": 0,
    "clip_transform_y": 0,
    "border_alpha": 1,
    "border_color": [0, 128, 0],
    "border_width": 30.0,
    "background_color": "#000000",
    "background_style": 1,
    "background_alpha": 0.2,
    "background_round_radius": 0.2,
    "background_height": 20,
    "background_width": 30,
    "background_horizontal_offset": 0.5,
    "background_vertical_offset": 0.5,
    "animation_intro_type": "渐显入场",
    "animation_intro_duration": 500000,
    "animation_outro_type": "渐隐出场",
    "animation_outro_duration": 500000,
    "animation_loop_type": "呼吸循环",
    "bubble_resource_id": "idjeidksjejd",
    "bubble_effect_id": "dasdfasdf",
    "font_effect_id": "asdfasdf"
}
```

### 1.4 响应示例

```json
{
    "code": 0,
    "message": "Success",
    "segment_ids": [
        "80447ae1-1f55-4e45-96f7-6086e72d260c"
    ],
    "text_infos": "[{\"id\":\"80447ae1-1f55-4e45-96f7-6086e72d260c\",\"text\":\"这是一个文本\",\"timerange\":{\"start\":500000,\"duration\":6000000},\"background\":{\"color\":\"#000000\",\"style\":1,\"alpha\":0.2,\"round_radius\":0.2,\"height\":20,\"width\":30,\"horizontal_offset\":0.5,\"vertical_offset\":0.5},\"border\":{\"alpha\":1,\"color\":[0,0.5,0],\"width\":30},\"bubble\":{\"effect_id\":\"dasdfasdf\",\"resource_id\":\"idjeidksjejd\"},\"clip_settings\":{\"alpha\":0.5,\"flip_horizontal\":false,\"flip_vertical\":false,\"rotation\":0,\"scale_x\":1,\"scale_y\":1,\"transform_x\":0,\"transform_y\":0},\"effect\":{\"effect_id\":\"asdfasdf\"},\"font\":\"微软雅黑\",\"intro_animation\":{\"animation_type\":\"渐显入场\",\"duration\":500000},\"loop_animation_type\":\"呼吸循环\",\"outro_animation\":{\"animation_type\":\"渐隐出场\",\"duration\":500000},\"style\":{\"align\":1,\"alpha\":0.5,\"auto_wrapping\":true,\"bold\":true,\"color\":[0.5,1,0],\"italic\":false,\"letter_spacing\":2,\"line_spacing\":0,\"max_line_width\":1,\"size\":8,\"underline\":false,\"vertical\":true}}]"
}
```

---

## 2. text_infos_by_timelines 根据时间线对象创建文本素材信息

### 功能说明
根据输入的时间线数组和文本列表，批量创建文本素材信息。

### 2.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| timelines | Array | 是 | 时间线数组 |
| timelines.start | Integer | 是 | 开始时间（微秒） |
| timelines.duration | Integer | 是 | 时长（微秒） |
| texts | Array | 是 | 文本列表 |

### 2.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| text_infos | String | 文本素材信息（JSON 字符串） |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 2.3 请求示例

```json
{
    "timelines": [
        {
            "start": 0,
            "duration": 4300000
        },
        {
            "start": 4300000,
            "duration": 1000000
        }
    ],
    "texts": ["这是一个文本", "这是第二个文本"]
}
```

### 2.4 响应示例

```json
{
    "code": 0,
    "message": "Success",
    "segment_ids": [
        "5f079a7f-fb08-4962-bbb7-cac1d3b7169c",
        "edbb7d91-08ad-4d2d-b936-52caf7fce113"
    ],
    "text_infos": "[{\"id\":\"5f079a7f-fb08-4962-bbb7-cac1d3b7169c\",\"text\":\"这是一个文本\",\"timerange\":{\"duration\":4300000,\"start\":0}},{\"id\":\"edbb7d91-08ad-4d2d-b936-52caf7fce113\",\"text\":\"这是第二个文本\",\"timerange\":{\"duration\":1000000,\"start\":4300000}}]"
}
```

---

## 3. modify_text_infos 修改文本信息

### 功能说明
修改一个文本素材信息，指定修改文本素材片段的基本信息。

### 3.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| segment_index | Array | 是 | 要修改的素材片段索引，如 `[1,2,3,5]` |
| font | String | 否 | 字体名称 |
| target_time_start | Integer | 否 | 片段在轨道上的开始时间（微秒） |
| target_time_duration | Integer | 否 | 片段在轨道上的时长（微秒） |
| style_size | Number | 否 | 字体大小 |
| style_bold | Boolean | 否 | 是否加粗 |
| style_italic | Boolean | 否 | 是否斜体 |
| style_underline | Boolean | 否 | 是否加下划线 |
| style_color | Array | 否 | 字体颜色 RGB 值 |
| style_alpha | Number | 否 | 字体不透明度 |
| style_align | Integer | 否 | 对齐方式 |
| style_vertical | Boolean | 否 | 是否竖排 |
| style_letter_spacing | Integer | 否 | 字符间距 |
| style_line_spacing | Integer | 否 | 行间距 |
| style_auto_wrapping | Boolean | 否 | 是否自动换行 |
| style_max_line_width | Number | 否 | 每行最大宽度占比 |
| clip_alpha | Number | 否 | 文本透明度 |
| clip_flip_horizontal | Boolean | 否 | 是否水平翻转 |
| clip_flip_vertical | Boolean | 否 | 是否垂直翻转 |
| clip_rotation | Number | 否 | 旋转角度 |
| clip_scale_x | Number | 否 | 水平缩放 |
| clip_scale_y | Number | 否 | 垂直缩放 |
| clip_transform_x | Number | 否 | 水平位移 |
| clip_transform_y | Number | 否 | 垂直位移 |
| border_alpha | Number | 否 | 边框不透明度 |
| border_color | Array | 否 | 边框颜色 |
| border_width | Number | 否 | 边框宽度 |
| background_color | String | 否 | 背景颜色 |
| background_style | Integer | 否 | 背景样式 |
| background_alpha | Number | 否 | 背景不透明度 |
| background_round_radius | Number | 否 | 背景圆角 |
| background_height | Number | 否 | 背景高度 |
| background_width | Number | 否 | 背景宽度 |
| background_horizontal_offset | Number | 否 | 背景水平偏移 |
| background_vertical_offset | Number | 否 | 背景垂直偏移 |
| animation_intro_type | String | 否 | 入场动画 |
| animation_intro_duration | Integer | 否 | 入场时长 |
| animation_outro_type | String | 否 | 出场动画 |
| animation_outro_duration | Integer | 否 | 出场时长 |
| animation_loop_type | String | 否 | 循环动画 |
| bubble_resource_id | String | 否 | 气泡 resource_id |
| bubble_effect_id | String | 否 | 气泡 effect_id |
| font_effect_id | String | 否 | 字体 effect_id |
| text_infos | String | 是 | 文本素材信息 |

### 3.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| text_infos | String | 修改后的文本素材信息 |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 3.3 请求示例

```json
{
    "segment_index": [1, 5],
    "target_time_start": 500000,
    "target_time_duration": 6000000,
    "style_size": 8.0,
    "style_bold": true,
    "style_color": [0, 0, 255],
    "style_alpha": 0.5,
    "style_align": 1,
    "border_color": [0, 255, 255],
    "border_width": 30.0,
    "background_color": "#000000",
    "animation_outro_type": "渐隐出场",
    "text_infos": "[{\"background\":{\"color\":\"#000000\"},\"border\":{},\"bubble\":{},\"clip_settings\":{},\"effect\":{},\"id\":\"338e6fc3-e8e4-46b0-8397-c48b87f98df9\",\"intro_animation\":{},\"outro_animation\":{},\"style\":{},\"text\":\"这是一个文本\",\"timerange\":{\"duration\":3000000,\"start\":100000}}]"
}
```

### 3.4 响应示例

```json
{
    "code": 0,
    "message": "修改成功",
    "segment_ids": [
        "338e6fc3-e8e4-46b0-8397-c48b87f98df9"
    ],
    "text_infos": "[{\"background\":{\"color\":\"#000000\",\"alpha\":0.2,\"style\":1,\"round_radius\":0.2,\"height\":20,\"width\":30,\"horizontal_offset\":0.5,\"vertical_offset\":0.5},\"border\":{\"alpha\":1,\"color\":[0,1,1],\"width\":30},\"bubble\":{\"resource_id\":\"idjeidksjejd\",\"effect_id\":\"dasdfasdf\"},\"clip_settings\":{\"alpha\":0.5,\"flip_horizontal\":false,\"flip_vertical\":false,\"rotation\":0,\"scale_x\":1,\"scale_y\":1,\"transform_x\":0,\"transform_y\":0},\"effect\":{\"effect_id\":\"asdfasdf\"},\"id\":\"338e6fc3-e8e4-46b0-8397-c48b87f98df9\",\"outro_animation\":{\"animation_type\":\"渐隐出场\",\"duration\":500000},\"style\":{\"size\":8,\"bold\":true,\"italic\":false,\"underline\":false,\"color\":[0,0,1],\"alpha\":0.5,\"align\":1,\"vertical\":true,\"line_spacing\":0,\"letter_spacing\":2,\"auto_wrapping\":true,\"max_line_width\":1},\"text\":\"这是一个文本\",\"timerange\":{\"duration\":6000000,\"start\":500000},\"loop_animation_type\":\"呼吸循环\"}]"
}
```

---

## 4. concat_text_infos 拼接两个文本信息

### 功能说明
将两个文本信息拼接成一个新的文本信息。

### 4.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text_infos1 | String | 是 | 待拼接的第一个文本素材 |
| text_infos2 | String | 是 | 待拼接的第二个文本素材 |

### 4.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| text_infos | String | 拼接后的文本素材 |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 4.3 请求示例

```json
{
    "text_infos1": "[{\"background\":{\"color\":\"#000000\"},\"border\":{},\"bubble\":{},\"clip_settings\":{},\"effect\":{},\"id\":\"740251f5-252a-48d6-ac90-f8e4081445fd\",\"intro_animation\":{},\"outro_animation\":{},\"style\":{},\"text\":\"第一个文本\",\"timerange\":{\"duration\":3200000,\"start\":100000}}]",
    "text_infos2": "[{\"background\":{\"color\":\"#000000\"},\"border\":{},\"bubble\":{},\"clip_settings\":{},\"effect\":{},\"id\":\"740251f5-252a-48d6-ac90-f8e4081445fd\",\"intro_animation\":{},\"outro_animation\":{},\"style\":{},\"text\":\"第二个文本\",\"timerange\":{\"duration\":3100000,\"start\":350000}}]"
}
```

### 4.4 响应示例

```json
{
    "code": 0,
    "message": "成功",
    "segment_ids": [
        "740251f5-252a-48d6-ac90-f8e4081445fd",
        "740251f5-252a-48d6-ac90-f8e4081445fd"
    ],
    "text_infos": "[{\"background\":{\"color\":\"#000000\"},\"border\":{},\"bubble\":{},\"clip_settings\":{},\"effect\":{},\"id\":\"740251f5-252a-48d6-ac90-f8e4081445fd\",\"intro_animation\":{},\"outro_animation\":{},\"style\":{},\"text\":\"第一个文本\",\"timerange\":{\"duration\":3200000,\"start\":100000}},{\"background\":{\"color\":\"#000000\"},\"border\":{},\"bubble\":{},\"clip_settings\":{},\"effect\":{},\"id\":\"740251f5-252a-48d6-ac90-f8e4081445fd\",\"intro_animation\":{},\"outro_animation\":{},\"style\":{},\"text\":\"第二个文本\",\"timerange\":{\"duration\":3100000,\"start\":3300000}}]"
}
```

---

## 5. swap_text_segment_position 交换文本片段的位置

### 功能说明
交换一个文本信息中两个文本素材片段的位置。

### 5.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| swap_position | Array | 是 | 交换位置配置数组 |
| swap_position.source_index | Integer | 是 | 源位置（从 1 开始） |
| swap_position.swap_index | Integer | 是 | 交换位置 |
| target_timerange_start | Integer | 否 | 新素材在轨道上的开始时间（微秒），默认 0 |
| text_infos | String | 是 | 文本素材信息 |

### 5.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| text_infos | String | 交换后的文本素材 |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 5.3 请求示例

```json
{
    "text_infos": "[{\"background\":{\"color\":\"#000000\"},\"border\":{},\"bubble\":{},\"clip_settings\":{},\"effect\":{},\"id\":\"740251f5-252a-48d6-ac90-f8e4081445fd\",\"intro_animation\":{},\"outro_animation\":{},\"style\":{},\"text\":\"文本 1\",\"timerange\":{\"duration\":3200000,\"start\":100000}},{\"background\":{\"color\":\"#000000\"},\"border\":{},\"bubble\":{},\"clip_settings\":{},\"id\":\"740251f5-252a-48d6-ac90-f8e4081d45fd\",\"intro_animation\":{},\"outro_animation\":{},\"style\":{},\"text\":\"文本 2\",\"timerange\":{\"duration\":5900000,\"start\":3300000}},{\"background\":{\"color\":\"#000000\"},\"border\":{},\"bubble\":{},\"clip_settings\":{},\"effect\":{},\"id\":\"740251f5-252a-48d6-ac90-f8e4081445fd\",\"intro_animation\":{},\"outro_animation\":{},\"style\":{},\"text\":\"文本 3\",\"timerange\":{\"duration\":3100000,\"start\":9200000}}]",
    "swap_position": [
        {
            "source_index": 1,
            "swap_index": 2
        }
    ],
    "target_timerange_start": 200000
}
```

### 5.4 响应示例

```json
{
    "code": 0,
    "message": "成功",
    "segment_ids": [
        "740251f5-252a-48d6-ac90-f8e4081d45fd",
        "740251f5-252a-48d6-ac90-f8e4081445fd",
        "740251f5-252a-48d6-ac90-f8e4081445fd"
    ],
    "text_infos": "[{\"id\":\"740251f5-252a-48d6-ac90-f8e4081d45fd\",\"text\":\"文本 2\",\"timerange\":{\"duration\":5900000,\"start\":200000},\"background\":{\"color\":\"#000000\"}},{\"id\":\"740251f5-252a-48d6-ac90-f8e4081445fd\",\"text\":\"文本 1\",\"timerange\":{\"duration\":3200000,\"start\":6100000},\"background\":{\"color\":\"#000000\"}},{\"id\":\"740251f5-252a-48d6-ac90-f8e4081445fd\",\"text\":\"文本 3\",\"timerange\":{\"duration\":3100000,\"start\":9300000},\"background\":{\"color\":\"#000000\"}}]"
}
```

---

## 6. 文本动画类型

### 6.1 文本入场动画（免费，部分）

| 动画名称 | 默认时长 |
|----------|----------|
| 渐显 | 0.50s |
| 放大 | 0.50s |
| 缩小 | 0.50s |
| 向上滑动 | 0.50s |
| 向下滑动 | 0.50s |
| 向左滑动 | 0.50s |
| 向右滑动 | 0.50s |
| 旋入 | 0.50s |
| 弹入 | 0.50s |
| 打字机 I | 0.50s |
| 打字机 II | 0.50s |
| 打字机 III | 0.50s |
| 溶解 | 0.50s |
| 模糊 | 0.50s |
| 弹簧 | 0.50s |
| 弹弓 | 0.50s |
| 生长 | 0.50s |
| 随机弹跳 | 0.50s |
| 水墨晕开 | 1.20s |

### 6.2 文本出场动画（免费，部分）

| 动画名称 | 默认时长 |
|----------|----------|
| 渐隐 | 0.50s |
| 放大 | 0.50s |
| 缩小 | 0.50s |
| 向上滑动 | 0.50s |
| 向下滑动 | 0.50s |
| 向左滑动 | 0.50s |
| 向右滑动 | 0.50s |
| 旋出 | 0.50s |
| 弹出 | 0.50s |
| 打字机 I | 0.50s |
| 打字机 II | 0.50s |
| 打字机 III | 0.50s |
| 溶解 | 0.50s |
| 模糊 | 0.50s |
| 弹簧 | 0.50s |
| 弹弓 | 0.50s |
| 水墨晕开 | 1.20s |

### 6.3 文本循环动画（免费，部分）

| 动画名称 | 默认时长 |
|----------|----------|
| 跳动 | 0.50s |
| 闪烁 | 0.50s |
| 摇摆 | 0.50s |
| 旋转 | 0.50s |
| 翻转 | 0.50s |
| 晃动 | 0.50s |
| 颤抖 | 0.50s |
| 钟摆 | 0.50s |
| 环绕 | 0.50s |
| 波浪 | 0.50s |
| 弹幕滚动 | 0.50s |
| 彩虹 | 0.50s |
| 故障闪动 | 0.50s |

---

## 📝 注意事项

1. 时间单位统一为**微秒**（μs）
2. `1 秒 = 1,000,000 微秒`
3. 位移参数使用**百分比**表示（相对于画面尺寸）
4. 颜色格式：RGB 数组 `[R,G,B]`（0-255）或 HEX `#RRGGBB`
5. 透明度范围：0.0（完全透明）~ 1.0（完全不透明）
6. segment_index 从 **1** 开始计数
7. 对齐方式：0=左对齐，1=居中，2=右对齐
8. **文本动画顺序**：若同时使用循环动画和入出场动画，请先添加出入场动画再添加循环动画
9. **颜色取值范围**：API 文档中颜色使用 0-255，内部实现使用 0.0-1.0
