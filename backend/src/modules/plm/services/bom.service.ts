import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PlmBom } from '../entities/plm-bom.entity.js';
import { PlmBomLine } from '../entities/plm-bom-line.entity.js';
import { PlmBomChangeLog } from '../entities/plm-bom-change-log.entity.js';
import { PlmMaterial } from '../entities/plm-material.entity.js';
import { TenantContext } from '../../../shared/tenant/tenant.context.js';
import {
  MESSAGE_SERVICE,
  MessageService,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';
import { sanitizeUpdateData } from '../../../shared/utils/sanitize.js';

export interface EcnBomChange {
  action: 'ADD' | 'REMOVE' | 'MODIFY';
  materialId?: string;
  quantity?: number;
  uomId?: string;
  lossRate?: number;
  sequence?: number;
  parentLineId?: string;
}

export interface BomLineNode extends PlmBomLine {
  children: BomLineNode[];
  materialCode?: string;
  materialName?: string;
}

export interface DiffField {
  field: string;
  before: unknown;
  after: unknown;
}

export interface BomDiff {
  header: DiffField[];
  linesAdded: PlmBomLine[];
  linesRemoved: PlmBomLine[];
  linesModified: { lineId: string; diffs: DiffField[] }[];
}

@Injectable()
export class BomService {
  constructor(
    @InjectRepository(PlmBom)
    private readonly bomRepo: Repository<PlmBom>,
    @InjectRepository(PlmBomLine)
    private readonly lineRepo: Repository<PlmBomLine>,
    @InjectRepository(PlmBomChangeLog)
    private readonly logRepo: Repository<PlmBomChangeLog>,
    @InjectRepository(PlmMaterial)
    private readonly materialRepo: Repository<PlmMaterial>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageSvc: MessageService,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async findAll(
    params: {
      materialId?: string;
      keyword?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{
    list: (PlmBom & { materialCode?: string; materialName?: string })[];
    total: number;
  }> {
    const tenantId = TenantContext.requireCurrentTenant();
    const { materialId, keyword, status, page = 1, pageSize = 20 } = params;

    const qb = this.bomRepo
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId });

    if (materialId) qb.andWhere('b.material_id = :materialId', { materialId });
    if (status) qb.andWhere('b.status = :status', { status });
    if (keyword) {
      qb.leftJoin(
        PlmMaterial,
        'm',
        'm.id = b.material_id AND m.tenant_id = :tenantId2',
        { tenantId2: tenantId },
      ).andWhere('(m.code LIKE :kw OR m.name LIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }

    qb.orderBy('b.material_id', 'ASC').addOrderBy('b.version', 'DESC');

    const total = await qb.getCount();
    const boms = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    // 批量查物料名称
    const matIds = [
      ...new Set(
        boms.map((b) => b.materialId).filter((id): id is string => !!id),
      ),
    ];
    const matMap = new Map<string, { code: string; name: string }>();
    if (matIds.length > 0) {
      const mats = await this.materialRepo.findBy({ id: In(matIds) });
      mats.forEach((m) => matMap.set(m.id, { code: m.code, name: m.name }));
    }

    const list = boms.map((b) => ({
      ...b,
      materialCode: b.materialId ? matMap.get(b.materialId)?.code : undefined,
      materialName: b.materialId ? matMap.get(b.materialId)?.name : undefined,
    }));
    return { list, total };
  }

  async delete(id: string): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const bom = await this.bomRepo.findOne({ where: { id, tenantId } });
    if (!bom) throw new NotFoundException('PLM_BOM_NOT_FOUND');
    // 删除关联明细行
    await this.lineRepo.delete({ bomId: id } as any);
    await this.bomRepo.delete(id);
  }

  async findOne(id: string): Promise<
    PlmBom & {
      lines: (PlmBomLine & { materialCode?: string; materialName?: string })[];
    }
  > {
    const tenantId = TenantContext.requireCurrentTenant();
    const bom = await this.bomRepo.findOne({ where: { id, tenantId } });
    if (!bom) throw new NotFoundException('PLM_BOM_NOT_FOUND');

    const lines = await this.lineRepo.find({
      where: { bomId: id, tenantId } as any,
      order: { sequence: 'ASC' },
    });

    const matIds = [
      ...new Set(
        lines.map((l) => l.materialId).filter((id): id is string => !!id),
      ),
    ];
    const matMap = new Map<string, { code: string; name: string }>();
    if (matIds.length > 0) {
      const mats = await this.materialRepo.findBy({ id: In(matIds) });
      mats.forEach((m) => matMap.set(m.id, { code: m.code, name: m.name }));
    }

    const enrichedLines = lines.map((l) => ({
      ...l,
      materialCode: l.materialId ? matMap.get(l.materialId)?.code : undefined,
      materialName: l.materialId ? matMap.get(l.materialId)?.name : undefined,
    }));
    return { ...bom, lines: enrichedLines };
  }

  async create(
    data: Partial<PlmBom> & { copyFromBomId?: string },
    lines: Partial<PlmBomLine>[] = [],
  ): Promise<PlmBom> {
    const tenantId = TenantContext.requireCurrentTenant();
    const { copyFromBomId, ...bomData } = data;
    bomData.tenantId = tenantId;

    // 自动递增版本号
    const latest = await this.bomRepo.findOne({
      where: { tenantId, materialId: bomData.materialId! },
      order: { version: 'DESC' },
    });
    bomData.version = (latest?.version ?? 0) + 1;

    const bom = await this.bomRepo.save(this.bomRepo.create(bomData));

    // 优先使用传入的明细行；若指定了复制来源版本且无传入明细，则从来源版本复制
    let finalLines = lines;
    if (finalLines.length === 0 && copyFromBomId) {
      const sourceLines = await this.lineRepo.find({
        where: { bomId: copyFromBomId, tenantId } as any,
        order: { sequence: 'ASC' },
      });
      // 复制时去掉原 id/bomId，保留其他字段
      finalLines = sourceLines.map(({ id: _id, bomId: _bid, ...rest }) => rest);
    }

    if (finalLines.length > 0) {
      const lineEntities = finalLines.map((l) =>
        this.lineRepo.create({ ...l, bomId: bom.id, tenantId }),
      );
      await this.lineRepo.save(lineEntities);
    }

    await this.writeLog(
      bom.id,
      tenantId,
      'CREATE',
      null,
      bom,
      bomData.createdBy,
    );
    return bom;
  }

  async update(
    id: string,
    data: Partial<PlmBom>,
    updatedBy?: string,
  ): Promise<PlmBom> {
    const tenantId = TenantContext.requireCurrentTenant();
    const bom = await this.bomRepo.findOne({ where: { id, tenantId } });
    if (!bom) throw new NotFoundException('PLM_BOM_NOT_FOUND');
    if (bom.status === 'OBSOLETE')
      throw new BadRequestException('PLM_BOM_OBSOLETE_READONLY');

    await this.writeLog(
      id,
      tenantId,
      'UPDATE',
      bom,
      { ...bom, ...data },
      updatedBy,
    );
    await this.bomRepo.update(id, sanitizeUpdateData(data) as any);
    return { ...bom, ...data };
  }

  async addLine(
    bomId: string,
    line: Partial<PlmBomLine> & {
      materialCode?: string;
      materialName?: string;
      unit?: string;
    },
    updatedBy?: string,
  ): Promise<PlmBomLine> {
    const tenantId = TenantContext.requireCurrentTenant();
    const bom = await this.bomRepo.findOne({ where: { id: bomId, tenantId } });
    if (!bom) throw new NotFoundException('PLM_BOM_NOT_FOUND');

    // 如果没有 materialId，尝试通过 materialCode 查找
    if (!line.materialId && line.materialCode) {
      const mat = await this.materialRepo.findOne({
        where: { tenantId, code: line.materialCode },
      });
      if (mat) line.materialId = mat.id;
    }

    const saved = await this.lineRepo.save(
      this.lineRepo.create({ ...line, bomId, tenantId }),
    );
    await this.writeLog(bomId, tenantId, 'LINE_ADD', null, saved, updatedBy);
    return saved;
  }

  async updateLine(
    lineId: string,
    data: Partial<PlmBomLine>,
    updatedBy?: string,
  ): Promise<PlmBomLine> {
    const tenantId = TenantContext.requireCurrentTenant();
    const line = await this.lineRepo.findOne({
      where: { id: lineId, tenantId } as any,
    });
    if (!line) throw new NotFoundException('PLM_BOM_LINE_NOT_FOUND');

    await this.writeLog(
      line.bomId,
      tenantId,
      'LINE_MOD',
      line,
      { ...line, ...data },
      updatedBy,
    );
    await this.lineRepo.update(lineId, sanitizeUpdateData(data) as any);
    return { ...line, ...data };
  }

  async removeLine(lineId: string, updatedBy?: string): Promise<void> {
    const tenantId = TenantContext.requireCurrentTenant();
    const line = await this.lineRepo.findOne({
      where: { id: lineId, tenantId } as any,
    });
    if (!line) throw new NotFoundException('PLM_BOM_LINE_NOT_FOUND');

    await this.writeLog(
      line.bomId,
      tenantId,
      'LINE_DEL',
      line,
      null,
      updatedBy,
    );
    await this.lineRepo.delete(lineId);
  }

  // ── 正展（BOM 展开为树形） ────────────────────────────────────────────────

  async expand(bomId: string, maxDepth = 99): Promise<BomLineNode[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const bom = await this.bomRepo.findOne({ where: { id: bomId, tenantId } });
    if (!bom) throw new NotFoundException('PLM_BOM_NOT_FOUND');

    const lines = await this.lineRepo.find({
      where: { bomId, tenantId } as any,
      order: { sequence: 'ASC' },
    });

    // 检测循环引用
    this.detectCycle(lines);

    // 递归展开子 BOM（跨 BOM 多级展开）
    return this.buildTree(lines, undefined, tenantId, maxDepth, 0);
  }

  private async buildTree(
    lines: PlmBomLine[],
    parentLineId: string | undefined,
    tenantId: string,
    maxDepth: number,
    depth: number,
  ): Promise<BomLineNode[]> {
    if (depth >= maxDepth) return [];

    const nodes = lines.filter((l) =>
      parentLineId ? l.parentLineId === parentLineId : !l.parentLineId,
    );

    const result: BomLineNode[] = [];
    for (const node of nodes) {
      const children = await this.buildTree(
        lines,
        node.id,
        tenantId,
        maxDepth,
        depth + 1,
      );

      // 如果子料本身有 BOM，递归展开
      if (children.length === 0 && depth < maxDepth - 1 && node.materialId) {
        const subBom = await this.bomRepo.findOne({
          where: {
            tenantId,
            materialId: node.materialId,
            status: 'ACTIVE',
          } as any,
          order: { version: 'DESC' },
        });
        if (subBom) {
          const subLines = await this.lineRepo.find({
            where: { bomId: subBom.id, tenantId } as any,
            order: { sequence: 'ASC' },
          });
          const subChildren = await this.buildTree(
            subLines,
            undefined,
            tenantId,
            maxDepth,
            depth + 1,
          );
          result.push({ ...node, children: subChildren });
          continue;
        }
      }

      result.push({ ...node, children });
    }
    return result;
  }

  /** 反展：查找使用某物料的所有 BOM */
  async whereUsed(
    materialId: string,
  ): Promise<{ bom: PlmBom; line: PlmBomLine }[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const lines = await this.lineRepo
      .createQueryBuilder('l')
      .innerJoinAndMapOne(
        'l.bom',
        PlmBom,
        'b',
        'b.id = l.bom_id AND b.tenant_id = :tenantId',
        { tenantId },
      )
      .where('l.material_id = :materialId', { materialId })
      .getMany();

    const result: { bom: PlmBom; line: PlmBomLine }[] = [];
    for (const line of lines) {
      const bom = await this.bomRepo.findOne({
        where: { id: line.bomId, tenantId },
      });
      if (bom) result.push({ bom, line });
    }
    return result;
  }

  // ── 版本对比 ──────────────────────────────────────────────────────────────

  async compare(bomId1: string, bomId2: string): Promise<BomDiff> {
    const tenantId = TenantContext.requireCurrentTenant();
    const [bom1, bom2] = await Promise.all([
      this.bomRepo.findOne({ where: { id: bomId1, tenantId } }),
      this.bomRepo.findOne({ where: { id: bomId2, tenantId } }),
    ]);
    if (!bom1 || !bom2) throw new NotFoundException('PLM_BOM_NOT_FOUND');

    const [lines1, lines2] = await Promise.all([
      this.lineRepo.find({ where: { bomId: bomId1, tenantId } as any }),
      this.lineRepo.find({ where: { bomId: bomId2, tenantId } as any }),
    ]);

    // 表头字段 diff
    const headerFields: (keyof PlmBom)[] = [
      'effectiveDate',
      'expiryDate',
      'status',
    ];
    const header: DiffField[] = headerFields
      .filter((f) => String(bom1[f]) !== String(bom2[f]))
      .map((f) => ({ field: f, before: bom1[f], after: bom2[f] }));

    // 明细 diff（按 materialId + sequence 匹配）
    const map1 = new Map(
      lines1.filter((l) => l.materialId).map((l) => [l.materialId!, l]),
    );
    const map2 = new Map(
      lines2.filter((l) => l.materialId).map((l) => [l.materialId!, l]),
    );

    const linesAdded = lines2.filter(
      (l) => l.materialId && !map1.has(l.materialId),
    );
    const linesRemoved = lines1.filter(
      (l) => l.materialId && !map2.has(l.materialId),
    );
    const linesModified: { lineId: string; diffs: DiffField[] }[] = [];

    for (const [matId, l1] of map1) {
      const l2 = map2.get(matId);
      if (!l2) continue;
      const lineFields: (keyof PlmBomLine)[] = [
        'quantity',
        'lossRate',
        'uomId',
        'effectiveDate',
        'expiryDate',
      ];
      const diffs = lineFields
        .filter((f) => String(l1[f]) !== String(l2[f]))
        .map((f) => ({ field: f, before: l1[f], after: l2[f] }));
      if (diffs.length > 0) linesModified.push({ lineId: l1.id, diffs });
    }

    return { header, linesAdded, linesRemoved, linesModified };
  }

  // ── 成本卷积 ──────────────────────────────────────────────────────────────

  async rollupCost(bomId: string): Promise<number> {
    const tenantId = TenantContext.requireCurrentTenant();
    const cost = await this.calcCost(bomId, tenantId, new Set());
    await this.bomRepo.update(bomId, { materialCost: cost });
    return cost;
  }

  private async calcCost(
    bomId: string,
    tenantId: string,
    visited: Set<string>,
  ): Promise<number> {
    if (visited.has(bomId)) return 0; // 防循环
    visited.add(bomId);

    const lines = await this.lineRepo.find({
      where: { bomId, tenantId } as any,
    });
    let total = 0;

    for (const line of lines) {
      if (!line.materialId) continue;
      const material = await this.materialRepo.findOne({
        where: { id: line.materialId, tenantId },
      });
      const stdCost = Number(material?.stdCost ?? 0);

      if (stdCost > 0) {
        total += stdCost * Number(line.quantity) * (1 + Number(line.lossRate));
      } else {
        // 子料无标准成本，尝试从子 BOM 卷积
        const subBom = await this.bomRepo.findOne({
          where: {
            tenantId,
            materialId: line.materialId,
            status: 'ACTIVE',
          } as any,
          order: { version: 'DESC' },
        });
        if (subBom) {
          const subCost = await this.calcCost(subBom.id, tenantId, visited);
          total +=
            subCost * Number(line.quantity) * (1 + Number(line.lossRate));
        }
      }
    }

    return Math.round(total * 10000) / 10000;
  }

  // ── 有效性管理 ────────────────────────────────────────────────────────────

  async findEffective(materialId: string, date?: Date): Promise<PlmBom | null> {
    const tenantId = TenantContext.requireCurrentTenant();
    const checkDate = date ?? new Date();
    const dateStr = checkDate.toISOString().split('T')[0];

    return this.bomRepo
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('b.material_id = :materialId', { materialId })
      .andWhere('b.status = :status', { status: 'ACTIVE' })
      .andWhere('(b.effective_date IS NULL OR b.effective_date <= :date)', {
        date: dateStr,
      })
      .andWhere('(b.expiry_date IS NULL OR b.expiry_date >= :date)', {
        date: dateStr,
      })
      .orderBy('b.version', 'DESC')
      .getOne();
  }

  // ── 状态管理 ──────────────────────────────────────────────────────────────

  /** 查找使用该 BOM 的在制工单（状态为 RELEASED 或 IN_PROGRESS） */
  async findAffectedWorkOrders(
    bomId: string,
  ): Promise<{ id: string; woNo: string; status: string }[]> {
    const tenantId = TenantContext.requireCurrentTenant();
    const rows = await this.bomRepo.manager.query(
      `SELECT id, wo_no AS woNo, status
       FROM mes_work_order
       WHERE tenant_id = ? AND bom_id = ? AND status IN ('RELEASED','IN_PROGRESS')`,
      [tenantId, bomId],
    );
    return rows as { id: string; woNo: string; status: string }[];
  }

  /** 激活 BOM：DRAFT → ACTIVE，同物料其他 ACTIVE BOM 置为 OBSOLETE */
  async activate(bomId: string): Promise<PlmBom> {
    const tenantId = TenantContext.requireCurrentTenant();
    const bom = await this.bomRepo.findOne({ where: { id: bomId, tenantId } });
    if (!bom) throw new NotFoundException('PLM_BOM_NOT_FOUND');
    if (bom.status !== 'DRAFT')
      throw new BadRequestException('PLM_BOM_INVALID_STATUS');

    // 将同物料其他 ACTIVE BOM 批量置为 OBSOLETE
    await this.bomRepo
      .createQueryBuilder()
      .update(PlmBom)
      .set({ status: 'OBSOLETE' })
      .where(
        'tenant_id = :tenantId AND material_id = :materialId AND status = :status AND id != :id',
        { tenantId, materialId: bom.materialId, status: 'ACTIVE', id: bomId },
      )
      .execute();

    await this.bomRepo.update(bomId, { status: 'ACTIVE' });

    await this.messageSvc.publish({
      eventId: uuidv4(),
      eventType: EventTypes.BOM_ACTIVATED,
      tenantId,
      sourceModule: 'PLM',
      targetModule: 'MES',
      payload: { bomId, materialId: bom.materialId, version: bom.version },
      createdAt: new Date(),
    });

    return { ...bom, status: 'ACTIVE' };
  }

  /** 停用 BOM：ACTIVE → INACTIVE，有在制工单则拒绝 */
  async deactivate(bomId: string): Promise<PlmBom> {
    const tenantId = TenantContext.requireCurrentTenant();
    const bom = await this.bomRepo.findOne({ where: { id: bomId, tenantId } });
    if (!bom) throw new NotFoundException('PLM_BOM_NOT_FOUND');
    if (bom.status !== 'ACTIVE')
      throw new BadRequestException('PLM_BOM_INVALID_STATUS');

    const workOrders = await this.findAffectedWorkOrders(bomId);
    if (workOrders.length > 0) {
      throw new BadRequestException({
        message: 'PLM_BOM_HAS_ACTIVE_WORK_ORDERS',
        workOrders,
      });
    }

    await this.bomRepo.update(bomId, { status: 'INACTIVE' });
    return { ...bom, status: 'INACTIVE' };
  }

  /** 废止 BOM：任意非 OBSOLETE → OBSOLETE，有在制工单则拒绝 */
  async obsolete(bomId: string): Promise<PlmBom> {
    const tenantId = TenantContext.requireCurrentTenant();
    const bom = await this.bomRepo.findOne({ where: { id: bomId, tenantId } });
    if (!bom) throw new NotFoundException('PLM_BOM_NOT_FOUND');
    if (bom.status === 'OBSOLETE')
      throw new BadRequestException('PLM_BOM_INVALID_STATUS');

    const workOrders = await this.findAffectedWorkOrders(bomId);
    if (workOrders.length > 0) {
      throw new BadRequestException({
        message: 'PLM_BOM_HAS_ACTIVE_WORK_ORDERS',
        workOrders,
      });
    }

    await this.bomRepo.update(bomId, { status: 'OBSOLETE' });
    return { ...bom, status: 'OBSOLETE' };
  }

  // ── 循环引用检测 ──────────────────────────────────────────────────────────

  private detectCycle(lines: PlmBomLine[]): void {
    const childMap = new Map<string, string[]>();
    for (const l of lines) {
      if (l.parentLineId) {
        const arr = childMap.get(l.parentLineId) ?? [];
        arr.push(l.id);
        childMap.set(l.parentLineId, arr);
      }
    }

    const visited = new Set<string>();
    const dfs = (id: string, path: Set<string>) => {
      if (path.has(id))
        throw new BadRequestException('PLM_BOM_CIRCULAR_REFERENCE');
      if (visited.has(id)) return;
      visited.add(id);
      path.add(id);
      for (const child of childMap.get(id) ?? []) dfs(child, path);
      path.delete(id);
    };

    for (const l of lines) {
      if (!l.parentLineId) dfs(l.id, new Set());
    }
  }

  // ── 变更日志 ──────────────────────────────────────────────────────────────

  private async writeLog(
    bomId: string,
    tenantId: string,
    changeType: string,
    before: unknown,
    after: unknown,
    changedBy?: string,
  ): Promise<void> {
    await this.logRepo.save(
      this.logRepo.create({
        tenantId,
        bomId,
        changeType,
        beforeData: before as any,
        afterData: after as any,
        changedBy,
      }),
    );
  }

  // ── ECN 变更应用 ──────────────────────────────────────────────────────────

  /**
   * 克隆当前 ACTIVE BOM 版本并应用 ECN 变更，事务内执行。
   * 成功：新版本 ACTIVE，旧版本 OBSOLETE。
   * 失败：回滚，原版本不变。
   */
  async cloneAndApply(
    tenantId: string,
    bomId: string,
    ecnChanges: EcnBomChange[],
    ecnNo?: string,
  ): Promise<PlmBom> {
    return this.bomRepo.manager.transaction(async (em) => {
      const bomRepo = em.getRepository(PlmBom);
      const lineRepo = em.getRepository(PlmBomLine);

      const sourceBom = await bomRepo.findOne({
        where: { id: bomId, tenantId },
      });
      if (!sourceBom) throw new NotFoundException('PLM_BOM_NOT_FOUND');
      if (sourceBom.status !== 'ACTIVE')
        throw new BadRequestException('PLM_BOM_NOT_ACTIVE');

      // 克隆 BOM 头
      const newVersion = sourceBom.version + 1;
      const newBom = bomRepo.create({
        tenantId,
        materialId: sourceBom.materialId,
        version: newVersion,
        status: 'DRAFT',
        effectiveDate: sourceBom.effectiveDate,
        expiryDate: sourceBom.expiryDate,
        ecnId: sourceBom.ecnId,
      });
      const savedBom = await bomRepo.save(newBom);

      // 克隆 BOM 行
      const sourceLines = await lineRepo.find({
        where: { bomId, tenantId } as any,
        order: { sequence: 'ASC' },
      });
      let lines = sourceLines.map(({ id: _id, bomId: _bid, ...rest }) => ({
        ...rest,
        bomId: savedBom.id,
        tenantId,
      }));

      // 应用变更
      for (const change of ecnChanges) {
        if (change.action === 'ADD') {
          lines.push({
            tenantId,
            bomId: savedBom.id,
            sequence: change.sequence ?? (lines.length + 1) * 10,
            materialId: change.materialId,
            quantity: change.quantity ?? 1,
            uomId: change.uomId,
            lossRate: change.lossRate ?? 0,
            parentLineId: change.parentLineId,
            isSubstitute: 0,
            substitutePriority: 1,
            remark: ecnNo ? `ECN: ${ecnNo}` : undefined,
          } as any);
        } else if (change.action === 'REMOVE') {
          lines = lines.filter((l) => l.materialId !== change.materialId);
        } else if (change.action === 'MODIFY') {
          lines = lines.map((l) => {
            if (l.materialId !== change.materialId) return l;
            return {
              ...l,
              quantity: change.quantity ?? l.quantity,
              uomId: change.uomId ?? l.uomId,
              lossRate: change.lossRate ?? l.lossRate,
              remark: ecnNo ? `ECN: ${ecnNo}` : l.remark,
            };
          });
        }
      }

      if (lines.length > 0) {
        await lineRepo.save(lines.map((l) => lineRepo.create(l)));
      }

      // 新版本 ACTIVE，旧版本 OBSOLETE
      await bomRepo.update(savedBom.id, {
        status: 'ACTIVE',
        ecnId: sourceBom.ecnId,
      } as any);
      await bomRepo.update(bomId, { status: 'OBSOLETE' } as any);

      return { ...savedBom, status: 'ACTIVE', version: newVersion };
    });
  }
}
