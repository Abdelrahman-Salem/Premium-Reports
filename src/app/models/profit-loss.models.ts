export interface ProfitLossFilters {
  fromMonth: string;
  fromYear: string;
  toMonth: string;
  toYear: string;
}

export interface ProfitLossMonth {
  key: string;
  label: string;
  sales: number;
  income: number;
  expenses: number;
  netProfit: number;
  margin: number;
}

export interface ProfitLossAccount {
  id: string;
  name: string;
  amount: number;
  months: number[];
}

export interface ProfitLossCenter {
  id: string;
  name: string;
  sales: number;
  income: number;
  expenses: number;
  netProfit: number;
  overhead: boolean;
}

export interface ProfitLossDashboard {
  periodLabel: string;
  months: ProfitLossMonth[];
  incomeAccounts: ProfitLossAccount[];
  expenseAccounts: ProfitLossAccount[];
  centers: ProfitLossCenter[];
  sales: number;
  income: number;
  expenses: number;
  netProfit: number;
  margin: number;
  averageMonthlySales: number;
}
