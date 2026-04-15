import type { App } from 'vue';
import { useConfigStore } from '../store/config';

/**
 * 配置初始化插件
 * 在应用启动时从数据库加载配置到全局状态管理
 */
export const configPlugin = {
  async install(app: App) {
    const configStore = useConfigStore();

    // 等待配置加载完成
    await configStore.loadConfig();

    console.log('[ConfigPlugin] 配置初始化完成');
  }
};