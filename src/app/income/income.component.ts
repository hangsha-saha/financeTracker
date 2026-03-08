import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export interface BillItem {
  billItemId: number;
  quantity: number;
  cost: number;
  totalPrice: number;
}

export interface Bill {
  billId: number;
  billDate: string;       // "07-03-2026"
  totalAmt: number;
  taxAmt: number;
  netAmt: number;
  paymentMode: string;    // "CASH" | "UPI" | "CARD"
  customerType: string;   // "Takeaway" | "Dine In" | "Online" | "Delivery"
  phoneNo: string;
  billItems: BillItem[];
}

export interface IncomeRecord {
  date: string;           // normalized to "YYYY-MM-DD" for sorting/filtering
  displayDate: string;    // original "DD-MM-YYYY" for display
  type: string;           // uppercased customerType
  payment: string;        // uppercased paymentMode
  gross: number;          // totalAmt
  tax: number;            // taxAmt
  net: number;            // netAmt
  billId: number;
  phoneNo: string;
}

@Component({
  selector: 'app-income',
  templateUrl: './income.component.html',
  styleUrls: ['./income.component.css']
})
export class IncomeComponent implements OnInit {

  // ── API ──
  // Resolves the correct ID:
  // OWNER / ADMIN  → their own userId
  // MANAGER/WAITER → adminId stored in ft_user (owner's id), fallback to userId
  private get API_URL(): string {
    return `http://192.168.1.39:3000/bills/user/${this.getApiUserId()}`;
  }

  // ── Sidebar ──
  sidebarName: string    = 'Admin User';
  sidebarRole: string    = 'Admin';
  sidebarInitial: string = 'A';
  sidebarEmail: string   = 'admin@restaurant.com';

  // ── Raw & mapped data ──
  ALL: IncomeRecord[] = [];

  // ── Filter state ──
  fDate: string       = '';
  fType: string       = '';
  fPayment: string    = '';
  fMin: number | null = null;
  fMax: number | null = null;
  fSearch: string     = '';

  // ── Filtered data ──
  filtered: IncomeRecord[] = [];

  // ── Sort ──
  sortCol: string          = 'date';
  sortDir: 'asc' | 'desc' = 'desc';

  // ── Pagination ──
  page: number   = 1;
  pgSize: number = 20;

  // ── Summary ──
  totalGross: number = 0;
  totalNet: number   = 0;
  totalTax: number   = 0;

  // ── Header pills ──
  recordCount: string = '0 records';
  headerNet: string   = '₹0';

  // ── Active filter tags ──
  filterTags: string[] = [];

  // ── UI state ──
  isLoading: boolean = true;
  errorMsg: string   = '';

  // ── Badge maps ──
  readonly TYPE_CLS: any = {
    'DINE IN':  'b-dine-in',
    'ONLINE':   'b-online',
    'TAKEAWAY': 'b-takeaway',
    'DELIVERY': 'b-delivery'
  };

  readonly PAY_CLS: any = {
    'CASH': 'b-cash',
    'UPI':  'b-upi',
    'CARD': 'b-card'
  };

  constructor(private http: HttpClient, private router: Router, private authService: AuthService) {}

  ngOnInit(): void {
    this.loadSidebarProfile();
    this.fetchBills();
  }

  // ════════════════════════════════════════
  // RESOLVE WHICH ID TO USE FOR API CALLS
  //
  // OWNER / ADMIN  → use their own userId
  // MANAGER/WAITER → use adminId stored in ft_user if present,
  //                  otherwise fall back to their own userId
  // ════════════════════════════════════════

  private getApiUserId(): number {
    const currentUser = this.authService.getCurrentUser();
    const adminId     = (currentUser as any)?.adminId ?? 0;
    const userId      = this.authService.getCurrentUserId();

    if (adminId && adminId !== 0) {
      console.log('[Income] Using adminId for API calls:', adminId);
      return adminId;
    }

    console.log('[Income] Using userId for API calls:', userId);
    return userId;
  }

  // ── Fetch from API ──
  fetchBills(): void {
    this.isLoading = true;
    this.errorMsg  = '';

    console.log('[Income] Fetching bills from:', this.API_URL);

    this.http.get<Bill[]>(this.API_URL).subscribe({
      next: (bills) => {
        this.ALL = bills.map(b => this.mapBill(b));
        this.isLoading = false;
        this.applyFilters();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg  = `Failed to load data: ${err.message || 'Network error'}`;
        console.error('Income API error:', err);
      }
    });
  }

  /** Convert API Bill → IncomeRecord */
  private mapBill(b: Bill): IncomeRecord {
    // Parse "DD-MM-YYYY" → "YYYY-MM-DD" for proper sorting
    const parts = b.billDate.split('-');
    const isoDate = parts.length === 3
      ? `${parts[2]}-${parts[1]}-${parts[0]}`
      : b.billDate;

    return {
      billId:      b.billId,
      date:        isoDate,
      displayDate: b.billDate,
      type:        (b.customerType || '').toUpperCase(),
      payment:     (b.paymentMode  || '').toUpperCase(),
      gross:       b.totalAmt,
      tax:         b.taxAmt,
      net:         b.netAmt,
      phoneNo:     b.phoneNo || ''
    };
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
      }
    } catch(e) {}
  }

  // ── Navigation ──
  readonly BUILT_PAGES = ['dashboard', 'login', 'inventory', 'income', 'expense', 'menu', 'generate-bill'];

  goTo(page: string): void {
    if (this.BUILT_PAGES.includes(page)) this.router.navigate(['/' + page]);
  }

  handleLogout(): void {
    if (confirm('Are you sure you want to logout?')) this.router.navigate(['/login']);
  }

  // ── Filter ──
  applyFilters(): void {
    const min    = this.fMin != null ? this.fMin : 0;
    const max    = this.fMax != null ? this.fMax : Infinity;
    const search = this.fSearch.trim().toLowerCase();

    this.filtered = this.ALL.filter(r => {
      // Date filter — compare against ISO date
      if (this.fDate && r.date !== this.fDate) return false;

      // Type filter — normalize both sides
      if (this.fType) {
        const normalizedType   = r.type.replace(/\s+/g, ' ').trim();
        const normalizedFilter = this.fType.toUpperCase().replace(/\s+/g, ' ').trim();
        if (normalizedType !== normalizedFilter) return false;
      }

      // Payment filter
      if (this.fPayment && r.payment !== this.fPayment.toUpperCase()) return false;

      // Amount range — filter on gross (totalAmt)
      if (r.gross < min || r.gross > max) return false;

      // Full-text search
      if (search) {
        const hay = `${r.displayDate} ${r.date} ${r.type} ${r.payment} ${r.gross} ${r.net} ${r.phoneNo} ${r.billId}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }

      return true;
    });

    this.page = 1;
    this.sortData();
    this.updateSummary();
    this.buildFilterTags();
  }

  clearFilters(): void {
    this.fDate    = '';
    this.fType    = '';
    this.fPayment = '';
    this.fMin     = null;
    this.fMax     = null;
    this.fSearch  = '';
    this.applyFilters();
  }

  buildFilterTags(): void {
    const tags: string[] = [];
    if (this.fDate)                 tags.push(`📅 ${this.fDate}`);
    if (this.fType)                 tags.push(`Type: ${this.fType}`);
    if (this.fPayment)              tags.push(`Pay: ${this.fPayment}`);
    if (this.fMin && this.fMin > 0) tags.push(`Min: ₹${this.fMin}`);
    if (this.fMax)                  tags.push(`Max: ₹${this.fMax}`);
    if (this.fSearch.trim())        tags.push(`"${this.fSearch.trim()}"`);
    this.filterTags = tags;
  }

  get hasActiveFilters(): boolean { return this.filterTags.length > 0; }

  // ── Sort ──
  setSort(col: string): void {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = 'asc';
    }
    this.sortData();
  }

  sortData(): void {
    this.filtered.sort((a: any, b: any) => {
      let av = a[this.sortCol];
      let bv = b[this.sortCol];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return this.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return this.sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  getSortIcon(col: string): string {
    if (this.sortCol !== col) return '⇅';
    return this.sortDir === 'asc' ? '▲' : '▼';
  }

  isSortActive(col: string): boolean { return this.sortCol === col; }

  // ── Summary ──
  updateSummary(): void {
    this.totalGross  = this.filtered.reduce((s, r) => s + r.gross, 0);
    this.totalNet    = this.filtered.reduce((s, r) => s + r.net,   0);
    this.totalTax    = this.filtered.reduce((s, r) => s + r.tax,   0);
    this.recordCount = `${this.filtered.length} record${this.filtered.length !== 1 ? 's' : ''}`;
    this.headerNet   = this.inr(this.totalNet);
  }

  // ── Pagination ──
  get pagedItems(): IncomeRecord[] {
    const start = (this.page - 1) * this.pgSize;
    return this.filtered.slice(start, start + this.pgSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pgSize));
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const start = Math.max(1, this.page - 2);
    const end   = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages) this.page = p;
  }

  onPgSizeChange(event: Event): void {
    this.pgSize = parseInt((event.target as HTMLSelectElement).value);
    this.page = 1;
  }

  // ── Badge helpers ──
  typeBadgeClass(type: string): string { return this.TYPE_CLS[type] || ''; }
  payBadgeClass(pay: string): string   { return this.PAY_CLS[pay]   || ''; }

  // ── Format ──
  inr(n: number): string {
    return '₹' + n.toLocaleString('en-IN');
  }
}