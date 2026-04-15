/**
 * Constants 全局常量插件
 * 将 constants 注册为全局属性，使组件可以直接访问
 */

import type { App } from 'vue';
import constants from '../constants';

/**
 * 创建全局常量插件
 *
 * 使用方式：
 * ```ts
 * import { createApp } from 'vue';
 * import { constantsPlugin } from './plugins';
 *
 * const app = createApp(App);
 * app.use(constantsPlugin);
 * ```
 *
 * 在组件中使用：
 * ```vue
 * <script setup>
 * // 直接使用 constants，无需导入
 * console.log(constants.DEVICE_COMMAND_CODES);
 * </script>
 * ```
 */
export function constantsPlugin(app: App): void {
  // 将 constants 注册为全局属性
  app.config.globalProperties.constants = constants;

  console.log('[Constants Plugin] 全局常量已注册');
}

/**
 * 默认插件实例
 */
export default constantsPlugin;
