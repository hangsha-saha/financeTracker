import { Component, OnInit, OnDestroy } from '@angular/core';
import { VendorsService } from '../services/vendors.service';

export interface Vendor {
  vendorId:      number;
  name:          string;
  phoneNumber:   number;
  email:         string;
  address:       string;
  category:      string;
  amountPending: number;
  note:          string;
  dueDate:       string;
  createdAt?:    string;
  userId?:       number;
}

export interface VendorCreatePayload {
  name:          string;
  phoneNumber:   number;
  email:         string;
  address:       string;
  category:      string;
  amountPending: number;
  note:          string;
  dueDate:       string;
}

export interface VendorUpdatePayload extends VendorCreatePayload {}

@Component({
  selector:    'app-vendors',
  templateUrl: './vendors.component.html',
  styleUrls:   ['./vendors.component.css']
})
export class VendorsComponent implements OnInit, OnDestroy {

  constructor(private vendorService: VendorsService) {}

  vendors:  Vendor[] = [];
  filtered: Vendor[] = [];
  isLoading: boolean = false;

  readonly KNOWN_CATEGORIES = [
    'Raw Materials', 'Vegetables & Fruits', 'Meat & Fish',
    'Dairy Products', 'Spices', 'Packaging', 'Beverages'
  ];

  // ── UI States ──
  searchText:          string  = '';
  statusFilter:        string  = 'all';
  showAddModal:        boolean = false;
  showEditModal:       boolean = false;
  showConfirm:         boolean = false;
  showMarkPaidConfirm: boolean = false;

  // ── Add Form Fields ──
  aName:    string         = '';
  aContact: string         = '';
  aEmail:   string         = '';
  aCity:    string         = '';
  aCategory: string        = '';
  aPending: number | null  = null;
  aNotes:   string         = '';
  aDueDate: string         = '';

  // ── Add Form Errors ──
  aErr: {
    name:    string;
    contact: string;
    email:   string;
    city:    string;
    dueDate: string;
  } = { name: '', contact: '', email: '', city: '', dueDate: '' };

  // ── Edit Form Fields ──
  eId:      number         = 0;
  eName:    string         = '';
  eContact: string         = '';
  eEmail:   string         = '';
  eCity:    string         = '';
  eCategory: string        = '';
  ePending: number | null  = null;
  eNotes:   string         = '';
  eDueDate: string         = '';

  // ── Edit Form Errors ──
  eErr: {
    name:    string;
    contact: string;
    email:   string;
    city:    string;
    dueDate: string;
  } = { name: '', contact: '', email: '', city: '', dueDate: '' };

  // ── Misc ──
  confirmMsg:          string  = '';
  toastMsg:            string  = '';
  toastType:           string  = '';
  toastVisible:        boolean = false;
  private toastTimer:  any;
  markPaidVendorId:    number | null = null;
  markPaidVendorName:  string  = '';
  page:                number  = 1;
  readonly PAGE_SIZE           = 8;

  ngOnInit():  void { this.loadVendors(); }
  ngOnDestroy(): void { clearTimeout(this.toastTimer); }

  // ════════════════════════════════════════
  // VALIDATION HELPERS
  // ════════════════════════════════════════

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  private isValidPhone(phone: string): boolean {
    // Accepts 10-digit Indian numbers, optionally prefixed with +91 or 0
    const digits = phone.replace(/[\s\-\(\)]/g, '');
    return /^(\+91|0)?[6-9]\d{9}$/.test(digits);
  }

  private validateAddForm(): boolean {
    this.aErr = { name: '', contact: '', email: '', city: '', dueDate: '' };
    let valid = true;

    if (!this.aName.trim()) {
      this.aErr.name = 'Vendor name is required.';
      valid = false;
    }
    if (!this.aContact.trim()) {
      this.aErr.contact = 'Contact number is required.';
      valid = false;
    } else if (!this.isValidPhone(this.aContact)) {
      this.aErr.contact = 'Enter a valid 10-digit mobile number.';
      valid = false;
    }
    if (!this.aEmail.trim()) {
      this.aErr.email = 'Email is required.';
      valid = false;
    } else if (!this.isValidEmail(this.aEmail)) {
      this.aErr.email = 'Enter a valid email address.';
      valid = false;
    }
    if (!this.aCity.trim()) {
      this.aErr.city = 'Address / City is required.';
      valid = false;
    }
    if (!this.aDueDate) {
      this.aErr.dueDate = 'Due date is required.';
      valid = false;
    }

    return valid;
  }

  private validateEditForm(): boolean {
    this.eErr = { name: '', contact: '', email: '', city: '', dueDate: '' };
    let valid = true;

    if (!this.eName.trim()) {
      this.eErr.name = 'Vendor name is required.';
      valid = false;
    }
    if (!this.eContact.toString().trim()) {
      this.eErr.contact = 'Contact number is required.';
      valid = false;
    } else if (!this.isValidPhone(this.eContact.toString())) {
      this.eErr.contact = 'Enter a valid 10-digit mobile number.';
      valid = false;
    }
    if (!this.eEmail.trim()) {
      this.eErr.email = 'Email is required.';
      valid = false;
    } else if (!this.isValidEmail(this.eEmail)) {
      this.eErr.email = 'Enter a valid email address.';
      valid = false;
    }
    if (!this.eCity.trim()) {
      this.eErr.city = 'Address / City is required.';
      valid = false;
    }
    if (!this.eDueDate) {
      this.eErr.dueDate = 'Due date is required.';
      valid = false;
    }

    return valid;
  }

  // ── Clear errors on input ──
  clearAddErr(field: keyof typeof this.aErr): void { this.aErr[field] = ''; }
  clearEditErr(field: keyof typeof this.eErr): void { this.eErr[field] = ''; }

  // ════════════════════════════════════════
  // DATA LAYER
  // ════════════════════════════════════════

  loadVendors(): void {
    this.isLoading = true;
    this.vendorService.getAll().subscribe({
      next: (data: Vendor[]) => {
        this.vendors   = data;
        this.isLoading = false;
        this.applyFilters();
      },
      error: () => {
        this.showToast('Could not load vendors', 'danger');
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
        this.showToast('Vendor added successfully!', 'success');
        this.isLoading = false;
      },
      error: () => {
        this.showToast('Error saving vendor', 'danger');
        this.isLoading = false;
      }
    });
  }

  updateVendor(vendorId: number, payload: VendorUpdatePayload): void {
    this.isLoading = true;
    this.vendorService.update(vendorId, payload).subscribe({
      next: (updatedVendor: Vendor) => {
        const idx = this.vendors.findIndex(v => v.vendorId === vendorId);
        if (idx > -1) this.vendors[idx] = updatedVendor;
        this.applyFilters();
        this.showToast('Updated successfully!', 'success');
        this.isLoading = false;
      },
      error: () => {
        this.showToast('Update failed', 'danger');
        this.isLoading = false;
      }
    });
  }

  deleteVendorById(vendorId: number): void {
    this.isLoading = true;
    this.vendorService.delete(vendorId).subscribe({
      next: () => {
        this.vendors   = this.vendors.filter(v => v.vendorId !== vendorId);
        this.applyFilters();
        this.showToast('Vendor deleted!', 'danger');
        this.isLoading = false;
      },
      error: () => {
        this.showToast('Delete failed', 'danger');
        this.isLoading = false;
      }
    });
  }

  // ════════════════════════════════════════
  // UI LOGIC
  // ════════════════════════════════════════

  applyFilters(): void {
    this.page = 1;
    const s = this.searchText.toLowerCase().trim();
    this.filtered = this.vendors.filter(v => {
      const matchSearch = !s
        || v.name.toLowerCase().includes(s)
        || v.phoneNumber.toString().includes(s);
      const matchStatus = this.statusFilter === 'all'
        || (this.statusFilter === 'pending'  && v.amountPending > 0)
        || (this.statusFilter === 'cleared'  && v.amountPending === 0);
      return matchSearch && matchStatus;
    });
  }

  get pagedItems(): Vendor[] {
    const start = (this.page - 1) * this.PAGE_SIZE;
    return this.filtered.slice(start, start + this.PAGE_SIZE);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.PAGE_SIZE));
  }

  // ── Save Add ──
  saveAdd(): void {
    if (!this.validateAddForm()) return;

    const payload: VendorCreatePayload = {
      name:          this.aName.trim(),
      phoneNumber:   Number(this.aContact.replace(/[\s\-\(\)]/g, '')),
      email:         this.aEmail.trim(),
      address:       this.aCity.trim(),
      category:      this.aCategory,
      amountPending: this.aPending ?? 0,
      note:          this.aNotes.trim(),
      dueDate:       this.aDueDate || new Date().toISOString().split('T')[0]
    };

    this.createVendor(payload);
    this.closeAddModal();
  }

  // ── Open / Save Edit ──
  openEditModal(vendorId: number): void {
    const v = this.vendors.find(v => v.vendorId === vendorId);
    if (!v) return;

    this.eId       = v.vendorId;
    this.eName     = v.name;
    this.eContact  = v.phoneNumber.toString();
    this.eEmail    = v.email;
    this.eCity     = v.address;
    this.eCategory = v.category;
    this.ePending  = v.amountPending;
    this.eNotes    = v.note;
    this.eDueDate  = v.dueDate;
    this.eErr      = { name: '', contact: '', email: '', city: '', dueDate: '' };

    this.showEditModal = true;
  }

  saveEdit(): void {
    if (!this.validateEditForm()) return;

    const payload: VendorUpdatePayload = {
      name:          this.eName.trim(),
      phoneNumber:   Number(this.eContact.toString().replace(/[\s\-\(\)]/g, '')),
      email:         this.eEmail.trim(),
      address:       this.eCity.trim(),
      category:      this.eCategory,
      amountPending: this.ePending ?? 0,
      note:          this.eNotes.trim(),
      dueDate:       this.eDueDate
    };

    this.updateVendor(this.eId, payload);
    this.closeEditModal();
  }

  doMarkPaid(): void {
    if (this.markPaidVendorId) {
      const v = this.vendors.find(v => v.vendorId === this.markPaidVendorId);
      if (v) {
        const payload: VendorUpdatePayload = { ...v, amountPending: 0 };
        this.updateVendor(this.markPaidVendorId, payload);
      }
    }
    this.showMarkPaidConfirm = false;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.aErr = { name: '', contact: '', email: '', city: '', dueDate: '' };
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.eErr = { name: '', contact: '', email: '', city: '', dueDate: '' };
  }

  doDelete(): void {
    this.deleteVendorById(this.eId);
    this.showConfirm   = false;
    this.showEditModal = false;
  }

  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 2800);
  }
}