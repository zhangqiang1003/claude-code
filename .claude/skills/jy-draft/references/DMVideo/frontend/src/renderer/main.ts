import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css';
import App from './App.vue'
import router from './router';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { configPlugin } from './plugins/configPlugin';

const app = createApp(App);
const pinia = createPinia();

// 先注册 pinia，因为 configPlugin 需要使用它
app.use(pinia);
// 再注册配置插件，它会从数据库加载配置到状态管理
app.use(configPlugin);
app.use(router);
app.use(ElementPlus);

// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app');