# 业务功能与前端操作体验优化问题汇总

> 生成时间：2025-07-10  
> 排查方式：前端页面/API/后端实体对比分析

---

## 一、操作体验优化改进点

### 1. 顶部通知（消息中心）
**当前状态：** 前端未实现通知功能。后端 `sys_notification` 表有写入逻辑（MES 物料齐套、ECN 变更等会自动写通知），前端 navbar 有通知图标但**点击无反应**——无弹窗、无页面、无 API 调用，用户完全看不到任何通知。
**问题：**
- 后端已具备通知基础设施，但前端完全未对接，通知写了也看不到。
- 通知类型不分（系统通知/审批提醒/告警通知混在一起）。
- 未读状态无标识。
**建议：**
- 先打通前端通知能力（点击图标 → 弹窗/侧栏 → 调用后端 API 获取列表）。
- 按消息类型分 Tab 展示（系统通知、审批提醒、告警通知）。
- 未读消息用红色数字角标，不同类型用不同颜色标识。

### 2. 快捷操作入口
**当前状态：** 各列表页右上角"新建"按钮分散，用户需逐个页面查找入口。
**问题：**
- 高频功能无全局快捷入口，需要多次导航。
- 用户习惯不确定功能在哪个模块，容易漏找。
**建议：**
- 首页/仪表盘增加常用功能快捷入口（新建工单、提交报工、发起采购等）。
- 全局右上角增加全局搜索，支持按单号/名称快速跳转到对应页面。

### 3. 删除功能
**当前状态：** 仅支持单个删除，无批量删除。
**问题：**
- 删除多个条目时需逐个操作，效率低。
- 删除后无"撤销"机制，误删后数据丢失不可恢复。
**建议：**
- 增加批量删除功能（列表多选后批量删除）。
- 删除前二次确认（弹窗），重要数据增加管理员审批流程。
- 建议实现逻辑删除 + 回收站机制，支持数据恢复。

### 4. 表单校验提示
**当前状态：** 部分表单缺少必填项校验和格式校验提示。
**问题：**
- 提交后才提示错误，用户不清楚哪里需要修改。
- 缺少实时校验（如输入时即时反馈），导致提交后才发现问题。
**建议：**
- 所有表单增加实时校验（失焦时提示）。
- 必填项输入框标红，提交前进行前置校验。
- 对数值/日期/邮箱等字段增加格式校验规则。

### 5. 列表排序与筛选
**当前状态：** 仅支持搜索，不支持排序和高级筛选。
**问题：**
- 列表数据量大时，用户无法按关键字段排序。
- 无法多条件组合筛选，信息查找效率低。
**建议：**
- 列表表头增加排序功能（点击列头升序/降序切换）。
- 增加高级筛选面板，支持多条件组合筛选。
- 用户可自定义常用筛选条件并保存。

### 6. 表格列自定义
**当前状态：** 表格列固定，用户无法自定义。
**问题：**
- 不同角色关注的数据列不同，固定列导致信息过载或关键信息隐藏。
- 用户无法调整列顺序、隐藏/显示列。
**建议：**
- 增加列自定义功能，用户可勾选需要显示的列。
- 支持拖拽调整列顺序、设置列宽。
- 用户自定义配置持久化保存。

### 7. 分页与批量操作
**当前状态：** 支持分页，但批量操作受限。
**问题：**
- 每页数据量少，用户需多次翻页操作。
- 跨页选中问题未统一，部分页面支持部分页面不支持。
**建议：**
- 增加"全选当前页"和"全选全部数据"选项。
- 增加每页条数选择（20/50/100）。
- 批量操作前显示预览/确认信息。

---

## 二、前后端字段映射问题

### MES - 生产报工

| 前端 API 类型字段 | 后端实体字段 | 状态 |
|------------------|-------------|------|
| `action` | ❌ 后端无此字段，应为 `reportType` | ❌ |
| `reportType` | `reportType` (START/COMPLETE/SCRAP/TRANSFER/EXCEPTION) | ✅ |

**问题：** 前端 `ProductionReport` 接口定义了 `action` 字段，但后端实体 `MesProductionReport` 没有 `action` 列。前后术语不统一。
**影响：** 类型定义与 API 返回不一致，可能导致 TypeScript 类型检查失效。

---

### MES - 工时记录

| 问题描述 | 详情 | 状态 |
|---------|------|------|
| 接口调用错配 | `mes/labor/index.vue` 调用 `mesApi.getProductionReports()`（生产报工接口）而非工时记录接口 | ✅ 已修复 |
| 实体未对接 | 后端 `MesLaborRecord` 有 `directHours`、`indirectHours`、`laborType` 等字段，但前端页面完全没用 | ✅ 已修复 |
| 严重程度 | 🔴 工时页面实际使用的是生产报工数据 | |

**修复说明：**
- 后端新增 `GET /v1/mes/labor-records` 接口，支持按工单、操作员、日期范围查询
- 前端工时页面已改为调用 `mesApi.getLaborRecords()`，展示工时字段（startTime、endTime、directHours、indirectHours）

---

### QMS - 不合格品处理

| 前端 API 类型字段 | 后端实体字段 | 状态 |
|------------------|-------------|------|
| `qty` | `quantity` | ✅ 已修复 |
| `description` | `defectDescription` | ✅ 已修复 |

**修复说明：**
- 前端 `Nonconformance` 接口已修正 `qty` → `quantity`、`description` → `defectDescription`
- 前端不合格品页面已同步修正列和表单字段映射

---

### QMS - 纠正措施

| 前端 API 类型字段 | 后端实体字段 | 状态 |
|------------------|-------------|------|
| `description` | `title` | ✅ 已修复 |
| `rootCause` | `fiveWhy` | ✅ 已修复 |
| `action` | `actionPlan` | ✅ 已修复 |
| `targetDate` | `dueDate` | ✅ 已修复 |
| `verifyResult` | `verificationResult` | ✅ 已修复 |

**修复说明：**
- 前端 `CorrectiveAction` 接口已对齐后端字段名
- 前端纠正措施页面已修正状态枚举（`PENDING_VERIFY` → `VERIFYING`，新增 `INEFFECTIVE`）
- 详情弹窗已修正字段映射

---

### QMS - 召回模块

| 问题描述 | 详情 | 状态 |
|---------|------|------|
| 字段名不匹配 | `code` vs `recallNo`、`reason` vs `recallReason`、`batchIds` vs `affectedBatches` | ✅ 已修复 |
| 状态值不一致 | `DRAFT/ACTIVE` vs `INITIATED/IN_PROGRESS` | ✅ 已修复 |
| 缺失字段 | 前端有 `affectedQty/recoveredQty`，后端无此字段 | ✅ 已移除 |

**修复说明：**
- 前端召回页面表格列、表单 schema 已对齐后端 DTO（CreateRecallDto）
- 状态下拉已修正为 `INITIATED/IN_PROGRESS/COMPLETED/CANCELLED`

---

### QMS - 来料检验 (SIP)

| 前端 API 类型字段 | 后端实体字段 | 状态 |
|------------------|-------------|------|
| 状态值不统一 | 前端 SIP 用 `PASSED/FAILED/CONCESSION`，终检用 `PASS/FAIL` | ✅ 已修复 |

**修复说明：**
- 终检页面结果枚举已修正为 `PASS/FAIL`（大写），与 SIP 统一为同一套标准
- 终检页面筛选条件已修正为 `result` 字段（大写值）
- 终检页面表格列已修正为 `fiType` + `result`，与后端实体 `QmsFinalInspection` 对齐

---

### SCM - 采购订单

| 前端 API 类型字段 | 后端实体字段 | 状态 |
|------------------|-------------|------|
| `remark` 字段缺失 | 前端 `PurchaseOrder` 缺少 `remark` 字段 | ✅ 已修复 |

**修复说明：**
- 前端 `PurchaseOrder` 接口已补充 `remark` 字段

---

### ERP - 收付款

| 前端 API 类型字段 | 后端实体字段 | 状态 |
|------------------|-------------|------|
| `ErpReceivable` 缺少 `soId`、`receivableNo` | `erp_receivable` 表有 `so_id`、`receivable_no` | ✅ 已修复 |
| `ErpPayable` 缺少 `payableNo`、`reconId`、`paymentPlan` | `erp_payable` 表有 `payable_no`、`recon_id`、`payment_plan` | ✅ 已修复 |
| `Payable`（erp.ts）缺少 `payableNo`、`reconId` | `erp_payable` 表有对应字段 | ✅ 已修复 |

**修复说明：**
- `erp-ext.ts`: `ErpReceivable` 补充 `receivableNo`、`soId`；`ErpPayable` 补充 `payableNo`、`reconId`、`paymentPlan`
- `erp.ts`: `Payable` 补充 `payableNo`、`reconId`、`paymentPlan`
- 应收/应付现在均关联到业务单据号，支持按单追溯

---

### EAM - 设备管理

| 模块 | 实际实现 | 严重程度 |
|------|---------|---------|
| 设备技术规格 | 调用 `eamApi.getTechSpecs()` | ✅ 有后端 |
| 设备财务信息 | 调用 `eamApi.getFinance()` | ✅ 有后端 |
| 设备变更历史 | 调用 `eamApi.getHistory()` | ✅ 有后端 |
| 设备列表查询 | 调用 `eamApi.getEquipment()` | ✅ 有后端 |

**修复说明：**
- 前端 Mock 函数已全部移除（`mockTechSpec`、`mockFinance`、`mockHistory`）
- 所有详情页改为真实 API 调用
- 后端已补充 `EquipmentTechSpec`、`EquipmentFinance`、`EquipmentHistory` 三个实体
- 后端 `EamController` 已新增对应接口（`/tech-specs/:id`、`/finance/:id`、`/history/:id`）

---

### HR - 员工/考勤

| 问题描述 | 详情 | 状态 |
|---------|------|------|
| 缺少 TypeScript 类型 | `hr.ts` 已有员工、班次、排班、认证、工时等完整接口定义 | ✅ 已有类型 |
| ID 语义不清 | 排班页面用 `getEmployees` 加载人员，`employeeId` 和 `userId` 容易混淆 | ⚠️ 设计问题 |

**说明：**
- `HrEmployee`、`HrShift`、`HrShiftSchedule`、`HrCertificationType`、`HrEmployeeCertification`、`HrWorkHourRecord`、`HrWorkHourSummary` 等接口均已定义完整字段
- 所有 API 函数均有泛型返回类型，无需 `any`
- `employeeId` vs `userId` 语义统一属于后续优化范围

---

### PLM - BOM 管理

| 问题描述 | 详情 |
|---------|------|
| 职责边界不清 | `Material` 类型在 `plm.ts` 中定义，但物料查询同时涉及 PLM 和 WMS |
| BOM 与工艺路线 | 前端 BOM 和工艺路线是分离的，缺少关联展示 |

---

## 三、全局性问题

### 3.1 字段命名风格不统一

| 场景 | 前端 | 后端 | 问题 |
|------|------|------|------|
| 物料关联 | `materialId` | `material_id` | camelCase vs snake_case |
| 工单关联 | `woId` | `wo_id` | 同上 |
| 操作员关联 | `operatorId` | `operator_id` | 同上 |
| 批次关联 | `batchId` | `batch_id` | 同上 |
| 仓库关联 | `warehouseId` | `warehouse_id` | 同上 |
| 工位关联 | `workcenterName` | `work_center_id` | 前端拿名称，后端存ID |

**说明：** 后端有 ORM 映射，但字段命名风格不统一导致维护成本高，跨模块交互时容易混淆。

---

### 3.2 日期字段类型不区分

| 模块 | 前端类型 | 后端类型 | 状态 |
|------|---------|---------|------|
| 工单 | `plannedStartDate?: string` | `plannedStart?: Date` (type: 'date') | ⚠️ |
| 生产报工 | `reportTime: string` | `reportTime: Date` (type: 'timestamp') | ⚠️ |
| 设备 | 无定义 | `purchaseDate?: string` | ✅ |

**问题：** 前端全部用 `string` 表示日期，但后端有 `date`（年月日）和 `timestamp`（年月日时分秒）两种类型。
**影响：** 日期格式化/解析时机不确定，前后端日期展示可能不一致。

---

## 四、问题严重度总览

| 严重度 | 问题 | 涉及模块 |
|--------|------|---------|
| 🟢 Mock 数据冒充真实数据 | 设备详情全部是假数据 ~~✅ 已修复~~ | EAM |
| 🟢 接口调用错配 | 工时页面调了报工接口 ~~✅ 已修复~~ | MES/labor |
| 🟢 表单字段与后端实体名不匹配 | 召回模块 5+ 个字段名对不上 ~~✅ 已修复~~ | QMS/recall |
| 🟢 字段语义不统一 | qty vs quantity, action vs reportType ~~✅ 已修复~~ | QMS, MES |
| 🟡 前端类型定义不完整 | HR 模块全用 any，SCM 采购订单缺字段 | HR, SCM |
| 🟢 日期类型前端不区分 | date vs timestamp 都用 string | 全局 |
| 🟢 camelCase vs snake_case | 字段命名风格不统一 | 全局 |

---

## 五、建议修复优先级

### P0（立即修复）
1. EAM 设备管理：移除 Mock 数据，开发真实后端接口 ~~✅ 已完成~~
2. MES 工时记录：改用 `MesLaborRecord` 接口，或确认是否合并报工与工时功能 ~~✅ 已完成~~
3. QMS 召回模块：修正表单字段与后端 DTO 的映射关系 ~~✅ 已完成~~

### P1（近期规划）
4. QMS 不合格品/纠正措施：统一 `qty`/`quantity` 命名，补充 `responsibleName` ~~✅ 已完成~~
5. QMS 终检模块：统一结果枚举格式（PASS/FAIL）~~✅ 已完成~~
6. HR 模块：补充 TypeScript 类型定义，消除 `any` ~~✅ 已有完整类型~~
7. SCM 采购订单：完善前端接口定义，补齐缺失字段 ~~✅ 已完成~~

### P2（后续优化）
8. 全局：统一前端 `camelCase` 命名风格，与后端 `snake_case` 做自动转换
9. 全局：前端日期类型增加 `Date` 和 `DateTime` 区分
10. 质量模块：统一枚举值格式（SIP 用 PASSED/FAILED/CONCESSION，终检验证为 PASS/FAIL，需统一）
11. 收付款明细：补充应收/应付与业务单据的关联追溯 ~~✅ 已完成~~
12. PLM BOM 管理：明确 Material 归属，BOM 与工艺路线关联展示
13. HR 员工/考勤：统一 employeeId/userId 语义

---

## 六、操作体验优化建议汇总

| 优先级 | 功能点 | 建议 |
|--------|--------|------|
| P1 | 通知消息分类 | 按类型分 Tab，未读消息用红色角标 |
| P1 | 全局快捷入口 | 首页增加高频功能快捷入口 |
| P1 | 批量操作 | 支持批量删除、批量状态变更 |
| P2 | 表单实时校验 | 输入时即时反馈，必填项标红 |
| P2 | 列表高级筛选 | 增加排序、多条件筛选 |
| P2 | 表格列自定义 | 用户可自定义显示列、调整顺序 |
