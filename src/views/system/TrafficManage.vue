<template>
  <div class="flex-fill">
    <div class="v-container">
      <div class="v-card traffic-card">
        <div class="header">
          <div><h2>Kafka 流量治理</h2><span>播放削峰、业务日志、死信重放与单机限流</span></div>
          <el-button @click="loadAll">刷新</el-button>
        </div>
        <div class="metrics">
          <div v-for="item in metricCards" :key="item.label" class="metric"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div>
        </div>
        <el-alert :type="overview.kafkaEnabled ? 'success' : 'warning'" :closable="false" show-icon>
          <template #title>{{ overview.kafkaEnabled ? 'Kafka 削峰链路运行中' : 'Kafka 未启用，播放量使用同步回退，异步业务日志暂停' }}</template>
          <div>播放主题：{{ overview.playTopic || '-' }} / 日志主题：{{ overview.businessLogTopic || '-' }}</div>
        </el-alert>

        <el-tabs v-model="tab" class="tabs" @tab-change="loadCurrentTab">
          <el-tab-pane label="播放事件" name="plays">
            <div class="toolbar">
              <el-select v-model="playStatus" clearable placeholder="全部状态" @change="reloadPlays"><el-option v-for="item in statuses" :key="item" :label="item" :value="item" /></el-select>
              <el-button type="danger" plain @click="replayAllPlayDead">批量重试失败播放</el-button>
            </div>
            <el-table :data="plays" v-loading="loading" stripe>
              <el-table-column prop="id" label="ID" width="80" /><el-table-column prop="vid" label="视频" width="90" />
              <el-table-column prop="actorType" label="用户类型" width="110" /><el-table-column prop="status" label="状态" width="100" />
              <el-table-column prop="attempts" label="重试" width="70" /><el-table-column prop="occurredAt" label="发生时间" min-width="170" />
              <el-table-column prop="errorMessage" label="错误" min-width="240" show-overflow-tooltip />
              <el-table-column label="操作" width="90"><template #default="scope"><el-button v-if="scope.row.status === 'DEAD'" link type="primary" @click="replayPlay(scope.row.id)">重试</el-button></template></el-table-column>
            </el-table>
            <el-pagination class="pagination" background layout="prev, pager, next" :total="playTotal" :page-size="20" v-model:current-page="playPage" @current-change="loadPlays" />
          </el-tab-pane>

          <el-tab-pane label="业务日志" name="logs">
            <div class="toolbar"><el-select v-model="logAction" clearable placeholder="全部动作" @change="reloadLogs"><el-option v-for="item in actions" :key="item" :label="item" :value="item" /></el-select></div>
            <el-table :data="logs" v-loading="loading" stripe>
              <el-table-column prop="traceId" label="Trace ID" min-width="230" show-overflow-tooltip /><el-table-column prop="action" label="动作" width="150" />
              <el-table-column prop="path" label="路径" min-width="190" /><el-table-column prop="responseStatus" label="状态码" width="90" />
              <el-table-column prop="latencyMs" label="耗时(ms)" width="100" /><el-table-column prop="occurredAt" label="发生时间" min-width="170" />
            </el-table>
            <el-pagination class="pagination" background layout="prev, pager, next" :total="logTotal" :page-size="20" v-model:current-page="logPage" @current-change="loadLogs" />
          </el-tab-pane>

          <el-tab-pane label="Kafka 死信" name="deadLetters">
            <el-table :data="deadLetters" v-loading="loading" stripe>
              <el-table-column prop="id" label="ID" width="80" /><el-table-column prop="sourceTopic" label="原主题" min-width="220" />
              <el-table-column prop="sourcePartition" label="分区" width="70" /><el-table-column prop="sourceOffset" label="位点" width="90" />
              <el-table-column prop="status" label="状态" width="100" /><el-table-column prop="createdAt" label="进入时间" min-width="170" />
              <el-table-column label="操作" width="90"><template #default="scope"><el-button v-if="scope.row.status === 'OPEN'" link type="primary" @click="replayDeadLetter(scope.row.id)">重放</el-button></template></el-table-column>
            </el-table>
            <el-pagination class="pagination" background layout="prev, pager, next" :total="deadTotal" :page-size="20" v-model:current-page="deadPage" @current-change="loadDeadLetters" />
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'TrafficManage',
  data() { return {
    overview: {}, tab: 'plays', loading: false, timer: null,
    plays: [], playTotal: 0, playPage: 1, playStatus: '', statuses: ['PENDING', 'RETRY', 'SUCCESS', 'DEAD'],
    logs: [], logTotal: 0, logPage: 1, logAction: '', actions: ['VIDEO_PLAY', 'VIDEO_ATTITUDE', 'COMMENT_ADD'],
    deadLetters: [], deadTotal: 0, deadPage: 1
  }; },
  computed: {
    metricCards() { const runtime = this.overview.runtime || {}; return [
      { label: '待聚合', value: this.overview.pending || 0 }, { label: '等待重试', value: this.overview.retry || 0 },
      { label: '失败播放', value: this.overview.dead || 0 }, { label: 'Kafka 死信', value: this.overview.openDeadLetters || 0 },
      { label: '今日业务日志', value: this.overview.logsToday || 0 }, { label: '本次启动放行', value: runtime.accepted || 0 },
      { label: '本次启动限流', value: runtime.rejected || 0 }, { label: '已聚合播放', value: runtime.aggregated || 0 }
    ]; }
  },
  methods: {
    headers() { return { Authorization: 'Bearer ' + localStorage.getItem('teri_token') }; },
    async loadAll() {
      try { const res = await this.$get('/admin/traffic/overview', { headers: this.headers() }); if (res.data.code === 200) this.overview = res.data.data || {}; }
      catch (e) { ElMessage.error('读取流量治理数据失败，请确认已执行数据库迁移'); }
      await this.loadCurrentTab();
    },
    loadCurrentTab() { if (this.tab === 'plays') return this.loadPlays(); if (this.tab === 'logs') return this.loadLogs(); return this.loadDeadLetters(); },
    async loadPlays() { this.loading = true; try { const res = await this.$get('/admin/traffic/play-events', { params: { status: this.playStatus || undefined, page: this.playPage, size: 20 }, headers: this.headers() }); if (res.data.code === 200) { this.plays = res.data.data.list || []; this.playTotal = res.data.data.total || 0; } } finally { this.loading = false; } },
    async loadLogs() { this.loading = true; try { const res = await this.$get('/admin/traffic/logs', { params: { action: this.logAction || undefined, page: this.logPage, size: 20 }, headers: this.headers() }); if (res.data.code === 200) { this.logs = res.data.data.list || []; this.logTotal = res.data.data.total || 0; } } finally { this.loading = false; } },
    async loadDeadLetters() { this.loading = true; try { const res = await this.$get('/admin/traffic/dead-letters', { params: { page: this.deadPage, size: 20 }, headers: this.headers() }); if (res.data.code === 200) { this.deadLetters = res.data.data.list || []; this.deadTotal = res.data.data.total || 0; } } finally { this.loading = false; } },
    reloadPlays() { this.playPage = 1; this.loadPlays(); }, reloadLogs() { this.logPage = 1; this.loadLogs(); },
    async replayPlay(id) { const res = await this.$post('/admin/traffic/play-events/replay-dead', null, { params: { id }, headers: this.headers() }); this.feedback(res, '播放事件已重新入队'); },
    async replayAllPlayDead() { await ElMessageBox.confirm('确定重新处理全部失败播放事件吗？', '批量重试', { type: 'warning' }); const res = await this.$post('/admin/traffic/play-events/replay-dead', null, { headers: this.headers() }); this.feedback(res, '失败播放已批量重新入队'); },
    async replayDeadLetter(id) { const res = await this.$post(`/admin/traffic/dead-letters/${id}/replay`, null, { headers: this.headers() }); this.feedback(res, 'Kafka 死信已重放'); },
    feedback(res, success) { if (res.data.code === 200) { ElMessage.success(success); this.loadAll(); } else ElMessage.error(res.data.message || '操作失败'); }
  },
  mounted() { this.loadAll(); this.timer = setInterval(this.loadAll, 5000); },
  beforeUnmount() { if (this.timer) clearInterval(this.timer); }
};
</script>

<style scoped>
.traffic-card { min-height: calc(100vh - 96px); padding: 22px; box-sizing: border-box; }
.header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }.header h2 { display: inline; margin-right: 12px; }.header span { color: #909399; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 22px 0; }.metric { padding: 16px; border: 1px solid #ebeef5; border-radius: 8px; }.metric span { color: #909399; }.metric strong { display: block; margin-top: 8px; font-size: 26px; }
.tabs { margin-top: 22px; }.toolbar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 12px; }.toolbar .el-select { width: 180px; }.pagination { justify-content: flex-end; margin-top: 18px; }
@media (max-width: 900px) { .metrics { grid-template-columns: repeat(2, 1fr); }.header { align-items: flex-start; flex-direction: column; } }
</style>
