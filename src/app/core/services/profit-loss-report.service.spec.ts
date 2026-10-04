import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProfitLossFilters } from '../../models/profit-loss.models';
import { ProfitLossReportService } from './profit-loss-report.service';

const key = '202601';
const amountKey = `dbl_base_currency_debit_credt${key}`;
const saleKey = `base_dat_document${key}`;
const period = [{ strColumnHeading: 'Jan 2026' }];
const filters: ProfitLossFilters = {
  fromMonth: '1', fromYear: '2026', toMonth: '10', toYear: '2026',
};

function sample() {
  return {
    accounts: {
      arrKeyPhpKey: [key], arrTimePeriodePhpKey: period,
      arrPandLMonthWisePhpKey: [
        { fk_bint_sub_ledger_id: 1, vchr_account_name: 'Cabin Revenue', bint_category: 3, [amountKey]: '100.25', total: '100.25' },
        { fk_bint_sub_ledger_id: 2, vchr_account_name: 'Rent Expense', bint_category: 4, [amountKey]: '30.10', total: '30.10' },
      ],
    },
    centers: {
      arrKeyPhpKey: [key], arrTimePeriodePhpKey: period,
      arrPandLMonthWisePhpKey: [
        { fk_bint_cost_center_id: 73, vchr_cost_center_name: '808 - AirPort Jeddah', bint_category: 3, [amountKey]: 25 },
        { fk_bint_cost_center_id: 75, vchr_cost_center_name: '810 - G.S.E', bint_category: 3, [amountKey]: 75.25 },
        { fk_bint_cost_center_id: 75, vchr_cost_center_name: '810 - G.S.E', bint_category: 4, [amountKey]: 20.10 },
        { fk_bint_cost_center_id: 1, vchr_cost_center_name: '100 - Head Quarter', bint_category: 4, [amountKey]: 10 },
      ],
      arrPandLMonthWiseSumPhpKey: [{ bint_category: 3, [amountKey]: '100.25' }, { bint_category: 4, [amountKey]: '30.10' }],
      arrPandLSalesPhpKey: [
        { vchr_cost_center_name: '808 - AirPort Jeddah', [saleKey]: '30.00' },
        { vchr_cost_center_name: '810 - G.S.E', [saleKey]: '95.50' },
      ],
      arrPandLSalesSumPhpKey: [{ [saleKey]: '125.50' }],
    },
  };
}

describe('ProfitLossReportService', () => {
  let service: ProfitLossReportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProfitLossReportService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('reconciles the two APIs and keeps sales distinct from accounting income', () => {
    const data = sample();
    const report = service.toDashboard(data.accounts, data.centers);
    expect(report.sales).toBeCloseTo(125.50, 2);
    expect(report.income).toBeCloseTo(100.25, 2);
    expect(report.expenses).toBeCloseTo(30.10, 2);
    expect(report.netProfit).toBeCloseTo(70.15, 2);
    expect(report.margin).toBeCloseTo(70.15 / 125.50, 5);
    expect(report.centers.find((center) => center.id === '73+75')?.sales).toBeCloseTo(125.50, 2);
    expect(report.centers.find((center) => center.id === '1')?.overhead).toBe(true);
    expect(report.incomeAccounts[0].name).toBe('Cabin Revenue');
  });

  it('rejects a difference between the account and cost-centre summaries', () => {
    const data = sample();
    data.centers.arrPandLMonthWiseSumPhpKey[0][amountKey] = '101.25';
    expect(() => service.toDashboard(data.accounts, data.centers)).toThrow(/do not reconcile/);
  });

  it('posts the matching period to both TRAACS report routes with browser credentials', () => {
    let result = 0;
    service.getReport(filters).subscribe((report) => { result = report.sales; });
    const accounts = http.expectOne('/api/reports/finance/profit-loss/monthly-accounts');
    const centers = http.expectOne('/api/reports/finance/profit-loss/monthly-centers');
    const accountSearch = JSON.parse(new URLSearchParams(accounts.request.body).get('arrSearchValueAjxKey')!);
    const centerSearch = JSON.parse(new URLSearchParams(centers.request.body).get('arrSearchValueAjxKey')!);
    expect(accounts.request.withCredentials).toBe(true);
    expect(centers.request.withCredentials).toBe(true);
    expect(accountSearch.intFromYearAjxKey).toBe(centerSearch.intFromYearAjxKey);
    expect(accountSearch.datToMonthAjxKey).toBe(centerSearch.datToMonthAjxKey);
    expect(centerSearch.strBaseAjxKey).toBe('Base');
    const data = sample();
    accounts.flush(data.accounts);
    centers.flush(data.centers);
    expect(result).toBeCloseTo(125.50, 2);
  });
});
