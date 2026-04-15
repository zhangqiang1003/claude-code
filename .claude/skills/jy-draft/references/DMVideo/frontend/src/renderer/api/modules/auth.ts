import { putRequest, getRequest, postRequest } from '../request';

/**
 * 认证相关接口
 * 包含：登录、注册、密码管理、验证码等功能
 */

// ==================== 账号密码登录 ====================

/**
 * 账号密码登录
 * @param data 登录数据
 * @param data.username 用户名/手机号
 * @param data.password 密码
 * @param data.captcha 图形验证码
 * @param data.captchaId 图形验证码 ID
 * @param data.agreement 是否同意协议（0: 否, 1: 是）
 * @param data.device 设备唯一标识（机器码）
 * @returns 登录结果，包含 token 和用户信息
 */
export const login = (data: {
    username: string;
    password: string;
    captcha: string;
    captchaId: string;
    agreement: number;
    device: string;
}) => {
    return putRequest('/user/auth/login/', data);
};

/**
 * 登出系统
 * @returns 登出结果
 */
export const logout = () => {
    return putRequest('/user/auth/logout/');
};

// ==================== 用户注册 ====================

/**
 * 注册新用户
 * @param data 注册数据
 * @param data.username 用户名
 * @param data.password 密码
 * @param data.confirmPassword 确认密码
 * @param data.agreement 是否同意协议（0: 否, 1: 是）
 * @param data.mobile 手机号
 * @param data.smsCode 短信验证码
 * @param data.device 设备唯一标识（机器码）
 * @returns 注册结果
 */
export const register = (data: {
    username: string;
    password: string;
    confirmPassword: string;
    agreement: number;
    mobile: string;
    smsCode: string;
    device: string;
}) => {
    return putRequest('/user/auth/register/', data);
};

/**
 * 创建用户
 * @param data 用户数据
 * @param data.phone 手机号
 * @param data.password 密码
 * @param data.code 验证码
 * @param data.nick_name 昵称（可选）
 * @returns 创建结果
 */
export const createUser = (data: {
    phone: string;
    password: string;
    code: string;
    nick_name?: string;
}) => {
    return putRequest('/user/auth/create_user/', data);
};

/**
 * 检查用户是否存在
 * @param data 用户数据
 * @param data.username 用户名
 * @returns 检查结果
 */
export const checkUser = (data: {
    username: string;
}) => {
    return postRequest('/user/auth/check_user/', data);
};

// ==================== 密码相关 ====================

/**
 * 忘记密码
 * @param data 密码重置数据
 * @param data.mobile 手机号
 * @param data.password 新密码
 * @param data.code 短信验证码
 * @returns 重置结果
 */
export const forgetPassword = (data: {
    mobile: string;
    password: string;
    code: string;
}) => {
    return putRequest('/user/auth/forget_password/', data);
};

/**
 * 修改密码
 * @param data 密码修改数据
 * @param data.oldPassword 旧密码
 * @param data.newPassword 新密码
 * @returns 修改结果
 */
export const changePassword = (data: {
    oldPassword: string;
    newPassword: string;
}) => {
    return putRequest('/user/auth/change_password/', data);
};

// ==================== 验证码相关 ====================

/**
 * 发送短信验证码
 * @param data 短信数据
 * @param data.user_id 用户 ID（可选）
 * @param data.mobile 手机号（可选）
 * @param data.type 验证码类型
 *   - 1: 注册
 *   - 2: 忘记密码
 *   - 3: 修改密码
 *   - 其他类型根据业务定义
 * @returns 发送结果
 */
export const sendSms = (data: {
    user_id?: number;
    mobile?: string;
    type: number;
}) => {
    return putRequest('/user/sms/send/', data);
};

/**
 * 获取图形验证码
 * @param random 随机数（可选，默认随机生成）
 * @returns 返回包含 img_url 和 captcha_id 的数据
 */
export const getCaptcha = (random?: number) => {
    return getRequest(`/captcha/${random || Math.floor(Math.random() * 10000)}`, {
        miniprogram: 1
    });
};

/**
 * 验证图形验证码
 * @param data 验证码数据
 * @param data.captcha 图形验证码
 * @param data.captchaId 图形验证码 ID
 * @returns 验证结果
 */
export const verifyCaptcha = (data: {
    captcha: string;
    captchaId: string;
}) => {
    return putRequest('/captcha/miniprogram_check/', data);
};

// ==================== 微信扫码登录 ====================

import constants from '../../constants';

/**
 * 微信扫码登录响应
 */
export interface WechatQrcodeLoginResp {
    state: string;        // 二维码状态标识
    qrcodeUrl: string;    // 二维码图片URL（微信授权链接）
    expireTime: number;   // 过期时间戳
}

/**
 * 微信扫码登录状态响应
 */
export interface WechatQrcodeLoginStatusResp {
    status: number;       // 0-等待扫码 1-已扫码 2-已确认 3-已取消 4-已过期
    loginResult?: {       // 登录结果（仅status=2时存在）
        accessToken: string;
        refreshToken: string;
        expiresTime: number;
        userId: number;
        nickname: string;
        avatar: string;
    };
}

/**
 * 初始化微信扫码登录 API
 * 设置基础 URL
 */
export const initWechatAuthApi = async (): Promise<void> => {
    const baseUrl = constants.WECHAT_API_BASE_URL;
    await window.electronAPI.wechatAuthSetBaseUrl(baseUrl);
    console.log('[WechatAuth] API 初始化完成，基础 URL:', baseUrl);
};

/**
 * 获取微信扫码登录二维码
 * @returns 二维码信息（包含 state、二维码 URL、过期时间）
 */
export const getWechatQrcodeLogin = (): Promise<{ code: number; msg: string; data: WechatQrcodeLoginResp }> => {
    return window.electronAPI.wechatAuthGetQrcode();
};

/**
 * 查询微信扫码登录状态
 * @param state 二维码状态标识
 * @returns 扫码状态
 */
export const checkWechatQrcodeLoginStatus = (state: string): Promise<{ code: number; msg: string; data: WechatQrcodeLoginStatusResp }> => {
    return window.electronAPI.wechatAuthCheckStatus(state);
};

// ==================== QQ 扫码登录 ====================

/**
 * QQ 扫码登录响应
 */
export interface QqQrcodeLoginResp {
    state: string;        // 二维码状态标识
    qrcodeUrl: string;    // 二维码图片URL（QQ授权链接）
    expireTime: number;   // 过期时间戳
}

/**
 * QQ 扫码登录状态响应
 */
export interface QqQrcodeLoginStatusResp {
    status: number;       // 0-等待扫码 1-已扫码 2-已确认 3-已取消 4-已过期
    loginResult?: {       // 登录结果（仅status=2时存在）
        accessToken: string;
        refreshToken: string;
        expiresTime: number;
        userId: number;
        nickname: string;
        avatar: string;
    };
}

/**
 * 初始化 QQ 扫码登录 API
 * 设置基础 URL
 */
export const initQqAuthApi = async (): Promise<void> => {
    const baseUrl = constants.QQ_API_BASE_URL;
    await window.electronAPI.qqAuthSetBaseUrl(baseUrl);
    console.log('[QqAuth] API 初始化完成，基础 URL:', baseUrl);
};

/**
 * 获取QQ扫码登录二维码
 * @returns 二维码信息（包含 state、二维码 URL、过期时间）
 */
export const getQqQrcodeLogin = (): Promise<{ code: number; msg: string; data: QqQrcodeLoginResp }> => {
    return window.electronAPI.qqAuthGetQrcode();
};

/**
 * 查询QQ扫码登录状态
 * @param state 二维码状态标识
 * @returns 扫码状态
 */
export const checkQqQrcodeLoginStatus = (state: string): Promise<{ code: number; msg: string; data: QqQrcodeLoginStatusResp }> => {
    return window.electronAPI.qqAuthCheckStatus(state);
};
