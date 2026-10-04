import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CostCentrePeriodicalFilters, MonthlySaleFilters, MonthlySaleReportResponse } from '../../models/dsr-report.models';
import { DsrReportService } from './dsr-report.service';

const filters: MonthlySaleFilters = {
  fromMonth: '1', fromYear: '2026', toMonth: '6', toYear: '2026',
  currency: 'SAR', dateType: 'Document Date', showProfit: true, showCount: true,
};

describe('DsrReportService monthly sales', () => {
  let service: DsrReportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DsrReportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('nets refunds and keeps cents in the source totals', () => {
    const data: MonthlySaleReportResponse = {
      arrTimePeriodePhpKey: [{ strColumnHeading: 'Jan 2026' }],
      arrSupplierMonthlySaleReportPhpKey: [
        { vchr_account_code: 'CAB', vchr_account_name: 'Cabin', dblSUMAmt0: '100.25', dblSUMProfit0: '80.10', dblCount0: 2 },
        { vchr_account_code: 'CAB', vchr_account_name: 'Cabin', dblSUMAmt0: '-10.20', dblSUMProfit0: '-8.05', dblCount0: -1 },
      ],
      arrRowTotalValuesPhpKey: [
        { dblRowTotalAmount: '100.25', dblRowTotalProfit: '80.10', dblRowTotalCount: 2 },
        { dblRowTotalAmount: '-10.20', dblRowTotalProfit: '-8.05', dblRowTotalCount: -1 },
      ],
    };
    const view = service.toMonthlySaleDashboardView(data);
    expect(view.totalAmount).toBeCloseTo(90.05, 2);
    expect(view.totalProfit).toBeCloseTo(72.05, 2);
    expect(view.totalCount).toBe(1);
    expect(view.totalSaleCount).toBe(2);
    expect(view.totalRefundCount).toBe(1);
    expect(view.services).toHaveLength(1);
  });

  it('rejects an API row whose month values disagree with its stated total', () => {
    expect(() => service.toMonthlySaleDashboardView({
      arrTimePeriodePhpKey: [{ strColumnHeading: 'Jan 2026' }],
      arrSupplierMonthlySaleReportPhpKey: [{ vchr_account_code: 'CAB', dblSUMAmt0: '90.05' }],
      arrRowTotalValuesPhpKey: [{ dblRowTotalAmount: '100.25' }],
    })).toThrow(/does not reconcile/);
  });

  it('loads all pages before calculating the report', () => {
    let response: MonthlySaleReportResponse | undefined;
    service.getMonthlySaleReport(filters).subscribe((data) => { response = data; });
    const first = http.expectOne('/api/reports/sales/monthly-service');
    expect(new URLSearchParams(first.request.body).get('intOffsetAjxKey')).toBe('0');
    first.flush(JSON.stringify({
      arrTimePeriodePhpKey: [{ strColumnHeading: 'Jan 2026' }],
      arrSupplierMonthlySaleReportPhpKey: Array.from({ length: 50 }, (_, index) => ({
        vchr_account_code: `S${index}`, dblSUMAmt0: '1.01', dblSUMProfit0: '0.81', dblCount0: 1,
      })),
      arrRowTotalValuesPhpKey: Array.from({ length: 50 }, () => ({
        dblRowTotalAmount: '1.01', dblRowTotalProfit: '0.81', dblRowTotalCount: 1,
      })),
    }));
    const second = http.expectOne('/api/reports/sales/monthly-service');
    expect(new URLSearchParams(second.request.body).get('intOffsetAjxKey')).toBe('50');
    second.flush(JSON.stringify({
      arrTimePeriodePhpKey: [{ strColumnHeading: 'Jan 2026' }],
      arrSupplierMonthlySaleReportPhpKey: [
        { vchr_account_code: 'S50', dblSUMAmt0: '2.02', dblSUMProfit0: '1.62', dblCount0: 2 },
      ],
      arrRowTotalValuesPhpKey: [{ dblRowTotalAmount: '2.02', dblRowTotalProfit: '1.62', dblRowTotalCount: 2 }],
    }));
    expect(response?.arrSupplierMonthlySaleReportPhpKey).toHaveLength(51);
    expect(service.toMonthlySaleDashboardView(response!).totalAmount).toBeCloseTo(52.52, 2);
  });

  it('uses the actual page length when the API caps rows below the requested size', () => {
    let response: MonthlySaleReportResponse | undefined;
    service.getMonthlySaleReport(filters).subscribe((data) => { response = data; });
    http.expectOne('/api/reports/sales/monthly-service').flush(JSON.stringify({
      intMonthlySaleReportCountPhpKey: 26,
      arrTimePeriodePhpKey: [{ strColumnHeading: 'Jan 2026' }],
      arrSupplierMonthlySaleReportPhpKey: Array.from({ length: 25 }, (_, index) => ({
        vchr_account_code: `S${index}`, dblSUMAmt0: 1,
      })),
    }));
    const second = http.expectOne('/api/reports/sales/monthly-service');
    expect(new URLSearchParams(second.request.body).get('intOffsetAjxKey')).toBe('25');
    second.flush(JSON.stringify({
      intMonthlySaleReportCountPhpKey: 26,
      arrTimePeriodePhpKey: [{ strColumnHeading: 'Jan 2026' }],
      arrSupplierMonthlySaleReportPhpKey: [{ vchr_account_code: 'S25', dblSUMAmt0: 1 }],
    }));
    expect(response?.arrSupplierMonthlySaleReportPhpKey).toHaveLength(26);
  });
});

describe('DsrReportService financial reconciliation', () => {
  let service: DsrReportService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DsrReportService);
  });

  it('preserves a loss on a sale and nets refunds from customer revenue and profit', () => {
    const view = service.toCustomerDashboardView({
      arrDsrTicketsPhpKey: [
        { strCustomerCodePhpKey: 'A', strDocumentNoPhpKey: 'INV-1', dblSellingAmtPhpKey: 100, dblProfitAmtPhpKey: -20 },
        { strCustomerCodePhpKey: 'A', strDocumentNoPhpKey: 'INV-2', dblSellingAmtPhpKey: 50, dblProfitAmtPhpKey: 25 },
        { strCustomerCodePhpKey: 'A', strDocumentNoPhpKey: 'REF-1', strSalesRefundsTypePhpKey: 'REFUND', dblSellingAmtPhpKey: 10, dblProfitAmtPhpKey: 5 },
      ],
      arrDsrDetailsCountPhpKey: { intDsrDetailTicketCountPhpKey: 4 },
    });
    expect(view.revenue).toBe(140);
    expect(view.profit).toBe(0);
    expect(view.customers[0]).toMatchObject({ revenue: 140, profit: 0, sales: 150, refunds: 10 });
    expect(view.loadedRows).toBe(3);
    expect(view.totalRows).toBe(4);
  });

  it('reconciles cost-centre source columns, including combined Jeddah/G.S.E and HQ overhead', () => {
    const filters: CostCentrePeriodicalFilters = {
      fromDate: '2026-01-01', toDate: '2026-09-16', costCenterId: '', costCenterName: 'ALL',
      departmentId: '1', departmentName: 'Default',
    };
    const view = service.toCostCentrePeriodicalDashboardView({
      arrCostCentersPhpKey: [
        { pk_bint_cost_center_id: 1, vchr_cost_center_name: '100 - Head Quarter' },
        { pk_bint_cost_center_id: 73, vchr_cost_center_name: '808 - AirPort Jeddah' },
        { pk_bint_cost_center_id: 74, vchr_cost_center_name: '809 - Maintenance' },
        { pk_bint_cost_center_id: 75, vchr_cost_center_name: '810 - G.S.E' },
        { pk_bint_cost_center_id: 77, vchr_cost_center_name: 'Medina' },
      ],
      arrCostCenterWiseDetailsPhpKey: [
        { bint_category: 3, vchr_account_name: 'Revenue A', dbl_base_currency_debit_credt73: 297506.25, dbl_base_currency_debit_credt75: 9441338.28 },
        { bint_category: 3, vchr_account_name: 'Revenue B', dbl_base_currency_debit_credt74: 39770, dbl_base_currency_debit_credt77: 362975 },
        { bint_category: 4, vchr_account_name: 'Expense A', dbl_base_currency_debit_credt1: 2828753.84, dbl_base_currency_debit_credt75: 3988746.79 },
        { bint_category: 4, vchr_account_name: 'Expense B', dbl_base_currency_debit_credt74: 570310.5, dbl_base_currency_debit_credt77: 483720.39 },
      ],
    }, filters);
    expect(view.totalRevenue).toBeCloseTo(10141589.53, 2);
    expect(view.totalExpense).toBeCloseTo(7871531.52, 2);
    expect(view.netProfit).toBeCloseTo(2270058.01, 2);
    expect(view.centers.find((center) => center.id === '73+75')).toMatchObject({ revenue: 9738844.53, expense: 3988746.79 });
    expect(view.centers.find((center) => center.id === '1')).toMatchObject({ isOperating: false, revenue: 0, expense: 2828753.84 });
  });

  it('keeps active centres missing from API metadata and rejects invalid financial values', () => {
    const filters: CostCentrePeriodicalFilters = {
      fromDate: '2026-01-01', toDate: '2026-12-31', costCenterId: '', costCenterName: 'ALL',
      departmentId: '1', departmentName: 'Default',
    };
    const response = {
      arrCostCentersPhpKey: [{ pk_bint_cost_center_id: 1, vchr_cost_center_name: 'Head Quarter' }],
      arrCostCenterWiseDetailsPhpKey: [{
        bint_category: 3, vchr_account_name: 'Revenue',
        dbl_base_currency_debit_credt1: 0, dbl_base_currency_debit_credt99: '125.25',
      }],
    };
    const view = service.toCostCentrePeriodicalDashboardView(response, filters);
    expect(view.totalRevenue).toBe(125.25);
    expect(view.centers.find((center) => center.id === '99')?.revenue).toBe(125.25);
    expect(() => service.toCostCentrePeriodicalDashboardView({
      ...response,
      arrCostCenterWiseDetailsPhpKey: [{ ...response.arrCostCenterWiseDetailsPhpKey[0], dbl_base_currency_debit_credt99: 'invalid' }],
    }, filters)).toThrow(/Invalid cost-centre value/);
  });
});
