/**
 * 完整基础测试数据初始化脚本 v3
 * 功能：
 *   1. 按依赖顺序创建基础数据
 *   2. 记录每个API的必填字段
 *   3. 生成ID映射文件供后续测试使用
 *
 * 运行方式：node scripts/init-complete-test-data.mjs
 * 在 backend 目录下执行
 */

const BASE_URL = 'http://localhost:3000/api/v1'
let TOKEN = ''
let created = {}

// 登录
async function login() {
  const resp = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456', tenantCode: 'DEFAULT' })
  })
  const data = await resp.json()
  TOKEN = data.data?.accessToken
  console.log(`[登录成功]`)
}

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${TOKEN}`,
  'X-Tenant-Id': 'DEFAULT'
})

// POST请求
async function create(name, path, data) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data)
  })
  const result = await resp.json()
  if (result.code !== 200) {
    console.log(`  [${name} 创建失败] ${result.message || result.errorCode}`)
    return null
  }
  return result.data
}

// GET请求
async function getApi(path) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: headers()
  })
  const result = await resp.json()
  return result.code === 200 ? result.data : null
}

// 批量创建
async function batchCreate(name, path, template, count, idKey = 'id') {
  console.log(`\n=== 创建${name} (${count}个) ===`)
  const ids = []
  for (let i = 1; i <= count; i++) {
    const data = template(i)
    const result = await create(name, path, data)
    if (result && result[idKey]) {
      ids.push({ id: result[idKey], code: result.code || result.woNo || result.name || result[idKey] })
    }
  }
  console.log(`  [${name}] 成功创建 ${ids.length} 个`)
  return ids
}

// 主函数
async function main() {
  console.log('========================================')
  console.log('MFG Platform 基础测试数据初始化 v3')
  console.log('========================================')

  await login()

  // 1. 计量单位 (UOM) - 无依赖
  // 必填: code, name
  created.uoms = await batchCreate('UOM', '/base/uoms', (i) => ({
    code: `UOM${String(i).padStart(3, '0')}`,
    name: `Unit ${i}`,
    status: 'ACTIVE'
  }), 10)

  // 2. 仓库 (Warehouse) - 无依赖
  // 必填: code, name
  created.warehouses = await batchCreate('Warehouse', '/wms/warehouses', (i) => ({
    code: `WH${String(i).padStart(3, '0')}`,
    name: `Warehouse ${i}`,
    status: 'ACTIVE'
  }), 5)

  // 3. 供应商 (Supplier) - 无依赖
  // 必填: code, name
  created.suppliers = await batchCreate('Supplier', '/scm/suppliers', (i) => ({
    code: `SUP${String(i).padStart(3, '0')}`,
    name: `Supplier ${i}`,
    status: 'ACTIVE'
  }), 10)

  // 4. 客户 (Customer) - 无依赖
  // 必填: code, name
  created.customers = await batchCreate('Customer', '/erp/customers', (i) => ({
    code: `CUST${String(i).padStart(3, '0')}`,
    name: `Customer ${i}`,
    status: 'ACTIVE'
  }), 10)

  // 5. APS资源 (Resource) - 无依赖
  // 必填: code, name, type
  created.resources = await batchCreate('Resource', '/aps/resources', (i) => ({
    code: `RES${String(i).padStart(3, '0')}`,
    name: `Resource ${i}`,
    type: i <= 10 ? 'MACHINE' : 'LABOR',
    status: 'AVAILABLE'
  }), 20)

  // 6. 物料 (Material) - 依赖 UOM
  // 必填: code, name, type, uomId
  created.materials = await batchCreate('Material', '/plm/materials', (i) => {
    const types = ['RAW', 'SEMI', 'FINISHED']
    const uomId = created.uoms[(i - 1) % created.uoms.length]?.id || '1'
    return {
      code: `MAT${String(i).padStart(5, '0')}`,
      name: `Material ${i}`,
      type: types[(i - 1) % 3],
      uomId: uomId,
      status: 'ACTIVE'
    }
  }, 30)

  // 7. BOM - 依赖 Material
  // 必填: materialId (bom object)
  // lines: [{ materialId, quantity }]
  console.log('\n=== 创建BOM (20个) ===')
  created.boms = []
  for (let i = 1; i <= 20 && i <= created.materials.length; i++) {
    const material = created.materials[i - 1]
    const lines = []
    // BOM包含2-3个子物料
    for (let j = 0; j < 3; j++) {
      const childMaterial = created.materials[(i + j) % created.materials.length]
      if (childMaterial && childMaterial.id !== material.id) {
        lines.push({
          materialId: childMaterial.id,
          quantity: Math.floor(Math.random() * 5) + 1
        })
      }
    }
    const result = await create('BOM', '/plm/boms', {
      bom: { materialId: material.id },
      lines: lines
    })
    if (result) {
      created.boms.push({ id: result.id, materialId: material.id })
    }
  }
  console.log(`  [BOM] 成功创建 ${created.boms.length} 个`)

  // 8. 工艺路线 - 依赖 Material
  // 必填: materialId (routing object)
  // lines: [{ sequence, name, standardHours }]
  console.log('\n=== 创建工艺路线 (20个) ===')
  created.routings = []
  for (let i = 1; i <= 20 && i <= created.materials.length; i++) {
    const material = created.materials[i - 1]
    const lines = []
    for (let j = 1; j <= 3; j++) {
      const resource = created.resources[(i + j) % created.resources.length]
      lines.push({
        sequence: j,
        name: `Step ${j}`,
        workCenterId: null,
        standardHours: Math.floor(Math.random() * 4) + 1
      })
    }
    const result = await create('Routing', '/plm/routings', {
      routing: { materialId: material.id },
      lines: lines
    })
    if (result) {
      created.routings.push({ id: result.id, materialId: material.id })
    }
  }
  console.log(`  [工艺路线] 成功创建 ${created.routings.length} 个`)

  // 9. 设备 (Equipment) - 无依赖
  // 必填: equipmentCode, name, status
  created.equipment = await batchCreate('Equipment', '/eam/equipment', (i) => ({
    equipmentCode: `EQ${String(i).padStart(3, '0')}`,
    name: `Equipment ${i}`,
    status: 'IDLE'
  }), 20)

  // 10. 员工 (Employee) - 无依赖
  // 必填: code, name (empNo, name)
  created.employees = await batchCreate('Employee', '/hr/employees', (i) => ({
    code: `EMP${String(i).padStart(3, '0')}`,
    name: `Employee ${i}`,
    status: 'ACTIVE'
  }), 20)

  // 11. MES工单 - 依赖 Material, BOM, Routing, UOM
  // 必填: woNo, materialId, plannedQty, uomId
  // 可选: bomId, routingId, woType, priority, bomLevel, isCritical
  console.log('\n=== 创建MES工单 (20个) ===')
  created.workOrders = []
  for (let i = 1; i <= 20; i++) {
    const material = created.materials[(i - 1) % created.materials.length]
    const bom = created.boms[(i - 1) % created.boms.length]
    const routing = created.routings[(i - 1) % created.routings.length]
    const uom = created.uoms[(i - 1) % created.uoms.length]

    const result = await create('WorkOrder', '/mes/work-orders', {
      woNo: `WO${String(i).padStart(5, '0')}`,
      woType: 'STANDARD',
      materialId: material?.id || '1',
      bomId: bom?.id,
      routingId: routing?.id,
      plannedQty: Math.floor(Math.random() * 100) + 50,
      uomId: uom?.id || '1',
      priority: (i % 10) + 1,
      bomLevel: 0,
      isCritical: i <= 5, // 前5个是关键工单
      status: 'RELEASED'
    })
    if (result) {
      created.workOrders.push({ id: result.id, woNo: result.woNo })
    }
  }
  console.log(`  [MES工单] 成功创建 ${created.workOrders.length} 个`)

  // 12. QMS检验标准
  // 必填: code, name
  created.qmsStandards = await batchCreate('QCStandard', '/qms/standards', (i) => ({
    code: `QCS${String(i).padStart(3, '0')}`,
    name: `QC Standard ${i}`,
    status: 'ACTIVE'
  }), 5)

  // 保存ID映射
  const fs = await import('fs')
  const outputPath = './test-data-ids.json'
  fs.writeFileSync(outputPath, JSON.stringify(created, null, 2))
  console.log(`\n=== ID映射已保存到 ${outputPath} ===`)

  // 打印汇总
  console.log('\n========================================')
  console.log('🎉 初始化完成!')
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

  return created
}

main().catch(err => {
  console.error('❌ 初始化失败:', err.message)
  process.exit(1)
})
