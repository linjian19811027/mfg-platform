/**
 * 测试 BOM 创建 - 使用数据库中实际存在的 materialId
 */
const BASE = 'http://localhost:3000'
const API = BASE + '/api/v1'

async function req(url, data, headers) {
  const body = JSON.stringify(data)
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body
  })
  return resp.json()
}

async function main() {
  // 登录
  const loginResp = await req(API + '/auth/login', {
    username: 'admin', password: 'Admin@123456', tenantCode: 'DEFAULT'
  })
  const token = loginResp.data?.accessToken
  console.log('[登录]', token ? '成功' : '失败')
  if (!token) return

  const h = { 'Authorization': `Bearer ${token}`, 'X-Tenant-Id': 'DEFAULT' }

  // 查询物料
  const matsResp = await fetch(API + '/plm/materials?pageSize=20', { headers: h })
  const mats = matsResp.data?.items || []
  console.log('\n[物料列表] 共', mats.length, '个')
  mats.slice(0,5).forEach(m => console.log(' ', m.id, m.code))

  // 用第一个物料ID创建BOM
  if (mats[0]) {
    console.log('\n[创建BOM] 使用 materialId:', mats[0].id)
    const bomResp = await req(API + '/plm/boms', {
      bom: { materialId: mats[0].id },
      lines: []
    }, h)
    console.log('[BOM结果]', JSON.stringify(bomResp).substring(0, 200))
  }

  // 查询工单
  const woResp = await fetch(API + '/mes/work-orders?pageSize=5', { headers: h })
  const wos = woResp.data?.items || []
  console.log('\n[工单列表] 共', wos.length, '个')
  wos.forEach(w => console.log(' ', w.id, w.woNo, 'materialId:', w.materialId))
}

main().catch(console.error)
