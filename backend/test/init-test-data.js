/**
 * MFG Platform 完整测试数据初始化脚本
 * 目的: 为状态机测试准备完整的业务数据
 *
 * 运行方式: node test/init-test-data.js
 */
const BASE_URL = 'http://localhost:3000'
const API = BASE_URL + '/api/v1'
const HR = BASE_URL + '/hr'

// Global token cache - reuse token to avoid rate limiting
let cachedToken = null
let tokenExpiry = 0

async function login() {
  // Reuse token for 10 minutes to avoid rate limiting
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken
  }

  const r = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456', tenantCode: 'DEFAULT' })
  }).then(r => r.json())
  if (!r.data?.accessToken) {
    throw new Error('Login failed: ' + JSON.stringify(r))
  }
  cachedToken = r.data.accessToken
  tokenExpiry = Date.now() + 600000 // 10 minutes
  return cachedToken
}

async function apiRequest(method, path, body = null) {
  const t = await login()
  const h = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${t}`,
    'X-Tenant-Id': 'DEFAULT'
  }
  const opts = { method, headers: h }
  if (body) opts.body = JSON.stringify(body)
  const resp = await fetch(path, opts)
  return { status: resp.status, body: await resp.json().catch(() => ({})) }
}

const post = (path, body) => apiRequest('POST', path, body)
const get = (path) => apiRequest('GET', path)
const patch = (path, body) => apiRequest('PATCH', path, body)
const del = (path) => apiRequest('DELETE', path)

// 状态机测试数据存储
const testData = {
  materials: [],      // 物料列表
  routings: [],       // 工艺路线(ACTIVE状态)
  workOrders: [],     // 工单(按状态分类)
  operations: [],     // 工序
  warehouses: [],     // 仓库
  customers: [],      // 客户
  suppliers: [],      // 供应商
  employees: [],      // 员工
  resources: [],     // APS资源
  bom: null,          // BOM
}

async function initMaterials() {
  console.log('\n📦 初始化物料...')
  // 创建测试用物料
  const materials = []
  for (let i = 0; i < 3; i++) {
    const ts = Date.now() + i
    const resp = await post(API + '/plm/materials', {
      code: `MAT_TEST_${ts}`,
      name: `测试物料_${ts}`,
      type: 'RAW',
      uomId: '1'
    })
    if (resp.status === 200 || resp.status === 201) {
      materials.push(resp.body.data)
      console.log(`  ✅ 创建物料: ${resp.body.data.code}`)
    } else {
      console.log(`  ⚠️ 创建物料失败: ${resp.body.message}`)
    }
  }
  testData.materials = materials
  return materials
}

async function initRoutings() {
  console.log('\n🔧 初始化工艺路线...')
  // 创建工艺路线并激活
  const routings = []
  for (let i = 0; i < 3; i++) {
    const ts = Date.now() + i
    // 1. 创建物料
    const matResp = await post(API + '/plm/materials', {
      code: `MAT_RT_${ts}`,
      name: `工艺测试物料_${ts}`,
      type: 'FINISHED',
      uomId: '1'
    })
    if (matResp.status !== 200 && matResp.status !== 201) {
      console.log(`  ⚠️ 创建物料失败`)
      continue
    }
    const materialId = matResp.body.data?.id
    console.log(`  ✅ 创建物料: ${matResp.body.data?.code}`)

    // 2. 创建工艺路线(草稿状态)
    const rtResp = await post(API + '/plm/routings', {
      materialId: materialId,
      name: `测试工艺路线_${ts}`
    })
    if (rtResp.status !== 200 && rtResp.status !== 201) {
      console.log(`  ⚠️ 创建工艺路线失败`)
      continue
    }
    const routingId = rtResp.body.data?.id
    console.log(`  ✅ 创建工艺路线: ${routingId}`)

    // 3. 激活工艺路线
    const actResp = await post(API + `/plm/routings/${routingId}/activate`, {})
    if (actResp.status === 200 || actResp.status === 201) {
      console.log(`  ✅ 激活工艺路线: ${routingId}`)
      routings.push({ ...rtResp.body.data, id: routingId, status: 'ACTIVE' })
    } else {
      console.log(`  ⚠️ 激活工艺路线失败: ${actResp.body.message}`)
      routings.push({ ...rtResp.body.data, id: routingId })
    }
  }
  testData.routings = routings
  return routings
}

async function initWorkOrders() {
  console.log('\n📋 初始化工单(按状态分类)...')

  // 创建RELEASED状态工单 - 用于状态机测试
  const releasedWos = []
  for (let i = 0; i < 5; i++) {
    const ts = Date.now() + i
    const material = testData.materials[i % testData.materials.length] || { id: '1' }
    const routing = testData.routings[i % testData.routings.length]

    const resp = await post(API + '/mes/work-orders', {
      woNo: `WO_RELEASED_${ts}`,
      woType: 'STANDARD',
      materialId: material.id,
      plannedQty: 100,
      uomId: '1',
      routingId: routing?.id || null,
      status: 'RELEASED'
    })
    if (resp.status === 200 || resp.status === 201) {
      releasedWos.push(resp.body.data)
      console.log(`  ✅ RELEASED工单: ${resp.body.data.woNo}`)
    } else {
      console.log(`  ⚠️ 创建RELEASED工单失败`)
    }
  }
  testData.workOrders.released = releasedWos

  // 创建IN_PROGRESS状态工单 - 需要先开工
  const inProgressWos = []
  for (let i = 0; i < 3; i++) {
    const ts = Date.now() + 100 + i
    const material = testData.materials[i % testData.materials.length] || { id: '1' }

    // 先创建RELEASED工单
    const woResp = await post(API + '/mes/work-orders', {
      woNo: `WO_IP_${ts}`,
      woType: 'STANDARD',
      materialId: material.id,
      plannedQty: 100,
      uomId: '1',
      status: 'RELEASED'
    })
    if (woResp.status !== 200 && woResp.status !== 201) continue

    const woId = woResp.body.data?.id

    // 开工转为IN_PROGRESS
    const startResp = await patch(API + `/mes/work-orders/${woId}/status`, { status: 'IN_PROGRESS' })
    if (startResp.status === 200 || startResp.status === 201) {
      inProgressWos.push({ ...woResp.body.data, status: 'IN_PROGRESS' })
      console.log(`  ✅ IN_PROGRESS工单: ${woResp.body.data.woNo}`)
    } else {
      console.log(`  ⚠️ 开工失败，继续使用RELEASED状态`)
      inProgressWos.push(woResp.body.data)
    }
  }
  testData.workOrders.inProgress = inProgressWos

  // 创建COMPLETED状态工单
  const completedWos = []
  for (let i = 0; i < 3; i++) {
    const ts = Date.now() + 200 + i
    const material = testData.materials[i % testData.materials.length] || { id: '1' }

    // 创建工单
    const woResp = await post(API + '/mes/work-orders', {
      woNo: `WO_COMP_${ts}`,
      woType: 'STANDARD',
      materialId: material.id,
      plannedQty: 100,
      uomId: '1',
      status: 'RELEASED'
    })
    if (woResp.status !== 200 && woResp.status !== 201) continue

    const woId = woResp.body.data?.id

    // 开工
    await patch(API + `/mes/work-orders/${woId}/status`, { status: 'IN_PROGRESS' })

    // 完工
    const compResp = await patch(API + `/mes/work-orders/${woId}/status`, { status: 'COMPLETED' })
    if (compResp.status === 200 || compResp.status === 201) {
      completedWos.push({ ...woResp.body.data, status: 'COMPLETED' })
      console.log(`  ✅ COMPLETED工单: ${woResp.body.data.woNo}`)
    } else {
      console.log(`  ⚠️ 完工失败`)
    }
  }
  testData.workOrders.completed = completedWos

  return testData.workOrders
}

async function initWarehouseData() {
  console.log('\n🏭 初始化仓库和库存...')
  const resp = await get(API + '/wms/warehouses')
  if (resp.status === 200) {
    testData.warehouses = resp.body.data?.list || resp.body.data?.items || []
    console.log(`  ✅ 获取仓库: ${testData.warehouses.length}个`)
  }
  return testData.warehouses
}

async function initOtherData() {
  console.log('\n📊 初始化其他业务数据...')

  // 客户
  const custResp = await get(API + '/erp/customers')
  if (custResp.status === 200) {
    testData.customers = custResp.body.data?.list || custResp.body.data?.items || []
    console.log(`  ✅ 客户: ${testData.customers.length}个`)
  }

  // 供应商
  const supResp = await get(API + '/scm/suppliers')
  if (supResp.status === 200) {
    testData.suppliers = supResp.body.data?.list || supResp.body.data?.items || []
    console.log(`  ✅ 供应商: ${testData.suppliers.length}个`)
  }

  // 员工
  const empResp = await get(HR + '/employees')
  if (empResp.status === 200) {
    testData.employees = empResp.body.data?.list || empResp.body.data?.items || []
    console.log(`  ✅ 员工: ${testData.employees.length}个`)
  }

  // APS资源
  const resResp = await get(API + '/aps/resources')
  if (resResp.status === 200) {
    testData.resources = resResp.body.data?.list || resResp.body.data?.items || []
    console.log(`  ✅ APS资源: ${testData.resources.length}个`)
  }
}

async function saveTestData() {
  console.log('\n💾 保存测试数据到文件...')
  const fs = await import('fs')
  const data = {
    timestamp: new Date().toISOString(),
    materials: testData.materials.map(m => ({ id: m.id, code: m.code, name: m.name })),
    routings: testData.routings.map(r => ({ id: r.id, name: r.name, status: r.status })),
    workOrders: {
      released: testData.workOrders.released.map(w => ({ id: w.id, woNo: w.woNo, status: w.status })),
      inProgress: testData.workOrders.inProgress.map(w => ({ id: w.id, woNo: w.woNo, status: w.status })),
      completed: testData.workOrders.completed.map(w => ({ id: w.id, woNo: w.woNo, status: w.status }))
    },
    warehouses: testData.warehouses.map(w => ({ id: w.id, code: w.code, name: w.name })),
    customers: testData.customers.map(c => ({ id: c.id, code: c.code, name: c.name })),
    suppliers: testData.suppliers.map(s => ({ id: s.id, code: s.code, name: s.name })),
    employees: testData.employees.map(e => ({ id: e.id, code: e.code, name: e.name })),
    resources: testData.resources.map(r => ({ id: r.id, code: r.code, name: r.name }))
  }

  fs.writeFileSync('./test/test-data.json', JSON.stringify(data, null, 2))
  console.log('  ✅ 测试数据已保存到 test/test-data.json')
}

async function main() {
  console.log('========================================')
  console.log('MFG Platform 完整测试数据初始化')
  console.log('========================================')

  try {
    // 1. 初始化基础数据
    await initMaterials()
    await initRoutings()
    await initOtherData()

    // 2. 初始化仓库数据
    await initWarehouseData()

    // 3. 初始化工单(按状态分类)
    await initWorkOrders()

    // 4. 保存测试数据
    await saveTestData()

    console.log('\n========================================')
    console.log('✅ 测试数据初始化完成!')
    console.log('========================================')
    console.log('\n工单状态分布:')
    console.log(`  RELEASED: ${testData.workOrders.released?.length || 0}个`)
    console.log(`  IN_PROGRESS: ${testData.workOrders.inProgress?.length || 0}个`)
    console.log(`  COMPLETED: ${testData.workOrders.completed?.length || 0}个`)
    console.log('\n请使用这些ID进行状态机测试!')

  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message)
    process.exit(1)
  }
}

main()
