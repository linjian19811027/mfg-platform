/**
 * 测试数据初始化脚本
 * 运行：node scripts/seed-data.mjs
 * 在 backend 目录下执行，后端需要先启动
 */

const BASE = 'http://localhost:3000/api/v1'
let TOKEN = ''

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) {
    console.warn(`  ⚠️  ${method} ${path} -> ${res.status}: ${json.message || json.errorCode}`)
    return null
  }
  return json.data ?? json
}

function ok(label, obj) {
  if (obj && (obj.id || obj.list !== undefined || Array.isArray(obj))) {
    console.log(`  ✅ ${label}`)
  } else {
    console.log(`  ⚠️  ${label} (空响应)`)
  }
}

async function main() {
  // ── 登录 ──────────────────────────────────────────────────────────────────
  console.log('\n=== 登录 ===')
  const loginRes = await api('POST', '/auth/login', {
    username: 'admin', password: 'Admin@123456', tenantCode: 'DEFAULT'
  })
  TOKEN = loginRes?.accessToken
  if (!TOKEN) { console.error('❌ 登录失败'); process.exit(1) }
  console.log('  ✅ 登录成功')

  const TID = 'DEFAULT'

  // ── PLM ───────────────────────────────────────────────────────────────────
  console.log('\n=== PLM 模块 ===')

  // 物料分类
  const cat1 = await api('POST', `/plm/materials/categories?tenantId=${TID}`, {
    code: 'RAW', name: '原材料', level: 1
  })
  ok('物料分类-原材料', cat1)

  const cat2 = await api('POST', `/plm/materials/categories?tenantId=${TID}`, {
    code: 'SEMI', name: '半成品', level: 1
  })
  ok('物料分类-半成品', cat2)

  const cat3 = await api('POST', `/plm/materials/categories?tenantId=${TID}`, {
    code: 'FG', name: '成品', level: 1
  })
  ok('物料分类-成品', cat3)

  // 物料
  const mat1 = await api('POST', `/plm/materials`, {
    tenantId: TID, code: 'MAT-002', name: '铝合金型材6061', type: 'RAW', uomId: '1', status: 'ACTIVE'
  })
  ok('物料-铝合金型材', mat1)

  const mat2 = await api('POST', `/plm/materials`, {
    tenantId: TID, code: 'MAT-003', name: '精密轴承6205', type: 'RAW', uomId: '2', status: 'ACTIVE'
  })
  ok('物料-精密轴承', mat2)

  const mat3 = await api('POST', `/plm/materials`, {
    tenantId: TID, code: 'FG-001', name: '精密加工件A型', type: 'FINISHED', uomId: '2', status: 'ACTIVE'
  })
  ok('物料-成品', mat3)

  // 查询物料列表获取ID
  const mats = await api('GET', `/plm/materials?tenantId=${TID}`)
  const matId = mats?.items?.[0]?.id || '1'
  console.log(`  📌 使用物料ID: ${matId}`)

  // BOM
  const bom = await api('POST', `/plm/boms`, {
    tenantId: TID,
    bom: { materialId: matId, version: 'V1.0', status: 'ACTIVE', effectiveDate: '2026-01-01' },
    lines: [
      { materialId: '2', quantity: 2, uomId: '1', lossRate: 0.02 },
      { materialId: '3', quantity: 4, uomId: '2', lossRate: 0.01 },
    ]
  })
  ok('BOM创建', bom)

  // 工艺路线
  const routing = await api('POST', `/plm/routings`, {
    tenantId: TID,
    routing: { code: 'RT-001', name: '标准加工路线', materialId: matId, status: 'ACTIVE' },
    operations: [
      { seqNo: 10, name: '粗加工', standardTime: 60, setupTime: 15 },
      { seqNo: 20, name: '精加工', standardTime: 90, setupTime: 20 },
      { seqNo: 30, name: '质检', standardTime: 30, setupTime: 5 },
    ]
  })
  ok('工艺路线创建', routing)

  // ── SCM ───────────────────────────────────────────────────────────────────
  console.log('\n=== SCM 模块 ===')

  const sup2 = await api('POST', `/scm/suppliers?tenantId=${TID}`, {
    code: 'SUP-002', name: '南方铝业集团', type: 'QUALIFIED',
    contactName: '李经理', contactPhone: '13800002001', region: '华南'
  })
  ok('供应商-南方铝业', sup2)

  const sup3 = await api('POST', `/scm/suppliers?tenantId=${TID}`, {
    code: 'SUP-003', name: '天津轴承制造有限公司', type: 'PREFERRED',
    contactName: '王总', contactPhone: '13800003001', region: '华北'
  })
  ok('供应商-天津轴承', sup3)

  // 采购订单
  const po = await api('POST', `/scm/purchase-orders?tenantId=${TID}`, {
    data: {
      supplierId: '1', currency: 'CNY',
      orderDate: '2026-04-17', expectedDate: '2026-05-10'
    },
    lines: [{ lineNo: 1, materialId: matId, quantity: 500, unitPrice: 45.5, uomId: '1' }]
  })
  ok('采购订单创建', po)

  // ── ERP ───────────────────────────────────────────────────────────────────
  console.log('\n=== ERP 模块 ===')

  const cus2 = await api('POST', `/erp/customers?tenantId=${TID}`, {
    code: 'CUS-002', name: '北京航空精密有限公司', type: 'KEY',
    creditLimit: 800000, contactName: '张总', contactPhone: '13900002001'
  })
  ok('客户-北京航空', cus2)

  const cus3 = await api('POST', `/erp/customers?tenantId=${TID}`, {
    code: 'CUS-003', name: '广州汽车零部件有限公司', type: 'GENERAL',
    creditLimit: 300000, contactName: '陈经理', contactPhone: '13900003001'
  })
  ok('客户-广州汽车', cus3)

  // 销售订单
  const so = await api('POST', `/erp/sales-orders?tenantId=${TID}`, {
    data: {
      customerId: '1', currency: 'CNY',
      orderDate: '2026-04-17', deliveryDate: '2026-05-20'
    },
    lines: [{ lineNo: 1, materialId: matId, quantity: 100, unitPrice: 180, uomId: '2', amount: 18000 }]
  })
  ok('销售订单创建', so)

  // ── EAM ───────────────────────────────────────────────────────────────────
  console.log('\n=== EAM 模块 ===')

  const eq2 = await api('POST', `/eam/equipment`, {
    tenantId: TID, equipmentCode: 'EQ-002', equipmentName: '数控车床CNC-002',
    equipmentType: 'MACHINE', category: 'PROCESSING', status: 'RUNNING',
    model: 'CK6150', manufacturer: '沈阳机床'
  })
  ok('设备-数控车床', eq2)

  const eq3 = await api('POST', `/eam/equipment`, {
    tenantId: TID, equipmentCode: 'EQ-003', equipmentName: '三坐标测量机CMM-001',
    equipmentType: 'INSPECTION', category: 'QUALITY', status: 'IDLE',
    model: 'CONTURA', manufacturer: '蔡司'
  })
  ok('设备-三坐标测量机', eq3)

  // 维保策略
  const strategy = await api('POST', `/eam/maintenance/strategies`, {
    tenantId: TID, equipmentId: '1',
    strategyCode: 'STR-001', strategyName: '月度预防性维保',
    strategyType: 'PERIODIC', triggerType: 'CALENDAR',
    intervalDays: 30, advanceNoticeDays: 3, isActive: 1
  })
  ok('维保策略创建', strategy)

  // ── MES ───────────────────────────────────────────────────────────────────
  console.log('\n=== MES 模块 ===')

  const wo2 = await api('POST', `/mes/work-orders`, {
    materialId: matId, uomId: '2', plannedQty: 50,
    plannedStart: '2026-04-20', plannedEnd: '2026-04-28'
  })
  ok('工单2创建', wo2)

  const wo3 = await api('POST', `/mes/work-orders`, {
    materialId: matId, uomId: '2', plannedQty: 200,
    plannedStart: '2026-04-25', plannedEnd: '2026-05-10'
  })
  ok('工单3创建', wo3)

  // ── QMS ───────────────────────────────────────────────────────────────────
  console.log('\n=== QMS 模块 ===')

  const std2 = await api('POST', `/qms/standards`, {
    code: 'STD-002', name: '铝合金型材来料检验标准',
    inspectionType: 'IQC', status: 'ACTIVE', version: 1,
    items: [
      { name: '外观检查', type: 'QUALITATIVE', method: '目视检查' },
      { name: '尺寸检查', type: 'NUMERIC', unit: 'mm', minValue: 99.5, maxValue: 100.5 },
    ]
  })
  ok('检验标准-铝合金', std2)

  // 不合格品
  const nc = await api('POST', `/qms/nonconformances`, {
    tenantId: TID, materialId: matId, defectType: 'DIMENSION',
    qty: 5, status: 'OPEN', description: '尺寸超差'
  })
  ok('不合格品记录', nc)

  // ── APS ───────────────────────────────────────────────────────────────────
  console.log('\n=== APS 模块 ===')

  const res2 = await api('POST', `/aps/resources?tenantId=${TID}`, {
    code: 'RES-002', name: '数控车床', type: 'MACHINE',
    status: 'AVAILABLE', capacity: 8, efficiency: 0.9
  })
  ok('资源-数控车床', res2)

  const res3 = await api('POST', `/aps/resources?tenantId=${TID}`, {
    code: 'RES-003', name: '质检工位', type: 'LABOR',
    status: 'AVAILABLE', capacity: 4, efficiency: 1.0
  })
  ok('资源-质检工位', res3)

  // 日历
  const cal = await api('POST', `/aps/calendars?tenantId=${TID}`, {
    resourceId: '1', workDate: '2026-04-18',
    startTime: '08:00:00', endTime: '17:00:00', isHoliday: 0, availableHours: 8
  })
  ok('日历条目创建', cal)

  // 优先级规则
  const rule = await api('POST', `/aps/priority-rules?tenantId=${TID}`, {
    name: '交期优先', ruleType: 'DELIVERY_DATE', weight: 0.6, isActive: 1
  })
  ok('优先级规则创建', rule)

  // ── WMS ───────────────────────────────────────────────────────────────────
  console.log('\n=== WMS 模块 ===')

  const wh2 = await api('POST', `/wms/warehouses?tenantId=${TID}`, {
    code: 'WH-002', name: '成品仓库', type: 'PHYSICAL', status: 'ACTIVE'
  })
  ok('仓库-成品仓库', wh2)

  const ss = await api('POST', `/wms/safety-stocks?tenantId=${TID}`, {
    materialId: matId, warehouseId: '1', safetyQty: 100, uomId: '2', alertEnabled: 1
  })
  ok('安全库存设置', ss)

  // ── SYS ───────────────────────────────────────────────────────────────────
  console.log('\n=== SYS 模块 ===')

  const users = await api('GET', `/sys/users?tenantId=${TID}`)
  if (users && (users.items || users.list || users.total >= 0)) {
    console.log(`  ✅ 用户列表 (${users.total} 条)`)
  } else {
    console.log(`  ⚠️  用户列表 (空响应)`)
  }

  const roles = await api('GET', `/sys/roles?tenantId=${TID}`)
  ok('角色列表', roles)

  console.log('\n=== 测试数据初始化完成 ===\n')
}

main().catch(err => {
  console.error('❌ 脚本执行失败:', err.message)
  process.exit(1)
})
