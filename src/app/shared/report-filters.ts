import { Component, computed, input, output, signal } from '@angular/core';

let filterId = 0;

@Component({
  selector: 'app-report-filters',
  template: `
    <div class="filter-toolbar">
      <div class="filter-caption">
        <span class="filter-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M7 12h10M10 17h4"/><circle cx="8" cy="7" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/></svg></span>
        <div class="filter-caption-text">
          <strong>{{ language() === 'ar' ? 'فلاتر التقرير' : 'Report filters' }}</strong>
          <div class="filter-summary">
            @for (part of summaryParts(); track $index) {
              <span class="filter-chip">
                @if ($index === 0) {
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M6 2v4m8-4v4M3 8h14"/></svg>
                } @else if (part === 'SAR') {
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="2" y="4" width="16" height="12" rx="2"/><circle cx="10" cy="10" r="3"/></svg>
                } @else {
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M15 8c0 4-5 9-5 9S5 12 5 8a5 5 0 1 1 10 0Z"/><circle cx="10" cy="8" r="1.7"/></svg>
                }
                <bdi [attr.dir]="$index === 0 ? 'ltr' : 'auto'">{{ part }}</bdi>
              </span>
            }
          </div>
        </div>
      </div>
      <div class="filter-toolbar-actions">
        <button class="filter-toggle" type="button" [attr.aria-expanded]="expanded()" [attr.aria-controls]="panelId" (click)="expanded.set(!expanded())">
          {{ language() === 'ar' ? (expanded() ? 'إخفاء الفلاتر' : 'تعديل الفلاتر') : (expanded() ? 'Hide filters' : 'Edit filters') }}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" [class.expanded]="expanded()" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
        </button>
        <button class="filter-run" type="button" [disabled]="busy() || !valid()" (click)="apply.emit()">
          @if (busy()) { <span class="button-spinner" aria-hidden="true"></span> }
          {{ language() === 'ar' ? (busy() ? 'جاري التحميل' : 'عرض التقرير') : (busy() ? 'Loading' : 'Run report') }}
          @if (!busy()) { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg> }
        </button>
      </div>
    </div>
    <div class="filter-content" [id]="panelId" [hidden]="!expanded()"><ng-content /></div>
  `,
})
export class ReportFilters {
  readonly language = input<'ar' | 'en'>('ar');
  readonly summary = input('');
  protected readonly summaryParts = computed(() => this.summary().split(' · ').filter(Boolean));
  readonly busy = input(false);
  readonly valid = input(true);
  readonly apply = output<void>();
  protected readonly expanded = signal(false);
  protected readonly panelId = `report-filters-${++filterId}`;
}
