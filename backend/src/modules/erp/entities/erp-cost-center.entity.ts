import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CostCenterType {
  FACTORY = 'FACTORY',
  WORKSHOP = 'WORKSHOP',
  LINE = 'LINE',
  WORKSTATION = 'WORKSTATION',
  PRODUCT = 'PRODUCT',
}

export enum CostCenterStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('erp_cost_center')
@Index('uk_erp_cost_center', ['tenantId', 'code'], { unique: true })
export class ErpCostCenter {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'center_type', type: 'enum', enum: CostCenterType })
  centerType!: CostCenterType;

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId?: string;

  @Column({ type: 'int', default: 1 })
  level!: number;

  @Column({
    type: 'enum',
    enum: CostCenterStatus,
    default: CostCenterStatus.ACTIVE,
  })
  status!: CostCenterStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
