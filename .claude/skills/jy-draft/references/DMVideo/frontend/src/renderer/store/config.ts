import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// 子文件夹名称常量
export const MATERIAL_VIDEO_DIR = 'materialVideo';
export const DRAFT_VIDEO_DIR = 'draftVideo';

/**
 * 配置状态管理
 */
export const useConfigStore = defineStore('config', () => {
  // 配置数据
  const videoRootPath = ref('');
  const jianyingDraftPath = ref('');
  const ffmpegPath = ref('');
  const pythonPath = ref('python');
  const apiToken = ref('');
  const apiBaseUrl = ref('');

  // 子文件夹名称
  const materialVideoDirName = ref(MATERIAL_VIDEO_DIR);
  const draftVideoDirName = ref(DRAFT_VIDEO_DIR);

  // 计算属性：完整路径
  const materialVideoPath = computed(() => {
    return videoRootPath.value ? `${videoRootPath.value}/${materialVideoDirName.value}` : '';
  });

  const draftVideoPath = computed(() => {
    return videoRootPath.value ? `${videoRootPath.value}/${draftVideoDirName.value}` : '';
  });

  // 是否已加载
  const loaded = ref(false);

  /**
   * 从数据库加载配置
   */
  async function loadConfig() {
    try {
      const configs = await window.electronAPI.getAllConfigs();
      videoRootPath.value = configs.video_root_path || '';
      jianyingDraftPath.value = configs.jianying_draft_path || '';
      ffmpegPath.value = configs.ffmpeg_path || '';
      pythonPath.value = configs.python_path || 'python';
      apiToken.value = configs.api_token || '';
      apiBaseUrl.value = configs.api_base_url || '';
      loaded.value = true;
      console.log('[ConfigStore] 配置加载完成');
    } catch (error) {
      console.error('[ConfigStore] 加载配置失败:', error);
    }
  }

  /**
   * 设置视频根路径（自动创建子文件夹）
   */
  async function setVideoRootPath(path: string) {
    try {
      const result = await window.electronAPI.setVideoRootPath(path);
      if (result.success) {
        videoRootPath.value = path;
      }
      return result;
    } catch (error) {
      console.error('[ConfigStore] 设置视频根路径失败:', error);
      throw error;
    }
  }

  /**
   * 更新单个配置
   */
  async function setConfig(key: string, value: string) {
    try {
      // 视频根路径使用专门的方法
      if (key === 'video_root_path') {
        return await setVideoRootPath(value);
      }

      await window.electronAPI.setConfig(key, value);
      // 同步更新本地状态
      switch (key) {
        case 'jianying_draft_path':
          jianyingDraftPath.value = value;
          break;
        case 'ffmpeg_path':
          ffmpegPath.value = value;
          break;
        case 'python_path':
          pythonPath.value = value;
          break;
        case 'api_token':
          apiToken.value = value;
          break;
        case 'api_base_url':
          apiBaseUrl.value = value;
          break;
      }
    } catch (error) {
      console.error('[ConfigStore] 更新配置失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新配置
   */
  async function setConfigs(configs: {
    video_root_path?: string;
    jianying_draft_path?: string;
    ffmpeg_path?: string;
    python_path?: string;
    api_token?: string;
    api_base_url?: string;
  }) {
    try {
      // 视频根路径单独处理
      if (configs.video_root_path !== undefined) {
        await setVideoRootPath(configs.video_root_path);
      }

      if (configs.jianying_draft_path !== undefined) {
        await window.electronAPI.setConfig('jianying_draft_path', configs.jianying_draft_path);
        jianyingDraftPath.value = configs.jianying_draft_path;
      }
      if (configs.ffmpeg_path !== undefined) {
        await window.electronAPI.setConfig('ffmpeg_path', configs.ffmpeg_path);
        ffmpegPath.value = configs.ffmpeg_path;
      }
      if (configs.python_path !== undefined) {
        await window.electronAPI.setConfig('python_path', configs.python_path);
        pythonPath.value = configs.python_path;
      }
      if (configs.api_token !== undefined) {
        await window.electronAPI.setConfig('api_token', configs.api_token);
        apiToken.value = configs.api_token;
      }
      if (configs.api_base_url !== undefined) {
        await window.electronAPI.setConfig('api_base_url', configs.api_base_url);
        apiBaseUrl.value = configs.api_base_url;
      }
    } catch (error) {
      console.error('[ConfigStore] 批量更新配置失败:', error);
      throw error;
    }
  }

  return {
    videoRootPath,
    jianyingDraftPath,
    ffmpegPath,
    pythonPath,
    apiToken,
    apiBaseUrl,
    materialVideoDirName,
    draftVideoDirName,
    materialVideoPath,
    draftVideoPath,
    loaded,
    loadConfig,
    setConfig,
    setConfigs,
    setVideoRootPath
  };
});