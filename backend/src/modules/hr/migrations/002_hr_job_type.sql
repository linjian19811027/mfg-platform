-- HR 模块 — 工种基础数据表
-- 创建时间：2025

CREATE TABLE IF NOT EXISTS `hr_job_type` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `name` varchar(50) NOT NULL COMMENT '工种名称',
  `code` varchar(20) DEFAULT NULL COMMENT '工种代码',
  `description` text DEFAULT NULL COMMENT '描述',
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工种基础数据';

-- 预置常用工种
INSERT IGNORE INTO `hr_job_type` (`tenant_id`, `name`, `code`, `description`) VALUES
('system', '车工', 'LATHE', '车床操作'),
('system', '铣工', 'MILL', '铣床操作'),
('system', '钳工', 'FITTER', '装配钳工'),
('system', '焊工', 'WELDER', '焊接作业'),
('system', '电工', 'ELECTRICIAN', '电气维护'),
('system', '质检员', 'QC', '质量检验'),
('system', '仓管员', 'WAREHOUSE', '仓库管理');
