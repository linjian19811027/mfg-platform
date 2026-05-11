/**
 * MFG Platform MES工单状态机测试用例
 *
 * 测试策略: 按正确顺序执行状态转换
 * 第一阶段: 验证所有合法转换 → 全部通过
 * 第二阶段: 验证非法转换被正确拒绝 → 防呆测试
 *
 * 运行方式: npx jest test/mes-workorder-state-machine.spec.ts --testTimeout=60000
 */
import 'reflect-metadata'

const BASE_URL = 'http://localhost:3000'
const API = BASE_URL + '/api/v1'

// ============================================
// 工具函数
// ============================================
let cachedToken = null
let tokenExpiry = 0

async function login() {
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
  tokenExpiry = Date.now() + 600000
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
  try {
    const resp = await fetch(path, opts)
    return { status: resp.status, body: await resp.json().catch(() => ({})) }
  } catch (e) {
    return { status: 0, body: { code: 500, message: e.message } }
  }
}

const post = (path, body) => apiRequest('POST', path, body)
const get = (path) => apiRequest('GET', path)
const patch = (path, body) => apiRequest('PATCH', path, body)

// ============================================
// 测试数据管理
// ============================================
let testData = {
  releasedWos: [],   // RELEASED状态工单
  inProgressWos: [], // IN_PROGRESS状态工单
  completedWos: [], // COMPLETED状态工单
  closedWos: [],    // CLOSED状态工单
  materialId: '1',
  uomId: '1'
}

async function createWorkOrder(woNo, status = 'RELEASED') {
  const resp = await post(API + '/mes/work-orders', {
    woNo,
    woType: 'STANDARD',
    materialId: testData.materialId,
    plannedQty: 100,
    uomId: testData.uomId,
    status
  })
  if (resp.status === 200 || resp.status === 201) {
    return resp.body.data
  }
  return null
}

async function changeStatus(woId, newStatus) {
  return await patch(API + `/mes/work-orders/${woId}/status`, { status: newStatus })
}

async function initTestData() {
  console.log('\n📋 初始化测试数据...')

  // 创建RELEASED工单
  for (let i = 0; i < 5; i++) {
    const wo = await createWorkOrder(`SM_RELEASED_${Date.now()}_${i}`)
    if (wo) testData.releasedWos.push(wo)
  }
  console.log(`  ✅ RELEASED工单: ${testData.releasedWos.length}个`)

  // 创建IN_PROGRESS工单
  for (let i = 0; i < 3; i++) {
    const wo = await createWorkOrder(`SM_IP_${Date.now()}_${i}`)
    if (wo) {
      await changeStatus(wo.id, 'IN_PROGRESS')
      testData.inProgressWos.push({ ...wo, status: 'IN_PROGRESS' })
    }
  }
  console.log(`  ✅ IN_PROGRESS工单: ${testData.inProgressWos.length}个`)

  // 创建COMPLETED工单
  for (let i = 0; i < 3; i++) {
    const wo = await createWorkOrder(`SM_COMP_${Date.now()}_${i}`)
    if (wo) {
      await changeStatus(wo.id, 'IN_PROGRESS')
      await changeStatus(wo.id, 'COMPLETED')
      testData.completedWos.push({ ...wo, status: 'COMPLETED' })
    }
  }
  console.log(`  ✅ COMPLETED工单: ${testData.completedWos.length}个`)
}

// ============================================
// 第一阶段: 合法状态转换测试
// ============================================
describe('【MES工单状态机】第一阶段: 合法状态转换', () => {
  beforeAll(async () => {
    await login()
    await initTestData()
  }, 60000)

  // ── RELEASED → IN_PROGRESS ──
  describe('RELEASED → IN_PROGRESS', () => {
    it('RELEASED工单可以转换为IN_PROGRESS', async () => {
      const wo = testData.releasedWos[0]
      if (!wo) {
        console.log('  ⚠️ 无RELEASED工单，跳过测试')
        return
      }
      const resp = await changeStatus(wo.id, 'IN_PROGRESS')
      expect([200, 201, 204]).toContain(resp.status)
      expect(resp.body.data?.status).toBe('IN_PROGRESS')
    })
  })

  // ── RELEASED → CLOSED ──
  describe('RELEASED → CLOSED', () => {
    it('RELEASED工单可以直接关闭', async () => {
      const wo = testData.releasedWos[1]
      if (!wo) {
        console.log('  ⚠️ 无RELEASED工单，跳过测试')
        return
      }
      const resp = await changeStatus(wo.id, 'CLOSED')
      expect([200, 201, 204]).toContain(resp.status)
      expect(resp.body.data?.status).toBe('CLOSED')
    })
  })

  // ── IN_PROGRESS → COMPLETED ──
  describe('IN_PROGRESS → COMPLETED', () => {
    it('IN_PROGRESS工单可以转换为COMPLETED', async () => {
      const wo = testData.inProgressWos[0]
      if (!wo) {
        console.log('  ⚠️ 无IN_PROGRESS工单，跳过测试')
        return
      }
      const resp = await changeStatus(wo.id, 'COMPLETED')
      expect([200, 201, 204]).toContain(resp.status)
      expect(resp.body.data?.status).toBe('COMPLETED')
    })
  })

  // ── IN_PROGRESS → CLOSED ──
  describe('IN_PROGRESS → CLOSED', () => {
    it('IN_PROGRESS工单可以直接关闭', async () => {
      const wo = testData.inProgressWos[1]
      if (!wo) {
        console.log('  ⚠️ 无IN_PROGRESS工单，跳过测试')
        return
      }
      const resp = await changeStatus(wo.id, 'CLOSED')
      expect([200, 201, 204]).toContain(resp.status)
      expect(resp.body.data?.status).toBe('CLOSED')
    })
  })

  // ── COMPLETED → CLOSED ──
  describe('COMPLETED → CLOSED', () => {
    it('COMPLETED工单可以关闭', async () => {
      const wo = testData.completedWos[0]
      if (!wo) {
        console.log('  ⚠️ 无COMPLETED工单，跳过测试')
        return
      }
      const resp = await changeStatus(wo.id, 'CLOSED')
      expect([200, 201, 204]).toContain(resp.status)
      expect(resp.body.data?.status).toBe('CLOSED')
    })
  })
})

// ============================================
// 第二阶段: 非法状态转换测试 (防呆测试)
// ============================================
describe('【MES工单状态机】第二阶段: 非法状态转换(防呆)', () => {
  let closedWo = null

  beforeAll(async () => {
    await login()
    // 为防呆测试创建一个新的CLOSED工单
    const wo = await createWorkOrder(`SM_CLOSED_${Date.now()}`)
    if (wo) {
      await changeStatus(wo.id, 'IN_PROGRESS')
      await changeStatus(wo.id, 'COMPLETED')
      await changeStatus(wo.id, 'CLOSED')
      closedWo = { ...wo, status: 'CLOSED' }
    }
  }, 30000)

  // ── IN_PROGRESS → RELEASED (不允许回退) ──
  describe('非法转换: IN_PROGRESS → RELEASED', () => {
    it('IN_PROGRESS工单不能回退到RELEASED', async () => {
      // 使用已有的IN_PROGRESS工单
      const existingWos = await get(API + '/mes/work-orders?status=IN_PROGRESS')
      const wo = existingWos.body?.data?.items?.[0]
      if (!wo) {
        console.log('  ⚠️ 无IN_PROGRESS工单，跳过测试')
        return
      }
      const resp = await changeStatus(wo.id, 'RELEASED')
      // 应该返回400或错误，而不是200
      expect(resp.status).toBeGreaterThanOrEqual(400)
    })
  })

  // ── COMPLETED → IN_PROGRESS (不允许回退) ──
  describe('非法转换: COMPLETED → IN_PROGRESS', () => {
    it('COMPLETED工单不能回退到IN_PROGRESS', async () => {
      const existingWos = await get(API + '/mes/work-orders?status=COMPLETED')
      const wo = existingWos.body?.data?.items?.[0]
      if (!wo) {
        console.log('  ⚠️ 无COMPLETED工单，跳过测试')
        return
      }
      const resp = await changeStatus(wo.id, 'IN_PROGRESS')
      expect(resp.status).toBeGreaterThanOrEqual(400)
    })
  })

  // ── COMPLETED → RELEASED (不允许回退) ──
  describe('非法转换: COMPLETED → RELEASED', () => {
    it('COMPLETED工单不能回退到RELEASED', async () => {
      const existingWos = await get(API + '/mes/work-orders?status=COMPLETED')
      const wo = existingWos.body?.data?.items?.[1]
      if (!wo) {
        console.log('  ⚠️ 无COMPLETED工单，跳过测试')
        return
      }
      const resp = await changeStatus(wo.id, 'RELEASED')
      expect(resp.status).toBeGreaterThanOrEqual(400)
    })
  })

  // ── CLOSED → 任何状态 (已关闭不允许流转) ──
  describe('非法转换: CLOSED → 任何状态', () => {
    it('CLOSED工单不能转换到任何状态', async () => {
      if (!closedWo) {
        console.log('  ⚠️ 无CLOSED工单，跳过测试')
        return
      }

      const statuses = ['RELEASED', 'IN_PROGRESS', 'COMPLETED']
      for (const status of statuses) {
        const resp = await changeStatus(closedWo.id, status)
        expect(resp.status).toBeGreaterThanOrEqual(400)
      }
    })
  })
})

// ============================================
// 第三阶段: 工单操作测试
// ============================================
describe('【MES工单操作】第三阶段: 工单操作', () => {
  beforeAll(async () => {
    await login()
  }, 30000)

  describe('工单查询', () => {
    it('可以获取工单列表', async () => {
      const resp = await get(API + '/mes/work-orders')
      expect([200, 201, 204]).toContain(resp.status)
    })

    it('可以获取工单详情', async () => {
      const wo = testData.releasedWos[2]
      if (!wo) return
      const resp = await get(API + `/mes/work-orders/${wo.id}`)
      expect([200, 201, 204]).toContain(resp.status)
    })
  })

  describe('工单优先级', () => {
    it('可以调整工单优先级', async () => {
      const wo = testData.releasedWos[3]
      if (!wo) return
      const resp = await patch(API + `/mes/work-orders/${wo.id}/priority`, { priority: 9 })
      expect([200, 201, 204]).toContain(resp.status)
    })
  })

  describe('工单拆分', () => {
    it('RELEASED工单可以拆分', async () => {
      const wo = testData.releasedWos[4]
      if (!wo) return
      const resp = await post(API + `/mes/work-orders/${wo.id}/split`, { splitQtys: [50, 50] })
      expect([200, 201, 204]).toContain(resp.status)
    })
  })

  describe('工单合并', () => {
    it('空数组应返回错误', async () => {
      const resp = await post(API + '/mes/work-orders/merge', { sourceIds: [] })
      // 空数组应该返回400
      expect(resp.status).toBeGreaterThanOrEqual(400)
    })

    it('需要至少2个工单才能合并', async () => {
      const resp = await post(API + '/mes/work-orders/merge', { sourceIds: ['1'] })
      expect(resp.status).toBeGreaterThanOrEqual(400)
    })
  })
})

// ============================================
// 第四阶段: 工序操作测试
// ============================================
describe('【MES工序操作】第四阶段: 工序操作', () => {
  beforeAll(async () => {
    await login()
  }, 30000)

  describe('工序查询', () => {
    it('可以获取工序列表', async () => {
      const resp = await get(API + '/mes/operations')
      expect([200, 201, 204]).toContain(resp.status)
    })
  })

  describe('报工操作', () => {
    it('可以查询报工记录', async () => {
      const resp = await get(API + '/mes/production-reports')
      expect([200, 201, 204]).toContain(resp.status)
    })
  })
})
