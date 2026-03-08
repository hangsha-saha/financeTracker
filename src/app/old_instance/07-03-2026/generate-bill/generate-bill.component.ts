import { Component, OnInit, OnDestroy } from '@angular/core';
import { BillService, MenuItemOption, VoucherData } from '../services/bill.service';
import { Subscription } from 'rxjs';

export interface BillItem {
  id:              number;
  name:            string;
  qty:             number;
  price:           number;
  total:           number;
  searchText:      string;
  dropdownOpen:    boolean;
  dropdownResults: MenuItemOption[];
  highlightIdx:    number;
}

export interface Voucher {
  type:  'percent' | 'flat';
  value: number;
  label: string;
}

@Component({
  selector:    'app-generate-bill',
  templateUrl: './generate-bill.component.html',
  styleUrls:   ['./generate-bill.component.css']
})
export class GenerateBillComponent implements OnInit, OnDestroy {

  // ── Loaded from JSON ──
  MENU:     MenuItemOption[]            = [];
  VOUCHERS: { [code: string]: Voucher } = {};

  // ── Loading states ──
  isLoadingMenu:     boolean = false;
  isLoadingVouchers: boolean = false;
  menuError:         string  = '';

  // ── Bill form fields ──
  billNumber:    string = 'BL-2026-001';
  customerType:  string = 'dine-in';
  tableNumber:   string = '';
  customerName:  string = '';
  customerPhone: string = '';
  customerEmail: string = '';
  paymentMethod: string = 'CASH';
  notes:         string = '';
  taxPct:        number = 10;
  discount:      number = 0;

  // ── Voucher ──
  voucherCode:       string                              = '';
  appliedVoucher:    (Voucher & { code: string }) | null = null;
  voucherStatus:     string                              = '';
  voucherStatusType: string                              = '';

  // ── Bill items ──
  items:          BillItem[] = [];
  private nextId: number     = 1;

  // ── Computed totals ──
  subtotal:   number = 0;
  taxAmt:     number = 0;
  voucherAmt: number = 0;
  total:      number = 0;

  // ── Print modal ──
  showPrintConfirm: boolean = false;

  readonly CAT_LABELS: any = {
    'dine-in':  'Dine-In',
    'walk-in':  'Walk-In',
    'takeaway': 'Takeaway'
  };

  readonly CAT_BADGE_CLASS: any = {
    'dine-in':  'badge-dine-in',
    'walk-in':  'badge-walk-in',
    'takeaway': 'badge-takeaway'
  };

  private subs: Subscription[] = [];

  constructor(private billService: BillService) {}

  ngOnInit(): void {
    this.loadMenu();
    this.loadVouchers();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ── Current user (replace with AuthService later) ──
  private readonly CURRENT_USER_ID: number = 1;

  // ════════════════════════════════════════
  // LOAD MENU — filtered by userId
  // ════════════════════════════════════════

  loadMenu(): void {
    this.isLoadingMenu = true;
    this.menuError     = '';

    const sub = this.billService
      .getMenuItemsByUserId(this.CURRENT_USER_ID)   // ← changed
      .subscribe({
        next: items => {
          this.MENU          = items;
          this.isLoadingMenu = false;
          // Pre-load 3 sample items after menu is ready
          this.addItemWithData({ name: 'Biryani',    price: 350, qty: 2 });
          this.addItemWithData({ name: 'Naan',       price: 40,  qty: 1 });
          this.addItemWithData({ name: 'Cold Drink', price: 50,  qty: 2 });
          this.recalcTotals();
        },
        error: () => {
          this.menuError     = 'Failed to load menu. Please refresh.';
          this.isLoadingMenu = false;
        }
      });

    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // LOAD VOUCHERS — filtered by userId
  // ════════════════════════════════════════

  loadVouchers(): void {
    this.isLoadingVouchers = true;

    const sub = this.billService
      .getVouchersByUserId(this.CURRENT_USER_ID)    // ← changed
      .subscribe({
        next: list => {
          const map: { [code: string]: Voucher } = {};
          list.forEach(v => {
            map[v.code] = {
              type:  v.type,
              value: v.value,
              label: v.label
            };
          });
          this.VOUCHERS          = map;
          this.isLoadingVouchers = false;
        },
        error: () => {
          this.isLoadingVouchers = false;
        }
      });

    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // CUSTOMER TYPE
  // ════════════════════════════════════════

  setCustomerType(type: string): void {
    this.customerType = type;
    if (type !== 'dine-in') this.tableNumber = '';
    this.recalcTotals();
  }

  // ════════════════════════════════════════
  // VOUCHER
  // ════════════════════════════════════════

  applyVoucher(): void {
    const code = this.voucherCode.trim().toUpperCase();

    if (!code) {
      this.voucherStatus     = '⚠ Please enter a voucher code.';
      this.voucherStatusType = 'error';
      return;
    }

    if (this.isLoadingVouchers || Object.keys(this.VOUCHERS).length === 0) {
      this.voucherStatus     = '⚠ Vouchers are still loading, please try again.';
      this.voucherStatusType = 'error';
      return;
    }

    const found = this.VOUCHERS[code];

    if (found) {
      this.appliedVoucher = {
        code:  code,
        type:  found.type,
        value: found.value,
        label: found.label
      };
      this.voucherStatus     = `✓ Voucher applied: ${found.label}`;
      this.voucherStatusType = 'success';
    } else {
      this.appliedVoucher    = null;
      this.voucherStatus     = '✕ Invalid code. Try: SAVE10, FLAT50, WELCOME20, VIP15, SPECIAL100';
      this.voucherStatusType = 'error';
    }

    this.recalcTotals();
  }

  removeVoucher(): void {
    this.appliedVoucher    = null;
    this.voucherCode       = '';
    this.voucherStatus     = '';
    this.voucherStatusType = '';
    this.recalcTotals();
  }

  // ════════════════════════════════════════
  // ITEMS
  // ════════════════════════════════════════

  addItem(): void {
    this.items.push({
      id:              this.nextId++,
      name:            '',
      qty:             1,
      price:           0,
      total:           0,
      searchText:      '',
      dropdownOpen:    false,
      dropdownResults: [],
      highlightIdx:    -1
    });
  }

  addItemWithData(data: { name: string; price: number; qty: number }): void {
    this.items.push({
      id:              this.nextId++,
      name:            data.name,
      qty:             data.qty,
      price:           data.price,
      total:           data.price * data.qty,
      searchText:      data.name,
      dropdownOpen:    false,
      dropdownResults: [],
      highlightIdx:    -1
    });
  }

  removeItem(id: number): void {
    this.items = this.items.filter(i => i.id !== id);
    this.recalcTotals();
  }

  // ════════════════════════════════════════
  // SEARCH DROPDOWN
  // ════════════════════════════════════════

  onSearchInput(item: BillItem): void {
    const q = item.searchText.toLowerCase().trim();
    item.dropdownResults = q === ''
      ? this.MENU.slice(0, 10)
      : this.MENU.filter(m => m.name.toLowerCase().includes(q));
    item.dropdownOpen = true;
    item.highlightIdx = -1;
  }

  onSearchFocus(item: BillItem): void {
    const q = item.searchText.toLowerCase().trim();
    item.dropdownResults = q === ''
      ? this.MENU.slice(0, 10)
      : this.MENU.filter(m => m.name.toLowerCase().includes(q));
    item.dropdownOpen = true;
  }

  onSearchBlur(item: BillItem): void {
    setTimeout(() => { item.dropdownOpen = false; }, 180);
  }

  onSearchKeydown(event: KeyboardEvent, item: BillItem): void {
    const len = item.dropdownResults.length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      item.highlightIdx = Math.min(item.highlightIdx + 1, len - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      item.highlightIdx = Math.max(item.highlightIdx - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (item.highlightIdx >= 0 && item.dropdownResults[item.highlightIdx]) {
        this.selectMenuItem(item, item.dropdownResults[item.highlightIdx]);
      }
    } else if (event.key === 'Escape') {
      item.dropdownOpen = false;
    }
  }

  selectMenuItem(item: BillItem, menu: MenuItemOption): void {
    item.name         = menu.name;
    item.searchText   = menu.name;
    item.price        = menu.price;
    item.dropdownOpen = false;
    item.highlightIdx = -1;
    this.updateItemTotal(item);
  }

  updateItemTotal(item: BillItem): void {
    item.total = (item.qty || 0) * (item.price || 0);
    this.recalcTotals();
  }

  // ════════════════════════════════════════
  // TOTALS
  // ════════════════════════════════════════

  recalcTotals(): void {
    this.subtotal = this.items.reduce((s, i) => s + (i.total || 0), 0);
    this.taxAmt   = (this.subtotal * (this.taxPct || 0)) / 100;

    this.voucherAmt = 0;
    if (this.appliedVoucher) {
      const v = this.appliedVoucher;
      this.voucherAmt = v.type === 'percent'
        ? ((this.subtotal + this.taxAmt) * v.value) / 100
        : v.value;
      this.voucherAmt = Math.min(
        this.voucherAmt,
        this.subtotal + this.taxAmt - (this.discount || 0)
      );
    }

    this.total = Math.max(
      0,
      this.subtotal + this.taxAmt - (this.discount || 0) - this.voucherAmt
    );
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  inr(n: number): string { return `₹${n.toFixed(2)}`; }

  get previewCustomerName(): string {
    return this.customerName.trim() || 'Walk-in Customer';
  }

  get previewDate(): string {
    return new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  get previewTime(): string {
    return new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  get filledItems(): BillItem[] {
    return this.items.filter(i => i.name.trim());
  }

  // ════════════════════════════════════════
  // PRINT
  // ════════════════════════════════════════

  openPrintConfirm(): void  { this.showPrintConfirm = true; }
  closePrintConfirm(): void { this.showPrintConfirm = false; }

  doPrint(): void {
    this.showPrintConfirm = false;
    setTimeout(() => window.print(), 300);
  }

  // ════════════════════════════════════════
  // SAVE
  // ════════════════════════════════════════

  saveBill(): void {
    alert(
      `Bill saved successfully!\n` +
      `Bill No: ${this.billNumber}\n` +
      `Type: ${this.CAT_LABELS[this.customerType]}\n` +
      `Total: ${this.inr(this.total)}`
    );
  }
}