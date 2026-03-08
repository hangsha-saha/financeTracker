import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface ApiBillItem {
  billItemId: number;
  quantity:   number;
  cost:       number;
  totalPrice: number;
}

export interface ApiVoucher {
  voucherId:  number;
  code:       string;
  percentage: number;
  minAmount:  number;
  expireDate: string;
  status:     number;
}

export interface ApiBill {
  billId:       number;
  billDate:     string;
  totalAmt:     number;   // subtotal (before tax/discount)
  taxAmt:       number;   // tax amount
  netAmt:       number;   // final amount paid
  paymentMode:  string;
  customerType: string;
  phoneNo:      string;
  billItems:    ApiBillItem[];
  voucher?:     ApiVoucher | null;  // voucher applied (may be null)
  discountAmt?: number;             // pre-computed discount from backend
}

export interface BillItem {
  name:  string;
  qty:   number;
  price: number;
  total: number;
}

export interface Bill {
  id:             string;
  customer:       string;
  date:           string;
  payment:        string;
  subtotal:       number;
  tax:            number;
  taxAmt:         number;
  discount:       number;      // flat discount amount
  voucherCode:    string;      // voucher code string, '' if none
  voucherPct:     number;      // voucher percentage, 0 if none
  voucherAmt:     number;      // discount amount from voucher
  netAmt:         number;
  customerType:   string;
  items:          BillItem[];
  billId:         number;
}

@Component({
  selector:    'app-view-bills',
  templateUrl: './view-bills.component.html',
  styleUrls:   ['./view-bills.component.css']
})
export class ViewBillsComponent implements OnInit, OnDestroy {

  private get API_URL(): string {
    const userId = this.authService.getCurrentUserId();
    return `http://192.168.1.39:3000/bills/user/${userId}`;
  }

  // ── State ──
  allBills:  Bill[]  = [];
  filtered:  Bill[]  = [];
  isLoading: boolean = true;
  hasError:  boolean = false;
  errorMsg:  string  = '';

  // ── Filters ──
  searchText:    string = '';
  filterDate:    string = '';
  filterPayment: string = '';

  // ── Pagination ──
  page:           number = 1;
  readonly PAGE_SIZE     = 6;
  readonly Math          = Math;

  // ── Stats ──
  statTotal:   number = 0;
  statRevenue: string = '₹0';
  statShowing: number = 0;

  // ── Modal ──
  showModal:    boolean   = false;
  selectedBill: Bill|null = null;

  // ── Toast ──
  toastMsg:     string  = '';
  toastType:    string  = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  constructor(
    private http:        HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void  { this.fetchBills(); }
  ngOnDestroy(): void { clearTimeout(this.toastTimer); }

  // ════════════════════════════════════════
  // FETCH
  // ════════════════════════════════════════

  fetchBills(): void {
    this.isLoading = true;
    this.hasError  = false;

    console.log('[ViewBills] Fetching from:', this.API_URL);

    this.http.get<ApiBill[]>(this.API_URL).subscribe({
      next: (data) => {
        console.log('[ViewBills] Raw API response:', data);
        this.allBills  = data.map(b => this.mapApiBill(b));
        this.isLoading = false;
        this.applyFilters();
      },
      error: (err) => {
        console.error('[ViewBills] Error:', err);
        this.isLoading = false;
        this.hasError  = true;
        this.errorMsg  = err?.message || 'Failed to fetch bills.';
        this.showToast('Failed to load bills', 'danger');
      }
    });
  }

  retryFetch(): void { this.fetchBills(); }

  // ════════════════════════════════════════
  // MAP API BILL → Internal Bill
  // ════════════════════════════════════════

  private mapApiBill(b: ApiBill): Bill {
    const isoDate = this.ddmmyyyyToIso(b.billDate);

    const taxPercent = b.totalAmt > 0
      ? Math.round((b.taxAmt / b.totalAmt) * 100)
      : 0;

    // ── Voucher / discount ──
    const voucher    = b.voucher ?? null;
    const voucherPct  = voucher?.percentage ?? 0;
    const voucherCode = voucher?.code ?? '';

    // Derive voucher discount amount:
    // If backend sends discountAmt use it directly,
    // otherwise compute from (subtotal + tax) × percentage
    let voucherAmt = b.discountAmt ?? 0;
    if (!voucherAmt && voucherPct > 0) {
      voucherAmt = ((b.totalAmt + b.taxAmt) * voucherPct) / 100;
    }

    const items: BillItem[] = (b.billItems || []).map((item, idx) => ({
      name:  `Item #${idx + 1}`,
      qty:   item.quantity,
      price: item.cost,
      total: item.totalPrice,
    }));

    return {
      id:           `BL-${b.billId}`,
      customer:     b.phoneNo     || '—',
      date:         isoDate,
      payment:      (b.paymentMode || 'CASH').toUpperCase(),
      subtotal:     b.totalAmt,
      tax:          taxPercent,
      taxAmt:       b.taxAmt,
      discount:     0,             // flat manual discount (not in API yet)
      voucherCode,
      voucherPct,
      voucherAmt,
      netAmt:       b.netAmt,
      customerType: b.customerType || '',
      items,
      billId:       b.billId,
    };
  }

  private ddmmyyyyToIso(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  calcTotal(b: Bill): number { return b.netAmt; }
  calcTax(b: Bill):   number { return b.taxAmt; }

  /** Total savings = voucher discount + flat discount */
  calcSavings(b: Bill): number { return (b.voucherAmt || 0) + (b.discount || 0); }

  fmtDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  fmtInr(n: number): string {
    return '₹' + (n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  paymentClass(payment: string): string {
    const map: { [k: string]: string } = {
      CASH: 'pay-cash', UPI: 'pay-upi', CARD: 'pay-card'
    };
    return map[payment] || 'pay-cash';
  }

  // ════════════════════════════════════════
  // FILTERS + PAGINATION
  // ════════════════════════════════════════

  applyFilters(): void {
    const s = this.searchText.toLowerCase().trim();
    this.filtered = this.allBills.filter(b => {
      const matchSearch  = !s
        || b.id.toLowerCase().includes(s)
        || b.customer.includes(s)
        || b.customerType.toLowerCase().includes(s)
        || b.voucherCode.toLowerCase().includes(s);
      const matchDate    = !this.filterDate    || b.date === this.filterDate;
      const matchPayment = !this.filterPayment || b.payment === this.filterPayment;
      return matchSearch && matchDate && matchPayment;
    });
    this.page = 1;
    this.updateStats();
  }

  clearFilters(): void {
    this.searchText = this.filterDate = this.filterPayment = '';
    this.applyFilters();
  }

  updateStats(): void {
    const rev        = this.allBills.reduce((s, b) => s + this.calcTotal(b), 0);
    this.statTotal   = this.allBills.length;
    this.statRevenue = '₹' + rev.toLocaleString('en-IN');
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

  openModal(bill: Bill): void  { this.selectedBill = bill; this.showModal = true;  }
  closeModal(): void           { this.showModal = false; this.selectedBill = null; }

  // ════════════════════════════════════════
  // PDF
  // ════════════════════════════════════════

  downloadPdf(bill: Bill, event?: Event): void {
    if (event) event.stopPropagation();

    const doc   = new jsPDF();
    const total = this.calcTotal(bill);

    // ── Header band ──
    doc.setFillColor(255, 140, 0);
    doc.rect(0, 0, 220, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('FinanceTracker Restaurant', 14, 12);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('123 Main Street, City Center  |  +91 98765 43210', 14, 22);

    // ── Bill info ──
    doc.setTextColor(26, 26, 26);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`Bill: ${bill.id}`, 14, 42);

    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${this.fmtDate(bill.date)}`,        14, 52);
    doc.text(`Phone: ${bill.customer}`,                  14, 60);
    doc.text(`Customer Type: ${bill.customerType}`,      14, 68);
    doc.text(`Payment: ${bill.payment}`,                 14, 76);
    if (bill.voucherCode) {
      doc.text(`Voucher: ${bill.voucherCode} (${bill.voucherPct}% off)`, 14, 84);
    }

    const tableStartY = bill.voucherCode ? 92 : 84;

    autoTable(doc, {
      startY: tableStartY,
      head: [['Item', 'Qty', 'Price (Rs)', 'Total (Rs)']],
      body: bill.items.map(i => [i.name, i.qty, i.price.toFixed(2), i.total.toFixed(2)]),
      styles:             { fontSize: 11, cellPadding: 4 },
      headStyles:         { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 248, 240] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
    });

    // ── Totals box ──
    const finalY     = (doc as any).lastAutoTable.finalY + 10;
    const boxHeight  = bill.voucherAmt > 0 ? 54 : 44;

    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(249, 249, 249);
    doc.roundedRect(120, finalY, 76, boxHeight, 3, 3, 'FD');

    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:',   124, finalY + 10);
    doc.text(`Rs ${bill.subtotal.toFixed(2)}`,  192, finalY + 10, { align: 'right' });
    doc.text('Tax:',        124, finalY + 20);
    doc.text(`Rs ${bill.taxAmt.toFixed(2)}`,    192, finalY + 20, { align: 'right' });

    let lineY = finalY + 30;
    if (bill.voucherAmt > 0) {
      doc.setTextColor(46, 125, 50);
      doc.text(`Voucher (${bill.voucherCode}):`, 124, lineY);
      doc.text(`-Rs ${bill.voucherAmt.toFixed(2)}`, 192, lineY, { align: 'right' });
      doc.setTextColor(100, 100, 100);
      lineY += 10;
    }

    doc.setDrawColor(255, 140, 0);
    doc.line(124, lineY + 3, 194, lineY + 3);

    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 140, 0);
    doc.text('TOTAL:', 124, lineY + 12);
    doc.text(`Rs ${total.toFixed(2)}`, 192, lineY + 12, { align: 'right' });

    // ── Footer ──
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('Thank you for dining with us!', 105, 285, { align: 'center' });

    doc.save(`${bill.id}.pdf`);
    this.showToast(`PDF downloaded: ${bill.id}`, 'success');
  }

  // ════════════════════════════════════════
  // EXCEL (single)
  // ════════════════════════════════════════

  downloadExcel(bill: Bill, event?: Event): void {
    if (event) event.stopPropagation();

    const wsData: any[][] = [
      ['FinanceTracker Restaurant'],
      ['123 Main Street, City Center'],
      [],
      ['Bill Number',   bill.id],
      ['Date',          this.fmtDate(bill.date)],
      ['Phone',         bill.customer],
      ['Customer Type', bill.customerType],
      ['Payment',       bill.payment],
      ...(bill.voucherCode
        ? [['Voucher', `${bill.voucherCode} (${bill.voucherPct}% off)`]]
        : []),
      [],
      ['Item', 'Qty', 'Price (Rs)', 'Total (Rs)'],
      ...bill.items.map(i => [i.name, i.qty, i.price, i.total]),
      [],
      ['', '', 'Subtotal',         bill.subtotal],
      ['', '', 'Tax',              bill.taxAmt],
      ...(bill.voucherAmt > 0
        ? [['', '', `Voucher (${bill.voucherCode})`, -bill.voucherAmt]]
        : []),
      ['', '', 'NET TOTAL',        bill.netAmt],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bill');
    ws['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 20 }, { wch: 16 }];

    const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    saveAs(blob, `${bill.id}.xlsx`);
    this.showToast(`Excel downloaded: ${bill.id}`, 'success');
  }

  // ════════════════════════════════════════
  // EXPORT ALL
  // ════════════════════════════════════════

  exportAllExcel(): void {
    if (this.filtered.length === 0) {
      this.showToast('No bills to export.', 'info');
      return;
    }

    const rows = this.filtered.map(b => ({
      'Bill No':           b.id,
      'Phone':             b.customer,
      'Customer Type':     b.customerType,
      'Date':              this.fmtDate(b.date),
      'Payment':           b.payment,
      'Subtotal (Rs)':     b.subtotal,
      'Tax (Rs)':          b.taxAmt,
      'Voucher':           b.voucherCode || '—',
      'Voucher Disc (Rs)': b.voucherAmt  || 0,
      'Net Total (Rs)':    b.netAmt,
      'Items':             b.items.length,
    }));

    const ws  = XLSX.utils.json_to_sheet(rows);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bills');
    ws['!cols'] = [
      { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 15 }, { wch: 8 }
    ];

    const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    saveAs(blob,
      `FinanceTracker-Bills-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    this.showToast(`Exported ${this.filtered.length} bills`, 'success');
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