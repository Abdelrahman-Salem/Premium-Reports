import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { YearComparison } from './year-comparison';
import {
  CostCentreOption,
  CostCentrePeriodicalDashboardView,
  CostCentrePeriodicalFilters,
} from '../models/dsr-report.models';

interface AccountTile {
  id: string;
  name: string;
  amount: number;
  weight: number;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-cost-centre-overview',
  imports: [DecimalPipe, PercentPipe, FormsModule, YearComparison],
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
  protected readonly quarter = computed(() => {
    for (let q = 1; q <= 4; q++) {
      const range = this.quarterRange(this.year(), q);
      if (range.fromDate === this.filters().fromDate && range.toDate === this.filters().toDate)
        return q;
    }
    return 0;
  });
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
  protected readonly expenseAccounts = computed(() => this.data()?.expenseAccounts ?? []);
  protected readonly maxExpense = computed(() =>
    Math.max(1, ...this.expenseAccounts().map((account) => Math.abs(account.total))),
  );
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
  protected readonly expenseTiles = computed(() => {
    const accounts = (this.data()?.expenseAccounts ?? []).filter((account) => account.total !== 0);
    const result: AccountTile[] = [];
    const items = accounts.map((account, index) => ({
      id: account.id,
      name: account.name,
      amount: account.total,
      weight: Math.abs(account.total),
      color: this.color(index),
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }));
    // Split near half the value at each step so tile area remains proportional to amount.
    const partition = (
      rows: AccountTile[],
      x: number,
      y: number,
      width: number,
      height: number,
    ): void => {
      if (!rows.length) return;
      if (rows.length === 1) {
        result.push({ ...rows[0], x, y, width, height });
        return;
      }
      const total = rows.reduce((sum, row) => sum + row.weight, 0);
      let split = 1;
      let subtotal = rows[0].weight;
      while (split < rows.length - 1 && subtotal + rows[split].weight <= total / 2) {
        subtotal += rows[split++].weight;
      }
      const ratio = subtotal / total;
      if (width >= height) {
        partition(rows.slice(0, split), x, y, width * ratio, height);
        partition(rows.slice(split), x + width * ratio, y, width * (1 - ratio), height);
      } else {
        partition(rows.slice(0, split), x, y, width, height * ratio);
        partition(rows.slice(split), x, y + height * ratio, width, height * (1 - ratio));
      }
    };
    partition(items, 0, 0, 100, 100);
    return result;
  });

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
    this.filtersChange.emit({ ...this.filters(), [key]: value });
  }
  protected selectCenter(id: string): void {
    this.filtersChange.emit({
      ...this.filters(),
      costCenterId: id,
      costCenterName: this.options().find((option) => option.id === id)?.label ?? 'ALL',
    });
  }
  protected selectYear(year: number): void {
    this.filtersChange.emit({
      ...this.filters(),
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
    });
  }
  protected selectQuarter(quarter: number): void {
    this.filtersChange.emit({ ...this.filters(), ...this.quarterRange(this.year(), quarter) });
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
