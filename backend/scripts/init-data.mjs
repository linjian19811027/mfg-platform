/**
 * 初始化数据库基础数据脚本
 * 运行方式：node scripts/init-data.mjs
 * 在 backend 目录下执行
 */

import mysql from 'mysql2/promise'
import { createHash, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 读取 .env.development
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

// 简单的 bcrypt 替代：使用 SHA-256 + salt（仅用于初始化脚本，实际登录用 bcrypt）
// 注意：这里需要用真正的 bcrypt，通过动态 import
async function hashPassword(password) {
  // 动态引入 bcrypt（需要在 backend 目录下运行）
  try {
    const bcrypt = await import('bcrypt')
    console.log(bcrypt.default.hash(password, 12))
    return bcrypt.default.hash(password, 12)
  } catch {
    // 如果 bcrypt 不可用，提示用户
    console.error('❌ 无法加载 bcrypt，请确保在 backend 目录下运行此脚本')
    process.exit(1)
  }
}

async function main() {
  const env = loadEnv()

  const conn = await mysql.createConnection({
    host: env.DATABASE_HOST || 'localhost',
    port: parseInt(env.DATABASE_PORT || '3306'),
    user: env.DATABASE_USER || 'newuser',
    password: env.DATABASE_PASS || 'newpassword!!',
    database: env.DATABASE_NAME || 'mfg_platform_test',
  })

  console.log('✅ 数据库连接成功')

  try {
    // 1. 创建默认租户
    await conn.execute(`
      INSERT IGNORE INTO sys_tenant (code, name, status, created_at, updated_at)
      VALUES ('DEFAULT', '默认租户', 'ACTIVE', NOW(), NOW())
    `)
    console.log('✅ 租户初始化完成：DEFAULT')

    // 2. 创建管理员角色
    await conn.execute(`
      INSERT IGNORE INTO sys_role (tenant_id, code, name, status, created_at)
      VALUES ('DEFAULT', 'ADMIN', '系统管理员', 'ACTIVE', NOW())
    `)
    console.log('✅ 角色初始化完成：ADMIN')

    // 查询角色 id
    const [roleRows] = await conn.execute(
      `SELECT id FROM sys_role WHERE tenant_id = 'DEFAULT' AND code = 'ADMIN' LIMIT 1`
    )
    const roleId = roleRows[0]?.id
    if (!roleId) throw new Error('角色创建失败')

    // 3. 创建管理员用户（密码：Admin@123456）
    const password = 'Admin@123456'
    const hashedPwd = await hashPassword(password)

    await conn.execute(`
      INSERT IGNORE INTO sys_user (
        tenant_id, username, password, real_name, status,
        login_fail_count, created_at, updated_at
      )
      VALUES ('DEFAULT', 'admin', ?, '系统管理员', 'ACTIVE', 0, NOW(), NOW())
    `, [hashedPwd])
    console.log('✅ 用户初始化完成：admin')

    // 查询刚插入的用户 id
    const [rows] = await conn.execute(
      `SELECT id FROM sys_user WHERE tenant_id = 'DEFAULT' AND username = 'admin' LIMIT 1`
    )
    const userId = rows[0]?.id
    if (!userId) throw new Error('用户创建失败，无法获取 id')

    // 4. 关联用户和角色
    await conn.execute(`
      INSERT IGNORE INTO sys_user_role (user_id, role_id, tenant_id, created_at)
      VALUES (?, ?, 'DEFAULT', NOW())
    `, [userId, roleId])
    console.log('✅ 用户角色关联完成')

    console.log('\n========================================')
    console.log('🎉 初始化完成！登录信息如下：')
    console.log('  租户编码：DEFAULT')
    console.log('  用户名：  admin')
    console.log('  密码：    Admin@123456')
    console.log('========================================\n')

  } finally {
    await conn.end()
  }
}

main().catch(err => {
  console.error('❌ 初始化失败：', err.message)
  process.exit(1)
})
