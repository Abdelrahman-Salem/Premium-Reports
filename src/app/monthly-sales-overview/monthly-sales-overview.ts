import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfitLossDashboard, ProfitLossFilters } from '../models/profit-loss.models';

@Component({
  selector: 'app-monthly-sales-overview',
  imports: [DecimalPipe, PercentPipe, FormsModule],
  templateUrl: './monthly-profit-loss.html',
  styleUrls: ['../cost-centre-overview/cost-centre-overview.css', './monthly-profit-loss.css'],
})
export class MonthlySalesOverview {
  readonly data = input<ProfitLossDashboard | null>(null);
  readonly filters = input.required<ProfitLossFilters>();
  readonly language = input<'ar' | 'en'>('ar');
  readonly loading = input(false);
  readonly filtersChange = output<ProfitLossFilters>();
  readonly yearSelected = output<ProfitLossFilters>();
  readonly search = output<void>();

  protected readonly year = computed(() => Number(this.filters().fromYear) || new Date().getFullYear());
  protected readonly years = computed(() => {
    const last = Math.max(new Date().getFullYear(), this.year());
    return Array.from({ length: 6 }, (_, index) => last - 5 + index);
  });
  protected readonly months = Array.from({ length: 12 }, (_, index) => index + 1);
  protected readonly selectedShareMonth = signal(0);
  protected readonly activeShareMonth = computed(() => Math.min(this.selectedShareMonth(), Math.max(0, (this.data()?.months.length ?? 1) - 1)));
  protected readonly maxSales = computed(() => this.max(this.data()?.months.map((month) => month.sales)));
  protected readonly maxProfit = computed(() => this.max(this.data()?.months.map((month) => month.netProfit)));
  protected readonly maxExpenses = computed(() => this.max(this.data()?.months.map((month) => month.expenses)));
  protected readonly maxIncomeAccount = computed(() => this.max(this.data()?.incomeAccounts.map((account) => account.amount)));
  protected readonly maxCenterSales = computed(() => this.max(this.data()?.centers.map((center) => center.sales)));
  protected readonly maxCenterProfit = computed(() => this.max(this.data()?.centers.map((center) => center.netProfit)));
  protected readonly hasNegativeIncome = computed(() => this.data()?.incomeAccounts.some((account) => account.amount < 0) ?? false);
  protected readonly incomeShares = computed(() => {
    const accounts = (this.data()?.incomeAccounts ?? []).filter((account) => account.amount > 0);
    const total = accounts.reduce((sum, account) => sum + account.amount, 0);
    return accounts.map((account, index) => ({
      account,
      share: total === 0 ? 0 : account.amount / total,
      color: this.colors[index % this.colors.length],
    }));
  });
  protected readonly incomeMix = computed(() => {
    let start = 0;
    const stops = this.incomeShares().map(({ share, color }) => {
      const end = start + share * 100;
      const stop = `${color} ${start}% ${end}%`;
      start = end;
      return stop;
    });
    return stops.length ? `conic-gradient(${stops.join(',')})` : '#edf0f1';
  });
  private readonly colors = ['#007fac', '#2d777c', '#b59432', '#4b7092', '#9a6074', '#4a9b84', '#707b82'];
  protected readonly invalidPeriod = computed(() => {
    const filters = this.filters();
    const fromYear = Number(filters.fromYear);
    const toYear = Number(filters.toYear);
    const fromMonth = Number(filters.fromMonth);
    const toMonth = Number(filters.toMonth);
    return !Number.isInteger(fromYear) || !Number.isInteger(toYear) ||
      !Number.isInteger(fromMonth) || !Number.isInteger(toMonth) ||
      fromMonth < 1 || fromMonth > 12 || toMonth < 1 || toMonth > 12 ||
      fromYear < 1900 || toYear > 2100 || fromYear * 12 + fromMonth > toYear * 12 + toMonth;
  });
  protected text(ar: string, en: string): string {
    return this.language() === 'ar' ? ar : en;
  }
  protected width(value: number, maximum: number): number {
    return Math.min(100, Math.abs(value) / maximum * 100);
  }

  protected incomeShare(amount: number, total: number): number | null {
    return total <= 0 ? null : amount / total;
  }
  protected update<K extends keyof ProfitLossFilters>(key: K, value: ProfitLossFilters[K]): void {
    this.filtersChange.emit({ ...this.filters(), [key]: value });
  }
  protected selectYear(year: number): void {
    this.yearSelected.emit({ ...this.filters(), fromMonth: '1', toMonth: '12', fromYear: String(year), toYear: String(year) });
  }
  protected submit(): void {
    if (!this.invalidPeriod() && !this.loading()) this.search.emit();
  }

  private max(values: number[] | undefined): number {
    return Math.max(1, ...(values ?? []).map(Math.abs));
  }
}
