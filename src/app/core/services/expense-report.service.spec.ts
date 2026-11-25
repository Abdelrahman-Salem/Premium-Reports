import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExecutiveFilters, FinancialReport } from '../../models/executive-performance.models';
import { ExpenseReportService } from './expense-report.service';

const options = [{ id: '1', label: 'Head Quarter' }, { id: '73', label: 'Jeddah' }, { id: '75', label: 'G.S.E' }];
const filters: ExecutiveFilters = { fromMonth: '2026-01', toMonth: '2026-01', quarters: [], costCenterIds: ['1','73','75'] };
const accountsUrl = '/api/reports/finance/profit-loss/monthly-accounts';
const centersUrl = '/api/reports/finance/profit-loss/monthly-centers';
const prefix = 'dbl_base_currency_debit_credt';

function sources(keys = ['202601'], ids = filters.costCenterIds) {
  const income = (id: string) => id === '73' ? 100 : id === '75' ? 200 : 0;
  const expense = (id: string) => id === '1' ? 10 : id === '73' ? 30 : 20;
  const sum = (fn: (id: string) => number, centers = ids) => centers.reduce((n,id) => n + fn(id),0);
  const amounts = (value: number, field = prefix) => Object.fromEntries(keys.map((key) => [field + key, value]));
  const rows = [
    { fk_bint_sub_ledger_id: 10, vchr_account_name: 'Income', vchr_account_code: 'REV', bint_category: 3, ...amounts(sum(income)), total: sum(income) * keys.length },
    { fk_bint_sub_ledger_id: 49, vchr_account_name: 'Salary', vchr_account_code: 'DUPLICATE', bint_category: 4, ...amounts(sum(expense) * .8), total: sum(expense) * .8 * keys.length },
    { fk_bint_sub_ledger_id: 55, vchr_account_name: 'Office Rent', vchr_account_code: 'DUPLICATE', bint_category: 4, ...amounts(sum(expense) * .25), total: sum(expense) * .25 * keys.length },
    { fk_bint_sub_ledger_id: 666, vchr_account_name: 'Fines', vchr_account_code: 'FINE', bint_category: 4, ...amounts(sum(expense) * -.05), total: sum(expense) * -.05 * keys.length },
  ];
  const all = options.map((c) => c.id);
  return {
    accounts: { arrKeyPhpKey: keys, arrTimePeriodePhpKey: keys.map((key) => ({ strColumnHeading: key })), intPandLMonthWiseCountPhpKey: 4 as number | null, arrPandLMonthWisePhpKey: rows },
    centers: { arrKeyPhpKey: keys, arrTimePeriodePhpKey: keys.map((key) => ({ strColumnHeading: key })),
      arrPandLMonthWisePhpKey: options.flatMap((c) => [
        { fk_bint_cost_center_id: Number(c.id), vchr_cost_center_name: c.label, bint_category: 3, ...amounts(income(c.id)) },
        { fk_bint_cost_center_id: Number(c.id), vchr_cost_center_name: c.label, bint_category: 4, ...amounts(expense(c.id)) },
      ]),
      arrPandLMonthWiseSumPhpKey: [{ bint_category: 3, ...amounts(sum(income,all)) }, { bint_category: 4, ...amounts(sum(expense,all)) }],
      arrPandLSalesPhpKey: options.filter((c) => income(c.id) > 0).map((c) => ({ vchr_cost_center_name: c.label, ...amounts(income(c.id) * 1.1, 'base_dat_document') })),
      arrPandLSalesSumPhpKey: [amounts(sum(income,all) * 1.1, 'base_dat_document')],
    },
  };
}

describe('ExpenseReportService completeness and scope', () => {
  let service: ExpenseReportService, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ExpenseReportService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.expectNone((r) => r.url.includes('/sales/')); http.verify(); });

  it('uses only the two financial sources and waits for reconciliation before publishing', () => {
    let result: FinancialReport | undefined;
    service.getReport(filters, options).subscribe((report) => result = report);
    const data = sources();
    http.expectOne(accountsUrl).flush(data.accounts);
    expect(result).toBeUndefined();
    http.expectOne(centersUrl).flush(data.centers);
    expect(result!.finance.expenses).toBeCloseTo(60, 10);
    expect(result!.finance.expenseAccounts.map((a) => a.id)).toEqual(['49','55','666']);
    expect(result!.finance.expenseAccounts.at(-1)!.amount).toBe(-3);
    expect(result!.finance.centers.reduce((sum,c) => sum + c.expenses,0)).toBe(60);
  });

  it('scopes the account request and global centre response to the same selected raw IDs', () => {
    let result: FinancialReport | undefined;
    service.getReport({ ...filters, costCenterIds: ['1','75'] }, options).subscribe((report) => result = report);
    const request = http.expectOne(accountsUrl);
    const body = new URLSearchParams(request.request.body);
    expect(JSON.parse(body.get('arrSearchValueAjxKey')!).intCostCenterAjxKey).toEqual(['1','75']);
    const data = sources(['202601'], ['1','75']);
    request.flush(data.accounts); http.expectOne(centersUrl).flush(data.centers);
    expect(result!.finance.expenses).toBeCloseTo(30,10);
    expect(result!.finance.centers.map((c) => c.id)).toEqual(['75','1']);
  });

  it('loads every declared account page even when multiple ledgers share a code', () => {
    let result: FinancialReport | undefined;
    service.getReport(filters, options).subscribe((report) => result = report);
    const data = sources();
    http.expectOne(centersUrl).flush(data.centers);
    http.expectOne(accountsUrl).flush({ ...data.accounts, arrPandLMonthWisePhpKey: data.accounts.arrPandLMonthWisePhpKey.slice(0,3) });
    expect(result).toBeUndefined();
    const next = http.expectOne(accountsUrl);
    expect(new URLSearchParams(next.request.body).get('intOffsetAjxKey')).toBe('3');
    next.flush({ ...data.accounts, arrPandLMonthWisePhpKey: data.accounts.arrPandLMonthWisePhpKey.slice(3) });
    expect(result!.finance.expenses).toBeCloseTo(60,10);
  });

  it('requests the next page when the count is null and the first page is full', () => {
    let result: FinancialReport | undefined;
    service.getReport(filters, options).subscribe((report) => result = report);
    const data = sources(); data.accounts.intPandLMonthWiseCountPhpKey = null;
    const zeros = Array.from({ length: 246 }, (_,i) => ({ ...data.accounts.arrPandLMonthWisePhpKey[1], fk_bint_sub_ledger_id: 1000 + i, total: 0, dbl_base_currency_debit_credt202601: 0 }));
    http.expectOne(centersUrl).flush(data.centers);
    http.expectOne(accountsUrl).flush({ ...data.accounts, arrPandLMonthWisePhpKey: [...data.accounts.arrPandLMonthWisePhpKey,...zeros] });
    expect(result).toBeUndefined();
    const next = http.expectOne(accountsUrl);
    expect(new URLSearchParams(next.request.body).get('intOffsetAjxKey')).toBe('250');
    next.flush({ ...data.accounts, arrPandLMonthWisePhpKey: [] });
    expect(result!.finance.expenseAccounts).toHaveLength(249);
    expect(result!.finance.expenses).toBeCloseTo(60,10);
  });

  it.each(['missing-month','missing-value','null-value','wrong-total','wrong-centre-total','repeated-ledger'])('blocks %s rather than showing partial figures', (problem) => {
    let emitted = false, failure: unknown;
    service.getReport(filters, options).subscribe({ next: () => emitted = true, error: (error) => failure = error });
    const data = sources(); data.accounts.intPandLMonthWiseCountPhpKey = null;
    if (problem === 'missing-month') data.accounts.arrKeyPhpKey = ['202602'];
    if (problem === 'missing-value') delete (data.accounts.arrPandLMonthWisePhpKey[1] as Record<string, unknown>)[prefix + '202601'];
    if (problem === 'null-value') Object.assign(data.accounts.arrPandLMonthWisePhpKey[1], { dbl_base_currency_debit_credt202601: null });
    if (problem === 'wrong-total') data.accounts.arrPandLMonthWisePhpKey[1].total += 1;
    if (problem === 'wrong-centre-total') Object.assign(data.centers.arrPandLMonthWiseSumPhpKey[1], { dbl_base_currency_debit_credt202601: 61 });
    if (problem === 'repeated-ledger') data.accounts.arrPandLMonthWisePhpKey.push(data.accounts.arrPandLMonthWisePhpKey[1]);
    http.expectOne(centersUrl).flush(data.centers); http.expectOne(accountsUrl).flush(data.accounts);
    expect(emitted).toBe(false); expect(failure).toBeInstanceOf(Error);
  });

  it('rejects monthly differences even when period totals match', () => {
    let emitted = false, failure: unknown;
    service.getReport({ ...filters, toMonth: '2026-02' }, options).subscribe({ next: () => emitted = true, error: (error) => failure = error });
    const data = sources(['202601','202602']);
    Object.assign(data.accounts.arrPandLMonthWisePhpKey[1], { dbl_base_currency_debit_credt202601: 49, dbl_base_currency_debit_credt202602: 47 });
    http.expectOne(centersUrl).flush(data.centers); http.expectOne(accountsUrl).flush(data.accounts);
    expect(emitted).toBe(false); expect(failure).toMatchObject({ reason: 'reconciliation' });
  });

  it('loads only nonconsecutive selected quarters and supports periods crossing a year', () => {
    let result: FinancialReport | undefined;
    service.getReport({ ...filters, toMonth: '2026-09', quarters: [1,3] }, options).subscribe((report) => result = report);
    for (const keys of [['202601','202602','202603'],['202607','202608','202609']]) {
      const data = sources(keys); http.expectOne(centersUrl).flush(data.centers); http.expectOne(accountsUrl).flush(data.accounts);
    }
    expect(result!.finance.months.map((m) => m.key)).toEqual(['202601','202602','202603','202607','202608','202609']);
    expect(result!.finance.expenses).toBeCloseTo(360,10);
    service.getReport({ ...filters, fromMonth: '2025-12', toMonth: '2026-01' }, options).subscribe((report) => result = report);
    const data = sources(['202512','202601']); http.expectOne(centersUrl).flush(data.centers); http.expectOne(accountsUrl).flush(data.accounts);
    expect(result!.periods[0]).toMatchObject({ fromDate: '2025-12-01', toDate: '2026-01-31' });
    expect(result!.finance.expenses).toBeCloseTo(120,10);
  });
});
