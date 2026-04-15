"""
缓存管理器
支持多种缓存模式：内存缓存、Redis缓存、混合缓存
"""

import time
from enum import IntEnum
from typing import Any, Optional, Dict
from threading import Lock


class CacheMode(IntEnum):
    """缓存模式枚举"""
    MEMORY = 0      # 仅使用内存缓存
    REDIS = 1       # 仅使用Redis缓存
    HYBRID = 2      # 同时使用内存和Redis缓存


class CacheItem:
    """缓存项"""

    def __init__(self, value: Any, expire_at: float):
        """
        Args:
            value: 缓存值
            expire_at: 过期时间戳（秒）
        """
        self.value = value
        self.expire_at = expire_at

    def is_expired(self) -> bool:
        """检查是否已过期"""
        return time.time() > self.expire_at


class CacheManager:
    """
    缓存管理器（单例模式）

    支持三种缓存模式：
    - MEMORY (0): 仅使用内存缓存
    - REDIS (1): 仅使用Redis缓存（暂未实现）
    - HYBRID (2): 同时使用内存和Redis缓存（暂未实现）

    使用示例：
        # 获取单例实例
        cache = CacheManager.get_instance()

        # 设置缓存（默认3600秒过期）
        cache.set('key', 'value')

        # 设置缓存（自定义过期时间）
        cache.set('key', 'value', ttl=7200)

        # 获取缓存
        value = cache.get('key')

        # 删除缓存
        cache.delete('key')

        # 检查缓存是否存在
        if cache.exists('key'):
            print('缓存存在')
    """

    _instance: Optional['CacheManager'] = None
    _lock: Lock = Lock()

    def __new__(cls, *args, **kwargs):
        raise RuntimeError("请使用 get_instance() 方法获取单例实例")

    @classmethod
    def get_instance(cls, mode: CacheMode = CacheMode.MEMORY, default_ttl: int = 3600) -> 'CacheManager':
        """
        获取单例实例

        Args:
            mode: 缓存模式，默认为 MEMORY
            default_ttl: 默认缓存过期时间（秒），默认 3600 秒

        Returns:
            CacheManager 实例
        """
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    # 绕过 __new__ 的限制
                    instance = object.__new__(cls)
                    instance._initialized = False
                    cls._instance = instance
        return cls._instance

    def __init__(self):
        """初始化缓存管理器（仅首次创建时调用）"""
        if hasattr(self, '_initialized') and self._initialized:
            return

        self._mode: CacheMode = CacheMode.MEMORY
        self._default_ttl: int = 3600
        self._memory_cache: Dict[str, CacheItem] = {}
        self._cache_lock: Lock = Lock()

        # Redis 相关配置（预留）
        self._redis_client = None
        self._redis_config: Dict[str, Any] = {}

        self._initialized = True

    def initialize(self, mode: CacheMode = CacheMode.MEMORY, default_ttl: int = 3600,
                   redis_config: Optional[Dict[str, Any]] = None) -> 'CacheManager':
        """
        初始化缓存配置

        Args:
            mode: 缓存模式
            default_ttl: 默认缓存过期时间（秒）
            redis_config: Redis 配置（当模式为 REDIS 或 HYBRID 时需要）

        Returns:
            self，支持链式调用
        """
        with self._cache_lock:
            self._mode = mode
            self._default_ttl = default_ttl

            if redis_config:
                self._redis_config = redis_config

            # 如果需要 Redis，进行初始化
            if mode in (CacheMode.REDIS, CacheMode.HYBRID):
                self._init_redis()

        return self

    def _init_redis(self) -> None:
        """
        初始化 Redis 连接（待实现）

        Raises:
            NotImplementedError: Redis 模式暂未实现
        """
        raise NotImplementedError("Redis 缓存模式暂未实现，请使用 MEMORY 模式")

    @property
    def mode(self) -> CacheMode:
        """获取当前缓存模式"""
        return self._mode

    @property
    def default_ttl(self) -> int:
        """获取默认缓存过期时间"""
        return self._default_ttl

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        设置缓存

        Args:
            key: 缓存键
            value: 缓存值
            ttl: 过期时间（秒），默认使用 default_ttl

        Returns:
            是否设置成功
        """
        if ttl is None:
            ttl = self._default_ttl

        expire_at = time.time() + ttl

        if self._mode == CacheMode.MEMORY:
            return self._set_memory(key, value, expire_at)
        elif self._mode == CacheMode.REDIS:
            return self._set_redis(key, value, ttl)
        elif self._mode == CacheMode.HYBRID:
            # 同时设置内存和 Redis
            memory_result = self._set_memory(key, value, expire_at)
            redis_result = self._set_redis(key, value, ttl)
            return memory_result and redis_result

        return False

    def _set_memory(self, key: str, value: Any, expire_at: float) -> bool:
        """设置内存缓存"""
        with self._cache_lock:
            self._memory_cache[key] = CacheItem(value, expire_at)
            return True

    def _set_redis(self, key: str, value: Any, ttl: int) -> bool:
        """设置 Redis 缓存（待实现）"""
        # TODO: 实现 Redis 缓存
        return False

    def get(self, key: str, default: Any = None) -> Any:
        """
        获取缓存

        Args:
            key: 缓存键
            default: 缓存不存在或已过期时的默认值

        Returns:
            缓存值，如果不存在或已过期则返回 default
        """
        if self._mode == CacheMode.MEMORY:
            return self._get_memory(key, default)
        elif self._mode == CacheMode.REDIS:
            return self._get_redis(key, default)
        elif self._mode == CacheMode.HYBRID:
            # 优先从内存获取，失败则从 Redis 获取
            value = self._get_memory(key, default)
            if value == default:
                value = self._get_redis(key, default)
                # 如果从 Redis 获取成功，同步到内存
                if value != default:
                    self._set_memory(key, value, time.time() + self._default_ttl)
            return value

        return default

    def _get_memory(self, key: str, default: Any) -> Any:
        """获取内存缓存"""
        with self._cache_lock:
            item = self._memory_cache.get(key)
            if item is None:
                return default

            # 检查是否过期
            if item.is_expired():
                del self._memory_cache[key]
                return default

            return item.value

    def _get_redis(self, key: str, default: Any) -> Any:
        """获取 Redis 缓存（待实现）"""
        # TODO: 实现 Redis 缓存
        return default

    def delete(self, key: str) -> bool:
        """
        删除缓存

        Args:
            key: 缓存键

        Returns:
            是否删除成功
        """
        if self._mode == CacheMode.MEMORY:
            return self._delete_memory(key)
        elif self._mode == CacheMode.REDIS:
            return self._delete_redis(key)
        elif self._mode == CacheMode.HYBRID:
            memory_result = self._delete_memory(key)
            redis_result = self._delete_redis(key)
            return memory_result or redis_result

        return False

    def _delete_memory(self, key: str) -> bool:
        """删除内存缓存"""
        with self._cache_lock:
            if key in self._memory_cache:
                del self._memory_cache[key]
                return True
            return False

    def _delete_redis(self, key: str) -> bool:
        """删除 Redis 缓存（待实现）"""
        # TODO: 实现 Redis 缓存
        return False

    def exists(self, key: str) -> bool:
        """
        检查缓存是否存在

        Args:
            key: 缓存键

        Returns:
            缓存是否存在（未过期）
        """
        if self._mode == CacheMode.MEMORY:
            return self._exists_memory(key)
        elif self._mode == CacheMode.REDIS:
            return self._exists_redis(key)
        elif self._mode == CacheMode.HYBRID:
            return self._exists_memory(key) or self._exists_redis(key)

        return False

    def _exists_memory(self, key: str) -> bool:
        """检查内存缓存是否存在"""
        with self._cache_lock:
            item = self._memory_cache.get(key)
            if item is None:
                return False

            # 检查是否过期
            if item.is_expired():
                del self._memory_cache[key]
                return False

            return True

    def _exists_redis(self, key: str) -> bool:
        """检查 Redis 缓存是否存在（待实现）"""
        # TODO: 实现 Redis 缓存
        return False

    def clear(self) -> bool:
        """
        清空所有缓存

        Returns:
            是否清空成功
        """
        if self._mode == CacheMode.MEMORY:
            return self._clear_memory()
        elif self._mode == CacheMode.REDIS:
            return self._clear_redis()
        elif self._mode == CacheMode.HYBRID:
            memory_result = self._clear_memory()
            redis_result = self._clear_redis()
            return memory_result and redis_result

        return False

    def _clear_memory(self) -> bool:
        """清空内存缓存"""
        with self._cache_lock:
            self._memory_cache.clear()
            return True

    def _clear_redis(self) -> bool:
        """清空 Redis 缓存（待实现）"""
        # TODO: 实现 Redis 缓存
        return False

    def cleanup_expired(self) -> int:
        """
        清理所有过期的缓存

        Returns:
            清理的缓存数量
        """
        if self._mode in (CacheMode.MEMORY, CacheMode.HYBRID):
            return self._cleanup_expired_memory()

        return 0

    def _cleanup_expired_memory(self) -> int:
        """清理内存中的过期缓存"""
        count = 0
        current_time = time.time()

        with self._cache_lock:
            expired_keys = [
                key for key, item in self._memory_cache.items()
                if item.expire_at < current_time
            ]

            for key in expired_keys:
                del self._memory_cache[key]
                count += 1

        return count

    def get_stats(self) -> Dict[str, Any]:
        """
        获取缓存统计信息

        Returns:
            统计信息字典
        """
        stats = {
            'mode': self._mode.name,
            'default_ttl': self._default_ttl,
            'memory': {
                'count': 0,
                'expired_count': 0
            }
        }

        if self._mode in (CacheMode.MEMORY, CacheMode.HYBRID):
            with self._cache_lock:
                current_time = time.time()
                total = len(self._memory_cache)
                expired = sum(
                    1 for item in self._memory_cache.values()
                    if item.expire_at < current_time
                )
                stats['memory']['count'] = total
                stats['memory']['expired_count'] = expired

        return stats

    def __repr__(self) -> str:
        return f"CacheManager(mode={self._mode.name}, default_ttl={self._default_ttl}s)"