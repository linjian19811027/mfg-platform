import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('outsourcing_operation_log')
@Index('idx_ool_oc', ['tenantId', 'ocId'])
@Index('idx_ool_created', ['tenantId', 'createdAt'])
export class OutsourcingOperationLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'oc_id', type: 'bigint' })
  ocId!: string;

  @Column({ length: 50 })
  action!: string;

  @Column({ name: 'from_status', length: 30, nullable: true })
  fromStatus?: string;

  @Column({ name: 'to_status', length: 30, nullable: true })
  toStatus?: string;

  @Column({ name: 'operator_id', length: 50 })
  operatorId!: string;

  @Column({ name: 'client_ip', length: 50, nullable: true })
  clientIp?: string;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
