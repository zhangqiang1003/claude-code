<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>材料库 - 视频</span>
          <div class="header-actions">
            <el-button type="primary" @click="handleAddVideos">
              <el-icon><Plus /></el-icon>
              添加视频
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
        <el-table-column label="文件名" min-width="200">
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
        <el-table-column prop="duration" label="时长" width="100">
          <template #default="{ row }">
            {{ formatDuration(row.duration) }}
          </template>
        </el-table-column>
        <el-table-column prop="format" label="格式" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.format" size="small">{{
              row.format.toUpperCase()
            }}</el-tag>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column label="分辨率" width="100">
          <template #default="{ row }">
            {{ row.width && row.height ? `${row.width}x${row.height}` : "--" }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="添加时间" width="180" />
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
                  <el-dropdown-item command="preview">
                    <el-icon><VideoPlay /></el-icon>预览视频
                  </el-dropdown-item>
                  <el-dropdown-item command="openFolder">
                    <el-icon><FolderOpened /></el-icon>查看文件
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
                  <el-dropdown-item command="smartSplit">
                    <el-icon><MagicStick /></el-icon>智能分割
                  </el-dropdown-item>
<!--                  <el-dropdown-item command="cut">-->
<!--                    <el-icon><Crop /></el-icon>精准截取-->
<!--                  </el-dropdown-item>-->
<!--                  <el-dropdown-item command="mute">-->
<!--                    <el-icon><Mute /></el-icon>静音处理-->
<!--                  </el-dropdown-item>-->
                  <el-dropdown-item command="delete" divided>
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
            <el-button type="primary" @click="selectSplitOutputDir"
              >选择</el-button
            >
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
            <el-button type="primary" @click="selectCutOutputPath"
              >选择</el-button
            >
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

    <!-- 智能分割对话框 -->
    <el-dialog v-model="showSmartSplitDialog" title="智能分割" width="900px" :close-on-click-modal="false" @closed="handleSmartSplitDialogClosed">
      <!-- 阶段1: 分析中 -->
      <div v-if="smartSplitPhase === 'analyzing'" class="smart-split-analyzing">
        <div class="smart-split-status">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <p>{{ smartSplitStatusText }}</p>
        </div>
      </div>

      <!-- 阶段2: 预览片段 -->
      <div v-else-if="smartSplitPhase === 'preview'" class="smart-split-preview">
        <div class="smart-split-info">
          <el-tag type="success">AI 已识别 {{ smartSplitSegments.length }} 个片段</el-tag>
          <el-button size="small" @click="handleSmartSplitSelectAll">
            {{ smartSplitSelectedAll ? '取消全选' : '全选' }}
          </el-button>
        </div>
        <el-table :data="smartSplitSegments" ref="smartSplitTableRef" style="width: 100%; margin-top: 12px;" max-height="400" @selection-change="handleSmartSplitSelectionChange">
          <el-table-column type="selection" width="55" :selectable="(row: any) => !row.is_migrated" />
          <el-table-column label="序号" width="60" type="index" />
          <el-table-column label="时间范围" width="180">
            <template #default="{ row }">
              {{ formatDuration(Number(row.startTime)) }} → {{ formatDuration(Number(row.endTime)) }}
            </template>
          </el-table-column>
          <el-table-column label="时长" width="80">
            <template #default="{ row }">
              {{ (Number(row.endTime) - Number(row.startTime)).toFixed(1) }}s
            </template>
          </el-table-column>
          <el-table-column prop="description" label="场景描述" min-width="120" />
          <el-table-column prop="keywords" label="关键词" min-width="100">
            <template #default="{ row }">
              <template v-if="row.keywords">
                <el-tag v-for="(kw, idx) in row.keywords.split(',').filter((k: string) => k.trim())" :key="idx" size="small" style="margin: 2px;">{{ kw.trim() }}</el-tag>
              </template>
              <span v-else>--</span>
            </template>
          </el-table-column>
          <el-table-column label="迁移状态" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.is_migrated" size="small" type="success">已迁移</el-tag>
              <span v-else>--</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <template v-if="row.filePath">
                <el-button
                  type="primary"
                  size="small"
                  link
                  @click="handlePreviewSegment(row.filePath)"
                >预览</el-button>
                <el-tooltip v-if="!row.is_migrated" content="一键迁移至素材库" placement="top">
                  <el-button
                    type="success"
                    size="small"
                    link
                    style="margin-left: 8px"
                    @click="handleMigrateToDraft(row)"
                  >迁移</el-button>
                </el-tooltip>
                <el-tag v-else size="small" type="info" style="margin-left: 8px">已迁移</el-tag>
              </template>
              <el-tag v-else size="small" type="info">未分割</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 阶段3: 执行中 -->
      <div v-else-if="smartSplitPhase === 'executing'" class="smart-split-executing">
        <div class="smart-split-status">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <p>正在执行 FFmpeg 切割，请稍候...</p>
          <el-progress :percentage="smartSplitProgress" :format="() => `${smartSplitProgress}%`" />
        </div>
      </div>

      <!-- 阶段4: 完成 -->
      <div v-else-if="smartSplitPhase === 'done'" class="smart-split-done">
        <el-result icon="success" title="分割完成" :sub-title="`成功生成 ${smartSplitOutputFiles.length} 个视频片段`">
          <template #extra>
            <el-button type="primary" @click="handleSmartSplitBackToPreview">查看结果</el-button>
          </template>
        </el-result>
      </div>

      <template #footer v-if="smartSplitPhase === 'analyzing'">
        <el-button @click="handleCancelSmartSplit">取消分析</el-button>
      </template>
      <template #footer v-else-if="smartSplitPhase === 'preview'">
        <el-button @click="showSmartSplitDialog = false">取消</el-button>
        <el-button @click="handleSmartSplitReanalyze" :loading="smartSplitReanalyzing">
          重新分析
        </el-button>
        <el-button
          v-if="smartSplitSegments.some((s: any) => s.filePath && !s.is_migrated)"
          type="success"
          :disabled="!hasMigratableSegments"
          @click="handleBatchMigrate"
          :loading="batchMigrating"
        >
          一键迁移
        </el-button>
        <el-button
          v-if="!smartSplitAllSplit"
          type="primary"
          @click="handleSmartSplitExecute"
          :loading="smartSplitExecuting"
        >
          开始分割
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
          v-if="previewVideoUrl"
          :src="previewVideoUrl"
          controls
          autoplay
          style="width: 100%; max-height: 70vh"
        />
      </div>
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Loading } from "@element-plus/icons-vue";
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
  MagicStick,
} from "@element-plus/icons-vue";

// 数据
const videoList = ref<any[]>([]);
const loading = ref(false);
const selectedIds = ref<number[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);

// 当前操作的视频
const currentVideo = ref<any>(null);

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

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const offset = (currentPage.value - 1) * pageSize.value;
    const [result, countResult] = await Promise.all([
      window.electronAPI.getMaterialVideoList(pageSize.value, offset),
      window.electronAPI.getMaterialVideoCount(),
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

// 格式化时长
const formatDuration = (seconds: number | undefined | null) => {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// 选择变化
const handleSelectionChange = (selection: any[]) => {
  selectedIds.value = selection.map((item) => item.id);
};

// 操作命令处理
const handleCommand = (command: string, row: any) => {
  currentVideo.value = row;
  switch (command) {
    case "preview":
      handlePreview(row);
      break;
    case "openFolder":
      handleOpenFolder(row);
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
    case "smartSplit":
      handleSmartSplit(row);
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

    // 调用新的添加视频接口（自动复制、获取信息、保存）
    const addResult = await window.electronAPI.addMaterialVideoWithCopy(
      result.filePaths,
    );

    if (addResult.success) {
      const successCount = addResult.results.filter((r) => r.success).length;
      const failCount = addResult.results.filter((r) => !r.success).length;

      if (failCount > 0) {
        ElMessage.warning(
          `成功添加 ${successCount} 个视频，失败 ${failCount} 个`,
        );
        // 显示失败详情
        addResult.results
          .filter((r) => !r.success)
          .forEach((r) => {
            console.error(`视频 ${r.file_name} 添加失败:`, r.error);
          });
      } else {
        ElMessage.success(`成功添加 ${successCount} 个视频`);
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

// 预览视频
const handlePreview = (row: any) => {
  window.electronAPI.openExternal(row.file_path);
};

// 打开文件所在目录
const handleOpenFolder = (row: any) => {
  window.electronAPI.showItemInFolder(row.file_path);
};

// 删除
const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm("确定要删除这个视频吗？", "提示", {
      type: "warning",
    });
    await window.electronAPI.deleteMaterialVideo([id]);
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
    await window.electronAPI.deleteMaterialVideo([...selectedIds.value]);
    ElMessage.success("删除成功");
    loadData();
  } catch (error) {
    if (error !== "cancel") {
      console.error("删除失败:", error);
      ElMessage.error("删除失败");
    }
  }
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
        splitForm.value.outputDir || undefined,
      );
    } else {
      result = await window.electronAPI.splitByScene(
        currentVideo.value.file_path,
        splitForm.value.threshold,
        splitForm.value.outputDir || undefined,
      );
    }

    if (result.success) {
      ElMessage.success(
        `分割成功，共生成 ${result!.data.segments.length} 个片段`,
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
      cutForm.value.outputPath || undefined,
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

// 视频预览（应用内）
const previewDialogVisible = ref(false);
const previewVideoUrl = ref('');

// ==================== 智能分割相关 ====================
const showSmartSplitDialog = ref(false);
const smartSplitPhase = ref<'analyzing' | 'preview' | 'executing' | 'done'>('analyzing');
const smartSplitStatusText = ref('');
const smartSplitSegments = ref<Array<{ id?: number; startTime: number; endTime: number; description: string; keywords?: string; filePath?: string; is_migrated?: number }>>([]);
const smartSplitSelectedSegments = ref<Array<{ id?: number; startTime: number; endTime: number; description: string; keywords?: string; filePath?: string; is_migrated?: number }>>([]);
const smartSplitExecuting = ref(false);
const smartSplitReanalyzing = ref(false);
const smartSplitProgress = ref(0);
const smartSplitOutputFiles = ref<string[]>([]);
const batchMigrating = ref(false);

// 异步 Batch 智能分割相关
const smartSplitBatchId = ref('');
let smartSplitPollTimer: ReturnType<typeof setInterval> | null = null;
const smartSplitPollCount = ref(0);
const smartSplitPreDeductedPoints = ref(0);  // 预扣除的积分

const smartSplitSelectedAll = computed(() => {
  return smartSplitSegments.value.length > 0 &&
    smartSplitSelectedSegments.value.length === smartSplitSegments.value.length;
});

const smartSplitAllSplit = computed(() => {
  return smartSplitSegments.value.length > 0 &&
    smartSplitSegments.value.every(seg => !!seg.filePath);
});

const hasMigratableSegments = computed(() => {
  return smartSplitSelectedSegments.value.length > 0;
});

const handleSmartSplitSelectAll = () => {
  if (smartSplitSelectedAll.value) {
    smartSplitSelectedSegments.value = [];
  } else {
    // 只选中未迁移的片段
    smartSplitSelectedSegments.value = smartSplitSegments.value.filter((s: any) => !s.is_migrated);
  }
};

const handleSmartSplitSelectionChange = (selection: any[]) => {
  smartSplitSelectedSegments.value = selection;
};

// 预览已分割的视频片段（应用内播放）
const handlePreviewSegment = async (filePath: string) => {
  try {
    const result = await window.electronAPI.readVideoFile(filePath);
    if (!result.success) {
      ElMessage.error('读取视频文件失败: ' + result.error);
      return;
    }

    const blob = new Blob([result.buffer!], { type: result.mimeType });
    const blobUrl = URL.createObjectURL(blob);

    // 释放之前的 Blob URL
    if (previewVideoUrl.value && previewVideoUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(previewVideoUrl.value);
    }

    previewVideoUrl.value = blobUrl;
    previewDialogVisible.value = true;
  } catch (error) {
    console.error('预览视频片段失败:', error);
    ElMessage.error('预览视频片段失败');
  }
};

// 预览对话框关闭时释放 Blob URL
const handlePreviewClosed = () => {
  if (previewVideoUrl.value && previewVideoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewVideoUrl.value);
  }
  previewVideoUrl.value = '';
};

// 迁移分割片段至素材库
const handleMigrateToDraft = async (row: any) => {
  if (!row.filePath) return;

  try {
    const result = await window.electronAPI.addDraftVideoWithCopy([row.filePath]);
    if (result.success) {
      const res = result.results[0];
      if (res?.success && res.id) {
        // 设置分析状态为已分析
        await window.electronAPI.updateDraftVideoAnalysisStatus(res.id, 2);
        // 如果有关键词，更新到素材视频
        if (row.keywords) {
          await window.electronAPI.updateDraftVideoAnalysis(res.id, row.keywords);
        }
        // 标记分析结果为已迁移
        if (row.id) {
          await window.electronAPI.smartSplitMarkMigrated(row.id);
          row.is_migrated = 1;
        }
        ElMessage.success('已迁移至素材库');
      } else {
        ElMessage.error('迁移失败: ' + (res?.error || '未知错误'));
      }
    } else {
      ElMessage.error('迁移失败: ' + (result.error || '未知错误'));
    }
  } catch (error: any) {
    console.error('迁移至素材库失败:', error);
    ElMessage.error('迁移至素材库失败');
  }
};

// 批量迁移选中的分割片段至素材库
const handleBatchMigrate = async () => {

  if (smartSplitSelectedSegments.value.length === 0) return;

  const migratable = smartSplitSelectedSegments.value.filter(
    (seg: any) => seg.filePath && !seg.is_migrated
  );

  if (migratable.length === 0) {
    ElMessage.warning('没有可迁移的片段');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要将选中的 ${migratable.length} 个片段迁移至素材库吗？`,
      '一键迁移',
      { type: 'info' }
    );
  } catch {
    return;
  }

  batchMigrating.value = true;
  let successCount = 0;
  let failCount = 0;

  for (const seg of migratable) {
    try {
      const result = await window.electronAPI.addDraftVideoWithCopy([seg.filePath!]);
      if (result.success) {
        const res = result.results[0];
        if (res?.success && res.id) {
          await window.electronAPI.updateDraftVideoAnalysisStatus(res.id, 2);
          if ((seg as any).keywords) {
            await window.electronAPI.updateDraftVideoAnalysis(res.id, (seg as any).keywords);
          }
          if (seg.id) {
            await window.electronAPI.smartSplitMarkMigrated(seg.id);
            (seg as any).is_migrated = 1;
          }
          successCount++;
        } else {
          failCount++;
        }
      } else {
        failCount++;
      }
    } catch {
      failCount++;
    }
  }

  batchMigrating.value = false;

  if (failCount === 0) {
    ElMessage.success(`成功迁移 ${successCount} 个片段`);
  } else {
    ElMessage.warning(`成功 ${successCount} 个，失败 ${failCount} 个`);
  }
};

const handleSmartSplit = async (row: any) => {
  // 1. 校验时长不超过2小时
  if (row.duration > 7200) {
    ElMessage.warning('视频时长超过2小时，不支持智能分割');
    return;
  }

  // 2. 校验文件大小不超过1.5G
  const SIZE_LIMIT = 1.5 * 1024 * 1024 * 1024; // 1.5G
  if (row.size && row.size > SIZE_LIMIT) {
    ElMessage.warning('视频文件超过1.5G，不支持智能分割');
    return;
  }

  currentVideo.value = row;
  smartSplitSegments.value = [];
  smartSplitSelectedSegments.value = [];
  smartSplitProgress.value = 0;
  smartSplitOutputFiles.value = [];

  // 3. 先查询是否已有分析结果
  try {
    const queryResult = await window.electronAPI.smartSplitGetAnalysisResults(row.id);
    if (queryResult.success && queryResult.results && queryResult.results.length > 0) {
      // 已有分析结果，直接进入预览阶段（DB 中时间为毫秒，转为秒）
      const segments = queryResult.results.map((r: any) => ({
        id: r.id,
        startTime: r.segment_start_time / 1000,
        endTime: r.segment_end_time / 1000,
        description: r.description || '',
        keywords: r.keywords || '',
        filePath: r.segment_file_path || undefined,
        is_migrated: r.is_migrated || 0,
      }));
      smartSplitSegments.value = segments;
      smartSplitSelectedSegments.value = [];
      smartSplitPhase.value = 'preview';
      showSmartSplitDialog.value = true;
      return;
    }
  } catch (e) {
    // 查询失败，继续走正常分析流程
  }

  // 4. 无已有结果，进入分析流程
  smartSplitPhase.value = 'analyzing';
  smartSplitStatusText.value = '正在检查积分...';
  showSmartSplitDialog.value = true;

  await doSmartSplitAnalyze(row);
};

// 执行智能分析（首次分析或重新分析）—— 异步 Batch 方案（含积分预扣除）
const doSmartSplitAnalyze = async (row: any) => {
  try {
    // 步骤1: 预估积分
    smartSplitStatusText.value = '正在预估所需积分...';
    const estimateResult = await window.electronAPI.smartSplitEstimatePoints(row.duration);
    if (!estimateResult.success) {
      ElMessage.error('预估积分失败: ' + (estimateResult.error || '未知错误'));
      showSmartSplitDialog.value = false;
      return;
    }
    const estimatedPoints = estimateResult?.estimatedPoints || 0;
    console.log(`[SmartSplit] 预估积分: ${estimatedPoints}`);

    // 步骤2: 检查积分是否足够
    smartSplitStatusText.value = `正在检查积分（需要 ${estimatedPoints.toFixed(1)} 积分）...`;
    const checkResult = await window.electronAPI.smartSplitCheckPoints(estimatedPoints);
    if (checkResult.error) {
      ElMessage.error(checkResult.error);
      showSmartSplitDialog.value = false;
      return;
    }
    if (!checkResult.sufficient) {
      ElMessage.warning(`积分不足，当前剩余 ${checkResult.remaining} 积分，需要 ${estimatedPoints.toFixed(1)} 积分`);
      showSmartSplitDialog.value = false;
      return;
    }

    // 步骤3: 预扣除积分
    smartSplitStatusText.value = `正在预扣除 ${estimatedPoints.toFixed(1)} 积分...`;
    const deductResult = await window.electronAPI.smartSplitPreDeductPoints(estimatedPoints, row.id);
    if (!deductResult.success) {
      ElMessage.error('积分预扣除失败: ' + (deductResult.error || '未知错误'));
      showSmartSplitDialog.value = false;
      return;
    }
    smartSplitPreDeductedPoints.value = estimatedPoints;
    console.log(`[SmartSplit] 预扣除积分成功，剩余: ${deductResult.remainingPoints}`);

    // 步骤4: 提交分析任务
    smartSplitStatusText.value = '正在上传视频并提交分析任务...';

    const analyzeResult = await window.electronAPI.smartSplitAnalyzeAsync(row.file_path, { videoId: row.id });

    if (!analyzeResult.success) {
      ElMessage.error(analyzeResult.error || '提交分析任务失败');
      showSmartSplitDialog.value = false;
      return;
    }

    // 保存 batchId 并开始轮询
    smartSplitBatchId.value = analyzeResult.batchId || '';
    smartSplitPollCount.value = 0;

    // 持久化，以便程序重启后恢复
    await window.electronAPI.setConfig('pending_smart_split_batch', JSON.stringify({
      batchId: analyzeResult.batchId,
      videoId: row.id,
      videoPath: row.file_path,
      preDeductedPoints: estimatedPoints,
    }));

    smartSplitStatusText.value = 'AI 正在分析视频内容（异步任务处理中，约需3-10分钟）...';

    // 开始轮询
    startSmartSplitPolling();
  } catch (error: any) {
    console.error('智能分割分析提交失败:', error);
    ElMessage.error('智能分割分析提交失败: ' + (error.message || '未知错误'));
    showSmartSplitDialog.value = false;
  }
};

// ==================== 异步轮询相关 ====================

const startSmartSplitPolling = () => {
  stopSmartSplitPolling();
  // 立即查询一次
  pollSmartSplitStatus();
  // 每 30 秒轮询一次
  smartSplitPollTimer = setInterval(() => {
    pollSmartSplitStatus();
  }, 30000);
};

const stopSmartSplitPolling = () => {
  if (smartSplitPollTimer) {
    clearInterval(smartSplitPollTimer);
    smartSplitPollTimer = null;
  }
};

const pollSmartSplitStatus = async () => {
  if (!smartSplitBatchId.value) return;

  smartSplitPollCount.value++;

  try {
    const videoId = currentVideo.value?.id;
    const result = await window.electronAPI.smartSplitCheckBatchResult(
      smartSplitBatchId.value,
      videoId,
      smartSplitPreDeductedPoints.value || undefined,
    );

    if (result.error && result.status === 'unknown') {
      // 查询本身出错（batch 任务可能已过期或不存在）
      smartSplitStatusText.value = '查询失败: ' + result.error;
      stopSmartSplitPolling();
      await clearPendingSmartSplit();
      return;
    }

    // 更新状态文本
    if (result.requestCounts) {
      const { total, completed, failed } = result.requestCounts;
      smartSplitStatusText.value = `任务处理中... 已完成: ${completed}/${total}，失败: ${failed}（已轮询 ${smartSplitPollCount.value} 次）`;
    } else {
      smartSplitStatusText.value = `AI 正在分析视频内容（已轮询 ${smartSplitPollCount.value} 次）...`;
    }

    // 终态判断
    const terminalStates = new Set(['completed', 'failed', 'expired', 'cancelled']);
    if (terminalStates.has(result.status)) {
      stopSmartSplitPolling();
      await clearPendingSmartSplit();

      if (result.status === 'completed' && result.segments && result.segments.length > 0) {
        smartSplitSegments.value = result.segments.map((seg: any) => ({
          ...seg,
          filePath: undefined,
          is_migrated: 0,
        }));
        smartSplitSelectedSegments.value = [];
        smartSplitPhase.value = 'preview';

        // 显示积分结算信息
        if (result.settlement) {
          const { actualPoints, difference, settlementType } = result.settlement;
          if (settlementType === 'exact') {
            ElMessage.success(`分析完成，识别到 ${result.segments.length} 个片段，消耗 ${actualPoints.toFixed(1)} 积分`);
          } else if (settlementType === 'refund') {
            ElMessage.success(`分析完成，识别到 ${result.segments.length} 个片段，实际消耗 ${actualPoints.toFixed(1)} 积分，退还 ${Math.abs(difference).toFixed(1)} 积分`);
          } else if (settlementType === 'charge') {
            ElMessage.success(`分析完成，识别到 ${result.segments.length} 个片段，实际消耗 ${actualPoints.toFixed(1)} 积分，补扣 ${difference.toFixed(1)} 积分`);
          }
        } else {
          ElMessage.success(`分析完成，识别到 ${result.segments.length} 个片段`);
        }
      } else if (result.status === 'completed') {
        ElMessage.warning('AI 未能识别出有效的视频片段');
        showSmartSplitDialog.value = false;
      } else {
        ElMessage.error(`分析任务${result.status === 'failed' ? '失败' : result.status === 'expired' ? '已过期' : '已取消'}${result.error ? ': ' + result.error : ''}`);
        showSmartSplitDialog.value = false;
      }
    }
  } catch (error: any) {
    console.error('[SmartSplit] 轮询状态出错:', error);
  }
};

// 取消异步分析
const handleCancelSmartSplit = async () => {
  stopSmartSplitPolling();
  if (smartSplitBatchId.value) {
    try {
      await window.electronAPI.videoAnalysisBatchCancel(smartSplitBatchId.value);
    } catch (e) {
      console.error('[SmartSplit] 取消任务失败:', e);
    }
  }
  await clearPendingSmartSplit();
  showSmartSplitDialog.value = false;
};

// 清除持久化的异步分析信息
const clearPendingSmartSplit = async () => {
  try {
    await window.electronAPI.setConfig('pending_smart_split_batch', '');
  } catch (e) {
    console.error('[SmartSplit] 清除配置失败:', e);
  }
};

// 对话框关闭时的清理（注意：分析阶段的持久化信息不清除，以便下次打开页面时恢复）
const handleSmartSplitDialogClosed = () => {
  stopSmartSplitPolling();
};

// 恢复中断的异步分析任务
const resumePendingSmartSplit = async () => {
  if (showSmartSplitDialog.value) return;

  try {
    const config = await window.electronAPI.getConfig('pending_smart_split_batch');
    if (!config?.value) return;

    const data = JSON.parse(config.value);
    if (!data.batchId) {
      await clearPendingSmartSplit();
      return;
    }

    console.log(`[SmartSplit] 检测到未完成的异步分析任务: ${data.batchId}`);

    // 查询一次状态
    const result = await window.electronAPI.smartSplitCheckBatchResult(data.batchId, data.videoId);
    const terminalStates = new Set(['completed', 'failed', 'expired', 'cancelled', 'unknown']);

    if (terminalStates.has(result.status)) {
      // 已终态，清除配置
      await clearPendingSmartSplit();

      if (result.status === 'completed' && result.segments && result.segments.length > 0) {
        // 任务已完成，结果已保存到 DB。自动打开对话框展示结果
        console.log(`[SmartSplit] 异步分析任务已完成，共 ${result.segments.length} 个片段`);

        const video = await window.electronAPI.getMaterialVideo(data.videoId);
        if (video) {
          currentVideo.value = video;
          smartSplitBatchId.value = '';
          smartSplitPollCount.value = 0;
          smartSplitSegments.value = result.segments.map((seg: any) => ({
            ...seg,
            filePath: undefined,
            is_migrated: 0,
          }));
          smartSplitSelectedSegments.value = [];
          smartSplitPhase.value = 'preview';
          showSmartSplitDialog.value = true;
          ElMessage.success(`检测到已完成的智能分割任务，识别到 ${result.segments.length} 个片段`);
        } else {
          // 视频已被删除，仅提示
          ElMessage.info(`智能分割分析已完成（共 ${result.segments.length} 个片段），但对应视频已被删除`);
        }
      } else if (result.status === 'failed') {
        ElMessage.error('之前的智能分割分析任务失败，请重新尝试');
      } else if (result.status === 'expired') {
        ElMessage.warning('之前的智能分割分析任务已过期，请重新提交');
      }
      return;
    }

    // 任务仍在运行，恢复 UI
    const video = await window.electronAPI.getMaterialVideo(data.videoId);
    if (!video) {
      await clearPendingSmartSplit();
      return;
    }

    currentVideo.value = video;
    smartSplitBatchId.value = data.batchId;
    smartSplitPollCount.value = 0;
    smartSplitSegments.value = [];
    smartSplitSelectedSegments.value = [];
    smartSplitPhase.value = 'analyzing';
    smartSplitStatusText.value = '恢复中... 正在等待 AI 分析结果';
    showSmartSplitDialog.value = true;

    ElMessage.info('检测到未完成的智能分割任务，正在恢复...');

    startSmartSplitPolling();
  } catch (error: any) {
    console.error('[SmartSplit] 恢复任务失败:', error);
    await clearPendingSmartSplit();
  }
};

// 重新分析
const handleSmartSplitReanalyze = async () => {
  if (!currentVideo.value) return;

  smartSplitReanalyzing.value = true;
  try {
    // TODO: 临时跳过积分校验
    // const pointsResult = await window.electronAPI.smartSplitCheckPoints(10);
    // if (pointsResult.error) {
    //   ElMessage.error(pointsResult.error);
    //   return;
    // }
    // if (!pointsResult.sufficient) {
    //   ElMessage.warning('积分不足，无法重新分析');
    //   return;
    // }

    // 删除旧的分析结果
    await window.electronAPI.smartSplitDeleteAnalysisResults(currentVideo.value.id);

    // 切到分析阶段
    smartSplitPhase.value = 'analyzing';
    smartSplitStatusText.value = 'AI 正在重新分析视频内容，请稍候...';
    smartSplitSegments.value = [];
    smartSplitSelectedSegments.value = [];

    await doSmartSplitAnalyze(currentVideo.value);
  } catch (error: any) {
    console.error('重新分析失败:', error);
    ElMessage.error('重新分析失败: ' + (error.message || '未知错误'));
  } finally {
    smartSplitReanalyzing.value = false;
  }
};

const handleSmartSplitExecute = async () => {
  if (smartSplitSelectedSegments.value.length === 0) {
    ElMessage.warning('请至少选择一个片段');
    return;
  }

  smartSplitPhase.value = 'executing';
  smartSplitExecuting.value = true;
  smartSplitProgress.value = 0;

  try {
    const segments = smartSplitSelectedSegments.value;
    const total = segments.length;
    const outputFiles: string[] = [];

    for (let i = 0; i < total; i++) {
      const seg = segments[i];
      // 如果已有本地文件，跳过
      if (seg.filePath) {
        outputFiles.push(seg.filePath);
        continue;
      }
      const duration = seg.endTime - seg.startTime;
      if (duration <= 0) continue;

      smartSplitProgress.value = Math.round((i / total) * 100);

      const result = await window.electronAPI.smartSplitExecute(
        currentVideo.value.file_path,
        [{ id: seg.id, startTime: seg.startTime, endTime: seg.endTime }],
        { videoId: currentVideo.value.id },
      );

      if (result.success && result.outputFiles.length > 0) {
        outputFiles.push(...result.outputFiles);
      }
    }

    smartSplitProgress.value = 100;
    smartSplitOutputFiles.value = outputFiles;

    // 调用归类钩子
    await window.electronAPI.smartSplitClassify({
      sourceVideoId: currentVideo.value.id,
      outputFiles,
      segments: JSON.parse(JSON.stringify(smartSplitSelectedSegments.value)),
    });

    smartSplitPhase.value = 'done';
    ElMessage.success(`分割完成，共生成 ${outputFiles.length} 个视频片段`);
  } catch (error: any) {
    console.error('执行分割失败:', error);
    ElMessage.error('执行分割失败: ' + (error.message || '未知错误'));
    showSmartSplitDialog.value = false;
  } finally {
    smartSplitExecuting.value = false;
  }
};

// 分割完成后，点击"查看结果"回到预览列表（刷新数据以含最新 filePath）
const handleSmartSplitBackToPreview = async () => {
  if (!currentVideo.value) return;
  try {
    const queryResult = await window.electronAPI.smartSplitGetAnalysisResults(currentVideo.value.id);
    if (queryResult.success && queryResult.results && queryResult.results.length > 0) {
      const segments = queryResult.results.map((r: any) => ({
        id: r.id,
        startTime: r.segment_start_time / 1000,
        endTime: r.segment_end_time / 1000,
        description: r.description || '',
        keywords: r.keywords || '',
        filePath: r.segment_file_path || undefined,
        is_migrated: r.is_migrated || 0,
      }));
      smartSplitSegments.value = segments;
      smartSplitSelectedSegments.value = [];
    }
  } catch (e) {
    console.error('刷新分析结果失败:', e);
  }
  smartSplitPhase.value = 'preview';
};

// 初始化
onMounted(() => {
  loadData();
  resumePendingSmartSplit();
});

// 组件卸载时清理
onUnmounted(() => {
  stopSmartSplitPolling();
});
</script>

<style scoped>
.page-container {
  height: 100%;
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

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
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

/* 智能分割 */
.smart-split-analyzing,
.smart-split-executing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  gap: 16px;
}

.smart-split-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.smart-split-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.smart-split-output-list {
  margin-top: 16px;
  font-size: 13px;
  color: #666;
}

.smart-split-output-list ul {
  margin-top: 8px;
  padding-left: 20px;
}

.smart-split-output-list li {
  margin-bottom: 4px;
  word-break: break-all;
}

/* 视频预览 */
.video-preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #000;
  border-radius: 4px;
  overflow: hidden;
}
</style>
