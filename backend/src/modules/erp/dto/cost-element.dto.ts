import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../shared/dto/page-query.dto.js';
import {
  CostElementStatus,
  CostElementType,
} from '../entities/erp-cost-element.entity.js';

export class CostElementQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;
}

export class CreateCostElementDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsEnum(CostElementType)
  elementType?: CostElementType;

  // Backward compatibility for old payload field name.
  @IsOptional()
  @IsEnum(CostElementType)
  type?: CostElementType;

  @IsOptional()
  @IsEnum(CostElementStatus)
  status?: CostElementStatus;
}
