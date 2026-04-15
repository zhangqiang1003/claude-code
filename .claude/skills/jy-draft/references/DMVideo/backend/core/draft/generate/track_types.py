# -*- coding: utf-8 -*-
"""
轨道类型定义模块

定义草稿轨道（视频/音频/文本）的数据结构。
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class TrackData:
    """
    轨道数据结构

    用于统一管理视频、音频、文本等轨道的数据格式。

    Attributes:
        track_type: 轨道类型（"video", "audio", "text", "sticker"）
        mute: 是否静音（仅视频和音频轨道有效）
        track_name: 轨道名称
        segments: 素材片段列表
    """
    track_type: str
    mute: bool = False
    track_name: Optional[str] = None
    segments: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式（兼容缓存存储）"""
        return {
            "track_type": self.track_type,
            "mute": self.mute,
            "track_name": self.track_name,
            "segments": self.segments,
        }


# def dict_to_track_data(track_data: Dict[str, Any]) -> TrackData:
#     return TrackData(**track_data)


def extract_segments(track: Any) -> List[Dict[str, Any]]:
    """
    从轨道数据中提取片段列表

    兼容两种格式:
    - TrackData 字典格式: {"track_type": ..., "segments": [...]}
    - 旧版列表格式: [seg1, seg2, ...]

    Args:
        track: 轨道数据（TrackData 字典或片段列表）

    Returns:
        片段列表
    """
    if isinstance(track, dict) and "segments" in track:
        return track.get("segments", [])
    if isinstance(track, list):
        return track
    return []
