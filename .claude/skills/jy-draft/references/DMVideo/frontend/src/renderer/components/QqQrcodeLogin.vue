<template>
  <el-dialog
    v-model="visible"
    title="QQ 扫码登录"
    width="400px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    class="qq-login-dialog"
    @close="handleClose"
  >
    <div class="qrcode-container">
      <!-- 二维码加载中 -->
      <div v-if="loading" class="loading-state">
        <el-icon class="loading-icon" :size="48">
          <Loading />
        </el-icon>
        <p>正在获取二维码...</p>
      </div>

      <!-- 二维码显示 -->
      <div v-else-if="qrcodeUrl" class="qrcode-wrapper">
        <div class="qrcode-frame" :class="{ 'expired': isExpired }">
          <div class="qrcode-instruction">
            <p>请使用 QQ 扫描二维码登录</p>
          </div>
          <div class="qrcode-image-wrapper">
            <canvas ref="qrcodeCanvas" class="qrcode-canvas"></canvas>
            <div v-if="isExpired" class="qrcode-overlay">
              <el-icon :size="40" color="#fff"><Warning /></el-icon>
              <p>二维码已过期</p>
            </div>
          </div>
        </div>

        <!-- 状态提示 -->
        <div class="status-tip" :class="statusClass">
          <el-icon v-if="status === 0"><Clock /></el-icon>
          <el-icon v-else-if="status === 1"><User /></el-icon>
          <el-icon v-else-if="status === 2"><CircleCheck /></el-icon>
          <el-icon v-else-if="status === 3"><CircleClose /></el-icon>
          <el-icon v-else-if="status === 4"><Warning /></el-icon>
          <span>{{ statusText }}</span>
        </div>

        <!-- 倒计时 -->
        <div v-if="status === 0 && !isExpired" class="countdown">
          <el-icon><Timer /></el-icon>
          <span>{{ formatCountdown }}</span>
        </div>

        <!-- 刷新按钮 -->
        <el-button
          v-if="isExpired || status === 3 || status === 4"
          type="primary"
          @click="refreshQrcode"
          class="refresh-btn"
        >
          <el-icon><Refresh /></el-icon>
          刷新二维码
        </el-button>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <el-icon :size="48" color="#f56c6c"><WarningFilled /></el-icon>
        <p>{{ error }}</p>
        <el-button type="primary" @click="refreshQrcode">重试</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue';
import QRCode from 'qrcode';
import {
  Loading,
  Clock,
  User,
  CircleCheck,
  CircleClose,
  Warning,
  Timer,
  Refresh,
  WarningFilled,
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { getQqQrcodeLogin, checkQqQrcodeLoginStatus } from '../api/modules/auth';
import { useAuthStore } from '../store/auth';

// Props
const props = defineProps<{
  modelValue: boolean;
}>();

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'login-success', data: any): void;
}>();

// Store
const authStore = useAuthStore();

// 状态
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const loading = ref(false);
const error = ref('');
const qrcodeUrl = ref('');
const state = ref('');
const expireTime = ref(0);
const status = ref(0); // 0-等待扫码 1-已扫码 2-已确认 3-已取消 4-已过期
const qrcodeCanvas = ref<HTMLCanvasElement | null>(null);

// 轮询定时器
let pollTimer: NodeJS.Timeout | null = null;
let countdownTimer: NodeJS.Timeout | null = null;

// 计算属性
const isExpired = computed(() => {
  if (!expireTime.value) return false;
  return Date.now() > expireTime.value;
});

const remainingTime = ref(0);

const formatCountdown = computed(() => {
  const minutes = Math.floor(remainingTime.value / 60);
  const seconds = remainingTime.value % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const statusText = computed(() => {
  switch (status.value) {
    case 0: return '等待扫码...';
    case 1: return '已扫码，请在手机上确认';
    case 2: return '登录成功！';
    case 3: return '已取消';
    case 4: return '二维码已过期';
    default: return '';
  }
});

const statusClass = computed(() => {
  switch (status.value) {
    case 0: return 'waiting';
    case 1: return 'scanned';
    case 2: return 'success';
    case 3: return 'cancelled';
    case 4: return 'expired';
    default: return '';
  }
});

// 方法
async function fetchQrcode() {
  loading.value = true;
  error.value = '';

  try {
    const response = await getQqQrcodeLogin();
    if (response.code === 0 && response.data) {
      qrcodeUrl.value = response.data.qrcodeUrl;
      state.value = response.data.state;
      expireTime.value = response.data.expireTime;
      status.value = 0;

      // 计算剩余时间
      updateRemainingTime();
    } else {
      error.value = response.msg || '获取二维码失败';
    }
  } catch (err: any) {
    console.error('[QqLogin] 获取二维码失败:', err);
    error.value = err.message || '获取二维码失败，请检查网络连接';
  } finally {
    loading.value = false;
  }

  // loading 置 false 后 DOM 更新，再渲染二维码
  if (qrcodeUrl.value) {
    await nextTick();
    renderQrcode();

    // 开始轮询状态
    startPolling();
    startCountdown();
  }
}

function renderQrcode() {
  if (!qrcodeCanvas.value || !qrcodeUrl.value) return;
  QRCode.toCanvas(qrcodeCanvas.value, qrcodeUrl.value, {
    width: 220,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  }, (err) => {
    if (err) console.error('[QqLogin] 渲染二维码失败:', err);
  });
}

function updateRemainingTime() {
  if (expireTime.value) {
    remainingTime.value = Math.max(0, Math.floor((expireTime.value - Date.now()) / 1000));
  }
}

function startCountdown() {
  stopCountdown();
  countdownTimer = setInterval(() => {
    updateRemainingTime();
    if (remainingTime.value <= 0) {
      stopCountdown();
      if (status.value === 0) {
        status.value = 4; // 设置为过期状态
        stopPolling();
      }
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!state.value || status.value >= 2) {
      stopPolling();
      return;
    }

    try {
      const response = await checkQqQrcodeLoginStatus(state.value);
      if (response.code === 0 && response.data) {
        status.value = response.data.status;

        // 登录成功
        if (status.value === 2 && response.data.loginResult) {
          stopPolling();
          stopCountdown();
          handleLoginSuccess(response.data.loginResult);
        }
        // 取消或过期
        else if (status.value === 3 || status.value === 4) {
          stopPolling();
          stopCountdown();
        }
      }
    } catch (err) {
      console.error('[QqLogin] 轮询状态失败:', err);
    }
  }, 2000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function handleLoginSuccess(loginResult: any) {
  // 保存认证信息
  authStore.setLoginInfo({
    accessToken: loginResult.accessToken,
    refreshToken: loginResult.refreshToken,
    expiresTime: loginResult.expiresTime,
    userId: loginResult.userId,
    nickname: loginResult.nickname,
    avatar: loginResult.avatar,
  });

  ElMessage.success('登录成功！');

  // 通知父组件
  emit('login-success', loginResult);

  // 延迟关闭弹窗
  setTimeout(() => {
    visible.value = false;
  }, 1000);
}

function refreshQrcode() {
  stopPolling();
  stopCountdown();
  qrcodeUrl.value = '';
  state.value = '';
  expireTime.value = 0;
  status.value = 0;
  error.value = '';
  fetchQrcode();
}

function handleClose() {
  stopPolling();
  stopCountdown();
}

// 监听弹窗显示
watch(visible, (newVal) => {
  if (newVal) {
    fetchQrcode();
  } else {
    handleClose();
  }
});

// 组件卸载时清理
onUnmounted(() => {
  stopPolling();
  stopCountdown();
});
</script>

<style scoped>
.qq-login-dialog :deep(.el-dialog__body) {
  padding: 20px;
}

.qrcode-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 300px;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #909399;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.qrcode-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.qrcode-frame {
  width: 100%;
  padding: 20px;
  border: 2px solid #12B7F5;
  border-radius: 8px;
  background: #f0f9ff;
  transition: all 0.3s;
}

.qrcode-frame.expired {
  border-color: #f56c6c;
  background: #fef0f0;
}

.qrcode-instruction {
  text-align: center;
  margin-bottom: 16px;
  color: #12B7F5;
  font-size: 14px;
  font-weight: 500;
}

.qrcode-image-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.qrcode-canvas {
  display: block;
}

.qrcode-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  color: #fff;
  font-size: 14px;
  gap: 8px;
}

.status-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
}

.status-tip.waiting {
  color: #909399;
  background: #f4f4f5;
}

.status-tip.scanned {
  color: #e6a23c;
  background: #fdf6ec;
}

.status-tip.success {
  color: #67c23a;
  background: #f0f9eb;
}

.status-tip.cancelled {
  color: #909399;
  background: #f4f4f5;
}

.status-tip.expired {
  color: #f56c6c;
  background: #fef0f0;
}

.countdown {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  color: #909399;
  font-size: 13px;
}

.refresh-btn {
  margin-top: 16px;
}
</style>
