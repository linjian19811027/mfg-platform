-- trace_batch
CREATE TABLE IF NOT EXISTS `trace_batch` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `trace_code` varchar(100) NOT NULL,
  `material_id` bigint NOT NULL,
  `material_code` varchar(100) NOT NULL,
  `material_name` varchar(200) NOT NULL,
  `batch_no` varchar(100) NOT NULL,
  `mes_wo_id` bigint NULL,
  `mes_batch_id` bigint NULL,
  `wms_batch_id` bigint NULL,
  `scm_po_id` bigint NULL,
  `erp_so_id` bigint NULL,
  `planned_qty` decimal(18,6) NOT NULL DEFAULT 0,
  `actual_qty` decimal(18,6) NOT NULL DEFAULT 0,
  `uom_id` bigint NOT NULL DEFAULT 0,
  `inspection_status` ENUM('PENDING','PASSED','FAILED','CONCESSION') NOT NULL DEFAULT 'PENDING',
  `inventory_status` ENUM('IN_STOCK','SHIPPED','CONSUMED','FROZEN') NOT NULL DEFAULT 'IN_STOCK',
  `is_frozen` tinyint(1) NOT NULL DEFAULT 0,
  `freeze_reason` varchar(200) NULL,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0,
  `production_start` datetime NULL,
  `production_end` datetime NULL,
  `operator_id` varchar(50) NULL,
  `barcode_path` varchar(500) NULL,
  `qrcode_path` varchar(500) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trace_code` (`trace_code`),
  INDEX `idx_trace_material` (`tenant_id`, `material_id`, `batch_no`),
  INDEX `idx_trace_wo` (`tenant_id`, `mes_wo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- trace_link
CREATE TABLE IF NOT EXISTS `trace_link` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `input_batch_id` bigint NOT NULL,
  `output_batch_id` bigint NOT NULL,
  `link_type` ENUM('PRODUCTION','SPLIT','MERGE','REWORK') NOT NULL DEFAULT 'PRODUCTION',
  `input_qty` decimal(18,6) NOT NULL DEFAULT 0,
  `mes_wo_id` bigint NULL,
  `linked_at` datetime NOT NULL,
  `is_manual` tinyint(1) NOT NULL DEFAULT 0,
  `manual_reason` text NULL,
  `operator_id` varchar(50) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_link_input` (`tenant_id`, `input_batch_id`),
  INDEX `idx_link_output` (`tenant_id`, `output_batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- trace_recall_assessment
CREATE TABLE IF NOT EXISTS `trace_recall_assessment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `assessment_no` varchar(50) NOT NULL,
  `problem_batch_id` bigint NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `status` ENUM('CALCULATING','COMPLETED','FAILED') NOT NULL DEFAULT 'CALCULATING',
  `affected_customers` int NOT NULL DEFAULT 0,
  `affected_so_count` int NOT NULL DEFAULT 0,
  `affected_output_batches` int NOT NULL DEFAULT 0,
  `affected_input_batches` int NOT NULL DEFAULT 0,
  `affected_suppliers` int NOT NULL DEFAULT 0,
  `in_stock_qty` decimal(18,6) NOT NULL DEFAULT 0,
  `high_risk_count` int NOT NULL DEFAULT 0,
  `medium_risk_count` int NOT NULL DEFAULT 0,
  `low_risk_count` int NOT NULL DEFAULT 0,
  `operator_id` varchar(50) NOT NULL,
  `completed_at` datetime NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_assessment_no` (`assessment_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- trace_report
CREATE TABLE IF NOT EXISTS `trace_report` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `trace_batch_id` bigint NOT NULL,
  `format` ENUM('PDF','EXCEL') NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `node_count` int NOT NULL DEFAULT 0,
  `has_missing_data` tinyint(1) NOT NULL DEFAULT 0,
  `operator_id` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_report_batch` (`tenant_id`, `trace_batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- trace_query_log
CREATE TABLE IF NOT EXISTS `trace_query_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `query_type` ENUM('FORWARD','BACKWARD','SCAN') NOT NULL,
  `start_point` varchar(200) NOT NULL,
  `result_node_count` int NOT NULL DEFAULT 0,
  `duration_ms` int NOT NULL DEFAULT 0,
  `operator_id` varchar(50) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_qlog_tenant` (`tenant_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
