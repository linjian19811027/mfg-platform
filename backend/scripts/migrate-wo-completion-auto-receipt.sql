-- ============================================================
-- 工单完工自动入库 DDL 迁移脚本
-- spec: wo-completion-auto-receipt
-- ============================================================

-- 1.1 mes_auto_receipt_config
CREATE TABLE IF NOT EXISTS `mes_auto_receipt_config` (
  `id`                  BIGINT       NOT NULL AUTO_INCREMENT,
  `tenant_id`           VARCHAR(50)  NOT NULL,
  -- MATERIAL = 精确匹配物料ID, CATEGORY = 分类前缀匹配
  `match_type`          VARCHAR(20)  NOT NULL COMMENT 'MATERIAL | CATEGORY',
  `match_value`         VARCHAR(100) NOT NULL,
  `require_fqc`         TINYINT(1)   NOT NULL DEFAULT 0,
  `target_warehouse_id` BIGINT       NULL,
  `target_location_id`  BIGINT       NULL,
  `enabled`             TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_marc_tenant_match` (`tenant_id`, `match_type`, `match_value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='MES 自动入库配置';

-- 1.2 mes_receipt_log
CREATE TABLE IF NOT EXISTS `mes_receipt_log` (
  `id`                  BIGINT         NOT NULL AUTO_INCREMENT,
  `tenant_id`           VARCHAR(50)    NOT NULL,
  `wo_id`               BIGINT         NOT NULL,
  -- FULL = 全部完工触发, PARTIAL = 部分完工触发
  `trigger_type`        VARCHAR(10)    NOT NULL COMMENT 'FULL | PARTIAL',
  `material_id`         BIGINT         NOT NULL,
  `quantity`            DECIMAL(18,6)  NOT NULL,
  `uom_id`              BIGINT         NULL,
  `target_warehouse_id` BIGINT         NULL,
  `target_location_id`  BIGINT         NULL,
  `require_fqc`         TINYINT(1)     NOT NULL DEFAULT 0,
  -- PENDING | SUCCESS | FAILED | RETRYING
  `status`              VARCHAR(10)    NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING | SUCCESS | FAILED | RETRYING',
  `retry_count`         INT            NOT NULL DEFAULT 0,
  `fqc_ir_id`           BIGINT         NULL COMMENT '关联 FQC 检验单',
  `wms_tx_id`           BIGINT         NULL COMMENT '关联 WMS 入库事务',
  `error_message`       TEXT           NULL,
  `created_at`          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_mrl_wo`     (`wo_id`),
  INDEX `idx_mrl_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='MES 自动入库日志';

-- 1.3 扩展 mes_work_order：新增 actual_receipt_qty
ALTER TABLE `mes_work_order`
  ADD COLUMN IF NOT EXISTS `actual_receipt_qty` DECIMAL(18,6) NOT NULL DEFAULT 0
    COMMENT '实际已入库数量（自动入库回写）';

-- 1.4 扩展 mes_work_order_operation：新增 partial_receipt_enabled
ALTER TABLE `mes_work_order_operation`
  ADD COLUMN IF NOT EXISTS `partial_receipt_enabled` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '是否允许部分完工入库';
