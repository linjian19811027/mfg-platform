/**
 * 基础测试数据初始化脚本
 * 运行方式：node scripts/init-test-data.mjs
 * 在 backend 目录下执行
 */

import mysql from 'mysql2/promise'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 读取 .env.test
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env.test')
    const content = readFileSync(envPath, 'utf-8')
    const env = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
    }
    return env
  } catch {
    return {}
  }
}

async function main() {
  const env = loadEnv()
  const BASE_URL = `http://localhost:${env.PORT || 3000}/api/v1`

  // 1. 登录获取token
  console.log('=== 1. 登录 ===')
  const loginResp = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456', tenantCode: 'DEFAULT' })
  })
  const login = await loginResp.json()
  const TOKEN = login.data?.accessToken
  console.log(`Token: ${TOKEN.substring(0, 30)}...`)
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
    'X-Tenant-Id': 'DEFAULT'
  }

  // 辅助函数：POST请求
  async function post(url, data) {
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) })
    return resp.json()
  }

  // 辅助函数：GET请求
  async function get(url) {
    const resp = await fetch(url, { method: 'GET', headers })
    return resp.json()
  }

  const created = { uoms: [], materials: [], warehouses: [], locations: [], suppliers: [], customers: [], resources: [], employees: [] }

  try {
    // 2. 计量单位
    console.log('\n=== 2. 创建计量单位 ===')
    const uomCodes = ['PC', 'KG', 'M', 'L', 'BOX', 'SET', 'PCS', 'M2', 'M3', 'TON']
    for (const code of uomCodes) {
      const result = await post(`${BASE_URL}/base/uoms`, { code, name: code, status: 'ACTIVE' })
      if (result.data?.id) {
        created.uoms.push({ id: result.data.id, code })
        console.log(`  UOM ${code}: id=${result.data.id}`)
      }
    }

    // 3. 仓库
    console.log('\n=== 3. 创建仓库 ===')
    for (let i = 1; i <= 3; i++) {
      const result = await post(`${BASE_URL}/wms/warehouses`, { code: `WH${i}`, name: `Warehouse ${i}`, status: 'ACTIVE' })
      if (result.data?.id) {
        created.warehouses.push({ id: result.data.id, code: `WH${i}` })
        console.log(`  Warehouse ${i}: id=${result.data.id}`)
      }
    }

    // 4. 供应商
    console.log('\n=== 4. 创建供应商 ===')
    for (let i = 1; i <= 10; i++) {
      const result = await post(`${BASE_URL}/scm/suppliers`, {
        code: `SUP${String(i).padStart(3, '0')}`,
        name: `Supplier ${i}`,
        status: 'ACTIVE'
      })
      if (result.data?.id) {
        created.suppliers.push({ id: result.data.id, code: `SUP${String(i).padStart(3, '0')}` })
        console.log(`  Supplier ${i}: id=${result.data.id}`)
      }
    }

    // 5. 客户
    console.log('\n=== 5. 创建客户 ===')
    for (let i = 1; i <= 10; i++) {
      const result = await post(`${BASE_URL}/erp/customers`, {
        code: `CUST${String(i).padStart(3, '0')}`,
        name: `Customer ${i}`,
        status: 'ACTIVE'
      })
      if (result.data?.id) {
        created.customers.push({ id: result.data.id, code: `CUST${String(i).padStart(3, '0')}` })
        console.log(`  Customer ${i}: id=${result.data.id}`)
      }
    }

    // 6. APS资源
    console.log('\n=== 6. 创建APS资源 ===')
    for (let i = 1; i <= 20; i++) {
      const result = await post(`${BASE_URL}/aps/resources`, {
        code: `RES${String(i).padStart(3, '0')}`,
        name: `Resource ${i}`,
        type: i <= 10 ? 'MACHINE' : 'LABOR',
        status: 'AVAILABLE'
      })
      if (result.data?.id) {
        created.resources.push({ id: result.data.id, code: `RES${String(i).padStart(3, '0')}` })
        console.log(`  Resource ${i}: id=${result.data.id}`)
      }
    }

    // 7. 员工
    console.log('\n=== 7. 创建员工 ===')
    for (let i = 1; i <= 20; i++) {
      const result = await post(`${BASE_URL}/hr/employees`, {
        code: `EMP${String(i).padStart(3, '0')}`,
        name: `Employee ${i}`,
        status: 'ACTIVE'
      })
      if (result.data?.id) {
        created.employees.push({ id: result.data.id, code: `EMP${String(i).padStart(3, '0')}` })
        console.log(`  Employee ${i}: id=${result.data.id}`)
      }
    }

    // 8. EAM设备
    console.log('\n=== 8. 创建EAM设备 ===')
    for (let i = 1; i <= 20; i++) {
      const result = await post(`${BASE_URL}/eam/equipment`, {
        equipmentCode: `EQ${String(i).padStart(3, '0')}`,
        name: `Equipment ${i}`,
        status: 'IDLE'
      })
      if (result.data?.id) {
        console.log(`  Equipment ${i}: id=${result.data.id}`)
      }
    }

    // 9. 物料 (30+)
    console.log('\n=== 9. 创建物料 ===')
    const materialTypes = ['RAW', 'SEMI', 'FINISHED']
    for (let i = 1; i <= 30; i++) {
      const type = materialTypes[i % 3]
      const uomId = created.uoms[i % created.uoms.length]?.id || '1'
      const result = await post(`${BASE_URL}/plm/materials`, {
        code: `MAT${String(i).padStart(5, '0')}`,
        name: `Material ${i} (${type})`,
        type,
        uomId,
        status: 'ACTIVE'
      })
      if (result.data?.id) {
        created.materials.push({ id: result.data.id, code: `MAT${String(i).padStart(5, '0')}` })
        if (i <= 5) console.log(`  Material ${i}: id=${result.data.id}`)
      }
    }
    console.log(`  ... 共创建 ${created.materials.length} 个物料`)

    // 10. BOM (为前20个物料创建BOM)
    console.log('\n=== 10. 创建BOM ===')
    let bomCount = 0
    for (let i = 1; i <= 20 && i < created.materials.length; i++) {
      const material = created.materials[i - 1]
      // 为BOM添加子物料行
      const lines = []
      for (let j = 0; j < 3; j++) {
        const childMaterial = created.materials[(i + j + 1) % created.materials.length]
        if (childMaterial && childMaterial.id !== material.id) {
          lines.push({
            materialId: childMaterial.id,
            quantity: Math.floor(Math.random() * 5) + 1
          })
        }
      }
      const result = await post(`${BASE_URL}/plm/boms`, {
        bom: { materialId: material.id },
        lines
      })
      if (result.data?.id) {
        bomCount++
      }
    }
    console.log(`  创建 ${bomCount} 个BOM`)

    // 11. 工艺路线 (为前20个物料创建工艺)
    console.log('\n=== 11. 创建工艺路线 ===')
    let routingCount = 0
    for (let i = 1; i <= 20 && i < created.materials.length; i++) {
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
      const result = await post(`${BASE_URL}/plm/routings`, {
        routing: { materialId: material.id },
        lines
      })
      if (result.data?.id) {
        routingCount++
      }
    }
    console.log(`  创建 ${routingCount} 个工艺路线`)

    // 12. QMS检验标准
    console.log('\n=== 12. 创建QMS检验标准 ===')
    for (let i = 1; i <= 10; i++) {
      const result = await post(`${BASE_URL}/qms/standards`, {
        code: `QCS${String(i).padStart(3, '0')}`,
        name: `QC Standard ${i}`,
        status: 'ACTIVE'
      })
      if (result.data?.id) {
        console.log(`  QC Standard ${i}: id=${result.data.id}`)
      }
    }

    console.log('\n========================================')
    console.log('🎉 基础数据初始化完成！')
    console.log(`  计量单位: ${created.uoms.length} 个`)
    console.log(`  仓库: ${created.warehouses.length} 个`)
    console.log(`  供应商: ${created.suppliers.length} 个`)
    console.log(`  客户: ${created.customers.length} 个`)
    console.log(`  资源: ${created.resources.length} 个`)
    console.log(`  员工: ${created.employees.length} 个`)
    console.log(`  物料: ${created.materials.length} 个`)
    console.log(`  BOM: ${bomCount} 个`)
    console.log(`  工艺路线: ${routingCount} 个`)
    console.log('========================================\n')

    // 保存创建的数据ID映射到文件
    const fs = await import('fs')
    fs.writeFileSync(
      resolve(__dirname, 'test-data-ids.json'),
      JSON.stringify(created, null, 2)
    )
    console.log('数据ID映射已保存到 test-data-ids.json')

  } catch (err) {
    console.error('❌ 初始化失败：', err.message)
    console.error(err.stack)
    process.exit(1)
  }
}

main()
