/**
 * 加密拦截器
 * 用于自动处理数据的加密和解密
 */

import { cryptoUtil } from './crypto';

/**
 * 字段加密配置
 */
export interface FieldEncryptionConfig {
  /** 表名 */
  table: string;
  /** 需要加密的字段列表 */
  fields: string[];
}

/**
 * 拦截器配置
 */
export interface InterceptorConfig {
  /** 是否启用加密 */
  enabled: boolean;
  /** 加密字段配置 */
  fieldConfigs: FieldEncryptionConfig[];
}

/**
 * 数据操作类型
 */
type OperationType = 'insert' | 'update' | 'select';

/**
 * 加密拦截器类
 * 自动拦截数据库操作，对敏感字段进行加密/解密
 */
export class EncryptionInterceptor {
  private enabled: boolean = true;
  private fieldConfigs: Map<string, Set<string>> = new Map();

  /**
   * 创建加密拦截器
   * @param config 拦截器配置
   */
  constructor(config?: Partial<InterceptorConfig>) {
    if (config?.enabled !== undefined) {
      this.enabled = config.enabled;
    }

    if (config?.fieldConfigs) {
      this.setFieldConfigs(config.fieldConfigs);
    }
  }

  /**
   * 设置字段加密配置
   */
  setFieldConfigs(configs: FieldEncryptionConfig[]): void {
    this.fieldConfigs.clear();
    for (const config of configs) {
      this.fieldConfigs.set(config.table, new Set(config.fields));
    }
  }

  /**
   * 添加单个表的加密配置
   */
  addTableConfig(table: string, fields: string[]): void {
    this.fieldConfigs.set(table, new Set(fields));
  }

  /**
   * 启用/禁用拦截器
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 检查表字段是否需要加密
   */
  private shouldEncrypt(table: string, field: string): boolean {
    if (!this.enabled) return false;
    const fields = this.fieldConfigs.get(table);
    return fields?.has(field) ?? false;
  }

  /**
   * 获取表的加密字段列表
   */
  private getEncryptFields(table: string): string[] {
    const fields = this.fieldConfigs.get(table);
    return fields ? Array.from(fields) : [];
  }

  /**
   * 插入前拦截 - 加密敏感字段
   * @param table 表名
   * @param data 要插入的数据
   * @returns 处理后的数据
   */
  beforeInsert<T extends Record<string, any>>(table: string, data: T): T {
    if (!this.enabled) return data;

    const encryptedFields = this.getEncryptFields(table);
    if (encryptedFields.length === 0) return data;

    const result: Record<string, any> = { ...data };
    for (const field of encryptedFields) {
      if (result[field] !== undefined && result[field] !== null) {
        // 只加密字符串类型
        if (typeof result[field] === 'string') {
          result[field] = cryptoUtil.encrypt(result[field]);
        }
      }
    }

    return result as T;
  }

  /**
   * 更新前拦截 - 加密敏感字段
   * @param table 表名
   * @param data 要更新的数据
   * @returns 处理后的数据
   */
  beforeUpdate<T extends Record<string, any>>(table: string, data: T): T {
    return this.beforeInsert(table, data);
  }

  /**
   * 查询后拦截 - 解密敏感字段
   * @param table 表名
   * @param data 查询结果数据
   * @returns 处理后的数据
   */
  afterSelect<T extends Record<string, any>>(table: string, data: T): T {
    if (!this.enabled) return data;
    if (!data) return data;

    const encryptedFields = this.getEncryptFields(table);
    if (encryptedFields.length === 0) return data;

    const result: Record<string, any> = { ...data };
    for (const field of encryptedFields) {
      if (result[field] !== undefined && result[field] !== null) {
        // 尝试解密
        if (typeof result[field] === 'string' && cryptoUtil.isEncrypted(result[field])) {
          try {
            result[field] = cryptoUtil.decrypt(result[field]);
          } catch (error) {
            console.warn(`[Interceptor] 解密字段 ${field} 失败:`, error);
          }
        }
      }
    }

    return result as T;
  }

  /**
   * 批量查询后拦截 - 解密敏感字段
   * @param table 表名
   * @param dataList 查询结果数据列表
   * @returns 处理后的数据列表
   */
  afterSelectMany<T extends Record<string, any>>(table: string, dataList: T[]): T[] {
    if (!this.enabled) return dataList;
    if (!dataList || dataList.length === 0) return dataList;

    return dataList.map(data => this.afterSelect(table, data));
  }

  /**
   * 创建代理对象，自动处理加密解密
   * @param target 目标对象（如数据库实例）
   * @param getTableName 获取表名的方法
   */
  createProxy<T extends object>(target: T, getTableName?: (method: string) => string): T {
    const self = this;

    return new Proxy(target, {
      get(obj, prop: string) {
        const value = Reflect.get(obj, prop);

        // 如果是方法，包装它
        if (typeof value === 'function') {
          return function (...args: any[]) {
            const result = value.apply(obj, args);

            // 处理返回 Promise 的方法
            if (result instanceof Promise) {
              return result.then((data: any) => {
                // 根据方法名判断操作类型
                if (prop.startsWith('get') || prop.startsWith('find')) {
                  if (Array.isArray(data)) {
                    const table = getTableName?.(prop) || prop.replace(/^get|find/, '').toLowerCase();
                    return self.afterSelectMany(table, data);
                  } else if (data && typeof data === 'object') {
                    const table = getTableName?.(prop) || prop.replace(/^get|find/, '').toLowerCase();
                    return self.afterSelect(table, data);
                  }
                }
                return data;
              });
            }

            return result;
          };
        }

        return value;
      }
    });
  }
}

// 默认配置：定义需要加密的表和字段
const defaultFieldConfigs: FieldEncryptionConfig[] = [
  {
    table: 'material_text',
    fields: []
  },
  {
    table: 'draft_text',
    fields: ['content']
  },
  {
    table: 'material_url',
    fields: ['url', 'title']
  },
  {
    table: 'config',
    fields: ['value']
  }
];

// 导出默认实例
export const encryptionInterceptor = new EncryptionInterceptor({
  enabled: true,
  fieldConfigs: defaultFieldConfigs
});