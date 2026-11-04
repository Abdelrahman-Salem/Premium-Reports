import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, catchError, forkJoin, map, of, timeout } from 'rxjs';
import { ProfitLossReportService } from '../core/services/profit-loss-report.service';
import { ProfitLossFilters } from '../models/profit-loss.models';

type Metric = 'sales' | 'income' | 'expenses' | 'netProfit';
type YearResult = { year: number; status: 'ready' | 'empty' | 'error'; sales: number; income: number; expenses: number; netProfit: number };

@Component({
  selector: 'app-monthly-year-comparison',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './monthly-year-comparison.html',
  styleUrls: ['../cost-centre-overview/cost-centre-overview.css', './monthly-year-comparison.css', './financial-year-charts.css'],
})
export class MonthlyYearComparison {
  readonly filters = input.required<ProfitLossFilters>();
  readonly language = input<'ar' | 'en'>('ar');
  private readonly service = inject(ProfitLossReportService);
  private subscription?: Subscription;
  protected readonly fromYear = signal(new Date().getFullYear() - 1);
  protected readonly toYear = signal(new Date().getFullYear());
  protected readonly mode = signal<'period' | 'full'>('period');
  protected readonly busy = signal(false);
  protected readonly requested = signal(false);
  protected readonly results = signal<YearResult[]>([]);
  protected readonly metrics: { key: Metric; ar: string; en: string; unit: string }[] = [
    { key: 'sales', ar: 'مبيعات الخدمات', en: 'Service sales', unit: 'SAR' },
    { key: 'income', ar: 'الإيراد المحاسبي', en: 'P&L income', unit: 'SAR' },
    { key: 'expenses', ar: 'المصروفات', en: 'Expenses', unit: 'SAR' },
    { key: 'netProfit', ar: 'صافي الربح', en: 'Net profit', unit: 'SAR' },
  ];
  protected readonly valid = computed(() => {
    const from = this.fromYear();
    const to = this.toYear();
    return Number.isInteger(from) && Number.isInteger(to) && from >= 1900 && to <= 2100 &&
      to > from && to - from < 5 && (this.mode() === 'full' || Number(this.filters().fromMonth) <= Number(this.filters().toMonth));
  });
  protected readonly years = computed(() => this.valid()
    ? Array.from({ length: this.toYear() - this.fromYear() + 1 }, (_, index) => this.fromYear() + index)
    : []);
  protected readonly sortedResults = computed(() => [...this.results()].sort((a, b) => a.year - b.year));
  readonly printReady = computed(() => !this.busy() && this.results().some((row) => row.status === 'ready'));

  constructor() {
    effect(() => {
      const year = Number(this.filters().toYear) || new Date().getFullYear();
      this.subscription?.unsubscribe();
      this.results.set([]);
      this.requested.set(false);
      this.busy.set(false);
      this.fromYear.set(year - 1);
      this.toYear.set(year);
    });
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
  }
  protected text(ar: string, en: string): string {
    return this.language() === 'ar' ? ar : en;
  }
  protected updateYear(key: 'from' | 'to', value: number): void {
    this.subscription?.unsubscribe();
    this.results.set([]);
    this.requested.set(false);
    (key === 'from' ? this.fromYear : this.toYear).set(value);
  }
  protected updateMode(value: 'period' | 'full'): void {
    this.subscription?.unsubscribe();
    this.results.set([]);
    this.requested.set(false);
    this.mode.set(value);
  }
  protected yearColor(year: number): string {
    return ['#087f9c', '#1c3c6c', '#8965b1', '#c58b32', '#2b9274'][year % 5];
  }
  protected readonly chartAxis = computed(() => {
    const values = this.results().filter((row) => row.status === 'ready').flatMap((row) => this.metrics.map((metric) => row[metric.key]));
    const positive = Math.max(0, ...values);
    const negative = Math.max(0, ...values.map((value) => -value));
    const range = positive + negative || 1;
    const upper = positive || negative ? positive : 1;
    return { range, positive: upper, zero: upper / range * 100 };
  });
  protected readonly chartTicks = computed(() => [0, 25, 50, 75, 100].map((position) => ({
    position, value: this.chartAxis().positive - this.chartAxis().range * position / 100,
  })));
  protected chartValue(value: number): string {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  }
  protected height(value: number): number {
    return Math.abs(value) / this.chartAxis().range * 100;
  }
  protected barTop(value: number): number {
    return this.chartAxis().zero - (value > 0 ? this.height(value) : 0);
  }
  protected compare(): void {
    if (!this.valid() || this.busy()) return;
    this.subscription?.unsubscribe();
    this.busy.set(true);
    this.requested.set(true);
    this.results.set([]);
    const base = this.filters();
    const requests = this.years().map((year) => {
      const filters: ProfitLossFilters = {
        ...base,
        fromYear: String(year),
        toYear: String(year),
        fromMonth: this.mode() === 'full' ? '1' : base.fromMonth,
        toMonth: this.mode() === 'full' ? '12' : base.toMonth,
      };
      return this.service.getReport(filters).pipe(
        timeout(60000),
        map((report): YearResult => ({ year, status: report.months.length ? 'ready' : 'empty', sales: report.sales, income: report.income, expenses: report.expenses, netProfit: report.netProfit })),
        catchError(() => of<YearResult>({ year, status: 'error', sales: 0, income: 0, expenses: 0, netProfit: 0 })),
      );
    });
    this.subscription = forkJoin(requests).subscribe((results) => {
      this.results.set(results);
      this.busy.set(false);
    });
  }
}
