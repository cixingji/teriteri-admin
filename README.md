# 芙影视界平台管理端

芙影视界管理端是平台运营后台，基于 Vue 3 构建，主要用于管理员登录、视频审核和平台内容管理。普通用户使用客户端，管理员使用本仓库对应的管理端。

## 关联仓库

- [后端服务](https://github.com/cixingji/teriteri-backend)
- [客户端](https://github.com/cixingji/teriteri-client)

## 技术栈

- Vue 3
- Vue Router
- Vuex
- Element Plus
- Axios

## 主要功能

- 管理员登录和会话校验
- 待审核视频列表
- 视频详情查看
- 视频审核通过、驳回和状态管理
- 管理端统一调用后端管理员接口

## 本地运行

### 环境要求

- Node.js 16+
- npm 8+
- 已启动并正确配置的后端服务
- 具有管理员身份的账号

### 安装依赖

```bash
npm install
```

### 开发启动

```bash
npm run serve
```

开发环境 API 地址请根据后端实际端口修改 `.env.development` 或 `vue.config.js`。管理员账号由后端用户数据中的管理员身份控制，具体以当前后端认证配置为准。

### 生产构建

```bash
npm run build
```

## 目录结构

```text
src/                 管理端页面、组件、路由和状态管理
public/              静态资源
src/assets/          图片与样式资源
.env.development     开发环境配置
.env.production      生产环境配置
```

## 项目声明

本项目由 `cixingji` 维护，主要用于学习、工程实践和技术交流。使用第三方资源时，请遵守相应的许可和版权要求。
