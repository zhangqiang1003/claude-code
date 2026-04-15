import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import cache from '../utils/cache';

/**
 * 用户信息接口
 */
export interface UserInfo {
  id: number;
  nickname: string;
  avatar: string;
  mobile?: string;
  email?: string;
}

/**
 * Token 信息接口
 */
export interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresTime: number;
}

/**
 * 认证状态管理
 */
export const useAuthStore = defineStore('auth', () => {
  // 状态
  const isLoggedIn = ref(false);
  const userInfo = ref<UserInfo | null>(null);
  const tokenInfo = ref<TokenInfo | null>(null);
  const showLoginDialogFlag = ref(false);
  const showQQLoginDialogFlag = ref(false);

  // 计算属性
  const accessToken = computed(() => tokenInfo.value?.accessToken || '');
  const nickname = computed(() => userInfo.value?.nickname || '未登录');
  const avatar = computed(() => userInfo.value?.avatar || '');

  /**
   * 从缓存加载认证信息
   */
  function loadFromCache() {
    try {
      const user = cache.get<any>('user');
      if (user && user.token) {
        tokenInfo.value = {
          accessToken: user.token.access,
          refreshToken: user.token.refresh,
          expiresTime: user.token.expiresTime || 0,
        };
        userInfo.value = {
          id: user.id,
          nickname: user.nickname || user.username,
          avatar: user.avatar,
          mobile: user.mobile,
          email: user.email,
        };
        isLoggedIn.value = true;
      }
    } catch (error) {
      console.error('[AuthStore] 加载缓存失败:', error);
    }
  }

  /**
   * 保存认证信息到缓存
   */
  function saveToCache() {
    try {
      if (tokenInfo.value && userInfo.value) {
        cache.set('user', {
          id: userInfo.value.id,
          nickname: userInfo.value.nickname,
          avatar: userInfo.value.avatar,
          mobile: userInfo.value.mobile,
          email: userInfo.value.email,
          token: {
            type: 'Bearer',
            access: tokenInfo.value.accessToken,
            refresh: tokenInfo.value.refreshToken,
            expiresTime: tokenInfo.value.expiresTime,
          },
        });
      }
    } catch (error) {
      console.error('[AuthStore] 保存缓存失败:', error);
    }
  }

  /**
   * 设置登录信息
   */
  function setLoginInfo(data: {
    accessToken: string;
    refreshToken: string;
    expiresTime: number;
    userId: number;
    nickname: string;
    avatar: string;
  }) {
    tokenInfo.value = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresTime: data.expiresTime,
    };
    userInfo.value = {
      id: data.userId,
      nickname: data.nickname,
      avatar: data.avatar,
    };
    isLoggedIn.value = true;
    saveToCache();
  }

  /**
   * 登出
   */
  function logout() {
    isLoggedIn.value = false;
    userInfo.value = null;
    tokenInfo.value = null;
    cache.remove('user');
  }

  /**
   * 显示登录弹窗
   */
  function showLoginDialog() {
    showLoginDialogFlag.value = true;
  }

  /**
   * 隐藏登录弹窗
   */
  function hideLoginDialog() {
    showLoginDialogFlag.value = false;
  }

  /**
   * 显示 QQ 登录弹窗
   */
  function showQQLoginDialog() {
    showQQLoginDialogFlag.value = true;
  }

  /**
   * 隐藏 QQ 登录弹窗
   */
  function hideQQLoginDialog() {
    showQQLoginDialogFlag.value = false;
  }

  /**
   * 检查登录状态
   */
  function checkLoginStatus(): boolean {
    if (!isLoggedIn.value || !tokenInfo.value) {
      return false;
    }

    // 检查 token 是否过期
    if (tokenInfo.value.expiresTime && Date.now() > tokenInfo.value.expiresTime) {
      logout();
      return false;
    }

    return true;
  }

  // 初始化时从缓存加载
  loadFromCache();

  return {
    // 状态
    isLoggedIn,
    userInfo,
    tokenInfo,
    showLoginDialogFlag,
    showQQLoginDialogFlag,
    // 计算属性
    accessToken,
    nickname,
    avatar,
    // 方法
    loadFromCache,
    saveToCache,
    setLoginInfo,
    logout,
    showLoginDialog,
    hideLoginDialog,
    showQQLoginDialog,
    hideQQLoginDialog,
    checkLoginStatus,
  };
});
