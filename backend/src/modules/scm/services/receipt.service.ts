import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ScmReceipt, ReceiptStatus } from '../entities/scm-receipt.entity.js';
import { ScmReceiptLine } from '../entities/scm-receipt-line.entity.js';
import {
  ScmReceiptException,
  ExceptionType,
  HandlingType,
  HandlingStatus,
} from '../entities/scm-receipt-exception.entity.js';
import {
  MessageService,
  MESSAGE_SERVICE,
} from '../../../shared/message/message.interface.js';
import { EventTypes } from '../../event/event-types.constant.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface ReceiptItemDto {
  poLineId: string;
  materialId: string;
  quantity: number;
  uomId: string;
}

export interface CreateReceiptDto {
  poId: string;
  supplierId: string;
  receiptDate: Date;
  items: ReceiptItemDto[];
}

export interface ConfirmedItemDto {
  poLineId: string;
  materialId: string;
  receivedQty: number;
}

export interface ReceiptQuery {
  status?: ReceiptStatus;
  poId?: string;
  supplierId?: string;
  page?: number;
  pageSize?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ReceiptService {
  constructor(
    @InjectRepository(ScmReceipt)
    private readonly receiptRepo: Repository<ScmReceipt>,
    @InjectRepository(ScmReceiptLine)
    private readonly lineRepo: Repository<ScmReceiptLine>,
    @InjectRepository(ScmReceiptException)
    private readonly exceptionRepo: Repository<ScmReceiptException>,
    @Inject(MESSAGE_SERVICE)
    private readonly messageService: MessageService,
  ) {}

  // ── receiptNo 生成 ──────────────────────────────────────────────────────────

  private async generateReceiptNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `RCV-${dateStr}-`;

    const result = await this.receiptRepo
      .createQueryBuilder('r')
      .select('r.receiptNo', 'receiptNo')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.receiptNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('r.receiptNo', 'DESC')
      .limit(1)
      .getRawOne<{ receiptNo: string }>();

    let seq = 1;
    if (result?.receiptNo) {
      const lastSeq = parseInt(result.receiptNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // ── 1. create ───────────────────────────────────────────────────────────────

  async create(tenantId: string, data: CreateReceiptDto): Promise<ScmReceipt> {
    const receiptNo = await this.generateReceiptNo(tenantId);

    // 查找供应商名称（同模块）
    let supplierName: string | undefined;
    if (data.supplierId) {
      const sup = await this.receiptRepo.manager
        .createQueryBuilder()
        .select('name')
        .from('scm_supplier', 's')
        .where('id = :id AND tenant_id = :tid', { id: data.supplierId, tid: tenantId })
        .getRawOne<{ name: string }>();
      supplierName = sup?.name;
    }

    const receipt = this.receiptRepo.create({
      tenantId,
      receiptNo,
      poId: data.poId,
      supplierId: data.supplierId,
      supplierName,
      receiptDate: data.receiptDate,
      status: ReceiptStatus.PENDING,
      items: data.items ?? [],
    });
    const savedReceipt = await this.receiptRepo.save(receipt);

    // 保存明细行
    if (data.items && data.items.length > 0) {
      const lines = data.items.map((item, idx) =>
        this.lineRepo.create({
          tenantId,
          receiptId: savedReceipt.id,
          lineNo: idx + 1,
          materialId: (item as any).materialId,
          materialCode: (item as any).materialCode,
          materialName: (item as any).materialName,
          receivedQty: (item as any).receivedQty ?? (item as any).quantity ?? 0,
          uomId: (item as any).uomId,
          unitPrice: (item as any).unitPrice,
        }),
      );
      await this.lineRepo.save(lines);
    }

    return savedReceipt;
  }

  // ── 2. findAll ──────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: ReceiptQuery = {},
  ): Promise<{ items: ScmReceipt[]; total: number }> {
    const { status, poId, supplierId, page = 1, pageSize = 20 } = query;

    const qb = this.receiptRepo
      .createQueryBuilder('r')
      .leftJoin('scm_supplier', 'sup', 'sup.id = r.supplier_id AND sup.tenant_id = r.tenant_id')
      .addSelect('sup.name', 'supplierName')
      .where('r.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('r.status = :status', { status });
    if (poId) qb.andWhere('r.poId = :poId', { poId });
    if (supplierId) qb.andWhere('r.supplierId = :supplierId', { supplierId });

    qb.orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const { entities, raw } = await qb.getRawAndEntities();
    const total = await qb.getCount();
    const items = entities.map((e, i) => ({ ...e, supplierName: raw[i]?.supplierName }));
    return { items, total };
    return { items, total };
  }

  // ── 3. findOne ──────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string): Promise<ScmReceipt> {
    const receipt = await this.receiptRepo.findOne({ where: { id, tenantId } });
    if (!receipt) throw new NotFoundException(`到货记录 ${id} 不存在`);
    return receipt;
  }

  async findLines(tenantId: string, receiptId: string): Promise<ScmReceiptLine[]> {
    return this.lineRepo.find({
      where: { tenantId, receiptId },
      order: { lineNo: 'ASC' },
    });
  }

  // ── 4. startInspection ─────────────────────────────────────────────────────

  async startInspection(tenantId: string, id: string): Promise<ScmReceipt> {
    const receipt = await this.findOne(tenantId, id);
    if (receipt.status !== ReceiptStatus.PENDING) {
      throw new BadRequestException(
        `仅 PENDING 状态可开始检验，当前状态：${receipt.status}`,
      );
    }
    receipt.status = ReceiptStatus.INSPECTING;
    return this.receiptRepo.save(receipt);
  }

  // ── 5. confirm ──────────────────────────────────────────────────────────────

  async confirm(
    tenantId: string,
    id: string,
    confirmedItems: ConfirmedItemDto[],
  ): Promise<ScmReceipt> {
    const receipt = await this.findOne(tenantId, id);
    if (receipt.status !== ReceiptStatus.INSPECTING) {
      throw new BadRequestException(
        `仅 INSPECTING 状态可确认，当前状态：${receipt.status}`,
      );
    }

    receipt.status = ReceiptStatus.ACCEPTED;
    const saved = await this.receiptRepo.save(receipt);

    // 发布 RECEIPT_PO_UPDATE_REQUEST 事件，由 ScmEventService 订阅并更新 PO 收货数量
    await this.messageService.publish({
      eventId: uuidv4(),
      eventType: EventTypes.RECEIPT_PO_UPDATE_REQUEST,
      tenantId,
      sourceModule: 'SCM',
      payload: {
        receiptId: saved.id,
        poId: saved.poId,
        confirmedItems,
      },
      createdAt: new Date(),
    });

    // 发布 RECEIPT_CONFIRMED 事件，通知 QMS 创建 IQC 检验
    await this.messageService.publish({
      eventId: uuidv4(),
      eventType: EventTypes.RECEIPT_CONFIRMED,
      tenantId,
      sourceModule: 'SCM',
      targetModule: 'QMS',
      payload: {
        receiptId: saved.id,
        receiptNo: saved.receiptNo,
        poId: saved.poId,
        supplierId: saved.supplierId,
        items: confirmedItems,
        tenantId,
      },
      createdAt: new Date(),
    });

    return saved;
  }

  // ── 6. reject ───────────────────────────────────────────────────────────────

  async reject(
    tenantId: string,
    id: string,
    reason: string,
  ): Promise<ScmReceipt> {
    const receipt = await this.findOne(tenantId, id);
    if (receipt.status !== ReceiptStatus.INSPECTING) {
      throw new BadRequestException(
        `仅 INSPECTING 状态可拒绝，当前状态：${receipt.status}`,
      );
    }
    receipt.status = ReceiptStatus.REJECTED;
    return this.receiptRepo.save(receipt);
  }

  // ── 7. createException ──────────────────────────────────────────────────────

  async createException(
    tenantId: string,
    receiptId: string,
    data: {
      exceptionType: ExceptionType;
      description?: string;
      quantity?: number;
      handlingType?: HandlingType;
    },
  ): Promise<ScmReceiptException> {
    await this.findOne(tenantId, receiptId);

    const exception = this.exceptionRepo.create({
      tenantId,
      receiptId,
      exceptionType: data.exceptionType,
      description: data.description,
      quantity: data.quantity,
      handlingType: data.handlingType,
      handlingStatus: HandlingStatus.PENDING,
    });

    return this.exceptionRepo.save(exception);
  }

  // ── 8. findExceptions ───────────────────────────────────────────────────────

  async findExceptions(
    tenantId: string,
    receiptId: string,
  ): Promise<ScmReceiptException[]> {
    return this.exceptionRepo.find({
      where: { tenantId, receiptId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── 8b. findAllExceptions ────────────────────────────────────────────────────

  async findAllExceptions(
    tenantId: string,
    query: { status?: string; page?: number; pageSize?: number } = {},
  ): Promise<{ list: ScmReceiptException[]; total: number }> {
    const { status, page = 1, pageSize = 20 } = query;
    const qb = this.exceptionRepo
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId })
      .orderBy('e.createdAt', 'DESC');
    if (status) qb.andWhere('e.handlingStatus = :status', { status });
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }

  // ── 9. processException ─────────────────────────────────────────────────────

  async processException(
    tenantId: string,
    exceptionId: string,
    handlingNotes?: string,
  ): Promise<ScmReceiptException> {
    const exception = await this.exceptionRepo.findOne({
      where: { id: exceptionId, tenantId },
    });
    if (!exception)
      throw new NotFoundException(`异常记录 ${exceptionId} 不存在`);

    if (exception.handlingStatus !== HandlingStatus.PENDING) {
      throw new BadRequestException(
        `仅 PENDING 状态可开始处理，当前状态：${exception.handlingStatus}`,
      );
    }

    exception.handlingStatus = HandlingStatus.PROCESSING;
    if (handlingNotes !== undefined) exception.handlingNotes = handlingNotes;

    return this.exceptionRepo.save(exception);
  }

  // ── 10. closeException ──────────────────────────────────────────────────────

  async closeException(
    tenantId: string,
    exceptionId: string,
    handlingNotes?: string,
  ): Promise<ScmReceiptException> {
    const exception = await this.exceptionRepo.findOne({
      where: { id: exceptionId, tenantId },
    });
    if (!exception)
      throw new NotFoundException(`异常记录 ${exceptionId} 不存在`);

    if (exception.handlingStatus !== HandlingStatus.PROCESSING) {
      throw new BadRequestException(
        `仅 PROCESSING 状态可关闭，当前状态：${exception.handlingStatus}`,
      );
    }

    exception.handlingStatus = HandlingStatus.CLOSED;
    if (handlingNotes !== undefined) exception.handlingNotes = handlingNotes;

    return this.exceptionRepo.save(exception);
  }
}
