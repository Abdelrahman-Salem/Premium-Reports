import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ExecutivePerformanceService } from '../core/services/executive-performance.service';
import { DsrReportService } from '../core/services/dsr-report.service';
import { ExecutiveReport } from '../models/executive-performance.models';
import { ExecutivePerformance } from './executive-performance';
import { contributionFinanceFixture } from './testing/service-contribution.fixture';

describe('ExecutivePerformance service deductions chart', () => {
  let fixture: ComponentFixture<ExecutivePerformance>, element: HTMLElement, report: ExecutiveReport;
  beforeEach(async () => {
    const source = { getReport: vi.fn() };
    await TestBed.configureTestingModule({ imports:[ExecutivePerformance],providers:[provideHttpClient(),{ provide:ExecutivePerformanceService,useValue:source }] }).compileComponents();
    report = { finance:contributionFinanceFixture(), customers:TestBed.inject(DsrReportService).toCustomerDashboardView({ arrDsrTicketsPhpKey:[] }),
      periods:[{ fromDate:'2026-01-01',toDate:'2026-11-30',monthKeys:contributionFinanceFixture().months.map((m) => m.key) }],
      centerNames:['Selected centres'],receivedAt:new Date('2026-11-21T16:18:20Z') };
    source.getReport.mockReturnValue(of(report));
    fixture = TestBed.createComponent(ExecutivePerformance);
    fixture.componentRef.setInput('options',[{id:'1',label:'Head Quarter'},{id:'73',label:'Jeddah'},{id:'74',label:'Maintenance'},{id:'75',label:'G.S.E'},{id:'77',label:'Medina'}]);
    fixture.componentRef.setInput('automaticLogin',true);fixture.detectChanges();element = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('.filter-run')!.click();fixture.detectChanges();
  });

  it('adds the chart immediately below the original and leaves headline financial figures unchanged', () => {
    const chart = element.querySelector('#service-income-after-expenses')!;
    expect(chart.previousElementSibling?.textContent).toContain('مساهمة فئات الخدمات في الإيراد المحاسبي');
    expect(element.querySelectorAll('.service-share-list .service-income-amount')).toHaveLength(7);
    expect(element.querySelector('.service-share-list .service-income-amount')?.textContent).toContain('4,692,018.56');
    expect(element.querySelector('.service-share-list .service-income-share')?.textContent).toContain('38.7%');
    expect(chart.querySelectorAll('.adjusted-service-row')).toHaveLength(7);
    expect(chart.querySelectorAll('.adjusted-service-summary strong')[0].textContent).toContain('12,139,732.84');
    expect(chart.querySelectorAll('.adjusted-service-summary strong')[1].textContent).toContain('3,133,062.97');
    expect(chart.querySelectorAll('.adjusted-service-summary strong')[2].textContent).toContain('9,006,669.87');
    expect(chart.querySelectorAll('.adjusted-service-summary > div')).toHaveLength(6);
    expect(chart.querySelector('.remaining-expenses strong')?.textContent).toContain('6,794,463.93');
    expect(chart.querySelector('.final-net-profit strong')?.textContent).toContain('2,212,205.94');
    expect(chart.querySelector('.adjusted-service-basis')?.textContent).toContain('الإيراد المحاسبي الأصلي');
    expect(element.querySelectorAll('.overview-sheet .reference-kpis strong')[1].textContent).toContain('12,139,733');
    expect(element.querySelectorAll('.overview-sheet .reference-kpis strong')[2].textContent).toContain('2,212,206');
    expect(report.finance.income).toBeCloseTo(12139732.84,2);
  });

  it('shows negative contributions, exact assigned deductions and English labels', () => {
    const nitrogen = element.querySelector<HTMLElement>('[data-service-id="9960"]')!;
    expect(nitrogen.classList.contains('loss')).toBe(true);
    expect(nitrogen.querySelector('.adjusted-service-amount')?.textContent).toContain('-36,865.35');
    expect(nitrogen.querySelector('.adjusted-service-share')?.textContent).toContain('-0.3%');
    expect(parseFloat(nitrogen.querySelector<HTMLElement>('i')!.style.left)).toBeCloseTo(0,10);
    const driver = element.querySelector('[data-service-id="9959"]')!;
    expect(driver.querySelectorAll('.adjusted-service-label > small')).toHaveLength(2);
    expect(driver.textContent).toContain('45,811.14'); expect(driver.textContent).toContain('7,204.53');
    fixture.componentRef.setInput('language','en');fixture.detectChanges();
    expect(element.querySelector('#service-income-after-expenses h2')?.textContent).toBe('Service Contribution after Specified Expenses');
  });

  it('removes the derived chart as soon as period filters clear the verified source report', async () => {
    await fixture.whenStable();
    const from = element.querySelector<HTMLInputElement>('#executive-from')!;
    from.value = '2026-02';from.dispatchEvent(new Event('input',{bubbles:true}));fixture.detectChanges();
    await fixture.whenStable();fixture.detectChanges();
    expect(element.querySelector('#service-income-after-expenses')).toBeNull();
    expect(fixture.componentInstance.printReady()).toBe(false);
  });

  it('updates service percentages immediately when the basis buttons switch without refetching or changing profit', () => {
    const chart = element.querySelector('#service-income-after-expenses')!;
    const before = chart.querySelector<HTMLButtonElement>('[data-basis=before]')!;
    const after = chart.querySelector<HTMLButtonElement>('[data-basis=after]')!;
    const totals = [...chart.querySelectorAll('.adjusted-service-summary strong')].map((item) => item.textContent);
    expect(before.getAttribute('aria-pressed')).toBe('true');
    expect(chart.querySelector('.adjusted-service-share')?.textContent).toContain('31.04%');
    after.click();fixture.detectChanges();
    expect(after.getAttribute('aria-pressed')).toBe('true');
    expect(before.getAttribute('aria-pressed')).toBe('false');
    expect(chart.querySelector('.adjusted-service-share')?.textContent).toContain('41.83%');
    expect(chart.querySelector('.adjusted-service-basis')?.textContent).toContain('9,006,669.87');
    expect([...chart.querySelectorAll('.adjusted-service-summary strong')].map((item) => item.textContent)).toEqual(totals);
    before.click();fixture.detectChanges();
    expect(chart.querySelector('.adjusted-service-share')?.textContent).toContain('31.04%');
    expect(TestBed.inject(ExecutivePerformanceService).getReport).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.printReady()).toBe(true);
  });
});
