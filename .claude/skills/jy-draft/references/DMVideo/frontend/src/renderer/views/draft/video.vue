<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>素材库 - 视频</span>
          <div class="header-actions">
            <el-button type="primary" @click="handleAddVideos">
              <el-icon><Plus /></el-icon>
              添加视频
            </el-button>
            <el-button
              type="success"
              :disabled="selectedIds.length === 0"
              @click="handleBatchAnalyze"
            >
              批量分析
            </el-button>
            <el-button
              type="warning"
              :disabled="selectedIds.length === 0"
              @click="handleBatchKeywordEdit"
            >
              编辑关键词
            </el-button>
            <el-button
              type="info"
              :disabled="selectedIds.length === 0"
              @click="handleBatchLocationEdit"
            >
              编辑地点
            </el-button>
            <el-button
              type="danger"
              :disabled="selectedIds.length === 0"
              @click="handleBatchDelete"
            >
              批量删除
            </el-button>
          </div>
        </div>
      </template>

      <!-- 表格 -->
      <el-table
        :data="videoList"
        style="width: 100%"
        @selection-change="handleSelectionChange"
        v-loading="loading"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="文件名" min-width="180">
          <template #default="{ row }">
            <el-tooltip
              :content="row.file_name"
              placement="top"
              :show-after="500"
            >
              <span class="file-name-cell">{{ row.file_name }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="分析状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="getAnalysisStatusType(row.analysis_status)"
              size="small"
            >
              {{ getAnalysisStatusLabel(row.analysis_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="keywords" label="关键词" min-width="180">
          <template #default="{ row }">
            <div v-if="row.keywords">
              <el-tag
                v-for="(keyword, index) in row.keywords
                  .split(',')
                  .map((k: string) => k.trim())
                  .filter((k: string) => k)"
                :key="index"
                size="small"
                style="margin-right: 5px"
              >
                {{ keyword }}
              </el-tag>
            </div>
            <span v-else class="no-data">未分析</span>
          </template>
        </el-table-column>
        <el-table-column prop="use_count" label="使用次数" width="100">
          <template #default="{ row }">
            <el-tag :type="row.use_count >= 5 ? 'danger' : 'success'">
              {{ row.use_count }}/5
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag
              :type="
                (row.status ?? 'active') === 'active' ? 'success' : 'danger'
              "
            >
              {{ (row.status ?? "active") === "active" ? "可用" : "已超限" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时长" width="90">
          <template #default="{ row }">
            <span v-if="row.duration">{{ formatDuration(row.duration) }}</span>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>
        <el-table-column label="省份" width="100">
          <template #default="{ row }">
            <span v-if="row.province_ids">
              <el-tag
                  v-for="(name, index) in getProvinceNames(row.province_ids)"
                  :key="index"
                  size="small"
                  style="margin-right: 4px"
              >
                {{ name }}
              </el-tag>
            </span>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>
        <el-table-column label="城市" width="100">
          <template #default="{ row }">
            <span v-if="row.city_ids">
              <el-tag
                  v-for="(name, index) in getCityNames(row.city_ids)"
                  :key="index"
                  size="small"
                  type="success"
                  style="margin-right: 4px"
              >
                {{ name }}
              </el-tag>
            </span>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>
        <el-table-column label="地点" width="120">
          <template #default="{ row }">
            <span v-if="row.place_names">
              <el-tag
                  v-for="(name, index) in row.place_names.split(',').filter((k: string) => k)"
                  :key="index"
                  size="small"
                  type="warning"
                  style="margin-right: 4px"
              >
                {{ name }}
              </el-tag>
            </span>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-dropdown
              trigger="click"
              @command="(cmd: string) => handleCommand(cmd, row)"
            >
              <el-button type="primary" size="small">
                操作菜单<el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="location">
                    <el-icon><Location /></el-icon>编辑地点
                  </el-dropdown-item>
                  <el-dropdown-item command="keyword">
                    <el-icon><Key /></el-icon>编辑关键词
                  </el-dropdown-item>
                  <el-dropdown-item command="analyze" divided :disabled="row.analysis_status === 1">
                    <el-icon><DataAnalysis /></el-icon>分析视频
                  </el-dropdown-item>
                  <el-dropdown-item command="preview" divided>
                    <el-icon><VideoPlay /></el-icon>预览视频
                  </el-dropdown-item>
                  <el-dropdown-item command="openFolder">
                    <el-icon><FolderOpened /></el-icon>查看文件
                  </el-dropdown-item>
                  <el-dropdown-item command="rename">
                    <el-icon><EditPen /></el-icon>编辑文件名
                  </el-dropdown-item>
<!--                  <el-dropdown-item command="extractText" divided>-->
<!--                    <el-icon><Document /></el-icon>提取文案-->
<!--                  </el-dropdown-item>-->
<!--                  <el-dropdown-item command="extractAudio">-->
<!--                    <el-icon><Headset /></el-icon>提取音频-->
<!--                  </el-dropdown-item>-->
<!--                  <el-dropdown-item command="split" divided>-->
<!--                    <el-icon><Operation /></el-icon>视频分割-->
<!--                  </el-dropdown-item>-->
<!--                  <el-dropdown-item command="cut">-->
<!--                    <el-icon><Crop /></el-icon>精准截取-->
<!--                  </el-dropdown-item>-->
<!--                  <el-dropdown-item command="mute">-->
<!--                    <el-icon><Mute /></el-icon>静音处理-->
<!--                  </el-dropdown-item>-->
                  <el-dropdown-item command="delete" divided :disabled="row.analysis_status === 1">
                    <el-icon><Delete /></el-icon>删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadData"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <!-- 关键词编辑对话框 -->
    <el-dialog
      v-model="keywordDialogVisible"
      :title="currentVideo?.keywords ? '编辑关键词' : '添加关键词'"
      width="500px"
      @closed="resetKeywordForm"
    >
      <el-form :model="keywordForm" label-width="80px">
        <el-form-item label="关键词">
          <div class="keyword-tags">
            <el-tag
              v-for="(keyword, index) in keywordForm.keywords"
              :key="index"
              closable
              size="large"
              style="margin-right: 8px; margin-bottom: 8px"
              @close="handleRemoveKeyword(index)"
            >
              {{ keyword }}
            </el-tag>
          </div>
          <el-input
            v-model="keywordInput"
            placeholder="输入关键词后按回车添加（最多6个字）"
            maxlength="6"
            show-word-limit
            @keyup.enter.stop.capture="handleAddKeyword"
            style="margin-top: 8px"
          >
            <template #append>
              <el-button @click.enter.stop="handleAddKeyword" :disabled="!keywordInput.trim()">
                添加
              </el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="keywordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveKeywords">保存</el-button>
      </template>
    </el-dialog>

    <!-- 地点编辑对话框 -->
    <el-dialog
      v-model="locationDialogVisible"
      :title="batchLocationMode ? `批量编辑地点信息（${batchLocationIds.length} 个视频）` : '编辑地点信息'"
      width="600px"
      @closed="resetLocationForm"
    >
      <el-form :model="locationForm" label-width="80px">
        <el-form-item label="省份">
          <el-select
            v-model="locationForm.selectedProvinces"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择省份（可选，多选）"
            style="width: 100%"
            @change="handleLocationProvinceChange"
          >
            <el-option
              v-for="item in provinceOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="城市">
          <el-select
            v-model="locationForm.selectedCities"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择城市（可选，多选）"
            style="width: 100%"
            :disabled="locationForm.selectedProvinces.length === 0"
          >
            <el-option
              v-for="item in locationCityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="地点">
          <div class="place-tags">
            <el-tag
              v-for="(place, index) in locationForm.placeNames"
              :key="index"
              closable
              size="large"
              style="margin-right: 8px; margin-bottom: 8px"
              @close="handleRemovePlace(index)"
            >
              {{ place }}
            </el-tag>
          </div>
          <el-input
            v-model="placeInput"
            placeholder="输入地点后按回车添加（如：故宫、长城）"
            @keyup.enter.stop="handleAddPlace"
            style="margin-top: 8px"
          >
            <template #append>
              <el-button @click="handleAddPlace" :disabled="!placeInput.trim()">
                添加
              </el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="locationDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveLocation">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量分析进度对话框 -->
    <el-dialog
      v-model="progressDialogVisible"
      title="批量分析进度"
      width="500px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <div class="progress-content">
        <!-- 分析中 -->
        <template v-if="batchPhase === 'analyzing'">
          <el-progress
            :percentage="concurrentProgressPercentage"
            :stroke-width="20"
            :text-inside="true"
          />
          <div class="progress-info">
            <p>AI 正在分析视频内容，每完成一个即更新...</p>
            <p>
              已完成: {{ progressInfo.successCount + progressInfo.failCount }} / {{ progressInfo.total }}
            </p>
            <p>
              <span style="color: #67c23a">成功: {{ progressInfo.successCount }}</span>
              <span style="margin-left: 20px; color: #f56c6c">失败: {{ progressInfo.failCount }}</span>
            </p>
          </div>
        </template>

        <!-- 完成 -->
        <template v-else-if="batchPhase === 'done'">
          <el-progress
            :percentage="100"
            :status="batchResultStatus"
            :stroke-width="20"
            :text-inside="true"
          />
          <div class="progress-info">
            <p>
              <span style="color: #67c23a">成功: {{ progressInfo.successCount }}</span>
              <span style="margin-left: 20px; color: #f56c6c">失败: {{ progressInfo.failCount }}</span>
            </p>
          </div>
        </template>

        <!-- 错误 -->
        <template v-else-if="batchPhase === 'error'">
          <el-result icon="error" title="分析失败" :sub-title="batchError">
          </el-result>
        </template>
      </div>
      <template #footer>
        <el-button
          type="primary"
          :disabled="batchPhase === 'analyzing'"
          @click="closeProgressDialog"
        >
          {{ batchPhase === 'done' || batchPhase === 'error' ? '完成' : '分析中...' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 批量编辑关键词对话框 -->
    <el-dialog
      v-model="batchKeywordDialogVisible"
      title="批量编辑关键词"
      width="800px"
      @closed="handleBatchKeywordDialogClose"
    >
      <el-alert
        title="编辑视频的关键词后，记得点击保存按钮"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
      />
      <div class="batch-keyword-scroll">
        <div
          v-for="(item, idx) in batchKeywordItems"
          :key="item.id"
          class="batch-keyword-card"
        >
          <div class="batch-keyword-card-header">
            <span class="batch-keyword-name">{{ item.fileName }}</span>
            <div class="batch-keyword-card-actions">
              <el-button
                type="primary"
                size="small"
                link
                @click="handleBatchPreviewVideo(item)"
              >
                <el-icon><VideoPlay /></el-icon>
                预览视频
              </el-button>
              <el-tag v-if="item.saved" type="success" size="small">已保存</el-tag>
            </div>
          </div>
          <el-collapse>
            <el-collapse-item :name="idx">
          <div class="batch-keyword-content">
            <!-- 已添加的关键词 -->
            <div class="batch-keyword-tags">
              <el-tag
                v-for="(keyword, ki) in item.keywords"
                :key="ki"
                closable
                size="large"
                style="margin-right: 8px; margin-bottom: 8px"
                @close="handleBatchRemoveKeyword(idx, ki)"
              >
                {{ keyword }}
              </el-tag>
              <span v-if="item.keywords.length === 0" class="no-data">暂无关键词</span>
            </div>

            <!-- 操作区：输入 + 保存 -->
            <div class="batch-keyword-actions">
              <el-input
                v-model="item.keywordInput"
                placeholder="输入关键词后按回车添加（最多6个字）"
                maxlength="6"
                show-word-limit
                @keyup.enter.stop.capture="handleBatchAddKeyword(idx)"
              >
                <template #append>
                  <el-button @click="handleBatchAddKeyword(idx)" :disabled="!item.keywordInput.trim()">
                    添加
                  </el-button>
                </template>
              </el-input>
              <el-button
                type="primary"
                :loading="item.saving"
                @click="handleBatchSaveKeyword(idx)"
              >
                保存
              </el-button>
            </div>
            </div>
          </el-collapse-item>
          </el-collapse>
        </div>
      </div>
      <template #footer>
        <el-button @click="batchKeywordDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 视频分割对话框 -->
    <el-dialog v-model="showSplitDialog" title="视频分割" width="500px">
      <el-form :model="splitForm" label-width="100px">
        <el-form-item label="分割方式">
          <el-radio-group v-model="splitForm.mode">
            <el-radio label="duration">按时长</el-radio>
            <el-radio label="scene">按镜头</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="splitForm.mode === 'duration'" label="每段时长">
          <el-input-number
            v-model="splitForm.segmentDuration"
            :min="1"
            :max="300"
            :step="1"
          />
          <span style="margin-left: 10px">秒</span>
        </el-form-item>
        <el-form-item v-if="splitForm.mode === 'scene'" label="检测阈值">
          <el-slider
            v-model="splitForm.threshold"
            :min="0.1"
            :max="0.9"
            :step="0.1"
            show-stops
          />
          <div class="form-tip">阈值越小，分割点越多（推荐 0.3）</div>
        </el-form-item>
        <el-form-item label="输出目录">
          <div class="path-input">
            <el-input
              v-model="splitForm.outputDir"
              placeholder="默认与源文件同目录"
            />
            <el-button type="primary" @click="selectSplitOutputDir">选择</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSplitDialog = false">取消</el-button>
        <el-button
          type="primary"
          @click="handleSplitConfirm"
          :loading="splitLoading"
        >
          开始分割
        </el-button>
      </template>
    </el-dialog>

    <!-- 精准截取对话框 -->
    <el-dialog v-model="showCutDialog" title="精准截取" width="600px">
      <el-form :model="cutForm" label-width="100px">
        <el-form-item label="视频时长">
          <span>{{ formatDuration(currentVideo?.duration) || "--" }}</span>
        </el-form-item>
        <el-form-item label="开始时间">
          <div class="time-input">
            <el-input-number
              v-model="cutForm.startMinute"
              :min="0"
              :max="999"
              placeholder="分"
            />
            <span>分</span>
            <el-input-number
              v-model="cutForm.startSecond"
              :min="0"
              :max="59"
              placeholder="秒"
            />
            <span>秒</span>
          </div>
        </el-form-item>
        <el-form-item label="截取时长">
          <div class="time-input">
            <el-input-number
              v-model="cutForm.durationMinute"
              :min="0"
              :max="999"
              placeholder="分"
            />
            <span>分</span>
            <el-input-number
              v-model="cutForm.durationSecond"
              :min="0"
              :max="59"
              placeholder="秒"
            />
            <span>秒</span>
          </div>
        </el-form-item>
        <el-form-item label="输出文件">
          <div class="path-input">
            <el-input v-model="cutForm.outputPath" placeholder="自动生成" />
            <el-button type="primary" @click="selectCutOutputPath">选择</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCutDialog = false">取消</el-button>
        <el-button
          type="primary"
          @click="handleCutConfirm"
          :loading="cutLoading"
        >
          开始截取
        </el-button>
      </template>
    </el-dialog>

    <!-- 视频预览对话框 -->
    <el-dialog
      v-model="previewDialogVisible"
      title="视频预览"
      width="800px"
      destroy-on-close
      @closed="handlePreviewClosed"
    >
      <div class="video-preview-container">
        <video
          v-if="previewVideoPath"
          :src="previewVideoPath"
          controls
          autoplay
          style="width: 100%; max-height: 70vh"
        />
      </div>
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 编辑文件名对话框 -->
    <el-dialog v-model="renameDialogVisible" title="编辑文件名" width="500px" @closed="resetRenameForm">
      <el-form label-width="80px">
        <el-form-item label="文件名">
          <el-input v-model="renameFileName" placeholder="请输入文件名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renameDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveFileName">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Plus,
  ArrowDown,
  VideoPlay,
  FolderOpened,
  Document,
  Headset,
  Operation,
  Crop,
  Mute,
  Delete,
  Location,
  Key,
  DataAnalysis,
  EditPen,
  Loading,
} from "@element-plus/icons-vue";

// 数据
const videoList = ref<any[]>([]);
const loading = ref(false);
const selectedIds = ref<number[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);

// 关键词编辑相关
const keywordDialogVisible = ref(false);
const currentVideo = ref<any>(null);
const keywordInput = ref("");
const keywordForm = ref<{ keywords: string[] }>({ keywords: [] });

// 地点编辑相关
const locationDialogVisible = ref(false);
const locationForm = ref({
  selectedProvinces: [] as string[],
  selectedCities: [] as string[],
  placeNames: [] as string[],
});
const placeInput = ref("");
const provinceOptions = ref<{ value: string; label: string }[]>([]);
const locationCityOptions = ref<{ value: string; label: string }[]>([]);
const placeData = ref<Record<string, Record<string, string>>>({});

// 批量编辑地点相关
const batchLocationMode = ref(false);
const batchLocationIds = ref<number[]>([]);

// 视频分割
const showSplitDialog = ref(false);
const splitLoading = ref(false);
const splitForm = ref({
  mode: "duration",
  segmentDuration: 10,
  threshold: 0.3,
  outputDir: "",
});

// 精准截取
const showCutDialog = ref(false);
const cutLoading = ref(false);
const cutForm = ref({
  startMinute: 0,
  startSecond: 0,
  durationMinute: 0,
  durationSecond: 10,
  outputPath: "",
});

// 视频预览
const previewDialogVisible = ref(false);
const previewVideoPath = ref("");

// 编辑文件名
const renameDialogVisible = ref(false);
const renameFileName = ref("");
// 批量分析进度相关
const progressDialogVisible = ref(false);
const progressInfo = ref({
  total: 0,
  successCount: 0,
  failCount: 0,
});
const batchPhase = ref<'analyzing' | 'done' | 'error'>('analyzing');
const batchError = ref('');
// Batch 异步任务恢复用（仅 resumePendingBatch 使用）
const batchId = ref('');
const batchRequestCounts = ref<{ total: number; completed: number; failed: number } | null>(null);
const cancellingBatch = ref(false);
let batchPollTimer: ReturnType<typeof setInterval> | null = null;

// 批量编辑关键词
interface BatchKeywordItem {
  id: number;
  fileName: string;
  filePath: string;
  keywords: string[];
  keywordInput: string;
  saving: boolean;
  saved: boolean;
}
const batchKeywordDialogVisible = ref(false);
const batchKeywordItems = ref<BatchKeywordItem[]>([]);

// 并发分析进度百分比
const concurrentProgressPercentage = computed(() => {
  const completed = progressInfo.value.successCount + progressInfo.value.failCount;
  if (progressInfo.value.total === 0) return 0;
  return Math.round((completed / progressInfo.value.total) * 100);
});

// 批量结果状态
const batchResultStatus = computed(() => {
  if (progressInfo.value.failCount > 0) return 'warning' as const;
  return 'success' as const;
});

// 获取文件名
const getFileName = (path: string): string => {
  if (!path) return "";
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
};

// 关闭进度对话框
const closeProgressDialog = () => {
  stopBatchPolling();
  progressDialogVisible.value = false;
  loadData();
};

// 格式化时长
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 100);
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

// 分析状态标签类型
const getAnalysisStatusType = (status: number): string => {
  const types: Record<number, string> = {
    0: "info", // 未分析
    1: "warning", // 分析中
    2: "success", // 已分析
    3: "danger", // 分析失败
  };
  return types[status ?? 0] || "info";
};

// 分析状态标签文本
const getAnalysisStatusLabel = (status: number): string => {
  const labels: Record<number, string> = {
    0: "未分析",
    1: "分析中",
    2: "已分析",
    3: "分析失败",
  };
  return labels[status ?? 0] || "未分析";
};

// 加载地区数据
const loadPlaceData = async () => {
  try {
    const result = await window.electronAPI.getPlaceData();
    if (result.success && result.data) {
      placeData.value = result.data;
      // 构建省份选项（key "0" 是省份列表）
      const provinces = result.data['0'] || {};
      provinceOptions.value = Object.entries(provinces).map(([key, value]) => ({
        value: key,
        label: value as string,
      }));
    }
  } catch (error) {
    console.error("加载地区数据失败:", error);
  }
};

// 根据省份ID获取省份名称列表
const getProvinceNames = (provinceIds: string): string[] => {
  if (!provinceIds) return [];
  const ids = provinceIds.split(',').map(p => p.trim()).filter(p => p);
  return ids.map(id => {
    const provinces = placeData.value['0'] || {};
    return provinces[id] || id;
  });
};

// 根据城市ID获取城市名称列表
const getCityNames = (cityIds: string): string[] => {
  if (!cityIds) return [];
  const ids = cityIds.split(',').map(c => c.trim()).filter(c => c);
  const names: string[] = [];
  for (const id of ids) {
    // 遍历所有省份查找城市
    for (const provinceId of Object.keys(placeData.value)) {
      if (provinceId === '0') continue;
      const cities = placeData.value[provinceId] || {};
      if (cities[id]) {
        names.push(cities[id]);
        break;
      }
    }
  }
  return names;
};

// 省份变化时更新城市选项
const handleLocationProvinceChange = (provinces: string[], clearCities: boolean = true) => {
  // 清空已选城市（仅在用户主动切换省份时）
  if (clearCities) {
    locationForm.value.selectedCities = [];
  }
  locationCityOptions.value = [];

  if (!provinces || provinces.length === 0) return;

  // 合并所有选中省份的城市
  const cities: { value: string; label: string }[] = [];
  for (const provinceId of provinces) {
    const provinceCities = placeData.value[provinceId] || {};
    for (const [cityId, cityName] of Object.entries(provinceCities)) {
      cities.push({
        value: cityId,
        label: cityName as string,
      });
    }
  }
  locationCityOptions.value = cities;
};

// 打开地点编辑对话框
const handleLocationEdit = async (row: any) => {
  currentVideo.value = row;

  // 解析现有省市区数据
  if (row.province_ids) {
    locationForm.value.selectedProvinces = row.province_ids.split(',').map((p: string) => p.trim()).filter((p: string) => p);
  } else {
    locationForm.value.selectedProvinces = [];
  }

  // 先保存城市ID，后面再设置
  let savedCityIds: string[] = [];
  if (row.city_ids) {
    savedCityIds = row.city_ids.split(',').map((c: string) => c.trim()).filter((c: string) => c);
  }

  if (row.place_names) {
    locationForm.value.placeNames = row.place_names.split(',').map((p: string) => p.trim()).filter((p: string) => p);
  } else {
    locationForm.value.placeNames = [];
  }

  // 根据已选省份更新城市选项（不清理已选城市）
  handleLocationProvinceChange(locationForm.value.selectedProvinces, false);

  // 回显已选城市
  locationForm.value.selectedCities = savedCityIds;

  locationDialogVisible.value = true;
};

// 重置地点表单
const resetLocationForm = () => {
  locationForm.value = {
    selectedProvinces: [],
    selectedCities: [],
    placeNames: [],
  };
  locationCityOptions.value = [];
  placeInput.value = "";
  batchLocationMode.value = false;
  batchLocationIds.value = [];
};

// 批量编辑地点
const handleBatchLocationEdit = () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请选择要编辑地点的视频");
    return;
  }

  // 设置批量模式
  batchLocationMode.value = true;
  batchLocationIds.value = [...selectedIds.value];

  // 重置表单（不打开省份回显，用户重新选择覆盖）
  locationForm.value = {
    selectedProvinces: [],
    selectedCities: [],
    placeNames: [],
  };
  locationCityOptions.value = [];
  placeInput.value = "";

  locationDialogVisible.value = true;
};

// 保存地点信息
const handleSaveLocation = async () => {
  try {
    const provinceIds = locationForm.value.selectedProvinces.join(',');
    const cityIds = locationForm.value.selectedCities.join(',');
    const placeNames = locationForm.value.placeNames.join(',');

    if (batchLocationMode.value) {
      // 批量模式：表单中有值的字段覆盖，为空的字段保留原值
      for (const id of batchLocationIds.value) {
        const video = videoList.value.find((v) => v.id === id);
        const finalProvinceIds = provinceIds || (video?.province_ids || null);
        const finalCityIds = cityIds || (video?.city_ids || null);
        const finalPlaceNames = placeNames || (video?.place_names || null);

        await window.electronAPI.updateDraftVideoLocation(
          id,
          finalProvinceIds,
          finalCityIds,
          finalPlaceNames
        );
      }
      ElMessage.success(`已更新 ${batchLocationIds.value.length} 个视频的地点信息`);
    } else {
      // 单条模式
      if (!currentVideo.value) return;
      await window.electronAPI.updateDraftVideoLocation(
        currentVideo.value.id,
        provinceIds || null,
        cityIds || null,
        placeNames || null
      );
      ElMessage.success("地点信息保存成功");
    }

    locationDialogVisible.value = false;
    loadData();
  } catch (error) {
    console.error("保存地点信息失败:", error);
    ElMessage.error("保存地点信息失败");
  }
};

// 添加地点
const handleAddPlace = () => {
  const place = placeInput.value.trim();
  if (!place) return;

  // 检查是否已存在
  if (locationForm.value.placeNames.includes(place)) {
    ElMessage.warning("该地点已添加");
    return;
  }

  locationForm.value.placeNames.push(place);
  placeInput.value = "";
};

// 删除地点
const handleRemovePlace = (index: number) => {
  locationForm.value.placeNames.splice(index, 1);
};

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const offset = (currentPage.value - 1) * pageSize.value;
    const [result, countResult] = await Promise.all([
      window.electronAPI.getDraftVideoList(pageSize.value, offset),
      window.electronAPI.getDraftVideoCount(),
    ]);
    videoList.value = result;
    total.value = countResult.count;
  } catch (error) {
    console.error("加载数据失败:", error);
    ElMessage.error("加载数据失败");
  } finally {
    loading.value = false;
  }
};

// 选择变化
const handleSelectionChange = (selection: any[]) => {
  selectedIds.value = selection.map((item) => item.id);
};

// 添加视频
const handleAddVideos = async () => {
  try {
    // 检查是否已配置视频根路径
    const configs = await window.electronAPI.getAllConfigs();
    if (!configs.video_root_path) {
      ElMessage.warning("请先在基本配置中设置视频存放根路径");
      return;
    }

    const result = await window.electronAPI.openVideo(true);
    if (result.canceled) return;

    ElMessage.info("正在处理视频文件，请稍候...");

    const addResult = await window.electronAPI.addDraftVideoWithCopy(
      result.filePaths,
    );

    if (addResult.success) {
      const successCount = addResult.results.filter((r) => r.success).length;
      const failCount = addResult.results.filter((r) => !r.success).length;
      const filteredCount = addResult.filtered?.length || 0;

      // 构建提示消息
      let message = "";
      if (successCount > 0) {
        message = `成功添加 ${successCount} 个视频`;
      }

      // 显示被过滤的短视频提示
      if (filteredCount > 0) {
        const filteredNames = addResult.filtered!.map(f => `${f.file_name}(${f.duration.toFixed(1)}s)`).join("、");
        console.log(`[Video] 已过滤时长小于2秒的视频: ${filteredNames}`);
        if (message) {
          message += `，已过滤 ${filteredCount} 个时长不足2秒的视频`;
        } else {
          message = `已过滤 ${filteredCount} 个时长不足2秒的视频`;
        }
      }

      // 显示失败的提示
      if (failCount > 0) {
        if (message) {
          message += `，失败 ${failCount} 个`;
        } else {
          message = `失败 ${failCount} 个`;
        }
        addResult.results
          .filter((r) => !r.success)
          .forEach((r) => {
            console.error(`视频 ${r.file_name} 添加失败:`, r.error);
          });
      }

      // 根据结果显示不同类型的提示
      if (successCount > 0 && failCount === 0 && filteredCount === 0) {
        ElMessage.success(message);
      } else if (failCount > 0 || (filteredCount > 0 && successCount === 0)) {
        ElMessage.warning(message);
      } else if (message) {
        ElMessage.success(message);
      }

      loadData();
    } else {
      ElMessage.error(addResult.error || "添加视频失败");
    }
  } catch (error) {
    console.error("添加视频失败:", error);
    ElMessage.error("添加视频失败");
  }
};

// 删除
const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm("确定要删除这个视频吗？", "提示", {
      type: "warning",
    });
    await window.electronAPI.deleteDraftVideo([id]);
    ElMessage.success("删除成功");
    loadData();
  } catch (error) {
    if (error !== "cancel") {
      console.error("删除失败:", error);
      ElMessage.error("删除失败");
    }
  }
};

// 批量删除
const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 个视频吗？`,
      "提示",
      {
        type: "warning",
      },
    );
    await window.electronAPI.deleteDraftVideo([...selectedIds.value]);
    ElMessage.success("删除成功");
    loadData();
  } catch (error) {
    if (error !== "cancel") {
      console.error("删除失败:", error);
      ElMessage.error("删除失败");
    }
  }
};

// 分析单个视频
const handleAnalyze = async (row: any) => {
  if (!row.file_path) {
    ElMessage.error("视频文件路径不存在");
    return;
  }

  // 更新分析状态为"分析中"
  try {
    await window.electronAPI.updateDraftVideoAnalysisStatus(row.id, 1);
    await loadData(); // 刷新显示状态
  } catch (error) {
    console.error("更新分析状态失败:", error);
  }

  try {
    ElMessage.info(`正在分析视频: ${row.file_name}`);

    // 调用视频分析 API
    const result = await window.electronAPI.videoAnalysisExtractKeywords(row.file_path, {
      fps: 2, // 每秒提取2帧
    });

    if (result.success && result.keywords) {
      // 保存关键词到数据库
      const keywordsStr = result.keywords.join(",");
      await window.electronAPI.updateDraftVideoAnalysis(row.id, keywordsStr);
      // 更新分析状态为"已分析"
      await window.electronAPI.updateDraftVideoAnalysisStatus(row.id, 2);

      ElMessage.success(`视频分析完成，提取到 ${result.keywords.length} 个关键词`);
      loadData(); // 刷新数据
    } else {
      // 更新分析状态为"分析失败"
      await window.electronAPI.updateDraftVideoAnalysisStatus(row.id, 3);
      ElMessage.error(result.error || "视频分析失败");
    }
  } catch (error: any) {
    console.error("视频分析出错:", error);
    // 更新分析状态为"分析失败"
    await window.electronAPI.updateDraftVideoAnalysisStatus(row.id, 3);
    ElMessage.error(error.message || "视频分析失败");
  }
};

// 启动并发分析（供 handleBatchAnalyze 和 resumeConcurrentAnalysis 共用）
const startConcurrentAnalysis = async (videos: Array<{ id: number; filePath: string }>) => {
  const videoPaths = videos.map((v) => v.filePath);
  const videoIdMap: Record<string, number> = {};
  for (const v of videos) {
    videoIdMap[v.filePath] = v.id;
  }

  // 订阅进度事件（每完成一个视频触发，DB 在主进程已更新）
  const unsubscribe = window.electronAPI.onVideoAnalysisBatchProgress((progress) => {
    progressInfo.value.successCount = progress.successCount;
    progressInfo.value.failCount = progress.failCount;

    // 每完成一个就刷新列表，让用户看到实时更新
    if (progress.isDone) {
      batchPhase.value = 'done';
      unsubscribe();
      clearPendingConcurrent();
      loadData();
    } else {
      loadData();
    }
  });

  try {
    // 发起并发分析（主进程会逐个更新 DB）
    const result = await window.electronAPI.videoAnalysisBatchExtractKeywordsConcurrent(
      videoPaths,
      videoIdMap,
      { concurrency: 3, fps: 2 }
    );

    if (!result.success) {
      batchPhase.value = 'error';
      batchError.value = result.error || '批量分析失败';
      unsubscribe();
      clearPendingConcurrent();
    }
  } catch (error: any) {
    console.error("批量分析出错:", error);
    batchPhase.value = 'error';
    batchError.value = error.message || '未知错误';
    clearPendingConcurrent();
  }
};

// 批量分析（并发实时分析，每完成一个即更新数据库）
const handleBatchAnalyze = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请选择要分析的视频");
    return;
  }

  // 获取选中的视频信息
  const selectedVideos = videoList.value.filter((v) =>
    selectedIds.value.includes(v.id)
  );

  // 过滤出有文件路径的视频
  const videosToAnalyze = selectedVideos.filter((v) => v.file_path);

  if (videosToAnalyze.length === 0) {
    ElMessage.warning("选中的视频没有有效的文件路径");
    return;
  }

  // 重置状态
  batchPhase.value = 'analyzing';
  batchError.value = '';
  progressInfo.value = {
    total: videosToAnalyze.length,
    successCount: 0,
    failCount: 0,
  };

  // 更新所有选中视频的状态为"分析中"
  for (const video of videosToAnalyze) {
    await window.electronAPI.updateDraftVideoAnalysisStatus(video.id, 1);
  }
  loadData();

  // 持久化分析列表，以便程序重启后恢复
  const videosData = videosToAnalyze.map((v) => ({ id: v.id, filePath: v.file_path }));
  await window.electronAPI.setConfig('pending_concurrent_videos', JSON.stringify(videosData));

  // 显示进度对话框
  progressDialogVisible.value = true;

  // 启动并发分析
  await startConcurrentAnalysis(videosData);
};

// 开始轮询 Batch 任务状态
const startBatchPolling = () => {
  stopBatchPolling();

  // 立即查询一次
  pollBatchStatus();

  // 每 30 秒轮询一次
  batchPollTimer = setInterval(() => {
    pollBatchStatus();
  }, 30000);
};

// 停止轮询
const stopBatchPolling = () => {
  if (batchPollTimer) {
    clearInterval(batchPollTimer);
    batchPollTimer = null;
  }
};

// 轮询查询 Batch 状态
const pollBatchStatus = async () => {
  if (!batchId.value) return;

  try {
    const result = await window.electronAPI.videoAnalysisBatchCheck(batchId.value);

    if (result.error && result.status === 'unknown') {
      // 查询本身出错（batch 任务可能已过期或不存在）
      batchPhase.value = 'error';
      batchError.value = result.error;
      stopBatchPolling();
      clearPendingBatch();
      return;
    }

    // 更新请求数量
    if (result.requestCounts) {
      batchRequestCounts.value = result.requestCounts;
    }

    // 终态判断
    const terminalStates = new Set(['completed', 'failed', 'expired', 'cancelled']);
    if (terminalStates.has(result.status)) {
      stopBatchPolling();

      if (result.status === 'completed' && result.results) {
        // 解析结果
        let successCount = 0;
        let failCount = 0;
        for (const r of result.results) {
          if (r.success) {
            successCount++;
          } else {
            failCount++;
          }
        }
        progressInfo.value = {
          ...progressInfo.value,
          successCount,
          failCount,
        };
        batchPhase.value = 'done';
      } else if (result.status === 'failed' || result.status === 'expired') {
        batchPhase.value = 'error';
        batchError.value = `Batch 任务${result.status === 'failed' ? '失败' : '已过期'}`;
      } else if (result.status === 'cancelled') {
        batchPhase.value = 'error';
        batchError.value = 'Batch 任务已取消';
      }

      // 清除持久化的 batch 信息
      clearPendingBatch();

      // 刷新数据
      loadData();
    }
    // 非终态，继续轮询（interval 会处理）
  } catch (error: any) {
    console.error('[DraftVideo] 轮询 Batch 状态出错:', error);
  }
};

// 取消 Batch 任务
const handleCancelBatch = async () => {
  if (!batchId.value) return;

  try {
    cancellingBatch.value = true;
    await window.electronAPI.videoAnalysisBatchCancel(batchId.value);
    stopBatchPolling();
    clearPendingBatch();
    batchPhase.value = 'error';
    batchError.value = '用户取消了分析任务';
    loadData();
  } catch (error: any) {
    ElMessage.error('取消任务失败: ' + (error.message || '未知错误'));
  } finally {
    cancellingBatch.value = false;
  }
};

// 组件卸载时清理
onUnmounted(() => {
  stopBatchPolling();
});

// 操作命令处理
const handleCommand = (command: string, row: any) => {
  currentVideo.value = row;
  switch (command) {
    case "location":
      handleLocationEdit(row);
      break;
    case "keyword":
      handleKeywordEdit(row);
      break;
    case "analyze":
      handleAnalyze(row);
      break;
    case "preview":
      handlePreview(row);
      break;
    case "openFolder":
      handleOpenFolder(row);
      break;
    case "rename":
      handleRenameEdit(row);
      break;
    case "extractText":
      handleExtractText(row);
      break;
    case "extractAudio":
      handleExtractAudio(row);
      break;
    case "split":
      handleSplit(row);
      break;
    case "cut":
      handleCut(row);
      break;
    case "mute":
      handleMute(row);
      break;
    case "delete":
      handleDelete(row.id);
      break;
  }
};

// 打开文件所在目录
const handleOpenFolder = (row: any) => {
  window.electronAPI.showItemInFolder(row.file_path);
};

// 提取文案
const handleExtractText = (row: any) => {
  ElMessage.info("提取文案功能开发中...");
};

// 提取音频
const handleExtractAudio = async (row: any) => {
  try {
    ElMessage.info("正在提取音频...");
    const result = await window.electronAPI.extractAudio(row.file_path);
    if (result.success) {
      ElMessage.success("音频提取成功: " + result.data);
    } else {
      ElMessage.error("提取失败: " + result.error);
    }
  } catch (error) {
    console.error("提取音频失败:", error);
    ElMessage.error("提取音频失败");
  }
};

// 打开分割对话框
const handleSplit = (row: any) => {
  currentVideo.value = row;
  splitForm.value = {
    mode: "duration",
    segmentDuration: 10,
    threshold: 0.3,
    outputDir: "",
  };
  showSplitDialog.value = true;
};

// 选择分割输出目录
const selectSplitOutputDir = async () => {
  const result = await window.electronAPI.openDirectory();
  if (!result.canceled && result.filePaths.length > 0) {
    splitForm.value.outputDir = result.filePaths[0];
  }
};

// 确认分割
const handleSplitConfirm = async () => {
  if (!currentVideo.value) return;

  splitLoading.value = true;
  try {
    let result;
    if (splitForm.value.mode === "duration") {
      result = await window.electronAPI.splitByDuration(
        currentVideo.value.file_path,
        splitForm.value.segmentDuration,
        splitForm.value.outputDir || undefined
      );
    } else {
      result = await window.electronAPI.splitByScene(
        currentVideo.value.file_path,
        splitForm.value.threshold,
        splitForm.value.outputDir || undefined
      );
    }

    if (result.success) {
      ElMessage.success(
        `分割成功，共生成 ${result.data.segments.length} 个片段`
      );
      showSplitDialog.value = false;
    } else {
      ElMessage.error("分割失败: " + result.data?.error);
    }
  } catch (error) {
    console.error("分割失败:", error);
    ElMessage.error("分割失败");
  } finally {
    splitLoading.value = false;
  }
};

// 打开截取对话框
const handleCut = (row: any) => {
  currentVideo.value = row;
  cutForm.value = {
    startMinute: 0,
    startSecond: 0,
    durationMinute: 0,
    durationSecond: 10,
    outputPath: "",
  };
  showCutDialog.value = true;
};

// 选择截取输出路径
const selectCutOutputPath = async () => {
  const result = await window.electronAPI.saveFile("cut_video.mp4", [
    { name: "Video Files", extensions: ["mp4", "avi", "mov"] },
  ]);
  if (!result.canceled && result.filePath) {
    cutForm.value.outputPath = result.filePath;
  }
};

// 确认截取
const handleCutConfirm = async () => {
  if (!currentVideo.value) return;

  const startTime = cutForm.value.startMinute * 60 + cutForm.value.startSecond;
  const duration =
    cutForm.value.durationMinute * 60 + cutForm.value.durationSecond;

  if (duration <= 0) {
    ElMessage.warning("请设置有效的截取时长");
    return;
  }

  cutLoading.value = true;
  try {
    const result = await window.electronAPI.cutVideo(
      currentVideo.value.file_path,
      startTime,
      duration,
      cutForm.value.outputPath || undefined
    );

    if (result.success) {
      ElMessage.success("截取成功: " + result.data);
      showCutDialog.value = false;
    } else {
      ElMessage.error("截取失败: " + result.error);
    }
  } catch (error) {
    console.error("截取失败:", error);
    ElMessage.error("截取失败");
  } finally {
    cutLoading.value = false;
  }
};

// 静音处理
const handleMute = async (row: any) => {
  try {
    await ElMessageBox.confirm("确定要对该视频进行静音处理吗？", "提示", {
      type: "info",
    });

    ElMessage.info("正在处理...");
    const result = await window.electronAPI.muteVideo(row.file_path);
    if (result.success) {
      ElMessage.success("静音处理成功: " + result.data);
    } else {
      ElMessage.error("处理失败: " + result.error);
    }
  } catch (error) {
    if (error !== "cancel") {
      console.error("静音处理失败:", error);
      ElMessage.error("静音处理失败");
    }
  }
};

// 预览
const handlePreview = async (row: any) => {
  try {
    // 读取视频文件并创建 Blob URL
    const result = await window.electronAPI.readVideoFile(row.file_path);
    if (!result.success) {
      ElMessage.error('读取视频文件失败: ' + result.error);
      return;
    }

    // 创建 Blob URL
    const blob = new Blob([result.buffer], { type: result.mimeType });
    const blobUrl = URL.createObjectURL(blob);

    // 释放之前的 Blob URL（避免内存泄漏）
    if (previewVideoPath.value && previewVideoPath.value.startsWith('blob:')) {
      URL.revokeObjectURL(previewVideoPath.value);
    }

    previewVideoPath.value = blobUrl;
    previewDialogVisible.value = true;
  } catch (error) {
    console.error('预览视频失败:', error);
    ElMessage.error('预览视频失败');
  }
};

// 预览对话框关闭时释放 Blob URL
const handlePreviewClosed = () => {
  if (previewVideoPath.value && previewVideoPath.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewVideoPath.value);
  }
  previewVideoPath.value = '';
};

// 编辑文件名
const handleRenameEdit = (row: any) => {
  currentVideo.value = row;
  renameFileName.value = row.file_name || '';
  renameDialogVisible.value = true;
};

const resetRenameForm = () => {
  renameFileName.value = '';
  currentVideo.value = null;
};

const handleSaveFileName = async () => {
  if (!currentVideo.value) return;
  let fileName = renameFileName.value.trim();
  if (!fileName) {
    ElMessage.warning('文件名不能为空');
    return;
  }

  // 若无文件后缀，自动添加原始后缀
  if (!fileName.includes('.')) {
    const originalName = currentVideo.value.file_name || '';
    const dotIndex = originalName.lastIndexOf('.');
    if (dotIndex > 0) {
      fileName += originalName.substring(dotIndex);
    }
  }

  try {
    await window.electronAPI.updateDraftVideoFileName(currentVideo.value.id, fileName);
    ElMessage.success('文件名修改成功');
    renameDialogVisible.value = false;
    loadData();
  } catch (error) {
    console.error('修改文件名失败:', error);
    ElMessage.error('修改文件名失败');
  }
};

// 打开关键词编辑对话框
const handleKeywordEdit = (row: any) => {
  currentVideo.value = row;
  // 解析现有关键词
  if (row.keywords) {
    keywordForm.value.keywords = row.keywords
      .split(",")
      .map((k: string) => k.trim())
      .filter((k: string) => k);
  } else {
    keywordForm.value.keywords = [];
  }
  keywordInput.value = "";
  keywordDialogVisible.value = true;
};

// 添加关键词
const handleAddKeyword = () => {
  const keyword = keywordInput.value.trim();
  if (!keyword) return;

  if (keywordForm.value.keywords.length >= 5) {
    ElMessage.warning("最多只能添加5个关键词");
    return;
  }

  // 检查是否已存在
  if (keywordForm.value.keywords.includes(keyword)) {
    ElMessage.warning("该关键词已存在");
    return;
  }

  keywordForm.value.keywords.push(keyword);
  keywordInput.value = "";
};

// 移除关键词
const handleRemoveKeyword = (index: number) => {
  keywordForm.value.keywords.splice(index, 1);
};

// 重置关键词表单
const resetKeywordForm = () => {
  keywordInput.value = "";
  keywordForm.value.keywords = [];
  currentVideo.value = null;
};

// 保存关键词
const handleSaveKeywords = async () => {
  if (!currentVideo.value) return;

  const keywords = keywordForm.value.keywords.join(",");

  try {
    await window.electronAPI.updateDraftVideoAnalysis(
      currentVideo.value.id,
      keywords
    );
    // 如果有关键词，更新分析状态为"已分析"
    if (keywords) {
      await window.electronAPI.updateDraftVideoAnalysisStatus(currentVideo.value.id, 2);
    }
    ElMessage.success("关键词保存成功");
    keywordDialogVisible.value = false;
    loadData();
  } catch (error) {
    console.error("保存关键词失败:", error);
    ElMessage.error("保存关键词失败");
  }
};

// 打开批量编辑关键词弹窗
const handleBatchKeywordEdit = () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请选择要编辑关键词的视频");
    return;
  }

  const selectedVideos = videoList.value.filter((v) =>
    selectedIds.value.includes(v.id)
  );

  batchKeywordItems.value = selectedVideos.map((v) => ({
    id: v.id,
    fileName: v.file_name || '',
    filePath: v.file_path || '',
    keywords: v.keywords
      ? v.keywords.split(",").map((k: string) => k.trim()).filter((k: string) => k)
      : [],
    keywordInput: "",
    saving: false,
    saved: false,
  }));

  batchKeywordDialogVisible.value = true;
};

// 批量编辑：添加关键词
const handleBatchAddKeyword = (idx: number) => {
  const item = batchKeywordItems.value[idx];
  const keyword = item.keywordInput.trim();
  if (!keyword) return;
  if (item.keywords.length >= 5) {
    ElMessage.warning("最多只能添加5个关键词");
    return;
  }
  if (item.keywords.includes(keyword)) {
    ElMessage.warning("该关键词已存在");
    return;
  }
  item.keywords = [...item.keywords, keyword];
  item.keywordInput = "";
  item.saved = false;
};

// 批量编辑：移除关键词
const handleBatchRemoveKeyword = (idx: number, ki: number) => {
  const item = batchKeywordItems.value[idx];
  item.keywords = item.keywords.filter((_, i) => i !== ki);
  item.saved = false;
};

// 批量编辑：保存单条关键词
const handleBatchSaveKeyword = async (idx: number) => {
  const item = batchKeywordItems.value[idx];
  item.saving = true;
  try {
    const keywordsStr = item.keywords.join(",");
    await window.electronAPI.updateDraftVideoAnalysis(item.id, keywordsStr);
    if (keywordsStr) {
      await window.electronAPI.updateDraftVideoAnalysisStatus(item.id, 2);
    }
    item.saved = true;
    ElMessage.success("保存成功");
  } catch (error) {
    console.error("保存关键词失败:", error);
    ElMessage.error("保存失败");
  } finally {
    item.saving = false;
  }
};

// 批量编辑：预览视频（复用现有预览对话框）
const handleBatchPreviewVideo = async (item: BatchKeywordItem) => {
  try {
    const result = await window.electronAPI.readVideoFile(item.filePath);
    if (!result.success) {
      ElMessage.error("读取视频文件失败: " + result.error);
      return;
    }
    // 释放之前的 blob URL
    if (previewVideoPath.value && previewVideoPath.value.startsWith("blob:")) {
      URL.revokeObjectURL(previewVideoPath.value);
    }
    const blob = new Blob([result.buffer], { type: result.mimeType });
    previewVideoPath.value = URL.createObjectURL(blob);
    previewDialogVisible.value = true;
  } catch (error) {
    console.error("预览视频失败:", error);
    ElMessage.error("预览视频失败");
  }
};

// 批量编辑：关闭弹窗
const handleBatchKeywordDialogClose = () => {
  batchKeywordItems.value = [];
  loadData();
};

// 清除持久化的 batch 信息
const clearPendingBatch = async () => {
  try {
    await window.electronAPI.setConfig('pending_batch_id', '');
    await window.electronAPI.setConfig('pending_batch_total', '');
  } catch (e) {
    console.error('[DraftVideo] 清除 batch 配置失败:', e);
  }
};

// 清除持久化的并发分析信息
const clearPendingConcurrent = async () => {
  try {
    await window.electronAPI.setConfig('pending_concurrent_videos', '');
  } catch (e) {
    console.error('[DraftVideo] 清除并发分析配置失败:', e);
  }
};

// 恢复未完成的 batch 任务
const resumePendingBatch = async () => {
  try {
    const batchIdConfig = await window.electronAPI.getConfig('pending_batch_id');
    const totalConfig = await window.electronAPI.getConfig('pending_batch_total');
    const savedBatchId = batchIdConfig?.value;
    const savedTotal = totalConfig?.value ? parseInt(totalConfig.value) : 0;

    if (!savedBatchId) return;

    console.log(`[DraftVideo] 检测到未完成的 batch 任务: ${savedBatchId}`);

    // 立即查询一次状态
    const result = await window.electronAPI.videoAnalysisBatchCheck(savedBatchId);
    const terminalStates = new Set(['completed', 'failed', 'expired', 'cancelled', 'unknown']);

    if (terminalStates.has(result.status)) {
      // 任务已终态或查询失败（unknown），清除配置，刷新数据
      await clearPendingBatch();
      loadData();
      console.log(`[DraftVideo] batch 任务已终态或无法恢复: ${result.status}`);
      return;
    }

    // 任务仍在运行，恢复轮询 UI
    batchId.value = savedBatchId;
    progressInfo.value = {
      total: savedTotal || 0,
      successCount: 0,
      failCount: 0,
    };
    batchRequestCounts.value = result.requestCounts || null;
    batchError.value = '';
    cancellingBatch.value = false;
    batchPhase.value = 'analyzing';

    // 显示进度对话框
    progressDialogVisible.value = true;

    // 开始轮询
    startBatchPolling();
  } catch (error: any) {
    console.error('[DraftVideo] 恢复 batch 任务失败:', error);
    // 恢复失败，清除配置避免下次再尝试
    await clearPendingBatch();
  }
};

// 恢复中断的并发分析任务
const resumeConcurrentAnalysis = async () => {
  // 已有进度对话框显示中（可能是 Batch 恢复），不再重复
  if (progressDialogVisible.value) return;

  try {
    const config = await window.electronAPI.getConfig('pending_concurrent_videos');
    if (!config?.value) return;

    const allVideos: Array<{ id: number; filePath: string }> = JSON.parse(config.value);
    if (!allVideos || allVideos.length === 0) {
      await clearPendingConcurrent();
      return;
    }

    // 筛选仍处于"分析中"状态的视频
    const remaining: Array<{ id: number; filePath: string }> = [];
    for (const v of allVideos) {
      const video = await window.electronAPI.getDraftVideo(v.id);
      if (video && video.analysis_status === 1) {
        remaining.push(v);
      }
    }

    if (remaining.length === 0) {
      // 所有视频都已完成，清除配置
      await clearPendingConcurrent();
      loadData();
      return;
    }

    console.log(`[DraftVideo] 检测到中断的并发分析，恢复 ${remaining.length}/${allVideos.length} 个`);

    // 设置状态（已完成的不重新分析）
    batchPhase.value = 'analyzing';
    batchError.value = '';
    progressInfo.value = {
      total: allVideos.length,
      successCount: allVideos.length - remaining.length,
      failCount: 0,
    };

    // 更新待恢复视频状态为"分析中"
    for (const v of remaining) {
      await window.electronAPI.updateDraftVideoAnalysisStatus(v.id, 1);
    }

    // 更新持久化数据为剩余视频
    await window.electronAPI.setConfig('pending_concurrent_videos', JSON.stringify(remaining));

    // 显示进度对话框
    progressDialogVisible.value = true;

    // 启动并发分析
    await startConcurrentAnalysis(remaining);
  } catch (error: any) {
    console.error('[DraftVideo] 恢复并发分析失败:', error);
    await clearPendingConcurrent();
  }
};

// 初始化
onMounted(() => {
  loadData();
  loadPlaceData();
  resumePendingBatch();
  resumeConcurrentAnalysis();
});
</script>

<style scoped>
.page-container {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.file-name-cell {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.no-data {
  color: #999;
  font-size: 12px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.keyword-tags {
  min-height: 40px;
  padding: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.place-tags {
  min-height: 32px;
  margin-bottom: 8px;
}

.progress-content {
  padding: 20px 0;
}

.progress-info {
  margin-top: 20px;
  text-align: center;
}

.progress-info p {
  margin: 8px 0;
  font-size: 14px;
}

.current-video {
  color: #909399;
  font-size: 12px !important;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.path-input {
  display: flex;
  gap: 10px;
  width: 100%;
}

.path-input .el-input {
  flex: 1;
}

.time-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-input .el-input-number {
  width: 80px;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

.video-preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #000;
  border-radius: 4px;
  overflow: hidden;
}

/* 批量编辑关键词弹窗 */

.batch-keyword-scroll {
  min-height: 400px;
  max-height: 520px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f5f7fa;
}



.batch-keyword-scroll::-webkit-scrollbar {
  width: 6px;
}

.batch-keyword-scroll::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 3px;
}

.batch-keyword-scroll::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.batch-keyword-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.2s;
}

.batch-keyword-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.batch-keyword-card:last-child {
  margin-bottom: 0;
}

.batch-keyword-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #eef1f5 100%);
  border-bottom: 1px solid #ebeef5;
}

.batch-keyword-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}

.batch-keyword-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.batch-keyword-content {
  padding: 12px 16px 8px;
}

.batch-keyword-tags {
  min-height: 40px;
  padding: 10px 12px;
  background-color: #fafbfc;
  border-radius: 6px;
  border: 1px solid #ebeef5;
  margin-bottom: 12px;
}

.batch-keyword-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.batch-keyword-actions .el-input {
  flex: 1;
}

/* 卡片内 collapse 去除默认边框 */
.batch-keyword-card .el-collapse {
  border-top: none;
  border-bottom: none;
}

.batch-keyword-card .el-collapse-item__header {
  background: transparent;
  border-bottom: none;
  padding: 0 16px;
  font-size: 13px;
  color: #909399;
}

.batch-keyword-card .el-collapse-item__wrap {
  border-bottom: none;
}
.page-container {
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f5f7fa;
}

.page-container::-webkit-scrollbar {
  width: 8px;
}

.page-container::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 4px;
}

.page-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
  transition: background 0.3s;
}

.page-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 表格滚动条样式 */
:deep(.el-table__body-wrapper) {
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f5f7fa;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-track) {
  background: #f5f7fa;
  border-radius: 4px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #c1c1c1;
  border-radius: 4px;
  transition: background 0.3s;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb:hover) {
  background: #a8a8a8;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-corner) {
  background: #f5f7fa;
}
</style>
