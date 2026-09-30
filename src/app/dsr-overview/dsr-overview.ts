import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CostCentreOption, DsrDashboardView, DsrDetailAggregateRow, DsrFilters } from '../models/dsr-report.models';

@Component({
  selector: 'app-dsr-overview',
  imports: [DecimalPipe, PercentPipe, FormsModule],
  templateUrl: './dsr-overview.html',
  styleUrls: ['../cost-centre-overview/cost-centre-overview.css', './dsr-overview.css'],
})
export class DsrOverview {
  readonly data = input<DsrDashboardView | null>(null);
  readonly filters = input.required<DsrFilters>();
  readonly options = input.required<CostCentreOption[]>();
  readonly language = input<'ar' | 'en'>('ar');
  readonly loading = input(false);
  readonly filtersChange = output<DsrFilters>();
  readonly yearSelected = output<DsrFilters>();
  readonly search = output<void>();

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
  protected readonly documentCount = computed(() => {
    const report = this.data();
    if (!report) return null;
    if (report.detailAnalytics) return report.detailAnalytics.totalDocumentCount;
    const count = report.saleCount + report.refundCount;
    return count > 0 ? count : null;
  });
  protected readonly months = computed(() => [...(this.data()?.detailAnalytics?.months ?? [])]
    .sort((a, b) => Date.parse(a.label) - Date.parse(b.label)));
  protected readonly maxMonthProfit = computed(() => Math.max(1, ...this.months().map((row) => Math.abs(row.profit))));
  protected readonly maxMonthCount = computed(() => Math.max(1, ...this.months().map((row) => Math.abs(row.count))));
  protected readonly maxServiceProfit = computed(() => Math.max(1, ...(this.data()?.detailAnalytics?.services ?? []).map((row) => Math.abs(row.profit))));
  protected readonly centerRows = computed(() => {
    const rows = this.data()?.detailAnalytics?.costCenters ?? [];
    const airport = rows.find((row) => /^808(?:\D|$)/.test(row.label));
    const gse = rows.find((row) => /^810(?:\D|$)/.test(row.label));
    if (!airport || !gse) return rows;
    return [...rows.filter((row) => row !== airport && row !== gse), {
      ...airport,
      label: '808 - AirPort Jeddah + 810 - G.S.E',
      amount: airport.amount + gse.amount,
    }].sort((a, b) => b.amount - a.amount);
  });
  protected readonly maxCenterAmount = computed(() => Math.max(1, ...this.centerRows().map((row) => Math.abs(row.amount))));
  protected readonly movementRows = computed(() => {
    const report = this.data();
    const details = report?.detailAnalytics;
    if (!details) return report?.comparisonRows.slice(0, 3) ?? [];
    const rows = details.saleRefundRows.map((row) => ({ label: row.label, value: row.amount }));
    return [...rows, { label: this.text('الصافي', 'Net'), value: rows.reduce((sum, row) => sum + row.value, 0) }];
  });
  protected readonly maxMovement = computed(() => Math.max(1, ...this.movementRows().map((row) => Math.abs(row.value))));
  protected readonly visibleTypeRows = computed(() => (this.data()?.typeOfSaleRows ?? []).filter((row) => row.count !== 0 || row.amount !== 0));
  protected readonly visibleProfitRows = computed(() => (this.data()?.profitSummaryRows ?? []).filter((row) => row.net !== 0));
  protected readonly hasTypeSummary = computed(() => this.visibleTypeRows().length > 0);
  protected readonly hasPaymentSummary = computed(() => (this.data()?.paymentSummaryRows ?? []).some((row) => row.count !== null && row.count !== 0 || row.amount !== 0));
  protected readonly maxServiceDocuments = computed(() => Math.max(1, ...(this.data()?.detailAnalytics?.services ?? []).map((row) => row.saleCount + row.refundCount)));
  protected readonly operationRows = computed(() => {
    const details = this.data()?.detailAnalytics;
    if (!details) return [];
    return details.agents.length > 1 ? details.agents.slice(0, 10) : details.customers.slice(0, 10);
  });
  protected readonly operationDimension = computed(() => (this.data()?.detailAnalytics?.agents.length ?? 0) > 1
    ? this.text('الموظف', 'staff') : this.text('العميل', 'customer'));
  protected readonly maxOperationDocuments = computed(() => Math.max(1, ...this.operationRows().map((row) => row.saleCount + row.refundCount)));
  protected readonly serviceMix = computed(() => {
    const rows = this.data()?.detailAnalytics?.services ?? [];
    const total = rows.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
    if (!total) return '#edf0f1';
    let start = 0;
    return `conic-gradient(${rows.map((row, index) => {
      const end = start + Math.max(0, row.amount) / total * 100;
      const stop = `${this.color(index)} ${start}% ${end}%`;
      start = end;
      return stop;
    }).join(',')})`;
  });
  protected readonly colors = ['#ee7925', '#08636b', '#b89e17', '#4c78a8', '#965477', '#459c85', '#69747d'];

  protected text(ar: string, en: string): string {
    return this.language() === 'ar' ? ar : en;
  }
  protected color(index: number): string {
    return this.colors[index % this.colors.length];
  }
  protected width(value: number, maximum: number): number {
    return Math.min(100, Math.abs(value) / Math.max(1, maximum) * 100);
  }
  protected marginPosition(value: number): number {
    return Math.max(0, Math.min(100, value * 100));
  }
  protected positiveShare(row: DsrDetailAggregateRow): number {
    const total = (this.data()?.detailAnalytics?.services ?? []).reduce((sum, service) => sum + Math.max(0, service.amount), 0);
    return total ? Math.max(0, row.amount) / total : 0;
  }
  protected metric(index: number): number {
    return this.data()?.metricCards[index]?.value ?? 0;
  }
  protected movementLabel(label: string): string {
    if (/^sale$/i.test(label)) return this.text('بيع', 'Sale');
    if (/^refund$/i.test(label)) return this.text('مرتجع', 'Refund');
    return label;
  }
  protected update<K extends keyof DsrFilters>(key: K, value: DsrFilters[K]): void {
    this.filtersChange.emit({ ...this.filters(), [key]: value });
  }
  protected selectYear(year: number): void {
    this.yearSelected.emit({ ...this.filters(), fromDate: `${year}-01-01`, toDate: `${year}-12-31` });
  }
  protected toggleCenter(id: string, checked: boolean): void {
    const selected = this.filters().costCenters;
    const costCenters = checked ? [...new Set([...selected, id])] : selected.filter((item) => item !== id);
    this.filtersChange.emit({ ...this.filters(), costCenters });
  }
  protected toggleAllCenters(checked: boolean): void {
    this.filtersChange.emit({ ...this.filters(), costCenters: checked ? this.options().map((option) => option.id) : [] });
  }
  protected submit(): void {
    if (!this.invalidFilters() && !this.loading()) this.search.emit();
  }
}
