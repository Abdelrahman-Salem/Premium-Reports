import { Component, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { DsrReportService } from './core/services/dsr-report.service';
import { ProfitLossReportService } from './core/services/profit-loss-report.service';
import { CostCentreOverview } from './cost-centre-overview/cost-centre-overview';
import { YearComparison } from './cost-centre-overview/year-comparison';
import { MonthlySalesOverview } from './monthly-sales-overview/monthly-sales-overview';
import { MonthlyYearComparison } from './monthly-sales-overview/monthly-year-comparison';
import { CustomerOverview } from './dsr-overview/customer-overview';
import { DsrYearComparison } from './dsr-overview/dsr-year-comparison';
import {
  CostCentrePeriodicalDashboardView,
  CostCentrePeriodicalFilters,
  CostCentreOption,
  DsrDashboardView,
  DsrCustomerDashboardView,
  DsrFilters,
  DsrMetricRow,
  DsrReportResult,
  MetricCard,
  MonthlySaleServiceRow,
} from './models/dsr-report.models';
import { ProfitLossDashboard, ProfitLossFilters } from './models/profit-loss.models';

type Language = 'en' | 'ar';
const defaultMonthlyYear = String(new Date().getFullYear());
const defaultMonthlyEndMonth = String(new Date().getMonth() + 1);
type ReportMode = 'monthly' | 'dsr' | 'costCentre';
type ReportSection = 'overview' | 'profit' | 'type' | 'payment' | 'payable' | 'expense' | 'raw';

const TRANSLATIONS = {
  en: {
    analytics: 'TRAACS analytics',
    salesDsr: 'Sales DSR',
    finance: 'Finance',
    operations: 'Operations',
    salesReport: 'Sales report',
    monthlyReport: 'Sales Performance Dashboard',
    dsrReport: 'Customer Insights Dashboard',
    costCentrePeriodical: 'Cost Centre Performance Dashboard',
    revenue: 'Revenue',
    grossProfit: 'Gross profit',
    netProfit: 'Net profit',
    totalExpense: 'Total expense',
    activeCostCentres: 'Active cost centres',
    accounts: 'Accounts',
    grossMargin: 'Gross margin',
    documents: 'Documents',
    avgMonthlyRevenue: 'Avg monthly revenue',
    avgTicket: 'Avg ticket',
    bestMonth: 'Best month',
    topService: 'Top service',
    monthlyTrend: 'Monthly trend',
    costCentrePerformance: 'Cost centre performance',
    revenueVsExpense: 'Revenue vs expense',
    accountBreakdown: 'Account breakdown',
    serviceMix: 'Service mix',
    serviceRanking: 'Service ranking',
    revenueHeatmap: 'Revenue heatmap',
    profitVsRevenue: 'Profit vs revenue',
    monthlyServiceTable: 'Monthly service table',
    title: 'Customer Insights Dashboard',
    subtitle:
      'Customer revenue, profit, monthly activity, and service mix from DSR detail rows.',
    liveApi: 'Live API',
    searching: 'Searching',
    search: 'Search',
    exportReport: 'Export PDF',
    openTraacs: 'Open TRAACS login',
    checkSession: 'Check session',
    checkingSession: 'Checking',
    sessionTitle: 'TRAACS access',
    sessionHint: 'Use this panel once after login or whenever the report stops loading.',
    sessionReady: 'TRAACS session is connected.',
    sessionMissing: 'Open TRAACS through this dashboard and sign in once.',
    proxyMissing:
      'TRAACS connection is not available right now. Try again after the deployment finishes.',
    signInFirst: 'Sign in to TRAACS first, then press Check session and search again.',
    noDataOrSession:
      'No report data was returned. If this period should have movement, sign in to TRAACS first and search again.',
    from: 'From',
    to: 'To',
    costCentre: 'Cost Centre',
    allSelected: 'All selected',
    selected: 'selected',
    currency: 'Currency',
    dateType: 'Date type',
    document: 'Document',
    service: 'Service',
    sales: 'Sales',
    refunds: 'Refunds',
    loadError:
      'Unable to load the DSR report from the live API. Open TRAACS login from this dashboard, sign in, then search again.',
    monthlyDataError: 'Could not verify the profit and loss report totals. Please retry the report.',
    noCostCentreError: 'Select at least one cost centre before searching.',
    noReportTitle: 'Choose filters and run a search',
    noReportSubtitle:
      'The dashboard will stay empty until a live TRAACS response is returned for the selected period and cost centres.',
    loadingReport: 'Loading report',
    keyMetrics: 'Key metrics',
    volumeComparison: 'Volume comparison',
    movementTitle: 'Sale, refund, and net movement',
    movementChart: 'Sales movement bar chart',
    commercialHealth: 'Commercial health',
    profitConcentration: 'Profit concentration',
    marginDescription: 'Net profit margin against total net sales volume.',
    saleDocuments: 'Sale documents',
    refundDocuments: 'Refund documents',
    overview: 'Overview',
    payment: 'Payment',
    payable: 'Payable',
    expense: 'Expense',
    type: 'Service type',
    profit: 'Profit',
    raw: 'Raw',
    reportSections: 'Report sections',
    summaryDetails: 'Summary details',
    metric: 'Metric',
    sale: 'Sale',
    refund: 'Refund',
    net: 'Net',
    value: 'Value',
    paymentModeSummary: 'Payment mode summary',
    payableSummary: 'Payable summary',
    profitBreakdown: 'Profit breakdown',
    normalizedResponse: 'Normalized response',
    language: 'عربي',
  },
  ar: {
    analytics: 'تحليلات تراكس',
    salesDsr: 'تقرير المبيعات DSR',
    finance: 'المالية',
    operations: 'العمليات',
    salesReport: 'تقرير المبيعات',
    monthlyReport: 'لوحة أداء مبيعات الخدمات',
    dsrReport: 'لوحة تحليل العملاء',
    revenue: 'الإيراد',
    grossProfit: 'مجمل الربح',
    grossMargin: 'هامش الربح',
    documents: 'المستندات',
    avgMonthlyRevenue: 'متوسط الإيراد الشهري',
    avgTicket: 'متوسط المستند',
    bestMonth: 'أفضل شهر',
    topService: 'أعلى خدمة',
    monthlyTrend: 'اتجاه الشهور',
    serviceMix: 'توزيع الخدمات',
    serviceRanking: 'ترتيب الخدمات',
    revenueHeatmap: 'خريطة الإيراد الحرارية',
    profitVsRevenue: 'الربح مقابل الإيراد',
    monthlyServiceTable: 'جدول الخدمات الشهري',
    title: 'لوحة تحليل العملاء',
    subtitle: 'تحليل إيرادات العملاء وأرباحهم ونشاطهم عبر الشهور والخدمات.',
    liveApi: 'بيانات مباشرة',
    searching: 'جاري البحث',
    search: 'بحث',
    exportReport: 'تصدير PDF',
    openTraacs: 'فتح تسجيل دخول TRAACS',
    checkSession: 'فحص الجلسة',
    checkingSession: 'جاري الفحص',
    sessionTitle: 'اتصال TRAACS',
    sessionHint: 'استخدم الجزء ده بعد تسجيل الدخول أو لو التقرير وقف تحميل.',
    sessionReady: 'جلسة TRAACS متصلة.',
    sessionMissing: 'افتح TRAACS من داخل الداشبورد وسجل الدخول مرة واحدة.',
    proxyMissing: 'اتصال TRAACS غير متاح حاليًا. جرّب مرة أخرى بعد اكتمال النشر.',
    signInFirst: 'سجل الدخول إلى TRAACS أولًا، ثم اضغط فحص الجلسة وابحث مرة أخرى.',
    noDataOrSession:
      'لم ترجع بيانات للتقرير. لو الفترة دي فيها حركة، سجل الدخول إلى TRAACS أولًا ثم ابحث مرة أخرى.',
    from: 'من',
    to: 'إلى',
    costCentre: 'مركز التكلفة',
    allSelected: 'الكل محدد',
    selected: 'محدد',
    currency: 'العملة',
    dateType: 'نوع التاريخ',
    document: 'المستند',
    service: 'الخدمة',
    sales: 'مبيعات',
    refunds: 'مرتجعات',
    loadError:
      'تعذر تحميل تقرير DSR من API المباشر. افتح تسجيل دخول TRAACS من الداشبورد، سجل الدخول، ثم ابحث مرة أخرى.',
    monthlyDataError: 'تعذر التحقق من بيانات الأرباح والخسائر أو مطابقة إجمالياتها. أعد تحميل التقرير.',
    noCostCentreError: 'اختر مركز تكلفة واحد على الأقل قبل البحث.',
    noReportTitle: 'اختر الفلاتر واضغط بحث',
    noReportSubtitle:
      'ستظل اللوحة فارغة حتى يرجع API المباشر بيانات TRAACS للفترة ومراكز التكلفة المحددة.',
    loadingReport: 'تحميل التقرير',
    keyMetrics: 'المؤشرات الرئيسية',
    volumeComparison: 'مقارنة الحركة',
    movementTitle: 'حركة المبيعات والمرتجعات والصافي',
    movementChart: 'رسم بياني لحركة المبيعات',
    commercialHealth: 'الصحة التجارية',
    profitConcentration: 'تركيز الأرباح',
    marginDescription: 'هامش صافي الربح مقارنة بإجمالي صافي المبيعات.',
    saleDocuments: 'مستندات البيع',
    refundDocuments: 'مستندات المرتجع',
    overview: 'نظرة عامة',
    payment: 'الدفع',
    payable: 'المستحقات',
    expense: 'المصروفات',
    type: 'نوع الخدمة',
    profit: 'الأرباح',
    raw: 'البيانات الخام',
    reportSections: 'أقسام التقرير',
    summaryDetails: 'تفاصيل الملخص',
    metric: 'البند',
    sale: 'بيع',
    refund: 'مرتجع',
    net: 'الصافي',
    value: 'القيمة',
    paymentModeSummary: 'ملخص طرق الدفع',
    payableSummary: 'ملخص المستحقات',
    profitBreakdown: 'تفصيل الأرباح',
    normalizedResponse: 'الاستجابة المنظمة',
    costCentrePeriodical: 'لوحة أداء مراكز التكلفة',
    netProfit: '\u0635\u0627\u0641\u064A \u0627\u0644\u0631\u0628\u062D',
    totalExpense: '\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0635\u0631\u0648\u0641',
    activeCostCentres:
      '\u0645\u0631\u0627\u0643\u0632 \u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0646\u0634\u0637\u0629',
    accounts: '\u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A',
    costCentrePerformance:
      '\u0623\u062F\u0627\u0621 \u0645\u0631\u0627\u0643\u0632 \u0627\u0644\u062A\u0643\u0644\u0641\u0629',
    revenueVsExpense:
      '\u0627\u0644\u0625\u064A\u0631\u0627\u062F \u0645\u0642\u0627\u0628\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641',
    accountBreakdown:
      '\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A',
    language: 'English',
  },
} as const;

type TranslationKey = keyof typeof TRANSLATIONS.en;

@Component({
  selector: 'app-root',
  imports: [CostCentreOverview, YearComparison, MonthlySalesOverview, MonthlyYearComparison, CustomerOverview, DsrYearComparison],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly dsrReportService = inject(DsrReportService);
  private readonly profitLossReportService = inject(ProfitLossReportService);
  private readonly monthlyComparison = viewChild(MonthlyYearComparison);
  private readonly dsrComparison = viewChild(DsrYearComparison);
  private readonly costCentreComparison = viewChild(YearComparison);
  private readonly chartColors = [
    '#2e6f73',
    '#c77b32',
    '#6c5b9e',
    '#4c7fae',
    '#9b9483',
    '#b14b4e',
    '#4f9d6e',
    '#1e8f6f',
  ];

  protected readonly reportMode = signal<ReportMode>('monthly');
  protected readonly costCentreView = signal<'report' | 'comparison'>('report');
  protected readonly monthlyView = signal<'report' | 'comparison'>('report');
  protected readonly dsrView = signal<'report' | 'comparison'>('report');
  protected readonly language = signal<Language>('ar');
  protected readonly costCentreOpen = signal(false);
  protected readonly hasSearched = signal(false);
  protected readonly sessionChecking = signal(false);
  protected readonly sessionReady = signal(false);
  protected readonly sessionMessage = signal<string | null>(null);
  protected readonly costCentreOptions: CostCentreOption[] = [
    { id: '1', label: '100 - Head Quarter' },
    { id: '73', label: '808 - AirPort Jeddah' },
    { id: '74', label: '809 - Maintenance' },
    { id: '75', label: '810 - G.S.E' },
    { id: '77', label: 'Medina' },
  ];

  protected readonly filters = signal<DsrFilters>({
    fromDate: '2024-01-01',
    toDate: '2026-09-09',
    costCenters: ['1', '73', '74', '75', '77'],
    currency: 'SAR',
    dateType: 'DOCUMENT',
    showSales: true,
    showRefunds: true,
  });
  protected readonly monthlyFilters = signal<ProfitLossFilters>({
    fromMonth: '1',
    fromYear: defaultMonthlyYear,
    toMonth: defaultMonthlyEndMonth,
    toYear: defaultMonthlyYear,
  });
  protected readonly costCentreFilters = signal<CostCentrePeriodicalFilters>({
    fromDate: '2026-01-01',
    toDate: '2026-09-16',
    costCenterId: '',
    costCenterName: 'ALL',
    departmentId: '1',
    departmentName: 'Default',
  });

  protected readonly report = signal<DsrReportResult | null>(null);
  protected readonly monthlyReport = signal<ProfitLossDashboard | null>(null);
  private monthlyRequestId = 0;
  protected readonly costCentreReport = signal<CostCentrePeriodicalDashboardView | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly activeSection = signal<ReportSection>('overview');

  protected readonly dashboard = computed<DsrDashboardView | null>(() => {
    const report = this.report();
    return report ? this.dsrReportService.toDashboardView(report.data, this.language()) : null;
  });
  protected readonly customerDashboard = computed<DsrCustomerDashboardView | null>(() => {
    const report = this.report();
    return report ? this.dsrReportService.toCustomerDashboardView(report.data) : null;
  });
  protected readonly monthlyDashboard = computed<ProfitLossDashboard | null>(() =>
    this.monthlyReport(),
  );
  protected readonly costCentreDashboard = computed<CostCentrePeriodicalDashboardView | null>(() =>
    this.costCentreReport(),
  );

  protected readonly metricCards = computed<MetricCard[]>(
    () => this.dashboard()?.metricCards ?? [],
  );
  protected readonly comparisonRows = computed<DsrMetricRow[]>(
    () => this.dashboard()?.comparisonRows ?? [],
  );
  protected readonly paymentRows = computed<DsrMetricRow[]>(
    () => this.dashboard()?.paymentRows ?? [],
  );
  protected readonly profitRows = computed<DsrMetricRow[]>(
    () => this.dashboard()?.profitRows ?? [],
  );
  protected readonly payableRows = computed<DsrMetricRow[]>(
    () => this.dashboard()?.payableRows ?? [],
  );
  protected readonly totalVolume = computed(() => this.dashboard()?.totalVolume ?? 0);
  protected readonly displayCurrency = computed(() =>
    this.filters().currency === 'Base' ? 'SAR' : this.filters().currency,
  );
  protected readonly sourceLabel = computed(() => this.t('liveApi'));
  protected readonly direction = computed(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));
  protected readonly typeOfSaleMax = computed(() =>
    Math.max(...(this.dashboard()?.typeOfSaleRows.map((row) => Math.abs(row.amount)) ?? [0]), 1),
  );
  protected readonly periodLabel = computed(
    () => `${this.filters().fromDate} - ${this.filters().toDate}`,
  );
  protected readonly monthlyPeriodLabel = computed(
    () =>
      `${this.monthlyFilters().fromMonth}/${this.monthlyFilters().fromYear} - ${this.monthlyFilters().toMonth}/${this.monthlyFilters().toYear}`,
  );
  protected readonly costCentrePeriodLabel = computed(() => {
    const filters = this.costCentreFilters();
    if (filters.quarters?.length) {
      const quarter = this.language() === 'ar' ? 'الربع' : 'Quarter';
      return `${filters.quarters.map((item) => `${quarter} ${item}`).join(' + ')} (${filters.fromDate.slice(0, 4)})`;
    }
    return `${filters.fromDate} - ${filters.toDate}`;
  });
  protected readonly visiblePeriodLabel = computed(() => {
    if (this.reportMode() === 'monthly') {
      return this.monthlyPeriodLabel();
    }

    return this.reportMode() === 'costCentre' ? this.costCentrePeriodLabel() : this.periodLabel();
  });
  protected readonly reportTitle = computed(() => {
    if (this.reportMode() === 'monthly') {
      return this.t('monthlyReport');
    }

    return this.reportMode() === 'costCentre' ? this.t('costCentrePeriodical') : this.t('title');
  });
  protected readonly reportSubtitle = computed(() => {
    if (this.reportMode() === 'monthly') {
      return this.language() === 'ar'
        ? 'تحليل شهري لإيرادات الخدمات والربحية والحجم مع مقارنة بين الشهور والخدمات.'
        : 'Monthly service revenue, profit, volume, service mix, and performance comparison.';
    }

    if (this.reportMode() === 'costCentre') {
      return this.language() === 'ar'
        ? 'تحليل الإيرادات والمصروفات وصافي الربح حسب مركز التكلفة والحساب خلال الفترة.'
        : 'Revenue, expense, and net profit analysis by cost centre and account for the selected period.';
    }

    return this.t('subtitle');
  });
  protected readonly hasActiveReport = computed(
    () => {
      if (this.reportMode() === 'monthly') {
        return this.monthlyView() === 'comparison'
          ? Boolean(this.monthlyComparison()?.printReady()) : Boolean(this.monthlyDashboard());
      }
      if (this.reportMode() === 'dsr') {
        return this.dsrView() === 'comparison'
          ? Boolean(this.dsrComparison()?.printReady()) : Boolean(this.customerDashboard()?.loadedRows);
      }
      return this.costCentreView() === 'comparison'
        ? Boolean(this.costCentreComparison()?.printReady()) : Boolean(this.costCentreDashboard());
    },
  );
  protected readonly selectedCostCentreLabel = computed(() => {
    const selected = this.filters().costCenters;

    if (this.isAllCostCentresSelected()) {
      return this.t('allSelected');
    }

    if (selected.length === 1) {
      return (
        this.costCentreOptions.find((option) => option.id === selected[0])?.label ??
        this.t('costCentre')
      );
    }

    return `${selected.length} ${this.t('selected')}`;
  });

  constructor() {
    this.checkSession();
  }

  @HostListener('window:focus')
  protected onWindowFocus(): void {
    this.checkSession();
  }

  protected refreshReport(filters: DsrFilters = this.filters()): void {
    if (filters.costCenters.length === 0) {
      this.error.set(this.t('noCostCentreError'));
      return;
    }

    if (!this.sessionReady()) {
      this.hasSearched.set(true);
      this.report.set(null);
      this.error.set(this.t('signInFirst'));
      this.checkSession();
      return;
    }

    this.hasSearched.set(true);
    this.loading.set(true);
    this.error.set(null);
    this.report.set(null);
    this.costCentreOpen.set(false);

    this.dsrReportService.getDsrReport(filters).subscribe({
      next: (result) => {
        if (!this.hasReportData(result)) {
          this.report.set(null);
          this.error.set(this.t('noDataOrSession'));
          this.loading.set(false);
          this.checkSession();
          return;
        }

        this.report.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.sessionReady.set(false);
        this.error.set(this.t('signInFirst'));
        this.checkSession();
      },
    });
  }

  protected showDsrYear(filters: DsrFilters): void {
    this.filters.set(filters);
    this.refreshReport(filters);
  }

  protected refreshMonthlyReport(filters: ProfitLossFilters = this.monthlyFilters()): void {
    const requestId = ++this.monthlyRequestId;
    if (!this.sessionReady()) {
      this.hasSearched.set(true);
      this.monthlyReport.set(null);
      this.error.set(this.t('signInFirst'));
      this.checkSession();
      return;
    }

    this.hasSearched.set(true);
    this.loading.set(true);
    this.error.set(null);
    this.monthlyReport.set(null);

    this.profitLossReportService.getReport(filters).subscribe({
      next: (view) => {
        if (requestId !== this.monthlyRequestId) return;
        if (view.months.length === 0) {
          this.error.set(this.t('noDataOrSession'));
          this.loading.set(false);
          return;
        }

        this.monthlyReport.set(view);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        if (requestId !== this.monthlyRequestId) return;
        this.loading.set(false);
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          this.sessionReady.set(false);
          this.error.set(this.t('signInFirst'));
          this.checkSession();
        } else {
          this.error.set(this.t('monthlyDataError'));
        }
      },
    });
  }

  protected showMonthlyYear(filters: ProfitLossFilters): void {
    this.monthlyFilters.set(filters);
    this.refreshMonthlyReport(filters);
  }

  protected setMonthlyFilters(filters: ProfitLossFilters): void {
    ++this.monthlyRequestId;
    this.monthlyFilters.set(filters);
    this.monthlyReport.set(null);
    this.error.set(null);
    this.loading.set(false);
  }

  protected refreshCostCentreReport(
    filters: CostCentrePeriodicalFilters = this.costCentreFilters(),
  ): void {
    if (!this.sessionReady()) {
      this.hasSearched.set(true);
      this.costCentreReport.set(null);
      this.error.set(this.t('signInFirst'));
      this.checkSession();
      return;
    }

    this.hasSearched.set(true);
    this.loading.set(true);
    this.error.set(null);
    this.costCentreReport.set(null);

    this.dsrReportService.getCostCentrePeriodicalReport(filters).subscribe({
      next: (response) => {
        const view = this.dsrReportService.toCostCentrePeriodicalDashboardView(response, filters);
        if (view.accounts.length === 0) {
          this.error.set(this.t('noDataOrSession'));
          this.loading.set(false);
          return;
        }

        this.costCentreReport.set(view);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.sessionReady.set(false);
        this.error.set(this.t('signInFirst'));
        this.checkSession();
      },
    });
  }

  protected showCostCentreYear(filters: CostCentrePeriodicalFilters): void {
    this.costCentreFilters.set(filters);
    this.refreshCostCentreReport(filters);
  }

  protected openTraacsLogin(): void {
    window.open(this.dsrReportService.getTraacsLoginUrl(), '_blank', 'noopener,noreferrer');
  }

  protected checkSession(): void {
    this.sessionChecking.set(true);
    this.sessionMessage.set(null);

    this.dsrReportService.getSessionStatus().subscribe({
      next: (status) => {
        this.sessionChecking.set(false);
        this.sessionReady.set(status.hasCookie);
        this.sessionMessage.set(
          status.hasCookie ? this.t('sessionReady') : this.t('sessionMissing'),
        );
      },
      error: () => {
        this.sessionChecking.set(false);
        this.sessionReady.set(false);
        this.sessionMessage.set(this.t('proxyMissing'));
      },
    });
  }

  protected t(key: TranslationKey): string {
    return TRANSLATIONS[this.language()][key];
  }

  protected updateFilter<K extends keyof DsrFilters>(key: K, value: DsrFilters[K]): void {
    this.filters.update((current) => ({ ...current, [key]: value }));
  }

  protected updateMonthlyFilter<K extends keyof ProfitLossFilters>(
    key: K,
    value: ProfitLossFilters[K],
  ): void {
    this.monthlyFilters.update((current) => ({ ...current, [key]: value }));
  }

  protected updateCostCentreFilter<K extends keyof CostCentrePeriodicalFilters>(
    key: K,
    value: CostCentrePeriodicalFilters[K],
  ): void {
    this.costCentreFilters.update((current) => ({ ...current, [key]: value }));
  }

  protected updateCostCentreSelection(costCenterId: string): void {
    const selected = this.costCentreOptions.find((option) => option.id === costCenterId);
    this.costCentreFilters.update((current) => ({
      ...current,
      costCenterId,
      costCenterName: selected?.label ?? 'ALL',
    }));
  }

  protected setReportMode(mode: ReportMode): void {
    this.reportMode.set(mode);
    this.error.set(null);
    this.hasSearched.set(false);
    this.costCentreOpen.set(false);
  }

  protected toggleLanguage(): void {
    this.language.update((current) => (current === 'en' ? 'ar' : 'en'));
  }

  protected toggleCostCentreDropdown(): void {
    this.costCentreOpen.update((isOpen) => !isOpen);
  }

  protected isAllCostCentresSelected(): boolean {
    return this.filters().costCenters.length === this.costCentreOptions.length;
  }

  protected isCostCentreSelected(id: string): boolean {
    return this.filters().costCenters.includes(id);
  }

  protected toggleAllCostCentres(checked: boolean): void {
    this.updateFilter(
      'costCenters',
      checked ? this.costCentreOptions.map((option) => option.id) : [],
    );
  }

  protected toggleCostCentre(id: string, checked: boolean): void {
    const current = this.filters().costCenters;
    const next = checked ? [...new Set([...current, id])] : current.filter((item) => item !== id);
    this.updateFilter('costCenters', next);
  }

  protected setSection(section: ReportSection): void {
    this.activeSection.set(section);
  }

  protected barWidth(value: number): string {
    const max = Math.max(this.totalVolume(), 1);
    return `${Math.min((Math.abs(value) / max) * 100, 100)}%`;
  }

  protected monthlyBarWidth(value: number, max: number): string {
    return `${Math.min((Math.abs(value) / Math.max(max, 1)) * 100, 100)}%`;
  }

  protected monthlyBarHeight(value: number, max: number): string {
    return `${Math.max(Math.min((Math.abs(value) / Math.max(max, 1)) * 100, 100), value === 0 ? 0 : 4)}%`;
  }

  protected heatOpacity(value: number, max: number): number {
    return Math.max(0.08, Math.min(Math.abs(value) / Math.max(max, 1), 1));
  }

  protected normalizedWidth(value: number, max: number): string {
    return `${Math.min((Math.abs(value) / Math.max(max, 1)) * 100, 100)}%`;
  }

  protected compactMoney(value: number): string {
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue >= 1_000_000) {
      return `${sign}${(absValue / 1_000_000).toFixed(absValue >= 10_000_000 ? 0 : 2)}M`;
    }

    if (absValue >= 1_000) {
      return `${sign}${(absValue / 1_000).toFixed(absValue >= 100_000 ? 0 : 1)}K`;
    }

    return `${value.toFixed(0)}`;
  }

  protected formatMoney(
    value: number | null | undefined,
    currency: string = 'SAR',
    maxFractionDigits = 0,
    minFractionDigits = 0,
  ): string {
    const displayCode = currency === 'Base' ? 'SAR' : currency;
    const numericValue = Number(value ?? 0);
    const formattedValue = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
    }).format(Number.isFinite(numericValue) ? numericValue : 0);

    return `${displayCode} ${formattedValue}`;
  }

  protected heatmapColumns(monthCount: number): string {
    return `minmax(220px, 280px) repeat(${monthCount}, minmax(96px, 1fr))`;
  }

  protected serviceColor(index: number): string {
    return this.chartColors[index % this.chartColors.length];
  }

  protected shareDonutGradient(services: MonthlySaleServiceRow[]): string {
    let start = 0;
    const segments = services.map((service, index) => {
      const end = start + Math.max(service.share, 0) * 360;
      const segment = `${this.serviceColor(index)} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
      start = end;
      return segment;
    });

    return `conic-gradient(${segments.join(', ')})`;
  }

  protected serviceBubbleLeft(service: MonthlySaleServiceRow): number {
    return 12 + (Math.max(0, Math.min(service.share, 0.42)) / 0.42) * 76;
  }

  protected serviceBubbleTop(service: MonthlySaleServiceRow): number {
    return 86 - Math.max(0, Math.min(service.margin, 1)) * 68;
  }

  protected serviceBubbleSize(service: MonthlySaleServiceRow, maxAmount: number): number {
    return 18 + Math.min(Math.sqrt(Math.abs(service.amount) / Math.max(maxAmount, 1)), 1) * 22;
  }

  protected typeBarWidth(value: number): string {
    return `${Math.min((Math.abs(value) / this.typeOfSaleMax()) * 100, 100)}%`;
  }

  protected gaugeDegrees(value: number): number {
    return Math.max(0, Math.min(value, 1)) * 180;
  }

  protected valueClass(value: number): string {
    if (value < 0) {
      return 'neg';
    }

    return value === 0 ? 'dim' : '';
  }

  protected exportCurrentReport(): void {
    if (!this.hasActiveReport() || this.loading()) return;
    const previousTitle = document.title;
    const mode = this.reportMode();
    const view = mode === 'monthly' ? this.monthlyView() : mode === 'dsr' ? this.dsrView() : this.costCentreView();
    document.title = `First Premium Support Services - ${this.reportTitle()} - ${view}${view === 'report' ? ` - ${this.visiblePeriodLabel()}` : ''}`;
    window.addEventListener('afterprint', () => { document.title = previousTitle; }, { once: true });
    window.print();
  }

  protected trackByLabel(_: number, row: DsrMetricRow | MetricCard): string {
    return row.label;
  }

  private hasReportData(result: DsrReportResult): boolean {
    return Boolean(
      result.data.arrDsrDetailsSummaryDataPhpKey?.arrDsrDetailsSummaryDesPhpKey ||
      result.data.arrDsrTicketsPhpKey?.length,
    );
  }
}
