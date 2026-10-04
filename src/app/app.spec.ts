import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { App } from './app';
import { DsrReportService } from './core/services/dsr-report.service';

function profitLossFixture(year: string) {
  const key = `${year}01`;
  const period = [{ strColumnHeading: `Jan ${year}` }];
  return {
    accounts: {
      arrKeyPhpKey: [key], arrTimePeriodePhpKey: period,
      arrPandLMonthWisePhpKey: [
        { fk_bint_sub_ledger_id: 1, vchr_account_name: 'Cabin Revenue', bint_category: 3, [`dbl_base_currency_debit_credt${key}`]: 100.25, total: 100.25 },
        { fk_bint_sub_ledger_id: 2, vchr_account_name: 'Rent Expense', bint_category: 4, [`dbl_base_currency_debit_credt${key}`]: 30.10, total: 30.10 },
      ],
    },
    centers: {
      arrKeyPhpKey: [key], arrTimePeriodePhpKey: period,
      arrPandLMonthWisePhpKey: [
        { fk_bint_cost_center_id: 75, vchr_cost_center_name: '810 - G.S.E', bint_category: 3, [`dbl_base_currency_debit_credt${key}`]: 100.25 },
        { fk_bint_cost_center_id: 75, vchr_cost_center_name: '810 - G.S.E', bint_category: 4, [`dbl_base_currency_debit_credt${key}`]: 20.10 },
        { fk_bint_cost_center_id: 1, vchr_cost_center_name: '100 - Head Quarter', bint_category: 4, [`dbl_base_currency_debit_credt${key}`]: 10 },
      ],
      arrPandLMonthWiseSumPhpKey: [
        { bint_category: 3, [`dbl_base_currency_debit_credt${key}`]: 100.25 },
        { bint_category: 4, [`dbl_base_currency_debit_credt${key}`]: 30.10 },
      ],
      arrPandLSalesPhpKey: [{ vchr_cost_center_name: '810 - G.S.E', [`base_dat_document${key}`]: 125.50 }],
      arrPandLSalesSumPhpKey: [{ [`base_dat_document${key}`]: 125.50 }],
    },
  };
}

function flushProfitLoss(http: HttpTestingController, year: string) {
  const data = profitLossFixture(year);
  const accounts = http.expectOne('/api/reports/finance/profit-loss/monthly-accounts');
  const centers = http.expectOne('/api/reports/finance/profit-loss/monthly-centers');
  accounts.flush(data.accounts);
  centers.flush(data.centers);
  return { accounts, centers };
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('shows the report names and company branding without session navigation', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.title')?.textContent).toContain('لوحة أداء مبيعات الخدمات');
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('First Premium Support Services');
    expect(compiled.querySelector<HTMLImageElement>('.brand-logo')?.getAttribute('src')).toBe('logo.jpg');
    expect(compiled.querySelector('.print-header strong')?.textContent).toBe('First Premium Support Services');
    expect(compiled.querySelector<HTMLImageElement>('.print-header img')?.getAttribute('src')).toBe('logo.jpg');
    expect(compiled.querySelectorAll('.sidebar .nav-button')).toHaveLength(3);
    expect(compiled.querySelector('.sidebar')?.textContent).not.toContain('Session');
    expect(compiled.querySelectorAll('.auth-actions button')).toHaveLength(2);
    expect(compiled.querySelector('.site-footer .footer-credit')?.textContent).toContain('Powered by');
    expect(compiled.querySelector<HTMLImageElement>('.footer-credit img')?.getAttribute('src')).toBe('codit.png');
    expect(compiled.querySelector<HTMLAnchorElement>('.footer-contact')?.getAttribute('href')).toBe('https://wa.me/201144918857');
    compiled.querySelectorAll<HTMLButtonElement>('.sidebar .nav-button')[1].click();
    fixture.detectChanges();
    expect(compiled.querySelector('.title')?.textContent).toContain('لوحة تحليل العملاء');
    expect(compiled.querySelector('.site-footer')).not.toBeNull();
    compiled.querySelectorAll<HTMLButtonElement>('.sidebar .nav-button')[2].click();
    fixture.detectChanges();
    expect(compiled.querySelector('.title')?.textContent).toContain('لوحة أداء مراكز التكلفة');
    expect(compiled.querySelector('.site-footer')).not.toBeNull();
    compiled.querySelector<HTMLButtonElement>('.topbar-actions .light-btn')!.click();
    fixture.detectChanges();
    expect(compiled.querySelector('.title')?.textContent).toContain('Cost Centre Performance Dashboard');
    expect([...compiled.querySelectorAll('.sidebar .nav-button')].map((button) => button.textContent?.trim())).toEqual([
      'Sales Performance Dashboard', 'Customer Insights Dashboard', 'Cost Centre Performance Dashboard',
    ]);
  });

  it('shows only the selected cost centre view', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[2].click();
    fixture.detectChanges();
    const buttons = element.querySelectorAll<HTMLButtonElement>('.report-view-switch button');
    expect(buttons).toHaveLength(2);
    expect(element.querySelector('app-cost-centre-overview')).not.toBeNull();
    expect(element.querySelector('app-year-comparison')).toBeNull();
    buttons[1].click();
    fixture.detectChanges();
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('app-year-comparison')).not.toBeNull();
    expect(element.querySelector('app-cost-centre-overview')).toBeNull();
    expect(element.querySelector('.cost-details')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('.export-btn')?.disabled).toBe(true);
    buttons[0].click();
    fixture.detectChanges();
    expect(element.querySelector('app-cost-centre-overview')).not.toBeNull();
    expect(element.querySelector('app-year-comparison')).toBeNull();
  });

  it('loads a selected year and separates sales, P&L income, expenses, and net profit', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const button = [...element.querySelectorAll<HTMLButtonElement>('app-monthly-sales-overview .year-strip button')]
      .find((item) => item.textContent?.trim() === '2025')!;
    button.click();
    const requests = flushProfitLoss(http, '2025');
    const payload = JSON.parse(new URLSearchParams(requests.accounts.request.body).get('arrSearchValueAjxKey')!);
    expect([payload.datFromMonthAjxKey, payload.intFromYearAjxKey, payload.datToMonthAjxKey, payload.intToYearAjxKey])
      .toEqual(['1', '2025', '12', '2025']);
    fixture.detectChanges();
    expect(element.querySelector('.metric.revenue strong')?.textContent?.trim()).toBe('125.50');
    expect(element.querySelector('.metric.income strong')?.textContent?.trim()).toBe('100.25');
    expect(element.querySelector('.metric.expense strong')?.textContent?.trim()).toBe('30.10');
    expect(element.querySelector('.metric.net strong')?.textContent?.trim()).toBe('70.15');
    expect(element.querySelector('.metric.margin strong')?.textContent?.trim()).toBe('55.9%');
    expect(element.querySelectorAll('.monthly-summary .metric')).toHaveLength(5);
    expect(element.querySelectorAll('#monthly-revenue .pl-service-columns .column')).toHaveLength(1);
    expect(element.querySelector('#monthly-revenue')?.textContent).toContain('Cabin Revenue');
    expect(element.querySelector('.pl-donut')).not.toBeNull();
    expect(element.querySelectorAll('.pl-donut-legend > div')).toHaveLength(1);
    expect(element.querySelectorAll('.pl-share-table tbody tr')).toHaveLength(1);
    expect(element.querySelector('.pl-share-table tbody .pl-share-cell')?.textContent).toContain('100.0%');
    expect(element.querySelectorAll('#monthly-profit .monthly-columns .column')).toHaveLength(1);
    expect(element.querySelectorAll('.pl-margin-column')).toHaveLength(1);
    expect(element.querySelectorAll('#monthly-expenses .chart')).toHaveLength(1);
    expect(element.querySelector('#monthly-expenses')?.textContent).not.toContain('Rent Expense');
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const originalTitle = document.title;
    element.querySelector<HTMLButtonElement>('.export-btn')!.click();
    expect(print).toHaveBeenCalledOnce();
    expect(document.title).toContain('First Premium Support Services - لوحة أداء مبيعات الخدمات - report');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe(originalTitle);
    print.mockRestore();
    http.verify();
  });

  it('keeps the accounting basis fixed rather than offering unsupported filters', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('#monthly-date-type')).toBeNull();
    expect(element.querySelector('#monthly-currency')).toBeNull();
    element.querySelector<HTMLButtonElement>('app-monthly-sales-overview .apply')!.click();
    const requests = flushProfitLoss(http, String(new Date().getFullYear()));
    fixture.detectChanges();
    const centerPayload = JSON.parse(new URLSearchParams(requests.centers.request.body).get('arrSearchValueAjxKey')!);
    expect(centerPayload.strBaseAjxKey).toBe('Base');
    expect(element.querySelector('.monthly-summary')?.textContent).toContain('125.50');
    http.verify();
  });

  it('compares monthly sales in separate year charts without showing the standard report', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.report-view-switch button')[1].click();
    fixture.detectChanges();
    expect(element.querySelector('app-monthly-sales-overview')).toBeNull();
    element.querySelector<HTMLButtonElement>('app-monthly-year-comparison .apply')!.click();
    const accountRequests = http.match('/api/reports/finance/profit-loss/monthly-accounts');
    const centerRequests = http.match('/api/reports/finance/profit-loss/monthly-centers');
    expect(accountRequests).toHaveLength(2);
    expect(centerRequests).toHaveLength(2);
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1);
    expect(accountRequests.map((request) => {
      const payload = JSON.parse(new URLSearchParams(request.request.body).get('arrSearchValueAjxKey')!);
      return [payload.intFromYearAjxKey, payload.intToYearAjxKey, payload.datFromMonthAjxKey, payload.datToMonthAjxKey];
    })).toEqual([
      [String(currentYear - 1), String(currentYear - 1), '1', currentMonth],
      [String(currentYear), String(currentYear), '1', currentMonth],
    ]);
    for (let index = 0; index < 2; index++) {
      const year = String(currentYear - 1 + index);
      const data = profitLossFixture(year);
      accountRequests[index].flush(data.accounts);
      centerRequests[index].flush(data.centers);
    }
    fixture.detectChanges();
    expect(element.querySelectorAll('.comparison-chart')).toHaveLength(4);
    expect(element.querySelectorAll('.comparison-chart:first-child .comparison-year')).toHaveLength(2);
    expect(element.querySelector<HTMLButtonElement>('.export-btn')?.disabled).toBe(false);
    http.verify();
  });

  it('loads a selected DSR year immediately and renders the new overview', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[1].click();
    fixture.detectChanges();
    const year = [...element.querySelectorAll<HTMLButtonElement>('app-dsr-overview .year-strip button')]
      .find((button) => button.textContent?.trim() === '2025')!;
    year.click();
    const requests = http.match('/api/reports/sales/dsr');
    expect(requests).toHaveLength(2);
    const byStatus = new Map(requests.map((request) => {
      const body = new URLSearchParams(request.request.body);
      const payload = JSON.parse(body.get('arrSearchValueAjxKey')!);
      expect([payload.datDsrDetailsFromAjxKey, payload.datDsrDetailsToAjxKey])
        .toEqual(['01/01/2025', '31/12/2025']);
      return [body.get('strStausAjxKey'), request] as const;
    }));
    expect(byStatus.get('D')?.request.body).toContain('tabClick=true');
    expect(byStatus.get('S')?.request.body).not.toContain('tabClick');
    byStatus.get('S')!.flush(JSON.stringify({
      arrDsrDetailsSummaryDataPhpKey: {
        arrDsrDetailsSummaryDesPhpKey: { Net: { dblTotal: 230, dblProfit: 140 } },
      },
    }));
    byStatus.get('D')!.flush(JSON.stringify({
      arrDsrTicketsPhpKey: [{
        datDatePhpKey: '15/01/2025', strDocumentNoPhpKey: 'D-1', strServiceName: 'Cabin Revenue',
        strCustomerNamePhpKey: 'Customer A', strCostCenterNamePhpKey: '808 - AirPort Jeddah', dblSellingAmtPhpKey: 125,
        dblProfitAmtPhpKey: 90, dblCustomerTaxPhpKey: 5,
      }, {
        datDatePhpKey: '15/01/2025', strDocumentNoPhpKey: 'D-2', strServiceName: 'Cabin Revenue',
        strCustomerNamePhpKey: 'Customer B', strCostCenterNamePhpKey: '810 - G.S.E', dblSellingAmtPhpKey: 75,
        dblProfitAmtPhpKey: 30, dblCustomerTaxPhpKey: 3,
      }],
      arrDsrDetailsCountPhpKey: { intDsrDetailTicketCountPhpKey: 3 },
    }));
    fixture.detectChanges();
    expect(element.querySelector('.metric.revenue strong')?.textContent?.trim()).toBe('200');
    expect(element.querySelector('.metric.net strong')?.textContent?.trim()).toBe('120');
    expect(element.querySelector('.metric.expense strong')?.textContent?.trim()).toBe('2');
    expect(element.querySelectorAll('#dsr-customers .customer-rank-row')).toHaveLength(2);
    expect(element.querySelector('#dsr-customer-detail')?.textContent).toContain('Cabin Revenue');
    expect(element.querySelectorAll('#dsr-trend .customer-month')).toHaveLength(2);
    expect(element.querySelector('.customer-data-note')?.textContent).toContain('2 / 3');
    expect(element.querySelector('.canvas')?.firstElementChild?.classList.contains('customer-data-note')).toBe(true);
    http.verify();
  });

  it('shows only DSR year comparison and queries the same date window for each year', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[1].click();
    fixture.detectChanges();
    element.querySelectorAll<HTMLButtonElement>('.report-view-switch button')[1].click();
    fixture.detectChanges();
    expect(element.querySelector('app-dsr-overview')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('.export-btn')?.disabled).toBe(true);
    element.querySelector<HTMLButtonElement>('app-dsr-year-comparison .apply')!.click();
    const requests = http.match('/api/reports/sales/dsr');
    expect(requests).toHaveLength(4);
    expect(requests.map((request) => {
      const body = new URLSearchParams(request.request.body);
      const payload = JSON.parse(body.get('arrSearchValueAjxKey')!);
      return [payload.datDsrDetailsFromAjxKey, payload.datDsrDetailsToAjxKey, body.get('strStausAjxKey')];
    })).toEqual([
      ['01/01/2025', '09/09/2025', 'S'], ['01/01/2025', '09/09/2025', 'D'],
      ['01/01/2026', '09/09/2026', 'S'], ['01/01/2026', '09/09/2026', 'D'],
    ]);
    for (const request of requests) {
      const status = new URLSearchParams(request.request.body).get('strStausAjxKey');
      request.flush(JSON.stringify(status === 'S' ? {} : { arrDsrDetailsCountPhpKey: { intDsrDetailTicketCountPhpKey: 2 }, arrDsrTicketsPhpKey: [{
        datDatePhpKey: '15/01/2026', strDocumentNoPhpKey: 'D-1',
        dblSellingAmtPhpKey: 125, dblProfitAmtPhpKey: 90,
      }] }));
    }
    fixture.detectChanges();
    expect(element.querySelectorAll('app-dsr-year-comparison .comparison-chart')).toHaveLength(4);
    expect(element.querySelector('.comparison-data-note')?.textContent).toContain('بيانات جزئية');
    expect(element.querySelectorAll('app-dsr-year-comparison .comparison-chart:first-child .comparison-year')).toHaveLength(2);
    expect(element.querySelector<HTMLButtonElement>('.export-btn')?.disabled).toBe(false);
    http.verify();
  });

  it('does not present summary-only DSR totals as customer analysis', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[1].click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('app-dsr-overview .apply')!.click();
    const requests = http.match('/api/reports/sales/dsr');
    expect(requests).toHaveLength(2);
    const summary = requests.find((request) => new URLSearchParams(request.request.body).get('strStausAjxKey') === 'S')!;
    const details = requests.find((request) => new URLSearchParams(request.request.body).get('strStausAjxKey') === 'D')!;
    summary.flush(JSON.stringify({
      arrDsrDetailsSummaryDataPhpKey: {
        arrDsrDetailsSummaryDesPhpKey: { Net: { dblTotal: 10827115, dblProfit: 10150440 } },
        arrDsrDetailsSummaryProfitPhpKey: { Net: { dblServiceFee: 10150440 } },
        arrDsrDetailsSummaryTypeOfSalePhpKey: { Sale: { dblOtherServiceAmount: 10827115, intOtherServiceCount: 250 } },
      },
    }));
    details.flush(JSON.stringify({ arrDsrTicketsPhpKey: null, arrDsrDetailsCountPhpKey: { intDsrDetailTicketCountPhpKey: 0 } }));
    fixture.detectChanges();
    expect(element.querySelector('app-dsr-overview .metric.revenue strong')?.textContent?.trim()).toBe('-');
    expect(element.querySelector('#dsr-customers')).toBeNull();
    expect(element.querySelector('.empty-overview')?.textContent).toContain('TRAACS');
    http.verify();
  });

  it('groups customer lines by code and counts unique documents with signed refunds', () => {
    const service = TestBed.inject(DsrReportService);
    const report = service.toCustomerDashboardView({
      arrDsrTicketsPhpKey: [
        { strCustomerCodePhpKey: 'A', strCustomerNamePhpKey: 'Alpha', strDocumentNoPhpKey: 'INV-1', datDatePhpKey: '01/01/2026', strServiceName: 'Fuel', dblSellingAmtPhpKey: 100, dblProfitAmtPhpKey: 40 },
        { strCustomerCodePhpKey: 'A', strCustomerNamePhpKey: 'Alpha renamed', strDocumentNoPhpKey: 'INV-1', datDatePhpKey: '01/01/2026', strServiceName: 'Cabin', dblSellingAmtPhpKey: 50, dblProfitAmtPhpKey: 20 },
        { strCustomerCodePhpKey: 'A', strDocumentNoPhpKey: 'REF-1', datDatePhpKey: '02/02/2026', strServiceName: 'Fuel', strSalesRefundsTypePhpKey: 'REFUND', dblSellingAmtPhpKey: -25, dblProfitAmtPhpKey: -10 },
        { strCustomerCodePhpKey: 'B', strCustomerNamePhpKey: 'Alpha', strDocumentNoPhpKey: 'INV-2', datDatePhpKey: '01/02/2026', strServiceName: 'Fuel', dblSellingAmtPhpKey: 75, dblProfitAmtPhpKey: 25 },
      ],
      arrDsrDetailsCountPhpKey: { intDsrDetailTicketCountPhpKey: 6 },
    });
    expect(report.customerCount).toBe(2);
    expect(report.revenue).toBe(200);
    expect(report.profit).toBe(75);
    expect(report.documents).toBe(3);
    expect(report.loadedRows).toBe(4);
    expect(report.totalRows).toBe(6);
    expect(report.customers.find((row) => row.code === 'A')).toMatchObject({ revenue: 125, profit: 50, documents: 2, lines: 3, refunds: 25, activeMonths: 2 });
    expect(report.months.map((row) => [row.key, row.customers, row.documents])).toEqual([['2026-01', 1, 1], ['2026-02', 2, 2]]);
  });

  it('loads each selected year immediately with its own date range', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[2].click();
    fixture.detectChanges();
    for (const [year, amount] of [
      [2025, 125],
      [2024, 75],
    ]) {
      const button = [...element.querySelectorAll<HTMLButtonElement>('.year-strip button')].find(
        (item) => item.textContent?.trim() === String(year),
      )!;
      button.click();
      const request = http.expectOne('/api/reports/finance/cost-centre-periodical');
      const payload = JSON.parse(
        new URLSearchParams(request.request.body).get('arrSearchValueAjxKey')!,
      );
      expect(payload.datFromAjxKey).toBe(`01/01/${year}`);
      expect(payload.datToAjxKey).toBe(`31/12/${year}`);
      request.flush(
        JSON.stringify({
          arrCostCentersPhpKey: [
            { pk_bint_cost_center_id: 73, vchr_cost_center_name: '808 - AirPort Jeddah' },
          ],
          arrCostCenterWiseDetailsPhpKey: [
            {
              bint_category: 3,
              vchr_account_name: 'Revenue',
              dbl_base_currency_debit_credt73: amount,
            },
          ],
        }),
      );
      fixture.detectChanges();
      expect(element.querySelector('.report-heading')?.textContent).toContain(
        `${year}-01-01 - ${year}-12-31`,
      );
      expect(element.querySelector('.metric.revenue strong')?.textContent?.trim()).toBe(
        String(amount),
      );
    }
    http.verify();
  });

  it('combines only the selected nonconsecutive quarters and uses one request for adjacent quarters', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[2].click();
    fixture.detectChanges();
    const quarters = element.querySelectorAll<HTMLInputElement>('.quarters input');
    quarters[0].click();
    fixture.detectChanges();
    quarters[2].click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('app-cost-centre-overview .apply')!.click();
    const requests = http.match('/api/reports/finance/cost-centre-periodical');
    expect(requests).toHaveLength(2);
    const periods = requests.map((request) => {
      const payload = JSON.parse(
        new URLSearchParams(request.request.body).get('arrSearchValueAjxKey')!,
      );
      return [payload.datFromAjxKey, payload.datToAjxKey];
    });
    expect(periods).toEqual([
      ['01/01/2026', '31/03/2026'],
      ['01/07/2026', '30/09/2026'],
    ]);
    for (const [index, request] of requests.entries()) {
      request.flush(
        JSON.stringify({
          arrCostCentersPhpKey: [
            { pk_bint_cost_center_id: 73, vchr_cost_center_name: '808 - AirPort Jeddah' },
          ],
          arrCostCenterWiseDetailsPhpKey: [
            {
              fk_bint_sub_ledger_id: 88,
              bint_category: 3,
              vchr_account_name: 'Revenue',
              dbl_base_currency_debit_credt73: index ? 30 : 10,
            },
            {
              fk_bint_sub_ledger_id: 90,
              bint_category: 4,
              vchr_account_name: 'Expense',
              dbl_base_currency_debit_credt73: index ? 7 : 5,
            },
          ],
        }),
      );
    }
    fixture.detectChanges();
    expect(element.querySelector('.metric.revenue strong')?.textContent?.trim()).toBe('40');
    expect(element.querySelector('.metric.expense strong')?.textContent?.trim()).toBe('12');
    expect(element.querySelector('.metric.net strong')?.textContent?.trim()).toBe('28');
    expect(element.querySelector('.report-heading')?.textContent).toContain('الربع 1');
    expect(element.querySelector('.report-heading')?.textContent).toContain('الربع 3');

    quarters[2].click();
    fixture.detectChanges();
    quarters[1].click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('app-cost-centre-overview .apply')!.click();
    const adjacent = http.expectOne('/api/reports/finance/cost-centre-periodical');
    const adjacentPayload = JSON.parse(
      new URLSearchParams(adjacent.request.body).get('arrSearchValueAjxKey')!,
    );
    expect([adjacentPayload.datFromAjxKey, adjacentPayload.datToAjxKey]).toEqual([
      '01/01/2026',
      '30/06/2026',
    ]);
    adjacent.flush(
      JSON.stringify({
        arrCostCentersPhpKey: [
          { pk_bint_cost_center_id: 73, vchr_cost_center_name: '808 - AirPort Jeddah' },
        ],
        arrCostCenterWiseDetailsPhpKey: [
          {
            fk_bint_sub_ledger_id: 88,
            bint_category: 3,
            vchr_account_name: 'Revenue',
            dbl_base_currency_debit_credt73: 21,
          },
        ],
      }),
    );
    http.verify();
  });

  it('keeps totals and charts limited to multiple selected cost centres', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[2].click();
    fixture.detectChanges();
    element.querySelector<HTMLInputElement>('input[name="center-73"]')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLInputElement>('input[name="center-74"]')!.click();
    fixture.detectChanges();
    expect(element.querySelector<HTMLInputElement>('input[name="center-all"]')!.checked).toBe(false);
    expect(element.querySelector<HTMLInputElement>('input[name="center-73"]')!.checked).toBe(true);
    expect(element.querySelector<HTMLInputElement>('input[name="center-74"]')!.checked).toBe(true);
    element.querySelector<HTMLButtonElement>('app-cost-centre-overview .apply')!.click();
    const request = http.expectOne('/api/reports/finance/cost-centre-periodical');
    const payload = JSON.parse(new URLSearchParams(request.request.body).get('arrSearchValueAjxKey')!);
    expect(payload.intCostCenterAjxKey).toBe('');
    expect(payload.strCostCenterNameAjxKey).toBe('ALL');
    request.flush(JSON.stringify({
      arrCostCentersPhpKey: [
        { pk_bint_cost_center_id: 1, vchr_cost_center_name: '100 - Head Quarter' },
        { pk_bint_cost_center_id: 73, vchr_cost_center_name: '808 - AirPort Jeddah' },
        { pk_bint_cost_center_id: 74, vchr_cost_center_name: '809 - Maintenance' },
        { pk_bint_cost_center_id: 75, vchr_cost_center_name: '810 - G.S.E' },
      ],
      arrCostCenterWiseDetailsPhpKey: [
        { fk_bint_sub_ledger_id: 88, bint_category: 3, vchr_account_name: 'Revenue', dbl_base_currency_debit_credt1: 999, dbl_base_currency_debit_credt73: 100, dbl_base_currency_debit_credt74: 200, dbl_base_currency_debit_credt75: 300 },
        { fk_bint_sub_ledger_id: 90, bint_category: 4, vchr_account_name: 'Expense', dbl_base_currency_debit_credt1: 500, dbl_base_currency_debit_credt73: 20, dbl_base_currency_debit_credt74: 30, dbl_base_currency_debit_credt75: 70 },
      ],
    }));
    fixture.detectChanges();
    expect(element.querySelector('.metric.revenue strong')?.textContent?.trim()).toBe('300');
    expect(element.querySelector('.metric.expense strong')?.textContent?.trim()).toBe('50');
    expect(element.querySelectorAll('.comparison-row')).toHaveLength(2);
    expect(element.querySelector('.comparison')?.textContent).not.toContain('Head Quarter');
    expect(element.querySelector('.comparison')?.textContent).not.toContain('G.S.E');
    http.verify();
  });
});
