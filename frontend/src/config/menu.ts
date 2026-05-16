export interface MenuItem {
  key: string
  title: string
  icon?: string
  path?: string
  permission?: string
  children?: MenuItem[]
}

export const menuConfig: MenuItem[] = [
  { key: 'dashboard', title: '工作台', icon: 'IconDashboard', path: '/dashboard' },
  {
    key: 'plm', title: 'PLM 产品', icon: 'IconApps',
    children: [
      { key: 'plm-material', title: '物料管理', path: '/plm/material', icon: 'IconArchive', permission: 'plm:material:view' },
      { key: 'plm-category', title: '物料分类', path: '/plm/categories', icon: 'IconTags', permission: 'plm:category:view' },
      { key: 'plm-bom', title: 'BOM 管理', path: '/plm/bom', icon: 'IconBranch', permission: 'plm:bom:view' },
      { key: 'plm-routing', title: '工艺路线', path: '/plm/routings', icon: 'IconSync', permission: 'plm:routing:view' },
      { key: 'plm-std-operation', title: '标准工序库', path: '/plm/standard-operations', icon: 'IconList', permission: 'plm:routing:view' },
      { key: 'plm-ecr', title: '变更申请(ECR)', path: '/plm/ecr', icon: 'IconEdit', permission: 'plm:ecr:view' },
      { key: 'plm-ecn', title: '变更通知(ECN)', path: '/plm/ecn', icon: 'IconNotification', permission: 'plm:ecn:view' },
      { key: 'plm-ecn-execution', title: 'ECN执行计划', path: '/plm/ecn-execution-plans', icon: 'IconCalendar', permission: 'plm:ecn:view' },
      { key: 'plm-code-rule', title: '物料编码规则', path: '/plm/code-rules', icon: 'IconCode', permission: 'plm:code:view' },
      { key: 'plm-document', title: '文档管理', path: '/plm/documents', icon: 'IconBook', permission: 'plm:document:view' },
    ],
  },
  {
    key: 'mes', title: 'MES 生产', icon: 'IconSettings',
    children: [
      { key: 'mes-workorder', title: '工单管理', path: '/mes/workorder', icon: 'IconFile', permission: 'mes:workorder:view' },
      { key: 'mes-picking', title: '领料管理', path: '/mes/picking', icon: 'IconExport', permission: 'mes:picking:view' },
      { key: 'mes-operation', title: '工序操作', path: '/mes/operation', icon: 'IconInteraction', permission: 'mes:operation:view' },
      { key: 'mes-wip', title: '在制品(WIP)', path: '/mes/wip', icon: 'IconLoading', permission: 'mes:wip:view' },
      { key: 'mes-labor', title: '工时记录', path: '/mes/labor', icon: 'IconHistory', permission: 'mes:labor:view' },
      { key: 'mes-quality-board', title: '质量看板', path: '/mes/quality-board', icon: 'IconComputer', permission: 'mes:quality:view' },
      { key: 'mes-dashboard', title: '生产看板', path: '/mes/dashboard', icon: 'IconDashboard', permission: 'mes:dashboard:view' },
    ],
  },
  {
    key: 'wms', title: 'WMS 仓储', icon: 'IconStorage',
    children: [
      { key: 'wms-inventory', title: '库存查询', path: '/wms/inventory', icon: 'IconList', permission: 'wms:inventory:view' },
      { key: 'wms-transaction', title: '库存流水', path: '/wms/transaction', icon: 'IconSwap', permission: 'wms:inventory:view' },
      { key: 'wms-warehouse', title: '仓库管理', path: '/wms/warehouse', icon: 'IconHome', permission: 'wms:warehouse:view' },
      { key: 'wms-count', title: '盘点管理', path: '/wms/inventory-count', icon: 'IconScan', permission: 'wms:count:view' },
      { key: 'wms-picking', title: '拣货任务', path: '/wms/picking-tasks', icon: 'IconCommand', permission: 'wms:picking:view' },
      { key: 'wms-safety', title: '安全库存', path: '/wms/safety-stock', icon: 'IconSafe', permission: 'wms:safety:view' },
      { key: 'wms-barcode', title: '条码规则', path: '/wms/barcode-rules', icon: 'IconStorage', permission: 'wms:barcode:view' },
      { key: 'wms-ledger', title: '库存台账', path: '/wms/reports/ledger', icon: 'IconBook', permission: 'wms:report:view' },
      { key: 'wms-turnover', title: '周转分析', path: '/wms/reports/turnover', icon: 'IconRecord', permission: 'wms:report:view' },
      { key: 'wms-dashboard', title: '库存看板', path: '/wms/dashboard', icon: 'IconDashboard', permission: 'wms:dashboard:view' },
    ],
  },
  {
    key: 'qms', title: 'QMS 质量', icon: 'IconCheckCircle',
    children: [
      { key: 'qms-inspection', title: '检验记录', path: '/qms/inspection', icon: 'IconEdit', permission: 'qms:inspection:view' },
      { key: 'qms-nonconform', title: '不合格品', path: '/qms/nonconformance', icon: 'IconCloseCircle', permission: 'qms:nonconform:view' },
      { key: 'qms-standard', title: '检验标准', path: '/qms/inspection-standards', icon: 'IconSettings', permission: 'qms:standard:view' },
      { key: 'qms-final', title: '成品检验', path: '/qms/final-inspection', icon: 'IconSkin', permission: 'qms:inspection:view' },
      { key: 'qms-supplier', title: '供应商质量', path: '/qms/supplier-quality', icon: 'IconUser', permission: 'qms:supplier:view' },
      { key: 'qms-spc', title: 'SPC 控制图', path: '/qms/spc', icon: 'IconComputer', permission: 'qms:spc:view' },
      { key: 'qms-capa', title: 'CAPA 纠正措施', path: '/qms/capa', icon: 'IconThunderbolt', permission: 'qms:capa:view' },
      { key: 'qms-complaint', title: '客户投诉', path: '/qms/complaints', icon: 'IconBulb', permission: 'qms:complaint:view' },
      { key: 'qms-recall', title: '召回管理', path: '/qms/recalls', icon: 'IconExport', permission: 'qms:recall:view' },
    ],
  },
  {
    key: 'erp', title: 'ERP 财务', icon: 'IconBook',
    children: [
      { key: 'erp-salesorder', title: '销售订单', path: '/erp/salesorder', icon: 'IconPublic', permission: 'erp:salesorder:view' },
      { key: 'erp-voucher', title: '财务凭证', path: '/erp/voucher', icon: 'IconAudit', permission: 'erp:voucher:view' },
      { key: 'erp-customer', title: '客户管理', path: '/erp/customers', icon: 'IconUserGroup', permission: 'erp:customer:view' },
      { key: 'erp-quotation', title: '报价单', path: '/erp/quotations', icon: 'IconFile', permission: 'erp:quotation:view' },
      { key: 'erp-shipment', title: '发货管理', path: '/erp/shipments', icon: 'IconTruck', permission: 'erp:shipment:view' },
      { key: 'erp-return', title: '销售退货', path: '/erp/sales-returns', icon: 'IconUndo', permission: 'erp:return:view' },
      { key: 'erp-receivable', title: '应收账款', path: '/erp/receivables', icon: 'IconDoubleDown', permission: 'erp:receivable:view' },
      { key: 'erp-payable', title: '应付账款', path: '/erp/payables', icon: 'IconDoubleUp', permission: 'erp:payable:view' },
      { key: 'erp-account', title: '科目管理', path: '/erp/accounts', icon: 'IconStorage', permission: 'erp:account:view' },
      { key: 'erp-cost-center', title: '成本中心', path: '/erp/cost-centers', icon: 'IconNav', permission: 'erp:cost:view' },
      { key: 'erp-std-cost', title: '标准成本', path: '/erp/standard-costs', icon: 'IconSafe', permission: 'erp:cost:view' },
      { key: 'erp-cost-analysis', title: '成本分析', path: '/erp/cost-analysis', icon: 'IconBarChart', permission: 'erp:cost:view' },
      { key: 'erp-sales-analytics', title: '销售分析', path: '/erp/sales-analytics', icon: 'IconDashboard', permission: 'erp:analytics:view' },
    ],
  },
  {
    key: 'scm', title: 'SCM 供应链', icon: 'IconSwap',
    children: [
      { key: 'scm-supplier', title: '供应商', path: '/scm/supplier', icon: 'IconUserGroup', permission: 'scm:supplier:view' },
      { key: 'scm-purchase', title: '采购订单', path: '/scm/purchase', icon: 'IconShoppingCart', permission: 'scm:purchase:view' },
      { key: 'scm-pr', title: '采购申请', path: '/scm/purchase-requests', icon: 'IconEdit', permission: 'scm:pr:view' },
      { key: 'scm-asn', title: 'ASN 到货通知', path: '/scm/asn', icon: 'IconMessage', permission: 'scm:asn:view' },
      { key: 'scm-rfq', title: '询价管理', path: '/scm/rfqs', icon: 'IconSearch', permission: 'scm:rfq:view' },
      { key: 'scm-receipt', title: '到货记录', path: '/scm/receipt', icon: 'IconDownload', permission: 'scm:receipt:view' },
      { key: 'scm-reconcile', title: '供应商对账', path: '/scm/reconciliations', icon: 'IconRelation', permission: 'scm:reconcile:view' },
      { key: 'scm-performance', title: '供应商绩效', path: '/scm/supplier-performance', icon: 'IconDashboard', permission: 'scm:supplier:view' },
    ],
  },
  {
    key: 'aps', title: 'APS 排程', icon: 'IconCalendar',
    children: [
      { key: 'aps-schedule', title: '排程结果', path: '/aps/schedule', icon: 'IconList', permission: 'aps:schedule:view' },
      { key: 'aps-gantt', title: '甘特图', path: '/aps/gantt', icon: 'IconLayout', permission: 'aps:schedule:view' },
      { key: 'aps-calendar', title: '资源日历', path: '/aps/calendar', icon: 'IconCalendar', permission: 'aps:calendar:view' },
      { key: 'aps-resource', title: '资源管理', path: '/aps/resources', icon: 'IconLayers', permission: 'aps:resource:view' },
      { key: 'aps-mrp', title: 'MRP 运算', path: '/aps/mrp', icon: 'IconSync', permission: 'aps:mrp:view' },
      { key: 'aps-capacity', title: '产能分析', path: '/aps/capacity', icon: 'IconBook', permission: 'aps:capacity:view' },
    ],
  },
  {
    key: 'eam', title: 'EAM 设备', icon: 'IconTool',
    children: [
      { key: 'eam-equipment', title: '设备台账', path: '/eam/equipment', icon: 'IconApps', permission: 'eam:equipment:view' },
      { key: 'eam-maintenance', title: '维保任务', path: '/eam/maintenance', icon: 'IconCommand', permission: 'eam:maintenance:view' },
      { key: 'eam-fault', title: '故障记录', path: '/eam/fault', icon: 'IconNotification', permission: 'eam:fault:view' },
      { key: 'eam-strategy', title: '维保策略', path: '/eam/strategy', icon: 'IconSettings', permission: 'eam:strategy:view' },
      { key: 'eam-inspection', title: '点检记录', path: '/eam/inspection', icon: 'IconCheckCircle', permission: 'eam:inspection:view' },
      { key: 'eam-spare-part', title: '备件管理', path: '/eam/spare-part', icon: 'IconTool', permission: 'eam:sparepart:view' },
      { key: 'eam-oee', title: 'OEE 管理', path: '/eam/oee', icon: 'IconDashboard', permission: 'eam:oee:view' },
      { key: 'eam-knowledge', title: '故障知识库', path: '/eam/knowledge', icon: 'IconBook', permission: 'eam:knowledge:view' },
    ],
  },
  {
    key: 'hr', title: 'HR 人力资源', icon: 'IconUser',
    children: [
      { key: 'hr-employees', title: '员工档案', path: '/hr/employees', icon: 'IconUserGroup', permission: 'hr:employee:view' },
      { key: 'hr-cert-expiring', title: '认证预警', path: '/hr/certifications/expiring', icon: 'IconNotification', permission: 'hr:cert:view' },
      { key: 'hr-schedules', title: '排班管理', path: '/hr/schedules', icon: 'IconSchedule', permission: 'hr:schedule:view' },
      { key: 'hr-work-hours-summary', title: '工时查询', path: '/hr/work-hours/summary', icon: 'IconHistory', permission: 'hr:workhour:view' },
    ],
  },
  {
    key: 'base', title: '基础数据', icon: 'IconStorage',
    children: [
      { key: 'base-batch', title: '批次管理', path: '/base/batch', icon: 'IconList', permission: 'base:batch:view' },
      { key: 'base-file', title: '文件管理', path: '/base/file', icon: 'IconFile', permission: 'base:file:view' },
      { key: 'base-shift', title: '班次管理', path: '/base/shifts', icon: 'IconClockCircle', permission: 'base:shift:view' },
      { key: 'base:work-center', title: '工作中心', path: '/base/work-centers', icon: 'IconStorage', permission: 'base:work-center:view' },
      { key: 'base-cert-type', title: '认证类型', path: '/base/certification-types', icon: 'IconCertificate', permission: 'base:certtype:view' },
    ],
  },
  {
    key: 'sys', title: '系统管理', icon: 'IconSettings',
    children: [
      { key: 'sys-user', title: '用户管理', path: '/sys/user', icon: 'IconUser', permission: 'sys:user:view' },
      { key: 'sys-role', title: '角色管理', path: '/sys/role', icon: 'IconCommon', permission: 'sys:role:view' },
      { key: 'sys-audit-log', title: '审计日志', path: '/sys/audit-log', icon: 'IconBook', permission: 'sys:log:view' },
      { key: 'sys-logs', title: '系统日志', path: '/sys/logs', icon: 'IconFile', permission: 'sys:log:view' },
      { key: 'sys-monitor', title: '系统监控', path: '/sys/monitor', icon: 'IconDashboard', permission: 'sys:monitor:view' },
      { key: 'sys-organization', title: '组织架构', path: '/sys/organization', icon: 'IconNav', permission: 'sys:org:view' },
      { key: 'sys-permission', title: '权限管理', path: '/sys/permission', icon: 'IconSafe', permission: 'sys:permission:view' },
      { key: 'sys-numbering', title: '通用编码管理', path: '/sys/numbering', icon: 'IconCode', permission: 'sys:config:view' },
    ],
  },
]
