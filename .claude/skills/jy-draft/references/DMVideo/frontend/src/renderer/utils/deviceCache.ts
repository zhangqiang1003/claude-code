/**
 * 设备信息缓存工具类
 * 用于缓存设备 ID 和设备名称的映射关系
 * 仅缓存名称以 'respi'（忽略大小写）开头的设备信息
 */

import cache from './cache';

const CACHE_KEY = 'device_cache';
const EXPIRY_DAYS = 365; // 1年有效期
const EXPIRY_SECONDS = EXPIRY_DAYS * 24 * 60 * 60; // 转换为秒

/**
 * 设备信息接口
 */
export interface DeviceInfo {
    id: string;
    name: string;
}

/**
 * 设备缓存类型
 */
export type DeviceCacheMap = Record<string, string>;

/**
 * 设备信息对象类型（支持多种格式）
 */
export type DeviceInput = DeviceInfo | DeviceInfo[] | Record<string, string | { name: string }>;

/**
 * 缓存统计信息
 */
export interface CacheInfo {
    total: number;
    expiryTime: number;
    expiryDate: string;
    isExpired: boolean;
    remainingTime: number; // 剩余秒数
}

/**
 * 设备信息缓存工具类
 */
class DeviceCacheClass {
    /**
     * 获取缓存的设备信息
     * @returns {DeviceCacheMap} 设备信息对象 {deviceId: deviceName, ...}
     */
    private getCache(): DeviceCacheMap {
        const cachedData = cache.get<DeviceCacheMap>(CACHE_KEY, {});
        return cachedData || {};
    }

    /**
     * 保存设备信息到缓存
     * @param {DeviceCacheMap} cacheData 设备信息对象
     */
    private saveCache(cacheData: DeviceCacheMap): void {
        cache.set(CACHE_KEY, cacheData, { expire: EXPIRY_SECONDS });
        console.log(`[deviceCache] 缓存已保存，设备数量: ${Object.keys(cacheData).length}，有效期: ${EXPIRY_DAYS}天`);
    }

    /**
     * 判断设备名称是否以 'respi' 开头（忽略大小写）
     * @param {string} deviceName 设备名称
     * @returns {boolean}
     */
    private isValidDevice(deviceName: string): boolean {
        if (!deviceName || typeof deviceName !== 'string') {
            return false;
        }
        return deviceName.toLowerCase().startsWith('respi');
    }

    /**
     * 增量更新设备缓存
     * 仅缓存名称以 'respi' 开头的设备信息
     * 已缓存的不删除，只新增；设备 ID 不变但名称改变时，更新设备名称
     * @param {DeviceInput} devices 设备列表
     * 支持格式：
     *   - 数组格式: [{id: 'xxx', name: 'yyy'}, ...]
     *   - 单个对象格式: {id: 'xxx', name: 'yyy'}
     *   - 多个对象格式: {'xxx': {name: 'yyy'}, ...} 或 {'xxx': 'yyy', ...}
     */
    updateCache(devices: DeviceInput): void {
        try {
            if (!devices) {
                console.warn('[deviceCache] 设备信息为空，跳过更新');
                return;
            }

            // 获取现有缓存
            const cacheData = this.getCache();
            let updateCount = 0;

            // 处理数组格式
            if (Array.isArray(devices)) {
                devices.forEach((device) => {
                    if (device && device.id && device.name) {
                        if (this.isValidDevice(device.name)) {
                            const oldName = cacheData[device.id];
                            cacheData[device.id] = device.name;
                            updateCount++;
                            if (oldName !== device.name) {
                                console.log(`[deviceCache] 更新设备: ${device.id}, ${oldName || '(新增)'} -> ${device.name}`);
                            }
                        }
                    }
                });
            }
            // 处理单个设备对象 {id: 'xxx', name: 'yyy'}
            else if ('id' in devices && 'name' in devices) {
                const device = devices as DeviceInfo;
                if (this.isValidDevice(device.name)) {
                    const oldName = cacheData[device.id];
                    cacheData[device.id] = device.name;
                    updateCount++;
                    if (oldName !== device.name) {
                        console.log(`[deviceCache] 更新设备: ${device.id}, ${oldName || '(新增)'} -> ${device.name}`);
                    }
                }
            }
            // 处理对象格式 {'xxx': {name: 'yyy'}, ...} 或 {'xxx': 'yyy', ...}
            else if (typeof devices === 'object') {
                Object.keys(devices).forEach((deviceId) => {
                    const deviceInfo = devices[deviceId];
                    let deviceName: string | null = null;

                    // 支持两种对象格式
                    if (typeof deviceInfo === 'string') {
                        deviceName = deviceInfo;
                    } else if (deviceInfo && typeof deviceInfo === 'object' && 'name' in deviceInfo) {
                        deviceName = (deviceInfo as { name: string }).name;
                    }

                    if (deviceName && this.isValidDevice(deviceName)) {
                        const oldName = cacheData[deviceId];
                        cacheData[deviceId] = deviceName;
                        updateCount++;
                        if (oldName !== deviceName) {
                            console.log(`[deviceCache] 更新设备: ${deviceId}, ${oldName || '(新增)'} -> ${deviceName}`);
                        }
                    }
                });
            }

            // 保存更新后的缓存
            this.saveCache(cacheData);
            console.log(`[deviceCache] 增量更新完成，共更新 ${updateCount} 个设备`);
        } catch (e) {
            console.error('[deviceCache] 更新缓存失败:', e);
        }
    }

    /**
     * 获取所有缓存的设备信息
     * @returns {DeviceCacheMap} 设备信息对象 {deviceId: deviceName, ...}
     */
    getAllCache(): DeviceCacheMap {
        return this.getCache();
    }

    /**
     * 根据设备 ID 查询设备名称
     * @param {string} deviceId 设备 ID
     * @returns {string | null} 设备名称，不存在返回 null
     */
    getNameById(deviceId: string): string | null {
        if (!deviceId) {
            return null;
        }
        const cacheData = this.getCache();
        return cacheData[deviceId] || null;
    }

    /**
     * 根据设备名称查询设备 ID
     * @param {string} deviceName 设备名称
     * @returns {string | null} 设备 ID，不存在返回 null
     */
    getIdByName(deviceName: string): string | null {
        if (!deviceName) {
            return null;
        }
        const cacheData = this.getCache();
        for (const deviceId in cacheData) {
            if (cacheData[deviceId] === deviceName) {
                return deviceId;
            }
        }
        return null;
    }

    /**
     * 根据设备 ID 判断设备信息是否存在
     * @param {string} deviceId 设备 ID
     * @returns {boolean}
     */
    existsById(deviceId: string): boolean {
        if (!deviceId) {
            return false;
        }
        const cacheData = this.getCache();
        return deviceId in cacheData;
    }

    /**
     * 根据设备名称判断设备信息是否存在
     * @param {string} deviceName 设备名称
     * @returns {boolean}
     */
    existsByName(deviceName: string): boolean {
        if (!deviceName) {
            return false;
        }
        return this.getIdByName(deviceName) !== null;
    }

    /**
     * 获取缓存统计信息
     * @returns {CacheInfo} 统计信息
     */
    getCacheInfo(): CacheInfo {
        const cacheData = this.getCache();
        const remainingTime = cache.getRemainingTime(CACHE_KEY);
        const isExpired = !cache.has(CACHE_KEY);

        // 计算过期时间戳
        const expiryTime = remainingTime > 0
            ? Date.now() + (remainingTime * 1000)
            : 0;

        return {
            total: Object.keys(cacheData).length,
            expiryTime: expiryTime,
            expiryDate: expiryTime ? new Date(expiryTime).toLocaleString() : '未知',
            isExpired: isExpired,
            remainingTime: remainingTime
        };
    }

    /**
     * 清空缓存
     */
    clearCache(): void {
        cache.remove(CACHE_KEY);
        console.log('[deviceCache] 缓存已清空');
    }
}

// 导出单例
export const deviceCache = new DeviceCacheClass();

// 默认导出
export default deviceCache;
