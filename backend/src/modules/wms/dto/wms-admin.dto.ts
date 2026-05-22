import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;
}

export class StockTakeListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}

export class WarehouseListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}

export class SafetyStockListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  materialId?: string;
}

export class PickTaskListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateWarehouseDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateSafetyStockDto {
  @IsString()
  materialId!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  safetyQty!: number;

  @IsOptional()
  @IsString()
  uomId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reorderQty?: number;
}

export class CreateBarcodeRuleDto {
  @IsString()
  ruleType!: string;

  @IsString()
  name!: string;

  @IsString()
  template!: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serialLength?: number;
}
