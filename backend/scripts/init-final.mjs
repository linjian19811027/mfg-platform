/**
 * 完整基础测试数据初始化 v5 FINAL
 * 修复了所有必填字段问题
 * 运行：node scripts/init-final.mjs
 */

const BASE = 'http://localhost:3000'
const API = BASE + '/api/v1'
const HR = BASE + '/hr'

let token = ''

async function req(url, data, extraHeaders = {}) {
  const body = JSON.stringify(data)
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-Id': 'DEFAULT',
    ...extraHeaders
  }
  const resp = await fetch(url, { method: 'POST', headers, body })
  return resp.json()
}

async function login() {
  const r = await req(API + '/auth/login', { username: 'admin', password: 'Admin@123456', tenantCode: 'DEFAULT' })
  token = r.data.accessToken
  console.log('[登录成功]')
}

async function create(name, url, data) {
  const r = await req(url, data)
  if (r.code !== 200) {
    console.log(`  [${name}失败] ${r.message || r.errorCode}`)
    return null
  }
  return r.data
}

async function batch(name, url, template, n) {
  console.log(`\n== ${name} (${n}个) ==`)
  const ids = []
  for (let i = 1; i <= n; i++) {
    const d = template(i)
    const r = await create(name, url, d)
    if (r?.id) {
      ids.push(r.id)
      if (i <= 3) console.log(`  ${name}${i}: id=${r.id}`)
    }
  }
  console.log(`  [${name}] 成功 ${ids.length} 个`)
  return ids
}

async function main() {
  console.log('========================================')
  console.log('MFG Platform 基础数据初始化 v5 FINAL')
  console.log('========================================')

  await login()

  // UOM
  const uoms = await batch('UOM', API + '/base/uoms', i => ({
    code: `UOM${String(i).padStart(3,'0')}`,
    name: `Unit ${i}`, status: 'ACTIVE'
  }), 5)

  // Warehouse
  const warehouses = await batch('WH', API + '/wms/warehouses', i => ({
    code: `WH${String(i).padStart(3,'0')}`,
    name: `Warehouse ${i}`, status: 'ACTIVE'
  }), 3)

  // Material
  const materials = await batch('Material', API + '/plm/materials', i => ({
    code: `MAT${String(200+i).padStart(5,'0')}`,
    name: `Material ${200+i}`,
    type: ['RAW','SEMI','FINISHED'][i%3],
    uomId: String(uoms[i-1] || 1),
    status: 'ACTIVE'
  }), 10)

  // BOM
  console.log('\n== BOM (5个) ==')
  const boms = []
  for (let i = 1; i <= 5; i++) {
    const matId = materials[i-1]
    const lines = materials.slice(i, i+2).map((mid, j) => ({ materialId: mid, quantity: j+1 }))
    const r = await create('BOM', API + '/plm/boms', { bom: { materialId: matId }, lines })
    if (r?.id) { boms.push(r.id); if(i<=3) console.log(`  BOM${i}: id=${r.id}`) }
  }
  console.log(`  [BOM] 成功 ${boms.length} 个`)

  // Routing
  const routings = []
  console.log('\n== Routing (5个) ==')
  for (let i = 1; i <= 5; i++) {
    const matId = materials[i-1]
    const lines = [1,2,3].map(seq => ({ sequence: seq, name: `Step ${seq}`, standardHours: seq }))
    const r = await create('Routing', API + '/plm/routings', { routing: { materialId: matId }, lines })
    if (r?.id) { routings.push(r.id); if(i<=3) console.log(`  Routing${i}: id=${r.id}`) }
  }
  console.log(`  [Routing] 成功 ${routings.length} 个`)

  // Equipment
  const equip = await batch('Equipment', API + '/eam/equipment', i => ({
    equipmentCode: `EQ${String(i).padStart(3,'0')}`,
    equipmentName: `Equipment ${i}`,
    equipmentType: i<=5 ? 'CNC' : 'Assembly',
    category: i<=5 ? 'Machining' : 'Assembly',
    status: 'IDLE'
  }), 5)

  // Employee (HR路径 /hr/employees, 必填: empNo, name, jobType, hireDate)
  const emps = await batch('Employee', HR + '/employees', i => ({
    empNo: `EMP${String(100+i).padStart(4,'0')}`,
    name: `Employee ${100+i}`,
    jobType: 'Operator',
    hireDate: '2024-01-01',
    status: 'ACTIVE'
  }), 5)

  // WorkOrder
  console.log('\n== WorkOrder (5个) ==')
  const wos = []
  for (let i = 1; i <= 5; i++) {
    const r = await create('WO', API + '/mes/work-orders', {
      woNo: `WO-F${String(i).padStart(4,'0')}`,
      woType: 'STANDARD',
      materialId: String(materials[i-1]),
      bomId: String(boms[i-1]),
      routingId: String(routings[i-1]),
      plannedQty: 100 + i*10,
      uomId: String(uoms[0]),
      priority: i,
      bomLevel: 0,
      isCritical: i<=2,
      status: 'RELEASED'
    })
    if (r?.id) { wos.push(r.id); console.log(`  WO${i}: id=${r.id} woNo=${r.woNo}`) }
  }
  console.log(`  [WorkOrder] 成功 ${wos.length} 个`)

  // QCStandard
  const qcs = await batch('QC', API + '/qms/standards', i => ({
    code: `QCS${String(100+i).padStart(3,'0')}`,
    name: `QC Standard ${100+i}`,
    inspectionType: i<=3 ? 'IQC' : 'FQC',
    items: [],
    version: 1,
    status: 'ACTIVE'
  }), 3)

  console.log('\n========================================')
  console.log('结果汇总:')
  console.log('  UOM: ' + uoms.length)
  console.log('  Warehouse: ' + warehouses.length)
  console.log('  Material: ' + materials.length)
  console.log('  BOM: ' + boms.length)
  console.log('  Routing: ' + routings.length)
  console.log('  Equipment: ' + equip.length)
  console.log('  Employee: ' + emps.length)
  console.log('  WorkOrder: ' + wos.length)
  console.log('  QCStandard: ' + qcs.length)
  console.log('========================================\n')

  return { uoms, warehouses, materials, boms, routings, equip, emps, wos, qcs }
}

main().catch(console.error)
