import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

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

  it('should render the monthly dashboard title', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.title')?.textContent).toContain('مبيعات الخدمات الشهرية');
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
    expect(element.querySelector('.export-btn')).toBeNull();
    buttons[0].click();
    fixture.detectChanges();
    expect(element.querySelector('app-cost-centre-overview')).not.toBeNull();
    expect(element.querySelector('app-year-comparison')).toBeNull();
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
