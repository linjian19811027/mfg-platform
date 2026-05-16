# 新增功能模块 — 菜单/权限配置指南

## 概述

本系统的菜单和权限是 **代码驱动** 的，不是在后台页面动态添加的。新增一个功能模块需要同步修改 **3 个文件**，项目重启后自动生效。

> 为什么这么设计？
> - 权限树和代码结构强制一致，不会出现"有菜单没页面"的脏数据
> - 启动时自动 seed（`PermissionSeedService.onApplicationBootstrap`），零运维
> - 多租户天然隔离，每个租户独立分配权限

---

## 术语速查

| 概念 | 说明 | 例子 |
|---|---|---|
| `code` | 权限唯一标识，冒号分隔的层级路径 | `eam:asset:view` |
| `type` | 权限类型：MENU=菜单页 / BUTTON=按钮 / API=接口 | |
| `module` | 所属模块大類（与后端 controller 分组一致） | `EAM`, `MES`, `BASE` |
| `sortOrder` | 兄弟节点间的排序数字，越小越靠前 | |
| `parentCode` | 子权限指向父级 code，形成树结构 | `eam:asset:view` → `eam:asset` |

---

## 三步配置法（以一个"EAM 设备管理"模块为例）

### 第 1 步：后端定义权限种子

**文件：** `backend/src/modules/auth/seed/permissions.data.ts`

在 `SEED_PERMISSIONS` 数组中新增一个顶层模块。结构如下：

```typescript
{
  code: 'eam',              // 模块 code，全局唯一
  name: 'EAM 设备管理',      // 显示名称（中文）
  type: 'MENU',             // 固定为 MENU（这是顶层模块目录）
  module: 'EAM',            // 后端模块名（大写）
  icon: 'IconTool',         // Arco 图标 name（见下方图标对照表）
  sortOrder: 25,            // 侧边栏排序位置（取一个不冲突的数字）
  isVisible: 1,             // 1=显示在菜单中
  children: [
    // ── 子菜单页面 ──
    {
      code: 'eam:asset',
      name: '设备台账',
      type: 'MENU',
      module: 'EAM',
      path: '/eam/assets',                    // 路由路径
      component: '/views/eam/assets/index.vue', // Vue 组件路径
      icon: 'IconTool',
      sortOrder: 1,
    },
    //  子菜单下的按钮权限
    { code: 'eam:asset:view',   name: '查看设备', type: 'BUTTON', module: 'EAM', parentCode: 'eam:asset' },
    { code: 'eam:asset:create', name: '创建设备', type: 'BUTTON', module: 'EAM', parentCode: 'eam:asset' },
    { code: 'eam:asset:edit',   name: '编辑设备', type: 'BUTTON', module: 'EAM', parentCode: 'eam:asset' },
    { code: 'eam:asset:delete', name: '删除设备', type: 'BUTTON', module: 'EAM', parentCode: 'eam:asset' },

    // ── 第二个子页面 ──
    {
      code: 'eam:maintenance',
      name: '保养计划',
      type: 'MENU',
      module: 'EAM',
      path: '/eam/maintenance',
      component: '/views/eam/maintenance/index.vue',
      icon: 'IconSync',
      sortOrder: 5,
    },
    { code: 'eam:maintenance:view',   name: '查看计划', type: 'BUTTON', module: 'EAM', parentCode: 'eam:maintenance' },
    { code: 'eam:maintenance:create', name: '创建计划', type: 'BUTTON', module: 'EAM', parentCode: 'eam:maintenance' },
    { code: 'eam:maintenance:edit',   name: '编辑计划', type: 'BUTTON', module: 'EAM', parentCode: 'eam:maintenance' },
  ],
},
```

> **放置位置：** 根据 `sortOrder` 找到对应位置插入。当前已有的 sortOrder 分配：
> | sortOrder | 模块 |
> |---|---|
> | 1 | dashboard |
> | 10 | PLM |
> | 20 | MES |
> | 30 | QMS |
> | 35 | SCM |
> | 40 | WMS |
> | 50 | ERP |
> | 60 | APS |
> | 70 | Traceability |
> | 80 | HR |
> | 90 | Outsourcing |
> | 100 | BASE |
> | 200 | SYS |
>
> 新的模块建议取中间值（如 `25`、`55`），避免后续插入困难。

---

### 第 2 步：前端注册路由

**文件：** `frontend/src/router/index.ts`

在 `BasicLayout` 的 `children` 数组中找到对应模块区，添加路由记录：

```typescript
{
  path: '/',
  component: () => import('@/layouts/BasicLayout.vue'),
  children: [
    // ... 已有路由 ...

    // EAM 设备管理
    { path: 'eam/assets',      name: 'EamAssets',      component: () => import('@/views/eam/assets/index.vue') },
    { path: 'eam/maintenance', name: 'EamMaintenance', component: () => import('@/views/eam/maintenance/index.vue') },

    // ... 其他路由 ...
  ],
},
```

**命名规范：**
- `path` 用小写 + 中划线（`kebab-case`），与后端权限 data 中的 `path` 保持一致
- `name` 用大驼峰（`PascalCase`），建议加模块前缀避免重名，如 `EamAssets`
- `component` 使用动态 `import()`，按需加载

---

### 第 3 步：前端配置菜单

**文件：** `frontend/src/config/menu.ts`

在 `menuConfig` 数组中新增菜单条目：

```typescript
{
  key: 'eam',                     // 菜单唯一 key
  title: 'EAM 设备',              // 侧边栏显示名称
  icon: 'IconTool',              // 图标 name（与第1步一致）
  children: [
    {
      key: 'eam-assets',          // 子菜单 key，用中划线分隔
      title: '设备台账',
      path: '/eam/assets',
      icon: 'IconTool',
      permission: 'eam:asset:view', // 对应后端权限 data 中的查看权限 code
    },
    {
      key: 'eam-maintenance',
      title: '保养计划',
      path: '/eam/maintenance',
      icon: 'IconSync',
      permission: 'eam:maintenance:view',
    },
  ],
},
```

**关键约束：**
- `permission` 字段必须 **与第 1 步定义的 BUTTON 或 MENU 的 code 一致**，侧边栏才能根据用户权限显隐
- 无 `permission` 字段的菜单项对所有人可见（如"工作台"）
- `key` 在整个菜单配置中唯一，建议格式 `{模块}-{页面}`

---

### 第 4 步（可选）：国际化翻译

如果新增的页面需要多语言支持：

**文件：** `frontend/src/locale/zh-CN/eam.ts`
```typescript
export default {
  'eam': {
    'title': '设备管理',
    'asset': {
      'index': { 'title': '设备台账' },
    },
    'maintenance': {
      'index': { 'title': '保养计划' },
    },
  },
}
```

**文件：** `frontend/src/locale/en-US/eam.ts`
```typescript
export default {
  'eam': {
    'title': 'Equipment Management',
    'asset': {
      'index': { 'title': 'Asset List' },
    },
    'maintenance': {
      'index': { 'title': 'Maintenance Plan' },
    },
  },
}
```

然后在 `frontend/src/locale/index.ts` 中注册新文件。

---

## 四重检查清单

每次配置完成后，逐一确认以下事项：

| # | 检查项 | 检查位置 | 是否一致 |
|---|---|---|---|
| 1 | 路由 path | `permissions.data.ts` 的 `path` = `router/index.ts` 的 `path` | ☐ |
| 2 | 组件路径 | `permissions.data.ts` 的 `component` = 实际 vue 文件位置 | ☐ |
| 3 | 权限 code | `menu.ts` 的 `permission` = `permissions.data.ts` 中对应的 BUTTON code | ☐ |
| 4 | 排序不冲突 | `permissions.data.ts` 的 `sortOrder` 在兄弟节点间唯一 | ☐ |

---

## 补充内容

### 图标对照表（Arco Design Vue）

菜单配置中 `icon` 字段使用 Arco Design 的图标组件名。目前系统中已使用的图标：

| icon name | 示例位置 |
|---|---|
| `IconDashboard` | 工作台 |
| `IconApps` | PLM 顶层 |
| `IconSettings` | MES、SYS 顶层 |
| `IconStorage` | WMS、BASE 顶层 |
| `IconCheckCircle` | QMS 顶层 |
| `IconArchive` | 物料管理 |
| `IconTags` | 物料分类 |
| `IconBranch` | BOM 管理 |
| `IconSync` | 工艺路线、保养计划 |
| `IconList` | 标准工序库、批次管理 |
| `IconEdit` | ECR |
| `IconNotification` | ECN |
| `IconCalendar` | ECN 执行计划 |
| `IconCode` | 编码规则 |
| `IconBook` | 文档管理、审计日志 |
| `IconFile` | 工单管理、文件管理、系统日志 |
| `IconExport` | 领料管理 |
| `IconInteraction` | 工序操作 |
| `IconLoading` | 在制品 |
| `IconHistory` | 工时记录 |
| `IconComputer` | 质量看板 |
| `IconTool` | 设备管理（EAM） |
| `IconUser` | 用户管理 |
| `IconUserGroup` | 员工档案 |
| `IconSafe` | 权限管理 |
| `IconNav` | 组织架构 |
| `IconHome` | 仓库管理 |
| `IconScan` | 盘点管理 |
| `IconCommand` | 拣货任务 |
| `IconRecord` | 周转分析 |
| `IconCloseCircle` | 不合格品 |
| `IconSkin` | 成品检验 |
| `IconThunderbolt` | APS |
| `IconBulb` | NCR |
| `IconPublic` | 供应商质量 |
| `IconStamp` | 合规性 |
| `IconDriveFile` | 文档 |
| `IconUndo` | 召回管理 |
| `IconDoubleDown` / `IconDoubleUp` | 追溯 |
| `IconBarChart` | SPC |
| `IconMessage` | 投诉管理 |
| `IconDownload` | 订单 |
| `IconRelation` | 物料清单 |
| `IconLayout` | 工作台 |
| `IconSchedule` | 排班管理 |
| `IconCommon` | 角色管理、租户管理 |
| `IconLanguage` | 语言切换 |
| `IconSearch` | 搜索 |
| `IconClose` | 关闭 |
| `IconSwap` | 库存流水 |
| `IconCertificate` | 认证类型 |
| `IconClockCircle` | 班次管理 |

> 所有可用图标列表见 [Arco Design Icon 文档](https://arco.design/vue/component/icon)。

使用新图标时，记得在 `BasicLayout.vue` 中 **同时添加 import 和 iconMap 注册**：

```typescript
// 1. import
import { IconTool } from '@arco-design/web-vue/es/icon'

// 2. 注册到 iconMap
const iconMap: Record<string, unknown> = {
  // ... 已有的 ...
  IconTool,
}
```

### 模块色彩映射

在 `BasicLayout.vue` 的 `themeMap` 中为新模块添加颜色：

```typescript
const themeMap: Record<string, { gradient: string, color: string }> = {
  // ... 已有的 ...
  'eam': { gradient: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff' },
}
```

### 后端 controller 模块注册

如果新增的模块有后端 API 接口，需要在 `app.module.ts` 中注册对应的 module：
- 参考已有的 `EamModule`、`MesModule` 等写法
- 确保 module 被正确导入到根模块

---

## 常见问题

### Q: 改了 permissions.data.ts，启动后没生效？

A: `PermissionSeedService` 只在 **新增** 权限时插入，**不会覆盖已有记录**。如果数据库里已存在同名 code 的记录，不会更新。要强制刷新，需要清空 `sys_permission` 表后重启。

### Q: 菜单配好了，但用户登录后看不到？

检查：
1. 该用户的角色是否 **分配了对应的权限**（在角色管理页面勾选）
2. `menu.ts` 中的 `permission` 字段是否与 `permissions.data.ts` 中的 code **完全一致**
3. 开发环境可能需清除 localStorage 重新登录

### Q: 按钮级权限在页面里怎么用？

在 Vue 组件中配合 `v-permission` 指令使用：

```vue
<template>
  <a-button v-permission="'eam:asset:create'">新增设备</a-button>
  <a-button v-permission="'eam:asset:edit'">编辑</a-button>
  <a-button v-permission="'eam:asset:delete'">删除</a-button>
</template>
```

`v-permission` 指令会自动判断当前用户是否拥有该权限 code。
