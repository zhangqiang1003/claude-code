/**
 * 通用 API 响应结构
 */
export interface ApiResponse<T = any> {
    code: number;
    msg: string;
    data: T;
}