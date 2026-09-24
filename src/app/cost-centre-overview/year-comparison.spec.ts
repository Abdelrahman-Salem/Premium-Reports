import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { YearComparison } from './year-comparison';
import { CostCentrePeriodicalFilters } from '../models/dsr-report.models';

describe('YearComparison', () => {
  const filters: CostCentrePeriodicalFilters = {
    fromDate: '2026-01-01',
    toDate: '2026-09-16',
    costCenterId: '73',
    costCenterName: '808 - AirPort Jeddah',
    departmentId: '1',
    departmentName: 'Default',
  };
  const response = (revenue: number, expense: number) => ({
    arrCostCentersPhpKey: [
      { pk_bint_cost_center_id: 73, vchr_cost_center_name: '808 - AirPort Jeddah' },
    ],
    arrCostCenterWiseDetailsPhpKey: [
      { bint_category: 3, vchr_account_name: 'Revenue', dbl_base_currency_debit_credt73: revenue },
      { bint_category: 4, vchr_account_name: 'Expense', dbl_base_currency_debit_credt73: expense },
    ],
  });

  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [YearComparison],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function render(input = filters) {
    const fixture = TestBed.createComponent(YearComparison);
    fixture.componentRef.setInput('filters', input);
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.comparison-toggle').click();
    fixture.detectChanges();
    return fixture;
  }
  function submit(fixture: ReturnType<typeof render>) {
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    return TestBed.inject(HttpTestingController).match(
      '/api/reports/finance/cost-centre-periodical',
    );
  }
  function payload(request: ReturnType<typeof submit>[number]) {
    return JSON.parse(new URLSearchParams(request.request.body).get('arrSearchValueAjxKey')!);
  }

  it('fetches each year for the same period and centre, with signed bars on one scale', () => {
    const fixture = render();
    const requests = submit(fixture);
    expect(requests).toHaveLength(2);
    expect(payload(requests[0]).datFromAjxKey).toBe('01/01/2025');
    expect(payload(requests[1]).datToAjxKey).toBe('16/09/2026');
    expect(payload(requests[0]).intCostCenterAjxKey).toBe('73');
    expect(requests.every((request) => request.request.withCredentials)).toBe(true);
    requests[1].flush(response(200, 50));
    requests[0].flush(response(100, 150));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(
      [...element.querySelectorAll('.year-label')].map((label) => label.textContent?.trim()),
    ).toEqual(['2025', '2026']);
    const negative = element.querySelector<HTMLElement>('.bar.negative')!;
    expect(parseFloat(negative.style.top)).toBe(80);
    expect(parseFloat(negative.style.height)).toBe(20);
    expect(negative.textContent).toContain('-50');
    expect(element.querySelectorAll('.bar')).toHaveLength(6);
  });

  it('does not represent a failed year as zero or discard a successful year', () => {
    const fixture = render();
    const requests = submit(fixture);
    requests[0].flush('Session expired', { status: 401, statusText: 'Unauthorized' });
    requests[1].flush(response(0, 0));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.year-group')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.unavailable').textContent).toContain(
      'could not be loaded',
    );
    expect(fixture.nativeElement.querySelector('.year-label').textContent).toContain('2026');
    expect(fixture.nativeElement.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('keeps missing report data distinct from a zero balance', () => {
    const fixture = render();
    const requests = submit(fixture);
    requests[0].flush({ arrCostCenterWiseDetailsPhpKey: [] });
    requests[1].flush(response(0, 0));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.year-group')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.unavailable').textContent).toContain('No data');
  });

  it('clamps February 29 to February 28 in a non-leap comparison year', () => {
    const fixture = render({ ...filters, fromDate: '2024-02-29', toDate: '2024-03-31' });
    const requests = submit(fixture);
    expect(payload(requests[0]).datFromAjxKey).toBe('28/02/2023');
    expect(payload(requests[1]).datFromAjxKey).toBe('29/02/2024');
    requests.forEach((request) => request.flush(response(1, 0)));
  });

  it('allows full-year comparison for a cross-year filter and cancels requests when filters change', () => {
    const fixture = render({ ...filters, fromDate: '2025-10-01', toDate: '2026-03-31' });
    expect(fixture.nativeElement.querySelector('.compare-submit').disabled).toBe(true);
    fixture.nativeElement.querySelector('input[value="full"]').click();
    fixture.detectChanges();
    const requests = submit(fixture);
    expect(payload(requests[0]).datFromAjxKey).toBe('01/01/2024');
    expect(payload(requests[0]).datToAjxKey).toBe('31/12/2024');
    fixture.componentRef.setInput('filters', { ...filters, costCenterId: '' });
    fixture.detectChanges();
    expect(requests.every((request) => request.cancelled)).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.year-group')).toHaveLength(0);
  });
});
