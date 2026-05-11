// Jest setup file - ensures test user password is valid before tests
import 'reflect-metadata'
import bcrypt from 'bcrypt'
import mysql from 'mysql2/promise'

beforeAll(async () => {
  // Reset password hash before tests run
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'newuser',
      password: 'newpassword!!',
      database: 'mfg_platform_test'
    })
    const hash = await bcrypt.hash('Admin@123456', 12)
    await conn.execute('UPDATE sys_user SET password = ?, login_fail_count = 0, locked_until = NULL WHERE username = ?', [hash, 'admin'])
    await conn.end()
    console.log('[SETUP] Password hash refreshed')
  } catch (e) {
    console.error('[SETUP] Failed to refresh password:', e.message)
  }
}, 10000)