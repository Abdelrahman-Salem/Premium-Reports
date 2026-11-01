import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExecutiveFilters, ExecutiveReport, executivePeriods } from '../../models/executive-performance.models';
import { ExecutivePerformanceService } from './executive-performance.service';

const options = [{ id: '1', label: '100 - Head Quarter' }, { id: '73', label: '808 - AirPort Jeddah' }, { id: '75', label: '810 - G.S.E' }];
const filters: ExecutiveFilters = { fromMonth: '2026-01', toMonth: '2026-01', quarters: [], costCenterIds: options.map((c) => c.id) };
const accountsUrl = '/api/reports/finance/profit-loss/monthly-accounts';
const centersUrl = '/api/reports/finance/profit-loss/monthly-centers';

function fixture(keys: string[], ids: string[]) {
  const income = (id: string) => id === '73' ? 100 : id === '75' ? 200 : 0;
  const expense = (id: string) => id === '1' ? 30 : income(id) * .4;
  const amounts = (value: number, prefix = 'dbl_base_currency_debit_credt') => Object.fromEntries(keys.map((key) => [prefix + key, value]));
  const sum = (fn: (id: string) => number, list = ids) => list.reduce((n, id) => n + fn(id), 0);
  const accountRows = [
    { fk_bint_sub_ledger_id: 10, vchr_account_code: 'REV', vchr_account_name: 'Rent & port Cabin Revenues', bint_category: 3, ...amounts(sum(income)), total: sum(income) * keys.length },
    { fk_bint_sub_ledger_id: 20, vchr_account_code: 'EXP', vchr_account_name: 'Salary Expenses', bint_category: 4, ...amounts(sum(expense)), total: sum(expense) * keys.length },
  ];
  const period = keys.map((key) => ({ strColumnHeading: key }));
  const allIds = options.map((c) => c.id);
  const rows = keys.flatMap((key) => ids.filter((id) => income(id) > 0).map((id) => ({
    datDatePhpKey: `01/${key.slice(4)}/${key.slice(0, 4)}`, strCustomerCodePhpKey: id, strCustomerNamePhpKey: `Customer ${id}`,
    strDocumentNoPhpKey: `${key}-${id}`, strCostCenterNamePhpKey: options.find((o) => o.id === id)!.label,
    dblSellingAmtPhpKey: income(id) * 1.1, dblProfitAmtPhpKey: income(id),
  })));
  return {
    accounts: { arrKeyPhpKey: keys, arrTimePeriodePhpKey: period, intPandLMonthWiseCountPhpKey: 2, arrPandLMonthWisePhpKey: accountRows },
    centers: { arrKeyPhpKey: keys, arrTimePeriodePhpKey: period,
      arrPandLMonthWisePhpKey: options.flatMap((c) => [
        { fk_bint_cost_center_id: Number(c.id), vchr_cost_center_name: c.label, bint_category: 3, ...amounts(income(c.id)) },
        { fk_bint_cost_center_id: Number(c.id), vchr_cost_center_name: c.label, bint_category: 4, ...amounts(expense(c.id)) },
      ]),
      arrPandLMonthWiseSumPhpKey: [{ bint_category: 3, ...amounts(sum(income, allIds)) }, { bint_category: 4, ...amounts(sum(expense, allIds)) }],
      arrPandLSalesPhpKey: options.filter((c) => income(c.id) > 0).map((c) => ({ vchr_cost_center_name: c.label, ...amounts(income(c.id) * 1.1, 'base_dat_document') })),
      arrPandLSalesSumPhpKey: [amounts(sum(income, allIds) * 1.1, 'base_dat_document')],
    },
    details: { arrDsrTicketsPhpKey: rows, arrDsrDetailsCountPhpKey: { intDsrDetailTicketCountPhpKey: rows.length,
      arrTotalDetailsTicketPhpKey: { dblSellingPriceSumPhpKey: sum(income) * keys.length * 1.1, dblProfitSumPhpKey: sum(income) * keys.length } } },
  };
}

describe('ExecutivePerformanceService', () => {
  let service: ExecutivePerformanceService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ExecutivePerformanceService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function flushOtherSources(data: ReturnType<typeof fixture>) {
    http.expectOne(centersUrl).flush(data.centers);
    for (const request of http.match('/api/reports/sales/dsr')) {
      const body = new URLSearchParams(request.request.body);
      request.flush(JSON.stringify(body.get('strStausAjxKey') === 'S' ? {} : data.details));
    }
  }

  it('reconciles all three sources and calculates every financial view from the same P&L', () => {
    let report: ExecutiveReport | undefined;
    service.getReport(filters, options).subscribe((value) => report = value);
    const data = fixture(['202601'], filters.costCenterIds);
    flushOtherSources(data);
    expect(report).toBeUndefined();
    http.expectOne(accountsUrl).flush(data.accounts);
    expect(report!.finance.sales).toBeCloseTo(330, 2);
    expect(report!.finance.income).toBe(300);
    expect(report!.finance.expenses).toBe(150);
    expect(report!.finance.netProfit).toBe(150);
    expect(report!.finance.margin).toBe(.5);
    expect(report!.finance.centers.reduce((sum, c) => sum + c.netProfit, 0)).toBe(150);
    expect(report!.customers.revenue).toBeCloseTo(report!.finance.sales, 2);
  });

  it('applies multiple-centre selection to accounts, sales, customers, and overhead consistently', () => {
    const selected = { ...filters, costCenterIds: ['1', '75'] };
    let report: ExecutiveReport | undefined;
    service.getReport(selected, options).subscribe((value) => report = value);
    const data = fixture(['202601'], selected.costCenterIds);
    const accounts = http.expectOne(accountsUrl);
    expect(JSON.parse(new URLSearchParams(accounts.request.body).get('arrSearchValueAjxKey')!).intCostCenterAjxKey).toEqual(['1', '75']);
    const dsr = http.match('/api/reports/sales/dsr');
    for (const request of dsr) {
      const body = new URLSearchParams(request.request.body);
      expect(JSON.parse(body.get('arrSearchValueAjxKey')!).intDsrDetailsCostCenterAjxKey).toEqual(['1', '75']);
      request.flush(JSON.stringify(body.get('strStausAjxKey') === 'S' ? {} : data.details));
    }
    http.expectOne(centersUrl).flush(data.centers); accounts.flush(data.accounts);
    expect(report!.finance.income).toBe(200);
    expect(report!.finance.expenses).toBe(110);
    expect(report!.finance.netProfit).toBe(90);
    expect(report!.finance.centers.map((c) => c.id)).toEqual(['75', '1']);
    expect(report!.customers.customerCount).toBe(1);
  });

  it('loads only the selected nonconsecutive quarters and computes averages over six months', () => {
    let report: ExecutiveReport | undefined;
    service.getReport({ ...filters, fromMonth: '2026-01', toMonth: '2026-09', quarters: [1, 3] }, options).subscribe((value) => report = value);
    for (const keys of [['202601', '202602', '202603'], ['202607', '202608', '202609']]) {
      const data = fixture(keys, filters.costCenterIds);
      flushOtherSources(data); http.expectOne(accountsUrl).flush(data.accounts);
    }
    expect(report!.finance.months.map((m) => m.key)).toEqual(['202601','202602','202603','202607','202608','202609']);
    expect(report!.finance.averageMonthlySales).toBeCloseTo(330, 2);
    expect(report!.customers.loadedRows).toBe(12);
    expect(report!.finance.netProfit).toBe(900);
  });

  it('waits for all account pages before exposing results', () => {
    let report: ExecutiveReport | undefined;
    service.getReport(filters, options).subscribe((value) => report = value);
    const data = fixture(['202601'], filters.costCenterIds);
    const missing = { ...data.accounts.arrPandLMonthWisePhpKey[0], fk_bint_sub_ledger_id: 11, vchr_account_code: 'REV2', total: 150, dbl_base_currency_debit_credt202601: 150 };
    Object.assign(data.accounts.arrPandLMonthWisePhpKey[0], { total: 150, dbl_base_currency_debit_credt202601: 150 });
    data.accounts.intPandLMonthWiseCountPhpKey = 3;
    flushOtherSources(data); http.expectOne(accountsUrl).flush(data.accounts);
    expect(report).toBeUndefined();
    const next = http.expectOne(accountsUrl);
    expect(new URLSearchParams(next.request.body).get('intOffsetAjxKey')).toBe('2');
    next.flush({ ...data.accounts, arrPandLMonthWisePhpKey: [missing] });
    expect(report!.finance.incomeAccounts).toHaveLength(2);
    expect(report!.finance.income).toBe(300);
  });

  it.each(['missing-month', 'outside-date', 'null-amount', 'inconsistent-expense', 'inconsistent-sales'])('rejects %s without displaying any dashboard', (problem) => {
    let emitted = false, failure: unknown;
    service.getReport(filters, options).subscribe({ next: () => emitted = true, error: (error) => failure = error });
    const data = fixture(['202601'], filters.costCenterIds);
    if (problem === 'missing-month') data.accounts.arrKeyPhpKey = ['202602'];
    if (problem === 'outside-date') data.details.arrDsrTicketsPhpKey[0].datDatePhpKey = '31/12/2025';
    if (problem === 'null-amount') Object.assign(data.accounts.arrPandLMonthWisePhpKey[0], { dbl_base_currency_debit_credt202601: null });
    if (problem === 'inconsistent-expense') Object.assign(data.centers.arrPandLMonthWiseSumPhpKey[1], { dbl_base_currency_debit_credt202601: 160 });
    if (problem === 'inconsistent-sales') {
      data.details.arrDsrTicketsPhpKey[0].dblSellingAmtPhpKey += 1;
      data.details.arrDsrDetailsCountPhpKey.arrTotalDetailsTicketPhpKey.dblSellingPriceSumPhpKey += 1;
    }
    flushOtherSources(data); http.expectOne(accountsUrl).flush(data.accounts);
    expect(emitted).toBe(false); expect(failure).toBeInstanceOf(Error);
  });

  it('rejects different monthly sales even when the full period totals match', () => {
    let emitted = false, failure: unknown;
    service.getReport({ ...filters, toMonth: '2026-02' }, options).subscribe({ next: () => emitted = true, error: (error) => failure = error });
    const data = fixture(['202601', '202602'], filters.costCenterIds);
    data.details.arrDsrTicketsPhpKey[0].dblSellingAmtPhpKey += 10;
    data.details.arrDsrTicketsPhpKey[2].dblSellingAmtPhpKey -= 10;
    flushOtherSources(data); http.expectOne(accountsUrl).flush(data.accounts);
    expect(emitted).toBe(false); expect(failure).toMatchObject({ reason: 'reconciliation' });
  });

  it('rejects repeated account pages', () => {
    let emitted = false, failure: unknown;
    service.getReport(filters, options).subscribe({ next: () => emitted = true, error: (error) => failure = error });
    const data = fixture(['202601'], filters.costCenterIds);
    data.accounts.intPandLMonthWiseCountPhpKey = 4;
    flushOtherSources(data); http.expectOne(accountsUrl).flush(data.accounts);
    http.expectOne(accountsUrl).flush(data.accounts);
    expect(emitted).toBe(false); expect(failure).toBeInstanceOf(Error);
  });

  it('uses calendar month ends including leap years', () => {
    expect(executivePeriods({ ...filters, fromMonth: '2024-02', toMonth: '2024-02' })[0].toDate).toBe('2024-02-29');
    expect(() => executivePeriods({ ...filters, fromMonth: '2026-04', toMonth: '2026-01' })).toThrow();
  });
});
