import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service.js';
import {
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
} from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { JwtPayload } from './strategies/jwt.strategy.js';
import { SysTenant } from './entities/sys-tenant.entity.js';

@ApiTags('认证')
@Controller('api/v1/auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(SysTenant)
    private readonly tenantRepo: Repository<SysTenant>,
  ) {}

  @Post('login')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: process.env.THROTTLE_DISABLE === '1' ? 999999 : 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '账号密码登录',
    description: '返回 accessToken / refreshToken，失败5次锁定30分钟',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: '登录成功，返回 Token' })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  @ApiResponse({ status: 429, description: '账户已锁定' })
  login(@Body() dto: LoginDto, @Req() req: import('express').Request) {
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip;
    const userAgent = req.headers['user-agent'];
    const requestTime = new Date();
    return this.authService.login(dto.username, dto.password, dto.tenantCode, {
      ip,
      userAgent,
      requestTime,
    });
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '刷新 AccessToken',
    description: '使用 refreshToken 换取新的 accessToken',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: '刷新成功' })
  @ApiResponse({ status: 401, description: 'refreshToken 无效或已过期' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '登出',
    description: 'JWT 无状态模式，客户端丢弃 token 即可',
  })
  @ApiResponse({ status: 200, description: '登出成功' })
  logout(@CurrentUser() user: JwtPayload) {
    return { message: 'Logged out', userId: user.sub };
  }

  @Post('change-password')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '修改密码' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: '修改成功' })
  @ApiResponse({ status: 401, description: '旧密码错误' })
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.sub,
      dto.oldPassword,
      dto.newPassword,
    );
  }

  @Get('tenants')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取租户列表（当前用户可见）' })
  async getTenants() {
    const tenants = await this.tenantRepo.find({
      where: { status: 'ACTIVE' },
      select: ['id', 'code', 'name'],
      order: { createdAt: 'ASC' },
    });
    return tenants.map((t) => ({ id: t.code, name: t.name }));
  }

  @Post('switch-tenant')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '切换租户' })
  @ApiBody({ schema: { properties: { tenantId: { type: 'string' } }, required: ['tenantId'] } })
  async switchTenant(
    @CurrentUser() user: JwtPayload,
    @Body() body: { tenantId: string },
  ) {
    if (!user.roles?.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('只有超级管理员可以切换租户');
    }
    return this.authService.switchTenant(user.sub, body.tenantId);
  }

  @Get('tenant-branding')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前租户品牌配置（Logo/标题/品牌色）' })
  async getTenantBranding(@CurrentUser() user: JwtPayload) {
    const tenant = await this.tenantRepo.findOne({
      where: { code: user.tenantId },
      select: ['logoUrl', 'brandColor', 'title', 'loginBg'],
    });
    return {
      logoUrl: tenant?.logoUrl ?? null,
      brandColor: tenant?.brandColor ?? null,
      title: tenant?.title ?? null,
      loginBg: tenant?.loginBg ?? null,
    };
  }
}
