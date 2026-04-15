<template>
  <el-dialog
    v-model="visible"
    title="素材审核与编辑"
    fullscreen
    :close-on-click-modal="false"
    :show-close="false"
    class="draft-review-dialog"
  >
    <div class="review-container">
      <!-- 左侧素材统计 -->
      <div class="material-summary">
        <el-card shadow="hover">
          <template #header>
            <span>素材统计</span>
          </template>
          <div class="summary-list">
            <div class="summary-item">
              <el-icon><VideoCamera /></el-icon>
              <span>视频: {{ videoSegmentCount }} 段 / {{ localVideoTracks.length }} 轨</span>
            </div>
            <div class="summary-item">
              <el-icon><Microphone /></el-icon>
              <span>音频: {{ audioSegmentCount }} 段 / {{ localAudioTracks.length }} 轨</span>
            </div>
            <div class="summary-item">
              <el-icon><Document /></el-icon>
              <span>字幕: {{ textSegmentCount }} 段 / {{ localTextTracks.length }} 轨</span>
            </div>
            <div class="summary-item">
              <el-icon><Headset /></el-icon>
              <span>背景音乐: {{ localBgMusicConfig.length }} 个</span>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 右侧编辑区域 -->
      <div class="material-editor">
        <el-tabs v-model="activeTab" type="border-card">
          <el-tab-pane label="字幕编辑" name="subtitle">
            <div class="track-manager">
              <div class="track-toolbar">
                <el-select v-model="selectedSubtitleTrack" placeholder="选择轨道" style="width: 200px">
                  <el-option
                    v-for="(_, index) in localTextTracks"
                    :key="index"
                    :label="localTextTracks[index]?.track_name || `字幕轨道 ${index + 1}`"
                    :value="index"
                  />
                </el-select>
                <el-button type="primary" size="small" @click="addTextTrack">
                  <el-icon><Plus /></el-icon> 添加轨道
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  :disabled="localTextTracks.length <= 1"
                  @click="removeTextTrack"
                >
                  <el-icon><Delete /></el-icon> 删除轨道
                </el-button>
                <el-input
                  v-if="localTextTracks[selectedSubtitleTrack]"
                  v-model="localTextTracks[selectedSubtitleTrack].track_name"
                  placeholder="轨道名称"
                  style="width: 160px; margin-left: 8px"
                  size="small"
                />
              </div>
              <SubtitleEditor v-if="localTextTracks[selectedSubtitleTrack]" v-model="localTextTracks[selectedSubtitleTrack]" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="视频编辑" name="video">
            <div class="track-manager">
              <div class="track-toolbar">
                <el-select v-model="selectedVideoTrack" placeholder="选择轨道" style="width: 200px">
                  <el-option
                    v-for="(_, index) in localVideoTracks"
                    :key="index"
                    :label="localVideoTracks[index]?.track_name || `视频轨道 ${index + 1}`"
                    :value="index"
                  />
                </el-select>
                <el-button type="primary" size="small" @click="addVideoTrack">
                  <el-icon><Plus /></el-icon> 添加轨道
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  :disabled="localVideoTracks.length <= 1"
                  @click="removeVideoTrack"
                >
                  <el-icon><Delete /></el-icon> 删除轨道
                </el-button>
                <el-input
                  v-if="localVideoTracks[selectedVideoTrack]"
                  v-model="localVideoTracks[selectedVideoTrack].track_name"
                  placeholder="轨道名称"
                  style="width: 160px; margin-left: 8px"
                  size="small"
                />
                <el-checkbox
                  v-if="localVideoTracks[selectedVideoTrack]"
                  v-model="localVideoTracks[selectedVideoTrack].mute"
                  style="margin-left: 12px"
                >静音</el-checkbox>
              </div>
              <VideoEditor v-if="localVideoTracks[selectedVideoTrack]" v-model="localVideoTracks[selectedVideoTrack]" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="音频编辑" name="audio">
            <div class="track-manager">
              <div class="track-toolbar">
                <el-select v-model="selectedAudioTrack" placeholder="选择轨道" style="width: 200px">
                  <el-option
                    v-for="(_, index) in localAudioTracks"
                    :key="index"
                    :label="localAudioTracks[index]?.track_name || `音频轨道 ${index + 1}`"
                    :value="index"
                  />
                </el-select>
                <el-button type="primary" size="small" @click="addAudioTrack">
                  <el-icon><Plus /></el-icon> 添加轨道
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  :disabled="localAudioTracks.length <= 1"
                  @click="removeAudioTrack"
                >
                  <el-icon><Delete /></el-icon> 删除轨道
                </el-button>
                <el-input
                  v-if="localAudioTracks[selectedAudioTrack]"
                  v-model="localAudioTracks[selectedAudioTrack].track_name"
                  placeholder="轨道名称"
                  style="width: 160px; margin-left: 8px"
                  size="small"
                />
                <el-checkbox
                  v-if="localAudioTracks[selectedAudioTrack]"
                  v-model="localAudioTracks[selectedAudioTrack].mute"
                  style="margin-left: 12px"
                >静音</el-checkbox>
              </div>
              <AudioEditor v-if="localAudioTracks[selectedAudioTrack]" v-model="localAudioTracks[selectedAudioTrack]" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="背景音乐" name="bgm">
            <BgmEditor v-model="localBgMusicConfig" />
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleSkip" :disabled="submitting">
          跳过编辑
        </el-button>
        <el-button @click="handleCancel" :disabled="submitting">
          取消任务
        </el-button>
        <el-button type="primary" @click="handleConfirm" :loading="submitting">
          确认并继续
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { VideoCamera, Microphone, Document, Headset, Plus, Delete } from '@element-plus/icons-vue';
import VideoEditor from './components/VideoEditor.vue';
import SubtitleEditor from './components/SubtitleEditor.vue';
import AudioEditor from './components/AudioEditor.vue';
import BgmEditor from './components/BgmEditor.vue';

// 轨道数据类型
interface TrackData {
  track_name?: string;
  mute?: boolean;
  segments: any[];
}

// Props
const props = defineProps<{
  modelValue: boolean;
  videoTracks: TrackData[];
  audioTracks: TrackData[];
  textTracks: TrackData[];
  bgMusicConfig: any[];
}>();

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm', data: any): void;
  (e: 'skip'): void;
  (e: 'cancel'): void;
}>();

// 本地编辑数据（轨道化）
const localVideoTracks = ref<TrackData[]>([]);
const localAudioTracks = ref<TrackData[]>([]);
const localTextTracks = ref<TrackData[]>([]);
const localBgMusicConfig = ref<any[]>([]);

// 当前选中的轨道索引
const selectedVideoTrack = ref(0);
const selectedAudioTrack = ref(0);
const selectedSubtitleTrack = ref(0);

// 当前激活的标签页
const activeTab = ref('subtitle');

// 提交状态
const submitting = ref(false);

// 双向绑定 visible
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

// 素材统计
const videoSegmentCount = computed(() => localVideoTracks.value.reduce((sum, t) => sum + t.segments.length, 0));
const audioSegmentCount = computed(() => localAudioTracks.value.reduce((sum, t) => sum + t.segments.length, 0));
const textSegmentCount = computed(() => localTextTracks.value.reduce((sum, t) => sum + t.segments.length, 0));

// 监听 props 变化，初始化本地数据
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      localVideoTracks.value = JSON.parse(JSON.stringify(props.videoTracks || []));
      localAudioTracks.value = JSON.parse(JSON.stringify(props.audioTracks || []));
      localTextTracks.value = JSON.parse(JSON.stringify(props.textTracks || []));
      localBgMusicConfig.value = JSON.parse(JSON.stringify(props.bgMusicConfig || []));
      selectedVideoTrack.value = 0;
      selectedAudioTrack.value = 0;
      selectedSubtitleTrack.value = 0;
      activeTab.value = 'subtitle';
    }
  }
);

// 轨道管理方法
const addVideoTrack = () => {
  const index = localVideoTracks.value.length + 1;
  localVideoTracks.value.push({ track_name: `视频轨道 ${index}`, mute: false, segments: [] });
  selectedVideoTrack.value = localVideoTracks.value.length - 1;
};
const removeVideoTrack = () => {
  localVideoTracks.value.splice(selectedVideoTrack.value, 1);
  if (selectedVideoTrack.value >= localVideoTracks.value.length) {
    selectedVideoTrack.value = Math.max(0, localVideoTracks.value.length - 1);
  }
};
const addAudioTrack = () => {
  const index = localAudioTracks.value.length + 1;
  localAudioTracks.value.push({ track_name: `音频轨道 ${index}`, mute: false, segments: [] });
  selectedAudioTrack.value = localAudioTracks.value.length - 1;
};
const removeAudioTrack = () => {
  localAudioTracks.value.splice(selectedAudioTrack.value, 1);
  if (selectedAudioTrack.value >= localAudioTracks.value.length) {
    selectedAudioTrack.value = Math.max(0, localAudioTracks.value.length - 1);
  }
};
const addTextTrack = () => {
  const index = localTextTracks.value.length + 1;
  localTextTracks.value.push({ track_name: `字幕轨道 ${index}`, segments: [] });
  selectedSubtitleTrack.value = localTextTracks.value.length - 1;
};
const removeTextTrack = () => {
  localTextTracks.value.splice(selectedSubtitleTrack.value, 1);
  if (selectedSubtitleTrack.value >= localTextTracks.value.length) {
    selectedSubtitleTrack.value = Math.max(0, localTextTracks.value.length - 1);
  }
};

// 跳过编辑
const handleSkip = () => {
  emit('skip');
  visible.value = false;
};

// 取消任务
const handleCancel = () => {
  emit('cancel');
  visible.value = false;
};

// 确认编辑
const handleConfirm = () => {
  const cleanData = JSON.parse(JSON.stringify({
    videoTracks: localVideoTracks.value,
    audioTracks: localAudioTracks.value,
    textTracks: localTextTracks.value,
    bgMusicConfig: localBgMusicConfig.value,
  }));

  console.log('[DraftReviewDialog] confirm data:', cleanData);

  emit('confirm', cleanData);
  visible.value = false;
};
</script>

<style scoped>
.draft-review-dialog :deep(.el-dialog__body) {
  padding: 0;
  height: calc(100vh - 120px);
  overflow: hidden;
}

.review-container {
  display: flex;
  height: 100%;
  gap: 16px;
  padding: 16px;
}

.material-summary {
  width: 240px;
  flex-shrink: 0;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 14px;
  color: #606266;
}

.summary-item .el-icon {
  font-size: 18px;
  color: #409eff;
}

.material-editor {
  flex: 1;
  overflow: hidden;
}

.material-editor :deep(.el-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.material-editor :deep(.el-tabs__content) {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.material-editor :deep(.el-tab-pane) {
  height: 100%;
}

.track-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.track-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
