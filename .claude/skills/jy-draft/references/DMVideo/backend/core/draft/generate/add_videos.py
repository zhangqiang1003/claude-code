# -*- coding: utf-8 -*-
"""
添加视频素材 API

添加视频/图片素材到草稿。
"""

import json
from typing import Dict, Any, List

from .draft_cache import (
    draft_cache,
    format_draft_key,
    DRAFT_VIDEOS,
    DEFAULT_EXPIRE_SECONDS
)
from .create_draft import check_draft_exists
from .track_types import TrackData


def add_videos(
    draft_id: str,
    video_infos: str,
    mute: bool = False,
    track_name: str = None
) -> Dict[str, Any]:
    """
    添加视频/图片素材到草稿

    Args:
        draft_id: 草稿唯一标识
        video_infos: 视频/图片素材信息（JSON 字符串）
        mute: 是否静音
        track_name: 素材轨名称

    Returns:
        包含结果的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息

    Example:
        >>> result = add_videos(
        ...     draft_id="xxx",
        ...     video_infos='[{"id":"1","video_url":"https://example.com/video.mp4","target_timerange":{"start":0,"duration":5000000}}]'
        ... )
    """
    # 参数校验
    if not draft_id:
        return {"code": -1, "message": "草稿 ID 不能为空"}

    if not video_infos:
        return {"code": -1, "message": "视频素材信息不能为空"}

    # 检查草稿是否存在
    if not check_draft_exists(draft_id):
        return {"code": -1, "message": "草稿不存在或已过期"}

    # 解析视频信息
    try:
        videos = json.loads(video_infos)
        if not isinstance(videos, list):
            videos = [videos]
    except json.JSONDecodeError:
        return {"code": -1, "message": "视频素材信息 JSON 格式错误"}

    if not videos:
        return {"code": -1, "message": "视频素材列表为空"}

    # 获取现有视频轨道
    key = format_draft_key(draft_id, DRAFT_VIDEOS)
    existing_tracks = draft_cache.get(key) or []

    # 添加新的视频轨道
    existing_tracks.append(TrackData(
        track_type="video",
        mute=mute,
        track_name=track_name,
        segments=videos
    ).to_dict())

    # 保存
    draft_cache.set(key, existing_tracks, DEFAULT_EXPIRE_SECONDS)

    return {"code": 0, "message": "success"}


def get_video_tracks(draft_id: str) -> List[List[Dict]]:
    """
    获取草稿的所有视频轨道

    Args:
        draft_id: 草稿ID

    Returns:
        视频轨道列表
    """
    key = format_draft_key(draft_id, DRAFT_VIDEOS)
    return draft_cache.get(key) or []


def get_all_videos(draft_id: str) -> List[Dict]:
    """
    获取草稿的所有视频片段（扁平化）

    Args:
        draft_id: 草稿ID

    Returns:
        视频片段列表
    """
    tracks = get_video_tracks(draft_id)
    videos = []
    for track in tracks:
        videos.extend(track)
    return videos
