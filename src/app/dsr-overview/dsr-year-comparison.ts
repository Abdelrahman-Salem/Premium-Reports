import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, catchError, from, map, mergeMap, of, timeout } from 'rxjs';
import { DsrReportService } from '../core/services/dsr-report.service';
import { DsrFilters } from '../models/dsr-report.models';

type Metric = 'revenue' | 'profit' | 'customers' | 'average';
type YearResult = { year: number; status: 'ready' | 'empty' | 'error'; revenue: number; profit: number; customers: number; average: number; loadedRows: number; totalRows: number };

@Component({
  selector: 'app-dsr-year-comparison',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './dsr-year-comparison.html',
  styleUrls: ['../cost-centre-overview/cost-centre-overview.css', '../monthly-sales-overview/monthly-year-comparison.css', './dsr-year-comparison.css'],
})
export class DsrYearComparison {
  readonly filters = input.required<DsrFilters>();
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
    { key: 'revenue', ar: 'إيرادات العملاء', en: 'Customer revenue', unit: 'SAR' },
    { key: 'profit', ar: 'ربح العملاء', en: 'Customer profit', unit: 'SAR' },
    { key: 'customers', ar: 'العملاء النشطون', en: 'Active customers', unit: '' },
    { key: 'average', ar: 'متوسط الإيراد لكل عميل', en: 'Revenue per customer', unit: 'SAR' },
  ];
  protected readonly valid = computed(() => {
    const from = this.fromYear();
    const to = this.toYear();
    const filters = this.filters();
    return Number.isInteger(from) && Number.isInteger(to) && from >= 1900 && to <= 2100 &&
      to > from && to - from < 5 && filters.costCenters.length > 0 &&
      (this.mode() === 'full' || (Boolean(filters.fromDate && filters.toDate) && filters.fromDate.slice(5) <= filters.toDate.slice(5)));
  });
  protected readonly years = computed(() => this.valid()
    ? Array.from({ length: this.toYear() - this.fromYear() + 1 }, (_, index) => this.fromYear() + index)
    : []);
  protected readonly rows = computed(() => [...this.results()].sort((a, b) => a.year - b.year));
  readonly printReady = computed(() => !this.busy() && this.results().some((row) => row.status === 'ready'));

  constructor() {
    effect(() => {
      const year = Number(this.filters().toDate.slice(0, 4)) || new Date().getFullYear();
      this.reset();
      this.fromYear.set(year - 1);
      this.toYear.set(year);
    });
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
  }
  protected text(ar: string, en: string): string {
    return this.language() === 'ar' ? ar : en;
  }
  protected updateYear(key: 'from' | 'to', value: number): void {
    this.reset();
    (key === 'from' ? this.fromYear : this.toYear).set(value);
  }
  protected updateMode(value: 'period' | 'full'): void {
    this.reset();
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
    this.reset();
    this.busy.set(true);
    this.requested.set(true);
    const base = this.filters();
    this.subscription = from(this.years()).pipe(
      mergeMap((year) => {
        const filters: DsrFilters = {
          ...base,
          fromDate: this.mode() === 'full' ? `${year}-01-01` : this.dateInYear(base.fromDate, year),
          toDate: this.mode() === 'full' ? `${year}-12-31` : this.dateInYear(base.toDate, year),
        };
        const failure: YearResult = { year, status: 'error', revenue: 0, profit: 0, customers: 0, average: 0, loadedRows: 0, totalRows: 0 };
        return this.service.getDsrReport(filters).pipe(
          timeout(60000),
          map((result): YearResult => {
            const report = this.service.toCustomerDashboardView(result.data);
            return { year, status: report.loadedRows ? 'ready' : 'empty', revenue: report.revenue,
              profit: report.profit, customers: report.customerCount, average: report.averageRevenue,
              loadedRows: report.loadedRows, totalRows: report.totalRows };
          }),
          catchError(() => of(failure)),
        );
      }, 2),
    ).subscribe({
      next: (result) => this.results.update((rows) => [...rows, result]),
      complete: () => this.busy.set(false),
    });
  }
  private reset(): void {
    this.subscription?.unsubscribe();
    this.results.set([]);
    this.busy.set(false);
    this.requested.set(false);
  }
  private dateInYear(date: string, year: number): string {
    const month = Number(date.slice(5, 7));
    const day = Math.min(Number(date.slice(8, 10)), new Date(year, month, 0).getDate());
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
