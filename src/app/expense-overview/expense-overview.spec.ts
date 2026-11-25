import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ExpenseReportService } from '../core/services/expense-report.service';
import { FinancialReport } from '../models/executive-performance.models';
import { referenceExpenseAccounts, referenceMonthKeys } from './testing/expense-reference.fixture';
import { ExpenseOverview } from './expense-overview';

function referenceReport(): FinancialReport {
  const accounts = referenceExpenseAccounts();
  return { finance: { months: referenceMonthKeys.map((key,i) => ({ key, label: key, sales: 0, income: 0,
    expenses: accounts.reduce((sum,a) => sum + a.months[i],0), netProfit: 0, margin: 0 })), incomeAccounts: [], expenseAccounts: accounts,
    centers: [], sales: 0, income: 0, expenses: 9927526.90, netProfit: 0, margin: 0, averageMonthlySales: 0, periodLabel: '' },
    periods: [{ fromDate: '2026-01-01', toDate: '2026-11-30', monthKeys: referenceMonthKeys }], centerNames: ['Head Quarter','G.S.E'], receivedAt: new Date('2026-11-21T16:18:20Z') };
}

describe('ExpenseOverview', () => {
  let fixture: ComponentFixture<ExpenseOverview>, element: HTMLElement, result: Subject<FinancialReport>;
  const options = [{ id: '1', label: 'Head Quarter' },{ id: '73', label: 'Jeddah' },{ id: '74', label: 'Maintenance' },{ id: '75', label: 'G.S.E' },{ id: '77', label: 'Medina' }];
  beforeEach(async () => {
    result = new Subject<FinancialReport>();
    await TestBed.configureTestingModule({ imports: [ExpenseOverview], providers: [
      { provide: ExpenseReportService, useValue: { getReport: vi.fn(() => result) } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(ExpenseOverview);
    fixture.componentRef.setInput('options', options); fixture.componentRef.setInput('automaticLogin', true);
    fixture.detectChanges(); element = fixture.nativeElement;
  });
  function load() { element.querySelector<HTMLButtonElement>('.filter-run')!.click(); fixture.detectChanges(); }
  function loaded() { load(); result.next(referenceReport()); fixture.detectChanges(); }
  async function change(selector: string, value: string) {
    await fixture.whenStable(); fixture.detectChanges();
    const input = element.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    input.value = value; input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  }

  it('publishes all charts only after receiving a verified report', () => {
    expect(fixture.componentInstance.printReady()).toBe(false);
    load();
    expect(element.querySelector('.expense-summary')).toBeNull();
    expect(fixture.componentInstance.printReady()).toBe(false);
    result.next(referenceReport()); fixture.detectChanges();
    expect(element.querySelector('.expense-kpi.primary strong')!.textContent!.trim()).toBe('9,927,526.90');
    expect(element.querySelectorAll('.expense-kpi')).toHaveLength(4);
    expect(element.querySelectorAll('.expense-month-card')).toHaveLength(11);
    expect(element.querySelectorAll('.expense-group')).toHaveLength(11);
    expect(element.querySelectorAll('.expense-group .expense-bar-row')).toHaveLength(76);
    expect(element.querySelector('#expense-centres')).not.toBeNull();
    expect(fixture.componentInstance.printReady()).toBe(true);
  });

  it('recalculates group and account views, labels scope, and does not invent an account-to-centre allocation', async () => {
    loaded();
    await change('#expense-group','staff');
    expect(element.querySelector('.expense-kpi.primary strong')!.textContent!.trim()).toBe('5,633,158.09');
    expect(element.querySelector('#expense-centres')).toBeNull();
    expect(element.querySelectorAll('.expense-group')).toHaveLength(1);
    await change('#expense-account','49');
    expect(element.querySelector('.expense-kpi.primary strong')!.textContent!.trim()).toBe('2,734,994.79');
    expect(fixture.componentInstance.periodLabel()).toContain('Salary Expenses');
    expect(fixture.componentInstance.data()!.finance.expenses).toBe(9927526.90);
  });

  it('clears stale reports and cancels pending loads when the financial period changes', async () => {
    loaded();
    load(); expect(result.observers).toHaveLength(1);
    await change('#expense-from','2025-12');
    expect(result.observers).toHaveLength(0);
    result.next(referenceReport()); fixture.detectChanges();
    expect(element.querySelector('.expense-summary')).toBeNull();
    expect(fixture.componentInstance.printReady()).toBe(false);
  });

  it('keeps data/export unavailable when verification fails', () => {
    load(); result.error(new Error('Incomplete response')); fixture.detectChanges();
    expect(element.querySelector('[role=alert]')?.textContent).toContain('تعذر التحقق');
    expect(element.querySelector('.expense-summary')).toBeNull();
    expect(fixture.componentInstance.printReady()).toBe(false);
  });

  it('keeps all group details visible while changing labels without reloading or changing balances', () => {
    loaded(); fixture.componentRef.setInput('language','en'); fixture.detectChanges();
    expect(element.querySelector('h1')?.textContent).toBe('Expense Analysis');
    expect(element.querySelector('#expense-groups')?.textContent).toContain('Staff Cost');
    expect(element.querySelector('.expense-kpi.primary strong')!.textContent!.trim()).toBe('9,927,526.90');
    expect(element.querySelectorAll('.expense-group .expense-group-content')).toHaveLength(11);
    expect(element.querySelectorAll('.expense-group .expense-bar-row')).toHaveLength(76);
    expect(element.querySelector('details.expense-group')).toBeNull();
    expect(element.querySelector('.expand-groups')).toBeNull();
  });
});
