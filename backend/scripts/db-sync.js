"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
const sys_user_entity_js_1 = require("../src/modules/auth/entities/sys-user.entity.js");
const sys_role_entity_js_1 = require("../src/modules/auth/entities/sys-role.entity.js");
const sys_permission_entity_js_1 = require("../src/modules/auth/entities/sys-permission.entity.js");
const sys_role_permission_entity_js_1 = require("../src/modules/auth/entities/sys-role-permission.entity.js");
const sys_user_role_entity_js_1 = require("../src/modules/auth/entities/sys-user-role.entity.js");
const sys_tenant_entity_js_1 = require("../src/modules/auth/entities/sys-tenant.entity.js");
const sys_audit_log_entity_js_1 = require("../src/modules/auth/entities/sys-audit-log.entity.js");
const material_batch_entity_js_1 = require("../src/modules/base/entities/material-batch.entity.js");
const sys_organization_entity_js_1 = require("../src/modules/base/entities/sys-organization.entity.js");
const sys_uom_entity_js_1 = require("../src/modules/base/entities/sys-uom.entity.js");
const conversion_instance_entity_js_1 = require("../src/modules/conversion/entities/conversion-instance.entity.js");
const conversion_definition_entity_js_1 = require("../src/modules/conversion/entities/conversion-definition.entity.js");
const plm_material_entity_js_1 = require("../src/modules/plm/entities/plm-material.entity.js");
const plm_bom_entity_js_1 = require("../src/modules/plm/entities/plm-bom.entity.js");
const plm_bom_line_entity_js_1 = require("../src/modules/plm/entities/plm-bom-line.entity.js");
const plm_routing_entity_js_1 = require("../src/modules/plm/entities/plm-routing.entity.js");
const plm_routing_operation_entity_js_1 = require("../src/modules/plm/entities/plm-routing-operation.entity.js");
const plm_ecr_entity_js_1 = require("../src/modules/plm/entities/plm-ecr.entity.js");
const plm_ecn_entity_js_1 = require("../src/modules/plm/entities/plm-ecn.entity.js");
const plm_document_entity_js_1 = require("../src/modules/plm/entities/plm-document.entity.js");
const plm_document_permission_entity_js_1 = require("../src/modules/plm/entities/plm-document-permission.entity.js");
const plm_material_category_entity_js_1 = require("../src/modules/plm/entities/plm-material-category.entity.js");
const plm_material_code_rule_entity_js_1 = require("../src/modules/plm/entities/plm-material-code-rule.entity.js");
const plm_material_substitute_entity_js_1 = require("../src/modules/plm/entities/plm-material-substitute.entity.js");
const plm_process_parameter_entity_js_1 = require("../src/modules/plm/entities/plm-process-parameter.entity.js");
const plm_bom_change_log_entity_js_1 = require("../src/modules/plm/entities/plm-bom-change-log.entity.js");
const mes_work_order_entity_js_1 = require("../src/modules/mes/entities/mes-work-order.entity.js");
const mes_work_order_operation_entity_js_1 = require("../src/modules/mes/entities/mes-work-order-operation.entity.js");
const mes_production_report_entity_js_1 = require("../src/modules/mes/entities/mes-production-report.entity.js");
const mes_material_issue_entity_js_1 = require("../src/modules/mes/entities/mes-material-issue.entity.js");
const mes_wip_entity_js_1 = require("../src/modules/mes/entities/mes-wip.entity.js");
const mes_labor_record_entity_js_1 = require("../src/modules/mes/entities/mes-labor-record.entity.js");
const mes_work_order_split_entity_js_1 = require("../src/modules/mes/entities/mes-work-order-split.entity.js");
const mes_work_order_merge_entity_js_1 = require("../src/modules/mes/entities/mes-work-order-merge.entity.js");
const wms_inventory_entity_js_1 = require("../src/modules/wms/entities/wms-inventory.entity.js");
const wms_stock_transaction_entity_js_1 = require("../src/modules/wms/entities/wms-stock-transaction.entity.js");
const wms_warehouse_entity_js_1 = require("../src/modules/wms/entities/wms-warehouse.entity.js");
const wms_location_entity_js_1 = require("../src/modules/wms/entities/wms-location.entity.js");
const wms_zone_entity_js_1 = require("../src/modules/wms/entities/wms-zone.entity.js");
const wms_container_entity_js_1 = require("../src/modules/wms/entities/wms-container.entity.js");
const wms_pick_task_entity_js_1 = require("../src/modules/wms/entities/wms-pick-task.entity.js");
const wms_stock_take_entity_js_1 = require("../src/modules/wms/entities/wms-stock-take.entity.js");
const wms_safety_stock_entity_js_1 = require("../src/modules/wms/entities/wms-safety-stock.entity.js");
const wms_barcode_rule_entity_js_1 = require("../src/modules/wms/entities/wms-barcode-rule.entity.js");
const qms_inspection_record_entity_js_1 = require("../src/modules/qms/entities/qms-inspection-record.entity.js");
const qms_inspection_standard_entity_js_1 = require("../src/modules/qms/entities/qms-inspection-standard.entity.js");
const qms_nonconformance_entity_js_1 = require("../src/modules/qms/entities/qms-nonconformance.entity.js");
const qms_corrective_action_entity_js_1 = require("../src/modules/qms/entities/qms-corrective-action.entity.js");
const qms_spc_data_point_entity_js_1 = require("../src/modules/qms/entities/qms-spc-data-point.entity.js");
const qms_sip_entity_js_1 = require("../src/modules/qms/entities/qms-sip.entity.js");
const scm_purchase_order_entity_js_1 = require("../src/modules/scm/entities/scm-purchase-order.entity.js");
const scm_purchase_order_line_entity_js_1 = require("../src/modules/scm/entities/scm-purchase-order-line.entity.js");
const scm_purchase_request_entity_js_1 = require("../src/modules/scm/entities/scm-purchase-request.entity.js");
const scm_asn_entity_js_1 = require("../src/modules/scm/entities/scm-asn.entity.js");
const scm_receipt_entity_js_1 = require("../src/modules/scm/entities/scm-receipt.entity.js");
const scm_receipt_exception_entity_js_1 = require("../src/modules/scm/entities/scm-receipt-exception.entity.js");
const scm_inquiry_entity_js_1 = require("../src/modules/scm/entities/scm-inquiry.entity.js");
const scm_inquiry_line_entity_js_1 = require("../src/modules/scm/entities/scm-inquiry-line.entity.js");
const scm_price_agreement_entity_js_1 = require("../src/modules/scm/entities/scm-price-agreement.entity.js");
const scm_price_record_entity_js_1 = require("../src/modules/scm/entities/scm-price-record.entity.js");
const erp_customer_entity_js_1 = require("../src/modules/erp/entities/erp-customer.entity.js");
const erp_quotation_entity_js_1 = require("../src/modules/erp/entities/erp-quotation.entity.js");
const erp_receivable_entity_js_1 = require("../src/modules/erp/entities/erp-receivable.entity.js");
const erp_payable_entity_js_1 = require("../src/modules/erp/entities/erp-payable.entity.js");
const erp_reconciliation_entity_js_1 = require("../src/modules/erp/entities/erp-reconciliation.entity.js");
const erp_account_entity_js_1 = require("../src/modules/erp/entities/erp-account.entity.js");
const erp_cost_center_entity_js_1 = require("../src/modules/erp/entities/erp-cost-center.entity.js");
const erp_cost_element_entity_js_1 = require("../src/modules/erp/entities/erp-cost-element.entity.js");
const erp_cost_record_entity_js_1 = require("../src/modules/erp/entities/erp-cost-record.entity.js");
const erp_cost_allocation_entity_js_1 = require("../src/modules/erp/entities/erp-cost-allocation.entity.js");
const erp_sales_order_entity_js_1 = require("../src/modules/erp/entities/erp-sales-order.entity.js");
const erp_sales_order_line_entity_js_1 = require("../src/modules/erp/entities/erp-sales-order-line.entity.js");
const erp_sales_return_entity_js_1 = require("../src/modules/erp/entities/erp-sales-return.entity.js");
const erp_shipment_entity_js_1 = require("../src/modules/erp/entities/erp-shipment.entity.js");
const erp_standard_cost_entity_js_1 = require("../src/modules/erp/entities/erp-standard-cost.entity.js");
const erp_voucher_entity_js_1 = require("../src/modules/erp/entities/erp-voucher.entity.js");
const erp_voucher_line_entity_js_1 = require("../src/modules/erp/entities/erp-voucher-line.entity.js");
const aps_schedule_entity_js_1 = require("../src/modules/aps/entities/aps-schedule.entity.js");
const aps_schedule_operation_entity_js_1 = require("../src/modules/aps/entities/aps-schedule-operation.entity.js");
const aps_resource_entity_js_1 = require("../src/modules/aps/entities/aps-resource.entity.js");
const aps_calendar_entity_js_1 = require("../src/modules/aps/entities/aps-calendar.entity.js");
const aps_mrp_entity_js_1 = require("../src/modules/aps/entities/aps-mrp.entity.js");
const aps_mrp_line_entity_js_1 = require("../src/modules/aps/entities/aps-mrp-line.entity.js");
const aps_priority_rule_entity_js_1 = require("../src/modules/aps/entities/aps-priority-rule.entity.js");
const aps_optimization_target_entity_js_1 = require("../src/modules/aps/entities/aps-optimization-target.entity.js");
const eam_equipment_entity_js_1 = require("../src/modules/eam/entities/eam-equipment.entity.js");
const eam_maintenance_plan_entity_js_1 = require("../src/modules/eam/entities/eam-maintenance-plan.entity.js");
const eam_maintenance_task_entity_js_1 = require("../src/modules/eam/entities/eam-maintenance-task.entity.js");
const eam_fault_record_entity_js_1 = require("../src/modules/eam/entities/eam-fault-record.entity.js");
const eam_inspection_record_entity_js_1 = require("../src/modules/eam/entities/eam-inspection-record.entity.js");
const eam_lubrication_entity_js_1 = require("../src/modules/eam/entities/eam-lubrication.entity.js");
const eam_oee_record_entity_js_1 = require("../src/modules/eam/entities/eam-oee-record.entity.js");
const eam_equipment_history_entity_js_1 = require("../src/modules/eam/entities/eam-equipment-history.entity.js");
const eam_equipment_finance_entity_js_1 = require("../src/modules/eam/entities/eam-equipment-finance.entity.js");
const event_store_entity_js_1 = require("../src/shared/message/event-store.entity.js");
const sys_file_entity_js_1 = require("../src/modules/file/entities/sys-file.entity.js");
const dataSource = new typeorm_1.DataSource({
    type: 'mysql',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    username: process.env.DATABASE_USER || 'newuser',
    password: process.env.DATABASE_PASS || 'newpassword!!',
    database: process.env.DATABASE_NAME || 'mfg_platform',
    charset: 'utf8mb4',
    timezone: '+08:00',
    synchronize: true,
    logging: ['schema', 'error', 'warn'],
    entities: [
        sys_user_entity_js_1.SysUser, sys_role_entity_js_1.SysRole, sys_permission_entity_js_1.SysPermission, sys_role_permission_entity_js_1.SysRolePermission, sys_user_role_entity_js_1.SysUserRole, sys_tenant_entity_js_1.SysTenant, sys_audit_log_entity_js_1.SysAuditLog,
        material_batch_entity_js_1.MaterialBatch, sys_organization_entity_js_1.SysOrganization, sys_uom_entity_js_1.SysUom,
        conversion_instance_entity_js_1.ConversionInstance, conversion_instance_entity_js_1.CiInput, conversion_instance_entity_js_1.CiOutput, conversion_definition_entity_js_1.ConversionDefinition, conversion_definition_entity_js_1.CdInput, conversion_definition_entity_js_1.CdOutput,
        plm_material_entity_js_1.PlmMaterial, plm_bom_entity_js_1.PlmBom, plm_bom_line_entity_js_1.PlmBomLine, plm_routing_entity_js_1.PlmRouting, plm_routing_operation_entity_js_1.PlmRoutingOperation,
        plm_ecr_entity_js_1.PlmEcr, plm_ecn_entity_js_1.PlmEcn, plm_document_entity_js_1.PlmDocument, plm_document_permission_entity_js_1.PlmDocumentPermission,
        plm_material_category_entity_js_1.PlmMaterialCategory, plm_material_code_rule_entity_js_1.PlmMaterialCodeRule, plm_material_substitute_entity_js_1.PlmMaterialSubstitute,
        plm_process_parameter_entity_js_1.PlmProcessParameter, plm_bom_change_log_entity_js_1.PlmBomChangeLog,
        mes_work_order_entity_js_1.MesWorkOrder, mes_work_order_operation_entity_js_1.MesWorkOrderOperation, mes_production_report_entity_js_1.MesProductionReport, mes_material_issue_entity_js_1.MesMaterialIssue,
        mes_wip_entity_js_1.MesWip, mes_labor_record_entity_js_1.MesLaborRecord, mes_work_order_split_entity_js_1.MesWorkOrderSplit, mes_work_order_merge_entity_js_1.MesWorkOrderMerge,
        wms_inventory_entity_js_1.WmsInventory, wms_stock_transaction_entity_js_1.WmsStockTransaction, wms_warehouse_entity_js_1.WmsWarehouse, wms_location_entity_js_1.WmsLocation, wms_zone_entity_js_1.WmsZone,
        wms_container_entity_js_1.WmsContainer, wms_pick_task_entity_js_1.WmsPickTask, wms_pick_task_entity_js_1.WmsPickTaskLine, wms_stock_take_entity_js_1.WmsStockTake, wms_stock_take_entity_js_1.WmsStockTakeLine,
        wms_safety_stock_entity_js_1.WmsSafetyStock, wms_barcode_rule_entity_js_1.WmsBarcodeRule,
        qms_inspection_record_entity_js_1.QmsInspectionRecord, qms_inspection_standard_entity_js_1.QmsInspectionStandard, qms_inspection_standard_entity_js_1.QmsInspectionItem,
        qms_nonconformance_entity_js_1.QmsNonconformance, qms_corrective_action_entity_js_1.QmsCorrectiveAction, qms_spc_data_point_entity_js_1.QmsSpcDataPoint,
        qms_sip_entity_js_1.QmsSip, qms_sip_entity_js_1.QmsFinalInspection, qms_sip_entity_js_1.QmsSupplierQualityRecord, qms_sip_entity_js_1.QmsCustomerComplaint, qms_sip_entity_js_1.QmsRecall,
        scm_purchase_order_entity_js_1.ScmPurchaseOrder, scm_purchase_order_line_entity_js_1.ScmPurchaseOrderLine, scm_purchase_request_entity_js_1.ScmPurchaseRequest, scm_asn_entity_js_1.ScmAsn,
        scm_receipt_entity_js_1.ScmReceipt, scm_receipt_exception_entity_js_1.ScmReceiptException, scm_inquiry_entity_js_1.ScmInquiry, scm_inquiry_line_entity_js_1.ScmInquiryLine,
        scm_price_agreement_entity_js_1.ScmPriceAgreement, scm_price_record_entity_js_1.ScmPriceRecord,
        erp_customer_entity_js_1.ErpCustomer, erp_quotation_entity_js_1.ErpQuotation, erp_receivable_entity_js_1.ErpReceivable, erp_payable_entity_js_1.ErpPayable, erp_reconciliation_entity_js_1.ErpReconciliation,
        erp_account_entity_js_1.ErpAccount, erp_cost_center_entity_js_1.ErpCostCenter, erp_cost_element_entity_js_1.ErpCostElement, erp_cost_record_entity_js_1.ErpCostRecord, erp_cost_allocation_entity_js_1.ErpCostAllocation,
        erp_sales_order_entity_js_1.ErpSalesOrder, erp_sales_order_line_entity_js_1.ErpSalesOrderLine, erp_sales_return_entity_js_1.ErpSalesReturn, erp_shipment_entity_js_1.ErpShipment,
        erp_standard_cost_entity_js_1.ErpStandardCost, erp_voucher_entity_js_1.ErpVoucher, erp_voucher_line_entity_js_1.ErpVoucherLine,
        aps_schedule_entity_js_1.ApsSchedule, aps_schedule_operation_entity_js_1.ApsScheduleOperation, aps_resource_entity_js_1.ApsResource, aps_calendar_entity_js_1.ApsCalendar,
        aps_mrp_entity_js_1.ApsMrp, aps_mrp_line_entity_js_1.ApsMrpLine, aps_priority_rule_entity_js_1.ApsPriorityRule, aps_optimization_target_entity_js_1.ApsOptimizationTarget,
        eam_equipment_entity_js_1.EamEquipment, eam_maintenance_plan_entity_js_1.EamMaintenancePlan, eam_maintenance_task_entity_js_1.EamMaintenanceTask, eam_fault_record_entity_js_1.EamFaultRecord,
        eam_inspection_record_entity_js_1.EamInspectionRecord, eam_lubrication_entity_js_1.EamLubrication, eam_oee_record_entity_js_1.EamOeeRecord,
        eam_equipment_history_entity_js_1.EamEquipmentHistory, eam_equipment_finance_entity_js_1.EamEquipmentFinance,
        event_store_entity_js_1.EventStore, sys_file_entity_js_1.SysFile,
    ],
});
async function main() {
    console.log('🔄 Connecting to database...');
    try {
        await dataSource.initialize();
        console.log('✅ Database connected, schema synchronized');
        const tables = await dataSource.query('SHOW TABLES');
        console.log(`\n✅ Total tables: ${tables.length}`);
        tables.forEach(t => console.log(`   📋 ${Object.values(t)[0]}`));
    }
    catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
    finally {
        await dataSource.destroy();
        console.log('\n🔌 Connection closed');
    }
}
main();
//# sourceMappingURL=db-sync.js.map