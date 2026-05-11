import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ErpCustomer } from './entities/erp-customer.entity.js';
import { ErpQuotation } from './entities/erp-quotation.entity.js';
import { ErpSalesOrder } from './entities/erp-sales-order.entity.js';
import { ErpSalesOrderLine } from './entities/erp-sales-order-line.entity.js';
import { ErpSalesReturn } from './entities/erp-sales-return.entity.js';
import { ErpShipment } from './entities/erp-shipment.entity.js';
import { ErpReceivable } from './entities/erp-receivable.entity.js';
import { ErpPayable } from './entities/erp-payable.entity.js';
import { ErpReconciliation } from './entities/erp-reconciliation.entity.js';
import { ErpAccount } from './entities/erp-account.entity.js';
import { ErpVoucher } from './entities/erp-voucher.entity.js';
import { ErpVoucherLine } from './entities/erp-voucher-line.entity.js';
import { ErpStandardCost } from './entities/erp-standard-cost.entity.js';
import { ErpCostRecord } from './entities/erp-cost-record.entity.js';
import { ErpCostAllocation } from './entities/erp-cost-allocation.entity.js';
import { ErpCostCenter } from './entities/erp-cost-center.entity.js';
import { ErpCostElement } from './entities/erp-cost-element.entity.js';

import { CustomerService } from './services/customer.service.js';
import { QuotationService } from './services/quotation.service.js';
import { SalesOrderService } from './services/sales-order.service.js';
import { ShipmentService } from './services/shipment.service.js';
import { SalesReturnService } from './services/sales-return.service.js';
import { ErpReconciliationService } from './services/erp-reconciliation.service.js';
import { ReceivableService } from './services/receivable.service.js';
import { PayableService } from './services/payable.service.js';
import { ErpAnalyticsService } from './services/erp-analytics.service.js';
import { AccountService } from './services/account.service.js';
import { VoucherService } from './services/voucher.service.js';
import { VoucherAutoService } from './services/voucher-auto.service.js';
import { LedgerService } from './services/ledger.service.js';
import { StandardCostService } from './services/standard-cost.service.js';
import { CostService } from './services/cost.service.js';
import { CostAllocationService } from './services/cost-allocation.service.js';
import { CostAnalysisService } from './services/cost-analysis.service.js';
import { PeriodEndService } from './services/period-end.service.js';
import { FinancialReportService } from './services/financial-report.service.js';
import { CostCenterService } from './services/cost-center.service.js';

import { ErpController } from './erp.controller.js';
import { MessageModule } from '../../shared/message/message.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpCustomer,
      ErpQuotation,
      ErpSalesOrder,
      ErpSalesOrderLine,
      ErpSalesReturn,
      ErpShipment,
      ErpReceivable,
      ErpPayable,
      ErpReconciliation,
      ErpAccount,
      ErpVoucher,
      ErpVoucherLine,
      ErpStandardCost,
      ErpCostRecord,
      ErpCostAllocation,
      ErpCostCenter,
      ErpCostElement,
    ]),
    MessageModule,
  ],
  controllers: [ErpController],
  providers: [
    CustomerService,
    QuotationService,
    SalesOrderService,
    ShipmentService,
    SalesReturnService,
    ErpReconciliationService,
    ReceivableService,
    PayableService,
    ErpAnalyticsService,
    AccountService,
    VoucherService,
    VoucherAutoService,
    LedgerService,
    StandardCostService,
    CostService,
    CostAllocationService,
    CostAnalysisService,
    PeriodEndService,
    FinancialReportService,
    CostCenterService,
  ],
  exports: [
    CustomerService,
    QuotationService,
    SalesOrderService,
    ShipmentService,
    SalesReturnService,
    ErpReconciliationService,
    ReceivableService,
    PayableService,
    ErpAnalyticsService,
    AccountService,
    VoucherService,
    LedgerService,
    CostService,
    CostAnalysisService,
    PeriodEndService,
    FinancialReportService,
    CostCenterService,
  ],
})
export class ErpModule {}
