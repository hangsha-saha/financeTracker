import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import {
  ReportsService, AnalyticsResponse, ExpenseBreakdown,
  ChartDataPoint, ChartPeriod
} from '../services/reports.service';
import { AuthService } from '../services/auth.service';
import { forkJoin, Subscription } from 'rxjs';

import {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexDataLabels, ApexTooltip, ApexPlotOptions, ApexFill,
  ApexLegend, ApexStroke, ApexMarkers, ApexGrid,
  ApexNonAxisChartSeries, ApexResponsive,
  ChartComponent
} from 'ng-apexcharts';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export type BarChartOptions = {
  series:      ApexAxisChartSeries;
  chart:       ApexChart;
  colors:      string[];
  xaxis:       ApexXAxis;
  yaxis:       ApexYAxis;
  tooltip:     ApexTooltip;
  plotOptions: ApexPlotOptions;
  dataLabels:  ApexDataLabels;
  legend:      ApexLegend;
  grid:        ApexGrid;
};

export type AreaChartOptions = {
  series:     ApexAxisChartSeries;
  chart:      ApexChart;
  colors:     string[];
  fill:       ApexFill;
  xaxis:      ApexXAxis;
  yaxis:      ApexYAxis;
  tooltip:    ApexTooltip;
  dataLabels: ApexDataLabels;
  stroke:     ApexStroke;
  grid:       ApexGrid;
  markers:    ApexMarkers;
};

export type DonutChartOptions = {
  series:      ApexNonAxisChartSeries;
  chart:       ApexChart;
  labels:      string[];
  colors:      string[];
  tooltip:     ApexTooltip;
  legend:      ApexLegend;
  dataLabels:  ApexDataLabels;
  plotOptions: ApexPlotOptions;
  responsive:  ApexResponsive[];
};

function toHtmlDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

@Component({
  selector:    'app-reports',
  templateUrl: './reports.component.html',
  styleUrls:   ['./reports.component.css']
})
export class ReportsComponent implements OnInit, OnDestroy {

  @ViewChild('barChartRef')   barChartRef!:   ChartComponent;
  @ViewChild('donutChartRef') donutChartRef!: ChartComponent;
  @ViewChild('areaChartRef')  areaChartRef!:  ChartComponent;

  // ── Date filters ──
  startDate = '';
  endDate   = '';

  // ── Period selector for bar/area chart (API 2) ──
  selectedChartPeriod: ChartPeriod = 'MONTHLY';

  readonly chartPeriods: { label: string; value: ChartPeriod }[] = [
    { label: 'Weekly (Day-wise)',    value: 'WEEKLY'        },
    { label: 'Monthly (Week-wise)',  value: 'MONTHLY'       },
    { label: 'Yearly (Month-wise)',  value: 'YEARLY'        },
    { label: 'Quarterly',           value: 'QUARTERLY'     },
    { label: 'Financial Year',      value: 'FINANCIAL_YEAR'},
    { label: 'Previous Year',       value: 'PREVIOUS_YEAR' },
  ];

  // ── Summary values (from API 1) ──
  totalIncome      = 0;
  totalExpense     = 0;
  netProfit        = 0;
  todayIncome      = 0;
  todayExpense     = 0;
  monthlyIncome    = 0;
  monthlyExpense   = 0;
  monthlyNetProfit = 0;
  yearlyIncome     = 0;
  yearlyExpense    = 0;
  expenseBreakdown: ExpenseBreakdown[] = [];

  // ── Chart data (from API 2) ──
  private chartPoints: ChartDataPoint[] = [];

  // ── Loading / error ──
  isLoading = false;
  apiError  = '';

  // ── Chart options ──
  barChartOptions!:   Partial<BarChartOptions>;
  areaChartOptions!:  Partial<AreaChartOptions>;
  donutChartOptions!: Partial<DonutChartOptions>;

  // ── Toast ──
  toastMsg     = '';
  toastType    = '';
  toastVisible = false;
  private toastTimer: any;

  private subs: Subscription[] = [];

  constructor(
    private reportsService: ReportsService,
    private authService:    AuthService
  ) {}

  ngOnInit(): void {
    const today = new Date();
    const m1    = new Date(today.getFullYear(), today.getMonth(), 1);
    this.startDate = toHtmlDate(m1);
    this.endDate   = toHtmlDate(today);

    this.initEmptyCharts();
    this.loadReportData();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearTimeout(this.toastTimer);
  }

  // ════════════════════════════════════════
  // LOAD — both APIs in parallel
  // ════════════════════════════════════════

  loadReportData(): void {
    this.isLoading = true;
    this.apiError  = '';

    const userId = this.authService.getCurrentUserId();
    const start  = ReportsService.toApiDate(this.startDate);
    const end    = ReportsService.toApiDate(this.endDate);

    if (!start || !end) {
      this.apiError  = 'Please select valid start and end dates.';
      this.isLoading = false;
      return;
    }

    const api1$ = this.reportsService.getAnalytics(userId, start, end);
    const api2$ = this.reportsService.getChartData(userId, this.selectedChartPeriod);

    const sub = forkJoin({ summary: api1$, chart: api2$ }).subscribe({
      next: ({ summary, chart }) => {
        this.isLoading = false;
        this.mapSummary(summary);
        this.chartPoints = chart.data || [];
        this.rebuildCharts();
      },
      error: (err) => {
        console.error('[Reports] Error:', err);
        this.isLoading = false;
        this.apiError  = err.status === 0
          ? 'Cannot reach server. Check your connection.'
          : `Server error (${err.status}). Please try again.`;
      }
    });

    this.subs.push(sub);
  }

  applyFilter(): void {
    if (!this.startDate || !this.endDate) return;
    if (new Date(this.startDate) > new Date(this.endDate)) {
      this.showToast('Start date must be before end date.', 'danger');
      return;
    }
    this.loadReportData();
  }

  // When user changes the chart period dropdown — only refetch API 2
  onChartPeriodChange(): void {
    if (!this.chartPoints) return;
    const userId = this.authService.getCurrentUserId();
    const sub = this.reportsService.getChartData(userId, this.selectedChartPeriod).subscribe({
      next: (chart) => {
        this.chartPoints = chart.data || [];
        this.rebuildCharts();
      },
      error: () => this.showToast('Could not load chart data', 'danger')
    });
    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // MAP API 1 → state
  // ════════════════════════════════════════

  private mapSummary(data: AnalyticsResponse): void {
    this.totalIncome      = data.totalIncome;
    this.totalExpense     = data.totalExpense;
    this.netProfit        = data.netProfit;
    this.todayIncome      = data.todayIncome;
    this.todayExpense     = data.todayExpense;
    this.monthlyIncome    = data.monthlyIncome;
    this.monthlyExpense   = data.monthlyExpense;
    this.monthlyNetProfit = data.monthlyNetProfit;
    this.yearlyIncome     = data.yearlyIncome;
    this.yearlyExpense    = data.yearlyExpense;
    this.expenseBreakdown = data.expenseBreakdown || [];
  }

  // ════════════════════════════════════════
  // CHARTS
  // ════════════════════════════════════════

  private initEmptyCharts(): void {
    this.barChartOptions = {
      chart:       { type: 'bar', height: 320, toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: true } },
      series:      [{ name: 'Income', data: [] }, { name: 'Expense', data: [] }],
      colors:      ['#4ade80', '#f87171'],
      xaxis:       { categories: [] },
      yaxis:       { labels: { formatter: (v: number) => '₹' + this.shortNum(v) } },
      tooltip:     { y: { formatter: (v: number) => '₹' + v.toLocaleString('en-IN') } },
      plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
      dataLabels:  { enabled: false },
      legend:      { position: 'top' },
      grid:        { borderColor: '#f0f0f0' },
    };

    this.donutChartOptions = {
      chart:       { type: 'donut', height: 320, fontFamily: 'inherit' },
      series:      [],
      labels:      [],
      colors:      ['#f87171','#fb923c','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6'],
      tooltip:     { y: { formatter: (v: number) => '₹' + v.toLocaleString('en-IN') } },
      legend:      { position: 'bottom' },
      dataLabels:  { formatter: (val: number) => val.toFixed(1) + '%' },
      plotOptions: { pie: { donut: { size: '60%' } } },
      responsive:  [{ breakpoint: 600, options: { chart: { height: 260 }, legend: { position: 'bottom' } } }],
    };

    this.areaChartOptions = {
      chart:      { type: 'area', height: 320, toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: true } },
      series:     [{ name: 'Net Profit', data: [] }, { name: 'Income', data: [] }, { name: 'Expense', data: [] }],
      colors:     ['#FF8C00', '#4ade80', '#f87171'],
      fill:       { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
      xaxis:      { categories: [] },
      yaxis:      { labels: { formatter: (v: number) => '₹' + this.shortNum(v) } },
      tooltip:    { y: { formatter: (v: number) => '₹' + v.toLocaleString('en-IN') } },
      dataLabels: { enabled: false },
      stroke:     { curve: 'smooth', width: 2 },
      grid:       { borderColor: '#f0f0f0' },
      markers:    { size: 4, colors: ['#FF8C00', '#4ade80', '#f87171'], strokeColors: '#fff', strokeWidth: 2 },
    };
  }

  private rebuildCharts(): void {
    setTimeout(() => {
      // ── Bar: labels + Income/Expense from API 2 ──
      const labels   = this.chartPoints.map(p => p.label);
      const incomes  = this.chartPoints.map(p => p.income);
      const expenses = this.chartPoints.map(p => p.expense);
      const profits  = this.chartPoints.map(p => p.income - p.expense);

      if (this.barChartRef) {
        this.barChartRef.updateOptions({
          xaxis:  { categories: labels },
          series: [
            { name: 'Income',  data: incomes  },
            { name: 'Expense', data: expenses },
          ]
        }, false, true);
      }

      // ── Area: profit trend from same API 2 data ──
      if (this.areaChartRef) {
        this.areaChartRef.updateOptions({
          xaxis:  { categories: labels },
          series: [
            { name: 'Net Profit', data: profits  },
            { name: 'Income',     data: incomes  },
            { name: 'Expense',    data: expenses },
          ]
        }, false, true);
      }

      // ── Donut: expenseBreakdown from API 1 ──
      if (this.donutChartRef) {
        const dLabels = this.expenseBreakdown.map(e => e.category);
        const dValues = this.expenseBreakdown.map(e => e.amount);
        this.donutChartRef.updateOptions({ labels: dLabels }, false, true);
        this.donutChartRef.updateSeries(dValues);
      }
    }, 0);
  }

  // ════════════════════════════════════════
  // COMPUTED GETTERS
  // ════════════════════════════════════════

  get profitClass():      string { return this.netProfit >= 0 ? 'profit-pos' : 'profit-neg'; }
  get netProfitDisplay(): string { return (this.netProfit < 0 ? '-' : '') + this.fmtINR(this.netProfit); }
  get totalBreakdown():   number { return this.expenseBreakdown.reduce((s, e) => s + e.amount, 0); }

  breakdownPct(amount: number): number {
    return this.totalBreakdown > 0 ? Math.round((amount / this.totalBreakdown) * 100) : 0;
  }

  hasBreakdown(): boolean { return this.expenseBreakdown.length > 0; }

  // ════════════════════════════════════════
  // PDF EXPORT
  // ════════════════════════════════════════

  exportPdf(): void {
    if (this.totalIncome === 0 && this.totalExpense === 0) {
      this.showToast('No data to export for selected range.', 'danger');
      return;
    }

    const doc = new jsPDF();

    doc.setFillColor(255, 140, 0);
    doc.rect(0, 0, 220, 28, 'F');
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('FinanceTracker — Financial Report', 14, 12);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${this.startDate}  to  ${this.endDate}`, 14, 22);
    doc.setTextColor(100, 100, 100); doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 148, 35);

    doc.setTextColor(30, 30, 30); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('Range Summary', 14, 44);

    autoTable(doc, {
      startY: 48,
      head:   [['Metric', 'Amount']],
      body:   [
        ['Total Income',  this.fmtPDF(this.totalIncome)],
        ['Total Expense', this.fmtPDF(this.totalExpense)],
        ['Net Profit',    this.fmtPDF(this.netProfit, this.netProfit < 0)],
      ],
      headStyles: { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 250, 240] },
      styles: { fontSize: 11 },
    });

    const y1 = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
    doc.text('Period Breakdown', 14, y1);

    autoTable(doc, {
      startY: y1 + 4,
      head:   [['Period', 'Income', 'Expense', 'Net Profit']],
      body:   [
        ['Today',          this.fmtPDF(this.todayIncome),   this.fmtPDF(this.todayExpense),   this.fmtPDF(this.todayIncome - this.todayExpense, (this.todayIncome - this.todayExpense) < 0)],
        ['This Month',     this.fmtPDF(this.monthlyIncome), this.fmtPDF(this.monthlyExpense), this.fmtPDF(this.monthlyNetProfit, this.monthlyNetProfit < 0)],
        ['This Year',      this.fmtPDF(this.yearlyIncome),  this.fmtPDF(this.yearlyExpense),  this.fmtPDF(this.yearlyIncome - this.yearlyExpense, (this.yearlyIncome - this.yearlyExpense) < 0)],
        ['Selected Range', this.fmtPDF(this.totalIncome),   this.fmtPDF(this.totalExpense),   this.fmtPDF(this.netProfit, this.netProfit < 0)],
      ],
      headStyles: { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 250, 240] },
      styles: { fontSize: 10 },
    });

    // ── Chart period breakdown from API 2 ──
    if (this.chartPoints.length > 0) {
      const y2 = (doc as any).lastAutoTable.finalY + 10;
      const periodLabel = this.chartPeriods.find(p => p.value === this.selectedChartPeriod)?.label || this.selectedChartPeriod;
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
      doc.text(`Chart Breakdown — ${periodLabel}`, 14, y2);
      autoTable(doc, {
        startY: y2 + 4,
        head:   [['Period', 'Income', 'Expense', 'Net Profit']],
        body:   this.chartPoints.map(p => [
          p.label,
          this.fmtPDF(p.income),
          this.fmtPDF(p.expense),
          this.fmtPDF(p.income - p.expense, (p.income - p.expense) < 0)
        ]),
        headStyles: { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 250, 240] },
        styles: { fontSize: 10 },
      });
    }

    if (this.expenseBreakdown.length > 0) {
      const y3 = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
      doc.text('Expense Breakdown', 14, y3);
      autoTable(doc, {
        startY: y3 + 4,
        head:   [['Category', 'Amount', '% of Total']],
        body:   this.expenseBreakdown.map(e => [e.category, this.fmtPDF(e.amount), this.breakdownPct(e.amount) + '%']),
        headStyles: { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 250, 240] },
        styles: { fontSize: 10 },
      });
    }

    doc.save(`FinanceReport_${this.startDate}_${this.endDate}.pdf`);
    this.showToast('PDF exported successfully!', 'success');
  }

  // ════════════════════════════════════════
  // EXCEL EXPORT
  // ════════════════════════════════════════

  exportExcel(): void {
    if (this.totalIncome === 0 && this.totalExpense === 0) {
      this.showToast('No data to export for selected range.', 'danger');
      return;
    }

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.aoa_to_sheet([
      ['FinanceTracker — Financial Report'],
      [`Period: ${this.startDate} to ${this.endDate}`],
      [`Generated: ${new Date().toLocaleDateString('en-IN')}`],
      [],
      ['RANGE SUMMARY'],
      ['Metric',         'Amount (Rs.)'],
      ['Total Income',   this.totalIncome],
      ['Total Expense',  this.totalExpense],
      ['Net Profit',     this.netProfit],
    ]);
    ws1['!cols'] = [{ wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Period', 'Income (Rs.)', 'Expense (Rs.)', 'Net Profit (Rs.)'],
      ['Today',          this.todayIncome,   this.todayExpense,   this.todayIncome - this.todayExpense],
      ['This Month',     this.monthlyIncome, this.monthlyExpense, this.monthlyNetProfit],
      ['This Year',      this.yearlyIncome,  this.yearlyExpense,  this.yearlyIncome - this.yearlyExpense],
      ['Selected Range', this.totalIncome,   this.totalExpense,   this.netProfit],
    ]);
    ws2['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Period Breakdown');

    // ── Chart data sheet (API 2) ──
    if (this.chartPoints.length > 0) {
      const periodLabel = this.chartPeriods.find(p => p.value === this.selectedChartPeriod)?.label || this.selectedChartPeriod;
      const ws3 = XLSX.utils.aoa_to_sheet([
        [`Chart Breakdown — ${periodLabel}`],
        ['Label', 'Income (Rs.)', 'Expense (Rs.)', 'Net Profit (Rs.)'],
        ...this.chartPoints.map(p => [p.label, p.income, p.expense, p.income - p.expense])
      ]);
      ws3['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Chart Breakdown');
    }

    if (this.expenseBreakdown.length > 0) {
      const ws4 = XLSX.utils.aoa_to_sheet([
        ['Category', 'Amount (Rs.)', '% of Total'],
        ...this.expenseBreakdown.map(e => [e.category, e.amount, +this.breakdownPct(e.amount)])
      ]);
      ws4['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Expense Breakdown');
    }

    const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    saveAs(blob, `FinanceReport_${this.startDate}_${this.endDate}.xlsx`);
    this.showToast('Excel exported successfully!', 'success');
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  getChartPeriodLabel(): string {
    return this.chartPeriods.find(p => p.value === this.selectedChartPeriod)?.label || this.selectedChartPeriod;
  }

  fmtINR(val: number): string { return '₹' + Math.abs(val).toLocaleString('en-IN'); }

  fmtPDF(val: number, negative = false): string {
    return (negative ? '-Rs. ' : 'Rs. ') + Math.abs(val).toLocaleString('en-IN');
  }

  shortNum(n: number): string {
    if (n >= 1_00_00_000) return (n / 1_00_00_000).toFixed(1) + 'Cr';
    if (n >= 1_00_000)    return (n / 1_00_000).toFixed(1) + 'L';
    if (n >= 1_000)       return (n / 1_000).toFixed(1) + 'K';
    return Math.round(n).toString();
  }

  showToast(msg: string, type = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 3000);
  }
}