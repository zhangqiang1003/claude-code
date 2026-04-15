<template>
  <div class="audio-editor">
    <el-table :data="track.segments" border stripe style="width: 100%">
      <el-table-column type="index" label="序号" width="60" />

      <el-table-column label="音频路径" min-width="200">
        <template #default="{ row }">
          <el-tooltip :content="row.material_url" placement="top" :show-after="500">
            <div class="path-cell">{{ getShortPath(row.material_url) }}</div>
          </el-tooltip>
        </template>
      </el-table-column>

      <el-table-column label="音量" width="180">
        <template #default="{ row, $index }">
          <div class="slider-cell">
            <el-slider
              v-model="row.volume"
              :min="0"
              :max="2"
              :step="0.1"
              :format-tooltip="(val: number) => `${(val * 100).toFixed(0)}%`"
              @change="handleVolumeChange($index, row.volume)"
            />
            <span class="slider-value">{{ ((row.volume ?? 1) * 100).toFixed(0) }}%</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="速度" width="120">
        <template #default="{ row, $index }">
          <el-input-number
            v-model="row.speed"
            :min="0.5"
            :max="2"
            :step="0.1"
            :precision="1"
            size="small"
            @change="handleSpeedChange($index, row.speed)"
          />
        </template>
      </el-table-column>

      <el-table-column label="开始时间" width="100">
        <template #default="{ row }">
          <span>{{ formatTime(row.target_timerange?.start) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="时长" width="80">
        <template #default="{ row }">
          <span>{{ formatDuration(row.target_timerange?.duration) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="淡入" width="100">
        <template #default="{ row, $index }">
          <el-input-number
            :model-value="row.fade?.in_duration"
            :min="0"
            :max="5000000"
            :step="100000"
            size="small"
            @change="(val: number | undefined) => setNestedField(row, 'fade', 'in_duration', val)"
          />
        </template>
      </el-table-column>

      <el-table-column label="淡出" width="100">
        <template #default="{ row, $index }">
          <el-input-number
            :model-value="row.fade?.out_duration"
            :min="0"
            :max="5000000"
            :step="100000"
            size="small"
            @change="(val: number | undefined) => setNestedField(row, 'fade', 'out_duration', val)"
          />
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="track.segments.length === 0" description="暂无音频素材" />
  </div>
</template>

<script setup lang="ts">
interface AudioFade {
  in_duration?: number;
  out_duration?: number;
  [key: string]: any;
}

interface AudioSegment {
  material_url?: string;
  volume?: number;
  speed?: number;
  fade?: AudioFade;
  target_timerange?: { start: number; duration: number };
  source_timerange?: { start: number; duration: number };
  [key: string]: any;
}

interface AudioTrackData {
  track_name?: string;
  mute?: boolean;
  segments: AudioSegment[];
}

// v-model: 接收一个 AudioTrack
const track = defineModel<AudioTrackData>({ required: true });

/**
 * 安全设置嵌套字段
 */
const setNestedField = (row: any, parentKey: string, childKey: string, value: any) => {
  if (!row[parentKey]) row[parentKey] = {};
  row[parentKey][childKey] = value;
};

// 获取短路径
const getShortPath = (path: string): string => {
  if (!path) return '-';
  const fileName = path.split('/').pop() || path.split('\\').pop() || path;
  if (fileName.length > 30) {
    return '...' + fileName.slice(-27);
  }
  return fileName;
};

// 格式化时间（微秒转换为 分:秒.毫秒）
const formatTime = (microseconds: number | undefined): string => {
  if (microseconds === undefined || microseconds === null) return '-';
  const totalMs = Math.floor(microseconds / 1000);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

// 格式化时长（微秒转换为 秒.毫秒）
const formatDuration = (microseconds: number | undefined): string => {
  if (microseconds === undefined || microseconds === null) return '-';
  const totalMs = Math.floor(microseconds / 1000);
  const seconds = Math.floor(totalMs / 1000);
  const ms = totalMs % 1000;
  return `${seconds}.${String(ms).padStart(3, '0')}s`;
};

// 处理音量变化
const handleVolumeChange = (index: number, value: number) => {
  console.log(`[AudioEditor] 音频 #${index + 1} 音量变更为: ${value}`);
};

// 处理速度变化
const handleSpeedChange = (index: number, value: number) => {
  console.log(`[AudioEditor] 音频 #${index + 1} 速度变更为: ${value}`);
};
</script>

<style scoped>
.audio-editor {
  width: 100%;
}

.path-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #606266;
}

.slider-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-cell :deep(.el-slider) {
  flex: 1;
}

.slider-value {
  min-width: 40px;
  font-size: 12px;
  color: #909399;
}
</style>
