/**
 * 数据库表结构同步脚本
 * 用途：扫描所有实体并通过 TypeORM synchronize 自动建表/更新表结构
 * 运行（在 backend/ 目录下）：
 *   npx ts-node --project tsconfig.json -r tsconfig-paths/register scripts/db-sync.ts
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

// ── Auth ──────────────────────────────────────────────────────────────────────
import { SysUser } from '../src/modules/auth/entities/sys-user.entity.js';
import { SysRole } from '../src/modules/auth/entities/sys-role.entity.js';
import { SysPermission } from '../src/modules/auth/entities/sys-permission.entity.js';
import { SysRolePermission } from '../src/modules/auth/entities/sys-role-permission.entity.js';
import { SysUserRole } from '../src/modules/auth/entities/sys-user-role.entity.js';
import { SysTenant } from '../src/modules/auth/entities/sys-tenant.entity.js';
import { SysAuditLog } from '../src/modules/auth/entities/sys-audit-log.entity.js';

// ── Base ──────────────────────────────────────────────────────────────────────
import { MaterialBatch } from '../src/modules/base/entities/material-batch.entity.js';
import { SysOrganization } from '../src/modules/base/entities/sys-organization.entity.js';
import { SysUom } from '../src/modules/base/entities/sys-uom.entity.js';

// ── Conversion ────────────────────────────────────────────────────────────────
import { ConversionInstance, CiInput, CiOutput } from '../src/modules/conversion/entities/conversion-instance.entity.js';
import { ConversionDefinition, CdInput, CdOutput } from '../src/modules/conversion/entities/conversion-definition.entity.js';

// ── PLM ───────────────────────────────────────────────────────────────────────
import { PlmMaterial } from '../src/modules/plm/entities/plm-material.entity.js';
import { PlmBom } from '../src/modules/plm/entities/plm-bom.entity.js';
import { PlmBomLine } from '../src/modules/plm/entities/plm-bom-line.entity.js';
import { PlmRouting } from '../src/modules/plm/entities/plm-routing.entity.js';
import { PlmRoutingOperation } from '../src/modules/plm/entities/plm-routing-operation.entity.js';
import { PlmEcr } from '../src/modules/plm/entities/plm-ecr.entity.js';
import { PlmEcn } from '../src/modules/plm/entities/plm-ecn.entity.js';
import { PlmDocument } from '../src/modules/plm/entities/plm-document.entity.js';
import { PlmDocumentPermission } from '../src/modules/plm/entities/plm-document-permission.entity.js';
import { PlmMaterialCategory } from '../src/modules/plm/entities/plm-material-category.entity.js';
import { PlmMaterialCodeRule } from '../src/modules/plm/entities/plm-material-code-rule.entity.js';
import { PlmMaterialSubstitute } from '../src/modules/plm/entities/plm-material-substitute.entity.js';
import { PlmProcessParameter } from '../src/modules/plm/entities/plm-process-parameter.entity.js';
import { PlmBomChangeLog } from '../src/modules/plm/entities/plm-bom-change-log.entity.js';

// ── MES ───────────────────────────────────────────────────────────────────────
import { MesWorkOrder } from '../src/modules/mes/entities/mes-work-order.entity.js';
import { MesWorkOrderOperation } from '../src/modules/mes/entities/mes-work-order-operation.entity.js';
import { MesProductionReport } from '../src/modules/mes/entities/mes-production-report.entity.js';
import { MesMaterialIssue } from '../src/modules/mes/entities/mes-material-issue.entity.js';
import { MesWip } from '../src/modules/mes/entities/mes-wip.entity.js';
import { MesLaborRecord } from '../src/modules/mes/entities/mes-labor-record.entity.js';
import { MesWorkOrderSplit } from '../src/modules/mes/entities/mes-work-order-split.entity.js';
import { MesWorkOrderMerge } from '../src/modules/mes/entities/mes-work-order-merge.entity.js';

// ── WMS ───────────────────────────────────────────────────────────────────────
import { WmsInventory } from '../src/modules/wms/entities/wms-inventory.entity.js';
import { WmsStockTransaction } from '../src/modules/wms/entities/wms-stock-transaction.entity.js';
import { WmsWarehouse } from '../src/modules/wms/entities/wms-warehouse.entity.js';
import { WmsLocation } from '../src/modules/wms/entities/wms-location.entity.js';
import { WmsZone } from '../src/modules/wms/entities/wms-zone.entity.js';
import { WmsContainer } from '../src/modules/wms/entities/wms-container.entity.js';
import { WmsPickTask, WmsPickTaskLine } from '../src/modules/wms/entities/wms-pick-task.entity.js';
import { WmsStockTake, WmsStockTakeLine } from '../src/modules/wms/entities/wms-stock-take.entity.js';
import { WmsSafetyStock } from '../src/modules/wms/entities/wms-safety-stock.entity.js';
import { WmsBarcodeRule } from '../src/modules/wms/entities/wms-barcode-rule.entity.js';

// ── QMS ───────────────────────────────────────────────────────────────────────
import { QmsInspectionRecord } from '../src/modules/qms/entities/qms-inspection-record.entity.js';
import { QmsInspectionStandard, QmsInspectionItem } from '../src/modules/qms/entities/qms-inspection-standard.entity.js';
import { QmsNonconformance } from '../src/modules/qms/entities/qms-nonconformance.entity.js';
import { QmsCorrectiveAction } from '../src/modules/qms/entities/qms-corrective-action.entity.js';
import { QmsSpcDataPoint } from '../src/modules/qms/entities/qms-spc-data-point.entity.js';
import { QmsSip, QmsFinalInspection, QmsSupplierQualityRecord, QmsCustomerComplaint, QmsRecall } from '../src/modules/qms/entities/qms-sip.entity.js';

// ── SCM ───────────────────────────────────────────────────────────────────────
import { ScmPurchaseOrder } from '../src/modules/scm/entities/scm-purchase-order.entity.js';
import { ScmPurchaseOrderLine } from '../src/modules/scm/entities/scm-purchase-order-line.entity.js';
import { ScmPurchaseRequest } from '../src/modules/scm/entities/scm-purchase-request.entity.js';
import { ScmAsn } from '../src/modules/scm/entities/scm-asn.entity.js';
import { ScmReceipt } from '../src/modules/scm/entities/scm-receipt.entity.js';
import { ScmReceiptException } from '../src/modules/scm/entities/scm-receipt-exception.entity.js';
import { ScmInquiry } from '../src/modules/scm/entities/scm-inquiry.entity.js';
import { ScmInquiryLine } from '../src/modules/scm/entities/scm-inquiry-line.entity.js';
import { ScmPriceAgreement } from '../src/modules/scm/entities/scm-price-agreement.entity.js';
import { ScmPriceRecord } from '../src/modules/scm/entities/scm-price-record.entity.js';

// ── ERP ───────────────────────────────────────────────────────────────────────
import { ErpCustomer } from '../src/modules/erp/entities/erp-customer.entity.js';
import { ErpQuotation } from '../src/modules/erp/entities/erp-quotation.entity.js';
import { ErpReceivable } from '../src/modules/erp/entities/erp-receivable.entity.js';
import { ErpPayable } from '../src/modules/erp/entities/erp-payable.entity.js';
import { ErpReconciliation } from '../src/modules/erp/entities/erp-reconciliation.entity.js';
import { ErpAccount } from '../src/modules/erp/entities/erp-account.entity.js';
import { ErpCostCenter } from '../src/modules/erp/entities/erp-cost-center.entity.js';
import { ErpCostElement } from '../src/modules/erp/entities/erp-cost-element.entity.js';
import { ErpCostRecord } from '../src/modules/erp/entities/erp-cost-record.entity.js';
import { ErpCostAllocation } from '../src/modules/erp/entities/erp-cost-allocation.entity.js';
import { ErpSalesOrder } from '../src/modules/erp/entities/erp-sales-order.entity.js';
import { ErpSalesOrderLine } from '../src/modules/erp/entities/erp-sales-order-line.entity.js';
import { ErpSalesReturn } from '../src/modules/erp/entities/erp-sales-return.entity.js';
import { ErpShipment } from '../src/modules/erp/entities/erp-shipment.entity.js';
import { ErpStandardCost } from '../src/modules/erp/entities/erp-standard-cost.entity.js';
import { ErpVoucher } from '../src/modules/erp/entities/erp-voucher.entity.js';
import { ErpVoucherLine } from '../src/modules/erp/entities/erp-voucher-line.entity.js';

// ── APS ───────────────────────────────────────────────────────────────────────
import { ApsSchedule } from '../src/modules/aps/entities/aps-schedule.entity.js';
import { ApsScheduleOperation } from '../src/modules/aps/entities/aps-schedule-operation.entity.js';
import { ApsResource } from '../src/modules/aps/entities/aps-resource.entity.js';
import { ApsCalendar } from '../src/modules/aps/entities/aps-calendar.entity.js';
import { ApsMrp } from '../src/modules/aps/entities/aps-mrp.entity.js';
import { ApsMrpLine } from '../src/modules/aps/entities/aps-mrp-line.entity.js';
import { ApsPriorityRule } from '../src/modules/aps/entities/aps-priority-rule.entity.js';
import { ApsOptimizationTarget } from '../src/modules/aps/entities/aps-optimization-target.entity.js';

// ── EAM ───────────────────────────────────────────────────────────────────────
import { EamEquipment } from '../src/modules/eam/entities/eam-equipment.entity.js';
import { EamMaintenancePlan } from '../src/modules/eam/entities/eam-maintenance-plan.entity.js';
import { EamMaintenanceTask } from '../src/modules/eam/entities/eam-maintenance-task.entity.js';
import { EamFaultRecord } from '../src/modules/eam/entities/eam-fault-record.entity.js';
import { EamInspectionRecord } from '../src/modules/eam/entities/eam-inspection-record.entity.js';
import { EamLubrication } from '../src/modules/eam/entities/eam-lubrication.entity.js';
import { EamOeeRecord } from '../src/modules/eam/entities/eam-oee-record.entity.js';
import { EamEquipmentHistory } from '../src/modules/eam/entities/eam-equipment-history.entity.js';
import { EamEquipmentFinance } from '../src/modules/eam/entities/eam-equipment-finance.entity.js';

// ── Shared ────────────────────────────────────────────────────────────────────
import { EventStore } from '../src/shared/message/event-store.entity.js';
import { SysFile } from '../src/modules/file/entities/sys-file.entity.js';

// ─────────────────────────────────────────────────────────────────────────────

const dataSource = new DataSource({
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
    // Auth
    SysUser, SysRole, SysPermission, SysRolePermission, SysUserRole, SysTenant, SysAuditLog,
    // Base
    MaterialBatch, SysOrganization, SysUom,
    // Conversion
    ConversionInstance, CiInput, CiOutput, ConversionDefinition, CdInput, CdOutput,
    // PLM
    PlmMaterial, PlmBom, PlmBomLine, PlmRouting, PlmRoutingOperation,
    PlmEcr, PlmEcn, PlmDocument, PlmDocumentPermission,
    PlmMaterialCategory, PlmMaterialCodeRule, PlmMaterialSubstitute,
    PlmProcessParameter, PlmBomChangeLog,
    // MES
    MesWorkOrder, MesWorkOrderOperation, MesProductionReport, MesMaterialIssue,
    MesWip, MesLaborRecord, MesWorkOrderSplit, MesWorkOrderMerge,
    // WMS
    WmsInventory, WmsStockTransaction, WmsWarehouse, WmsLocation, WmsZone,
    WmsContainer, WmsPickTask, WmsPickTaskLine, WmsStockTake, WmsStockTakeLine,
    WmsSafetyStock, WmsBarcodeRule,
    // QMS
    QmsInspectionRecord, QmsInspectionStandard, QmsInspectionItem,
    QmsNonconformance, QmsCorrectiveAction, QmsSpcDataPoint,
    QmsSip, QmsFinalInspection, QmsSupplierQualityRecord, QmsCustomerComplaint, QmsRecall,
    // SCM
    ScmPurchaseOrder, ScmPurchaseOrderLine, ScmPurchaseRequest, ScmAsn,
    ScmReceipt, ScmReceiptException, ScmInquiry, ScmInquiryLine,
    ScmPriceAgreement, ScmPriceRecord,
    // ERP
    ErpCustomer, ErpQuotation, ErpReceivable, ErpPayable, ErpReconciliation,
    ErpAccount, ErpCostCenter, ErpCostElement, ErpCostRecord, ErpCostAllocation,
    ErpSalesOrder, ErpSalesOrderLine, ErpSalesReturn, ErpShipment,
    ErpStandardCost, ErpVoucher, ErpVoucherLine,
    // APS
    ApsSchedule, ApsScheduleOperation, ApsResource, ApsCalendar,
    ApsMrp, ApsMrpLine, ApsPriorityRule, ApsOptimizationTarget,
    // EAM
    EamEquipment, EamMaintenancePlan, EamMaintenanceTask, EamFaultRecord,
    EamInspectionRecord, EamLubrication, EamOeeRecord,
    EamEquipmentHistory, EamEquipmentFinance,
    // Shared
    EventStore, SysFile,
  ],
});

async function main() {
  console.log('🔄 Connecting to database...');
  try {
    await dataSource.initialize();
    console.log('✅ Database connected, schema synchronized');
    const tables: Record<string, string>[] = await dataSource.query('SHOW TABLES');
    console.log(`\n✅ Total tables: ${tables.length}`);
    tables.forEach(t => console.log(`   📋 ${Object.values(t)[0]}`));
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('\n🔌 Connection closed');
  }
}

main();
