# 音频处理 API

> 模块：剪映数据插件 - 音频处理
> 更新时间：2026-03-13

---

## 1. audio_info 自动创建一段音频片段

### 功能说明
根据音频 URL 和参数，自动创建一段音频素材信息。

### 1.1 基础参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| audio_url | String | 是 | 音频 URL 地址 |
| target_time_start | Integer | 否 | 素材在轨道上的开始时间（微秒），默认 0 |
| target_time_duration | Integer | 否 | 素材在轨道上的时长（微秒） |

### 1.2 播放控制参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| speed | Number | 否 | 播放速度，默认 1.0，取值范围：0.1~50.0 |
| volume | Number | 否 | 音量，默认 1.0（100%） |
| change_pitch | Boolean | 否 | 是否跟随变速改变音调，默认 false |
| source_time_start | Integer | 否 | 截取素材片段的开始时间（微秒） |
| source_time_duration | Integer | 否 | 截取素材片段的时长（微秒） |

### 1.3 音频淡入淡出参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| fade_in_duration | Integer | 否 | 音频淡入时长（微秒） |
| fade_out_duration | Integer | 否 | 音频淡出时长（微秒） |

### 1.4 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| audio_infos | String | 音频素材信息（JSON 字符串） |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 1.5 请求示例

```json
{
    "audio_url": "https://x.mp3",
    "source_time_start": 0,
    "source_time_duration": 3000000,
    "fade_in_duration": 500000,
    "fade_out_duration": 500000,
    "speed": 2.1,
    "volume": 0.8,
    "change_pitch": true
}
```

### 1.6 响应示例

```json
{
    "audio_infos": "[{\"id\":\"a69cd073-62bf-48c5-a53e-823f64fafd88\",\"audio_url\":\"https://x.mp3\",\"source_timerange\":{\"start\":0,\"duration\":3000000},\"speed\":2.1,\"volume\":0.8,\"change_pitch\":true,\"target_timerange\":{\"duration\":1428571,\"start\":0},\"fade\":{\"in_duration\":500000,\"out_duration\":500000}}]",
    "code": 0,
    "message": "Success",
    "segment_ids": [
        "a69cd073-62bf-48c5-a53e-823f64fafd88"
    ]
}
```

---

## 2. audio_infos_by_timelines 根据时间线对象创建音频素材信息

### 功能说明
根据输入的时间线数组和音频 URL 列表，批量创建音频素材信息。

### 2.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| timelines | Array | 是 | 时间线数组 |
| timelines.start | Integer | 是 | 开始时间（微秒） |
| timelines.duration | Integer | 是 | 时长（微秒） |
| audio_urls | Array | 是 | 音频素材的 URL 列表 |

### 2.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| audio_infos | String | 音频素材信息（JSON 字符串） |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 2.3 请求示例

```json
{
    "timelines": [
        {
            "start": 0,
            "duration": 1000000
        }
    ],
    "audio_urls": ["https://w.mp3"]
}
```

### 2.4 响应示例

```json
{
    "audio_infos": "[{\"audio_url\":\"https://w.mp3\",\"id\":\"6a13e35a-95c8-4780-956e-ff7c50c3c3b4\",\"target_timerange\":{\"duration\":1000000,\"start\":0},\"source_timerange\":{\"duration\":1000000,\"start\":0}}]",
    "code": 0,
    "message": "Success",
    "segment_ids": [
        "6a13e35a-95c8-4780-956e-ff7c50c3c3b4"
    ]
}
```

---

## 3. modify_audio_infos 修改音频信息

### 功能说明
修改一个音频素材信息，指定修改音频素材片段的基本信息。

### 3.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| segment_index | Array | 是 | 要修改的素材片段的索引，从 1 开始，如 `[1,2,3,5]` |
| audio_infos | String | 是 | 音频素材信息（JSON 字符串） |
| speed | Number | 否 | 播放速度，默认 1.0，取值范围：0.1~50.0 |
| volume | Number | 否 | 音量，默认 1.0 |
| change_pitch | Boolean | 否 | 是否跟随变速改变音调 |
| source_time_start | Integer | 否 | 截取素材片段的开始时间（微秒） |
| source_time_duration | Integer | 否 | 截取素材片段的时长（微秒） |
| target_time_start | Integer | 否 | 素材在轨道上的开始时间（微秒） |
| fade_in_duration | Integer | 否 | 淡入时长（微秒） |
| fade_out_duration | Integer | 否 | 淡出时长（微秒） |

### 3.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| audio_infos | String | 修改后的音频素材信息 |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 3.3 请求示例

```json
{
  "audio_infos": "[{\"audio_url\":\"https://lf6-lv-music-tos.faceu.com/obj/tos-cn-ve-2774/aff4f94a4c374b859b384b0920587213\",\"id\":\"2556f314-19c4-4528-934f-b894125f4370\",\"source_timerange\":{\"duration\":71000000,\"start\":0}}]",
  "segment_index": [1, 4, 0],
  "volume": 10,
  "change_pitch": true
}
```

### 3.4 响应示例

```json
{
    "audio_infos": "[{\"audio_url\":\"https://lf6-lv-music-tos.faceu.com/obj/tos-cn-ve-2774/aff4f94a4c374b859b384b0920587213\",\"id\":\"2556f314-19c4-4528-934f-b894125f4370\",\"source_timerange\":{\"duration\":71000000,\"start\":0},\"speed\":1,\"volume\":10,\"change_pitch\":true,\"fade\":{\"in_duration\":0,\"out_duration\":0},\"target_timerange\":{\"start\":0,\"duration\":71000000}}]",
    "code": 0,
    "message": "Success",
    "segment_ids": [
        "2556f314-19c4-4528-934f-b894125f4370"
    ]
}
```

---

## 4. concat_audio_infos 拼接音频信息

### 功能说明
将两个音频信息拼接成一个新的音频信息。

### 4.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| audio_infos1 | String | 是 | 待拼接的第一个音频素材 |
| audio_infos2 | String | 是 | 待拼接的第二个音频素材 |

### 4.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| audio_infos | String | 拼接后的音频素材 |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 4.3 请求示例

```json
{
    "audio_infos1": "[{\"id\":\"12343\",\"audio_url\":\"https://a.mp3\",\"target_timerange\":{\"start\":0,\"duration\":5000000},\"fade\":{\"in_duration\":500000,\"out_duration\":500000}}]",
    "audio_infos2": "[{\"id\":\"1234\",\"audio_url\":\"https://a.mp3\",\"target_timerange\":{\"start\":0,\"duration\":5000000}},{\"id\":\"123s4\",\"audio_url\":\"https://a.mp3\",\"target_timerange\":{\"start\":5000000,\"duration\":5500000}}]"
}
```

### 4.4 响应示例

```json
{
    "audio_infos": "[{\"id\":\"12343\",\"audio_url\":\"https://a.mp3\",\"target_timerange\":{\"start\":0,\"duration\":5000000},\"fade\":{\"in_duration\":500000,\"out_duration\":500000}},{\"id\":\"1234\",\"audio_url\":\"https://a.mp3\",\"target_timerange\":{\"start\":5000000,\"duration\":5000000}},{\"id\":\"123s4\",\"audio_url\":\"https://a.mp3\",\"target_timerange\":{\"start\":10000000,\"duration\":5500000}}]",
    "code": 0,
    "message": "拼接成功",
    "segment_ids": [
        "12343",
        "1234",
        "123s4"
    ]
}
```

---

## 5. swap_audio_segment_position 交换音频片段的位置

### 功能说明
交换一个音频信息中两个音频素材片段的位置。

### 5.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| swap_position | Array | 是 | 交换位置配置数组 |
| swap_position.source_index | Integer | 是 | 源位置（从 1 开始） |
| swap_position.swap_index | Integer | 是 | 交换位置 |
| target_timerange_start | Integer | 否 | 新素材在轨道上的开始时间（微秒），默认 0 |
| audio_infos | String | 是 | 音频素材信息 |

### 5.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| audio_infos | String | 交换后的音频素材 |
| segment_ids | Array | 素材片段 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 5.3 请求示例

```json
{
    "audio_infos": "[{\"audio_url\":\"https://a.mp3\",\"fade\":{\"in_duration\":500000,\"out_duration\":500000},\"id\":\"12343\",\"target_timerange\":{\"start\":0,\"duration\":5000000}},{\"audio_url\":\"https://a.mp3\",\"id\":\"1234\",\"target_timerange\":{\"start\":5000000,\"duration\":5000000}},{\"audio_url\":\"https://a.mp3\",\"id\":\"123s4\",\"target_timerange\":{\"start\":10000000,\"duration\":5500000}}]",
    "swap_position": [
        {
            "source_index": 1,
            "swap_index": 2
        }
    ],
    "target_timerange_start": 300000
}
```

### 5.4 响应示例

```json
{
    "audio_infos": "[{\"audio_url\":\"https://a.mp3\",\"id\":\"1234\",\"target_timerange\":{\"duration\":5000000,\"start\":300000}},{\"audio_url\":\"https://a.mp3\",\"fade\":{\"in_duration\":500000,\"out_duration\":500000},\"id\":\"12343\",\"target_timerange\":{\"duration\":5000000,\"start\":5300000}},{\"audio_url\":\"https://a.mp3\",\"id\":\"123s4\",\"target_timerange\":{\"duration\":5500000,\"start\":10300000}}]",
    "code": 0,
    "message": "成功",
    "segment_ids": [
        "1234",
        "12343",
        "123s4"
    ]
}
```

---

## 6. generate_audio_effect 生成音频特效

### 功能说明
为音频素材生成特效（如变声、混响等）。

### 6.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| audio_ids | Array | 是 | 音频唯一标识列表 |
| effect_type | String | 是 | 特效类型名称（见下方特效类型表） |
| params | Array | 否 | 特效参数列表，取值范围 0~100 |
| segment_index | Array | 是 | 音频唯一标识位置列表（从 1 开始） |

### 6.2 音频场景特效类型（免费）

| 特效名称 | 参数 | 默认值 | 说明 |
|----------|------|--------|------|
| 8bit | pitch_shift, timbre, strength | 50, 100, 100 | 8位游戏音效 |
| 低保真 | 强弱 | 100 | 低保真音质效果 |
| 合成器 | 强弱 | 100 | 合成器音效 |
| 回音 | quantity, strength | 80, 76 | 回音效果 |
| 扩音器 | 强弱 | 100 | 扩音器效果 |
| 水下 | 深度 | 50 | 水下闷响效果 |
| 没电了 | 强弱 | 100 | 没电拖音效果 |
| 环绕音 | center_position, surrounding_frequency | 50, 50 | 环绕立体声 |
| 电音 | 强弱 | 100 | 电子音效 |
| 颤音 | 频率, 幅度 | 71, 90 | 颤音效果 |
| 麦霸 | 空间大小, 强弱 | 5, 45 | 卡拉OK麦霸效果 |
| 黑胶 | 强弱, 噪点 | 100, 74 | 黑胶唱片效果 |

### 6.3 音频场景特效类型（付费）

| 特效名称 | 参数 | 默认值 | 说明 |
|----------|------|--------|------|
| 360度环绕音 | strength | 100 | 全方位环绕音 |
| 3d环绕音 | 强度 | 0 | 3D空间音效 |
| Autotune | 强度 | 100 | 自动调音效果 |
| Livehouse | 强度 | 100 | 现场演出效果 |
| 下雨 | strength, noise | 100, 74 | 雨声氛围 |
| 乡村大喇叭 | 强度 | 100 | 乡村广播效果 |
| 人声增强 | 强弱 | 100 | 人声音量增强 |
| 低音增强 | strength | 100 | 低频增强 |
| 停车场 | strength | 100 | 停车场回声 |
| 冥想 | 强度 | 100 | 冥想氛围音效 |
| 冰川之下 | strength, noise | 100, 74 | 冰川水下效果 |
| 刮风 | strength, noise | 100, 74 | 风声氛围 |
| 午夜电台 | 强度 | 100 | 午夜电台效果 |
| 噪音混响 | strength | 100 | 噪音混响 |
| 回声 | 强度 | 100 | 回声效果 |
| 复古收音机 | 强度 | 100 | 复古收音机音质 |
| 失真电子 | 强度 | 100 | 电子失真效果 |
| 对讲机 | 强度 | 100 | 对讲机通话效果 |
| 山洞 | strength | 100 | 山洞回声 |
| 教堂 | 强度 | 100 | 教堂混响 |
| 森林 | 强度, 背景音 | 100, 50 | 森林环境音 |
| 深海回声 | 强度 | 100 | 深海回声效果 |
| 演唱会 | 强度 | 100 | 演唱会现场效果 |
| 电话 | 强弱 | 70 | 电话通话效果 |
| 留声机 | 强度 | 100 | 老式留声机 |
| 音乐厅 | strength | 100 | 音乐厅混响 |

### 6.4 音色特效类型（免费）

| 特效名称 | 参数 | 默认值 | 说明 |
|----------|------|--------|------|
| 大叔 | 音调, 音色 | 83, 100 | 成熟男声 |
| 女生 | 音调, 音色 | 83, 33 | 女性声音 |
| 怪物 | 音调, 音色 | 65, 78 | 怪物声音 |
| 机器人 | 强弱 | 100 | 机械声音 |
| 男生 | 音调, 音色 | 38, 25 | 男性声音 |
| 花栗鼠 | 音调, 音色 | 50, 50 | 花栗鼠声音 |
| 萝莉 | 音调, 音色 | 75, 60 | 萝莉声音 |

### 6.5 音色特效类型（付费）

| 特效名称 | 说明 |
|----------|------|
| 台湾小哥 | 台湾口音男声 |
| 圣诞精灵 | 圣诞精灵声音 |
| 圣诞老人 | 圣诞老人声音 |
| 广告男声 | 广告配音男声 |
| 港普男声 | 港式普通话 |
| 老婆婆 | 老年女性声音 |
| 解说小帅 | 解说员声音 |
| TVB女声 | TVB剧集女声 |
| 东厂公公 | 古装太监声音 |
| 八戒 | 猪八戒声音 |
| 熊二 | 熊出没熊二声音 |
| 猴哥 | 孙悟空声音 |
| 黛玉 | 林黛玉声音 |

### 6.6 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| effect_ids | Array | 音频特效 ID 列表 |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功，-1=失败） |

### 6.7 请求示例

```json
{
    "audio_ids": ["1234", "2233223"],
    "effect_type": "大叔",
    "params": [50, 80],
    "segment_index": [1]
}
```

### 6.8 响应示例

```json
{
    "code": 0,
    "effect_ids": [
        "96103886-400d-422e-aec9-29f2c0210aed"
    ],
    "message": "success"
}
```

---

## 7. 音频关键帧

### 功能说明
通过关键帧控制音量变化，实现音量的动态调整。

### 7.1 关键帧参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| time_offset | Integer | 是 | 关键帧的时间偏移量（微秒） |
| volume | Number | 是 | 音量值，0.0~N |

### 7.2 使用说明

1. 关键帧用于控制音量的变化曲线
2. 多个关键帧按时间顺序连接形成音量变化曲线
3. 音量值可以大于 1.0，实现音量放大效果
4. 关键帧时间偏移是相对于片段开始的偏移量

---

## 📝 注意事项

1. 时间单位统一为**微秒**（μs）
2. `1 秒 = 1,000,000 微秒`
3. 音量 1.0 = 100%
4. 速度 1.0 = 原速，2.0 = 2 倍速
5. segment_index 从 **1** 开始计数
6. **change_pitch** 参数控制变速时是否改变音调：
   - `true`：变速同时改变音调（变快时音调变高，变慢时音调变低）
   - `false`：变速时保持原音调（推荐）
7. **特效参数** 取值范围统一为 **0~100**
8. **特效类型** 分为三大类：
   - 场景音（sound_effect）：环境音效
   - 音色（tone）：变声效果
   - 声音成曲（speech_to_song）：将语音转为歌曲
9. 每个音频片段**每类特效只能添加一个**