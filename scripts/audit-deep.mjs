/**
 * Deep audit: extract ALL property names from backend entities (including relations)
 * and compare with frontend columns/form fields more precisely.
 * This version also reads entity files manually for accuracy.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Parse all entity files to get exact field names
const entityDir = path.join(root, 'backend/src/modules');

function parseEntityFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const className = content.match(/export\s+class\s+(\w+)/)?.[1];
  if (!className) return null;

  const fields = new Set();
  const relations = {}; // fieldName -> relation type (ManyToOne, OneToOne, etc.)
  const joinColumns = {}; // fieldName -> DB column name

  // Extract @Column decorated properties
  // Match pattern: @Column(...) \n propertyName: Type
  const lines = content.split('\n');
  let currentDecorator = null;
  let currentPropName = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect decorators
    if (line.startsWith('@Column') || line.startsWith('@CreateDateColumn') ||
        line.startsWith('@UpdateDateColumn') || line.startsWith('@DeleteDateColumn') ||
        line.startsWith('@PrimaryGeneratedColumn') || line.startsWith('@PrimaryColumn')) {
      currentDecorator = 'column';
      // Extract name from decorator if present
      const nameMatch = line.match(/name:\s*'(\w+)'/);
      if (nameMatch) currentPropName = nameMatch[1]; // DB column name
    } else if (line.startsWith('@ManyToOne') || line.startsWith('@OneToMany') ||
               line.startsWith('@OneToOne') || line.startsWith('@ManyToMany')) {
      currentDecorator = 'relation';
    } else if (line.startsWith('@JoinColumn')) {
      const nameMatch = line.match(/name:\s*'(\w+)'/);
      if (nameMatch && currentPropName) {
        joinColumns[currentPropName] = nameMatch[1];
      }
    } else if (line.startsWith('@')) {
      currentDecorator = null;
    }

    // Detect property declaration
    const propMatch = line.match(/^(\w+)\??\s*:\s*(\w+)/);
    if (propMatch && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('@')) {
      const propName = propMatch[1];
      const propType = propMatch[2];
      // Skip common non-entity fields
      if (['constructor', 'new'].includes(propName)) continue;
      if (propName.match(/^[A-Z]/)) continue; // Skip type imports
      fields.add(propName);
      if (currentDecorator === 'relation') {
        relations[propName] = propType;
      }
    }
  }

  return { className, fields, relations, joinColumns, filePath };
}

// Walk entity directories
const allEntities = {};
function walkEntities(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkEntities(full);
    else if (entry.name.endsWith('.entity.ts')) {
      const parsed = parseEntityFile(full);
      if (parsed) allEntities[parsed.className] = parsed;
    }
  }
}
walkEntities(entityDir);

// Also collect all unique field names across all entities for cross-reference
const allFieldNames = new Set();
for (const e of Object.values(allEntities)) {
  for (const f of e.fields) allFieldNames.add(f);
}

// --- Now scan frontend Vue files ---
const viewsDir = path.join(root, 'frontend/src/views');

function walkVueFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkVueFiles(full));
    else if (entry.name.endsWith('.vue')) results.push(full);
  }
  return results;
}

const vueFiles = walkVueFiles(viewsDir);

// Determine the backend entity for each Vue file based on:
// 1. Directory structure mapping
// 2. API endpoint in file content
// 3. Service/import references

const moduleMapping = {
  'aps': ['Aps'],
  'base': ['Mfg', 'Sys', 'Material'],
  'eam': ['Eam'],
  'erp': ['Erp'],
  'hr': ['Hr'],
  'mes': ['Mes'],
  'outsourcing': ['Outsourcing'],
  'plm': ['Plm'],
  'qms': ['Qms'],
  'scm': ['Scm'],
  'sys': ['Sys'],
  'traceability': ['Trace'],
  'wms': ['Wms'],
};

const viewToEntityHints = {
  // aps
  'aps/calendar': 'ApsCalendar',
  'aps/capacity': 'ApsResource',
  'aps/gantt': 'ApsSchedule',
  'aps/mrp': 'ApsMrp',
  'aps/priority-rule': 'ApsPriorityRule',
  'aps/resource': 'ApsResource',
  'aps/schedule': 'ApsSchedule',
  // base
  'base/batch': 'MaterialBatch',
  'base/certification-types': 'HrCertificationType',
  'base/file': 'SysFile',
  'base/shifts': 'MfgWorkCenter', // shifts might be in work center
  'base/work-center': 'MfgWorkCenter',
  // eam
  'eam/equipment': 'EamEquipment',
  'eam/fault': 'EamFaultRecord',
  'eam/inspection': 'EamInspectionRecord',
  'eam/knowledge': 'EamFaultKnowledge',
  'eam/lubrication': 'EamLubrication',
  'eam/maintenance': 'EamMaintenancePlan',
  'eam/oee': 'EamOeeRecord',
  'eam/spare-part': 'EamSparePart',
  'eam/strategy': 'EamMaintenanceStrategy',
  'eam/analytics': 'EamOeeRecord',
  // erp
  'erp/account': 'ErpAccount',
  'erp/cost-center': 'ErpCostCenter',
  'erp/cost-element': 'ErpCostElement',
  'erp/customer': 'ErpCustomer',
  'erp/payable': 'ErpPayable',
  'erp/quotation': 'ErpQuotation',
  'erp/receivable': 'ErpReceivable',
  'erp/sales-return': 'ErpSalesReturn',
  'erp/salesorder': 'ErpSalesOrder',
  'erp/shipment': 'ErpShipment',
  'erp/standard-cost': 'ErpStandardCost',
  'erp/voucher': 'ErpVoucher',
  // hr
  'hr/employees': 'HrEmployee',
  'hr/employee-history': 'HrEmployeeHistory',
  'hr/schedules': 'HrShiftSchedule',
  // mes
  'mes/workorder': 'MesWorkOrder',
  'mes/operation': 'MesWorkOrderOperation',
  'mes/picking': 'MesPicking',
  'mes/receipt-logs': 'MesAutoReceiptConfig',
  'mes/auto-receipt-config': 'MesAutoReceiptConfig',
  'mes/labor': 'HrEmployee',
  'mes/wip': 'MesWip',
  // outsourcing
  'outsourcing/orders': 'OutsourcingOrder',
  // plm
  'plm/material': 'PlmMaterial',
  'plm/bom': 'PlmBom',
  'plm/routing': 'PlmRouting',
  'plm/standard-operation': 'PlmStandardOperation',
  'plm/category': 'PlmMaterialCategory',
  'plm/code-rule': 'PlmMaterialCodeRule',
  'plm/document': 'PlmDocument',
  'plm/ecn': 'PlmEcn',
  'plm/ecr': 'PlmEcr',
  'plm/ecn-execution-plans': 'PlmEcnExecutionPlan',
  // qms
  'qms/inspection': 'QmsInspectionRecord',
  'qms/nonconformance': 'QmsNonconformance',
  'qms/capa': 'QmsCapa',
  'qms/complaint': 'QmsComplaint',
  'qms/standard': 'QmsInspectionStandard',
  'qms/spc': 'QmsSpcRecord',
  'qms/final-inspection': 'QmsFinalInspection',
  'qms/supplier-quality': 'QmsSupplierEvaluation',
  'qms/recall': 'QmsRecall',
  // scm
  'scm/supplier': 'ScmSupplier',
  'scm/purchase': 'ScmPurchaseOrder',
  'scm/purchase-request': 'ScmPurchaseRequest',
  'scm/receipt': 'ScmReceipt',
  'scm/asn': 'ScmAsn',
  'scm/rfq': 'ScmRfq',
  'scm/price-agreement': 'ScmPriceAgreement',
  'scm/qualification': 'ScmSupplierQualification',
  'scm/reconciliation': 'ScmReconciliation',
  'scm/analytics': 'ScmSupplier',
  'scm/supplier-performance': 'ScmSupplierPerformance',
  'scm/receipt-exception': 'ScmReceipt',
  // sys
  'sys/organization': 'SysOrganization',
  'sys/role': 'SysRole',
  'sys/permission': 'SysPermission',
  'sys/user': 'SysUser',
  'sys/audit-log': 'SysAuditLog',
  'sys/config': 'SysConfig',
  'sys/tenant': 'SysTenant',
  'sys/uom': 'SysUom',
  'sys/numbering': 'SysNumberingRule',
  // wms
  'wms/warehouse': 'WmsWarehouse',
  'wms/location': 'WmsLocation',
  'wms/zone': 'WmsZone',
  'wms/material': 'WmsMaterial',
  'wms/inventory': 'WmsInventory',
  'wms/transaction': 'WmsTransaction',
  'wms/picking-task': 'WmsPickingTask',
  'wms/replenish': 'WmsReplenishTask',
  'wms/putaway': 'WmsPutawayTask',
  'wms/safety-stock': 'WmsSafetyStock',
  'wms/inventory-count': 'WmsInventoryCount',
  'wms/barcode-rule': 'WmsBarcodeRule',
  'wms/dashboard': 'WmsWarehouse',
  'wms/reports/ledger': 'WmsTransaction',
  'wms/reports/turnover': 'WmsInventory',
};

// Known meta/common fields to skip
const SKIP_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy',
  'createTime', 'updateTime', 'createBy', 'updateBy', 'create_time', 'update_time',
  'status', 'remark', 'description', 'name', 'code', 'type', 'sort', 'enabled',
  'tenantId', 'tenant_id', 'orgId', 'org_id', 'key', 'action', 'index', 'children',
  'total', 'current', 'pageSize', 'page', 'size', 'count', 'label', 'value',
  'title', 'icon', 'path', 'component', 'redirect', 'hidden', 'parentId', 'parent_id',
  'level', 'sortOrder', 'sort_order', 'isActive', 'is_active', 'isEnabled', 'is_enabled',
  'row', 'col', 'span', 'data', 'loading', 'visible', 'disabled', 'rules', 'model',
  'options', 'placeholder', 'required', 'width', 'fixed', 'align', 'ellipsis',
  'oper', 'operation', 'actions', 'handle', 'operate',
  'startTime', 'endTime', 'startDate', 'endDate', 'date', 'time',
  'pageNo', 'pageSize', 'pageNo', 'totalPage', 'totalRecord',
]);

const results = [];

for (const vueFile of vueFiles) {
  const relPath = path.relative(viewsDir, vueFile).replace(/\\/g, '/');
  const content = fs.readFileSync(vueFile, 'utf-8');

  // Extract dataIndex from columns
  const columns = [];
  const dataIndexRegex = /dataIndex\s*:\s*['"]([\w.]+)['"]/g;
  let m;
  while ((m = dataIndexRegex.exec(content)) !== null) {
    const val = m[1].split('.')[0]; // handle nested like 'material.name'
    columns.push(val);
  }

  // Extract form field names
  const formFields = [];
  const fieldRegex = /(?:field|name)\s*=\s*['"](\w+)['"]/g;
  while ((m = fieldRegex.exec(content)) !== null) {
    formFields.push(m[1]);
  }

  // Extract v-model formModel.xxx
  const vmodelRegex = /formModel\.(\w+)/g;
  while ((m = vmodelRegex.exec(content)) !== null) {
    formFields.push(m[1]);
  }

  const allFields = [...new Set([...columns, ...formFields])];
  if (allFields.length === 0) continue;

  // Get candidate entity
  const viewKey = relPath.replace(/\/(index|detail)\.vue$/, '').replace(/\/detail$/, '');
  const entityName = viewToEntityHints[viewKey];
  
  if (!entityName) continue; // Skip views we can't map

  const entity = allEntities[entityName];
  if (!entity) {
    // Try alternative naming
    const altName = Object.keys(allEntities).find(k => 
      k.toLowerCase().includes(viewKey.split('/').pop().replace(/[-_]/g, ''))
    );
    if (altName) {
      const altEntity = allEntities[altName];
      for (const f of allFields) {
        if (SKIP_FIELDS.has(f)) continue;
        if (!altEntity.fields.has(f)) {
          results.push({ file: relPath, field: f, entity: altName, entityFields: [...altEntity.fields].sort() });
        }
      }
    }
    continue;
  }

  // For each frontend field, check if it exists in the entity
  // Also check related entities (ManyToOne etc)
  const relatedFields = new Set(entity.fields);
  for (const [relName, relType] of Object.entries(entity.relations)) {
    // Add common related entity fields like xxxName, xxxCode
    relatedFields.add(`${relName}Name`);
    relatedFields.add(`${relName}Code`);
    // Find the related entity and add its fields
    const relEntityName = Object.keys(allEntities).find(k => 
      k.toLowerCase() === relType.toLowerCase() || 
      k.toLowerCase() === relType.toLowerCase().replace('entity', '')
    );
    if (relEntityName) {
      for (const f of allEntities[relEntityName].fields) {
        relatedFields.add(f);
      }
    }
  }

  for (const f of allFields) {
    if (SKIP_FIELDS.has(f)) continue;
    if (!relatedFields.has(f)) {
      // Double-check against all entities
      let globalFound = false;
      for (const e of Object.values(allEntities)) {
        if (e.fields.has(f)) { globalFound = true; break; }
      }
      if (!globalFound) {
        results.push({ file: relPath, field: f, entity: entityName, entityFields: [...entity.fields].sort().join(', ') });
      }
    }
  }
}

// Group by file and output
const byFile = {};
for (const r of results) {
  const key = r.file;
  if (!byFile[key]) byFile[key] = [];
  byFile[key].push(r);
}

console.log('=== FRONTEND ↔ BACKEND FIELD MISMATCH AUDIT ===\n');
console.log('Fields used in Vue columns/forms that do NOT exist in the mapped backend entity\n');

for (const [file, items] of Object.entries(byFile).sort()) {
  console.log(`📁 ${file}`);
  for (const item of items) {
    console.log(`   ❌ "${item.field}" NOT in entity ${item.entity}`);
    console.log(`      Entity fields: ${item.entityFields.substring(0, 200)}...`);
  }
  console.log();
}

console.log(`\nTotal: ${results.length} mismatches across ${Object.keys(byFile).length} files`);
