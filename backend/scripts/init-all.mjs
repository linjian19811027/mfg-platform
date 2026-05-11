/**
 * MFG Platform 完整测试数据初始化 v8
 * 包含所有基础数据 + BOM Lines + Routing Operations
 * 运行：node scripts/init-all.mjs
 */
const BASE = 'http://localhost:3000/api/v1'
const HR = 'http://localhost:3000/hr'

let token = ''
const h = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
  'X-Tenant-Id': 'DEFAULT'
})

async function req(url, data) {
  const body = JSON.stringify(data)
  const r = await fetch(url, { method:'POST', headers: { ...h(), 'Content-Length': Buffer.byteLength(body) }, body }).then(r => r.json())
  if (r.code !== 200) { console.log(`  [${url}] ${r.message}`); return null }
  return r.data
}

async function get(url) {
  const r = await fetch(url, { headers: h() }).then(r => r.json())
  return r.code === 200 ? r.data : null
}

async function login() {
  token = (await req('http://localhost:3000/api/v1/auth/login', {username:'admin',password:'Admin@123456',tenantCode:'DEFAULT'}))?.accessToken
  console.log('[登录]', token ? 'OK' : 'FAIL')
}

async function getList(path) {
  const d = await get(path + '?pageSize=500')
  return d?.items || d?.list || d || []
}

async function main() {
  console.log('========================================')
  console.log('MFG Platform 初始化 v8')
  console.log('========================================')

  await login()
  if (!token) return

  // 查询现有数据
  const [uoms, whs, mats, boms, routings, equip, emps, wos] = await Promise.all([
    getList('http://localhost:3000/api/v1/base/uoms'),
    getList('http://localhost:3000/api/v1/wms/warehouses'),
    getList('http://localhost:3000/api/v1/plm/materials'),
    getList('http://localhost:3000/api/v1/plm/boms'),
    getList('http://localhost:3000/api/v1/plm/routings'),
    getList('http://localhost:3000/api/v1/eam/equipment'),
    getList('http://localhost:3000/hr/employees'),
    getList('http://localhost:3000/api/v1/mes/work-orders')
  ])

  console.log('\n现有数据:')
  console.log('  UOM:', uoms.length)
  console.log('  WH:', whs.length)
  console.log('  Material:', mats.length)
  console.log('  BOM:', boms.length)
  console.log('  Routing:', routings.length)
  console.log('  Equipment:', equip.length)
  console.log('  Employee:', emps.length)
  console.log('  WorkOrder:', wos.length)

  // 补充数据到目标数量
  console.log('\n补充数据...')

  // UOM - 目标30个
  if (uoms.length < 30) {
    console.log('\n== UOM ==')
    for (let i = uoms.length + 1; i <= 30; i++) {
      const r = await req('http://localhost:3000/api/v1/base/uoms', {
        code: `UOM${i}`, name: `Unit ${i}`, status: 'ACTIVE'
      })
      if (r) console.log(`  UOM${i}: ${r.id}`)
    }
  }

  // Warehouse - 目标10个
  if (whs.length < 10) {
    console.log('\n== Warehouse ==')
    for (let i = whs.length + 1; i <= 10; i++) {
      const r = await req('http://localhost:3000/api/v1/wms/warehouses', {
        code: `WH${String(i).padStart(3,'0')}`, name: `Warehouse ${i}`, status: 'ACTIVE'
      })
      if (r) console.log(`  WH${i}: ${r.id}`)
    }
  }

  // Material - 目标30个
  if (mats.length < 30) {
    console.log('\n== Material ==')
    const uomIds = uoms.map(u => u.id)
    for (let i = mats.length + 1; i <= 30; i++) {
      const r = await req('http://localhost:3000/api/v1/plm/materials', {
        code: `MAT${300+i}`, name: `Material ${300+i}`,
        type: ['RAW','SEMI','FINISHED'][i%3],
        uomId: uomIds[(i-1)%uomIds.length] || '1',
        status: 'ACTIVE'
      })
      if (r && i <= 33) console.log(`  MAT${300+i}: ${r.id}`)
    }
  }

  // 重新获取Material/BOM/Routing
  const [m2, b2, r2] = await Promise.all([
    getList('http://localhost:3000/api/v1/plm/materials'),
    getList('http://localhost:3000/api/v1/plm/boms'),
    getList('http://localhost:3000/api/v1/plm/routings')
  ])

  // BOM - 目标20个
  if (b2.length < 20) {
    console.log('\n== BOM ==')
    for (let i = b2.length + 1; i <= 20; i++) {
      const mat = m2[(i-1)%m2.length]
      if (!mat) continue
      const lines = m2.slice(i%m2.length, (i+2)%m2.length).map((m, j) => ({materialId: m.id, quantity: j+1}))
      const r = await req('http://localhost:3000/api/v1/plm/boms', {bom:{materialId:mat.id}, lines})
      if (r) console.log(`  BOM${i}: ${r.id} <- MAT${mat.code}`)
    }
  }

  // Routing - 目标20个
  if (r2.length < 20) {
    console.log('\n== Routing ==')
    for (let i = r2.length + 1; i <= 20; i++) {
      const mat = m2[(i-1)%m2.length]
      if (!mat) continue
      const lines = [1,2,3].map(seq => ({sequence:seq, name:`Step ${seq}`, standardHours:seq}))
      const r = await req('http://localhost:3000/api/v1/plm/routings', {routing:{materialId:mat.id}, lines})
      if (r) console.log(`  Rout${i}: ${r.id} <- MAT${mat.code}`)
    }
  }

  // WorkOrder - 目标20个
  const wos2 = await getList('http://localhost:3000/api/v1/mes/work-orders')
  if (wos2.length < 20) {
    console.log('\n== WorkOrder ==')
    const uom0 = uoms[0]
    for (let i = wos2.length + 1; i <= 20; i++) {
      const mat = m2[(i-1)%m2.length]
      const bom = b2[(i-1)%b2.length]
      const rout = r2[(i-1)%r2.length]
      if (!mat) continue
      const r = await req('http://localhost:3000/api/v1/mes/work-orders', {
        woNo: `WO-V8-${i}`, woType:'STANDARD',
        materialId: mat.id, bomId: bom?.id, routingId: rout?.id,
        plannedQty: 50+i*5, uomId: uom0?.id || '1',
        priority: i%10+1, bomLevel: 0, isCritical: i<=5, status: 'RELEASED'
      })
      if (r) console.log(`  WO${i}: ${r.id} ${r.woNo}`)
    }
  }

  // ========== BOM Lines 填充 ==========
  console.log('\n== BOM Lines 填充 ==')
  const boms4Lines = await getList('http://localhost:3000/api/v1/plm/boms')
  const mats4Lines = await getList('http://localhost:3000/api/v1/plm/materials')

  let bomLinesAdded = 0
  for (let i = 0; i < boms4Lines.length; i++) {
    const bom = boms4Lines[i]
    const lineMats = mats4Lines.filter(m => m.id !== bom.materialId)
    if (lineMats.length < 2) continue

    for (let j = 0; j < 2; j++) {
      const matIdx = (i + j) % lineMats.length
      const r = await fetch(`http://localhost:3000/api/v1/plm/boms/${bom.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h() },
        body: JSON.stringify({
          materialId: lineMats[matIdx].id,
          quantity: j + 1,
          sequence: (j + 1) * 10
        })
      }).then(r => r.json())
      if (r.code === 200) bomLinesAdded++
    }
    if ((i + 1) % 20 === 0) console.log(`  Processed ${i + 1} BOMs...`)
  }
  console.log(`  BOM lines added: ${bomLinesAdded}`)

  // ========== Routing Operations 填充 ==========
  console.log('\n== Routing Operations 填充 ==')
  const routs4Ops = await getList('http://localhost:3000/api/v1/plm/routings')

  let routOpsAdded = 0
  for (let i = 0; i < routs4Ops.length; i++) {
    const routing = routs4Ops[i]

    for (let seq = 1; seq <= 3; seq++) {
      const r = await fetch(`http://localhost:3000/api/v1/plm/routings/${routing.id}/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h() },
        body: JSON.stringify({
          sequence: seq,
          operationCode: `OP-${routing.id}-${seq}`,
          operationName: `Step ${seq}`,
          standardHours: seq,
          workCenterId: null
        })
      }).then(r => r.json())
      if (r.code === 200) routOpsAdded++
    }
    if ((i + 1) % 20 === 0) console.log(`  Processed ${i + 1} Routings...`)
  }
  console.log(`  Routing operations added: ${routOpsAdded}`)

  // 最终统计
  const [u5, w5, m5, b5, r5, eq5, em5, wo5] = await Promise.all([
    getList('http://localhost:3000/api/v1/base/uoms'),
    getList('http://localhost:3000/api/v1/wms/warehouses'),
    getList('http://localhost:3000/api/v1/plm/materials'),
    getList('http://localhost:3000/api/v1/plm/boms'),
    getList('http://localhost:3000/api/v1/plm/routings'),
    getList('http://localhost:3000/api/v1/eam/equipment'),
    getList('http://localhost:3000/hr/employees'),
    getList('http://localhost:3000/api/v1/mes/work-orders')
  ])

  console.log('\n========================================')
  console.log('最终结果:')
  console.log('  UOM:', u5.length)
  console.log('  Warehouse:', w5.length)
  console.log('  Material:', m5.length)
  console.log('  BOM:', b5.length)
  console.log('  Routing:', r5.length)
  console.log('  Equipment:', eq5.length)
  console.log('  Employee:', em5.length)
  console.log('  WorkOrder:', wo5.length)
  console.log('  BOM Lines:', bomLinesAdded)
  console.log('  Routing Operations:', routOpsAdded)
  console.log('========================================')
  console.log('完成!')
}

main().catch(console.error)