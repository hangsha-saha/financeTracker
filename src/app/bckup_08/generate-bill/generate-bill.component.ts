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

export interface Voucher {
  id:    number;
  code:  string;
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

  // ── Restaurant info ──
  restaurantName:    string = 'FinanceTracker Restaurant';
  restaurantAddress: string = '';
  restaurantGst:     string = '';

  // ── Menu + Vouchers ──
  MENU:        MenuItemOption[]             = [];
  VOUCHERS:    { [code: string]: Voucher }  = {};
  voucherList: Voucher[]                    = [];

  // ── Loading states ──
  isLoadingMenu: boolean = false;
  isSavingBill:  boolean = false;
  menuError:     string  = '';

  // ── Bill flow ──
  isBillGenerated: boolean      = false;
  savedBillId:     number | null = null;

  // ── Customer info ──
  customerType:  string = 'dine-in';
  customerPhone: string = '';
  notes:         string = '';

  // ── Payment ──
  paymentMethod: string = 'CASH';

  // ── Billing ──
  taxPct:   number = 10;
  discount: number = 0;

  // ── Voucher ──
  voucherCode:       string         = '';
  appliedVoucher:    Voucher | null = null;
  voucherStatus:     string         = '';
  voucherStatusType: string         = '';

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

        const map: { [code: string]: Voucher } = {};
        vouchers.forEach(v => { map[v.code] = v; });
        this.VOUCHERS = map;

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
  //
  // POST /bills/user/{userId}/voucher/{voucherId|null}
  // Body: { paymentMode, customerType, phoneNo }
  // Then for each item:
  // POST /bill-items/bill/{billId}/item/{menuItemId}
  // Body: { quantity }
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

    // No voucher → 'null' in URL, with voucher → voucherId number
    const voucherId: number = this.appliedVoucher?.id ?? 0;

    const payload: BillPayload = {
      paymentMode:  this.paymentMethod || 'CASH',
      customerType: this.customerType,
      phoneNo:      this.customerPhone.trim(),
    };

    console.log('[Bill] POST /bills — voucherId:', voucherId, '— payload:', payload);

    const sub = this.billService.createBill(payload, voucherId).subscribe({
      next: (billRes) => {
        console.log('[Bill] Bill created — response:', billRes);

        const billId = billRes.billId
                    ?? billRes.id
                    ?? billRes.bill_id
                    ?? billRes.billID;

        if (!billId) {
          console.error('[Bill] No billId in response:', billRes);
          this.showToast(
            'Bill saved but could not attach items — no billId returned.',
            'danger'
          );
          this.isSavingBill = false;
          return;
        }

        this.savedBillId = billId;
        this.saveItemsSequentially(billId, filled, 0);
      },
      error: (err) => {
        console.error('[Bill] Create bill failed:', err.status, err.error);
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

  private saveItemsSequentially(
    billId: number,
    items:  BillItem[],
    index:  number
  ): void {
    if (index >= items.length) {
      this.isSavingBill = false;
      this.showToast(
        `Bill saved! ${items.length} item(s) added. Total: ${this.inr(this.total)}`,
        'success'
      );
      console.log('[Bill] All items saved for billId:', billId);
      return;
    }

    const item = items[index];
    console.log(
      `[Bill-Item] POST bill/${billId}/item/${item.menuItemId} — qty:`, item.qty
    );

    const sub = this.billService
      .addBillItem(billId, item.menuItemId, item.qty)
      .subscribe({
        next: (res) => {
          console.log(`[Bill-Item] Item ${index + 1} saved:`, res);
          this.saveItemsSequentially(billId, items, index + 1);
        },
        error: (err) => {
          console.error(
            `[Bill-Item] Failed to save item "${item.name}":`,
            err.status, err.error
          );
          // Continue saving remaining items even if one fails
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
  // VOUCHER
  // ════════════════════════════════════════

  applyVoucher(): void {
    const code = this.voucherCode.trim().toUpperCase();
    if (!code) return;
    const found = this.VOUCHERS[code];
    if (found) {
      this.appliedVoucher    = found;
      this.voucherStatus     = `✓ Applied: ${found.label}`;
      this.voucherStatusType = 'success';
    } else {
      this.voucherStatus     = '✕ Invalid code';
      this.voucherStatusType = 'error';
      this.appliedVoucher    = null;
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
      : this.MENU.filter((m: MenuItemOption) =>
          m.name.toLowerCase().includes(q)
        );
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
    console.log('[selectMenuItem] selected:', menu.id, menu.name, menu.price);
    this.updateItemTotal(item);
  }

  updateItemTotal(item: BillItem): void {
    item.total = (item.qty || 0) * (item.price || 0);
    this.recalcTotals();
  }

  recalcTotals(): void {
    this.subtotal   = this.items.reduce(
      (s: number, i: BillItem) => s + (i.total || 0), 0
    );
    this.taxAmt     = (this.subtotal * (this.taxPct || 0)) / 100;
    this.voucherAmt = 0;

    if (this.appliedVoucher) {
      const v = this.appliedVoucher;
      this.voucherAmt = v.type === 'percent'
        ? ((this.subtotal + this.taxAmt) * v.value) / 100
        : v.value;
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
    return this.items.filter(
      (i: BillItem) => i.name.trim() !== '' && i.price > 0
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
    this.toastTimer = setTimeout(() => { this.toastVisible = false; }, 3000);
  }
}