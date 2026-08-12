<template>
  <div class="page">
    <div class="toolbar">
      <div>
        <h2>用户管理</h2>
        <p>管理员可封禁用户；超级管理员还可以授予或撤销管理员身份。</p>
      </div>
      <div class="search">
        <el-input v-model="keyword" clearable placeholder="用户名或昵称" @keyup.enter="loadUsers" />
        <el-button type="primary" @click="search">查询</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="users" stripe>
      <el-table-column prop="uid" label="UID" width="85" />
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column prop="nickname" label="昵称" min-width="140">
        <template #default="scope">{{ scope.row.nickname || '-' }}</template>
      </el-table-column>
      <el-table-column label="身份" width="120">
        <template #default="scope">
          <el-tag :type="roleType(scope.row.role)">{{ roleName(scope.row.role) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="GitHub" width="100">
        <template #default="scope">{{ scope.row.githubLinked ? '已绑定' : '未绑定' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.state === 1 ? 'danger' : 'success'">
            {{ scope.row.state === 1 ? '已封禁' : '正常' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" min-width="170">
        <template #default="scope">{{ formatDate(scope.row.createDate) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="scope">
          <el-button
            size="small"
            :type="scope.row.state === 1 ? 'success' : 'danger'"
            :disabled="!canManage(scope.row)"
            @click="changeState(scope.row)"
          >
            {{ scope.row.state === 1 ? '解除封禁' : '封禁' }}
          </el-button>
          <el-button
            v-if="isSuperAdmin && scope.row.role !== 2"
            size="small"
            :type="scope.row.role === 1 ? 'warning' : 'primary'"
            :disabled="scope.row.uid === currentUserId"
            @click="changeRole(scope.row)"
          >
            {{ scope.row.role === 1 ? '撤销管理员' : '设为管理员' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="pagination"
      background
      layout="total, prev, pager, next, sizes"
      :total="total"
      v-model:current-page="page"
      v-model:page-size="size"
      :page-sizes="[10, 20, 50, 100]"
      @current-change="loadUsers"
      @size-change="changeSize"
    />
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'UserManage',
  data() {
    return {
      users: [],
      keyword: '',
      page: 1,
      size: 20,
      total: 0,
      loading: false,
    };
  },
  computed: {
    currentRole() {
      return Number(localStorage.getItem('teri_role') || 1);
    },
    isSuperAdmin() {
      return this.currentRole === 2;
    },
    currentUserId() {
      return this.$store.state.user?.uid;
    },
  },
  methods: {
    async loadUsers() {
      this.loading = true;
      try {
        const response = await this.$axios.get('/api/admin/users', {
          params: { page: this.page, size: this.size, keyword: this.keyword || undefined },
        });
        this.users = response.data.data.records;
        this.total = response.data.data.total;
      } catch (error) {
        ElMessage.error(error.response?.data?.message || '用户列表加载失败');
      } finally {
        this.loading = false;
      }
    },
    search() {
      this.page = 1;
      this.loadUsers();
    },
    changeSize() {
      this.page = 1;
      this.loadUsers();
    },
    canManage(user) {
      return user.uid !== this.currentUserId && user.role < this.currentRole;
    },
    async changeState(user) {
      const nextState = user.state === 1 ? 0 : 1;
      const action = nextState === 1 ? '封禁' : '解除封禁';
      try {
        await ElMessageBox.confirm(`确定要${action}用户“${user.username}”吗？`, '确认操作', {
          type: 'warning',
        });
        await this.$axios.patch(`/api/admin/users/${user.uid}/state`, { state: nextState });
        ElMessage.success(`${action}成功`);
        this.loadUsers();
      } catch (error) {
        if (error !== 'cancel' && error !== 'close') {
          ElMessage.error(error.response?.data?.message || `${action}失败`);
        }
      }
    },
    async changeRole(user) {
      const nextRole = user.role === 1 ? 0 : 1;
      const action = nextRole === 1 ? '授予管理员身份' : '撤销管理员身份';
      try {
        await ElMessageBox.confirm(`确定要为“${user.username}”${action}吗？该用户的现有登录会话会立即失效。`, '确认操作', {
          type: 'warning',
        });
        await this.$axios.patch(`/api/admin/users/${user.uid}/role`, { role: nextRole });
        ElMessage.success('身份已更新');
        this.loadUsers();
      } catch (error) {
        if (error !== 'cancel' && error !== 'close') {
          ElMessage.error(error.response?.data?.message || '身份更新失败');
        }
      }
    },
    roleName(role) {
      return ['普通用户', '管理员', '超级管理员'][role] || '未知';
    },
    roleType(role) {
      return role === 2 ? 'danger' : role === 1 ? 'warning' : 'info';
    },
    formatDate(value) {
      return value ? new Date(value).toLocaleString('zh-CN') : '-';
    },
  },
  mounted() {
    this.loadUsers();
  },
};
</script>

<style scoped>
.page { padding: 24px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
h2 { margin: 0 0 8px; }
p { margin: 0; color: #777; }
.search { display: flex; gap: 10px; width: 360px; align-items: center; }
.pagination { margin-top: 20px; justify-content: flex-end; }
@media (max-width: 800px) {
  .toolbar { flex-direction: column; }
  .search { width: 100%; }
}
</style>
