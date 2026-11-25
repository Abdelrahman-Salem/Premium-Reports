import { FinancialReport } from './executive-performance.models';
import { EXPENSE_GROUPS, expenseDashboard, expenseGroupId, expenseShare } from './expense-report.models';
import { ProfitLossAccount } from './profit-loss.models';
import { referenceExpenseAccounts, referenceMonthKeys } from '../expense-overview/testing/expense-reference.fixture';

export function expenseFixture(accounts = referenceExpenseAccounts(), keys = referenceMonthKeys): FinancialReport {
  const months = keys.map((key, i) => ({ key, label: key, sales: 0, income: 0, expenses: accounts.reduce((sum,a) => sum + a.months[i],0), netProfit: 0, margin: 0 }));
  return { finance: { months, incomeAccounts: [], expenseAccounts: accounts, centers: [], sales: 0, income: 0,
    expenses: accounts.reduce((sum,a) => sum + a.amount,0), netProfit: 0, margin: 0, averageMonthlySales: 0, periodLabel: '' },
    periods: [{ fromDate: '2026-01-01', toDate: '2026-11-30', monthKeys: keys }], centerNames: ['Selected centre'], receivedAt: new Date('2026-11-21T16:18:20Z') };
}

describe('Expense calculations', () => {
  it('reproduces the supplied monthly report using all 76 ledgers and 11 months', () => {
    const view = expenseDashboard(expenseFixture(), { groupId: '', accountId: '' });
    expect(view.accounts).toHaveLength(76);
    expect(view.groups).toHaveLength(11);
    expect(view.unclassifiedCount).toBe(0);
    expect(view.total).toBeCloseTo(9927526.90, 2);
    expect(view.average).toBeCloseTo(9927526.90 / 11, 2);
    expect(view.months.map((m) => Number(m.amount.toFixed(2)))).toEqual([
      1034251.12,354742.57,1521534.56,1059413.49,795002.20,1310506.35,806733.79,1049783.15,907092.11,853688.61,234778.95,
    ]);
    expect(view.topMonths.map((m) => m.id)).toEqual(['202603','202606','202604','202608','202601']);
    expect(view.topAccounts.map((a) => Number(a.value.toFixed(2)))).toEqual([2734994.79,1925215.11,924400,465000,423944.33]);
    expect(view.months.at(-1)!.topAccounts.map((a) => a.id)).toEqual(['659','1090','62','55','644']);
  });

  it('classifies each reference ledger once and uses current balances instead of PDF totals', () => {
    const ids = EXPENSE_GROUPS.flatMap((g) => g.accountIds);
    expect(ids.length).toBe(new Set(ids).size);
    const view = expenseDashboard(expenseFixture(), { groupId: '', accountId: '' });
    expect(view.groups.reduce((sum,g) => sum + g.amount,0)).toBeCloseTo(view.total, 2);
    expect(view.groups.find((g) => g.id === 'staff')!.amount).toBeCloseTo(5633158.09, 2);
    expect(view.groups.find((g) => g.id === 'fuel')!.amount).toBeCloseTo(2908771.11, 2);
    expect(view.groups.find((g) => g.id === 'premises')!.amount).toBeCloseTo(545072.40, 2);
    expect(view.groups.flatMap((g) => g.accounts)).toHaveLength(76);
  });

  it('keeps negative adjustments signed and calculates detail shares against the complete total', () => {
    const view = expenseDashboard(expenseFixture(), { groupId: '', accountId: '' });
    const fine = view.accounts.find((a) => a.id === '666')!;
    expect(fine.amount).toBe(-2544);
    expect(expenseShare(fine.amount, view.total)).toBeLessThan(0);
    expect(view.groups.find((g) => g.id === 'government')!.amount).toBeCloseTo(21015.78, 2);
    expect(view.topAccounts.some((a) => a.id === '666')).toBe(false);
    expect(view.months.reduce((sum,m) => sum + m.share!,0)).toBeCloseTo(1, 10);
    expect(view.topAccounts[0].ratio).toBeCloseTo(2734994.79 / 9927526.90, 10);
  });

  it('recalculates all account and monthly views for group/account selection without changing source data', () => {
    const source = expenseFixture();
    const staff = expenseDashboard(source, { groupId: 'staff', accountId: '' });
    expect(staff.groups).toHaveLength(1);
    expect(staff.total).toBeCloseTo(5633158.09, 2);
    expect(staff.months.reduce((sum,m) => sum + m.amount,0)).toBeCloseTo(staff.total, 2);
    const salary = expenseDashboard(source, { groupId: 'staff', accountId: '49' });
    expect(salary.accounts).toHaveLength(1);
    expect(salary.total).toBeCloseTo(2734994.79, 2);
    expect(salary.topAccounts[0].ratio).toBe(1);
    expect(source.finance.expenseAccounts).toHaveLength(76);
    expect(source.finance.expenses).toBeCloseTo(9927526.90, 2);
  });

  it('includes unknown accounts and zero months, and never substitutes absolute values or invalid percentages', () => {
    const accounts: ProfitLossAccount[] = [
      { id: '49', name: 'Salary', amount: 100, months: [100,0] },
      { id: 'new-ledger', name: 'New expense', amount: -120, months: [-120,0] },
    ];
    const view = expenseDashboard(expenseFixture(accounts, ['202601','202607']), { groupId: '', accountId: '' });
    expect(expenseGroupId('new-ledger')).toBe('unclassified');
    expect(view.unclassifiedCount).toBe(1);
    expect(view.groups.find((g) => g.id === 'unclassified')!.amount).toBe(-120);
    expect(view.total).toBe(-20);
    expect(view.average).toBe(-10);
    expect(view.months.map((m) => m.amount)).toEqual([-20,0]);
    expect(view.months.every((m) => m.share === null)).toBe(true);
    expect(expenseShare(0,0)).toBeNull();
  });
});
