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
    for (const [year, amount] of [[2025, 125], [2024, 75]]) {
      const button = [...element.querySelectorAll<HTMLButtonElement>('.year-strip button')]
        .find(item => item.textContent?.trim() === String(year))!;
      button.click();
      const request = http.expectOne('/api/reports/finance/cost-centre-periodical');
      const payload = JSON.parse(new URLSearchParams(request.request.body).get('arrSearchValueAjxKey')!);
      expect(payload.datFromAjxKey).toBe(`01/01/${year}`);
      expect(payload.datToAjxKey).toBe(`31/12/${year}`);
      request.flush(JSON.stringify({
        arrCostCentersPhpKey: [{ pk_bint_cost_center_id: 73, vchr_cost_center_name: '808 - AirPort Jeddah' }],
        arrCostCenterWiseDetailsPhpKey: [{
          bint_category: 3, vchr_account_name: 'Revenue', dbl_base_currency_debit_credt73: amount,
        }],
      }));
      fixture.detectChanges();
      expect(element.querySelector('.report-heading')?.textContent).toContain(`${year}-01-01 - ${year}-12-31`);
      expect(element.querySelector('.metric.revenue strong')?.textContent?.trim()).toBe(String(amount));
    }
    http.verify();
  });
});
