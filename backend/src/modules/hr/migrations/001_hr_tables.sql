-- HR 模块数据库表 DDL
-- 创建时间：2024

-- 1. hr_employee 员工档案表
CREATE TABLE IF NOT EXISTS `hr_employee` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `emp_no` varchar(20) NOT NULL,
  `name` varchar(50) NOT NULL,
  `job_type` varchar(50) NOT NULL,
  `work_center_id` bigint NULL,
  `hire_date` date NOT NULL,
  `leave_date` date NULL,
  `status` enum('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `phone` varchar(20) NULL,
  `id_card` varchar(20) NULL,
  `emergency_contact` varchar(50) NULL,
  `emergency_phone` varchar(20) NULL,
  `remark` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_emp_no` (`tenant_id`, `emp_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. hr_certification_type 认证类型表
CREATE TABLE IF NOT EXISTS `hr_certification_type` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `code` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `is_mandatory` tinyint(1) NOT NULL DEFAULT 0,
  `default_validity_months` int NOT NULL DEFAULT 12,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_code` (`tenant_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 预置5种认证类型（使用系统租户 'system'，实际使用时各租户自行初始化）
INSERT IGNORE INTO `hr_certification_type` (`tenant_id`, `code`, `name`, `is_mandatory`, `default_validity_months`) VALUES
('system', 'WELD', '焊工证', 1, 36),
('system', 'SPEC_EQ', '特种设备操作证', 1, 24),
('system', 'FORK', '叉车证', 1, 36),
('system', 'ELEC', '电工证', 1, 36),
('system', 'QC', '质检员证', 0, 24);

-- 3. hr_employee_certification 员工技能认证表（含计算列）
CREATE TABLE IF NOT EXISTS `hr_employee_certification` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `emp_id` bigint NOT NULL,
  `cert_type_id` bigint NOT NULL,
  `cert_no` varchar(100) NOT NULL,
  `issue_date` date NOT NULL,
  `expire_date` date NOT NULL,
  `issuer` varchar(100) NULL,
  `attachment_path` varchar(500) NULL,
  `is_expired` tinyint(1) GENERATED ALWAYS AS (IF(`expire_date` < CURDATE(), 1, 0)) STORED,
  `is_expiring_soon` tinyint(1) GENERATED ALWAYS AS (IF(`expire_date` >= CURDATE() AND `expire_date` <= DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1, 0)) STORED,
  `remark` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_emp_id` (`emp_id`),
  KEY `idx_cert_type_id` (`cert_type_id`),
  CONSTRAINT `fk_cert_emp` FOREIGN KEY (`emp_id`) REFERENCES `hr_employee` (`id`),
  CONSTRAINT `fk_cert_type` FOREIGN KEY (`cert_type_id`) REFERENCES `hr_certification_type` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. hr_shift 班次定义表（含计算列，预置4种班次）
CREATE TABLE IF NOT EXISTS `hr_shift` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `code` varchar(20) NOT NULL,
  `name` varchar(50) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `is_cross_day` tinyint(1) GENERATED ALWAYS AS (IF(`end_time` < `start_time`, 1, 0)) STORED,
  `duration_hours` decimal(5,2) GENERATED ALWAYS AS (
    IF(`end_time` >= `start_time`,
      TIME_TO_SEC(TIMEDIFF(`end_time`, `start_time`)) / 3600,
      (TIME_TO_SEC(TIMEDIFF(`end_time`, `start_time`)) + 86400) / 3600
    )
  ) STORED,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_code` (`tenant_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 预置4种班次
INSERT IGNORE INTO `hr_shift` (`tenant_id`, `code`, `name`, `start_time`, `end_time`) VALUES
('system', 'DAY', '早班', '06:00:00', '14:00:00'),
('system', 'MID', '中班', '14:00:00', '22:00:00'),
('system', 'NIGHT', '夜班', '22:00:00', '06:00:00'),
('system', 'NORMAL', '白班', '08:00:00', '17:00:00');

-- 5. hr_shift_schedule 排班计划表
CREATE TABLE IF NOT EXISTS `hr_shift_schedule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `emp_id` bigint NOT NULL,
  `schedule_date` date NOT NULL,
  `shift_id` bigint NOT NULL,
  `work_center_id` bigint NULL,
  `equipment_id` bigint NULL,
  `remark` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_emp_date` (`tenant_id`, `emp_id`, `schedule_date`),
  KEY `idx_schedule_date` (`schedule_date`),
  CONSTRAINT `fk_schedule_emp` FOREIGN KEY (`emp_id`) REFERENCES `hr_employee` (`id`),
  CONSTRAINT `fk_schedule_shift` FOREIGN KEY (`shift_id`) REFERENCES `hr_shift` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. hr_work_hour_record 工时明细表
CREATE TABLE IF NOT EXISTS `hr_work_hour_record` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `emp_id` bigint NOT NULL,
  `report_date` date NOT NULL,
  `operation_code` varchar(50) NOT NULL,
  `work_center_id` bigint NULL,
  `actual_hours` decimal(8,2) NOT NULL,
  `mes_report_id` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_mes_report` (`tenant_id`, `mes_report_id`),
  KEY `idx_emp_date` (`emp_id`, `report_date`),
  CONSTRAINT `fk_whr_emp` FOREIGN KEY (`emp_id`) REFERENCES `hr_employee` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. hr_work_hour_summary 工时汇总表
CREATE TABLE IF NOT EXISTS `hr_work_hour_summary` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `emp_id` bigint NOT NULL,
  `summary_date` date NOT NULL,
  `dimension` enum('DAY','WEEK','MONTH') NOT NULL,
  `total_hours` decimal(8,2) NOT NULL DEFAULT 0,
  `normal_hours` decimal(8,2) NOT NULL DEFAULT 0,
  `overtime_hours` decimal(8,2) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_emp_date_dim` (`tenant_id`, `emp_id`, `summary_date`, `dimension`),
  KEY `idx_emp_date` (`emp_id`, `summary_date`),
  CONSTRAINT `fk_whs_emp` FOREIGN KEY (`emp_id`) REFERENCES `hr_employee` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. 扩展 mes_operation 表（新增工序所需技能认证字段）
ALTER TABLE `mes_operation`
  ADD COLUMN IF NOT EXISTS `required_cert_codes` JSON NULL COMMENT '工序所需技能认证代码列表，如 ["WELD","SPEC_EQ"]';
