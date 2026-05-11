# 制造业八大核心系统平台
## 详细设计文档（DDD）v1.0

**版本**：v1.0  
**日期**：2026-04-14  
**依据**：HLD v2.0（含附件）  
**技术栈**：NestJS + TypeORM + MySQL 8.0 + Redis（可选）+ Vue 3  

---

## 文档结构

1. [数据库详细设计](#1-数据库详细设计)
   - 1.1 命名规范
   - 1.2 核心表设计（转换引擎）
   - 1.3 八大系统表设计
   - 1.4 索引设计
   - 1.5 分区策略
2. [API详细设计](#2-api详细设计)
   - 2.1 接口规范
   - 2.2 认证授权
   - 2.3 核心API列表
   - 2.4 请求响应示例
3. [前端详细设计](#3-前端详细设计)
   - 3.1 技术选型
   - 3.2 组件库设计
   - 3.3 页面结构
   - 3.4 状态管理
4. [关键算法设计](#4-关键算法设计)
   - 4.1 排程算法
   - 4.2 成本分摊算法
   - 4.3 追溯链生成算法
5. [补充设计（v1.1新增）](#5-补充设计v11新增)
   - 5.1 基础主数据表设计（批次/组织/单位）
   - 5.2 权限系统表设计
   - 5.3 SCM模块表设计
   - 5.4 ERP模块表设计
   - 5.5 APS模块表设计
   - 5.6 EAM模块表设计
   - 5.7 文件存储设计
   - 5.8 事件总线表设计
   - 5.9 补充API列表（SCM/ERP/APS/EAM/权限）

---

## 1. 数据库详细设计

### 1.1 命名规范

| 对象 | 规范 | 示例 |
|:---|:---|:---|
| 表名 | 小写+下划线，模块前缀 | `mes_work_order` |
| 字段名 | 小写+下划线 | `created_at` |
| 主键 | `id`，BIGINT自增 | `id BIGINT PRIMARY KEY AUTO_INCREMENT` |
| 外键 | 引用表名+`_id` | `material_id` |
| 租户字段 | `tenant_id`，VARCHAR(50) | `tenant_id VARCHAR(50) NOT NULL` |
| 时间字段 | `created_at`/`updated_at` | `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` |
| 状态字段 | 枚举或VARCHAR | `status VARCHAR(20)` |
| 索引名 | `idx_`+表名+字段名 | `idx_mes_work_order_tenant_status` |

### 1.2 核心表设计（转换引擎）

#### 1.2.1 转换定义表（conversion_definition）

```sql
CREATE TABLE conversion_definition (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    tenant_id VARCHAR(50) NOT NULL COMMENT '租户ID',
    code VARCHAR(50) NOT NULL COMMENT '转换编码',
    name VARCHAR(100) NOT NULL COMMENT '转换名称',
    version INT NOT NULL DEFAULT 1 COMMENT '版本号',
    type VARCHAR(20) NOT NULL COMMENT '类型：PRODUCTION/PROCUREMENT/SALES/TRANSFER',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/OBSOLETE',
    organization_id BIGINT COMMENT '组织ID',

    -- 时间参数（JSON存储灵活配置）
    time_params JSON COMMENT '时间参数：{std_hours, setup_time, teardown_time}',

    -- 成本参数
    cost_params JSON COMMENT '成本参数：{cost_center_id, allocation_rule}',

    -- 扩展字段
    attributes JSON COMMENT '扩展属性',

    -- 审计字段
    created_by BIGINT COMMENT '创建人',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_by BIGINT COMMENT '更新人',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 约束
    UNIQUE KEY uk_cd_tenant_code_version (tenant_id, code, version),
    INDEX idx_cd_tenant_status (tenant_id, status),
    INDEX idx_cd_organization (organization_id)
) ENGINE=InnoDB COMMENT='转换定义表（工艺模板）';
```

#### 1.2.2 转换定义输入表（cd_input）

```sql
CREATE TABLE cd_input (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    cd_id BIGINT NOT NULL COMMENT '转换定义ID',
    material_id BIGINT NOT NULL COMMENT '物料ID',
    quantity DECIMAL(18, 6) NOT NULL COMMENT '数量',
    uom_id BIGINT NOT NULL COMMENT '单位ID',
    is_key_input TINYINT(1) DEFAULT 1 COMMENT '是否关键输入',
    loss_rate DECIMAL(5, 4) DEFAULT 0 COMMENT '损耗率',
    sequence INT DEFAULT 0 COMMENT '顺序',
    attributes JSON COMMENT '扩展属性',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_cdi_cd_id (cd_id),
    INDEX idx_cdi_material (material_id),
    FOREIGN KEY (cd_id) REFERENCES conversion_definition(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='转换定义-输入物料';
```

#### 1.2.3 转换定义输出表（cd_output）

```sql
CREATE TABLE cd_output (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    cd_id BIGINT NOT NULL COMMENT '转换定义ID',
    material_id BIGINT NOT NULL COMMENT '物料ID',
    quantity DECIMAL(18, 6) NOT NULL COMMENT '数量（比例）',
    uom_id BIGINT NOT NULL COMMENT '单位ID',
    is_main_output TINYINT(1) DEFAULT 1 COMMENT '是否主产出',
    yield_rate DECIMAL(5, 4) DEFAULT 1 COMMENT '收率',
    sequence INT DEFAULT 0 COMMENT '顺序',
    attributes JSON COMMENT '扩展属性',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_cdo_cd_id (cd_id),
    INDEX idx_cdo_material (material_id),
    FOREIGN KEY (cd_id) REFERENCES conversion_definition(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='转换定义-输出物料';
```

#### 1.2.4 转换实例表（conversion_instance）

```sql
CREATE TABLE conversion_instance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    tenant_id VARCHAR(50) NOT NULL COMMENT '租户ID',

    -- 关联定义
    definition_id BIGINT NOT NULL COMMENT '转换定义ID',
    definition_version INT NOT NULL COMMENT '定义版本',

    -- 业务上下文
    business_type VARCHAR(20) NOT NULL COMMENT '业务类型',
    business_id VARCHAR(50) NOT NULL COMMENT '业务单号',
    business_no VARCHAR(50) COMMENT '业务编号（显示用）',
    organization_id BIGINT COMMENT '组织ID',

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED' COMMENT '状态：PLANNED/RELEASED/RUNNING/COMPLETED/CLOSED',

    -- 时间轴
    planned_start TIMESTAMP NULL COMMENT '计划开始',
    planned_end TIMESTAMP NULL COMMENT '计划结束',
    actual_start TIMESTAMP NULL COMMENT '实际开始',
    actual_end TIMESTAMP NULL COMMENT '实际结束',

    -- 成本归集（汇总）
    material_cost DECIMAL(18, 4) DEFAULT 0 COMMENT '材料成本',
    labor_cost DECIMAL(18, 4) DEFAULT 0 COMMENT '人工成本',
    overhead_cost DECIMAL(18, 4) DEFAULT 0 COMMENT '制造费用',
    total_cost DECIMAL(18, 4) DEFAULT 0 COMMENT '总成本',

    -- 质量结果
    quality_status VARCHAR(20) COMMENT '质量状态：PASSED/FAILED',

    -- 扩展
    attributes JSON COMMENT '扩展属性',

    -- 审计
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- 约束和索引
    UNIQUE KEY uk_ci_tenant_business (tenant_id, business_type, business_id),
    INDEX idx_ci_tenant_status (tenant_id, status),
    INDEX idx_ci_definition (definition_id),
    INDEX idx_ci_planned_time (planned_start, planned_end),
    INDEX idx_ci_actual_time (actual_start, actual_end),
    INDEX idx_ci_organization (organization_id),
    INDEX idx_ci_quality (quality_status)
) ENGINE=InnoDB COMMENT='转换实例表（执行记录）';
```

#### 1.2.5 转换实例输入表（ci_input）

```sql
CREATE TABLE ci_input (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    ci_id BIGINT NOT NULL COMMENT '转换实例ID',
    material_id BIGINT NOT NULL COMMENT '物料ID',
    batch_id BIGINT COMMENT '物料批次ID',
    planned_qty DECIMAL(18, 6) COMMENT '计划数量',
    actual_qty DECIMAL(18, 6) COMMENT '实际数量',
    uom_id BIGINT NOT NULL COMMENT '单位ID',
    is_consumed TINYINT(1) DEFAULT 0 COMMENT '是否已消耗',
    consumed_at TIMESTAMP NULL COMMENT '消耗时间',
    attributes JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_cii_ci_id (ci_id),
    INDEX idx_cii_material (material_id),
    INDEX idx_cii_batch (batch_id),
    FOREIGN KEY (ci_id) REFERENCES conversion_instance(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='转换实例-实际输入';
```

#### 1.2.6 转换实例输出表（ci_output）

```sql
CREATE TABLE ci_output (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    ci_id BIGINT NOT NULL COMMENT '转换实例ID',
    material_id BIGINT NOT NULL COMMENT '物料ID',
    batch_id BIGINT COMMENT '产出批次ID',
    planned_qty DECIMAL(18, 6) COMMENT '计划数量',
    actual_qty DECIMAL(18, 6) COMMENT '实际数量',
    scrap_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '报废数量',
    uom_id BIGINT NOT NULL COMMENT '单位ID',
    quality_status VARCHAR(20) COMMENT '质量状态',
    attributes JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_cio_ci_id (ci_id),
    INDEX idx_cio_material (material_id),
    INDEX idx_cio_batch (batch_id),
    FOREIGN KEY (ci_id) REFERENCES conversion_instance(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='转换实例-实际输出';
```

### 1.3 八大系统表设计

#### 1.3.1 PLM模块

**物料主数据表（plm_material）**

```sql
CREATE TABLE plm_material (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL COMMENT '物料编码',
    name VARCHAR(200) NOT NULL COMMENT '物料名称',
    specification VARCHAR(500) COMMENT '规格型号',
    type VARCHAR(20) NOT NULL COMMENT '类型：RAW原材料/SEMI半成品/FINISHED成品',
    category_id BIGINT COMMENT '分类ID',
    uom_id BIGINT NOT NULL COMMENT '主单位ID',

    -- 行业扩展字段（JSON存储）
    attributes JSON COMMENT '扩展属性：{conductor_section, voltage_level, insulation_thickness}',

    -- 状态
    status VARCHAR(20) DEFAULT 'ACTIVE' COMMENT '状态：DESIGN/ACTIVE/OBSOLETE',

    -- 图纸文档
    drawing_url VARCHAR(500) COMMENT '图纸URL',
    doc_url VARCHAR(500) COMMENT '文档URL',

    -- 成本
    std_cost DECIMAL(18, 4) COMMENT '标准成本',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_plm_material_tenant_code (tenant_id, code),
    INDEX idx_plm_material_tenant_type (tenant_id, type),
    INDEX idx_plm_material_category (category_id),
    INDEX idx_plm_material_status (status)
) ENGINE=InnoDB COMMENT='物料主数据';
```

**BOM表（plm_bom）**

```sql
CREATE TABLE plm_bom (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    material_id BIGINT NOT NULL COMMENT '成品物料ID',
    version INT NOT NULL DEFAULT 1 COMMENT '版本号',
    status VARCHAR(20) DEFAULT 'ACTIVE' COMMENT '状态',
    effective_date DATE COMMENT '生效日期',
    expiry_date DATE COMMENT '失效日期',
    is_default TINYINT(1) DEFAULT 0 COMMENT '是否默认版本',

    -- 成本
    material_cost DECIMAL(18, 4) COMMENT '材料成本',
    labor_cost DECIMAL(18, 4) COMMENT '人工成本',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_plm_bom_tenant_material_version (tenant_id, material_id, version),
    INDEX idx_plm_bom_material (material_id),
    INDEX idx_plm_bom_effective (effective_date, expiry_date),
    FOREIGN KEY (material_id) REFERENCES plm_material(id)
) ENGINE=InnoDB COMMENT='BOM主表';
```

**BOM明细表（plm_bom_line）**

```sql
CREATE TABLE plm_bom_line (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    bom_id BIGINT NOT NULL COMMENT 'BOM ID',
    sequence INT NOT NULL COMMENT '行号',
    material_id BIGINT NOT NULL COMMENT '子物料ID',
    quantity DECIMAL(18, 6) NOT NULL COMMENT '用量',
    uom_id BIGINT NOT NULL COMMENT '单位',
    loss_rate DECIMAL(5, 4) DEFAULT 0 COMMENT '损耗率',
    is_substitute TINYINT(1) DEFAULT 0 COMMENT '是否替代料',
    parent_line_id BIGINT COMMENT '父行ID（多级BOM）',
    reference_designator VARCHAR(100) COMMENT '位号',

    INDEX idx_plm_bom_line_bom (bom_id),
    INDEX idx_plm_bom_line_material (material_id),
    FOREIGN KEY (bom_id) REFERENCES plm_bom(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='BOM明细';
```

#### 1.3.2 MES模块

**生产工单表（mes_work_order）**

```sql
CREATE TABLE mes_work_order (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    wo_no VARCHAR(50) NOT NULL COMMENT '工单号',
    wo_type VARCHAR(20) DEFAULT 'STANDARD' COMMENT '类型：STANDARD/REWORK/SUBCONTRACT',

    -- 来源
    source_type VARCHAR(20) COMMENT '来源类型：APS/ERP/MANUAL',
    source_id VARCHAR(50) COMMENT '来源单号',

    -- 产品
    material_id BIGINT NOT NULL COMMENT '产品ID',
    bom_id BIGINT COMMENT 'BOM版本',
    routing_id BIGINT COMMENT '工艺路线',

    -- 数量
    planned_qty DECIMAL(18, 6) NOT NULL COMMENT '计划数量',
    completed_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '完工数量',
    scrap_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '报废数量',
    uom_id BIGINT NOT NULL,

    -- 时间
    planned_start DATE COMMENT '计划开工',
    planned_end DATE COMMENT '计划完工',
    actual_start TIMESTAMP NULL COMMENT '实际开工',
    actual_end TIMESTAMP NULL COMMENT '实际完工',

    -- 状态
    status VARCHAR(20) DEFAULT 'RELEASED' COMMENT '状态：RELEASED/IN_PROGRESS/COMPLETED/CLOSED',
    priority INT DEFAULT 5 COMMENT '优先级1-10',

    -- 工作中心
    work_center_id BIGINT COMMENT '工作中心',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_mes_wo_tenant_no (tenant_id, wo_no),
    INDEX idx_mes_wo_tenant_status (tenant_id, status),
    INDEX idx_mes_wo_material (material_id),
    INDEX idx_mes_wo_planned_time (planned_start, planned_end),
    INDEX idx_mes_wo_priority (priority)
) ENGINE=InnoDB COMMENT='生产工单';
```

**工单工序表（mes_work_order_operation）**

```sql
CREATE TABLE mes_work_order_operation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    wo_id BIGINT NOT NULL COMMENT '工单ID',
    sequence INT NOT NULL COMMENT '工序序号',
    operation_id BIGINT NOT NULL COMMENT '工序ID',
    operation_name VARCHAR(100) COMMENT '工序名称',

    -- 资源
    work_center_id BIGINT COMMENT '工作中心',
    equipment_id BIGINT COMMENT '指定设备',

    -- 时间
    planned_hours DECIMAL(8, 2) COMMENT '计划工时',
    actual_hours DECIMAL(8, 2) COMMENT '实际工时',

    -- 数量
    planned_qty DECIMAL(18, 6) COMMENT '计划数量',
    completed_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '完工数量',
    scrap_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '报废数量',

    -- 状态
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT '状态：PENDING/IN_PROGRESS/COMPLETED',

    -- 时间戳
    actual_start TIMESTAMP NULL,
    actual_end TIMESTAMP NULL,

    INDEX idx_mes_woo_wo (wo_id),
    INDEX idx_mes_woo_sequence (sequence),
    INDEX idx_mes_woo_status (status),
    FOREIGN KEY (wo_id) REFERENCES mes_work_order(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='工单工序';
```

**生产报工记录表（mes_production_report）**

```sql
CREATE TABLE mes_production_report (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    wo_id BIGINT NOT NULL COMMENT '工单ID',
    woo_id BIGINT COMMENT '工序ID',

    -- 报工类型
    report_type VARCHAR(20) NOT NULL COMMENT '类型：START/COMPLETE/SCRAP/TRANSFER',

    -- 数量
    completed_qty DECIMAL(18, 6) DEFAULT 0,
    scrap_qty DECIMAL(18, 6) DEFAULT 0,
    uom_id BIGINT,

    -- 人员设备
    operator_id BIGINT COMMENT '操作工',
    equipment_id BIGINT COMMENT '设备',

    -- 时间
    report_time TIMESTAMP NOT NULL COMMENT '报工时间',
    shift_id BIGINT COMMENT '班次',

    -- 关联批次
    input_batch_ids JSON COMMENT '投入批次',
    output_batch_id BIGINT COMMENT '产出批次',

    -- 异常
    exception_type VARCHAR(50) COMMENT '异常类型',
    exception_reason VARCHAR(500) COMMENT '异常原因',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_mes_pr_wo (wo_id),
    INDEX idx_mes_pr_woo (woo_id),
    INDEX idx_mes_pr_time (report_time),
    INDEX idx_mes_pr_operator (operator_id)
) ENGINE=InnoDB COMMENT='生产报工记录';
```

#### 1.3.3 WMS模块

**库存记录表（wms_inventory）**

```sql
CREATE TABLE wms_inventory (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    material_id BIGINT NOT NULL COMMENT '物料ID',
    batch_id BIGINT COMMENT '批次ID',
    location_id BIGINT NOT NULL COMMENT '库位ID',

    -- 数量
    quantity DECIMAL(18, 6) NOT NULL COMMENT '数量',
    available_qty DECIMAL(18, 6) NOT NULL COMMENT '可用数量',
    locked_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '锁定数量',
    uom_id BIGINT NOT NULL,

    -- 状态
    status VARCHAR(20) DEFAULT 'AVAILABLE' COMMENT '状态：AVAILABLE/QUARANTINE/LOCKED',

    -- 质量
    quality_status VARCHAR(20) DEFAULT 'UNINSPECTED' COMMENT '质量状态',

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_wms_inv_tenant_material_batch_loc (tenant_id, material_id, batch_id, location_id),
    INDEX idx_wms_inv_material (material_id),
    INDEX idx_wms_inv_location (location_id),
    INDEX idx_wms_inv_status (status)
) ENGINE=InnoDB COMMENT='库存记录';
```

**出入库记录表（wms_stock_transaction）**

```sql
CREATE TABLE wms_stock_transaction (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    tx_no VARCHAR(50) NOT NULL COMMENT '交易单号',
    tx_type VARCHAR(20) NOT NULL COMMENT '类型：RECEIPT/ISSUE/TRANSFER/ADJUST',

    -- 物料
    material_id BIGINT NOT NULL,
    batch_id BIGINT,

    -- 库位
    from_location_id BIGINT COMMENT '来源库位',
    to_location_id BIGINT COMMENT '目标库位',

    -- 数量
    quantity DECIMAL(18, 6) NOT NULL COMMENT '数量（正数入库，负数出库）',
    uom_id BIGINT NOT NULL,

    -- 来源
    source_type VARCHAR(20) COMMENT '来源类型：PO/WO/SO',
    source_id VARCHAR(50) COMMENT '来源单号',

    -- 操作
    operator_id BIGINT COMMENT '操作人',
    tx_time TIMESTAMP NOT NULL COMMENT '交易时间',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_wms_tx_tenant_no (tenant_id, tx_no),
    INDEX idx_wms_tx_material (material_id),
    INDEX idx_wms_tx_time (tx_time),
    INDEX idx_wms_tx_source (source_type, source_id)
) ENGINE=InnoDB COMMENT='库存交易记录';
```

#### 1.3.4 QMS模块

**检验记录表（qms_inspection_record）**

```sql
CREATE TABLE qms_inspection_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    ir_no VARCHAR(50) NOT NULL COMMENT '检验单号',
    inspection_type VARCHAR(20) NOT NULL COMMENT '类型：IQC/IPQC/FQC/OQC',

    -- 检验对象
    material_id BIGINT NOT NULL,
    batch_id BIGINT COMMENT '批次',
    wo_id BIGINT COMMENT '关联工单',

    -- 结果
    result VARCHAR(20) NOT NULL COMMENT '结果：PASSED/FAILED/CONCESSION',
    disposition VARCHAR(20) COMMENT '处置：RELEASE/REWORK/SCRAP/CONCESSION',

    -- 人员时间
    inspector_id BIGINT COMMENT '检验员',
    inspection_time TIMESTAMP NOT NULL,

    -- 备注
    remarks VARCHAR(1000),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_qms_ir_tenant_no (tenant_id, ir_no),
    INDEX idx_qms_ir_material (material_id),
    INDEX idx_qms_ir_type (inspection_type),
    INDEX idx_qms_ir_result (result),
    INDEX idx_qms_ir_time (inspection_time)
) ENGINE=InnoDB COMMENT='检验记录';
```

### 1.4 索引设计原则

#### 1.4.1 必选索引

| 场景 | 索引类型 | 示例 |
|:---|:---|:---|
| 租户隔离 | 复合索引首位 | `(tenant_id, ...)` |
| 主键查询 | 主键索引 | `PRIMARY KEY (id)` |
| 唯一约束 | 唯一索引 | `UNIQUE KEY uk_xxx` |
| 外键关联 | 普通索引 | `INDEX idx_xxx_id` |
| 时间范围 | 复合索引 | `(tenant_id, created_at)` |
| 状态过滤 | 普通索引 | `INDEX idx_status` |

#### 1.4.2 慢查询优化索引

```sql
-- 追溯查询优化（高频）
CREATE INDEX idx_ci_trace 
ON conversion_instance(tenant_id, business_type, business_id, status);

-- 物料库存查询优化
CREATE INDEX idx_wms_inv_query 
ON wms_inventory(tenant_id, material_id, status, available_qty);

-- 工单进度查询优化
CREATE INDEX idx_mes_woo_progress 
ON mes_work_order_operation(wo_id, status, sequence);

-- 检验记录查询优化
CREATE INDEX idx_qms_ir_batch 
ON qms_inspection_record(tenant_id, batch_id, inspection_type);
```

### 1.5 分区策略

#### 1.5.1 时间分区（大数据量表）

```sql
-- 转换实例表按月分区（预计年增1000万条）
CREATE TABLE conversion_instance (
    -- ... 字段定义
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB
PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at)) (
    PARTITION p202401 VALUES LESS THAN (202402),
    PARTITION p202402 VALUES LESS THAN (202403),
    -- ...
    PARTITION p202412 VALUES LESS THAN (202501),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 自动添加分区事件
DELIMITER //
CREATE EVENT add_monthly_partition
ON SCHEDULE EVERY 1 MONTH
DO
BEGIN
    -- 添加下下个月分区
    SET @next_month = DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 2 MONTH), '%Y%m');
    SET @sql = CONCAT('ALTER TABLE conversion_instance ADD PARTITION (PARTITION p', 
                      @next_month, ' VALUES LESS THAN (', 
                      DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 3 MONTH), '%Y%m'), '))');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END //
DELIMITER ;
```

#### 1.5.2 归档策略

```sql
-- 3年前数据归档到历史表
CREATE TABLE conversion_instance_archive LIKE conversion_instance;

-- 归档脚本（每月执行）
INSERT INTO conversion_instance_archive 
SELECT * FROM conversion_instance 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 YEAR);

DELETE FROM conversion_instance 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 YEAR);
```

---

## 2. API详细设计

### 2.1 接口规范

#### 2.1.1 RESTful规范

| 操作 | HTTP方法 | URL | 说明 |
|:---|:---|:---|:---|
| 查询列表 | GET | `/api/v1/mes/work-orders` | 支持分页、筛选、排序 |
| 查询详情 | GET | `/api/v1/mes/work-orders/{id}` | 返回完整详情 |
| 创建 | POST | `/api/v1/mes/work-orders` | 返回201 + Location头 |
| 更新 | PUT | `/api/v1/mes/work-orders/{id}` | 全量更新 |
| 部分更新 | PATCH | `/api/v1/mes/work-orders/{id}` | 部分字段更新 |
| 删除 | DELETE | `/api/v1/mes/work-orders/{id}` | 软删除 |
| 批量操作 | POST | `/api/v1/mes/work-orders/batch` | 批量创建/更新/删除 |

#### 2.1.2 通用请求参数

```typescript
// 分页参数
interface PaginationParams {
  page?: number;        // 页码，默认1
  pageSize?: number;    // 每页条数，默认20，最大100
  sort?: string;        // 排序字段，如"-created_at"表示倒序
}

// 筛选参数（URL Query）
// GET /api/v1/mes/work-orders?status=IN_PROGRESS&priority=1,2&plannedStart_gte=2024-01-01

// 操作符
// _eq: 等于
// _ne: 不等于
// _gt: 大于
// _gte: 大于等于
// _lt: 小于
// _lte: 小于等于
// _in: 在列表中
// _like: 模糊匹配
```

#### 2.1.3 通用响应格式

```typescript
// 成功响应
interface SuccessResponse<T> {
  code: 200;
  message: 'success';
  data: T;
  timestamp: string;
  requestId: string;
}

// 分页响应
interface PaginatedResponse<T> {
  code: 200;
  message: 'success';
  data: {
    list: T[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
  timestamp: string;
  requestId: string;
}

// 错误响应
interface ErrorResponse {
  code: number;        // HTTP状态码
  errorCode: string;   // 业务错误码，如"MES_WORK_ORDER_NOT_FOUND"
  message: string;     // 错误信息
  details?: any;       // 详细错误
  timestamp: string;
  requestId: string;
}
```

### 2.2 认证授权

#### 2.2.1 JWT认证

```typescript
// 登录接口
POST /api/v1/auth/login
Request:
{
  "username": "admin",
  "password": "hashed_password",
  "tenantCode": "tenant_a"  // 租户标识
}

Response:
{
  "code": 200,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 28800,  // 8小时
    "tokenType": "Bearer",
    "user": {
      "id": 1,
      "username": "admin",
      "realName": "管理员",
      "tenantId": "tenant_a",
      "roles": ["ADMIN", "PRODUCTION_MANAGER"]
    }
  }
}

// 后续请求头
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
X-Tenant-ID: tenant_a
```

#### 2.2.2 权限控制

```typescript
// RBAC权限模型
// 接口装饰器
@Controller('api/v1/mes/work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkOrderController {

  @Post()
  @Roles('PRODUCTION_MANAGER', 'WORKSHOP_SUPERVISOR')
  @Permissions('mes:work-order:create')
  create(@Body() dto: CreateWorkOrderDTO) {
    return this.service.create(dto);
  }

  @Get(':id')
  @Roles('PRODUCTION_MANAGER', 'WORKSHOP_SUPERVISOR', 'OPERATOR')
  @Permissions('mes:work-order:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
```

### 2.3 核心API列表

#### 2.3.1 PLM模块

| 接口 | 方法 | URL | 说明 |
|:---|:---|:---|:---|
| 创建物料 | POST | `/api/v1/plm/materials` | 创建物料主数据 |
| 查询物料列表 | GET | `/api/v1/plm/materials` | 分页查询 |
| 查询物料详情 | GET | `/api/v1/plm/materials/{id}` | 含BOM/工艺 |
| 更新物料 | PUT | `/api/v1/plm/materials/{id}` | 全量更新 |
| 创建BOM | POST | `/api/v1/plm/boms` | 创建BOM版本 |
| 查询BOM | GET | `/api/v1/plm/boms/{id}` | 含明细 |
| 创建工艺路线 | POST | `/api/v1/plm/routings` | 创建工艺 |
| 查询工艺路线 | GET | `/api/v1/plm/routings/{id}` | 含工序 |

#### 2.3.2 MES模块

| 接口 | 方法 | URL | 说明 |
|:---|:---|:---|:---|
| 创建工单 | POST | `/api/v1/mes/work-orders` | 创建生产工单 |
| 查询工单列表 | GET | `/api/v1/mes/work-orders` | 分页查询 |
| 查询工单详情 | GET | `/api/v1/mes/work-orders/{id}` | 含工序进度 |
| 开工 | POST | `/api/v1/mes/work-orders/{id}/start` | 工单开工 |
| 报工 | POST | `/api/v1/mes/work-orders/{id}/report` | 产量报工 |
| 完工 | POST | `/api/v1/mes/work-orders/{id}/complete` | 工单完工 |
| 查询追溯 | GET | `/api/v1/mes/traceability/{batchId}` | 正向追溯 |
| 反向追溯 | GET | `/api/v1/mes/traceability/reverse/{batchId}` | 反向追溯 |

#### 2.3.3 WMS模块

| 接口 | 方法 | URL | 说明 |
|:---|:---|:---|:---|
| 入库 | POST | `/api/v1/wms/receipts` | 采购/生产入库 |
| 出库 | POST | `/api/v1/wms/issues` | 领料/销售出库 |
| 库存查询 | GET | `/api/v1/wms/inventory` | 实时库存 |
| 库存明细 | GET | `/api/v1/wms/inventory/{materialId}` | 批次库位明细 |
| 盘点 | POST | `/api/v1/wms/stock-takes` | 创建盘点单 |
| 移库 | POST | `/api/v1/wms/transfers` | 库位间转移 |

### 2.4 请求响应示例

#### 2.4.1 创建生产工单

```http
POST /api/v1/mes/work-orders
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
X-Tenant-ID: tenant_a

Request:
{
  "woNo": "WO-2024-001",
  "materialId": 1001,
  "bomId": 2001,
  "routingId": 3001,
  "plannedQty": 1000,
  "uomId": 10,
  "plannedStart": "2024-01-15",
  "plannedEnd": "2024-01-20",
  "priority": 5,
  "workCenterId": 5001,
  "remark": "客户加急订单"
}

Response: 201 Created
{
  "code": 201,
  "message": "success",
  "data": {
    "id": 10001,
    "woNo": "WO-2024-001",
    "materialId": 1001,
    "materialName": "YJV-0.6/1kV-3×95",
    "plannedQty": 1000,
    "status": "RELEASED",
    "operations": [
      {
        "id": 1000101,
        "sequence": 10,
        "operationName": "拉丝",
        "status": "PENDING"
      },
      {
        "id": 1000102,
        "sequence": 20,
        "operationName": "绞线",
        "status": "PENDING"
      }
      // ...
    ],
    "createdAt": "2024-01-10T09:30:00Z",
    "createdBy": 1
  },
  "timestamp": "2024-01-10T09:30:00Z",
  "requestId": "req_abc123"
}
```

#### 2.4.2 生产报工

```http
POST /api/v1/mes/work-orders/10001/report
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

Request:
{
  "operationId": 1000101,
  "reportType": "COMPLETE",
  "completedQty": 500,
  "scrapQty": 5,
  "operatorId": 101,
  "equipmentId": 2001,
  "inputBatches": [
    {"batchId": 5001, "qty": 510}
  ],
  "outputBatch": {
    "batchNo": "B20240115-001",
    "qty": 495
  },
  "remark": "设备运行正常"
}

Response:
{
  "code": 200,
  "data": {
    "reportId": 8001,
    "woId": 10001,
    "operationId": 1000101,
    "completedQty": 500,
    "cumulativeQty": 500,  // 累计完工
    "remainingQty": 500,   // 剩余
    "nextOperationId": 1000102,  // 下道工序
    "status": "IN_PROGRESS"
  }
}
```

#### 2.4.3 追溯查询

```http
GET /api/v1/mes/traceability/B20240115-001
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

Response:
{
  "code": 200,
  "data": {
    "batchId": 6001,
    "batchNo": "B20240115-001",
    "materialId": 1001,
    "materialName": "YJV-0.6/1kV-3×95",
    "quantity": 495,
    "producedAt": "2024-01-15T14:30:00Z",
    "workOrderNo": "WO-2024-001",
    "qualityStatus": "PASSED",
    "tree": {
      "level": 0,
      "node": "成品电缆 B20240115-001",
      "children": [
        {
          "level": 1,
          "node": "绞线工序",
          "children": [
            {
              "level": 2,
              "node": "铜丝 B20240110-001 (供应商: 江铜)",
              "material": "铜丝 Φ2.6mm",
              "supplier": "江西铜业",
              "batchNo": "B20240110-001",
              "certificateNo": "JC20240110001"
            },
            {
              "level": 2,
              "node": "绝缘料 B20240112-001 (供应商: 万马)",
              "material": "PVC绝缘料",
              "supplier": "万马股份",
              "batchNo": "B20240112-001"
            }
          ]
        }
      ]
    }
  }
}
```

---

## 3. 前端详细设计

### 3.1 技术选型

| 端 | 技术 | 版本 | 用途 |
|:---|:---|:---:|:---|
| 管理端 | Vue 3 + Vite + Ant Design Vue | 3.4/5/4.x | PC管理界面 |
| PDA端 | UniApp (Vue 3) | 3.0 | 工位扫码 |
| 大屏端 | Vue 3 + DataV + ECharts | 5.x | 生产看板 |

### 3.2 组件库设计

#### 3.2.1 基础组件（管理端）

```typescript
// components/
├── Basic/
│   ├── MTable/           # 增强表格（分页、筛选、排序）
│   ├── MForm/            # 动态表单（JSON Schema驱动）
│   ├── MSearch/          # 高级搜索
│   ├── MModal/           # 模态框（可拖拽、全屏）
│   ├── MUpload/          # 文件上传（断点续传）
│   └── MPrint/           # 打印组件
├── Business/
│   ├── MaterialSelect/   # 物料选择器（带搜索、分类）
│   ├── BatchInput/       # 批次录入（扫码/手工）
│   ├── WorkOrderCard/    # 工单卡片（进度可视化）
│   ├── TraceabilityTree/ # 追溯树（交互式）
│   └── ReportChart/      # 报表图表
└── Layout/
    ├── BasicLayout/      # 基础布局（侧边栏+头部+内容）
    ├── PageHeader/       # 页面头部（标题+面包屑+操作）
    └── TenantSelector/   # 租户选择器
```

#### 3.2.2 动态表单组件

```vue
<!-- MForm.vue -->
<template>
  <a-form :model="formData" v-bind="formProps">
    <a-form-item 
      v-for="field in schema" 
      :key="field.name"
      :label="field.label"
      :rules="field.rules"
    >
      <!-- 根据类型渲染不同组件 -->
      <component 
        :is="getComponent(field.type)"
        v-model="formData[field.name]"
        v-bind="field.props"
      />
    </a-form-item>
  </a-form>
</template>

<script setup>
const props = defineProps({
  schema: Array,  // JSON Schema定义
  initialValues: Object
});

const formData = reactive(props.initialValues || {});

const getComponent = (type) => {
  const map = {
    'string': 'a-input',
    'number': 'a-input-number',
    'select': 'a-select',
    'date': 'a-date-picker',
    'datetime': 'a-date-picker',
    'material': 'MaterialSelect',  // 业务组件
    'batch': 'BatchInput',
    // ...
  };
  return map[type] || 'a-input';
};
</script>
```

### 3.3 页面结构

#### 3.3.1 管理端页面路由

```typescript
// router/modules/plm.ts
export default {
  path: '/plm',
  name: 'PLM',
  component: BasicLayout,
  meta: { title: '产品管理', icon: 'AppstoreOutlined' },
  children: [
    {
      path: 'materials',
      name: 'Materials',
      component: () => import('@/views/plm/materials/index.vue'),
      meta: { title: '物料管理', permission: 'plm:material:read' }
    },
    {
      path: 'materials/:id',
      name: 'MaterialDetail',
      component: () => import('@/views/plm/materials/detail.vue'),
      meta: { title: '物料详情', hidden: true }
    },
    {
      path: 'boms',
      name: 'BOMs',
      component: () => import('@/views/plm/boms/index.vue'),
      meta: { title: 'BOM管理', permission: 'plm:bom:read' }
    },
    {
      path: 'routings',
      name: 'Routings',
      component: () => import('@/views/plm/routings/index.vue'),
      meta: { title: '工艺路线', permission: 'plm:routing:read' }
    }
  ]
};

// router/modules/mes.ts
export default {
  path: '/mes',
  name: 'MES',
  component: BasicLayout,
  meta: { title: '生产执行', icon: 'ToolOutlined' },
  children: [
    {
      path: 'work-orders',
      name: 'WorkOrders',
      component: () => import('@/views/mes/work-orders/index.vue'),
      meta: { title: '工单管理', permission: 'mes:work-order:read' }
    },
    {
      path: 'work-orders/:id/report',
      name: 'WorkOrderReport',
      component: () => import('@/views/mes/work-orders/report.vue'),
      meta: { title: '生产报工', permission: 'mes:work-order:report' }
    },
    {
      path: 'traceability',
      name: 'Traceability',
      component: () => import('@/views/mes/traceability/index.vue'),
      meta: { title: '质量追溯', permission: 'mes:traceability:read' }
    }
  ]
};
```

#### 3.3.2 PDA端页面结构

```
pages/
├── index/index.vue           # 首页（功能入口）
├── scan/                     # 扫码模块
│   ├── index.vue             # 扫码首页
│   ├── material.vue          # 物料扫码
│   └── batch.vue             # 批次扫码
├── work-order/               # 工单模块
│   ├── list.vue              # 工单列表
│   ├── detail.vue            # 工单详情
│   ├── start.vue             # 开工
│   ├── report.vue            # 报工
│   └── complete.vue          # 完工
├── quality/                  # 质量模块
│   ├── inspection.vue        # 检验录入
│   └── exception.vue         # 异常上报
└── profile/                  # 个人中心
    └── index.vue
```

### 3.4 状态管理

#### 3.4.1 Pinia Store设计

```typescript
// stores/
├── auth.ts           # 认证状态
├── tenant.ts         # 租户状态
├── user.ts           # 用户信息
├── permission.ts     # 权限状态
├── app.ts            # 应用配置（主题、语言）
└── modules/
    ├── plm.ts        # PLM模块状态
    ├── mes.ts        # MES模块状态
    └── wms.ts        # WMS模块状态

// stores/modules/mes.ts
export const useMESStore = defineStore('mes', {
  state: () => ({
    workOrders: [],
    currentWorkOrder: null,
    operations: [],
    loading: false
  }),

  getters: {
    inProgressWorkOrders: (state) => 
      state.workOrders.filter(wo => wo.status === 'IN_PROGRESS'),

    currentOperation: (state) => 
      state.operations.find(op => op.status === 'IN_PROGRESS')
  },

  actions: {
    async fetchWorkOrders(params) {
      this.loading = true;
      try {
        const res = await api.get('/mes/work-orders', { params });
        this.workOrders = res.data.list;
        return res.data;
      } finally {
        this.loading = false;
      }
    },

    async startWorkOrder(id) {
      const res = await api.post(`/mes/work-orders/${id}/start`);
      // 更新本地状态
      const index = this.workOrders.findIndex(wo => wo.id === id);
      if (index !== -1) {
        this.workOrders[index].status = 'IN_PROGRESS';
      }
      return res.data;
    },

    async reportProduction(data) {
      const res = await api.post(`/mes/work-orders/${data.woId}/report`, data);
      // 更新工序进度
      await this.fetchOperations(data.woId);
      return res.data;
    }
  }
});
```

#### 3.4.2 API封装

```typescript
// utils/request.ts
import axios from 'axios';

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000
});

// 请求拦截器
request.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  const tenantStore = useTenantStore();

  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }
  if (tenantStore.currentTenant) {
    config.headers['X-Tenant-ID'] = tenantStore.currentTenant.id;
  }

  return config;
});

// 响应拦截器
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // 未授权，跳转登录
      router.push('/login');
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default request;

// api/modules/mes.ts
export const mesApi = {
  // 工单
  getWorkOrders: (params) => request.get('/mes/work-orders', { params }),
  getWorkOrder: (id) => request.get(`/mes/work-orders/${id}`),
  createWorkOrder: (data) => request.post('/mes/work-orders', data),
  startWorkOrder: (id) => request.post(`/mes/work-orders/${id}/start`),
  reportProduction: (id, data) => request.post(`/mes/work-orders/${id}/report`, data),

  // 追溯
  getTraceability: (batchId) => request.get(`/mes/traceability/${batchId}`),
  getReverseTraceability: (batchId) => request.get(`/mes/traceability/reverse/${batchId}`)
};
```

---

## 4. 关键算法设计

### 4.1 排程算法（APS）

#### 4.1.1 算法选择

MVP采用**启发式规则+正向排程**，非最优但可解释、可调试。

```typescript
// 排程算法
class SchedulingEngine {
  async schedule(orders: Order[], resources: Resource[], constraints: Constraints): Schedule {
    // 1. 按优先级排序订单
    const sortedOrders = this.prioritize(orders);

    const schedule: Schedule = { assignments: [] };

    for (const order of sortedOrders) {
      // 2. 获取工艺路线
      const routing = await this.getRouting(order.materialId);

      // 3. 逐工序排程
      let currentTime = new Date();

      for (const operation of routing.operations) {
        // 4. 查找可用资源
        const availableResource = this.findAvailableResource(
          operation,
          resources,
          currentTime,
          constraints
        );

        if (!availableResource) {
          // 资源不足，延迟排程
          currentTime = this.getNextAvailableTime(operation, resources);
          continue;
        }

        // 5. 计算工序时间
        const duration = this.calculateDuration(operation, order.quantity);

        // 6. 创建排程任务
        const assignment: Assignment = {
          orderId: order.id,
          operationId: operation.id,
          resourceId: availableResource.id,
          startTime: currentTime,
          endTime: new Date(currentTime.getTime() + duration * 60000)
        };

        schedule.assignments.push(assignment);

        // 7. 更新资源占用
        this.occupyResource(availableResource, assignment);

        // 8. 更新当前时间
        currentTime = assignment.endTime;
      }
    }

    return schedule;
  }

  // 优先级排序
  private prioritize(orders: Order[]): Order[] {
    return orders.sort((a, b) => {
      // 优先级权重：交期紧急度(40%) + 客户等级(30%) + 订单利润(20%) + 先到先服务(10%)
      const scoreA = this.calculatePriorityScore(a);
      const scoreB = this.calculatePriorityScore(b);
      return scoreB - scoreA;  // 降序
    });
  }

  // 查找可用资源
  private findAvailableResource(
    operation: Operation,
    resources: Resource[],
    startTime: Date,
    constraints: Constraints
  ): Resource | null {
    const candidates = resources.filter(r => 
      r.type === operation.requiredResourceType &&
      r.isAvailable(startTime, operation.duration) &&
      this.checkConstraints(r, constraints)
    );

    // 选择负荷最小的资源
    return candidates.sort((a, b) => a.load - b.load)[0] || null;
  }
}
```

### 4.2 成本分摊算法

#### 4.2.1 加权平均法

```typescript
// 成本分摊
class CostAllocationEngine {
  // 计算转换实例成本
  async calculateCost(instance: ConversionInstance): CostBreakdown {
    // 1. 材料成本（从投入物料实际成本汇总）
    const materialCost = await this.calculateMaterialCost(instance.inputs);

    // 2. 人工成本（从报工记录汇总）
    const laborCost = await this.calculateLaborCost(instance.id);

    3. 制造费用（设备折旧、能源等）
    const overheadCost = await this.calculateOverheadCost(instance);

    // 4. 总成本
    const totalCost = materialCost + laborCost + overheadCost;

    // 5. 分摊到产出
    const outputs = instance.outputs;
    const mainOutput = outputs.find(o => o.isMainOutput);
    const byProducts = outputs.filter(o => !o.isMainOutput);

    // 主产品承担全部成本（简化）
    // 或按价值比例分摊
    const allocation = this.allocateByValue(totalCost, outputs);

    return {
      materialCost,
      laborCost,
      overheadCost,
      totalCost,
      allocation
    };
  }

  // 按价值比例分摊
  private allocateByValue(totalCost: number, outputs: Output[]): Allocation[] {
    const totalValue = outputs.reduce((sum, o) => sum + o.marketValue * o.quantity, 0);

    return outputs.map(o => ({
      outputId: o.id,
      cost: totalCost * (o.marketValue * o.quantity / totalValue),
      unitCost: totalCost * (o.marketValue * o.quantity / totalValue) / o.quantity
    }));
  }
}
```

### 4.3 追溯链生成算法

#### 4.3.1 递归查询优化

```typescript
// 追溯服务
class TraceabilityService {
  // 正向追溯（成品→原料）
  async traceForward(batchId: string, maxDepth = 10): Promise<TraceabilityNode> {
    const cache = new Map<string, TraceabilityNode>();
    return this.traceForwardRecursive(batchId, maxDepth, cache);
  }

  private async traceForwardRecursive(
    batchId: string, 
    depth: number,
    cache: Map<string, TraceabilityNode>
  ): Promise<TraceabilityNode> {
    // 缓存命中
    if (cache.has(batchId)) {
      return cache.get(batchId);
    }

    const batch = await this.batchRepo.findOne({
      where: { id: batchId },
      relations: ['material', 'supplier']
    });

    const node: TraceabilityNode = {
      batchId: batch.id,
      batchNo: batch.batchNo,
      materialId: batch.materialId,
      materialName: batch.material.name,
      quantity: batch.quantity,
      producedAt: batch.producedAt,
      qualityStatus: batch.qualityStatus,
      children: []
    };

    if (depth > 0) {
      // 查找生产该批次的转换实例
      const conversion = await this.conversionRepo.findOne({
        where: { outputBatchId: batchId },
        relations: ['inputs']
      });

      if (conversion) {
        // 递归追溯输入物料
        for (const input of conversion.inputs) {
          if (input.batchId) {
            const childNode = await this.traceForwardRecursive(
              input.batchId, 
              depth - 1,
              cache
            );
            node.children.push(childNode);
          }
        }
      }
    }

    cache.set(batchId, node);
    return node;
  }

  // 反向追溯（原料→成品）
  async traceBackward(batchId: string, maxDepth = 10): Promise<TraceabilityNode> {
    const cache = new Map<string, TraceabilityNode>();
    return this.traceBackwardRecursive(batchId, maxDepth, cache);
  }

  private async traceBackwardRecursive(
    batchId: string,
    depth: number,
    cache: Map<string, TraceabilityNode>
  ): Promise<TraceabilityNode> {
    if (cache.has(batchId)) {
      return cache.get(batchId);
    }

    const batch = await this.batchRepo.findOne({
      where: { id: batchId },
      relations: ['material']
    });

    const node: TraceabilityNode = {
      batchId: batch.id,
      batchNo: batch.batchNo,
      materialId: batch.materialId,
      materialName: batch.material.name,
      quantity: batch.quantity,
      usedIn: []
    };

    if (depth > 0) {
      // 查找使用该批次的转换实例
      const conversions = await this.conversionRepo.find({
        where: { inputBatchId: batchId },
        relations: ['outputs']
      });

      for (const conversion of conversions) {
        for (const output of conversion.outputs) {
          if (output.batchId) {
            const childNode = await this.traceBackwardRecursive(
              output.batchId,
              depth - 1,
              cache
            );
            node.usedIn.push(childNode);
          }
        }
      }
    }

    cache.set(batchId, node);
    return node;
  }
}
```

---

**文档状态**：详细设计确认中（v1.1补充中）
**下一步**：开发实施（代码规范、开发环境搭建、迭代开发）


---

## 5. 补充设计（v1.1新增）

> 本章补充原v1.0遗漏的基础主数据、权限系统、SCM/ERP/APS/EAM四个模块的数据库表设计、文件存储设计、事件总线表设计及对应API列表。

---

### 5.1 基础主数据表设计

#### 5.1.1 批次主数据表（material_batch）

批次是追溯链的核心节点，所有系统的 `batch_id` 均引用此表。

```sql
CREATE TABLE material_batch (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    batch_no VARCHAR(100) NOT NULL COMMENT '批次号',
    material_id BIGINT NOT NULL COMMENT '物料ID',

    -- 来源
    source_type VARCHAR(20) NOT NULL COMMENT '来源：PURCHASE采购/PRODUCTION生产/RETURN退货/ADJUST调整',
    source_id VARCHAR(50) COMMENT '来源单号（采购单号/工单号等）',
    supplier_id BIGINT COMMENT '供应商ID（采购批次）',

    -- 数量
    initial_qty DECIMAL(18, 6) NOT NULL COMMENT '初始数量',
    current_qty DECIMAL(18, 6) NOT NULL COMMENT '当前剩余数量',
    uom_id BIGINT NOT NULL COMMENT '单位ID',

    -- 质量状态
    quality_status VARCHAR(20) DEFAULT 'UNINSPECTED'
        COMMENT '质量状态：UNINSPECTED待检/PASSED合格/FAILED不合格/CONCESSION让步接收',

    -- 时间
    produced_at TIMESTAMP NULL COMMENT '生产/到货时间',
    expire_at TIMESTAMP NULL COMMENT '有效期',

    -- 供应商批次信息
    supplier_batch_no VARCHAR(100) COMMENT '供应商批次号',
    certificate_no VARCHAR(100) COMMENT '质量证书编号',

    -- 扩展
    attributes JSON COMMENT '扩展属性（线缆：米数、盘号等）',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_batch_tenant_no (tenant_id, batch_no),
    INDEX idx_batch_material (tenant_id, material_id),
    INDEX idx_batch_source (source_type, source_id),
    INDEX idx_batch_quality (tenant_id, quality_status),
    INDEX idx_batch_supplier (supplier_id),
    FOREIGN KEY (material_id) REFERENCES plm_material(id)
) ENGINE=InnoDB COMMENT='物料批次主数据';
```

#### 5.1.2 组织架构表（sys_organization）

工厂/车间/产线/工位的层级结构，APS资源模型、MES工作中心、EAM设备位置均依赖此表。

```sql
CREATE TABLE sys_organization (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL COMMENT '组织编码',
    name VARCHAR(100) NOT NULL COMMENT '组织名称',
    type VARCHAR(20) NOT NULL COMMENT '类型：COMPANY公司/FACTORY工厂/WORKSHOP车间/LINE产线/WORKSTATION工位',
    parent_id BIGINT COMMENT '父节点ID（NULL为根节点）',
    level INT NOT NULL DEFAULT 1 COMMENT '层级深度',
    path VARCHAR(500) COMMENT '全路径（如：1/3/7/12，便于查询子树）',
    sort_order INT DEFAULT 0 COMMENT '同级排序',
    manager_id BIGINT COMMENT '负责人ID',
    status VARCHAR(20) DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE',
    attributes JSON COMMENT '扩展属性',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_org_tenant_code (tenant_id, code),
    INDEX idx_org_parent (parent_id),
    INDEX idx_org_type (tenant_id, type),
    INDEX idx_org_path (path)
) ENGINE=InnoDB COMMENT='组织架构（工厂/车间/产线/工位）';
```

#### 5.1.3 计量单位表（sys_uom）

所有表中 `uom_id` 的主数据来源，支持单位换算。

```sql
CREATE TABLE sys_uom (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(20) NOT NULL COMMENT '单位编码（如：KG/M/PCS）',
    name VARCHAR(50) NOT NULL COMMENT '单位名称（如：千克/米/件）',
    symbol VARCHAR(20) COMMENT '符号（如：kg/m/pcs）',
    category VARCHAR(20) COMMENT '类别：WEIGHT重量/LENGTH长度/VOLUME体积/COUNT计数/AREA面积',
    is_base TINYINT(1) DEFAULT 0 COMMENT '是否基准单位',
    status VARCHAR(20) DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_uom_tenant_code (tenant_id, code)
) ENGINE=InnoDB COMMENT='计量单位';

-- 单位换算关系表
CREATE TABLE sys_uom_conversion (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    from_uom_id BIGINT NOT NULL COMMENT '源单位',
    to_uom_id BIGINT NOT NULL COMMENT '目标单位',
    factor DECIMAL(18, 8) NOT NULL COMMENT '换算系数（1个源单位 = factor个目标单位）',

    UNIQUE KEY uk_uom_conv (tenant_id, from_uom_id, to_uom_id),
    FOREIGN KEY (from_uom_id) REFERENCES sys_uom(id),
    FOREIGN KEY (to_uom_id) REFERENCES sys_uom(id)
) ENGINE=InnoDB COMMENT='单位换算关系';
```

---

### 5.2 权限系统表设计

#### 5.2.1 租户表（sys_tenant）

```sql
CREATE TABLE sys_tenant (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL COMMENT '租户编码（登录时使用）',
    name VARCHAR(100) NOT NULL COMMENT '租户名称',
    status VARCHAR(20) DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/SUSPENDED/EXPIRED',
    plan VARCHAR(20) DEFAULT 'STANDARD' COMMENT '套餐：TRIAL/STANDARD/PROFESSIONAL/ENTERPRISE',
    expire_at TIMESTAMP NULL COMMENT '到期时间（NULL为永久）',
    max_users INT DEFAULT 50 COMMENT '最大用户数',
    enabled_modules JSON COMMENT '已启用模块列表（如：["PLM","MES","WMS"]）',
    contact_name VARCHAR(50) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    contact_email VARCHAR(100) COMMENT '联系邮箱',
    attributes JSON COMMENT '扩展配置',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_tenant_code (code)
) ENGINE=InnoDB COMMENT='租户表';
```

#### 5.2.2 用户表（sys_user）

```sql
CREATE TABLE sys_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    username VARCHAR(50) NOT NULL COMMENT '登录账号',
    password VARCHAR(200) NOT NULL COMMENT '密码（bcrypt加密）',
    real_name VARCHAR(50) COMMENT '真实姓名',
    phone VARCHAR(20) COMMENT '手机号',
    email VARCHAR(100) COMMENT '邮箱',
    avatar_url VARCHAR(500) COMMENT '头像URL',
    employee_no VARCHAR(50) COMMENT '工号',
    organization_id BIGINT COMMENT '所属组织（工厂/车间）',
    status VARCHAR(20) DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED/LOCKED',

    -- 安全
    password_changed_at TIMESTAMP NULL COMMENT '最后改密时间',
    login_fail_count INT DEFAULT 0 COMMENT '连续登录失败次数',
    locked_until TIMESTAMP NULL COMMENT '锁定到期时间',
    last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
    last_login_ip VARCHAR(50) COMMENT '最后登录IP',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_user_tenant_username (tenant_id, username),
    INDEX idx_user_org (organization_id),
    INDEX idx_user_status (tenant_id, status)
) ENGINE=InnoDB COMMENT='用户表';
```

#### 5.2.3 角色表（sys_role）

```sql
CREATE TABLE sys_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL COMMENT '角色编码',
    name VARCHAR(100) NOT NULL COMMENT '角色名称',
    description VARCHAR(500) COMMENT '角色描述',
    is_system TINYINT(1) DEFAULT 0 COMMENT '是否系统内置角色',
    status VARCHAR(20) DEFAULT 'ACTIVE',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_role_tenant_code (tenant_id, code)
) ENGINE=InnoDB COMMENT='角色表';

-- 用户角色关联
CREATE TABLE sys_user_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_user_role (tenant_id, user_id, role_id),
    INDEX idx_ur_user (user_id),
    INDEX idx_ur_role (role_id)
) ENGINE=InnoDB COMMENT='用户角色关联';
```

#### 5.2.4 权限表（sys_permission）

```sql
CREATE TABLE sys_permission (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(100) NOT NULL COMMENT '权限编码（如：mes:work-order:create）',
    name VARCHAR(100) NOT NULL COMMENT '权限名称',
    module VARCHAR(20) NOT NULL COMMENT '所属模块：PLM/MES/WMS等',
    type VARCHAR(20) NOT NULL COMMENT '类型：MENU菜单/BUTTON按钮/API接口',
    parent_id BIGINT COMMENT '父权限ID',
    path VARCHAR(200) COMMENT '前端路由路径或API路径',
    sort_order INT DEFAULT 0,

    UNIQUE KEY uk_perm_code (code),
    INDEX idx_perm_module (module)
) ENGINE=InnoDB COMMENT='权限定义表';

-- 角色权限关联
CREATE TABLE sys_role_permission (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,

    UNIQUE KEY uk_role_perm (tenant_id, role_id, permission_id),
    INDEX idx_rp_role (role_id)
) ENGINE=InnoDB COMMENT='角色权限关联';
```

#### 5.2.5 操作审计日志表（sys_audit_log）

```sql
CREATE TABLE sys_audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    user_id BIGINT COMMENT '操作用户',
    username VARCHAR(50) COMMENT '用户名（冗余，防止用户删除后丢失）',
    module VARCHAR(20) COMMENT '模块',
    action VARCHAR(50) COMMENT '操作类型：CREATE/UPDATE/DELETE/QUERY/LOGIN/LOGOUT',
    resource_type VARCHAR(50) COMMENT '资源类型（如：WorkOrder）',
    resource_id VARCHAR(50) COMMENT '资源ID',
    request_method VARCHAR(10) COMMENT 'HTTP方法',
    request_url VARCHAR(500) COMMENT '请求URL',
    request_body TEXT COMMENT '请求体（脱敏后）',
    response_code INT COMMENT '响应状态码',
    ip_address VARCHAR(50) COMMENT '客户端IP',
    user_agent VARCHAR(500) COMMENT '浏览器信息',
    duration_ms INT COMMENT '耗时（毫秒）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_audit_tenant_time (tenant_id, created_at),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_resource (resource_type, resource_id)
) ENGINE=InnoDB COMMENT='操作审计日志（保留180天）';
```

---

### 5.3 SCM模块表设计

#### 5.3.1 供应商表（scm_supplier）

```sql
CREATE TABLE scm_supplier (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL COMMENT '供应商编码',
    name VARCHAR(200) NOT NULL COMMENT '供应商名称',
    short_name VARCHAR(50) COMMENT '简称',
    category VARCHAR(20) COMMENT '类别：MATERIAL原材料/SERVICE服务/EQUIPMENT设备',
    grade VARCHAR(20) DEFAULT 'QUALIFIED'
        COMMENT '等级：STRATEGIC战略/PREFERRED优选/QUALIFIED合格/ELIMINATED淘汰/BLACKLIST黑名单',

    -- 基础信息
    country VARCHAR(50) COMMENT '国家',
    province VARCHAR(50) COMMENT '省份',
    city VARCHAR(50) COMMENT '城市',
    address VARCHAR(500) COMMENT '详细地址',
    website VARCHAR(200) COMMENT '官网',

    -- 联系人
    contact_name VARCHAR(50) COMMENT '主要联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    contact_email VARCHAR(100) COMMENT '联系邮箱',

    -- 财务
    tax_no VARCHAR(50) COMMENT '税号',
    bank_name VARCHAR(100) COMMENT '开户行',
    bank_account VARCHAR(50) COMMENT '银行账号',
    payment_terms VARCHAR(50) COMMENT '付款条件（如：月结30天）',
    currency VARCHAR(10) DEFAULT 'CNY' COMMENT '结算币种',

    -- 资质
    business_license_no VARCHAR(50) COMMENT '营业执照号',
    business_license_expire DATE COMMENT '营业执照到期日',
    iso_cert_no VARCHAR(50) COMMENT 'ISO认证编号',
    iso_cert_expire DATE COMMENT 'ISO认证到期日',

    -- 绩效（冗余汇总，定期更新）
    delivery_rate DECIMAL(5, 2) COMMENT '交期达成率（%）',
    quality_rate DECIMAL(5, 2) COMMENT '质量合格率（%）',
    response_score DECIMAL(3, 1) COMMENT '服务响应评分（1-10）',

    status VARCHAR(20) DEFAULT 'ACTIVE',
    attributes JSON COMMENT '扩展属性',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_scm_supplier_tenant_code (tenant_id, code),
    INDEX idx_scm_supplier_grade (tenant_id, grade),
    INDEX idx_scm_supplier_status (tenant_id, status)
) ENGINE=InnoDB COMMENT='供应商档案';
```

#### 5.3.2 采购订单表（scm_purchase_order）

```sql
CREATE TABLE scm_purchase_order (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    po_no VARCHAR(50) NOT NULL COMMENT '采购单号',
    po_type VARCHAR(20) DEFAULT 'STANDARD' COMMENT '类型：STANDARD普通/BLANKET框架/URGENT紧急',

    -- 供应商
    supplier_id BIGINT NOT NULL COMMENT '供应商ID',

    -- 来源
    source_type VARCHAR(20) COMMENT '来源：MANUAL手工/MRP系统触发/PR采购申请',
    source_id VARCHAR(50) COMMENT '来源单号',

    -- 时间
    order_date DATE NOT NULL COMMENT '下单日期',
    required_date DATE COMMENT '要求到货日期',

    -- 金额
    total_amount DECIMAL(18, 4) DEFAULT 0 COMMENT '订单总金额',
    currency VARCHAR(10) DEFAULT 'CNY',
    exchange_rate DECIMAL(10, 6) DEFAULT 1 COMMENT '汇率',

    -- 状态
    status VARCHAR(20) DEFAULT 'DRAFT'
        COMMENT '状态：DRAFT草稿/PENDING_APPROVAL审批中/APPROVED已审批/SENT已发送/CONFIRMED供应商确认/PARTIAL_RECEIVED部分到货/RECEIVED全部到货/CLOSED关闭/CANCELLED取消',

    -- 审批
    approved_by BIGINT COMMENT '审批人',
    approved_at TIMESTAMP NULL COMMENT '审批时间',

    -- 备注
    remark VARCHAR(1000),
    attributes JSON,

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_scm_po_tenant_no (tenant_id, po_no),
    INDEX idx_scm_po_supplier (supplier_id),
    INDEX idx_scm_po_status (tenant_id, status),
    INDEX idx_scm_po_date (order_date),
    FOREIGN KEY (supplier_id) REFERENCES scm_supplier(id)
) ENGINE=InnoDB COMMENT='采购订单';

-- 采购订单明细
CREATE TABLE scm_purchase_order_line (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    po_id BIGINT NOT NULL COMMENT '采购单ID',
    line_no INT NOT NULL COMMENT '行号',
    material_id BIGINT NOT NULL COMMENT '物料ID',
    quantity DECIMAL(18, 6) NOT NULL COMMENT '采购数量',
    received_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '已到货数量',
    uom_id BIGINT NOT NULL,
    unit_price DECIMAL(18, 6) COMMENT '单价',
    amount DECIMAL(18, 4) COMMENT '金额',
    required_date DATE COMMENT '要求到货日期',
    status VARCHAR(20) DEFAULT 'OPEN' COMMENT '行状态：OPEN/PARTIAL/RECEIVED/CLOSED',
    remark VARCHAR(500),

    INDEX idx_scm_pol_po (po_id),
    INDEX idx_scm_pol_material (material_id),
    FOREIGN KEY (po_id) REFERENCES scm_purchase_order(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='采购订单明细';
```

#### 5.3.3 到货记录表（scm_receipt）

```sql
CREATE TABLE scm_receipt (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    receipt_no VARCHAR(50) NOT NULL COMMENT '到货单号',
    po_id BIGINT NOT NULL COMMENT '采购单ID',
    supplier_id BIGINT NOT NULL COMMENT '供应商ID',
    receipt_date DATE NOT NULL COMMENT '到货日期',
    delivery_note_no VARCHAR(50) COMMENT '供应商送货单号',
    status VARCHAR(20) DEFAULT 'PENDING_INSPECTION'
        COMMENT '状态：PENDING_INSPECTION待检/INSPECTING检验中/ACCEPTED已入库/REJECTED已退货',
    remark VARCHAR(500),

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_scm_receipt_tenant_no (tenant_id, receipt_no),
    INDEX idx_scm_receipt_po (po_id),
    INDEX idx_scm_receipt_supplier (supplier_id),
    INDEX idx_scm_receipt_date (receipt_date)
) ENGINE=InnoDB COMMENT='采购到货记录';

-- 到货明细
CREATE TABLE scm_receipt_line (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    receipt_id BIGINT NOT NULL,
    po_line_id BIGINT COMMENT '采购单行ID',
    material_id BIGINT NOT NULL,
    received_qty DECIMAL(18, 6) NOT NULL COMMENT '到货数量',
    accepted_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '验收合格数量',
    rejected_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '拒收数量',
    uom_id BIGINT NOT NULL,
    batch_id BIGINT COMMENT '生成的批次ID',
    unit_price DECIMAL(18, 6) COMMENT '实际单价（点价结算时填写）',
    remark VARCHAR(500),

    INDEX idx_scm_rl_receipt (receipt_id),
    INDEX idx_scm_rl_material (material_id),
    FOREIGN KEY (receipt_id) REFERENCES scm_receipt(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='到货明细';
```

#### 5.3.4 采购价格协议表（scm_price_agreement）

```sql
CREATE TABLE scm_price_agreement (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    agreement_no VARCHAR(50) NOT NULL COMMENT '协议编号',
    supplier_id BIGINT NOT NULL,
    material_id BIGINT NOT NULL,
    price_type VARCHAR(20) DEFAULT 'FIXED' COMMENT '价格类型：FIXED固定/FLOATING浮动/LADDER阶梯',
    unit_price DECIMAL(18, 6) COMMENT '单价（固定价）',
    price_formula VARCHAR(500) COMMENT '价格公式（浮动价，如：LME铜价+加工费500）',
    currency VARCHAR(10) DEFAULT 'CNY',
    uom_id BIGINT NOT NULL,
    effective_date DATE NOT NULL COMMENT '生效日期',
    expiry_date DATE COMMENT '失效日期',
    min_qty DECIMAL(18, 6) COMMENT '最小起订量',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    remark VARCHAR(500),

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_scm_pa_tenant_no (tenant_id, agreement_no),
    INDEX idx_scm_pa_supplier_material (supplier_id, material_id),
    INDEX idx_scm_pa_effective (effective_date, expiry_date)
) ENGINE=InnoDB COMMENT='采购价格协议';
```

---

### 5.4 ERP模块表设计

#### 5.4.1 客户表（erp_customer）

```sql
CREATE TABLE erp_customer (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL COMMENT '客户编码',
    name VARCHAR(200) NOT NULL COMMENT '客户名称',
    short_name VARCHAR(50) COMMENT '简称',
    grade VARCHAR(20) DEFAULT 'NORMAL'
        COMMENT '等级：STRATEGIC战略/KEY重要/NORMAL一般/POTENTIAL潜在',

    -- 联系信息
    contact_name VARCHAR(50),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    address VARCHAR(500),

    -- 财务
    credit_limit DECIMAL(18, 4) DEFAULT 0 COMMENT '信用额度',
    payment_terms VARCHAR(50) COMMENT '账期（如：月结30天）',
    currency VARCHAR(10) DEFAULT 'CNY',
    tax_rate DECIMAL(5, 4) DEFAULT 0.13 COMMENT '税率',
    invoice_type VARCHAR(20) COMMENT '发票类型：VAT增值税专票/GENERAL普票',

    -- 应收
    receivable_balance DECIMAL(18, 4) DEFAULT 0 COMMENT '应收余额（冗余）',

    status VARCHAR(20) DEFAULT 'ACTIVE',
    attributes JSON,

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_erp_customer_tenant_code (tenant_id, code),
    INDEX idx_erp_customer_grade (tenant_id, grade)
) ENGINE=InnoDB COMMENT='客户档案';
```

#### 5.4.2 销售订单表（erp_sales_order）

```sql
CREATE TABLE erp_sales_order (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    so_no VARCHAR(50) NOT NULL COMMENT '销售单号',
    customer_id BIGINT NOT NULL COMMENT '客户ID',
    order_date DATE NOT NULL COMMENT '下单日期',
    required_date DATE COMMENT '要求交货日期',
    contract_no VARCHAR(50) COMMENT '合同号',
    salesperson_id BIGINT COMMENT '销售员',

    -- 金额
    total_amount DECIMAL(18, 4) DEFAULT 0,
    tax_amount DECIMAL(18, 4) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'CNY',

    -- 状态
    status VARCHAR(20) DEFAULT 'DRAFT'
        COMMENT '状态：DRAFT/CONFIRMED/IN_PRODUCTION/PARTIAL_SHIPPED/SHIPPED/INVOICED/CLOSED/CANCELLED',

    -- 来源（适配器导入时记录外部单号）
    external_so_no VARCHAR(50) COMMENT '外部系统销售单号',
    source VARCHAR(20) COMMENT '来源：MANUAL/KINGDEE/YONYOU/ECOMMERCE',

    remark VARCHAR(1000),
    attributes JSON,

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_erp_so_tenant_no (tenant_id, so_no),
    INDEX idx_erp_so_customer (customer_id),
    INDEX idx_erp_so_status (tenant_id, status),
    INDEX idx_erp_so_date (order_date),
    FOREIGN KEY (customer_id) REFERENCES erp_customer(id)
) ENGINE=InnoDB COMMENT='销售订单';

-- 销售订单明细
CREATE TABLE erp_sales_order_line (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    so_id BIGINT NOT NULL,
    line_no INT NOT NULL COMMENT '行号',
    material_id BIGINT NOT NULL,
    quantity DECIMAL(18, 6) NOT NULL COMMENT '销售数量',
    shipped_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '已发货数量',
    uom_id BIGINT NOT NULL,
    unit_price DECIMAL(18, 6) COMMENT '单价',
    discount_rate DECIMAL(5, 4) DEFAULT 0 COMMENT '折扣率',
    amount DECIMAL(18, 4) COMMENT '金额',
    required_date DATE COMMENT '行交货日期',
    status VARCHAR(20) DEFAULT 'OPEN',
    remark VARCHAR(500),

    INDEX idx_erp_sol_so (so_id),
    INDEX idx_erp_sol_material (material_id),
    FOREIGN KEY (so_id) REFERENCES erp_sales_order(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='销售订单明细';
```

#### 5.4.3 会计科目表（erp_account）

```sql
CREATE TABLE erp_account (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(20) NOT NULL COMMENT '科目编码（如：1001）',
    name VARCHAR(100) NOT NULL COMMENT '科目名称',
    parent_id BIGINT COMMENT '父科目ID',
    level INT NOT NULL DEFAULT 1 COMMENT '科目级次',
    type VARCHAR(20) NOT NULL
        COMMENT '科目类型：ASSET资产/LIABILITY负债/EQUITY权益/INCOME收入/EXPENSE费用/COST成本',
    direction VARCHAR(10) NOT NULL COMMENT '余额方向：DEBIT借/CREDIT贷',
    is_leaf TINYINT(1) DEFAULT 1 COMMENT '是否末级科目（只有末级可记账）',
    is_system TINYINT(1) DEFAULT 0 COMMENT '是否系统内置（不可删除）',
    auxiliary_types JSON COMMENT '辅助核算类型（如：["CUSTOMER","SUPPLIER","DEPARTMENT"]）',
    status VARCHAR(20) DEFAULT 'ACTIVE',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_erp_account_tenant_code (tenant_id, code),
    INDEX idx_erp_account_parent (parent_id),
    INDEX idx_erp_account_type (tenant_id, type)
) ENGINE=InnoDB COMMENT='会计科目';
```

#### 5.4.4 财务凭证表（erp_voucher）

```sql
CREATE TABLE erp_voucher (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    voucher_no VARCHAR(50) NOT NULL COMMENT '凭证号',
    voucher_type VARCHAR(20) DEFAULT 'GENERAL'
        COMMENT '凭证类型：GENERAL记账/RECEIPT收款/PAYMENT付款/TRANSFER转账',
    period VARCHAR(7) NOT NULL COMMENT '会计期间（如：2024-01）',
    voucher_date DATE NOT NULL COMMENT '凭证日期',

    -- 来源
    source_type VARCHAR(30) COMMENT '来源：MANUAL手工/MES_COMPLETE完工/SCM_RECEIPT采购入库/ERP_SALES销售',
    source_id VARCHAR(50) COMMENT '来源单号',

    -- 状态
    status VARCHAR(20) DEFAULT 'DRAFT' COMMENT '状态：DRAFT草稿/REVIEWED已审核/POSTED已过账/REVERSED已冲销',
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP NULL,
    posted_by BIGINT,
    posted_at TIMESTAMP NULL,

    total_debit DECIMAL(18, 4) DEFAULT 0 COMMENT '借方合计',
    total_credit DECIMAL(18, 4) DEFAULT 0 COMMENT '贷方合计',
    remark VARCHAR(500),

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_erp_voucher_tenant_no_period (tenant_id, voucher_no, period),
    INDEX idx_erp_voucher_period (tenant_id, period),
    INDEX idx_erp_voucher_status (tenant_id, status),
    INDEX idx_erp_voucher_source (source_type, source_id)
) ENGINE=InnoDB COMMENT='财务凭证';

-- 凭证分录
CREATE TABLE erp_voucher_entry (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    voucher_id BIGINT NOT NULL,
    line_no INT NOT NULL COMMENT '分录行号',
    account_id BIGINT NOT NULL COMMENT '科目ID',
    summary VARCHAR(200) COMMENT '摘要',
    debit_amount DECIMAL(18, 4) DEFAULT 0 COMMENT '借方金额',
    credit_amount DECIMAL(18, 4) DEFAULT 0 COMMENT '贷方金额',

    -- 辅助核算
    customer_id BIGINT COMMENT '客户（辅助核算）',
    supplier_id BIGINT COMMENT '供应商（辅助核算）',
    department_id BIGINT COMMENT '部门（辅助核算）',
    cost_center_id BIGINT COMMENT '成本中心（辅助核算）',
    material_id BIGINT COMMENT '物料（辅助核算）',

    INDEX idx_erp_ve_voucher (voucher_id),
    INDEX idx_erp_ve_account (account_id),
    FOREIGN KEY (voucher_id) REFERENCES erp_voucher(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='凭证分录';
```

#### 5.4.5 成本中心表（erp_cost_center）

```sql
CREATE TABLE erp_cost_center (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL COMMENT '成本中心编码',
    name VARCHAR(100) NOT NULL COMMENT '成本中心名称',
    type VARCHAR(20) COMMENT '类型：FACTORY工厂/WORKSHOP车间/LINE产线/PRODUCT产品',
    organization_id BIGINT COMMENT '关联组织',
    parent_id BIGINT COMMENT '父成本中心',
    status VARCHAR(20) DEFAULT 'ACTIVE',

    UNIQUE KEY uk_erp_cc_tenant_code (tenant_id, code),
    INDEX idx_erp_cc_org (organization_id)
) ENGINE=InnoDB COMMENT='成本中心';
```

---

### 5.5 APS模块表设计

#### 5.5.1 工厂日历表（aps_calendar）

```sql
CREATE TABLE aps_calendar (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL COMMENT '日历编码',
    name VARCHAR(100) NOT NULL COMMENT '日历名称',
    organization_id BIGINT COMMENT '适用组织',
    status VARCHAR(20) DEFAULT 'ACTIVE',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_aps_cal_tenant_code (tenant_id, code)
) ENGINE=InnoDB COMMENT='工厂日历';

-- 日历班次定义
CREATE TABLE aps_calendar_shift (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    calendar_id BIGINT NOT NULL,
    shift_name VARCHAR(50) NOT NULL COMMENT '班次名称（如：早班/中班/夜班）',
    start_time TIME NOT NULL COMMENT '开始时间',
    end_time TIME NOT NULL COMMENT '结束时间',
    work_hours DECIMAL(4, 2) COMMENT '有效工时（小时）',
    day_of_week JSON COMMENT '适用星期（如：[1,2,3,4,5]表示周一到周五）',

    INDEX idx_aps_shift_calendar (calendar_id),
    FOREIGN KEY (calendar_id) REFERENCES aps_calendar(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='日历班次';

-- 日历例外（节假日/加班）
CREATE TABLE aps_calendar_exception (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    calendar_id BIGINT NOT NULL,
    exception_date DATE NOT NULL COMMENT '例外日期',
    type VARCHAR(20) NOT NULL COMMENT '类型：HOLIDAY休息/OVERTIME加班',
    work_hours DECIMAL(4, 2) DEFAULT 0 COMMENT '当天有效工时（0=全天休息）',
    remark VARCHAR(200),

    INDEX idx_aps_ce_calendar_date (calendar_id, exception_date),
    FOREIGN KEY (calendar_id) REFERENCES aps_calendar(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='日历例外（节假日/加班）';
```

#### 5.5.2 资源模型表（aps_resource）

```sql
CREATE TABLE aps_resource (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL COMMENT '资源编码',
    name VARCHAR(100) NOT NULL COMMENT '资源名称',
    type VARCHAR(20) NOT NULL COMMENT '类型：MACHINE设备/LABOR人员/TOOL工装/MOLD模具',
    organization_id BIGINT COMMENT '所属组织',
    equipment_id BIGINT COMMENT '关联EAM设备ID（type=MACHINE时）',
    calendar_id BIGINT COMMENT '适用日历',

    -- 产能
    capacity DECIMAL(10, 4) DEFAULT 1 COMMENT '产能系数（1=100%）',
    efficiency DECIMAL(5, 4) DEFAULT 1 COMMENT '效率系数',

    -- 替代关系
    substitute_group VARCHAR(50) COMMENT '替代组（同组资源可互换）',
    substitute_priority INT DEFAULT 0 COMMENT '替代优先级（越小越优先）',

    -- 互斥关系（同一时间只能做一件事）
    is_exclusive TINYINT(1) DEFAULT 1 COMMENT '是否独占（1=同时只能一个任务）',

    status VARCHAR(20) DEFAULT 'AVAILABLE'
        COMMENT '状态：AVAILABLE可用/MAINTENANCE维保/BREAKDOWN故障/OFFLINE下线',

    attributes JSON,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_aps_res_tenant_code (tenant_id, code),
    INDEX idx_aps_res_org (organization_id),
    INDEX idx_aps_res_type (tenant_id, type),
    INDEX idx_aps_res_status (tenant_id, status)
) ENGINE=InnoDB COMMENT='APS资源模型';
```

#### 5.5.3 排程结果表（aps_schedule）

```sql
CREATE TABLE aps_schedule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    schedule_no VARCHAR(50) NOT NULL COMMENT '排程批次号',
    schedule_type VARCHAR(20) DEFAULT 'FORWARD'
        COMMENT '排程类型：FORWARD正向/BACKWARD反向/FINITE有限产能/INFINITE无限产能',
    status VARCHAR(20) DEFAULT 'DRAFT'
        COMMENT '状态：DRAFT草稿/PUBLISHED已发布/ARCHIVED已归档',
    scheduled_at TIMESTAMP COMMENT '排程执行时间',
    scheduled_by BIGINT COMMENT '排程人',
    horizon_start DATE COMMENT '排程起始日期',
    horizon_end DATE COMMENT '排程截止日期',
    remark VARCHAR(500),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_aps_schedule_tenant_no (tenant_id, schedule_no),
    INDEX idx_aps_schedule_status (tenant_id, status)
) ENGINE=InnoDB COMMENT='排程批次';

-- 排程任务（甘特图数据）
CREATE TABLE aps_schedule_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    schedule_id BIGINT NOT NULL COMMENT '排程批次ID',
    so_id BIGINT COMMENT '销售订单ID',
    wo_id BIGINT COMMENT '工单ID',
    operation_id BIGINT COMMENT '工序ID',
    resource_id BIGINT NOT NULL COMMENT '分配资源ID',

    -- 时间
    planned_start TIMESTAMP NOT NULL COMMENT '计划开始',
    planned_end TIMESTAMP NOT NULL COMMENT '计划结束',
    setup_start TIMESTAMP COMMENT '准备开始时间',
    setup_end TIMESTAMP COMMENT '准备结束时间',

    -- 数量
    planned_qty DECIMAL(18, 6) COMMENT '计划数量',

    -- 优先级
    priority INT DEFAULT 5,
    is_critical TINYINT(1) DEFAULT 0 COMMENT '是否关键路径',

    -- 状态（发布后同步到MES工单）
    status VARCHAR(20) DEFAULT 'PLANNED',

    INDEX idx_aps_task_schedule (schedule_id),
    INDEX idx_aps_task_resource (resource_id),
    INDEX idx_aps_task_time (planned_start, planned_end),
    FOREIGN KEY (schedule_id) REFERENCES aps_schedule(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='排程任务（甘特图数据）';
```

---

### 5.6 EAM模块表设计

#### 5.6.1 设备台账表（eam_equipment）

```sql
CREATE TABLE eam_equipment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL COMMENT '设备编码',
    name VARCHAR(100) NOT NULL COMMENT '设备名称',
    model VARCHAR(100) COMMENT '型号规格',
    serial_no VARCHAR(100) COMMENT '出厂序列号',
    manufacturer VARCHAR(100) COMMENT '制造商',
    supplier_id BIGINT COMMENT '采购供应商',

    -- 位置
    organization_id BIGINT COMMENT '所在工位/产线',
    parent_id BIGINT COMMENT '父设备ID（部件归属）',

    -- 财务
    purchase_date DATE COMMENT '购置日期',
    purchase_price DECIMAL(18, 4) COMMENT '购置原值',
    depreciation_years INT COMMENT '折旧年限',
    salvage_rate DECIMAL(5, 4) DEFAULT 0.05 COMMENT '残值率',
    net_value DECIMAL(18, 4) COMMENT '账面净值（定期更新）',

    -- 技术参数
    rated_power DECIMAL(10, 2) COMMENT '额定功率（kW）',
    technical_params JSON COMMENT '技术参数（转速/精度/产能等）',

    -- 状态
    status VARCHAR(20) DEFAULT 'RUNNING'
        COMMENT '状态：RUNNING运行/IDLE空闲/MAINTENANCE维保/BREAKDOWN故障/SCRAPPED报废',

    -- OEE（冗余，定期计算更新）
    oee_target DECIMAL(5, 4) DEFAULT 0.85 COMMENT 'OEE目标值',
    oee_actual DECIMAL(5, 4) COMMENT 'OEE实际值（最近30天）',

    qr_code VARCHAR(200) COMMENT '二维码内容',
    attributes JSON,

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_eam_equip_tenant_code (tenant_id, code),
    INDEX idx_eam_equip_org (organization_id),
    INDEX idx_eam_equip_status (tenant_id, status),
    INDEX idx_eam_equip_parent (parent_id)
) ENGINE=InnoDB COMMENT='设备台账';
```

#### 5.6.2 维保计划表（eam_maintenance_plan）

```sql
CREATE TABLE eam_maintenance_plan (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    plan_no VARCHAR(50) NOT NULL COMMENT '计划编号',
    equipment_id BIGINT NOT NULL COMMENT '设备ID',
    plan_type VARCHAR(20) NOT NULL
        COMMENT '类型：DAILY日保/WEEKLY周保/MONTHLY月保/QUARTERLY季保/ANNUAL年保',
    strategy VARCHAR(20) DEFAULT 'PERIODIC'
        COMMENT '策略：PERIODIC周期/CONDITION状态/PREDICTIVE预测',

    -- 内容
    content TEXT COMMENT '维保内容描述',
    checklist JSON COMMENT '点检项列表（[{item, standard, method}]）',
    estimated_hours DECIMAL(4, 2) COMMENT '预计工时',
    required_skills JSON COMMENT '所需技能',
    required_parts JSON COMMENT '所需备件（[{partId, qty}]）',

    -- 周期
    interval_days INT COMMENT '周期天数（PERIODIC策略）',
    last_done_at DATE COMMENT '上次执行日期',
    next_due_at DATE COMMENT '下次到期日期',

    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_eam_mp_tenant_no (tenant_id, plan_no),
    INDEX idx_eam_mp_equipment (equipment_id),
    INDEX idx_eam_mp_due (next_due_at),
    FOREIGN KEY (equipment_id) REFERENCES eam_equipment(id)
) ENGINE=InnoDB COMMENT='维保计划';

-- 维保工单（计划触发生成）
CREATE TABLE eam_maintenance_order (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    order_no VARCHAR(50) NOT NULL COMMENT '维保工单号',
    plan_id BIGINT COMMENT '来源计划ID（NULL为临时工单）',
    equipment_id BIGINT NOT NULL,
    order_type VARCHAR(20) NOT NULL
        COMMENT '类型：PREVENTIVE预防性/CORRECTIVE纠正性/EMERGENCY紧急',

    -- 时间
    planned_date DATE COMMENT '计划执行日期',
    actual_start TIMESTAMP NULL COMMENT '实际开始',
    actual_end TIMESTAMP NULL COMMENT '实际结束',

    -- 执行
    assignee_id BIGINT COMMENT '执行人',
    actual_hours DECIMAL(4, 2) COMMENT '实际工时',
    result VARCHAR(20) COMMENT '执行结果：COMPLETED/DEFERRED/CANCELLED',
    result_remark VARCHAR(1000) COMMENT '执行记录',

    -- 费用
    labor_cost DECIMAL(18, 4) DEFAULT 0,
    parts_cost DECIMAL(18, 4) DEFAULT 0,
    total_cost DECIMAL(18, 4) DEFAULT 0,

    status VARCHAR(20) DEFAULT 'PENDING'
        COMMENT '状态：PENDING待执行/IN_PROGRESS执行中/COMPLETED已完成/CANCELLED已取消',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_eam_mo_tenant_no (tenant_id, order_no),
    INDEX idx_eam_mo_equipment (equipment_id),
    INDEX idx_eam_mo_status (tenant_id, status),
    INDEX idx_eam_mo_planned (planned_date),
    FOREIGN KEY (equipment_id) REFERENCES eam_equipment(id)
) ENGINE=InnoDB COMMENT='维保工单';
```

#### 5.6.3 故障记录表（eam_failure_record）

```sql
CREATE TABLE eam_failure_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    failure_no VARCHAR(50) NOT NULL COMMENT '故障单号',
    equipment_id BIGINT NOT NULL,

    -- 故障信息
    failure_time TIMESTAMP NOT NULL COMMENT '故障发生时间',
    failure_type VARCHAR(50) COMMENT '故障类型（机械/电气/液压/软件等）',
    failure_desc TEXT COMMENT '故障现象描述',
    severity VARCHAR(20) DEFAULT 'MEDIUM'
        COMMENT '严重程度：CRITICAL严重/HIGH高/MEDIUM中/LOW低',

    -- 来源
    source VARCHAR(20) DEFAULT 'MANUAL'
        COMMENT '来源：MANUAL手工报修/MES_ALERT设备报警/AUTO自动检测',

    -- 响应与维修
    response_time TIMESTAMP NULL COMMENT '响应时间',
    repair_start TIMESTAMP NULL COMMENT '维修开始',
    repair_end TIMESTAMP NULL COMMENT '维修完成',
    recovery_time TIMESTAMP NULL COMMENT '设备恢复时间',
    repairer_id BIGINT COMMENT '维修人',
    root_cause TEXT COMMENT '根本原因分析',
    repair_action TEXT COMMENT '维修措施',
    replaced_parts JSON COMMENT '更换备件（[{partId, partName, qty}]）',

    -- 统计
    downtime_minutes INT COMMENT '停机时长（分钟）',
    repair_cost DECIMAL(18, 4) DEFAULT 0,

    status VARCHAR(20) DEFAULT 'OPEN'
        COMMENT '状态：OPEN已报修/REPAIRING维修中/REPAIRED已修复/CLOSED已关闭',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_eam_fr_tenant_no (tenant_id, failure_no),
    INDEX idx_eam_fr_equipment (equipment_id),
    INDEX idx_eam_fr_time (failure_time),
    INDEX idx_eam_fr_status (tenant_id, status),
    FOREIGN KEY (equipment_id) REFERENCES eam_equipment(id)
) ENGINE=InnoDB COMMENT='设备故障记录';
```

#### 5.6.4 备件台账表（eam_spare_part）

```sql
CREATE TABLE eam_spare_part (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL COMMENT '备件编码',
    name VARCHAR(100) NOT NULL COMMENT '备件名称',
    specification VARCHAR(200) COMMENT '规格型号',
    category VARCHAR(20) COMMENT '类别：CRITICAL关键/GENERAL通用/CONSUMABLE易损件',
    uom_id BIGINT NOT NULL,

    -- 库存
    current_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '当前库存',
    safety_qty DECIMAL(18, 6) DEFAULT 0 COMMENT '安全库存',
    location VARCHAR(100) COMMENT '存放位置',

    -- 采购
    supplier_id BIGINT COMMENT '主要供应商',
    unit_price DECIMAL(18, 4) COMMENT '参考单价',
    lead_time_days INT COMMENT '采购周期（天）',

    -- 关联设备
    applicable_equipment JSON COMMENT '适用设备列表（[equipmentId, ...]）',

    status VARCHAR(20) DEFAULT 'ACTIVE',
    attributes JSON,

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_eam_sp_tenant_code (tenant_id, code),
    INDEX idx_eam_sp_category (tenant_id, category)
) ENGINE=InnoDB COMMENT='备件台账';

-- 备件领用记录
CREATE TABLE eam_spare_part_usage (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    part_id BIGINT NOT NULL COMMENT '备件ID',
    equipment_id BIGINT COMMENT '使用设备',
    maintenance_order_id BIGINT COMMENT '关联维保工单',
    failure_record_id BIGINT COMMENT '关联故障单',
    quantity DECIMAL(18, 6) NOT NULL COMMENT '领用数量',
    unit_price DECIMAL(18, 4) COMMENT '单价',
    amount DECIMAL(18, 4) COMMENT '金额',
    used_by BIGINT COMMENT '领用人',
    used_at TIMESTAMP NOT NULL COMMENT '领用时间',
    remark VARCHAR(500),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_eam_spu_part (part_id),
    INDEX idx_eam_spu_equipment (equipment_id),
    INDEX idx_eam_spu_time (used_at)
) ENGINE=InnoDB COMMENT='备件领用记录';
```

---

### 5.7 文件存储设计

#### 5.7.1 文件元数据表（sys_file）

```sql
CREATE TABLE sys_file (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    file_key VARCHAR(200) NOT NULL COMMENT '存储Key（MinIO对象名或本地相对路径）',
    original_name VARCHAR(200) NOT NULL COMMENT '原始文件名',
    mime_type VARCHAR(100) COMMENT 'MIME类型（如：application/pdf）',
    size_bytes BIGINT COMMENT '文件大小（字节）',
    storage_type VARCHAR(20) DEFAULT 'LOCAL'
        COMMENT '存储类型：LOCAL本地/MINIO对象存储',
    bucket VARCHAR(100) COMMENT 'MinIO Bucket名称',
    url VARCHAR(500) COMMENT '访问URL（本地存储为相对路径）',
    checksum VARCHAR(64) COMMENT 'MD5校验值',

    -- 关联业务
    ref_type VARCHAR(50) COMMENT '关联业务类型（如：PLM_MATERIAL/PLM_BOM/QMS_REPORT）',
    ref_id VARCHAR(50) COMMENT '关联业务ID',

    -- 版本
    version INT DEFAULT 1 COMMENT '版本号',
    is_latest TINYINT(1) DEFAULT 1 COMMENT '是否最新版本',
    previous_id BIGINT COMMENT '上一版本文件ID',

    uploaded_by BIGINT COMMENT '上传人',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_sys_file_key (tenant_id, file_key),
    INDEX idx_sys_file_ref (ref_type, ref_id),
    INDEX idx_sys_file_tenant (tenant_id)
) ENGINE=InnoDB COMMENT='文件元数据';
```

#### 5.7.2 存储路径规范

```
# MinIO Bucket结构
{tenant_id}/
├── plm/
│   ├── materials/{material_id}/drawings/    # 物料图纸
│   ├── materials/{material_id}/docs/        # 物料文档
│   └── routings/{routing_id}/sop/           # 工艺SOP
├── qms/
│   ├── inspection-reports/{ir_no}/          # 检验报告
│   └── certificates/                        # 质量证书
├── eam/
│   └── equipment/{equipment_id}/manuals/    # 设备说明书
└── temp/                                    # 临时上传（24小时清理）

# 本地文件系统（降级模式）
/data/files/{tenant_id}/...  # 同上结构
```

#### 5.7.3 文件上传API规范

```typescript
// 上传接口
POST /api/v1/files/upload
Content-Type: multipart/form-data

FormData:
  file: File           // 文件内容
  refType: string      // 关联业务类型
  refId: string        // 关联业务ID
  version?: number     // 版本号（更新时传入）

Response:
{
  "code": 201,
  "data": {
    "id": 1001,
    "fileKey": "tenant_a/plm/materials/101/drawings/YJV-3x95.pdf",
    "originalName": "YJV-3x95图纸.pdf",
    "url": "/api/v1/files/1001/download",
    "size": 204800,
    "version": 1
  }
}

// 下载接口（支持权限控制）
GET /api/v1/files/{id}/download
Authorization: Bearer ...

// 预览接口（图片/PDF在线预览）
GET /api/v1/files/{id}/preview
```

---

### 5.8 事件总线表设计

HLD附件A中定义了降级模式下的数据库轮询队列，此处补充完整的事件存储表设计，与HLD保持一致并扩展细节。

#### 5.8.1 事件存储表（sys_event_store）

```sql
CREATE TABLE sys_event_store (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    event_id VARCHAR(36) NOT NULL COMMENT '事件唯一ID（UUID）',
    event_type VARCHAR(100) NOT NULL
        COMMENT '事件类型（如：MATERIAL_CREATED/WORK_ORDER_RELEASED/PRODUCTION_COMPLETED）',
    source_module VARCHAR(20) NOT NULL COMMENT '来源模块：PLM/MES/WMS等',
    target_module VARCHAR(20) COMMENT '目标模块（NULL=广播）',
    payload JSON NOT NULL COMMENT '事件数据',

    -- 处理状态
    status VARCHAR(20) DEFAULT 'PENDING'
        COMMENT '状态：PENDING待处理/PROCESSING处理中/COMPLETED已完成/FAILED失败/DEAD_LETTER死信',
    retry_count INT DEFAULT 0 COMMENT '重试次数',
    max_retries INT DEFAULT 3 COMMENT '最大重试次数',
    last_error TEXT COMMENT '最后一次错误信息',
    processed_at TIMESTAMP NULL COMMENT '处理完成时间',

    -- 调度
    scheduled_at TIMESTAMP NULL COMMENT '计划处理时间（延迟消息）',
    priority INT DEFAULT 5 COMMENT '优先级（1最高，10最低）',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_event_id (event_id),
    INDEX idx_event_status_time (status, created_at),
    INDEX idx_event_tenant_type (tenant_id, event_type),
    INDEX idx_event_scheduled (scheduled_at, status)
) ENGINE=InnoDB COMMENT='事件存储（消息队列降级方案）';
```

#### 5.8.2 事件订阅配置表（sys_event_subscription）

```sql
CREATE TABLE sys_event_subscription (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL COMMENT '订阅的事件类型（支持通配符：INSPECTION_*）',
    subscriber_module VARCHAR(20) NOT NULL COMMENT '订阅模块',
    handler_class VARCHAR(200) COMMENT '处理器类名（用于动态路由）',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    filter_condition JSON COMMENT '过滤条件（如：{status: "COMPLETED"}）',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_event_sub (tenant_id, event_type, subscriber_module)
) ENGINE=InnoDB COMMENT='事件订阅配置';
```

#### 5.8.3 八大系统关键事件清单

| 事件类型 | 来源模块 | 目标模块 | 触发时机 | 关键数据 |
|:---|:---:|:---:|:---|:---|
| `MATERIAL_CREATED` | PLM | ALL | 物料新建/变更发布 | materialId, code, name, version |
| `BOM_REVISED` | PLM | MES/APS/ERP | BOM版本变更 | bomId, materialId, version, changeType |
| `ROUTING_REVISED` | PLM | MES/APS | 工艺路线变更 | routingId, materialId, version |
| `PURCHASE_ORDER_APPROVED` | SCM | WMS | 采购单审批通过 | poId, supplierId, lines |
| `RECEIPT_CONFIRMED` | SCM | WMS/QMS | 到货确认 | receiptId, poId, lines |
| `SALES_ORDER_CONFIRMED` | ERP | APS | 销售订单确认 | soId, customerId, lines, requiredDate |
| `WORK_ORDER_RELEASED` | APS | MES | 排程完成下发工单 | woId, scheduleId, operations |
| `PRODUCTION_STARTED` | MES | EAM | 工单开工 | woId, equipmentId, operatorId |
| `PRODUCTION_COMPLETED` | MES | ERP/WMS | 工单完工 | woId, completedQty, costData |
| `MATERIAL_ISSUE_REQUEST` | MES | WMS | 领料申请 | woId, materialId, qty, locationId |
| `MATERIAL_ISSUED` | WMS | MES | 领料出库完成 | issueId, woId, batchId, qty |
| `STOCK_IN_COMPLETED` | WMS | ERP | 入库完成 | receiptId, materialId, batchId, qty |
| `INSPECTION_TRIGGERED` | MES/SCM | QMS | 检验节点触发 | inspectionType, materialId, batchId, woId |
| `INSPECTION_COMPLETED` | QMS | MES/WMS/SCM | 检验完成 | irId, result, disposition, batchId |
| `EQUIPMENT_STATUS_CHANGED` | EAM | APS/MES | 设备状态变更 | equipmentId, oldStatus, newStatus |
| `EQUIPMENT_FAILURE_REPORTED` | MES/EAM | EAM | 设备故障上报 | equipmentId, failureType, severity |
| `MAINTENANCE_COMPLETED` | EAM | APS/MES | 维保完成 | equipmentId, orderId, recoveryTime |

---

### 5.9 补充API列表

#### 5.9.1 基础主数据API

| 接口 | 方法 | URL | 说明 |
|:---|:---|:---|:---|
| 创建批次 | POST | `/api/v1/base/batches` | 手工创建批次 |
| 查询批次 | GET | `/api/v1/base/batches/{id}` | 批次详情 |
| 批次列表 | GET | `/api/v1/base/batches` | 分页查询 |
| 组织树查询 | GET | `/api/v1/base/organizations/tree` | 返回完整树结构 |
| 创建组织 | POST | `/api/v1/base/organizations` | 新建组织节点 |
| 更新组织 | PUT | `/api/v1/base/organizations/{id}` | 更新组织信息 |
| 单位列表 | GET | `/api/v1/base/uoms` | 查询所有计量单位 |
| 创建单位 | POST | `/api/v1/base/uoms` | 新建计量单位 |
| 单位换算 | POST | `/api/v1/base/uoms/convert` | 数量单位换算 |

#### 5.9.2 权限系统API

| 接口 | 方法 | URL | 说明 |
|:---|:---|:---|:---|
| 登录 | POST | `/api/v1/auth/login` | 账号密码登录 |
| 刷新Token | POST | `/api/v1/auth/refresh` | 刷新AccessToken |
| 登出 | POST | `/api/v1/auth/logout` | 登出（清除Session）|
| 修改密码 | POST | `/api/v1/auth/change-password` | 修改当前用户密码 |
| 用户列表 | GET | `/api/v1/sys/users` | 分页查询用户 |
| 创建用户 | POST | `/api/v1/sys/users` | 新建用户 |
| 更新用户 | PUT | `/api/v1/sys/users/{id}` | 更新用户信息 |
| 禁用用户 | PATCH | `/api/v1/sys/users/{id}/disable` | 禁用账号 |
| 重置密码 | POST | `/api/v1/sys/users/{id}/reset-password` | 管理员重置密码 |
| 角色列表 | GET | `/api/v1/sys/roles` | 查询所有角色 |
| 创建角色 | POST | `/api/v1/sys/roles` | 新建角色 |
| 角色授权 | PUT | `/api/v1/sys/roles/{id}/permissions` | 设置角色权限 |
| 用户授角色 | PUT | `/api/v1/sys/users/{id}/roles` | 为用户分配角色 |
| 权限树 | GET | `/api/v1/sys/permissions/tree` | 返回权限树 |
| 当前用户权限 | GET | `/api/v1/sys/permissions/mine` | 当前用户的权限列表 |
| 审计日志 | GET | `/api/v1/sys/audit-logs` | 查询操作日志 |

#### 5.9.3 SCM模块API

| 接口 | 方法 | URL | 说明 |
|:---|:---|:---|:---|
| 供应商列表 | GET | `/api/v1/scm/suppliers` | 分页查询 |
| 创建供应商 | POST | `/api/v1/scm/suppliers` | 新建供应商 |
| 供应商详情 | GET | `/api/v1/scm/suppliers/{id}` | 含绩效数据 |
| 更新供应商 | PUT | `/api/v1/scm/suppliers/{id}` | 更新信息 |
| 供应商绩效 | GET | `/api/v1/scm/suppliers/{id}/performance` | 绩效分析 |
| 采购订单列表 | GET | `/api/v1/scm/purchase-orders` | 分页查询 |
| 创建采购订单 | POST | `/api/v1/scm/purchase-orders` | 新建采购单 |
| 采购订单详情 | GET | `/api/v1/scm/purchase-orders/{id}` | 含明细 |
| 审批采购订单 | POST | `/api/v1/scm/purchase-orders/{id}/approve` | 审批通过 |
| 拒绝采购订单 | POST | `/api/v1/scm/purchase-orders/{id}/reject` | 审批拒绝 |
| 创建到货记录 | POST | `/api/v1/scm/receipts` | 登记到货 |
| 到货详情 | GET | `/api/v1/scm/receipts/{id}` | 含明细 |
| 确认到货 | POST | `/api/v1/scm/receipts/{id}/confirm` | 确认入库 |
| 价格协议列表 | GET | `/api/v1/scm/price-agreements` | 查询价格协议 |
| 创建价格协议 | POST | `/api/v1/scm/price-agreements` | 新建协议 |
| 采购分析 | GET | `/api/v1/scm/analytics/purchase` | 采购金额/品类分析 |

#### 5.9.4 ERP模块API

| 接口 | 方法 | URL | 说明 |
|:---|:---|:---|:---|
| 客户列表 | GET | `/api/v1/erp/customers` | 分页查询 |
| 创建客户 | POST | `/api/v1/erp/customers` | 新建客户 |
| 客户详情 | GET | `/api/v1/erp/customers/{id}` | 含应收信息 |
| 销售订单列表 | GET | `/api/v1/erp/sales-orders` | 分页查询 |
| 创建销售订单 | POST | `/api/v1/erp/sales-orders` | 新建销售单 |
| 销售订单详情 | GET | `/api/v1/erp/sales-orders/{id}` | 含明细+生产进度 |
| 确认销售订单 | POST | `/api/v1/erp/sales-orders/{id}/confirm` | 确认并触发APS |
| 科目列表 | GET | `/api/v1/erp/accounts` | 查询科目树 |
| 创建科目 | POST | `/api/v1/erp/accounts` | 新建科目 |
| 凭证列表 | GET | `/api/v1/erp/vouchers` | 分页查询 |
| 创建凭证 | POST | `/api/v1/erp/vouchers` | 手工录入凭证 |
| 审核凭证 | POST | `/api/v1/erp/vouchers/{id}/review` | 审核 |
| 过账凭证 | POST | `/api/v1/erp/vouchers/{id}/post` | 过账 |
| 科目余额表 | GET | `/api/v1/erp/reports/trial-balance` | 科目余额表 |
| 利润表 | GET | `/api/v1/erp/reports/income-statement` | 利润表 |
| 资产负债表 | GET | `/api/v1/erp/reports/balance-sheet` | 资产负债表 |
| 成本中心列表 | GET | `/api/v1/erp/cost-centers` | 查询成本中心 |
| 产品成本报表 | GET | `/api/v1/erp/reports/product-cost` | 产品成本分析 |

#### 5.9.5 APS模块API

| 接口 | 方法 | URL | 说明 |
|:---|:---|:---|:---|
| 日历列表 | GET | `/api/v1/aps/calendars` | 查询工厂日历 |
| 创建日历 | POST | `/api/v1/aps/calendars` | 新建日历 |
| 设置班次 | PUT | `/api/v1/aps/calendars/{id}/shifts` | 配置班次 |
| 设置例外 | POST | `/api/v1/aps/calendars/{id}/exceptions` | 添加节假日/加班 |
| 资源列表 | GET | `/api/v1/aps/resources` | 查询资源 |
| 创建资源 | POST | `/api/v1/aps/resources` | 新建资源 |
| 资源负荷 | GET | `/api/v1/aps/resources/{id}/load` | 资源负荷分析 |
| 执行排程 | POST | `/api/v1/aps/schedules` | 触发排程计算 |
| 排程列表 | GET | `/api/v1/aps/schedules` | 查询排程批次 |
| 排程详情 | GET | `/api/v1/aps/schedules/{id}` | 含甘特图数据 |
| 发布排程 | POST | `/api/v1/aps/schedules/{id}/publish` | 发布并下发工单 |
| 甘特图数据 | GET | `/api/v1/aps/schedules/{id}/gantt` | 甘特图专用接口 |
| 产能分析 | GET | `/api/v1/aps/analytics/capacity` | 产能负荷分析 |
| 交期承诺 | POST | `/api/v1/aps/delivery-promise` | 快速交期承诺查询 |

#### 5.9.6 EAM模块API

| 接口 | 方法 | URL | 说明 |
|:---|:---|:---|:---|
| 设备列表 | GET | `/api/v1/eam/equipment` | 分页查询 |
| 创建设备 | POST | `/api/v1/eam/equipment` | 新建设备台账 |
| 设备详情 | GET | `/api/v1/eam/equipment/{id}` | 含履历/OEE |
| 更新设备状态 | PATCH | `/api/v1/eam/equipment/{id}/status` | 变更设备状态 |
| 设备树 | GET | `/api/v1/eam/equipment/tree` | 设备层级树 |
| 维保计划列表 | GET | `/api/v1/eam/maintenance-plans` | 查询维保计划 |
| 创建维保计划 | POST | `/api/v1/eam/maintenance-plans` | 新建计划 |
| 生成维保工单 | POST | `/api/v1/eam/maintenance-plans/{id}/generate` | 手动生成工单 |
| 维保工单列表 | GET | `/api/v1/eam/maintenance-orders` | 查询工单 |
| 完成维保工单 | POST | `/api/v1/eam/maintenance-orders/{id}/complete` | 记录执行结果 |
| 故障报修 | POST | `/api/v1/eam/failure-records` | 提交故障报修 |
| 故障列表 | GET | `/api/v1/eam/failure-records` | 查询故障记录 |
| 故障详情 | GET | `/api/v1/eam/failure-records/{id}` | 含维修过程 |
| 关闭故障 | POST | `/api/v1/eam/failure-records/{id}/close` | 关闭故障单 |
| 备件列表 | GET | `/api/v1/eam/spare-parts` | 查询备件 |
| 创建备件 | POST | `/api/v1/eam/spare-parts` | 新建备件 |
| 备件领用 | POST | `/api/v1/eam/spare-parts/{id}/use` | 记录领用 |
| OEE报表 | GET | `/api/v1/eam/analytics/oee` | OEE分析报表 |
| 故障分析 | GET | `/api/v1/eam/analytics/failure` | MTBF/MTTR分析 |

---

### 5.10 补充说明：数据库表全景图

以下为所有模块表的汇总，便于开发时快速定位：

| 模块 | 表名 | 说明 |
|:---|:---|:---|
| **基础** | `sys_tenant` | 租户 |
| | `sys_organization` | 组织架构 |
| | `sys_uom` | 计量单位 |
| | `sys_uom_conversion` | 单位换算 |
| | `material_batch` | 物料批次（追溯核心）|
| | `sys_file` | 文件元数据 |
| | `sys_event_store` | 事件总线（降级队列）|
| | `sys_event_subscription` | 事件订阅配置 |
| **权限** | `sys_user` | 用户 |
| | `sys_role` | 角色 |
| | `sys_permission` | 权限定义 |
| | `sys_user_role` | 用户角色关联 |
| | `sys_role_permission` | 角色权限关联 |
| | `sys_audit_log` | 操作审计日志 |
| **转换引擎** | `conversion_definition` | 转换定义（工艺模板）|
| | `cd_input` | 转换定义-输入物料 |
| | `cd_output` | 转换定义-输出物料 |
| | `conversion_instance` | 转换实例（执行记录）|
| | `ci_input` | 转换实例-实际输入 |
| | `ci_output` | 转换实例-实际输出 |
| **PLM** | `plm_material` | 物料主数据 |
| | `plm_bom` | BOM主表 |
| | `plm_bom_line` | BOM明细 |
| **SCM** | `scm_supplier` | 供应商档案 |
| | `scm_purchase_order` | 采购订单 |
| | `scm_purchase_order_line` | 采购订单明细 |
| | `scm_receipt` | 到货记录 |
| | `scm_receipt_line` | 到货明细 |
| | `scm_price_agreement` | 价格协议 |
| **ERP** | `erp_customer` | 客户档案 |
| | `erp_sales_order` | 销售订单 |
| | `erp_sales_order_line` | 销售订单明细 |
| | `erp_account` | 会计科目 |
| | `erp_voucher` | 财务凭证 |
| | `erp_voucher_entry` | 凭证分录 |
| | `erp_cost_center` | 成本中心 |
| **APS** | `aps_calendar` | 工厂日历 |
| | `aps_calendar_shift` | 日历班次 |
| | `aps_calendar_exception` | 日历例外 |
| | `aps_resource` | 资源模型 |
| | `aps_schedule` | 排程批次 |
| | `aps_schedule_task` | 排程任务（甘特图）|
| **MES** | `mes_work_order` | 生产工单 |
| | `mes_work_order_operation` | 工单工序 |
| | `mes_production_report` | 生产报工记录 |
| **WMS** | `wms_inventory` | 库存记录 |
| | `wms_stock_transaction` | 出入库记录 |
| **QMS** | `qms_inspection_record` | 检验记录 |
| **EAM** | `eam_equipment` | 设备台账 |
| | `eam_maintenance_plan` | 维保计划 |
| | `eam_maintenance_order` | 维保工单 |
| | `eam_failure_record` | 故障记录 |
| | `eam_spare_part` | 备件台账 |
| | `eam_spare_part_usage` | 备件领用记录 |

**合计：约50张表**，覆盖八大系统全部核心业务。

---

**文档版本**：v1.1（2026-04-14补充）  
**补充内容**：批次主数据、组织架构、计量单位、权限系统、SCM/ERP/APS/EAM四模块表设计、文件存储、事件总线、补充API列表  
**文档状态**：详细设计完成  
**下一步**：开发实施（代码规范、开发环境搭建、迭代开发）
