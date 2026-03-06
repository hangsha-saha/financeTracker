import { Component, OnInit, OnDestroy } from '@angular/core';
import { VendorsService } from '../services/vendors.service';
// ─────────────────────────────────────────────────────────────────
// API-READY SETUP
// When you connect a real backend, import these and inject
// HttpClient in the constructor, then replace every method
// that currently uses local array operations with HTTP calls.
//
// import { HttpClient, HttpErrorResponse } from '@angular/common/http';
// import { Observable, throwError } from 'rxjs';
// import { catchError, finalize } from 'rxjs/operators';
//
// private readonly API_BASE = 'https://your-api.com/api/v1';
// ─────────────────────────────────────────────────────────────────

export interface Vendor {
  id: number;
  name: string;
  contact: string;
  email: string;
  city: string;
  category: string;
  pending: number;
  notes: string;
}

// ── API request/response shapes (ready for backend) ──
export interface VendorCreatePayload {
  name: string;
  contact: string;
  email: string;
  city: string;
  category: string;
  pending: number;
  notes: string;
}

export interface VendorUpdatePayload extends Partial<VendorCreatePayload> {}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Component({
  selector: 'app-vendors',
  templateUrl: './vendors.component.html',
  styleUrls: ['./vendors.component.css']
})
export class VendorsComponent implements OnInit, OnDestroy {

  constructor(private vendorService: VendorsService) {}

  readonly Math = Math;
  // ── Data ──
  vendors: Vendor[] = [];
  filtered: Vendor[] = [];
  private nextId    = 6; // remove when API is connected

  // ── Loading / error state (used by API later) ──
  isLoading: boolean = false;
  apiError: string   = '';

  // ── Constants ──
  readonly KNOWN_CATEGORIES = [
    'Raw Materials', 'Vegetables & Fruits', 'Meat & Fish',
    'Dairy Products', 'Spices', 'Packaging', 'Beverages'
  ];

  // ── Filters ──
  searchText: string   = '';
  statusFilter: string = 'all';

  // ── Modal state ──
  showAddModal: boolean  = false;
  showEditModal: boolean = false;

  // ── Add form fields ──
  aName: string     = '';
  aContact: string  = '';
  aEmail: string    = '';
  aCity: string     = '';
  aCategory: string = '';
  aOtherCat: string = '';
  aPending: number | null = null;
  aNotes: string    = '';

  // Add form errors
  errAName: boolean     = false;
  errAContact: boolean  = false;
  errAEmail: boolean    = false;
  errACity: boolean     = false;
  errACategory: boolean = false;
  errAOtherCat: boolean = false;

  // ── Edit form fields ──
  eId: number       = 0;
  eName: string     = '';
  eContact: string  = '';
  eEmail: string    = '';
  eCity: string     = '';
  eCategory: string = '';
  eOtherCat: string = '';
  ePending: number | null = null;
  eNotes: string    = '';

  // Edit form errors
  errEName: boolean     = false;
  errEContact: boolean  = false;
  errEEmail: boolean    = false;
  errECity: boolean     = false;
  errECategory: boolean = false;
  errEOtherCat: boolean = false;

  // ── Confirm delete ──
  showConfirm: boolean  = false;
  confirmMsg: string    = '';

  // ── Toast ──
  toastMsg: string      = '';
  toastType: string     = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  // ── Mark paid confirm ──
  showMarkPaidConfirm: boolean = false;
  markPaidVendorId: number | null = null;
  markPaidVendorName: string      = '';

  ngOnInit(): void {
    this.loadVendors();
  }

  ngOnDestroy(): void {
    clearTimeout(this.toastTimer);
  }

  // ════════════════════════════════════════════════════════════════
  // DATA LAYER — replace each method body with an HTTP call
  // when your API is ready. The method signatures stay the same.
  // ════════════════════════════════════════════════════════════════

  loadVendors(): void {
    this.isLoading = true;
    this.vendorService.getAll().subscribe({
      next: (data: Vendor[]) => {
        this.vendors = data;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err: any) => {
        this.showToast('Could not load vendors from server', 'danger');
        this.isLoading = false;
      }
    });
  }

  createVendor(payload: VendorCreatePayload): void {
    this.isLoading = true;
    this.vendorService.add(payload).subscribe({
      next: (newVendor: Vendor) => {
        this.vendors.push(newVendor);
        this.applyFilters();
        this.showToast(`"${newVendor.name}" added successfully!`, 'success');
        this.isLoading = false;
      },
      error: (err: any) => {
        this.showToast('Error saving new vendor', 'danger');
        this.isLoading = false;
      }
    });
  }

  updateVendor(id: number, payload: VendorUpdatePayload): void {
    this.isLoading = true;
    this.vendorService.update(id, payload).subscribe({
      next: (updatedVendor: Vendor) => {
        const idx = this.vendors.findIndex(v => v.id === id);
        if (idx > -1) this.vendors[idx] = updatedVendor;
        this.applyFilters();
        this.showToast(`"${updatedVendor.name}" updated!`, 'success');
        this.isLoading = false;
      },
      error: (err: any) => {
        this.showToast('Update failed', 'danger');
        this.isLoading = false;
      }
    });
  }

  deleteVendorById(id: number): void {
    this.isLoading = true;
    this.vendorService.delete(id).subscribe({
      next: () => {
        this.vendors = this.vendors.filter(v => v.id !== id);
        this.applyFilters();
        this.showToast(`Vendor removed successfully.`, 'danger');
        this.isLoading = false;
      },
      error: (err: any) => {
        this.showToast('Delete operation failed', 'danger');
        this.isLoading = false;
      }
    });
  }

  markVendorPaid(id: number): void {
    const idx = this.vendors.findIndex(v => v.id === id);
    if (idx > -1) {
      const name = this.vendors[idx].name;
      this.vendors[idx].pending = 0;
      this.applyFilters();
      this.showToast(`"${name}" marked as paid! ✓`, 'success');
    }
  }

  // ════════════════════════════════════════════════════════════════
  // FILTERS
  // ════════════════════════════════════════════════════════════════

  applyFilters(): void {
    this.page = 1;
    const s = this.searchText.toLowerCase().trim();
    this.filtered = this.vendors.filter(v => {
      const matchSearch = !s || v.name.toLowerCase().includes(s) || v.contact.toLowerCase().includes(s);
      const matchStatus =
        this.statusFilter === 'all' ||
        (this.statusFilter === 'pending' && v.pending > 0) ||
        (this.statusFilter === 'cleared' && v.pending === 0);
      return matchSearch && matchStatus;
    });
  }

    // ── Pagination ──
  page: number         = 1;
  readonly PAGE_SIZE   = 8;

  // ════════════════════════════════════════════════════════════════
  // PAGINATION
  // ════════════════════════════════════════════════════════════════

  get pagedItems(): Vendor[] {
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
  goToPage(p: number): void { if (p >= 1 && p <= this.totalPages) this.page = p; }

  // ════════════════════════════════════════════════════════════════
  // ADD MODAL
  // ════════════════════════════════════════════════════════════════

  openAddModal(): void {
    this.clearAddForm();
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.clearAddForm();
  }

  clearAddForm(): void {
    this.aName = ''; this.aContact = ''; this.aEmail = '';
    this.aCity = ''; this.aCategory = ''; this.aOtherCat = '';
    this.aPending = null; this.aNotes = '';
    this.errAName = false; this.errAContact = false; this.errAEmail = false;
    this.errACity = false; this.errACategory = false; this.errAOtherCat = false;
  }

  get addNeedsOtherCat(): boolean { return this.aCategory === 'Other'; }

  onAddCategoryChange(): void {
    if (!this.addNeedsOtherCat) { this.aOtherCat = ''; this.errAOtherCat = false; }
  }

  saveAdd(): void {
    this.errAName     = !this.aName.trim();
    this.errAContact  = !this.aContact.trim();
    this.errAEmail    = !this.aEmail.trim() || !this.validEmail(this.aEmail);
    this.errACity     = !this.aCity.trim();
    this.errACategory = !this.aCategory;
    this.errAOtherCat = this.addNeedsOtherCat && !this.aOtherCat.trim();

    if (this.errAName || this.errAContact || this.errAEmail ||
        this.errACity || this.errACategory || this.errAOtherCat) return;

    const payload: VendorCreatePayload = {
      name:    this.aName.trim(),
      contact: this.aContact.trim(),
      email:   this.aEmail.trim(),
      city:    this.aCity.trim(),
      category: this.addNeedsOtherCat ? (this.aOtherCat.trim() || 'Other') : this.aCategory,
      pending: this.aPending ?? 0,
      notes:   this.aNotes.trim(),
    };

    this.createVendor(payload);
    this.closeAddModal();
  }

  // ════════════════════════════════════════════════════════════════
  // EDIT MODAL
  // ════════════════════════════════════════════════════════════════

  openEditModal(id: number): void {
    const v = this.vendors.find(v => v.id === id);
    if (!v) return;
    this.eId       = v.id;
    this.eName     = v.name;
    this.eContact  = v.contact;
    this.eEmail    = v.email;
    this.eCity     = v.city;
    this.ePending  = v.pending;
    this.eNotes    = v.notes;

    // Handle known vs custom category
    if (this.KNOWN_CATEGORIES.includes(v.category)) {
      this.eCategory = v.category;
      this.eOtherCat = '';
    } else {
      this.eCategory = 'Other';
      this.eOtherCat = v.category;
    }

    this.clearEditErrors();
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.clearEditErrors();
  }

  clearEditErrors(): void {
    this.errEName = false; this.errEContact = false; this.errEEmail = false;
    this.errECity = false; this.errECategory = false; this.errEOtherCat = false;
  }

  get editNeedsOtherCat(): boolean { return this.eCategory === 'Other'; }

  onEditCategoryChange(): void {
    if (!this.editNeedsOtherCat) { this.eOtherCat = ''; this.errEOtherCat = false; }
  }

  saveEdit(): void {
    this.errEName     = !this.eName.trim();
    this.errEContact  = !this.eContact.trim();
    this.errEEmail    = !this.eEmail.trim() || !this.validEmail(this.eEmail);
    this.errECity     = !this.eCity.trim();
    this.errECategory = !this.eCategory;
    this.errEOtherCat = this.editNeedsOtherCat && !this.eOtherCat.trim();

    if (this.errEName || this.errEContact || this.errEEmail ||
        this.errECity || this.errECategory || this.errEOtherCat) return;

    const payload: VendorUpdatePayload = {
      name:    this.eName.trim(),
      contact:  this.eContact.trim(),
      email:    this.eEmail.trim(),
      city:     this.eCity.trim(),
      category: this.editNeedsOtherCat ? (this.eOtherCat.trim() || 'Other') : this.eCategory,
      pending:  this.ePending ?? 0,
      notes:    this.eNotes.trim(),
    };

    this.updateVendor(this.eId, payload);
    this.closeEditModal();
  }

  // ════════════════════════════════════════════════════════════════
  // DELETE
  // ════════════════════════════════════════════════════════════════

  openDeleteConfirm(): void {
    const v = this.vendors.find(v => v.id === this.eId);
    if (!v) return;
    this.confirmMsg  = `Delete "${v.name}"? This cannot be undone.`;
    this.showConfirm = true;
  }

  cancelDelete(): void {
    this.showConfirm = false;
  }

  doDelete(): void {
    this.showConfirm   = false;
    this.showEditModal = false;
    this.deleteVendorById(this.eId);
  }

  // ════════════════════════════════════════════════════════════════
  // MARK PAID
  // ════════════════════════════════════════════════════════════════

  openMarkPaidConfirm(id: number): void {
    const v = this.vendors.find(v => v.id === id);
    if (!v) return;
    this.markPaidVendorId   = id;
    this.markPaidVendorName = v.name;
    this.showMarkPaidConfirm = true;
  }

  cancelMarkPaid(): void {
    this.showMarkPaidConfirm = false;
    this.markPaidVendorId    = null;
    this.markPaidVendorName  = '';
  }

  doMarkPaid(): void {
    if (this.markPaidVendorId !== null) {
      this.markVendorPaid(this.markPaidVendorId);
    }
    this.showMarkPaidConfirm = false;
    this.markPaidVendorId    = null;
    this.markPaidVendorName  = '';
  }

  // ════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════

  validEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  getCategoryDisplayName(cat: string): string {
    return cat || '—';
  }

  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 2800);
  }
}