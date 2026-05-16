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

    function flatten(items: SeedPermission[]) {
      for (const item of items) {
        flatList.push(item);
        if (item.children) {
          flatten(item.children as SeedPermission[]);
        }
      }
    }
    flatten(SEED_PERMISSIONS);

    // Find new permissions that don't exist in DB yet
    const newItems = flatList.filter((item) => !existingCodes.has(item.code));
    if (newItems.length === 0) {
      this.logger.log(`All ${flatList.length} permissions already exist — nothing to seed`);
      return;
    }

    this.logger.log(`Seeding ${newItems.length} new permissions...`);
    const codeMap = new Map<string, SysPermission>();

    // Load existing permissions into codeMap for parent linking
    for (const existing of await this.permRepo.find()) {
      codeMap.set(existing.code, existing);
    }

    // First pass: insert new permissions, map code → entity
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
      perm.parentId = undefined; // will fix in second pass
      const entity = await this.permRepo.save(perm);
      codeMap.set(entity.code, entity);
    }

    // Second pass: link parentId using parentCode for new items
    for (const item of newItems) {
      if (item.parentCode && codeMap.has(item.code)) {
        const parent = codeMap.get(item.parentCode);
        if (parent) {
          await this.permRepo.update({ code: item.code }, { parentId: parent.id });
        }
      }
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
