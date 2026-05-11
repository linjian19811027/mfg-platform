import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

  @Type(() => Number)
  @IsInt()
  @Min(0)
  minQty!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxQty!: number;
}

export class CreateBarcodeRuleDto {
  @IsString()
  ruleName!: string;

  @IsString()
  pattern!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
