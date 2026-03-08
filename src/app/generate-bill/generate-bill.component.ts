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
  phoneError:    string = '';   // ← validation error for phone

  // ── Payment ──
  paymentMethod: string = 'CASH';

  // ── Billing ──
  taxPct:   number = 10;
  discount: number = 0;

  // ── Voucher dropdown ──
  selectedVoucherId:   number               = 0;
  appliedVoucher:      VoucherOption | null = null;
  voucherStatus:       string               = '';
  voucherStatusType:   string               = '';
  voucherDropdownOpen: boolean              = false;

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
  // PHONE VALIDATION
  // Accepts 10-digit Indian numbers,
  // optionally prefixed with +91 or 0
  // Field is optional — empty is allowed
  // ════════════════════════════════════════

  private isValidPhone(phone: string): boolean {
    if (!phone.trim()) return true;   // optional field — blank is fine
    const digits = phone.replace(/[\s\-\(\)]/g, '');
    return /^(\+91|0)?[6-9]\d{9}$/.test(digits);
  }

  validatePhone(): void {
    const phone = this.customerPhone.trim();
    if (!phone) {
      this.phoneError = '';
      return;
    }
    this.phoneError = this.isValidPhone(phone)
      ? ''
      : 'Enter a valid 10-digit mobile number (starting with 6–9).';
  }

  clearPhoneError(): void {
    this.phoneError = '';
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
    return this.voucherList.filter(v => Number(v.status) === 1);
  }

  selectVoucher(v: VoucherOption | null): void {
    this.voucherDropdownOpen = false;

    if (!v) {
      this.appliedVoucher    = null;
      this.selectedVoucherId = 0;
      this.voucherStatus     = '';
      this.voucherStatusType = '';
      this.recalcTotals();
      return;
    }

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

  removeVoucher(): void { this.selectVoucher(null); }

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
    // Validate phone before proceeding
    this.validatePhone();
    if (this.phoneError) {
      this.showToast('Please fix the errors before generating the bill.', 'danger');
      return;
    }

    this.isBillGenerated = true;
    if (this.items.length === 0) {
      this.addItem();
    }
  }

  // ════════════════════════════════════════
  // STEP 2 — SAVE BILL
  // ════════════════════════════════════════

  saveBill(): void {
    // Re-validate phone on save as well
    this.validatePhone();
    if (this.phoneError) {
      this.showToast('Please enter a valid phone number before saving.', 'danger');
      return;
    }

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
    const sub  = this.billService
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

  onSearchFocus(item: BillItem): void { this.onSearchInput(item); }

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
    setTimeout(() => this.printBillOnly(), 300);
  }

  private printBillOnly(): void {
    const el = document.getElementById('billPreview');
    if (!el) { window.print(); return; }

    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) { window.print(); return; }

    printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bill — ${this.restaurantName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px; background: white; color: #111; padding: 24px;
    }
    .bill-header { text-align: center; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid #ddd; }
    .bill-restaurant-name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .bill-address, .bill-gst { font-size: 11px; color: #555; }
    .bill-meta {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 8px; margin-bottom: 14px;
      padding-bottom: 14px; border-bottom: 1px solid #ddd; font-size: 11px;
    }
    .bill-meta-item { display: flex; flex-direction: column; }
    .bill-meta-label { font-weight: 600; color: #777; font-size: 10px; text-transform: uppercase; }
    .bill-item-header {
      display: grid; grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 6px; font-weight: 700; font-size: 11px;
      border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 6px;
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .bill-item {
      display: grid; grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 6px; padding: 5px 0; border-bottom: 1px solid #eee; font-size: 12px;
    }
    .bill-totals { margin-top: 14px; padding-top: 10px; border-top: 2px solid #111; }
    .bill-total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
    .bill-total-row.final {
      font-size: 15px; font-weight: 700;
      border-top: 1px solid #ddd; margin-top: 8px; padding-top: 8px;
    }
    .bill-footer {
      text-align: center; margin-top: 18px;
      padding-top: 14px; border-top: 1px dashed #ddd; font-size: 11px; color: #777;
    }
    @page { margin: 10mm; size: A4 portrait; }
  </style>
</head>
<body>${el.innerHTML}</body>
</html>`);

    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 400);
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  inr(n: number): string { return `₹${(n || 0).toFixed(2)}`; }

  get previewDate(): string { return new Date().toLocaleDateString('en-IN'); }

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