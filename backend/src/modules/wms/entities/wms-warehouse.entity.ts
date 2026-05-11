import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wms_warehouse')
@Index('uk_wms_wh', ['tenantId', 'code'], { unique: true })
export class WmsWarehouse {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'tenant_id', length: 50 }) tenantId!: string;
  @Column({ length: 50 }) code!: string;
  @Column({ length: 100 }) name!: string;
  @Column({ length: 20, default: 'PHYSICAL' }) type!: string; // PHYSICAL | LOGICAL | VIRTUAL
  @Column({ length: 500, nullable: true }) address?: string;
  @Column({ name: 'manager_id', type: 'bigint', nullable: true })
  managerId?: string;
  @Column({ length: 20, default: 'ACTIVE' }) status!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
