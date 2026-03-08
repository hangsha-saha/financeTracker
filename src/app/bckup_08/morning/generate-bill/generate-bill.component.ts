import { Component, OnInit, OnDestroy } from '@angular/core';
import { BillService, MenuItemOption, VoucherOption, BillPayload } from '../services/bill.service';
import { AuthService } from '../services/auth.service';
import { Subscription, forkJoin } from 'rxjs';

export interface BillItem {
  id:              number;
  menuItemId:      number;
  name:            string;
  qty:             number;
  price:           number;
  total:           number;
  searchText:      string;
  dropdownOpen:    boolean;
  dropdownResults: MenuItemOption[];
}

@Component({
  selector:    'app-generate-bill',
  templateUrl: './generate-bill.component.html',
  styleUrls:   ['./generate-bill.component.css']
})
export class GenerateBillComponent implements OnInit, OnDestroy {

  // ── Restaurant info ──
  restaurantName:    string = 'FinanceTracker Restaurant';
  restaurantAddress: string = '';
  restaurantGst:     string = '';

  // ── Menu + Vouchers ──
  MENU:        MenuItemOption[] = [];
  voucherList: VoucherOption[]  = [];

  // ── Loading states ──
  isLoadingMenu: boolean = false;
  isSavingBill:  boolean = false;
  menuError:     string  = '';

  // ── Bill flow ──
  isBillGenerated: boolean       = false;
  savedBillId:     number | null = null;

  // ── Customer info ──
  customerType:  string = 'dine-in';
  customerPhone: string = '';

  // ── Payment ──
  paymentMethod: string = 'CASH';

  // ── Billing ──
  taxPct:   number = 10;
  discount: number = 0;

  // ── Voucher dropdown ──
  selectedVoucherId: number          = 0;   // 0 = no voucher
  appliedVoucher:    VoucherOption | null = null;
  voucherStatus:     string          = '';
  voucherStatusType: string          = '';
  voucherDropdownOpen: boolean       = false;

  // ── Items ──
  items:          BillItem[] = [];
  private nextId: number     = 1;

  // ── Totals ──
  subtotal:   number = 0;
  taxAmt:     number = 0;
  voucherAmt: number = 0;
  total:      number = 0;

  // ── UI ──
  showPrintConfirm: boolean = false;

  // ── Toast ──
  toastMsg:     string  = '';
  toastType:    string  = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  readonly CAT_LABELS: { [key: string]: string } = {
    'dine-in':  'Dine-In',
    'walk-in':  'Walk-In',
    'takeaway': 'Takeaway'
  };

  private subs: Subscription[] = [];

  constructor(
    private billService: BillService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearTimeout(this.toastTimer);
  }

  // ════════════════════════════════════════
  // LOAD — menu + vouchers + restaurant
  // ════════════════════════════════════════

  loadInitialData(): void {
    this.isLoadingMenu = true;
    this.menuError     = '';

    const sub = forkJoin({
      menu:       this.billService.getMenuItems(),
      vouchers:   this.billService.getVouchers(),
      restaurant: this.billService.getRestaurant(),
    }).subscribe({
      next: ({ menu, vouchers, restaurant }) => {
        this.MENU        = menu;
        this.voucherList = vouchers;

        if (restaurant && restaurant.length > 0) {
          const r = restaurant[0];
          this.restaurantName    = r.restaurantName || 'FinanceTracker Restaurant';
          this.restaurantAddress = r.address        || '';
          this.restaurantGst     = r.gstNumber      || '';
        }

        this.isLoadingMenu = false;
      },
      error: () => {
        this.menuError     = 'Failed to load data. Please retry.';
        this.isLoadingMenu = false;
      }
    });
    this.subs.push(sub);
  }

  loadMenu(): void {
    this.loadInitialData();
  }

  // ════════════════════════════════════════
  // VOUCHER DROPDOWN
  // ════════════════════════════════════════

  get activeVouchers(): VoucherOption[] {
    return this.voucherList.filter(v => v.status === 1);
  }

  selectVoucher(v: VoucherOption | null): void {
    this.voucherDropdownOpen = false;

    if (!v) {
      // "No Voucher" selected
      this.appliedVoucher    = null;
      this.selectedVoucherId = 0;
      this.voucherStatus     = '';
      this.voucherStatusType = '';
      this.recalcTotals();
      return;
    }

    // Minimum amount check (client-side UX hint)
    if (this.subtotal > 0 && v.minAmount > 0 && this.subtotal < v.minAmount) {
      this.showToast(
        `Minimum order ₹${v.minAmount} required for voucher "${v.code}".`,
        'danger'
      );
      this.appliedVoucher    = null;
      this.selectedVoucherId = 0;
      this.voucherStatus     = `✕ Min. order ₹${v.minAmount} required`;
      this.voucherStatusType = 'error';
      this.recalcTotals();
      return;
    }

    this.appliedVoucher    = v;
    this.selectedVoucherId = v.id;
    this.voucherStatus     = `✓ Applied: ${v.code} — ${v.percentage}% off`;
    this.voucherStatusType = 'success';
    this.recalcTotals();
  }

  removeVoucher(): void {
    this.selectVoucher(null);
  }

  toggleVoucherDropdown(): void {
    this.voucherDropdownOpen = !this.voucherDropdownOpen;
  }

  closeVoucherDropdown(): void {
    setTimeout(() => { this.voucherDropdownOpen = false; }, 180);
  }

  // ════════════════════════════════════════
  // STEP 1 — GENERATE BILL
  // ════════════════════════════════════════

  generateBill(): void {
    this.isBillGenerated = true;
    if (this.items.length === 0) {
      this.addItem();
    }
  }

  // ════════════════════════════════════════
  // STEP 2 — SAVE BILL
  // ════════════════════════════════════════

  saveBill(): void {
    const filled = this.filledItems;

    if (!this.isBillGenerated) {
      this.showToast('Please generate the bill first.', 'danger');
      return;
    }
    if (filled.length === 0) {
      this.showToast('Please add at least one item before saving.', 'danger');
      return;
    }
    const invalid = filled.find(i => !i.menuItemId || i.menuItemId === 0);
    if (invalid) {
      this.showToast('Please select items from the dropdown.', 'danger');
      return;
    }

    this.isSavingBill = true;

    const voucherId = this.appliedVoucher?.id ?? 0;

    const payload: BillPayload = {
      paymentMode:  this.paymentMethod || 'CASH',
      customerType: this.customerType,
      phoneNo:      this.customerPhone.trim(),
    };

    console.log('[Bill] POST — voucherId:', voucherId, '— payload:', payload);

    const sub = this.billService.createBill(payload, voucherId).subscribe({
      next: (billRes) => {
        console.log('[Bill] created:', billRes);

        const billId = billRes.billId
                    ?? billRes.id
                    ?? billRes.bill_id
                    ?? billRes.billID;

        if (!billId) {
          this.showToast('Bill saved but no billId returned.', 'danger');
          this.isSavingBill = false;
          return;
        }

        this.savedBillId = billId;
        this.saveItemsSequentially(billId, filled, 0);
      },
      error: (err) => {
        console.error('[Bill] create failed:', err);
        this.showToast(
          err.error?.message || 'Failed to save bill. Please try again.',
          'danger'
        );
        this.isSavingBill = false;
      }
    });
    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // SAVE ITEMS SEQUENTIALLY
  // ════════════════════════════════════════

  private saveItemsSequentially(billId: number, items: BillItem[], index: number): void {
    if (index >= items.length) {
      this.isSavingBill = false;
      this.showToast(
        `Bill saved! ${items.length} item(s) added. Total: ${this.inr(this.total)}`,
        'success'
      );
      return;
    }

    const item = items[index];
    const sub = this.billService
      .addBillItem(billId, item.menuItemId, item.qty)
      .subscribe({
        next:  () => this.saveItemsSequentially(billId, items, index + 1),
        error: (err) => {
          console.error(`[Bill-Item] failed for "${item.name}":`, err);
          this.saveItemsSequentially(billId, items, index + 1);
        }
      });
    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // CUSTOMER TYPE
  // ════════════════════════════════════════

  setCustomerType(type: string): void {
    this.customerType = type;
    this.recalcTotals();
  }

  // ════════════════════════════════════════
  // ITEMS
  // ════════════════════════════════════════

  addItem(): void {
    this.items.push({
      id:              this.nextId++,
      menuItemId:      0,
      name:            '',
      qty:             1,
      price:           0,
      total:           0,
      searchText:      '',
      dropdownOpen:    false,
      dropdownResults: [],
    });
  }

  removeItem(id: number): void {
    this.items = this.items.filter((i: BillItem) => i.id !== id);
    this.recalcTotals();
  }

  onSearchInput(item: BillItem): void {
    const q = item.searchText.toLowerCase().trim();
    item.dropdownResults = q === ''
      ? this.MENU.slice(0, 8)
      : this.MENU.filter((m: MenuItemOption) => m.name.toLowerCase().includes(q));
    item.dropdownOpen = true;
    item.menuItemId   = 0;
    item.price        = 0;
    item.total        = 0;
    this.recalcTotals();
  }

  onSearchFocus(item: BillItem): void {
    this.onSearchInput(item);
  }

  onSearchBlur(item: BillItem): void {
    setTimeout(() => { item.dropdownOpen = false; }, 200);
  }

  selectMenuItem(item: BillItem, menu: MenuItemOption): void {
    item.menuItemId   = menu.id;
    item.name         = menu.name;
    item.searchText   = menu.name;
    item.price        = menu.price;
    item.dropdownOpen = false;
    this.updateItemTotal(item);
  }

  updateItemTotal(item: BillItem): void {
    item.total = (item.qty || 0) * (item.price || 0);
    this.recalcTotals();
  }

  recalcTotals(): void {
    this.subtotal = this.items.reduce((s, i) => s + (i.total || 0), 0);
    this.taxAmt   = (this.subtotal * (this.taxPct || 0)) / 100;

    this.voucherAmt = 0;
    if (this.appliedVoucher) {
      // Percentage-based voucher from backend
      this.voucherAmt = ((this.subtotal + this.taxAmt) * this.appliedVoucher.percentage) / 100;
    }

    this.total = Math.max(
      0,
      this.subtotal + this.taxAmt - (this.discount || 0) - this.voucherAmt
    );
  }

  // ════════════════════════════════════════
  // PRINT
  // ════════════════════════════════════════

  openPrintConfirm(): void  { this.showPrintConfirm = true;  }
  closePrintConfirm(): void { this.showPrintConfirm = false; }
  doPrint(): void {
    this.showPrintConfirm = false;
    setTimeout(() => window.print(), 300);
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  inr(n: number): string {
    return `₹${(n || 0).toFixed(2)}`;
  }

  get previewDate(): string {
    return new Date().toLocaleDateString('en-IN');
  }

  get filledItems(): BillItem[] {
    return this.items.filter((i: BillItem) => i.name.trim() !== '' && i.price > 0);
  }

  // ════════════════════════════════════════
  // TOAST
  // ════════════════════════════════════════

  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastVisible = false; }, 3000);
  }
}