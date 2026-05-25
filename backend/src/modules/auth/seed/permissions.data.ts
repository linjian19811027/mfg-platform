/**
 * 完整权限种子数据定义
 *
 * 结构说明：
 * - type MENU：菜单目录 / 页面
 * - type BUTTON：页面级操作按钮（增删改查导出等）
 * - type API：后端接口级权限（通常与 BUTTON 一一对应）
 *
 * 每个业务模块定义为一个数组，格式为：
 * { code, name, type, module, path?, component?, icon?, children? }
 *
 * children 中的子权限通过 parentCode 关联到父级
 */
export interface SeedPermission {
  code: string
  name: string
  type: 'MENU' | 'BUTTON' | 'API'
  module: string
  path?: string
  component?: string
  icon?: string
  sortOrder?: number
  isVisible?: number
  parentCode?: string
  children?: Omit<SeedPermission, 'children'>[]
}

export const SEED_PERMISSIONS: SeedPermission[] = [
  // ════════════════════════════════════════════
  // 工作台
  // ════════════════════════════════════════════
  {
    code: 'dashboard', name: '工作台', type: 'MENU', module: 'SYS',
    path: '/dashboard', component: '/views/dashboard/index.vue', icon: 'IconDashboard',
    sortOrder: 1, isVisible: 1,
  },

  // ════════════════════════════════════════════
  // PLM 产品生命周期管理
  // ════════════════════════════════════════════
  {
    code: 'plm', name: 'PLM 产品管理', type: 'MENU', module: 'PLM',
    icon: 'IconApps', sortOrder: 10, isVisible: 1,
    children: [
      { code: 'plm:material', name: '物料管理', type: 'MENU', module: 'PLM',
        path: '/plm/material', component: '/views/plm/material/index.vue', icon: 'IconArchive', sortOrder: 1 },
      { code: 'plm:material:view', name: '查看物料', type: 'BUTTON', module: 'PLM', sortOrder: 1, parentCode: 'plm:material' },
      { code: 'plm:material:create', name: '创建物料', type: 'BUTTON', module: 'PLM', sortOrder: 2, parentCode: 'plm:material' },
      { code: 'plm:material:edit', name: '编辑物料', type: 'BUTTON', module: 'PLM', sortOrder: 3, parentCode: 'plm:material' },
      { code: 'plm:material:delete', name: '删除物料', type: 'BUTTON', module: 'PLM', sortOrder: 4, parentCode: 'plm:material' },

      { code: 'plm:category', name: '物料分类', type: 'MENU', module: 'PLM',
        path: '/plm/categories', component: '/views/plm/category/index.vue', icon: 'IconTags', sortOrder: 5 },
      { code: 'plm:category:view', name: '查看分类', type: 'BUTTON', module: 'PLM', parentCode: 'plm:category' },
      { code: 'plm:category:create', name: '创建分类', type: 'BUTTON', module: 'PLM', parentCode: 'plm:category' },
      { code: 'plm:category:edit', name: '编辑分类', type: 'BUTTON', module: 'PLM', parentCode: 'plm:category' },
      { code: 'plm:category:delete', name: '删除分类', type: 'BUTTON', module: 'PLM', parentCode: 'plm:category' },

      { code: 'plm:bom', name: 'BOM 管理', type: 'MENU', module: 'PLM',
        path: '/plm/bom', component: '/views/plm/bom/index.vue', icon: 'IconBranch', sortOrder: 10 },
      { code: 'plm:bom:view', name: '查看 BOM', type: 'BUTTON', module: 'PLM', parentCode: 'plm:bom' },
      { code: 'plm:bom:create', name: '创建 BOM', type: 'BUTTON', module: 'PLM', parentCode: 'plm:bom' },
      { code: 'plm:bom:edit', name: '编辑 BOM', type: 'BUTTON', module: 'PLM', parentCode: 'plm:bom' },
      { code: 'plm:bom:delete', name: '删除 BOM', type: 'BUTTON', module: 'PLM', parentCode: 'plm:bom' },

      { code: 'plm:routing', name: '工艺路线', type: 'MENU', module: 'PLM',
        path: '/plm/routings', component: '/views/plm/routing/index.vue', icon: 'IconSync', sortOrder: 15 },
      { code: 'plm:routing:view', name: '查看工艺路线', type: 'BUTTON', module: 'PLM', parentCode: 'plm:routing' },
      { code: 'plm:routing:create', name: '创建工艺路线', type: 'BUTTON', module: 'PLM', parentCode: 'plm:routing' },
      { code: 'plm:routing:edit', name: '编辑工艺路线', type: 'BUTTON', module: 'PLM', parentCode: 'plm:routing' },
      { code: 'plm:routing:delete', name: '删除工艺路线', type: 'BUTTON', module: 'PLM', parentCode: 'plm:routing' },

      { code: 'plm:std-operation', name: '标准工序库', type: 'MENU', module: 'PLM',
        path: '/plm/standard-operations', component: '/views/plm/standard-operation/index.vue', icon: 'IconList', sortOrder: 20 },
      { code: 'plm:std-operation:view', name: '查看标准工序', type: 'BUTTON', module: 'PLM', parentCode: 'plm:std-operation' },
      { code: 'plm:std-operation:create', name: '创建标准工序', type: 'BUTTON', module: 'PLM', parentCode: 'plm:std-operation' },
      { code: 'plm:std-operation:edit', name: '编辑标准工序', type: 'BUTTON', module: 'PLM', parentCode: 'plm:std-operation' },
      { code: 'plm:std-operation:delete', name: '删除标准工序', type: 'BUTTON', module: 'PLM', parentCode: 'plm:std-operation' },

      { code: 'plm:ecr', name: '变更申请(ECR)', type: 'MENU', module: 'PLM',
        path: '/plm/ecr', component: '/views/plm/ecr/index.vue', icon: 'IconEdit', sortOrder: 25 },
      { code: 'plm:ecr:view', name: '查看 ECR', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecr' },
      { code: 'plm:ecr:create', name: '创建 ECR', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecr' },
      { code: 'plm:ecr:edit', name: '编辑 ECR', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecr' },
      { code: 'plm:ecr:delete', name: '删除 ECR', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecr' },
      { code: 'plm:ecr:approve', name: '审批 ECR', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecr' },

      { code: 'plm:ecn', name: '变更通知(ECN)', type: 'MENU', module: 'PLM',
        path: '/plm/ecn', component: '/views/plm/ecn/index.vue', icon: 'IconNotification', sortOrder: 30 },
      { code: 'plm:ecn:view', name: '查看 ECN', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecn' },
      { code: 'plm:ecn:create', name: '创建 ECN', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecn' },
      { code: 'plm:ecn:edit', name: '编辑 ECN', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecn' },
      { code: 'plm:ecn:delete', name: '删除 ECN', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecn' },
      { code: 'plm:ecn:approve', name: '审批 ECN', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecn' },

      { code: 'plm:ecn-execution', name: 'ECN 执行计划', type: 'MENU', module: 'PLM',
        path: '/plm/ecn-execution-plans', component: '/views/plm/ecn-execution-plans/index.vue', icon: 'IconCalendar', sortOrder: 35 },
      { code: 'plm:ecn-execution:view', name: '查看执行计划', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecn-execution' },
      { code: 'plm:ecn-execution:create', name: '创建执行计划', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecn-execution' },
      { code: 'plm:ecn-execution:edit', name: '编辑执行计划', type: 'BUTTON', module: 'PLM', parentCode: 'plm:ecn-execution' },

      { code: 'plm:code-rule', name: '物料编码规则', type: 'MENU', module: 'PLM',
        path: '/plm/code-rules', component: '/views/plm/code-rule/index.vue', icon: 'IconCode', sortOrder: 40 },
      { code: 'plm:code-rule:view', name: '查看编码规则', type: 'BUTTON', module: 'PLM', parentCode: 'plm:code-rule' },
      { code: 'plm:code-rule:create', name: '创建编码规则', type: 'BUTTON', module: 'PLM', parentCode: 'plm:code-rule' },
      { code: 'plm:code-rule:edit', name: '编辑编码规则', type: 'BUTTON', module: 'PLM', parentCode: 'plm:code-rule' },

      { code: 'plm:document', name: '文档管理', type: 'MENU', module: 'PLM',
        path: '/plm/documents', component: '/views/plm/document/index.vue', icon: 'IconBook', sortOrder: 45 },
      { code: 'plm:document:view', name: '查看文档', type: 'BUTTON', module: 'PLM', parentCode: 'plm:document' },
      { code: 'plm:document:create', name: '上传文档', type: 'BUTTON', module: 'PLM', parentCode: 'plm:document' },
      { code: 'plm:document:delete', name: '删除文档', type: 'BUTTON', module: 'PLM', parentCode: 'plm:document' },
    ],
  },

  // ════════════════════════════════════════════
  // MES 生产执行管理
  // ════════════════════════════════════════════
  {
    code: 'mes', name: 'MES 生产执行', type: 'MENU', module: 'MES',
    icon: 'IconSettings', sortOrder: 20, isVisible: 1,
    children: [
      { code: 'mes:workorder', name: '工单管理', type: 'MENU', module: 'MES',
        path: '/mes/workorder', component: '/views/mes/workorder/index.vue', icon: 'IconFile', sortOrder: 1 },
      { code: 'mes:workorder:view', name: '查看工单', type: 'BUTTON', module: 'MES', parentCode: 'mes:workorder' },
      { code: 'mes:workorder:create', name: '创建工单', type: 'BUTTON', module: 'MES', parentCode: 'mes:workorder' },
      { code: 'mes:workorder:edit', name: '编辑工单', type: 'BUTTON', module: 'MES', parentCode: 'mes:workorder' },
      { code: 'mes:workorder:delete', name: '删除工单', type: 'BUTTON', module: 'MES', parentCode: 'mes:workorder' },

      { code: 'mes:picking', name: '领料管理', type: 'MENU', module: 'MES',
        path: '/mes/picking', component: '/views/mes/picking/index.vue', icon: 'IconExport', sortOrder: 5 },
      { code: 'mes:picking:view', name: '查看领料', type: 'BUTTON', module: 'MES', parentCode: 'mes:picking' },
      { code: 'mes:picking:create', name: '创建领料单', type: 'BUTTON', module: 'MES', parentCode: 'mes:picking' },
      { code: 'mes:picking:approve', name: '审批领料', type: 'BUTTON', module: 'MES', parentCode: 'mes:picking' },

      { code: 'mes:operation', name: '工序操作', type: 'MENU', module: 'MES',
        path: '/mes/operation', component: '/views/mes/operation/index.vue', icon: 'IconInteraction', sortOrder: 10 },
      { code: 'mes:operation:view', name: '查看工序', type: 'BUTTON', module: 'MES', parentCode: 'mes:operation' },
      { code: 'mes:operation:start', name: '开始工序', type: 'BUTTON', module: 'MES', parentCode: 'mes:operation' },
      { code: 'mes:operation:complete', name: '完成工序', type: 'BUTTON', module: 'MES', parentCode: 'mes:operation' },

      { code: 'mes:wip', name: '在制品(WIP)', type: 'MENU', module: 'MES',
        path: '/mes/wip', component: '/views/mes/wip/index.vue', icon: 'IconLoading', sortOrder: 15 },
      { code: 'mes:wip:view', name: '查看在制品', type: 'BUTTON', module: 'MES', parentCode: 'mes:wip' },

      { code: 'mes:labor', name: '工时记录', type: 'MENU', module: 'MES',
        path: '/mes/labor', component: '/views/mes/labor/index.vue', icon: 'IconHistory', sortOrder: 20 },
      { code: 'mes:labor:view', name: '查看工时', type: 'BUTTON', module: 'MES', parentCode: 'mes:labor' },

      { code: 'mes:quality-board', name: '质量看板', type: 'MENU', module: 'MES',
        path: '/mes/quality-board', component: '/views/mes/quality-board/index.vue', icon: 'IconComputer', sortOrder: 25 },
      { code: 'mes:quality:view', name: '查看质量看板', type: 'BUTTON', module: 'MES', parentCode: 'mes:quality-board' },

      { code: 'mes:dashboard', name: '生产看板', type: 'MENU', module: 'MES',
        path: '/mes/dashboard', component: '/views/mes/dashboard/index.vue', icon: 'IconDashboard', sortOrder: 30 },
      { code: 'mes:dashboard:view', name: '查看生产看板', type: 'BUTTON', module: 'MES', parentCode: 'mes:dashboard' },

      { code: 'mes:auto-receipt', name: '自动入库配置', type: 'MENU', module: 'MES',
        path: '/mes/auto-receipt-config', component: '/views/mes/auto-receipt-config/index.vue', icon: 'IconSettings', sortOrder: 35 },
      { code: 'mes:receipt-logs', name: '入库日志', type: 'MENU', module: 'MES',
        path: '/mes/receipt-logs', component: '/views/mes/receipt-logs/index.vue', icon: 'IconBook', sortOrder: 36 },
    ],
  },

  // ════════════════════════════════════════════
  // WMS 仓储管理
  // ════════════════════════════════════════════
  {
    code: 'wms', name: 'WMS 仓储管理', type: 'MENU', module: 'WMS',
    icon: 'IconStorage', sortOrder: 30, isVisible: 1,
    children: [
      { code: 'wms:inventory', name: '库存查询', type: 'MENU', module: 'WMS',
        path: '/wms/inventory', component: '/views/wms/inventory/index.vue', icon: 'IconList', sortOrder: 1 },
      { code: 'wms:inventory:view', name: '查看库存', type: 'BUTTON', module: 'WMS', parentCode: 'wms:inventory' },
      { code: 'wms:inventory:export', name: '导出库存', type: 'BUTTON', module: 'WMS', parentCode: 'wms:inventory' },

      { code: 'wms:transaction', name: '库存流水', type: 'MENU', module: 'WMS',
        path: '/wms/transaction', component: '/views/wms/transaction/index.vue', icon: 'IconSwap', sortOrder: 5 },
      { code: 'wms:transaction:view', name: '查看流水', type: 'BUTTON', module: 'WMS', parentCode: 'wms:transaction' },

      { code: 'wms:warehouse', name: '仓库管理', type: 'MENU', module: 'WMS',
        path: '/wms/warehouse', component: '/views/wms/warehouse/index.vue', icon: 'IconHome', sortOrder: 10 },
      { code: 'wms:warehouse:view', name: '查看仓库', type: 'BUTTON', module: 'WMS', parentCode: 'wms:warehouse' },
      { code: 'wms:warehouse:create', name: '创建仓库', type: 'BUTTON', module: 'WMS', parentCode: 'wms:warehouse' },
      { code: 'wms:warehouse:edit', name: '编辑仓库', type: 'BUTTON', module: 'WMS', parentCode: 'wms:warehouse' },

      { code: 'wms:inventory-count', name: '盘点管理', type: 'MENU', module: 'WMS',
        path: '/wms/inventory-count', component: '/views/wms/inventory-count/index.vue', icon: 'IconScan', sortOrder: 15 },
      { code: 'wms:inventory-count:view', name: '查看盘点', type: 'BUTTON', module: 'WMS', parentCode: 'wms:inventory-count' },
      { code: 'wms:inventory-count:create', name: '创建盘点', type: 'BUTTON', module: 'WMS', parentCode: 'wms:inventory-count' },
      { code: 'wms:inventory-count:approve', name: '审核盘点', type: 'BUTTON', module: 'WMS', parentCode: 'wms:inventory-count' },

      { code: 'wms:picking', name: '拣货任务', type: 'MENU', module: 'WMS',
        path: '/wms/picking-tasks', component: '/views/wms/picking-task/index.vue', icon: 'IconCommand', sortOrder: 20 },
      { code: 'wms:picking:view', name: '查看拣货', type: 'BUTTON', module: 'WMS', parentCode: 'wms:picking' },
      { code: 'wms:picking:assign', name: '分配拣货', type: 'BUTTON', module: 'WMS', parentCode: 'wms:picking' },

      { code: 'wms:safety-stock', name: '安全库存', type: 'MENU', module: 'WMS',
        path: '/wms/safety-stock', component: '/views/wms/safety-stock/index.vue', icon: 'IconSafe', sortOrder: 25 },
      { code: 'wms:safety:view', name: '查看安全库存', type: 'BUTTON', module: 'WMS', parentCode: 'wms:safety-stock' },
      { code: 'wms:safety-stock:edit', name: '设置安全库存', type: 'BUTTON', module: 'WMS', parentCode: 'wms:safety-stock' },

      { code: 'wms:barcode-rule', name: '条码规则', type: 'MENU', module: 'WMS',
        path: '/wms/barcode-rules', component: '/views/wms/barcode-rule/index.vue', icon: 'IconStorage', sortOrder: 30 },
      { code: 'wms:barcode:view', name: '查看条码规则', type: 'BUTTON', module: 'WMS', parentCode: 'wms:barcode-rule' },

      { code: 'wms:ledger', name: '库存台账', type: 'MENU', module: 'WMS',
        path: '/wms/reports/ledger', component: '/views/wms/reports/ledger.vue', icon: 'IconBook', sortOrder: 35 },
      { code: 'wms:report:view', name: '查看报表', type: 'BUTTON', module: 'WMS', parentCode: 'wms:ledger' },
      { code: 'wms:turnover', name: '库存周转率', type: 'MENU', module: 'WMS',
        path: '/wms/reports/turnover', component: '/views/wms/reports/turnover.vue', icon: 'IconDashboard', sortOrder: 40 },
      { code: 'wms:dashboard', name: '仓储看板', type: 'MENU', module: 'WMS',
        path: '/wms/dashboard', component: '/views/wms/dashboard/index.vue', icon: 'IconDashboard', sortOrder: 45 },
      { code: 'wms:dashboard:view', name: '查看仓储看板', type: 'BUTTON', module: 'WMS', parentCode: 'wms:dashboard' },
      { code: 'wms:count:view', name: '查看盘点', type: 'BUTTON', module: 'WMS', parentCode: 'wms:inventory-count' },
    ],
  },

  // ════════════════════════════════════════════
  // QMS 质量管理
  // ════════════════════════════════════════════
  {
    code: 'qms', name: 'QMS 质量管理', type: 'MENU', module: 'QMS',
    icon: 'IconCheckCircle', sortOrder: 40, isVisible: 1,
    children: [
      { code: 'qms:inspection', name: '检验管理', type: 'MENU', module: 'QMS',
        path: '/qms/inspection', component: '/views/qms/inspection/index.vue', icon: 'IconList', sortOrder: 1 },
      { code: 'qms:inspection:view', name: '查看检验', type: 'BUTTON', module: 'QMS', parentCode: 'qms:inspection' },
      { code: 'qms:inspection:create', name: '创建检验单', type: 'BUTTON', module: 'QMS', parentCode: 'qms:inspection' },
      { code: 'qms:inspection:edit', name: '编辑检验单', type: 'BUTTON', module: 'QMS', parentCode: 'qms:inspection' },
      { code: 'qms:inspection:approve', name: '审核检验', type: 'BUTTON', module: 'QMS', parentCode: 'qms:inspection' },

      { code: 'qms:nonconformance', name: '不合格品处理', type: 'MENU', module: 'QMS',
        path: '/qms/nonconformance', component: '/views/qms/nonconformance/index.vue', icon: 'IconCloseCircle', sortOrder: 5 },
      { code: 'qms:nonconformance:view', name: '查看不合格品', type: 'BUTTON', module: 'QMS', parentCode: 'qms:nonconformance' },
      { code: 'qms:nonconformance:create', name: '录入不合格品', type: 'BUTTON', module: 'QMS', parentCode: 'qms:nonconformance' },
      { code: 'qms:nonconformance:disposition', name: '处置不合格品', type: 'BUTTON', module: 'QMS', parentCode: 'qms:nonconformance' },

      { code: 'qms:standard', name: '检验标准', type: 'MENU', module: 'QMS',
        path: '/qms/inspection-standards', component: '/views/qms/standard/index.vue', icon: 'IconTags', sortOrder: 10 },

      { code: 'qms:spc', name: 'SPC 统计过程控制', type: 'MENU', module: 'QMS',
        path: '/qms/spc', component: '/views/qms/spc/index.vue', icon: 'IconDashboard', sortOrder: 15 },

      { code: 'qms:capa', name: 'CAPA 纠正预防', type: 'MENU', module: 'QMS',
        path: '/qms/capa', component: '/views/qms/capa/index.vue', icon: 'IconShield', sortOrder: 20 },
      { code: 'qms:capa:view', name: '查看 CAPA', type: 'BUTTON', module: 'QMS', parentCode: 'qms:capa' },
      { code: 'qms:capa:create', name: '创建 CAPA', type: 'BUTTON', module: 'QMS', parentCode: 'qms:capa' },
      { code: 'qms:capa:approve', name: '审批 CAPA', type: 'BUTTON', module: 'QMS', parentCode: 'qms:capa' },

      { code: 'qms:final', name: '成品检验', type: 'MENU', module: 'QMS',
        path: '/qms/final-inspection', component: '/views/qms/final-inspection/index.vue', icon: 'IconSkin', sortOrder: 25 },
      { code: 'qms:supplier', name: '供应商质量', type: 'MENU', module: 'QMS',
        path: '/qms/supplier-quality', component: '/views/qms/supplier-quality/index.vue', icon: 'IconUser', sortOrder: 30 },
      { code: 'qms:complaint', name: '客户投诉', type: 'MENU', module: 'QMS',
        path: '/qms/complaints', component: '/views/qms/complaint/index.vue', icon: 'IconBulb', sortOrder: 35 },
      { code: 'qms:recall', name: '召回管理', type: 'MENU', module: 'QMS',
        path: '/qms/recalls', component: '/views/qms/recall/index.vue', icon: 'IconExport', sortOrder: 40 },
    ],
  },

  // ════════════════════════════════════════════
  // SCM 供应链管理
  // ════════════════════════════════════════════
  {
    code: 'scm', name: 'SCM 供应链管理', type: 'MENU', module: 'SCM',
    icon: 'IconTruck', sortOrder: 50, isVisible: 1,
    children: [
      { code: 'scm:supplier', name: '供应商管理', type: 'MENU', module: 'SCM',
        path: '/scm/suppliers', component: '/views/scm/suppliers/index.vue', icon: 'IconUserGroup', sortOrder: 1 },
      { code: 'scm:supplier:view', name: '查看供应商', type: 'BUTTON', module: 'SCM', parentCode: 'scm:supplier' },
      { code: 'scm:supplier:create', name: '创建供应商', type: 'BUTTON', module: 'SCM', parentCode: 'scm:supplier' },
      { code: 'scm:supplier:edit', name: '编辑供应商', type: 'BUTTON', module: 'SCM', parentCode: 'scm:supplier' },

      { code: 'scm:purchase-order', name: '采购订单', type: 'MENU', module: 'SCM',
        path: '/scm/purchase-orders', component: '/views/scm/purchase-order/index.vue', icon: 'IconFileText', sortOrder: 5 },
      { code: 'scm:purchase-order:view', name: '查看订单', type: 'BUTTON', module: 'SCM', parentCode: 'scm:purchase-order' },
      { code: 'scm:purchase-order:create', name: '创建订单', type: 'BUTTON', module: 'SCM', parentCode: 'scm:purchase-order' },
      { code: 'scm:purchase-order:approve', name: '审批订单', type: 'BUTTON', module: 'SCM', parentCode: 'scm:purchase-order' },
      { code: 'scm:purchase-order:receive', name: '收货', type: 'BUTTON', module: 'SCM', parentCode: 'scm:purchase-order' },

      { code: 'scm:contract', name: '合同管理', type: 'MENU', module: 'SCM',
        path: '/scm/contracts', component: '/views/scm/contract/index.vue', icon: 'IconFile', sortOrder: 10 },

      { code: 'scm:evaluation', name: '供应商评估', type: 'MENU', module: 'SCM',
        path: '/scm/evaluations', component: '/views/scm/evaluation/index.vue', icon: 'IconStar', sortOrder: 15 },

      { code: 'scm:asn', name: 'ASN 到货通知', type: 'MENU', module: 'SCM',
        path: '/scm/asn', component: '/views/scm/asn/index.vue', icon: 'IconMessage', sortOrder: 20 },
      { code: 'scm:rfq', name: '询价管理', type: 'MENU', module: 'SCM',
        path: '/scm/rfqs', component: '/views/scm/rfq/index.vue', icon: 'IconSearch', sortOrder: 25 },
      { code: 'scm:receipt', name: '到货记录', type: 'MENU', module: 'SCM',
        path: '/scm/receipt', component: '/views/scm/receipt/index.vue', icon: 'IconDownload', sortOrder: 30 },
      { code: 'scm:reconcile', name: '供应商对账', type: 'MENU', module: 'SCM',
        path: '/scm/reconciliations', component: '/views/scm/reconciliation/index.vue', icon: 'IconRelation', sortOrder: 35 },
      { code: 'scm:performance', name: '供应商绩效', type: 'MENU', module: 'SCM',
        path: '/scm/supplier-performance', component: '/views/scm/performance/index.vue', icon: 'IconDashboard', sortOrder: 40 },
      { code: 'scm:price-agreement', name: '价格协议', type: 'MENU', module: 'SCM',
        path: '/scm/price-agreements', component: '/views/scm/price-agreement/index.vue', icon: 'IconSafe', sortOrder: 45 },
      { code: 'scm:qualification', name: '供应商资质', type: 'MENU', module: 'SCM',
        path: '/scm/qualifications', component: '/views/scm/qualification/index.vue', icon: 'IconCheckCircle', sortOrder: 50 },
      { code: 'scm:receipt-exception', name: '到货异常', type: 'MENU', module: 'SCM',
        path: '/scm/receipt-exceptions', component: '/views/scm/receipt-exception/index.vue', icon: 'IconNotification', sortOrder: 55 },
      { code: 'scm:analytics', name: '采购分析', type: 'MENU', module: 'SCM',
        path: '/scm/analytics', component: '/views/scm/analytics/index.vue', icon: 'IconBarChart', sortOrder: 60 },
    ],
  },

  // ════════════════════════════════════════════
  // ERP 企业资源管理
  // ════════════════════════════════════════════
  {
    code: 'erp', name: 'ERP 企业资源', type: 'MENU', module: 'ERP',
    icon: 'IconDesktop', sortOrder: 60, isVisible: 1,
    children: [
      { code: 'erp:quotation', name: '报价管理', type: 'MENU', module: 'ERP',
        path: '/erp/quotations', component: '/views/erp/quotation/index.vue', icon: 'IconMoney', sortOrder: 1 },
      { code: 'erp:quotation:view', name: '查看报价', type: 'BUTTON', module: 'ERP', parentCode: 'erp:quotation' },
      { code: 'erp:quotation:create', name: '创建报价', type: 'BUTTON', module: 'ERP', parentCode: 'erp:quotation' },
      { code: 'erp:quotation:approve', name: '审批报价', type: 'BUTTON', module: 'ERP', parentCode: 'erp:quotation' },
      { code: 'erp:quotation:convert', name: '转订单', type: 'BUTTON', module: 'ERP', parentCode: 'erp:quotation' },

      { code: 'erp:customer', name: '客户管理', type: 'MENU', module: 'ERP',
        path: '/erp/customers', component: '/views/erp/customer/index.vue', icon: 'IconUserGroup', sortOrder: 5 },

      { code: 'erp:sales-order', name: '销售订单', type: 'MENU', module: 'ERP',
        path: '/erp/sales-orders', component: '/views/erp/sales-order/index.vue', icon: 'IconFile', sortOrder: 10 },

      { code: 'erp:price', name: '价格历史', type: 'MENU', module: 'ERP',
        path: '/erp/price-history', component: '/views/erp/price-history/index.vue', icon: 'IconChart', sortOrder: 15 },

      { code: 'erp:mrp', name: 'MRP 物料需求', type: 'MENU', module: 'ERP',
        path: '/erp/mrp', component: '/views/erp/mrp/index.vue', icon: 'IconGrid', sortOrder: 20 },

      { code: 'erp:voucher', name: '财务凭证', type: 'MENU', module: 'ERP',
        path: '/erp/voucher', component: '/views/erp/voucher/index.vue', icon: 'IconAudit', sortOrder: 25 },
      { code: 'erp:shipment', name: '发货管理', type: 'MENU', module: 'ERP',
        path: '/erp/shipments', component: '/views/erp/shipment/index.vue', icon: 'IconTruck', sortOrder: 30 },
      { code: 'erp:return', name: '销售退货', type: 'MENU', module: 'ERP',
        path: '/erp/sales-returns', component: '/views/erp/sales-return/index.vue', icon: 'IconUndo', sortOrder: 35 },
      { code: 'erp:receivable', name: '应收账款', type: 'MENU', module: 'ERP',
        path: '/erp/receivables', component: '/views/erp/receivable/index.vue', icon: 'IconDoubleDown', sortOrder: 40 },
      { code: 'erp:payable', name: '应付账款', type: 'MENU', module: 'ERP',
        path: '/erp/payables', component: '/views/erp/payable/index.vue', icon: 'IconDoubleUp', sortOrder: 45 },
      { code: 'erp:account', name: '科目管理', type: 'MENU', module: 'ERP',
        path: '/erp/accounts', component: '/views/erp/account/index.vue', icon: 'IconStorage', sortOrder: 50 },
      { code: 'erp:cost-center', name: '成本中心', type: 'MENU', module: 'ERP',
        path: '/erp/cost-centers', component: '/views/erp/cost-center/index.vue', icon: 'IconNav', sortOrder: 55 },
      { code: 'erp:std-cost', name: '标准成本', type: 'MENU', module: 'ERP',
        path: '/erp/standard-costs', component: '/views/erp/standard-cost/index.vue', icon: 'IconSafe', sortOrder: 60 },
      { code: 'erp:cost-analysis', name: '成本分析', type: 'MENU', module: 'ERP',
        path: '/erp/cost-analysis', component: '/views/erp/cost-analysis/index.vue', icon: 'IconBarChart', sortOrder: 65 },
      { code: 'erp:sales-analytics', name: '销售分析', type: 'MENU', module: 'ERP',
        path: '/erp/sales-analytics', component: '/views/erp/sales-analytics/index.vue', icon: 'IconDashboard', sortOrder: 70 },
      { code: 'erp:cost-element', name: '成本要素', type: 'MENU', module: 'ERP',
        path: '/erp/cost-elements', component: '/views/erp/cost-element/index.vue', icon: 'IconStorage', sortOrder: 75 },
      { code: 'erp:ledger', name: '总账', type: 'MENU', module: 'ERP',
        path: '/erp/ledger/general', component: '/views/erp/ledger/index.vue', icon: 'IconBook', sortOrder: 80 },
      { code: 'erp:financial-report', name: '财务报表', type: 'MENU', module: 'ERP',
        path: '/erp/financial-reports', component: '/views/erp/financial-report/index.vue', icon: 'IconBarChart', sortOrder: 85 },
    ],
  },

  // ════════════════════════════════════════════
  // EAM 设备资产管理
  // ════════════════════════════════════════════
  {
    code: 'eam', name: 'EAM 设备管理', type: 'MENU', module: 'EAM',
    icon: 'IconTool', sortOrder: 70, isVisible: 1,
    children: [
      { code: 'eam:equipment', name: '设备台账', type: 'MENU', module: 'EAM',
        path: '/eam/equipment', component: '/views/eam/equipment/index.vue', icon: 'IconTool', sortOrder: 1 },
      { code: 'eam:equipment:view', name: '查看设备', type: 'BUTTON', module: 'EAM', parentCode: 'eam:equipment' },
      { code: 'eam:equipment:create', name: '创建设备', type: 'BUTTON', module: 'EAM', parentCode: 'eam:equipment' },
      { code: 'eam:equipment:edit', name: '编辑设备', type: 'BUTTON', module: 'EAM', parentCode: 'eam:equipment' },
      { code: 'eam:equipment:delete', name: '删除设备', type: 'BUTTON', module: 'EAM', parentCode: 'eam:equipment' },

      { code: 'eam:maintenance', name: '保养计划', type: 'MENU', module: 'EAM',
        path: '/eam/maintenance-orders', component: '/views/eam/maintenance/index.vue', icon: 'IconCalendar', sortOrder: 5 },
      { code: 'eam:maintenance:view', name: '查看保养', type: 'BUTTON', module: 'EAM', parentCode: 'eam:maintenance' },
      { code: 'eam:maintenance:create', name: '创建保养计划', type: 'BUTTON', module: 'EAM', parentCode: 'eam:maintenance' },
      { code: 'eam:maintenance:execute', name: '执行保养', type: 'BUTTON', module: 'EAM', parentCode: 'eam:maintenance' },

      { code: 'eam:repair', name: '维修工单', type: 'MENU', module: 'EAM',
        path: '/eam/repair-orders', component: '/views/eam/repair/index.vue', icon: 'IconBug', sortOrder: 10 },
      { code: 'eam:repair:view', name: '查看维修', type: 'BUTTON', module: 'EAM', parentCode: 'eam:repair' },
      { code: 'eam:repair:create', name: '创建维修工单', type: 'BUTTON', module: 'EAM', parentCode: 'eam:repair' },
      { code: 'eam:repair:dispatch', name: '派工', type: 'BUTTON', module: 'EAM', parentCode: 'eam:repair' },

      { code: 'eam:inspection', name: '点检任务', type: 'MENU', module: 'EAM',
        path: '/eam/inspection-tasks', component: '/views/eam/inspection/index.vue', icon: 'IconSearch', sortOrder: 15 },

      { code: 'eam:spare-part', name: '备件管理', type: 'MENU', module: 'EAM',
        path: '/eam/spare-parts', component: '/views/eam/spare-part/index.vue', icon: 'IconStorage', sortOrder: 20 },

      { code: 'eam:oee', name: 'OEE 管理', type: 'MENU', module: 'EAM',
        path: '/eam/oee', component: '/views/eam/oee/index.vue', icon: 'IconDashboard', sortOrder: 25 },

      { code: 'eam:knowledge', name: '故障知识库', type: 'MENU', module: 'EAM',
        path: '/eam/knowledge', component: '/views/eam/knowledge/index.vue', icon: 'IconBook', sortOrder: 30 },
    ],
  },

  // ════════════════════════════════════════════
  // APS 高级排程
  // ════════════════════════════════════════════
  {
    code: 'aps', name: 'APS 高级排程', type: 'MENU', module: 'APS',
    icon: 'IconChart', sortOrder: 80, isVisible: 1,
    children: [
      { code: 'aps:plan', name: '排程计划', type: 'MENU', module: 'APS',
        path: '/aps/plans', component: '/views/aps/plan/index.vue', icon: 'IconList', sortOrder: 1 },
      { code: 'aps:plan:view', name: '查看计划', type: 'BUTTON', module: 'APS', parentCode: 'aps:plan' },
      { code: 'aps:plan:create', name: '创建计划', type: 'BUTTON', module: 'APS', parentCode: 'aps:plan' },
      { code: 'aps:plan:publish', name: '发布计划', type: 'BUTTON', module: 'APS', parentCode: 'aps:plan' },

      { code: 'aps:gantt', name: '甘特图', type: 'MENU', module: 'APS',
        path: '/aps/gantt', component: '/views/aps/gantt/index.vue', icon: 'IconGrid', sortOrder: 5 },

      { code: 'aps:calendar', name: '资源日历', type: 'MENU', module: 'APS',
        path: '/aps/calendar', component: '/views/aps/calendar/index.vue', icon: 'IconCalendar', sortOrder: 10 },
      { code: 'aps:resource', name: '资源管理', type: 'MENU', module: 'APS',
        path: '/aps/resources', component: '/views/aps/resource/index.vue', icon: 'IconLayers', sortOrder: 15 },
      { code: 'aps:mrp', name: 'MRP 运算', type: 'MENU', module: 'APS',
        path: '/aps/mrp', component: '/views/aps/mrp/index.vue', icon: 'IconSync', sortOrder: 20 },
      { code: 'aps:capacity', name: '产能分析', type: 'MENU', module: 'APS',
        path: '/aps/capacity', component: '/views/aps/capacity/index.vue', icon: 'IconBook', sortOrder: 25 },
      { code: 'aps:priority-rule', name: '优先级规则', type: 'MENU', module: 'APS',
        path: '/aps/priority-rules', component: '/views/aps/priority-rule/index.vue', icon: 'IconSettings', sortOrder: 30 },
    ],
  },

  // ════════════════════════════════════════════
  // HR 人力资源
  // ════════════════════════════════════════════
  {
    code: 'hr', name: 'HR 人力资源', type: 'MENU', module: 'HR',
    icon: 'IconUser', sortOrder: 90, isVisible: 1,
    children: [
      { code: 'hr:employee', name: '员工档案', type: 'MENU', module: 'HR',
        path: '/hr/employees', component: '/views/hr/employees/index.vue', icon: 'IconUserGroup', sortOrder: 1 },
      { code: 'hr:employee:view', name: '查看员工', type: 'BUTTON', module: 'HR', parentCode: 'hr:employee' },
      { code: 'hr:employee:create', name: '创建员工', type: 'BUTTON', module: 'HR', parentCode: 'hr:employee' },
      { code: 'hr:employee:edit', name: '编辑员工', type: 'BUTTON', module: 'HR', parentCode: 'hr:employee' },
      { code: 'hr:employee:delete', name: '删除员工', type: 'BUTTON', module: 'HR', parentCode: 'hr:employee' },
      { code: 'hr:employee:import', name: '导入员工', type: 'BUTTON', module: 'HR', parentCode: 'hr:employee' },

      { code: 'hr:cert', name: '认证预警', type: 'MENU', module: 'HR',
        path: '/hr/certifications/expiring', component: '/views/hr/certifications/expiring.vue', icon: 'IconNotification', sortOrder: 5 },

      { code: 'hr:schedule', name: '排班管理', type: 'MENU', module: 'HR',
        path: '/hr/schedules', component: '/views/hr/schedules/index.vue', icon: 'IconSchedule', sortOrder: 10 },

      { code: 'hr:workhour', name: '工时查询', type: 'MENU', module: 'HR',
        path: '/hr/work-hours/summary', component: '/views/hr/work-hours/summary.vue', icon: 'IconHistory', sortOrder: 15 },
      { code: 'hr:workhour-dashboard', name: '工时看板', type: 'MENU', module: 'HR',
        path: '/hr/work-hours/dashboard', component: '/views/hr/work-hours/dashboard.vue', icon: 'IconDashboard', sortOrder: 20 },
    ],
  },

  // ════════════════════════════════════════════
  // Traceability 追溯管理
  // ════════════════════════════════════════════
  {
    code: 'traceability', name: '追溯管理', type: 'MENU', module: 'TRACEABILITY',
    icon: 'IconConnection', sortOrder: 100, isVisible: 1,
    children: [
      { code: 'traceability:forward', name: '正向追溯', type: 'MENU', module: 'TRACEABILITY',
        path: '/traceability/forward', component: '/views/traceability/forward/index.vue', icon: 'IconArrowForward', sortOrder: 1 },
      { code: 'traceability:batch', name: '批次追溯', type: 'MENU', module: 'TRACEABILITY',
        path: '/traceability/batches', component: '/views/traceability/batch/index.vue', icon: 'IconList', sortOrder: 3 },
      { code: 'traceability:backward', name: '反向追溯', type: 'MENU', module: 'TRACEABILITY',
        path: '/traceability/backward', component: '/views/traceability/backward/index.vue', icon: 'IconArrowBack', sortOrder: 5 },
      { code: 'traceability:recall', name: '召回管理', type: 'MENU', module: 'TRACEABILITY',
        path: '/traceability/recall', component: '/views/traceability/recall/index.vue', icon: 'IconWarning', sortOrder: 10 },
      { code: 'traceability:dashboard', name: '追溯看板', type: 'MENU', module: 'TRACEABILITY',
        path: '/traceability/dashboard', component: '/views/traceability/dashboard/index.vue', icon: 'IconDashboard', sortOrder: 15 },
    ],
  },

  // ════════════════════════════════════════════
  // 外协加工
  // ════════════════════════════════════════════
  {
    code: 'outsourcing', name: '外协加工', type: 'MENU', module: 'OUTSOURCING',
    icon: 'IconLink', sortOrder: 110, isVisible: 1,
    children: [
      { code: 'outsourcing:order', name: '外协订单', type: 'MENU', module: 'OUTSOURCING',
        path: '/outsourcing/orders', component: '/views/outsourcing/orders/index.vue', icon: 'IconFile', sortOrder: 1 },
      { code: 'outsourcing:order:view', name: '查看外协订单', type: 'BUTTON', module: 'OUTSOURCING', parentCode: 'outsourcing:order' },
      { code: 'outsourcing:order:create', name: '创建外协订单', type: 'BUTTON', module: 'OUTSOURCING', parentCode: 'outsourcing:order' },
      { code: 'outsourcing:order:receive', name: '外协收货', type: 'BUTTON', module: 'OUTSOURCING', parentCode: 'outsourcing:order' },
    ],
  },

  // ════════════════════════════════════════════
  // RPT 报表设计
  // ════════════════════════════════════════════
  {
    code: 'rpt', name: '报表设计', type: 'MENU', module: 'RPT',
    icon: 'IconBarChart', sortOrder: 115, isVisible: 1,
    children: [
      { code: 'rpt:list', name: '我的报表', type: 'MENU', module: 'RPT',
        path: '/rpt/list', component: '/views/rpt/list/index.vue', icon: 'IconFile', sortOrder: 1 },
    ],
  },

  // ════════════════════════════════════════════
  // 平台管理（仅超管可见）
  // ════════════════════════════════════════════
  {
    code: 'platform', name: '平台管理', type: 'MENU', module: 'PLATFORM',
    icon: 'IconCloud', sortOrder: 250, isVisible: 1,
    children: [
      { code: 'platform:tenant', name: '租户管理', type: 'MENU', module: 'PLATFORM',
        path: '/sys/tenant', component: '/views/sys/tenant/index.vue', icon: 'IconUserGroup', sortOrder: 1 },
      { code: 'platform:monitor', name: '平台监控', type: 'MENU', module: 'PLATFORM',
        path: '/sys/monitor', component: '/views/sys/monitor/index.vue', icon: 'IconDashboard', sortOrder: 5 },
    ],
  },

  // ════════════════════════════════════════════
  // 基础数据
  // ════════════════════════════════════════════
  {
    code: 'base', name: '基础数据', type: 'MENU', module: 'BASE',
    icon: 'IconStorage', sortOrder: 70, isVisible: 1,
    children: [
      { code: 'base:batch', name: '批次管理', type: 'MENU', module: 'BASE',
        path: '/base/batch', component: '/views/base/batch/index.vue', icon: 'IconList', sortOrder: 1 },
      { code: 'base:batch:view', name: '查看批次', type: 'BUTTON', module: 'BASE', parentCode: 'base:batch' },
      { code: 'base:batch:create', name: '创建批次', type: 'BUTTON', module: 'BASE', parentCode: 'base:batch' },

      { code: 'base:file', name: '文件管理', type: 'MENU', module: 'BASE',
        path: '/base/file', component: '/views/base/file/index.vue', icon: 'IconFile', sortOrder: 5 },
      { code: 'base:file:upload', name: '上传文件', type: 'BUTTON', module: 'BASE', parentCode: 'base:file' },

      { code: 'base:shift', name: '班次管理', type: 'MENU', module: 'BASE',
        path: '/base/shifts', component: '/views/base/shifts/index.vue', icon: 'IconClockCircle', sortOrder: 10 },
      { code: 'base:shift:view', name: '查看班次', type: 'BUTTON', module: 'BASE', parentCode: 'base:shift' },
      { code: 'base:shift:create', name: '创建班次', type: 'BUTTON', module: 'BASE', parentCode: 'base:shift' },
      { code: 'base:shift:edit', name: '编辑班次', type: 'BUTTON', module: 'BASE', parentCode: 'base:shift' },

      { code: 'base:work-center', name: '工作中心', type: 'MENU', module: 'BASE',
        path: '/base/work-centers', component: '/views/base/work-center/index.vue', icon: 'IconStorage', sortOrder: 15 },
      { code: 'base:work-center:view', name: '查看工作中心', type: 'BUTTON', module: 'BASE', parentCode: 'base:work-center' },
      { code: 'base:work-center:create', name: '创建工作中心', type: 'BUTTON', module: 'BASE', parentCode: 'base:work-center' },
      { code: 'base:work-center:edit', name: '编辑工作中心', type: 'BUTTON', module: 'BASE', parentCode: 'base:work-center' },
      { code: 'base:work-center:delete', name: '删除工作中心', type: 'BUTTON', module: 'BASE', parentCode: 'base:work-center' },

      { code: 'base:cert-type', name: '认证类型', type: 'MENU', module: 'BASE',
        path: '/base/certification-types', component: '/views/base/certification-types/index.vue', icon: 'IconCertificate', sortOrder: 20 },
      { code: 'base:cert-type:view', name: '查看认证类型', type: 'BUTTON', module: 'BASE', parentCode: 'base:cert-type' },
      { code: 'base:cert-type:create', name: '创建认证类型', type: 'BUTTON', module: 'BASE', parentCode: 'base:cert-type' },
      { code: 'base:cert-type:edit', name: '编辑认证类型', type: 'BUTTON', module: 'BASE', parentCode: 'base:cert-type' },
    ],
  },

  // ════════════════════════════════════════════
  // 系统管理
  // ════════════════════════════════════════════
  {
    code: 'sys', name: '系统管理', type: 'MENU', module: 'SYS',
    icon: 'IconSettings', sortOrder: 200, isVisible: 1,
    children: [
      { code: 'sys:user', name: '用户管理', type: 'MENU', module: 'SYS',
        path: '/sys/user', component: '/views/sys/user/index.vue', icon: 'IconUser', sortOrder: 1 },
      { code: 'sys:user:list', name: '用户列表', type: 'BUTTON', module: 'SYS', parentCode: 'sys:user' },
      { code: 'sys:user:create', name: '创建用户', type: 'BUTTON', module: 'SYS', parentCode: 'sys:user' },
      { code: 'sys:user:update', name: '编辑用户', type: 'BUTTON', module: 'SYS', parentCode: 'sys:user' },
      { code: 'sys:user:delete', name: '删除用户', type: 'BUTTON', module: 'SYS', parentCode: 'sys:user' },

      { code: 'sys:role', name: '角色管理', type: 'MENU', module: 'SYS',
        path: '/sys/role', component: '/views/sys/role/index.vue', icon: 'IconCommon', sortOrder: 5 },
      { code: 'sys:role:list', name: '角色列表', type: 'BUTTON', module: 'SYS', parentCode: 'sys:role' },
      { code: 'sys:role:create', name: '创建角色', type: 'BUTTON', module: 'SYS', parentCode: 'sys:role' },
      { code: 'sys:role:update', name: '编辑角色', type: 'BUTTON', module: 'SYS', parentCode: 'sys:role' },
      { code: 'sys:role:delete', name: '删除角色', type: 'BUTTON', module: 'SYS', parentCode: 'sys:role' },

      { code: 'sys:audit', name: '审计日志', type: 'MENU', module: 'SYS',
        path: '/sys/audit-log', component: '/views/sys/audit-log/index.vue', icon: 'IconBook', sortOrder: 10 },
      { code: 'sys:audit:list', name: '查看审计日志', type: 'BUTTON', module: 'SYS', parentCode: 'sys:audit' },

      { code: 'sys:log', name: '系统日志', type: 'MENU', module: 'SYS',
        path: '/sys/logs', component: '/views/sys/logs/index.vue', icon: 'IconFile', sortOrder: 15 },

      { code: 'sys:monitor', name: '系统监控', type: 'MENU', module: 'SYS',
        path: '/sys/monitor', component: '/views/sys/monitor/index.vue', icon: 'IconDashboard', sortOrder: 20 },

      { code: 'sys:org', name: '组织架构', type: 'MENU', module: 'SYS',
        path: '/sys/organization', component: '/views/sys/organization/index.vue', icon: 'IconNav', sortOrder: 25 },
      { code: 'sys:org:view', name: '查看组织', type: 'BUTTON', module: 'SYS', parentCode: 'sys:org' },
      { code: 'sys:org:create', name: '创建组织', type: 'BUTTON', module: 'SYS', parentCode: 'sys:org' },
      { code: 'sys:org:update', name: '编辑组织', type: 'BUTTON', module: 'SYS', parentCode: 'sys:org' },
      { code: 'sys:org:delete', name: '删除组织', type: 'BUTTON', module: 'SYS', parentCode: 'sys:org' },

      { code: 'sys:numbering', name: '通用编码管理', type: 'MENU', module: 'SYS',
        path: '/sys/numbering', component: '/views/sys/numbering/index.vue', icon: 'IconCode', sortOrder: 30 },
      { code: 'sys:numbering:view', name: '查看编码规则', type: 'BUTTON', module: 'SYS', parentCode: 'sys:numbering' },

      { code: 'sys:permission', name: '权限管理', type: 'MENU', module: 'SYS',
        path: '/sys/permission', component: '/views/sys/permission/index.vue', icon: 'IconSafe', sortOrder: 32 },
      { code: 'sys:permission:view', name: '查看权限', type: 'BUTTON', module: 'SYS', parentCode: 'sys:permission' },

      { code: 'sys:tenant', name: '租户管理', type: 'MENU', module: 'SYS',
        path: '/sys/tenants', component: '/views/sys/tenants/index.vue', icon: 'IconCommon', sortOrder: 35 },
      { code: 'sys:tenant:view', name: '查看租户', type: 'BUTTON', module: 'SYS', parentCode: 'sys:tenant' },
      { code: 'sys:tenant:create', name: '创建租户', type: 'BUTTON', module: 'SYS', parentCode: 'sys:tenant' },
      { code: 'sys:tenant:update', name: '编辑租户', type: 'BUTTON', module: 'SYS', parentCode: 'sys:tenant' },

      { code: 'sys:uom', name: '计量单位', type: 'MENU', module: 'SYS',
        path: '/sys/uom', component: '/views/sys/uom/index.vue', icon: 'IconStorage', sortOrder: 40 },
      { code: 'sys:uom:view', name: '查看计量单位', type: 'BUTTON', module: 'SYS', parentCode: 'sys:uom' },
      { code: 'sys:uom:create', name: '创建计量单位', type: 'BUTTON', module: 'SYS', parentCode: 'sys:uom' },
      { code: 'sys:uom:update', name: '编辑计量单位', type: 'BUTTON', module: 'SYS', parentCode: 'sys:uom' },
      { code: 'sys:uom:delete', name: '删除计量单位', type: 'BUTTON', module: 'SYS', parentCode: 'sys:uom' },

      { code: 'sys:config', name: '全局配置', type: 'MENU', module: 'SYS',
        path: '/sys/config', component: '/views/sys/config/index.vue', icon: 'IconSettings', sortOrder: 45 },
      { code: 'sys:config:view', name: '查看配置', type: 'BUTTON', module: 'SYS', parentCode: 'sys:config' },
    ],
  },

  // ════════════════════════════════════════════
  // 补充缺失的权限码（为已有 MENU 添加 :view BUTTON）
  // ════════════════════════════════════════════
  // QMS 补充
  { code: 'qms:standard:view', name: '查看检验标准', type: 'BUTTON', module: 'QMS', parentCode: 'qms:standard' },
  { code: 'qms:spc:view', name: '查看SPC', type: 'BUTTON', module: 'QMS', parentCode: 'qms:spc' },
  { code: 'qms:nonconform:view', name: '查看不合格品', type: 'BUTTON', module: 'QMS', parentCode: 'qms:nonconformance' },
  { code: 'qms:complaint:view', name: '查看投诉', type: 'BUTTON', module: 'QMS', parentCode: 'qms' },
  { code: 'qms:recall:view', name: '查看召回', type: 'BUTTON', module: 'QMS', parentCode: 'qms' },
  { code: 'qms:supplier:view', name: '查看供应商质量', type: 'BUTTON', module: 'QMS', parentCode: 'qms' },

  // EAM 补充
  { code: 'eam:fault:view', name: '查看故障', type: 'BUTTON', module: 'EAM', parentCode: 'eam:repair' },
  { code: 'eam:inspection:view', name: '查看点检', type: 'BUTTON', module: 'EAM', parentCode: 'eam' },
  { code: 'eam:knowledge:view', name: '查看知识库', type: 'BUTTON', module: 'EAM', parentCode: 'eam' },
  { code: 'eam:oee:view', name: '查看OEE', type: 'BUTTON', module: 'EAM', parentCode: 'eam' },
  { code: 'eam:sparepart:view', name: '查看备件', type: 'BUTTON', module: 'EAM', parentCode: 'eam' },
  { code: 'eam:strategy:view', name: '查看策略', type: 'BUTTON', module: 'EAM', parentCode: 'eam' },

  // ERP 补充
  { code: 'erp:customer:view', name: '查看客户', type: 'BUTTON', module: 'ERP', parentCode: 'erp' },
  { code: 'erp:salesorder:view', name: '查看销售订单', type: 'BUTTON', module: 'ERP', parentCode: 'erp' },
  { code: 'erp:shipment:view', name: '查看发货', type: 'BUTTON', module: 'ERP', parentCode: 'erp' },
  { code: 'erp:return:view', name: '查看退货', type: 'BUTTON', module: 'ERP', parentCode: 'erp' },
  { code: 'erp:receivable:view', name: '查看应收', type: 'BUTTON', module: 'ERP', parentCode: 'erp' },
  { code: 'erp:payable:view', name: '查看应付', type: 'BUTTON', module: 'ERP', parentCode: 'erp' },
  { code: 'erp:account:view', name: '查看科目', type: 'BUTTON', module: 'ERP', parentCode: 'erp' },
  { code: 'erp:voucher:view', name: '查看凭证', type: 'BUTTON', module: 'ERP', parentCode: 'erp' },
  { code: 'erp:cost:view', name: '查看成本', type: 'BUTTON', module: 'ERP', parentCode: 'erp' },
  { code: 'erp:analytics:view', name: '查看分析', type: 'BUTTON', module: 'ERP', parentCode: 'erp' },

  // SCM 补充
  { code: 'scm:purchase:view', name: '查看采购订单', type: 'BUTTON', module: 'SCM', parentCode: 'scm' },
  { code: 'scm:pr:view', name: '查看采购申请', type: 'BUTTON', module: 'SCM', parentCode: 'scm' },
  { code: 'scm:asn:view', name: '查看ASN', type: 'BUTTON', module: 'SCM', parentCode: 'scm' },
  { code: 'scm:rfq:view', name: '查看询价', type: 'BUTTON', module: 'SCM', parentCode: 'scm' },
  { code: 'scm:receipt:view', name: '查看到货', type: 'BUTTON', module: 'SCM', parentCode: 'scm' },
  { code: 'scm:reconcile:view', name: '查看对账', type: 'BUTTON', module: 'SCM', parentCode: 'scm' },

  // APS 补充
  { code: 'aps:schedule:view', name: '查看排程', type: 'BUTTON', module: 'APS', parentCode: 'aps' },
  { code: 'aps:calendar:view', name: '查看日历', type: 'BUTTON', module: 'APS', parentCode: 'aps' },
  { code: 'aps:resource:view', name: '查看资源', type: 'BUTTON', module: 'APS', parentCode: 'aps' },
  { code: 'aps:mrp:view', name: '查看MRP', type: 'BUTTON', module: 'APS', parentCode: 'aps' },
  { code: 'aps:capacity:view', name: '查看产能', type: 'BUTTON', module: 'APS', parentCode: 'aps' },

  // HR 补充
  { code: 'hr:cert:view', name: '查看认证', type: 'BUTTON', module: 'HR', parentCode: 'hr' },
  { code: 'hr:schedule:view', name: '查看排班', type: 'BUTTON', module: 'HR', parentCode: 'hr' },
  { code: 'hr:workhour:view', name: '查看工时', type: 'BUTTON', module: 'HR', parentCode: 'hr' },

  // SYS 补充
  { code: 'sys:role:view', name: '查看角色', type: 'BUTTON', module: 'SYS', parentCode: 'sys:role' },
  { code: 'sys:user:view', name: '查看用户', type: 'BUTTON', module: 'SYS', parentCode: 'sys:user' },
  { code: 'sys:log:view', name: '查看日志', type: 'BUTTON', module: 'SYS', parentCode: 'sys:audit' },
  { code: 'sys:monitor:view', name: '查看监控', type: 'BUTTON', module: 'SYS', parentCode: 'sys' },

  // BASE 补充（已在主体树中定义的不重复）
  { code: 'base:file:view', name: '查看文件', type: 'BUTTON', module: 'BASE', parentCode: 'base:file' },
  { code: 'base:certtype:view', name: '查看认证类型', type: 'BUTTON', module: 'BASE', parentCode: 'base:cert-type' },

  // PLM 补充
  { code: 'plm:code:view', name: '查看编码规则', type: 'BUTTON', module: 'PLM', parentCode: 'plm:code-rule' },
]

/**
 * 系统管理员默认角色代码
 * 每个租户创建时自动创建这两个角色
 */
export const DEFAULT_ROLES = {
  TENANT_ADMIN: { code: 'TENANT_ADMIN', name: '租户管理员', type: 'TENANT_ADMIN' as const, description: '拥有本租户全部权限' },
  DEFAULT_USER: { code: 'USER', name: '普通用户', type: 'CUSTOM' as const, description: '默认用户角色，无任何权限' },
}
