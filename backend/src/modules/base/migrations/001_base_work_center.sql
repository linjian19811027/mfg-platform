-- 基础主数据 — 工作中心表
-- 创建时间：2025

CREATE TABLE IF NOT EXISTS `mfg_work_center` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(50) NOT NULL,
  `name` varchar(50) NOT NULL COMMENT '工作中心名称',
  `code` varchar(20) DEFAULT NULL COMMENT '工作中心代码',
  `description` text DEFAULT NULL COMMENT '描述',
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作中心基础数据';

-- 预置常用工作中心
INSERT IGNORE INTO `mfg_work_center` (`tenant_id`, `name`, `code`, `description`) VALUES
('system', '机加工车间', 'MACH', '机加工生产中心'),
('system', '装配车间', 'ASSY', '产品装配中心'),
('system', '焊接车间', 'WELD', '焊接作业中心'),
('system', '质检中心', 'QC', '质量检验中心'),
('system', '包装车间', 'PACK', '包装作业中心');
