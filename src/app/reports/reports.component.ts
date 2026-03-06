import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ReportsService, MonthData, ReportSummary, BreakdownResult } from '../services/reports.service';
import { Subscription, forkJoin } from 'rxjs';

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

@Component({
  selector:    'app-reports',
  templateUrl: './reports.component.html',
  styleUrls:   ['./reports.component.css']
})
export class ReportsComponent implements OnInit, OnDestroy {

  @ViewChild('barChartRef')   barChartRef!:   ChartComponent;
  @ViewChild('donutChartRef') donutChartRef!: ChartComponent;
  @ViewChild('areaChartRef')  areaChartRef!:  ChartComponent;

  // ── Current user (replace with AuthService later) ──
  private readonly CURRENT_USER_ID: number = 1;

  // ── Date filters ──
  startDate: string = '2026-02-01';
  endDate:   string = '2026-02-28';

  // ── Summary values ──
  totalIncome:  number = 0;
  totalExpense: number = 0;
  netProfit:    number = 0;

  // ── Loading / error ──
  isLoading: boolean = false;
  apiError:  string  = '';

  // ── Raw data (full list for the user) ──
  allMonths: MonthData[] = [];

  // ── Chart options ──
  barChartOptions!:   Partial<BarChartOptions>;
  areaChartOptions!:  Partial<AreaChartOptions>;
  donutChartOptions!: Partial<DonutChartOptions>;

  // ── Toast ──
  toastMsg:     string  = '';
  toastType:    string  = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  private subs: Subscription[] = [];

  constructor(private reportsService: ReportsService) {}

  ngOnInit(): void {
    this.initEmptyCharts();
    this.loadReportData();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearTimeout(this.toastTimer);
  }

  // ════════════════════════════════════════
  // LOAD — fetch all monthly data for user
  // ════════════════════════════════════════

  loadReportData(): void {
    this.isLoading = true;
    this.apiError  = '';

    const sub = this.reportsService
      .getAllByUserId(this.CURRENT_USER_ID)
      .subscribe({
        next: list => {
          this.allMonths = list;
          this.isLoading = false;
          this.applyFilter();
        },
        error: () => {
          this.apiError  = 'Failed to load report data. Please try again.';
          this.isLoading = false;
        }
      });

    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // FILTER — runs on date change or after load
  // ════════════════════════════════════════

  applyFilter(): void {
    const filtered = this.getFilteredMonths();

    if (filtered.length === 0) {
      this.totalIncome  = 0;
      this.totalExpense = 0;
      this.netProfit    = 0;
      this.updateCharts([], [], [], [], [], []);
      return;
    }

    // ── Compute summary ──
    this.totalIncome  = filtered.reduce((s, m) => s + m.income,  0);
    this.totalExpense = filtered.reduce((s, m) => s + m.expense, 0);
    this.netProfit    = this.totalIncome - this.totalExpense;

    // ── Prepare chart data ──
    const months   = filtered.map(m => m.month);
    const incomes  = filtered.map(m => m.income);
    const expenses = filtered.map(m => m.expense);
    const profits  = filtered.map(m => m.income - m.expense);
    const bd       = this.reportsService.aggregateBreakdown(filtered);

    this.updateCharts(months, incomes, expenses, profits, bd.labels, bd.values);
  }

  // ── Client-side filter on allMonths ──
  getFilteredMonths(): MonthData[] {
    if (!this.startDate || !this.endDate) return this.allMonths;
    return this.allMonths.filter(
      m => m.date >= this.startDate && m.date <= this.endDate
    );
  }

  // ════════════════════════════════════════
  // CHARTS — init with empty data
  // ════════════════════════════════════════

  private initEmptyCharts(): void {
    this.barChartOptions = {
      chart:      { type: 'bar', height: 320, toolbar: { show: false },
                    fontFamily: 'inherit', animations: { enabled: true } },
      series:     [{ name: 'Income', data: [] }, { name: 'Expense', data: [] }],
      colors:     ['#4CAF50', '#EF5350'],
      xaxis:      { categories: [] },
      yaxis:      { labels: { formatter: (v: number) =>
                    '₹' + (v / 1000).toFixed(0) + 'k' } },
      tooltip:    { y: { formatter: (v: number) =>
                    '₹' + v.toLocaleString('en-IN') } },
      plotOptions:{ bar: { columnWidth: '55%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      legend:     { position: 'top' },
      grid:       { borderColor: '#f0f0f0' },
    };

    this.donutChartOptions = {
      chart:       { type: 'donut', height: 320, fontFamily: 'inherit' },
      series:      [],
      labels:      [],
      colors:      ['#4CAF50','#FF9800','#9C27B0','#0288D1','#FF8C00','#E91E63'],
      tooltip:     { y: { formatter: (v: number) =>
                     '₹' + v.toLocaleString('en-IN') } },
      legend:      { position: 'bottom' },
      dataLabels:  { formatter: (val: number) => val.toFixed(1) + '%' },
      plotOptions: { pie: { donut: { size: '60%' } } },
      responsive:  [{ breakpoint: 600,
                      options: { chart: { height: 260 },
                                 legend: { position: 'bottom' } } }],
    };

    this.areaChartOptions = {
      chart:      { type: 'area', height: 320, toolbar: { show: false },
                    fontFamily: 'inherit', animations: { enabled: true } },
      series:     [{ name: 'Net Profit', data: [] }],
      colors:     ['#FF8C00'],
      fill:       { type: 'gradient', gradient: { shadeIntensity: 1,
                    opacityFrom: 0.4, opacityTo: 0.05 } },
      xaxis:      { categories: [] },
      yaxis:      { labels: { formatter: (v: number) =>
                    '₹' + (v / 1000).toFixed(0) + 'k' } },
      tooltip:    { y: { formatter: (v: number) =>
                    '₹' + v.toLocaleString('en-IN') } },
      dataLabels: { enabled: false },
      stroke:     { curve: 'smooth', width: 2 },
      grid:       { borderColor: '#f0f0f0' },
      markers:    { size: 4, colors: ['#FF8C00'],
                    strokeColors: '#fff', strokeWidth: 2 },
    };
  }

  private updateCharts(
    months:   string[], incomes: number[], expenses: number[],
    profits:  number[], bdLabels: string[], bdValues: number[]
  ): void {
    if (this.barChartRef) {
      this.barChartRef.updateOptions({
        xaxis:  { categories: months },
        series: [
          { name: 'Income',  data: incomes  },
          { name: 'Expense', data: expenses },
        ]
      });
    }
    if (this.areaChartRef) {
      this.areaChartRef.updateOptions({
        xaxis:  { categories: months },
        series: [{ name: 'Net Profit', data: profits }]
      });
    }
    if (this.donutChartRef) {
      this.donutChartRef.updateOptions({ labels: bdLabels });
      this.donutChartRef.updateSeries(bdValues);
    }
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  fmtINR(val: number): string {
    return '₹' + Math.abs(val).toLocaleString('en-IN');
  }

  fmtPDF(val: number, negative: boolean = false): string {
    return (negative ? '-Rs. ' : 'Rs. ') + Math.abs(val).toLocaleString('en-IN');
  }

  get profitClass(): string {
    return this.netProfit >= 0 ? 'profit-pos' : 'profit-neg';
  }

  get netProfitDisplay(): string {
    return (this.netProfit < 0 ? '-' : '') + this.fmtINR(this.netProfit);
  }

  // ════════════════════════════════════════
  // PDF EXPORT
  // ════════════════════════════════════════

  exportPdf(): void {
    const filtered = this.getFilteredMonths();

    if (filtered.length === 0) {
      this.showToast('No data in selected date range.', 'danger');
      return;
    }

    const bd  = this.reportsService.aggregateBreakdown(filtered);
    const doc = new jsPDF();

    // ── Header band ──
    doc.setFillColor(255, 140, 0);
    doc.rect(0, 0, 220, 28, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('FinanceTracker - Financial Report', 14, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${this.startDate}  to  ${this.endDate}`, 14, 22);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 150, 35);

    // ── Summary ──
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, 44);

    autoTable(doc, {
      startY: 48,
      head:   [['Metric', 'Amount']],
      body:   [
        ['Total Income',  this.fmtPDF(this.totalIncome)],
        ['Total Expense', this.fmtPDF(this.totalExpense)],
        ['Net Profit',    this.fmtPDF(this.netProfit, this.netProfit < 0)],
      ],
      headStyles:         { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 250, 240] },
      styles:             { fontSize: 11 },
    });

    // ── Monthly breakdown ──
    const y1 = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Monthly Breakdown', 14, y1);

    autoTable(doc, {
      startY: y1 + 4,
      head:   [['Month', 'Income', 'Expense', 'Profit']],
      body:   filtered.map(m => {
        const p = m.income - m.expense;
        return [
          m.month,
          this.fmtPDF(m.income),
          this.fmtPDF(m.expense),
          this.fmtPDF(p, p < 0)
        ];
      }),
      headStyles:         { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 250, 240] },
      styles:             { fontSize: 10 },
    });

    // ── Expense breakdown ──
    const y2 = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Expense Breakdown', 14, y2);

    autoTable(doc, {
      startY: y2 + 4,
      head:   [['Category', 'Amount', '% of Total']],
      body:   bd.labels.map((label, i) => [
        label,
        this.fmtPDF(bd.values[i]),
        ((bd.values[i] / this.totalExpense) * 100).toFixed(1) + '%'
      ]),
      headStyles:         { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 250, 240] },
      styles:             { fontSize: 10 },
    });

    doc.save(`FinanceReport_${this.startDate}_to_${this.endDate}.pdf`);
    this.showToast('PDF exported successfully!', 'success');
  }

  // ════════════════════════════════════════
  // EXCEL EXPORT
  // ════════════════════════════════════════

  exportExcel(): void {
    const filtered = this.getFilteredMonths();

    if (filtered.length === 0) {
      this.showToast('No data in selected date range.', 'danger');
      return;
    }

    const bd = this.reportsService.aggregateBreakdown(filtered);
    const wb = XLSX.utils.book_new();

    // Sheet 1 — Summary
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['FinanceTracker - Financial Report'],
      [`Period: ${this.startDate} to ${this.endDate}`],
      [`Generated: ${new Date().toLocaleDateString('en-IN')}`],
      [],
      ['SUMMARY'],
      ['Metric',         'Amount (Rs.)'],
      ['Total Income',   this.totalIncome],
      ['Total Expense',  this.totalExpense],
      ['Net Profit',     this.netProfit],
    ]);
    ws1['!cols'] = [{ wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    // Sheet 2 — Monthly Breakdown
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Month', 'Income (Rs.)', 'Expense (Rs.)', 'Profit (Rs.)'],
      ...filtered.map(m => [
        m.month, m.income, m.expense, m.income - m.expense
      ])
    ]);
    ws2['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Monthly Breakdown');

    // Sheet 3 — Expense Breakdown
    const ws3 = XLSX.utils.aoa_to_sheet([
      ['Category', 'Amount (Rs.)', '% of Total'],
      ...bd.labels.map((label, i) => [
        label,
        bd.values[i],
        +((bd.values[i] / this.totalExpense) * 100).toFixed(1)
      ])
    ]);
    ws3['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Expense Breakdown');

    const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    saveAs(blob, `FinanceReport_${this.startDate}_to_${this.endDate}.xlsx`);
    this.showToast('Excel exported successfully!', 'success');
  }

  // ════════════════════════════════════════
  // TOAST
  // ════════════════════════════════════════

  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 3000);
  }
}