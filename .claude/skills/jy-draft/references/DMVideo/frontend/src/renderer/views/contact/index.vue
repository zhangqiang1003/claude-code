<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>联系我</span>
      </template>

      <div class="contact-content" v-loading="loading">
        <div class="qrcode-wrapper" v-if="qrcodeUrl">
          <img :src="qrcodeUrl" alt="微信二维码" class="qrcode-img" />
          <p class="qrcode-tip">微信扫码添加好友</p>
        </div>
        <el-empty v-else-if="!loading" description="暂未配置联系方式" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const qrcodeUrl = ref('');
const loading = ref(false);
let unsubscribeBase64: (() => void) | null = null;

const CACHE_KEY_IMAGE = 'contact_qrcode_base64';
const CACHE_KEY_URL_HASH = 'contact_qrcode_url_hash';
const CACHE_KEY_TIMESTAMP = 'contact_qrcode_api_ts';
const CACHE_TTL = 60 * 60 * 1000; // 1小时

/** 简单 DJB2 哈希 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function saveCache(urlHash: string, base64: string) {
  try {
    localStorage.setItem(CACHE_KEY_URL_HASH, urlHash);
    localStorage.setItem(CACHE_KEY_IMAGE, base64);
    localStorage.setItem(CACHE_KEY_TIMESTAMP, String(Date.now()));
  } catch (e) {
    console.warn('缓存二维码失败:', e);
  }
}

function readCache() {
  const base64 = localStorage.getItem(CACHE_KEY_IMAGE);
  const urlHash = localStorage.getItem(CACHE_KEY_URL_HASH);
  const ts = localStorage.getItem(CACHE_KEY_TIMESTAMP);
  return { base64, urlHash, ts: ts ? Number(ts) : 0 };
}

const loadQrcode = async () => {
  loading.value = true;
  try {
    const { base64, urlHash, ts } = readCache();

    // 缓存未过期，直接使用，无需调接口
    if (base64 && Date.now() - ts < CACHE_TTL) {
      qrcodeUrl.value = base64;
      return;
    }

    // 调接口获取图片 URL（快速返回，不阻塞渲染）
    const result = await window.electronAPI.clientInfoGetQrcode();
    if (result.success && result.qrcodeUrl) {
      const newHash = hashString(result.qrcodeUrl);

      // 地址未变且缓存存在，刷新时间戳，继续用缓存
      if (base64 && urlHash === newHash) {
        localStorage.setItem(CACHE_KEY_TIMESTAMP, String(Date.now()));
        qrcodeUrl.value = base64;
        return;
      }

      // 地址变化或无缓存：先用 URL 直接显示图片
      qrcodeUrl.value = result.qrcodeUrl;

      // 通知主进程异步下载 base64（不阻塞页面渲染）
      window.electronAPI.clientInfoDownloadQrcodeBase64(result.qrcodeUrl);
    } else if (base64) {
      // 接口失败但有缓存
      localStorage.setItem(CACHE_KEY_TIMESTAMP, String(Date.now()));
      qrcodeUrl.value = base64;
    }
  } catch (error) {
    console.error('获取二维码失败:', error);
    const { base64 } = readCache();
    if (base64) qrcodeUrl.value = base64;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  // 监听主进程异步返回的 base64
  unsubscribeBase64 = window.electronAPI.onQrcodeBase64Ready((data) => {
    const currentUrl = qrcodeUrl.value;
    // 仅处理当前图片的回调
    if (currentUrl === data.imageUrl || currentUrl.includes(new URL(data.imageUrl).pathname)) {
      const hash = hashString(data.imageUrl);
      saveCache(hash, data.base64);
      // 切换为 base64 显示
      qrcodeUrl.value = data.base64;
    }
  });

  loadQrcode();
});

onUnmounted(() => {
  if (unsubscribeBase64) {
    unsubscribeBase64();
    unsubscribeBase64 = null;
  }
});
</script>

<style scoped>
.contact-content {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.qrcode-wrapper {
  text-align: center;
}

.qrcode-img {
  max-width: 300px;
  max-height: 300px;
  border-radius: 8px;
}

.qrcode-tip {
  margin-top: 12px;
  color: #666;
  font-size: 14px;
}
</style>
