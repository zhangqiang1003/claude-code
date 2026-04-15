/**
 * 通用 API 响应结构
 */
export interface ApiResponse<T = any> {
    code: number;
    msg: string;
    data: T;
}

/**
 * 设备请求参数
 */
export interface DeviceReqVO {
    device_id: string;  // 设备地址
}

/**
 * 设备响应信息
 */
export interface DeviceRespVO {
    name: string;  // 设备名称
    address: string;  // 设备地址
}

/**
 * 设备的连接状态
 */
export interface DeviceConnectedRespVO {
    device_id: string;
    is_connected: boolean;
}

/**
 * 全局常量类型定义
 */
export interface Constants {
    DEVICE_COMMAND_CODES: number[];
    SERVER_BASE_URL: string;
}

/**
 * 扩展 Vue 组件实例类型
 * 声明全局 constants 属性的类型
 */
declare module '@vue/runtime-core' {
    export interface ComponentCustomProperties {
        /**
         * 全局常量对象
         * @example
         * // 在组件中直接使用
         * console.log(constants.DEVICE_COMMAND_CODES);
         */
        constants: Constants;
    }
}

/**
 * led灯的状态值
 */
export interface LedStates {
    red: number;
    yellow: number;
    white: number;
}