import { contributionFinanceFixture } from '../executive-performance/testing/service-contribution.fixture';
import { ProfitLossAccount } from './profit-loss.models';
import { SERVICE_EXPENSE_ASSIGNMENTS, serviceContributions } from './service-contribution.models';

const account = (id: string, amount: number, name = id): ProfitLossAccount => ({ id, name, amount, months: [amount] });

describe('Service revenue after specified expenses', () => {
  it('deducts the six reference accounts from their assigned services, once each', () => {
    const result = serviceContributions(contributionFinanceFixture());
    expect(result.rows).toHaveLength(7);
    expect(result.income).toBeCloseTo(12139732.84,2);
    expect(result.deducted).toBeCloseTo(3133062.97,2);
    expect(result.total).toBeCloseTo(9006669.87,2);
    expect(result.remainingExpenses).toBeCloseTo(6794463.93,2);
    expect(result.netProfit).toBeCloseTo(2212205.94,2);
    expect(result.total - result.remainingExpenses).toBeCloseTo(result.netProfit,2);
    expect(result.netMargin).toBeCloseTo(result.netProfit / result.income,10);
    const amounts = Object.fromEntries(result.rows.map((row) => [row.id,Number(row.amount.toFixed(2))]));
    expect(amounts).toEqual({ '9962':3767618.56, '9933':3413827.72, '10143':599561.57, '9959':758522.37, '44':469245, '9971':34760, '9960':-36865.35 });
    expect(result.rows.find((row) => row.id === '9959')!.expenses.map((e) => e.id)).toEqual(['644','10160']);
    const ids = SERVICE_EXPENSE_ASSIGNMENTS.flatMap((item) => item.expenseIds);
    expect(ids).toHaveLength(6); expect(new Set(ids).size).toBe(6);
    expect(result.rows.flatMap((row) => row.expenses)).toHaveLength(6);
  });

  it('keeps negative contributions and compares percentages against the same original income', () => {
    const result = serviceContributions(contributionFinanceFixture());
    const nitrogen = result.rows.find((row) => row.id === '9960')!;
    expect(nitrogen.amount).toBeCloseTo(-36865.35,2);
    expect(nitrogen.share).toBeCloseTo(-36865.35 / 12139732.84,10);
    expect(result.rows.find((row) => row.id === '9962')!.share).toBeCloseTo(3767618.56 / 12139732.84,10);
    expect(result.rows.reduce((sum,row) => sum + row.share!,0)).toBeCloseTo(result.total / result.income,10);
    for (const row of result.rows) expect(row.share!).toBeLessThanOrEqual(row.income / result.income);
  });

  it('leaves Headset/Other intact, excludes IDE variants and preserves the original P&L and service order', () => {
    const finance = contributionFinanceFixture();
    const original = structuredClone(finance);
    const result = serviceContributions(finance);
    expect(result.rows.map((row) => row.id)).toEqual(finance.incomeAccounts.map((row) => row.id));
    expect(result.rows.find((row) => row.id === '44')!.deducted).toBe(0);
    expect(result.rows.find((row) => row.id === '9971')!.deducted).toBe(0);
    expect(finance.expenseAccounts.find((row) => row.id === '1119')!.amount).toBeGreaterThan(0);
    expect(finance.expenseAccounts.find((row) => row.id === '1120')!.amount).toBeGreaterThan(0);
    expect(result.rows.flatMap((row) => row.expenses.map((e) => e.id))).not.toContain('1119');
    expect(result.rows.flatMap((row) => row.expenses.map((e) => e.id))).not.toContain('1120');
    expect(finance).toEqual(original);
    expect(finance.netProfit).toBeCloseTo(2212205.94,2);
  });

  it('uses ledger identity and does not deduct unrelated accounts with a similar name', () => {
    const finance = contributionFinanceFixture([
      account('9962',1000,'Renamed rent service'), account('future-service',250,'New service'),
    ],[account('659',100,'Renamed expense'),account('unrelated',80,'Brokerage Fees')],['202601']);
    const result = serviceContributions(finance);
    expect(result.deducted).toBe(100);
    expect(result.total).toBe(1150);
    expect(result.rows.find((row) => row.id === 'future-service')!.amount).toBe(250);
  });

  it('shows an assigned expense with no service revenue instead of dropping the negative balance', () => {
    const finance = contributionFinanceFixture([account('44',100)],[account('671',40)],['202601']);
    const result = serviceContributions(finance);
    expect(result.total).toBe(60);
    expect(result.rows.find((row) => row.id === '9960')).toMatchObject({ income: 0, deducted: 40, amount: -40 });
    expect(result.rows.reduce((sum,row) => sum + row.share!,0)).toBeCloseTo(.6,10);
  });

  it('uses only scoped period balances and retains expense credits with their sign', () => {
    const income = { id:'9962',name:'Rent',amount:210,months:[10,20,30,40,50,60] };
    const expense = { id:'659',name:'Brokerage',amount:21,months:[1,2,3,4,5,6] };
    const result = serviceContributions(contributionFinanceFixture([income],[expense],['202601','202602','202603','202607','202608','202609']));
    expect(result.total).toBe(189);
    const credit = serviceContributions(contributionFinanceFixture([account('9962',100)],[account('659',-20)],['202601']));
    expect(credit.deducted).toBe(-20); expect(credit.total).toBe(120);
  });

  it.each([100,120])('retains the original percentage base when expenses of %s make the contribution nonpositive', (expense) => {
    const result = serviceContributions(contributionFinanceFixture([account('9962',100)],[account('659',expense)],['202601']));
    expect(result.total).toBe(100 - expense);
    expect(result.rows[0].share).toBe((100 - expense) / 100);
  });

  it('does not deduct assigned expenses twice when displaying final company profit', () => {
    const finance = contributionFinanceFixture([account('9962',1000)],[account('659',100),account('other-expense',200)],['202601']);
    const result = serviceContributions(finance);
    expect(result.total).toBe(900);
    expect(result.remainingExpenses).toBe(200);
    expect(result.netProfit).toBe(700);
    expect(result.netProfit).toBe(finance.netProfit);
    expect(result.netMargin).toBe(.7);
    expect(result.rows[0].share).toBe(.9);
  });

  it('does not show percentages when original accounting income is zero', () => {
    const result = serviceContributions(contributionFinanceFixture([],[account('671',40)],['202601']));
    expect(result.total).toBe(-40);
    expect(result.netProfit).toBe(-40);
    expect(result.rows[0].share).toBeNull();
    expect(result.netMargin).toBeNull();
  });

  it('switches the service percentage denominator without changing money, profit or accounting margin', () => {
    const finance = contributionFinanceFixture();
    const before = serviceContributions(finance,'before');
    const after = serviceContributions(finance,'after');
    expect(before.percentageBase).toBe(finance.income);
    expect(after.percentageBase).toBe(after.total);
    expect(after.percentageBasis).toBe('after');
    expect(after.rows[0].share).toBeCloseTo(after.rows[0].amount / after.total,10);
    expect(after.rows.reduce((sum,row) => sum + row.share!,0)).toBeCloseTo(1,10);
    expect(before.rows.map(({share,...row}) => row)).toEqual(after.rows.map(({share,...row}) => row));
    for (const key of ['income','deducted','total','remainingExpenses','netProfit','netMargin'] as const) expect(after[key]).toBe(before[key]);
  });

  it('handles nonpositive selected bases and can use a positive after-deduction base even without original income', () => {
    for (const expense of [100,120]) {
      const finance = contributionFinanceFixture([account('9962',100)],[account('659',expense)],['202601']);
      expect(serviceContributions(finance,'before').rows[0].share).not.toBeNull();
      expect(serviceContributions(finance,'after').rows[0].share).toBeNull();
    }
    const credit = contributionFinanceFixture([],[account('659',-20)],['202601']);
    expect(serviceContributions(credit,'before').rows[0].share).toBeNull();
    const after = serviceContributions(credit,'after');
    expect(after.percentageBase).toBe(20);
    expect(after.rows[0].share).toBe(1);
    expect(after.netMargin).toBeNull();
  });
});
