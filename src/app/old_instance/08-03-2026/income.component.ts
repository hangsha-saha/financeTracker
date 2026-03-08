import { Component, OnInit, OnDestroy } from '@angular/core';
import { IncomeService, IncomeRecord } from '../services/income.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-income',
  templateUrl: './income.component.html',
  styleUrls: ['./income.component.css']
})
export class IncomeComponent implements OnInit, OnDestroy {

  private readonly CURRENT_USER_ID = 1;

  private ALL: IncomeRecord[] = [];

  isLoading: boolean = false;
  apiError:  string  = '';

  filtered: IncomeRecord[] = [];

  fDate:    string        = '';
  fType:    string        = '';
  fPayment: string        = '';
  fMin:     number | null = null;
  fMax:     number | null = null;
  fSearch:  string        = '';

  sortCol: string          = 'date';
  sortDir: 'asc' | 'desc' = 'desc';

  page:   number = 1;
  pgSize: number = 20;

  totalGross:  number = 0;
  recordCount: string = '0 records';
  headerGross: string = '₹0';

  filterTags: string[] = [];

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

  private sub!: Subscription;

  constructor(private incomeService: IncomeService) {}

  ngOnInit(): void {
    this.loadIncome();
  }

  ngOnDestroy(): void {
    if (this.sub) this.sub.unsubscribe();
  }

  loadIncome(): void {
    this.isLoading = true;
    this.apiError  = '';

    this.sub = this.incomeService.getByUserId(this.CURRENT_USER_ID).subscribe({
      next: records => {
        this.ALL       = records;
        this.isLoading = false;
        this.applyFilters();
      },
      error: err => {
        this.apiError  = 'Failed to load income data. Please try again.';
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    const min    = this.fMin ?? 0;
    const max    = this.fMax ?? Infinity;
    const search = this.fSearch.trim().toLowerCase();

    this.filtered = this.ALL.filter(r => {
      if (this.fDate    && r.date    !== this.fDate)    return false;
      if (this.fType    && r.type    !== this.fType)    return false;
      if (this.fPayment && r.payment !== this.fPayment) return false;
      if (r.gross < min || r.gross > max)               return false;
      if (search) {
        const hay = `${r.date} ${r.type} ${r.payment} ${r.gross}`.toLowerCase();
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
    this.fDate = ''; this.fType = ''; this.fPayment = '';
    this.fMin  = null; this.fMax = null; this.fSearch = '';
    this.applyFilters();
  }

  buildFilterTags(): void {
    const tags: string[] = [];
    if (this.fDate)               tags.push(`📅 ${this.fDate}`);
    if (this.fType)               tags.push(`Type: ${this.fType}`);
    if (this.fPayment)            tags.push(`Pay: ${this.fPayment}`);
    if (this.fMin && this.fMin > 0) tags.push(`Min: ₹${this.fMin}`);
    if (this.fMax)                tags.push(`Max: ₹${this.fMax}`);
    if (this.fSearch.trim())      tags.push(`"${this.fSearch.trim()}"`);
    this.filterTags = tags;
  }

  get hasActiveFilters(): boolean { return this.filterTags.length > 0; }

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
      if (av > bv) return this.sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }

  getSortIcon(col: string): string {
    if (this.sortCol !== col) return '⇅';
    return this.sortDir === 'asc' ? '▲' : '▼';
  }

  isSortActive(col: string): boolean { return this.sortCol === col; }

  updateSummary(): void {
    this.totalGross  = this.filtered.reduce((s, r) => s + r.gross, 0);
    this.recordCount = `${this.filtered.length} record${this.filtered.length !== 1 ? 's' : ''}`;
    this.headerGross = this.inr(this.totalGross);
  }

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
    this.page   = 1;
  }

  typeBadgeClass(type: string): string { return this.TYPE_CLS[type] || ''; }
  payBadgeClass(pay: string):   string { return this.PAY_CLS[pay]   || ''; }

  inr(n: number): string {
    return '₹' + n.toLocaleString('en-IN');
  }
}