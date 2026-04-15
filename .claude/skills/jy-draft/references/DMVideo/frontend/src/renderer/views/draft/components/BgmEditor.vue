<template>
  <div class="bgm-editor">
    <div class="bgm-actions">
      <el-button type="primary" @click="addBgm">
        <el-icon><Plus /></el-icon>
        添加背景音乐
      </el-button>
    </div>

    <div v-if="bgMusicConfig.length > 0" class="bgm-list">
      <el-card
        v-for="(music, index) in bgMusicConfig"
        :key="index"
        class="bgm-card"
        shadow="hover"
      >
        <template #header>
          <div class="bgm-card-header">
            <span>背景音乐 #{{ index + 1 }}</span>
            <el-button type="danger" size="small" text @click="removeBgm(index)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </div>
        </template>

        <el-form label-width="100px" size="small">
          <el-form-item label="音频文件">
            <div class="audio-url-input">
              <el-input
                v-model="music.bg_audio_url"
                placeholder="请输入音频文件路径"
                style="flex: 1"
              />
              <el-button @click="selectBgMusicFile(index)" style="margin-left: 8px">
                <el-icon><FolderOpened /></el-icon>
                选择文件
              </el-button>
            </div>
          </el-form-item>

          <el-form-item label="音量">
            <el-slider
              v-model="music.volume"
              :min="0"
              :max="100"
              :format-tooltip="(val: number) => `${val}%`"
              style="width: 300px"
            />
            <span class="volume-value">{{ music.volume }}%</span>
          </el-form-item>

          <el-divider content-position="left">时间配置</el-divider>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="起始时间">
                <el-input-number
                  v-model="music.target_start_time"
                  :min="0"
                  :step="100"
                  placeholder="毫秒"
                  style="width: 100%"
                />
                <div class="field-hint">在时间线上的起始位置（毫秒）</div>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="截取起点">
                <el-input-number
                  v-model="music.source_start_time"
                  :min="0"
                  :step="100"
                  placeholder="毫秒"
                  style="width: 100%"
                />
                <div class="field-hint">音频文件截取起始点（毫秒）</div>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="截取终点">
                <el-input-number
                  v-model="music.source_end_time"
                  :min="0"
                  :step="100"
                  placeholder="毫秒"
                  style="width: 100%"
                />
                <div class="field-hint">音频文件截取结束点（毫秒）</div>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="播放时长">
                <div class="duration-display">
                  {{ calculateDuration(music) }} 毫秒
                </div>
                <div class="field-hint">截取终点 - 截取起点</div>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-card>
    </div>

    <el-empty v-else description="暂无背景音乐，点击上方按钮添加" />
  </div>
</template>

<script setup lang="ts">
import { Plus, Delete, FolderOpened } from '@element-plus/icons-vue';

// v-model
const bgMusicConfig = defineModel<any[]>({ required: true });

// 添加背景音乐
const addBgm = () => {
  bgMusicConfig.value.push({
    bg_audio_url: '',
    volume: 50,
    target_start_time: 0,
    source_start_time: 0,
    source_end_time: 0,
  });
};

// 移除背景音乐
const removeBgm = (index: number) => {
  bgMusicConfig.value.splice(index, 1);
};

// 选择背景音乐文件
const selectBgMusicFile = async (index: number) => {
  try {
    const result = await window.electronAPI.openFile([
      { name: '音频文件', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] }
    ]);
    if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
      bgMusicConfig.value[index].bg_audio_url = result.filePaths[0];
    }
  } catch (error) {
    console.error('选择文件失败:', error);
  }
};

// 计算播放时长
const calculateDuration = (music: { source_start_time: number; source_end_time: number }) => {
  const duration = music.source_end_time - music.source_start_time;
  return duration > 0 ? duration : 0;
};
</script>

<style scoped>
.bgm-editor {
  width: 100%;
}

.bgm-actions {
  margin-bottom: 16px;
}

.bgm-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bgm-card {
  border: 1px solid #e4e7ed;
}

.bgm-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
  color: #303133;
}

.audio-url-input {
  display: flex;
  align-items: center;
}

.volume-value {
  margin-left: 12px;
  font-size: 14px;
  color: #606266;
  min-width: 40px;
}

.field-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.duration-display {
  font-size: 16px;
  font-weight: 500;
  color: #409eff;
  padding: 8px 0;
}
</style>
