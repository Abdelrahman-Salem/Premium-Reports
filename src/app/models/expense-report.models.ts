import { FinancialReport } from './executive-performance.models';
import { ProfitLossAccount } from './profit-loss.models';

export interface ExpenseGroupDefinition {
  id: string;
  ar: string;
  en: string;
  accountIds: readonly string[];
}

// Ledger IDs are intentional: several distinct TRAACS ledgers share an account code.
// These classifications reproduce the supplied Expense Report; amounts always come from TRAACS.
export const EXPENSE_GROUPS: readonly ExpenseGroupDefinition[] = [
  { id: 'staff', ar: 'تكاليف الموظفين', en: 'Staff Cost', accountIds: ['49','664','1082','73','1141','67','1083','1096','623','74','1151','75','626','50','76','1094','53','1084','1089','1090','1092','1091','625','624','1093'] },
  { id: 'fuel', ar: 'الوساطة والوقود والنيتروجين', en: 'Brokerage, Fuel & Nitrogen', accountIds: ['62','659','671'] },
  { id: 'premises', ar: 'المقرات والمرافق والصيانة', en: 'Premises, Utilities & Maintenance', accountIds: ['55','1099','630','64','649','641','1101','56','631','646','57','1116','1126','1103','1122'] },
  { id: 'provisions', ar: 'الإهلاك والمخصصات', en: 'Depreciation & Provisions', accountIds: ['1150','1147'] },
  { id: 'vehicles', ar: 'قطع غيار المركبات والتأمين', en: 'Vehicle spare parts & insurance', accountIds: ['645','644','1119','10160','1120'] },
  { id: 'bonus', ar: 'المكافآت والإكراميات والهدايا', en: 'Bonus, Ikramiya & Giveaways', accountIds: ['1132','10186','10187','654'] },
  { id: 'aviation', ar: 'الطيران المدني والتفتيش', en: 'Civil Aviation & Inspection', accountIds: ['672','71','640'] },
  { id: 'stationery', ar: 'القرطاسية والطباعة والبرمجيات', en: 'Stationery, Printing & Software', accountIds: ['1112','1109','627','59','635','1110','628','1097','637','638'] },
  { id: 'government', ar: 'الرسوم الحكومية والغرامات', en: 'Government Fees & Fines', accountIds: ['1140','663','655','666'] },
  { id: 'bank', ar: 'الرسوم البنكية والضمانات وفروق العملة', en: 'Bank charges, L/Gs & FX', accountIds: ['60','66','675'] },
  { id: 'other', ar: 'مصروفات أخرى', en: 'Other expenses', accountIds: ['1115','70'] },
  { id: 'unclassified', ar: 'مصروفات غير مصنفة', en: 'Unclassified expenses', accountIds: [] },
];

export interface ExpenseDisplayFilters { groupId: string; accountId: string; }
export interface ExpenseBarItem { id: string; label: string; value: number; ratio: number | null; }
export interface ExpenseGroup extends ExpenseGroupDefinition { amount: number; accounts: ProfitLossAccount[]; }
export interface ExpenseMonth {
  key: string;
  label: string;
  amount: number;
  share: number | null;
  topAccounts: ExpenseBarItem[];
}
export interface ExpenseDashboard {
  total: number;
  average: number;
  accounts: ProfitLossAccount[];
  groups: ExpenseGroup[];
  months: ExpenseMonth[];
  topMonths: ExpenseBarItem[];
  topAccounts: ExpenseBarItem[];
  unclassifiedCount: number;
}

const groupByLedger = new Map(EXPENSE_GROUPS.flatMap((group) => group.accountIds.map((id) => [id, group.id] as const)));
export function expenseGroupId(id: string): string { return groupByLedger.get(id) ?? 'unclassified'; }
export function expenseShare(value: number, total: number): number | null { return total > 0 ? value / total : null; }

/** All views use the same selected ledgers and signed monthly balances. Never infer missing money. */
export function expenseDashboard(report: FinancialReport, filters: ExpenseDisplayFilters): ExpenseDashboard {
  const accounts = report.finance.expenseAccounts.filter((account) =>
    (!filters.groupId || expenseGroupId(account.id) === filters.groupId) && (!filters.accountId || account.id === filters.accountId));
  const total = accounts.reduce((sum, account) => sum + account.amount, 0);
  const groups = EXPENSE_GROUPS.map((group) => {
    const members = accounts.filter((account) => expenseGroupId(account.id) === group.id);
    return { ...group, accounts: members, amount: members.reduce((sum, account) => sum + account.amount, 0) };
  }).filter((group) => group.accounts.length > 0);
  const top = (items: ExpenseBarItem[]) => items.filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id)).slice(0, 5);
  const months = report.finance.months.map((month, index) => {
    const amount = accounts.reduce((sum, account) => sum + account.months[index], 0);
    return { key: month.key, label: month.label, amount, share: expenseShare(amount, total),
      topAccounts: top(accounts.map((account) => ({ id: account.id, label: account.name, value: account.months[index],
        ratio: expenseShare(account.months[index], amount) }))) };
  });
  return { total, average: months.length ? total / months.length : 0, accounts, groups, months,
    topAccounts: top(accounts.map((account) => ({ id: account.id, label: account.name, value: account.amount, ratio: expenseShare(account.amount, total) }))),
    topMonths: top(months.map((month) => ({ id: month.key, label: month.label, value: month.amount, ratio: month.share }))),
    unclassifiedCount: accounts.filter((account) => expenseGroupId(account.id) === 'unclassified').length };
}
