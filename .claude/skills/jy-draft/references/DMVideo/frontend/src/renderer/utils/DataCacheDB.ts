/**
 * IndexedDB 数据缓存管理工具
 * 用于本地临时存储数据包和上传任务
 */

/**
 * 本地存储的数据包
 */
export interface StoredDataPacket {
  id?: number;                     // 自动生成的键
  recordId: string | number;       // 记录ID
  packetIndex: number;             // 包序号
  data: number[];                  // 数据字节数组
  timestamp: number;               // 时间戳
}

/**
 * 本地存储的上传任务
 */
export interface StoredUploadTask {
  recordId: string | number;       // 记录ID（主键）
  totalPackets: number;            // 总包数
  receivedPackets: number;         // 已接收包数
  isDataTransferComplete: boolean; // 数据传输是否完成
  createdAt: number;               // 创建时间
  updatedAt: number;               // 更新时间
}

/**
 * IndexedDB 数据库配置
 */
const IDB_CONFIG = {
  DB_NAME: 'ZeroMatDataCache',
  DB_VERSION: 1,
  STORE_PACKETS: 'data_packets',
  STORE_TASKS: 'upload_tasks',
} as const;

/**
 * IndexedDB 管理类
 * 用于本地临时存储数据包和上传任务
 *
 * 功能：
 * - 保存数据包到 IndexedDB
 * - 查询和读取数据包
 * - 管理上传任务状态
 * - 清理过期数据
 *
 * @example
 * ```typescript
 * const db = new DataCacheDB();
 * await db.init();
 *
 * // 保存数据包
 * await db.savePacket(recordId, packetIndex, data);
 *
 * // 获取所有数据包
 * const packets = await db.getPackets(recordId);
 *
 * // 删除记录
 * await db.deleteRecord(recordId);
 * ```
 */
export class DataCacheDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化数据库（单例模式，确保只初始化一次）
   */
  async init(): Promise<void> {
    // 如果已经初始化，直接返回
    if (this.db) {
      return;
    }

    // 如果正在初始化，等待初始化完成
    if (this.initPromise) {
      return this.initPromise;
    }

    // 开始初始化
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_CONFIG.DB_NAME, IDB_CONFIG.DB_VERSION);

      request.onerror = () => {
        console.error('[DataCacheDB] 数据库打开失败:', request.error);
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[DataCacheDB] 数据库初始化成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建数据包存储
        if (!db.objectStoreNames.contains(IDB_CONFIG.STORE_PACKETS)) {
          const packetStore = db.createObjectStore(IDB_CONFIG.STORE_PACKETS, { keyPath: 'id', autoIncrement: true });
          packetStore.createIndex('recordId', 'recordId', { unique: false });
          packetStore.createIndex('packetIndex', 'packetIndex', { unique: false });
          console.log('[DataCacheDB] 创建数据包存储');
        }

        // 创建任务存储
        if (!db.objectStoreNames.contains(IDB_CONFIG.STORE_TASKS)) {
          const taskStore = db.createObjectStore(IDB_CONFIG.STORE_TASKS, { keyPath: 'recordId' });
          taskStore.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('[DataCacheDB] 创建任务存储');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * 保存单个数据包
   * @param recordId 记录ID
   * @param packetIndex 包序号
   * @param data 数据字节数组
   */
  async savePacket(recordId: string | number, packetIndex: number, data: number[]): Promise<void> {
    if (!this.db) await this.init();

    const packet: StoredDataPacket = {
      recordId,
      packetIndex,
      data,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IDB_CONFIG.STORE_PACKETS], 'readwrite');
      const store = transaction.objectStore(IDB_CONFIG.STORE_PACKETS);
      const request = store.add(packet);

      request.onsuccess = () => {
        console.log(`[DataCacheDB] 保存数据包成功: recordId=${recordId}, index=${packetIndex}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`[DataCacheDB] 保存数据包失败:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 批量保存数据包
   * @param recordId 记录ID
   * @param packets 数据包数组 { index: number; data: number[] }
   */
  async savePackets(recordId: string | number, packets: Array<{ index: number; data: number[] }>): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IDB_CONFIG.STORE_PACKETS], 'readwrite');
      const store = transaction.objectStore(IDB_CONFIG.STORE_PACKETS);

      let completed = 0;
      const total = packets.length;

      packets.forEach(({ index, data }) => {
        const packet: StoredDataPacket = {
          recordId,
          packetIndex: index,
          data,
          timestamp: Date.now(),
        };

        const request = store.add(packet);

        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            console.log(`[DataCacheDB] 批量保存 ${total} 个数据包成功`);
            resolve();
          }
        };

        request.onerror = () => {
          console.error(`[DataCacheDB] 批量保存数据包失败:`, request.error);
          reject(request.error);
        };
      });
    });
  }

  /**
   * 获取记录的所有数据包
   * @param recordId 记录ID
   * @returns 排序后的数据字节数组
   */
  async getPackets(recordId: string | number): Promise<number[][]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IDB_CONFIG.STORE_PACKETS], 'readonly');
      const store = transaction.objectStore(IDB_CONFIG.STORE_PACKETS);
      const index = store.index('recordId');
      const request = index.getAll(recordId);

      request.onsuccess = () => {
        const packets = request.result as StoredDataPacket[];
        // 按包序号排序
        packets.sort((a, b) => a.packetIndex - b.packetIndex);
        const dataArrays = packets.map(p => p.data);
        console.log(`[DataCacheDB] 获取数据包成功: recordId=${recordId}, count=${dataArrays.length}`);
        resolve(dataArrays);
      };

      request.onerror = () => {
        console.error(`[DataCacheDB] 获取数据包失败:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 保存或更新上传任务
   * @param task 上传任务
   */
  async saveTask(task: StoredUploadTask): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IDB_CONFIG.STORE_TASKS], 'readwrite');
      const store = transaction.objectStore(IDB_CONFIG.STORE_TASKS);
      const request = store.put(task);

      request.onsuccess = () => {
        console.log(`[DataCacheDB] 保存任务成功: recordId=${task.recordId}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`[DataCacheDB] 保存任务失败:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取上传任务
   * @param recordId 记录ID
   * @returns 任务对象或 null
   */
  async getTask(recordId: string | number): Promise<StoredUploadTask | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IDB_CONFIG.STORE_TASKS], 'readonly');
      const store = transaction.objectStore(IDB_CONFIG.STORE_TASKS);
      const request = store.get(recordId);

      request.onsuccess = () => {
        const task = request.result as StoredUploadTask | undefined;
        resolve(task || null);
      };

      request.onerror = () => {
        console.error(`[DataCacheDB] 获取任务失败:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有未完成的任务
   * @returns 未完成的任务列表
   */
  async getIncompleteTasks(): Promise<StoredUploadTask[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IDB_CONFIG.STORE_TASKS], 'readonly');
      const store = transaction.objectStore(IDB_CONFIG.STORE_TASKS);
      const request = store.getAll();

      request.onsuccess = () => {
        const tasks = request.result as StoredUploadTask[];
        // 筛选出未完成的任务（数据传输已完成但可能上传失败）
        const incompleteTasks = tasks.filter(t => t.isDataTransferComplete);
        console.log(`[DataCacheDB] 获取未完成任务: ${incompleteTasks.length} 个`);
        resolve(incompleteTasks);
      };

      request.onerror = () => {
        console.error(`[DataCacheDB] 获取未完成任务失败:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有任务
   * @returns 所有任务列表
   */
  async getAllTasks(): Promise<StoredUploadTask[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IDB_CONFIG.STORE_TASKS], 'readonly');
      const store = transaction.objectStore(IDB_CONFIG.STORE_TASKS);
      const request = store.getAll();

      request.onsuccess = () => {
        const tasks = request.result as StoredUploadTask[];
        console.log(`[DataCacheDB] 获取所有任务: ${tasks.length} 个`);
        resolve(tasks);
      };

      request.onerror = () => {
        console.error(`[DataCacheDB] 获取所有任务失败:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 删除记录的所有数据（包括数据包和任务）
   * @param recordId 记录ID
   */
  async deleteRecord(recordId: string | number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IDB_CONFIG.STORE_PACKETS, IDB_CONFIG.STORE_TASKS], 'readwrite');

      // 删除数据包
      const packetStore = transaction.objectStore(IDB_CONFIG.STORE_PACKETS);
      const packetIndex = packetStore.index('recordId');
      const packetRequest = packetIndex.openCursor(IDBKeyRange.only(recordId));

      packetRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // 删除任务
      const taskStore = transaction.objectStore(IDB_CONFIG.STORE_TASKS);
      taskStore.delete(recordId);

      transaction.oncomplete = () => {
        console.log(`[DataCacheDB] 删除记录数据成功: recordId=${recordId}`);
        resolve();
      };

      transaction.onerror = () => {
        console.error(`[DataCacheDB] 删除记录数据失败:`, transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * 清空所有数据（数据包和任务）
   */
  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IDB_CONFIG.STORE_PACKETS, IDB_CONFIG.STORE_TASKS], 'readwrite');

      transaction.objectStore(IDB_CONFIG.STORE_PACKETS).clear();
      transaction.objectStore(IDB_CONFIG.STORE_TASKS).clear();

      transaction.oncomplete = () => {
        console.log('[DataCacheDB] 清空所有数据成功');
        resolve();
      };

      transaction.onerror = () => {
        console.error('[DataCacheDB] 清空所有数据失败:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * 清理过期数据
   * @param maxAge 最大保留时间（毫秒），默认7天
   */
  async cleanupOldData(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    if (!this.db) await this.init();

    const now = Date.now();
    const expireTime = now - maxAge;
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IDB_CONFIG.STORE_PACKETS, IDB_CONFIG.STORE_TASKS], 'readwrite');

      // 清理过期的数据包
      const packetStore = transaction.objectStore(IDB_CONFIG.STORE_PACKETS);
      const packetRequest = packetStore.openCursor();

      packetRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const packet = cursor.value as StoredDataPacket;
          if (packet.timestamp < expireTime) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        }
      };

      // 清理过期的任务
      const taskStore = transaction.objectStore(IDB_CONFIG.STORE_TASKS);
      const taskRequest = taskStore.openCursor();

      taskRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const task = cursor.value as StoredUploadTask;
          if (task.createdAt < expireTime) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        console.log(`[DataCacheDB] 清理过期数据完成: 删除了 ${deletedCount} 个数据包`);
        resolve(deletedCount);
      };

      transaction.onerror = () => {
        console.error('[DataCacheDB] 清理过期数据失败:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * 获取数据库统计信息
   * @returns 统计信息
   */
  async getStats(): Promise<{
    totalPackets: number;
    totalTasks: number;
    estimatedSize: number;
  }> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IDB_CONFIG.STORE_PACKETS, IDB_CONFIG.STORE_TASKS], 'readonly');

      let packetCount = 0;
      let taskCount = 0;

      // 统计数据包
      const packetStore = transaction.objectStore(IDB_CONFIG.STORE_PACKETS);
      const packetRequest = packetStore.count();

      packetRequest.onsuccess = () => {
        packetCount = packetRequest.result;
      };

      // 统计任务
      const taskStore = transaction.objectStore(IDB_CONFIG.STORE_TASKS);
      const taskRequest = taskStore.count();

      taskRequest.onsuccess = () => {
        taskCount = taskRequest.result;
      };

      transaction.oncomplete = () => {
        // 估算大小（粗略计算）
        const estimatedSize = (packetCount * 250 + taskCount * 100) / 1024; // KB
        resolve({
          totalPackets: packetCount,
          totalTasks: taskCount,
          estimatedSize: Math.round(estimatedSize * 100) / 100,
        });
      };

      transaction.onerror = () => {
        console.error('[DataCacheDB] 获取统计信息失败:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
      console.log('[DataCacheDB] 数据库连接已关闭');
    }
  }
}

/**
 * 创建全局单例实例
 */
let globalInstance: DataCacheDB | null = null;

/**
 * 获取全局 DataCacheDB 实例（单例模式）
 * @returns DataCacheDB 实例
 */
export function getDataCacheDB(): DataCacheDB {
  if (!globalInstance) {
    globalInstance = new DataCacheDB();
  }
  return globalInstance;
}
