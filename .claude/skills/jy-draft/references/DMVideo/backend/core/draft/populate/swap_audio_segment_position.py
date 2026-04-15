# -*- coding: utf-8 -*-
"""
交换音频片段位置 API

交换一个音频信息中两个音频素材片段的位置。
"""

import json
from typing import Dict, Any, List, Optional


def swap_audio_segment_position(
    audio_infos: str,
    swap_position: List[Dict[str, int]],
    target_timerange_start: int = 0
) -> Dict[str, Any]:
    """
    交换音频片段的位置

    Args:
        audio_infos: 音频素材信息（JSON 字符串）
        swap_position: 交换位置配置数组，每个元素包含：
            - source_index: 源位置（从 1 开始）
            - swap_index: 交换位置
        target_timerange_start: 新素材在轨道上的开始时间（微秒），默认 0

    Returns:
        包含交换后音频信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - audio_infos: 交换后的音频素材（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = swap_audio_segment_position(
        ...     audio_infos='[{"id":"1","target_timerange":{"start":0,"duration":5000000}},{"id":"2","target_timerange":{"start":5000000,"duration":3000000}}]',
        ...     swap_position=[{"source_index": 1, "swap_index": 2}]
        ... )
    """
    # 参数校验
    if not audio_infos:
        return {
            "code": -1,
            "message": "音频素材信息不能为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    if not swap_position:
        return {
            "code": -1,
            "message": "交换位置配置不能为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    # 解析音频信息
    try:
        audio_list = json.loads(audio_infos)
    except json.JSONDecodeError:
        return {
            "code": -1,
            "message": "音频素材信息 JSON 格式错误",
            "audio_infos": "[]",
            "segment_ids": []
        }

    if not isinstance(audio_list, list):
        audio_list = [audio_list]

    if len(audio_list) < 2:
        return {
            "code": -1,
            "message": "音频片段数量少于 2，无法交换位置",
            "audio_infos": audio_infos,
            "segment_ids": []
        }

    # 执行交换操作
    for swap_item in swap_position:
        source_idx = swap_item.get("source_index", 0)
        swap_idx = swap_item.get("swap_index", 0)

        # 转换为 0 基索引
        source_idx_0 = source_idx - 1
        swap_idx_0 = swap_idx - 1

        # 索引校验
        if source_idx_0 < 0 or source_idx_0 >= len(audio_list):
            return {
                "code": -1,
                "message": f"源位置索引 {source_idx} 超出范围",
                "audio_infos": audio_infos,
                "segment_ids": []
            }

        if swap_idx_0 < 0 or swap_idx_0 >= len(audio_list):
            return {
                "code": -1,
                "message": f"交换位置索引 {swap_idx} 超出范围",
                "audio_infos": audio_infos,
                "segment_ids": []
            }

        # 交换元素
        audio_list[source_idx_0], audio_list[swap_idx_0] = audio_list[swap_idx_0], audio_list[source_idx_0]

    # 重新计算时间范围
    current_time = target_timerange_start
    for item in audio_list:
        target_range = item.get("target_timerange", {})
        duration = target_range.get("duration", 0)

        item["target_timerange"] = {
            "start": current_time,
            "duration": duration
        }

        current_time += duration

    # 提取所有 segment_ids
    segment_ids = [item.get("id", "") for item in audio_list]

    return {
        "code": 0,
        "message": "成功",
        "audio_infos": json.dumps(audio_list, ensure_ascii=False),
        "segment_ids": segment_ids
    }


def move_audio_segment(
    audio_infos: str,
    from_index: int,
    to_index: int,
    target_timerange_start: int = 0
) -> Dict[str, Any]:
    """
    移动音频片段到指定位置

    Args:
        audio_infos: 音频素材信息（JSON 字符串）
        from_index: 源位置（从 1 开始）
        to_index: 目标位置（从 1 开始）
        target_timerange_start: 新素材在轨道上的开始时间（微秒），默认 0

    Returns:
        包含移动后音频信息的字典

    Example:
        >>> result = move_audio_segment(
        ...     audio_infos='[{"id":"1"},{"id":"2"},{"id":"3"}]',
        ...     from_index=1,
        ...     to_index=3
        ... )
    """
    # 参数校验
    if not audio_infos:
        return {
            "code": -1,
            "message": "音频素材信息不能为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    # 解析音频信息
    try:
        audio_list = json.loads(audio_infos)
    except json.JSONDecodeError:
        return {
            "code": -1,
            "message": "音频素材信息 JSON 格式错误",
            "audio_infos": "[]",
            "segment_ids": []
        }

    # 转换为 0 基索引
    from_idx_0 = from_index - 1
    to_idx_0 = to_index - 1

    # 索引校验
    if from_idx_0 < 0 or from_idx_0 >= len(audio_list):
        return {
            "code": -1,
            "message": f"源位置索引 {from_index} 超出范围",
            "audio_infos": audio_infos,
            "segment_ids": []
        }

    if to_idx_0 < 0 or to_idx_0 >= len(audio_list):
        return {
            "code": -1,
            "message": f"目标位置索引 {to_index} 超出范围",
            "audio_infos": audio_infos,
            "segment_ids": []
        }

    # 移动元素
    item = audio_list.pop(from_idx_0)
    audio_list.insert(to_idx_0, item)

    # 重新计算时间范围
    current_time = target_timerange_start
    for audio_item in audio_list:
        target_range = audio_item.get("target_timerange", {})
        duration = target_range.get("duration", 0)

        audio_item["target_timerange"] = {
            "start": current_time,
            "duration": duration
        }

        current_time += duration

    segment_ids = [item.get("id", "") for item in audio_list]

    return {
        "code": 0,
        "message": "成功",
        "audio_infos": json.dumps(audio_list, ensure_ascii=False),
        "segment_ids": segment_ids
    }


if __name__ == "__main__":
    # 测试示例
    test_audio_infos = json.dumps([
        {"id": "audio-001", "audio_url": "https://example.com/a.mp3", "target_timerange": {"start": 0, "duration": 5000000}, "fade": {"in_duration": 500000, "out_duration": 500000}},
        {"id": "audio-002", "audio_url": "https://example.com/b.mp3", "target_timerange": {"start": 5000000, "duration": 3000000}},
        {"id": "audio-003", "audio_url": "https://example.com/c.mp3", "target_timerange": {"start": 8000000, "duration": 4000000}}
    ])

    result = swap_audio_segment_position(
        audio_infos=test_audio_infos,
        swap_position=[{"source_index": 1, "swap_index": 2}],
        target_timerange_start=300000
    )

    print(f"code: {result['code']}")
    print(f"message: {result['message']}")

    # 解析并打印结果
    swapped = json.loads(result["audio_infos"])
    print("\n交换后的顺序和时间范围:")
    for item in swapped:
        target = item.get("target_timerange", {})
        print(f"  {item['id']}: start={target['start']/1_000_000}s, duration={target['duration']/1_000_000}s")