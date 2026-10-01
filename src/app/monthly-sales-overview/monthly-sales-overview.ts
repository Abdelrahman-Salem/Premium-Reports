import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MonthlySaleDashboardView, MonthlySaleFilters } from '../models/dsr-report.models';

@Component({
  selector: 'app-monthly-sales-overview',
  imports: [DecimalPipe, PercentPipe, FormsModule],
  templateUrl: './monthly-sales-overview.html',
  styleUrls: ['../cost-centre-overview/cost-centre-overview.css', './monthly-sales-overview.css'],
})
export class MonthlySalesOverview {
  readonly data = input<MonthlySaleDashboardView | null>(null);
  readonly filters = input.required<MonthlySaleFilters>();
  readonly language = input<'ar' | 'en'>('ar');
  readonly loading = input(false);
  readonly filtersChange = output<MonthlySaleFilters>();
  readonly yearSelected = output<MonthlySaleFilters>();
  readonly search = output<void>();

  protected readonly year = computed(() => Number(this.filters().fromYear) || new Date().getFullYear());
  protected readonly years = computed(() => {
    const last = Math.max(new Date().getFullYear(), this.year());
    return Array.from({ length: 6 }, (_, index) => last - 5 + index);
  });
  protected readonly months = Array.from({ length: 12 }, (_, index) => index + 1);
  protected readonly selectedShareMonth = signal(0);
  protected readonly activeShareMonth = computed(() => Math.min(this.selectedShareMonth(), Math.max(0, (this.data()?.months.length ?? 1) - 1)));
  protected readonly maxMonthlyProfit = computed(() => Math.max(1, ...this.data()?.months.map((month) => Math.abs(month.profit)) ?? [1]));
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
  protected readonly mix = computed(() => {
    const services = this.data()?.services ?? [];
    const total = services.reduce((sum, service) => sum + Math.max(0, service.amount), 0);
    if (!total) return '#edf0f1';
    let start = 0;
    const stops = services.map((service, index) => {
      const end = start + Math.max(0, service.amount) / total * 100;
      const stop = `${this.color(index)} ${start}% ${end}%`;
      start = end;
      return stop;
    });
    return `conic-gradient(${stops.join(',')})`;
  });
  protected readonly colors = ['#ee7925', '#08636b', '#b89e17', '#4c78a8', '#965477', '#459c85', '#69747d'];

  protected text(ar: string, en: string): string {
    return this.language() === 'ar' ? ar : en;
  }
  protected color(index: number): string {
    return this.colors[index % this.colors.length];
  }
  protected width(value: number, maximum: number): number {
    return Math.min(100, Math.abs(value) / Math.max(maximum, 1) * 100);
  }
  protected shareOf(amount: number, monthlyTotal: number): number {
    return monthlyTotal === 0 ? 0 : amount / monthlyTotal;
  }
  protected shareWidth(amount: number, monthlyTotal: number): number {
    return Math.min(100, Math.abs(this.shareOf(amount, monthlyTotal)) * 100);
  }
  protected marginHeight(margin: number): number {
    return Math.min(100, Math.abs(margin) * 100);
  }
  protected update<K extends keyof MonthlySaleFilters>(key: K, value: MonthlySaleFilters[K]): void {
    this.filtersChange.emit({ ...this.filters(), [key]: value });
  }
  protected selectYear(year: number): void {
    this.yearSelected.emit({ ...this.filters(), fromMonth: '1', toMonth: '12', fromYear: String(year), toYear: String(year) });
  }
  protected submit(): void {
    if (!this.invalidPeriod() && !this.loading()) this.search.emit();
  }
}
