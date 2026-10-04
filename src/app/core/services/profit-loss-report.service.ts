import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map } from 'rxjs';

import { ProfitLossAccount, ProfitLossCenter, ProfitLossDashboard, ProfitLossFilters } from '../../models/profit-loss.models';

type NumericRow = Record<string, string | number | null | undefined>;
type AccountRow = NumericRow & {
  fk_bint_sub_ledger_id?: number | null;
  vchr_account_name?: string;
  vchr_account_code?: string;
  bint_category?: number;
  total?: string | number;
};
type CenterRow = NumericRow & {
  fk_bint_cost_center_id?: number;
  vchr_cost_center_name?: string;
  bint_category?: number;
};
type AccountResponse = {
  arrPandLMonthWisePhpKey?: AccountRow[];
  arrKeyPhpKey?: string[];
  arrTimePeriodePhpKey?: Array<{ strColumnHeading?: string }>;
  intPandLMonthWiseCountPhpKey?: number | null;
};
type CenterResponse = {
  arrPandLMonthWisePhpKey?: CenterRow[];
  arrPandLMonthWiseSumPhpKey?: CenterRow[];
  arrPandLSalesPhpKey?: Array<NumericRow & { vchr_cost_center_name?: string }>;
  arrPandLSalesSumPhpKey?: NumericRow[];
  arrKeyPhpKey?: string[];
  arrTimePeriodePhpKey?: Array<{ strColumnHeading?: string }>;
};

const ACCOUNT_MONTH = 'dbl_base_currency_debit_credt';
const CENTER_MONTH = 'dbl_base_currency_debit_credt';
const SALES_MONTH = 'base_dat_document';

@Injectable({ providedIn: 'root' })
export class ProfitLossReportService {
  private readonly http = inject(HttpClient);
  private readonly headers = new HttpHeaders({
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    Accept: '*/*',
    'X-Requested-With': 'XMLHttpRequest',
  });

  getReport(filters: ProfitLossFilters) {
    const period = {
      datFromMonthAjxKey: filters.fromMonth,
      intFromYearAjxKey: filters.fromYear,
      datToMonthAjxKey: filters.toMonth,
      intToYearAjxKey: filters.toYear,
    };
    const accountsSearch = {
      ...period,
      intCostCenterAjxKey: ['1', '73', '74', '75', '77'],
      intDeptAjxKey: ['1'],
      intCostCentreGroupAjxKey: ['2', '1'],
      intDepartmentGroupAjxKey: [],
      strCostCenterNameAjxKey: ['ALL'],
      strDepartmentNameAjxKey: ['ALL'],
      strCostCentreGroupNamesAjxKey: ['ALL'],
      strDepartmentGroupNameAjxKey: [],
    };
    const centersSearch = {
      ...period,
      strBaseAjxKey: 'Base',
      strCSMCurrencyAjxKey: 'Base',
    };
    const request = <T>(url: string, search: object) => {
      const body = new URLSearchParams();
      body.set('intPerPageAjxKey', '');
      body.set('intOffsetAjxKey', '');
      body.set('arrSearchValueAjxKey', JSON.stringify(search));
      return this.http.post<T>(url, body.toString(), { headers: this.headers, withCredentials: true });
    };

    return forkJoin({
      accounts: request<AccountResponse>('/api/reports/finance/profit-loss/monthly-accounts', accountsSearch),
      centers: request<CenterResponse>('/api/reports/finance/profit-loss/monthly-centers', centersSearch),
    }).pipe(map(({ accounts, centers }) => this.toDashboard(accounts, centers)));
  }

  toDashboard(accounts: AccountResponse, centers: CenterResponse): ProfitLossDashboard {
    const keys = accounts.arrKeyPhpKey ?? [];
    if (!keys.length || !keys.every((key) => /^\d{6}$/.test(key)) ||
      JSON.stringify(keys) !== JSON.stringify(centers.arrKeyPhpKey ?? []) ||
      (accounts.arrTimePeriodePhpKey ?? []).length !== keys.length ||
      (centers.arrTimePeriodePhpKey ?? []).length !== keys.length) {
      throw new Error('Profit and loss report periods are incomplete or different.');
    }
    const accountRows = accounts.arrPandLMonthWisePhpKey;
    const centerRows = centers.arrPandLMonthWisePhpKey;
    const sumRows = centers.arrPandLMonthWiseSumPhpKey;
    const salesRows = centers.arrPandLSalesPhpKey;
    const salesSum = centers.arrPandLSalesSumPhpKey?.[0];
    if (!accountRows || !centerRows || !sumRows || !salesRows || !salesSum ||
      (accounts.intPandLMonthWiseCountPhpKey && accountRows.length < accounts.intPandLMonthWiseCountPhpKey)) {
      throw new Error('Profit and loss report is missing required rows.');
    }

    const accountView = (category: number): ProfitLossAccount[] => accountRows
      .filter((row) => Number(row.bint_category) === category)
      .map((row) => {
        const months = keys.map((key) => this.amount(row, `${ACCOUNT_MONTH}${key}`));
        const amount = this.sum(months);
        if (row.total !== undefined && row.total !== null) {
          this.assertEqual(amount, this.amount(row, 'total'), `account ${row.vchr_account_code}`);
        }
        return {
          id: String(row.fk_bint_sub_ledger_id ?? row.vchr_account_code ?? ''),
          name: row.vchr_account_name || row.vchr_account_code || 'Unclassified account',
          amount,
          months,
        };
      })
      .sort((a, b) => b.amount - a.amount);
    const incomeAccounts = accountView(3);
    const expenseAccounts = accountView(4);
    const summary = (category: number) => {
      const rows = sumRows.filter((row) => Number(row.bint_category) === category);
      if (rows.length !== 1) throw new Error(`Missing profit and loss category ${category} summary.`);
      return rows[0];
    };
    const incomeSummary = summary(3);
    const expenseSummary = summary(4);

    const months = keys.map((key, index) => {
      const income = this.sum(incomeAccounts.map((account) => account.months[index]));
      const expenses = this.sum(expenseAccounts.map((account) => account.months[index]));
      const sales = this.amount(salesSum, `${SALES_MONTH}${key}`);
      this.assertEqual(income, this.amount(incomeSummary, `${CENTER_MONTH}${key}`), `income ${key}`);
      this.assertEqual(expenses, this.amount(expenseSummary, `${CENTER_MONTH}${key}`), `expenses ${key}`);
      this.assertEqual(income, this.sum(centerRows.filter((row) => Number(row.bint_category) === 3)
        .map((row) => this.amount(row, `${CENTER_MONTH}${key}`))), `center income ${key}`);
      this.assertEqual(expenses, this.sum(centerRows.filter((row) => Number(row.bint_category) === 4)
        .map((row) => this.amount(row, `${CENTER_MONTH}${key}`))), `center expenses ${key}`);
      this.assertEqual(sales, this.sum(salesRows.map((row) => this.amount(row, `${SALES_MONTH}${key}`))), `center sales ${key}`);
      const netProfit = income - expenses;
      return {
        key,
        label: accounts.arrTimePeriodePhpKey?.[index]?.strColumnHeading || `${key.slice(4)}/${key.slice(0, 4)}`,
        sales,
        income,
        expenses,
        netProfit,
        margin: sales === 0 ? 0 : netProfit / sales,
      };
    });

    const centerMap = new Map<string, ProfitLossCenter>();
    const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
    for (const row of centerRows) {
      const id = String(row.fk_bint_cost_center_id ?? '');
      const current = centerMap.get(id) ?? {
        id,
        name: row.vchr_cost_center_name || `Cost centre ${id}`,
        sales: 0, income: 0, expenses: 0, netProfit: 0, overhead: id === '1',
      };
      const amount = this.sum(keys.map((key) => this.amount(row, `${CENTER_MONTH}${key}`)));
      if (Number(row.bint_category) === 3) current.income += amount;
      if (Number(row.bint_category) === 4) current.expenses += amount;
      centerMap.set(id, current);
    }
    for (const row of salesRows) {
      const center = [...centerMap.values()].find((item) => normalizeName(item.name) === normalizeName(row.vchr_cost_center_name || ''));
      if (!center) throw new Error(`Unmatched sales cost centre: ${row.vchr_cost_center_name}`);
      center.sales += this.sum(keys.map((key) => this.amount(row, `${SALES_MONTH}${key}`)));
    }
    const airport = centerMap.get('73');
    const groundSupport = centerMap.get('75');
    if (airport && groundSupport) {
      centerMap.delete('73');
      centerMap.delete('75');
      centerMap.set('73+75', {
        id: '73+75', name: '808 + 810 - Jeddah Airport / G.S.E',
        sales: airport.sales + groundSupport.sales,
        income: airport.income + groundSupport.income,
        expenses: airport.expenses + groundSupport.expenses,
        netProfit: 0, overhead: false,
      });
    }
    const centerView = [...centerMap.values()]
      .map((center) => ({ ...center, netProfit: center.income - center.expenses }))
      .sort((a, b) => b.sales - a.sales);
    const sales = this.sum(months.map((month) => month.sales));
    const income = this.sum(months.map((month) => month.income));
    const expenses = this.sum(months.map((month) => month.expenses));
    this.assertEqual(sales, this.sum(centerView.map((center) => center.sales)), 'total sales');
    this.assertEqual(income, this.sum(centerView.map((center) => center.income)), 'total income');
    this.assertEqual(expenses, this.sum(centerView.map((center) => center.expenses)), 'total expenses');
    const netProfit = income - expenses;
    return {
      periodLabel: `${months[0].label} - ${months[months.length - 1].label}`,
      months, incomeAccounts, expenseAccounts, centers: centerView,
      sales, income, expenses, netProfit,
      margin: sales === 0 ? 0 : netProfit / sales,
      averageMonthlySales: sales / months.length,
    };
  }

  private amount(row: NumericRow, key: string): number {
    if (!Object.hasOwn(row, key)) throw new Error(`Missing profit and loss value: ${key}`);
    const value = Number(row[key]);
    if (!Number.isFinite(value)) throw new Error(`Invalid profit and loss value: ${key}`);
    return value;
  }

  private sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }

  private assertEqual(actual: number, expected: number, source: string): void {
    if (Math.abs(actual - expected) > 0.02) throw new Error(`Profit and loss totals do not reconcile: ${source}`);
  }
}
