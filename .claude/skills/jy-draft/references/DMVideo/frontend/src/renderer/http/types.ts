/**
 * HTTP 请求模块类型定义
 */

import { AxiosRequestConfig, AxiosProgressEvent } from 'axios';

/**
 * 通用 API 响应结构
 */
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

/**
 * 请求配置接口，扩展 AxiosRequestConfig
 */
export interface RequestConfig extends AxiosRequestConfig {
  /**
   * 是否显示加载提示
   * @default true
   */
  showLoading?: boolean;

  /**
   * 是否显示错误提示
   * @default true
   */
  showError?: boolean;

  /**
   * 自定义错误消息
   */
  customErrorMsg?: string;

  /**
   * 是否直接返回响应数据（跳过统一响应格式处理）
   * @default false
   */
  directResponse?: boolean;
}

/**
 * 上传文件参数接口
 */
export interface UploadFileOptions {
  /**
   * 文件对象或文件列表
   */
  file: File | FileList;

  /**
   * 表单数据字段名
   * @default 'file'
   */
  fieldName?: string;

  /**
   * 额外的表单数据
   */
  data?: Record<string, any>;

  /**
   * 上传进度回调
   */
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
}

/**
 * 请求方法枚举
 */
export enum RequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

/**
 * HTTP 错误类
 */
export class HttpError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
