/**
 * 完整基础测试数据初始化 FINAL v6
 * 策略：先API查询现有数据，再补充创建缺失数据
 * 运行：node scripts/init-all-data.mjs
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
  console.log('[登录]', token ? '成功' : '失败')
}

async function get(url) {
  const r = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-Id': 'DEFAULT' }
  }).then(r => r.json())
  return r.code === 200 ? r.data : null
}

async function post(url, data) {
  const body = JSON.stringify(data)
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': 'DEFAULT'
    },
    body
  }).then(r => r.json())
  if (r.code !== 200) {
    console.log(`  [失败] ${r.message || r.errorCode}`)
    return null
  }
  return r.data
}

async function getList(path, pageSize = 100) {
  const d = await get(path + `?pageSize=${pageSize}`)
  return d?.items || d?.list || []
}

async function main() {
  console.log('========================================')
  console.log('MFG Platform 基础数据初始化 v6')
  console.log('========================================')

  await login()
  if (!token) return

  // 查询现有数据
  console.log('\n[查询现有数据...]')
  const [uoms, whs, mats, boms, routings, equip, emps, wos] = await Promise.all([
    getList(API + '/base/uoms'),
    getList(API + '/wms/warehouses'),
    getList(API + '/plm/materials'),
    getList(API + '/plm/boms'),
    getList(API + '/plm/routings'),
    getList(API + '/eam/equipment'),
    getList(HR + '/employees'),
    getList(API + '/mes/work-orders')
  ])

  console.log(`  UOM: ${uoms.length} 个`)
  console.log(`  Warehouse: ${whs.length} 个`)
  console.log(`  Material: ${moms.length} 个`)
  console.log(`  BOM: ${boms.length} 个`)
  console.log(`  Routing: ${routings.length} 个`)
  console.log(`  Equipment: ${equip.length} 个`)
  console.log(`  Employee: ${emps.length} 个`)
  console.log(`  WorkOrder: ${wos.length} 个`)
}

  // 补充创建缺失数据...
  console.log('\n[补充创建...]')

  // UOM
  if (uoms.length < 10) {
    console.log('\n== 补充UOM ==')
    for (let i = uoms.length + 1; i <= 10; i++) {
      const r = await post(API + '/base/uoms', {
        code: `UOM${String(i).padStart(3,'0')}`,
        name: `Unit ${i}`, status: 'ACTIVE'
      })
      if (r) console.log(`  UOM${i}: id=${r.id}`)
    }
  }

  // Warehouse
  if (whs.length < 5) {
    console.log('\n== 补充Warehouse ==')
    for (let i = whs.length + 1; i <= 5; i++) {
      const r = await post(API + '/wms/warehouses', {
        code: `WH${String(i).padStart(3,'0')}`,
        name: `Warehouse ${i}`, status: 'ACTIVE'
      })
      if (r) console.log(`  WH${i}: id=${r.id}`)
    }
  }

  // Material
  if (mats.length < 30) {
    console.log('\n== 补充Material ==')
    const uomIds = uoms.map(u => u.id)
    for (let i = mats.length + 1; i <= 30; i++) {
      const r = await post(API + '/plm/materials', {
        code: `MAT${String(300 + i).padStart(5,'0')}`,
        name: `Material ${300 + i}`,
        type: ['RAW', 'SEMI', 'FINISHED'][i % 3],
        uomId: uomIds[(i-1) % uomIds.length] || '1',
        status: 'ACTIVE'
      })
      if (r && i <= 33) console.log(`  Material${i}: id=${r.id}`)
    }
  }

  // 重新查询完整数据
  console.log('\n[重新查询...]')
  const [uoms2, mats2, boms2, routings2] = await Promise.all([
    getList(API + '/base/uoms'),
    getList(API + '/plm/materials'),
    getList(API + '/plm/boms'),
    getList(API + '/plm/routings')
  ])

  // BOM (依赖Material)
  if (boms2.length < 20) {
    console.log('\n== 补充BOM ==')
    for (let i = boms2.length + 1; i <= 20; i++) {
      const mat = mats2[i-1]
      if (!mat) continue
      const lines = mats2.slice(i, i+2).map((m, j) => ({
        materialId: m.id, quantity: j + 1
      }))
      const r = await post(API + '/plm/boms', {
        bom: { materialId: mat.id },
        lines
      })
      if (r) console.log(`  BOM${i}: id=${r.id} for Material ${mat.id}`)
    }
  }

  // Routing (依赖Material)
  if (routings2.length < 20) {
    console.log('\n== 补充Routing ==')
    for (let i = routings2.length + 1; i <= 20; i++) {
      const mat = mats2[i-1]
      if (!mat) continue
      const lines = [1,2,3].map(seq => ({
        sequence: seq, name: `Step ${seq}`, standardHours: seq
      }))
      const r = await post(API + '/plm/routings', {
        routing: { materialId: mat.id },
        lines
      })
      if (r) console.log(`  Routing${i}: id=${r.id} for Material ${mat.id}`)
    }
  }

  // 查询最新数据
  const [mats3, boms3, routings3, equip3, emps3, wos3] = await Promise.all([
    getList(API + '/plm/materials'),
    getList(API + '/plm/boms'),
    getList(API + '/plm/routings'),
    getList(API + '/eam/equipment'),
    getList(HR + '/employees'),
    getList(API + '/mes/work-orders')
  ])

  // WorkOrder (依赖Material/BOM/Routing/UOM)
  if (wos3.length < 20) {
    console.log('\n== 补充WorkOrder ==')
    const uom0 = uoms2[0]
    for (let i = wos3.length + 1; i <= 20; i++) {
      const mat = mats3[(i-1) % mats3.length]
      const bom = boms3[(i-1) % boms3.length]
      const routing = routings3[(i-1) % routings3.length]
      if (!mat) continue
      const r = await post(API + '/mes/work-orders', {
        woNo: `WO-V6${String(i).padStart(4,'0')}`,
        woType: 'STANDARD',
        materialId: mat.id,
        bomId: bom?.id,
        routingId: routing?.id,
        plannedQty: 50 + i * 10,
        uomId: uom0?.id || '1',
        priority: (i % 10) + 1,
        bomLevel: 0,
        isCritical: i <= 5,
        status: 'RELEASED'
      })
      if (r) console.log(`  WO${i}: id=${r.id} woNo=${r.woNo}`)
    }
  }

  // 最终统计
  console.log('\n========================================')
  console.log('初始化完成!')
  console.log('========================================')
}

main().catch(console.error)
