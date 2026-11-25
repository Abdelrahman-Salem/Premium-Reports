import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { ExpenseBarItem } from '../models/expense-report.models';

@Component({
  selector: 'app-expense-bars', imports: [DecimalPipe, PercentPipe],
  template: `
    <div class="expense-bars" [class.compact]="compact()" [class.no-ratios]="!showRatios()" role="list" [attr.aria-label]="label()">
      @for (item of items(); track item.id; let first = $first) {
        <div class="expense-bar-row" role="listitem" [class.negative]="item.value < 0"
          [title]="item.label + ': SAR ' + (item.value | number:'1.2-2')">
          <bdi class="bar-label">{{ item.label }}</bdi>
          <div class="bar-track" aria-hidden="true" dir="ltr">
            @if (negative() > 0) { <span class="bar-zero" [style.left.%]="zero()"></span> }
            <i [class.highlight]="highlight() && first && item.value > 0" [class.reversal]="item.value < 0"
              [style.left.%]="zero() + Math.min(0, item.value) / scale() * 100"
              [style.width.%]="Math.abs(item.value) / scale() * 100"></i>
          </div>
          <strong dir="ltr">{{ item.value | number:'1.0-0' }}</strong>
          @if (showRatios()) { <span class="bar-ratio" dir="ltr">{{ item.ratio === null ? '—' : item.ratio < 0 ? (item.ratio | percent:'1.1-2') : (item.ratio | percent:'1.1-1') }}</span> }
        </div>
      }
    </div>`,
  styles: [`
    :host { display: block; min-width: 0; }
    * { box-sizing: border-box; }
    .expense-bars { display: grid; gap: 15px; }
    .expense-bar-row { display: grid; grid-template-columns: minmax(160px,1.25fr) minmax(100px,1.5fr) 98px 52px; align-items: center; gap: 14px; min-width: 0; font-size: 12px; }
    .bar-label { overflow-wrap: anywhere; line-height: 1.6; }
    .bar-track { position: relative; height: 15px; border-radius: 4px; background: #eef1f6; }
    .bar-track i { position: absolute; height: 100%; background: #1b365d; border-radius: 4px; min-width: 0; }
    .bar-track i.highlight { background: #b23a3a; }
    .bar-track i.reversal { background: #9db2d3; }
    .bar-zero { position: absolute; inset-block: -3px; border-left: 1px solid #91a2bb; z-index: 1; }
    strong { font-variant-numeric: tabular-nums; text-align: end; color: #0f2444; font-size: 12px; }
    .bar-ratio { color: #6b6a66; text-align: end; font-size: 11px; }
    .negative strong, .negative .bar-ratio { color: #b23a3a; }
    .no-ratios .expense-bar-row { grid-template-columns: minmax(120px,1.2fr) minmax(65px,1fr) 85px; }
    .compact { gap: 11px; }
    .compact .expense-bar-row { gap: 9px; font-size: 10px; }
    .compact strong { font-size: 11px; }
    .compact .bar-track { height: 10px; }
    @media(max-width:700px) {
      .expense-bar-row, .no-ratios .expense-bar-row { grid-template-columns: minmax(0,1fr) 92px 45px; gap: 7px; }
      .bar-label { grid-column: 1 / -1; }
      .bar-track { grid-column: 1; }
      .no-ratios .expense-bar-row { grid-template-columns: minmax(0,1fr) 85px; }
      strong { font-size: 11px; }
    }
  `],
})
export class ExpenseBars {
  readonly items = input.required<ExpenseBarItem[]>();
  readonly label = input('');
  readonly compact = input(false);
  readonly highlight = input(false);
  readonly showRatios = input(true);
  protected readonly Math = Math;
  protected readonly negative = computed(() => Math.max(0, ...this.items().map((item) => -item.value)));
  protected readonly scale = computed(() => (Math.max(0, ...this.items().map((item) => item.value)) + this.negative()) || 1);
  protected readonly zero = computed(() => this.negative() / this.scale() * 100);
}
