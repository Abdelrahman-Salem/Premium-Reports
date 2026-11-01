import { DecimalPipe, PercentPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReportFilters } from '../shared/report-filters';
import { Subscription } from 'rxjs';
import { ExecutivePerformanceService } from '../core/services/executive-performance.service';
import { CostCentreOption } from '../models/dsr-report.models';
import { ExecutiveFilters, ExecutiveReport, ExecutiveReportError, executivePeriods } from '../models/executive-performance.models';
import { ProfitLossAccount } from '../models/profit-loss.models';
import { PerformanceColumn, PerformanceColumns } from './performance-columns';

@Component({
  selector: 'app-executive-performance', imports: [DecimalPipe, PercentPipe, FormsModule, PerformanceColumns, ReportFilters],
  templateUrl: './executive-performance.html', styleUrl: './executive-performance.css',
})
export class ExecutivePerformance {
  readonly options = input.required<CostCentreOption[]>();
  readonly language = input<'ar' | 'en'>('ar');
  readonly sessionReady = input(false);
  private readonly service = inject(ExecutivePerformanceService);
  private subscription?: Subscription;
  readonly data = signal<ExecutiveReport | null>(null);
  readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly now = new Date();
  protected readonly filters = signal<ExecutiveFilters>({ fromMonth: `${this.now.getFullYear()}-01`,
    toMonth: `${this.now.getFullYear()}-${String(this.now.getMonth() + 1).padStart(2, '0')}`, quarters: [], costCenterIds: ['1','73','74','75','77'] });
  protected readonly years = Array.from({ length: 6 }, (_, i) => this.now.getFullYear() - 5 + i);
  protected readonly valid = computed(() => { try { executivePeriods(this.filters()); return true; } catch { return false; } });
  readonly printReady = computed(() => !!this.data() && !this.busy());
  readonly periodLabel = computed(() => this.data()?.periods.map((period) => `${period.fromDate} - ${period.toDate}`).join(' / ') ?? '');
  protected readonly monthWindows = computed(() => {
    const months = this.data()?.finance.months ?? [];
    return Array.from({ length: Math.ceil(months.length / 12) }, (_, group) => months.slice(group * 12, group * 12 + 12).map((month, i) => ({ month, index: group * 12 + i })));
  });
  protected readonly services = computed(() => (this.data()?.finance.incomeAccounts ?? []).map((account, index) => ({ account, color: this.serviceColor(account.name, index) })));
  protected readonly maxServiceAmount = computed(() => Math.max(1, ...this.services().map((item) => Math.abs(item.account.amount))));
  protected readonly topCustomers = computed(() => this.data()?.customers.customers.filter((customer) => customer.revenue > 0).slice(0, 5) ?? []);
  protected readonly topTotal = computed(() => this.topCustomers().reduce((sum, customer) => sum + customer.revenue, 0));
  protected readonly topTwoShare = computed(() => this.ratio(this.topCustomers().slice(0, 2).reduce((sum, customer) => sum + customer.revenue, 0), this.topTotal()));
  protected readonly topThreeShare = computed(() => this.ratio(this.services().slice(0, 3).reduce((sum, item) => sum + item.account.amount, 0), this.data()?.finance.income ?? 0));
  protected readonly expenseAccounts = computed(() => this.data()?.finance.expenseAccounts.filter((account) => account.months.some((value) => value !== 0)).length ?? 0);
  protected readonly overheadShare = computed(() => this.ratio(this.data()?.finance.centers.filter((c) => c.overhead).reduce((sum, c) => sum + c.expenses, 0) ?? 0, this.data()?.finance.expenses ?? 0));
  protected readonly maxCentreNet = computed(() => Math.max(1, ...(this.data()?.finance.centers ?? []).map((center) => Math.abs(center.netProfit))));
  protected readonly maxComparison = computed(() => Math.max(1, ...(this.data()?.finance.centers ?? []).flatMap((center) => [Math.abs(center.income), Math.abs(center.expenses), Math.abs(center.netProfit)])));
  protected readonly stackScale = computed(() => {
    const months = this.data()?.finance.months ?? [];
    const accounts = this.data()?.finance.incomeAccounts ?? [];
    const positive = Math.max(0, ...months.map((_, i) => accounts.reduce((sum, a) => sum + Math.max(0, a.months[i]), 0)));
    const negative = Math.max(0, ...months.map((_, i) => accounts.reduce((sum, a) => sum + Math.max(0, -a.months[i]), 0)));
    return { positive, negative, total: (positive + negative) * 1.12 || 1 };
  });

  constructor() { inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe()); }
  protected text(ar: string, en: string): string { return this.language() === 'ar' ? ar : en; }
  protected ratio(value: number, total: number): number | null { return total > 0 ? value / total : null; }
  protected width(value: number, total: number): number { return total > 0 ? Math.min(100, Math.abs(value) / total * 100) : 0; }
  protected short(value: number): string { return Math.abs(value) >= 1000000 ? `${(value / 1000000).toFixed(2)}M` : `${(value / 1000).toFixed(0)}K`; }
  protected updateMonth(key: 'fromMonth' | 'toMonth', value: string): void {
    this.clear(); this.filters.update((current) => ({ ...current, [key]: value, quarters: [] }));
  }
  protected toggleQuarter(quarter: number): void {
    this.clear();
    this.filters.update((current) => {
      const quarters = current.quarters.includes(quarter) ? current.quarters.filter((q) => q !== quarter) : [...current.quarters, quarter].sort();
      const year = current.fromMonth.slice(0, 4);
      return { ...current, quarters,
        fromMonth: `${year}-${String(quarters.length ? (quarters[0] - 1) * 3 + 1 : 1).padStart(2, '0')}`,
        toMonth: `${year}-${String(quarters.length ? quarters.at(-1)! * 3 : 12).padStart(2, '0')}` };
    });
  }
  protected toggleCenter(id: string): void {
    this.clear();
    this.filters.update((current) => ({ ...current, costCenterIds: id === 'ALL'
      ? (current.costCenterIds.length === this.options().length ? [] : this.options().map((c) => c.id))
      : (current.costCenterIds.includes(id) ? current.costCenterIds.filter((c) => c !== id) : [...current.costCenterIds, id]) }));
  }
  protected selectYear(year: number): void {
    this.clear(); this.filters.update((current) => ({ ...current, fromMonth: `${year}-01`, toMonth: `${year}-12`, quarters: [] }));
    this.load();
  }
  protected clear(): void { this.subscription?.unsubscribe(); this.data.set(null); this.busy.set(false); this.error.set(''); }
  protected load(): void {
    if (!this.valid()) return;
    this.clear();
    if (!this.sessionReady()) { this.error.set(this.text('سجّل الدخول إلى TRAACS لعرض التقرير.', 'Sign in to TRAACS to load the report.')); return; }
    this.busy.set(true);
    const filters = structuredClone(this.filters());
    this.subscription = this.service.getReport(filters, this.options()).subscribe({
      next: (report) => { this.data.set(report); this.busy.set(false); },
      error: (failure: unknown) => {
        this.busy.set(false);
        if (failure instanceof ExecutiveReportError && failure.reason === 'reconciliation') {
          this.error.set(this.text('إجماليات المصادر لا تتطابق للفترة والمراكز المحددة. لم يُعرض التقرير؛ راجع القيود والفلاتر في TRAACS.', 'Source totals do not reconcile for the selected period and centres. Check the postings and filters in TRAACS.'));
        } else if (failure instanceof HttpErrorResponse && [401, 403].includes(failure.status)) {
          this.error.set(this.text('انتهت جلسة TRAACS. سجّل الدخول وأعد تحميل التقرير.', 'The TRAACS session expired. Sign in and reload the report.'));
        } else {
          this.error.set(this.text('تعذر التحقق من اكتمال بيانات الفترة والمراكز المحددة. أعد المحاولة بعد فحص اتصال TRAACS.', 'The selected period and centre data could not be fully verified. Check the TRAACS connection and retry.'));
        }
      },
    });
  }
  protected monthlyColumns(indices: { index: number }[], kind: 'sales' | 'profit'): PerformanceColumn[] {
    const finance = this.data()!.finance;
    return indices.map(({ index }) => {
      const month = finance.months[index];
      return { id: month.key, label: month.label, value: kind === 'sales' ? month.sales : month.netProfit,
        ratio: kind === 'sales' ? this.ratio(month.sales, finance.sales) : this.ratio(month.netProfit, month.income) };
    });
  }
  protected expenseColumns(): PerformanceColumn[] {
    const finance = this.data()!.finance;
    return finance.centers.map((center) => ({ id: center.id, label: center.name, value: center.expenses,
      ratio: this.ratio(center.expenses, finance.expenses), color: '#ef9a9e' }));
  }
  protected stackSegments(index: number) {
    let positive = 0, negative = 0;
    const scale = this.stackScale();
    return this.services().map(({ account, color }) => {
      const value = account.months[index];
      const start = value >= 0 ? positive : negative + value;
      if (value >= 0) positive += value; else negative += value;
      return { account, value, color, height: Math.abs(value) / scale.total * 100,
        bottom: (scale.negative * 1.12 + start) / scale.total * 100,
        share: this.ratio(value, this.data()!.finance.months[index].income) };
    });
  }
  protected heatColor(account: ProfitLossAccount, index: number): string {
    const shares = account.months.map((amount, i) => this.ratio(amount, this.data()!.finance.months[i].income) ?? 0);
    const value = shares[index];
    if (value < 0) return '#f8dfe1';
    const peak = Math.max(...shares, 0);
    if (peak > 0 && value === peak) return '#192d50';
    return `rgba(75, 108, 155, ${Math.min(0.75, 0.08 + value * 1.4)})`;
  }
  protected heatDark(account: ProfitLossAccount, index: number): boolean {
    const shares = account.months.map((amount, i) => this.ratio(amount, this.data()!.finance.months[i].income) ?? 0);
    return shares[index] > 0 && (shares[index] === Math.max(...shares) || shares[index] >= 0.32);
  }
  protected serviceName(name: string): string {
    const names: [RegExp, string][] = [[/rent.*cabin/i, 'Rent & Port Cabin'], [/equipment/i, 'Equipment'], [/fuel/i, 'Fuel'],
      [/vehicles.*driver/i, 'Vehicles & Driver'], [/headset/i, 'Headset'], [/nitrogen/i, 'Nitrogen, Tyre & Oil'], [/^other\s+revenue/i, 'Other']];
    return names.find(([pattern]) => pattern.test(name))?.[1] ?? name;
  }
  private serviceColor(name: string, index: number): string {
    const patterns = [/rent.*cabin/i, /equipment/i, /fuel/i, /vehicles.*driver/i, /headset/i, /^other\s+revenue/i, /nitrogen/i];
    const palette = ['#1c3c6c', '#4b6c9b', '#2a9d8f', '#efa336', '#916bc0', '#98a5ba', '#c83f48'];
    const match = patterns.findIndex((pattern) => pattern.test(name));
    return match < 0 ? palette[index % palette.length] : palette[match];
  }
}
