import { referenceExpenseAccounts, referenceIncomeAccounts, referenceMonthKeys } from '../../expense-overview/testing/expense-reference.fixture';
import { ProfitLossAccount, ProfitLossDashboard } from '../../models/profit-loss.models';

// Only tests import this financial snapshot. Service sales are not needed by this derived analysis.
export function contributionFinanceFixture(
  incomeAccounts: ProfitLossAccount[] = referenceIncomeAccounts(),
  expenseAccounts: ProfitLossAccount[] = referenceExpenseAccounts(),
  keys = referenceMonthKeys,
): ProfitLossDashboard {
  const months = keys.map((key,index) => {
    const income = incomeAccounts.reduce((sum,a) => sum + a.months[index],0);
    const expenses = expenseAccounts.reduce((sum,a) => sum + a.months[index],0);
    return { key, label: key, income, expenses, sales: 0, netProfit: income - expenses, margin: income > 0 ? (income - expenses) / income : 0 };
  });
  const income = incomeAccounts.reduce((sum,a) => sum + a.amount,0);
  const expenses = expenseAccounts.reduce((sum,a) => sum + a.amount,0);
  return { months, incomeAccounts, expenseAccounts, income, expenses, netProfit: income - expenses,
    margin: income > 0 ? (income - expenses) / income : 0, sales: 0, averageMonthlySales: 0, centers: [], periodLabel: '' };
}
