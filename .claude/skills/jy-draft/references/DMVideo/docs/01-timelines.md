# 时间线 API

> 模块：剪映数据插件 - 时间线生成

---

## 1. generate_timelines 自动生成时间线分段

### 功能说明
根据输入的时长分段，自动计算并生成时间线。

### 1.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| timeline_segment | Array | 是 | 时间线分段，每个元素的单位为微秒，如 `[3000000,7000000,2000000]` |

### 1.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| target | Object | 响应数据 |
| target.all_timelines | Array | 总时间线数组 |
| target.all_timelines.start | Integer | 开始时间（微秒） |
| target.all_timelines.duration | Integer | 总时长（微秒） |
| target.timelines | Array | 时间线分段数组 |
| target.timelines.start | Integer | 分段开始时间（微秒） |
| target.timelines.duration | Integer | 分段时长（微秒） |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功） |

### 1.3 请求示例

```json
{
    "timeline_segment": [3000000, 7000000, 200000, 4000000]
}
```

### 1.4 响应示例

```json
{
    "code": 0,
    "message": "成功",
    "target": {
        "all_timelines": [
            {
                "duration": 14200000,
                "start": 0
            }
        ],
        "timelines": [
            {
                "duration": 3000000,
                "start": 0
            },
            {
                "duration": 7000000,
                "start": 3000000
            },
            {
                "duration": 200000,
                "start": 10000000
            },
            {
                "duration": 4000000,
                "start": 10200000
            }
        ]
    }
}
```

---

## 2. generate_timelines_by_audio 根据音频列表生成时间线

### 功能说明
根据输入的音频 URL 列表，自动分析每个音频的时长并生成时间线。

### 2.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| audio_urls | Array | 是 | 音频文件 URL 列表 |

### 2.2 响应参数

| 参数 | 类型 | 说明 |
|------|------|------|
| target | Object | 响应数据 |
| target.all_timelines | Array | 总时间线数组 |
| target.all_timelines.start | Integer | 开始时间（微秒） |
| target.all_timelines.duration | Integer | 总时长（微秒） |
| target.timelines | Array | 时间线分段数组 |
| target.timelines.start | Integer | 分段开始时间（微秒） |
| target.timelines.duration | Integer | 分段时长（微秒） |
| message | String | 响应消息 |
| code | Integer | 状态码（0=成功） |

### 2.3 请求示例

```json
{
    "audio_urls": [
        "https://analysis-store.oss-cn-beijing.aliyuncs.com/dazi.mp3",
        "https://analysis-store.oss-cn-beijing.aliyuncs.com/book.mp3",
        "https://analysis-store.oss-cn-beijing.aliyuncs.com/%E4%B8%89%E4%B8%AA%E5%92%8C%E5%B0%9A.mp3",
        "https://analysis-store.oss-cn-beijing.aliyuncs.com/%E5%B0%8F%E6%98%9F%E6%98%9F.mp3",
        "https://analysis-store.oss-cn-beijing.aliyuncs.com/%E7%94%9F%E6%97%A5%E5%BF%AB%E4%B9%90.mp3",
        "https://96f.1ting.com/local_to_cube_202004121813/96kmp3/2021/11/24/24a_tq/01.mp3"
    ]
}
```

### 2.4 响应示例

```json
{
    "code": 0,
    "message": "success",
    "target": {
        "all_timelines": [
            {
                "duration": 793608957,
                "start": 0
            }
        ],
        "timelines": [
            {
                "duration": 38063500,
                "start": 0
            },
            {
                "duration": 2223500,
                "start": 38063500
            },
            {
                "duration": 246047346,
                "start": 40287000
            },
            {
                "duration": 105534693,
                "start": 286334346
            },
            {
                "duration": 86595918,
                "start": 391869039
            },
            {
                "duration": 315144000,
                "start": 478464957
            }
        ]
    }
}
```

---

## 📝 注意事项

1. 时间单位统一为**微秒**（μs）
2. `1 秒 = 1,000,000 微秒`
3. timelines 数组中的 start 值是累加的，表示每个分段在总时间线中的起始位置
