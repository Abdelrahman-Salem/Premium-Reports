import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReportFilters } from '../shared/report-filters';
import { CostCentreOption, DsrCustomerDashboardView, DsrCustomerMonth, DsrFilters } from '../models/dsr-report.models';
import { PerformanceColumn, PerformanceColumns } from '../executive-performance/performance-columns';

@Component({
  selector: 'app-dsr-overview',
  imports: [DecimalPipe, PercentPipe, FormsModule, ReportFilters, PerformanceColumns],
  templateUrl: './customer-overview.html',
  styleUrls: ['../cost-centre-overview/cost-centre-overview.css', './customer-overview.css'],
})
export class CustomerOverview {
  readonly data = input<DsrCustomerDashboardView | null>(null);
  readonly filters = input.required<DsrFilters>();
  readonly options = input.required<CostCentreOption[]>();
  readonly language = input<'ar' | 'en'>('ar');
  readonly loading = input(false);
  readonly filtersChange = output<DsrFilters>();
  readonly yearSelected = output<DsrFilters>();
  readonly search = output<void>();

  protected readonly query = signal('');
  protected readonly sortBy = signal<'revenue' | 'profit' | 'documents'>('revenue');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly year = computed(() => Number(this.filters().toDate.slice(0, 4)) || new Date().getFullYear());
  protected readonly years = computed(() => {
    const last = Math.max(new Date().getFullYear(), this.year());
    return Array.from({ length: 6 }, (_, index) => last - 5 + index);
  });
  protected readonly invalidFilters = computed(() => {
    const filters = this.filters();
    return !filters.fromDate || !filters.toDate || filters.fromDate > filters.toDate ||
      !filters.costCenters.length || (!filters.showSales && !filters.showRefunds);
  });
  protected readonly currency = computed(() => this.filters().currency === 'Base' ? 'SAR' : this.filters().currency);
  protected readonly topCustomers = computed(() => this.data()?.customers.slice(0, 10) ?? []);
  protected readonly maxRevenue = computed(() => Math.max(1, ...this.topCustomers().map((row) => Math.abs(row.revenue))));
  protected readonly maxMonthValue = computed(() => Math.max(1, ...(this.data()?.months ?? []).flatMap((row) => [Math.abs(row.revenue), Math.abs(row.profit)])));
  protected readonly maxMonthCustomers = computed(() => Math.max(1, ...(this.data()?.months ?? []).map((row) => row.customers)));
  protected readonly filteredCustomers = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return [...(this.data()?.customers ?? [])]
      .filter((row) => !query || `${row.name} ${row.code}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => b[this.sortBy()] - a[this.sortBy()]);
  });
  protected readonly selected = computed(() => {
    const customers = this.data()?.customers ?? [];
    return customers.find((row) => row.id === this.selectedId()) ?? customers[0] ?? null;
  });
  protected readonly maxSelectedService = computed(() => Math.max(1, ...(this.selected()?.services ?? []).map((row) => Math.abs(row.revenue))));
  protected readonly maxSelectedMonth = computed(() => Math.max(1, ...(this.selected()?.months ?? []).map((row) => Math.abs(row.revenue))));
  // Chart windows only project existing report values; no financial aggregation is performed here.
  protected readonly heatMonthGroups = computed(() => this.chartGroups(this.data()?.months ?? [], 12));
  protected readonly customerHeatRows = computed(() => (this.data()?.customers ?? []).map((customer) => ({
    customer, months: new Map(customer.months.map((month) => [month.key, month.revenue])),
  })));
  protected readonly heatMaximum = computed(() => Math.max(1, ...(this.data()?.customers ?? []).flatMap((customer) =>
    customer.months.map((month) => Math.abs(month.revenue)))));
  protected readonly selectedChartGroups = computed(() => this.chartGroups(this.selected()?.months ?? [], 12));

  protected heatColor(value: number | undefined): string {
    if (value === undefined || value === 0) return '#f1f4f8';
    if (value < 0) return '#f8dfe1';
    return value >= this.heatMaximum() ? '#1c3c6c' : `rgba(75, 108, 155, ${0.1 + value / this.heatMaximum() * 0.65})`;
  }

  private chartGroups<T>(rows: readonly T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));
  }
  protected monthColumns(months: DsrCustomerMonth[], kind: 'comparison' | 'customers' | 'selected'): PerformanceColumn[] {
    return months.flatMap((month): PerformanceColumn[] => kind === 'comparison'
      ? [
          { id: month.key + '-sales', label: month.label + ' · ' + this.text('المبيعات', 'Sales'), value: month.revenue, ratio: null, color: '#1c3c6c' },
          { id: month.key + '-income', label: month.label + ' · ' + this.text('إيراد الخدمات', 'Service income'), value: month.profit, ratio: null, color: '#2a9d70' },
        ]
      : [{ id: month.key, label: month.label, value: kind === 'customers' ? month.customers : month.revenue, ratio: null }]);
  }

  protected text(ar: string, en: string): string { return this.language() === 'ar' ? ar : en; }
  protected width(value: number, maximum: number): number { return Math.min(100, Math.abs(value) / maximum * 100); }
  protected update<K extends keyof DsrFilters>(key: K, value: DsrFilters[K]): void {
    this.filtersChange.emit({ ...this.filters(), [key]: value });
  }
  protected selectYear(year: number): void {
    this.yearSelected.emit({ ...this.filters(), fromDate: `${year}-01-01`, toDate: `${year}-12-31` });
  }
  protected toggleCenter(id: string, checked: boolean): void {
    const selected = this.filters().costCenters;
    this.filtersChange.emit({ ...this.filters(), costCenters: checked ? [...new Set([...selected, id])] : selected.filter((item) => item !== id) });
  }
  protected toggleAllCenters(checked: boolean): void {
    this.filtersChange.emit({ ...this.filters(), costCenters: checked ? this.options().map((option) => option.id) : [] });
  }
  protected submit(): void { if (!this.invalidFilters() && !this.loading()) this.search.emit(); }
}
