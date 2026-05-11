import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('trace_query_log')
@Index('idx_trace_qlog_tenant', ['tenantId', 'createdAt'])
export class TraceQueryLog {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  /** FORWARD | BACKWARD | SCAN */
  @Column({ name: 'query_type', length: 20 }) queryType!: string;
  @Column({ name: 'start_point', length: 200 }) startPoint!: string;
  @Column({ name: 'result_node_count', type: 'int', default: 0 })
  resultNodeCount!: number;
  @Column({ name: 'duration_ms', type: 'int', default: 0 }) durationMs!: number;
  @Column({ name: 'operator_id', length: 50, nullable: true })
  operatorId?: string;
  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
