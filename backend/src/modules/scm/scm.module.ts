import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScmSupplier } from './entities/scm-supplier.entity.js';
import { ScmSupplierQualification } from './entities/scm-supplier-qualification.entity.js';
import { ScmSupplierOnboarding } from './entities/scm-supplier-onboarding.entity.js';
import { ScmPurchaseRequest } from './entities/scm-purchase-request.entity.js';
import { ScmPurchaseOrder } from './entities/scm-purchase-order.entity.js';
import { ScmPurchaseOrderLine } from './entities/scm-purchase-order-line.entity.js';
import { ScmReceipt } from './entities/scm-receipt.entity.js';
import { ScmReceiptException } from './entities/scm-receipt-exception.entity.js';
import { ScmAsn } from './entities/scm-asn.entity.js';
import { ScmInquiry } from './entities/scm-inquiry.entity.js';
import { ScmInquiryLine } from './entities/scm-inquiry-line.entity.js';
import { ScmPriceAgreement } from './entities/scm-price-agreement.entity.js';
import { ScmPriceRecord } from './entities/scm-price-record.entity.js';
import { ScmReconciliation } from './entities/scm-reconciliation.entity.js';

import { SupplierService } from './services/supplier.service.js';
import { SupplierOnboardingService } from './services/supplier-onboarding.service.js';
import { PurchaseRequestService } from './services/purchase-request.service.js';
import { PurchaseOrderService } from './services/purchase-order.service.js';
import { AsnService } from './services/asn.service.js';
import { ReceiptService } from './services/receipt.service.js';
import { InquiryService } from './services/inquiry.service.js';
import { PriceAgreementService } from './services/price-agreement.service.js';
import { ReconciliationService } from './services/reconciliation.service.js';
import { ScmAnalyticsService } from './services/scm-analytics.service.js';
import { ScmEventService } from './services/scm-event.service.js';

import { ScmController } from './scm.controller.js';
import { MessageModule } from '../../shared/message/message.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScmSupplier,
      ScmSupplierQualification,
      ScmSupplierOnboarding,
      ScmPurchaseRequest,
      ScmPurchaseOrder,
      ScmPurchaseOrderLine,
      ScmReceipt,
      ScmReceiptException,
      ScmAsn,
      ScmInquiry,
      ScmInquiryLine,
      ScmPriceAgreement,
      ScmPriceRecord,
      ScmReconciliation,
    ]),
    MessageModule,
  ],
  controllers: [ScmController],
  providers: [
    SupplierService,
    SupplierOnboardingService,
    PurchaseRequestService,
    PurchaseOrderService,
    AsnService,
    ReceiptService,
    InquiryService,
    PriceAgreementService,
    ReconciliationService,
    ScmAnalyticsService,
    ScmEventService,
  ],
  exports: [
    SupplierService,
    SupplierOnboardingService,
    PurchaseRequestService,
    PurchaseOrderService,
    AsnService,
    ReceiptService,
    InquiryService,
    PriceAgreementService,
    ReconciliationService,
    ScmAnalyticsService,
  ],
})
export class ScmModule {}
