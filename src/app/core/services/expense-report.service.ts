import { Injectable, inject } from '@angular/core';
import { ExecutivePerformanceService } from './executive-performance.service';
import { ExecutiveFilters } from '../../models/executive-performance.models';
import { CostCentreOption } from '../../models/dsr-report.models';

@Injectable({ providedIn: 'root' })
export class ExpenseReportService {
  private readonly finance = inject(ExecutivePerformanceService);

  getReport(filters: ExecutiveFilters, options: CostCentreOption[]) {
    return this.finance.getFinanceReport(filters, options);
  }
}
