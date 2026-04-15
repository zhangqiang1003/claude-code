import {ApiResponse} from "./index";

/**
 * Base API 接口定义
 */
export interface IBaseApi {
    /**
     * 发现设备
     * @returns 返回设备列表
     */
    ping(): Promise<ApiResponse<string>>;
}