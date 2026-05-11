import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PriceType {
  FIXED = 'FIXED',
  TIERED = 'TIERED',
}

export enum AgreementStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('scm_price_agreement')
@Index('uk_scm_pa', ['tenantId', 'agreementNo'], { unique: true })
@Index('idx_scm_pa_supplier_material', ['supplierId', 'materialId'])
@Index('idx_scm_pa_valid', ['validFrom', 'validTo'])
export class ScmPriceAgreement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', length: 50 })
  tenantId!: string;

  @Column({ name: 'agreement_no', length: 50 })
  agreementNo!: string;

  @Column({ name: 'supplier_id', type: 'bigint' })
  supplierId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({
    name: 'price_type',
    type: 'enum',
    enum: PriceType,
    default: PriceType.FIXED,
  })
  priceType!: PriceType;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  unitPrice?: number;

  @Column({ name: 'tiered_prices', type: 'json', nullable: true })
  tieredPrices?: Record<string, any>[];

  @Column({ name: 'valid_from', type: 'date' })
  validFrom!: Date;

  @Column({ name: 'valid_to', type: 'date' })
  validTo!: Date;

  @Column({
    type: 'enum',
    enum: AgreementStatus,
    default: AgreementStatus.ACTIVE,
  })
  status!: AgreementStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
