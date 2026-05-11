/**
 * 数据库表结构同步脚本
 * 运行：node scripts/db-sync.mjs
 * 前提：已执行 npm run build
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// 读取环境变量：优先 .env.sync（高权限账号），回退 .env.development
function loadEnv() {
  const files = ['.env.sync', '.env.development'];
  for (const f of files) {
    try {
      const env = readFileSync(resolve(rootDir, f), 'utf-8');
      for (const line of env.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx < 0) continue;
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        // 第一个文件优先，不覆盖已设置的值
        if (!process.env[key]) process.env[key] = val;
      }
      console.log(`✅ Loaded ${f}`);
      break; // 只读第一个找到的文件
    } catch {
      // 文件不存在，继续尝试下一个
    }
  }
}

loadEnv();

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  // 优先使用 DB_SYNC_USER/PASS（可传入高权限账号用于建表）
  username: process.env.DB_SYNC_USER || process.env.DATABASE_USER || 'newuser',
  password: process.env.DB_SYNC_PASS || process.env.DATABASE_PASS || 'newpassword!!',
  database: process.env.DATABASE_NAME || 'mfg_platform',
  charset: 'utf8mb4',
  timezone: '+08:00',
  synchronize: true,
  logging: ['schema', 'error'],
  // TypeORM glob 模式：扫描 dist/src 下所有 entity.js
  entities: [resolve(rootDir, 'dist/src/**/*.entity.js')],
});

async function main() {
  console.log('🔄 Connecting to database...');
  console.log(`   Host: ${process.env.DATABASE_HOST || 'localhost'}:${process.env.DATABASE_PORT || '3306'}`);
  console.log(`   DB:   ${process.env.DATABASE_NAME || 'mfg_platform'}`);
  console.log(`   User: ${process.env.DATABASE_USER || 'newuser'}`);

  try {
    await dataSource.initialize();
    console.log('✅ Schema synchronized successfully');

    const tables = await dataSource.query('SHOW TABLES');
    console.log(`\n📊 Total tables: ${tables.length}`);
    tables.forEach(t => {
      const name = Object.values(t)[0];
      console.log(`   ✓ ${name}`);
    });
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Check DATABASE_USER / DATABASE_PASS');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('   → MySQL not running or wrong host/port');
    } else {
      console.error(err);
    }
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('\n🔌 Done');
  }
}

main();
