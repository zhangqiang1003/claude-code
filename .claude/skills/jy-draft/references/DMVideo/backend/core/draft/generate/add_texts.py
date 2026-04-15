# -*- coding: utf-8 -*-
"""
添加文本素材 API
"""

import json
from typing import Dict, Any, List

from .draft_cache import draft_cache, format_draft_key, DRAFT_TEXTS, DEFAULT_EXPIRE_SECONDS
from .create_draft import check_draft_exists
from .track_types import TrackData


def add_texts(draft_id: str, text_infos: str, track_name: str = None) -> Dict[str, Any]:
    """添加文本素材到草稿"""
    if not draft_id:
        return {"code": -1, "message": "草稿 ID 不能为空"}
    if not text_infos:
        return {"code": -1, "message": "文本素材信息不能为空"}
    if not check_draft_exists(draft_id):
        return {"code": -1, "message": "草稿不存在或已过期"}

    try:
        texts = json.loads(text_infos)
        if not isinstance(texts, list):
            texts = [texts]
    except json.JSONDecodeError:
        return {"code": -1, "message": "文本素材信息 JSON 格式错误"}

    if not texts:
        return {"code": -1, "message": "文本素材列表为空"}

    key = format_draft_key(draft_id, DRAFT_TEXTS)
    existing_tracks = draft_cache.get(key) or []
    existing_tracks.append(TrackData(
        track_type="text",
        track_name=track_name,
        segments=texts
    ).to_dict())
    draft_cache.set(key, existing_tracks, DEFAULT_EXPIRE_SECONDS)

    return {"code": 0, "message": "success"}


def get_text_tracks(draft_id: str) -> List[List[Dict]]:
    """获取草稿的所有文本轨道"""
    key = format_draft_key(draft_id, DRAFT_TEXTS)
    return draft_cache.get(key) or []


def get_all_texts(draft_id: str) -> List[Dict]:
    """获取草稿的所有文本片段"""
    tracks = get_text_tracks(draft_id)
    texts = []
    for track in tracks:
        texts.extend(track)
    return texts