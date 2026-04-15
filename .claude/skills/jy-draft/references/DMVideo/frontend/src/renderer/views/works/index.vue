<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>作品库</span>
          <div class="header-actions">
            <el-button type="primary" @click="handleAddWork">
              <el-icon><Plus /></el-icon>
              添加作品
            </el-button>
            <el-button type="danger" :disabled="selectedIds.length === 0" @click="handleBatchDelete">
              批量删除
            </el-button>
          </div>
        </div>
      </template>

      <!-- 表格 -->
      <el-table
        :data="workList"
        style="width: 100%"
        @selection-change="handleSelectionChange"
        v-loading="loading"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="缩略图" width="120">
          <template #default="{ row }">
            <el-image
              v-if="row.thumbnail"
              :src="row.thumbnail"
              style="width: 100px; height: 60px"
              fit="cover"
            />
            <div v-else class="no-thumbnail">无缩略图</div>
          </template>
        </el-table-column>
        <el-table-column prop="file_name" label="文件名" min-width="150" />
        <el-table-column prop="platform" label="平台" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.platform">{{ row.platform }}</el-tag>
            <span v-else class="no-data">未发布</span>
          </template>
        </el-table-column>
        <el-table-column label="数据" width="280">
          <template #default="{ row }">
            <div class="stats-container">
              <span><el-icon><View /></el-icon> {{ row.play_count || 0 }}</span>
              <span><el-icon><Star /></el-icon> {{ row.like_count || 0 }}</span>
              <span><el-icon><ChatDotRound /></el-icon> {{ row.comment_count || 0 }}</span>
              <span><el-icon><Share /></el-icon> {{ row.share_count || 0 }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150">
          <template #default="{ row }">
            <span v-if="row.remark">{{ row.remark }}</span>
            <span v-else class="no-data">无备注</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handlePreview(row)">预览</el-button>
            <el-button type="success" size="small" @click="handleEditRemark(row)">备注</el-button>
            <el-button type="warning" size="small" @click="handleMonitor(row)">监控</el-button>
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

    <!-- 备注对话框 -->
    <el-dialog v-model="showRemarkDialog" title="编辑备注" width="400px">
      <el-input
        v-model="remarkContent"
        type="textarea"
        :rows="4"
        placeholder="请输入备注"
      />
      <template #footer>
        <el-button @click="showRemarkDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRemark">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, View, Star, ChatDotRound, Share } from '@element-plus/icons-vue';

// 数据
const workList = ref<any[]>([]);
const loading = ref(false);
const selectedIds = ref<number[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);

// 备注对话框
const showRemarkDialog = ref(false);
const remarkContent = ref('');
const editingId = ref<number | null>(null);

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const offset = (currentPage.value - 1) * pageSize.value;
    const result = await window.electronAPI.getWorkList(pageSize.value, offset);
    workList.value = result;
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

// 添加作品
const handleAddWork = async () => {
  try {
    const result = await window.electronAPI.openVideo(false);
    if (result.canceled || result.filePaths.length === 0) return;

    const filePath = result.filePaths[0];
    await window.electronAPI.addWork({
      file_path: filePath,
      file_name: filePath.split(/[/\\]/).pop()
    });

    ElMessage.success('添加成功');
    loadData();
  } catch (error) {
    console.error('添加作品失败:', error);
    ElMessage.error('添加作品失败');
  }
};

// 删除
const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这个作品吗？', '提示', {
      type: 'warning'
    });
    await window.electronAPI.deleteWork([id]);
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
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 个作品吗？`, '提示', {
      type: 'warning'
    });
    await window.electronAPI.deleteWork(selectedIds.value);
    ElMessage.success('删除成功');
    loadData();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
};

// 预览
const handlePreview = (row: any) => {
  window.electronAPI.openExternal(row.file_path);
};

// 编辑备注
const handleEditRemark = (row: any) => {
  editingId.value = row.id;
  remarkContent.value = row.remark || '';
  showRemarkDialog.value = true;
};

// 保存备注
const handleSaveRemark = async () => {
  if (editingId.value === null) return;

  try {
    await window.electronAPI.updateWorkRemark(editingId.value, remarkContent.value);
    ElMessage.success('保存成功');
    showRemarkDialog.value = false;
    loadData();
  } catch (error) {
    console.error('保存备注失败:', error);
    ElMessage.error('保存备注失败');
  }
};

// 监控
const handleMonitor = (row: any) => {
  ElMessage.info('作品监控功能开发中...');
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

.no-thumbnail {
  width: 100px;
  height: 60px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #999;
}

.no-data {
  color: #999;
  font-size: 12px;
}

.stats-container {
  display: flex;
  gap: 15px;
}

.stats-container span {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>