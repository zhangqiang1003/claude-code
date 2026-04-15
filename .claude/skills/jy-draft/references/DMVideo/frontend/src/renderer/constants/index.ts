export default {
  /**
   * 设备指令码
   */
  DEVICE_COMMAND_CODES: [
    0x02, 0x03, 0x04, 0x05, 0x07, 0x10, 0x11, 0x1f, 0x20, 0x21, 0x22, 0x23,
    0x25, 0x26, 0x29,
  ],

  // 远程服务器（业务 API）
  SERVER_BASE_URL:
    window.process?.env?.SERVER_BASE_URL || "https://test.dmaodata.cn",

  // 本地后端服务（蓝牙设备控制、数据上传）
  API_BASE_URL: window.process?.env?.API_BASE_URL || "http://127.0.0.1:8205",

  // 微信扫码登录 API 基础 URL
  WECHAT_API_BASE_URL:
    window.process?.env?.WECHAT_API_BASE_URL || "http://127.0.0.1:38080",

  // QQ 扫码登录 API 基础 URL
  QQ_API_BASE_URL:
    window.process?.env?.QQ_API_BASE_URL || "http://127.0.0.1:38080",
};
