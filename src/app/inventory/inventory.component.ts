import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  InventoryService,
  InventoryApiItem,
  InventoryAddPayload,
  InventoryUpdatePayload,
  VendorNameItem
} from '../services/inventory.service';
import { Subscription } from 'rxjs';

export interface InventoryItem {
  inventoryId:     number;
  name:            string;
  category:        string;
  unit:            string;
  quantity:        number;
  usedQuantity:    number;
  minimumQuantity: number;
  supplier:        string;   // vendorName
  vendorId:        number;
  costUnit:        number;
  notes:           string;
}

@Component({
  selector:    'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls:   ['./inventory.component.css']
})
export class InventoryComponent implements OnInit, OnDestroy {

  // ── Data ──
  inventory: InventoryItem[] = [];
  filtered:  InventoryItem[] = [];

  // ── Vendor dropdown ──
  vendorList:        VendorNameItem[] = [];
  isLoadingVendors:  boolean          = false;

  // ── Loading / error ──
  isLoading:  boolean = false;
  isSaving:   boolean = false;
  isDeleting: boolean = false;
  apiError:   string  = '';

  // ── Filter state ──
  searchText:     string = '';
  statusFilter:   string = 'all';
  categoryFilter: string = '';

  // ── Sort ──
  sortCol: string          = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  // ── Pagination ──
  page:   number = 1;
  pgSize: number = 10;

  // ── Header stats ──
  statInStock: number = 0;
  statLow:     number = 0;
  statOut:     number = 0;

  // ── Modal ──
  showModal: boolean       = false;
  isEditing: boolean       = false;
  editingId: number | null = null;

  // Form fields
  fName:     string        = '';
  fCategory: string        = '';
  fUnit:     string        = '';
  fQty:      number | null = null;
  fUsed:     number | null = null;
  fMinQty:   number | null = null;
  fVendorId: number | null = null;   // ← number now, bound to select
  fCostUnit: number | null = null;
  fNotes:    string        = '';

  // Form errors
  errName:     boolean = false;
  errCategory: boolean = false;
  errUnit:     boolean = false;
  errQty:      boolean = false;
  errUsed:     boolean = false;
  errUsedMsg:  string  = 'Valid used quantity required';
  errVendor:   boolean = false;

  // Preview
  previewValue:    string = '—';
  previewPct:      string = '';
  previewBarWidth: number = 0;
  previewBarColor: string = 'var(--border-color)';

  // ── Confirm delete ──
  showConfirm:     boolean       = false;
  confirmMsg:      string        = '';
  pendingDeleteId: number | null = null;

  // ── Toast ──
  toastMsg:     string  = '';
  toastType:    string  = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  private subs: Subscription[] = [];

  readonly CATEGORIES = [
    'Grains', 'Vegetables', 'Meat & Seafood', 'Dairy',
    'Oils & Fats', 'Spices', 'Beverages', 'Packaging',
    'Stationery', 'Cleaning', 'Electronics', 'Office', 'Other'
  ];

  readonly UNITS = [
    'kg', 'grams', 'liters', 'ml', 'pieces',
    'dozen', 'boxes', 'packets', 'Ream', 'Box',
    'Bottle', 'Piece', 'Roll', 'Kg'
  ];

  constructor(private inventoryService: InventoryService) {}

  ngOnInit(): void {
    this.loadInventory();
    this.loadVendors();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearTimeout(this.toastTimer);
  }

  // ════════════════════════════════════════
  // MAP API → flat InventoryItem
  // ════════════════════════════════════════

  private mapToItem(api: InventoryApiItem): InventoryItem {
    return {
      inventoryId:     api.inventoryId,
      name:            api.itemName,
      category:        api.category,
      unit:            api.unit,
      quantity:        api.quantity,
      usedQuantity:    api.usedQuantity,
      minimumQuantity: api.minimumQuantity,
      supplier:        api.vendorName || '',
      vendorId:        api.vendorId,
      costUnit:        api.unitCost,
      notes:           api.note,
    };
  }

  // ════════════════════════════════════════
  // LOAD INVENTORY — GET /inventory/{userId}/all
  // ════════════════════════════════════════

  loadInventory(): void {
    this.isLoading = true;
    this.apiError  = '';

    const sub = this.inventoryService.getAll().subscribe({
      next: apiItems => {
        this.inventory = apiItems.map(i => this.mapToItem(i));
        this.isLoading = false;
        this.applyFilters();
      },
      error: err => {
        this.apiError  = err.error?.message || 'Failed to load inventory.';
        this.isLoading = false;
      }
    });

    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // LOAD VENDORS — GET /vendors/{userId}/names
  // ════════════════════════════════════════

  loadVendors(): void {
    this.isLoadingVendors = true;

    const sub = this.inventoryService.getVendorNames().subscribe({
      next: list => {
        this.vendorList       = list;
        this.isLoadingVendors = false;
      },
      error: () => {
        this.isLoadingVendors = false;
        this.showToast('Could not load vendor list.', 'danger');
      }
    });

    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // CREATE — POST /inventory/{userId}/add
  // ════════════════════════════════════════

  private createItem(): void {
    this.isSaving = true;

    const payload: InventoryAddPayload = {
      itemName:        this.fName.trim(),
      category:        this.fCategory,
      unit:            this.fUnit,
      unitCost:        this.fCostUnit  || 0,
      quantity:        this.fQty!,
      usedQuantity:    this.fUsed!,
      minimumQuantity: this.fMinQty    || 0,
      note:            this.fNotes.trim(),
      vendorId:        this.fVendorId!,
    };

    const sub = this.inventoryService.add(payload).subscribe({
      next: apiItem => {
        this.inventory.push(this.mapToItem(apiItem));
        this.applyFilters();
        this.showToast(`"${apiItem.itemName}" added!`, 'success');
        this.isSaving = false;
        this.closeModal();
      },
      error: err => {
        this.showToast(err.error?.message || 'Failed to add item.', 'danger');
        this.isSaving = false;
      }
    });

    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // UPDATE — PUT /inventory/{userId}/update/{inventoryId}
  // ════════════════════════════════════════

  private updateItem(): void {
    if (!this.editingId) return;
    this.isSaving = true;

    const payload: InventoryUpdatePayload = {
      itemName:        this.fName.trim(),
      category:        this.fCategory,
      unit:            this.fUnit,
      unitCost:        this.fCostUnit  || 0,
      quantity:        this.fQty!,
      usedQuantity:    this.fUsed!,
      minimumQuantity: this.fMinQty    || 0,
      note:            this.fNotes.trim(),
      vendorId:        this.fVendorId!,
    };

    const sub = this.inventoryService.update(this.editingId, payload).subscribe({
      next: apiItem => {
        const idx = this.inventory.findIndex(
          i => i.inventoryId === this.editingId
        );
        if (idx > -1) this.inventory[idx] = this.mapToItem(apiItem);
        this.applyFilters();
        this.showToast(`"${apiItem.itemName}" updated!`, 'success');
        this.isSaving = false;
        this.closeModal();
      },
      error: err => {
        this.showToast(err.error?.message || 'Failed to update item.', 'danger');
        this.isSaving = false;
      }
    });

    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // DELETE — DELETE /inventory/{userId}/delete/{inventoryId}
  // ════════════════════════════════════════

  doDelete(): void {
    if (!this.pendingDeleteId) return;
    this.isDeleting = true;

    const itemName = this.inventory.find(
      i => i.inventoryId === this.pendingDeleteId
    )?.name;

    const sub = this.inventoryService.delete(this.pendingDeleteId).subscribe({
      next: () => {
        this.inventory = this.inventory.filter(
          i => i.inventoryId !== this.pendingDeleteId
        );
        this.applyFilters();
        this.showToast(`"${itemName}" deleted.`, 'danger');
        this.pendingDeleteId = null;
        this.showConfirm     = false;
        this.isDeleting      = false;
      },
      error: err => {
        this.showToast(err.error?.message || 'Failed to delete.', 'danger');
        this.isDeleting  = false;
        this.showConfirm = false;
      }
    });

    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // SAVE — dispatches to create or update
  // ════════════════════════════════════════

  saveItem(): void {
    this.clearErrors();
    let ok = true;

    if (!this.fName.trim())
      { this.errName     = true; ok = false; }
    if (!this.fCategory)
      { this.errCategory = true; ok = false; }
    if (!this.fUnit)
      { this.errUnit     = true; ok = false; }
    if (this.fQty === null || isNaN(this.fQty) || this.fQty < 0)
      { this.errQty      = true; ok = false; }
    if (this.fUsed === null || isNaN(this.fUsed) || this.fUsed < 0)
      { this.errUsed     = true; ok = false; }
    if (!this.fVendorId)
      { this.errVendor   = true; ok = false; }

    if (!this.errUsed && this.fQty !== null && this.fUsed !== null
        && this.fUsed > this.fQty) {
      this.errUsed    = true;
      this.errUsedMsg = 'Used quantity cannot exceed total quantity';
      ok = false;
    }

    if (!ok) return;

    if (this.isEditing) {
      this.updateItem();
    } else {
      this.createItem();
    }
  }

  // ════════════════════════════════════════
  // MODAL
  // ════════════════════════════════════════

  openAddModal(): void {
    this.isEditing = false;
    this.editingId = null;
    this.clearForm();
    this.showModal = true;
    this.updatePreview();
  }

  openEditModal(inventoryId: number): void {
    const item = this.inventory.find(i => i.inventoryId === inventoryId);
    if (!item) return;
    this.isEditing  = true;
    this.editingId  = inventoryId;
    this.fName      = item.name;
    this.fCategory  = item.category;
    this.fUnit      = item.unit;
    this.fQty       = item.quantity;
    this.fUsed      = item.usedQuantity;
    this.fMinQty    = item.minimumQuantity;
    this.fVendorId  = item.vendorId;
    this.fCostUnit  = item.costUnit;
    this.fNotes     = item.notes;
    this.clearErrors();
    this.showModal  = true;
    this.updatePreview();
  }

  closeModal(): void {
    this.showModal = false;
    this.clearForm();
  }

  clearForm(): void {
    this.fName     = ''; this.fCategory = ''; this.fUnit = '';
    this.fQty      = null; this.fUsed = null; this.fMinQty = null;
    this.fVendorId = null;
    this.fCostUnit = null; this.fNotes = '';
    this.clearErrors();
    this.previewValue    = '—';
    this.previewPct      = '';
    this.previewBarWidth = 0;
    this.previewBarColor = 'var(--border-color)';
  }

  clearErrors(): void {
    this.errName     = false; this.errCategory = false;
    this.errUnit     = false; this.errQty      = false;
    this.errUsed     = false; this.errVendor   = false;
    this.errUsedMsg  = 'Valid used quantity required';
  }

  // ════════════════════════════════════════
  // DELETE CONFIRM
  // ════════════════════════════════════════

  confirmDelete(inventoryId: number): void {
    const item = this.inventory.find(i => i.inventoryId === inventoryId);
    if (!item) return;
    this.pendingDeleteId = inventoryId;
    this.confirmMsg      = `Delete "${item.name}"? This cannot be undone.`;
    this.showConfirm     = true;
  }

  cancelDelete(): void {
    this.showConfirm     = false;
    this.pendingDeleteId = null;
  }

  // ════════════════════════════════════════
  // PREVIEW
  // ════════════════════════════════════════

  updatePreview(): void {
    const qty  = this.fQty  ?? 0;
    const used = this.fUsed ?? 0;
    const unit = this.fUnit || '';
    const rem  = Math.max(0, qty - used);
    const pct  = qty > 0 ? Math.min(100, (rem / qty) * 100) : 0;
    const cls  = this.getBarClass(pct);

    this.previewValue    = `${this.fmt(rem)} ${unit}`;
    this.previewPct      = qty > 0 ? `${Math.round(pct)}% remaining` : '';
    this.previewBarWidth = qty > 0 ? Math.max(pct, 2) : 2;
    this.previewBarColor = this.getBarBg(cls);
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  getRemaining(item: InventoryItem): number {
    return Math.max(0, item.quantity - item.usedQuantity);
  }

  getStatus(item: InventoryItem): string {
    const rem = this.getRemaining(item);
    if (rem <= 0) return 'out-of-stock';
    const pct = item.quantity > 0 ? (rem / item.quantity) * 100 : 0;
    if (pct < 30) return 'low-stock';
    return 'in-stock';
  }

  getStatusLabel(s: string): string {
    const map: any = {
      'in-stock':     'In Stock',
      'low-stock':    'Low Stock',
      'out-of-stock': 'Out of Stock'
    };
    return map[s] || s;
  }

  getStatusClass(s: string): string {
    const map: any = {
      'in-stock':     'status-in-stock',
      'low-stock':    'status-low-stock',
      'out-of-stock': 'status-out-of-stock'
    };
    return map[s] || '';
  }

  getRemPct(item: InventoryItem): number {
    if (item.quantity <= 0) return 0;
    return Math.min(100, (this.getRemaining(item) / item.quantity) * 100);
  }

  getBarClass(pct: number): string {
    if (pct <= 0)  return 'empty';
    if (pct < 30)  return 'low';
    if (pct < 55)  return 'medium';
    return 'good';
  }

  getBarColor(cls: string): string {
    const map: any = {
      good:   'var(--success)',
      medium: '#E65100',
      low:    'var(--danger)',
      empty:  '#E65100'
    };
    return map[cls] || 'var(--text-tertiary)';
  }

  getBarBg(cls: string): string {
    const map: any = {
      good:   'var(--success)',
      medium: 'var(--warning)',
      low:    'var(--danger)',
      empty:  'var(--danger)'
    };
    return map[cls] || 'var(--border-color)';
  }

  getQtyClass(item: InventoryItem): string {
    const s = this.getStatus(item);
    if (s === 'in-stock')  return 'ok';
    if (s === 'low-stock') return 'low';
    return 'out';
  }

  fmt(n: number): string {
    return parseFloat(String(n)).toLocaleString('en-IN', {
      maximumFractionDigits: 2
    });
  }

  updateStats(): void {
    this.statInStock = this.inventory.filter(
      i => this.getStatus(i) === 'in-stock').length;
    this.statLow     = this.inventory.filter(
      i => this.getStatus(i) === 'low-stock').length;
    this.statOut     = this.inventory.filter(
      i => this.getStatus(i) === 'out-of-stock').length;
  }

  applyFilters(): void {
    const search = this.searchText.toLowerCase().trim();
    this.filtered = this.inventory.filter(item => {
      if (search && !`${item.name} ${item.supplier}`.toLowerCase().includes(search))
        return false;
      if (this.statusFilter && this.statusFilter !== 'all' &&
          this.getStatus(item) !== this.statusFilter)
        return false;
      if (this.categoryFilter && item.category !== this.categoryFilter)
        return false;
      return true;
    });
    this.page = 1;
    this.sortData();
    this.updateStats();
  }

  sortData(): void {
    this.filtered.sort((a: any, b: any) => {
      let av = this.sortCol === 'status' ? this.getStatus(a) : a[this.sortCol];
      let bv = this.sortCol === 'status' ? this.getStatus(b) : b[this.sortCol];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return this.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return this.sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }

  setSort(col: string): void {
    if (col === this.sortCol) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = 'asc';
    }
    this.sortData();
  }

  getSortIcon(col: string): string {
    if (this.sortCol !== col) return '⇅';
    return this.sortDir === 'asc' ? '▲' : '▼';
  }

  isSortActive(col: string): boolean { return this.sortCol === col; }

  clearFilters(): void {
    this.searchText     = '';
    this.statusFilter   = 'all';
    this.categoryFilter = '';
    this.applyFilters();
  }

  get pagedItems(): InventoryItem[] {
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
    if (p < 1 || p > this.totalPages) return;
    this.page = p;
  }

  onPgSizeChange(event: Event): void {
    this.pgSize = parseInt((event.target as HTMLSelectElement).value);
    this.page   = 1;
  }

  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 2800);
  }
}