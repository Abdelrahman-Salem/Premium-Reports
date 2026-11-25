import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ExpenseReportService } from '../core/services/expense-report.service';
import { CostCentreOption } from '../models/dsr-report.models';
import { ExecutiveFilters, ExecutiveReportError, FinancialReport, executivePeriods } from '../models/executive-performance.models';
import { ExpenseBarItem, ExpenseDisplayFilters, ExpenseGroup, ExpenseMonth, expenseDashboard, expenseGroupId, expenseShare } from '../models/expense-report.models';
import { PerformanceColumn, PerformanceColumns } from '../executive-performance/performance-columns';
import { ReportFilters } from '../shared/report-filters';
import { ExpenseBars } from './expense-bars';

@Component({
  selector: 'app-expense-overview',
  imports: [DatePipe, DecimalPipe, PercentPipe, FormsModule, ReportFilters, ExpenseBars, PerformanceColumns],
  templateUrl: './expense-overview.html', styleUrl: './expense-overview.css',
})
export class ExpenseOverview {
  readonly options = input.required<CostCentreOption[]>();
  readonly language = input<'ar' | 'en'>('ar');
  readonly sessionReady = input(false);
  readonly automaticLogin = input(false);
  private readonly service = inject(ExpenseReportService);
  private subscription?: Subscription;
  private readonly now = new Date();
  private readonly currentKey = `${this.now.getFullYear()}${String(this.now.getMonth() + 1).padStart(2, '0')}`;
  readonly data = signal<FinancialReport | null>(null);
  readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly filters = signal<ExecutiveFilters>({ fromMonth: `${this.now.getFullYear()}-01`,
    toMonth: `${this.now.getFullYear()}-${String(this.now.getMonth() + 1).padStart(2, '0')}`,
    quarters: [], costCenterIds: ['1','73','74','75','77'] });
  protected readonly display = signal<ExpenseDisplayFilters>({ groupId: '', accountId: '' });
  protected readonly years = Array.from({ length: 6 }, (_, index) => this.now.getFullYear() - 5 + index);
  protected readonly valid = computed(() => { try { executivePeriods(this.filters()); return true; } catch { return false; } });
  protected readonly view = computed(() => this.data() ? expenseDashboard(this.data()!, this.display()) : null);
  protected readonly groupOptions = computed(() => this.data() ? expenseDashboard(this.data()!, { groupId: '', accountId: '' }).groups : []);
  protected readonly accountOptions = computed(() => (this.data()?.finance.expenseAccounts ?? [])
    .filter((account) => !this.display().groupId || expenseGroupId(account.id) === this.display().groupId));
  protected readonly scoped = computed(() => !!(this.display().groupId || this.display().accountId));
  protected readonly selectionLabel = computed(() => this.data()?.centerNames.join(' / ') ?? '');
  protected readonly scopeLabel = computed(() => {
    const group = this.groupOptions().find((item) => item.id === this.display().groupId);
    const account = this.accountOptions().find((item) => item.id === this.display().accountId);
    return [group ? this.text(group.ar, group.en) : '', account?.name ?? ''].filter(Boolean).join(' / ') || this.text('جميع حسابات المصروفات', 'All expense accounts');
  });
  readonly printReady = computed(() => !!this.data() && !!this.view() && !this.busy());
  readonly periodLabel = computed(() => [this.data()?.periods.map((period) => `${period.fromDate} — ${period.toDate}`).join(' / '),
    this.selectionLabel(), this.scopeLabel()].filter(Boolean).join(' · '));
  protected readonly filterSummary = computed(() => {
    let period = `${this.filters().fromMonth} — ${this.filters().toMonth}`;
    if (this.filters().quarters.length) period = this.filters().quarters.map((q) => `${this.text('الربع', 'Q')} ${q}`).join(' + ') + ` (${this.filters().fromMonth.slice(0,4)})`;
    return `${period} · ${this.filters().costCenterIds.length}${this.text(' مراكز', ' centres')} · SAR`;
  });
  protected readonly monthWindows = computed(() => {
    const months = this.view()?.months ?? [];
    return Array.from({ length: Math.ceil(months.length / 12) }, (_, i) => months.slice(i * 12, i * 12 + 12));
  });
  protected readonly groupBars = computed<ExpenseBarItem[]>(() => (this.view()?.groups ?? []).map((group) => ({
    id: group.id, label: this.text(group.ar, group.en), value: group.amount, ratio: expenseShare(group.amount, this.view()!.total),
  })));
  protected readonly centreColumns = computed<PerformanceColumn[]>(() => (this.data()?.finance.centers ?? []).map((center) => ({
    id: center.id, label: center.name, value: center.expenses, ratio: expenseShare(center.expenses, this.data()!.finance.expenses), color: '#1b365d',
  })));
  protected readonly incompleteCalendar = computed(() => this.view()?.months.some((month) => month.key >= this.currentKey) ?? false);
  protected readonly activeAccounts = computed(() => this.view()?.accounts.filter((account) => account.months.some((value) => value !== 0)).length ?? 0);

  constructor() { inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe()); }
  protected text(ar: string, en: string): string { return this.language() === 'ar' ? ar : en; }
  protected share(value: number): number | null { return expenseShare(value, this.view()?.total ?? 0); }
  protected monthState(key: string): string {
    return key === this.currentKey ? this.text('شهر جارٍ', 'Current month') : key > this.currentKey ? this.text('لم يبدأ بعد', 'Future month') : '';
  }
  protected groupItems(group: ExpenseGroup): ExpenseBarItem[] {
    return group.accounts.map((account) => ({ id: account.id, label: account.name, value: account.amount, ratio: this.share(account.amount) }));
  }
  protected monthColumns(months: ExpenseMonth[]): PerformanceColumn[] {
    return months.map((month) => ({ id: month.key, label: month.label + (this.monthState(month.key) ? ` · ${this.monthState(month.key)}` : ''),
      value: month.amount, ratio: month.share, color: month.key === this.view()?.topMonths[0]?.id ? '#0f2444' : '#1b365d' }));
  }
  protected changeDisplay(key: keyof ExpenseDisplayFilters, value: string): void {
    this.display.update((current) => ({ ...current, [key]: value, ...(key === 'groupId' ? { accountId: '' } : {}) }));
  }
  protected updateMonth(key: 'fromMonth' | 'toMonth', value: string): void {
    this.clear(); this.filters.update((current) => ({ ...current, [key]: value, quarters: [] }));
  }
  protected toggleQuarter(quarter: number): void {
    this.clear(); this.filters.update((current) => {
      const quarters = current.quarters.includes(quarter) ? current.quarters.filter((q) => q !== quarter) : [...current.quarters, quarter].sort();
      const year = current.fromMonth.slice(0,4);
      return { ...current, quarters, fromMonth: `${year}-${String(quarters.length ? (quarters[0] - 1) * 3 + 1 : 1).padStart(2,'0')}`,
        toMonth: `${year}-${String(quarters.length ? quarters.at(-1)! * 3 : 12).padStart(2,'0')}` };
    });
  }
  protected toggleCenter(id: string): void {
    this.clear(); this.filters.update((current) => ({ ...current, costCenterIds: id === 'ALL'
      ? (current.costCenterIds.length === this.options().length ? [] : this.options().map((center) => center.id))
      : current.costCenterIds.includes(id) ? current.costCenterIds.filter((value) => value !== id) : [...current.costCenterIds, id] }));
  }
  protected selectYear(year: number): void {
    this.clear(); this.filters.update((current) => ({ ...current, fromMonth: `${year}-01`,
      toMonth: `${year}-${year === this.now.getFullYear() ? String(this.now.getMonth() + 1).padStart(2,'0') : '12'}`, quarters: [] }));
    this.load();
  }
  private clear(): void {
    this.subscription?.unsubscribe(); this.data.set(null); this.busy.set(false); this.error.set('');
    this.display.set({ groupId: '', accountId: '' });
  }
  protected load(): void {
    if (!this.valid()) return;
    this.clear();
    if (!this.sessionReady() && !this.automaticLogin()) {
      this.error.set(this.text('اتصال TRAACS غير جاهز. أعد الاتصال لعرض التقرير.', 'The TRAACS connection is not ready. Reconnect to load the report.')); return;
    }
    this.busy.set(true);
    this.subscription = this.service.getReport(structuredClone(this.filters()), this.options()).subscribe({
      next: (report) => { this.data.set(report); this.busy.set(false); },
      error: (failure: unknown) => {
        this.busy.set(false);
        if (failure instanceof ExecutiveReportError && failure.reason === 'reconciliation') {
          this.error.set(this.text('لم تتطابق مصروفات الحسابات مع المراكز للفترة المحددة. أعد المحاولة، وراجع الفترة والمراكز في TRAACS إذا استمر الاختلاف.',
            'Account and centre totals do not reconcile for the selected period. Retry, and check the period and centres in TRAACS if the difference persists.'));
        } else if (failure instanceof HttpErrorResponse && [401,403].includes(failure.status)) {
          this.error.set(this.text('تعذر تجديد اتصال TRAACS. أعد الاتصال وحاول مجددًا.', 'The TRAACS connection could not be renewed. Reconnect and retry.'));
        } else {
          this.error.set(this.text('تعذر التحقق من اكتمال بيانات المصروفات. لم يُعرض التقرير؛ أعد المحاولة.', 'The expense data could not be fully verified. Please retry the report.'));
        }
      },
    });
  }
}
