<template>
  <div class="flex-fill">
    <div class="v-container">
      <div class="v-card task-card">
        <div class="toolbar">
          <div><strong>视频转码队列</strong><span class="total">共 {{ total }} 条</span></div>
          <div>
            <el-select v-model="status" clearable placeholder="全部状态" @change="reload">
              <el-option v-for="item in statuses" :key="item" :label="statusName(item)" :value="item" />
            </el-select>
            <el-button @click="reload">刷新</el-button>
          </div>
        </div>
        <el-table :data="rows" v-loading="loading" stripe>
          <el-table-column label="任务" width="90"><template #default="scope">#{{ scope.row.task.id }}</template></el-table-column>
          <el-table-column label="视频 / 投稿" min-width="220">
            <template #default="scope">
              <div v-for="video in scope.row.videos" :key="video.vid">#{{ video.vid }} {{ video.title }}</div>
              <span v-if="!scope.row.videos.length">暂未创建投稿</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110"><template #default="scope"><el-tag :type="tagType(scope.row.task.status)">{{ statusName(scope.row.task.status) }}</el-tag></template></el-table-column>
          <el-table-column label="队列位置" width="100"><template #default="scope">{{ scope.row.task.status === 'RUNNING' ? '执行中' : (scope.row.queuePosition > 0 ? `第 ${scope.row.queuePosition} 位` : '-') }}</template></el-table-column>
          <el-table-column label="进度" min-width="180"><template #default="scope"><el-progress :percentage="scope.row.task.progress || 0" /></template></el-table-column>
          <el-table-column label="编码器" width="100"><template #default="scope">{{ scope.row.task.encoder }}</template></el-table-column>
          <el-table-column label="尝试" width="80"><template #default="scope">{{ scope.row.task.attempts }}/3</template></el-table-column>
          <el-table-column label="源信息" min-width="170"><template #default="scope">{{ assetInfo(scope.row.asset) }}</template></el-table-column>
          <el-table-column prop="task.errorMessage" label="错误" min-width="220" show-overflow-tooltip />
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="scope"><el-button v-if="scope.row.task.status === 'FAILED'" link type="primary" @click="retry(scope.row.task.id)">重试</el-button></template>
          </el-table-column>
        </el-table>
        <el-pagination class="pagination" background layout="prev, pager, next" :total="total" :page-size="20" v-model:current-page="page" @current-change="load" />
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';

export default {
  name: 'TranscodeTasks',
  data() {
    return { rows: [], total: 0, page: 1, status: '', loading: false, timer: null, statuses: ['QUEUED', 'RUNNING', 'RETRY', 'SUCCESS', 'FAILED'] };
  },
  methods: {
    async load() {
      this.loading = true;
      try {
        const res = await this.$get('/admin/transcode/tasks', {
          params: { status: this.status || undefined, page: this.page, size: 20 },
          headers: { Authorization: 'Bearer ' + localStorage.getItem('teri_token') }
        });
        if (res.data.code === 200) { this.rows = res.data.data.list || []; this.total = res.data.data.total || 0; }
      } finally { this.loading = false; }
    },
    reload() { this.page = 1; this.load(); },
    async retry(id) {
      const res = await this.$post(`/admin/transcode/tasks/${id}/retry`, null, { headers: { Authorization: 'Bearer ' + localStorage.getItem('teri_token') } });
      if (res.data.code === 200) { ElMessage.success('已重新加入队列'); this.load(); }
      else ElMessage.error(res.data.message || '重试失败');
    },
    statusName(status) { return ({ QUEUED: '排队中', RUNNING: '转码中', RETRY: '等待重试', SUCCESS: '已完成', FAILED: '失败' })[status] || status; },
    tagType(status) { return ({ RUNNING: 'warning', SUCCESS: 'success', FAILED: 'danger', RETRY: 'warning' })[status] || 'info'; },
    assetInfo(asset) { return asset ? `${asset.width || '?'}×${asset.height || '?'} / ${Math.round(asset.duration || 0)}秒` : '-'; }
  },
  mounted() { this.load(); this.timer = setInterval(this.load, 5000); },
  beforeUnmount() { if (this.timer) clearInterval(this.timer); }
};
</script>

<style scoped>
.task-card { min-height: calc(100vh - 96px); padding: 20px; box-sizing: border-box; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.toolbar strong { font-size: 18px; }
.toolbar .total { margin-left: 12px; color: #909399; }
.toolbar .el-select { width: 140px; margin-right: 10px; }
.pagination { justify-content: flex-end; margin-top: 20px; }
</style>
