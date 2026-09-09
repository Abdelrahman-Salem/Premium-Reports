import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  DsrBucket,
  DsrDashboardView,
  DsrFilters,
  DsrMetricGroup,
  DsrMetricRow,
  DsrPayableRow,
  DsrPaymentRow,
  DsrReportResponse,
  DsrReportResult,
  DsrSummaryRow,
  DsrTypeOfSaleRow,
  MetricCard,
} from '../../models/dsr-report.models';

type DashboardLanguage = 'en' | 'ar';

const BUCKET_LABELS: Record<DashboardLanguage, Record<DsrBucket, string>> = {
  en: {
    Sale: 'Sale',
    Refund: 'Refund',
    Net: 'Net',
    Profit: 'Profit',
  },
  ar: {
    Sale: 'بيع',
    Refund: 'مرتجع',
    Net: 'الصافي',
    Profit: 'الأرباح',
  },
};

const METRIC_LABELS: Record<DashboardLanguage, Record<string, string>> = {
  en: {
    dblTotal: 'Total',
    dblServiceFee: 'Service fee',
    dblProfit: 'Profit',
    dblBillingTax: 'Billing tax',
    dblDiscountGiven: 'Discount given',
    dblMF: 'MF',
    dblTax: 'Tax',
    dblVATIn: 'VAT in',
  },
  ar: {
    dblTotal: 'الإجمالي',
    dblServiceFee: 'رسوم الخدمة',
    dblProfit: 'الربح',
    dblBillingTax: 'ضريبة الفاتورة',
    dblDiscountGiven: 'الخصم الممنوح',
    dblMF: 'MF',
    dblTax: 'الضريبة',
    dblVATIn: 'ضريبة المدخلات',
  },
};

const TYPE_OF_SALE_LABELS: Record<DashboardLanguage, Record<string, string>> = {
  en: {
    Ticket: 'Air tickets',
    Hotel: 'Hotels',
    Car: 'Car rental',
    Stock: 'Stock',
    OtherService: 'Other services',
  },
  ar: {
    Ticket: 'تذاكر الطيران',
    Hotel: 'الفنادق',
    Car: 'تأجير السيارات',
    Stock: 'المخزون',
    OtherService: 'خدمات أخرى',
  },
};

@Injectable({ providedIn: 'root' })
export class DsrReportService {
  private readonly http = inject(HttpClient);
  private readonly loginPagePath = '/nucorelib/basic_users/login';
  private readonly apiOrigin = this.resolveApiOrigin();
  private readonly endpoint = `${this.apiOrigin}/api/reports/sales/dsr`;

  updateSessionCookie(cookie: string): Observable<void> {
    return this.http.post<void>(`${this.apiOrigin}/api/session/cookie`, { cookie });
  }

  getSessionStatus(): Observable<{ hasCookie: boolean; loginUrl: string }> {
    return this.http.get<{ hasCookie: boolean; loginUrl: string }>(`${this.apiOrigin}/api/session/status`);
  }

  getTraacsLoginUrl(): string {
    return `${this.apiOrigin || window.location.origin}${this.loginPagePath}`;
  }

  getDsrReport(filters: DsrFilters): Observable<DsrReportResult> {
    const body = new URLSearchParams();
    body.set('arrSearchValueAjxKey', JSON.stringify(this.buildTraacsSearchPayload(filters)));
    body.set('strStausAjxKey', 'S');

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: '*/*',
      'X-Requested-With': 'XMLHttpRequest',
    });

    return this.http.post(this.endpoint, body.toString(), { headers, responseType: 'text' }).pipe(
      map((response) => ({
        data: this.parseResponse(response),
        source: 'api' as const,
        receivedAt: new Date(),
      })),
    );
  }

  toDashboardView(response: DsrReportResponse, language: DashboardLanguage): DsrDashboardView {
    const summary = response.arrDsrDetailsSummaryDataPhpKey ?? {};
    const description = summary.arrDsrDetailsSummaryDesPhpKey ?? {};
    const payment = summary.arrDsrDetailsSummaryMopPhpKey ?? {};
    const typeOfSale = summary.arrDsrDetailsSummaryTypeOfSalePhpKey ?? {};
    const payable = summary.arrDsrDetailsSummaryPayableSummaryPhpKey ?? {};
    const profit = summary.arrDsrDetailsSummaryProfitPhpKey ?? {};
    const expense = summary.arrDsrDetailsSummaryExpensePhpKey ?? {};

    const saleTotal = this.valueOf(description, 'Sale', 'dblTotal');
    const refundTotal = this.valueOf(description, 'Refund', 'dblTotal');
    const netTotal = this.valueOf(description, 'Net', 'dblTotal');
    const netProfit = this.valueOf(description, 'Net', 'dblProfit');
    const billingTax = this.valueOf(description, 'Net', 'dblBillingTax');
    const saleCount = this.valueOf(payment, 'Sale', 'intCreditCount');
    const refundCount = Math.abs(this.valueOf(payment, 'Refund', 'intCreditCount'));
    const profitMargin = netTotal === 0 ? 0 : netProfit / netTotal;

    const metricCards: MetricCard[] = [
      {
        label: language === 'ar' ? 'صافي الربح' : 'Net profit',
        value: netProfit,
        helper: language === 'ar' ? `هامش ${(profitMargin * 100).toFixed(1)}%` : `${(profitMargin * 100).toFixed(1)}% margin`,
        tone: 'net',
        icon: 'net',
      },
      {
        label: language === 'ar' ? 'حجم المبيعات' : 'Sales volume',
        value: saleTotal,
        helper: language === 'ar' ? `${saleCount.toLocaleString()} مستند` : `${saleCount.toLocaleString()} documents`,
        tone: 'sale',
        icon: 'sale',
      },
      {
        label: language === 'ar' ? 'حجم المرتجعات' : 'Refund volume',
        value: refundTotal,
        helper:
          language === 'ar'
            ? `${refundCount.toLocaleString()} مستند مرتجع`
            : `${refundCount.toLocaleString()} refunded documents`,
        tone: 'refund',
        icon: 'refund',
      },
      {
        label: language === 'ar' ? 'صافي الإجمالي' : 'Net total',
        value: netTotal,
        helper: language === 'ar' ? 'المبيعات ناقص المرتجعات' : 'Sales minus refunds',
        tone: 'net',
        icon: 'net',
      },
      {
        label: language === 'ar' ? 'ضريبة الفاتورة' : 'Billing tax',
        value: billingTax,
        helper: language === 'ar' ? 'صافي ضريبة الفواتير' : 'Net billing VAT / tax',
        tone: 'refund',
        icon: 'tax',
      },
      {
        label: language === 'ar' ? 'رسوم الخدمة' : 'Service fee',
        value: this.valueOf(description, 'Net', 'dblServiceFee'),
        helper: language === 'ar' ? 'صافي حركة رسوم الخدمة' : 'Net service fee movement',
        tone: 'net',
        icon: 'fee',
      },
      {
        label: language === 'ar' ? 'الخصم الممنوح' : 'Discount given',
        value: this.valueOf(description, 'Net', 'dblDiscountGiven'),
        helper: language === 'ar' ? 'تأثير إجمالي الخصومات' : 'Total discount impact',
        tone: 'sale',
        icon: 'discount',
      },
      {
        label: language === 'ar' ? 'مستحقات المورد' : 'Supplier payable',
        value: this.valueOf(payable, 'Profit', 'dblSuppAmount'),
        helper: language === 'ar' ? 'ملخص مستحقات الأرباح' : 'Profit payable summary',
        tone: 'profit',
        icon: 'supplier',
      },
    ];

    const expenseRows = this.buildSummaryRows(expense, language, ['dblExpenseTax', 'dblBankCharge']);

    return {
      metricCards,
      comparisonRows: [
        { label: BUCKET_LABELS[language].Sale, value: saleTotal },
        { label: BUCKET_LABELS[language].Refund, value: refundTotal },
        { label: BUCKET_LABELS[language].Net, value: netTotal },
        { label: BUCKET_LABELS[language].Profit, value: netProfit },
      ],
      paymentRows: this.flattenGroup(payment, language),
      payableRows: this.flattenGroup(payable, language),
      profitRows: this.flattenGroup(profit, language),
      summaryRows: this.buildSummaryRows(description, language),
      profitSummaryRows: this.buildSummaryRows(profit, language, [
        'dblServiceFee',
        'dblDiscountGiven',
        'dblExtraEarning',
        'dblSTDComm',
        'dblPaybackCommission',
        'dblGlpoProfit',
        'dblCCChargeCollected',
        'dblSuppAgencyCharge',
        'dblIataInsuranceCollected',
        'dblIataInsurancePayable',
        'dblSupplierFee',
        'dblExpenseTax',
      ]),
      expenseRows,
      paymentSummaryRows: this.buildPaymentRows(payment, language),
      payableSummaryRows: this.buildPayableRows(payable, language),
      typeOfSaleRows: this.buildTypeOfSaleRows(typeOfSale, language),
      hasExpenses: expenseRows.some((row) => row.sale !== 0 || row.refund !== 0 || row.net !== 0),
      totalVolume: Math.max(Math.abs(saleTotal), Math.abs(refundTotal), Math.abs(netTotal), Math.abs(netProfit)),
      saleCount,
      refundCount,
      profitMargin,
      rawPreview: JSON.stringify(response, null, 2),
    };
  }

  private parseResponse(response: string): DsrReportResponse {
    const parsed = JSON.parse(response.trim()) as unknown;

    if (!this.isObject(parsed)) {
      throw new Error('DSR response is not an object.');
    }

    return parsed as DsrReportResponse;
  }

  private buildSummaryRows(
    description: DsrMetricGroup,
    language: DashboardLanguage,
    metrics = [
      'dblTotal',
      'dblServiceFee',
      'dblProfit',
      'dblBillingTax',
      'dblDiscountGiven',
      'dblMF',
      'dblTax',
      'dblVATIn',
    ],
  ): DsrSummaryRow[] {
    return metrics.map((metric) => ({
      label: this.metricLabel(metric, language),
      sale: this.valueOf(description, 'Sale', metric),
      refund: this.valueOf(description, 'Refund', metric),
      net: this.valueOf(description, 'Net', metric),
    }));
  }

  private buildPaymentRows(payment: DsrMetricGroup, language: DashboardLanguage): DsrPaymentRow[] {
    return [
      { bucket: 'Sale' as const, tone: 'sale' as const },
      { bucket: 'Refund' as const, tone: 'refund' as const },
      { bucket: 'Net' as const, tone: 'net' as const },
      { bucket: 'Profit' as const, tone: 'profit' as const },
    ].map(({ bucket, tone }) => ({
      label: BUCKET_LABELS[language][bucket],
      tone,
      count: bucket === 'Profit' ? null : Math.abs(this.valueOf(payment, bucket, 'intCreditCount')),
      amount: this.valueOf(payment, bucket, 'dblCreditAmount'),
    }));
  }

  private buildPayableRows(payable: DsrMetricGroup, language: DashboardLanguage): DsrPayableRow[] {
    return [
      { bucket: 'Sale' as const, tone: 'sale' as const },
      { bucket: 'Refund' as const, tone: 'refund' as const },
      { bucket: 'Net' as const, tone: 'net' as const },
      { bucket: 'Profit' as const, tone: 'profit' as const },
    ].map(({ bucket, tone }) => ({
      label: BUCKET_LABELS[language][bucket],
      tone,
      cost: this.valueOf(payable, bucket, 'dblCostAmount'),
      supplier: this.valueOf(payable, bucket, 'dblSuppAmount'),
    }));
  }

  private buildTypeOfSaleRows(typeOfSale: DsrMetricGroup, language: DashboardLanguage): DsrTypeOfSaleRow[] {
    return [
      { label: TYPE_OF_SALE_LABELS[language]['Ticket'], countMetric: 'intTicketCount', amountMetric: 'dblTicketAmount' },
      { label: TYPE_OF_SALE_LABELS[language]['Hotel'], countMetric: 'intHotelCount', amountMetric: 'dblHotelAmount' },
      { label: TYPE_OF_SALE_LABELS[language]['Car'], countMetric: 'intCarCount', amountMetric: 'dblCarAmount' },
      { label: TYPE_OF_SALE_LABELS[language]['Stock'], countMetric: 'intStockCount', amountMetric: 'dblStockAmount' },
      {
        label: TYPE_OF_SALE_LABELS[language]['OtherService'],
        countMetric: 'intOtherServiceCount',
        amountMetric: 'dblOtherServiceAmount',
      },
    ].map(({ label, countMetric, amountMetric }) => ({
      label,
      count: Math.abs(this.valueOf(typeOfSale, 'Sale', countMetric)),
      amount: this.valueOf(typeOfSale, 'Sale', amountMetric),
    }));
  }

  private flattenGroup(group: DsrMetricGroup, language: DashboardLanguage): DsrMetricRow[] {
    const buckets: DsrBucket[] = ['Sale', 'Refund', 'Net', 'Profit'];
    const rows: DsrMetricRow[] = [];

    for (const bucket of buckets) {
      const metrics = group[bucket];
      if (!metrics) {
        continue;
      }

      for (const [metric, value] of Object.entries(metrics)) {
        const numericValue = this.toNumber(value);
        if (numericValue !== 0) {
          rows.push({
            label: `${BUCKET_LABELS[language][bucket]} ${this.metricLabel(metric, language)}`,
            value: numericValue,
          });
        }
      }
    }

    return rows;
  }

  private valueOf(group: DsrMetricGroup, bucket: DsrBucket, metric: string): number {
    return this.toNumber(group[bucket]?.[metric]);
  }

  private toNumber(value: number | string | undefined): number {
    const numberValue = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private metricLabel(metric: string, language: DashboardLanguage): string {
    return METRIC_LABELS[language][metric] ?? this.humanizeMetric(metric);
  }

  private humanizeMetric(metric: string): string {
    return metric
      .replace(/^(dbl|int|str|bln)/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
  }

  private buildTraacsSearchPayload(filters: DsrFilters): Record<string, unknown> {
    return {
      datDsrDetailsFromAjxKey: this.toTraacsDate(filters.fromDate),
      datDsrDetailsToAjxKey: this.toTraacsDate(filters.toDate),
      intDsrDetailsCostCenterAjxKey: filters.costCenters,
      intDsrDetailsDepartmentAjxKey: ['1'],
      strDsrDetailsSupplierCodeAjxKey: '',
      strDsrDetailsSupplierNameAjxKey: '',
      intDsrDetailsSupplierIdAjxKey: '',
      intDsrDetailsCustomerIdAjxKey: '',
      intDsrDetailsAirlineIdAjxKey: '',
      intDsrDetailsHotelIdAjxKey: '',
      strDsrDetailsHotelNameAjxKey: '',
      strDsrDetailsCustomerCodeAjxKey: '',
      strDsrDetailsCustomerNameAjxKey: '',
      strDsrDetailsAirlineNameAjxKey: '',
      intDsrDetailsUserIdAjxKey: '',
      strDsrDetailsAgentAjxKey: '',
      strDsrDetailsBookingStaffAjxKey: '',
      intDsrDetailsServiceAjxKey: '',
      strServiceTypeAjxKey: 'service',
      strDsrDetailsCurrencyAjxKey: 'Base',
      blnDsrDetailsSingleSectionAjxKey: true,
      blnDsrDetailsShowSaleDataAjxKey: filters.showSales,
      blnDsrDetailsShowRefundDataAjxKey: filters.showRefunds,
      blnDsrDetailsCashAjxKey: false,
      blnDsrDetailsChequeAjxKey: false,
      blnDsrDetailsCreditCardAjxKey: false,
      blnDsrDetailsCreditAjxKey: false,
      blnDsrDetailsTicketSaleAjxKey: true,
      blnDsrDetailsVoucherSaleAjxKey: true,
      blnDsrDetailsStockSaleAjxKey: true,
      blnDsrDetailsOtherServiceSaleAjxKey: true,
      blnDsrDetailsShowSummaryDataAjxKey: true,
      blnDsrDetailsShowDetailsDataAjxKey: true,
      strCostCenterAjxKey: filters.costCenters.length === 5 ? ['ALL'] : filters.costCenters,
      strDepartmentAjxKey: ['ALL'],
      strUserIdAjxKey: 'All',
      strServiceAjxKey: '',
      strGlobalCurrencyAjxKey: 'Base',
      strDateTypeAjxKey: filters.dateType,
      strCurrencyAjxKey: filters.currency === 'Base' ? 'SAR' : filters.currency,
      strDsrDetailsCostCentreGroupAjxKey: ['ALL'],
      intDsrDetailsCostCentreGroupAjxKey: ['ALL'],
      blnCashAjxKey: true,
      blnChequeAjxKey: true,
      blnTelexAjxKey: true,
      blnCreditCardAjxKey: true,
      blnUCCFAjxKey: true,
      blnCustomerCardAjxKey: true,
      blnCreditAjxKey: true,
      blnAllModOfPaymentCheckedAjxKey: true,
      strCustomerCodeAllAjxKey: '',
      intCustomerCountAjxKey: 0,
      strSortByAjxKey: 'Document Date-Ticket No',
      blnConsiderGLPOProfitAjxKey: true,
      blnListOnlyMYDataAjxKey: 'FALSE',
      blnConsiderCorp: false,
      blnConsiderCash: false,
      intProfileIdAjxKey: '',
      strSubCustomerCodeAjxKey: '',
      intSubCustomerCountAjxKey: 0,
      strDsrDetailsSubCustomerNameAjxKey: '',
      blnShowDataAjxKey: 'false',
      strTypeAjxKey: '',
      strCategoryAjxKey: 'All',
      strGroupAjxKey: '',
      strGroupNameAjxKey: 'All',
      strGdsCompanyAjxKey: '',
      strLpoNumberAjxKey: '',
      intRegionAjxKey: '',
      intAirportRegionAjxKey: '',
      strClassNameAjxKey: '',
      blnStaffResponsibleSaleAjxKey: true,
      blnCashEquivalentSaleAjxKey: true,
      strServiceGroupAjxKey: [],
      strServiceGroupIdAjxKey: [],
      intDsrDetailSalesManIdAjxKey: '',
      strDsrDetailSalesManNameAjxKey: '',
      blnRefundUnderIssuingStaff: false,
    };
  }

  private toTraacsDate(dateValue: string): string {
    const [year, month, day] = dateValue.split('-');
    return `${day}/${month}/${year}`;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private resolveApiOrigin(): string {
    return ['4200', '4201'].includes(window.location.port) ? `${window.location.protocol}//${window.location.hostname}:3333` : '';
  }
}
