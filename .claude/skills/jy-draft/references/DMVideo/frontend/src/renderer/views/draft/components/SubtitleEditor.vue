<template>
  <div class="subtitle-editor">
    <el-table :data="track.segments" border stripe style="width: 100%">
      <el-table-column type="index" label="序号" width="60" />

      <el-table-column label="文本内容" min-width="250">
        <template #default="{ row, $index }">
          <el-input
            v-model="row.content"
            type="textarea"
            :rows="2"
            placeholder="请输入字幕内容"
            @change="handleTextChange($index, row.content)"
          />
        </template>
      </el-table-column>

      <el-table-column label="字体大小" width="120">
        <template #default="{ row, $index }">
          <el-input-number
            :model-value="row.style?.size"
            :min="12"
            :max="120"
            :step="1"
            size="small"
            @change="(val: number | undefined) => { setNestedField(row, 'style', 'size', val); handleStyleChange($index, 'style.size', val); }"
          />
        </template>
      </el-table-column>

      <el-table-column label="字体颜色" width="100">
        <template #default="{ row, $index }">
          <el-color-picker
            :model-value="normalizeColor(row.style?.color)"
            show-alpha
            size="small"
            @change="(val: string | null) => { handleColorChange(row, val); handleStyleChange($index, 'style.color', val); }"
          />
        </template>
      </el-table-column>

      <el-table-column label="垂直位置" width="180">
        <template #default="{ row, $index }">
          <div class="slider-cell">
            <el-slider
              :model-value="row.clip_settings?.transform_y ?? 0.8"
              :min="0"
              :max="1"
              :step="0.05"
              :format-tooltip="formatTransformY"
              @change="(val: number | undefined) => { setNestedField(row, 'clip_settings', 'transform_y', val); handleStyleChange($index, 'clip_settings.transform_y', val); }"
            />
            <span class="slider-value">{{ getPositionLabel(row.clip_settings?.transform_y) }}</span>
          </div>
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
    </el-table>

    <el-empty v-if="track.segments.length === 0" description="暂无字幕素材" />
  </div>
</template>

<script setup lang="ts">
interface TextStyle {
  size?: number;
  color?: number[];
  [key: string]: any;
}

interface ClipSettings {
  transform_y?: number;
  [key: string]: any;
}

interface TextSegment {
  content?: string;
  style?: TextStyle;
  clip_settings?: ClipSettings;
  target_timerange?: { start: number; duration: number };
  source_timerange?: { start: number; duration: number };
  [key: string]: any;
}

interface TextTrackData {
  track_name?: string;
  segments: TextSegment[];
}

// v-model: 接收一个 TextTrack
const track = defineModel<TextTrackData>({ required: true });

/**
 * 安全设置嵌套字段
 * 确保 row.style / row.clip_settings 对象存在后再赋值
 */
const setNestedField = (row: any, parentKey: string, childKey: string, value: any) => {
  if (!row[parentKey]) row[parentKey] = {};
  row[parentKey][childKey] = value;
};

/**
 * 将 style.color 数组 [r, g, b, a] (0-1 或 0-255) 转为 hex 字符串供 el-color-picker
 */
const normalizeColor = (color: number[] | undefined): string | undefined => {
  if (!color || !Array.isArray(color)) return undefined;
  const [r, g, b, a] = color;
  // 判断是 0-1 范围还是 0-255
  const toHex = (v: number) => {
    const v255 = v <= 1 ? Math.round(v * 255) : Math.round(v);
    return v255.toString(16).padStart(2, '0');
  };
  const alpha = a !== undefined ? (a <= 1 ? Math.round(a * 255) : Math.round(a)) : 255;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${alpha.toString(16).padStart(2, '0')}`;
};

/**
 * 处理颜色变更：将 hex 字符串转为数组并存入 row.style.color
 */
const handleColorChange = (row: any, hexVal: string | null) => {
  if (!hexVal) return;
  // 解析 #RRGGBBAA
  const r = parseInt(hexVal.slice(1, 3), 16) / 255;
  const g = parseInt(hexVal.slice(3, 5), 16) / 255;
  const b = parseInt(hexVal.slice(5, 7), 16) / 255;
  const a = hexVal.length >= 9 ? parseInt(hexVal.slice(7, 9), 16) / 255 : 1.0;
  setNestedField(row, 'style', 'color', [r, g, b, a]);
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

// 格式化垂直位置滑块提示
const formatTransformY = (val: number): string => {
  return `${(val * 100).toFixed(0)}%`;
};

// 获取位置标签
const getPositionLabel = (val: number | undefined): string => {
  if (val === undefined || val === null) return '-';
  const percent = (val * 100).toFixed(0);
  if (val < 0.3) return `顶部 ${percent}%`;
  if (val < 0.7) return `中部 ${percent}%`;
  return `底部 ${percent}%`;
};

// 处理文本变化
const handleTextChange = (index: number, value: string) => {
  console.log(`[SubtitleEditor] 字幕 #${index + 1} 内容变更为: ${value}`);
};

// 处理样式变化
const handleStyleChange = (index: number, field: string, value: any) => {
  console.log(`[SubtitleEditor] 字幕 #${index + 1} ${field} 变更为: ${value}`);
};
</script>

<style scoped>
.subtitle-editor {
  width: 100%;
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
  min-width: 60px;
  font-size: 12px;
  color: #909399;
}

:deep(.el-textarea__inner) {
  font-size: 13px;
}
</style>
