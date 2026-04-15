<template>
  <el-container class="main-layout">
    <!-- 侧边栏导航 -->
    <el-aside width="200px" class="sidebar">
      <div class="logo">
        <h2>DMVideo</h2>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="#fff"
        active-text-color="#1890ff"
      >
        <!-- 材料库 -->
        <el-sub-menu index="material">
          <template #title>
            <el-icon><FolderOpened /></el-icon>
            <span>材料库</span>
          </template>
<!--          <el-menu-item index="/material/text">-->
<!--            <el-icon><Document /></el-icon>-->
<!--            <span>文案</span>-->
<!--          </el-menu-item>-->
          <el-menu-item index="/material/video">
            <el-icon><VideoCamera /></el-icon>
            <span>视频</span>
          </el-menu-item>
<!--          <el-menu-item index="/material/url">-->
<!--            <el-icon><Link /></el-icon>-->
<!--            <span>作品地址</span>-->
<!--          </el-menu-item>-->
        </el-sub-menu>

        <!-- 素材库 -->
        <el-sub-menu index="draft">
          <template #title>
            <el-icon><Files /></el-icon>
            <span>素材库</span>
          </template>
          <el-menu-item index="/draft/text">
            <el-icon><Document /></el-icon>
            <span>文案</span>
          </el-menu-item>
          <el-menu-item index="/draft/video">
            <el-icon><VideoCamera /></el-icon>
            <span>视频</span>
          </el-menu-item>
        </el-sub-menu>

        <!-- 作品库 -->
<!--        <el-menu-item index="/works">-->
<!--          <el-icon><Folder /></el-icon>-->
<!--          <span>作品库</span>-->
<!--        </el-menu-item>-->

        <!-- 基本配置 -->
        <el-menu-item index="/config">
          <el-icon><Setting /></el-icon>
          <span>基本配置</span>
        </el-menu-item>

        <!-- 联系我 -->
        <el-menu-item index="/contact">
          <el-icon><ChatDotRound /></el-icon>
          <span>联系我</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 主内容区 -->
    <el-container>
      <el-header class="header">
        <div class="header-title">{{ pageTitle }}</div>
        <div class="header-right">
          <!-- 未登录状态 -->
          <el-button v-if="!authStore.isLoggedIn" type="primary" size="small" @click="authStore.showLoginDialog()">
            <el-icon><User /></el-icon>
            登录
          </el-button>
          <!-- 已登录状态 -->
          <div v-else class="user-info">
            <el-avatar :size="28" :src="authStore.avatar || undefined" class="user-avatar">
              <el-icon :size="16"><User /></el-icon>
            </el-avatar>
            <span class="user-nickname">{{ authStore.nickname }}</span>
            <el-button type="danger" text size="small" @click="handleLogout">退出</el-button>
          </div>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  FolderOpened,
  Files,
  Folder,
  Document,
  VideoCamera,
  Link,
  Setting,
  ChatDotRound,
  User,
} from '@element-plus/icons-vue';
import { useAuthStore } from '../store/auth';

const route = useRoute();
const authStore = useAuthStore();

// 计算当前激活的菜单项
const activeMenu = computed(() => {
  return route.path;
});

// 页面标题
const pageTitle = computed(() => {
  return route.meta?.title || 'DMVideo';
});

// 退出登录
function handleLogout() {
  authStore.logout();
  ElMessage.success('已退出登录');
}
</script>

<style scoped>
.main-layout {
  height: 100vh;
}

.sidebar {
  background-color: #001529;
  color: #fff;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #002140;
}

.logo h2 {
  color: #fff;
  margin: 0;
  font-size: 20px;
}

.el-menu {
  border-right: none;
  height: calc(100vh - 60px);
}

.header {
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.header-title {
  font-size: 18px;
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  flex-shrink: 0;
}

.user-nickname {
  font-size: 14px;
  color: #606266;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
