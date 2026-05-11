import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../../shared/dto/page-query.dto.js';

export class ScmListQueryDto extends PageQueryDto {
  [key: string]: unknown;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
