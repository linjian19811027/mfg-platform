import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateComplaintDto {
  @IsString()
  @MaxLength(50)
  complaintNo!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  materialId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateComplaintDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  satisfactionScore?: number;
}

export class CreateRecallDto {
  @IsString()
  @MaxLength(50)
  recallNo!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  materialId!: string;

  @IsArray()
  affectedBatches!: string[];

  @IsOptional()
  @IsArray()
  affectedCustomers?: string[];

  @IsOptional()
  @IsString()
  recallReason?: string;
}

export class UpdateRecallDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  recallReason?: string;

  @IsOptional()
  @IsString()
  reportUrl?: string;
}
