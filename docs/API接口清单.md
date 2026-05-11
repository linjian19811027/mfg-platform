# MFG Platform API 接口清单

---

## 认证 (Auth)

**路由前缀:** `/api/v1/auth`

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/auth/login | 账号密码登录 | @Public |
| POST | /api/v1/auth/refresh | 刷新 AccessToken | @Public |
| POST | /api/v1/auth/logout | 登出 | @ApiBearerAuth |
| POST | /api/v1/auth/change-password | 修改密码 | @ApiBearerAuth |

---

## 系统管理 (Sys)

**路由前缀:** `/api/v1/sys`

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/sys/users | 用户列表（分页） | sys:user:list |
| GET | /api/v1/sys/users/:id | 用户详情 | sys:user:list |
| POST | /api/v1/sys/users | 创建用户 | sys:user:create |
| PUT | /api/v1/sys/users/:id | 更新用户 | sys:user:update |
| DELETE | /api/v1/sys/users/:id | 删除用户 | sys:user:delete |
| PATCH | /api/v1/sys/users/:id/status | 切换用户状态 | - |
| POST | /api/v1/sys/users/:id/reset-password | 重置用户密码 | - |
| GET | /api/v1/sys/roles | 角色列表 | sys:role:list |
| GET | /api/v1/sys/roles/list | 角色分页列表 | - |
| GET | /api/v1/sys/roles/:id | 角色详情 | - |
| GET | /api/v1/sys/roles/:id/permissions | 获取角色权限列表 | - |
| POST | /api/v1/sys/roles | 创建角色 | sys:role:create |
| PUT | /api/v1/sys/roles/:id | 更新角色 | sys:role:update |
| PUT | /api/v1/sys/roles/:id/permissions | 更新角色权限 | - |
| DELETE | /api/v1/sys/roles/:id | 删除角色 | sys:role:delete |
| PATCH | /api/v1/sys/roles/:id/status | 切换角色状态 | - |
| GET | /api/v1/sys/permissions | 权限列表 | - |
| GET | /api/v1/sys/permissions/tree | 权限树 | - |
| GET | /api/v1/sys/audit-logs | 审计日志查询 | sys:audit:list |
| GET | /api/v1/sys/orgs/tree | 组织树 | - |
| GET | /api/v1/sys/orgs/simple | 组织简单列表 | - |
| GET | /api/v1/sys/orgs/:id | 组织详情 | - |
| POST | /api/v1/sys/orgs | 创建组织 | - |
| PUT | /api/v1/sys/orgs/:id | 更新组织 | - |
| DELETE | /api/v1/sys/orgs/:id | 删除组织 | - |
| GET | /api/v1/sys/uoms | 计量单位列表 | - |
| POST | /api/v1/sys/uoms | 创建计量单位 | - |
| PUT | /api/v1/sys/uoms/:id | 更新计量单位 | - |
| DELETE | /api/v1/sys/uoms/:id | 删除计量单位 | - |
| PATCH | /api/v1/sys/uoms/:id/conversion | 设置换算系数 | - |
| GET | /api/v1/sys/tenants | 租户列表 | - |
| POST | /api/v1/sys/tenants | 创建租户 | - |
| PUT | /api/v1/sys/tenants/:id | 更新租户 | - |
| PATCH | /api/v1/sys/tenants/:id/status | 切换租户状态 | - |

---

## 基础主数据 (Base)

**路由前缀:** `/api/v1/base`

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/base/organizations/tree | 组织树 | - |
| POST | /api/v1/base/organizations | 创建组织节点 | - |
| PUT | /api/v1/base/organizations/:id | 更新组织 | - |
| DELETE | /api/v1/base/organizations/:id | 删除组织（叶节点） | - |
| GET | /api/v1/base/uoms | 计量单位列表 | - |
| POST | /api/v1/base/uoms | 创建计量单位 | - |
| POST | /api/v1/base/uoms/convert | 单位换算 | - |
| GET | /api/v1/base/batches | 批次列表 | - |
| GET | /api/v1/base/batches/:id | 批次详情 | - |
| POST | /api/v1/base/batches | 创建批次 | - |
| PUT | /api/v1/base/batches/:id | 更新批次 | - |
| GET | /api/v1/base/files | 文件列表 | - |
| DELETE | /api/v1/base/files/:id | 删除文件记录 | - |

---

## PLM 产品生命周期管理 (PLM)

**路由前缀:** `/api/v1/plm`

### 物料分类
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/plm/materials/categories | 物料分类树 | - |
| POST | /api/v1/plm/materials/categories | 创建物料分类 | - |
| PUT | /api/v1/plm/materials/categories/:id | 更新物料分类 | - |
| DELETE | /api/v1/plm/materials/categories/:id | 删除物料分类 | - |

### 物料编码规则
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/plm/materials/code-rules | 编码规则列表 | - |
| POST | /api/v1/plm/materials/code-rules | 创建编码规则 | - |
| PUT | /api/v1/plm/materials/code-rules/:id | 更新编码规则 | - |

### 物料主数据
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/plm/materials | 物料列表（多维度筛选） | - |
| GET | /api/v1/plm/materials/export | 物料 Excel 导出 | - |
| GET | /api/v1/plm/materials/import-template | 下载物料导入模板 | - |
| GET | /api/v1/plm/materials/:id | 物料详情 | - |
| GET | /api/v1/plm/materials/:id/where-used | 物料被哪些 BOM 使用（反查） | - |
| GET | /api/v1/plm/materials/:id/substitutes | 物料替代关系列表 | - |
| POST | /api/v1/plm/materials | 创建物料 | - |
| POST | /api/v1/plm/materials/import | 物料 Excel 批量导入 | - |
| PUT | /api/v1/plm/materials/:id | 更新物料 | - |
| PATCH | /api/v1/plm/materials/:id/status | 物料状态流转 | - |
| POST | /api/v1/plm/materials/:id/substitutes | 添加替代关系 | - |
| POST | /api/v1/plm/materials/:id/drawings | 上传图纸/文档 | - |

### BOM
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/plm/boms | BOM 列表 | - |
| GET | /api/v1/plm/boms/compare | BOM 版本对比 | - |
| GET | /api/v1/plm/boms/import-template | 下载 BOM 导入模板 | - |
| GET | /api/v1/plm/boms/:id | BOM 详情（含明细） | - |
| GET | /api/v1/plm/boms/:id/expand | BOM 正展（树形展开） | - |
| GET | /api/v1/plm/boms/:id/where-used | BOM 反展（反查上级） | - |
| GET | /api/v1/plm/boms/:id/cost | BOM 成本卷积 | - |
| GET | /api/v1/plm/boms/:id/export | BOM Excel 导出 | - |
| POST | /api/v1/plm/boms | 创建 BOM | - |
| POST | /api/v1/plm/boms/import | BOM Excel 批量导入 | - |
| POST | /api/v1/plm/boms/:id/activate | 激活 BOM | - |
| POST | /api/v1/plm/boms/:id/deactivate | 停用 BOM | - |
| POST | /api/v1/plm/boms/:id/obsolete | 废止 BOM | - |
| POST | /api/v1/plm/boms/:id/lines | 添加 BOM 明细行 | - |
| PUT | /api/v1/plm/boms/lines/:lineId | 更新 BOM 明细行 | - |
| DELETE | /api/v1/plm/boms/:id | 删除 BOM | - |
| DELETE | /api/v1/plm/boms/lines/:lineId | 删除 BOM 明细行 | - |

### 工艺路线
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/plm/routings | 工艺路线列表 | - |
| GET | /api/v1/plm/routings/:id | 工艺路线详情（含工序） | - |
| GET | /api/v1/plm/routings/:id/impact | 变更影响分析（在制工单） | - |
| POST | /api/v1/plm/routings | 创建工艺路线 | - |
| POST | /api/v1/plm/routings/:id/copy | 复制工艺路线 | - |
| POST | /api/v1/plm/routings/:id/activate | 激活工艺路线版本 | - |
| POST | /api/v1/plm/routings/:id/retire | 废止工艺路线 | - |
| PUT | /api/v1/plm/routings/:id | 更新工艺路线 | - |
| DELETE | /api/v1/plm/routings/:id | 删除工艺路线 | - |
| POST | /api/v1/plm/routings/:id/operations | 添加工序 | - |
| PUT | /api/v1/plm/routings/operations/:opId | 更新工序 | - |
| DELETE | /api/v1/plm/routings/operations/:opId | 删除工序 | - |

### 变更管理 ECR/ECN
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/plm/ecrs | ECR 变更申请列表 | - |
| GET | /api/v1/plm/ecrs/:id | ECR 详情 | - |
| POST | /api/v1/plm/ecrs | 创建变更申请 ECR | - |
| PUT | /api/v1/plm/ecrs/:id | 更新 ECR（仅 DRAFT 状态） | - |
| PATCH | /api/v1/plm/ecrs/:id/submit | 提交 ECR 审批 | - |
| PATCH | /api/v1/plm/ecrs/:id/approve | 审批通过 ECR | - |
| PATCH | /api/v1/plm/ecrs/:id/reject | 驳回 ECR | - |
| GET | /api/v1/plm/ecns | ECN 变更通知列表 | - |
| GET | /api/v1/plm/ecns/:id | ECN 详情 | - |
| POST | /api/v1/plm/ecns | 签发 ECN 变更通知 | - |
| PATCH | /api/v1/plm/ecns/:id/complete | 完成 ECN 执行 | - |

### ECN 执行计划
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/plm/ecn-execution-plans | ECN 执行计划列表 | - |
| GET | /api/v1/plm/ecn-execution-plans/:id | ECN 执行计划详情 | - |
| PATCH | /api/v1/plm/ecn-execution-plans/:id/trigger | 手动触发 ECN 执行计划 | - |
| PATCH | /api/v1/plm/ecn-execution-plans/:id/effective-date | 修改 ECN 执行计划生效日期 | - |
| PATCH | /api/v1/plm/ecn-execution-plans/:id/retry | 重试 ECN 执行计划中的失败项 | - |
| PATCH | /api/v1/plm/ecn-execution-plans/:id/cancel | 取消 ECN 执行计划 | - |
| GET | /api/v1/plm/ecn-execution-plans/:id/wip-assessment | 获取 ECN 执行计划的在制工单影响评估报告 | - |
| PATCH | /api/v1/plm/ecn-execution-plans/:id/wip-assessment/confirm | 确认在制工单影响评估 | - |

---

## MES 制造执行系统 (MES)

**路由前缀:** `/api/v1/mes`

### 工单
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/mes/work-orders | 工单列表（多维度筛选） | - |
| GET | /api/v1/mes/work-orders/:id | 工单详情（含工序进度） | - |
| POST | /api/v1/mes/work-orders | 创建工单 | - |
| PUT | /api/v1/mes/work-orders/:id | 更新工单 | - |
| PATCH | /api/v1/mes/work-orders/:id/status | 工单状态流转 | - |
| PATCH | /api/v1/mes/work-orders/:id/priority | 调整工单优先级（1-10） | - |
| POST | /api/v1/mes/work-orders/:id/split | 工单拆分 | - |
| POST | /api/v1/mes/work-orders/merge | 工单合并 | - |
| GET | /api/v1/mes/work-orders/:id/tree | 工单树（含进度、关键路径标记） | - |
| GET | /api/v1/mes/work-orders/:id/critical-path | 关键路径工单列表 | - |
| GET | /api/v1/mes/work-orders/:id/readiness | 物料齐套明细 | - |
| GET | /api/v1/mes/work-orders/:id/cancel-preview | 级联取消预览 | - |
| POST | /api/v1/mes/work-orders/:id/cancel | 取消工单（支持级联取消） | - |
| PATCH | /api/v1/mes/work-orders/:id/parent | 修改父工单关联 | - |

### 齐套检查 & 领料
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/mes/work-orders/:id/kit-check | 物料齐套检查 | - |
| POST | /api/v1/mes/work-orders/:id/material-issues | 扫码领料 | - |
| POST | /api/v1/mes/work-orders/:id/material-returns | 物料退料 | - |
| POST | /api/v1/mes/work-orders/:id/material-supplements | 物料补料（超耗/报废补领） | - |
| GET | /api/v1/mes/work-orders/:id/material-issues | 领料记录查询 | - |

### 报工
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/mes/work-orders/:id/report | 报工（START/COMPLETE/SCRAP/TRANSFER/EXCEPTION） | - |
| GET | /api/v1/mes/production-reports | 报工记录查询 | - |
| PUT | /api/v1/mes/production-reports/:id/correct | 报工修正（仅班长/质检员） | - |

### 工序操作
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/mes/operations | 工序列表 | - |
| POST | /api/v1/mes/operations/:id/start | 开工确认（四项前置检查） | - |
| POST | /api/v1/mes/operations/:id/complete | 完工扫码 | - |
| POST | /api/v1/mes/operations/:id/first-inspection | 触发首检 | - |
| POST | /api/v1/mes/operations/:id/exception | 异常报工 | - |

### 质量
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/mes/nonconformances | 不合格品处理 | - |
| GET | /api/v1/mes/work-orders/:id/traceability | 质量追溯（人/机/料/法/环） | - |

### 自动入库配置
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/mes/auto-receipt-config | 查询自动入库配置列表 | - |
| POST | /api/v1/mes/auto-receipt-config | 创建自动入库配置 | - |
| PUT | /api/v1/mes/auto-receipt-config/:id | 更新自动入库配置 | - |
| DELETE | /api/v1/mes/auto-receipt-config/:id | 删除自动入库配置 | - |
| PATCH | /api/v1/mes/auto-receipt-config/:id/toggle | 启用/停用自动入库配置 | - |

### 入库日志
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/mes/receipt-logs | 查询入库日志 | - |
| POST | /api/v1/mes/receipt-logs/:id/retry | 手动重试失败的入库日志 | - |

---

## WMS 仓储管理系统 (WMS)

**路由前缀:** `/api/v1/wms`

### 库存查询
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/wms/inventory | 实时库存查询（多维度筛选） | - |
| GET | /api/v1/wms/inventory/transactions | 库存流水查询 | - |

### 入库
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/wms/receipts | 入库（采购/生产/退货/调拨/其他） | - |
| POST | /api/v1/wms/putaway | 上架作业（暂存区→目标库位） | - |
| GET | /api/v1/wms/putaway/recommend | 推荐上架库位 | - |

### 出库
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/wms/issues | 出库（生产领料/销售/调拨/其他） | - |

### 移库
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/wms/inventory/transfer | 库位间移库 | - |

### 库存调整
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/wms/inventory/adjust | 库存调整（盘盈/盘亏） | - |
| POST | /api/v1/wms/inventory/lock | 冻结库存（质检/召回/盘点） | - |
| POST | /api/v1/wms/inventory/unlock | 释放冻结库存 | - |

### 拣货任务
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/wms/pick-tasks | 创建拣货任务 | - |
| POST | /api/v1/wms/pick-tasks/:id/verify | 拣货复核 | - |
| GET | /api/v1/wms/pick-tasks | 拣货任务列表 | - |

### 盘点
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/wms/stock-takes | 盘点单列表 | - |
| POST | /api/v1/wms/stock-takes | 创建盘点单 | - |
| PATCH | /api/v1/wms/stock-takes/:id/start | 开始盘点 | - |
| POST | /api/v1/wms/stock-takes/lines/:lineId/count | 录入盘点数量 | - |
| GET | /api/v1/wms/stock-takes/:id/diff | 盘点差异分析 | - |
| PATCH | /api/v1/wms/stock-takes/:id/approve | 审批并调整库存 | - |

---

## QMS 质量管理系统 (QMS)

**路由前缀:** `/api/v1/qms`

### 检验标准
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/qms/standards | 检验标准列表 | - |
| GET | /api/v1/qms/standards/:id | 检验标准详情 | - |
| POST | /api/v1/qms/standards | 创建检验标准 | - |
| POST | /api/v1/qms/standards/:id/version | 创建新版本 | - |

### 检验记录
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/qms/inspections | 检验记录列表 | - |
| POST | /api/v1/qms/inspections | 创建检验任务 | - |
| PATCH | /api/v1/qms/inspections/:id/result | 录入检验结果（自动判定） | - |
| POST | /api/v1/qms/first-inspections | 首检任务创建 | - |
| POST | /api/v1/qms/final-inspections/inbound | 入库检验 | - |
| POST | /api/v1/qms/final-inspections/outbound | 出货检验 | - |

### 不合格品
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/qms/nonconformances | 不合格品列表 | - |
| GET | /api/v1/qms/nonconformances/:id | 不合格品详情 | - |
| POST | /api/v1/qms/nonconformances | 创建不合格品记录 | - |
| PATCH | /api/v1/qms/nonconformances/:id/disposition | 处置决策（返工/返修/报废/让步接收） | - |
| POST | /api/v1/qms/nonconformances/:id/rework | 返工跟踪 | - |

### SPC
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/qms/spc/data-points | 录入 SPC 数据点 | - |
| GET | /api/v1/qms/spc/chart/:itemId | SPC 控制图数据 | - |

---

## APS 高级计划排程 (APS)

**路由前缀:** `/api/v1/aps`

### 资源
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/aps/resources | 资源列表 | - |
| POST | /api/v1/aps/resources | 创建资源 | - |
| GET | /api/v1/aps/resources/:id | 资源详情 | - |
| PATCH | /api/v1/aps/resources/:id | 更新资源 | - |
| DELETE | /api/v1/aps/resources/:id | 删除资源 | - |
| PATCH | /api/v1/aps/resources/:id/status | 更新资源状态 | - |
| POST | /api/v1/aps/resources/:id/alternatives | 添加替代资源 | - |
| DELETE | /api/v1/aps/resources/:id/alternatives/:altId | 移除替代资源 | - |

### 日历
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/aps/calendars | 查询日历 | - |
| POST | /api/v1/aps/calendars | 创建日历条目 | - |
| POST | /api/v1/aps/calendars/batch | 批量创建日历条目 | - |
| PATCH | /api/v1/aps/calendars/holiday | 设置节假日 | - |
| GET | /api/v1/aps/calendars/working-hours | 查询工作时间 | - |

### 排程
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/aps/schedule | 触发正向排程 | - |
| POST | /api/v1/aps/schedule/backward | 反向排程 | - |
| POST | /api/v1/aps/schedule/release | 发布派工单 | - |
| GET | /api/v1/aps/schedules/wo/:woId | 查询工单排程 | - |
| DELETE | /api/v1/aps/schedules/:id | 取消排程 | - |
| GET | /api/v1/aps/schedules | 排程结果列表 | - |

### MRP
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/aps/mrp/calculate | MRP 计算 | - |
| GET | /api/v1/aps/mrp | MRP 列表 | - |
| GET | /api/v1/aps/mrp/:id | MRP 详情 | - |
| POST | /api/v1/aps/mrp/:id/release | 发布 MRP | - |
| GET | /api/v1/aps/mrp/:id/readiness | 齐套检查 | - |

---

## EAM 设备管理 (EAM)

**路由前缀:** `/api/v1/eam`

### 设备台账
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/eam/equipment | 设备列表 | - |
| POST | /api/v1/eam/equipment | 创建设备 | - |
| GET | /api/v1/eam/equipment/tree | 设备树 | - |
| GET | /api/v1/eam/equipment/qrcode/:code | 二维码查询设备 | - |
| GET | /api/v1/eam/equipment/:id | 设备详情 | - |
| PUT | /api/v1/eam/equipment/:id | 更新设备 | - |
| PUT | /api/v1/eam/equipment/:id/status | 设备状态变更 | - |
| GET | /api/v1/eam/equipment/:id/oee | 设备 OEE 记录 | - |

### 维保管理
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/eam/maintenance/strategies | 维保策略列表 | - |
| POST | /api/v1/eam/maintenance/strategies | 创建维保策略 | - |
| PUT | /api/v1/eam/maintenance/strategies/:id | 更新维保策略 | - |
| GET | /api/v1/eam/maintenance/plans | 维保计划列表 | - |
| POST | /api/v1/eam/maintenance/plans | 创建维保计划 | - |
| PUT | /api/v1/eam/maintenance/plans/:id | 更新维保计划 | - |
| DELETE | /api/v1/eam/maintenance/plans/:id | 取消维保计划 | - |
| POST | /api/v1/eam/maintenance/tasks/:id/complete | 完成维保任务 | - |

### 故障管理
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/v1/eam/fault-records | 故障列表 | - |
| POST | /api/v1/eam/fault-records | 故障报修 | - |
| GET | /api/v1/eam/fault-records/:id | 故障详情 | - |
| PUT | /api/v1/eam/fault-records/:id/respond | 故障响应 | - |
| PUT | /api/v1/eam/fault-records/:id/diagnose | 故障诊断 | - |
| PUT | /api/v1/eam/fault-records/:id/start-repair | 开始维修 | - |
| PUT | /api/v1/eam/fault-records/:id/complete-repair | 维修完成 | - |
| PUT | /api/v1/eam/fault-records/:id/verify-close | 验收关闭 | - |

### OEE
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | /api/v1/eam/oee | 录入 OEE 数据 | - |
| GET | /api/v1/eam/oee | OEE 记录查询 | - |

---

## HR 人力资源 (HR)

**路由前缀:** `/hr`

### 员工
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /hr/employees/overview | 员工概览 | - |
| GET | /hr/employees | 员工列表 | - |
| POST | /hr/employees | 创建员工 | - |
| GET | /hr/employees/:id | 员工详情 | - |
| PATCH | /hr/employees/:id | 更新员工 | - |
| PATCH | /hr/employees/:id/status | 更新员工状态 | - |

### 技能认证
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /hr/certification-types | 认证类型列表 | - |
| POST | /hr/certification-types | 创建认证类型 | - |
| GET | /hr/employees/:id/certifications | 员工认证列表 | - |
| POST | /hr/employees/:id/certifications | 添加认证 | - |
| GET | /hr/certifications/expiring | 即将过期认证提醒 | - |
| PATCH | /hr/certifications/:id/renew | 续期认证 | - |

### 工时
| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /hr/work-hours/dashboard | 工时看板 | - |
| GET | /hr/work-hours/summary | 工时汇总 | - |
| GET | /hr/work-hours/records | 工时记录 | - |

---

## 接口统计汇总

| 模块 | 接口数量 |
|------|---------|
| 认证 (Auth) | 4 |
| 系统管理 (Sys) | 32 |
| 基础主数据 (Base) | 13 |
| PLM 产品生命周期管理 | 63 |
| MES 制造执行系统 | 37 |
| WMS 仓储管理系统 | 34 |
| QMS 质量管理系统 | 26 |
| ERP 企业资源计划 | 76 |
| SCM 供应链管理 | 60 |
| APS 高级计划排程 | 38 |
| EAM 设备管理 | 46 |
| HR 人力资源 | 20 |
| Outsourcing 外协管理 | 17 |
| Traceability 追溯管理 | 15 |
| Event 事件总线 | 4 |
| File 文件存储 | 4 |
| Conversion 转换引擎 | 9 |
| Report 报表服务 | 2 |
| **总计** | **~500** |
