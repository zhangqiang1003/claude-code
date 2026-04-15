<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>材料库 - 作品地址</span>
          <div class="header-actions">
            <el-button type="primary" @click="showAddDialog = true">
              <el-icon><Plus /></el-icon>
              添加地址
            </el-button>
            <el-button type="danger" :disabled="selectedIds.length === 0" @click="handleBatchDelete">
              批量删除
            </el-button>
          </div>
        </div>
      </template>

      <!-- 表格 -->
      <el-table
        :data="urlList"
        style="width: 100%"
        @selection-change="handleSelectionChange"
        v-loading="loading"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="url" label="地址" min-width="300">
          <template #default="{ row }">
            <a :href="row.url" target="_blank" class="url-link">{{ row.url }}</a>
          </template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" width="100">
          <template #default="{ row }">
            <el-tag :type="getPlatformType(row.platform)">{{ row.platform || '未知' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content_type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.content_type === 'video' ? 'success' : 'warning'">
              {{ row.content_type === 'video' ? '视频' : '图片' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="添加时间" width="180" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleExtractText(row)">提取文案</el-button>
            <el-button type="success" size="small" @click="handleRewrite(row)">仿写</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row.id)">删除</el-button>
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

    <!-- 添加对话框 -->
    <el-dialog v-model="showAddDialog" title="添加作品地址" width="500px">
      <el-form :model="formData" label-width="80px">
        <el-form-item label="地址">
          <el-input v-model="formData.url" placeholder="请输入作品地址" />
        </el-form-item>
        <el-form-item label="平台">
          <el-select v-model="formData.platform" placeholder="请选择平台">
            <el-option label="抖音" value="dy" />
            <el-option label="小红书" value="xhs" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="formData.content_type">
            <el-radio label="video">视频</el-radio>
            <el-radio label="image">图片</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';

// 数据
const urlList = ref<any[]>([]);
const loading = ref(false);
const selectedIds = ref<number[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);

// 对话框
const showAddDialog = ref(false);
const formData = ref({
  url: '',
  platform: 'dy',
  content_type: 'video'
});

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const offset = (currentPage.value - 1) * pageSize.value;
    const result = await window.electronAPI.getMaterialUrlList(pageSize.value, offset);
    urlList.value = result;
    total.value = result.length;
  } catch (error) {
    console.error('加载数据失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
};

// 选择变化
const handleSelectionChange = (selection: any[]) => {
  selectedIds.value = selection.map(item => item.id);
};

// 平台标签
const getPlatformType = (platform: string) => {
  const types: Record<string, string> = {
    dy: 'danger',
    xhs: 'warning',
    other: 'info'
  };
  return types[platform] || 'info';
};

// 保存
const handleSave = async () => {
  if (!formData.value.url.trim()) {
    ElMessage.warning('请输入地址');
    return;
  }

  try {
    await window.electronAPI.addMaterialUrl(formData.value);
    ElMessage.success('添加成功');
    showAddDialog.value = false;
    resetForm();
    loadData();
  } catch (error) {
    console.error('保存失败:', error);
    ElMessage.error('保存失败');
  }
};

// 删除
const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这条记录吗？', '提示', {
      type: 'warning'
    });
    await window.electronAPI.deleteMaterialUrl([id]);
    ElMessage.success('删除成功');
    loadData();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
};

// 批量删除
const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 条记录吗？`, '提示', {
      type: 'warning'
    });
    await window.electronAPI.deleteMaterialUrl(selectedIds.value);
    ElMessage.success('删除成功');
    loadData();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
};

// 提取文案
const handleExtractText = (row: any) => {
  ElMessage.info('提取文案功能开发中...');
};

// 仿写
const handleRewrite = (row: any) => {
  ElMessage.info('仿写功能开发中...');
};

// 重置表单
const resetForm = () => {
  formData.value = {
    url: '',
    platform: 'dy',
    content_type: 'video'
  };
};

// 初始化
onMounted(() => {
  loadData();
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

.url-link {
  color: #1890ff;
  text-decoration: none;
}

.url-link:hover {
  text-decoration: underline;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>