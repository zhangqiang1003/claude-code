/**
 * 本地缓存工具
 * 基于 localStorage 实现，支持设置有效期
 */

/**
 * 缓存项接口
 */
interface CacheItem<T = any> {
  /** 缓存值 */
  value: T;
  /** 过期时间戳（毫秒） */
  expireTime: number;
}

/**
 * 缓存配置接口
 */
interface CacheOptions {
  /** 缓存有效期（秒），默认 3600 秒（1小时） */
  expire?: number;
}

/** 缓存键前缀 */
const CACHE_PREFIX = 'cache_';

/** 所有缓存键的存储键 */
const CACHE_KEYS_KEY = '__cache_keys__';

/**
 * 缓存工具类
 */
class CacheUtil {
  /**
   * 获取完整的缓存键
   */
  private getCacheKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  /**
   * 获取所有缓存键列表
   */
  private getCacheKeys(): string[] {
    const keysStr = localStorage.getItem(CACHE_KEYS_KEY);
    return keysStr ? JSON.parse(keysStr) : [];
  }

  /**
   * 保存缓存键列表
   */
  private saveCacheKeys(keys: string[]): void {
    localStorage.setItem(CACHE_KEYS_KEY, JSON.stringify(keys));
  }

  /**
   * 添加缓存键到列表
   */
  private addCacheKey(key: string): void {
    const keys = this.getCacheKeys();
    if (!keys.includes(key)) {
      keys.push(key);
      this.saveCacheKeys(keys);
    }
  }

  /**
   * 从缓存键列表中移除
   */
  private removeCacheKey(key: string): void {
    const keys = this.getCacheKeys();
    const index = keys.indexOf(key);
    if (index > -1) {
      keys.splice(index, 1);
      this.saveCacheKeys(keys);
    }
  }

  /**
   * 检查缓存是否过期
   */
  private isExpired(expireTime: number): boolean {
    return Date.now() > expireTime;
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param options 缓存配置
   */
  set<T = any>(key: string, value: T, options: CacheOptions = {}): boolean {
    try {
      const expire = options.expire ?? 3600; // 默认 3600 秒
      const expireTime = Date.now() + expire * 1000;

      const cacheItem: CacheItem<T> = {
        value,
        expireTime,
      };

      const fullKey = this.getCacheKey(key);
      localStorage.setItem(fullKey, JSON.stringify(cacheItem));
      this.addCacheKey(key);

      return true;
    } catch (error) {
      console.error('设置缓存失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @param defaultValue 默认值（当缓存不存在或已过期时返回）
   */
  get<T = any>(key: string, defaultValue?: T): T | null {
    try {
      const fullKey = this.getCacheKey(key);
      const itemStr = localStorage.getItem(fullKey);

      if (!itemStr) {
        return defaultValue ?? null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(itemStr);

      // 检查是否过期
      if (this.isExpired(cacheItem.expireTime)) {
        this.remove(key); // 自动删除过期缓存
        return defaultValue ?? null;
      }

      return cacheItem.value;
    } catch (error) {
      console.error('获取缓存失败:', error);
      return defaultValue ?? null;
    }
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  remove(key: string): boolean {
    try {
      const fullKey = this.getCacheKey(key);
      localStorage.removeItem(fullKey);
      this.removeCacheKey(key);
      return true;
    } catch (error) {
      console.error('删除缓存失败:', error);
      return false;
    }
  }

  /**
   * 更新缓存
   * @param key 缓存键
   * @param value 新的缓存值
   * @param options 缓存配置（如果不指定，保持原有的过期时间）
   */
  update<T = any>(key: string, value: T, options?: CacheOptions): boolean {
    try {
      const fullKey = this.getCacheKey(key);
      const itemStr = localStorage.getItem(fullKey);

      if (!itemStr) {
        // 如果缓存不存在，执行设置操作
        return this.set(key, value, options);
      }

      // 如果缓存存在，更新值
      const cacheItem: CacheItem = JSON.parse(itemStr);

      const newCacheItem: CacheItem<T> = {
        value,
        // 如果指定了新的过期时间配置，使用新配置；否则保持原有的过期时间
        expireTime: options?.expire
          ? Date.now() + options.expire * 1000
          : cacheItem.expireTime,
      };

      localStorage.setItem(fullKey, JSON.stringify(newCacheItem));
      return true;
    } catch (error) {
      console.error('更新缓存失败:', error);
      return false;
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): boolean {
    try {
      const keys = this.getCacheKeys();
      keys.forEach(key => {
        const fullKey = this.getCacheKey(key);
        localStorage.removeItem(fullKey);
      });
      this.saveCacheKeys([]);
      return true;
    } catch (error) {
      console.error('清空缓存失败:', error);
      return false;
    }
  }

  /**
   * 检查缓存是否存在且未过期
   * @param key 缓存键
   */
  has(key: string): boolean {
    try {
      const fullKey = this.getCacheKey(key);
      const itemStr = localStorage.getItem(fullKey);

      if (!itemStr) {
        return false;
      }

      const cacheItem: CacheItem = JSON.parse(itemStr);

      // 检查是否过期
      if (this.isExpired(cacheItem.expireTime)) {
        this.remove(key); // 自动删除过期缓存
        return false;
      }

      return true;
    } catch (error) {
      console.error('检查缓存失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存剩余有效时间（秒）
   * @param key 缓存键
   * @returns 剩余秒数，如果缓存不存在或已过期返回 -1
   */
  getRemainingTime(key: string): number {
    try {
      const fullKey = this.getCacheKey(key);
      const itemStr = localStorage.getItem(fullKey);

      if (!itemStr) {
        return -1;
      }

      const cacheItem: CacheItem = JSON.parse(itemStr);

      if (this.isExpired(cacheItem.expireTime)) {
        this.remove(key);
        return -1;
      }

      const remainingMs = cacheItem.expireTime - Date.now();
      return Math.floor(remainingMs / 1000);
    } catch (error) {
      console.error('获取缓存剩余时间失败:', error);
      return -1;
    }
  }

  /**
   * 清理所有过期缓存
   */
  clearExpired(): boolean {
    try {
      const keys = this.getCacheKeys();
      const expiredKeys: string[] = [];

      keys.forEach(key => {
        const fullKey = this.getCacheKey(key);
        const itemStr = localStorage.getItem(fullKey);

        if (itemStr) {
          const cacheItem: CacheItem = JSON.parse(itemStr);
          if (this.isExpired(cacheItem.expireTime)) {
            expiredKeys.push(key);
          }
        }
      });

      expiredKeys.forEach(key => this.remove(key));

      return true;
    } catch (error) {
      console.error('清理过期缓存失败:', error);
      return false;
    }
  }

  /**
   * 获取所有缓存键
   */
  keys(): string[] {
    return this.getCacheKeys();
  }

  /**
   * 获取缓存大小（字节）
   * @param key 缓存键，如果不传则返回所有缓存的总大小
   */
  getSize(key?: string): number {
    try {
      if (key) {
        const fullKey = this.getCacheKey(key);
        const itemStr = localStorage.getItem(fullKey);
        return itemStr ? new Blob([itemStr]).size : 0;
      } else {
        const keys = this.getCacheKeys();
        let totalSize = 0;
        keys.forEach(k => {
          totalSize += this.getSize(k);
        });
        return totalSize;
      }
    } catch (error) {
      console.error('获取缓存大小失败:', error);
      return 0;
    }
  }
}

// 创建单例实例
const cache = new CacheUtil();

// 导出单例
export default cache;
