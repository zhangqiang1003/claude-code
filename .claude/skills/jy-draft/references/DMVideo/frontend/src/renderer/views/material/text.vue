<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>材料库 - 文案</span>
          <div class="header-actions">
            <el-button type="primary" @click="handleOpenAddDialog">
              <el-icon><Plus /></el-icon>
              添加文案
            </el-button>
            <el-button type="danger" :disabled="selectedIds.length === 0" @click="handleBatchDelete">
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
        <el-table-column prop="content" label="文案内容" min-width="300">
          <template #default="{ row }">
            <div class="text-content">{{ row.content }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="100">
          <template #default="{ row }">
            <el-tag :type="getSourceType(row.source)">{{ getSourceLabel(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleRewrite(row)">仿写</el-button>
            <el-button type="warning" size="small" @click="handleEdit(row)">编辑</el-button>
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

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingId ? '编辑文案' : '添加文案'"
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
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" :disabled="!formData.content.trim()" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';

// 数据
const textList = ref<any[]>([]);
const loading = ref(false);
const selectedIds = ref<number[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);

// 对话框
const showAddDialog = ref(false);
const editingId = ref<number | null>(null);
const formData = ref({
  content: '',
  source: 'manual'
});

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const offset = (currentPage.value - 1) * pageSize.value;
    const result = await window.electronAPI.getMaterialTextList(pageSize.value, offset);
    textList.value = result;
    total.value = result.length; // 实际应用中应该从后端获取总数
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

// 来源标签
const getSourceType = (source: string) => {
  const types: Record<string, string> = {
    manual: 'info',
    rewrite: 'success',
    extract: 'warning'
  };
  return types[source] || 'info';
};

const getSourceLabel = (source: string) => {
  const labels: Record<string, string> = {
    manual: '手动输入',
    rewrite: '仿写',
    extract: '提取'
  };
  return labels[source] || source;
};

// 打开添加对话框
const handleOpenAddDialog = () => {
  resetForm();
  showAddDialog.value = true;
};

// 取消
const handleCancel = () => {
  showAddDialog.value = false;
  resetForm();
};

// 添加/编辑保存
const handleSave = async () => {
  if (!formData.value.content.trim()) {
    ElMessage.warning('请输入文案内容');
    return;
  }

  try {
    if (editingId.value) {
      await window.electronAPI.updateMaterialText(editingId.value, formData.value.content);
      ElMessage.success('更新成功');
    } else {
      await window.electronAPI.addMaterialText(formData.value.content, formData.value.source);
      ElMessage.success('添加成功');
    }
    showAddDialog.value = false;
    resetForm();
    loadData();
  } catch (error) {
    console.error('保存失败:', error);
    ElMessage.error('保存失败');
  }
};

// 编辑
const handleEdit = (row: any) => {
  editingId.value = row.id;
  formData.value = {
    content: row.content,
    source: row.source
  };
  showAddDialog.value = true;
};

// 删除
const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这条文案吗？', '提示', {
      type: 'warning'
    });
    await window.electronAPI.deleteMaterialText([id]);
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
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 条文案吗？`, '提示', {
      type: 'warning'
    });
    await window.electronAPI.deleteMaterialText([...selectedIds.value]);
    ElMessage.success('删除成功');
    loadData();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
};

// 仿写
const handleRewrite = (row: any) => {
  ElMessage.info('仿写功能开发中...');
  // TODO: 调用AI接口进行仿写
};

// 重置表单
const resetForm = () => {
  editingId.value = null;
  formData.value = {
    content: '',
    source: 'manual'
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
</style>