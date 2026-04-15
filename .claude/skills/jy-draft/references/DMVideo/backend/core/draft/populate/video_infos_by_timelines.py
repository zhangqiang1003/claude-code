# -*- coding: utf-8 -*-
"""
根据时间线创建视频素材信息 API

根据输入的时间线数组和视频 URL 列表，批量创建视频素材信息。
输出的每个视频片段与 video_info.py 生成的格式完全对齐。
"""

import uuid
import json
from typing import Dict, Any, List


def video_infos_by_timelines(
    timelines: List[Dict[str, int]],
    video_urls: List[str]
) -> Dict[str, Any]:
    """
    根据时间线对象创建视频素材信息

    Args:
        timelines: 时间线数组，每个元素包含 start 和 duration（微秒）
        video_urls: 视频/图片素材的 URL 列表

    Returns:
        包含视频信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - video_infos: 视频/图片素材信息（JSON 字符串）
        - segment_ids: 素材片段 ID 列表

    Example:
        >>> result = video_infos_by_timelines(
        ...     timelines=[{"start": 0, "duration": 5000000}, {"start": 5000000, "duration": 3000000}],
        ...     video_urls=["https://example.com/video1.mp4", "https://example.com/video2.mp4"]
        ... )
    """
    # 参数校验
    if not timelines:
        return {"code": -1, "message": "时间线数组不能为空", "video_infos": "[]", "segment_ids": []}

    if not video_urls:
        return {"code": -1, "message": "视频 URL 列表不能为空", "video_infos": "[]", "segment_ids": []}

    # 检查时间线格式
    for i, tl in enumerate(timelines):
        if not isinstance(tl, dict):
            return {"code": -1, "message": f"时间线 {i} 不是有效的对象", "video_infos": "[]", "segment_ids": []}
        if "start" not in tl or "duration" not in tl:
            return {"code": -1, "message": f"时间线 {i} 缺少 start 或 duration 字段", "video_infos": "[]", "segment_ids": []}

    video_infos = []
    segment_ids = []

    for i, tl in enumerate(timelines):
        video_url = video_urls[i % len(video_urls)]
        segment_id = uuid.uuid4().hex

        video_infos.append({
            "id": segment_id,
            "material_url": video_url,
            "target_timerange": {"start": tl["start"], "duration": tl["duration"]},
            "source_timerange": {"start": 0, "duration": tl["duration"]}
        })
        segment_ids.append(segment_id)

    return {"code": 0, "message": "成功", "video_infos": json.dumps(video_infos, ensure_ascii=False), "segment_ids": segment_ids}


def video_infos_by_timelines_simple(
    timeline_segments: List[int],
    video_urls: List[str],
    start_offset: int = 0
) -> Dict[str, Any]:
    """
    根据时长分段简单创建视频素材信息

    Args:
        timeline_segments: 时长分段列表（微秒），自动计算开始时间
        video_urls: 视频/图片素材的 URL 列表
        start_offset: 起始偏移时间（微秒），默认 0

    Returns:
        包含视频信息的字典

    Example:
        >>> result = video_infos_by_timelines_simple(
        ...     timeline_segments=[3000000, 5000000, 2000000],
        ...     video_urls=["https://example.com/video.mp4"]
        ... )
    """
    if not timeline_segments or not video_urls:
        return {"code": -1, "message": "参数不能为空", "video_infos": "[]", "segment_ids": []}

    timelines = []
    current = start_offset
    for dur in timeline_segments:
        if dur < 0:
            return {"code": -1, "message": f"时长不能为负数: {dur}", "video_infos": "[]", "segment_ids": []}
        timelines.append({"start": current, "duration": dur})
        current += dur

    return video_infos_by_timelines(timelines, video_urls)
