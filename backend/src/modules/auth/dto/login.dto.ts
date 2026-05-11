import { IsString, IsOptional, Length, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// 密码强度正则：8位以上，必须包含大写字母、小写字母、数字、特殊字符各至少一个
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
const PASSWORD_MSG = '密码至少8位，必须包含大写字母、小写字母、数字和特殊字符';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'Admin@123456' })
  @IsString()
  @Length(6, 100)
  password!: string;

  @ApiProperty({ example: 'tenant_a', description: '租户编码' })
  @IsString()
  @IsNotEmpty()
  tenantCode!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @ApiProperty({ description: PASSWORD_MSG, example: 'NewPass@123' })
  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
  newPassword!: string;
}

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ description: PASSWORD_MSG, example: 'Init@123456' })
  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  realName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  roleIds?: string[];
}
