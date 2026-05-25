import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysPermission } from '../entities/sys-permission.entity.js';
import { SysRole } from '../entities/sys-role.entity.js';
import { SysRolePermission } from '../entities/sys-role-permission.entity.js';
import { SEED_PERMISSIONS, DEFAULT_ROLES, SeedPermission } from './permissions.data.js';

@Injectable()
export class PermissionSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionSeedService.name);

  constructor(
    @InjectRepository(SysPermission)
    private readonly permRepo: Repository<SysPermission>,
    @InjectRepository(SysRole)
    private readonly roleRepo: Repository<SysRole>,
    @InjectRepository(SysRolePermission)
    private readonly rolePermRepo: Repository<SysRolePermission>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedPermissions();
    await this.ensureRoles();
    this.logger.log('✅ Permission seed completed');
  }

  private async seedPermissions() {
    const existingPerms = await this.permRepo.find({ select: ['code'] });
    const existingCodes = new Set(existingPerms.map((p) => p.code));

    // Flatten the tree into ordered list
    const flatList: SeedPermission[] = [];

    function flatten(items: SeedPermission[], parentCode?: string) {
      for (const item of items) {
        // 自动设置 parentCode（子项跟随父级的 code）
        if (parentCode && !item.parentCode) {
          (item as any).parentCode = parentCode;
        }
        flatList.push(item);
        if (item.children) {
          flatten(item.children as SeedPermission[], item.code);
        }
      }
    }
    flatten(SEED_PERMISSIONS);

    // Find new permissions that don't exist in DB yet
    const newItems = flatList.filter((item) => !existingCodes.has(item.code));
    const codeMap = new Map<string, SysPermission>();

    // Load ALL existing permissions into codeMap
    for (const existing of await this.permRepo.find()) {
      codeMap.set(existing.code, existing);
    }

    // First pass: insert new permissions（同时设置 parentCode）
    if (newItems.length > 0) {
      this.logger.log(`Seeding ${newItems.length} new permissions...`);
      for (const item of newItems) {
        const perm = new SysPermission();
        perm.code = item.code;
        perm.name = item.name;
        perm.type = item.type;
        perm.module = item.module;
        perm.path = item.path ?? undefined;
        perm.component = item.component ?? undefined;
        perm.icon = item.icon ?? undefined;
        perm.sortOrder = item.sortOrder ?? 0;
        perm.isVisible = item.isVisible ?? 1;
        perm.parentCode = item.parentCode ?? undefined;
        const entity = await this.permRepo.save(perm);
        codeMap.set(entity.code, entity);
      }
    }

    // Second pass: 修正所有记录的 parentCode（确保已有记录的 parentCode 不为空）
    let parentCodeFixed = 0;
    for (const item of flatList) {
      if (!item.parentCode) continue;
      const entity = codeMap.get(item.code);
      if (entity && !entity.parentCode) {
        await this.permRepo.update({ code: item.code }, { parentCode: item.parentCode });
        entity.parentCode = item.parentCode;
        parentCodeFixed++;
      }
    }
    if (parentCodeFixed > 0) {
      this.logger.log(`Fixed parentCode for ${parentCodeFixed} existing records`);
    }

    // Third pass: 修正所有记录的 parentId（不仅限新增，确保已有记录也正确关联）
    let linked = 0;
    for (const item of flatList) {
      if (!item.parentCode) continue;
      const entity = codeMap.get(item.code);
      const parent = codeMap.get(item.parentCode);
      if (entity && parent && String(entity.parentId) !== String(parent.id)) {
        await this.permRepo.update({ code: item.code }, { parentId: parent.id });
        linked++;
      }
    }

    if (newItems.length === 0 && parentCodeFixed === 0 && linked === 0) {
      this.logger.log(`All ${flatList.length} permissions already exist and linked — nothing to seed`);
      return;
    }
    if (linked > 0) {
      this.logger.log(`Linked ${linked} permissions to their parents`);
    }

    // Update TENANT_ADMIN role with any new permissions (if role exists)
    const adminRole = await this.roleRepo.findOne({ where: { type: 'TENANT_ADMIN' } });
    if (adminRole) {
      const newPerms = codeMap
        .get(Array.from(codeMap.keys()).find((k) => newItems.some((ni) => ni.code === k))!)
        ? undefined
        : undefined;
      const newPermEntities = newItems
        .map((item) => codeMap.get(item.code))
        .filter((p): p is SysPermission => !!p);
      if (newPermEntities.length > 0) {
        const rolePerms = newPermEntities.map((p) =>
          this.rolePermRepo.create({
            roleId: adminRole.id,
            permissionId: p.id,
            tenantId: '__SYSTEM__',
          }),
        );
        await this.rolePermRepo.save(rolePerms);
        this.logger.log(`Assigned ${newPermEntities.length} new permissions to TENANT_ADMIN`);
      }
    }

    this.logger.log(`Seeded ${newItems.length} new permissions (${existingCodes.size} existed)`);
  }

  private async ensureRoles() {
    // Only seed roles if they don't exist
    for (const defaultRole of Object.values(DEFAULT_ROLES)) {
      const existing = await this.roleRepo.findOne({ where: { code: defaultRole.code } });
      if (existing) continue;

      const role = await this.roleRepo.save(
        this.roleRepo.create({
          tenantId: '__SYSTEM__',
          code: defaultRole.code,
          name: defaultRole.name,
          type: defaultRole.type,
          description: defaultRole.description,
          isSystem: 1,
        }),
      );

      // TENANT_ADMIN gets all permissions
      if (defaultRole.type === 'TENANT_ADMIN') {
        const allPerms = await this.permRepo.find();
        if (allPerms.length > 0) {
          await this.rolePermRepo.save(
            allPerms.map((p) =>
              this.rolePermRepo.create({
                roleId: role.id,
                permissionId: p.id,
                tenantId: '__SYSTEM__',
              }),
            ),
          );
          this.logger.log(`Assigned ${allPerms.length} permissions to ${defaultRole.code}`);
        }
      }
    }
  }
}
