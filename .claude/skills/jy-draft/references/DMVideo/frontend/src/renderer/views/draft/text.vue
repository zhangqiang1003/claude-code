<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>素材库 - 文案</span>
          <div class="header-actions">
            <el-button type="primary" @click="showAddDialog = true">
              <el-icon><Plus /></el-icon>
              添加文案
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
        :data="textList"
        style="width: 100%"
        @selection-change="handleSelectionChange"
        v-loading="loading"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="content" label="文案内容" min-width="350">
          <template #default="{ row }">
            <el-tooltip
              v-if="row.content"
              :content="row.content"
              placement="top"
              :show-after="500"
              popper-class="text-content-tooltip"
            >
              <div class="text-content">{{ row.content }}</div>
            </el-tooltip>
            <div v-else class="text-content">-</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="(row.status ?? 0) === 1 ? 'success' : 'info'"
              size="small"
            >
              {{ (row.status ?? 0) === 1 ? "已使用" : "待使用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              type="success"
              size="small"
              @click="openTextToVideoDialog(row)"
              >文生视频</el-button
            >
            <el-button type="primary" size="small" @click="handleEdit(row)"
              >编辑</el-button
            >
            <el-button type="danger" size="small" @click="handleDelete(row.id)"
              >删除</el-button
            >
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

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="isEdit ? '编辑文案' : '添加文案'"
      width="600px"
    >
      <el-form :model="formData" label-width="80px">
        <el-form-item label="文案内容">
          <el-input
            v-model="formData.content"
            type="textarea"
            :rows="6"
            placeholder="请输入文案内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSave">{{
          isEdit ? "保存" : "添加"
        }}</el-button>
      </template>
    </el-dialog>

    <!-- 断点续传确认对话框 -->
    <el-dialog
      v-model="showResumeDialog"
      title="发现未完成的任务"
      width="500px"
      :close-on-click-modal="false"
    >
      <div v-if="resumableTask" class="resume-dialog-content">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        >
          <template #title> 检测到该文案有未完成的视频生成任务 </template>
        </el-alert>

        <div class="task-info">
          <p><strong>创建时间：</strong>{{ resumableTask.created_at }}</p>
        </div>

        <el-divider />

        <p class="resume-tip">
          选择"继续执行"将从中断位置继续，无需重复已完成步骤；
          选择"重新开始"将放弃已有数据，重新生成。
        </p>
      </div>

      <template #footer>
        <el-button @click="startNewTask">重新开始</el-button>
        <el-button type="primary" @click="resumeTask">继续执行</el-button>
      </template>
    </el-dialog>

    <!-- 文生视频配置对话框 -->
    <el-dialog
      v-model="showTextToVideoDialog"
      title="文生视频配置"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="textToVideoConfig" label-width="100px">
        <el-form-item label="文案内容">
          <el-input
            v-model="selectedTextContent"
            type="textarea"
            :rows="3"
            readonly
          />
        </el-form-item>

        <el-form-item label="草稿名称">
          <el-input
            v-model="textToVideoConfig.draftName"
            placeholder="留空则自动使用日期作为名称"
            clearable
          />
        </el-form-item>

        <el-form-item label="音色类型">
          <el-radio-group
            v-model="textToVideoConfig.voiceType"
            @change="handleVoiceTypeChange"
          >
            <el-radio value="system">系统音色</el-radio>
            <el-radio value="cloned">克隆音色</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item
          v-if="textToVideoConfig.voiceType === 'system'"
          label="系统音色"
        >
          <el-select
            v-model="textToVideoConfig.voiceId"
            placeholder="请选择系统音色"
            style="width: 100%"
            filterable
          >
            <el-option-group
              v-for="category in filteredSystemVoices"
              :key="category.group"
              :label="category.group"
            >
              <el-option
                v-for="voice in category.voices"
                :key="voice.value"
                :label="voice.label"
                :value="voice.value"
              />
            </el-option-group>
          </el-select>
        </el-form-item>

        <el-form-item v-else label="克隆音色">
          <el-select
            v-model="textToVideoConfig.clonedVoiceId"
            placeholder="请选择克隆音色"
            style="width: 100%"
            @change="handleClonedVoiceChange"
          >
            <el-option
              v-for="voice in clonedVoices"
              :key="voice.id"
              :label="voice.voice_tag"
              :value="voice.voice_id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="音色模型">
          <el-select
            v-model="textToVideoConfig.voiceModelId"
            placeholder="请选择音色模型"
            style="width: 100%"
            :disabled="textToVideoConfig.voiceType === 'cloned'"
            @change="handleModelChange"
          >
            <template v-if="textToVideoConfig.voiceType === 'system'">
              <el-option
                label="CosyVoice V3 Flash（快速，音色丰富）"
                value="cosyvoice-v3-flash"
              />
              <el-option
                label="CosyVoice V3 Plus（高质量，仅标杆音色）"
                value="cosyvoice-v3-plus"
              />
            </template>
            <template v-else>
              <el-option
                label="CosyVoice V3.5 Plus（高质量）"
                value="cosyvoice-v3.5-plus"
              />
              <el-option
                label="CosyVoice V3.5 Flash（快速）"
                value="cosyvoice-v3.5-flash"
              />
              <el-option
                label="CosyVoice V3 Plus（高质量）"
                value="cosyvoice-v3-plus"
              />
              <el-option
                label="CosyVoice V3 Flash（快速）"
                value="cosyvoice-v3-flash"
              />
            </template>
          </el-select>
          <span
            v-if="textToVideoConfig.voiceType === 'system'"
            class="model-hint"
          >
            V3.5 版本模型不支持系统音色，已自动过滤
          </span>
          <span
            v-if="textToVideoConfig.voiceType === 'cloned'"
            class="model-hint"
          >
            已自动关联克隆音色的音色模型
          </span>
        </el-form-item>

        <el-form-item label="视频画布">
          <el-row :gutter="20">
            <el-col :span="12">
              <div style="display: flex; align-items: center; gap: 8px">
                <span style="white-space: nowrap">宽</span>
                <el-input-number
                  v-model="textToVideoConfig.canvasWidth"
                  :min="320"
                  :max="4096"
                  style="flex: 1"
                />
              </div>
            </el-col>
            <el-col :span="12">
              <div style="display: flex; align-items: center; gap: 8px">
                <span style="white-space: nowrap">高</span>
                <el-input-number
                  v-model="textToVideoConfig.canvasHeight"
                  :min="240"
                  :max="4096"
                  style="flex: 1"
                />
              </div>
            </el-col>
          </el-row>
        </el-form-item>

        <el-form-item label="省份筛选">
          <el-select
            v-model="textToVideoConfig.selectedProvinces"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择省份（可选，多选）"
            style="width: 100%"
            @change="handleProvinceChange"
          >
            <el-option
              v-for="item in provinceOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="城市筛选">
          <el-select
            v-model="textToVideoConfig.selectedCities"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择城市（可选，多选）"
            style="width: 100%"
            :disabled="textToVideoConfig.selectedProvinces.length === 0"
          >
            <el-option
              v-for="item in cityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="地点关键词">
          <el-select
            v-model="textToVideoConfig.placeKeywords"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入地点关键词（可选，多选）"
            style="width: 100%"
            :no-data-text="'输入关键词后按回车添加'"
          >
            <el-option
              v-for="item in usedPlaceOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTextToVideoDialog = false">取消</el-button>
        <el-button
          type="primary"
          @click="startTextToVideo"
          :loading="isStarting"
        >
          开始生成
        </el-button>
      </template>
    </el-dialog>

    <!-- 进度对话框 -->
    <el-dialog
      v-model="showProgressDialog"
      :title="
        isCompleted ? '生成完成' : hasError ? '生成失败' : '视频生成中...'
      "
      width="500px"
      :close-on-click-modal="false"
      :show-close="false"
    >
      <div class="progress-content">
        <!-- 生成中状态 -->
        <div v-if="!isCompleted && !hasError" class="progress-loading">
          <el-icon class="loading-icon is-loading"><Loading /></el-icon>
          <!-- <p class="loading-title">{{ currentStepTitle }}</p> -->
          <p class="loading-tip">请耐心等待，这可能需要几分钟时间...</p>
        </div>
        <!-- 完成状态 -->
        <div v-else-if="isCompleted" class="progress-success">
          <el-icon class="success-icon"><CircleCheck /></el-icon>
          <p class="success-title">视频草稿生成完成！</p>
          <p class="success-tip">点击"完成"按钮关闭此窗口</p>
        </div>
        <!-- 错误状态 -->
        <div v-else-if="hasError" class="progress-error">
          <el-icon class="error-icon"><CircleClose /></el-icon>
          <p class="error-title">生成失败</p>
          <p class="error-message">{{ errorMessage }}</p>
        </div>
      </div>
      <template #footer>
        <el-button
          v-if="isCompleted || hasError"
          type="primary"
          @click="closeProgressDialog"
        >
          {{ hasError ? "关闭" : "完成" }}
        </el-button>
        <el-button v-else type="danger" @click="cancelTask">取消</el-button>
      </template>
    </el-dialog>

    <!-- 草稿审核对话框 -->
    <DraftReviewDialog
      v-model="showReviewDialog"
      :video-tracks="reviewMaterials?.videoTracks || []"
      :audio-tracks="reviewMaterials?.audioTracks || []"
      :text-tracks="reviewMaterials?.textTracks || []"
      :bg-music-config="reviewMaterials?.bgMusicConfig || []"
      @confirm="handleReviewConfirm"
      @skip="handleReviewSkip"
      @cancel="handleReviewCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Plus,
  Loading,
  CircleCheck,
  CircleClose,
} from "@element-plus/icons-vue";
import DraftReviewDialog from "./DraftReviewDialog.vue";

// CosyVoice v3 系统音色列表（按场景分类，基于阿里云官方文档）
// plusCompatible: 标记该音色同时兼容 v3-plus 模型（v3-plus 仅支持 2 个标杆音色）
const systemVoiceCategories = [
  {
    group: "标杆音色（支持情感控制）",
    voices: [
      {
        label: "龙安洋 - 阳光大男孩（20~30岁）",
        value: "longanyang",
        plusCompatible: true,
      },
      {
        label: "龙安欢 - 欢脱元气女（20~30岁）",
        value: "longanhuan",
        plusCompatible: true,
      },
    ],
  },
  {
    group: "语音助手",
    voices: [
      { label: "龙小淳 - 知性积极女（25~30岁）", value: "longxiaochun_v3" },
      { label: "龙小夏 - 沉稳权威女（25~30岁）", value: "longxiaoxia_v3" },
      { label: "YUMI - 正经青年女（20~25岁）", value: "longyumi_v3" },
      { label: "龙安昀 - 居家暖男（30~35岁）", value: "longanyun_v3" },
      { label: "龙安温 - 优雅知性女（25~35岁）", value: "longanwen_v3" },
      { label: "龙安莉 - 利落从容女（25~35岁）", value: "longanli_v3" },
      { label: "龙安朗 - 清爽利落男（20~25岁）", value: "longanlang_v3" },
      { label: "龙应沐 - 优雅知性女（25~30岁）", value: "longyingmu_v3" },
    ],
  },
  {
    group: "社交陪伴",
    voices: [
      { label: "龙安台 - 嗲甜台湾女（20~25岁）", value: "longantai_v3" },
      { label: "龙华 - 元气甜美女（20~25岁）", value: "longhua_v3" },
      { label: "龙橙 - 智慧青年男（20~25岁）", value: "longcheng_v3" },
      { label: "龙泽 - 温暖元气男（25~30岁）", value: "longze_v3" },
      { label: "龙哲 - 呆板大暖男（25~30岁）", value: "longzhe_v3" },
      { label: "龙颜 - 温暖春风女（30~35岁）", value: "longyan_v3" },
      { label: "龙星 - 温婉邻家女（20~25岁）", value: "longxing_v3" },
      { label: "龙天 - 磁性理智男（30~35岁）", value: "longtian_v3" },
      { label: "龙婉 - 细腻柔声女（20~30岁）", value: "longwan_v3" },
      { label: "龙嫱 - 浪漫风情女（30~35岁）", value: "longqiang_v3" },
      { label: "龙菲菲 - 甜美娇气女（20~25岁）", value: "longfeifei_v3" },
      { label: "龙浩 - 多情忧郁男（30~35岁）", value: "longhao_v3" },
      { label: "龙安柔 - 温柔闺蜜女（20~35岁）", value: "longanrou_v3" },
      { label: "龙寒 - 温暖痴情男（30~35岁）", value: "longhan_v3" },
      { label: "龙安智 - 睿智轻熟男（25~35岁）", value: "longanzhi_v3" },
      { label: "龙安灵 - 思维灵动女（20~30岁）", value: "longanling_v3" },
      { label: "龙安雅 - 高雅气质女（25~35岁）", value: "longanya_v3" },
      { label: "龙安亲 - 亲和活泼女（20~25岁）", value: "longanqin_v3" },
    ],
  },
  {
    group: "有声书",
    voices: [
      { label: "龙妙 - 抑扬顿挫女（25~30岁）", value: "longmiao_v3" },
      { label: "龙三叔 - 沉稳质感男（25~45岁）", value: "longsanshu_v3" },
      { label: "龙媛 - 温暖治愈女（35~40岁）", value: "longyuan_v3" },
      { label: "龙悦 - 温暖磁性女（30~35岁）", value: "longyue_v3" },
      { label: "龙修 - 博才说书男（25~35岁）", value: "longxiu_v3" },
      { label: "龙楠 - 睿智青年男（25~30岁）", value: "longnan_v3" },
      { label: "龙婉君 - 细腻柔声女（20~30岁）", value: "longwanjun_v3" },
      { label: "龙逸尘 - 洒脱活力男（20~30岁）", value: "longyichen_v3" },
      { label: "龙老伯 - 沧桑岁月爷（60岁以上）", value: "longlaobo_v3" },
      { label: "龙老姨 - 烟火从容阿姨（60岁以上）", value: "longlaoyi_v3" },
    ],
  },
  {
    group: "新闻播报",
    voices: [
      { label: "龙硕 - 博才干练男（25~30岁）", value: "longshuo_v3" },
      { label: "龙书 - 沉稳青年男（20~25岁）", value: "longshu_v3" },
      { label: "Bella3.0 - 精准干练女（25~30岁）", value: "loongbella_v3" },
    ],
  },
  {
    group: "客服",
    voices: [
      { label: "龙应询 - 年轻青涩男（20~25岁）", value: "longyingxun_v3" },
      { label: "龙应静 - 低调冷静女（25~35岁）", value: "longyingjing_v3" },
      { label: "龙应聆 - 温和共情女（25~30岁）", value: "longyingling_v3" },
      { label: "龙应桃 - 温柔淡定女（25~30岁）", value: "longyingtao_v3" },
    ],
  },
  {
    group: "直播带货",
    voices: [
      { label: "龙安燃 - 活泼质感女（30~40岁）", value: "longanran_v3" },
      { label: "龙安宣 - 经典直播女（30~40岁）", value: "longanxuan_v3" },
    ],
  },
  {
    group: "电话销售",
    voices: [
      { label: "龙应笑 - 清甜推销女（20~25岁）", value: "longyingxiao_v3" },
    ],
  },
  {
    group: "短视频配音",
    voices: [
      { label: "龙机器 - 呆萌机器人（20~30岁）", value: "longjiqi_v3" },
      { label: "龙猴哥 - 经典猴哥（20~25岁）", value: "longhouge_v3" },
      { label: "龙黛玉 - 娇率才女音（15~25岁）", value: "longdaiyu_v3" },
    ],
  },
  {
    group: "诗词朗诵",
    voices: [{ label: "龙飞 - 热血磁性男（30~35岁）", value: "longfei_v3" }],
  },
  {
    group: "童声",
    voices: [
      {
        label: "龙呼呼 - 天真烂漫女童（6~10岁）",
        value: "longhuhu_v3",
        plusCompatible: true,
      },
      { label: "龙泡泡 - 飞天泡泡音（6~15岁）", value: "longpaopao_v3" },
      { label: "龙杰力豆 - 阳光顽皮男（10岁）", value: "longjielidou_v3" },
      { label: "龙仙 - 豪放可爱女（12岁）", value: "longxian_v3" },
      { label: "龙铃 - 稚气呆板女（10岁）", value: "longling_v3" },
      { label: "龙闪闪 - 戏剧化童声（6~15岁）", value: "longshanshan_v3" },
      { label: "龙牛牛 - 阳光男童声（6~15岁）", value: "longniuniu_v3" },
    ],
  },
  {
    group: "方言",
    voices: [
      { label: "龙嘉欣 - 优雅粤语女（30~35岁）", value: "longjiaxin_v3" },
      { label: "龙嘉怡 - 知性粤语女（25~30岁）", value: "longjiayi_v3" },
      { label: "龙安粤 - 欢脱粤语男（25~35岁）", value: "longanyue_v3" },
      { label: "龙老铁 - 东北直率男（25~30岁）", value: "longlaotie_v3" },
      { label: "龙陕哥 - 原味陕北男（25~35岁）", value: "longshange_v3" },
      { label: "龙安闽 - 清纯萝莉女（18~25岁）", value: "longanmin_v3" },
    ],
  },
  {
    group: "出海营销",
    voices: [
      { label: "loongkyong - 韩语女（25~30岁）", value: "loongkyong_v3" },
      { label: "Riko - 二次元霓虹女（18~25岁）", value: "loongriko_v3" },
      {
        label: "loongtomoka - 日语女（30~35岁）",
        value: "loongtomoka_v3",
      },
    ],
  },
];

// 数据
const textList = ref<any[]>([]);
const loading = ref(false);
const selectedIds = ref<number[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);

// 对话框
const showAddDialog = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const formData = ref({
  content: "",
});

// 文生视频相关
const showTextToVideoDialog = ref(false);
const showProgressDialog = ref(false);
const isStarting = ref(false);
const selectedTextId = ref<number | null>(null);
const selectedTextContent = ref("");
const clonedVoices = ref<any[]>([]);
const currentTaskId = ref<number | null>(null);

// 断点续传相关
const showResumeDialog = ref(false);
const resumableTask = ref<any>(null);
const isCheckingResume = ref(false);

// 草稿审核相关
const showReviewDialog = ref(false);
const reviewTaskId = ref<number | null>(null);
const reviewMaterials = ref<{
  videoTracks: any[];
  audioTracks: any[];
  textTracks: any[];
  bgMusicConfig: any[];
} | null>(null);
let unsubscribeReview: (() => void) | null = null;

// 地区数据
const placeData = ref<Record<string, Record<string, string>>>({});
const provinceOptions = ref<{ value: string; label: string }[]>([]);
const cityOptions = ref<{ value: string; label: string }[]>([]);

// 已使用的地点数据（从素材库视频中聚合）
const usedLocations = ref<{
  provinces: string[];
  cities: string[];
  places: string[];
}>({ provinces: [], cities: [], places: [] });

// 生成默认草稿名称（yyyymmddhhmmss）
const generateDefaultDraftName = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

// 文生视频配置
const textToVideoConfig = ref({
  voiceType: "system",
  voiceId: "longanyang",
  clonedVoiceId: "",
  voiceModelId: "cosyvoice-v3-flash",
  isMuted: false,
  // 草稿名称
  draftName: "",
  // 视频画布尺寸
  canvasWidth: 1080,
  canvasHeight: 1920,
  // 省份（多选）
  selectedProvinces: [] as string[],
  // 城市（多选）
  selectedCities: [] as string[],
  // 地点关键词（多选）
  placeKeywords: [] as string[],
});

// 步骤定义（key 必须与后端 stepKey 一致）
const steps = ref([
  {
    key: "tts_local_path",
    title: "语音合成",
    status: "wait" as string,
    error: "",
  },
  {
    key: "asr_content",
    title: "音频文案提取",
    status: "wait" as string,
    error: "",
  },
  { key: "keywords", title: "关键词查询", status: "wait" as string, error: "" },
  {
    key: "short_sentences",
    title: "关键词绑定",
    status: "wait" as string,
    error: "",
  },
  {
    key: "video_timelines",
    title: "视频匹配",
    status: "wait" as string,
    error: "",
  },
  {
    key: "draft_populate",
    title: "素材准备",
    status: "wait" as string,
    error: "",
  },
  // draft_review 已停用，待轨道编辑功能完善后恢复
  {
    key: "draft_generate",
    title: "草稿生成",
    status: "wait" as string,
    error: "",
  },
]);

// 计算属性
const currentStepIndex = computed(() => {
  const processingIndex = steps.value.findIndex(
    (s) => s.status === "processing",
  );
  if (processingIndex >= 0) return processingIndex;
  const successCount = steps.value.filter((s) => s.status === "success").length;
  return successCount;
});

const isCompleted = computed(() => {
  return steps.value.every(
    (s) =>
      s.status === "success" || s.status === "warning" || s.status === "finish",
  );
});

const hasError = computed(() => {
  return steps.value.some((s) => s.status === "error");
});

// 当前步骤标题
const currentStepTitle = computed(() => {
  const processingStep = steps.value.find(
    (s) => s.status === "process" || s.status === "processing",
  );
  if (processingStep) {
    return `正在${processingStep.title}...`;
  }
  return "准备中...";
});

// 错误信息
const errorMessage = computed(() => {
  const errorStep = steps.value.find((s) => s.status === "error");
  return errorStep?.error || "未知错误";
});

// 根据所选模型过滤系统音色（v3-plus 仅支持标杆音色）
const filteredSystemVoices = computed(() => {
  const model = textToVideoConfig.value.voiceModelId;
  return systemVoiceCategories
    .map((category) => ({
      group: category.group,
      voices: category.voices.filter((voice) => {
        if (model === "cosyvoice-v3-plus") {
          return voice.plusCompatible === true;
        }
        return true;
      }),
    }))
    .filter((category) => category.voices.length > 0);
});

// 已配置的地点选项（用于地点关键词下拉预设）
const usedPlaceOptions = computed(() => {
  return usedLocations.value.places.map((name) => ({
    value: name,
    label: name,
  }));
});

// 音色类型切换：系统音色不支持 v3.5 模型，自动切换到 v3-flash
const handleVoiceTypeChange = (type: string) => {
  if (type === "system") {
    if (textToVideoConfig.value.voiceModelId.includes("v3.5")) {
      textToVideoConfig.value.voiceModelId = "cosyvoice-v3-flash";
    }
  }
};

// 模型切换：v3-plus 仅支持标杆音色，若当前音色不兼容则重置
const handleModelChange = (modelId: string) => {
  if (modelId === "cosyvoice-v3-plus") {
    const currentVoice = textToVideoConfig.value.voiceId;
    const isCompatible = systemVoiceCategories.some((cat) =>
      cat.voices.some((v) => v.value === currentVoice && v.plusCompatible),
    );
    if (!isCompatible) {
      textToVideoConfig.value.voiceId = "longanyang";
    }
  }
};

// 进度监听取消函数
let unsubscribeProgress: (() => void) | null = null;

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const offset = (currentPage.value - 1) * pageSize.value;
    const [result, countResult] = await Promise.all([
      window.electronAPI.getDraftTextList(pageSize.value, offset),
      window.electronAPI.getDraftTextCount(),
    ]);
    textList.value = result;
    total.value = countResult.count;
  } catch (error) {
    console.error("加载数据失败:", error);
    ElMessage.error("加载数据失败");
  } finally {
    loading.value = false;
  }
};

// 加载克隆音色列表
const loadClonedVoices = async () => {
  try {
    const voices = await window.electronAPI.getActiveVoiceClones();
    clonedVoices.value = voices || [];
  } catch (error) {
    console.error("加载克隆音色失败:", error);
  }
};

// 加载已使用的地点数据
const loadUsedLocations = async () => {
  try {
    const result = await window.electronAPI.getDraftVideoUsedLocations();
    if (result.success && result.data) {
      usedLocations.value = result.data;
    }
  } catch (error) {
    console.error("加载已用地点数据失败:", error);
  }
};

// 加载地区数据
const loadPlaceData = async () => {
  try {
    const result = await window.electronAPI.getPlaceData();
    if (result.success && result.data) {
      placeData.value = result.data;
      // 过滤省份选项：只显示素材库中已配置的省份
      const usedProvinceSet = new Set(usedLocations.value.provinces);
      const allProvinces = result.data["0"] || {};
      if (usedProvinceSet.size > 0) {
        provinceOptions.value = Object.entries(allProvinces)
          .filter(([key]) => usedProvinceSet.has(key))
          .map(([key, value]) => ({ value: key, label: value as string }));
      } else {
        provinceOptions.value = Object.entries(allProvinces).map(
          ([key, value]) => ({
            value: key,
            label: value as string,
          }),
        );
      }
    }
  } catch (error) {
    console.error("加载地区数据失败:", error);
  }
};

// 省份变化时更新城市选项
const handleProvinceChange = (provinces: string[]) => {
  // 清空已选城市
  textToVideoConfig.value.selectedCities = [];
  cityOptions.value = [];

  if (!provinces || provinces.length === 0) return;

  // 合并所有选中省份的城市，过滤为只显示素材库中已配置的
  const usedCitySet = new Set(usedLocations.value.cities);
  const cities: { value: string; label: string }[] = [];
  for (const provinceId of provinces) {
    const provinceCities = placeData.value[provinceId] || {};
    for (const [cityId, cityName] of Object.entries(provinceCities)) {
      if (usedCitySet.size === 0 || usedCitySet.has(cityId)) {
        cities.push({
          value: cityId,
          label: cityName as string,
        });
      }
    }
  }
  cityOptions.value = cities;
};

// 克隆音色变化时自动关联音色模型
const handleClonedVoiceChange = (voiceId: string) => {
  if (!voiceId) return;

  // 从克隆音色列表中找到选中的音色
  const selectedVoice = clonedVoices.value.find((v) => v.voice_id === voiceId);
  if (selectedVoice && selectedVoice.voice_model_id) {
    // 自动填充关联的音色模型ID
    textToVideoConfig.value.voiceModelId = selectedVoice.voice_model_id;
    console.log(
      `[TextToVideo] 自动关联音色模型: ${selectedVoice.voice_model_id}`,
    );
  }
};

// 选择变化
const handleSelectionChange = (selection: any[]) => {
  selectedIds.value = selection.map((item) => item.id);
};

// 编辑
const handleEdit = (row: any) => {
  isEdit.value = true;
  editId.value = row.id;
  formData.value.content = row.content;
  showAddDialog.value = true;
};

// 保存
const handleSave = async () => {
  if (!formData.value.content.trim()) {
    ElMessage.warning("请输入文案内容");
    return;
  }

  try {
    if (isEdit.value && editId.value) {
      await window.electronAPI.updateDraftText(
        editId.value,
        formData.value.content,
      );
      ElMessage.success("修改成功");
    } else {
      await window.electronAPI.addDraftText(formData.value.content);
      ElMessage.success("添加成功");
    }
    showAddDialog.value = false;
    formData.value.content = "";
    isEdit.value = false;
    editId.value = null;
    loadData();
  } catch (error) {
    console.error("保存失败:", error);
    ElMessage.error("保存失败");
  }
};

// 删除
const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm("确定要删除这条文案吗？", "提示", {
      type: "warning",
    });
    await window.electronAPI.deleteDraftText([id]);
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
      `确定要删除选中的 ${selectedIds.value.length} 条文案吗？`,
      "提示",
      {
        type: "warning",
      },
    );
    await window.electronAPI.deleteDraftText([...selectedIds.value]);
    ElMessage.success("删除成功");
    loadData();
  } catch (error) {
    if (error !== "cancel") {
      console.error("删除失败:", error);
      ElMessage.error("删除失败");
    }
  }
};

// 打开文生视频配置对话框
const openTextToVideoDialog = async (row: any) => {
  selectedTextId.value = row.id;
  selectedTextContent.value = row.content;

  // 检查是否有可恢复的任务
  isCheckingResume.value = true;
  try {
    const result = await window.electronAPI.textToVideoGetResumableTask(row.id);
    if (result.success && result.task) {
      // 有可恢复的任务，显示确认对话框
      resumableTask.value = result.task;
      showResumeDialog.value = true;
      return;
    }
  } catch (error) {
    console.error("检查可恢复任务失败:", error);
  } finally {
    isCheckingResume.value = false;
  }

  // 没有可恢复的任务，打开配置对话框
  await openNewTaskDialog();
};

// localStorage 键名
const STORAGE_KEY = "textToVideoConfig";

// 默认配置
const defaultConfig = {
  voiceType: "system",
  voiceId: "longanyang",
  clonedVoiceId: "",
  voiceModelId: "cosyvoice-v3-flash",
  canvasWidth: 1920,
  canvasHeight: 1080,
};

// 从 localStorage 加载保存的配置偏好
const loadSavedConfig = (): typeof defaultConfig => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...defaultConfig, ...JSON.parse(saved) };
    }
  } catch (e) {
    // 忽略解析错误
  }
  return { ...defaultConfig };
};

// 保存配置偏好到 localStorage
const saveConfig = () => {
  try {
    const config = {
      voiceType: textToVideoConfig.value.voiceType,
      voiceId: textToVideoConfig.value.voiceId,
      clonedVoiceId: textToVideoConfig.value.clonedVoiceId,
      voiceModelId: textToVideoConfig.value.voiceModelId,
      canvasWidth: textToVideoConfig.value.canvasWidth,
      canvasHeight: textToVideoConfig.value.canvasHeight,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    // 忽略存储错误
  }
};

// 打开新任务配置对话框
const openNewTaskDialog = async () => {
  const saved = loadSavedConfig();
  textToVideoConfig.value = {
    voiceType: saved.voiceType,
    voiceId: saved.voiceId || "",
    clonedVoiceId: saved.clonedVoiceId || "",
    voiceModelId: saved.voiceModelId,
    isMuted: false,
    draftName: "",
    canvasWidth: saved.canvasWidth,
    canvasHeight: saved.canvasHeight,
    selectedProvinces: [],
    selectedCities: [],
    placeKeywords: [],
  };
  cityOptions.value = [];
  await loadUsedLocations();
  await Promise.all([loadClonedVoices(), loadPlaceData()]);
  showTextToVideoDialog.value = true;
};

// 继续执行已有任务（断点续传）
const resumeTask = async () => {
  showResumeDialog.value = false;
  if (!resumableTask.value) return;

  currentTaskId.value = resumableTask.value.id;
  resetSteps();
  showProgressDialog.value = true;

  // 监听进度
  unsubscribeProgress = window.electronAPI.onTextToVideoProgress(
    (progress: any) => {
      updateStepStatus(progress);
    },
  );

  // 监听审核请求
  unsubscribeReview = window.electronAPI.onDraftReviewRequest((data: any) => {
    reviewTaskId.value = data.taskId;
    reviewMaterials.value = {
      videoTracks: data.videoTracks || [],
      audioTracks: data.audioTracks || [],
      textTracks: data.textTracks || [],
      bgMusicConfig: data.bgMusicConfig || [],
    };
    showReviewDialog.value = true;
  });

  // 启动任务
  try {
    const startResult = await window.electronAPI.textToVideoStart(
      resumableTask.value.id,
    );
    if (!startResult.success) {
      ElMessage.error(startResult.error || "启动任务失败");
      showProgressDialog.value = false;
    }
  } catch (error: any) {
    console.error("恢复任务失败:", error);
    ElMessage.error(error.message || "恢复任务失败");
    showProgressDialog.value = false;
  }
};

// 开始新任务（放弃已有数据）
const startNewTask = async () => {
  showResumeDialog.value = false;
  await openNewTaskDialog();
};

// 获取步骤显示名称
const getStepDisplayName = (stepKey: string): string => {
  const stepNames: Record<string, string> = {
    tts_local_path: "语音合成",
    asr_content: "音频识别",
    keywords: "关键词查询",
    short_sentences: "关键词绑定",
    video_timelines: "视频匹配",
    draft_populate: "素材准备",
    draft_review: "素材审核",
    draft_generate: "草稿生成",
  };
  return stepNames[stepKey] || stepKey;
};

// 开始文生视频
const startTextToVideo = async () => {
  // 验证配置
  if (
    textToVideoConfig.value.voiceType === "system" &&
    !textToVideoConfig.value.voiceId
  ) {
    ElMessage.warning("请选择系统音色");
    return;
  }
  if (
    textToVideoConfig.value.voiceType === "cloned" &&
    !textToVideoConfig.value.clonedVoiceId
  ) {
    ElMessage.warning("请选择克隆音色");
    return;
  }

  isStarting.value = true;
  try {
    // 创建任务
    const result = await window.electronAPI.textToVideoCreateTask({
      draft_text_id: selectedTextId.value!,
      voice_id:
        textToVideoConfig.value.voiceType === "system"
          ? textToVideoConfig.value.voiceId
          : textToVideoConfig.value.clonedVoiceId,
      voice_model_id: textToVideoConfig.value.voiceModelId,
      is_muted: textToVideoConfig.value.isMuted,
      draft_name:
        textToVideoConfig.value.draftName.trim() || generateDefaultDraftName(),
      province_at:
        textToVideoConfig.value.selectedProvinces.length > 0
          ? textToVideoConfig.value.selectedProvinces.join(",")
          : undefined,
      city_at:
        textToVideoConfig.value.selectedCities.length > 0
          ? textToVideoConfig.value.selectedCities.join(",")
          : undefined,
      place_at:
        textToVideoConfig.value.placeKeywords.length > 0
          ? textToVideoConfig.value.placeKeywords.join(",")
          : undefined,
      canvas_width: textToVideoConfig.value.canvasWidth,
      canvas_height: textToVideoConfig.value.canvasHeight,
    });

    if (!result.success) {
      ElMessage.error(result.error || "创建任务失败");
      return;
    }

    // 保存用户配置偏好
    saveConfig();

    // 如果选择了克隆音色，更新使用时间
    if (
      textToVideoConfig.value.voiceType === "cloned" &&
      textToVideoConfig.value.clonedVoiceId
    ) {
      const selectedVoice = clonedVoices.value.find(
        (v) => v.voice_id === textToVideoConfig.value.clonedVoiceId,
      );
      if (selectedVoice && selectedVoice.id) {
        try {
          await window.electronAPI.updateVoiceCloneUsedAt(selectedVoice.id);
          console.log(
            `[TextToVideo] 已更新克隆音色使用时间: ${selectedVoice.voice_tag}`,
          );
        } catch (error) {
          console.error("[TextToVideo] 更新克隆音色使用时间失败:", error);
        }
      }
    }

    currentTaskId.value = result.taskId;

    // 关闭配置对话框，显示进度对话框
    showTextToVideoDialog.value = false;
    resetSteps();
    showProgressDialog.value = true;

    // 监听进度
    unsubscribeProgress = window.electronAPI.onTextToVideoProgress(
      (progress: any) => {
        updateStepStatus(progress);
      },
    );

    // 监听审核请求
    unsubscribeReview = window.electronAPI.onDraftReviewRequest((data: any) => {
      reviewTaskId.value = data.taskId;
      reviewMaterials.value = {
        videoTracks: data.videoTracks || [],
        audioTracks: data.audioTracks || [],
        textTracks: data.textTracks || [],
        bgMusicConfig: data.bgMusicConfig || [],
      };
      showReviewDialog.value = true;
    });

    // 启动任务
    const startResult = await window.electronAPI.textToVideoStart(
      result.taskId,
    );
    if (!startResult.success) {
      ElMessage.error(startResult.error || "启动任务失败");
      showProgressDialog.value = false;
    }
  } catch (error: any) {
    console.error("启动文生视频失败:", error);
    ElMessage.error(error.message || "启动失败");
  } finally {
    isStarting.value = false;
  }
};

// 重置步骤状态
const resetSteps = () => {
  steps.value = steps.value.map((s) => ({
    ...s,
    status: "wait",
    error: "",
  }));
};

// 更新步骤状态
const updateStepStatus = (progress: any) => {
  const step = steps.value.find((s) => s.key === progress.stepKey);
  if (!step) return;

  switch (progress.status) {
    case "processing":
      step.status = "process"; // Element Plus ElStep 使用 "process" 而非 "processing"
      break;
    case "completed":
      step.status = "success";
      break;
    case "failed":
      step.status = "error";
      step.error = progress.data?.error || "执行失败";
      // 弹窗提醒用户错误信息
      ElMessageBox.alert(step.error, `${step.title} 失败`, {
        confirmButtonText: "确定",
        type: "error",
      });
      break;
    case "skipped":
      step.status = "finish"; // Element Plus ElStep 不支持 warning，使用 finish 表示跳过
      break;
  }
};

// 取消任务
const cancelTask = async () => {
  if (currentTaskId.value) {
    try {
      await window.electronAPI.textToVideoCancel(currentTaskId.value);
      ElMessage.info("已取消任务");
    } catch (error) {
      console.error("取消任务失败:", error);
    }
  }
  showProgressDialog.value = false;
};

// 关闭进度对话框
const closeProgressDialog = () => {
  showProgressDialog.value = false;
  if (unsubscribeProgress) {
    unsubscribeProgress();
    unsubscribeProgress = null;
  }
  if (unsubscribeReview) {
    unsubscribeReview();
    unsubscribeReview = null;
  }
  // 更新文案状态
  if (selectedTextId.value && isCompleted.value) {
    window.electronAPI.updateDraftTextStatus(selectedTextId.value, 1);
    loadData();
  }
};

// 审核对话框 - 确认
const handleReviewConfirm = async (editedMaterials: any) => {
  if (!reviewTaskId.value) return;

  try {
    // 深拷贝数据以确保可以序列化
    const cleanMaterials = JSON.parse(JSON.stringify(editedMaterials));
    await window.electronAPI.draftReviewSubmit(reviewTaskId.value, {
      action: "confirm",
      editedMaterials: cleanMaterials,
    });
    showReviewDialog.value = false;
    ElMessage.success("已提交编辑结果");
  } catch (error: any) {
    console.error("提交审核结果失败:", error);
    ElMessage.error(error.message || "提交失败");
  }
};

// 审核对话框 - 跳过
const handleReviewSkip = async () => {
  if (!reviewTaskId.value) return;

  try {
    await window.electronAPI.draftReviewSubmit(reviewTaskId.value, {
      action: "skip",
    });
    showReviewDialog.value = false;
    ElMessage.info("已跳过编辑");
  } catch (error: any) {
    console.error("跳过审核失败:", error);
    ElMessage.error(error.message || "操作失败");
  }
};

// 审核对话框 - 取消
const handleReviewCancel = async () => {
  if (!reviewTaskId.value) return;

  try {
    await window.electronAPI.draftReviewSubmit(reviewTaskId.value, {
      action: "cancel",
    });
    showReviewDialog.value = false;
    showProgressDialog.value = false;
    ElMessage.warning("任务已取消");
  } catch (error: any) {
    console.error("取消审核失败:", error);
    ElMessage.error(error.message || "操作失败");
  }
};

// 初始化
onMounted(() => {
  loadData();
});

// 清理
onUnmounted(() => {
  if (unsubscribeProgress) {
    unsubscribeProgress();
  }
  if (unsubscribeReview) {
    unsubscribeReview();
  }
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

.text-content {
  max-height: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.progress-content {
  padding: 20px 0;
}

.progress-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 0;
}

.loading-icon {
  font-size: 48px;
  color: #409eff;
  margin-bottom: 20px;
}

.loading-title {
  font-size: 16px;
  color: #303133;
  margin: 0 0 10px 0;
}

.loading-tip {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.progress-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 0;
}

.success-icon {
  font-size: 48px;
  color: #67c23a;
  margin-bottom: 20px;
}

.success-title {
  font-size: 18px;
  color: #303133;
  margin: 0 0 10px 0;
  font-weight: 500;
}

.success-tip {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.progress-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 0;
}

.error-icon {
  font-size: 48px;
  color: #f56c6c;
  margin-bottom: 20px;
}

.error-title {
  font-size: 18px;
  color: #303133;
  margin: 0 0 10px 0;
  font-weight: 500;
}

.error-message {
  font-size: 14px;
  color: #f56c6c;
  margin: 0;
  text-align: center;
  max-width: 80%;
}

.model-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

/* 断点续传对话框样式 */
.resume-dialog-content {
  padding: 0 10px;
}

.resume-dialog-content .task-info {
  margin: 16px 0;
}

.resume-dialog-content .task-info p {
  margin: 8px 0;
  font-size: 14px;
  color: #606266;
}

.resume-dialog-content .error-text {
  color: #f56c6c;
}

.resume-dialog-content .completed-steps {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e4e7ed;
}

.resume-dialog-content .resume-tip {
  font-size: 13px;
  color: #909399;
  line-height: 1.6;
}
</style>

<!-- 全局样式：文案内容 tooltip 宽度限制为视口宽度的 50% -->
<style>
.text-content-tooltip {
  max-width: 50vw !important;
  word-wrap: break-word;
  white-space: normal;
}
</style>
