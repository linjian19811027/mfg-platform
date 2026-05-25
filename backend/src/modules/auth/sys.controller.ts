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
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
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
import { SysConfig } from './entities/sys-config.entity.js';
import { SysTenant } from './entities/sys-tenant.entity.js';
import { SysOrganization } from '../base/entities/sys-organization.entity.js';
import { SysUom } from '../base/entities/sys-uom.entity.js';
import { TenantContext } from '../../shared/tenant/tenant.context.js';
import { escapeLikePattern } from '../../shared/utils/sanitize.js';
import { Permissions } from './decorators/permissions.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { JwtPayload } from './strategies/jwt.strategy.js';
import { CreateUserDto } from './dto/login.dto.js';
import { TenantProvisionService } from './tenant-provision.service.js';

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
    @InjectRepository(SysConfig) private readonly configRepo: Repository<SysConfig>,
    private readonly provisionSvc: TenantProvisionService,
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
          { tenantId, username: Like(`%${escapeLikePattern(keyword)}%`) },
          { tenantId, realName: Like(`%${escapeLikePattern(keyword)}%`) },
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
    @CurrentUser() user: JwtPayload,
    @Body() body: Partial<SysRole>,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const roleData = body;
    roleData.tenantId = tenantId;

    // 非 SUPER_ADMIN 不能创建系统级角色
    if (roleData.type && roleData.type !== 'CUSTOM' && !user.roles?.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('PERM_FORBIDDEN: 无权创建系统级角色');
    }

    const role = await this.roleRepo.save(this.roleRepo.create(roleData));
    return role;
  }

  @Put('roles/:id')
  @Permissions('sys:role:update')
  @ApiOperation({ summary: '更新角色' })
  async updateRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: Partial<SysRole> & { permissionIds?: string[] },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const { permissionIds, ...roleData } = body;

    // 非 SUPER_ADMIN 不能修改系统级角色
    if (!user.roles?.includes('SUPER_ADMIN')) {
      const existing = await this.roleRepo.findOne({ where: { id, tenantId } });
      if (existing && existing.type !== 'CUSTOM') {
        throw new ForbiddenException('PERM_FORBIDDEN: 无权修改系统级角色');
      }
    }
    // 验证权限不越权
    if (permissionIds !== undefined && !user.roles?.includes('SUPER_ADMIN')) {
      await this.validatePermScope(user, permissionIds);
    }

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
  @ApiOperation({ summary: '权限列表（按当前用户范围过滤）' })
  async getPermissions(@CurrentUser() user: JwtPayload) {
    const all = await this.permRepo.find({ order: { sortOrder: 'ASC' } });
    const filtered = this.filterPermsByUserScope(user, all);
    return this.buildPermTree(filtered);
  }

  @Get('permissions/tree')
  @ApiOperation({ summary: '权限树（全部权限，用于管理页面）' })
  async getPermissionTree() {
    const all = await this.permRepo.find({ order: { sortOrder: 'ASC' } });
    return this.buildPermTree(all);
  }

  @Post('permissions')
  @ApiOperation({ summary: '创建权限（菜单/按钮/API）' })
  async createPermission(@Body() body: Record<string, unknown>) {
    const tenantId = TenantContext.getCurrentTenant() ?? '__SYSTEM__';
    return this.permRepo.save(this.permRepo.create({ ...body, tenantId } as any));
  }

  @Put('permissions/:id')
  @ApiOperation({ summary: '更新权限' })
  async updatePermission(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    await this.permRepo.update(id, body as any);
    return this.permRepo.findOne({ where: { id } });
  }

  @Delete('permissions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除权限' })
  async deletePermission(@Param('id') id: string) {
    await this.permRepo.delete(id);
  }

  /**
   * 根据当前用户角色过滤可见权限：
   * - SUPER_ADMIN → 所有权限
   * - TENANT_ADMIN / CUSTOM → 只返回用户自身已拥有的权限及其父级
   */
  private async getUserScopePermIds(user: JwtPayload): Promise<Set<string> | null> {
    if (user.roles?.includes('SUPER_ADMIN')) return null; // null = 全部可见
    const userPerms = user.permissions ?? [];
    if (userPerms.length === 0) return new Set();

    // 查出用户拥有的权限及其所有祖先节点，保证权限树完整展示勾选状态
    const ownedPerms = await this.permRepo.find({
      where: { code: In(userPerms) },
    });
    const visibleIds = new Set<string>();
    const allPerms = await this.permRepo.find();

    // 收集所有祖先节点
    const parentMap = new Map<string, string | null>();
    for (const p of allPerms) {
      parentMap.set(p.id, p.parentId ?? null);
    }

    const collectAncestors = (id: string) => {
      visibleIds.add(id);
      const pid = parentMap.get(id);
      if (pid && !visibleIds.has(pid)) collectAncestors(pid);
    };

    for (const p of ownedPerms) {
      collectAncestors(p.id);
    }
    return visibleIds;
  }

  private filterPermsByUserScope(
    user: JwtPayload,
    allPerms: SysPermission[],
  ): SysPermission[] {
    if (user.roles?.includes('SUPER_ADMIN')) return allPerms;
    const userPerms = user.permissions ?? [];
    if (userPerms.length === 0) return [];

    // 收集用户拥有的权限 code 及其祖先节点
    const userPermSet = new Set(userPerms);
    const idToCode = new Map(allPerms.map((p) => [p.id, p.code]));
    const parentMap = new Map<string, string | null>();
    for (const p of allPerms) {
      parentMap.set(p.id, p.parentId ?? null);
    }

    // 找出在可见范围内的权限 ID
    const visibleIds = new Set<string>();
    for (const p of allPerms) {
      if (userPermSet.has(p.code)) {
        // 收集该节点及其所有祖先
        let cur = p.id;
        while (cur && !visibleIds.has(cur)) {
          visibleIds.add(cur);
          const pid = parentMap.get(cur);
          if (pid) cur = pid;
          else break;
        }
      }
    }

    return allPerms.filter((p) => visibleIds.has(p.id));
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

  /**
   * 验证 permissionIds 是否都在当前用户权限范围内（不越权）
   */
  private async validatePermScope(user: JwtPayload, permissionIds: string[]): Promise<void> {
    const userPerms = user.permissions ?? [];
    if (userPerms.length === 0 && permissionIds.length > 0) {
      throw new ForbiddenException('PERM_FORBIDDEN: 无权分配任何权限');
    }
    const userPermSet = new Set(userPerms);
    for (const pid of permissionIds) {
      // 检查该 permission ID 对应的 code 是否在用户权限内
      const perm = await this.permRepo.findOne({ where: { id: pid } });
      if (perm && !userPermSet.has(perm.code)) {
        throw new ForbiddenException(`PERM_FORBIDDEN: 无权分配权限 ${perm.code}`);
      }
    }
  }

  // ─── 审计日志 ────────────────────────────────────────────────

  @Get('audit-logs')
  @Permissions('sys:audit:list')
  @ApiOperation({ summary: '审计日志查询' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'operator', required: false })
  @ApiQuery({ name: 'module', required: false })
  @ApiQuery({ name: 'actionType', required: false })
  @ApiQuery({ name: 'result', required: false })
  @ApiQuery({ name: 'startTime', required: false })
  @ApiQuery({ name: 'endTime', required: false })
  async listAuditLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('userId') userId?: string,
    @Query('operator') operator?: string,
    @Query('module') module?: string,
    @Query('actionType') actionType?: string,
    @Query('result') result?: string,
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
    if (operator) qb.andWhere('log.username LIKE :operator', { operator: `%${escapeLikePattern(operator)}%` });
    if (module) qb.andWhere('log.module = :module', { module });
    if (actionType) qb.andWhere('log.action = :actionType', { actionType });
    if (result) qb.andWhere('(log.loginResult = :result OR (log.responseCode IS NOT NULL AND :result = CASE WHEN log.responseCode < 400 THEN \'success\' ELSE \'fail\' END))', { result });
    if (startTime) qb.andWhere('log.createdAt >= :startTime', { startTime });
    if (endTime) qb.andWhere('log.createdAt <= :endTime', { endTime });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  @Get('audit-logs/export')
  @Permissions('sys:audit:list')
  @ApiOperation({ summary: '导出审计日志（JSON 格式）' })
  async exportAuditLogs(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const qb = this.auditRepo
      .createQueryBuilder('log')
      .where('log.tenantId = :tenantId', { tenantId })
      .orderBy('log.createdAt', 'DESC');
    if (startTime) qb.andWhere('log.createdAt >= :startTime', { startTime });
    if (endTime) qb.andWhere('log.createdAt <= :endTime', { endTime });
    const items = await qb.getMany();
    return { items, total: items.length, exportedAt: new Date().toISOString() };
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
    if (name) qb.andWhere('r.name LIKE :name', { name: `%${escapeLikePattern(name)}%` });
    const [list, total] = await qb.getManyAndCount();
    return { list, total, page, pageSize };
  }

  @Get('roles/:id/permissions')
  @ApiOperation({ summary: '获取角色权限列表' })
  async getRolePermissions(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    const items = await this.rolePermRepo
      .createQueryBuilder('rp')
      .innerJoin('sys_permission', 'p', 'p.id = rp.permission_id')
      .select('p.code', 'code')
      .where('rp.role_id = :roleId', { roleId: id })
      .andWhere('rp.tenant_id = :tenantId', { tenantId })
      .getRawMany();
    return items.map((i) => i.code).filter(Boolean);
  }

  @Put('roles/:id/permissions')
  @ApiOperation({ summary: '更新角色权限' })
  async updateRolePermissions(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { permissions: string[] },
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    // 验证权限不越权
    if (body.permissions && !user.roles?.includes('SUPER_ADMIN')) {
      await this.validatePermScope(user, body.permissions);
    }
    await this.rolePermRepo.delete({ roleId: id, tenantId });

    if (body.permissions?.length) {
      // 将 permission code 转换为 id
      const perms = await this.permRepo.find({
        where: { code: In(body.permissions) },
      });
      const codeToId = new Map(perms.map((p) => [p.code, p.id]));

      await this.rolePermRepo.save(
        body.permissions
          .map((code) => {
            const permissionId = codeToId.get(code);
            if (!permissionId) return null;
            return this.rolePermRepo.create({ roleId: id, permissionId, tenantId });
          })
          .filter((x): x is SysRolePermission => x !== null),
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
    const mappedStatus = this.mapStatus(body.status);
    await this.roleRepo.update({ id, tenantId }, { status: mappedStatus });
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
    const mappedStatus = this.mapStatus(body.status);
    await this.userRepo.update({ id, tenantId }, { status: mappedStatus });
    // 禁用用户时递增 tokenVersion，使旧 token 立即失效
    if (mappedStatus === 'INACTIVE' || mappedStatus === 'DELETED') {
      await this.userRepo.increment({ id, tenantId }, 'tokenVersion', 1);
    }
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
    // 递增 tokenVersion 使旧 token 失效
    await this.userRepo.increment({ id, tenantId }, 'tokenVersion', 1);
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
    await this.orgRepo.softDelete({ id, tenantId });
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
    // 字段映射：前端 type → 后端 category；自动生成 code
    const { type, description, code, ...rest } = body;
    const mappedCode = (code as string) ?? (rest.symbol as string) ?? (rest.name as string) ?? 'UOM';
    const uom = await this.uomRepo.save(
      this.uomRepo.create({
        ...rest,
        code: mappedCode,
        category: type ?? rest.category,
        tenantId,
      } as Partial<SysUom>),
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
    const { type, description, ...rest } = body;
    await this.uomRepo.update({ id, tenantId }, {
      ...rest,
      ...(type !== undefined ? { category: type } : {}),
    } as Partial<SysUom>);
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

  @Get('tenants/:id')
  @ApiOperation({ summary: '租户详情（用户数、角色数、模块）' })
  async getTenantDetail(@Param('id') id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new Error('TENANT_NOT_FOUND');

    const userCount = await this.userRepo.count({ where: { tenantId: tenant.code } });
    const roleCount = await this.roleRepo.count({ where: { tenantId: tenant.code } });

    return {
      ...tenant,
      userCount,
      roleCount,
      enabledModules: tenant.enabledModules ?? [],
    };
  }

  /** 套餐预设：plan → 自动解析 enabledModules */
  private static readonly PLAN_MODULES: Record<string, string[]> = {
    BASIC: ['MES', 'WMS'],
    STANDARD: ['MES', 'WMS', 'PLM', 'QMS', 'HR'],
    PROFESSIONAL: ['MES', 'WMS', 'PLM', 'QMS', 'HR', 'SCM', 'ERP', 'APS'],
    ENTERPRISE: ['PLM', 'MES', 'WMS', 'QMS', 'SCM', 'ERP', 'APS', 'EAM', 'HR', 'TRACEABILITY', 'OUTSOURCING'],
  };

  @Post('tenants')
  @ApiOperation({ summary: '创建租户' })
  async createTenant(@Body() body: Record<string, unknown>) {
    const { enabledModules, contact, phone, email, remark, status, plan, ...rest } = body;
    // 字段映射：前端 contact/phone/email → 后端 contactName/contactPhone/contactEmail
    const mappedStatus = this.mapTenantStatus(status as string);
    const tenant = await this.tenantRepo.save(
      this.tenantRepo.create({
        ...rest,
        contactName: contact ?? rest.contactName,
        contactPhone: phone ?? rest.contactPhone,
        contactEmail: email ?? rest.contactEmail,
        status: mappedStatus,
        plan: (plan as string)?.toUpperCase() ?? 'STANDARD',
      } as Partial<SysTenant>),
    );

    // 为租户创建默认的 TENANT_ADMIN 角色并分配模块权限
    const adminRole = await this.roleRepo.save(
      this.roleRepo.create({
        tenantId: tenant.code,
        code: 'TENANT_ADMIN',
        name: `${tenant.name} 管理员`,
        type: 'TENANT_ADMIN',
        description: `${tenant.name} 的租户管理员角色`,
        status: 'ACTIVE',
        isSystem: 1,
      }),
    );

    // 根据 plan 或 enabledModules 分配权限，SYS + BASE 基础权限始终包含
    const BASE_MODULES = ['SYS', 'BASE'];
    const planModules = plan ? (SysController.PLAN_MODULES[(plan as string).toUpperCase()] ?? []) : [];
    const modules: string[] = (enabledModules as string[]) ?? planModules;
    const allModules = [...new Set([...BASE_MODULES, ...modules])];
    const perms = await this.permRepo.find({
      where: { module: In(allModules) },
    });
    if (perms.length > 0) {
      await this.rolePermRepo.save(
        perms.map((p) =>
          this.rolePermRepo.create({
            roleId: adminRole.id,
            permissionId: p.id,
            tenantId: tenant.code,
          }),
        ),
      );
    }

    // 同步更新租户记录（始终包含 SYS + BASE）
    await this.tenantRepo.update({ id: tenant.id }, { enabledModules: allModules } as any);

    // 初始化租户基础数据（异步，不阻塞返回）
    this.provisionSvc.provision(tenant.code, allModules).catch(() => {});

    return { id: tenant.id };
  }

  @Put('tenants/:id')
  @ApiOperation({ summary: '更新租户' })
  async updateTenant(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const { enabledModules, contact, phone, email, remark, status, ...rest } = body;
    const mappedStatus = this.mapTenantStatus(status as string);
    const oldTenant = await this.tenantRepo.findOne({ where: { id } });

    await this.tenantRepo.update({ id }, {
      ...rest,
      ...(contact !== undefined ? { contactName: contact } : {}),
      ...(phone !== undefined ? { contactPhone: phone } : {}),
      ...(email !== undefined ? { contactEmail: email } : {}),
      ...(mappedStatus ? { status: mappedStatus } : {}),
    } as any);

    // 如果 enabledModules 变更，同步更新租户的 TENANT_ADMIN 角色权限
    if (enabledModules !== undefined && oldTenant) {
      await this.tenantRepo.update({ id }, { enabledModules: enabledModules as string[] } as any);

      const adminRole = await this.roleRepo.findOne({
        where: { tenantId: oldTenant.code, code: 'TENANT_ADMIN' },
      });
      if (adminRole) {
        // 删除旧的 TENANT_ADMIN 权限
        await this.rolePermRepo.delete({ roleId: adminRole.id, tenantId: oldTenant.code });

        // 分配新的权限
        const modules = enabledModules as string[];
        if (modules.length > 0) {
          const perms = await this.permRepo.find({
            where: { module: In(modules) },
          });
          if (perms.length > 0) {
            await this.rolePermRepo.save(
              perms.map((p) =>
                this.rolePermRepo.create({
                  roleId: adminRole.id,
                  permissionId: p.id,
                  tenantId: oldTenant.code,
                }),
              ),
            );
          }
        }
      }
    }

    return { id };
  }

  @Patch('tenants/:id/status')
  @ApiOperation({ summary: '切换租户状态' })
  async toggleTenantStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    const mappedStatus = this.mapTenantStatus(body.status) ?? body.status;
    await this.tenantRepo.update({ id }, { status: mappedStatus });
    return { id };
  }

  // ─── 全局配置管理 ────────────────────────────────────────────────

  @Get('configs')
  @ApiOperation({ summary: '全局配置列表' })
  async getConfigs(
    @Query('group') group?: string,
  ) {
    const tenantId = TenantContext.requireCurrentTenant();
    const where: Record<string, unknown> = { tenantId };
    if (group) where.group = group;
    return this.configRepo.find({ where, order: { group: 'ASC', key: 'ASC' } });
  }

  @Post('configs')
  @ApiOperation({ summary: '创建/更新配置' })
  async upsertConfig(@Body() body: { key: string; value: string; group?: string; description?: string }) {
    const tenantId = TenantContext.requireCurrentTenant();
    const existing = await this.configRepo.findOne({ where: { tenantId, key: body.key } });
    if (existing) {
      await this.configRepo.update(existing.id, { value: body.value, description: body.description });
      return this.configRepo.findOne({ where: { id: existing.id } });
    }
    return this.configRepo.save(this.configRepo.create({ ...body, tenantId }));
  }

  @Delete('configs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除配置' })
  async deleteConfig(@Param('id') id: string) {
    const tenantId = TenantContext.requireCurrentTenant();
    await this.configRepo.delete({ id, tenantId });
  }

  /** 前端小写 status → 后端大写（租户专用） */
  private mapTenantStatus(status?: string): string | undefined {
    if (!status) return undefined;
    const map: Record<string, string> = {
      trial: 'TRIAL', formal: 'ACTIVE', expired: 'EXPIRED', disabled: 'INACTIVE',
    };
    return map[status] ?? status.toUpperCase();
  }

  /** 前端小写 status → 后端大写（通用：用户/角色） */
  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      active: 'ACTIVE', disabled: 'INACTIVE', deleted: 'DELETED',
    };
    return map[status] ?? status.toUpperCase();
  }
}
