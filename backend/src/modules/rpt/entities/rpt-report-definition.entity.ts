import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('rpt_report_definition')
@Index('idx_rpt_def_tenant', ['tenantId'])
@Index('idx_rpt_def_template', ['isTemplate', 'status'])
export class RptReportDefinition {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ length: 200 }) name!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  /** DASHBOARD | TABLE | CHART | MIXED */
  @Column({ length: 20 }) type!: string;
  /** 布局配置（组件位置、尺寸） */
  @Column({ type: 'json' }) layout!: Record<string, unknown>;
  /** 组件列表（图表配置、表格列定义等） */
  @Column({ type: 'json' }) components!: Record<string, unknown>[];
  /** 数据源配置（API 端点、参数映射） */
  @Column({ name: 'data_sources', type: 'json' }) dataSources!: Record<string, unknown>[];
  @Column({ name: 'is_template', type: 'tinyint', default: 0 }) isTemplate!: number;
  @Column({ length: 20, default: 'ACTIVE' }) status!: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
