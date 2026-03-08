import {
  Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

declare var Chart: any;
declare var flatpickr: any;

// ── API 1: summary scalars ──
interface AnalyticsResponse {
  totalIncome:      number;
  totalExpense:     number;
  netProfit:        number;
  expenseBreakdown: { category: string; amount: number }[];
  todayIncome:      number;
  todayExpense:     number;
  monthlyIncome:    number;
  monthlyExpense:   number;
  monthlyNetProfit: number;
  yearlyIncome:     number;
  yearlyExpense:    number;
}

// ── API 2: chart data ──
interface ChartDataPoint {
  label:   string;
  income:  number;
  expense: number;
}
interface ChartApiResponse {
  period:   string;
  category: string;
  data:     ChartDataPoint[];
}

// Period values accepted by API 2
type ChartPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'QUARTERLY' | 'FINANCIAL_YEAR' | 'PREVIOUS_YEAR';

@Component({
  selector:    'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls:   ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('incomeExpenseCanvas') incomeExpenseCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('expensePieCanvas')    expensePieCanvas!:    ElementRef<HTMLCanvasElement>;
  @ViewChild('profitCanvas')        profitCanvas!:        ElementRef<HTMLCanvasElement>;

  private readonly BASE     = 'http://192.168.1.39:3000';
  private readonly BASE_API = 'http://192.168.1.21:8080';

  // ── Header ──
  headerRoleLabel = '';

  // ── Analytics data (API 1) ──
  analyticsData: AnalyticsResponse | null = null;
  isLoading  = false;
  apiError   = '';

  // ── Metric card values ──
  metricTodayIncome    = '₹0';
  metricTodayExpense   = '₹0';
  metricMonthlyIncome  = '₹0';
  metricMonthlyExpense = '₹0';
  metricNetProfit      = '₹0';
  metricTotalIncome    = '₹0';
  metricTotalExpense   = '₹0';
  metricYearlyIncome   = '₹0';
  metricYearlyExpense  = '₹0';
  metricRangeNetProfit = '₹0';

  // ── Filter state ──
  currentPeriod    = 'monthly';
  currentSession   = 'all-sessions';
  currentCategory  = 'all';
  currentDateRange: string | null = null;
  rangeStart: Date | null = null;
  rangeEnd:   Date | null = null;

  // ── Active tag labels ──
  activeFilterTag   = 'Monthly';
  activeSessionTag  = '';
  activeCategoryTag = '';
  activeDateTag     = '';

  // ── Chart subtitles ──
  incomeExpenseSubtitle = 'Monthly';
  expensePieSubtitle    = 'All Categories';
  profitSubtitle        = 'Monthly';

  // ── Chart instances ──
  private incomeExpenseChart: any = null;
  private expensePieChart:    any = null;
  private profitChart:        any = null;
  private fpInstance:         any = null;
  private toastTimer:         any;

  // ── Toast ──
  toastMessage = '';
  toastType    = '';
  toastVisible = false;

  readonly PIE_COLORS = [
    '#FF8C00','#4CAF50','#EF5350','#2196F3',
    '#9C27B0','#FFB74D','#00BCD4','#795548'
  ];

  readonly PERIOD_LABELS: Record<string, string> = {
    daily:            'Today',
    weekly:           'This Week',
    monthly:          'This Month',
    quarterly:        'This Quarter',
    'financial-year': 'Financial Year',
    'prev-year':      'Previous Year',
  };

  readonly SESSION_LABELS: Record<string, string> = {
    'all-sessions': 'All Sessions', breakfast: 'Breakfast',
    brunch: 'Brunch', lunch: 'Lunch', snacks: 'Snacks', dinner: 'Dinner',
  };

  // Map UI period → API 2 period enum
  private readonly PERIOD_TO_CHART_API: Record<string, ChartPeriod> = {
    daily:            'DAILY',
    weekly:           'WEEKLY',
    monthly:          'MONTHLY',
    quarterly:        'QUARTERLY',
    'financial-year': 'FINANCIAL_YEAR',
    'prev-year':      'PREVIOUS_YEAR',
  };

  constructor(
    private http:        HttpClient,
    private router:      Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadHeaderProfile();
    this.fetchAll();
  }

  ngAfterViewInit(): void {
    this.buildCharts();
    this.initFlatpickr();
  }

  ngOnDestroy(): void {
    [this.incomeExpenseChart, this.expensePieChart, this.profitChart]
      .forEach(c => { if (c) c.destroy(); });
    if (this.fpInstance) this.fpInstance.destroy();
    clearTimeout(this.toastTimer);
  }

  // ════════════════════════════════════════
  // PROFILE
  // ════════════════════════════════════════

  loadHeaderProfile(): void {
    try {
      const authUser = this.authService.getCurrentUser();
      if (authUser) this.headerRoleLabel = (authUser.role || 'admin').toUpperCase();
      const raw = localStorage.getItem('ftProfile');
      if (raw) { const p = JSON.parse(raw); if (p.role) this.headerRoleLabel = p.role.toUpperCase(); }
    } catch (e) { this.headerRoleLabel = 'ADMIN'; }
  }

  // ════════════════════════════════════════
  // DATE HELPERS  (for API 1 only)
  // ════════════════════════════════════════

  private toApiDate(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${d.getFullYear()}`;
  }

  private getDateRange(): { startDate: string; endDate: string } {
    const now   = new Date();
    const today = this.toApiDate(now);

    if (this.rangeStart && this.rangeEnd)
      return { startDate: this.toApiDate(this.rangeStart), endDate: this.toApiDate(this.rangeEnd) };

    switch (this.currentPeriod) {
      case 'daily':
        return { startDate: today, endDate: today };
      case 'weekly': {
        const day = now.getDay();
        const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        return { startDate: this.toApiDate(mon), endDate: today };
      }
      case 'monthly': {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: this.toApiDate(first), endDate: today };
      }
      case 'quarterly': {
        const q     = Math.floor(now.getMonth() / 3);
        const first = new Date(now.getFullYear(), q * 3, 1);
        return { startDate: this.toApiDate(first), endDate: today };
      }
      case 'financial-year': {
        const fyStart = now.getMonth() >= 3
          ? new Date(now.getFullYear(), 3, 1)
          : new Date(now.getFullYear() - 1, 3, 1);
        return { startDate: this.toApiDate(fyStart), endDate: today };
      }
      case 'prev-year': {
        const prevStart = new Date(now.getFullYear() - 1, 0, 1);
        const prevEnd   = new Date(now.getFullYear() - 1, 11, 31);
        return { startDate: this.toApiDate(prevStart), endDate: this.toApiDate(prevEnd) };
      }
      default:
        return { startDate: today, endDate: today };
    }
  }

  // ════════════════════════════════════════
  // FETCH BOTH APIs IN PARALLEL
  // ════════════════════════════════════════

  fetchAll(): void {
    this.isLoading = true;
    this.apiError  = '';

    const userId               = this.authService.getCurrentUserId();
    const { startDate, endDate } = this.getDateRange();

    // API 1 — summary scalars
    const url1 = `${this.BASE}/analytics/user/${userId}?startDate=${startDate}&endDate=${endDate}`;

    // API 2 — chart data
    // For custom date range we fall back to MONTHLY bars (API 2 doesn't take a date range)
    const chartPeriod: ChartPeriod = this.currentDateRange
      ? 'MONTHLY'
      : (this.PERIOD_TO_CHART_API[this.currentPeriod] || 'MONTHLY');
    const url2 = `${this.BASE}/analytics/income-expense?ownerId=${userId}&period=${chartPeriod}&category=ALL`;

    console.log('[Dashboard] API1:', url1);
    console.log('[Dashboard] API2:', url2);

    // Fire both together
    this.http.get<AnalyticsResponse>(url1).subscribe({
      next: (summary) => {
        this.analyticsData = summary;
        this.updateMetricCards(summary);

        this.http.get<ChartApiResponse>(url2).subscribe({
          next: (chart) => {
            this.isLoading = false;
            this.updateAllCharts(summary, chart.data);
          },
          error: (err) => {
            console.error('[Dashboard] Chart API error:', err);
            this.isLoading = false;
            // Degrade gracefully — show 2-bar daily fallback using summary
            const fallback: ChartDataPoint[] = [
              { label: 'Income',  income: summary.totalIncome,  expense: 0 },
              { label: 'Expense', income: 0, expense: summary.totalExpense },
            ];
            this.updateAllCharts(summary, fallback);
            this.showToast('Chart data unavailable, showing totals only', 'error');
          }
        });
      },
      error: (err) => {
        console.error('[Dashboard] Summary API error:', err);
        this.apiError  = 'Failed to load analytics data.';
        this.isLoading = false;
        this.showToast('Failed to load analytics', 'error');
      }
    });
  }

  // Alias used by HTML retry button and filter resets
  fetchAnalytics(): void { this.fetchAll(); }

  // ════════════════════════════════════════
  // UPDATE METRIC CARDS
  // ════════════════════════════════════════

  private updateMetricCards(data: AnalyticsResponse): void {
    this.metricTodayIncome    = this.inr(data.todayIncome);
    this.metricTodayExpense   = this.inr(data.todayExpense);
    this.metricMonthlyIncome  = this.inr(data.monthlyIncome);
    this.metricMonthlyExpense = this.inr(data.monthlyExpense);
    this.metricNetProfit      = this.inr(data.monthlyNetProfit);
    this.metricTotalIncome    = this.inr(data.totalIncome);
    this.metricTotalExpense   = this.inr(data.totalExpense);
    this.metricYearlyIncome   = this.inr(data.yearlyIncome);
    this.metricYearlyExpense  = this.inr(data.yearlyExpense);
    this.metricRangeNetProfit = this.inr(data.netProfit);
  }

  private inr(n: number): string {
    return '₹' + (n || 0).toLocaleString('en-IN');
  }

  // ════════════════════════════════════════
  // FILTERS
  // ════════════════════════════════════════

  setPeriod(period: string): void {
    this.currentPeriod    = period;
    this.rangeStart       = null;
    this.rangeEnd         = null;
    this.currentDateRange = null;
    if (this.fpInstance) this.fpInstance.clear();
    this.fetchAll();
  }

  setSession(session: string): void {
    this.currentSession = session;
    if (session !== 'all-sessions') {
      this.showToast('Session breakdown is not available from the API.', 'error');
    }
    if (this.analyticsData) {
      const sLabel = this.SESSION_LABELS[session] || session;
      this.activeSessionTag      = session !== 'all-sessions' ? sLabel : '';
      this.incomeExpenseSubtitle = (this.PERIOD_LABELS[this.currentPeriod] || 'Custom')
        + ' · ' + (session !== 'all-sessions' ? sLabel : 'All Sessions');
      this.profitSubtitle = this.incomeExpenseSubtitle;
    }
  }

  setCategory(event: Event): void {
    this.currentCategory = (event.target as HTMLSelectElement).value;
    if (this.analyticsData) {
      // Re-filter doughnut only — bar/line data comes from API 2 which already has its own category
      this.updatePieChart(this.analyticsData);
      this.updateSubtitleTags();
    }
  }

  resetAllFilters(): void {
    this.currentPeriod    = 'monthly';
    this.currentSession   = 'all-sessions';
    this.currentCategory  = 'all';
    this.rangeStart       = null;
    this.rangeEnd         = null;
    this.currentDateRange = null;
    if (this.fpInstance) this.fpInstance.clear();
    const sel = document.getElementById('categoryFilter') as HTMLSelectElement;
    if (sel) sel.value = 'all';
    this.fetchAll();
  }

  resetZoom(): void {
    if (this.profitChart) { try { this.profitChart.resetZoom(); } catch (e) {} }
  }

  isPeriodActive(p: string):  boolean { return this.currentPeriod  === p; }
  isSessionActive(s: string): boolean { return this.currentSession === s; }
  closeNotifications(): void {}

  // ════════════════════════════════════════
  // FLATPICKR
  // ════════════════════════════════════════

  initFlatpickr(): void {
    if (typeof flatpickr === 'undefined') return;
    this.fpInstance = flatpickr('#dateRangeFilter', {
      mode:       'range',
      dateFormat: 'd M Y',
      maxDate:    'today',
      onChange:   (dates: Date[], dateStr: string) => {
        if (dates.length === 2) {
          this.rangeStart       = dates[0];
          this.rangeEnd         = dates[1];
          this.currentDateRange = dateStr;
          this.currentPeriod    = '';
          this.fetchAll();
        }
      }
    });
  }

  // ════════════════════════════════════════
  // BUILD CHARTS (empty shells on init)
  // ════════════════════════════════════════

  buildCharts(): void {
    if (typeof Chart === 'undefined') return;

    try {
      const zp = (window as any).ChartZoom || (window as any)['chartjs-plugin-zoom'];
      if (zp) Chart.register(zp);
    } catch (e) {}

    // ── Bar: Income vs Expense ──
    this.incomeExpenseChart = new Chart(this.incomeExpenseCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: 'Income',  data: [], backgroundColor: 'rgba(76,175,80,0.85)',  borderRadius: 6 },
          { label: 'Expense', data: [], backgroundColor: 'rgba(239,83,80,0.85)', borderRadius: 6 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
          tooltip: {
            backgroundColor: '#1a1a1a', padding: 12, cornerRadius: 8,
            callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}` }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { callback: (v: any) => '₹' + Number(v).toLocaleString('en-IN') }
          }
        },
        animation: { duration: 600, easing: 'easeOutQuart' }
      }
    });

    // ── Doughnut: Expense Breakdown ──
    this.expensePieChart = new Chart(this.expensePieCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{ data: [], backgroundColor: this.PIE_COLORS, borderWidth: 3, borderColor: '#fff', hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12 } },
          tooltip: {
            backgroundColor: '#1a1a1a', padding: 12, cornerRadius: 8,
            callbacks: { label: (ctx: any) => ` ${ctx.label}: ₹${ctx.parsed.toLocaleString('en-IN')}` }
          }
        },
        animation: { duration: 600, easing: 'easeOutQuart' }
      }
    });

    // ── Line: Profit Trend ──
    const ctx      = this.profitCanvas.nativeElement.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 380);
    gradient.addColorStop(0, 'rgba(255,140,0,0.40)');
    gradient.addColorStop(1, 'rgba(255,140,0,0.01)');

    const profitOptions: any = {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
        tooltip: {
          backgroundColor: '#1a1a1a', padding: 12, cornerRadius: 8,
          callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}` }
        },
        zoom: {
          pan:  { enabled: true, mode: 'x' },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { callback: (v: any) => '₹' + Number(v).toLocaleString('en-IN') }
        }
      },
      animation: { duration: 800, easing: 'easeOutQuart' }
    };

    this.profitChart = new Chart(this.profitCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Profit', data: [],
            borderColor: '#FF8C00', backgroundColor: gradient,
            fill: true, tension: 0.45, pointRadius: 6, pointHoverRadius: 10,
            pointBackgroundColor: '#fff', pointBorderColor: '#FF8C00',
            pointBorderWidth: 3, borderWidth: 3
          },
          {
            label: 'Income', data: [],
            borderColor: 'rgba(76,175,80,0.8)', backgroundColor: 'transparent',
            fill: false, tension: 0.4, pointRadius: 4, borderWidth: 2,
            borderDash: [6, 4]
          },
          {
            label: 'Expense', data: [],
            borderColor: 'rgba(239,83,80,0.8)', backgroundColor: 'transparent',
            fill: false, tension: 0.4, pointRadius: 4, borderWidth: 2,
            borderDash: [6, 4]
          },
        ]
      },
      options: profitOptions
    });
  }

  // ════════════════════════════════════════
  // UPDATE ALL CHARTS
  // chartPoints come directly from API 2 response
  // ════════════════════════════════════════

  updateAllCharts(summary: AnalyticsResponse, chartPoints: ChartDataPoint[]): void {
    if (!this.incomeExpenseChart || !this.expensePieChart || !this.profitChart) return;

    // ── 1. For DAILY: API 2 returns no useful breakdown — just show Income vs Expense ──
    let points = chartPoints;
    if (this.currentPeriod === 'daily') {
      points = [
        { label: 'Income',  income: summary.todayIncome,  expense: 0 },
        { label: 'Expense', income: 0, expense: summary.todayExpense },
      ];
    }

    const labels   = points.map(p => p.label);
    const incomes  = points.map(p => p.income);
    const expenses = points.map(p => p.expense);
    const profits  = points.map(p => p.income - p.expense);

    // ── 2. Bar chart ──
    this.incomeExpenseChart.data.labels           = labels;
    this.incomeExpenseChart.data.datasets[0].data = incomes;
    this.incomeExpenseChart.data.datasets[1].data = expenses;
    this.incomeExpenseChart.update();

    // ── 3. Doughnut ──
    this.updatePieChart(summary);

    // ── 4. Line chart ──
    this.profitChart.data.labels           = labels;
    this.profitChart.data.datasets[0].data = profits;
    this.profitChart.data.datasets[1].data = incomes;
    this.profitChart.data.datasets[2].data = expenses;
    try { this.profitChart.resetZoom(); } catch (e) {}
    this.profitChart.update();

    // ── 5. Subtitles & tags ──
    this.updateSubtitleTags();
  }

  // ── Doughnut: uses expenseBreakdown from API 1, filtered by category ──
  private updatePieChart(summary: AnalyticsResponse): void {
    if (!this.expensePieChart) return;

    let breakdown = summary.expenseBreakdown || [];

    if (this.currentCategory !== 'all') {
      const CAT_MAP: Record<string, string[]> = {
        rent:            ['Rent'],
        salaries:        ['Salaries', 'Salary'],
        'raw-materials': ['Raw Materials', 'RawMaterials'],
        utilities:       ['Utilities'],
        supplies:        ['Supplies'],
        marketing:       ['Marketing'],
      };
      const allowed = (CAT_MAP[this.currentCategory] || []).map(s => s.toLowerCase());
      breakdown = breakdown.filter(b => allowed.includes(b.category.toLowerCase()));
    }

    const pieLabels = breakdown.map(b => b.category);
    const pieData   = breakdown.map(b => b.amount);

    this.expensePieChart.data.labels                      = pieLabels;
    this.expensePieChart.data.datasets[0].data            = pieData;
    this.expensePieChart.data.datasets[0].backgroundColor = this.PIE_COLORS.slice(0, pieLabels.length);
    this.expensePieChart.update();
  }

  private updateSubtitleTags(): void {
    const pLabel = this.currentDateRange
      ? 'Custom Range'
      : (this.PERIOD_LABELS[this.currentPeriod] || this.currentPeriod);
    const sLabel = this.SESSION_LABELS[this.currentSession] || this.currentSession;
    const sel    = document.getElementById('categoryFilter') as HTMLSelectElement;
    const cLabel = this.currentCategory === 'all'
      ? 'All Categories'
      : (sel?.options[sel.selectedIndex]?.text || this.currentCategory);

    this.activeFilterTag   = pLabel;
    this.activeSessionTag  = this.currentSession !== 'all-sessions' ? sLabel : '';
    this.activeCategoryTag = this.currentCategory !== 'all' ? cLabel : '';
    this.activeDateTag     = this.currentDateRange ? `📅 ${this.currentDateRange}` : '';

    this.incomeExpenseSubtitle = `${pLabel}`;
    this.expensePieSubtitle    = cLabel;
    this.profitSubtitle        = `${pLabel}`;
  }

  // ════════════════════════════════════════
  // TOAST
  // ════════════════════════════════════════

  showToast(msg: string, type = ''): void {
    this.toastMessage = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 3000);
  }
}