/**
 * Debug test for login issue
 */
const BASE_URL = 'http://localhost:3000'
const API = BASE_URL + '/api/v1'

async function login() {
  console.log('[DEBUG] login() called')
  const r = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456', tenantCode: 'DEFAULT' })
  }).then(r => r.json())
  console.log('[DEBUG] login response:', r.code, r.message?.substring(0, 50))
  const token = r.data?.accessToken
  console.log('[DEBUG] token:', token?.substring(0, 50) || 'NO TOKEN')
  return token
}

async function testAPI(path) {
  console.log('[DEBUG] testAPI() called with path:', path)
  const token = await login()
  console.log('[DEBUG] token in testAPI:', token?.substring(0, 50) || 'NO TOKEN')

  const h = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-Id': 'DEFAULT'
  }
  console.log('[DEBUG] headers set')

  const resp = await fetch(path, { method: 'GET', headers: h })
  console.log('[DEBUG] response status:', resp.status)
  return resp.status
}

describe('Debug test', () => {
  beforeAll(async () => {
    console.log('[DEBUG] beforeAll called')
  }, 15000)

  it('SYS-001: GET /api/v1/sys/users', async () => {
    const status = await testAPI(API + '/sys/users')
    console.log('[DEBUG] final status:', status)
    expect([200, 201]).toContain(status)
  })
})