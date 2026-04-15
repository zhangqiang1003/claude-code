<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>基本配置</span>
      </template>

      <el-form :model="configForm" label-width="150px" style="max-width: 600px">
        <el-form-item label="视频存放根路径">
          <div class="path-input">
            <el-input v-model="configForm.video_root_path" placeholder="请选择视频存放根路径" />
            <el-button type="primary" @click="selectVideoRootPath">选择</el-button>
          </div>
        </el-form-item>

        <el-form-item label="剪映草稿地址">
          <div class="path-input">
            <el-input v-model="configForm.jianying_draft_path" placeholder="请选择剪映草稿目录" />
            <el-button type="primary" @click="selectJianyingDraftPath">选择</el-button>
          </div>
        </el-form-item>

<!--        <el-form-item label="FFmpeg路径">-->
<!--          <div class="path-input">-->
<!--            <el-input v-model="configForm.ffmpeg_path" placeholder="可选，留空使用内置版本" />-->
<!--            <el-button type="primary" @click="selectFFmpegPath">选择</el-button>-->
<!--          </div>-->
<!--        </el-form-item>-->

<!--        <el-form-item label="Python路径">-->
<!--          <div class="path-input">-->
<!--            <el-input v-model="configForm.python_path" placeholder="Python解释器路径" />-->
<!--            <el-button type="primary" @click="selectPythonPath">选择</el-button>-->
<!--          </div>-->
<!--        </el-form-item>-->

        <el-form-item label="API Token">
          <el-input
            v-model="configForm.api_token"
            type="password"
            placeholder="请输入API Token"
            show-password
          />
        </el-form-item>

        <el-form-item label="API 服务地址">
          <div class="path-input">
            <el-input v-model="configForm.api_base_url" placeholder="Token API 服务地址" />
            <el-button type="primary" @click="testApiConnection">测试连接</el-button>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 复刻音色管理 -->
    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>复刻音色</span>
          <el-button type="primary" size="small" @click="showCloneDialog">
            <el-icon><Plus /></el-icon>
            克隆音色
          </el-button>
        </div>
      </template>

      <div class="voice-clone-tips">
        <el-alert
          title="使用说明"
          type="info"
          :closable="false"
          show-icon
        >
          <template #default>
            <p>1. 可免费克隆 2 组音色，超过后克隆需消耗 100 积分</p>
            <p>2. 免费音色超过 7 天未使用将自动过期，付费音色超过 30 天未使用将失效</p>
            <p>3. 付费音色失效后再次克隆需消耗 100 积分</p>
            <p>4. 准备 10-60 秒清晰无噪的 MP3 录音文件（将校验实际格式和时长）</p>
          </template>
        </el-alert>
      </div>

      <el-table :data="voiceCloneList" style="width: 100%" v-loading="voiceLoading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="voice_tag" label="音色标识" width="120" />
        <el-table-column label="模型" min-width="180">
          <template #default="{ row }">
            {{ getModelName(row.voice_model_id) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '激活' : '已过期' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="(row.clone_type ?? 'free') === 'free' ? undefined : 'warning'" size="small">
              {{ (row.clone_type ?? 'free') === 'free' ? '免费' : '付费' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近使用" width="160">
          <template #default="{ row }">
            <span v-if="row.used_at">{{ formatDate(row.used_at) }}</span>
            <span v-else class="no-data">未使用</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'expired'"
              type="warning"
              size="small"
              @click="handleReclone(row)"
            >
              重新克隆
            </el-button>
<!--            <el-button-->
<!--              v-else-->
<!--              type="primary"-->
<!--              size="small"-->
<!--              @click="handleUseVoice(row)"-->
<!--            >-->
<!--              使用-->
<!--            </el-button>-->
            <el-button type="danger" size="small" @click="handleDeleteVoice(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 克隆音色对话框 -->
    <el-dialog
      v-model="cloneDialogVisible"
      title="克隆音色"
      width="500px"
      @closed="resetCloneForm"
    >
      <el-form :model="cloneForm" :rules="cloneRules" ref="cloneFormRef" label-width="100px">
        <el-form-item label="音色标识" prop="voice_tag">
          <el-input
            v-model="cloneForm.voice_tag"
            placeholder="自定义音色标识（仅数字和字母，最多8位）"
            maxlength="8"
            show-word-limit
            @input="handleVoiceTagInput"
          />
        </el-form-item>
        <el-form-item label="语音模型" prop="voice_model_id">
          <el-select v-model="cloneForm.voice_model_id" placeholder="请选择语音模型" style="width: 100%">
            <el-option
              v-for="model in supportedModels"
              :key="model.id"
              :label="model.name"
              :value="model.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="录音文件" prop="audio_file_path">
          <div class="path-input">
            <el-input v-model="cloneForm.audio_file_path" placeholder="选择录音文件" />
            <el-button type="primary" @click="selectAudioFile">选择</el-button>
          </div>
          <div class="audio-tips">
            <el-text size="small" type="info">
              仅支持 MP3 格式，时长 10-60 秒，需清晰无背景噪音
            </el-text>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cloneDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCloneVoice" :loading="cloneLoading">
          开始克隆
        </el-button>
      </template>
    </el-dialog>

    <!-- 测试用例同步 -->
    <el-card style="margin-top: 20px" v-if="!hasDownloadedTestData">
      <template #header>
        <div class="card-header">
          <span>测试用例同步</span>
          <el-button type="primary" size="small" @click="showSyncDialog" :loading="syncLoading">
            <el-icon><Download /></el-icon>
            下载测试用例
          </el-button>
        </div>
      </template>

      <div class="sync-tips">
        <el-alert
          title="使用说明"
          type="info"
          :closable="false"
          show-icon
        >
          <template #default>
            <p>1. 点击"下载测试用例"按钮，将同步视频素材和文案到本地</p>
            <p>2. 视频素材将存放在配置的视频存放根路径中</p>
            <p>3. 支持断点重试：已同步的记录会自动跳过</p>
          </template>
        </el-alert>
      </div>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="视频素材">
          <span v-if="syncResult.video">{{ syncResult.video.successCount }} 成功 / {{ syncResult.video.skipCount }} 跳过 / {{ syncResult.video.failCount }} 失败</span>
          <span v-else class="no-data">未同步</span>
        </el-descriptions-item>
        <el-descriptions-item label="文案素材">
          <span v-if="syncResult.text">{{ syncResult.text.successCount }} 成功 / {{ syncResult.text.skipCount }} 跳过 / {{ syncResult.text.failCount }} 失败</span>
          <span v-else class="no-data">未同步</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 同步进度对话框 -->
    <el-dialog
      v-model="syncDialogVisible"
      title="同步进度"
      width="500px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="syncProgress.isDone"
    >
      <div class="sync-progress-content">
        <el-progress
          :percentage="syncProgress.total > 0 ? Math.round((syncProgress.completed / syncProgress.total) * 100) : 0"
          :status="syncProgress.isDone ? 'success' : ''"
        />
        <div class="sync-progress-info">
          <p v-if="syncProgress.syncType === 'video'">
            <el-tag type="primary" size="small">视频同步</el-tag>
            {{ syncProgress.completed }} / {{ syncProgress.total }}
          </p>
          <p v-else-if="syncProgress.syncType === 'text'">
            <el-tag type="success" size="small">文案同步</el-tag>
            {{ syncProgress.completed }} / {{ syncProgress.total }}
          </p>
          <p class="sync-status">
            <el-tag size="small" :type="getStatusTagType(syncProgress.status)">
              {{ getStatusText(syncProgress.status) }}
            </el-tag>
            <span v-if="syncProgress.current" class="sync-current">{{ syncProgress.current }}</span>
          </p>
        </div>
        <el-divider v-if="syncProgress.isDone && syncErrors.length > 0" />
        <div v-if="syncProgress.isDone && syncErrors.length > 0" class="sync-errors">
          <el-alert
            title="部分记录同步失败"
            type="warning"
            :closable="false"
          >
            <ul>
              <li v-for="(error, index) in syncErrors.slice(0, 5)" :key="index">{{ error }}</li>
              <li v-if="syncErrors.length > 5">... 还有 {{ syncErrors.length - 5 }} 条错误</li>
            </ul>
          </el-alert>
        </div>
      </div>
      <template #footer>
        <el-button v-if="syncProgress.isDone" type="primary" @click="syncDialogVisible = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Plus, Download } from '@element-plus/icons-vue';
import { useConfigStore } from '../../store';

// 使用配置状态管理
const configStore = useConfigStore();

// 本地表单数据
const configForm = ref({
  video_root_path: '',
  jianying_draft_path: '',
  ffmpeg_path: '',
  python_path: 'python',
  api_token: '',
  api_base_url: ''
});

// ==================== 音色克隆相关 ====================

const voiceCloneList = ref<any[]>([]);
const voiceLoading = ref(false);
const voiceCloneCount = computed(() => voiceCloneList.value.filter(v => v.deleted === 0).length);
const freeVoiceCloneCount = computed(() => voiceCloneList.value.filter(v => v.deleted === 0 && (v.clone_type ?? 'free') === 'free').length);

const cloneDialogVisible = ref(false);
const cloneLoading = ref(false);
const cloneFormRef = ref<FormInstance>();
const cloneForm = ref({
  voice_tag: '',
  voice_model_id: 'cosyvoice-v3-plus',
  audio_file_path: '',
  clone_type: 'free' as 'free' | 'paid',
});

const supportedModels = ref<{ id: string; name: string }[]>([]);

const cloneRules: FormRules = {
  voice_tag: [
    { required: true, message: '请输入音色标识', trigger: 'blur' },
    { max: 8, message: '音色标识最多8个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9]+$/, message: '音色标识只能包含数字和字母', trigger: 'blur' }
  ],
  voice_model_id: [
    { required: true, message: '请选择语音模型', trigger: 'change' }
  ],
  audio_file_path: [
    { required: true, message: '请选择录音文件', trigger: 'change' }
  ]
};

// 加载支持的模型列表
const loadSupportedModels = async () => {
  try {
    const result = await window.electronAPI.bailianAudioGetSupportedModels();
    supportedModels.value = result.models || [];
  } catch (error) {
    console.error('加载模型列表失败:', error);
  }
};

// 加载音色克隆列表
const loadVoiceCloneList = async () => {
  voiceLoading.value = true;
  try {
    // 先自动过期（免费7天，付费30天）
    await window.electronAPI.expireUnusedVoices(7, 30);
    // 加载列表
    voiceCloneList.value = await window.electronAPI.getVoiceCloneList();
  } catch (error) {
    console.error('加载音色列表失败:', error);
    ElMessage.error('加载音色列表失败');
  } finally {
    voiceLoading.value = false;
  }
};

// 显示克隆对话框
const showCloneDialog = async () => {
  // 判断当前克隆是否需要付费（免费额度已用完）
  if (freeVoiceCloneCount.value >= 2) {
    // 免费额度已用完，需要确认付费克隆
    try {
      await ElMessageBox.confirm(
        '免费克隆额度已用完（2个），继续克隆将消耗 100 积分。付费音色超过 30 天未使用将失效，失效后再次克隆仍需消耗 100 积分。确认继续？',
        '付费克隆确认',
        {
          confirmButtonText: '确认克隆',
          cancelButtonText: '取消',
          type: 'warning',
        }
      );
      // 用户确认，先检查积分
      const apiToken = configForm.value.api_token;
      if (!apiToken) {
        ElMessage.warning('请先配置 API Token');
        return;
      }
      const pointsResult = await window.electronAPI.hasEnoughPoints(apiToken, 100);
      if (!pointsResult.sufficient) {
        ElMessage.error(`积分不足，当前剩余 ${pointsResult.remaining}，需要 100 积分`);
        return;
      }
      cloneForm.value.clone_type = 'paid';
    } catch {
      // 用户取消
      return;
    }
  } else {
    cloneForm.value.clone_type = 'free';
  }
  cloneDialogVisible.value = true;
};

// 实时过滤音色标识输入（只允许数字和字母）
const handleVoiceTagInput = (value: string) => {
  cloneForm.value.voice_tag = value.replace(/[^a-zA-Z0-9]/g, '');
};

// 选择录音文件（选择后自动校验格式和时长）
const selectAudioFile = async () => {
  const result = await window.electronAPI.openFile([
    { name: 'MP3 Files', extensions: ['mp3'] }
  ]);
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];

    // 使用 FFprobe 校验音频文件的实际格式和时长
    try {
      const audioResult = await window.electronAPI.getAudioInfo(filePath);
      if (!audioResult.success) {
        ElMessage.error('无法识别该音频文件: ' + (audioResult.error || '未知错误'));
        return;
      }

      const info = audioResult.data;
      const formatName: string = (info.formatName || '').toLowerCase();
      const codecName: string = (info.codecName || '').toLowerCase();

      // 校验实际格式是否为 MP3（通过 FFprobe 检测的 format_name 和 codec_name）
      if (!formatName.includes('mp3') && !codecName.includes('mp3')) {
        ElMessage.error('该文件实际格式不是 MP3，请选择真正的 MP3 文件');
        return;
      }

      // 校验音频时长（10-60 秒）
      const duration = info.duration || 0;
      if (duration < 10) {
        ElMessage.error(`音频时长过短（${duration.toFixed(1)} 秒），至少需要 10 秒`);
        return;
      }
      if (duration > 60) {
        ElMessage.error(`音频时长过长（${duration.toFixed(1)} 秒），最多支持 60 秒`);
        return;
      }

      // 校验通过
      cloneForm.value.audio_file_path = filePath;
    } catch (error: any) {
      ElMessage.error('音频文件校验失败: ' + (error.message || '未知错误'));
    }
  }
};

// 执行克隆
const handleCloneVoice = async () => {
  if (!cloneFormRef.value) return;

  await cloneFormRef.value.validate(async (valid) => {
    if (!valid) return;

    cloneLoading.value = true;
    try {
      // 1. 先上传音频到 OSS 获取公网 URL
      ElMessage.info('正在上传音频文件...');

      // 初始化 OSS
      await window.electronAPI.tokenConfigInitOSSWithSTS();

      // 上传音频
      const uploadResult = await window.electronAPI.ossUploadFile(cloneForm.value.audio_file_path);
      if (!uploadResult.success) {
        ElMessage.error(uploadResult.error || '音频上传失败');
        return;
      }

      // 使用带签名的临时访问 URL（私有 bucket 需要签名才能访问）
      const audioUrl = uploadResult.signedUrl;
      console.log('[音色克隆] 使用签名 URL:', audioUrl);
      ElMessage.info('正在克隆音色，请稍候...');

      // 2. 调用克隆接口
      const cloneResult = await window.electronAPI.bailianAudioCloneVoiceByUrl(audioUrl, {
        voiceName: cloneForm.value.voice_tag,
        targetModel: cloneForm.value.voice_model_id
      });

      if (!cloneResult.success) {
        ElMessage.error(cloneResult.error || '音色克隆失败');
        return;
      }

      // 3. 保存到数据库
      await window.electronAPI.addVoiceClone({
        voice_id: cloneResult.voiceId,
        voice_tag: cloneForm.value.voice_tag,
        voice_model_id: cloneForm.value.voice_model_id,
        audio_file_path: cloneForm.value.audio_file_path,
        clone_type: cloneForm.value.clone_type,
      });

      // 4. 如果是付费克隆，扣除积分
      if (cloneForm.value.clone_type === 'paid') {
        const apiToken = configForm.value.api_token;
        if (apiToken) {
          const deductResult = await window.electronAPI.deductPoints(apiToken, 100);
          if (!deductResult.success) {
            console.error('[音色克隆] 扣除积分失败:', deductResult.error);
          }
        }
      }

      ElMessage.success('音色克隆成功');
      cloneDialogVisible.value = false;
      loadVoiceCloneList();
    } catch (error: any) {
      console.error('克隆音色失败:', error);
      ElMessage.error(error.message || '克隆音色失败');
    } finally {
      cloneLoading.value = false;
    }
  });
};

// 使用音色
const handleUseVoice = async (row: any) => {
  try {
    await window.electronAPI.updateVoiceCloneUsedAt(row.id);
    ElMessage.success(`已选择音色: ${row.voice_tag}`);
    loadVoiceCloneList();
  } catch (error) {
    console.error('更新使用时间失败:', error);
  }
};

// 重新克隆
const handleReclone = async (row: any) => {
  // 判断是否需要付费：如果原音色是付费类型，或免费额度已用完
  const isPaid = (row.clone_type ?? 'free') === 'paid' || freeVoiceCloneCount.value >= 2;
  if (isPaid) {
    try {
      await ElMessageBox.confirm(
        '重新克隆将消耗 100 积分。付费音色超过 30 天未使用将失效，失效后再次克隆仍需消耗 100 积分。确认继续？',
        '付费克隆确认',
        {
          confirmButtonText: '确认克隆',
          cancelButtonText: '取消',
          type: 'warning',
        }
      );
      // 检查积分
      const apiToken = configForm.value.api_token;
      if (!apiToken) {
        ElMessage.warning('请先配置 API Token');
        return;
      }
      const pointsResult = await window.electronAPI.hasEnoughPoints(apiToken, 100);
      if (!pointsResult.sufficient) {
        ElMessage.error(`积分不足，当前剩余 ${pointsResult.remaining}，需要 100 积分`);
        return;
      }
      cloneForm.value.clone_type = 'paid';
    } catch {
      return;
    }
  } else {
    cloneForm.value.clone_type = 'free';
  }
  cloneForm.value = {
    ...cloneForm.value,
    voice_tag: row.voice_tag,
    voice_model_id: row.voice_model_id,
    audio_file_path: '',
  };
  cloneDialogVisible.value = true;
};

// 删除音色
const handleDeleteVoice = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除这个音色吗？', '提示', { type: 'warning' });
    await window.electronAPI.deleteVoiceClone([row.id]);
    ElMessage.success('删除成功');
    loadVoiceCloneList();
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
};

// 重置克隆表单
const resetCloneForm = () => {
  cloneForm.value = {
    voice_tag: '',
    voice_model_id: 'cosyvoice-v3-plus',
    audio_file_path: '',
    clone_type: 'free',
  };
  cloneFormRef.value?.resetFields();
};

// 获取模型名称
const getModelName = (modelId: string): string => {
  const model = supportedModels.value.find(m => m.id === modelId);
  return model?.name || modelId;
};

// 格式化日期
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// ==================== 测试用例同步相关 ====================

// 是否已下载测试数据（用于控制模块显示）
const hasDownloadedTestData = ref(false);
const syncLoading = ref(false);
const syncDialogVisible = ref(false);
const syncErrors = ref<string[]>([]);
const syncResult = ref<{
  video: { successCount: number; skipCount: number; failCount: number } | null;
  text: { successCount: number; skipCount: number; failCount: number } | null;
}>({
  video: null,
  text: null,
});

const syncProgress = ref<{
  total: number;
  completed: number;
  current: string;
  status: 'reading' | 'downloading'|'processing'|'saving'|'done';
  isDone: boolean;
  syncType?: 'video'|'text';
}>({
  total: 0,
  completed: 0,
  current: '',
  status: 'reading',
  isDone: true,
});

let unsubscribeProgress: (() => void)| null = null;

// 检查是否已下载测试数据
const checkDownloadedTestData = async () => {
  try{
    const result = await window.electronAPI.isInitConfigCompleted('download_test_data');
    hasDownloadedTestData.value = result.completed;
  } catch (error){
    console.error('检查初始化状态失败:', error);
    hasDownloadedTestData.value = false;
  }
};

// 显示同步对话框
const showSyncDialog = async () => {
  // 检查视频根路径
  if (!configForm.value.video_root_path) {
    ElMessage.warning('请先配置视频存放根路径');
    return;
  }

  try {
    syncLoading.value = true;
    syncDialogVisible.value = true;
    syncErrors.value = [];
    syncResult.value = { video: null, text: null };

    // 订阅进度事件
    unsubscribeProgress = window.electronAPI.onFeishuSyncProgress((progress: any) => {
      syncProgress.value = progress;
    });

    // 同步视频素材
    syncProgress.value = {
      total: 0,
      completed: 0,
      current: '',
      status: 'reading',
      isDone: false,
      syncType: 'video',
    };

    const videoResult = await window.electronAPI.feishuSyncVideos();
    syncResult.value.video = {
      successCount: videoResult.successCount,
      skipCount: videoResult.skipCount,
      failCount: videoResult.failCount,
    };
    if (videoResult.errors) {
      syncErrors.value.push(...videoResult.errors);
    }

    // 同步文案素材
    syncProgress.value = {
      total: 0,
      completed: 0,
      current: '',
      status: 'reading',
      isDone: false,
      syncType: 'text',
    };

    const textResult = await window.electronAPI.feishuSyncTexts();
    syncResult.value.text = {
      successCount: textResult.successCount,
      skipCount: textResult.skipCount,
      failCount: textResult.failCount,
    };
    if (textResult.errors) {
      syncErrors.value.push(...textResult.errors);
    }

    // 完成同步
    syncProgress.value.isDone = true;

    // 显示结果
    const totalCount = (syncResult.value.video?.successCount || 0) + (syncResult.value.text?.successCount || 0);
    const totalFailCount = (syncResult.value.video?.failCount || 0) + (syncResult.value.text?.failCount || 0);

    // 只有在视频和文案都下载成功（没有失败记录）的情况下，才更新初始化状态为已完成
    if (totalFailCount === 0 && syncErrors.value.length === 0) {
      // 更新初始化状态为已完成
      await window.electronAPI.updateInitConfigStatus('download_test_data', 5);
      hasDownloadedTestData.value = true;
      if (totalCount > 0) {
        ElMessage.success(`同步完成：成功 ${totalCount} 条记录`);
      } else {
        ElMessage.info('所有记录已是最新，无需同步');
      }
    } else {
      // 有失败记录，不更新初始化状态
      ElMessage.warning(`同步完成但有部分失败，请重试`);
    }

  } catch (error: any) {
    console.error('同步失败:', error);
    ElMessage.error(`同步失败: ${error.message || '未知错误'}`);
    syncProgress.value.isDone = true;
  } finally {
    syncLoading.value = false;
    if (unsubscribeProgress) {
      unsubscribeProgress();
      unsubscribeProgress = null;
    }
  }
};

// 取消同步
const handleCancelSync = () => {
  syncDialogVisible.value = false;
  if (unsubscribeProgress) {
    unsubscribeProgress();
    unsubscribeProgress = null;
  }
};

// 获取状态标签类型
const getStatusTagType = (status: string): '' | 'success' | 'warning' | 'info' | 'danger' => {
  const typeMap: Record<string, '' | 'success' | 'warning' | 'info' | 'danger'> = {
    reading: 'info',
    downloading: 'warning',
    processing: '',
    saving: '',
    done: 'success',
  };
  return typeMap[status] || 'info';
};

// 获取状态文本
const getStatusText = (status: string): string => {
  const textMap: Record<string, string> = {
    reading: '读取数据',
    downloading: '下载文件',
    processing: '处理中',
    saving: '保存数据',
    done: '已完成',
  };
  return textMap[status] || status;
};

// ==================== 基本配置相关 ====================

// 从全局状态加载配置到表单
const loadConfig = () => {
  configForm.value = {
    video_root_path: configStore.videoRootPath,
    jianying_draft_path: configStore.jianyingDraftPath,
    ffmpeg_path: configStore.ffmpegPath,
    python_path: configStore.pythonPath,
    api_token: configStore.apiToken,
    api_base_url: configStore.apiBaseUrl
  };
};

// 保存配置（同时更新数据库和全局状态）
const saveConfig = async () => {
  try {
    await configStore.setConfigs({
      video_root_path: configForm.value.video_root_path,
      jianying_draft_path: configForm.value.jianying_draft_path,
      ffmpeg_path: configForm.value.ffmpeg_path,
      python_path: configForm.value.python_path,
      api_token: configForm.value.api_token,
      api_base_url: configForm.value.api_base_url
    });

    // 同步更新 Token API 的基础地址
    if (configForm.value.api_base_url) {
      await window.electronAPI.setTokenBaseUrl(configForm.value.api_base_url);
    }

    ElMessage.success('保存成功');
  } catch (error) {
    console.error('保存配置失败:', error);
    ElMessage.error('保存配置失败');
  }
};

// 重置表单（从全局状态恢复）
const resetForm = () => {
  loadConfig();
};

// 选择视频存放根路径
const selectVideoRootPath = async () => {
  const result = await window.electronAPI.openDirectory();
  if (!result.canceled && result.filePaths.length > 0) {
    configForm.value.video_root_path = result.filePaths[0];
  }
};

// 选择剪映草稿路径
const selectJianyingDraftPath = async () => {
  const result = await window.electronAPI.openDirectory();
  if (!result.canceled && result.filePaths.length > 0) {
    configForm.value.jianying_draft_path = result.filePaths[0];
  }
};

// 选择FFmpeg路径
const selectFFmpegPath = async () => {
  const result = await window.electronAPI.openFile([
    { name: 'Executable', extensions: ['exe', 'sh', ''] }
  ]);
  if (!result.canceled && result.filePaths.length > 0) {
    configForm.value.ffmpeg_path = result.filePaths[0];
  }
};

// 选择Python路径
const selectPythonPath = async () => {
  const result = await window.electronAPI.openFile([
    { name: 'Python', extensions: ['exe', ''] }
  ]);
  if (!result.canceled && result.filePaths.length > 0) {
    configForm.value.python_path = result.filePaths[0];
  }
};

// 测试 API 连接
const testApiConnection = async () => {
  if (!configForm.value.api_token) {
    ElMessage.warning('请先输入 API Token');
    return;
  }

  try {
    // 临时设置 API 基础地址
    if (configForm.value.api_base_url) {
      await window.electronAPI.setTokenBaseUrl(configForm.value.api_base_url);
    }

    const result = await window.electronAPI.checkTokenValid(configForm.value.api_token);

    if (result.valid) {
      ElMessage.success(`连接成功！剩余积分: ${result.info?.unusedPoints || 0}`);
    } else {
      ElMessage.error(`连接失败: ${result.error || 'Token 无效'}`);
    }
  } catch (error: any) {
    console.error('测试连接失败:', error);
    ElMessage.error(`连接失败: ${error.message}`);
  }
};

// 初始化：从全局状态加载配置
onMounted(() => {
  loadConfig();
  loadSupportedModels();
  loadVoiceCloneList();
  checkDownloadedTestData();
});

// 清理
onUnmounted(() => {
  if (unsubscribeProgress) {
    unsubscribeProgress();
    unsubscribeProgress = null;
  }
});
</script>

<style scoped>
.page-container {
  height: 100%;
}

.path-input {
  display: flex;
  gap: 10px;
}

.path-input .el-input {
  flex: 1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.voice-clone-tips {
  margin-bottom: 16px;
}

.voice-clone-tips .el-alert p {
  margin: 4px 0;
  line-height: 1.5;
  text-align: left;
}

.audio-tips {
  margin-top: 8px;
}

.no-data {
  color: #999;
  font-size: 12px;
}

.sync-tips {
  margin-bottom: 16px;
}

.sync-tips .el-alert p {
  margin: 4px 0;
  line-height: 1.5;
  text-align: left;
}

.sync-progress-content {
  padding: 10px 0;
}

.sync-progress-info {
  margin-top: 16px;
  text-align: center;
}

.sync-progress-info p {
  margin: 8px 0;
}

.sync-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sync-current {
  color: #666;
  font-size: 12px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-errors ul {
  margin: 8px 0;
  padding-left: 20px;
}

.sync-errors li {
  margin: 4px 0;
  font-size: 12px;
  color: #666;
}
</style>
