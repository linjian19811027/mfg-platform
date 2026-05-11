import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { SysUser } from './entities/sys-user.entity.js';
import { SysRole } from './entities/sys-role.entity.js';
import { SysPermission } from './entities/sys-permission.entity.js';
import { SysUserRole } from './entities/sys-user-role.entity.js';
import { SysRolePermission } from './entities/sys-role-permission.entity.js';
import { SysAuditLog } from './entities/sys-audit-log.entity.js';
import { SysTenant } from './entities/sys-tenant.entity.js';
import { SysOrganization } from '../base/entities/sys-organization.entity.js';
import { SysUom } from '../base/entities/sys-uom.entity.js';
import { TenantContext } from '../../shared/tenant/tenant.context.js';
import { Permissions } from './decorators/permissions.decorator.js';
import { CreateUserDto } from './dto/login.dto.js';

const SALT_ROUNDS = 12;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
const PASSWORD_MSG = '密码至少8位，必须包含大写字母、小写字母、数字和特殊字符';

class UpdateUserDto {
  @IsOptional() @IsString() realName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional()
  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
  password?: string;
  @IsOptional() roleIds?: string[];
}

@ApiTags('系统管理')
@ApiBearerAuth()
@Controller('api/v1/sys')
export class SysController {
  constructor(
    @InjectRepository(SysUser) private readonly userRepo: Repository<SysUser>,
    @InjectRepository(SysRole) private readonly roleRepo: Repository<SysRole>,
    @InjectRepository(SysPermission)
    private readonly permRepo: Repository<SysPermission>,
    @InjectRepository(SysUserRole)
    private readonly userRoleRepo: Repository<SysUserRole>,
    @InjectRepository(SysRolePermission)
    private readonly rolePermRepo: Repository<SysRolePermission>,
    @InjectRepository(SysAuditLog)
    private readonly auditRepo: Repository<SysAuditLog>,
    @InjectRepository(SysTenant)
    private readonly tenantRepo: Repository<SysTenant>,
    @InjectRepository(SysOrganization)
    private readonly orgRepo: Repository<SysOrganization>,
    @InjectRepository(SysUom) private readonly uomRepo: Repository<SysUom>,
  ) {}

  // ─── 用户管理 ────────────────────────────────────────────────

  @Get('users')
  @Permissions('sys:user:list')
  @ApiOperation({ summary: '用户列表（分页）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'keyword', required: false })
  async listUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('keyword') keyword?: string,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const where = keyword
      ? [
          { tenantId, username: Like(`%${keyword}%`) },
          { tenantId, realName: Like(`%${keyword}%`) },
        ]
      : { tenantId };
    const [items, total] = await this.userRepo.findAndCount({
      where,
      select: [
        'id',
        'username',
        'realName',
        'phone',
        'email',
        'status',
        'lastLoginAt',
        'createdAt',
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    return { items, total, page, pageSize };
  }

  @Get('users/:id')
  @Permissions('sys:user:list')
  @ApiOperation({ summary: '用户详情' })
  async getUser(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    const user = await this.userRepo.findOne({
      where: { id, tenantId },
      select: [
        'id',
        'username',
        'realName',
        'phone',
        'email',
        'employeeNo',
        'organizationId',
        'status',
        'lastLoginAt',
        'createdAt',
      ],
    });
    if (!user) throw new Error('USER_NOT_FOUND');
    const roles = await this.userRoleRepo.find({
      where: { userId: id, tenantId },
    });
    return { ...user, roleIds: roles.map((r) => r.roleId) };
  }

  @Post('users')
  @Permissions('sys:user:create')
  @ApiOperation({ summary: '创建用户' })
  async createUser(@Body() body: CreateUserDto) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { roleIds, password, ...userData } = body;
    const user = await this.userRepo.save(
      this.userRepo.create({
        ...userData,
        tenantId,
        password: await bcrypt.hash(password, SALT_ROUNDS),
      }),
    );
    if (roleIds?.length) {
      await this.userRoleRepo.save(
        roleIds.map((roleId) =>
          this.userRoleRepo.create({ userId: user.id, roleId, tenantId }),
        ),
      );
    }
    const { password: _, ...result } = user;
    return result;
  }

  @Put('users/:id')
  @Permissions('sys:user:update')
  @ApiOperation({ summary: '更新用户' })
  async updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { roleIds, password, ...updateData } = body;
    if (password) {
      (updateData as Partial<SysUser>).password = await bcrypt.hash(
        password,
        SALT_ROUNDS,
      );
    }
    await this.userRepo.update(
      { id, tenantId },
      updateData as Partial<SysUser>,
    );
    if (roleIds !== undefined) {
      await this.userRoleRepo.delete({ userId: id, tenantId });
      if (roleIds.length) {
        await this.userRoleRepo.save(
          roleIds.map((roleId) =>
            this.userRoleRepo.create({ userId: id, roleId, tenantId }),
          ),
        );
      }
    }
    return { id };
  }

  @Delete('users/:id')
  @Permissions('sys:user:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除用户' })
  async deleteUser(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.userRepo.update({ id, tenantId }, { status: 'DELETED' });
  }

  // ─── 角色管理 ────────────────────────────────────────────────

  @Get('roles')
  @Permissions('sys:role:list')
  @ApiOperation({ summary: '角色列表' })
  async listRoles() {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.roleRepo.find({
      where: { tenantId, status: 'ACTIVE' },
      order: { createdAt: 'ASC' },
    });
  }

  @Post('roles')
  @Permissions('sys:role:create')
  @ApiOperation({ summary: '创建角色' })
  async createRole(
    @Body() body: Partial<SysRole> & { permissionIds?: string[] },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { permissionIds, ...roleData } = body;
    roleData.tenantId = tenantId;
    const role = await this.roleRepo.save(this.roleRepo.create(roleData));
    if (permissionIds?.length) {
      await this.rolePermRepo.save(
        permissionIds.map((permissionId) =>
          this.rolePermRepo.create({ roleId: role.id, permissionId, tenantId }),
        ),
      );
    }
    return role;
  }

  @Put('roles/:id')
  @Permissions('sys:role:update')
  @ApiOperation({ summary: '更新角色' })
  async updateRole(
    @Param('id') id: string,
    @Body() body: Partial<SysRole> & { permissionIds?: string[] },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { permissionIds, ...roleData } = body;
    await this.roleRepo.update({ id, tenantId }, roleData);
    if (permissionIds !== undefined) {
      await this.rolePermRepo.delete({ roleId: id, tenantId });
      if (permissionIds.length) {
        await this.rolePermRepo.save(
          permissionIds.map((permissionId) =>
            this.rolePermRepo.create({ roleId: id, permissionId, tenantId }),
          ),
        );
      }
    }
    return { id };
  }

  @Delete('roles/:id')
  @Permissions('sys:role:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除角色' })
  async deleteRole(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.roleRepo.update({ id, tenantId }, { status: 'DELETED' });
  }

  // ─── 权限树 ──────────────────────────────────────────────────

  @Get('permissions')
  @ApiOperation({ summary: '权限列表' })
  async getPermissions() {
    const all = await this.permRepo.find({ order: { sortOrder: 'ASC' } });
    return this.buildPermTree(all);
  }

  @Get('permissions/tree')
  @ApiOperation({ summary: '权限树' })
  async getPermissionTree() {
    const all = await this.permRepo.find({ order: { sortOrder: 'ASC' } });
    return this.buildPermTree(all);
  }

  private buildPermTree(
    nodes: SysPermission[],
    parentId?: string,
  ): (SysPermission & { children: SysPermission[] })[] {
    return nodes
      .filter((n) => (parentId ? n.parentId === parentId : !n.parentId))
      .map((n) => ({
        ...n,
        children: this.buildPermTree(nodes, n.id) as SysPermission[],
      }));
  }

  // ─── 审计日志 ────────────────────────────────────────────────

  @Get('audit-logs')
  @Permissions('sys:audit:list')
  @ApiOperation({ summary: '审计日志查询' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'startTime', required: false })
  @ApiQuery({ name: 'endTime', required: false })
  async listAuditLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('userId') userId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const qb = this.auditRepo
      .createQueryBuilder('log')
      .where('log.tenantId = :tenantId', { tenantId })
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (userId) qb.andWhere('log.userId = :userId', { userId });
    if (startTime) qb.andWhere('log.createdAt >= :startTime', { startTime });
    if (endTime) qb.andWhere('log.createdAt <= :endTime', { endTime });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  // ─── 角色分页列表 ─────────────────────────────────────────────

  @Get('roles/list')
  @ApiOperation({ summary: '角色分页列表' })
  async listRolesPaged(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('name') name?: string,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const qb = this.roleRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('r.createdAt', 'ASC');
    if (name) qb.andWhere('r.name LIKE :name', { name: `%${name}%` });
    const [list, total] = await qb.getManyAndCount();
    return { list, total, page, pageSize };
  }

  @Get('roles/:id/permissions')
  @ApiOperation({ summary: '获取角色权限列表' })
  async getRolePermissions(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    const items = await this.rolePermRepo.find({
      where: { roleId: id, tenantId },
    });
    return items.map((i) => i.permissionId);
  }

  @Put('roles/:id/permissions')
  @ApiOperation({ summary: '更新角色权限' })
  async updateRolePermissions(
    @Param('id') id: string,
    @Body() body: { permissions: string[] },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.rolePermRepo.delete({ roleId: id, tenantId });
    if (body.permissions?.length) {
      await this.rolePermRepo.save(
        body.permissions.map((permissionId) =>
          this.rolePermRepo.create({ roleId: id, permissionId, tenantId }),
        ),
      );
    }
    return { id };
  }

  @Patch('roles/:id/status')
  @ApiOperation({ summary: '切换角色状态' })
  async toggleRoleStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.roleRepo.update({ id, tenantId }, { status: body.status });
    return { id };
  }

  // ─── 用户状态 & 重置密码 ──────────────────────────────────────

  @Patch('users/:id/status')
  @ApiOperation({ summary: '切换用户状态' })
  async toggleUserStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.userRepo.update({ id, tenantId }, { status: body.status });
    return { id };
  }

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: '重置用户密码' })
  async resetPassword(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678!@#$';
    const tempPassword = Array.from(
      { length: 10 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('');
    await this.userRepo.update(
      { id, tenantId },
      { password: await bcrypt.hash(tempPassword, SALT_ROUNDS) },
    );
    return { tempPassword };
  }

  // ─── 组织架构 ─────────────────────────────────────────────────

  @Get('orgs/tree')
  @ApiOperation({ summary: '组织树' })
  async getOrgTree() {
    const tenantId = TenantContext.requireCurrentTenant();
    const all = await this.orgRepo.find({
      where: { tenantId },
      order: { sortOrder: 'ASC' },
    });
    return this.buildOrgTree(all);
  }

  @Get('orgs/simple')
  @ApiOperation({ summary: '组织简单列表（用于下拉选择）' })
  async getOrgsSimple() {
    const tenantId = TenantContext.requireCurrentTenant();
    const all = await this.orgRepo.find({
      where: { tenantId },
      select: ['id', 'name', 'code', 'parentId', 'level'],
      order: { level: 'ASC', sortOrder: 'ASC' },
    });
    return all;
  }

  @Get('orgs/:id')
  @ApiOperation({ summary: '组织详情' })
  async getOrg(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    return this.orgRepo.findOne({ where: { id, tenantId } });
  }

  @Post('orgs')
  @ApiOperation({ summary: '创建组织' })
  async createOrg(@Body() body: Record<string, unknown>) {
    const tenantId = TenantContext.requireCurrentTenant();
    let level = 1;
    let path = '';
    if (body['parentId']) {
      const parent = await this.orgRepo.findOne({
        where: { id: body['parentId'] as string, tenantId },
      });
      if (parent) {
        level = parent.level + 1;
        path = `${parent.path ?? parent.id}/${parent.id}`;
      }
    }
    const org = await this.orgRepo.save(
      this.orgRepo.create({
        ...body,
        tenantId,
        level,
        path,
      } as Partial<SysOrganization>),
    );
    return org;
  }

  @Put('orgs/:id')
  @ApiOperation({ summary: '更新组织' })
  async updateOrg(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.orgRepo.update({ id, tenantId }, body as any);
    return { id };
  }

  @Delete('orgs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除组织' })
  async deleteOrg(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.orgRepo.delete({ id, tenantId });
  }

  private buildOrgTree(
    nodes: SysOrganization[],
    parentId?: string,
  ): (SysOrganization & { children: SysOrganization[] })[] {
    return nodes
      .filter((n) => (parentId ? n.parentId === parentId : !n.parentId))
      .map((n) => ({
        ...n,
        children: this.buildOrgTree(nodes, n.id) as SysOrganization[],
      }));
  }

  // ─── 计量单位 ─────────────────────────────────────────────────

  @Get('uoms')
  @ApiOperation({ summary: '计量单位列表' })
  async getUoms(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('name') name?: string,
    @Query('type') type?: string,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const qb = this.uomRepo
      .createQueryBuilder('u')
      .where('u.tenantId = :tenantId', { tenantId })
      .orderBy('u.createdAt', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (name)
      qb.andWhere('(u.name LIKE :name OR u.symbol LIKE :name)', {
        name: `%${name}%`,
      });
    if (type) qb.andWhere('u.category = :type', { type });
    const [list, total] = await qb.getManyAndCount();
    return { list, total, page, pageSize };
  }

  @Post('uoms')
  @ApiOperation({ summary: '创建计量单位' })
  async createUom(@Body() body: Record<string, unknown>) {
    const tenantId = TenantContext.requireCurrentTenant();
    const uom = await this.uomRepo.save(
      this.uomRepo.create({ ...body, tenantId } as Partial<SysUom>),
    );
    return { id: uom.id };
  }

  @Put('uoms/:id')
  @ApiOperation({ summary: '更新计量单位' })
  async updateUom(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.uomRepo.update({ id, tenantId }, body as Partial<SysUom>);
    return { id };
  }

  @Delete('uoms/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除计量单位' })
  async deleteUom(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.uomRepo.delete({ id, tenantId });
  }

  @Patch('uoms/:id/conversion')
  @ApiOperation({ summary: '设置换算系数' })
  async setUomConversion(
    @Param('id') id: string,
    @Body() body: { conversionFactor: number },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.uomRepo.update({ id, tenantId }, {
      isBase: 0,
    } as Partial<SysUom>);
    return { id };
  }

  // ─── 租户管理 ─────────────────────────────────────────────────

  @Get('tenants')
  @ApiOperation({ summary: '租户列表' })
  async getTenants(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('name') name?: string,
    @Query('status') status?: string,
  ) {
    const qb = this.tenantRepo
      .createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (name)
      qb.andWhere('(t.name LIKE :name OR t.code LIKE :name)', {
        name: `%${name}%`,
      });
    if (status) qb.andWhere('t.status = :status', { status });
    const [list, total] = await qb.getManyAndCount();
    return { list, total, page, pageSize };
  }

  @Post('tenants')
  @ApiOperation({ summary: '创建租户' })
  async createTenant(@Body() body: Record<string, unknown>) {
    const tenant = await this.tenantRepo.save(
      this.tenantRepo.create(body as Partial<SysTenant>),
    );
    return { id: tenant.id };
  }

  @Put('tenants/:id')
  @ApiOperation({ summary: '更新租户' })
  async updateTenant(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.tenantRepo.update({ id }, body as any);
    return { id };
  }

  @Patch('tenants/:id/status')
  @ApiOperation({ summary: '切换租户状态' })
  async toggleTenantStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    await this.tenantRepo.update({ id }, { status: body.status });
    return { id };
  }
}
