import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CostCentreOption,
  CostCentrePeriodicalDashboardView,
  CostCentrePeriodicalFilters,
} from '../models/dsr-report.models';

interface RevenueCentreTile {
  id: string;
  name: string;
  amount: number;
  share: number;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-cost-centre-overview',
  imports: [DecimalPipe, PercentPipe, FormsModule],
  templateUrl: './cost-centre-overview.html',
  styleUrl: './cost-centre-overview.css',
})
export class CostCentreOverview {
  readonly data = input<CostCentrePeriodicalDashboardView | null>(null);
  readonly filters = input.required<CostCentrePeriodicalFilters>();
  readonly options = input.required<CostCentreOption[]>();
  readonly language = input<'ar' | 'en'>('ar');
  readonly loading = input(false);
  readonly filtersChange = output<CostCentrePeriodicalFilters>();
  readonly yearSelected = output<CostCentrePeriodicalFilters>();
  readonly search = output<void>();
  protected readonly colors = [
    '#ee7925',
    '#08636b',
    '#b89e17',
    '#4c78a8',
    '#965477',
    '#459c85',
    '#69747d',
  ];
  protected readonly year = computed(
    () => Number(this.filters().fromDate.slice(0, 4)) || new Date().getFullYear(),
  );
  protected readonly years = computed(() => {
    const last = Math.max(new Date().getFullYear(), this.year());
    return Array.from({ length: 6 }, (_, index) => last - 5 + index);
  });
  protected readonly selectedQuarters = computed(() => {
    if (this.filters().quarters !== undefined) return this.filters().quarters ?? [];
    for (let q = 1; q <= 4; q++) {
      const range = this.quarterRange(this.year(), q);
      if (range.fromDate === this.filters().fromDate && range.toDate === this.filters().toDate)
        return [q];
    }
    return [];
  });
  protected readonly selectedCenters = computed(() =>
    this.filters().costCenterIds ?? (this.filters().costCenterId ? [this.filters().costCenterId] : []),
  );
  protected readonly invalidDates = computed(
    () =>
      !this.filters().fromDate ||
      !this.filters().toDate ||
      this.filters().fromDate > this.filters().toDate,
  );
  protected readonly revenueAccounts = computed(() => this.data()?.revenueAccounts ?? []);
  protected readonly revenueMagnitude = computed(() =>
    this.revenueAccounts().reduce((sum, account) => sum + Math.abs(account.total), 0),
  );
  protected readonly hasRevenueAdjustments = computed(() =>
    this.revenueAccounts().some((account) => account.total < 0),
  );
  protected readonly pie = computed(() => {
    const total = this.revenueMagnitude();
    if (!total) return '#e9ecee';
    let start = 0;
    const stops = this.revenueAccounts().map((account, index) => {
      const end = start + (Math.abs(account.total) / total) * 100;
      const stop = `${this.color(index)} ${start}% ${end}%`;
      start = end;
      return stop;
    });
    return `conic-gradient(${stops.join(',')})`;
  });
  protected readonly maxRevenue = computed(() =>
    Math.max(1, ...this.revenueAccounts().map((account) => Math.abs(account.total))),
  );
  protected readonly revenueCentreTiles = computed<RevenueCentreTile[]>(() => {
    const centers = (this.data()?.centers ?? []).filter((center) => center.revenue > 0);
    const total = centers.reduce((sum, center) => sum + center.revenue, 0);
    if (!total) return [];
    const tiles = centers.map((center, index) => ({
      id: center.id,
      name: center.name,
      amount: center.revenue,
      share: center.revenue / total,
      color: this.color(index),
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }));
    const result: RevenueCentreTile[] = [];
    const partition = (
      items: RevenueCentreTile[],
      x: number,
      y: number,
      width: number,
      height: number,
    ): void => {
      if (!items.length) return;
      if (items.length === 1) {
        result.push({ ...items[0], x, y, width, height });
        return;
      }
      const weight = items.reduce((sum, item) => sum + item.amount, 0);
      let split = 1;
      let firstWeight = items[0].amount;
      while (split < items.length - 1 && firstWeight + items[split].amount <= weight / 2) {
        firstWeight += items[split++].amount;
      }
      const ratio = firstWeight / weight;
      if (width >= height) {
        partition(items.slice(0, split), x, y, width * ratio, height);
        partition(items.slice(split), x + width * ratio, y, width * (1 - ratio), height);
      } else {
        partition(items.slice(0, split), x, y, width, height * ratio);
        partition(items.slice(split), x, y + height * ratio, width, height * (1 - ratio));
      }
    };
    partition(tiles, 0, 0, 100, 100);
    return result;
  });
  protected readonly maxMargin = computed(() =>
    Math.max(
      1,
      ...(this.data()?.centers ?? [])
        .filter((center) => center.revenue > 0)
        .map((center) => Math.abs(center.margin)),
    ),
  );
  protected readonly maxComparison = computed(() =>
    Math.max(
      1,
      ...(this.data()?.centers ?? []).flatMap((center) => [
        Math.abs(center.revenue),
        Math.abs(center.expense),
        Math.abs(center.net),
      ]),
    ),
  );
  protected text(ar: string, en: string): string {
    return this.language() === 'ar' ? ar : en;
  }
  protected color(index: number): string {
    return this.colors[index % this.colors.length];
  }
  protected width(value: number, maximum: number): number {
    return Math.min(100, (Math.abs(value) / maximum) * 100);
  }
  protected update(key: keyof CostCentrePeriodicalFilters, value: string): void {
    this.filtersChange.emit({ ...this.filters(), [key]: value, quarters: [] });
  }
  protected selectCenter(id: string): void {
    const selectedIds = this.selectedCenters();
    const costCenterIds = id
      ? selectedIds.includes(id)
        ? selectedIds.filter((centerId) => centerId !== id)
        : this.options().filter((option) => selectedIds.includes(option.id) || option.id === id).map((option) => option.id)
      : [];
    const names = this.options().filter((option) => costCenterIds.includes(option.id)).map((option) => option.label);
    this.filtersChange.emit({
      ...this.filters(),
      costCenterId: costCenterIds.length === 1 ? costCenterIds[0] : '',
      costCenterIds,
      costCenterName: names.length ? names.join(' + ') : 'ALL',
    });
  }
  protected selectYear(year: number): void {
    this.yearSelected.emit({
      ...this.filters(),
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
      quarters: [],
    });
  }
  protected selectQuarter(quarter: number): void {
    const selected = this.selectedQuarters();
    const quarters = selected.includes(quarter)
      ? selected.filter((item) => item !== quarter)
      : [...selected, quarter].sort((a, b) => a - b);
    const from = quarters.length ? this.quarterRange(this.year(), quarters[0]) : null;
    const to = quarters.length
      ? this.quarterRange(this.year(), quarters[quarters.length - 1])
      : null;
    this.filtersChange.emit({
      ...this.filters(),
      fromDate: from?.fromDate ?? `${this.year()}-01-01`,
      toDate: to?.toDate ?? `${this.year()}-12-31`,
      quarters,
    });
  }
  protected submit(): void {
    if (!this.invalidDates() && !this.loading()) this.search.emit();
  }
  private quarterRange(
    year: number,
    quarter: number,
  ): Pick<CostCentrePeriodicalFilters, 'fromDate' | 'toDate'> {
    const start = String((quarter - 1) * 3 + 1).padStart(2, '0');
    const end = String(quarter * 3).padStart(2, '0');
    const day = new Date(year, quarter * 3, 0).getDate();
    return { fromDate: `${year}-${start}-01`, toDate: `${year}-${end}-${day}` };
  }
}
