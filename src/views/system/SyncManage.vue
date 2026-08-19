<template>
  <div class="flex-fill">
    <div class="v-container">
      <div class="v-card sync-card">
        <div class="header">
          <div><h2>数据同步运维</h2><span>Canal → Kafka → Elasticsearch</span></div>
          <div><el-button @click="loadAll">刷新</el-button><el-button type="primary" @click="rebuild">全量重建</el-button><el-button type="success" @click="consistency">检查并修复</el-button></div>
        </div>
        <div class="metrics">
          <div v-for="item in metricCards" :key="item.label" class="metric"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div>
        </div>
        <el-alert :type="overview.enabled ? 'success' : 'warning'" :closable="false" show-icon>
          <template #title>{{ overview.enabled ? '同步链路已启用' : '同步链路未启用，请检查 sync.enabled 配置' }}</template>
          <div v-if="overview.checkpoint">最新位点：{{ overview.checkpoint.binlogFile }} : {{ overview.checkpoint.binlogPosition }}，更新时间 {{ overview.checkpoint.updatedAt }}</div>
        </el-alert>

        <div class="section-title"><span>索引维护任务</span></div>
        <el-table :data="jobs" stripe>
          <el-table-column prop="id" label="任务" width="80" />
          <el-table-column prop="jobType" label="类型" width="170" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="进度" min-width="180"><template #default="scope"><el-progress :percentage="jobProgress(scope.row)" /></template></el-table-column>
          <el-table-column label="差异" min-width="260"><template #default="scope">缺失 {{ scope.row.missingCount }} / 错误 {{ scope.row.staleCount }} / 多余 {{ scope.row.extraCount }} / 已修复 {{ scope.row.repairedCount }}</template></el-table-column>
          <el-table-column prop="errorMessage" label="错误" min-width="200" show-overflow-tooltip />
        </el-table>

        <div class="section-title">
          <span>同步事件</span>
          <div><el-select v-model="status" clearable placeholder="全部状态" @change="reloadEvents"><el-option v-for="item in statuses" :key="item" :label="item" :value="item" /></el-select><el-button type="danger" plain @click="replayDead">批量重放死信</el-button></div>
        </div>
        <el-table :data="events" v-loading="loading" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="sourceTable" label="表" width="110" />
          <el-table-column prop="eventType" label="事件" width="90" />
          <el-table-column label="聚合对象" min-width="170"><template #default="scope">{{ scope.row.aggregateType }}:{{ scope.row.aggregateKey }}</template></el-table-column>
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="attempts" label="重试" width="70" />
          <el-table-column label="Binlog 位点" min-width="190"><template #default="scope">{{ scope.row.binlogFile }}:{{ scope.row.binlogPosition }}</template></el-table-column>
          <el-table-column prop="errorMessage" label="错误" min-width="220" show-overflow-tooltip />
          <el-table-column label="操作" width="90"><template #default="scope"><el-button v-if="scope.row.status === 'DEAD'" link type="primary" @click="replay(scope.row.id)">重放</el-button></template></el-table-column>
        </el-table>
        <el-pagination class="pagination" background layout="prev, pager, next" :total="total" :page-size="20" v-model:current-page="page" @current-change="loadEvents" />
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'SyncManage',
  data() { return { overview: {}, jobs: [], events: [], total: 0, page: 1, status: '', loading: false, timer: null, statuses: ['PENDING', 'RETRY', 'SUCCESS', 'DEAD'] }; },
  computed: {
    metricCards() { return [
      { label: '待处理', value: this.overview.pending || 0 }, { label: '等待重试', value: this.overview.retry || 0 },
      { label: '已成功', value: this.overview.success || 0 }, { label: '死信', value: this.overview.dead || 0 }
    ]; }
  },
  methods: {
    headers() { return { Authorization: 'Bearer ' + localStorage.getItem('teri_token') }; },
    async loadAll() {
      const [overview, jobs] = await Promise.all([this.$get('/admin/sync/overview', { headers: this.headers() }), this.$get('/admin/sync/jobs', { headers: this.headers() })]);
      if (overview.data.code === 200) this.overview = overview.data.data || {};
      if (jobs.data.code === 200) this.jobs = jobs.data.data || [];
      await this.loadEvents();
    },
    async loadEvents() {
      this.loading = true;
      try {
        const res = await this.$get('/admin/sync/events', { params: { status: this.status || undefined, page: this.page, size: 20 }, headers: this.headers() });
        if (res.data.code === 200) { this.events = res.data.data.list || []; this.total = res.data.data.total || 0; }
      } finally { this.loading = false; }
    },
    reloadEvents() { this.page = 1; this.loadEvents(); },
    async rebuild() { const res = await this.$post('/admin/sync/index/rebuild', null, { headers: this.headers() }); this.feedback(res, '全量重建已启动'); },
    async consistency() { const res = await this.$post('/admin/sync/index/consistency', null, { params: { repair: true }, headers: this.headers() }); this.feedback(res, '一致性检查与修复已启动'); },
    async replay(id) { const res = await this.$post(`/admin/sync/events/${id}/replay`, null, { headers: this.headers() }); this.feedback(res, '事件已重新入队'); },
    async replayDead() {
      await ElMessageBox.confirm('确定重新处理全部死信事件吗？', '批量重放', { type: 'warning' });
      const res = await this.$post('/admin/sync/events/replay-dead', null, { headers: this.headers() }); this.feedback(res, '死信已批量重新入队');
    },
    feedback(res, success) { if (res.data.code === 200 || res.data.code === 202) { ElMessage.success(success); this.loadAll(); } else ElMessage.error(res.data.message || '操作失败'); },
    jobProgress(job) { return job.total > 0 ? Math.min(100, Math.round(job.processed / job.total * 100)) : (job.status === 'SUCCESS' ? 100 : 0); }
  },
  mounted() { this.loadAll(); this.timer = setInterval(this.loadAll, 5000); },
  beforeUnmount() { if (this.timer) clearInterval(this.timer); }
};
</script>

<style scoped>
.sync-card { min-height: calc(100vh - 96px); padding: 22px; box-sizing: border-box; }
.header, .section-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.header h2 { display: inline; margin-right: 12px; }.header span { color: #909399; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 22px 0; }
.metric { padding: 18px; border: 1px solid #ebeef5; border-radius: 8px; }.metric span { color: #909399; }.metric strong { display: block; margin-top: 8px; font-size: 28px; }
.section-title { margin: 26px 0 12px; font-size: 17px; font-weight: 600; }.section-title .el-select { width: 140px; margin-right: 10px; }
.pagination { justify-content: flex-end; margin-top: 18px; }
@media (max-width: 800px) { .metrics { grid-template-columns: repeat(2, 1fr); }.header { align-items: flex-start; flex-direction: column; } }
</style>
