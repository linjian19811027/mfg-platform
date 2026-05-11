/**
 * 完整测试数据初始化脚本 v2
 * 运行方式：node scripts/init-test-data-full.mjs
 * 在 backend 目录下执行
 */

const BASE_URL = 'http://localhost:3000/api/v1'
let TOKEN = ''

async function login() {
  const resp = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456', tenantCode: 'DEFAULT' })
  })
  const data = await resp.json()
  TOKEN = data.data?.accessToken
  console.log(`[登录成功] Token: ${TOKEN.substring(0, 30)}...`)
  return TOKEN
}

async function post(path, data) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
      'X-Tenant-Id': 'DEFAULT'
    },
    body: JSON.stringify(data)
  })
  const result = await resp.json()
  if (result.code !== 200) {
    console.log(`  [警告] ${path}: ${result.message}`)
    return null
  }
  return result.data
}

async function get(path) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'X-Tenant-Id': 'DEFAULT'
    }
  })
  const result = await resp.json()
  return result.data
}

// 批量创建
async function batchCreate(name, path, template, count, idField = 'id') {
  console.log(`\n=== 创建${name} (${count}个) ===`)
  const ids = []
  for (let i = 1; i <= count; i++) {
    const data = template(i)
    const result = await post(path, data)
    if (result) {
      ids.push({ id: result[idField], code: result.code || result.woNo || result.name, data: result })
      if (i <= 3 || i === count) {
        console.log(`  ${name}${i}: id=${result[idField]}`)
      }
    }
  }
  console.log(`  ... 共创建 ${ids.length} 个${name}`)
  return ids
}

async function main() {
  await login()

  const created = {
    uoms: [],
    warehouses: [],
    suppliers: [],
    customers: [],
    resources: [],
    employees: [],
    materials: [],
    boms: [],
    routings: [],
    workOrders: []
  }

  // 1. UOM 计量单位
  created.uoms = await batchCreate('UOM', '/base/uoms', (i) => ({
    code: `UOM${i}`,
    name: `Unit ${i}`,
    status: 'ACTIVE'
  }), 10)

  // 2. 仓库
  created.warehouses = await batchCreate('Warehouse', '/wms/warehouses', (i) => ({
    code: `WH${String(i).padStart(2, '0')}`,
    name: `Warehouse ${i}`,
    status: 'ACTIVE'
  }), 5)

  // 3. 供应商
  created.suppliers = await batchCreate('Supplier', '/scm/suppliers', (i) => ({
    code: `SUP${String(i).padStart(3, '0')}`,
    name: `Supplier ${i}`,
    status: 'ACTIVE'
  }), 10)

  // 4. 客户
  created.customers = await batchCreate('Customer', '/erp/customers', (i) => ({
    code: `CUST${String(i).padStart(3, '0')}`,
    name: `Customer ${i}`,
    status: 'ACTIVE'
  }), 10)

  // 5. APS资源
  created.resources = await batchCreate('Resource', '/aps/resources', (i) => ({
    code: `RES${String(i).padStart(3, '0')}`,
    name: `Resource ${i}`,
    type: i <= 10 ? 'MACHINE' : 'LABOR',
    status: 'AVAILABLE'
  }), 20)

  // 6. 物料
  created.materials = await batchCreate('Material', '/plm/materials', (i) => {
    const types = ['RAW', 'SEMI', 'FINISHED']
    return {
      code: `MAT${String(i).padStart(5, '0')}`,
      name: `Material ${i}`,
      type: types[i % 3],
      uomId: created.uoms[i % created.uoms.length]?.id || '1',
      status: 'ACTIVE'
    }
  }, 30)

  // 7. BOM (为物料创建BOM)
  console.log(`\n=== 创建BOM (20个) ===`)
  for (let i = 1; i <= 20 && i < created.materials.length; i++) {
    const material = created.materials[i - 1]
    const lines = []
    // 每个BOM有2-3个子物料行
    for (let j = 0; j < 3; j++) {
      const childMaterial = created.materials[(i + j) % created.materials.length]
      if (childMaterial && childMaterial.id !== material.id) {
        lines.push({
          materialId: childMaterial.id,
          quantity: Math.floor(Math.random() * 5) + 1
        })
      }
    }
    const result = await post('/plm/boms', { bom: { materialId: material.id }, lines })
    if (result) {
      created.boms.push({ id: result.id, materialId: material.id })
      if (i <= 3 || i === 20) console.log(`  BOM${i}: id=${result.id} for Material ${i}`)
    }
  }
  console.log(`  ... 共创建 ${created.boms.length} 个BOM`)

  // 8. 工艺路线
  console.log(`\n=== 创建工艺路线 (20个) ===`)
  for (let i = 1; i <= 20 && i < created.materials.length; i++) {
    const material = created.materials[i - 1]
    const lines = []
    for (let j = 1; j <= 3; j++) {
      const resource = created.resources[(i + j) % created.resources.length]
      lines.push({
        sequence: j,
        name: `Step ${j} of ${material.code}`,
        workCenterId: null,
        standardHours: Math.floor(Math.random() * 4) + 1
      })
    }
    const result = await post('/plm/routings', { routing: { materialId: material.id }, lines })
    if (result) {
      created.routings.push({ id: result.id, materialId: material.id })
      if (i <= 3 || i === 20) console.log(`  Routing${i}: id=${result.id} for Material ${i}`)
    }
  }
  console.log(`  ... 共创建 ${created.routings.length} 个工艺路线`)

  // 9. MES工单
  console.log(`\n=== 创建MES工单 (10个) ===`)
  for (let i = 1; i <= 10; i++) {
    const material = created.materials[(i - 1) % created.materials.length]
    const bom = created.boms[(i - 1) % created.boms.length]
    const routing = created.routings[(i - 1) % created.routings.length]
    const result = await post('/mes/work-orders', {
      woNo: `WO-${String(i).padStart(5, '0')}`,
      woType: 'STANDARD',
      materialId: material?.id || '1',
      bomId: bom?.id,
      routingId: routing?.id,
      plannedQty: Math.floor(Math.random() * 100) + 50,
      uomId: created.uoms[0]?.id || '1',
      priority: Math.floor(Math.random() * 10) + 1,
      bomLevel: 0,
      isCritical: i <= 3, // 前3个是关键工单
      status: 'RELEASED'
    })
    if (result) {
      created.workOrders.push({ id: result.id, woNo: result.woNo })
      if (i <= 3 || i === 10) console.log(`  WO${i}: id=${result.id} woNo=${result.woNo}`)
    }
  }
  console.log(`  ... 共创建 ${created.workOrders.length} 个工单`)

  // 10. QMS检验标准
  console.log(`\n=== 创建QMS检验标准 (5个) ===`)
  for (let i = 1; i <= 5; i++) {
    const result = await post('/qms/standards', {
      code: `QCS${String(i).padStart(3, '0')}`,
      name: `QC Standard ${i}`,
      status: 'ACTIVE'
    })
    if (result && i <= 3) console.log(`  QC Standard ${i}: id=${result.id}`)
  }

  // 保存结果
  const fs = await import('fs')
  const outputPath = new URL('.', import.meta.url).pathname + 'test-data-ids.json'
  fs.writeFileSync(outputPath, JSON.stringify(created, null, 2))
  console.log(`\n=== 数据ID映射已保存到 test-data-ids.json ===`)

  console.log('\n========================================')
  console.log('🎉 基础数据初始化完成!')
  console.log(`  UOM: ${created.uoms.length} 个`)
  console.log(`  Warehouse: ${created.warehouses.length} 个`)
  console.log(`  Supplier: ${created.suppliers.length} 个`)
  console.log(`  Customer: ${created.customers.length} 个`)
  console.log(`  Resource: ${created.resources.length} 个`)
  console.log(`  Material: ${created.materials.length} 个`)
  console.log(`  BOM: ${created.boms.length} 个`)
  console.log(`  Routing: ${created.routings.length} 个`)
  console.log(`  WorkOrder: ${created.workOrders.length} 个`)
  console.log('========================================\n')
}

main().catch(console.error)
