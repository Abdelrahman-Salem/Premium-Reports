import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DsrReportService } from '../core/services/dsr-report.service';
import {
  CostCentrePeriodicalFilters,
  CostCentrePeriodicalResponse,
} from '../models/dsr-report.models';
import { CostCentreOverview } from './cost-centre-overview';

describe('CostCentreOverview', () => {
  const filters: CostCentrePeriodicalFilters = {
    fromDate: '2026-01-01',
    toDate: '2026-09-16',
    costCenterId: '',
    costCenterName: 'ALL',
    departmentId: '1',
    departmentName: 'Default',
  };
  const response: CostCentrePeriodicalResponse = {
    arrCostCentersPhpKey: [
      { pk_bint_cost_center_id: 1, vchr_cost_center_name: '100 - Head Quarter' },
      { pk_bint_cost_center_id: 73, vchr_cost_center_name: '808 - AirPort Jeddah' },
      { pk_bint_cost_center_id: 75, vchr_cost_center_name: '810 - G.S.E' },
    ],
    arrCostCenterWiseDetailsPhpKey: [
      ...Array.from({ length: 10 }, (_, index) => ({
        bint_category: 3,
        vchr_account_code: `R${index}`,
        vchr_account_name: `Revenue ${index}`,
        dbl_base_currency_debit_credt73: 100,
        dbl_base_currency_debit_credt75: 50,
      })),
      {
        bint_category: 4,
        vchr_account_name: 'Salary Expenses',
        dbl_base_currency_debit_credt1: 300,
      },
      {
        bint_category: 4,
        vchr_account_name: 'Expense correction',
        dbl_base_currency_debit_credt73: -50,
      },
    ],
  };

  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [CostCentreOverview],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  function render(source = response) {
    const fixture = TestBed.createComponent(CostCentreOverview);
    fixture.componentRef.setInput('filters', filters);
    fixture.componentRef.setInput('options', []);
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput(
      'data',
      TestBed.inject(DsrReportService).toCostCentrePeriodicalDashboardView(source, filters),
    );
    fixture.detectChanges();
    return fixture;
  }

  it('shows all revenue accounts and retains merged centres and admin overhead', () => {
    const fixture = render();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.distribution .legend-list > div')).toHaveLength(10);
    expect(element.querySelectorAll('.comparison-row')).toHaveLength(2);
    expect(element.querySelector('.comparison')?.textContent).toContain(
      '808 - AirPort Jeddah + 810 - G.S.E',
    );
    expect(element.querySelector('.comparison')?.textContent).toContain('Admin / non-operating');
    expect(element.querySelector('.metric.net strong')?.textContent?.trim()).toBe('1,250');
  });

  it('sizes expense tiles by absolute balance while displaying signed amounts', () => {
    const fixture = render();
    const tiles = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.tile'),
    ];
    const areas = tiles.map((tile) => parseFloat(tile.style.width) * parseFloat(tile.style.height));
    expect(areas.reduce((sum, area) => sum + area, 0)).toBeCloseTo(10000);
    expect(areas[0] / areas[1]).toBeCloseTo(6);
    expect(fixture.nativeElement.querySelector('.expense-legend').textContent).toContain('-50');
  });

  it('groups charts into three sections and distinguishes losses from undefined margins', () => {
    const fixture = render({
      ...response,
      arrCostCenterWiseDetailsPhpKey: [
        ...response.arrCostCenterWiseDetailsPhpKey!,
        { bint_category: 4, vchr_account_name: 'Operating costs', dbl_base_currency_debit_credt73: 4000 },
      ],
    });
    const element: HTMLElement = fixture.nativeElement;
    expect([...element.querySelectorAll('.analysis-section')].map(section => section.id))
      .toEqual(['cost-revenue', 'cost-profit', 'cost-expense']);
    expect(element.querySelectorAll('#cost-revenue .chart')).toHaveLength(3);
    expect(element.querySelectorAll('#cost-profit .chart')).toHaveLength(3);
    expect(element.querySelectorAll('#cost-expense .chart')).toHaveLength(3);
    const losses = [...element.querySelectorAll<HTMLElement>('.net-chart .signed-track i')];
    expect(losses).toHaveLength(2);
    for (const loss of losses) {
      expect(loss.classList.contains('loss-key')).toBe(true);
      expect(parseFloat(loss.style.left)).toBeLessThan(50);
      expect(parseFloat(loss.style.left) + parseFloat(loss.style.width)).toBeCloseTo(50);
    }
    const marginRows = element.querySelectorAll('.margin-chart .signed-row');
    expect(marginRows[0].querySelector('strong')?.textContent).toContain('-163.3%');
    expect(marginRows[1].querySelector('.signed-track')).toBeNull();
    expect(marginRows[1].textContent).toContain('Margin unavailable');
    expect(element.querySelectorAll('.expense-account-bars .account-bar')).toHaveLength(3);
  });

  it('changes quarter boundaries without replacing the loaded report period', () => {
    const fixture = render();
    let next: CostCentrePeriodicalFilters | undefined;
    fixture.componentInstance.filtersChange.subscribe((value) => (next = value));
    fixture.nativeElement.querySelectorAll('.quarters input')[1].click();
    expect(next?.fromDate).toBe('2026-04-01');
    expect(next?.toDate).toBe('2026-06-30');
    fixture.componentRef.setInput('filters', next);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.report-heading').textContent).toContain(
      '2026-01-01 - 2026-09-16',
    );
  });

  it('blocks invalid dates and renders zero data without invalid chart styles', () => {
    const fixture = render({
      arrCostCentersPhpKey: response.arrCostCentersPhpKey,
      arrCostCenterWiseDetailsPhpKey: [],
    });
    fixture.componentRef.setInput('filters', { ...filters, fromDate: '2026-10-01' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.apply').disabled).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.tile')).toHaveLength(0);
    expect(fixture.nativeElement.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});
