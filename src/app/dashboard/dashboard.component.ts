import {
  Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef
} from '@angular/core';
import { Router } from '@angular/router';

declare var Chart: any;
declare var flatpickr: any;

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('incomeExpenseCanvas') incomeExpenseCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('expensePieCanvas')    expensePieCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('profitCanvas')        profitCanvas!: ElementRef<HTMLCanvasElement>;

  // Sidebar profile
  sidebarName: string    = 'Admin User';
  sidebarRole: string    = 'Admin';
  sidebarInitial: string = 'A';
  sidebarEmail: string   = 'admin@restaurant.com';
  headerRoleLabel: string = 'ADMIN';

  // Notifications
  notificationCount: number  = 3;
  showNotifications: boolean = false;

  // Filter state
  currentPeriod: string       = 'daily';
  currentSession: string      = 'all-sessions';
  currentCategory: string     = 'all';
  currentDateRange: string | null = null;

  // Active tag labels (shown in filter bar)
  activeFilterTag: string    = 'Daily';
  activeSessionTag: string   = '';
  activeCategoryTag: string  = '';
  activeDateTag: string      = '';

  // Chart subtitle bindings
  incomeExpenseSubtitle: string = 'Daily';
  expensePieSubtitle: string    = 'All Categories';
  profitSubtitle: string        = 'Daily';

  // Chart instances
  private incomeExpenseChart: any = null;
  private expensePieChart: any    = null;
  private profitChart: any        = null;
  private fpInstance: any         = null;
  private toastTimer: any;

  // Toast
  toastMessage: string  = '';
  toastType: string     = '';
  toastVisible: boolean = false;

  // ── Data ──
  readonly BASE_DATA: any = {
    daily: {
      labels: ['7 AM','9 AM','11 AM','1 PM','3 PM','5 PM','7 PM','9 PM'],
      income:  [1840,3250,6120,8940,4370,5680,9820,7600],
      expense: [980,1640,3280,4760,2140,2890,5120,3940]
    },
    weekly: {
      labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      income:  [11200,9800,12400,13600,15800,22400,18900],
      expense: [6840,6100,7680,8240,9200,12600,11400]
    },
    monthly: {
      labels: ['Sep 25','Oct 25','Nov 25','Dec 25','Jan 26','Feb 26'],
      income:  [264800,298400,271600,382000,304200,312400],
      expense: [182600,201400,189200,248700,210800,218750]
    },
    quarterly: {
      labels: ['Q1 Apr–Jun','Q2 Jul–Sep','Q3 Oct–Dec','Q4 Jan–Mar'],
      income:  [842600,918400,1062000,923800],
      expense: [601200,648800,724600,665400]
    },
    'financial-year': {
      labels: ['FY 21-22','FY 22-23','FY 23-24','FY 24-25','FY 25-26'],
      income:  [1842000,2214000,2687000,3128400,3746800],
      expense: [1486000,1728000,2041000,2389600,2640000]
    },
    'prev-year': {
      labels: ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
      income:  [218400,241600,268000,252800,278400,314200,348600,362800,419400,296800,284200,343200],
      expense: [158600,172400,189200,182800,196600,218400,236800,248600,286200,208400,199800,241600]
    },
  };

  readonly DATE_RANGE_DATA: any = {
    labels: ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7'],
    income:  [12400,14800,11600,18200,16400,21800,19600],
    expense: [7800,9200,7100,10800,9600,12400,11200]
  };

  readonly EXPENSE_BREAKDOWN: any = {
    all:           { labels:['Raw Materials','Salaries','Rent','Utilities','Marketing','Supplies'], data:[68400,82000,45000,18600,22400,14800] },
    rent:          { labels:['Rent'], data:[45000] },
    salaries:      { labels:['Salaries'], data:[82000] },
    'raw-materials':{ labels:['Raw Materials'], data:[68400] },
    utilities:     { labels:['Utilities'], data:[18600] },
    supplies:      { labels:['Supplies'], data:[14800] },
    marketing:     { labels:['Marketing'], data:[22400] },
    'dine-in':     { labels:['Salaries','Raw Materials','Utilities'], data:[82000,38400,12600] },
    online:        { labels:['Marketing','Supplies','Utilities'], data:[22400,14800,6000] },
    takeaway:      { labels:['Raw Materials','Packaging','Supplies'], data:[30000,12000,14800] },
    delivery:      { labels:['Raw Materials','Marketing','Packaging'], data:[30000,22400,12000] },
  };

  readonly SESSION_MULT: any = {
    'all-sessions': 1, breakfast: 0.12, brunch: 0.18,
    lunch: 0.32, snacks: 0.10, dinner: 0.38
  };

  readonly SESSION_LABELS: any = {
    'all-sessions': 'All Sessions', breakfast: 'Breakfast',
    brunch: 'Brunch', lunch: 'Lunch', snacks: 'Snacks', dinner: 'Dinner'
  };

  readonly PERIOD_LABELS: any = {
    daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
    quarterly: 'Quarterly', 'financial-year': 'Financial Year', 'prev-year': 'Previous Year'
  };

  readonly PIE_COLORS = ['#FF8C00','#4CAF50','#EF5350','#2196F3','#9C27B0','#FFB74D','#00BCD4','#795548'];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadSidebarProfile();
  }

  ngAfterViewInit(): void {
    // Small delay ensures canvas elements are in the DOM
    setTimeout(() => {
      this.buildCharts();
      this.updateAllCharts();
      this.initFlatpickr();
    }, 200);
  }

  ngOnDestroy(): void {
    if (this.incomeExpenseChart) { this.incomeExpenseChart.destroy(); this.incomeExpenseChart = null; }
    if (this.expensePieChart)    { this.expensePieChart.destroy();    this.expensePieChart = null; }
    if (this.profitChart)        { this.profitChart.destroy();        this.profitChart = null; }
    if (this.fpInstance)         { this.fpInstance.destroy(); }
    clearTimeout(this.toastTimer);
  }

  // ── Profile ──
  loadSidebarProfile(): void {
    try {
      const raw = localStorage.getItem('ftProfile');
      if (raw) {
        const p = JSON.parse(raw);
        const roleMap: any = { admin:'Admin', manager:'Manager', cashier:'Cashier', staff:'Staff' };
        this.sidebarName    = p.displayName || `${p.firstName} ${p.lastName}`;
        this.sidebarRole    = roleMap[p.role] || 'Admin';
        this.sidebarInitial = (p.firstName || 'A')[0].toUpperCase();
        this.sidebarEmail   = p.email || 'admin@restaurant.com';
        this.headerRoleLabel = this.sidebarRole.toUpperCase();
      }
    } catch(e) {}
  }

  // ── Navigation ──
  // Pages that are built and registered in the router
  private readonly BUILT_PAGES = ['dashboard', 'login', 'inventory', 'income','expense', 'menu','generate-bill'];

  goTo(page: string): void {
    if (this.BUILT_PAGES.includes(page)) {
      this.router.navigate(['/' + page]);
    } else {
      this.showToast(`"${this.capitalize(page)}" page coming soon!`, 'info');
    }
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
  }

  handleLogout(): void {
    if (confirm('Are you sure you want to logout?')) {
      this.router.navigate(['/login']);
    }
  }

  // ── Notifications ──
  toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) this.notificationCount = 0;
  }

  closeNotifications(): void { this.showNotifications = false; }

  // ── Filters ──
  setPeriod(period: string): void {
    this.currentPeriod = period;
    this.currentDateRange = null;
    if (this.fpInstance) this.fpInstance.clear();
    this.updateAllCharts();
  }

  setSession(session: string): void {
    this.currentSession = session;
    this.updateAllCharts();
  }

  setCategory(event: Event): void {
    this.currentCategory = (event.target as HTMLSelectElement).value;
    this.updateAllCharts();
  }

  resetAllFilters(): void {
    this.currentPeriod   = 'daily';
    this.currentSession  = 'all-sessions';
    this.currentCategory = 'all';
    this.currentDateRange = null;
    if (this.fpInstance) this.fpInstance.clear();
    const sel = document.getElementById('categoryFilter') as HTMLSelectElement;
    if (sel) sel.value = 'all';
    this.updateAllCharts();
  }

  resetZoom(): void { if (this.profitChart) this.profitChart.resetZoom(); }

  isPeriodActive(p: string): boolean  { return this.currentPeriod === p; }
  isSessionActive(s: string): boolean { return this.currentSession === s; }

  // ── Flatpickr ──
  initFlatpickr(): void {
    this.fpInstance = flatpickr('#dateRangeFilter', {
      mode: 'range',
      dateFormat: 'd M Y',
      maxDate: 'today',
      onChange: (dates: Date[], dateStr: string) => {
        if (dates.length === 2) {
          this.currentDateRange = dateStr;
          this.currentPeriod    = '';
          this.updateAllCharts();
        }
      }
    });
  }

  // ── Build Charts ──
  buildCharts(): void {
    if (typeof Chart === 'undefined') {
      console.error('Chart.js not loaded. Check angular.json scripts.');
      return;
    }

    // Register zoom plugin if available
    try {
      const zoomPlugin = (window as any).ChartZoom || (window as any)['chartjs-plugin-zoom'];
      if (zoomPlugin) Chart.register(zoomPlugin);
    } catch(e) {}

    // ── Income vs Expense Bar Chart ──
    this.incomeExpenseChart = new Chart(this.incomeExpenseCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: 'Income',  data: [], backgroundColor: 'rgba(76,175,80,0.85)',  borderRadius: 6, borderSkipped: false },
          { label: 'Expense', data: [], backgroundColor: 'rgba(239,83,80,0.85)', borderRadius: 6, borderSkipped: false },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
            ticks: { callback: (v: number) => '₹' + v.toLocaleString('en-IN') }
          }
        },
        animation: { duration: 600, easing: 'easeOutQuart' }
      }
    });

    // ── Expense Breakdown Doughnut ──
    this.expensePieChart = new Chart(this.expensePieCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: this.PIE_COLORS,
          borderWidth: 3,
          borderColor: '#fff',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
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

    // ── Profit Trend Line Chart ──
    const canvas   = this.profitCanvas.nativeElement;
    const ctx      = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 380);
    gradient.addColorStop(0, 'rgba(255,140,0,0.40)');
    gradient.addColorStop(1, 'rgba(255,140,0,0.01)');

    const profitOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
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
          ticks: { callback: (v: number) => '₹' + v.toLocaleString('en-IN') }
        }
      },
      animation: { duration: 800, easing: 'easeOutQuart' }
    };

    // Add zoom plugin options only if plugin loaded
    try {
      profitOptions.plugins.zoom = {
        pan: { enabled: true, mode: 'x' },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
      };
    } catch(e) {}

    this.profitChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Profit',
            data: [],
            borderColor: '#FF8C00',
            backgroundColor: gradient,
            fill: true,
            tension: 0.45,
            pointRadius: 6,
            pointHoverRadius: 10,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#FF8C00',
            pointBorderWidth: 3,
            borderWidth: 3
          },
          {
            label: 'Income',
            data: [],
            borderColor: 'rgba(76,175,80,0.8)',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.4,
            pointRadius: 4,
            borderWidth: 2,
            borderDash: [6, 4]
          },
          {
            label: 'Expense',
            data: [],
            borderColor: 'rgba(239,83,80,0.8)',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.4,
            pointRadius: 4,
            borderWidth: 2,
            borderDash: [6, 4]
          },
        ]
      },
      options: profitOptions
    });
  }

  // ── Update All Charts ──
  updateAllCharts(): void {
    if (!this.incomeExpenseChart || !this.expensePieChart || !this.profitChart) return;

    const base    = this.currentDateRange
      ? this.DATE_RANGE_DATA
      : (this.BASE_DATA[this.currentPeriod] || this.BASE_DATA['daily']);

    const mult    = this.SESSION_MULT[this.currentSession] ?? 1;
    const income  = base.income.map((v: number) => Math.round(v * mult));
    const expense = base.expense.map((v: number) => Math.round(v * (mult * 0.85 + 0.15)));
    const profit  = income.map((v: number, i: number) => v - expense[i]);

    // Bar chart
    this.incomeExpenseChart.data.labels            = [...base.labels];
    this.incomeExpenseChart.data.datasets[0].data  = income;
    this.incomeExpenseChart.data.datasets[1].data  = expense;
    this.incomeExpenseChart.update();

    // Doughnut chart
    const pie = this.EXPENSE_BREAKDOWN[this.currentCategory] || this.EXPENSE_BREAKDOWN['all'];
    this.expensePieChart.data.labels                         = [...pie.labels];
    this.expensePieChart.data.datasets[0].data               = [...pie.data];
    this.expensePieChart.data.datasets[0].backgroundColor    = this.PIE_COLORS.slice(0, pie.labels.length);
    this.expensePieChart.update();

    // Profit line chart
    this.profitChart.data.labels           = [...base.labels];
    this.profitChart.data.datasets[0].data = profit;
    this.profitChart.data.datasets[1].data = income;
    this.profitChart.data.datasets[2].data = expense;
    try { this.profitChart.resetZoom(); } catch(e) {}
    this.profitChart.update();

    // Update label tags
    const pLabel = this.currentDateRange
      ? 'Custom Range'
      : (this.PERIOD_LABELS[this.currentPeriod] || this.currentPeriod);
    const sLabel = this.SESSION_LABELS[this.currentSession] || this.currentSession;

    const sel    = document.getElementById('categoryFilter') as HTMLSelectElement;
    const cLabel = this.currentCategory === 'all'
      ? 'All Categories'
      : (sel?.options[sel.selectedIndex]?.text || this.currentCategory);

    this.activeFilterTag    = pLabel;
    this.activeSessionTag   = this.currentSession !== 'all-sessions' ? sLabel : '';
    this.activeCategoryTag  = this.currentCategory !== 'all' ? cLabel : '';
    this.activeDateTag      = this.currentDateRange ? `📅 ${this.currentDateRange}` : '';

    this.incomeExpenseSubtitle = `${pLabel} · ${sLabel}`;
    this.expensePieSubtitle    = cLabel;
    this.profitSubtitle        = `${pLabel} · ${sLabel}`;
  }

  // ── Toast ──
  showToast(msg: string, type: string = ''): void {
    this.toastMessage = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 3000);
  }
}