export type ReportSource = 'api';
export type DsrBucket = 'Sale' | 'Refund' | 'Net' | 'Profit';

export interface DsrFilters {
  fromDate: string;
  toDate: string;
  costCenters: string[];
  currency: 'SAR' | 'Base';
  dateType: 'DOCUMENT' | 'SERVICE';
  showSales: boolean;
  showRefunds: boolean;
}

export interface CostCentreOption {
  id: string;
  label: string;
}

export interface NumericMetricMap {
  [metricName: string]: number | string | undefined;
}

export type DsrMetricGroup = Partial<Record<DsrBucket, NumericMetricMap>>;

export interface DsrSummaryData {
  arrDsrDetailsSummaryDesPhpKey?: DsrMetricGroup;
  arrDsrDetailsSummaryMopPhpKey?: DsrMetricGroup;
  arrDsrDetailsSummaryTypeOfSalePhpKey?: DsrMetricGroup;
  arrDsrDetailsSummaryPayableSummaryPhpKey?: DsrMetricGroup;
  arrDsrDetailsSummaryProfitPhpKey?: DsrMetricGroup;
  arrDsrDetailsSummaryExpensePhpKey?: DsrMetricGroup;
}

export interface DsrReportResponse {
  arrDsrDetailsSummaryDataPhpKey?: DsrSummaryData;
  [sectionName: string]: unknown;
}

export interface DsrReportResult {
  data: DsrReportResponse;
  source: ReportSource;
  receivedAt: Date;
}

export interface MetricCard {
  label: string;
  value: number;
  helper: string;
  tone: 'net' | 'sale' | 'refund' | 'profit';
  icon: 'net' | 'sale' | 'refund' | 'profit' | 'tax' | 'discount' | 'fee' | 'supplier';
}

export interface DsrMetricRow {
  label: string;
  value: number;
}

export interface DsrSummaryRow {
  label: string;
  sale: number;
  refund: number;
  net: number;
}

export interface DsrPaymentRow {
  label: string;
  tone: 'net' | 'sale' | 'refund' | 'profit';
  count: number | null;
  amount: number;
}

export interface DsrPayableRow {
  label: string;
  tone: 'net' | 'sale' | 'refund' | 'profit';
  cost: number;
  supplier: number;
}

export interface DsrTypeOfSaleRow {
  label: string;
  count: number;
  amount: number;
}

export interface DsrDashboardView {
  metricCards: MetricCard[];
  comparisonRows: DsrMetricRow[];
  paymentRows: DsrMetricRow[];
  payableRows: DsrMetricRow[];
  profitRows: DsrMetricRow[];
  summaryRows: DsrSummaryRow[];
  profitSummaryRows: DsrSummaryRow[];
  expenseRows: DsrSummaryRow[];
  paymentSummaryRows: DsrPaymentRow[];
  payableSummaryRows: DsrPayableRow[];
  typeOfSaleRows: DsrTypeOfSaleRow[];
  hasExpenses: boolean;
  totalVolume: number;
  saleCount: number;
  refundCount: number;
  profitMargin: number;
  rawPreview: string;
}
