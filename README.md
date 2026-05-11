# 制造业八大核心系统平台（mfg-platform）

面向中小制造企业的一体化管理平台，覆盖 PLM、MES、WMS、QMS、ERP、SCM、APS、EAM 八大核心业务系统，支持多租户隔离、无 Redis 降级部署。

---

## 目录结构

```
mfg-platform/
├── backend/          # NestJS 后端 API
├── frontend/         # Vue 3 管理端（PC 浏览器）
├── pda/              # UniApp PDA 端（待开发）
├── e2e-test/         # Playwright E2E 测试
└── README.md
```

---

## 技术栈

### 后端（backend）

| 类别 | 技术 | 版本 |
|:---|:---|:---|
| 运行时 | Node.js | ≥ 18 |
| 框架 | NestJS | ^11 |
| 语言 | TypeScript | ^5.7 |
| ORM | TypeORM | ^0.3 |
| 数据库 | MySQL | 8.0 |
| 认证 | JWT + Passport | - |
| API 文档 | Swagger / OpenAPI | ^11 |
| 限流 | @nestjs/throttler | ^6 |
| 安全 | Helmet | ^8 |
| 文件上传 | Multer | ^2 |
| 单元测试 | Jest + ts-jest | ^30 |
| E2E 测试 | Jest + Supertest | - |
| 代码规范 | ESLint + Prettier | - |

### 前端（frontend）

| 类别 | 技术 | 版本 |
|:---|:---|:---|
| 框架 | Vue 3 (Composition API) | ^3.4 |
| 语言 | TypeScript | ^5.3 |
| 构建工具 | Vite | ^5 |
| UI 组件库 | Arco Design Vue | ^2.55 |
| 状态管理 | Pinia | ^2.1 |
| 路由 | Vue Router | ^4.3 |
| HTTP 客户端 | Axios | ^1.6 |
| 图表 | ECharts | ^5.6 |

### E2E 测试（e2e-test）

| 类别 | 技术 | 版本 |
|:---|:---|:---|
| 浏览器自动化 | Playwright | ^1.59 |

### 无 Redis 降级方案

| 能力 | 替代方案 |
|:---|:---|
| 缓存 | 内存 LRU（MemoryCacheService） |
| 消息队列 | 数据库轮询（sys_event_store，每 5 秒） |
| Session | JWT 无状态（8 小时过期） |
| 分布式锁 | 数据库乐观锁（单实例） |
| 实时通知 | SSE 轮询（10 秒） |
| 文件存储 | 本地文件系统（`/data/files/{tenant_id}/`） |

---

## 升级到完整生产方案

当业务规模增长，需要从降级方案升级到完整方案时，按以下步骤操作。

### 一、接入 Redis

#### 1. 安装 Redis

```bash
# Linux
apt install redis-server
systemctl enable redis-server
systemctl start redis-server

# Windows（开发用）
# 下载 https://github.com/tporadowski/redis/releases
```

#### 2. 安装 NestJS Redis / Bull 依赖

```bash
cd backend
npm install @nestjs/bull bull ioredis
npm install @types/bull -D
```

#### 3. 修改 `.env.production`

```env
REDIS_URL=redis://localhost:6379
# 如有密码：
# REDIS_URL=redis://:yourpassword@localhost:6379
```

#### 4. 修改缓存模块（`backend/src/shared/cache/cache.module.ts`）

当前代码检测到 `REDIS_URL` 后仍返回 `MemoryCacheService`，需替换为真正的 Redis 实现：

```typescript
import { createClient } from 'redis';
// 或使用 ioredis：import Redis from 'ioredis';

if (redisUrl) {
  logger.log('[Cache] Using Redis');
  // 替换为 RedisCacheService（需自行实现 CacheProvider 接口）
  return new RedisCacheService(redisUrl);
}
```

`RedisCacheService` 需实现 `cache.interface.ts` 中的 `CacheProvider` 接口（`get/set/del/clear`）。

#### 5. 修改消息队列模块（`backend/src/shared/message/message.module.ts`）

当前代码检测到 `REDIS_URL` 后仍返回 `DatabaseMessageService`，需替换为 Bull 队列：

```typescript
import { BullModule, InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

if (redisUrl) {
  logger.log('[Message] Using Bull queue (Redis)');
  // 替换为 BullMessageService（需自行实现 MessageService 接口）
  return new BullMessageService(queue);
}
```

`BullMessageService` 需实现 `message.interface.ts` 中的 `MessageService` 接口（`publish/subscribe`）。

#### 6. Redis 接入后的收益

| 能力 | 降级方案 | Redis 方案 |
|:---|:---|:---|
| 缓存 | 进程内 LRU，重启丢失，多实例不共享 | 分布式共享，持久化 |
| 消息队列 | DB 轮询，5 秒延迟，高并发有压力 | 毫秒级投递，支持重试、死信队列 |
| 分布式锁 | 数据库乐观锁，仅单实例安全 | Redlock，多实例安全 |
| 实时通知 | SSE 轮询，10 秒延迟 | WebSocket + Redis Pub/Sub，实时推送 |

---

### 二、替换本地文件存储为对象存储

当前文件存储在本地磁盘，多实例部署时文件无法共享。

#### 1. 安装 AWS S3 SDK（兼容阿里云 OSS / 腾讯云 COS）

```bash
cd backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

#### 2. 修改环境变量

```env
STORAGE_TYPE=s3
S3_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com   # 阿里云 OSS
S3_BUCKET=mfg-platform-files
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=cn-hangzhou
```

#### 3. 修改文件服务

`backend/src/shared/storage/` 目录下实现 `S3StorageService`，实现与 `LocalStorageService` 相同的接口（`upload/download/delete/getUrl`），然后在 `StorageModule` 中根据 `STORAGE_TYPE` 环境变量切换。

---

### 三、环境变量配置说明

项目通过 `.env` 文件区分开发和生产环境，NestJS 会根据 `NODE_ENV` 自动加载对应文件。

#### 文件优先级

```
.env.production     ← NODE_ENV=production 时加载
.env.development    ← NODE_ENV=development 时加载（默认）
.env                ← 兜底，所有环境都会加载
```

#### 开发环境（`.env.development`）

```env
NODE_ENV=development
PORT=3000

# 数据库 - 开发环境可以用简单密码
DATABASE_TYPE=mysql
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=newuser
DATABASE_PASS=newpassword!!
DATABASE_NAME=mfg_platform

# JWT - 开发环境用固定密钥方便调试
JWT_SECRET=mfg-platform-dev-secret-2026
JWT_EXPIRES_IN=8h

# Redis（不配置则自动降级为内存缓存 + DB 轮询）
# REDIS_URL=redis://localhost:6379

# 文件存储
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./data/files
```

#### 生产环境（`.env.production`）

```env
NODE_ENV=production
PORT=3000

# 数据库 - 生产环境必须使用强密码，用户名也建议改掉
DATABASE_TYPE=mysql
DATABASE_HOST=localhost          # 如果数据库在其他机器，填对应 IP
DATABASE_PORT=3306
DATABASE_USER=mfg_app            # 建议用专用账号，不要用 root
DATABASE_PASS=Str0ng#P@ss_2026!  # 必须替换为强密码
DATABASE_NAME=mfg_platform

# JWT - 生产环境必须用随机强密钥
# 生成命令：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=在这里填入随机生成的64位十六进制字符串
JWT_EXPIRES_IN=8h

# Redis（有 Redis 时取消注释）
# REDIS_URL=redis://localhost:6379
# 有密码时：REDIS_URL=redis://:yourpassword@localhost:6379

# 文件存储
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=/data/files   # 生产环境用绝对路径
```

#### 生产环境数据库账号创建

```sql
-- 创建专用账号（只允许本地连接）
CREATE USER 'mfg_app'@'localhost' IDENTIFIED BY 'Str0ng#P@ss_2026!';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER
  ON mfg_platform.* TO 'mfg_app'@'localhost';
FLUSH PRIVILEGES;

-- 如果后端和数据库不在同一台机器，把 localhost 换成后端服务器 IP
-- CREATE USER 'mfg_app'@'192.168.1.100' IDENTIFIED BY '...';
```

#### 强密码生成

```bash
# 生成数据库密码（24位随机）
node -e "console.log(require('crypto').randomBytes(18).toString('base64'))"

# 生成 JWT_SECRET（64位十六进制）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **注意**：`.env.production` 不要提交到 Git，在 `.gitignore` 中加入：
> ```
> .env.production
> .env.local
> ```

---

## 开发环境搭建

### 前置条件

- Node.js ≥ 18（推荐 20 LTS）
- MySQL 8.0
- Git

### 1. 克隆项目

```bash
git clone <repo-url>
cd mfg-platform
```

### 2. 初始化数据库

登录 MySQL，创建数据库和用户：

```sql
CREATE DATABASE mfg_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'newuser'@'localhost' IDENTIFIED BY 'newpassword!!';
GRANT ALL PRIVILEGES ON mfg_platform.* TO 'newuser'@'localhost';
FLUSH PRIVILEGES;
```

### 3. 配置后端环境变量

```bash
cd backend
cp .env.example .env.development
```

编辑 `.env.development`，确认以下配置：

```env
NODE_ENV=development
PORT=3000

DATABASE_TYPE=mysql
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=newuser
DATABASE_PASS=newpassword!!
DATABASE_NAME=mfg_platform

JWT_SECRET=mfg-platform-dev-secret-2026
JWT_EXPIRES_IN=8h

STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./data/files
```

### 4. 安装后端依赖并同步数据库表结构

```bash
cd backend
npm install
npm run db:sync
```

`db:sync` 会先编译再执行 `scripts/db-sync.mjs`，自动根据 TypeORM Entity 创建/更新表结构。

### 5. 初始化基础数据

表结构同步完成后，执行初始化脚本创建必要的基础数据：

```bash
cd backend
node scripts/init-data.mjs
```

该脚本会创建以下数据：

| 数据 | 内容 |
|:---|:---|
| 默认租户 | 租户编码 `DEFAULT`，名称"默认租户" |
| 管理员角色 | `ADMIN` 系统管理员 |
| 管理员账号 | 用户名 `admin`，密码 `Admin@123456` |

初始化成功后输出：
```
🎉 初始化完成！登录信息如下：
  租户编码：DEFAULT
  用户名：  admin
  密码：    Admin@123456
```

### 6. 启动后端开发服务器

```bash
cd backend
npm run start:dev
```

后端启动后访问：
- API 服务：`http://localhost:3000`
- Swagger 文档：`http://localhost:3000/api/docs`

### 7. 安装前端依赖并启动

```bash
cd frontend
npm install
npm run dev
```

前端启动后访问：`http://localhost:5173`

### 8. 导入演示数据（可选）

如需快速体验各模块功能，可在后端服务启动后导入演示数据：

```bash
cd backend
node scripts/seed-data.mjs
```

演示数据涵盖：

| 模块 | 内容 |
|:---|:---|
| PLM | 物料分类（原材料/半成品/成品）、物料主数据、BOM、工艺路线 |
| SCM | 供应商、采购订单 |
| ERP | 客户、销售订单 |
| MES | 生产工单 |
| QMS | 检验标准、不合格品记录 |
| WMS | 仓库、安全库存 |
| APS | 资源、日历、优先级规则 |
| EAM | 设备台账、维保策略 |

---

## 常用开发命令

### 后端

```bash
cd backend

npm run start:dev      # 开发模式（热重载）
npm run start:debug    # 调试模式
npm run build          # 编译 TypeScript
npm run test           # 运行单元测试
npm run test:cov       # 运行测试并生成覆盖率报告
npm run test:e2e       # 运行后端 E2E 测试
npm run lint           # ESLint 检查并自动修复
npm run format         # Prettier 格式化
npm run db:sync        # 同步数据库表结构
```

### 前端

```bash
cd frontend

npm run dev            # 开发模式
npm run build          # 生产构建
npm run preview        # 预览生产构建
npm run type-check     # TypeScript 类型检查
```

### E2E 测试

```bash
cd e2e-test

# BOM 管理专项测试
node bom.test.mjs                  # headless 模式
node bom.test.mjs --headed         # 可视化模式（调试用）

# PLM 模块完整测试
node plm.test.mjs

# 运行所有模块测试
node run-all.mjs
```

---

## 生产环境部署

### 环境要求

- Windows Server 2019 / Linux（Ubuntu 20.04+）
- Node.js ≥ 18
- MySQL 8.0
- Nginx（反向代理）
- PM2（进程守护）

### 1. 安装 PM2

```bash
npm install -g pm2
```

### 2. 构建后端

```bash
cd backend
npm install --production=false
npm run build
```

构建产物在 `backend/dist/`。

### 3. 配置生产环境变量

在 `backend/` 目录创建 `.env.production`：

```env
NODE_ENV=production
PORT=3000

DATABASE_TYPE=mysql
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=newuser
DATABASE_PASS=<强密码>
DATABASE_NAME=mfg_platform

JWT_SECRET=<随机生成的强密钥，至少32位>
JWT_EXPIRES_IN=8h

STORAGE_TYPE=local
STORAGE_LOCAL_PATH=/data/files
```

> 生产环境 `JWT_SECRET` 必须替换为随机强密钥，可用以下命令生成：
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 4. 同步生产数据库

```bash
cd backend
NODE_ENV=production node dist/scripts/db-sync.mjs
```

### 5. 用 PM2 启动后端

```bash
cd backend
pm2 start dist/main.js --name mfg-backend --env production
pm2 save
pm2 startup   # 设置开机自启
```

常用 PM2 命令：

```bash
pm2 list                    # 查看进程列表
pm2 logs mfg-backend        # 查看日志
pm2 restart mfg-backend     # 重启
pm2 stop mfg-backend        # 停止
pm2 monit                   # 监控面板
```

### 6. 构建前端

```bash
cd frontend
npm install
npm run build
```

构建产物在 `frontend/dist/`。

### 7. 配置 Nginx

创建 `/etc/nginx/conf.d/mfg-platform.conf`（Linux）或对应 Windows 路径：

```nginx
server {
    listen 80;
    server_name your-domain.com;   # 替换为实际域名或 IP

    # 前端静态文件
    root /path/to/mfg-platform/frontend/dist;
    index index.html;

    # 前端路由（Vue Router history 模式）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    # 文件上传大小限制
    client_max_body_size 50M;
}
```

重载 Nginx：

```bash
nginx -t          # 检查配置
nginx -s reload   # 重载
```

### 8. 文件存储目录权限

```bash
mkdir -p /data/files
# Linux 下设置权限
chown -R node-user:node-user /data/files
chmod 755 /data/files
```

### 9. 验证部署

```bash
# 检查后端健康状态
curl http://localhost:3000/api/health

# 检查 PM2 进程
pm2 list

# 查看后端日志
pm2 logs mfg-backend --lines 50
```

---

## 项目架构说明

### 多租户设计

所有业务表均包含 `tenant_id` 字段，通过 JWT 中的租户信息自动隔离数据。
`TenantContext` 使用 AsyncLocalStorage 在请求生命周期内传递租户上下文，无需每个方法手动传参。

### 模块划分

```
backend/src/modules/
├── auth/         # 认证、权限、角色、审计日志
├── base/         # 基础主数据（组织、计量单位、批次）
├── plm/          # 产品生命周期（物料、BOM、工艺路线、ECR/ECN）
├── mes/          # 制造执行（工单、报工、质检、在制品）
├── wms/          # 仓储管理（库存、出入库、盘点）
├── qms/          # 质量管理（检验、不合格品、CAPA）
├── erp/          # 企业资源（销售订单、成本、财务凭证）
├── scm/          # 供应链（采购、供应商、收货）
├── aps/          # 高级排程（排程、MRP、产能）
├── eam/          # 设备管理（台账、维保、故障）
├── conversion/   # 转换引擎（单位换算、追溯）
└── event/        # 事件总线（跨模块消息）
```

### API 规范

- 所有接口前缀：`/api/v1/`
- 认证方式：`Authorization: Bearer <token>`
- 租户标识：`X-Tenant-Id: <tenantId>`（或从 JWT 自动解析）
- 响应格式：`{ data: T, message: string, statusCode: number }`

---

## 开发规范

- 数据库表结构第 2 周冻结，之后只加字段不改结构
- 每 2 周必须有一个可运行版本
- 前端 CRUD 页面优先用低代码表单引擎生成，核心交互页面手写
- APS 排程算法：基于优先级规则的有限产能正向排程（不做遗传算法）
- 适配器框架（金蝶/用友）放最后开发

---

## 常见问题

**Q: 启动后端报数据库连接失败？**
检查 MySQL 服务是否启动，`.env.development` 中的连接信息是否正确，用户是否有对应数据库的权限。

**Q: 前端请求 API 报 401？**
确认已登录且 localStorage 中有 `token`，检查 token 是否过期（默认 8 小时）。

**Q: db:sync 报错？**
先确认 `npm run build` 成功，再执行 `npm run db:sync`。如果表结构冲突，可在 MySQL 中手动删除对应表后重新同步。

**Q: 文件上传失败？**
检查 `STORAGE_LOCAL_PATH` 目录是否存在且有写入权限。
