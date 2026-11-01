import { DsrCustomerDashboardView } from './dsr-report.models';
import { ProfitLossDashboard } from './profit-loss.models';

export interface ExecutiveFilters {
  fromMonth: string;
  toMonth: string;
  quarters: number[];
  costCenterIds: string[];
}

export interface ExecutivePeriod {
  fromDate: string;
  toDate: string;
  monthKeys: string[];
}

export interface ExecutiveReport {
  finance: ProfitLossDashboard;
  customers: DsrCustomerDashboardView;
  periods: ExecutivePeriod[];
  centerNames: string[];
  receivedAt: Date;
}

export class ExecutiveReportError extends Error {
  constructor(readonly reason: 'period' | 'scope' | 'incomplete' | 'reconciliation') {
    super(`Executive report validation failed: ${reason}`);
  }
}

export function executivePeriods(filters: ExecutiveFilters): ExecutivePeriod[] {
  const monthIndex = (value: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new ExecutiveReportError('period');
    const [year, month] = value.split('-').map(Number);
    if (year < 1900 || year > 2100) throw new ExecutiveReportError('period');
    return year * 12 + month - 1;
  };
  const first = monthIndex(filters.fromMonth);
  const last = monthIndex(filters.toMonth);
  if (first > last || !filters.costCenterIds.length) throw new ExecutiveReportError('period');
  let indices = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  if (filters.quarters.length) {
    const year = Math.floor(first / 12);
    if (year !== Math.floor(last / 12) || filters.quarters.some((q) => !Number.isInteger(q) || q < 1 || q > 4)) {
      throw new ExecutiveReportError('period');
    }
    indices = [...new Set(filters.quarters)].sort().flatMap((q) => [0, 1, 2].map((m) => year * 12 + (q - 1) * 3 + m));
  }
  const groups: number[][] = [];
  for (const index of indices) {
    const group = groups.at(-1);
    if (group && group.at(-1)! + 1 === index) group.push(index);
    else groups.push([index]);
  }
  const month = (index: number) => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
  return groups.map((group) => {
    const end = group.at(-1)!;
    const day = new Date(Date.UTC(Math.floor(end / 12), end % 12 + 1, 0)).getUTCDate();
    return { fromDate: `${month(group[0])}-01`, toDate: `${month(end)}-${day}`,
      monthKeys: group.map((index) => month(index).replace('-', '')) };
  });
}
