import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

// ─── Auth / System ───────────────────────────────────────────
import { SysTenant } from '../../auth/entities/sys-tenant.entity.js';
import { SysUser } from '../../auth/entities/sys-user.entity.js';
import { SysRole } from '../../auth/entities/sys-role.entity.js';
import { SysUserRole } from '../../auth/entities/sys-user-role.entity.js';

// ─── Base ────────────────────────────────────────────────────
import { SysOrganization } from '../../base/entities/sys-organization.entity.js';
import { SysUom, SysUomConversion } from '../../base/entities/sys-uom.entity.js';
import { SysNumberingRule } from '../../base/entities/sys-numbering-rule.entity.js';
import { MfgWorkCenter } from '../../base/entities/mfg-work-center.entity.js';

// ─── HR ──────────────────────────────────────────────────────
import { HrShift } from '../../hr/entities/hr-shift.entity.js';
import { HrJobType } from '../../hr/entities/hr-job-type.entity.js';

// ─── PLM ─────────────────────────────────────────────────────
import { PlmMaterialCategory } from '../../plm/entities/plm-material-category.entity.js';

// ─── WMS ─────────────────────────────────────────────────────
import { WmsWarehouse } from '../../wms/entities/wms-warehouse.entity.js';
import { WmsZone } from '../../wms/entities/wms-zone.entity.js';
import { WmsLocation } from '../../wms/entities/wms-location.entity.js';

// ─── ERP ─────────────────────────────────────────────────────
import { ErpAccount } from '../../erp/entities/erp-account.entity.js';
import { ErpCostCenter } from '../../erp/entities/erp-cost-center.entity.js';

const SALT_ROUNDS = 12;
const DEFAULT_TENANT_ID = 'DEFAULT';

// ─── 种子数据定义 ──────────────────────────────────────────────

const UOM_DATA = [
  { code: 'PCS', name: '个', symbol: '个', category: 'COUNT', isBase: 1 },
  { code: 'KG', name: '千克', symbol: 'kg', category: 'WEIGHT', isBase: 1 },
  { code: 'G', name: '克', symbol: 'g', category: 'WEIGHT', isBase: 0 },
  { code: 'T', name: '吨', symbol: 't', category: 'WEIGHT', isBase: 0 },
  { code: 'M', name: '米', symbol: 'm', category: 'LENGTH', isBase: 1 },
  { code: 'CM', name: '厘米', symbol: 'cm', category: 'LENGTH', isBase: 0 },
  { code: 'MM', name: '毫米', symbol: 'mm', category: 'LENGTH', isBase: 0 },
  { code: 'L', name: '升', symbol: 'L', category: 'VOLUME', isBase: 1 },
  { code: 'ML', name: '毫升', symbol: 'mL', category: 'VOLUME', isBase: 0 },
  { code: 'M2', name: '平方米', symbol: 'm²', category: 'AREA', isBase: 1 },
  { code: 'M3', name: '立方米', symbol: 'm³', category: 'VOLUME', isBase: 0 },
  { code: 'H', name: '小时', symbol: 'h', category: 'TIME', isBase: 1 },
  { code: 'D', name: '天', symbol: 'd', category: 'TIME', isBase: 0 },
  { code: 'BAG', name: '包', symbol: '包', category: 'PACKAGE', isBase: 0 },
  { code: 'BOX', name: '箱', symbol: '箱', category: 'PACKAGE', isBase: 0 },
  { code: 'PLT', name: '托盘', symbol: '托盘', category: 'PACKAGE', isBase: 0 },
];

const UOM_CONVERSION_DATA = [
  { fromCode: 'KG', toCode: 'G', factor: 1000 },
  { fromCode: 'T', toCode: 'KG', factor: 1000 },
  { fromCode: 'M', toCode: 'CM', factor: 100 },
  { fromCode: 'M', toCode: 'MM', factor: 1000 },
  { fromCode: 'L', toCode: 'ML', factor: 1000 },
  { fromCode: 'D', toCode: 'H', factor: 24 },
];

const SHIFT_DATA = [
  { code: 'DAY', name: '早班', startTime: '08:00', endTime: '16:00' },
  { code: 'MID', name: '中班', startTime: '16:00', endTime: '00:00' },
  { code: 'NIGHT', name: '夜班', startTime: '00:00', endTime: '08:00' },
];

const JOB_TYPE_DATA = [
  { code: 'OPERATOR', name: '操作工' },
  { code: 'QC', name: '质检员' },
  { code: 'TECHNICIAN', name: '技术员' },
  { code: 'MANAGER', name: '管理员' },
  { code: 'STOREKEEPER', name: '仓管员' },
  { code: 'MAINTAINER', name: '维修工' },
  { code: 'PLANNER', name: '计划员' },
];

const WORK_CENTER_DATA = [
  { name: '总装线', code: 'ASSY_LINE' },
  { name: '机加工线', code: 'MACHINE_LINE' },
  { name: '包装线', code: 'PACK_LINE' },
  { name: '质检台', code: 'QC_STATION' },
  { name: '原材料库工作中心', code: 'RAW_WH' },
  { name: '成品库工作中心', code: 'FG_WH' },
];

const MATERIAL_CATEGORY_DATA = [
  { code: 'RAW', name: '原材料', parentCode: null, level: 1 },
  { code: 'SEMI', name: '半成品', parentCode: null, level: 1 },
  { code: 'FINISHED', name: '成品', parentCode: null, level: 1 },
  { code: 'AUX', name: '辅料', parentCode: null, level: 1 },
  { code: 'PACK', name: '包装材料', parentCode: null, level: 1 },
  { code: 'SPARE', name: '备品备件', parentCode: null, level: 1 },
  { code: 'RAW_METAL', name: '金属材料', parentCode: 'RAW', level: 2 },
  { code: 'RAW_PLASTIC', name: '塑料材料', parentCode: 'RAW', level: 2 },
  { code: 'RAW_ELECTRONIC', name: '电子元件', parentCode: 'RAW', level: 2 },
];

const NUMBERING_RULE_DATA = [
  { businessKey: 'PLM_MATERIAL', code: 'MAT', name: '物料编码', segments: [{ type: 'CONST', value: 'MAT' }, { type: 'DATE', format: 'YYYYMMDD' }, { type: 'SERIAL', length: 4, padChar: '0' }] },
  { businessKey: 'PLM_BOM', code: 'BOM', name: 'BOM编码', segments: [{ type: 'CONST', value: 'BOM' }, { type: 'DATE', format: 'YYYYMMDD' }, { type: 'SERIAL', length: 4, padChar: '0' }] },
  { businessKey: 'PLM_ROUTING', code: 'ROUT', name: '工艺路线编码', segments: [{ type: 'CONST', value: 'ROUT' }, { type: 'DATE', format: 'YYYYMMDD' }, { type: 'SERIAL', length: 4, padChar: '0' }] },
  { businessKey: 'MES_WO', code: 'WO', name: '生产工单编码', segments: [{ type: 'CONST', value: 'WO' }, { type: 'DATE', format: 'YYYYMMDD' }, { type: 'SERIAL', length: 4, padChar: '0' }] },
  { businessKey: 'SCM_PO', code: 'PO', name: '采购订单编码', segments: [{ type: 'CONST', value: 'PO' }, { type: 'DATE', format: 'YYYYMMDD' }, { type: 'SERIAL', length: 4, padChar: '0' }] },
  { businessKey: 'SCM_PR', code: 'PR', name: '采购申请编码', segments: [{ type: 'CONST', value: 'PR' }, { type: 'DATE', format: 'YYYYMMDD' }, { type: 'SERIAL', length: 4, padChar: '0' }] },
  { businessKey: 'ERP_SO', code: 'SO', name: '销售订单编码', segments: [{ type: 'CONST', value: 'SO' }, { type: 'DATE', format: 'YYYYMMDD' }, { type: 'SERIAL', length: 4, padChar: '0' }] },
  { businessKey: 'WMS_ASN', code: 'ASN', name: '入库通知单编码', segments: [{ type: 'CONST', value: 'ASN' }, { type: 'DATE', format: 'YYYYMMDD' }, { type: 'SERIAL', length: 4, padChar: '0' }] },
  { businessKey: 'QMS_QC', code: 'QC', name: '质检单编码', segments: [{ type: 'CONST', value: 'QC' }, { type: 'DATE', format: 'YYYYMMDD' }, { type: 'SERIAL', length: 4, padChar: '0' }] },
  { businessKey: 'EAM_MT', code: 'MT', name: '维修工单编码', segments: [{ type: 'CONST', value: 'MT' }, { type: 'DATE', format: 'YYYYMMDD' }, { type: 'SERIAL', length: 4, padChar: '0' }] },
];

const WAREHOUSE_DATA = [
  { code: 'WH_MAIN', name: '主仓库', type: 'PHYSICAL' },
  { code: 'WH_RAW', name: '原材料仓', type: 'PHYSICAL' },
  { code: 'WH_SEMI', name: '半成品仓', type: 'PHYSICAL' },
  { code: 'WH_FG', name: '成品仓', type: 'PHYSICAL' },
  { code: 'WH_NG', name: '不良品仓', type: 'PHYSICAL' },
];

const ZONE_DATA: Record<string, { code: string; name: string; zoneType: string }[]> = {
  WH_MAIN: [
    { code: 'Z-RCV', name: '收货区', zoneType: 'RECEIVING' },
    { code: 'Z-STORE', name: '存储区', zoneType: 'RAW_MATERIAL' },
    { code: 'Z-PICK', name: '拣货区', zoneType: 'PICKING' },
    { code: 'Z-SHIP', name: '发货区', zoneType: 'SHIPPING' },
  ],
  WH_RAW: [
    { code: 'Z-RCV', name: '收货区', zoneType: 'RECEIVING' },
    { code: 'Z-STORE', name: '存储区', zoneType: 'RAW_MATERIAL' },
    { code: 'Z-QC', name: '待检区', zoneType: 'QUARANTINE' },
  ],
  WH_FG: [
    { code: 'Z-STORE', name: '存储区', zoneType: 'FINISHED' },
    { code: 'Z-SHIP', name: '发货区', zoneType: 'SHIPPING' },
  ],
  WH_SEMI: [
    { code: 'Z-STORE', name: '存储区', zoneType: 'SEMI_FINISHED' },
    { code: 'Z-TRANSIT', name: '中转区', zoneType: 'TRANSIT' },
  ],
  WH_NG: [
    { code: 'Z-NG', name: '不良品区', zoneType: 'NONCONFORMING' },
    { code: 'Z-SCRAP', name: '报废区', zoneType: 'SCRAP' },
  ],
};

const ACCOUNT_DATA = [
  // 资产类 1xxx
  { code: '1001', name: '现金', type: 'ASSET', parentCode: null },
  { code: '1002', name: '银行存款', type: 'ASSET', parentCode: null },
  { code: '1122', name: '应收账款', type: 'ASSET', parentCode: null },
  { code: '1123', name: '预付账款', type: 'ASSET', parentCode: null },
  { code: '1403', name: '原材料', type: 'ASSET', parentCode: null },
  { code: '1405', name: '库存商品', type: 'ASSET', parentCode: null },
  { code: '1408', name: '委托加工物资', type: 'ASSET', parentCode: null },
  { code: '1601', name: '固定资产', type: 'ASSET', parentCode: null },
  { code: '1602', name: '累计折旧', type: 'ASSET', parentCode: null },
  // 负债类 2xxx
  { code: '2201', name: '应付账款', type: 'LIABILITY', parentCode: null },
  { code: '2202', name: '预收账款', type: 'LIABILITY', parentCode: null },
  { code: '2211', name: '应付职工薪酬', type: 'LIABILITY', parentCode: null },
  { code: '2221', name: '应交税费', type: 'LIABILITY', parentCode: null },
  // 权益类 4xxx
  { code: '4001', name: '实收资本', type: 'EQUITY', parentCode: null },
  { code: '4101', name: '盈余公积', type: 'EQUITY', parentCode: null },
  { code: '4103', name: '本年利润', type: 'EQUITY', parentCode: null },
  { code: '4104', name: '利润分配', type: 'EQUITY', parentCode: null },
  // 成本类 5xxx
  { code: '5001', name: '生产成本', type: 'EXPENSE', parentCode: null },
  { code: '5101', name: '制造费用', type: 'EXPENSE', parentCode: null },
  { code: '5201', name: '劳务成本', type: 'EXPENSE', parentCode: null },
  // 损益类 6xxx
  { code: '6001', name: '主营业务收入', type: 'REVENUE', parentCode: null },
  { code: '6051', name: '其他业务收入', type: 'REVENUE', parentCode: null },
  { code: '6401', name: '主营业务成本', type: 'EXPENSE', parentCode: null },
  { code: '6402', name: '其他业务成本', type: 'EXPENSE', parentCode: null },
  { code: '6601', name: '销售费用', type: 'EXPENSE', parentCode: null },
  { code: '6602', name: '管理费用', type: 'EXPENSE', parentCode: null },
  { code: '6603', name: '财务费用', type: 'EXPENSE', parentCode: null },
];

const COST_CENTER_DATA = [
  { code: 'CC_DEFAULT', name: '默认成本中心', centerType: 'FACTORY' },
];

@Injectable()
export class InitSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitSeedService.name);

  constructor(
    @InjectRepository(SysTenant)
    private readonly tenantRepo: Repository<SysTenant>,
    @InjectRepository(SysUser)
    private readonly userRepo: Repository<SysUser>,
    @InjectRepository(SysRole)
    private readonly roleRepo: Repository<SysRole>,
    @InjectRepository(SysUserRole)
    private readonly userRoleRepo: Repository<SysUserRole>,
    @InjectRepository(SysOrganization)
    private readonly orgRepo: Repository<SysOrganization>,
    @InjectRepository(SysUom)
    private readonly uomRepo: Repository<SysUom>,
    @InjectRepository(SysUomConversion)
    private readonly uomConvRepo: Repository<SysUomConversion>,
    @InjectRepository(SysNumberingRule)
    private readonly numberingRuleRepo: Repository<SysNumberingRule>,
    @InjectRepository(MfgWorkCenter)
    private readonly workCenterRepo: Repository<MfgWorkCenter>,
    @InjectRepository(HrShift)
    private readonly shiftRepo: Repository<HrShift>,
    @InjectRepository(HrJobType)
    private readonly jobTypeRepo: Repository<HrJobType>,
    @InjectRepository(PlmMaterialCategory)
    private readonly matCatRepo: Repository<PlmMaterialCategory>,
    @InjectRepository(WmsWarehouse)
    private readonly warehouseRepo: Repository<WmsWarehouse>,
    @InjectRepository(WmsZone)
    private readonly zoneRepo: Repository<WmsZone>,
    @InjectRepository(WmsLocation)
    private readonly locationRepo: Repository<WmsLocation>,
    @InjectRepository(ErpAccount)
    private readonly accountRepo: Repository<ErpAccount>,
    @InjectRepository(ErpCostCenter)
    private readonly costCenterRepo: Repository<ErpCostCenter>,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('🚀 开始初始化基础种子数据...');

    await this.seedTenant();
    await this.seedUsers();
    await this.seedOrganization();
    await this.seedUoms();
    await this.seedShifts();
    await this.seedJobTypes();
    await this.seedWorkCenters();
    await this.seedMaterialCategories();
    await this.seedNumberingRules();
    await this.seedWarehouses();
    await this.seedAccounts();
    await this.seedCostCenters();

    this.logger.log('✅ 基础种子数据初始化完成');
  }

  // ─── 1. 默认租户 ──────────────────────────────────────────────

  private async seedTenant() {
    // 1. 系统级租户（超级管理员所属）
    const systemTenant = await this.tenantRepo.findOne({ where: { code: '__SYSTEM__' } });
    if (!systemTenant) {
      await this.tenantRepo.save(
        this.tenantRepo.create({
          code: '__SYSTEM__',
          name: '系统平台',
          status: 'ACTIVE',
          plan: 'UNLIMITED',
          maxUsers: 999999,
          enabledModules: ['PLM', 'MES', 'WMS', 'QMS', 'SCM', 'ERP', 'APS', 'EAM', 'HR', 'TRACE'],
        }),
      );
      this.logger.log('✅ 系统租户 __SYSTEM__ 已创建');
    }

    // 2. 默认业务租户
    const exists = await this.tenantRepo.findOne({ where: { code: DEFAULT_TENANT_ID } });
    if (exists) {
      this.logger.log('⏭️  默认租户已存在，跳过');
      return;
    }
    await this.tenantRepo.save(
      this.tenantRepo.create({
        code: DEFAULT_TENANT_ID,
        name: '默认企业',
        status: 'ACTIVE',
        plan: 'STANDARD',
        maxUsers: 50,
        enabledModules: ['PLM', 'MES', 'WMS', 'QMS', 'SCM', 'ERP', 'APS', 'EAM', 'HR', 'TRACE'],
      }),
    );
    this.logger.log('✅ 默认租户已创建');
  }

  // ─── 2. 默认用户 ──────────────────────────────────────────────

  private async seedUsers() {
    const superAdmin = await this.userRepo.findOne({ where: { username: 'superadmin' } });
    if (superAdmin) {
      this.logger.log('⏭️  默认用户已存在，跳过');
      return;
    }

    const superRole = await this.roleRepo.findOne({ where: { code: 'SUPER_ADMIN' } });
    const adminRole = await this.roleRepo.findOne({ where: { code: 'TENANT_ADMIN' } });
    const defaultRole = await this.roleRepo.findOne({ where: { code: 'USER' } });

    // 如果角色还未创建，先创建系统角色
    const roles = await this.ensureSystemRoles();

    const superAdminRole = superRole ?? roles.superAdmin;
    const tenantAdminRole = adminRole ?? roles.tenantAdmin;
    const userRole = defaultRole ?? roles.defaultUser;

    const pwHash = await bcrypt.hash('Admin@123456', SALT_ROUNDS);

    // 超级管理员 — 平台级，不属于任何租户
    const sa = await this.userRepo.save(
      this.userRepo.create({
        tenantId: '__SYSTEM__',
        username: 'superadmin',
        password: pwHash,
        realName: '超级管理员',
        status: 'ACTIVE',
      }),
    );
    await this.userRoleRepo.save(
      this.userRoleRepo.create({
        tenantId: '__SYSTEM__',
        userId: sa.id,
        roleId: superAdminRole.id,
      }),
    );

    // 租户管理员 — 属于默认租户
    const admin = await this.userRepo.save(
      this.userRepo.create({
        tenantId: DEFAULT_TENANT_ID,
        username: 'admin',
        password: pwHash,
        realName: '租户管理员',
        status: 'ACTIVE',
        employeeNo: 'ADM001',
      }),
    );
    await this.userRoleRepo.save([
      this.userRoleRepo.create({
        tenantId: DEFAULT_TENANT_ID,
        userId: admin.id,
        roleId: tenantAdminRole.id,
      }),
      // admin 也拥有 USER 角色
      this.userRoleRepo.create({
        tenantId: DEFAULT_TENANT_ID,
        userId: admin.id,
        roleId: userRole.id,
      }),
    ]);

    this.logger.log('✅ 默认用户已创建：superadmin / admin (密码: Admin@123456)');
  }

  private async ensureSystemRoles() {
    let superAdmin = await this.roleRepo.findOne({ where: { code: 'SUPER_ADMIN' } });
    let tenantAdmin = await this.roleRepo.findOne({ where: { code: 'TENANT_ADMIN' } });
    let defaultUser = await this.roleRepo.findOne({ where: { code: 'USER' } });

    if (!superAdmin) {
      superAdmin = await this.roleRepo.save(
        this.roleRepo.create({
          tenantId: '__SYSTEM__',
          code: 'SUPER_ADMIN',
          name: '超级管理员',
          type: 'SUPER_ADMIN',
          description: '平台超级管理员，拥有全部权限',
          isSystem: 1,
        }),
      );
    }
    if (!tenantAdmin) {
      tenantAdmin = await this.roleRepo.save(
        this.roleRepo.create({
          tenantId: '__SYSTEM__',
          code: 'TENANT_ADMIN',
          name: '租户管理员',
          type: 'TENANT_ADMIN',
          description: '租户管理员，拥有租户内全部权限',
          isSystem: 1,
        }),
      );
    }
    if (!defaultUser) {
      defaultUser = await this.roleRepo.save(
        this.roleRepo.create({
          tenantId: '__SYSTEM__',
          code: 'USER',
          name: '普通用户',
          type: 'USER',
          description: '普通用户，拥有基本访问权限',
          isSystem: 1,
        }),
      );
    }

    return { superAdmin, tenantAdmin, defaultUser };
  }

  // ─── 3. 组织架构 ──────────────────────────────────────────────

  private async seedOrganization() {
    const exists = await this.orgRepo.findOne({ where: { tenantId: DEFAULT_TENANT_ID, code: 'DEFAULT_ORG' } });
    if (exists) {
      this.logger.log('⏭️  默认组织已存在，跳过');
      return;
    }
    await this.orgRepo.save(
      this.orgRepo.create({
        tenantId: DEFAULT_TENANT_ID,
        code: 'DEFAULT_ORG',
        name: '默认企业',
        type: 'COMPANY',
        level: 1,
        path: '1',
        sortOrder: 1,
        status: 'ACTIVE',
      }),
    );
    this.logger.log('✅ 默认组织已创建');
  }

  // ─── 4. 计量单位 ──────────────────────────────────────────────

  private async seedUoms() {
    const count = await this.uomRepo.count({ where: { tenantId: DEFAULT_TENANT_ID } });
    if (count > 0) {
      this.logger.log('⏭️  计量单位已存在，跳过');
      return;
    }
    // 批量插入 UOM
    const uomEntities = UOM_DATA.map((d) =>
      this.uomRepo.create({
        tenantId: DEFAULT_TENANT_ID,
        code: d.code,
        name: d.name,
        symbol: d.symbol,
        category: d.category,
        isBase: d.isBase,
        status: 'ACTIVE',
      }),
    );
    const saved = await this.uomRepo.save(uomEntities);

    // 建立 code → id 映射
    const codeIdMap = new Map<string, string>();
    for (const u of saved) {
      codeIdMap.set(u.code, u.id);
    }

    // 插入换算关系
    const convEntities = UOM_CONVERSION_DATA
      .filter((d) => codeIdMap.has(d.fromCode) && codeIdMap.has(d.toCode))
      .map((d) =>
        this.uomConvRepo.create({
          tenantId: DEFAULT_TENANT_ID,
          fromUomId: codeIdMap.get(d.fromCode)!,
          toUomId: codeIdMap.get(d.toCode)!,
          factor: d.factor,
        }),
      );
    if (convEntities.length > 0) {
      await this.uomConvRepo.save(convEntities);
    }

    this.logger.log(`✅ 已创建 ${saved.length} 个计量单位和 ${convEntities.length} 个换算关系`);
  }

  // ─── 5. 班次 ──────────────────────────────────────────────────

  private async seedShifts() {
    const count = await this.shiftRepo.count({ where: { tenantId: DEFAULT_TENANT_ID } });
    if (count > 0) {
      this.logger.log('⏭️  班次已存在，跳过');
      return;
    }
    await this.shiftRepo.save(
      SHIFT_DATA.map((d) =>
        this.shiftRepo.create({
          tenantId: DEFAULT_TENANT_ID,
          code: d.code,
          name: d.name,
          startTime: d.startTime,
          endTime: d.endTime,
        }),
      ),
    );
    this.logger.log(`✅ 已创建 ${SHIFT_DATA.length} 个班次`);
  }

  // ─── 6. 岗位类型 ──────────────────────────────────────────────

  private async seedJobTypes() {
    const count = await this.jobTypeRepo.count({ where: { tenantId: DEFAULT_TENANT_ID } });
    if (count > 0) {
      this.logger.log('⏭️  岗位类型已存在，跳过');
      return;
    }
    await this.jobTypeRepo.save(
      JOB_TYPE_DATA.map((d) =>
        this.jobTypeRepo.create({
          tenantId: DEFAULT_TENANT_ID,
          code: d.code,
          name: d.name,
          enabled: 1,
        }),
      ),
    );
    this.logger.log(`✅ 已创建 ${JOB_TYPE_DATA.length} 个岗位类型`);
  }

  // ─── 7. 工作中心 ──────────────────────────────────────────────

  private async seedWorkCenters() {
    const count = await this.workCenterRepo.count({ where: { tenantId: DEFAULT_TENANT_ID } });
    if (count > 0) {
      this.logger.log('⏭️  工作中心已存在，跳过');
      return;
    }
    await this.workCenterRepo.save(
      WORK_CENTER_DATA.map((d) =>
        this.workCenterRepo.create({
          tenantId: DEFAULT_TENANT_ID,
          code: d.code,
          name: d.name,
          enabled: 1,
        }),
      ),
    );
    this.logger.log(`✅ 已创建 ${WORK_CENTER_DATA.length} 个工作中心`);
  }

  // ─── 8. 物料分类 ──────────────────────────────────────────────

  private async seedMaterialCategories() {
    const count = await this.matCatRepo.count({ where: { tenantId: DEFAULT_TENANT_ID } });
    if (count > 0) {
      this.logger.log('⏭️  物料分类已存在，跳过');
      return;
    }
    // 先插入一级分类
    const topLevel = MATERIAL_CATEGORY_DATA.filter((d) => d.level === 1);
    const topEntities = await this.matCatRepo.save(
      topLevel.map((d) =>
        this.matCatRepo.create({
          tenantId: DEFAULT_TENANT_ID,
          code: d.code,
          name: d.name,
          level: 1,
          sortOrder: 1,
          status: 'ACTIVE',
        }),
      ),
    );

    const codeMap = new Map(topEntities.map((e) => [e.code, e.id]));

    // 再插入二级分类
    const subLevel = MATERIAL_CATEGORY_DATA.filter((d) => d.level === 2);
    let seq = 1;
    const subEntities = subLevel
      .filter((d) => codeMap.has(d.parentCode!))
      .map((d) =>
        this.matCatRepo.create({
          tenantId: DEFAULT_TENANT_ID,
          code: d.code,
          name: d.name,
          parentId: codeMap.get(d.parentCode!),
          level: 2,
          sortOrder: seq++,
          status: 'ACTIVE',
        }),
      );
    if (subEntities.length > 0) {
      await this.matCatRepo.save(subEntities);
    }

    this.logger.log(`✅ 已创建 ${topEntities.length + subEntities.length} 个物料分类`);
  }

  // ─── 9. 编码规则 ──────────────────────────────────────────────

  private async seedNumberingRules() {
    const count = await this.numberingRuleRepo.count({ where: { tenantId: DEFAULT_TENANT_ID } });
    if (count > 0) {
      this.logger.log('⏭️  编码规则已存在，跳过');
      return;
    }
    await this.numberingRuleRepo.save(
      NUMBERING_RULE_DATA.map((d) =>
        this.numberingRuleRepo.create({
          tenantId: DEFAULT_TENANT_ID,
          businessKey: d.businessKey,
          code: d.code,
          name: d.name,
          mode: 'AUTO',
          segments: d.segments as any,
          currentSerial: 0,
          isDefault: true,
          status: 'ACTIVE',
        }),
      ),
    );
    this.logger.log(`✅ 已创建 ${NUMBERING_RULE_DATA.length} 条编码规则`);
  }

  // ─── 10. 仓库/库区 ────────────────────────────────────────────

  private async seedWarehouses() {
    const count = await this.warehouseRepo.count({ where: { tenantId: DEFAULT_TENANT_ID } });
    if (count > 0) {
      this.logger.log('⏭️  仓库已存在，跳过');
      return;
    }

    const whEntities = await this.warehouseRepo.save(
      WAREHOUSE_DATA.map((d) =>
        this.warehouseRepo.create({
          tenantId: DEFAULT_TENANT_ID,
          code: d.code,
          name: d.name,
          type: d.type,
          status: 'ACTIVE',
        }),
      ),
    );

    const whCodeIdMap = new Map(whEntities.map((w) => [w.code, w.id]));

    // 插入库区
    let zoneCount = 0;
    const zoneEntities: WmsZone[] = [];
    for (const [whCode, zones] of Object.entries(ZONE_DATA)) {
      const whId = whCodeIdMap.get(whCode);
      if (!whId) continue;
      let seq = 1;
      for (const z of zones) {
        zoneEntities.push(
          this.zoneRepo.create({
            tenantId: DEFAULT_TENANT_ID,
            warehouseId: whId,
            code: z.code,
            name: z.name,
            zoneType: z.zoneType,
            sortOrder: seq++,
          }),
        );
        zoneCount++;
      }
    }
    await this.zoneRepo.save(zoneEntities);

    // 为每个库区生成几个示例库位
    const savedZones = await this.zoneRepo.find({ where: { tenantId: DEFAULT_TENANT_ID } });
    const locEntities: WmsLocation[] = [];
    const zoneTypePrefix: Record<string, string> = {
      RECEIVING: 'R',
      STORAGE: 'S',
      PICKING: 'P',
      SHIPPING: 'D',
      RAW_MATERIAL: 'S',
      FINISHED: 'S',
      SEMI_FINISHED: 'S',
      QUARANTINE: 'Q',
      NONCONFORMING: 'N',
      SCRAP: 'X',
      TRANSIT: 'T',
    };
    for (const zone of savedZones) {
      const prefix = zoneTypePrefix[zone.zoneType] ?? 'L';
      for (let i = 1; i <= 9; i++) {
        locEntities.push(
          this.locationRepo.create({
            tenantId: DEFAULT_TENANT_ID,
            warehouseId: zone.warehouseId,
            zoneId: zone.id,
            code: `${prefix}-${String(i).padStart(2, '0')}`,
            name: `库位 ${prefix}-${String(i).padStart(2, '0')}`,
            type: 'STORAGE',
            status: 'ACTIVE',
          }),
        );
      }
    }
    if (locEntities.length > 0) {
      await this.locationRepo.save(locEntities);
    }

    this.logger.log(`✅ 已创建 ${whEntities.length} 个仓库、${zoneCount} 个库区、${locEntities.length} 个库位`);
  }

  // ─── 11. 会计科目 ────────────────────────────────────────────

  private async seedAccounts() {
    const count = await this.accountRepo.count({ where: { tenantId: DEFAULT_TENANT_ID } });
    if (count > 0) {
      this.logger.log('⏭️  会计科目已存在，跳过');
      return;
    }
    await this.accountRepo.save(
      ACCOUNT_DATA.map((d) =>
        this.accountRepo.create({
          tenantId: DEFAULT_TENANT_ID,
          code: d.code,
          name: d.name,
          type: d.type as any,
          isLeaf: 1,
          status: 'ACTIVE' as any,
        }),
      ),
    );
    this.logger.log(`✅ 已创建 ${ACCOUNT_DATA.length} 个会计科目`);
  }

  // ─── 12. 成本中心 ─────────────────────────────────────────────

  private async seedCostCenters() {
    const count = await this.costCenterRepo.count({ where: { tenantId: DEFAULT_TENANT_ID } });
    if (count > 0) {
      this.logger.log('⏭️  成本中心已存在，跳过');
      return;
    }
    await this.costCenterRepo.save(
      COST_CENTER_DATA.map((d) =>
        this.costCenterRepo.create({
          tenantId: DEFAULT_TENANT_ID,
          code: d.code,
          name: d.name,
          centerType: d.centerType as any,
          level: 1,
          status: 'ACTIVE' as any,
        }),
      ),
    );
    this.logger.log(`✅ 已创建 ${COST_CENTER_DATA.length} 个成本中心`);
  }
}
