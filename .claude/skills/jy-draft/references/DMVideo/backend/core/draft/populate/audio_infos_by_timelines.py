# -*- coding: utf-8 -*-
"""
根据时间线创建音频素材信息 API

根据输入的时间线数组和音频 URL 列表，批量创建音频素材信息。
"""

import uuid
import json
from typing import Dict, Any, List, Optional


def audio_infos_by_timelines(
    timelines: List[Dict[str, int]],
    audio_urls: List[str]
) -> Dict[str, Any]:
    """
    根据时间线对象创建音频素材信息

    Args:
        timelines: 时间线数组，每个元素包含 start 和 duration（微秒）
        audio_urls: 音频素材的 URL 列表

    Returns:
        包含音频信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - audio_infos: 音频素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = audio_infos_by_timelines(
        ...     timelines=[{"start": 0, "duration": 1000000}],
        ...     audio_urls=["https://example.com/audio.mp3"]
        ... )
    """
    # 参数校验
    if not timelines:
        return {
            "code": -1,
            "message": "时间线数组不能为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    if not audio_urls:
        return {
            "code": -1,
            "message": "音频 URL 列表不能为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    # 检查时间线格式
    for i, timeline in enumerate(timelines):
        if "start" not in timeline or "duration" not in timeline:
            return {
                "code": -1,
                "message": f"时间线 {i} 缺少 start 或 duration 字段",
                "audio_infos": "[]",
                "segment_ids": []
            }

    audio_infos = []
    segment_ids = []

    # 如果 URL 数量少于时间线数量，循环使用 URL
    for i, timeline in enumerate(timelines):
        audio_url = audio_urls[i % len(audio_urls)]
        segment_id = uuid.uuid4().hex

        audio_info = {
            "id": segment_id,
            "material_url": audio_url,
            "audio_url": audio_url,  # 向后兼容
            "target_timerange": {
                "start": timeline["start"],
                "duration": timeline["duration"]
            },
            "source_timerange": {
                "start": 0,
                "duration": timeline["duration"]
            }
        }

        audio_infos.append(audio_info)
        segment_ids.append(segment_id)

    return {
        "code": 0,
        "message": "Success",
        "audio_infos": json.dumps(audio_infos, ensure_ascii=False),
        "segment_ids": segment_ids
    }


def audio_infos_by_timelines_simple(
    timeline_segments: List[int],
    audio_urls: List[str],
    start_offset: int = 0
) -> Dict[str, Any]:
    """
    根据时长分段简单创建音频素材信息

    Args:
        timeline_segments: 时长分段列表（微秒），自动计算开始时间
        audio_urls: 音频素材的 URL 列表
        start_offset: 起始偏移时间（微秒），默认 0

    Returns:
        包含音频信息的字典

    Example:
        >>> result = audio_infos_by_timelines_simple(
        ...     timeline_segments=[3000000, 5000000, 2000000],
        ...     audio_urls=["https://example.com/audio.mp3"]
        ... )
    """
    if not timeline_segments:
        return {
            "code": -1,
            "message": "时长分段列表不能为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    if not audio_urls:
        return {
            "code": -1,
            "message": "音频 URL 列表不能为空",
            "audio_infos": "[]",
            "segment_ids": []
        }

    # 构建时间线数组
    timelines = []
    current_start = start_offset

    for duration in timeline_segments:
        if duration < 0:
            return {
                "code": -1,
                "message": f"时长不能为负数: {duration}",
                "audio_infos": "[]",
                "segment_ids": []
            }
        timelines.append({
            "start": current_start,
            "duration": duration
        })
        current_start += duration

    return audio_infos_by_timelines(timelines, audio_urls)


if __name__ == "__main__":
    # 测试示例
    result = audio_infos_by_timelines(
        timelines=[
            {"start": 0, "duration": 1000000},
            {"start": 1000000, "duration": 2000000}
        ],
        audio_urls=["https://example.com/audio.mp3"]
    )
    print(f"code: {result['code']}")
    print(f"segment_ids: {result['segment_ids']}")

    # 简单模式测试
    result2 = audio_infos_by_timelines_simple(
        timeline_segments=[3000000, 5000000, 2000000],
        audio_urls=["https://example.com/audio.mp3"]
    )
    print(f"\nsimple mode segment_ids: {result2['segment_ids']}")