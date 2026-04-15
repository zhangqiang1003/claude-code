# -*- coding: utf-8 -*-
"""
添加音频素材 API

添加音频素材到草稿。
"""

import json
from typing import Dict, Any, List

from .draft_cache import (
    draft_cache,
    format_draft_key,
    DRAFT_AUDIOS,
    DEFAULT_EXPIRE_SECONDS
)
from .create_draft import check_draft_exists
from .track_types import TrackData


def add_audios(
    draft_id: str,
    audio_infos: str,
    mute: bool = False,
    track_name: str = None
) -> Dict[str, Any]:
    """
    添加音频素材到草稿

    Args:
        draft_id: 草稿唯一标识
        audio_infos: 音频素材信息（JSON 字符串）
        mute: 是否静音
        track_name: 素材轨名称

    Returns:
        包含结果的字典
    """
    if not draft_id:
        return {"code": -1, "message": "草稿 ID 不能为空"}

    if not audio_infos:
        return {"code": -1, "message": "音频素材信息不能为空"}

    if not check_draft_exists(draft_id):
        return {"code": -1, "message": "草稿不存在或已过期"}

    try:
        audios = json.loads(audio_infos)
        if not isinstance(audios, list):
            audios = [audios]
    except json.JSONDecodeError:
        return {"code": -1, "message": "音频素材信息 JSON 格式错误"}

    if not audios:
        return {"code": -1, "message": "音频素材列表为空"}

    key = format_draft_key(draft_id, DRAFT_AUDIOS)
    existing_tracks = draft_cache.get(key) or []
    existing_tracks.append(TrackData(
        track_type="audio",
        mute=mute,
        track_name=track_name,
        segments=audios
    ).to_dict())
    draft_cache.set(key, existing_tracks, DEFAULT_EXPIRE_SECONDS)

    return {"code": 0, "message": "success"}


def get_audio_tracks(draft_id: str) -> List[Dict]:
    """获取草稿的所有音频轨道"""
    key = format_draft_key(draft_id, DRAFT_AUDIOS)
    return draft_cache.get(key) or []


def get_all_audios(draft_id: str) -> List[Dict]:
    """获取草稿的所有音频片段（扁平化）"""
    tracks = get_audio_tracks(draft_id)
    audios = []
    for track in tracks:
        audios.extend(track)
    return audios