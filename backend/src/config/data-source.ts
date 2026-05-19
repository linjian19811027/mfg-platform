/**
 * TypeORM DataSource 配置（供 CLI migration 命令使用）
 * 与 database.config.ts 保持同步
 *
 * 用法：
 *   npm run migration:generate  — 自动生成迁移文件
 *   npm run migration:run      — 执行迁移
 *   npm run migration:revert   — 回滚迁移
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
const { DataSource } = require('typeorm');

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env.' + (process.env.NODE_ENV || 'development')) });

module.exports = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT || 3306),
  username: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASS || '',
  database: process.env.DATABASE_NAME || 'mfg_platform',
  entities: [path.resolve(__dirname, '../**/*.entity.js')],
  migrations: [path.resolve(__dirname, '../migrations/*.js')],
  charset: 'utf8mb4',
  timezone: '+08:00',
});
