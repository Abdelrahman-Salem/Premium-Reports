import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { App } from './app';
import { DsrReportService } from './core/services/dsr-report.service';
import { ReportPdfService } from './core/services/report-pdf.service';
import { ExpenseReportService } from './core/services/expense-report.service';
import { of } from 'rxjs';

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
  const search = JSON.parse(new URLSearchParams(accounts.request.body).get('arrSearchValueAjxKey')!);
  const first = Number(search.intFromYearAjxKey) * 12 + Number(search.datFromMonthAjxKey) - 1;
  const last = Number(search.intToYearAjxKey) * 12 + Number(search.datToMonthAjxKey) - 1;
  const keys = Array.from({ length: last - first + 1 }, (_,i) => `${Math.floor((first+i)/12)}${String((first+i)%12+1).padStart(2,'0')}`);
  for (const response of [data.accounts,data.centers]) {
    response.arrKeyPhpKey = keys;
    response.arrTimePeriodePhpKey = keys.map((key) => ({ strColumnHeading: key }));
  }
  const expand = (rows: object[], prefix: string) => rows.forEach((row) => {
    const record = row as Record<string,unknown>;
    const amount = record[prefix + year + '01'];
    delete record[prefix + year + '01'];
    keys.forEach((key,i) => record[prefix + key] = i === 0 ? amount : 0);
  });
  expand([...data.accounts.arrPandLMonthWisePhpKey,...data.centers.arrPandLMonthWisePhpKey,...data.centers.arrPandLMonthWiseSumPhpKey], 'dbl_base_currency_debit_credt');
  expand([...data.centers.arrPandLSalesPhpKey,...data.centers.arrPandLSalesSumPhpKey], 'base_dat_document');
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
    expect(compiled.querySelector('.title')?.textContent).toContain('تحليل المصروفات');
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('First Premium Support Services');
    expect(compiled.querySelector<HTMLImageElement>('.brand-logo')?.getAttribute('src')).toBe('logo.jpg');
    expect(compiled.querySelector('.print-header strong')?.textContent).toBe('First Premium Support Services');
    expect(compiled.querySelector<HTMLImageElement>('.print-header img')?.getAttribute('src')).toBe('logo.jpg');
    expect(compiled.querySelectorAll('.sidebar .nav-button')).toHaveLength(4);
    expect(compiled.querySelector('.sidebar')?.textContent).not.toContain('Session');
    expect(compiled.querySelectorAll('.auth-actions button')).toHaveLength(1);
    expect(compiled.querySelector('.auth-actions')?.textContent).not.toContain('فتح تسجيل دخول');
    expect(compiled.querySelector('.site-footer .footer-credit')?.textContent).toContain('Powered by');
    expect(compiled.querySelector<HTMLImageElement>('.footer-credit img')?.getAttribute('src')).toBe('codit.png');
    expect(compiled.querySelector<HTMLAnchorElement>('.footer-contact')?.getAttribute('href')).toBe('https://wa.me/201144918857');
    compiled.querySelectorAll<HTMLButtonElement>('.sidebar .nav-button')[2].click();
    fixture.detectChanges();
    expect(compiled.querySelector('.title')?.textContent).toContain('تحليل العملاء');
    expect(compiled.querySelector('.site-footer')).not.toBeNull();
    compiled.querySelectorAll<HTMLButtonElement>('.sidebar .nav-button')[3].click();
    fixture.detectChanges();
    expect(compiled.querySelector('.title')?.textContent).toContain('الأداء السنوي');
    expect(compiled.querySelector('.site-footer')).not.toBeNull();
    compiled.querySelector<HTMLButtonElement>('.topbar-actions .light-btn')!.click();
    fixture.detectChanges();
    expect(compiled.querySelector('.title')?.textContent).toContain('Annual Performance');
    expect([...compiled.querySelectorAll('.sidebar .nav-button')].map((button) => button.textContent?.trim())).toEqual([
      'Sales Performance Summary', 'Expense Analysis', 'Customer Analysis', 'Annual Performance',
    ]);
  });

  it('shows only the selected cost centre view', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[3].click();
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

  it('exports the verified expense page with its own name, scope, and portrait charts', async () => {
    const finance = { months: [{ key: '202601', label: 'Jan 2026', sales: 0, income: 0, expenses: 30.10, netProfit: -30.10, margin: 0 }],
      incomeAccounts: [], expenseAccounts: [{ id: '55', name: 'Office Rent', amount: 30.10, months: [30.10] }], centers: [],
      sales: 0, income: 0, expenses: 30.10, netProfit: -30.10, margin: 0, averageMonthlySales: 0, periodLabel: '' };
    const source = TestBed.inject(ExpenseReportService);
    vi.spyOn(source, 'getReport').mockReturnValue(of({ finance,
      periods: [{ fromDate: '2026-01-01', toDate: '2026-01-31', monthKeys: ['202601'] }], centerNames: ['G.S.E'], receivedAt: new Date() }));
    const download = vi.spyOn(TestBed.inject(ReportPdfService), 'download').mockResolvedValue();
    const fixture = TestBed.createComponent(App);
    TestBed.inject(HttpTestingController).expectOne('/api/session/status').flush({ hasCookie: true, automatic: true });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelectorAll<HTMLButtonElement>('.sidebar .nav-button')[1].click(); fixture.detectChanges();
    expect(element.querySelector('.title')?.textContent).toBe('تحليل المصروفات');
    expect(element.querySelector<HTMLButtonElement>('.export-btn')!.disabled).toBe(true);
    element.querySelector<HTMLButtonElement>('app-expense-overview .filter-run')!.click(); fixture.detectChanges();
    expect(element.querySelector<HTMLButtonElement>('.export-btn')!.disabled).toBe(false);
    element.querySelector<HTMLButtonElement>('.export-btn')!.click(); await fixture.whenStable();
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ title: 'تحليل المصروفات', portrait: true,
      fileName: expect.stringContaining('Expense-Analysis-report-'), period: expect.stringContaining('2026-01-31') }));
    expect(download.mock.calls[0][0].period).toContain('G.S.E');
  });

  it('loads expenses for the selected year and exports the replacement page without service sales', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const button = [...element.querySelectorAll<HTMLButtonElement>('app-expense-overview .year-strip button')]
      .find((item) => item.textContent?.trim() === '2025')!;
    button.click();
    const requests = flushProfitLoss(http, '2025');
    const payload = JSON.parse(new URLSearchParams(requests.accounts.request.body).get('arrSearchValueAjxKey')!);
    expect([payload.datFromMonthAjxKey, payload.intFromYearAjxKey, payload.datToMonthAjxKey, payload.intToYearAjxKey])
      .toEqual(['1', '2025', '12', '2025']);
    fixture.detectChanges();
    expect(element.querySelector('.expense-kpi.primary strong')?.textContent?.trim()).toBe('30.10');
    expect(element.querySelectorAll('.expense-kpi')).toHaveLength(4);
    expect(element.querySelectorAll('.expense-month-card')).toHaveLength(12);
    expect(element.querySelector('#expense-account-details')?.textContent).toContain('Rent Expense');
    expect(element.querySelector('app-monthly-sales-overview')).toBeNull();
    expect(element.querySelector('#monthly-revenue')).toBeNull();
    const download = vi.spyOn(TestBed.inject(ReportPdfService), 'download').mockResolvedValue(undefined);
    element.querySelector<HTMLButtonElement>('.export-btn')!.click();
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ title: 'تحليل المصروفات', portrait: true, language: 'ar' }));
    http.verify();
  });

  it('prevents concurrent exports and allows retry after a failed PDF download', async () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('.year-strip button')!.click();
    flushProfitLoss(http, '2021');
    fixture.detectChanges();
    let rejectExport!: (reason: unknown) => void;
    const download = vi.spyOn(TestBed.inject(ReportPdfService), 'download').mockReturnValue(new Promise((_resolve, reject) => rejectExport = reject));
    const button = element.querySelector<HTMLButtonElement>('.export-btn')!;
    button.click(); button.click();
    fixture.detectChanges();
    expect(download).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(true);
    rejectExport(new Error('Failed to render'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('.pdf-status.error')).not.toBeNull();
    expect(button.disabled).toBe(false);
    http.verify();
  });

  it('keeps the accounting basis fixed rather than offering unsupported filters', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('#expense-date-type')).toBeNull();
    expect(element.querySelector('#expense-currency')).toBeNull();
    element.querySelector<HTMLButtonElement>('app-expense-overview .filter-run')!.click();
    const requests = flushProfitLoss(http, String(new Date().getFullYear()));
    fixture.detectChanges();
    const centerPayload = JSON.parse(new URLSearchParams(requests.centers.request.body).get('arrSearchValueAjxKey')!);
    expect(centerPayload.strBaseAjxKey).toBe('Base');
    expect(element.querySelector('.expense-summary')?.textContent).toContain('30.10');
    http.verify();
  });

  it('allows the first report while automatic authentication is still connecting', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    const session = http.expectOne('/api/session/status');
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.auth-status')?.textContent).toContain('جاري الاتصال تلقائيًا');
    element.querySelector<HTMLButtonElement>('app-expense-overview .filter-run')!.click();
    flushProfitLoss(http, String(new Date().getFullYear()));
    session.flush({ hasCookie: true, automatic: true, loginUrl: '' });
    fixture.detectChanges();
    expect(element.querySelector('.expense-summary')?.textContent).toContain('30.10');
    expect(element.querySelector('.auth-panel.ready')).not.toBeNull();
    expect(element.querySelectorAll('.auth-actions button')).toHaveLength(1);
    http.verify();
  });

  it('retains the manual login fallback only when the server disables automatic login', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: false, automatic: false, loginUrl: '/login' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.auth-actions button')).toHaveLength(2);
    expect(element.querySelector('.auth-actions')?.textContent).toContain('فتح تسجيل دخول');
    http.verify();
  });

  it('moves the unchanged financial year comparison to the comprehensive dashboard and exports it in landscape', async () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-expense-overview')).not.toBeNull();
    expect(element.querySelector('.report-view-switch')).toBeNull();
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[0].click(); fixture.detectChanges();
    expect(element.querySelector('app-executive-performance')).not.toBeNull();
    element.querySelectorAll<HTMLButtonElement>('.report-view-switch button')[1].click();
    fixture.detectChanges();
    expect(element.querySelector('.title')?.textContent).toBe('لوحة الأداء الشاملة');
    expect(element.querySelector('app-executive-performance')).toBeNull();
    expect(element.querySelector('app-monthly-sales-overview')).toBeNull();
    expect(element.querySelector('.app.executive-mode')).toBeNull();
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
    expect(element.querySelectorAll('.comparison-chart')).toHaveLength(1);
    expect(element.querySelectorAll('.financial-metric-group')).toHaveLength(4);
    expect(element.querySelectorAll('.financial-metric-group:first-child .comparison-year')).toHaveLength(2);
    expect(element.querySelector<HTMLButtonElement>('.export-btn')?.disabled).toBe(false);
    const download = vi.spyOn(TestBed.inject(ReportPdfService), 'download').mockResolvedValue();
    element.querySelector<HTMLButtonElement>('.export-btn')!.click(); await fixture.whenStable();
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ title: 'لوحة الأداء الشاملة · مقارنة السنوات', portrait: false,
      fileName: expect.stringContaining('executive-comparison-') }));
    const fromMonth = element.querySelector<HTMLSelectElement>('select[name=comparisonMonthFrom]')!;
    const toMonth = element.querySelector<HTMLSelectElement>('select[name=comparisonMonthTo]')!;
    fromMonth.value = '3'; fromMonth.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges(); await fixture.whenStable();
    toMonth.value = '9'; toMonth.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(element.querySelector<HTMLButtonElement>('.export-btn')!.disabled).toBe(true);
    element.querySelector<HTMLButtonElement>('app-monthly-year-comparison .apply')!.click();
    const scopedAccounts = http.match('/api/reports/finance/profit-loss/monthly-accounts');
    const scopedCenters = http.match('/api/reports/finance/profit-loss/monthly-centers');
    expect(scopedAccounts).toHaveLength(2);
    for (let index = 0; index < 2; index++) {
      const payload = JSON.parse(new URLSearchParams(scopedAccounts[index].request.body).get('arrSearchValueAjxKey')!);
      expect([payload.datFromMonthAjxKey, payload.datToMonthAjxKey]).toEqual(['3','9']);
      const data = profitLossFixture(String(currentYear - 1 + index));
      scopedAccounts[index].flush(data.accounts); scopedCenters[index].flush(data.centers);
    }
    fixture.detectChanges();
    element.querySelectorAll<HTMLButtonElement>('.report-view-switch button')[0].click(); fixture.detectChanges();
    expect(element.querySelector('app-monthly-year-comparison')).toBeNull();
    expect(element.querySelector('app-executive-performance')).not.toBeNull();
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[1].click(); fixture.detectChanges();
    expect(element.querySelector('app-expense-overview')).not.toBeNull();
    expect(element.querySelector('.report-view-switch')).toBeNull();
    expect(element.querySelector('app-monthly-year-comparison')).toBeNull();
    http.verify();
  });

  it('loads a selected DSR year immediately and renders the new overview', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[2].click();
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
    const remaining = http.expectOne('/api/reports/sales/dsr-tickets');
    expect(new URLSearchParams(remaining.request.body).get('intOffsetAjxKey')).toBe('2');
    remaining.flush(JSON.stringify({
      arrDsrTicketsPhpKey: [{
        datDatePhpKey: '15/01/2025', strDocumentNoPhpKey: 'D-3', strServiceName: 'Cabin Revenue',
        strCustomerNamePhpKey: 'Customer C', dblSellingAmtPhpKey: 50, dblProfitAmtPhpKey: 30,
      }],
      arrDsrDetailsCountPhpKey: { intDsrDetailTicketCountPhpKey: 3 },
      intDsrDetailsTicketOffSetPhpKey: 2,
    }));
    fixture.detectChanges();
    expect(element.querySelector('.metric.revenue strong')?.textContent?.trim()).toBe('250');
    expect(element.querySelector('.metric.net strong')?.textContent?.trim()).toBe('150');
    expect(element.querySelector('.metric.expense strong')?.textContent?.trim()).toBe('3');
    expect(element.querySelectorAll('#dsr-customers .customer-rank-row')).toHaveLength(3);
    expect(element.querySelector('#dsr-customer-detail')?.textContent).toContain('Cabin Revenue');
    expect(element.querySelectorAll('#dsr-trend .customer-period-row')).toHaveLength(1);
    expect(element.querySelectorAll('#dsr-trend .customer-heat-table tbody tr')).toHaveLength(3);
    expect(element.querySelector('.customer-data-note')).toBeNull();
    http.verify();
  });

  it('shows only DSR year comparison and queries the same date window for each year', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[2].click();
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
    const remaining = http.match('/api/reports/sales/dsr-tickets');
    expect(remaining).toHaveLength(2);
    for (const request of remaining) {
      expect(new URLSearchParams(request.request.body).get('intOffsetAjxKey')).toBe('1');
      request.flush(JSON.stringify({
        arrDsrTicketsPhpKey: [{
          datDatePhpKey: '16/01/2026', strDocumentNoPhpKey: 'D-2',
          dblSellingAmtPhpKey: 75, dblProfitAmtPhpKey: 50,
        }],
        arrDsrDetailsCountPhpKey: { intDsrDetailTicketCountPhpKey: 2 },
        intDsrDetailsTicketOffSetPhpKey: 1,
      }));
    }
    fixture.detectChanges();
    expect(element.querySelectorAll('app-dsr-year-comparison .comparison-chart')).toHaveLength(1);
    expect(element.querySelectorAll('app-dsr-year-comparison .financial-metric-group')).toHaveLength(3);
    expect(element.querySelectorAll('app-dsr-year-comparison .customer-year-count')).toHaveLength(2);
    expect(element.querySelector('.comparison-data-note')).toBeNull();
    expect(element.querySelectorAll('app-dsr-year-comparison .financial-metric-group:first-child .comparison-year')).toHaveLength(2);
    expect(element.querySelector<HTMLButtonElement>('.export-btn')?.disabled).toBe(false);
    http.verify();
  });

  it('does not present summary-only DSR totals as customer analysis', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/session/status').flush({ hasCookie: true, loginUrl: '' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[2].click();
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
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[3].click();
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
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[3].click();
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
    element.querySelectorAll<HTMLButtonElement>('.nav-button')[3].click();
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
