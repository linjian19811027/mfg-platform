/**
 * MFG Platform 完整业务数据初始化脚本 v1.1
 * 覆盖所有模块的测试数据
 * 运行: node scripts/init-complete.mjs
 *
 * v1.1修复: 修正OUTSOURCING/TRACEABILITY/BASE模块的API路径和字段名
 */

const BASE = 'http://localhost:3000'
const API = BASE + '/api/v1'
const HR = BASE + '/hr'

let token = ''

async function login() {
  const r = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456', tenantCode: 'DEFAULT' })
  }).then(r => r.json())
  token = r.data?.accessToken
  console.log('[登录]', token ? 'OK' : 'FAIL')
  return token
}

async function post(url, data) {
  const body = JSON.stringify(data)
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Tenant-Id': 'DEFAULT' },
    body
  }).then(r => r.json())
  if (r.code !== 200) {
    console.log(`  [失败] ${url.split('/').pop()} - ${r.message || r.errorCode || JSON.stringify(r)}`)
    return null
  }
  return r.data
}

async function getList(path) {
  const r = await fetch(path + '?pageSize=500', {
    headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-Id': 'DEFAULT' }
  }).then(r => r.json())
  return r.data?.items || r.data?.list || r.data || []
}

async function create(name, url, data) {
  const result = await post(url, data)
  if (result?.id) {
    console.log(`  +${name}: ${result.id}`)
  }
  return result
}

async function main() {
  console.log('========================================')
  console.log('MFG Platform 完整数据初始化 v1.1')
  console.log('========================================')

  await login()
  if (!token) return

  // 获取基础数据
  console.log('\n[获取基础数据...]')
  const [uoms, whs, mats, boms, routings, equip, emps] = await Promise.all([
    getList(API + '/base/uoms'),
    getList(API + '/wms/warehouses'),
    getList(API + '/plm/materials'),
    getList(API + '/plm/boms'),
    getList(API + '/plm/routings'),
    getList(API + '/eam/equipment'),
    getList(HR + '/employees')
  ])

  console.log(`  UOM: ${uoms.length}, WH: ${whs.length}, Material: ${mats.length}`)
  console.log(`  BOM: ${boms.length}, Routing: ${routings.length}, Equipment: ${equip.length}`)

  const uom0 = uoms[0]
  const wh0 = whs[0]
  const mat0 = mats[0]
  const bom0 = boms[0]
  const rout0 = routings[0]
  const emp0 = emps[0]

  // ========== 1. MES: 生产工单 ==========
  console.log('\n[1. MES: 生产工单]')
  for (let i = 1; i <= 20; i++) {
    const mat = mats[(i-1) % mats.length]
    const bom = boms[(i-1) % boms.length]
    const rout = routings[(i-1) % routings.length]
    await create('WO', API + '/mes/work-orders', {
      woNo: `WO-${String(i).padStart(4,'0')}`,
      woType: 'STANDARD',
      materialId: mat?.id,
      bomId: bom?.id,
      routingId: rout?.id,
      plannedQty: 50 + i * 10,
      uomId: uom0?.id || '1',
      priority: (i % 10) + 1,
      bomLevel: 0,
      isCritical: i <= 3,
      status: 'RELEASED'
    })
  }

  // ========== 2. APS: 资源 ==========
  console.log('\n[2. APS: 资源]')
  if (equip.length > 0) {
    for (let i = 1; i <= 10; i++) {
      const eq = equip[(i-1) % equip.length]
      await create('Resource', API + '/aps/resources', {
        resourceCode: `RES-${String(i).padStart(3,'0')}`,
        resourceName: `资源${i}`,
        resourceType: eq?.equipmentType || 'Machine',
        workshopId: null,
        status: 'AVAILABLE'
      })
    }
  }

  // ========== 3. APS: 日历 ==========
  console.log('\n[3. APS: 日历]')
  for (let i = 1; i <= 10; i++) {
    await create('Calendar', API + '/aps/calendars', {
      name: `日历${i}`,
      date: new Date(2026, 4, 1 + i).toISOString().split('T')[0],
      type: i % 2 === 0 ? 'REST' : 'WORKING',
      shiftId: null
    })
  }

  // ========== 4. APS: 优先级规则 ==========
  console.log('\n[4. APS: 优先级规则]')
  const priorityRules = ['FIFO', 'EDDD', 'CRITICAL', 'MATERIAL_AVAIL']
  for (let i = 0; i < priorityRules.length; i++) {
    await create('PriorityRule', API + '/aps/priority-rules', {
      ruleCode: `PR-${i+1}`,
      ruleName: priorityRules[i],
      description: `优先级规则${i+1}`,
      priority: i + 1,
      status: 'ACTIVE'
    })
  }

  // ========== 5. APS: 排程 ==========
  console.log('\n[5. APS: 排程]')
  const wos = await getList(API + '/mes/work-orders')
  if (wos.length > 0 && equip.length > 0) {
    await create('Schedule', API + '/aps/schedules', {
      scheduleCode: `SCH-${Date.now()}`,
      woId: wos[0]?.id,
      resourceId: equip[0]?.id,
      plannedStart: new Date().toISOString(),
      plannedEnd: new Date(Date.now() + 86400000).toISOString(),
      status: 'DRAFT'
    })
  }

  // ========== 6. APS: MRP ==========
  console.log('\n[6. APS: MRP]')
  if (mat0) {
    await create('MRP', API + '/aps/mrp', {
      mrpCode: `MRP-${Date.now()}`,
      materialId: mat0.id,
      requiredQty: 100,
      status: 'PENDING'
    })
  }

  // ========== 7. ERP: 客户 ==========
  console.log('\n[7. ERP: 客户]')
  for (let i = 1; i <= 10; i++) {
    await create('Customer', API + '/erp/customers', {
      code: `CUST-${String(i).padStart(3,'0')}`,
      name: `客户${i}`,
      contactPerson: `联系人${i}`,
      phone: `138${String(10000000 + i)}`,
      type: 'DOMESTIC',
      status: 'ACTIVE'
    })
  }

  // ========== 8. ERP: 销售订单 ==========
  console.log('\n[8. ERP: 销售订单]')
  const customers = await getList(API + '/erp/customers')
  if (customers.length > 0 && mats.length > 0) {
    for (let i = 1; i <= 10; i++) {
      await create('SalesOrder', API + '/erp/sales-orders', {
        orderNo: `SO-${String(i).padStart(4,'0')}`,
        customerId: customers[(i-1) % customers.length]?.id,
        orderDate: '2026-05-01',
        deliveryDate: '2026-05-15',
        status: 'OPEN'
      })
    }
  }

  // ========== 9. ERP: 会计科目 ==========
  console.log('\n[9. ERP: 会计科目]')
  const accounts = [
    { code: '1001', name: '库存现金' },
    { code: '1002', name: '银行存款' },
    { code: '1122', name: '应收账款' },
    { code: '2202', name: '应付账款' },
    { code: '5001', name: '生产成本' },
    { code: '6001', name: '主营业务收入' }
  ]
  for (const acc of accounts) {
    await create('Account', API + '/erp/accounts', {
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.code.startsWith('1') ? 'ASSET' : 'LIABILITY',
      status: 'ACTIVE'
    })
  }

  // ========== 10. ERP: 成本中心 ==========
  console.log('\n[10. ERP: 成本中心]')
  for (let i = 1; i <= 5; i++) {
    await create('CostCenter', API + '/erp/cost-centers', {
      costCenterCode: `CC-${String(i).padStart(3,'0')}`,
      costCenterName: `成本中心${i}`,
      status: 'ACTIVE'
    })
  }

  // ========== 11. ERP: 凭证 ==========
  console.log('\n[11. ERP: 凭证]')
  if (accounts.length >= 2) {
    await create('Voucher', API + '/erp/vouchers', {
      voucherNo: `VCH-${Date.now()}`,
      date: '2026-05-01',
      entries: [
        { accountCode: accounts[0].code, debit: 1000, credit: 0 },
        { accountCode: accounts[1].code, debit: 0, credit: 1000 }
      ]
    })
  }

  // ========== 12. SCM: 供应商询价 ==========
  console.log('\n[12. SCM: 询价单]')
  if (emps.length > 0) {
    for (let i = 1; i <= 5; i++) {
      await create('Inquiry', API + '/scm/inquiries', {
        inquiryNo: `INQ-${String(i).padStart(4,'0')}`,
        supplierId: '1',
        inquiryDate: '2026-05-01',
        status: 'DRAFT'
      })
    }
  }

  // ========== 13. SCM: 采购订单 ==========
  console.log('\n[13. SCM: 采购订单]')
  const suppliers = await getList(API + '/scm/suppliers')
  if (suppliers.length > 0 && mats.length > 0) {
    for (let i = 1; i <= 10; i++) {
      await create('PurchaseOrder', API + '/scm/purchase-orders', {
        poNo: `PO-${String(i).padStart(4,'0')}`,
        supplierId: suppliers[(i-1) % suppliers.length]?.id,
        orderDate: '2026-05-01',
        deliveryDate: '2026-05-15',
        status: 'APPROVED'
      })
    }
  }

  // ========== 14. SCM: ASN ==========
  console.log('\n[14. SCM: ASN]')
  const pos = await getList(API + '/scm/purchase-orders')
  if (pos.length > 0) {
    for (let i = 1; i <= 5; i++) {
      await create('ASN', API + '/scm/asns', {
        asnNo: `ASN-${String(i).padStart(4,'0')}`,
        purchaseOrderId: pos[(i-1) % pos.length]?.id,
        expectedDate: '2026-05-15',
        status: 'PENDING'
      })
    }
  }

  // ========== 15. SCM: 到货记录 ==========
  console.log('\n[15. SCM: 到货记录]')
  if (pos.length > 0 && mats.length > 0) {
    await create('Receipt', API + '/scm/receipts', {
      receiptNo: `RCV-${Date.now()}`,
      purchaseOrderId: pos[0]?.id,
      materialId: mats[0]?.id,
      receivedQty: 50,
      receiptDate: '2026-05-08',
      status: 'COMPLETED'
    })
  }

  // ========== 16. QMS: 检验标准 ==========
  console.log('\n[16. QMS: 检验标准]')
  if (mats.length > 0) {
    for (let i = 1; i <= 10; i++) {
      await create('InspectionStandard', API + '/qms/standards', {
        code: `QCS-${String(i).padStart(3,'0')}`,
        name: `质检标准${i}`,
        inspectionType: i % 2 === 0 ? 'FQC' : 'IQC',
        materialId: mats[(i-1) % mats.length]?.id,
        version: 1,
        status: 'ACTIVE'
      })
    }
  }

  // ========== 17. QMS: 检验任务 ==========
  console.log('\n[17. QMS: 检验任务]')
  const standards = await getList(API + '/qms/standards')
  if (standards.length > 0 && mats.length > 0) {
    await create('InspectionTask', API + '/qms/inspections', {
      taskNo: `INS-${Date.now()}`,
      inspectionType: 'IQC',
      materialId: mats[0]?.id,
      sampleSize: 10,
      status: 'PENDING'
    })
  }

  // ========== 18. QMS: 不合格品处理 ==========
  console.log('\n[18. QMS: 不合格品]')
  if (mats.length > 0) {
    await create('Nonconformance', API + '/qms/nonconformances', {
      ncnNo: `NCN-${Date.now()}`,
      materialId: mats[0]?.id,
      quantity: 5,
      severity: 'MINOR',
      status: 'OPEN'
    })
  }

  // ========== 19. EAM: 维保策略 ==========
  console.log('\n[19. EAM: 维保策略]')
  if (equip.length > 0) {
    for (let i = 1; i <= 5; i++) {
      await create('MaintenanceStrategy', API + '/eam/maintenance-strategies', {
        strategyCode: `MS-${String(i).padStart(3,'0')}`,
        strategyName: `维保策略${i}`,
        equipmentType: equip[0]?.equipmentType || 'CNC',
        maintenanceType: i % 2 === 0 ? 'PREVENTIVE' : 'CORRECTIVE',
        intervalDays: 30 * i,
        status: 'ACTIVE'
      })
    }
  }

  // ========== 20. EAM: 维保计划 ==========
  console.log('\n[20. EAM: 维保计划]')
  if (equip.length > 0) {
    await create('MaintenancePlan', API + '/eam/maintenance-plans', {
      planCode: `MP-${Date.now()}`,
      equipmentId: equip[0]?.id,
      maintenanceType: 'PREVENTIVE',
      plannedDate: '2026-05-15',
      status: 'PENDING'
    })
  }

  // ========== 21. EAM: 故障记录 ==========
  console.log('\n[21. EAM: 故障记录]')
  if (equip.length > 0) {
    await create('FaultRecord', API + '/eam/fault-records', {
      equipmentId: equip[0]?.id,
      faultTime: new Date().toISOString(),
      faultType: 'ELECTRICAL',
      description: '测试故障',
      status: 'OPEN'
    })
  }

  // ========== 22. EAM: 备件 ==========
  // 注意: 字段是 partCode, partName, currentStock, safetyStock, unit, category
  console.log('\n[22. EAM: 备件]')
  for (let i = 1; i <= 10; i++) {
    await create('SparePart', API + '/eam/spare-parts', {
      partCode: `SP-${String(i).padStart(3,'0')}`,
      partName: `备件${i}`,
      specification: `规格${i}`,
      unit: '个',
      currentStock: 10 + i,
      safetyStock: 5,
      category: 'GENERAL',
      isActive: 1
    })
  }

  // ========== 23. EAM: 点检记录 ==========
  console.log('\n[23. EAM: 点检记录]')
  if (equip.length > 0 && emp0) {
    await create('InspectionRecord', API + '/eam/inspection-records', {
      equipmentId: equip[0]?.id,
      inspectionDate: new Date().toISOString(),
      inspectorId: emp0?.id,
      result: 'OK',
      status: 'COMPLETED'
    })
  }

  // ========== 24. HR: 班次 ==========
  // 注意: 字段是 code, name, startTime, endTime, enabled
  console.log('\n[24. HR: 班次]')
  const shiftRecords = [
    { code: 'D', name: '白班', startTime: '08:00', endTime: '20:00' },
    { code: 'N', name: '夜班', startTime: '20:00', endTime: '08:00' },
    { code: 'A', name: '早班', startTime: '06:00', endTime: '14:00' }
  ]
  for (const s of shiftRecords) {
    await create('Shift', HR + '/shifts', {
      code: s.code,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      enabled: 1
    })
  }

  // ========== 25. HR: 考勤记录 ==========
  console.log('\n[25. HR: 考勤记录]')
  if (emps.length > 0) {
    await create('Attendance', HR + '/attendances', {
      employeeId: emps[0]?.id,
      workDate: new Date().toISOString().split('T')[0],
      shiftCode: 'D',
      checkInTime: '08:00',
      checkOutTime: '17:30',
      status: 'COMPLETED'
    })
  }

  // ========== 26. MES: 报工记录 ==========
  console.log('\n[26. MES: 报工记录]')
  if (wos.length > 0 && emps.length > 0) {
    await create('ProductionReport', API + '/mes/production-reports', {
      woId: wos[0]?.id,
      reportType: 'COMPLETE',
      completedQty: 20,
      scrapQty: 1,
      operatorId: emps[0]?.id,
      reportTime: new Date().toISOString(),
      status: 'COMPLETED'
    })
  }

  // ========== 27. MES: 人工工时 ==========
  console.log('\n[27. MES: 人工工时]')
  if (emps.length > 0 && wos.length > 0) {
    await create('LaborRecord', API + '/mes/labor-records', {
      employeeId: emps[0]?.id,
      woId: wos[0]?.id,
      workDate: new Date().toISOString().split('T')[0],
      hours: 8,
      status: 'COMPLETED'
    })
  }

  // ========== 28. OUTSOURCING: 委外订单 ==========
  // 注意: OUTSOURCING path是 /outsourcing/orders (不带 /api/v1 前缀)
  console.log('\n[28. OUTSOURCING: 委外订单]')
  if (mats.length > 0 && wh0) {
    await create('OutsourcingOrder', BASE + '/outsourcing/orders', {
      ocNo: `OUT-${Date.now()}`,
      supplierId: '1', // 需要实际的supplierId
      processName: `委外工序${Date.now()}`,
      materialId: mats[0]?.id,
      plannedQty: 50,
      unitPrice: 20,
      issueWarehouseId: wh0?.id,
      plannedDelivery: '2026-05-20',
      status: 'DRAFT'
    })
  }

  // ========== 29. OUTSOURCING: 委外发料 ==========
  // 注意: endpoint是 /outsourcing/orders/:id/issues, 需要先获取orderId
  console.log('\n[29. OUTSOURCING: 委外发料]')
  const outOrders = await getList(BASE + '/outsourcing/orders')
  if (outOrders.length > 0) {
    await post(BASE + '/outsourcing/orders/' + outOrders[0]?.id + '/issues', {
      batchId: outOrders[0]?.id,
      issueQty: 30,
      warehouseId: wh0?.id || '1',
      locationId: '1',
      operatorId: emp0?.id || '1'
    })
  }

  // ========== 30. BASE: 批次 ==========
  // 注意: 批次需要 sourceType, initialQty, currentQty, uomId, qualityStatus
  console.log('\n[30. BASE: 批次]')
  if (mats.length > 0 && uom0) {
    for (let i = 1; i <= 10; i++) {
      await create('Batch', API + '/base/batches', {
        batchNo: `BAT-${String(i).padStart(4,'0')}`,
        materialId: mats[(i-1) % mats.length]?.id,
        sourceType: 'PURCHASE',
        initialQty: 100 + i * 10,
        currentQty: 100 + i * 10,
        uomId: uom0?.id,
        qualityStatus: 'PASSED',
        producedAt: new Date('2026-05-01'),
        expireAt: new Date('2027-05-01')
      })
    }
  }

  // ========== 31. TRACEABILITY: 追溯批次 ==========
  // 注意: path是 /traceability/batches/manual, 字段有 materialCode, materialName
  console.log('\n[31. TRACEABILITY: 追溯批次]')
  if (mats.length > 0) {
    await create('TraceBatch', BASE + '/traceability/batches/manual', {
      materialId: mats[0]?.id,
      materialCode: mats[0]?.materialCode || 'MAT-001',
      materialName: mats[0]?.name || mats[0]?.materialName || '测试物料',
      batchNo: `TRB-${Date.now()}`,
      plannedQty: 100,
      actualQty: 0,
      productionStart: new Date('2026-05-01'),
      productionEnd: new Date('2026-05-08')
    })
  }

  console.log('\n========================================')
  console.log('数据初始化完成!')
  console.log('========================================')
}

main().catch(console.error)