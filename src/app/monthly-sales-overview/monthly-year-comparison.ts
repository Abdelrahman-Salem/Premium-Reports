import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, catchError, forkJoin, map, of, timeout } from 'rxjs';
import { DsrReportService } from '../core/services/dsr-report.service';
import { MonthlySaleFilters } from '../models/dsr-report.models';

type Metric = 'revenue' | 'profit' | 'documents';
type YearResult = { year: number; status: 'ready' | 'empty' | 'error'; revenue: number; profit: number; documents: number };

@Component({
  selector: 'app-monthly-year-comparison',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './monthly-year-comparison.html',
  styleUrls: ['../cost-centre-overview/cost-centre-overview.css', './monthly-year-comparison.css'],
})
export class MonthlyYearComparison {
  readonly filters = input.required<MonthlySaleFilters>();
  readonly language = input<'ar' | 'en'>('ar');
  private readonly service = inject(DsrReportService);
  private subscription?: Subscription;
  protected readonly fromYear = signal(new Date().getFullYear() - 1);
  protected readonly toYear = signal(new Date().getFullYear());
  protected readonly mode = signal<'period' | 'full'>('period');
  protected readonly busy = signal(false);
  protected readonly requested = signal(false);
  protected readonly results = signal<YearResult[]>([]);
  protected readonly metrics: { key: Metric; ar: string; en: string; unit: string }[] = [
    { key: 'revenue', ar: 'الإيرادات', en: 'Revenue', unit: 'SAR' },
    { key: 'profit', ar: 'مجمل الربح', en: 'Gross profit', unit: 'SAR' },
    { key: 'documents', ar: 'المستندات', en: 'Documents', unit: '' },
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
  protected scale(metric: Metric): number {
    return Math.max(1, ...this.results().filter((row) => row.status === 'ready').map((row) => Math.abs(row[metric])));
  }
  protected height(value: number, metric: Metric): number {
    return Math.abs(value) / this.scale(metric) * 100;
  }
  protected compare(): void {
    if (!this.valid() || this.busy()) return;
    this.subscription?.unsubscribe();
    this.busy.set(true);
    this.requested.set(true);
    this.results.set([]);
    const base = this.filters();
    const requests = this.years().map((year) => {
      const filters: MonthlySaleFilters = {
        ...base,
        fromYear: String(year),
        toYear: String(year),
        fromMonth: this.mode() === 'full' ? '1' : base.fromMonth,
        toMonth: this.mode() === 'full' ? '12' : base.toMonth,
        showProfit: true,
        showCount: true,
      };
      return this.service.getMonthlySaleReport(filters).pipe(
        timeout(60000),
        map((response): YearResult => {
          const report = this.service.toMonthlySaleDashboardView(response);
          return { year, status: report.services.length ? 'ready' : 'empty', revenue: report.totalAmount, profit: report.totalProfit, documents: report.totalCount };
        }),
        catchError(() => of<YearResult>({ year, status: 'error', revenue: 0, profit: 0, documents: 0 })),
      );
    });
    this.subscription = forkJoin(requests).subscribe((results) => {
      this.results.set(results);
      this.busy.set(false);
    });
  }
}
