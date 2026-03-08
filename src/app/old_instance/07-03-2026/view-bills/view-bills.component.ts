import { Component, OnInit, OnDestroy } from '@angular/core';
import { ViewBillsService, Bill, BillItem } from '../services/view-bills.service';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export type { Bill, BillItem };

@Component({
  selector:    'app-view-bills',
  templateUrl: './view-bills.component.html',
  styleUrls:   ['./view-bills.component.css']
})
export class ViewBillsComponent implements OnInit, OnDestroy {

  // ── Data ──
  allBills: Bill[] = [];
  filtered: Bill[] = [];

  // ── Loading / error ──
  isLoading: boolean = false;
  apiError:  string  = '';

  // ── Filters ──
  searchText:    string = '';
  filterDate:    string = '';
  filterPayment: string = '';

  // ── Pagination ──
  page:            number = 1;
  readonly PAGE_SIZE      = 6;
  readonly Math           = Math;

  // ── Stats ──
  statTotal:   number = 0;
  statRevenue: string = '₹0';
  statShowing: number = 0;

  // ── Modal ──
  showModal:    boolean     = false;
  selectedBill: Bill | null = null;

  // ── Toast ──
  toastMsg:     string  = '';
  toastType:    string  = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  private sub!: Subscription;

  constructor(
    private viewBillsService: ViewBillsService,
    private authService:      AuthService        // ← inject AuthService
  ) {}

  ngOnInit(): void {
    this.loadBills();
  }

  ngOnDestroy(): void {
    if (this.sub) this.sub.unsubscribe();
    clearTimeout(this.toastTimer);
  }

  // ════════════════════════════════════════
  // LOAD — uses userId from auth session
  // ════════════════════════════════════════

  loadBills(): void {
    this.isLoading = true;
    this.apiError  = '';

    const userId = this.authService.getCurrentUserId();
    console.log('[ViewBills] Loading bills for userId:', userId);

    this.sub = this.viewBillsService
      .getByUserId(userId)
      .subscribe({
        next: bills => {
          console.log('[ViewBills] Loaded', bills.length, 'bills');
          this.allBills  = bills;
          this.isLoading = false;
          this.applyFilters();
        },
        error: (err) => {
          console.error('[ViewBills] Load error:', err);
          this.apiError  = 'Failed to load bills. Please try again.';
          this.isLoading = false;
        }
      });
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  calcTotal(b: Bill): number {
    return Math.max(0, b.subtotal + (b.subtotal * b.tax / 100) - b.discount);
  }

  calcTax(b: Bill): number {
    return (b.subtotal * b.tax) / 100;
  }

  fmtDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  fmtInr(n: number): string {
    return '₹' + n.toLocaleString('en-IN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  paymentClass(payment: string): string {
    const map: any = { CASH: 'pay-cash', UPI: 'pay-upi', CARD: 'pay-card' };
    return map[payment] || '';
  }

  // ════════════════════════════════════════
  // FILTERS + PAGINATION
  // ════════════════════════════════════════

  applyFilters(): void {
    const s = this.searchText.toLowerCase().trim();
    this.filtered = this.allBills.filter(b => {
      const matchSearch  = !s ||
        b.id.toLowerCase().includes(s) ||
        b.customer.toLowerCase().includes(s) ||
        b.phoneNo.includes(s);
      const matchDate    = !this.filterDate    || b.date === this.filterDate;
      const matchPayment = !this.filterPayment || b.payment === this.filterPayment;
      return matchSearch && matchDate && matchPayment;
    });
    this.page = 1;
    this.updateStats();
  }

  clearFilters(): void {
    this.searchText    = '';
    this.filterDate    = '';
    this.filterPayment = '';
    this.applyFilters();
  }

  updateStats(): void {
    const totalRevenue = this.allBills.reduce(
      (s, b) => s + this.calcTotal(b), 0
    );
    this.statTotal   = this.allBills.length;
    this.statRevenue = '₹' + totalRevenue.toLocaleString('en-IN',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    this.statShowing = this.filtered.length;
  }

  get pagedBills(): Bill[] {
    const start = (this.page - 1) * this.PAGE_SIZE;
    return this.filtered.slice(start, start + this.PAGE_SIZE);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.PAGE_SIZE));
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const start = Math.max(1, this.page - 2);
    const end   = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  prevPage(): void { if (this.page > 1) this.page--; }
  nextPage(): void { if (this.page < this.totalPages) this.page++; }
  goToPage(p: number): void { this.page = p; }

  // ════════════════════════════════════════
  // MODAL
  // ════════════════════════════════════════

  openModal(bill: Bill): void {
    this.selectedBill = bill;
    this.showModal    = true;
  }

  closeModal(): void {
    this.showModal    = false;
    this.selectedBill = null;
  }

  // ════════════════════════════════════════
  // PDF DOWNLOAD
  // ════════════════════════════════════════

  downloadPdf(bill: Bill, event?: Event): void {
    if (event) event.stopPropagation();

    const doc   = new jsPDF();
    const tax   = this.calcTax(bill);
    const total = this.calcTotal(bill);

    doc.setFillColor(255, 140, 0);
    doc.rect(0, 0, 220, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FinanceTracker Restaurant', 14, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('123 Main Street, City Center  |  +91 98765 43210', 14, 22);

    doc.setTextColor(26, 26, 26);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Bill: ${bill.id}`, 14, 42);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${this.fmtDate(bill.date)}`,     14, 52);
    doc.text(`Customer: ${bill.customer}`,            14, 60);
    doc.text(`Phone: ${bill.phoneNo}`,                14, 68);
    doc.text(`Payment: ${bill.payment}`,              14, 76);

    autoTable(doc, {
      startY: 84,
      head: [['Item', 'Qty', 'Price (Rs)', 'Total (Rs)']],
      body: bill.items.map(i => [
        i.name, i.qty, i.price.toFixed(2), i.total.toFixed(2)
      ]),
      styles:             { fontSize: 11, cellPadding: 4 },
      headStyles:         { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 248, 240] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'center' },
        2: { halign: 'right'  },
        3: { halign: 'right'  }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(249, 249, 249);
    doc.roundedRect(120, finalY, 76, 44, 3, 3, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Subtotal:',           124, finalY + 10);
    doc.text(`Rs ${bill.subtotal.toFixed(2)}`,  192, finalY + 10, { align: 'right' });
    doc.text(`Tax (${bill.tax}%):`, 124, finalY + 20);
    doc.text(`Rs ${tax.toFixed(2)}`,            192, finalY + 20, { align: 'right' });
    doc.text('Discount:',           124, finalY + 30);
    doc.text(`Rs ${bill.discount.toFixed(2)}`,  192, finalY + 30, { align: 'right' });

    doc.setDrawColor(255, 140, 0);
    doc.line(124, finalY + 33, 194, finalY + 33);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 140, 0);
    doc.text('TOTAL:',              124, finalY + 42);
    doc.text(`Rs ${total.toFixed(2)}`,          192, finalY + 42, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('Thank you for dining with us!', 105, 285, { align: 'center' });

    doc.save(`${bill.id}.pdf`);
    this.showToast(`PDF downloaded: ${bill.id}`, 'success');
  }

  // ════════════════════════════════════════
  // EXCEL DOWNLOAD (single bill)
  // ════════════════════════════════════════

  downloadExcel(bill: Bill, event?: Event): void {
    if (event) event.stopPropagation();

    const tax   = this.calcTax(bill);
    const total = this.calcTotal(bill);

    const wsData: any[][] = [
      ['FinanceTracker Restaurant'],
      ['123 Main Street, City Center'],
      [],
      ['Bill Number', bill.id],
      ['Date',        this.fmtDate(bill.date)],
      ['Customer',    bill.customer],
      ['Phone',       bill.phoneNo],
      ['Payment',     bill.payment],
      [],
      ['Item', 'Qty', 'Price (Rs)', 'Total (Rs)'],
      ...bill.items.map(i => [i.name, i.qty, i.price, i.total]),
      [],
      ['', '', 'Subtotal',           bill.subtotal],
      ['', '', `Tax (${bill.tax}%)`, tax],
      ['', '', 'Discount',           bill.discount],
      ['', '', 'TOTAL',              total],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bill');
    ws['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 16 }, { wch: 16 }];

    const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    saveAs(blob, `${bill.id}.xlsx`);
    this.showToast(`Excel downloaded: ${bill.id}`, 'success');
  }

  // ════════════════════════════════════════
  // EXPORT ALL FILTERED BILLS
  // ════════════════════════════════════════

  exportAllExcel(): void {
    if (this.filtered.length === 0) {
      this.showToast('No bills to export.', 'info');
      return;
    }

    const rows = this.filtered.map(b => ({
      'Bill No':    b.id,
      'Customer':   b.customer,
      'Phone':      b.phoneNo,
      'Date':       this.fmtDate(b.date),
      'Payment':    b.payment,
      'Subtotal':   b.subtotal,
      'Tax':        this.calcTax(b),
      'Discount':   b.discount,
      'Total':      this.calcTotal(b),
      'Items':      b.items.length,
    }));

    const ws  = XLSX.utils.json_to_sheet(rows);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bills');
    ws['!cols'] = [
      { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 14 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 8  }
    ];

    const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    saveAs(blob,
      `FinanceTracker-Bills-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    this.showToast(
      `Exported ${this.filtered.length} bills to Excel`, 'success'
    );
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