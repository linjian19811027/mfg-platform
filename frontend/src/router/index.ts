import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { setupRouterGuard } from './guard'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { public: true },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: { public: true },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/BasicLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/index.vue') },
      // PLM
      { path: 'plm/material', name: 'PlmMaterial', component: () => import('@/views/plm/material/index.vue') },
      { path: 'plm/material/:id', name: 'PlmMaterialDetail', component: () => import('@/views/plm/material/detail.vue') },
      { path: 'plm/bom', name: 'PlmBom', component: () => import('@/views/plm/bom/index.vue') },
      { path: 'plm/routings', name: 'PlmRouting', component: () => import('@/views/plm/routing/index.vue') },
      { path: 'plm/standard-operations', name: 'PlmStdOperation', component: () => import('@/views/plm/standard-operation/index.vue') },
      { path: 'plm/ecr', name: 'PlmEcr', component: () => import('@/views/plm/ecr/index.vue') },
      { path: 'plm/ecn', name: 'PlmEcn', component: () => import('@/views/plm/ecn/index.vue') },
      { path: 'plm/categories', name: 'PlmCategory', component: () => import('@/views/plm/category/index.vue') },
      { path: 'plm/code-rules', name: 'PlmCodeRule', component: () => import('@/views/plm/code-rule/index.vue') },
      { path: 'plm/documents', name: 'PlmDocument', component: () => import('@/views/plm/document/index.vue') },
      // MES
      { path: 'mes/workorder', name: 'MesWorkorder', component: () => import('@/views/mes/workorder/index.vue') },
      { path: 'mes/workorder/:id', name: 'MesWorkorderDetail', component: () => import('@/views/mes/workorder/detail.vue') },
      { path: 'mes/picking', name: 'MesPicking', component: () => import('@/views/mes/picking/index.vue') },
      { path: 'mes/operation', name: 'MesOperation', component: () => import('@/views/mes/operation/index.vue') },
      { path: 'mes/quality-board', name: 'MesQualityBoard', component: () => import('@/views/mes/quality-board/index.vue') },
      { path: 'mes/wip', name: 'MesWip', component: () => import('@/views/mes/wip/index.vue') },
      { path: 'mes/labor', name: 'MesLabor', component: () => import('@/views/mes/labor/index.vue') },
      // WMS
      { path: 'wms/inventory', name: 'WmsInventory', component: () => import('@/views/wms/inventory/index.vue') },
      { path: 'wms/transaction', name: 'WmsTransaction', component: () => import('@/views/wms/transaction/index.vue') },
      { path: 'wms/inventory-count', name: 'WmsInventoryCount', component: () => import('@/views/wms/inventory-count/index.vue') },
      { path: 'wms/picking-tasks', name: 'WmsPickingTask', component: () => import('@/views/wms/picking-task/index.vue') },
      { path: 'wms/warehouse', name: 'WmsWarehouse', component: () => import('@/views/wms/warehouse/index.vue') },
      { path: 'wms/safety-stock', name: 'WmsSafetyStock', component: () => import('@/views/wms/safety-stock/index.vue') },
      { path: 'wms/barcode-rules', name: 'WmsBarcodeRule', component: () => import('@/views/wms/barcode-rule/index.vue') },
      { path: 'wms/reports/ledger', name: 'WmsLedger', component: () => import('@/views/wms/reports/ledger.vue') },
      { path: 'wms/reports/turnover', name: 'WmsTurnover', component: () => import('@/views/wms/reports/turnover.vue') },
      // QMS
      { path: 'qms/inspection', name: 'QmsInspection', component: () => import('@/views/qms/inspection/index.vue') },
      { path: 'qms/nonconformance', name: 'QmsNonconformance', component: () => import('@/views/qms/nonconformance/index.vue') },
      { path: 'qms/inspection-standards', name: 'QmsStandard', component: () => import('@/views/qms/standard/index.vue') },
      { path: 'qms/spc', name: 'QmsSpc', component: () => import('@/views/qms/spc/index.vue') },
      { path: 'qms/capa', name: 'QmsCapa', component: () => import('@/views/qms/capa/index.vue') },
      { path: 'qms/final-inspection', name: 'QmsFinalInspection', component: () => import('@/views/qms/final-inspection/index.vue') },
      { path: 'qms/supplier-quality', name: 'QmsSupplierQuality', component: () => import('@/views/qms/supplier-quality/index.vue') },
      { path: 'qms/complaints', name: 'QmsComplaint', component: () => import('@/views/qms/complaint/index.vue') },
      { path: 'qms/recalls', name: 'QmsRecall', component: () => import('@/views/qms/recall/index.vue') },
      // ERP
      { path: 'erp/salesorder', name: 'ErpSalesorder', component: () => import('@/views/erp/salesorder/index.vue') },
      { path: 'erp/voucher', name: 'ErpVoucher', component: () => import('@/views/erp/voucher/index.vue') },
      { path: 'erp/customers', name: 'ErpCustomer', component: () => import('@/views/erp/customer/index.vue') },
      { path: 'erp/quotations', name: 'ErpQuotation', component: () => import('@/views/erp/quotation/index.vue') },
      { path: 'erp/shipments', name: 'ErpShipment', component: () => import('@/views/erp/shipment/index.vue') },
      { path: 'erp/sales-returns', name: 'ErpSalesReturn', component: () => import('@/views/erp/sales-return/index.vue') },
      { path: 'erp/receivables', name: 'ErpReceivable', component: () => import('@/views/erp/receivable/index.vue') },
      { path: 'erp/payables', name: 'ErpPayable', component: () => import('@/views/erp/payable/index.vue') },
      { path: 'erp/accounts', name: 'ErpAccount', component: () => import('@/views/erp/account/index.vue') },
      { path: 'erp/ledger/general', name: 'ErpLedger', component: () => import('@/views/erp/ledger/general.vue') },
      { path: 'erp/cost-centers', name: 'ErpCostCenter', component: () => import('@/views/erp/cost-center/index.vue') },
      { path: 'erp/cost-elements', name: 'ErpCostElement', component: () => import('@/views/erp/cost-element/index.vue') },
      { path: 'erp/standard-costs', name: 'ErpStandardCost', component: () => import('@/views/erp/standard-cost/index.vue') },
      { path: 'erp/cost-analysis', name: 'ErpCostAnalysis', component: () => import('@/views/erp/cost-analysis/index.vue') },
      { path: 'erp/sales-analytics', name: 'ErpSalesAnalytics', component: () => import('@/views/erp/sales-analytics/index.vue') },
      { path: 'erp/financial-reports', name: 'ErpFinancialReport', component: () => import('@/views/erp/financial-report/index.vue') },
      // SCM
      { path: 'scm/supplier', name: 'ScmSupplier', component: () => import('@/views/scm/supplier/index.vue') },
      { path: 'scm/purchase', name: 'ScmPurchase', component: () => import('@/views/scm/purchase/index.vue') },
      { path: 'scm/receipt', name: 'ScmReceipt', component: () => import('@/views/scm/receipt/index.vue') },
      { path: 'scm/purchase-requests', name: 'ScmPurchaseRequest', component: () => import('@/views/scm/purchase-request/index.vue') },
      { path: 'scm/asn', name: 'ScmAsn', component: () => import('@/views/scm/asn/index.vue') },
      { path: 'scm/rfqs', name: 'ScmRfq', component: () => import('@/views/scm/rfq/index.vue') },
      { path: 'scm/price-agreements', name: 'ScmPriceAgreement', component: () => import('@/views/scm/price-agreement/index.vue') },
      { path: 'scm/supplier-performance', name: 'ScmSupplierPerformance', component: () => import('@/views/scm/supplier-performance/index.vue') },
      { path: 'scm/analytics', name: 'ScmAnalytics', component: () => import('@/views/scm/analytics/index.vue') },
      { path: 'scm/receipt-exceptions', name: 'ScmReceiptException', component: () => import('@/views/scm/receipt-exception/index.vue') },
      { path: 'scm/reconciliations', name: 'ScmReconciliation', component: () => import('@/views/scm/reconciliation/index.vue') },
      { path: 'scm/qualifications', name: 'ScmQualification', component: () => import('@/views/scm/qualification/index.vue') },
      // APS
      { path: 'aps/schedule', name: 'ApsSchedule', component: () => import('@/views/aps/schedule/index.vue') },
      { path: 'aps/calendar', name: 'ApsCalendar', component: () => import('@/views/aps/calendar/index.vue') },
      { path: 'aps/resources', name: 'ApsResource', component: () => import('@/views/aps/resource/index.vue') },
      { path: 'aps/mrp', name: 'ApsMrp', component: () => import('@/views/aps/mrp/index.vue') },
      { path: 'aps/capacity', name: 'ApsCapacity', component: () => import('@/views/aps/capacity/index.vue') },
      { path: 'aps/priority-rules', name: 'ApsPriorityRule', component: () => import('@/views/aps/priority-rule/index.vue') },
      // EAM
      { path: 'eam/equipment', name: 'EamEquipment', component: () => import('@/views/eam/equipment/index.vue') },
      { path: 'eam/maintenance', name: 'EamMaintenance', component: () => import('@/views/eam/maintenance/index.vue') },
      { path: 'eam/fault', name: 'EamFault', component: () => import('@/views/eam/fault/index.vue') },
      { path: 'eam/strategy', name: 'EamStrategy', component: () => import('@/views/eam/strategy/index.vue') },
      { path: 'eam/inspection', name: 'EamInspection', component: () => import('@/views/eam/inspection/index.vue') },
      { path: 'eam/lubrication', name: 'EamLubrication', component: () => import('@/views/eam/lubrication/index.vue') },
      { path: 'eam/spare-part', name: 'EamSparePart', component: () => import('@/views/eam/spare-part/index.vue') },
      { path: 'eam/oee', name: 'EamOee', component: () => import('@/views/eam/oee/index.vue') },
      { path: 'eam/knowledge', name: 'EamKnowledge', component: () => import('@/views/eam/knowledge/index.vue') },
      { path: 'eam/analytics', name: 'EamAnalytics', component: () => import('@/views/eam/analytics/index.vue') },
      // BASE
      { path: 'base/batch', name: 'BaseBatch', component: () => import('@/views/base/batch/index.vue') },
      { path: 'base/file', name: 'BaseFile', component: () => import('@/views/base/file/index.vue') },
      { path: 'base/shifts', name: 'BaseShift', component: () => import('@/views/base/shifts/index.vue') },
      { path: 'base/certification-types', name: 'BaseCertType', component: () => import('@/views/base/certification-types/index.vue') },
      { path: 'base/work-centers', name: 'BaseWorkCenter', component: () => import('@/views/base/work-center/index.vue') },
      // SYS
      { path: 'sys/user', name: 'SysUser', component: () => import('@/views/sys/user/index.vue') },
      { path: 'sys/role', name: 'SysRole', component: () => import('@/views/sys/role/index.vue') },
      { path: 'sys/permission', name: 'SysPermission', component: () => import('@/views/sys/permission/index.vue') },
      { path: 'sys/audit-log', name: 'SysAuditLog', component: () => import('@/views/sys/audit-log/index.vue') },
      { path: 'sys/organization', name: 'SysOrganization', component: () => import('@/views/sys/organization/index.vue') },
      { path: 'sys/uom', name: 'SysUom', component: () => import('@/views/sys/uom/index.vue') },
      { path: 'sys/tenant', name: 'SysTenant', component: () => import('@/views/sys/tenant/index.vue') },
      { path: 'sys/monitor', name: 'SysMonitor', component: () => import('@/views/sys/monitor/index.vue') },
      { path: 'sys/logs', name: 'SysLogs', component: () => import('@/views/sys/logs/index.vue') },
      { path: 'sys/numbering', name: 'SysNumbering', component: () => import('@/views/sys/numbering/index.vue') },
      { path: 'sys/config', name: 'SysConfig', component: () => import('@/views/sys/config/index.vue') },
      // HR
      { path: 'hr/employees', name: 'HrEmployee', component: () => import('@/views/hr/employees/index.vue') },
      { path: 'hr/employees/:id', name: 'HrEmployeeDetail', component: () => import('@/views/hr/employees/detail.vue') },
      { path: 'hr/certifications/expiring', name: 'HrCertificationExpiring', component: () => import('@/views/hr/certifications/expiring.vue') },
      { path: 'hr/schedules', name: 'HrSchedule', component: () => import('@/views/hr/schedules/index.vue') },
      { path: 'hr/work-hours/dashboard', name: 'HrWorkHourDashboard', component: () => import('@/views/hr/work-hours/dashboard.vue') },
      { path: 'hr/work-hours/summary', name: 'HrWorkHourSummary', component: () => import('@/views/hr/work-hours/summary.vue') },
      // Traceability
      { path: 'traceability/batches', name: 'TraceabilityBatch', component: () => import('@/views/traceability/batches/index.vue') },
      { path: 'traceability/batches/:id', name: 'TraceabilityBatchDetail', component: () => import('@/views/traceability/batches/detail.vue') },
      { path: 'traceability/forward/:traceCode', name: 'TraceabilityForward', component: () => import('@/views/traceability/forward/index.vue') },
      { path: 'traceability/backward/:traceCode', name: 'TraceabilityBackward', component: () => import('@/views/traceability/backward/index.vue') },
      { path: 'traceability/recall', name: 'TraceabilityRecall', component: () => import('@/views/traceability/recall/index.vue') },
      { path: 'traceability/recall/assessments/:id', name: 'TraceabilityRecallDetail', component: () => import('@/views/traceability/recall/detail.vue') },
      { path: 'traceability/dashboard', name: 'TraceabilityDashboard', component: () => import('@/views/traceability/dashboard/index.vue') },
      // 核心交互页面
      { path: 'traceability', name: 'Traceability', component: () => import('@/views/traceability/index.vue') },
      { path: 'aps/gantt', name: 'ApsGantt', component: () => import('@/views/aps/gantt/index.vue') },
      { path: 'mes/dashboard', name: 'MesDashboard', component: () => import('@/views/mes/dashboard/index.vue') },
      { path: 'wms/dashboard', name: 'WmsDashboard', component: () => import('@/views/wms/dashboard/index.vue') },
      // MES 自动入库 & 多层级工单
      { path: 'mes/auto-receipt-config', name: 'MesAutoReceiptConfig', component: () => import('@/views/mes/auto-receipt-config/index.vue') },
      { path: 'mes/receipt-logs', name: 'MesReceiptLogs', component: () => import('@/views/mes/receipt-logs/index.vue') },
      // 外协加工
      { path: 'outsourcing/orders', name: 'OutsourcingOrders', component: () => import('@/views/outsourcing/orders/index.vue') },
      { path: 'outsourcing/orders/:id', name: 'OutsourcingOrderDetail', component: () => import('@/views/outsourcing/orders/detail.vue') },
      // 报表设计器
      { path: 'rpt/list', name: 'RptList', component: () => import('@/views/rpt/list/index.vue') },
      { path: 'rpt/designer/:id', name: 'RptDesigner', component: () => import('@/views/rpt/designer/index.vue') },
      { path: 'rpt/preview/:id', name: 'RptPreview', component: () => import('@/views/rpt/preview/index.vue') },

      // ECN 执行计划
      { path: 'plm/ecn-execution-plans', name: 'EcnExecutionPlans', component: () => import('@/views/plm/ecn-execution-plans/index.vue') },
      { path: 'plm/ecn-execution-plans/:id', name: 'EcnExecutionPlanDetail', component: () => import('@/views/plm/ecn-execution-plans/detail.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/404' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

setupRouterGuard(router)

export default router
