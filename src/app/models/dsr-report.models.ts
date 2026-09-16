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
  arrDsrTicketsPhpKey?: DsrTicketRawRow[] | null;
  arrDsrDetailsCountPhpKey?: DsrDetailsCount;
  [sectionName: string]: unknown;
}

export interface DsrTicketRawRow {
  datDatePhpKey?: string | null;
  datIssueDatePhpKey?: string | null;
  strTicketPhpKey?: string | null;
  strDocumentNoPhpKey?: string | null;
  strCustomerNamePhpKey?: string | null;
  strServiceName?: string | null;
  strServiceCode?: string | null;
  strSectorPhpKey?: string | null;
  strCostCenterNamePhpKey?: string | null;
  strAgentNamePhpKey?: string | null;
  strBookingStaffName?: string | null;
  strTaxRegionPhpKey?: string | null;
  strSaleRefundTypePhpKey?: string | null;
  strSalesRefundsTypePhpKey?: string | null;
  dblSellingAmtPhpKey?: number | string | null;
  dblServiceFeePhpKey?: number | string | null;
  dblProfitAmtPhpKey?: number | string | null;
  dblCustomerTaxPhpKey?: number | string | null;
  dblCostAmtPhpKey?: number | string | null;
  dblSupplierAmtPhpKey?: number | string | null;
  [metricName: string]: number | string | null | undefined;
}

export interface DsrDetailsCount {
  intDsrDetailTicketCountPhpKey?: number | string | null;
  arrTotalDetailsTicketPhpKey?: {
    dblServiceFeeSumPhpKey?: number | string | null;
    dblSellingPriceSumPhpKey?: number | string | null;
    dblProfitSumPhpKey?: number | string | null;
    dblCustomerTaxSumPhpKey?: number | string | null;
    dblCostAmtSumPhpKey?: number | string | null;
    intCountPhpKey?: number | string | null;
    [metricName: string]: number | string | null | undefined;
  } | null;
  [metricName: string]: unknown;
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

export interface DsrDetailAggregateRow {
  label: string;
  amount: number;
  profit: number;
  tax: number;
  cost: number;
  count: number;
  saleCount: number;
  refundCount: number;
  margin: number;
  share: number;
}

export interface DsrDetailDocumentRow {
  date: string;
  documentNo: string;
  ticketNo: string;
  service: string;
  customer: string;
  costCenter: string;
  agent: string;
  type: string;
  amount: number;
  profit: number;
  tax: number;
  margin: number;
}

export interface DsrDetailAnalyticsView {
  hasDetails: boolean;
  rowCount: number;
  totalDocumentCount: number;
  totalSelling: number;
  totalProfit: number;
  totalTax: number;
  totalCost: number;
  profitMargin: number;
  avgDocumentValue: number;
  taxableShare: number;
  services: DsrDetailAggregateRow[];
  customers: DsrDetailAggregateRow[];
  costCenters: DsrDetailAggregateRow[];
  agents: DsrDetailAggregateRow[];
  taxRegions: DsrDetailAggregateRow[];
  saleRefundRows: DsrDetailAggregateRow[];
  months: DsrDetailAggregateRow[];
  documents: DsrDetailDocumentRow[];
  maxServiceAmount: number;
  maxCustomerAmount: number;
  maxCostCenterAmount: number;
  maxMonthAmount: number;
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
  detailAnalytics: DsrDetailAnalyticsView | null;
  rawPreview: string;
}

export interface MonthlySaleFilters {
  fromMonth: string;
  fromYear: string;
  toMonth: string;
  toYear: string;
  currency: 'SAR' | 'Base';
  dateType: 'Document Date' | 'Service Date';
  showProfit: boolean;
  showCount: boolean;
}

export interface MonthlySaleRawRow {
  intcustomerid?: number | null;
  fk_bint_service_id?: number | null;
  vchr_account_code?: string | null;
  vchr_account_name?: string | null;
  pk_bint_service_id?: number | null;
  [metricName: string]: number | string | null | undefined;
}

export interface MonthlySaleReportResponse {
  arrSupplierMonthlySaleReportPhpKey?: MonthlySaleRawRow[];
  arrRowTotalValuesPhpKey?: Array<{
    dblRowTotalAmount?: number | string | null;
    dblRowTotalProfit?: number | string | null;
    dblRowTotalCount?: number | string | null;
  }>;
  arrTimePeriodePhpKey?: Array<{
    strColumnHeading?: string;
    datFromDate?: string;
    datToDate?: string;
  }>;
  [sectionName: string]: unknown;
}

export interface MonthlySaleMonthMetric {
  label: string;
  fromDate: string;
  toDate: string;
  amount: number;
  profit: number;
  count: number;
  saleCount: number;
  refundCount: number;
  margin: number;
  change: number | null;
}

export interface MonthlySaleServiceRow {
  id: string;
  code: string;
  name: string;
  amount: number;
  profit: number;
  count: number;
  margin: number;
  share: number;
  avgTicket: number;
  maxMonthAmount: number;
  months: MonthlySaleMonthMetric[];
}

export interface MonthlySaleDashboardView {
  months: MonthlySaleMonthMetric[];
  services: MonthlySaleServiceRow[];
  topServices: MonthlySaleServiceRow[];
  totalAmount: number;
  totalProfit: number;
  totalCount: number;
  grossMargin: number;
  avgMonthlyAmount: number;
  avgTicket: number;
  bestMonth: MonthlySaleMonthMetric | null;
  weakestMonth: MonthlySaleMonthMetric | null;
  topService: MonthlySaleServiceRow | null;
  growthRate: number | null;
  activeServiceCount: number;
  totalSaleCount: number;
  totalRefundCount: number;
  maxMonthlyAmount: number;
  maxServiceAmount: number;
  maxServiceProfit: number;
  maxServiceCount: number;
  maxServiceMargin: number;
  maxHeatAmount: number;
  amountTrendPoints: string;
  profitTrendPoints: string;
  periodLabel: string;
  rawPreview: string;
}

export interface CostCentrePeriodicalFilters {
  fromDate: string;
  toDate: string;
  costCenterId: string;
  costCenterName: string;
  departmentId: string;
  departmentName: string;
}

export interface CostCentrePeriodicalRawRow {
  fk_bint_sub_ledger_id?: number | string | null;
  bint_category?: number | string | null;
  vchr_account_name?: string | null;
  vchr_account_code?: string | null;
  [metricName: string]: number | string | null | undefined;
}

export interface CostCentrePeriodicalCenter {
  vchr_cost_center_name?: string | null;
  pk_bint_cost_center_id?: number | string | null;
}

export interface CostCentrePeriodicalResponse {
  arrCostCenterWiseDetailsPhpKey?: CostCentrePeriodicalRawRow[];
  arrCostCentersPhpKey?: CostCentrePeriodicalCenter[];
  [sectionName: string]: unknown;
}

export interface CostCentreAccountBreakdown {
  costCenterId: string;
  costCenterName: string;
  amount: number;
}

export interface CostCentreAccountRow {
  id: string;
  code: string;
  name: string;
  category: number;
  type: 'revenue' | 'expense' | 'other';
  total: number;
  share: number;
  centerValues: CostCentreAccountBreakdown[];
}

export interface CostCentrePerformanceRow {
  id: string;
  name: string;
  isOperating: boolean;
  revenue: number;
  expense: number;
  net: number;
  margin: number;
  revenueShare: number;
  expenseShare: number;
  topRevenueAccount: string;
  topExpenseAccount: string;
}

export interface CostCentrePeriodicalDashboardView {
  periodLabel: string;
  centers: CostCentrePerformanceRow[];
  accounts: CostCentreAccountRow[];
  revenueAccounts: CostCentreAccountRow[];
  expenseAccounts: CostCentreAccountRow[];
  topRevenueAccounts: CostCentreAccountRow[];
  topExpenseAccounts: CostCentreAccountRow[];
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  profitMargin: number;
  strongestCenter: CostCentrePerformanceRow | null;
  highestExpenseCenter: CostCentrePerformanceRow | null;
  activeCenterCount: number;
  operatingCenterCount: number;
  accountCount: number;
  maxCenterRevenue: number;
  maxCenterExpense: number;
  maxCenterNet: number;
  maxAccountAmount: number;
  rawPreview: string;
}
