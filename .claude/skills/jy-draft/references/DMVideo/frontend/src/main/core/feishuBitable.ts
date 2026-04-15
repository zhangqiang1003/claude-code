/**
 * 飞书多维表格同步工具类
 * 用于从飞书多维表格读取视频素材和文案，同步到本地素材库
 */

import { Client } from '@larksuiteoapi/node-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import { DB } from '../database';
import { FFmpeg } from '../ffmpeg';
import { tokenConfigUtil, FeishuConfig } from './tokenConfig';

/**
 * 飞书字段类型
 */
export type BitableFieldType = 1 | 2 | 3 | 4 | 5 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23;

/**
 * 飞书字段信息
 */
export interface BitableField {
  field_id: string;
  field_name: string;
  type: BitableFieldType;
  property?: any;
}

/**
 * 飞书记录字段值
 */
export interface BitableRecordFieldValue {
  type?: BitableFieldType;
  value?: any;
}

/**
 * 飞书记录
 */
export interface BitableRecord {
  record_id: string;
  fields: Record<string, BitableRecordFieldValue>;
}

/**
 * 附件信息
 */
export interface AttachmentInfo {
  file_token: string;
  name: string;
  size: number;
  url: string;
  type: string;
}

/**
 * 同步选项
 */
export interface SyncOptions {
  /** 是否覆盖已存在的记录 */
  overwrite?: boolean;
}

/**
 * 文案同步选项
 */
export interface SyncTextOptions extends SyncOptions {
  /** 文案字段名（默认自动识别） */
  textFieldName?: string;
}

/**
 * 同步进度
 */
export interface SyncProgress {
  /** 总记录数 */
  total: number;
  /** 已完成数 */
  completed: number;
  /** 当前处理的记录 */
  current: string;
  /** 状态 */
  status: 'reading' | 'downloading' | 'processing' | 'saving' | 'done';
  /** 是否完成 */
  isDone: boolean;
  /** 同步类型 */
  syncType?: 'video' | 'text';
}

/**
 * 同步结果
 */
export interface SyncResult {
  /** 是否成功 */
  success: boolean;
  /** 成功数量 */
  successCount: number;
  /** 跳过数量（已存在） */
  skipCount: number;
  /** 失败数量 */
  failCount: number;
  /** 错误信息列表 */
  errors: string[];
  /** 错误信息 */
  error?: string;
}

/**
 * 飞书多维表格同步工具类（单例模式）
 */
export class FeishuBitableUtil {
  private static instance: FeishuBitableUtil | null = null;
  private client: Client | null = null;
  private db: DB | null = null;
  private ffmpeg: FFmpeg | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): FeishuBitableUtil {
    if (!FeishuBitableUtil.instance) {
      FeishuBitableUtil.instance = new FeishuBitableUtil();
    }
    return FeishuBitableUtil.instance;
  }

  /**
   * 初始化
   */
  public init(db: DB): void {
    this.db = db;
    this.ffmpeg = new FFmpeg();
    console.log('[FeishuBitableUtil] 模块初始化完成，飞书客户端将在同步时动态初始化');
  }

  /**
   * 确保飞书客户端已初始化
   * 从 tokenConfigUtil 获取飞书配置并初始化客户端
   */
  private async ensureClientInitialized(): Promise<boolean> {
    // 如果客户端已存在，直接返回
    if (this.client) {
      return true;
    }

    try {
      // 从 tokenConfigUtil 获取飞书配置
      const feishuConfig = await tokenConfigUtil.getFeishuConfig();
      console.log('[FeishuBitableUtil] 获取到的飞书配置:', feishuConfig);

      if (!feishuConfig) {
        console.error('[FeishuBitableUtil] 飞书配置为 null，请检查服务端是否返回了 feishu 字段');
        return false;
      }

      if (!feishuConfig.app_id || !feishuConfig.app_secret) {
        console.error('[FeishuBitableUtil] 飞书配置不完整，缺少 app_id 或 app_secret:', {
          hasAppId: !!feishuConfig.app_id,
          hasAppSecret: !!feishuConfig.app_secret
        });
        return false;
      }

      // 初始化飞书客户端
      this.client = new Client({
        appId: feishuConfig.app_id,
        appSecret: feishuConfig.app_secret,
        disableTokenCache: false, // SDK 自动管理 token
      });
      console.log('[FeishuBitableUtil] 飞书客户端初始化成功');
      return true;
    } catch (error) {
      console.error('[FeishuBitableUtil] 初始化飞书客户端失败:', error);
      return false;
    }
  }

  /**
   * 解析飞书多维表格 URL
   * @param url 飞书多维表格 URL，格式：https://xxx.feishu.cn/base/appToken?table=tableId
   * @returns { appToken, tableId } 或 null
   */
  private parseFeishuTableUrl(url: string): { appToken: string; tableId: string } | null {
    try {
      if (!url || !url.includes('feishu.cn/base/')) {
        return null;
      }

      // 解析 URL
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const searchParams = urlObj.searchParams;

      // 提取 appToken（路径中 /base/ 后面的部分）
      const baseMatch = pathname.match(/\/base\/([a-zA-Z0-9]+)/);
      if (!baseMatch) {
        return null;
      }
      const appToken = baseMatch[1];

      // 提取 tableId（查询参数 table 的值）
      const tableId = searchParams.get('table');
      if (!tableId) {
        return null;
      }

      return { appToken, tableId };
    } catch (e) {
      console.error('[FeishuBitableUtil] 解析飞书表格 URL 失败:', e);
      return null;
    }
  }

  /**
   * 检查数据库是否已初始化
   */
  public isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * 检查飞书客户端是否已初始化
   */
  public isClientInitialized(): boolean {
    return this.client !== null;
  }

  /**
   * 获取表格字段列表
   */
  public async getTableFields(appToken: string, tableId: string): Promise<BitableField[]> {
    if (!this.client) {
      throw new Error('飞书客户端未初始化');
    }

    console.log('[FeishuBitableUtil] 开始获取表格字段, appToken:', appToken, 'tableId:', tableId);

    const fields: BitableField[] = [];
    let pageToken: string | undefined;
    let lastPageToken: string | undefined;

    try {
      do {
        lastPageToken = pageToken;
        console.log('[FeishuBitableUtil] 正在获取字段列表, pageToken:', pageToken);
        const res = await this.client.bitable.v1.appTableField.list({
          path: {
            app_token: appToken,
            table_id: tableId,
          },
          params: {
            page_size: 100,
            page_token: pageToken,
          },
        });

        console.log('[FeishuBitableUtil] API 调用成功');

        if (res.data?.items) {
          console.log('[FeishuBitableUtil] 获取到字段数量:', res.data.items.length);
          fields.push(...res.data.items as BitableField[]);
        }

        pageToken = res.data?.page_token;

        // 防止死循环：如果 pageToken 没有变化，跳出循环
        if (pageToken === lastPageToken) {
          console.log('[FeishuBitableUtil] pageToken 未变化，结束分页');
          break;
        }
      } while (pageToken);

      console.log('[FeishuBitableUtil] 字段获取完成, 总数:', fields.length);
      return fields;
    } catch (error: any) {
      console.error('[FeishuBitableUtil] 获取表格字段失败:', error);
      console.error('[FeishuBitableUtil] 错误详情:', error.message, error.code);
      throw error;
    }
  }

  /**
   * 搜索表格记录
   */
  public async searchRecords(appToken: string, tableId: string): Promise<BitableRecord[]> {
    if (!this.client) {
      throw new Error('飞书客户端未初始化');
    }

    console.log('[FeishuBitableUtil] 开始搜索表格记录, appToken:', appToken, 'tableId:', tableId);

    const records: BitableRecord[] = [];
    let pageToken: string | undefined;
    let lastPageToken: string | undefined;

    try {
      do {
        lastPageToken = pageToken;
        console.log('[FeishuBitableUtil] 正在搜索记录, pageToken:', pageToken);
        const res = await this.client.bitable.v1.appTableRecord.search({
          path: {
            app_token: appToken,
            table_id: tableId,
          },
          params: {
            page_size: 100,
            page_token: pageToken,
          },
        });

        console.log('[FeishuBitableUtil] 搜索记录 API 调用成功');

        if (res.data?.items) {
          console.log('[FeishuBitableUtil] 获取到记录数量:', res.data.items.length);
          for (const item of res.data.items) {
            if (item.record_id) {
              records.push({
                record_id: item.record_id,
                fields: item.fields as Record<string, BitableRecordFieldValue>,
              });
            }
          }
        }

        pageToken = res.data?.page_token;

        // 防止死循环：如果 pageToken 没有变化，跳出循环
        if (pageToken === lastPageToken) {
          console.log('[FeishuBitableUtil] pageToken 未变化，结束分页');
          break;
        }
      } while (pageToken);

      console.log('[FeishuBitableUtil] 记录搜索完成, 总数:', records.length);
      return records;
    } catch (error: any) {
      console.error('[FeishuBitableUtil] 搜索表格记录失败:', error);
      console.error('[FeishuBitableUtil] 错误详情:', error.message, error.code);
      throw error;
    }
  }

  /**
   * 获取附件下载URL
   * 飞书多维表格附件的 url 字段应该已经是可用的下载链接
   * 如果 url 为空，尝试通过 SDK 下载并保存
   */
  private async downloadAttachmentByToken(fileToken: string, savePath: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      console.log('[FeishuBitableUtil] 通过 file_token 下载附件:', fileToken);

      // 使用飞书 SDK 直接下载文件
      const res = await this.client.drive.v1.file.download({
        path: {
          file_token: fileToken,
        },
      });

      // 使用 SDK 提供的 writeFile 方法直接保存文件
      await res.writeFile(savePath);
      console.log('[FeishuBitableUtil] 文件保存成功:', savePath);
      return true;
    } catch (error: any) {
      console.error('[FeishuBitableUtil] 通过 file_token 下载失败:', error);
      return false;
    }
  }

  /**
   * 获取飞书访问令牌
   */
  private async getAccessToken(): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    try {
      // 使用 SDK 内部的 token 管理器获取 token
      // @larksuiteoapi/node-sdk 的 client 可能有不同的结构
      const clientAny = this.client as any;

      // 尝试多种方式获取 token
      if (clientAny.tokenManager && typeof clientAny.tokenManager.getToken === 'function') {
        const tokenInfo = await clientAny.tokenManager.getToken();
        return tokenInfo?.tenant_access_token || null;
      }

      // 尝试从 client 的内部属性获取
      if (clientAny._tokenManager) {
        const tokenInfo = await clientAny._tokenManager.getToken?.();
        return tokenInfo?.tenant_access_token || null;
      }

      // 尝试使用 SDK 的认证接口获取 token
      // 手动调用飞书 auth API
      const feishuConfig = await tokenConfigUtil.getFeishuConfig();
      if (feishuConfig) {
        const authRes = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
          app_id: feishuConfig.app_id,
          app_secret: feishuConfig.app_secret,
        });

        if (authRes.data?.tenant_access_token) {
          return authRes.data.tenant_access_token;
        }
      }

      return null;
    } catch (error) {
      console.error('[FeishuBitableUtil] 获取访问令牌失败:', error);
      return null;
    }
  }

  /**
   * 下载附件
   * @param url 下载URL
   * @param savePath 保存路径
   * @param fileToken 可选的飞书文件token，用于认证下载
   */
  private async downloadAttachment(url: string, savePath: string, fileToken?: string): Promise<void> {
    // 确保目录存在
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const headers: Record<string, string> = {};

    // 如果是飞书 API URL，添加认证头
    if (url.includes('open.feishu.cn')) {
      const accessToken = await this.getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        console.log('[FeishuBitableUtil] 已添加认证头');
      } else {
        console.warn('[FeishuBitableUtil] 获取 access_token 失败，尝试无认证下载');
      }
    }

    console.log('[FeishuBitableUtil] 开始下载, URL:', url);
    console.log('[FeishuBitableUtil] 保存路径:', savePath);

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 300000, // 5 分钟超时
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      maxRedirects: 10, // 允许重定向
    });

    console.log('[FeishuBitableUtil] 下载响应状态:', response.status);
    console.log('[FeishuBitableUtil] 下载内容大小:', response.data.length, 'bytes');

    fs.writeFileSync(savePath, response.data);
    console.log('[FeishuBitableUtil] 文件保存成功');
  }

  /**
   * 生成唯一文件名
   */
  private generateUniqueFileName(originalName: string): string {
    const timestamp = Date.now();
    const uuid = crypto.randomUUID().substring(0, 8);
    const ext = path.extname(originalName);
    return `${timestamp}_${uuid}${ext}`;
  }

  /**
   * 同步视频素材到本地
   */
  public async syncVideos(
    options: SyncOptions = {},
    onProgress?: (progress: SyncProgress) => void
  ): Promise<SyncResult> {
    if (!this.db || !this.ffmpeg) {
      return { success: false, successCount: 0, skipCount: 0, failCount: 0, errors: [], error: '模块未初始化' };
    }

    // 确保飞书客户端已初始化
    const clientInitialized = await this.ensureClientInitialized();
    if (!clientInitialized) {
      return { success: false, successCount: 0, skipCount: 0, failCount: 0, errors: [], error: '飞书客户端初始化失败，请检查飞书配置' };
    }

    const result: SyncResult = {
      success: true,
      successCount: 0,
      skipCount: 0,
      failCount: 0,
      errors: [],
    };

    try {
      // 获取视频根路径
      const videoRootPath = this.db.getConfig('video_root_path');
      if (!videoRootPath) {
        return { ...result, success: false, error: '请先在基本配置中设置视频存放根路径' };
      }

      // 从 tokenConfig 获取源视频素材表格地址
      const sourceTableUrl = await tokenConfigUtil.getSourceTableUrl();
      if (!sourceTableUrl) {
        return { ...result, success: false, error: '获取源视频素材表格地址失败，请检查配置' };
      }

      // 解析表格 URL
      const tableInfo = this.parseFeishuTableUrl(sourceTableUrl);
      if (!tableInfo) {
        return { ...result, success: false, error: '源视频素材表格地址格式无效' };
      }

      console.log('[FeishuBitableUtil] 源视频素材表格:', tableInfo);

      // 获取表格字段
      const fields = await this.getTableFields(
        tableInfo.appToken,
        tableInfo.tableId
      );

      // 找到附件字段
      const attachmentField = fields.find(f => f.type === 17); // 17 = 附件类型
      if (!attachmentField) {
        return { ...result, success: false, error: '未找到附件字段' };
      }

      // 获取所有记录
      const records = await this.searchRecords(
        tableInfo.appToken,
        tableInfo.tableId
      );

      const total = records.length;
      let completed = 0;

      // 遍历记录
      for (const record of records) {
        const recordId = record.record_id;

        try {
          // 发送进度
          onProgress?.({
            total,
            completed,
            current: recordId,
            status: 'reading',
            isDone: false,
          });

          // 检查是否已存在
          const existing = this.db.getDraftVideoByFeishuRecordId(recordId);
          if (existing && !options.overwrite) {
            console.log('[FeishuBitableUtil] 记录已存在，跳过:', recordId);
            result.skipCount++;
            completed++;
            continue;
          }

          // 获取附件信息
          const attachmentValue = record.fields[attachmentField.field_name];
          console.log('[FeishuBitableUtil] 附件字段值:', attachmentValue);

          // 飞书附件字段值可能是直接数组，也可能是 { value: [...] } 结构
          let attachments: AttachmentInfo[] = [];
          if (Array.isArray(attachmentValue)) {
            // 直接是数组
            attachments = attachmentValue as AttachmentInfo[];
          } else if (attachmentValue && Array.isArray(attachmentValue.value)) {
            // { value: [...] } 结构
            attachments = attachmentValue.value as AttachmentInfo[];
          } else if (attachmentValue) {
            console.log('[FeishuBitableUtil] 附件字段值格式未知，尝试作为数组处理');
            // 尝试直接作为数组
            const attachmentAny = attachmentValue as any;
            if (attachmentAny.file_token) {
              attachments = [attachmentAny as AttachmentInfo];
            }
          }

          if (attachments.length === 0) {
            console.log('[FeishuBitableUtil] 附件数组为空，跳过:', recordId);
            result.skipCount++;
            completed++;
            continue;
          }

          // 只处理第一个附件
          const attachment = attachments[0];
          console.log('[FeishuBitableUtil] 附件完整信息:', JSON.stringify(attachment, null, 2));
          console.log('[FeishuBitableUtil] 找到附件:', attachment.name, 'url:', attachment.url, 'file_token:', attachment.file_token);

          // 检查是否有下载URL或file_token
          if (!attachment.url && !attachment.file_token) {
            console.log('[FeishuBitableUtil] 附件缺少 url 和 file_token，跳过:', recordId);
            result.skipCount++;
            completed++;
            continue;
          }

          // 创建年月日文件夹 (格式: YYYY-MM-DD)
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const dateFolder = `${year}-${month}-${day}`;

          // 生成唯一文件名
          const uniqueFileName = this.generateUniqueFileName(attachment.name);

          // 构建保存路径: 根目录/draftVideo/年月日/文件名
          const draftVideoDir = 'draftVideo'; // 素材库-视频草稿目录名
          const saveDir = path.join(videoRootPath, draftVideoDir, dateFolder);
          const savePath = path.join(saveDir, uniqueFileName);

          console.log('[FeishuBitableUtil] 准备下载:', attachment.name);
          console.log('[FeishuBitableUtil] 保存路径:', savePath);

          // 下载附件
          onProgress?.({
            total,
            completed,
            current: attachment.name,
            status: 'downloading',
            isDone: false,
          });

          let downloadSuccess = false;

          // 优先使用附件中的 url 字段
          if (attachment.url) {
            console.log('[FeishuBitableUtil] 使用附件URL下载:', attachment.url);
            try {
              // 飞书附件URL需要认证，传入file_token用于获取access_token
              await this.downloadAttachment(attachment.url, savePath, attachment.file_token);
              downloadSuccess = true;
              console.log('[FeishuBitableUtil] URL下载成功');
            } catch (downloadError: any) {
              console.error('[FeishuBitableUtil] URL下载失败:', downloadError.message);
            }
          }

          // 如果URL下载失败，尝试使用file_token
          if (!downloadSuccess && attachment.file_token) {
            console.log('[FeishuBitableUtil] 尝试使用 file_token 下载');
            downloadSuccess = await this.downloadAttachmentByToken(attachment.file_token, savePath);
          }

          if (!downloadSuccess) {
            console.log('[FeishuBitableUtil] 下载失败，跳过:', recordId);
            result.failCount++;
            result.errors.push(`记录 ${recordId} 下载失败`);
            completed++;
            continue;
          }

          // 获取视频元信息
          onProgress?.({
            total,
            completed,
            current: attachment.name,
            status: 'processing',
            isDone: false,
          });

          let videoInfo: any = {};
          try {
            const info = await this.ffmpeg.getVideoInfo(savePath);
            videoInfo = {
              duration: info.duration,
              width: info.width,
              height: info.height,
              size: info.size,
              format: path.extname(attachment.name).substring(1),
            };
          } catch (e) {
            console.warn('[FeishuBitableUtil] 获取视频元信息失败:', e);
            videoInfo = {
              size: attachment.size,
              format: path.extname(attachment.name).substring(1),
            };
          }

          // 查找关键词字段（直接匹配"视频关键词"字段名，或名称包含"关键词"/"keyword"）
          console.log('[FeishuBitableUtil] 所有字段:', fields.map(f => ({ name: f.field_name, type: f.type })));

          const keywordField = fields.find(f =>
            f.type === 1 && (
              f.field_name === '视频关键词' ||
              f.field_name.includes('关键词') ||
              f.field_name.toLowerCase().includes('keyword')
            )
          );

          console.log('[FeishuBitableUtil] 找到的关键词字段:', keywordField?.field_name);

          let keywords = '';
          if (keywordField) {
            const keywordValue = record.fields[keywordField.field_name];
            console.log('[FeishuBitableUtil] 关键词字段原始值:', keywordValue);
            if (keywordValue) {
              // 处理不同的值结构
              if (typeof keywordValue === 'string') {
                keywords = keywordValue;
              } else if (Array.isArray(keywordValue)) {
                // 数组结构：[{ text: 'xxx', type: 'text' }]
                const firstItem = keywordValue[0] as any;
                if (firstItem && firstItem.text) {
                  keywords = firstItem.text;
                }
              } else if (keywordValue.value !== undefined) {
                keywords = String(keywordValue.value);
              } else {
                // 尝试访问其他可能的属性
                const keywordAny = keywordValue as any;
                if (keywordAny.text !== undefined) {
                  keywords = String(keywordAny.text);
                }
              }
            }
          }

          console.log('[FeishuBitableUtil] 解析后的关键词:', keywords);

          // 写入数据库
          onProgress?.({
            total,
            completed,
            current: attachment.name,
            status: 'saving',
            isDone: false,
          });

          if (existing && options.overwrite) {
            // 更新现有记录（暂不支持，跳过）
            result.skipCount++;
          } else {
            // 新增记录
            const videoId = this.db.addDraftVideoWithFeishuId({
              file_path: savePath,
              file_name: attachment.name,
              duration: videoInfo.duration,
              width: videoInfo.width,
              height: videoInfo.height,
              size: videoInfo.size,
              format: videoInfo.format,
              keywords: keywords,
              thumbnail: '', // 缩略图稍后生成
              feishu_record_id: recordId,
            });

            // 解析关键词并写入关联表
            if (keywords && keywords.trim()) {
              const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k);
              this.db.addVideoKeywords(videoId, keywordList);
            }

            result.successCount++;
          }

        } catch (e: any) {
          console.error('[FeishuBitableUtil] 处理记录失败:', e);
          result.failCount++;
          result.errors.push(`记录 ${recordId} 处理失败: ${e.message}`);
        }

        completed++;
      }

      // 发送完成进度
      onProgress?.({
        total,
        completed,
        current: '',
        status: 'done',
        isDone: true,
      });

    } catch (e: any) {
      console.error('[FeishuBitableUtil] 同步视频失败:', e);
      return { ...result, success: false, error: e.message };
    }

    return result;
  }

  /**
   * 同步文案到本地
   */
  public async syncTexts(
    options: SyncTextOptions = {},
    onProgress?: (progress: SyncProgress) => void
  ): Promise<SyncResult> {
    if (!this.db) {
      return { success: false, successCount: 0, skipCount: 0, failCount: 0, errors: [], error: '模块未初始化' };
    }

    // 确保飞书客户端已初始化
    const clientInitialized = await this.ensureClientInitialized();
    if (!clientInitialized) {
      return { success: false, successCount: 0, skipCount: 0, failCount: 0, errors: [], error: '飞书客户端初始化失败，请检查飞书配置' };
    }

    const result: SyncResult = {
      success: true,
      successCount: 0,
      skipCount: 0,
      failCount: 0,
      errors: [],
    };

    try {
      // 从 tokenConfig 获取仿写文案表格地址
      const rewriteTableUrl = await tokenConfigUtil.getRewriteTableUrl();
      if (!rewriteTableUrl) {
        return { ...result, success: false, error: '获取仿写文案表格地址失败，请检查配置' };
      }

      // 解析表格 URL
      const tableInfo = this.parseFeishuTableUrl(rewriteTableUrl);
      if (!tableInfo) {
        return { ...result, success: false, error: '仿写文案表格地址格式无效' };
      }

      console.log('[FeishuBitableUtil] 仿写文案表格:', tableInfo);

      // 获取表格字段
      const fields = await this.getTableFields(
        tableInfo.appToken,
        tableInfo.tableId
      );

      // 打印所有字段信息，便于调试
      console.log('[FeishuBitableUtil] 所有字段:', fields.map(f => ({ name: f.field_name, type: f.type })));

      // 找到文案字段（优先匹配名称包含"仿写文案"或"文案"的文本类型字段）
      let textField: BitableField | undefined;

      if (options.textFieldName) {
        // 如果指定了字段名，直接匹配
        textField = fields.find(f => f.field_name === options.textFieldName);
      }

      if (!textField) {
        // 优先匹配"仿写文案"字段
        textField = fields.find(f =>
          f.type === 1 && (
            f.field_name === '仿写文案' ||
            f.field_name.includes('仿写') ||
            (f.field_name.includes('文案') && !f.field_name.includes('表格') && !f.field_name.includes('地址'))
          )
        );
      }

      if (!textField) {
        // 如果没找到，再取第一个文本类型字段
        textField = fields.find(f => f.type === 1); // 1 = 文本类型
      }

      if (!textField) {
        return { ...result, success: false, error: '未找到文案字段' };
      }

      console.log('[FeishuBitableUtil] 选中文案字段:', textField.field_name);

      // 获取所有记录
      const records = await this.searchRecords(
        tableInfo.appToken,
        tableInfo.tableId
      );

      const total = records.length;
      let completed = 0;

      // 遍历记录
      console.log('[FeishuBitableUtil] 开始遍历仿写文案记录，文案字段名:', textField.field_name);
      for (const record of records) {
        const recordId = record.record_id;
        console.log('[FeishuBitableUtil] 读取记录, recordId:', recordId);

        try {
          // 发送进度
          onProgress?.({
            total,
            completed,
            current: recordId,
            status: 'reading',
            isDone: false,
          });

          // 检查是否已存在
          const existing = this.db.getDraftTextByFeishuRecordId(recordId);
          console.log('[FeishuBitableUtil] 记录是否已存在:', !!existing, 'overwrite:', options.overwrite);
          if (existing && !options.overwrite) {
            console.log('[FeishuBitableUtil] 记录已存在，跳过:', recordId);
            result.skipCount++;
            completed++;
            continue;
          }

          // 获取文案内容
          const textValue = record.fields[textField.field_name];
          console.log('[FeishuBitableUtil] 文案字段原始值:', JSON.stringify(textValue));

          // 处理不同的值结构（飞书返回的格式可能是直接字符串或 { value: xxx } 结构）
          let content = '';
          if (textValue) {
            if (typeof textValue === 'string') {
              content = textValue;
            } else if (Array.isArray(textValue)) {
              // 数组结构：[{ text: 'xxx', type: 'text' }]
              const firstItem = textValue[0] as any;
              if (firstItem && firstItem.text) {
                content = firstItem.text;
              }
            } else if (textValue.value !== undefined) {
              content = String(textValue.value);
            } else if ((textValue as any).text !== undefined) {
              content = String((textValue as any).text);
            }
          }

          console.log('[FeishuBitableUtil] 解析后的文案内容长度:', content.length);

          if (!content.trim()) {
            console.log('[FeishuBitableUtil] 文案内容为空，跳过:', recordId);
            result.skipCount++;
            completed++;
            continue;
          }

          // 写入数据库
          onProgress?.({
            total,
            completed,
            current: content.substring(0, 20) + '...',
            status: 'saving',
            isDone: false,
          });

          if (existing && options.overwrite) {
            // 更新现有记录
            console.log('[FeishuBitableUtil] 更新现有记录, id:', existing.id, '内容长度:', content.length);
            this.db.updateDraftText(existing.id, content);
            result.successCount++;
          } else {
            // 新增记录
            console.log('[FeishuBitableUtil] 新增记录到数据库, recordId:', recordId, '内容长度:', content.length);
            this.db.addDraftTextWithFeishuId(content, recordId);
            console.log('[FeishuBitableUtil] 新增记录成功');
            result.successCount++;
          }

        } catch (e: any) {
          console.error('[FeishuBitableUtil] 处理记录失败:', e);
          result.failCount++;
          result.errors.push(`记录 ${recordId} 处理失败: ${e.message}`);
        }

        completed++;
      }

      // 发送完成进度
      onProgress?.({
        total,
        completed,
        current: '',
        status: 'done',
        isDone: true,
      });

    } catch (e: any) {
      console.error('[FeishuBitableUtil] 同步文案失败:', e);
      return { ...result, success: false, error: e.message };
    }

    return result;
  }

  /**
   * 重置飞书客户端（清除缓存的客户端，下次操作时会重新初始化）
   */
  public resetClient(): void {
    this.client = null;
    console.log('[FeishuBitableUtil] 飞书客户端已重置');
  }
}

// 导出单例实例
export const feishuBitableUtil = FeishuBitableUtil.getInstance();