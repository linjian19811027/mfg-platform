import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../../shared/dto/page-query.dto.js';

export class QmsComplaintQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class QmsRecallQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}
