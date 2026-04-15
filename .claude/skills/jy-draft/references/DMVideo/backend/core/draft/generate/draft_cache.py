# -*- coding: utf-8 -*-
"""
草稿内存缓存模块

提供基于本地内存的草稿数据缓存功能，支持过期时间管理。
"""

import time
import threading
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field


@dataclass
class CacheItem:
    """缓存项"""
    value: Any
    expire_at: float  # 过期时间戳（秒）


class DraftMemoryCache:
    """
    草稿内存缓存

    使用本地内存存储草稿数据，支持：
    - 键值对存储
    - 过期时间管理
    - 自动清理过期数据
    - 线程安全
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._cache: Dict[str, CacheItem] = {}
                    cls._instance._cache_lock = threading.Lock()
        return cls._instance

    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存值

        Args:
            key: 缓存键

        Returns:
            缓存值，不存在或已过期返回 None
        """
        with self._cache_lock:
            item = self._cache.get(key)
            if item is None:
                return None

            # 检查是否过期
            if time.time() > item.expire_at:
                del self._cache[key]
                return None

            return item.value

    def set(self, key: str, value: Any, expire_seconds: int = 43200) -> None:
        """
        设置缓存值

        Args:
            key: 缓存键
            value: 缓存值
            expire_seconds: 过期时间（秒），默认 12 小时
        """
        with self._cache_lock:
            expire_at = time.time() + expire_seconds
            self._cache[key] = CacheItem(value=value, expire_at=expire_at)

    def delete(self, key: str) -> bool:
        """
        删除缓存

        Args:
            key: 缓存键

        Returns:
            是否删除成功
        """
        with self._cache_lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def exists(self, key: str) -> bool:
        """
        检查缓存是否存在

        Args:
            key: 缓存键

        Returns:
            是否存在
        """
        return self.get(key) is not None

    def keys(self, pattern: Optional[str] = None) -> List[str]:
        """
        获取所有键

        Args:
            pattern: 键模式（前缀匹配），为 None 时返回所有键

        Returns:
            键列表
        """
        with self._cache_lock:
            if pattern is None:
                return list(self._cache.keys())
            return [k for k in self._cache.keys() if k.startswith(pattern)]

    def clear_expired(self) -> int:
        """
        清理过期缓存

        Returns:
            清理的数量
        """
        current_time = time.time()
        count = 0
        with self._cache_lock:
            expired_keys = [
                k for k, v in self._cache.items()
                if current_time > v.expire_at
            ]
            for key in expired_keys:
                del self._cache[key]
                count += 1
        return count

    def clear_all(self) -> None:
        """清空所有缓存"""
        with self._cache_lock:
            self._cache.clear()

    def get_stats(self) -> Dict[str, Any]:
        """
        获取缓存统计信息

        Returns:
            统计信息
        """
        with self._cache_lock:
            current_time = time.time()
            total = len(self._cache)
            expired = sum(1 for v in self._cache.values() if current_time > v.expire_at)
            return {
                "total": total,
                "active": total - expired,
                "expired": expired
            }


# 全局缓存实例
draft_cache = DraftMemoryCache()


# ==================== 缓存键常量 ====================

# 草稿模板相关
DRAFT_TEMPLATE = "template"  # 草稿模板信息（width, height）
DRAFT_VIDEOS = "videos"  # 视频轨道
DRAFT_AUDIOS = "audios"  # 音频轨道
DRAFT_TEXTS = "texts"  # 文本轨道
DRAFT_STICKERS = "stickers"  # 贴纸轨道
DRAFT_EFFECTS = "effects"  # 视频特效
DRAFT_FILTERS = "filters"  # 视频滤镜
DRAFT_AUDIO_EFFECTS = "audio_effects"  # 音频特效
DRAFT_KEYFRAMES = "keyframes"  # 关键帧
DRAFT_AUDIO_KEYFRAMES = "audio_keyframes"  # 音频关键帧

# 轨道静音状态 (Track.mute)
# 数据格式: {track_index: muted_bool, ...} 或 {track_name: muted_bool, ...}
DRAFT_VIDEO_TRACK_MUTED = "video_track_muted"  # 视频轨道静音状态
DRAFT_AUDIO_TRACK_MUTED = "audio_track_muted"  # 音频轨道静音状态

# 生成的元数据
GEN_EFFECTS = "gen:effects"
GEN_FILTERS = "gen:filters"
GEN_KEYFRAMES = "gen:keyframes"
GEN_AUDIO_KEYFRAMES = "gen:audio_keyframes"

# 默认过期时间（12小时）
DEFAULT_EXPIRE_SECONDS = 12 * 60 * 60


def format_draft_key(draft_id: str, data_type: str) -> str:
    """
    格式化草稿缓存键

    Args:
        draft_id: 草稿ID
        data_type: 数据类型

    Returns:
        缓存键
    """
    return f"draft:{draft_id}:{data_type}"


def format_gen_key(data_type: str, item_id: str) -> str:
    """
    格式化生成数据缓存键

    Args:
        data_type: 数据类型
        item_id: 数据ID

    Returns:
        缓存键
    """
    return f"{data_type}:{item_id}"


# ==================== 轨道静音状态辅助函数 ====================

def set_track_muted(draft_id: str, track_type: str, track_index: int, muted: bool) -> None:
    """
    设置轨道静音状态

    Args:
        draft_id: 草稿ID
        track_type: 轨道类型 ("video" 或 "audio")
        track_index: 轨道索引
        muted: 是否静音
    """
    if track_type == "video":
        cache_key = format_draft_key(draft_id, DRAFT_VIDEO_TRACK_MUTED)
    elif track_type == "audio":
        cache_key = format_draft_key(draft_id, DRAFT_AUDIO_TRACK_MUTED)
    else:
        raise ValueError(f"不支持的轨道类型: {track_type}")

    # 获取现有的静音状态字典
    muted_dict = draft_cache.get(cache_key) or {}
    muted_dict[str(track_index)] = muted

    # 保存回缓存
    draft_cache.set(cache_key, muted_dict)


def get_track_muted(draft_id: str, track_type: str, track_index: int) -> bool:
    """
    获取轨道静音状态

    Args:
        draft_id: 草稿ID
        track_type: 轨道类型 ("video" 或 "audio")
        track_index: 轨道索引

    Returns:
        是否静音，默认为 False
    """
    if track_type == "video":
        cache_key = format_draft_key(draft_id, DRAFT_VIDEO_TRACK_MUTED)
    elif track_type == "audio":
        cache_key = format_draft_key(draft_id, DRAFT_AUDIO_TRACK_MUTED)
    else:
        raise ValueError(f"不支持的轨道类型: {track_type}")

    muted_dict = draft_cache.get(cache_key) or {}
    return muted_dict.get(str(track_index), False)


def get_all_track_muted(draft_id: str, track_type: str) -> Dict[str, bool]:
    """
    获取所有轨道的静音状态

    Args:
        draft_id: 草稿ID
        track_type: 轨道类型 ("video" 或 "audio")

    Returns:
        静音状态字典 {track_index: muted_bool, ...}
    """
    if track_type == "video":
        cache_key = format_draft_key(draft_id, DRAFT_VIDEO_TRACK_MUTED)
    elif track_type == "audio":
        cache_key = format_draft_key(draft_id, DRAFT_AUDIO_TRACK_MUTED)
    else:
        raise ValueError(f"不支持的轨道类型: {track_type}")

    return draft_cache.get(cache_key) or {}


def set_all_track_muted(draft_id: str, track_type: str, muted_dict: Dict[str, bool]) -> None:
    """
    批量设置轨道静音状态

    Args:
        draft_id: 草稿ID
        track_type: 轨道类型 ("video" 或 "audio")
        muted_dict: 静音状态字典 {track_index: muted_bool, ...}
    """
    if track_type == "video":
        cache_key = format_draft_key(draft_id, DRAFT_VIDEO_TRACK_MUTED)
    elif track_type == "audio":
        cache_key = format_draft_key(draft_id, DRAFT_AUDIO_TRACK_MUTED)
    else:
        raise ValueError(f"不支持的轨道类型: {track_type}")

    draft_cache.set(cache_key, muted_dict)


if __name__ == "__main__":
    # 测试
    cache = DraftMemoryCache()

    # 设置
    cache.set("test_key", {"name": "test"}, expire_seconds=60)

    # 获取
    value = cache.get("test_key")
    print(f"get: {value}")

    # 检查存在
    print(f"exists: {cache.exists('test_key')}")

    # 统计
    print(f"stats: {cache.get_stats()}")

    # 删除
    cache.delete("test_key")
    print(f"after delete: {cache.get('test_key')}")