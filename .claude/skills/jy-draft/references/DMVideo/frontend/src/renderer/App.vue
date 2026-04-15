<template>
  <div id="app">
    <el-config-provider :locale="locale">
      <router-view />
      <WechatQrcodeLogin v-model="authStore.showLoginDialogFlag" />
      <QqQrcodeLogin v-model="authStore.showQQLoginDialogFlag" />
    </el-config-provider>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import WechatQrcodeLogin from './components/WechatQrcodeLogin.vue';
import QqQrcodeLogin from './components/QqQrcodeLogin.vue';
import { useAuthStore } from './store/auth';
import { initWechatAuthApi, initQqAuthApi } from './api/modules/auth';

// 直接设置为中文
const locale = ref(zhCn);
const authStore = useAuthStore();

// 应用启动时初始化认证 API
onMounted(async () => {
  await initWechatAuthApi();
  await initQqAuthApi();
});
</script>

<style>
#app {
  display: flex;
  flex-direction: column;
  min-height: 90vh;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  background-color: #f0f2f5;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
}
</style>
