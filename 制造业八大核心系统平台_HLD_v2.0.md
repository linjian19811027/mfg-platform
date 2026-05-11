# 制造业八大核心系统平台
## 概要设计文档（HLD）v2.0

**版本**：v2.0  
**日期**：2026-04-14  
**依据**：PRD v1.1（全功能版）  
**团队**：3人全栈（Node.js）  
**架构风格**：弹性模块化单体（可降级运行，可平滑演进）  

---

## 文档结构

1. [设计目标与约束](#1-设计目标与约束)
2. [整体架构](#2-整体架构)
3. [弹性基础设施设计](#3-弹性基础设施设计)
4. [转换引擎内核](#4-转换引擎内核)
5. [八大系统模块](#5-八大系统模块)
6. [多租户与数据隔离](#6-多租户与数据隔离)
7. [适配器框架](#7-适配器框架)
8. [部署架构](#8-部署架构)
9. [技术选型汇总](#9-技术选型汇总)
10. [关键设计决策](#10-关键设计决策)
11. [附件](#附件)
    - 附件A：弹性架构降级策略详解
    - 附件B：单体到微服务演进路线图

---

## 1. 设计目标与约束

### 1.1 设计目标

| 目标 | 说明 |
|:---|:---|
| **可组装** | 八大系统可独立部署，也可任意组合，数据无缝衔接 |
| **可扩展** | 新行业通过配置实现，不改动内核代码 |
| **可集成** | 通过适配器对接外部系统，内核不受污染 |
| **弹性运行** | 基础设施缺失时自动降级，核心功能不中断 |
| **平滑演进** | 现在省人（3人够用），以后省事（可拆分微服务） |
| **高质量** | 功能完整，体验优秀，性能达标 |

### 1.2 设计约束

| 约束 | 说明 |
|:---|:---|
| **团队规模** | 3人全栈，Node.js技术栈 |
| **运维能力** | 无专职DBA，无运维人员 |
| **部署环境** | 客户服务器配置不一（2核4G到8核16G） |
| **基础设施** | 部分客户无Redis，需降级运行 |
| **数据隔离** | 多租户，支持SaaS和私有化 |
| **性能要求** | 追溯查询<3秒，支持100工位并发 |

---

## 2. 整体架构

### 2.1 逻辑架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         接入层                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Web管理端 │ │ PDA工位端 │ │ 大屏看板 │ │ 开放API │ │ 适配器  │   │
│  │ (Vue3)  │ │(UniApp) │ │(Vue3)  │ │(REST)  │ │(多协议)│   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         网关层                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  API Gateway (Nginx)                                     │   │
│  │  统一认证 │ 限流 │ 路由 │ 负载均衡 │ 日志 │ 监控           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       业务服务层                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  PLM模块 │ │  SCM模块 │ │  ERP模块 │ │  APS模块 │ │  MES模块 │   │
│  │  (物料)  │ │  (采购)  │ │  (财务)  │ │  (排程)  │ │  (执行)  │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────────┐   │
│  │  WMS模块 │ │  QMS模块 │ │  EAM模块 │ │    转换引擎内核      │   │
│  │  (仓储)  │ │  (质量)  │ │  (设备)  │ │  (Conversion Core)  │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────────────────┘   │
│                                                                  │
│  技术栈：NestJS + TypeORM + MySQL + Redis(可选) + Bull(可选)    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       基础设施层（弹性）                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  MySQL  │ │ Redis   │ │ 本地缓存 │ │ 数据库轮询│ │ 内存队列 │   │
│  │ (必需)  │ │(增强)  │ │(降级)  │ │(降级)  │ │(降级)  │   │
│  │ 主数据   │ │ 缓存/队列│ │ LRU   │ │ 异步任务 │ │ 同步执行 │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 部署模式

| 模式 | 基础设施 | 适用场景 |
|:---|:---|:---|
| **完整模式** | MySQL + Redis + MinIO | 标准部署，性能最优 |
| **降级模式** | MySQL only | 小型服务器，功能完整性能降级 |
| **开发模式** | SQLite + 内存缓存 | 本地开发，零配置启动 |

---

## 3. 弹性基础设施设计

### 3.1 核心原则

> **MySQL是唯一必需基础设施，其他都是增强。**

系统启动时自动检测基础设施，动态选择实现：

```typescript
// infrastructure.config.ts
export const infrastructureConfig = {
  // 自动检测并配置
  cache: process.env.REDIS_URL ? 'redis' : 'memory',
  queue: process.env.REDIS_URL ? 'bull' : 'database',
  session: process.env.REDIS_URL ? 'redis' : 'jwt',
  lock: process.env.REDIS_URL ? 'redlock' : 'database',

  // 启动时检测日志
  onDetect: (infra) => {
    console.log('=== Infrastructure Detection ===');
    console.log(`MySQL: ✅ ${infra.mysql.version}`);
    console.log(`Redis: ${infra.redis ? '✅' : '⚠️  fallback to memory'}`);
    console.log(`Mode: ${infra.redis ? '🟢 FULL' : '🟡 DEGRADED'}`);
  }
};
```

### 3.2 弹性组件矩阵

| 组件 | 完整实现（有Redis） | 降级实现（无Redis） | 切换方式 |
|:---|:---|:---|:---|
| **缓存** | Redis缓存（持久化） | 内存LRU缓存（进程级） | 自动 |
| **消息队列** | Bull队列（实时异步） | 数据库轮询（5秒延迟） | 自动 |
| **Session** | Redis存储 | JWT无状态 + 数据库 | 自动 |
| **分布式锁** | Redlock（跨实例） | 数据库乐观锁（单实例） | 自动 |
| **实时通知** | WebSocket + Redis Pub/Sub | SSE轮询（10秒） | 自动 |
| **文件存储** | MinIO | 本地文件系统 | 配置 |

### 3.3 降级后的系统能力

| 能力 | 完整模式 | 降级模式 | 业务影响 |
|:---|:---|:---|:---|
| 缓存命中率 | 95%+ | 70%（进程重启丢失） | 查询稍慢 |
| 消息实时性 | 毫秒级 | 5秒级 | 延迟可接受 |
| 并发控制 | 跨实例 | 单实例 | 不支持集群部署 |
| 用户踢出 | 实时 | JWT 8小时过期 | 安全稍降 |
| 系统可用性 | 99.9% | 99.5% | 基本可用 |

**关键承诺**：降级模式下，**核心业务流程100%可用**，只是性能和实时性降低。

---

## 4. 转换引擎内核

### 4.1 核心概念

**转换（Conversion）**：物料形态变化的基本单元

```typescript
// 转换定义（模板）
interface ConversionDefinition {
  id: string;
  code: string;                    // 转换编码
  name: string;                    // 转换名称
  version: number;                 // 版本号

  inputs: ConversionInput[];       // 输入物料清单
  outputs: ConversionOutput[];     // 输出物料清单
  resources: ResourceRequirement[]; // 设备/人力/能源
  parameters: ProcessParameter[];  // 工艺参数
  qualityRequirements: QualityRequirement[];
  timeParams: TimeParameters;      // 标准工时
  costParams: CostParameters;      // 成本分摊规则
}

// 转换实例（执行记录）
interface ConversionInstance {
  id: string;
  definitionId: string;
  businessType: 'WORK_ORDER' | 'PROCUREMENT' | 'SALES' | 'TRANSFER';
  businessId: string;

  actualInputs: ActualInput[];     // 实际投入（批次追溯）
  actualOutputs: ActualOutput[];   // 实际产出
  actualResources: ActualResource[];
  qualityRecords: QualityRecord[];
  timeline: Timeline;              // 计划/实际时间
  costCollection: CostCollection;
  status: ConversionStatus;
  traceability: TraceabilityChain;
}
```

### 4.2 数据模型

详见数据库详细设计文档（后续产出）。

### 4.3 追溯链生成

```typescript
// 正向追溯：成品 → 原料 → 供应商
async function traceForward(batchId: string): Promise<TraceabilityNode> {
  const batch = await getBatch(batchId);
  const node: TraceabilityNode = { batch, children: [] };

  const conversion = await getConversionByOutputBatch(batchId);
  if (conversion) {
    for (const input of conversion.actualInputs) {
      node.children.push(await traceForward(input.batchId));
    }
  }
  return node;
}

// 反向追溯：原料 → 成品 → 客户
async function traceBackward(batchId: string): Promise<TraceabilityNode> {
  const batch = await getBatch(batchId);
  const node: TraceabilityNode = { batch, usedIn: [] };

  const conversions = await getConversionsByInputBatch(batchId);
  for (const conversion of conversions) {
    for (const output of conversion.actualOutputs) {
      node.usedIn.push(await traceBackward(output.batchId));
    }
  }
  return node;
}
```

---

## 5. 八大系统模块

### 5.1 模块通用结构

```
modules/plm/                       
├── controllers/                   # HTTP接口层
├── services/                      # 业务逻辑层
├── entities/                      # 数据实体
├── dtos/                          # 数据传输对象
├── events/                        # 领域事件定义
├── subscribers/                   # 事件处理器
├── plm.module.ts                  # 模块定义
└── README.md                      # 模块说明
```

### 5.2 系统间接口契约

| 衔接 | 事件类型 | 数据内容 | 触发方式 |
|:---|:---|:---|:---|
| PLM→全系统 | `MATERIAL_CREATED` | 物料主数据 | 变更推送 |
| PLM→全系统 | `BOM_REVISED` | BOM版本变更 | 变更推送 |
| ERP→APS | `SALES_ORDER_CREATED` | 销售订单 | 订单下达 |
| APS→MES | `WORK_ORDER_RELEASED` | 派工单 | 排程完成 |
| MES→ERP | `PRODUCTION_COMPLETED` | 完工实绩+成本 | 完工触发 |
| WMS→MES | `MATERIAL_AVAILABLE` | 物料可用 | 库存变更 |
| MES→WMS | `MATERIAL_ISSUE_REQUEST` | 领料申请 | 工单开工 |
| QMS↔MES | `INSPECTION_*` | 检验标准/结果 | 检验节点 |
| EAM→APS/MES | `EQUIPMENT_STATUS_CHANGED` | 设备状态 | 状态变更 |

---

## 6. 多租户与数据隔离

### 6.1 方案：单库+租户ID字段

```sql
-- 所有业务表增加tenant_id
CREATE TABLE conversion_instance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,  -- 租户标识
    business_id VARCHAR(50),
    -- ... 其他字段
    INDEX idx_tenant_business (tenant_id, business_id),
    INDEX idx_tenant_status (tenant_id, status)
) ENGINE=InnoDB;
```

### 6.2 自动附加租户条件

```typescript
// tenant.interceptor.ts
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    // 自动附加到所有查询
    if (tenantId) {
      TenantContext.setCurrentTenant(tenantId);
    }

    return next.handle();
  }
}

// 在Repository中自动使用
@Injectable()
export class ConversionRepository extends Repository<ConversionInstance> {
  find(options?: FindManyOptions<ConversionInstance>) {
    const tenantId = TenantContext.getCurrentTenant();
    return super.find({
      ...options,
      where: {
        ...options?.where,
        tenantId  // 自动附加
      }
    });
  }
}
```

---

## 7. 适配器框架

### 7.1 设计目标
- 内核纯净：八大系统不感知外部系统
- 快速适配：配置+少量脚本实现对接
- 双向可选：支持只接下行、只接上行、或双向

### 7.2 架构

```
┌─────────────────────────────────────────┐
│  适配器配置中心（界面+YAML）              │
│  连接配置 │ 映射规则 │ 调度策略 │ 监控告警   │
└─────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│ 协议适配器 │   │ 数据映射器 │   │ 调度引擎  │
│ • REST  │   │ • 字段映射 │   │ • 定时   │
│ • SOAP  │   │ • 编码转换 │   │ • 实时   │
│ • DB    │   │ • 单位换算 │   │ • 批量   │
│ • File  │   │ • 数据校验 │   │         │
└─────────┘   └─────────┘   └─────────┘
```

### 7.3 MVP适配器

| 优先级 | 适配器 | 对接系统 |
|:---:|:---|:---|
| P0 | 金蝶K3Cloud | ERP双向 |
| P0 | 用友U8/U9 | ERP双向 |
| P1 | 第三方MES | MES单向取数 |
| P1 | 电商平台 | 淘宝/京东/拼多多 |

---

## 8. 部署架构

### 8.1 容器化部署（Docker Compose）

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://user:pass@mysql:3306/mfg_platform
      - REDIS_URL=${REDIS_URL:-}  # 可选，空则降级
    depends_on:
      - mysql
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G

  mysql:
    image: mysql:8.0
    volumes:
      - mysql_data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=rootpass
      - MYSQL_DATABASE=mfg_platform

  # Redis可选，不配置则应用降级运行
  redis:
    image: redis:7-alpine
    profiles: ["full"]  # docker-compose --profile full up
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

### 8.2 启动检测

```bash
# 启动日志示例
$ docker-compose up

[APP] 2026-04-14 14:30:00 INFO  === Infrastructure Detection ===
[APP] 2026-04-14 14:30:00 INFO  MySQL: ✅ 8.0.32 (connected)
[APP] 2026-04-14 14:30:00 WARN  Redis: ⚠️  not configured, fallback to memory
[APP] 2026-04-14 14:30:00 INFO  Cache: memory (LRU)
[APP] 2026-04-14 14:30:00 INFO  Queue: database (polling 5s)
[APP] 2026-04-14 14:30:00 INFO  Session: JWT (stateless)
[APP] 2026-04-14 14:30:00 INFO  Lock: database (optimistic)
[APP] 2026-04-14 14:30:00 INFO  Mode: 🟡 DEGRADED (functional but limited)
[APP] 2026-04-14 14:30:01 INFO  Server listening on port 3000
```

---

## 9. 技术选型汇总

### 后端

| 技术 | 选型 | 版本 | 用途 | 弹性降级 |
|:---|:---|:---:|:---|:---|
| 运行时 | Node.js LTS | 20.x | 执行环境 | - |
| 框架 | NestJS | 10.x | 核心框架 | - |
| ORM | TypeORM | 0.3.x | 数据库操作 | SQLite（开发）|
| 数据库 | **MySQL** | 8.0+ | 主存储 | **必需** |
| 缓存 | Redis / 内存 | 7.x | 缓存 | 内存LRU |
| 队列 | Bull / 数据库 | 4.x | 异步任务 | 数据库轮询 |
| Session | Redis / JWT | - | 会话 | JWT无状态 |
| 锁 | Redlock / 数据库 | - | 并发控制 | 数据库乐观锁 |
| 搜索 | MySQL Full-Text | - | 简单搜索 | - |
| 文件 | MinIO / 本地 | latest | 对象存储 | 本地文件 |

### 前端

| 端 | 技术 | 版本 |
|:---|:---|:---:|
| 管理端 | Vue 3 + Vite + Ant Design Vue | 3.4/5/4.x |
| PDA端 | UniApp (Vue 3) | 3.0 |
| 大屏端 | Vue 3 + DataV | 2.x |

---

## 10. 关键设计决策

| 决策 | 选择 | 理由 |
|:---|:---|:---|
| 架构风格 | **弹性模块化单体** | 3人团队，可降级运行，未来可拆分 |
| 数据库 | **MySQL 8.0** | 团队熟悉，无DBA，运维简单 |
| 多租户 | **单库+tenant_id** | 简单有效，备份恢复容易 |
| 消息队列 | **Bull/数据库轮询** | 无需额外部署，自动降级 |
| 缓存 | **Redis/内存LRU** | 自动检测，无缝切换 |
| 前端 | **Vue 3生态** | 国内强，学习曲线平缓 |
| 部署 | **Docker Compose** | 简单，客户可自行维护 |

---

## 附件

### 附件A：弹性架构降级策略详解

详见 [附件A：弹性架构降级策略详解](#附件A-弹性架构降级策略详解)

### 附件B：单体到微服务演进路线图

详见 [附件B：单体到微服务演进路线图](#附件B-单体到微服务演进路线图)

---

**文档状态**：概要设计确认中  
**下一步**：详细设计（数据库设计、API设计、前端设计）

---

# 附件A：弹性架构降级策略详解

## A.1 缓存层降级

### 完整实现：Redis缓存

```typescript
@Injectable()
export class RedisCacheService implements CacheProvider {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async get(key: string) {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl = 3600) {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string) {
    await this.redis.del(key);
  }
}
```

### 降级实现：内存LRU缓存

```typescript
@Injectable()
export class MemoryCacheService implements CacheProvider {
  private cache = new Map<string, CacheItem>();
  private maxSize = 1000;  // 最大条目数

  async get(key: string): Promise<any> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expireAt) {
      this.cache.delete(key);
      return null;
    }

    // LRU：更新访问顺序
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  async set(key: string, value: any, ttl = 3600): Promise<void> {
    // LRU淘汰
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expireAt: Date.now() + ttl * 1000
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  // 进程退出时清空（数据不持久化）
  onApplicationShutdown() {
    this.cache.clear();
  }
}
```

### 配置切换

```typescript
// cache.module.ts
@Module({
  providers: [
    {
      provide: 'CACHE_PROVIDER',
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get('REDIS_URL');
        if (redisUrl) {
          console.log('[Cache] Using Redis');
          return new RedisCacheService(new Redis(redisUrl));
        } else {
          console.log('[Cache] Using Memory LRU (degraded)');
          return new MemoryCacheService();
        }
      },
      inject: [ConfigService]
    }
  ],
  exports: ['CACHE_PROVIDER']
})
export class CacheModule {}
```

## A.2 消息队列降级

### 完整实现：Bull队列（Redis）

```typescript
@Injectable()
export class BullMessageService implements MessageService {
  private queues = new Map<string, Queue>();

  async publish(event: DomainEvent): Promise<void> {
    const queue = this.getQueue(event.eventType);
    await queue.add(event, {
      attempts: 3,
      backoff: 'exponential',
      removeOnComplete: 100  // 保留最近100条
    });
  }

  subscribe(eventType: string, handler: Function): void {
    const queue = this.getQueue(eventType);
    queue.process(async (job) => {
      await handler(job.data);
    });
  }

  private getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      this.queues.set(name, new Queue(name, {
        redis: { host: 'localhost', port: 6379 }
      }));
    }
    return this.queues.get(name);
  }
}
```

### 降级实现：数据库轮询

```typescript
// 事件表
@Entity()
export class EventStore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventType: string;

  @Column('json')
  payload: any;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  error: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Injectable()
export class DatabaseMessageService implements MessageService {
  private handlers = new Map<string, Function[]>();

  constructor(
    @InjectRepository(EventStore)
    private readonly eventRepository: Repository<EventStore>
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    // 同步执行，不等待
    const handlers = this.handlers.get(event.eventType) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        // 同步失败，写入数据库异步重试
        await this.eventRepository.save({
          eventType: event.eventType,
          payload: event,
          status: 'PENDING'
        });
      }
    }
  }

  subscribe(eventType: string, handler: Function): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }

  // 定时轮询（每5秒）
  @Cron('*/5 * * * * *')
  async processPendingEvents(): Promise<void> {
    const events = await this.eventRepository.find({
      where: { 
        status: In(['PENDING', 'FAILED']),
        retryCount: LessThan(3)
      },
      take: 10,
      order: { createdAt: 'ASC' }
    });

    for (const event of events) {
      await this.processEvent(event);
    }
  }

  private async processEvent(event: EventStore): Promise<void> {
    event.status = 'PROCESSING';
    await this.eventRepository.save(event);

    try {
      const handlers = this.handlers.get(event.eventType) || [];
      for (const handler of handlers) {
        await handler(event.payload);
      }

      event.status = 'COMPLETED';
    } catch (err) {
      event.status = 'FAILED';
      event.error = err.message;
      event.retryCount++;
    }

    await this.eventRepository.save(event);
  }
}
```

### 降级实现：同步执行（开发环境）

```typescript
@Injectable()
export class SyncMessageService implements MessageService {
  private handlers = new Map<string, Function[]>();

  async publish(event: DomainEvent): Promise<void> {
    // 立即同步执行，不排队
    const handlers = this.handlers.get(event.eventType) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[SyncMessage] Handler error:`, err);
        // 记录日志，人工补偿
      }
    }
  }

  subscribe(eventType: string, handler: Function): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }
}
```

## A.3 Session存储降级

### 完整实现：Redis存储

```typescript
@Injectable()
export class RedisSessionService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async get(sessionId: string): Promise<SessionData> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async set(sessionId: string, data: SessionData, ttl = 7200): Promise<void> {
    await this.redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
  }

  async destroy(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }
}
```

### 降级实现：JWT无状态

```typescript
@Injectable()
export class JwtSessionService {
  constructor(private readonly config: ConfigService) {}

  sign(payload: SessionData): string {
    return jwt.sign(payload, this.config.get('JWT_SECRET'), {
      expiresIn: '8h',  // 8小时过期
      issuer: 'mfg-platform'
    });
  }

  verify(token: string): SessionData {
    try {
      return jwt.verify(token, this.config.get('JWT_SECRET')) as SessionData;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  // 无法主动踢出用户，只能等过期
  // 如需踢出，需维护黑名单（数据库或Redis）
}
```

### 降级实现：数据库存储

```typescript
@Entity()
export class Session {
  @PrimaryColumn()
  id: string;

  @Column('text')
  data: string;

  @Column()
  expireAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

@Injectable()
export class DatabaseSessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>
  ) {}

  async get(sessionId: string): Promise<SessionData> {
    const session = await this.sessionRepository.findOne({
      where: { 
        id: sessionId, 
        expireAt: MoreThan(new Date()) 
      }
    });
    return session ? JSON.parse(session.data) : null;
  }

  async set(sessionId: string, data: SessionData, ttl = 7200): Promise<void> {
    await this.sessionRepository.save({
      id: sessionId,
      data: JSON.stringify(data),
      expireAt: new Date(Date.now() + ttl * 1000)
    });
  }

  async destroy(sessionId: string): Promise<void> {
    await this.sessionRepository.delete({ id: sessionId });
  }

  // 定时清理过期Session
  @Cron('0 0 * * *')  // 每天凌晨
  async cleanup(): Promise<void> {
    await this.sessionRepository.delete({
      expireAt: LessThan(new Date())
    });
  }
}
```

## A.4 分布式锁降级

### 完整实现：Redlock（Redis）

```typescript
@Injectable()
export class RedlockService {
  private redlock: Redlock;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 10,
      retryDelay: 200,
      retryJitter: 200
    });
  }

  async acquire(key: string, ttl = 10000): Promise<Lock> {
    return this.redlock.acquire(key, ttl);
  }

  async release(lock: Lock): Promise<void> {
    await lock.release();
  }
}
```

### 降级实现：数据库乐观锁

```typescript
@Entity()
export class DistributedLock {
  @PrimaryColumn()
  lockKey: string;

  @Column()
  holderId: string;  // 持有者标识（UUID）

  @Column()
  acquiredAt: Date;

  @Column()
  expireAt: Date;  // 30秒超时
}

@Injectable()
export class DatabaseLockService {
  constructor(
    @InjectRepository(DistributedLock)
    private readonly lockRepository: Repository<DistributedLock>
  ) {}

  async acquire(key: string, ttl = 30000): Promise<string | null> {
    const holderId = uuidv4();

    try {
      await this.lockRepository.insert({
        lockKey: key,
        holderId,
        acquiredAt: new Date(),
        expireAt: new Date(Date.now() + ttl)
      });
      return holderId;  // 获取成功
    } catch (err) {
      // 唯一键冲突，获取失败
      return null;
    }
  }

  async release(key: string, holderId: string): Promise<void> {
    await this.lockRepository.delete({
      lockKey: key,
      holderId  // 只能释放自己持有的锁
    });
  }

  // 定时清理过期锁
  @Cron('*/30 * * * * *')  // 每30秒
  async cleanup(): Promise<void> {
    await this.lockRepository.delete({
      expireAt: LessThan(new Date())
    });
  }
}
```

### 降级实现：内存锁（单实例）

```typescript
@Injectable()
export class MemoryLockService {
  private locks = new Map<string, { holderId: string; expireAt: number }>();

  async acquire(key: string, ttl = 30000): Promise<string | null> {
    const existing = this.locks.get(key);
    if (existing && Date.now() < existing.expireAt) {
      return null;  // 已被占用
    }

    const holderId = uuidv4();
    this.locks.set(key, {
      holderId,
      expireAt: Date.now() + ttl
    });
    return holderId;
  }

  async release(key: string, holderId: string): Promise<void> {
    const existing = this.locks.get(key);
    if (existing && existing.holderId === holderId) {
      this.locks.delete(key);
    }
  }

  // 注意：仅适用于单实例部署！
  // 多实例时各实例内存独立，锁不生效
}
```

## A.5 降级检测与监控

```typescript
// infrastructure-health.service.ts
@Injectable()
export class InfrastructureHealthService {
  private status = {
    mysql: false,
    redis: false,
    mode: 'UNKNOWN'
  };

  constructor(
    private readonly dataSource: DataSource,
    @InjectRedis() private readonly redis?: Redis
  ) {}

  async check(): Promise<InfrastructureStatus> {
    // 检测MySQL
    try {
      await this.dataSource.query('SELECT 1');
      this.status.mysql = true;
    } catch (err) {
      this.status.mysql = false;
    }

    // 检测Redis
    if (this.redis) {
      try {
        await this.redis.ping();
        this.status.redis = true;
      } catch (err) {
        this.status.redis = false;
      }
    } else {
      this.status.redis = false;
    }

    this.status.mode = this.status.redis ? 'FULL' : 'DEGRADED';

    return this.status;
  }

  // 健康检查端点
  @Get('health')
  async healthCheck() {
    const status = await this.check();

    return {
      status: status.mysql ? (status.redis ? 'UP' : 'DEGRADED') : 'DOWN',
      components: {
        mysql: status.mysql ? 'UP' : 'DOWN',
        redis: status.redis ? 'UP' : 'DOWN'
      },
      mode: status.mode,
      timestamp: new Date().toISOString()
    };
  }
}
```

---

# 附件B：单体到微服务演进路线图

## B.1 演进原则

> **不是推翻重写，而是物理分离。现在的模块边界，就是未来的服务边界。**

## B.2 演进阶段

### Phase 1：模块化单体（现在 - 1年）

**现状**：
- 代码层面：8个模块清晰分离
- 数据库：单库，模块表前缀隔离
- 部署：单个Docker容器
- 团队：3人

**目标**：
- 打磨产品，验证市场
- 积累客户案例
- 团队熟悉业务领域

**关键产出**：
- 稳定的模块接口契约
- 完善的领域事件设计
- 清晰的模块边界

```
单体应用
├── PLM模块（代码隔离）
├── MES模块（代码隔离）
├── WMS模块（代码隔离）
├── ...其他模块
└── 共享基础设施
```

### Phase 2：数据库分离（1-2年）

**触发条件**：
- 客户数据量增长（单表>1000万行）
- 某个模块（如MES）性能瓶颈
- 需要独立扩展某个模块

**动作**：
- MES模块数据库独立（读写分离）
- 其他模块共用主库
- 跨库查询通过API或事件同步

```
┌─────────────────────────────────────────┐
│              API Gateway                 │
└─────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│  MES服务 │   │  主服务  │   │  其他   │
│ (独立DB) │   │ (主DB)  │   │ (主DB)  │
│ MySQL   │   │ MySQL   │   │ MySQL   │
└─────────┘   └─────────┘   └─────────┘
```

**技术要点**：
- 数据迁移：双写+校验+切换
- 跨服务查询：通过API而非直接JOIN
- 事务：最终一致性，Saga模式

### Phase 3：核心服务拆分（2-3年）

**触发条件**：
- 团队扩大到8-10人
- 有专职运维/DevOps
- 核心服务需要独立迭代

**拆分顺序**（按业务价值）：
1. **转换引擎服务**（核心内核，多系统依赖）
2. **MES服务**（生产执行，变化最频繁）
3. **WMS服务**（仓储，独立扩展）
4. 其他服务（PLM/ERP/QMS/EAM/SCM/APS）

```
┌─────────────────────────────────────────┐
│              API Gateway                 │
│  统一认证 │ 限流 │ 路由 │ 熔断 │ 监控     │
└─────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│ 转换引擎 │   │  MES服务 │   │  WMS服务 │
│ 服务    │   │         │   │         │
│ (核心)  │   │ (高频)  │   │ (独立)  │
└─────────┘   └─────────┘   └─────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ PLM服务 │ │ ERP服务 │ │ 其他服务 │
    └─────────┘ └─────────┘ └─────────┘
```

**基础设施**：
- Kubernetes：容器编排
- Istio：服务网格（流量管理、熔断、监控）
- Nacos/Consul：服务注册发现
- SkyWalking：链路追踪
- Prometheus+Grafana：监控告警

### Phase 4：平台化（3-5年）

**愿景**：
- 制造中台：转换引擎+公共服务
- 行业应用：线缆/建筑/机加等行业包
- 生态市场：第三方开发者接入

```
┌─────────────────────────────────────────┐
│           制造中台（核心服务）            │
│  转换引擎 │ 主数据 │ 权限 │ 流程 │ 消息    │
└─────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│ 线缆行业 │   │ 建筑行业 │   │ 机加行业 │
│ 应用包   │   │ 应用包   │   │ 应用包   │
└─────────┘   └─────────┘   └─────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
    ┌─────────┐             ┌─────────┐
    │ 第三方应用 │             │ 客户定制  │
    │ (生态市场) │             │ (低代码)  │
    └─────────┘             └─────────┘
```

## B.3 拆分检查清单

在决定拆分某个模块前，检查：

| 检查项 | 标准 | 当前状态 |
|:---|:---|:---:|
| 团队规模 | >= 8人 | ⬜ |
| 模块边界 | 接口清晰，无循环依赖 | ⬜ |
| 数据隔离 | 可独立数据库，跨模块查询<5% | ⬜ |
| 性能瓶颈 | 该模块资源占用>50% | ⬜ |
| 迭代频率 | 该模块变更频率远高于其他 | ⬜ |
| 运维能力 | 有专职DevOps或运维 | ⬜ |
| 基础设施 | K8s、服务发现、链路追踪就绪 | ⬜ |

**只有6项以上达标，才考虑拆分。**

## B.4 拆分技术方案

### 数据库拆分

```typescript
// 双写阶段（迁移中）
@Injectable()
export class DualWriteService {
  constructor(
    private readonly oldRepo: OldRepository,  // 主库
    private readonly newRepo: NewRepository   // 新库
  ) {}

  async create(data: any) {
    // 先写新库，再写旧库
    const newResult = await this.newRepo.save(data);
    try {
      await this.oldRepo.save(data);
    } catch (err) {
      // 记录不一致，人工处理
      await this.inconsistencyLog.log({ data, error: err });
    }
    return newResult;
  }
}

// 校验工具
@Injectable()
export class DataValidatorService {
  async validate() {
    // 抽样对比新旧库数据
    const samples = await this.oldRepo.sample(1000);
    for (const sample of samples) {
      const newData = await this.newRepo.findById(sample.id);
      if (!this.isEqual(sample, newData)) {
        await this.reportMismatch(sample, newData);
      }
    }
  }
}
```

### 服务拆分

```typescript
// 原单体中的MES模块
@Module({
  imports: [TypeOrmModule.forFeature([MES entities])],
  controllers: [MESController],
  providers: [MESService]
})
export class MESModule {}

// 拆分为独立服务后
// 1. 新建mes-service项目
// 2. 复制MES模块代码
// 3. 数据库独立配置
// 4. 暴露HTTP/gRPC接口
// 5. 原单体通过HTTP客户端调用

// 原单体中的调用方式变更
@Injectable()
export class ProductionService {
  constructor(
    // 原：直接注入MESService
    // private readonly mesService: MESService

    // 新：通过HTTP客户端调用
    private readonly mesClient: MESHttpClient
  ) {}

  async createWorkOrder(data: CreateWorkOrderDTO) {
    // return this.mesService.create(data);
    return this.mesClient.post('/work-orders', data);
  }
}
```

## B.5 演进风险控制

| 风险 | 应对 |
|:---|:---|
| 拆分过早 | 坚持检查清单，不满足不拆分 |
| 数据不一致 | 双写+校验+补偿机制 |
| 性能下降（网络开销） | 批量接口、缓存、异步 |
| 故障扩散 | 熔断、限流、降级 |
| 复杂度爆炸 | 保持服务数量<10个，避免过细拆分 |

---

**总结**：
- **现在**：模块化单体，3人搞定，快速迭代
- **未来**：按需拆分，平滑演进，不推倒重来
- **关键**：现在的模块边界设计，决定未来的拆分难度
