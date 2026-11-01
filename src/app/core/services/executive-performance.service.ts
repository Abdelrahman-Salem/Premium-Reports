import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, concatMap, defer, expand, forkJoin, from, map, reduce, retry, throwError, timeout, timer, toArray } from 'rxjs';
import { CostCentreOption } from '../../models/dsr-report.models';
import { ExecutiveFilters, ExecutivePeriod, ExecutiveReport, ExecutiveReportError, executivePeriods } from '../../models/executive-performance.models';
import { ProfitLossAccount, ProfitLossCenter, ProfitLossDashboard } from '../../models/profit-loss.models';
import { DsrReportService } from './dsr-report.service';
import { ProfitLossReportService } from './profit-loss-report.service';

type Accounts = Parameters<ProfitLossReportService['toDashboard']>[0];
type Centers = Parameters<ProfitLossReportService['toDashboard']>[1];
type AmountRow = Record<string, string | number | null | undefined>;
const ACCOUNT = 'dbl_base_currency_debit_credt';
const SALES = 'base_dat_document';

@Injectable({ providedIn: 'root' })
export class ExecutivePerformanceService {
  private readonly http = inject(HttpClient);
  private readonly dsr = inject(DsrReportService);
  private readonly profitLoss = inject(ProfitLossReportService);
  private readonly headers = new HttpHeaders({
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest',
  });

  getReport(filters: ExecutiveFilters, options: CostCentreOption[]): Observable<ExecutiveReport> {
    return defer(() => {
      const periods = executivePeriods(filters);
      const ids = [...new Set(filters.costCenterIds)];
      const selection = ids.map((id) => options.find((option) => option.id === id));
      if (selection.some((option) => !option)) throw new ExecutiveReportError('scope');
      const centers = selection as CostCentreOption[];
      return from(periods).pipe(
        concatMap((period) => forkJoin({
          finance: this.finance(period, centers),
          details: this.dsr.getDsrReport({ ...period, costCenters: ids, currency: 'SAR',
            dateType: 'DOCUMENT', showSales: true, showRefunds: true }),
        }).pipe(map(({ finance, details }) => {
          const rows = details.data.arrDsrTicketsPhpKey ?? [];
          for (const row of rows) {
            this.amount(row, 'dblSellingAmtPhpKey');
            this.amount(row, 'dblProfitAmtPhpKey');
            const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(row.datDatePhpKey ?? ''));
            if (!match) throw new ExecutiveReportError('period');
            const date = `${match[3]}-${match[2]}-${match[1]}`;
            const parsed = new Date(`${date}T00:00:00Z`);
            if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date ||
              date < period.fromDate || date > period.toDate) throw new ExecutiveReportError('period');
          }
          const customers = this.dsr.toCustomerDashboardView(details.data);
          if (customers.loadedRows !== customers.totalRows) throw new ExecutiveReportError('incomplete');
          this.equal(finance.sales, customers.revenue);
          for (const month of finance.months) {
            const customerMonth = customers.months.find((item) => item.key.replace('-', '') === month.key);
            this.equal(month.sales, customerMonth?.revenue ?? 0);
          }
          return { finance, details: details.data };
        }))),
        toArray(),
        map((parts) => ({
          finance: this.mergeFinance(parts.map((part) => part.finance)),
          customers: this.dsr.toCustomerDashboardView({
            arrDsrTicketsPhpKey: parts.flatMap((part) => part.details.arrDsrTicketsPhpKey ?? []),
            arrDsrDetailsCountPhpKey: { intDsrDetailTicketCountPhpKey: parts.reduce((n, part) => n + (part.details.arrDsrTicketsPhpKey?.length ?? 0), 0) },
          }),
          periods, centerNames: centers.map((center) => center.label), receivedAt: new Date(),
        })),
      );
    });
  }

  private request<T>(url: string, search: object, offset?: number): Observable<T> {
    const body = new URLSearchParams({ arrSearchValueAjxKey: JSON.stringify(search),
      intPerPageAjxKey: offset === undefined ? '' : '250', intOffsetAjxKey: offset === undefined ? '' : String(offset) });
    return this.http.post<T>(url, body.toString(), { headers: this.headers, withCredentials: true }).pipe(
      timeout(60000), retry({ count: 2, delay: (error: unknown, attempt) => {
        const temporary = error instanceof HttpErrorResponse ? [0, 408, 429, 502, 503, 504].includes(error.status)
          : error instanceof Error && error.name === 'TimeoutError';
        return temporary ? timer(attempt * 1000) : throwError(() => error);
      } }),
    );
  }

  private finance(period: ExecutivePeriod, selection: CostCentreOption[]): Observable<ProfitLossDashboard> {
    const dates = { datFromMonthAjxKey: String(Number(period.fromDate.slice(5, 7))), intFromYearAjxKey: period.fromDate.slice(0, 4),
      datToMonthAjxKey: String(Number(period.toDate.slice(5, 7))), intToYearAjxKey: period.toDate.slice(0, 4) };
    const search = { ...dates, intCostCenterAjxKey: selection.map((c) => c.id), strCostCenterNameAjxKey: selection.map((c) => c.label),
      intDeptAjxKey: ['1'], strDepartmentNameAjxKey: ['ALL'], intCostCentreGroupAjxKey: ['2', '1'],
      strCostCentreGroupNamesAjxKey: ['ALL'], intDepartmentGroupAjxKey: [], strDepartmentGroupNameAjxKey: [] };
    return forkJoin({
      accounts: this.accounts(search, period),
      centers: this.request<Centers>('/api/reports/finance/profit-loss/monthly-centers', { ...dates, strBaseAjxKey: 'Base', strCSMCurrencyAjxKey: 'Base' }),
    }).pipe(map(({ accounts, centers }) => {
      this.periodKeys(centers.arrKeyPhpKey, period);
      for (const row of accounts.arrPandLMonthWisePhpKey ?? []) {
        for (const key of period.monthKeys) this.amount(row, ACCOUNT + key);
      }
      const scoped = this.selectCenters(centers, selection, period);
      try {
        return this.profitLoss.toDashboard(accounts, scoped);
      } catch (failure) {
        throw new ExecutiveReportError(failure instanceof Error && /reconcile/.test(failure.message) ? 'reconciliation' : 'incomplete');
      }
    }));
  }

  private accounts(search: object, period: ExecutivePeriod): Observable<Accounts> {
    return defer(() => {
      let first: Accounts | undefined;
      let count: number | undefined;
      const seen = new Set<string>();
      const page = (offset: number) => this.request<Accounts>('/api/reports/finance/profit-loss/monthly-accounts', search, offset).pipe(map((data) => {
        this.periodKeys(data.arrKeyPhpKey, period);
        const rows = data.arrPandLMonthWisePhpKey;
        if (!Array.isArray(rows)) throw new ExecutiveReportError('incomplete');
        if (data.intPandLMonthWiseCountPhpKey != null) {
          const reported = Number(data.intPandLMonthWiseCountPhpKey);
          if (!Number.isSafeInteger(reported) || reported < offset + rows.length ||
            (count !== undefined && count !== reported)) throw new ExecutiveReportError('incomplete');
          count = reported;
        }
        if (!rows.length && count !== undefined && offset < count) throw new ExecutiveReportError('incomplete');
        for (const row of rows) {
          const identity = row.fk_bint_sub_ledger_id ?? row.vchr_account_code ?? row.vchr_account_name;
          const id = `${row.bint_category}:${identity}`;
          if (identity == null || seen.has(id)) throw new ExecutiveReportError('incomplete');
          seen.add(id);
        }
        first ??= data;
        return { offset, rows };
      }));
      return page(0).pipe(
        expand(({ offset, rows }) => (count !== undefined ? offset + rows.length < count : rows.length === 250)
          ? page(offset + rows.length) : EMPTY),
        reduce((all, next) => { all.push(...next.rows); return all; }, [] as NonNullable<Accounts['arrPandLMonthWisePhpKey']>),
        map((rows) => ({ ...first!, arrPandLMonthWisePhpKey: rows })),
      );
    });
  }

  private selectCenters(source: Centers, selection: CostCentreOption[], period: ExecutivePeriod): Centers {
    const rows = source.arrPandLMonthWisePhpKey;
    const sums = source.arrPandLMonthWiseSumPhpKey;
    const sales = source.arrPandLSalesPhpKey;
    const salesSum = source.arrPandLSalesSumPhpKey;
    if (!Array.isArray(rows) || !Array.isArray(sums) || !Array.isArray(sales) || salesSum?.length !== 1) {
      throw new ExecutiveReportError('incomplete');
    }
    const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
    const names = new Map<string, string>();
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.fk_bint_cost_center_id == null || !row.vchr_cost_center_name) throw new ExecutiveReportError('scope');
      const id = String(row.fk_bint_cost_center_id);
      const key = `${id}:${row.bint_category}`;
      const name = normalize(row.vchr_cost_center_name);
      if (seen.has(key) || (names.has(name) && names.get(name) !== id)) throw new ExecutiveReportError('scope');
      seen.add(key); names.set(name, id);
    }
    const ids = new Set(selection.map((c) => c.id));
    const chosen = rows.filter((row) => ids.has(String(row.fk_bint_cost_center_id)));
    // Complete global summaries establish zero activity for centres omitted by TRAACS.
    for (const center of selection) {
      if (!chosen.some((row) => String(row.fk_bint_cost_center_id) === center.id)) {
        chosen.push({ fk_bint_cost_center_id: Number(center.id), vchr_cost_center_name: center.label, bint_category: 3,
          ...Object.fromEntries(period.monthKeys.map((key) => [ACCOUNT + key, 0])) });
      }
    }
    const chosenSales = sales.filter((row) => {
      const id = names.get(normalize(row.vchr_cost_center_name ?? ''));
      if (!id) throw new ExecutiveReportError('scope');
      return ids.has(id);
    });
    const chosenSums = [3, 4].map((category) => {
      const matching = sums.filter((row) => Number(row.bint_category) === category);
      if (matching.length !== 1) throw new ExecutiveReportError('incomplete');
      const result: AmountRow = { bint_category: category };
      for (const key of period.monthKeys) {
        const field = ACCOUNT + key;
        this.equal(rows.filter((row) => Number(row.bint_category) === category).reduce((sum, row) => sum + this.amount(row, field), 0), this.amount(matching[0], field));
        result[field] = chosen.filter((row) => Number(row.bint_category) === category).reduce((sum, row) => sum + this.amount(row, field), 0);
      }
      return result;
    });
    const selectedSalesSum: AmountRow = {};
    for (const key of period.monthKeys) {
      this.equal(sales.reduce((sum, row) => sum + this.amount(row, SALES + key), 0), this.amount(salesSum[0], SALES + key));
      selectedSalesSum[SALES + key] = chosenSales.reduce((sum, row) => sum + this.amount(row, SALES + key), 0);
    }
    return { ...source, arrPandLMonthWisePhpKey: chosen, arrPandLMonthWiseSumPhpKey: chosenSums,
      arrPandLSalesPhpKey: chosenSales, arrPandLSalesSumPhpKey: [selectedSalesSum] };
  }

  private mergeFinance(parts: ProfitLossDashboard[]): ProfitLossDashboard {
    const months = parts.flatMap((part) => part.months);
    const mergeAccounts = (kind: 'incomeAccounts' | 'expenseAccounts') => {
      const accounts = new Map<string, ProfitLossAccount>();
      let offset = 0;
      for (const part of parts) {
        for (const item of part[kind]) {
          const account = accounts.get(item.id) ?? { ...item, amount: 0, months: Array(months.length).fill(0) };
          item.months.forEach((value, index) => account.months[offset + index] = value);
          account.amount += item.amount; accounts.set(item.id, account);
        }
        offset += part.months.length;
      }
      return [...accounts.values()].sort((a, b) => b.amount - a.amount);
    };
    const centers = new Map<string, ProfitLossCenter>();
    for (const part of parts) for (const item of part.centers) {
      const center = centers.get(item.id) ?? { ...item, sales: 0, income: 0, expenses: 0, netProfit: 0 };
      center.sales += item.sales; center.income += item.income; center.expenses += item.expenses;
      center.netProfit = center.income - center.expenses; centers.set(item.id, center);
    }
    const total = (key: 'sales' | 'income' | 'expenses') => months.reduce((sum, month) => sum + month[key], 0);
    const sales = total('sales'), income = total('income'), expenses = total('expenses');
    return { months, incomeAccounts: mergeAccounts('incomeAccounts'), expenseAccounts: mergeAccounts('expenseAccounts'),
      centers: [...centers.values()].sort((a, b) => b.income - a.income), sales, income, expenses,
      netProfit: income - expenses, margin: income === 0 ? 0 : (income - expenses) / income,
      averageMonthlySales: sales / months.length, periodLabel: months.map((month) => month.label).join(' / ') };
  }

  private periodKeys(keys: string[] | undefined, period: ExecutivePeriod): void {
    if (JSON.stringify(keys) !== JSON.stringify(period.monthKeys)) throw new ExecutiveReportError('period');
  }
  private amount(row: AmountRow, field: string): number {
    const raw = row[field];
    if (raw == null || String(raw).trim() === '' || !Number.isFinite(Number(raw))) throw new ExecutiveReportError('incomplete');
    return Number(raw);
  }
  private equal(actual: number, expected: number): void {
    if (Math.abs(actual - expected) > 0.02) throw new ExecutiveReportError('reconciliation');
  }
}
