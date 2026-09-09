import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DsrReportService } from './core/services/dsr-report.service';
import {
  CostCentreOption,
  DsrDashboardView,
  DsrFilters,
  DsrMetricRow,
  DsrReportResult,
  MetricCard,
} from './models/dsr-report.models';

type Language = 'en' | 'ar';
type ReportSection = 'overview' | 'profit' | 'type' | 'payment' | 'payable' | 'expense' | 'raw';

const TRANSLATIONS = {
  en: {
    analytics: 'TRAACS analytics',
    salesDsr: 'Sales DSR',
    finance: 'Finance',
    operations: 'Operations',
    salesReport: 'Sales report',
    title: 'DSR Details Dashboard',
    subtitle: 'Daily sales report summary for sale, refund, net, profit, tax, and payment movement.',
    liveApi: 'Live API',
    searching: 'Searching',
    search: 'Search',
    exportReport: 'Export report',
    openTraacs: 'Open TRAACS login',
    checkSession: 'Check session',
    checkingSession: 'Checking',
    sessionTitle: 'TRAACS access',
    sessionHint: 'Use this panel once after login or whenever the report stops loading.',
    sessionReady: 'TRAACS session is connected.',
    sessionMissing: 'Open TRAACS through this dashboard and sign in once.',
    proxyMissing: 'Local TRAACS proxy is not running. Start the API proxy, then try again.',
    signInFirst: 'Sign in to TRAACS first, then press Check session and search again.',
    noDataOrSession: 'No report data was returned. If this period should have movement, sign in to TRAACS first and search again.',
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
    title: 'لوحة تفاصيل DSR',
    subtitle: 'ملخص يومي للمبيعات والمرتجعات والصافي والأرباح والضرائب وحركة الدفع.',
    liveApi: 'بيانات مباشرة',
    searching: 'جاري البحث',
    search: 'بحث',
    exportReport: 'تصدير التقرير',
    openTraacs: 'فتح تسجيل دخول TRAACS',
    checkSession: 'فحص الجلسة',
    checkingSession: 'جاري الفحص',
    sessionTitle: 'اتصال TRAACS',
    sessionHint: 'استخدم الجزء ده بعد تسجيل الدخول أو لو التقرير وقف تحميل.',
    sessionReady: 'جلسة TRAACS متصلة.',
    sessionMissing: 'افتح TRAACS من داخل الداشبورد وسجل الدخول مرة واحدة.',
    proxyMissing: 'البروكسي المحلي الخاص بـ TRAACS غير شغال. شغل API proxy ثم جرّب مرة أخرى.',
    signInFirst: 'سجل الدخول إلى TRAACS أولًا، ثم اضغط فحص الجلسة وابحث مرة أخرى.',
    noDataOrSession: 'لم ترجع بيانات للتقرير. لو الفترة دي فيها حركة، سجل الدخول إلى TRAACS أولًا ثم ابحث مرة أخرى.',
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
    loadError: 'تعذر تحميل تقرير DSR من API المباشر. افتح تسجيل دخول TRAACS من الداشبورد، سجل الدخول، ثم ابحث مرة أخرى.',
    noCostCentreError: 'اختر مركز تكلفة واحد على الأقل قبل البحث.',
    noReportTitle: 'اختر الفلاتر واضغط بحث',
    noReportSubtitle: 'ستظل اللوحة فارغة حتى يرجع API المباشر بيانات TRAACS للفترة ومراكز التكلفة المحددة.',
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
    language: 'English',
  },
} as const;

type TranslationKey = keyof typeof TRANSLATIONS.en;

@Component({
  selector: 'app-root',
  imports: [CurrencyPipe, DecimalPipe, FormsModule, PercentPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly dsrReportService = inject(DsrReportService);

  protected readonly language = signal<Language>('ar');
  protected readonly costCentreOpen = signal(false);
  protected readonly hasSearched = signal(false);
  protected readonly sessionChecking = signal(false);
  protected readonly sessionReady = signal(false);
  protected readonly traacsLoginUrl = signal(this.dsrReportService.getTraacsLoginUrl());
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

  protected readonly report = signal<DsrReportResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly activeSection = signal<ReportSection>('overview');

  protected readonly dashboard = computed<DsrDashboardView | null>(() => {
    const report = this.report();
    return report ? this.dsrReportService.toDashboardView(report.data, this.language()) : null;
  });

  protected readonly metricCards = computed<MetricCard[]>(() => this.dashboard()?.metricCards ?? []);
  protected readonly comparisonRows = computed<DsrMetricRow[]>(() => this.dashboard()?.comparisonRows ?? []);
  protected readonly paymentRows = computed<DsrMetricRow[]>(() => this.dashboard()?.paymentRows ?? []);
  protected readonly profitRows = computed<DsrMetricRow[]>(() => this.dashboard()?.profitRows ?? []);
  protected readonly payableRows = computed<DsrMetricRow[]>(() => this.dashboard()?.payableRows ?? []);
  protected readonly totalVolume = computed(() => this.dashboard()?.totalVolume ?? 0);
  protected readonly displayCurrency = computed(() => (this.filters().currency === 'Base' ? 'SAR' : this.filters().currency));
  protected readonly sourceLabel = computed(() => this.t('liveApi'));
  protected readonly direction = computed(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));
  protected readonly typeOfSaleMax = computed(() =>
    Math.max(...(this.dashboard()?.typeOfSaleRows.map((row) => Math.abs(row.amount)) ?? [0]), 1),
  );
  protected readonly periodLabel = computed(() => `${this.filters().fromDate} - ${this.filters().toDate}`);

  protected readonly selectedCostCentreLabel = computed(() => {
    const selected = this.filters().costCenters;

    if (this.isAllCostCentresSelected()) {
      return this.t('allSelected');
    }

    if (selected.length === 1) {
      return this.costCentreOptions.find((option) => option.id === selected[0])?.label ?? this.t('costCentre');
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

  protected refreshReport(): void {
    if (this.filters().costCenters.length === 0) {
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

    this.dsrReportService.getDsrReport(this.filters()).subscribe({
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

  protected openTraacsLogin(): void {
    window.open(this.traacsLoginUrl(), '_blank', 'noopener');
  }

  protected checkSession(): void {
    this.sessionChecking.set(true);
    this.sessionMessage.set(null);

    this.dsrReportService.getSessionStatus().subscribe({
      next: (status) => {
        this.sessionChecking.set(false);
        this.sessionReady.set(status.hasCookie);
        this.traacsLoginUrl.set(status.loginUrl);
        this.sessionMessage.set(status.hasCookie ? this.t('sessionReady') : this.t('sessionMissing'));
      },
      error: () => {
        this.sessionChecking.set(false);
        this.sessionReady.set(false);
        this.traacsLoginUrl.set(this.dsrReportService.getTraacsLoginUrl());
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
    this.updateFilter('costCenters', checked ? this.costCentreOptions.map((option) => option.id) : []);
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

  protected exportReport(): void {
    const report = this.report();
    if (!report) {
      return;
    }

    const blob = new Blob([JSON.stringify(report.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dsr-report-${this.filters().fromDate}-${this.filters().toDate}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected trackByLabel(_: number, row: DsrMetricRow | MetricCard): string {
    return row.label;
  }

  private hasReportData(result: DsrReportResult): boolean {
    return Boolean(result.data.arrDsrDetailsSummaryDataPhpKey?.arrDsrDetailsSummaryDesPhpKey);
  }
}
