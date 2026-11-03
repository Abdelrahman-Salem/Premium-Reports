import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

export interface PerformanceColumn { id: string; label: string; value: number; ratio: number | null; color?: string; }

@Component({
  selector: 'app-performance-columns', imports: [DecimalPipe, PercentPipe],
  template: `
    <div class="column-scroll" tabindex="0" [attr.aria-label]="label()">
      <div class="reference-columns" [class.without-ratios]="!showRatios()" [style.--column-count]="items().length" [style.grid-template-columns]="'repeat(' + items().length + ', minmax(64px, 1fr))'" dir="ltr">
        @for (item of items(); track item.id) {
          <div class="reference-column" [title]="item.label + ': ' + unit() + ' ' + (item.value | number:'1.2-2')">
            <div class="plot">
              <span class="zero-line" [style.bottom.%]="zero()"></span>
              <i [style.background]="item.value < 0 ? '#c83f48' : (item.color || (item.value === highest() ? '#1c3c6c' : '#4b6c9b'))"
                [style.bottom.%]="bottom(item.value)" [style.height.%]="height(item.value)"></i>
              <strong class="value" [class.loss]="item.value < 0" [style.bottom.%]="item.value >= 0 ? bottom(item.value) + height(item.value) + 1 : null"
                [style.top.%]="item.value < 0 ? 101 - bottom(item.value) : null">{{ compact() ? short(item.value) : (item.value | number:'1.0-0') }}</strong>
            </div>
            <bdi>{{ item.label }}</bdi>
            @if (showRatios()) { <span class="ratio" [class.loss]="item.ratio !== null && item.ratio < 0">{{ item.ratio === null ? '-' : (item.ratio | percent:'1.1-1') }}</span> }
          </div>
        }
      </div>
    </div>`,
  styles: [`
    :host { display: block; min-width: 0; }
    * { box-sizing: border-box; letter-spacing: 0; }
    .column-scroll { overflow-x: auto; padding-top: 16px; padding-bottom: 6px; }
    .reference-columns { display: grid; gap: 10px; }
    .reference-column { min-width: 0; display: grid; grid-template-rows: 220px minmax(32px, auto) 20px; gap: 8px; text-align: center; }
    .without-ratios .reference-column { grid-template-rows: 220px minmax(32px, auto); }
    .plot { position: relative; min-width: 0; }
    .plot i { display: block; position: absolute; left: 18%; width: 64%; border-radius: 3px 3px 0 0; }
    .zero-line { position: absolute; left: 0; right: 0; border-top: 1px solid #dce3ed; }
    .value { position: absolute; left: 0; right: 0; color: #192d50; font: 600 11px Arial, sans-serif; overflow-wrap: anywhere; }
    bdi { color: #60718a; font: 11px/1.5 Arial, sans-serif; overflow-wrap: anywhere; align-self: start; }
    .ratio { color: #219669; font: 11px Arial, sans-serif; }
    .loss { color: #c83f48; }
    @media print { .column-scroll { overflow: visible; padding-top: 10px; } .reference-columns { grid-template-columns: repeat(var(--column-count, 12), minmax(0,1fr)) !important; gap: 5px; } .reference-column { grid-template-rows: 165px minmax(28px, auto) 16px; gap: 6px; } }
  `],
})
export class PerformanceColumns {
  readonly items = input.required<PerformanceColumn[]>();
  readonly label = input('');
  readonly compact = input(false);
  readonly showRatios = input(true);
  readonly unit = input('SAR');
  protected readonly highest = computed(() => Math.max(0, ...this.items().map((item) => item.value)));
  protected readonly lowest = computed(() => Math.max(0, ...this.items().map((item) => -item.value)));
  protected readonly scale = computed(() => (this.highest() + this.lowest()) * 1.25 || 1);
  protected readonly zero = computed(() => this.lowest() * 1.25 / this.scale() * 100);
  protected bottom(value: number): number { return this.zero() + Math.min(0, value) / this.scale() * 100; }
  protected height(value: number): number { return Math.abs(value) / this.scale() * 100; }
  protected short(value: number): string {
    const magnitude = Math.abs(value);
    return magnitude >= 1000000 ? `${(value / 1000000).toFixed(2)}M` : magnitude >= 1000 ? `${Math.round(value / 1000)}K` : String(Math.round(value));
  }
}
