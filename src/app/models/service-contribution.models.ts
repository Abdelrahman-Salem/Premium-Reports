import { ProfitLossAccount, ProfitLossDashboard } from './profit-loss.models';

// The six expense ledgers and their service assignments are specified in the user's reference image.
// Match ledger IDs, not account codes or partial names; IDE ledgers are separate accounts.
export const SERVICE_EXPENSE_ASSIGNMENTS = [
  { incomeId: '9962', name: 'Rent & Port Cabin Revenue', expenseIds: ['659'] },
  { incomeId: '9933', name: 'Equipments Revenues', expenseIds: ['645'] },
  { incomeId: '10143', name: 'Fuel Revenues', expenseIds: ['62'] },
  { incomeId: '9959', name: 'Vehicles & Driver Revenue', expenseIds: ['644', '10160'] },
  { incomeId: '44', name: 'Headset Revenues', expenseIds: [] },
  { incomeId: '9971', name: 'Other Revenue', expenseIds: [] },
  { incomeId: '9960', name: 'Nitrogen & Tyre & Oil & Other Maintenance Revenue', expenseIds: ['671'] },
] as const;

export interface ServiceContributionRow {
  id: string;
  name: string;
  income: number;
  expenses: ProfitLossAccount[];
  deducted: number;
  amount: number;
  share: number | null;
}

export type ContributionPercentageBasis = 'before' | 'after';

export interface ServiceContributions {
  rows: ServiceContributionRow[];
  income: number;
  deducted: number;
  total: number;
  remainingExpenses: number;
  netProfit: number;
  netMargin: number | null;
  percentageBasis: ContributionPercentageBasis;
  percentageBase: number;
}

/** Derived analysis of already verified period/centre balances. Does not change the P&L. */
export function serviceContributions(finance: ProfitLossDashboard, percentageBasis: ContributionPercentageBasis = 'before'): ServiceContributions {
  const expenseMap = new Map(finance.expenseAccounts.map((account) => [account.id, account]));
  const incomeAccounts = [...finance.incomeAccounts];
  for (const assignment of SERVICE_EXPENSE_ASSIGNMENTS) {
    // A selected centre can incur an assigned expense with no revenue for that service.
    if (!incomeAccounts.some((account) => account.id === assignment.incomeId) &&
      assignment.expenseIds.some((id) => (expenseMap.get(id)?.amount ?? 0) !== 0)) {
      incomeAccounts.push({ id: assignment.incomeId, name: assignment.name, amount: 0, months: finance.months.map(() => 0) });
    }
  }
  const rows = incomeAccounts.map((account): ServiceContributionRow => {
    const assignment = SERVICE_EXPENSE_ASSIGNMENTS.find((item) => item.incomeId === account.id);
    const expenses = (assignment?.expenseIds ?? []).flatMap((id) => {
      const expense = expenseMap.get(id);
      return expense ? [expense] : [];
    });
    const deducted = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    return { id: account.id, name: account.name, income: account.amount, expenses, deducted, amount: account.amount - deducted, share: null };
  });
  const deducted = rows.reduce((sum, row) => sum + row.deducted, 0);
  const total = finance.income - deducted;
  const percentageBase = percentageBasis === 'after' ? total : finance.income;
  return {
    rows: rows.map((row) => ({ ...row, share: percentageBase > 0 ? row.amount / percentageBase : null })),
    income: finance.income,
    deducted,
    total,
    remainingExpenses: finance.expenses - deducted,
    // These assigned expenses are already included in the P&L; never deduct them again.
    netProfit: finance.netProfit,
    netMargin: finance.income > 0 ? finance.netProfit / finance.income : null,
    percentageBasis,
    percentageBase,
  };
}
