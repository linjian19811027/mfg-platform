/**
 * 自动创建数据库（如果不存在）
 * 用法：node scripts/init-db.mjs
 * 读取 .env.development / .env.production 中的数据库配置
 */
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// 读取环境变量
function loadEnv() {
  const files = ['.env.sync', '.env.development', '.env.production'];
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
        if (!process.env[key]) process.env[key] = val;
      }
      console.log(`✅ Loaded ${f}`);
      break;
    } catch {
      // 文件不存在，继续尝试下一个
    }
  }
}

loadEnv();

const host = process.env.DATABASE_HOST || 'localhost';
const port = parseInt(process.env.DATABASE_PORT || '3306');
const user = process.env.DATABASE_USER || 'root';
const password = process.env.DATABASE_PASS || '';
const database = process.env.DATABASE_NAME || 'mfg_platform';

async function main() {
  console.log(`🔄 Connecting to MySQL at ${host}:${port}...`);

  // 不指定 database 连接（数据库可能还不存在）
  const conn = await mysql.createConnection({ host, port, user, password });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`✅ Database \`${database}\` ready`);
  } catch (err) {
    console.error('❌ Failed to create database:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
