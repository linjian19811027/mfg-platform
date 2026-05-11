import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CostElementType {
  MATERIAL = 'MATERIAL',
  LABOR = 'LABOR',
  OVERHEAD = 'OVERHEAD',
  OUTSOURCE = 'OUTSOURCE',
}

export enum CostElementStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('erp_cost_element')
@Index('uk_erp_cost_element', ['tenantId', 'code'], { unique: true })
export class ErpCostElement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'element_type', type: 'enum', enum: CostElementType })
  elementType!: CostElementType;

  @Column({ name: 'account_id', type: 'bigint', nullable: true })
  accountId?: string;

  @Column({
    type: 'enum',
    enum: CostElementStatus,
    default: CostElementStatus.ACTIVE,
  })
  status!: CostElementStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
