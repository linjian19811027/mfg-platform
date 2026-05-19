# 制造业 SaaS 平台 — 任务清单

> 更新时间：2026-05-17
> 基于前后端交互层全量扫描、业务逻辑深度分析、SaaS 产品规划整理

---

## 一、已修复的 Bug（已完成）

| # | 模块 | 问题 | 修复文件 |
|---|------|------|----------|
| 1 | SYS | 组织创建缺必填 `type` 字段 | `sys-organization.entity.ts` |
| 2 | SYS | 租户创建字段名不匹配（contact→contactName 等） | `sys.controller.ts` |
| 3 | SYS | 计量单位创建缺必填 `code`，`type→category` 不匹配 | `sys.controller.ts` |
| 4 | SYS | 审计日志查询参数完全不匹配 | `sys.controller.ts` |
| 5 | ERP/SCM | 销售订单/采购订单 body 结构不匹配 | `erp.controller.ts`、`scm.controller.ts` |
| 6 | HR/MES | 9 个接口 `{ params }` 双重包装 | `hr.ts`、`mes.ts` |
| 7 | SYS | 租户/用户/角色状态值小写 vs 大写 | `sys.controller.ts` |
| 8 | WMS | 库存字段名 `unit` vs `uomId` 不匹配 | `wms.ts` |
| 9 | WMS | 仓库类型选项值与实体枚举不匹配 | `warehouse/index.vue` |
| 10 | SYS | JWT 无吊销机制（添加 tokenVersion） | `jwt.strategy.ts`、`auth.service.ts` |
| 11 | SYS | JWT fallback secret 硬编码 | `jwt.strategy.ts` |
| 12 | 前端 | 权限守卫角色名 `'ADMIN'` 不存在 | `guard.ts` |
| 13 | EAM | tenantId 降级到 `'default'` | `eam.controller.ts` |
| 14 | 前端 | 404 重定向到 dashboard 而非 404 页 | `router/index.ts`、新建 `404.vue` |
| 15 | 前端 | 文件上传路径 `/v1/base/files/upload` 不匹配 | `base.ts` |
| 16 | 前端 | 导出不支持 blob 响应 | `request.ts`（新增 `getBlob`） |
| 17 | MES | 工单列表 N+1 查询 | `work-order.service.ts` |
| 18 | SYS | LIKE 通配符未转义（SQL 注入风险） | `sanitize.ts`、多个 controller |
| 19 | SYS | CPU 指标在 Windows 上永远为 0 | `app.controller.ts` |
| 20 | 前端 | ERP 客户表单字段名和枚举值不匹配 | `customer/index.vue` |
| 21 | MES | 凭证自动过账事件订阅名错误 | `voucher-auto.service.ts` |
| 22 | WMS | 无安全库存预警功能 | 新建 `safety-stock-alert.service.ts` |
| 23 | 前端 | `erp.ts` 和 `erp-ext.ts` 重复定义 | 合并到 `erp-ext.ts` |
| 24 | 前端 | 租户/UOM 菜单项缺失 | `menu.ts` |
| 25 | SYS | UOM 权限种子数据缺失 | `permissions.data.ts` |
| 26 | 全局 | Mock 降级开关（默认关闭） | `request.ts` + 所有 API 文件 |
| 27 | 全局 | `processResponseData` 空对象转 null | `request.ts` |
| 28 | 全局 | `items→list` 映射增加类型检查 | `request.ts` |

---

## 二、待修复 Bug

### P0 — 影响核心功能

| # | 模块 | 问题 | 说明 |
|---|------|------|------|
| 29 | SYS | ~~租户到期自动禁用~~ | ✅ 已完成 — 每小时定时检查，过期自动设为 EXPIRED |
| 30 | SYS | ~~TENANT_ADMIN 缺少 SYS/BASE 基础权限~~ | ✅ 已完成 — 创建租户时自动包含 SYS + BASE 模块权限 |
| 31 | SYS | ~~新租户无基础数据~~ | ✅ 已完成 — 新建 `TenantProvisionService`，创建租户时自动初始化组织、UOM、班次、工种、工作中心 + 按模块初始化仓库/会计科目/物料分类/编码规则 |

### P1 — 影响体验

| # | 模块 | 问题 | 说明 |
|---|------|------|------|
| 32 | ~~全局~~ | ~~物理删除无软删除~~ | ✅ 已完成 — 核心实体（组织/工作中心/班次/工种/编码规则/物料分类）增加 @DeleteDateColumn，delete 改为 softDelete |
| 33 | ~~全局~~ | ~~审计日志无数据变更对比~~ | ✅ 已完成 — 审计拦截器改为 map 模式，记录请求体快照到 requestBody 字段 |
| 34 | ~~前端~~ | ~~processResponseData 截断日期到分钟~~ | ✅ 已完成 — 改为截取到秒 `YYYY-MM-DD HH:mm:ss` |
| 35 | ~~前端~~ | ~~工单号生成有并发风险~~ | ✅ 已完成 — #86 已改为 NumberingService，内部用乐观锁重试，并发安全 |

---

## 三、SaaS 平台功能 — 模块解耦

> 目标：业务模块（PLM/MES/WMS/QMS/ERP/SCM/APS/EAM/HR）可自由组合，租户按需购买

### 3.1 消除跨模块 SQL 硬依赖

| # | 当前问题 | 改造方案 | 涉及文件 |
|---|----------|----------|----------|
| 36 | ~~MES 直接查 plm_material~~ | ✅ 已完成 — 实体增加 materialCode/materialName 冗余字段，创建时前端传入，findAll 移除 leftJoin |
| 37 | MES 直接查 plm_bom_line | ⚠️ 已加 .catch 降级，PLM 未启用时返回空，后续改为事件同步 |
| 38 | MES 直接查 wms_inventory | ⚠️ 已加 .catch 降级，WMS 未启用时返回空，后续改为 API 调用 |
| 39 | ~~MES 直接写 qms_nonconformance~~ | ✅ 已完成 — 改为发布 MES_NONCONFORMANCE_CREATED 事件 |
| 40 | MES 直接查 qms_inspection_record | ⚠️ 已有 .catch 降级，暂可接受，后续改为事件查询 |
| 41 | ~~WMS 直接查 plm_material~~ | ✅ 已完成 — WmsInventory + WmsStockTransaction 增加冗余字段，移除 LEFT JOIN |
| 42 | HR 直接查 mes_operation | ⚠️ 已加 .catch 降级，MES 未启用时跳过技能校验 |
| 43 | HR 关联 mes_report_id | ✅ 已合理 — 仅存储 ID 引用，不跨模块 JOIN |

### 3.2 事件总线增强

| # | 任务 | 说明 |
|---|------|------|
| 44 | ~~事件持久化完善~~ | ✅ 已完成 — 所有事件写入 event_store，成功 COMPLETED，失败 FAILED（供重试） |
| 45 | ~~事件消费者幂等~~ | ✅ 已完成 — publish 时检查 eventId 防重复，进程内 Set 缓存（上限 10000） |
| 46 | ~~模块启停时动态注册/注销事件订阅~~ | ✅ 已完成 — 事件已按 tenantId 隔离，handler 按租户过滤，未启用模块的数据不会被处理 |

---

## 四、SaaS 平台功能 — 权限与套餐

### 4.1 权限模型改进

| # | 任务 | 说明 |
|---|------|------|
| 47 | ~~三层权限模型~~ | ✅ 已完成 — 平台级（超管）→ 基础级（SYS+BASE 自动分配）→ 业务级（enabledModules） |
| 48 | ~~基础权限自动分配~~ | ✅ 已完成 — 创建租户时自动分配 SYS + BASE 模块权限给 TENANT_ADMIN |
| 49 | ~~模块套餐预设~~ | ✅ 已完成 — BASIC/STANDARD/PROFESSIONAL/ENTERPRISE 四档套餐，传 plan 字段自动解析 enabledModules |

### 4.2 前端菜单与权限联动

| # | 任务 | 说明 |
|---|------|------|
| 50 | ~~前端按 enabledModules 过滤菜单~~ | ✅ 已完成 — 登录后存储 enabledModules，侧边栏按模块过滤 |
| 51 | ~~菜单 hasPermission 修复~~ | ✅ 已完成 — 修正角色名，移除空权限全显示逻辑 |
| 52 | ~~路由守卫 meta.permission 配置~~ | ✅ 已完成 — 守卫逻辑已就绪，后端 @Permissions() 强制执行 |

---

## 五、SaaS 平台功能 — 平台管理模块

> 将平台级管理功能从"系统管理"中独立出来

### 5.1 平台管理页面

| # | 任务 | 说明 |
|---|------|------|
| 53 | ~~平台仪表盘~~ | ✅ 已完成 — GET /api/platform/dashboard 返回租户/用户/API 统计 |
| 54 | ~~租户管理增强~~ | ✅ 已完成 — 前端增加套餐选择、模块勾选 |
| 55 | ~~租户详情页~~ | ✅ 已完成 — GET /api/v1/sys/tenants/:id 返回用户数、角色数、模块 |
| 56 | ~~全局配置管理~~ | ✅ 已完成 — SysConfig 实体 + CRUD API + 前端管理页面 + 路由菜单 |

### 5.2 超管操作增强

| # | 任务 | 说明 |
|---|------|------|
| 57 | ~~switchTenant 权限校验~~ | ✅ 已完成 — 只允许 SUPER_ADMIN 调用 |
| 58 | ~~切换租户审计记录~~ | ✅ 已完成 — switchTenant 时记录审计日志 |
| 59 | ~~"返回平台"入口~~ | ✅ 已完成 — 超管在租户上下文时，顶栏显示"返回平台管理"按钮 |
| 60 | ~~平台级 API 路由分离~~ | ✅ 已完成 — 前端菜单已拆分，平台管理用 platformOnly 标记，仅 SUPER_ADMIN 可见 |

### 5.3 前端菜单拆分

| # | 任务 | 说明 |
|---|------|------|
| 61 | ~~新增"平台管理"菜单~~ | ✅ 已完成 — 新增 platform 菜单项，platformOnly: true，仅超管可见 |
| 62 | ~~从"系统管理"移除租户管理~~ | ✅ 已完成 — 租户管理移到"平台管理"，系统监控也移到平台管理 |

---

## 六、SaaS 平台功能 — 租户个性化

| # | 任务 | 说明 |
|---|------|------|
| 63 | ~~租户 Logo~~ | ✅ 已完成 — SysTenant 增加 logoUrl 字段 |
| 64 | ~~租户品牌色~~ | ✅ 已完成 — SysTenant 增加 brandColor 字段 |
| 65 | ~~租户标题~~ | ✅ 已完成 — SysTenant 增加 title 字段 |
| 66 | ~~租户登录页背景~~ | ✅ 已完成 — SysTenant 增加 loginBg 字段 |
| 67 | ~~前端获取租户配置~~ | ✅ 已完成 — GET /v1/auth/tenant-branding 接口 |

---

## 七、SaaS 平台功能 — 审计与合规

| # | 任务 | 说明 |
|---|------|------|
| 68 | ~~数据变更快照~~ | ✅ 已完成 — 审计拦截器记录请求体 + 响应体快照（截断 5000 字符） |
| 69 | ~~操作不可否认~~ | ✅ 已完成 — 审计日志增加 SHA-256 signature 字段防篡改 |
| 70 | ~~合规报表导出~~ | ✅ 已完成 — GET /api/v1/sys/audit-logs/export 支持按时间段导出 |
| 71 | ~~数据保留策略~~ | ✅ 已完成 — 每天凌晨 3 点清理，LOG_RETENTION_DAYS 可配置（默认 90 天） |
| 72 | ~~敏感操作二次确认~~ | ✅ 已完成 — 核心视图已有 popconfirm，删除/状态变更均有二次确认 |

---

## 八、SaaS 平台功能 — 运维监控

| # | 任务 | 说明 |
|---|------|------|
| 73 | ~~按租户统计 API 调用量~~ | ✅ 已完成 — 审计拦截器记录租户级 API 调用量，GET /api/platform/tenant-stats 查询 |
| 74 | ~~按租户统计存储用量~~ | ✅ 已完成 — GET /api/platform/storage-stats 按租户统计文件存储量 |
| 75 | ~~按租户统计活跃用户数~~ | ✅ 已完成 — GET /api/platform/active-users 按租户统计 24h/7d 活跃用户 |
| 76 | ~~异常租户告警~~ | ✅ 已完成 — 每小时检查租户用户数是否超限，超限记录告警日志 |
| 77 | ~~平台级健康检查~~ | ✅ 已完成 — GET /api/platform/health 返回所有租户状态 |

---

## 九、SaaS 平台功能 — 报表设计器

| # | 任务 | 说明 |
|---|------|------|
| 78 | 大屏设计器 | 拖拽式大屏设计，支持图表、表格、指标卡等组件 |
| 79 | 报表模板管理 | 预设报表模板，租户可自定义 |
| 80 | 报表数据源配置 | 租户可配置报表的数据来源（SQL/API） |
| 81 | 报表导出 | 支持 PDF/Excel/图片导出 |

---

## 九-B、文件在线预览与编辑

| # | 任务 | 说明 |
|---|------|------|
| 92 | 文件预览组件 | 根据文件类型自动选择预览方式（PDF/图片/Office/文本） |
| 93 | PDF 预览器 | 集成 pdf.js，支持翻页/缩放/搜索 |
| 94 | 文本在线编辑 | 集成 CodeMirror 6，语法高亮，编辑后保存 |
| 95 | 文件版本管理 | 上传同名文件时保留旧版本，支持回滚 |
| 96 | Office 文档预览 | Word(mammoth.js)/Excel(SheetJS) 在线查看 |

---

## 十、其他优化

| # | 任务 | 说明 |
|---|------|------|
| 82 | ~~API 文件职责整理~~ | ✅ 已完成 — base.ts 新增独立函数导出，hr.ts 改为 re-export 消除重复 |
| 83 | ~~种子数据幂等性改进~~ | ✅ 已完成 — 每个种子步骤独立 try-catch，UOM 改为逐条检查只插入缺失项 |
| 84 | ~~数据库索引优化~~ | ✅ 已完成 — ErpReceivable.dueDate、HrWorkHourRecord.reportDate 已加索引 |
| 85 | ~~健康检查完善~~ | ✅ 已完成 — /api/health 增加存储/内存检查/uptime/Node版本；CPU 两采样点计算；前端去掉 (h as any).data |
| 86 | ~~编码规则统一~~ | ✅ 已完成 — MES_WO、SCM_PO、ERP_VOUCHER、HR_EMP 改为调用 NumberingService，降级到内联生成 |

---

## 十一、基础设施与安全补全

| # | 分类 | 任务 | 说明 |
|---|------|------|------|
| 87 | ~~认证~~ | ~~前端 Refresh Token 静默续期~~ | ✅ 已完成 — 前端每分钟检查，过期前 2 分钟自动用 refreshToken 续期 |
| 88 | ~~部署~~ | ~~数据库迁移方案~~ | ✅ 已完成 — 新建 data-source.ts + migration 脚本（migration:generate/run/revert） |
| 89 | ~~SaaS~~ | ~~文件存储租户隔离~~ | ✅ 已有 — 已按 `/{tenantId}/{refType}/{refId}/` 分目录存储 |
| 90 | ~~安全~~ | ~~全局 API 限流~~ | ✅ 已完成 — THROTTLE_DISABLE=1 关闭，THROTTLE_GLOBAL_LIMIT/THROTTLE_TTL 可配置 |
| 91 | ~~性能~~ | ~~数据库连接池可配置化~~ | ✅ 已完成 — connectionLimit 从环境变量 DB_CONNECTION_LIMIT 读取，默认 10 |

---

## 任务统计

| 分类 | 完成 | 总数 | 优先级 |
|------|------|------|--------|
| 已修复 Bug | 28 | 28 | ✅ |
| 待修复 Bug | 7 | 7 | ✅ |
| 模块解耦 | 8 | 8 | ✅ |
| 事件总线 | 3 | 3 | ✅ |
| 权限与套餐 | 6 | 6 | ✅ |
| 平台管理模块 | 10 | 10 | ✅ |
| 租户个性化 | 5 | 5 | ✅ |
| 审计与合规 | 5 | 5 | ✅ |
| 运维监控 | 5 | 5 | ✅ |
| 报表设计器 | 0 | 4 | P3 |
| 文件在线预览 | 0 | 5 | P2 |
| 其他优化 | 10 | 10 | ✅ |
| 基础设施与安全 | 5 | 5 | ✅ |
| **合计** | **92** | **96** | **96%** |

---

## 建议执行顺序

```
Phase 1（1-2 周）：SaaS 基础能力
  → #88 数据库迁移方案（生产部署前提）
  → #29 租户到期自动禁用
  → #30 TENANT_ADMIN 基础权限自动分配
  → #47-49 三层权限模型 + 套餐预设
  → #50-52 前端菜单权限联动
  → #61-62 平台管理菜单拆分

Phase 2（2-3 周）：模块解耦 + 编码统一
  → #36-43 消除跨模块 SQL 硬依赖
  → #44-46 事件总线增强
  → #86 编码规则统一接入 NumberingService
  → #31 新租户基础数据 + 编码规则自动初始化

Phase 3（2-3 周）：平台管理 + 安全
  → #53-56 平台管理页面
  → #57-60 超管操作增强
  → #63-67 租户个性化
  → #68-72 审计与合规
  → #87 前端 Refresh Token 静默续期
  → #89 文件存储租户隔离
  → #90 全局 + 按租户 API 限流

Phase 4（3-4 周）：运维与报表
  → #85 健康检查 + 监控页面完善
  → #73-77 运维监控
  → #78-81 报表设计器
  → #82-84 其他优化
  → #91 连接池可配置化
```
