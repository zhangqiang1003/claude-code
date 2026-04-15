<template>
  <div class="video-editor">
    <el-table :data="track.segments" border stripe style="width: 100%">
      <el-table-column type="index" label="序号" width="60" />

      <el-table-column label="视频路径" min-width="200">
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

      <el-table-column label="开始时间" width="120">
        <template #default="{ row }">
          <span>{{ formatTime(row.target_timerange?.start) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="时长" width="100">
        <template #default="{ row }">
          <span>{{ formatDuration(row.target_timerange?.duration) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="track.segments.length === 0" description="暂无视频素材" />
  </div>
</template>

<script setup lang="ts">
interface VideoSegment {
  material_url?: string;
  volume?: number;
  speed?: number;
  target_timerange?: { start: number; duration: number };
  source_timerange?: { start: number; duration: number };
  [key: string]: any;
}

interface VideoTrackData {
  track_name?: string;
  mute?: boolean;
  segments: VideoSegment[];
}

// v-model: 接收一个 VideoTrack
const track = defineModel<VideoTrackData>({ required: true });

// 获取短路径
const getShortPath = (path: string): string => {
  if (!path) return '-';
  const fileName = path.split('/').pop() || path.split('\\').pop() || path;
  if (fileName.length > 30) {
    return '...' + fileName.slice(-27);
  }
  return fileName;
};

// 格式化时间（微秒转换为 时:分:秒.毫秒）
const formatTime = (microseconds: number | undefined): string => {
  if (microseconds === undefined || microseconds === null) return '-';
  const totalMs = Math.floor(microseconds / 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
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
  console.log(`[VideoEditor] 视频 #${index + 1} 音量变更为: ${value}`);
};

// 处理速度变化
const handleSpeedChange = (index: number, value: number) => {
  console.log(`[VideoEditor] 视频 #${index + 1} 速度变更为: ${value}`);
};
</script>

<style scoped>
.video-editor {
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
