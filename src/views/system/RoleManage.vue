<template>
  <el-card class="role-card">
    <template #header><strong>管理员身份说明</strong></template>
    <el-descriptions :column="1" border>
      <el-descriptions-item label="普通用户">只能使用主站功能，不能进入管理端。</el-descriptions-item>
      <el-descriptions-item label="管理员">可以审核内容、处理举报和封禁普通用户。</el-descriptions-item>
      <el-descriptions-item label="超级管理员">除管理员权限外，还可以授予或撤销管理员身份。</el-descriptions-item>
    </el-descriptions>
    <p>项目不引入复杂 RBAC，继续使用原有的三级身份。身份调整统一在用户管理中完成。</p>
    <el-button type="primary" @click="$router.push('/system/user')">前往用户管理</el-button>
  </el-card>
</template>

<script>
export default { name: 'RoleManage' };
</script>

<style scoped>
.role-card { margin: 24px; max-width: 900px; }
p { color: #666; margin: 20px 0; }
</style>
