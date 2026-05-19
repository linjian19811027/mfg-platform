import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysUom, SysUomConversion } from '../base/entities/sys-uom.entity.js';
import { SysNumberingRule } from '../base/entities/sys-numbering-rule.entity.js';
import { SysOrganization } from '../base/entities/sys-organization.entity.js';
import { MfgWorkCenter } from '../base/entities/mfg-work-center.entity.js';
import { HrShift } from '../hr/entities/hr-shift.entity.js';
import { HrJobType } from '../hr/entities/hr-job-type.entity.js';
import { PlmMaterialCategory } from '../plm/entities/plm-material-category.entity.js';
import { WmsWarehouse } from '../wms/entities/wms-warehouse.entity.js';
import { ErpAccount } from '../erp/entities/erp-account.entity.js';
import { ErpCostCenter } from '../erp/entities/erp-cost-center.entity.js';

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
  { code: 'H', name: '小时', symbol: 'h', category: 'TIME', isBase: 1 },
  { code: 'D', name: '天', symbol: 'd', category: 'TIME', isBase: 0 },
];

const UOM_CONVERSION = [
  { from: 'KG', to: 'G', factor: 1000 },
  { from: 'T', to: 'KG', factor: 1000 },
  { from: 'M', to: 'CM', factor: 100 },
  { from: 'L', to: 'ML', factor: 1000 },
  { from: 'D', to: 'H', factor: 24 },
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

const WAREHOUSE_DATA = [
  { code: 'WH_MAIN', name: '主仓库', type: 'PHYSICAL' },
  { code: 'WH_RAW', name: '原材料仓', type: 'PHYSICAL' },
  { code: 'WH_FG', name: '成品仓', type: 'PHYSICAL' },
];

const ACCOUNT_DATA = [
  { code: '1001', name: '现金', type: 'ASSET' },
  { code: '1002', name: '银行存款', type: 'ASSET' },
  { code: '1122', name: '应收账款', type: 'ASSET' },
  { code: '1403', name: '原材料', type: 'ASSET' },
  { code: '1405', name: '库存商品', type: 'ASSET' },
  { code: '2201', name: '应付账款', type: 'LIABILITY' },
  { code: '4001', name: '实收资本', type: 'EQUITY' },
  { code: '5001', name: '生产成本', type: 'EXPENSE' },
  { code: '6001', name: '主营业务收入', type: 'REVENUE' },
  { code: '6401', name: '主营业务成本', type: 'EXPENSE' },
  { code: '6601', name: '销售费用', type: 'EXPENSE' },
  { code: '6602', name: '管理费用', type: 'EXPENSE' },
  { code: '6603', name: '财务费用', type: 'EXPENSE' },
];

const NUMBERING_RULES = [
  { businessKey: 'PLM_MATERIAL', code: 'MAT', name: '物料编码', module: 'PLM' },
  { businessKey: 'PLM_BOM', code: 'BOM', name: 'BOM编码', module: 'PLM' },
  { businessKey: 'PLM_ROUTING', code: 'ROUT', name: '工艺路线编码', module: 'PLM' },
  { businessKey: 'MES_WO', code: 'WO', name: '生产工单编码', module: 'MES' },
  { businessKey: 'SCM_PO', code: 'PO', name: '采购订单编码', module: 'SCM' },
  { businessKey: 'SCM_PR', code: 'PR', name: '采购申请编码', module: 'SCM' },
  { businessKey: 'ERP_SO', code: 'SO', name: '销售订单编码', module: 'ERP' },
  { businessKey: 'WMS_ASN', code: 'ASN', name: '入库通知单编码', module: 'WMS' },
  { businessKey: 'QMS_QC', code: 'QC', name: '质检单编码', module: 'QMS' },
  { businessKey: 'EAM_MT', code: 'MT', name: '维修工单编码', module: 'EAM' },
];

@Injectable()
export class TenantProvisionService {
  private readonly logger = new Logger(TenantProvisionService.name);

  constructor(
    @InjectRepository(SysUom) private readonly uomRepo: Repository<SysUom>,
    @InjectRepository(SysUomConversion) private readonly uomConvRepo: Repository<SysUomConversion>,
    @InjectRepository(SysNumberingRule) private readonly ruleRepo: Repository<SysNumberingRule>,
    @InjectRepository(SysOrganization) private readonly orgRepo: Repository<SysOrganization>,
    @InjectRepository(MfgWorkCenter) private readonly wcRepo: Repository<MfgWorkCenter>,
    @InjectRepository(HrShift) private readonly shiftRepo: Repository<HrShift>,
    @InjectRepository(HrJobType) private readonly jobTypeRepo: Repository<HrJobType>,
    @InjectRepository(PlmMaterialCategory) private readonly matCatRepo: Repository<PlmMaterialCategory>,
    @InjectRepository(WmsWarehouse) private readonly whRepo: Repository<WmsWarehouse>,
    @InjectRepository(ErpAccount) private readonly accountRepo: Repository<ErpAccount>,
    @InjectRepository(ErpCostCenter) private readonly ccRepo: Repository<ErpCostCenter>,
  ) {}

  async provision(tenantCode: string, enabledModules: string[] = []) {
    this.logger.log(`开始为租户 ${tenantCode} 初始化基础数据...`);

    // 1. 默认组织
    await this.orgRepo.save(this.orgRepo.create({
      tenantId: tenantCode, code: tenantCode.toUpperCase(), name: tenantCode,
      type: 'COMPANY', level: 1, sortOrder: 1, status: 'ACTIVE',
    }));

    // 2. 计量单位
    const uoms = await this.uomRepo.save(
      UOM_DATA.map((d) => this.uomRepo.create({ ...d, tenantId: tenantCode, status: 'ACTIVE' })),
    );
    const codeIdMap = new Map(uoms.map((u) => [u.code, u.id]));
    const convs = UOM_CONVERSION
      .filter((c) => codeIdMap.has(c.from) && codeIdMap.has(c.to))
      .map((c) => this.uomConvRepo.create({
        tenantId: tenantCode, fromUomId: codeIdMap.get(c.from)!,
        toUomId: codeIdMap.get(c.to)!, factor: c.factor,
      }));
    if (convs.length > 0) await this.uomConvRepo.save(convs);

    // 3. 班次
    await this.shiftRepo.save(
      SHIFT_DATA.map((d) => this.shiftRepo.create({ ...d, tenantId: tenantCode })),
    );

    // 4. 工种
    await this.jobTypeRepo.save(
      JOB_TYPE_DATA.map((d) => this.jobTypeRepo.create({ ...d, tenantId: tenantCode, enabled: 1 })),
    );

    // 5. 工作中心
    await this.wcRepo.save(
      this.wcRepo.create({ tenantId: tenantCode, name: '默认工作中心', code: 'DEFAULT_WC', enabled: 1 }),
    );

    // 6. 按模块初始化业务数据
    if (enabledModules.includes('WMS')) {
      await this.whRepo.save(
        WAREHOUSE_DATA.map((d) => this.whRepo.create({ ...d, tenantId: tenantCode, status: 'ACTIVE' })),
      );
    }

    if (enabledModules.includes('ERP')) {
      const accounts = ACCOUNT_DATA.map((d) =>
        this.accountRepo.create({ ...d, tenantId: tenantCode, isLeaf: 1, status: 'ACTIVE' } as any),
      );
      await this.accountRepo.save(accounts as any);
      await this.ccRepo.save(
        this.ccRepo.create({
          tenantId: tenantCode, code: 'CC_DEFAULT', name: '默认成本中心',
          centerType: 'FACTORY' as any, level: 1, status: 'ACTIVE' as any,
        }),
      );
    }

    if (enabledModules.includes('PLM')) {
      await this.matCatRepo.save(
        ['RAW', 'SEMI', 'FINISHED', 'AUX'].map((code) =>
          this.matCatRepo.create({
            tenantId: tenantCode, code, name: code, level: 1, sortOrder: 1, status: 'ACTIVE',
          }),
        ),
      );
    }

    // 7. 编码规则（按模块）
    const rulesToCreate = NUMBERING_RULES.filter((r) => enabledModules.includes(r.module));
    if (rulesToCreate.length > 0) {
      await this.ruleRepo.save(
        rulesToCreate.map((r) => this.ruleRepo.create({
          tenantId: tenantCode, businessKey: r.businessKey, code: r.code, name: r.name,
          mode: 'AUTO',
          segments: [
            { type: 'CONST' as const, value: r.code },
            { type: 'DATE' as const, format: 'YYYYMMDD' },
            { type: 'SERIAL' as const, length: 4, padChar: '0' },
          ],
          currentSerial: 0, isDefault: true, status: 'ACTIVE',
        })),
      );
    }

    this.logger.log(`租户 ${tenantCode} 基础数据初始化完成`);
  }
}
