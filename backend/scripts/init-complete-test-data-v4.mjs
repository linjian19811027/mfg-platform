/**
 * 完整基础测试数据初始化脚本 v4
 * 修复了：
 * 1. Equipment 必填字段：equipmentName, category
 * 2. QMS 必填字段：items 数组, inspectionType
 * 3. HR 路径：/hr/employees
 *
 * 运行：node scripts/init-complete-test-data-v4.mjs
 */

const BASE_URL = 'http://localhost:3000'
let TOKEN = ''
let created = {}

async function login() {
  const resp = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456', tenantCode: 'DEFAULT' })
  })
  const data = await resp.json()
  TOKEN = data.data?.accessToken
  console.log(`[登录成功]`)
}

const api = (prefix) => ({
  headers: () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
    'X-Tenant-Id': 'DEFAULT'
  }),
  post: async (path, data) => {
    const resp = await fetch(`${BASE_URL}${prefix}${path}`, {
      method: 'POST',
      headers: api().headers(),
      body: JSON.stringify(data)
    })
    const result = await resp.json()
    if (result.code !== 200) {
      console.log(`  [失败] ${result.message || result.errorCode}`)
      return null
    }
    return result.data
  }
})

const api1 = api('/api/v1')
const apiHr = api('/hr')

async function batchCreate(name, prefix, path, template, count, idKey = 'id') {
  console.log(`\n=== 创建${name} (${count}个) ===`)
  const ids = []
  for (let i = 1; i <= count; i++) {
    const data = template(i)
    const result = await (prefix === '/hr' ? apiHr : api1).post(path, data)
    if (result && result[idKey]) {
      ids.push({ id: result[idKey], code: result.code || result.woNo || result.equipmentCode || result[idKey] })
      if (i <= 3) console.log(`  ${name}${i}: id=${result[idKey]}`)
    }
  }
  console.log(`  [${name}] 成功 ${ids.length} 个`)
  return ids
}

async function main() {
  console.log('========================================')
  console.log('MFG Platform 基础数据初始化 v4')
  console.log('========================================')

  await login()

  // 1. UOM
  created.uoms = await batchCreate('UOM', '/api/v1', '/base/uoms', (i) => ({
    code: `UOM${String(i).padStart(3, '0')}`,
    name: `Unit ${i}`,
    status: 'ACTIVE'
  }), 10)

  // 2. 仓库
  created.warehouses = await batchCreate('Warehouse', '/api/v1', '/wms/warehouses', (i) => ({
    code: `WH${String(i).padStart(3, '0')}`,
    name: `Warehouse ${i}`,
    status: 'ACTIVE'
  }), 5)

  // 3. 供应商 (已有)
  created.suppliers = await batchCreate('Supplier', '/api/v1', '/scm/suppliers', (i) => ({
    code: `SUP${String(i).padStart(3, '0')}`,
    name: `Supplier ${i}`,
    status: 'ACTIVE'
  }), 5)

  // 4. 客户 (已有)
  created.customers = await batchCreate('Customer', '/api/v1', '/erp/customers', (i) => ({
    code: `CUST${String(i).padStart(3, '0')}`,
    name: `Customer ${i}`,
    status: 'ACTIVE'
  }), 5)

  // 5. APS资源 (已有)
  created.resources = await batchCreate('Resource', '/api/v1', '/aps/resources', (i) => ({
    code: `RES${String(i).padStart(3, '0')}`,
    name: `Resource ${i}`,
    type: i <= 10 ? 'MACHINE' : 'LABOR',
    status: 'AVAILABLE'
  }), 10)

  // 6. 物料 (已有)
  created.materials = await batchCreate('Material', '/api/v1', '/plm/materials', (i) => {
    const types = ['RAW', 'SEMI', 'FINISHED']
    return {
      code: `MAT${String(i + 100).padStart(5, '0')}`,
      name: `Material ${i + 100}`,
      type: types[i % 3],
      uomId: created.uoms[i % created.uoms.length]?.id || '1',
      status: 'ACTIVE'
    }
  }, 10)

  // 7. BOM
  console.log('\n=== 创建BOM (10个) ===')
  created.boms = []
  for (let i = 1; i <= 10 && i <= created.materials.length; i++) {
    const material = created.materials[i - 1]
    const lines = []
    for (let j = 0; j < 2; j++) {
      const child = created.materials[(i + j) % created.materials.length]
      if (child && child.id !== material.id) {
        lines.push({ materialId: child.id, quantity: Math.floor(Math.random() * 3) + 1 })
      }
    }
    const result = await api1.post('/plm/boms', { bom: { materialId: material.id }, lines })
    if (result) {
      created.boms.push({ id: result.id, materialId: material.id })
      if (i <= 3) console.log(`  BOM${i}: id=${result.id}`)
    }
  }
  console.log(`  [BOM] 成功 ${created.boms.length} 个`)

  // 8. 工艺路线
  console.log('\n=== 创建工艺路线 (10个) ===')
  created.routings = []
  for (let i = 1; i <= 10 && i <= created.materials.length; i++) {
    const material = created.materials[i - 1]
    const lines = []
    for (let j = 1; j <= 3; j++) {
      lines.push({
        sequence: j,
        name: `Step ${j}`,
        workCenterId: null,
        standardHours: Math.floor(Math.random() * 4) + 1
      })
    }
    const result = await api1.post('/plm/routings', { routing: { materialId: material.id }, lines })
    if (result) {
      created.routings.push({ id: result.id, materialId: material.id })
      if (i <= 3) console.log(`  Routing${i}: id=${result.id}`)
    }
  }
  console.log(`  [工艺路线] 成功 ${created.routings.length} 个`)

  // 9. 设备 (EAM) - 修复必填字段
  created.equipment = await batchCreate('Equipment', '/api/v1', '/eam/equipment', (i) => ({
    equipmentCode: `EQ${String(i).padStart(3, '0')}`,
    equipmentName: `Equipment ${i}`,
    equipmentType: i <= 10 ? 'CNC' : 'Assembly',
    category: i <= 10 ? 'Machining' : 'Assembly',
    status: 'IDLE'
  }), 10)

  // 10. 员工 (HR) - 路径是 /hr/employees
  created.employees = await batchCreate('Employee', '/hr', '/employees', (i) => ({
    code: `EMP${String(i).padStart(3, '0')}`,
    name: `Employee ${i}`,
    status: 'ACTIVE'
  }), 10)

  // 11. MES工单
  console.log('\n=== 创建MES工单 (10个) ===')
  created.workOrders = []
  for (let i = 1; i <= 10; i++) {
    const material = created.materials[(i - 1) % created.materials.length]
    const bom = created.boms[(i - 1) % created.boms.length]
    const routing = created.routings[(i - 1) % created.routings.length]
    const uom = created.uoms[0]

    const result = await api1.post('/mes/work-orders', {
      woNo: `WO-T${String(i).padStart(4, '0')}`,
      woType: 'STANDARD',
      materialId: material?.id,
      bomId: bom?.id,
      routingId: routing?.id,
      plannedQty: Math.floor(Math.random() * 100) + 50,
      uomId: uom?.id,
      priority: (i % 10) + 1,
      bomLevel: 0,
      isCritical: i <= 3,
      status: 'RELEASED'
    })
    if (result) {
      created.workOrders.push({ id: result.id, woNo: result.woNo })
      if (i <= 3) console.log(`  WO${i}: id=${result.id} woNo=${result.woNo}`)
    }
  }
  console.log(`  [MES工单] 成功 ${created.workOrders.length} 个`)

  // 12. QMS检验标准 - 修复必填字段
  created.qmsStandards = await batchCreate('QCStandard', '/api/v1', '/qms/standards', (i) => ({
    code: `QCS${String(i).padStart(3, '0')}`,
    name: `QC Standard ${i}`,
    inspectionType: i <= 3 ? 'IQC' : 'FQC',
    items: [],
    status: 'ACTIVE',
    version: 1
  }), 5)

  // 保存
  const fs = await import('fs')
  fs.writeFileSync('./test-data-ids-v4.json', JSON.stringify(created, null, 2))
  console.log(`\n=== ID映射已保存到 test-data-ids-v4.json ===`)

  console.log('\n========================================')
  console.log('结果汇总')
  console.log('========================================')
  console.log(`  UOM: ${created.uoms?.length || 0} 个`)
  console.log(`  Warehouse: ${created.warehouses?.length || 0} 个`)
  console.log(`  Supplier: ${created.suppliers?.length || 0} 个`)
  console.log(`  Customer: ${created.customers?.length || 0} 个`)
  console.log(`  Resource: ${created.resources?.length || 0} 个`)
  console.log(`  Material: ${created.materials?.length || 0} 个`)
  console.log(`  BOM: ${created.boms?.length || 0} 个`)
  console.log(`  Routing: ${created.routings?.length || 0} 个`)
  console.log(`  Equipment: ${created.equipment?.length || 0} 个`)
  console.log(`  Employee: ${created.employees?.length || 0} 个`)
  console.log(`  WorkOrder: ${created.workOrders?.length || 0} 个`)
  console.log(`  QCStandard: ${created.qmsStandards?.length || 0} 个`)
  console.log('========================================\n')
}

main().catch(err => {
  console.error('❌ 失败:', err.message)
  process.exit(1)
})
