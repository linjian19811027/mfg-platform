/**
 * 全量 API 测试脚本
 * node scripts/test-all-api.mjs
 */
const BASE = 'http://localhost:3000/api/v1'
let TOKEN = '', TID = 'DEFAULT'
let pass = 0, fail = 0, skip = 0

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data: json.data ?? json, msg: json.message ?? json.errorCode }
}

function log(label, r, expectOk = true) {
  if (r === null) { console.log(`  ⏭  ${label} (跳过)`); skip++; return }
  if (r.ok === expectOk) { console.log(`  ✅ ${label} [${r.status}]`); pass++ }
  else { console.log(`  ❌ ${label} [${r.status}] ${r.msg}`); fail++ }
}

async function main() {
  // ── 登录 ──────────────────────────────────────────────────────────────────
  console.log('\n=== AUTH ===')
  const lr = await req('POST', '/auth/login', { username: 'admin', password: 'Admin@123456', tenantCode: 'DEFAULT' })
  TOKEN = lr.data?.accessToken
  log('POST /auth/login', lr)
  if (!TOKEN) { console.error('登录失败，终止'); process.exit(1) }

  // ── PLM ───────────────────────────────────────────────────────────────────
  console.log('\n=== PLM ===')
  log('GET  /plm/materials', await req('GET', `/plm/materials?tenantId=${TID}`))
  const mat = await req('POST', '/plm/materials', { tenantId: TID, code: `MAT-T${Date.now()}`, name: 'Test Material', type: 'RAW', uomId: '1', status: 'ACTIVE' })
  log('POST /plm/materials', mat)
  const matId = mat.data?.id ?? '1'
  log('GET  /plm/materials/:id', await req('GET', `/plm/materials/${matId}`))
  log('PUT  /plm/materials/:id', await req('PUT', `/plm/materials/${matId}`, { tenantId: TID, name: 'Test Material Updated' }))
  log('GET  /plm/materials/categories', await req('GET', `/plm/materials/categories?tenantId=${TID}`))
  const cat = await req('POST', `/plm/materials/categories?tenantId=${TID}`, { code: `CAT-T${Date.now()}`, name: 'Test Cat', level: 1 })
  log('POST /plm/materials/categories', cat)
  log('GET  /plm/materials/code-rules', await req('GET', `/plm/materials/code-rules?tenantId=${TID}`))
  log('GET  /plm/boms', await req('GET', `/plm/boms?tenantId=${TID}`))
  const bom = await req('POST', '/plm/boms', { tenantId: TID, bom: { materialId: matId, status: 'ACTIVE' }, lines: [] })
  log('POST /plm/boms', bom)
  const bomId = bom.data?.id ?? '1'
  log('GET  /plm/boms/:id', await req('GET', `/plm/boms/${bomId}`))
  log('GET  /plm/boms/:id/expand', await req('GET', `/plm/boms/${bomId}/expand`))
  log('GET  /plm/routings', await req('GET', `/plm/routings?tenantId=${TID}`))
  const rt = await req('POST', '/plm/routings', { tenantId: TID, routing: { code: `RT-T${Date.now()}`, name: 'Test Route', materialId: matId, status: 'ACTIVE' }, operations: [] })
  log('POST /plm/routings', rt)
  const rtId = rt.data?.id ?? '1'
  log('GET  /plm/routings/:id', await req('GET', `/plm/routings/${rtId}`))
  log('GET  /plm/ecrs', await req('GET', `/plm/ecrs?tenantId=${TID}`))
  const ecr = await req('POST', '/plm/ecrs', { tenantId: TID, ecrNo: `ECR-T${Date.now()}`, title: 'Test ECR', changeReason: 'Test reason', changeType: 'DESIGN', affectedItems: [], status: 'DRAFT' })
  log('POST /plm/ecrs', ecr)
  log('GET  /plm/ecns', await req('GET', `/plm/ecns?tenantId=${TID}`))
  log('GET  /plm/documents', await req('GET', `/plm/documents?refType=MATERIAL&refId=${matId}`))

  // ── SCM ───────────────────────────────────────────────────────────────────
  console.log('\n=== SCM ===')
  log('GET  /scm/suppliers', await req('GET', `/scm/suppliers?tenantId=${TID}`))
  const sup = await req('POST', `/scm/suppliers?tenantId=${TID}`, { code: `SUP-T${Date.now()}`, name: 'Test Supplier', type: 'QUALIFIED', contactName: 'Test', contactPhone: '13800000001' })
  log('POST /scm/suppliers', sup)
  const supId = sup.data?.id ?? '1'
  log('GET  /scm/suppliers/:id', await req('GET', `/scm/suppliers/${supId}?tenantId=${TID}`))
  log('PATCH /scm/suppliers/:id', await req('PATCH', `/scm/suppliers/${supId}?tenantId=${TID}`, { contactName: 'Updated' }))
  log('GET  /scm/purchase-requests', await req('GET', `/scm/purchase-requests?tenantId=${TID}`))
  const pr = await req('POST', `/scm/purchase-requests?tenantId=${TID}`, { materialId: matId, quantity: 100, uomId: '1', expectedDate: '2026-06-01', reason: 'Test' })
  log('POST /scm/purchase-requests', pr)
  const prId = pr.data?.id ?? '1'
  log('PATCH /scm/purchase-requests/:id/submit', await req('PATCH', `/scm/purchase-requests/${prId}/submit?tenantId=${TID}`))
  log('GET  /scm/purchase-orders', await req('GET', `/scm/purchase-orders?tenantId=${TID}`))
  const po = await req('POST', `/scm/purchase-orders?tenantId=${TID}`, { data: { supplierId: supId, currency: 'CNY', orderDate: '2026-04-17' }, lines: [{ lineNo: 1, materialId: matId, quantity: 100, unitPrice: 50, uomId: '1' }] })
  log('POST /scm/purchase-orders', po)
  const poId = po.data?.id ?? '1'
  log('GET  /scm/purchase-orders/:id', await req('GET', `/scm/purchase-orders/${poId}?tenantId=${TID}`))
  log('PATCH /scm/purchase-orders/:id/confirm', await req('PATCH', `/scm/purchase-orders/${poId}/confirm?tenantId=${TID}`))
  log('GET  /scm/asns', await req('GET', `/scm/asns?tenantId=${TID}`))
  const asn = await req('POST', `/scm/asns?tenantId=${TID}`, { supplierId: supId, poId: poId, expectedDate: '2026-05-01' })
  log('POST /scm/asns', asn)
  const asnId = asn.data?.id ?? '1'
  log('PATCH /scm/asns/:id/receive', await req('PATCH', `/scm/asns/${asnId}/receive?tenantId=${TID}`))
  log('GET  /scm/receipts', await req('GET', `/scm/receipts?tenantId=${TID}`))
  log('GET  /scm/inquiries', await req('GET', `/scm/inquiries?tenantId=${TID}`))
  const rfq = await req('POST', `/scm/inquiries?tenantId=${TID}`, { materialId: matId, quantity: 100, uomId: '1', requiredDate: '2026-06-01' })
  log('POST /scm/inquiries', rfq)
  log('GET  /scm/price-agreements', await req('GET', `/scm/price-agreements?tenantId=${TID}`))
  log('GET  /scm/reconciliations', await req('GET', `/scm/reconciliations?tenantId=${TID}`))
  log('GET  /scm/receipt-exceptions', await req('GET', `/scm/receipt-exceptions?tenantId=${TID}`))
  log('GET  /scm/supplier-qualifications', await req('GET', `/scm/supplier-qualifications?tenantId=${TID}`))
  log('GET  /scm/analytics/amount', await req('GET', `/scm/analytics/amount?tenantId=${TID}`))
  log('GET  /scm/analytics/delivery-trend', await req('GET', `/scm/analytics/delivery-trend?tenantId=${TID}`))

  // ── ERP ───────────────────────────────────────────────────────────────────
  console.log('\n=== ERP ===')
  log('GET  /erp/customers', await req('GET', `/erp/customers?tenantId=${TID}`))
  const cus = await req('POST', `/erp/customers?tenantId=${TID}`, { code: `CUS-T${Date.now()}`, name: 'Test Customer', type: 'GENERAL', creditLimit: 100000 })
  log('POST /erp/customers', cus)
  const cusId = cus.data?.id ?? '1'
  log('GET  /erp/customers/:id', await req('GET', `/erp/customers/${cusId}?tenantId=${TID}`))
  log('GET  /erp/quotations', await req('GET', `/erp/quotations?tenantId=${TID}`))
  const qt = await req('POST', `/erp/quotations?tenantId=${TID}`, { customerId: cusId, currency: 'CNY', quotationDate: '2026-04-17', validUntil: '2026-06-01', lines: [] })
  log('POST /erp/quotations', qt)
  const qtId = qt.data?.id ?? '1'
  log('PATCH /erp/quotations/:id/send', await req('PATCH', `/erp/quotations/${qtId}/send?tenantId=${TID}`))
  log('GET  /erp/sales-orders', await req('GET', `/erp/sales-orders?tenantId=${TID}`))
  const so = await req('POST', `/erp/sales-orders?tenantId=${TID}`, { data: { customerId: cusId, currency: 'CNY', orderDate: '2026-04-17', deliveryDate: '2026-05-20' }, lines: [{ lineNo: 1, materialId: matId, quantity: 10, unitPrice: 200, uomId: '2', amount: 2000 }] })
  log('POST /erp/sales-orders', so)
  const soId = so.data?.id ?? '1'
  log('GET  /erp/sales-orders/:id', await req('GET', `/erp/sales-orders/${soId}?tenantId=${TID}`))
  log('PATCH /erp/sales-orders/:id/confirm', await req('PATCH', `/erp/sales-orders/${soId}/confirm?tenantId=${TID}`))
  log('GET  /erp/shipments', await req('GET', `/erp/shipments?tenantId=${TID}`))
  log('GET  /erp/sales-returns', await req('GET', `/erp/sales-returns?tenantId=${TID}`))
  log('GET  /erp/receivables', await req('GET', `/erp/receivables?tenantId=${TID}`))
  log('GET  /erp/receivables/aging', await req('GET', `/erp/receivables/aging?tenantId=${TID}`))
  log('GET  /erp/payables', await req('GET', `/erp/payables?tenantId=${TID}`))
  log('GET  /erp/accounts', await req('GET', `/erp/accounts?tenantId=${TID}`))
  log('GET  /erp/accounts/tree', await req('GET', `/erp/accounts/tree?tenantId=${TID}`))
  log('GET  /erp/vouchers', await req('GET', `/erp/vouchers?tenantId=${TID}`))
  log('GET  /erp/ledger/general', await req('GET', `/erp/ledger/general?tenantId=${TID}`))
  log('GET  /erp/ledger/detail', await req('GET', `/erp/ledger/detail?tenantId=${TID}&accountId=1`))
  log('GET  /erp/cost-centers', await req('GET', `/erp/cost-centers?tenantId=${TID}`))
  log('GET  /erp/cost-centers/tree', await req('GET', `/erp/cost-centers/tree?tenantId=${TID}`))
  log('GET  /erp/standard-costs', await req('GET', `/erp/standard-costs?tenantId=${TID}`))
  log('GET  /erp/cost-elements', await req('GET', `/erp/cost-elements?tenantId=${TID}`))
  log('GET  /erp/cost-analysis/variance', await req('GET', `/erp/cost-analysis/variance?tenantId=${TID}&period=2026-04`))
  log('GET  /erp/reports/balance-sheet', await req('GET', `/erp/reports/balance-sheet?tenantId=${TID}&date=2026-04-30`))
  log('GET  /erp/reports/income-statement', await req('GET', `/erp/reports/income-statement?tenantId=${TID}&period=2026-04`))
  log('GET  /erp/analytics/sales-trend', await req('GET', `/erp/analytics/sales-trend?tenantId=${TID}`))
  log('GET  /erp/analytics/customers', await req('GET', `/erp/analytics/customers?tenantId=${TID}`))

  // ── WMS ───────────────────────────────────────────────────────────────────
  console.log('\n=== WMS ===')
  log('GET  /wms/inventory', await req('GET', `/wms/inventory?tenantId=${TID}`))
  log('GET  /wms/inventory/transactions', await req('GET', `/wms/inventory/transactions?tenantId=${TID}`))
  log('GET  /wms/warehouses', await req('GET', `/wms/warehouses?tenantId=${TID}`))
  const wh = await req('POST', `/wms/warehouses?tenantId=${TID}`, { code: `WH-T${Date.now()}`, name: 'Test WH', type: 'PHYSICAL', status: 'ACTIVE' })
  log('POST /wms/warehouses', wh)
  log('GET  /wms/safety-stocks', await req('GET', `/wms/safety-stocks?tenantId=${TID}`))
  log('GET  /wms/barcode-rules', await req('GET', `/wms/barcode-rules?tenantId=${TID}`))
  log('GET  /wms/stock-takes', await req('GET', `/wms/stock-takes?tenantId=${TID}`))
  const st = await req('POST', '/wms/stock-takes', { tenantId: TID, warehouseId: '1', takeType: 'FULL' })
  log('POST /wms/stock-takes', st)
  log('GET  /wms/pick-tasks', await req('GET', `/wms/pick-tasks?tenantId=${TID}`))
  log('GET  /wms/reports/ledger', await req('GET', `/wms/reports/ledger?tenantId=${TID}`))
  log('GET  /wms/reports/turnover', await req('GET', `/wms/reports/turnover?tenantId=${TID}`))

  // ── MES ───────────────────────────────────────────────────────────────────
  console.log('\n=== MES ===')
  log('GET  /mes/work-orders', await req('GET', `/mes/work-orders?tenantId=${TID}`))
  const wo = await req('POST', '/mes/work-orders', { materialId: matId, uomId: '2', plannedQty: 50, plannedStart: '2026-05-01', plannedEnd: '2026-05-10' })
  log('POST /mes/work-orders', wo)
  const woId = wo.data?.id ?? '1'
  log('GET  /mes/work-orders/:id', await req('GET', `/mes/work-orders/${woId}`))
  log('PATCH /mes/work-orders/:id/status', await req('PATCH', `/mes/work-orders/${woId}/status`, { status: 'IN_PROGRESS' }))
  log('GET  /mes/work-orders/:id/kit-check', await req('GET', `/mes/work-orders/${woId}/kit-check`))
  log('GET  /mes/work-orders/:id/material-issues', await req('GET', `/mes/work-orders/${woId}/material-issues`))
  log('GET  /mes/production-reports', await req('GET', `/mes/production-reports?tenantId=${TID}`))
  log('GET  /mes/dashboards/quality', await req('GET', '/mes/dashboards/quality'))
  log('GET  /mes/dashboards/production', await req('GET', '/mes/dashboards/production'))

  // ── QMS ───────────────────────────────────────────────────────────────────
  console.log('\n=== QMS ===')
  log('GET  /qms/standards', await req('GET', `/qms/standards?tenantId=${TID}`))
  const std = await req('POST', '/qms/standards', { code: `STD-T${Date.now()}`, name: 'Test Std', inspectionType: 'IQC', status: 'ACTIVE', version: 1, items: [] })
  log('POST /qms/standards', std)
  const stdId = std.data?.id ?? '1'
  log('GET  /qms/standards/:id', await req('GET', `/qms/standards/${stdId}`))
  log('GET  /qms/inspections', await req('GET', `/qms/inspections?tenantId=${TID}`))
  log('GET  /qms/nonconformances', await req('GET', `/qms/nonconformances?tenantId=${TID}`))
  log('GET  /qms/corrective-actions', await req('GET', `/qms/corrective-actions?tenantId=${TID}`))
  log('GET  /qms/complaints', await req('GET', `/qms/complaints?tenantId=${TID}`))
  log('GET  /qms/recalls', await req('GET', `/qms/recalls?tenantId=${TID}`))
  log('GET  /qms/spc/chart/:itemId', await req('GET', `/qms/spc/chart/1`))

  // ── EAM ───────────────────────────────────────────────────────────────────
  console.log('\n=== EAM ===')
  log('GET  /eam/equipment', await req('GET', `/eam/equipment?tenantId=${TID}`))
  const eq = await req('POST', '/eam/equipment', { tenantId: TID, equipmentCode: `EQ-T${Date.now()}`, equipmentName: 'Test Equip', equipmentType: 'MACHINE', category: 'PROCESSING', status: 'RUNNING' })
  log('POST /eam/equipment', eq)
  const eqId = eq.data?.id ?? '1'
  log('GET  /eam/equipment/:id', await req('GET', `/eam/equipment/${eqId}`))
  log('GET  /eam/equipment/:id/tech-specs', await req('GET', `/eam/equipment/${eqId}/tech-specs`))
  log('POST /eam/equipment/:id/tech-specs', await req('POST', `/eam/equipment/${eqId}/tech-specs`, [{ paramCode: 'POWER', paramName: 'Power', paramValue: '7.5', paramUnit: 'kW', paramType: 'NUMBER' }]))
  log('GET  /eam/equipment/:id/finance', await req('GET', `/eam/equipment/${eqId}/finance`))
  log('POST /eam/equipment/:id/finance', await req('POST', `/eam/equipment/${eqId}/finance`, { originalValue: 500000, depreciationMethod: 'STRAIGHT_LINE', usefulLife: 10, salvageValue: 25000, currentNetValue: 450000 }))
  log('GET  /eam/maintenance/strategies', await req('GET', `/eam/maintenance/strategies?tenantId=${TID}`))
  const strat = await req('POST', '/eam/maintenance/strategies', { tenantId: TID, strategyCode: `STR-T${Date.now()}`, strategyName: 'Test Strategy', strategyType: 'PERIODIC', triggerType: 'CALENDAR', intervalDays: 30, isActive: 1 })
  log('POST /eam/maintenance/strategies', strat)
  log('GET  /eam/maintenance/plans', await req('GET', `/eam/maintenance/plans?tenantId=${TID}`))
  log('GET  /eam/inspection-records', await req('GET', `/eam/inspection-records?equipmentId=${eqId}`))
  log('POST /eam/inspection-records', await req('POST', '/eam/inspection-records', { tenantId: TID, equipmentId: eqId, inspectionType: 'DAILY', inspectionDate: new Date().toISOString(), inspectorId: '1', overallResult: 'NORMAL', checkItems: [] }))
  log('GET  /eam/lubrication-records/due', await req('GET', `/eam/lubrication-records/due?tenantId=${TID}`))
  log('GET  /eam/fault-records', await req('GET', `/eam/fault-records?tenantId=${TID}`))
  const fault = await req('POST', '/eam/fault-records', { tenantId: TID, equipmentId: eqId, faultType: 'ELECTRICAL', severity: 'MEDIUM', faultDescription: 'Test fault description', reportedAt: new Date().toISOString() })
  log('POST /eam/fault-records', fault)
  log('GET  /eam/fault-knowledge', await req('GET', `/eam/fault-knowledge?tenantId=${TID}`))
  log('GET  /eam/fault-knowledge/search', await req('GET', `/eam/fault-knowledge/search?keyword=test&tenantId=${TID}`))
  log('GET  /eam/spare-parts', await req('GET', `/eam/spare-parts?tenantId=${TID}`))
  const sp = await req('POST', '/eam/spare-parts', { tenantId: TID, partCode: `SP-T${Date.now()}`, partName: 'Test Part', category: 'GENERAL', unit: 'pcs', currentStock: '10', safetyStock: '5' })
  log('POST /eam/spare-parts', sp)
  log('GET  /eam/oee', await req('GET', `/eam/oee?equipmentId=${eqId}&tenantId=${TID}`))
  log('GET  /eam/analytics/maintenance', await req('GET', `/eam/analytics/maintenance?tenantId=${TID}`))
  log('GET  /eam/analytics/fault', await req('GET', `/eam/analytics/fault?tenantId=${TID}`))
  log('GET  /eam/spare-part-transactions', await req('GET', `/eam/spare-part-transactions?tenantId=${TID}`))

  // ── APS ───────────────────────────────────────────────────────────────────
  console.log('\n=== APS ===')
  log('GET  /aps/resources', await req('GET', `/aps/resources?tenantId=${TID}`))
  const res = await req('POST', `/aps/resources?tenantId=${TID}`, { code: `RES-T${Date.now()}`, name: 'Test Resource', type: 'MACHINE', status: 'AVAILABLE', capacity: 8, efficiency: 0.9 })
  log('POST /aps/resources', res)
  const resId = res.data?.id ?? '1'
  log('GET  /aps/resources/:id', await req('GET', `/aps/resources/${resId}?tenantId=${TID}`))
  log('PATCH /aps/resources/:id/status', await req('PATCH', `/aps/resources/${resId}/status?tenantId=${TID}`, { status: 'MAINTENANCE' }))
  log('GET  /aps/calendars', await req('GET', `/aps/calendars?tenantId=${TID}`))
  const cal = await req('POST', `/aps/calendars?tenantId=${TID}`, { resourceId: resId, workDate: '2026-05-01', startTime: '08:00:00', endTime: '17:00:00', isHoliday: 0, availableHours: 8 })
  log('POST /aps/calendars', cal)
  log('GET  /aps/priority-rules', await req('GET', `/aps/priority-rules?tenantId=${TID}`))
  const pr2 = await req('POST', `/aps/priority-rules?tenantId=${TID}`, { name: `Rule-T${Date.now()}`, ruleType: 'FIFO', weight: 0.4, isActive: 1 })
  log('POST /aps/priority-rules', pr2)
  const prId2 = pr2.data?.id ?? '1'
  log('PATCH /aps/priority-rules/:id/toggle', await req('PATCH', `/aps/priority-rules/${prId2}/toggle?tenantId=${TID}`, { isActive: false }))
  log('GET  /aps/mrp', await req('GET', `/aps/mrp?tenantId=${TID}`))
  log('GET  /aps/schedules', await req('GET', `/aps/schedules?tenantId=${TID}`))
  log('GET  /aps/capacity-analysis', await req('GET', `/aps/capacity-analysis?tenantId=${TID}&startDate=2026-04-01&endDate=2026-04-30`))
  log('GET  /aps/delivery-analysis', await req('GET', `/aps/delivery-analysis?tenantId=${TID}&startDate=2026-04-01&endDate=2026-04-30`))
  log('GET  /aps/gantt/resource', await req('GET', `/aps/gantt/resource?tenantId=${TID}&startDate=2026-04-01&endDate=2026-04-30`))
  log('GET  /aps/gantt/order', await req('GET', `/aps/gantt/order?tenantId=${TID}&startDate=2026-04-01&endDate=2026-04-30`))

  // ── SYS ───────────────────────────────────────────────────────────────────
  console.log('\n=== SYS ===')
  log('GET  /sys/users', await req('GET', `/sys/users?tenantId=${TID}`))
  log('GET  /sys/roles', await req('GET', `/sys/roles?tenantId=${TID}`))
  log('GET  /sys/audit-logs', await req('GET', `/sys/audit-logs?tenantId=${TID}`))

  // ── BASE ──────────────────────────────────────────────────────────────────
  console.log('\n=== BASE ===')
  log('GET  /base/batches', await req('GET', `/base/batches?tenantId=${TID}`))
  log('GET  /base/organizations/tree', await req('GET', `/base/organizations/tree?tenantId=${TID}`))
  log('GET  /base/uoms', await req('GET', `/base/uoms?tenantId=${TID}`))

  // ── 汇总 ──────────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(50)}`)
  console.log(`✅ 通过: ${pass}  ❌ 失败: ${fail}  ⏭  跳过: ${skip}`)
  console.log(`总计: ${pass + fail + skip} 个接口`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error('脚本异常:', e.message); process.exit(1) })
