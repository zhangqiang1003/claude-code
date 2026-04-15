# 草稿管理 API

> 模块：剪映草稿模板 - 草稿管理
> 更新时间：2026-03-13

---

## 插件信息

| 插件名称 | 地址 |
|---------|------|
| 剪映草稿模板 | https://www.coze.cn/store/plugin/7552063650572288036 |

---

## 1. create_draft 创建草稿

### 功能说明
创建一个新的剪映草稿项目。

### 1.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| width | Integer | 是 | 视频画面的宽度（像素） |
| height | Integer | 是 | 视频画面的高度（像素） |

### 1.2 常用分辨率

| 分辨率 | width | height | 说明 |
|--------|-------|--------|------|
| 1080p | 1920 | 1080 | 全高清 |
| 720p | 1280 | 720 | 高清 |
| 4K | 3840 | 2160 | 超高清 |
| 竖屏 1080p | 1080 | 1920 | 手机竖屏 |
| 竖屏 720p | 720 | 1280 | 手机竖屏 |

### 1.3 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| draft_id | String | 草稿唯一标识 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 1.4 请求示例

```json
{
    "width": 1920,
    "height": 1080
}
```

### 1.5 响应示例

```json
{
    "code": 0,
    "draft_id": "79450e2975734bd0969ce5f38356e5a0",
    "message": "success"
}
```

---

## 2. save_draft 保存草稿

### 功能说明
保存草稿并获取可访问的草稿链接。

### 2.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| draft_id | String | 是 | 草稿唯一标识 |
| client_id | Number | 否 | 剪映小程序客户端编号，默认值：10000 |

### 2.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| draft_id | String | 草稿唯一标识 |
| draft_url | String | 草稿访问地址 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |
| tip | String | 提示信息 |

### 2.3 请求示例

```json
{
    "draft_id": "49be6cbcb4384bf482751c252c54b500",
    "client_id": 10000
}
```

### 2.4 响应示例

```json
{
    "code": 0,
    "draft_id": "49be6cbcb4384bf482751c252c54b500",
    "draft_url": "https://draft.dmaodata.cn/draft/49be6cbcb4384bf482751c252c54b500/10000/aMKPqZ4H12345678901234564xhHr6pM/1759716434",
    "message": "success",
    "tip": "请复制地址到浏览器打开，或使用剪映小程序：https://yiaicoze.feishu.cn/wiki/U1lYwp7JBiOdR1kOOpvcaXi6nrG"
}
```

---

## 3. add_videos 添加视频/图片素材到草稿

### 功能说明
添加一个视频/图片素材信息到草稿。

### 3.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| draft_id | String | 是 | 草稿唯一标识 |
| video_infos | String | 是 | 视频/图片素材信息（JSON 字符串，格式参考 [03-video.md](03-video.md)） |

### 3.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 3.3 请求示例

```json
{
    "draft_id": "49be6cbcb4384bf482751c252c54b500",
    "video_infos": "[{\"id\":\"22341\",\"video_url\":\"https://www.a.mp4\",\"target_timerange\":{\"start\":1000000,\"duration\":9000000}}]"
}
```

### 3.4 响应示例

```json
{
    "code": 0,
    "message": "success"
}
```

---

## 4. add_audios 添加音频素材到草稿

### 功能说明
添加一个音频素材信息到草稿。

### 4.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| draft_id | String | 是 | 草稿唯一标识 |
| audio_infos | String | 是 | 音频素材信息（JSON 字符串，格式参考 [02-audio.md](02-audio.md)） |

### 4.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 4.3 请求示例

```json
{
  "audio_infos": "[{\"audio_url\":\"https://lf3-lv-music-tos.faceu.com/obj/tos-cn-ve-2774/aff4f94a4c374b859b384b0920587213\",\"fade\":{\"in_duration\":0,\"out_duration\":0},\"id\":\"30d3abf9-3232-4010-a8d2-5d6c770c73fc\",\"source_timerange\":{},\"speed\":1,\"target_timerange\":{\"duration\":71000000,\"start\":0}}]",
  "draft_id": "03bd3c79be15402998adb252fcfdfeb6"
}
```

### 4.4 响应示例

```json
{
    "code": 0,
    "message": "success"
}
```

---

## 5. add_texts 添加文本素材到草稿

### 功能说明
添加一个文本素材信息到草稿。

### 5.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| draft_id | String | 是 | 草稿唯一标识 |
| text_infos | String | 是 | 文本素材信息（JSON 字符串，格式参考 [04-text.md](04-text.md)） |

### 5.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 5.3 请求示例

```json
{
    "draft_id": "42aa1930-6212-4dc7-bcb9-1960a1570054",
    "text_infos": "[{\"id\":\"22342\",\"text\":\"这是一个文本\",\"timerange\":{\"start\":1000000,\"duration\":9000000}}]"
}
```

### 5.4 响应示例

```json
{
    "code": 0,
    "message": "success"
}
```

---

## 6. add_stickers 添加贴纸素材到草稿

### 功能说明
添加一个贴纸素材信息到草稿。

### 6.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| draft_id | String | 是 | 草稿唯一标识 |
| sticker_infos | String | 是 | 贴纸素材信息（JSON 字符串，格式参考 [05-sticker.md](05-sticker.md)） |

### 6.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 6.3 请求示例

```json
{
    "draft_id": "42aa1930-6212-4dc7-bcb9-1960a1570054",
    "sticker_infos": "[{\"id\":\"22342\",\"resource_id\":\"123123\",\"target_timerange\":{\"start\":1000000,\"duration\":9000000}}]"
}
```

### 6.4 响应示例

```json
{
    "code": 0,
    "message": "success"
}
```

---

## 7. add_video_effects 添加视频/图片素材特效到草稿

### 功能说明
为草稿中的视频/图片素材添加特效。

### 7.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| draft_id | String | 是 | 草稿标识 |
| effect_ids01 ~ effect_ids10 | Array | 否 | 视频/图片素材特效唯一标识列表（最多 10 组） |

### 7.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 7.3 请求示例

```json
{
    "draft_id": "77a0f6a7-18e7-438f-a37c-1dcd75376e68",
    "effect_ids01": ["34123"],
    "effect_ids02": ["73662"]
}
```

### 7.4 响应示例

```json
{
    "code": 0,
    "message": "success"
}
```

---

## 8. add_video_filters 添加视频/图片素材滤镜到草稿

### 功能说明
为草稿中的视频/图片素材添加滤镜。

### 8.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| draft_id | String | 是 | 草稿 ID |
| filter_ids01 ~ filter_ids10 | Array | 否 | 视频/图片素材滤镜唯一标识列表（最多 10 组） |

### 8.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 8.3 请求示例

```json
{
    "draft_id": "77a0f6a7-18e7-438f-a37c-1dcd75376e69",
    "filter_ids01": ["34123"],
    "filter_ids02": ["73662"]
}
```

### 8.4 响应示例

```json
{
    "code": 0,
    "message": "success"
}
```

---

## 9. add_keyframes 添加关键帧到草稿

### 功能说明
为草稿中的素材（音频/图片/文本/视频）添加关键帧。

### 9.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| draft_id | String | 是 | 草稿 ID |
| keyframe_ids01 ~ keyframe_ids10 | Array | 否 | 素材关键帧唯一标识列表（最多 10 组） |

### 9.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 9.3 请求示例

```json
{
    "draft_id": "77a0f6a7-18e7-438f-a37c-1dcd75376e68",
    "keyframe_ids01": ["34123"],
    "keyframe_ids02": ["73662"]
}
```

### 9.4 响应示例

```json
{
    "code": 0,
    "message": "success"
}
```

---

## 10. add_audio_effects 添加音频素材特效到草稿

### 功能说明
为草稿中的音频素材添加特效。

### 10.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| draft_id | String | 是 | 草稿 ID |
| effect_ids01 ~ effect_ids10 | Array | 否 | 音频素材特效唯一标识列表（最多 10 组） |

### 10.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 10.3 请求示例

```json
{
    "draft_id": "77a0f6a7-18e7-438f-a37c-1dcd75376e68",
    "effect_ids01": ["34123"],
    "effect_ids02": ["73662"]
}
```

### 10.4 响应示例

```json
{
    "code": 0,
    "message": "success"
}
```

---

## 11. add_audio_keyframes 添加音频素材关键帧到草稿

### 功能说明
为草稿中的音频素材添加关键帧。

### 11.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| draft_id | String | 是 | 草稿 ID |
| keyframe_ids01 ~ keyframe_ids10 | Array | 否 | 音频素材关键帧列表（最多 10 组） |

### 11.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 11.3 请求示例

```json
{
    "draft_id": "77a0f6a7-18e7-438f-a37c-1dcd75376e68",
    "keyframe_ids01": ["34123"],
    "keyframe_ids02": ["73662"]
}
```

### 11.4 响应示例

```json
{
    "code": 0,
    "message": "success"
}
```

---

## 📝 草稿管理工作流程

### 完整流程示例

```
1. create_draft → 获取 draft_id
2. add_videos → 添加视频素材
3. add_audios → 添加音频素材
4. add_texts → 添加文本素材
5. add_stickers → 添加贴纸素材
6. add_video_effects → 添加视频特效
7. add_video_filters → 添加视频滤镜
8. add_keyframes → 添加关键帧动画
9. add_audio_effects → 添加音频特效
10. add_audio_keyframes → 添加音频关键帧
11. save_draft → 保存并获取访问链接
```

### 素材添加顺序

建议按照以下顺序添加素材，以确保轨道层次正确：

1. **视频/图片**：底层轨道
2. **音频**：音频轨道
3. **文本**：文本轨道（叠加在视频上方）
4. **贴纸**：贴纸轨道（最上层）
5. **特效/滤镜**：添加到已有素材
6. **关键帧**：添加动画效果

---

## 📝 注意事项

1. 时间单位统一为**微秒**（μs）
2. `1 秒 = 1,000,000 微秒`
3. 所有素材信息参数均为 **JSON 字符串**格式
4. effect_ids/keyframe_ids 最多支持 **10 组**（effect_ids01 ~ effect_ids10）
5. draft_id 在整个工作流程中需要保持一致
6. 保存草稿后获得的 draft_url 可在浏览器或剪映小程序中打开编辑
7. **主视频轨道**上的片段必须从 0s 开始
8. 素材 URL 需要是可公开访问的网络地址