import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ApsResourceType {
  MACHINE = 'MACHINE',
  LABOR = 'LABOR',
  TOOL = 'TOOL',
  FIXTURE = 'FIXTURE',
}

export enum ApsResourceStatus {
  AVAILABLE = 'AVAILABLE',
  MAINTENANCE = 'MAINTENANCE',
  REPAIR = 'REPAIR',
  BREAKDOWN = 'BREAKDOWN',
}

@Entity('aps_resource')
@Index('uk_aps_resource', ['tenantId', 'code'], { unique: true })
export class ApsResource {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ length: 50 })
  code!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'enum', enum: ApsResourceType })
  type!: ApsResourceType;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 1 })
  capacity!: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 1 })
  efficiency!: number;

  @Column({
    type: 'enum',
    enum: ApsResourceStatus,
    default: ApsResourceStatus.AVAILABLE,
  })
  status!: ApsResourceStatus;

  @Column({ name: 'alternative_resources', type: 'json', nullable: true })
  alternativeResources?: string[];

  @Column({ name: 'exclusive_resources', type: 'json', nullable: true })
  exclusiveResources?: string[];

  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
