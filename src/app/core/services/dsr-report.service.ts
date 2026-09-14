import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  DsrBucket,
  DsrDashboardView,
  DsrFilters,
  DsrDetailAggregateRow,
  DsrDetailAnalyticsView,
  DsrDetailDocumentRow,
  DsrMetricGroup,
  DsrMetricRow,
  DsrPayableRow,
  DsrPaymentRow,
  DsrReportResponse,
  DsrReportResult,
  DsrSummaryRow,
  DsrTicketRawRow,
  DsrTypeOfSaleRow,
  MetricCard,
  MonthlySaleDashboardView,
  MonthlySaleFilters,
  MonthlySaleMonthMetric,
  MonthlySaleRawRow,
  MonthlySaleReportResponse,
  MonthlySaleServiceRow,
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
  private readonly monthlySaleEndpoint = `${this.apiOrigin}/api/reports/sales/monthly-service`;

  updateSessionCookie(cookie: string): Observable<void> {
    return this.http.post<void>(`${this.apiOrigin}/api/session/cookie`, { cookie });
  }

  getSessionStatus(): Observable<{ hasCookie: boolean; loginUrl: string }> {
    return this.http.get<{ hasCookie: boolean; loginUrl: string }>(`${this.apiOrigin}/api/session/status`);
  }

  getTraacsLoginUrl(): string {
    const loginOrigin = ['4200', '4201'].includes(window.location.port) ? window.location.origin : this.apiOrigin || window.location.origin;
    return `${loginOrigin}${this.loginPagePath}`;
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

  getMonthlySaleReport(filters: MonthlySaleFilters): Observable<MonthlySaleReportResponse> {
    const body = new URLSearchParams();
    body.set('intPerPageAjxKey', '50');
    body.set('intOffsetAjxKey', '0');
    body.set('arrSearchValueAjxKey', JSON.stringify(this.buildMonthlySaleSearchPayload(filters)));

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: '*/*',
      'X-Requested-With': 'XMLHttpRequest',
    });

    return this.http
      .post(this.monthlySaleEndpoint, body.toString(), { headers, responseType: 'text' })
      .pipe(map((response) => this.parseMonthlySaleResponse(response)));
  }

  toDashboardView(response: DsrReportResponse, language: DashboardLanguage): DsrDashboardView {
    const detailAnalytics = this.buildDsrDetailAnalytics(response);
    const summary = response.arrDsrDetailsSummaryDataPhpKey ?? {};
    const description = summary.arrDsrDetailsSummaryDesPhpKey ?? {};
    const payment = summary.arrDsrDetailsSummaryMopPhpKey ?? {};
    const typeOfSale = summary.arrDsrDetailsSummaryTypeOfSalePhpKey ?? {};
    const payable = summary.arrDsrDetailsSummaryPayableSummaryPhpKey ?? {};
    const profit = summary.arrDsrDetailsSummaryProfitPhpKey ?? {};
    const expense = summary.arrDsrDetailsSummaryExpensePhpKey ?? {};

    const saleTotal = this.valueOf(description, 'Sale', 'dblTotal') || Math.max(detailAnalytics?.totalSelling ?? 0, 0);
    const refundTotal = this.valueOf(description, 'Refund', 'dblTotal');
    const netTotal = this.valueOf(description, 'Net', 'dblTotal') || detailAnalytics?.totalSelling || 0;
    const netProfit = this.valueOf(description, 'Net', 'dblProfit') || detailAnalytics?.totalProfit || 0;
    const billingTax = this.valueOf(description, 'Net', 'dblBillingTax') || detailAnalytics?.totalTax || 0;
    const saleCount = this.valueOf(payment, 'Sale', 'intCreditCount') || detailAnalytics?.totalDocumentCount || 0;
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
      detailAnalytics,
      rawPreview: JSON.stringify(response, null, 2),
    };
  }

  private buildDsrDetailAnalytics(response: DsrReportResponse): DsrDetailAnalyticsView | null {
    const rows = response.arrDsrTicketsPhpKey ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    const totalDetails = response.arrDsrDetailsCountPhpKey?.arrTotalDetailsTicketPhpKey;
    const rowTotals = this.aggregateDsrRows(rows);
    const totalSelling = this.toNumber(totalDetails?.dblSellingPriceSumPhpKey) || rowTotals.amount;
    const totalProfit = this.toNumber(totalDetails?.dblProfitSumPhpKey) || rowTotals.profit;
    const totalTax = this.toNumber(totalDetails?.dblCustomerTaxSumPhpKey) || rowTotals.tax;
    const totalCost = this.toNumber(totalDetails?.dblCostAmtSumPhpKey) || rowTotals.cost;
    const totalDocumentCount =
      this.toNumber(totalDetails?.intCountPhpKey) ||
      this.toNumber(response.arrDsrDetailsCountPhpKey?.intDsrDetailTicketCountPhpKey) ||
      rows.length;
    const documents = rows.slice(0, 80).map((row) => this.toDsrDocumentRow(row));
    const services = this.groupDsrRows(rows, (row) => row.strServiceName || row.strSectorPhpKey || 'Unclassified service');
    const customers = this.groupDsrRows(rows, (row) => row.strCustomerNamePhpKey || 'Unclassified customer').slice(0, 12);
    const costCenters = this.groupDsrRows(rows, (row) => row.strCostCenterNamePhpKey || 'Unclassified cost center');
    const agents = this.groupDsrRows(rows, (row) => row.strBookingStaffName || row.strAgentNamePhpKey || 'Unassigned');
    const taxRegions = this.groupDsrRows(rows, (row) => row.strTaxRegionPhpKey || 'No tax region');
    const saleRefundRows = this.groupDsrRows(rows, (row) => row.strSalesRefundsTypePhpKey || 'Unknown');
    const months = this.groupDsrRows(rows, (row) => this.monthLabelFromDsrDate(row.datDatePhpKey || row.datIssueDatePhpKey || ''));

    return {
      hasDetails: true,
      rowCount: rows.length,
      totalDocumentCount,
      totalSelling,
      totalProfit,
      totalTax,
      totalCost,
      profitMargin: totalSelling === 0 ? 0 : totalProfit / totalSelling,
      avgDocumentValue: totalDocumentCount === 0 ? 0 : totalSelling / totalDocumentCount,
      taxableShare: totalSelling === 0 ? 0 : totalTax / totalSelling,
      services,
      customers,
      costCenters,
      agents,
      taxRegions,
      saleRefundRows,
      months,
      documents,
      maxServiceAmount: Math.max(...services.map((row) => Math.abs(row.amount)), 1),
      maxCustomerAmount: Math.max(...customers.map((row) => Math.abs(row.amount)), 1),
      maxCostCenterAmount: Math.max(...costCenters.map((row) => Math.abs(row.amount)), 1),
      maxMonthAmount: Math.max(...months.map((row) => Math.abs(row.amount)), 1),
    };
  }

  private groupDsrRows(rows: DsrTicketRawRow[], labelOf: (row: DsrTicketRawRow) => string): DsrDetailAggregateRow[] {
    const groups = new Map<string, DsrDetailAggregateRow>();

    for (const row of rows) {
      const label = labelOf(row).trim() || 'Unclassified';
      const current =
        groups.get(label) ??
        ({
          label,
          amount: 0,
          profit: 0,
          tax: 0,
          cost: 0,
          count: 0,
          saleCount: 0,
          refundCount: 0,
          margin: 0,
          share: 0,
        } satisfies DsrDetailAggregateRow);
      const sign = this.isDsrRefund(row) ? -1 : 1;

      current.amount += sign * Math.abs(this.toNumber(row.dblSellingAmtPhpKey));
      current.profit += sign * Math.abs(this.toNumber(row.dblProfitAmtPhpKey));
      current.tax += sign * Math.abs(this.toNumber(row.dblCustomerTaxPhpKey));
      current.cost += sign * Math.abs(this.toNumber(row.dblCostAmtPhpKey));
      current.count += sign;

      if (sign < 0) {
        current.refundCount += 1;
      } else {
        current.saleCount += 1;
      }

      groups.set(label, current);
    }

    const groupRows = [...groups.values()];
    const totalAmount = groupRows.reduce((total, row) => total + row.amount, 0);

    return groupRows
      .map((row) => ({
        ...row,
        margin: row.amount === 0 ? 0 : row.profit / row.amount,
        share: totalAmount === 0 ? 0 : row.amount / totalAmount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private aggregateDsrRows(rows: DsrTicketRawRow[]): DsrDetailAggregateRow {
    return this.groupDsrRows(rows, () => 'Total')[0];
  }

  private toDsrDocumentRow(row: DsrTicketRawRow): DsrDetailDocumentRow {
    const sign = this.isDsrRefund(row) ? -1 : 1;
    const amount = sign * Math.abs(this.toNumber(row.dblSellingAmtPhpKey));
    const profit = sign * Math.abs(this.toNumber(row.dblProfitAmtPhpKey));
    const tax = sign * Math.abs(this.toNumber(row.dblCustomerTaxPhpKey));

    return {
      date: String(row.datDatePhpKey || row.datIssueDatePhpKey || ''),
      documentNo: String(row.strDocumentNoPhpKey || '-'),
      ticketNo: String(row.strTicketPhpKey || '-'),
      service: String(row.strServiceName || row.strSectorPhpKey || '-'),
      customer: String(row.strCustomerNamePhpKey || '-'),
      costCenter: String(row.strCostCenterNamePhpKey || '-'),
      agent: String(row.strBookingStaffName || row.strAgentNamePhpKey || '-'),
      type: String(row.strSalesRefundsTypePhpKey || '-'),
      amount,
      profit,
      tax,
      margin: amount === 0 ? 0 : profit / amount,
    };
  }

  private isDsrRefund(row: DsrTicketRawRow): boolean {
    return /refund/i.test(String(row.strSalesRefundsTypePhpKey || row.strSaleRefundTypePhpKey || ''));
  }

  private monthLabelFromDsrDate(value: string): string {
    const [day, month, year] = String(value).split('/');
    const date = new Date(Number(year), Number(month) - 1, Number(day));

    if (Number.isNaN(date.getTime())) {
      return value || 'Unknown month';
    }

    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }

  toMonthlySaleDashboardView(response: MonthlySaleReportResponse): MonthlySaleDashboardView {
    const periods = response.arrTimePeriodePhpKey ?? [];
    const labels = periods.map((period, index) => ({
      label: period.strColumnHeading || `Month ${index + 1}`,
      fromDate: period.datFromDate || '',
      toDate: period.datToDate || '',
    }));
    const monthCount = Math.max(labels.length, this.detectMonthCount(response.arrSupplierMonthlySaleReportPhpKey ?? []));
    const monthLabels = Array.from({ length: monthCount }, (_, index) => labels[index] ?? {
      label: `Month ${index + 1}`,
      fromDate: '',
      toDate: '',
    });
    const services = this.buildMonthlyServiceRows(response.arrSupplierMonthlySaleReportPhpKey ?? [], monthLabels);
    const months = monthLabels.map((period, index) => {
      const amount = services.reduce((total, service) => total + service.months[index].amount, 0);
      const profit = services.reduce((total, service) => total + service.months[index].profit, 0);
      const count = services.reduce((total, service) => total + service.months[index].count, 0);
      const saleCount = services.reduce((total, service) => total + service.months[index].saleCount, 0);
      const refundCount = services.reduce((total, service) => total + service.months[index].refundCount, 0);
      const previousAmount =
        index === 0 ? null : services.reduce((total, service) => total + service.months[index - 1].amount, 0);

      return {
        ...period,
        amount,
        profit,
        count,
        saleCount,
        refundCount,
        margin: amount === 0 ? 0 : profit / amount,
        change: previousAmount === null || previousAmount === 0 ? null : (amount - previousAmount) / Math.abs(previousAmount),
      };
    });
    const totalAmount = months.reduce((total, month) => total + month.amount, 0);
    const totalProfit = months.reduce((total, month) => total + month.profit, 0);
    const totalCount = months.reduce((total, month) => total + month.count, 0);
    const totalSaleCount = months.reduce((total, month) => total + month.saleCount, 0);
    const totalRefundCount = months.reduce((total, month) => total + month.refundCount, 0);
    const topServices = services.slice(0, 5);
    const bestMonth = months.reduce<MonthlySaleMonthMetric | null>(
      (best, month) => (!best || month.amount > best.amount ? month : best),
      null,
    );
    const weakestMonth = months.reduce<MonthlySaleMonthMetric | null>(
      (weakest, month) => (!weakest || month.amount < weakest.amount ? month : weakest),
      null,
    );

    return {
      months,
      services,
      topServices,
      totalAmount,
      totalProfit,
      totalCount,
      grossMargin: totalAmount === 0 ? 0 : totalProfit / totalAmount,
      avgMonthlyAmount: months.length === 0 ? 0 : totalAmount / months.length,
      avgTicket: totalCount === 0 ? 0 : totalAmount / totalCount,
      bestMonth,
      weakestMonth,
      topService: topServices[0] ?? null,
      growthRate:
        months.length < 2 || months[0].amount === 0
          ? null
          : (months[months.length - 1].amount - months[0].amount) / Math.abs(months[0].amount),
      activeServiceCount: services.filter((service) => service.amount > 0).length,
      totalSaleCount,
      totalRefundCount,
      maxMonthlyAmount: Math.max(...months.map((month) => Math.abs(month.amount)), 1),
      maxServiceAmount: Math.max(...services.map((service) => Math.abs(service.amount)), 1),
      maxServiceProfit: Math.max(...services.map((service) => Math.abs(service.profit)), 1),
      maxServiceCount: Math.max(...services.map((service) => Math.abs(service.count)), 1),
      maxServiceMargin: Math.max(...services.map((service) => Math.abs(service.margin)), 1),
      maxHeatAmount: Math.max(...services.flatMap((service) => service.months.map((month) => Math.abs(month.amount))), 1),
      amountTrendPoints: this.toTrendPoints(months.map((month) => month.amount)),
      profitTrendPoints: this.toTrendPoints(months.map((month) => month.profit)),
      periodLabel: `${months[0]?.label ?? ''} - ${months[months.length - 1]?.label ?? ''}`,
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

  private parseMonthlySaleResponse(response: string): MonthlySaleReportResponse {
    const parsed = JSON.parse(response.trim()) as unknown;

    if (!this.isObject(parsed)) {
      throw new Error('Monthly sale response is not an object.');
    }

    return parsed as MonthlySaleReportResponse;
  }

  private buildMonthlyServiceRows(
    rows: MonthlySaleRawRow[],
    monthLabels: Array<{ label: string; fromDate: string; toDate: string }>,
  ): MonthlySaleServiceRow[] {
    const serviceMap = new Map<string, MonthlySaleServiceRow>();

    for (const row of rows) {
      const code = String(row.vchr_account_code || row.pk_bint_service_id || row.fk_bint_service_id || 'NA');
      const name = String(row.vchr_account_name || 'Unclassified service');
      const id = `${code}-${name}`;
      const current =
        serviceMap.get(id) ??
        ({
          id,
          code,
          name,
          amount: 0,
          profit: 0,
          count: 0,
          margin: 0,
          share: 0,
          avgTicket: 0,
          maxMonthAmount: 0,
          months: monthLabels.map((period) => ({
            ...period,
            amount: 0,
            profit: 0,
            count: 0,
            saleCount: 0,
            refundCount: 0,
            margin: 0,
            change: null,
          })),
        } satisfies MonthlySaleServiceRow);

      monthLabels.forEach((_, index) => {
        const count = this.toNumber(row[`dblCount${index}`] as number | string | undefined);
        current.months[index].amount += this.toNumber(row[`dblSUMAmt${index}`] as number | string | undefined);
        current.months[index].profit += this.toNumber(row[`dblSUMProfit${index}`] as number | string | undefined);
        current.months[index].count += count;

        if (count < 0) {
          current.months[index].refundCount += Math.abs(count);
        } else {
          current.months[index].saleCount += count;
        }
      });

      serviceMap.set(id, current);
    }

    const services = [...serviceMap.values()].map((service) => {
      service.months = service.months.map((month, index, months) => {
        const previous = index === 0 ? null : months[index - 1].amount;
        return {
          ...month,
          margin: month.amount === 0 ? 0 : month.profit / month.amount,
          change: previous === null || previous === 0 ? null : (month.amount - previous) / Math.abs(previous),
        };
      });
      service.amount = service.months.reduce((total, month) => total + month.amount, 0);
      service.profit = service.months.reduce((total, month) => total + month.profit, 0);
      service.count = service.months.reduce((total, month) => total + month.count, 0);
      service.margin = service.amount === 0 ? 0 : service.profit / service.amount;
      service.avgTicket = service.count === 0 ? 0 : service.amount / service.count;
      service.maxMonthAmount = Math.max(...service.months.map((month) => Math.abs(month.amount)), 0);
      return service;
    });
    const grandTotal = services.reduce((total, service) => total + service.amount, 0);

    return services
      .map((service) => ({ ...service, share: grandTotal === 0 ? 0 : service.amount / grandTotal }))
      .sort((a, b) => b.amount - a.amount);
  }

  private detectMonthCount(rows: MonthlySaleRawRow[]): number {
    return rows.reduce((max, row) => {
      const monthIndexes = Object.keys(row)
        .map((key) => /^dblSUMAmt(\d+)$/.exec(key)?.[1])
        .filter((value): value is string => Boolean(value))
        .map((value) => Number(value) + 1);

      return Math.max(max, ...monthIndexes, 0);
    }, 0);
  }

  private toTrendPoints(values: number[]): string {
    if (values.length === 0) {
      return '';
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return values
      .map((value, index) => {
        const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
        const y = 88 - ((value - min) / range) * 76;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
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

  private toNumber(value: number | string | null | undefined): number {
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

  private buildMonthlySaleSearchPayload(filters: MonthlySaleFilters): Record<string, unknown> {
    return {
      datFromMonthAjxKey: filters.fromMonth,
      intFromYearAjxKey: filters.fromYear,
      datToMonthAjxKey: filters.toMonth,
      intToYearAjxKey: filters.toYear,
      strServiceIdAjxKey: 'Service',
      strTypeAjxKey: 'service type',
      strCurrencyAjxKey: filters.currency === 'Base' ? 'SAR' : filters.currency,
      intCostCentreAjxKey: '',
      intDeptAjxKey: '1',
      strCostCentreNameAjxKey: 'ALL',
      strDepartmentNameAjxKey: 'Default',
      blnShowProfitAjxKey: filters.showProfit,
      blnShowCountAjxKey: filters.showCount,
      strAmountAjxKey: '2',
      strDateTypeAjxKey: filters.dateType,
      strGroupingAjxKey: 'service',
      strGroupingNameAjxKey: 'Service',
      strServiceAjxKey: 'Service',
      strServiceTypeAjxKey: 'Service Type',
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
