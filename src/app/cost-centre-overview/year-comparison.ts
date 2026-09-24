import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, catchError, from, map, mergeMap, of, timeout } from 'rxjs';
import { DsrReportService } from '../core/services/dsr-report.service';
import { CostCentrePeriodicalFilters } from '../models/dsr-report.models';

type ComparisonMetric = 'revenue' | 'expense' | 'net';
interface YearResult {
  year: number;
  fromDate: string;
  toDate: string;
  status: 'ready' | 'empty' | 'error';
  revenue: number;
  expense: number;
  net: number;
}

@Component({
  selector: 'app-year-comparison',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './year-comparison.html',
  styleUrl: './year-comparison.css',
})
export class YearComparison {
  readonly filters = input.required<CostCentrePeriodicalFilters>();
  readonly language = input<'ar' | 'en'>('ar');
  private readonly service = inject(DsrReportService);
  private subscription?: Subscription;
  protected readonly open = signal(false);
  protected readonly fromYear = signal(new Date().getFullYear() - 1);
  protected readonly toYear = signal(new Date().getFullYear());
  protected readonly mode = signal<'period' | 'full'>('period');
  protected readonly busy = signal(false);
  protected readonly results = signal<YearResult[]>([]);
  protected readonly requested = signal(false);
  protected readonly metrics: { key: ComparisonMetric; ar: string; en: string }[] = [
    { key: 'revenue', ar: 'الإيرادات', en: 'Revenue' },
    { key: 'expense', ar: 'المصروفات', en: 'Expense' },
    { key: 'net', ar: 'صافي الربح', en: 'Net profit' },
  ];
  protected readonly valid = computed(() => {
    const from = this.fromYear();
    const to = this.toYear();
    const filters = this.filters();
    return (
      Number.isInteger(from) &&
      Number.isInteger(to) &&
      from >= 1900 &&
      to <= 2100 &&
      to > from &&
      to - from < 5 &&
      (this.mode() === 'full' ||
        (Boolean(filters.fromDate && filters.toDate) &&
          filters.fromDate <= filters.toDate &&
          filters.fromDate.slice(0, 4) === filters.toDate.slice(0, 4)))
    );
  });
  protected readonly years = computed(() =>
    this.valid()
      ? Array.from(
          { length: this.toYear() - this.fromYear() + 1 },
          (_, index) => this.fromYear() + index,
        )
      : [],
  );
  protected readonly rows = computed(() => [...this.results()].sort((a, b) => a.year - b.year));
  protected readonly readyRows = computed(() =>
    this.rows().filter((row) => row.status === 'ready'),
  );
  protected readonly scale = computed(() => {
    const values = this.readyRows().flatMap((row) => this.metrics.map((metric) => row[metric.key]));
    const positive = Math.max(0, ...values);
    const negative = Math.min(0, ...values);
    const roughStep = Math.max(positive, Math.abs(negative), 1) / 4;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const factor = roughStep / magnitude;
    const step = (factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10) * magnitude;
    const top = Math.ceil(positive / step) * step || (negative === 0 ? step : 0);
    const bottom = Math.floor(negative / step) * step;
    return { top, bottom, range: top - bottom, step };
  });
  protected readonly baseline = computed(() => (this.scale().top / this.scale().range) * 100);
  protected readonly ticks = computed(() =>
    Array.from({ length: Math.round(this.scale().range / this.scale().step) + 1 }, (_, index) => ({
      position: ((index * this.scale().step) / this.scale().range) * 100,
      value: this.scale().top - this.scale().step * index,
    })),
  );

  constructor() {
    effect(() => {
      const year = Number(this.filters().fromDate.slice(0, 4)) || new Date().getFullYear();
      this.reset();
      this.fromYear.set(year - 1);
      this.toYear.set(year);
    });
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
  }

  protected text(ar: string, en: string): string {
    return this.language() === 'ar' ? ar : en;
  }
  protected toggle(): void {
    this.open.update((value) => !value);
    if (!this.open() && this.busy()) this.reset();
  }
  protected updateYears(key: 'from' | 'to', value: number): void {
    this.reset();
    (key === 'from' ? this.fromYear : this.toYear).set(value);
  }
  protected updateMode(mode: 'period' | 'full'): void {
    this.reset();
    this.mode.set(mode);
  }
  private reset(): void {
    this.subscription?.unsubscribe();
    this.busy.set(false);
    this.results.set([]);
    this.requested.set(false);
  }
  protected compare(): void {
    if (!this.valid() || this.busy()) return;
    this.reset();
    this.requested.set(true);
    this.busy.set(true);
    const base = { ...this.filters() };
    const full = this.mode() === 'full';
    this.subscription = from(this.years())
      .pipe(
        mergeMap((year) => {
          const fromDate = full ? `${year}-01-01` : this.dateInYear(base.fromDate, year);
          const toDate = full ? `${year}-12-31` : this.dateInYear(base.toDate, year);
          const filters = { ...base, fromDate, toDate };
          const initial: YearResult = {
            year,
            fromDate,
            toDate,
            status: 'error',
            revenue: 0,
            expense: 0,
            net: 0,
          };
          return this.service.getCostCentrePeriodicalReport(filters).pipe(
            timeout(60000),
            map((response) => {
              const data = this.service.toCostCentrePeriodicalDashboardView(response, filters);
              return {
                ...initial,
                status: data.accounts.length ? ('ready' as const) : ('empty' as const),
                revenue: data.totalRevenue,
                expense: data.totalExpense,
                net: data.netProfit,
              };
            }),
            catchError(() => of(initial)),
          );
        }, 2),
      )
      .subscribe({
        next: (row) => this.results.update((rows) => [...rows, row]),
        complete: () => this.busy.set(false),
      });
  }
  protected height(value: number): number {
    return (Math.abs(value) / this.scale().range) * 100;
  }
  protected top(value: number): number {
    return ((this.scale().top - Math.max(0, value)) / this.scale().range) * 100;
  }
  private dateInYear(date: string, year: number): string {
    const month = Number(date.slice(5, 7));
    const day = Math.min(Number(date.slice(8, 10)), new Date(year, month, 0).getDate());
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
