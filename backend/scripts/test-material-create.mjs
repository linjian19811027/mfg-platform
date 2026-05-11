/**
 * 专项测试：新建物料 API
 * node scripts/test-material-create.mjs
 */
const BASE = 'http://localhost:3000/api/v1'

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  return { ok: res.ok, status: res.status, json }
}

async function main() {
  // 1. 登录
  console.log('=== 1. 登录 ===')
  const lr = await req('POST', '/auth/login', {
    username: 'admin',
    password: 'Admin@123456',
    tenantCode: 'DEFAULT',
  })
  console.log('状态:', lr.status)
  console.log('响应:', JSON.stringify(lr.json, null, 2))
  const token = lr.json?.data?.accessToken
  if (!token) { console.error('登录失败，终止'); process.exit(1) }
  console.log('Token 获取成功\n')

  // 2. 先查询物料列表（GET，验证基础连通性）
  console.log('=== 2. 查询物料列表 ===')
  const listR = await req('GET', '/plm/materials?tenantId=DEFAULT', null, token)
  console.log('状态:', listR.status)
  console.log('响应:', JSON.stringify(listR.json, null, 2))
  console.log()

  // 3. 新建物料（复现 bug）
  console.log('=== 3. 新建物料（复现 bug）===')
  const createR = await req('POST', '/plm/materials', {
    tenantId: 'DEFAULT',
    code: `MAT-TEST-${Date.now()}`,
    name: '测试物料',
    type: 'RAW',
    uomId: '1',
    status: 'ACTIVE',
  }, token)
  console.log('状态:', createR.status)
  console.log('响应:', JSON.stringify(createR.json, null, 2))
  console.log()

  // 4. 不带 tenantId 字段新建（测试 TenantContext 是否正常工作）
  console.log('=== 4. 不带 tenantId 字段新建 ===')
  const createR2 = await req('POST', '/plm/materials', {
    code: `MAT-TEST2-${Date.now()}`,
    name: '测试物料2',
    type: 'RAW',
    uomId: '1',
  }, token)
  console.log('状态:', createR2.status)
  console.log('响应:', JSON.stringify(createR2.json, null, 2))
  console.log()

  // 5. 缺少必填字段（uomId）
  console.log('=== 5. 缺少必填字段 uomId ===')
  const createR3 = await req('POST', '/plm/materials', {
    code: `MAT-TEST3-${Date.now()}`,
    name: '测试物料3',
    type: 'RAW',
  }, token)
  console.log('状态:', createR3.status)
  console.log('响应:', JSON.stringify(createR3.json, null, 2))
  console.log()

  // 6. 重复 code（唯一性校验）
  console.log('=== 6. 重复 code 测试 ===')
  const dupCode = `MAT-DUP-${Date.now()}`
  await req('POST', '/plm/materials', { code: dupCode, name: '重复物料', type: 'RAW', uomId: '1' }, token)
  const dupR = await req('POST', '/plm/materials', { code: dupCode, name: '重复物料2', type: 'RAW', uomId: '1' }, token)
  console.log('状态:', dupR.status)
  console.log('响应:', JSON.stringify(dupR.json, null, 2))
}

main().catch(e => { console.error('脚本异常:', e); process.exit(1) })
