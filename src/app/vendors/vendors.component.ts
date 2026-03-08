import { Component, OnInit, OnDestroy } from '@angular/core';
import { VendorsService } from '../services/vendors.service';

// Updated interfaces to match the FinanceTracker API & JSON structure
export interface Vendor {
  vendorId: number;
  name: string;
  phoneNumber: number;
  email: string;
  address: string;
  category: string;
  amountPending: number;
  note: string;
  dueDate: string;
  createdAt?: string;
  userId?: number;
}

export interface VendorCreatePayload {
  name: string;
  phoneNumber: number;
  email: string;
  address: string;
  category: string;
  amountPending: number;
  note: string;
  dueDate: string;
}

export interface VendorUpdatePayload extends VendorCreatePayload {}

@Component({
  selector: 'app-vendors',
  templateUrl: './vendors.component.html',
  styleUrls: ['./vendors.component.css']
})
export class VendorsComponent implements OnInit, OnDestroy {

  constructor(private vendorService: VendorsService) {}

  vendors: Vendor[] = [];
  filtered: Vendor[] = [];
  isLoading: boolean = false;

  readonly KNOWN_CATEGORIES = [
    'Raw Materials', 'Vegetables & Fruits', 'Meat & Fish',
    'Dairy Products', 'Spices', 'Packaging', 'Beverages'
  ];

  // UI States
  searchText: string = '';
  statusFilter: string = 'all';
  showAddModal: boolean = false;
  showEditModal: boolean = false;
  showConfirm: boolean = false;
  showMarkPaidConfirm: boolean = false;

  // Add Form Fields
  aName: string = ''; aContact: string = ''; aEmail: string = '';
  aCity: string = ''; aCategory: string = ''; aPending: number | null = null;
  aNotes: string = ''; aDueDate: string = '';

  // Edit Form Fields
  eId: number = 0; eName: string = ''; eContact: string = '';
  eEmail: string = ''; eCity: string = ''; eCategory: string = '';
  ePending: number | null = null; eNotes: string = ''; eDueDate: string = '';

  // Misc
  confirmMsg: string = ''; toastMsg: string = ''; toastType: string = '';
  toastVisible: boolean = false; private toastTimer: any;
  markPaidVendorId: number | null = null;
  markPaidVendorName: string = '';
  page: number = 1;
  readonly PAGE_SIZE = 8;

  ngOnInit(): void { this.loadVendors(); }
  ngOnDestroy(): void { clearTimeout(this.toastTimer); }

  // ════════ DATA LAYER ════════
  loadVendors(): void {
    this.isLoading = true;
    this.vendorService.getAll().subscribe({
      next: (data: Vendor[]) => {
        this.vendors = data;
        this.applyFilters();
        this.isLoading = false;
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
        this.vendors = this.vendors.filter(v => v.vendorId !== vendorId);
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

  // ════════ UI LOGIC ════════
  applyFilters(): void {
    this.page = 1;
    const s = this.searchText.toLowerCase().trim();
    this.filtered = this.vendors.filter(v => {
      const matchSearch = !s || v.name.toLowerCase().includes(s) || v.phoneNumber.toString().includes(s);
      const matchStatus = this.statusFilter === 'all' || 
                         (this.statusFilter === 'pending' && v.amountPending > 0) || 
                         (this.statusFilter === 'cleared' && v.amountPending === 0);
      return matchSearch && matchStatus;
    });
  }

  get pagedItems(): Vendor[] {
    const start = (this.page - 1) * this.PAGE_SIZE;
    return this.filtered.slice(start, start + this.PAGE_SIZE);
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.filtered.length / this.PAGE_SIZE)); }

  saveAdd(): void {
    const payload: VendorCreatePayload = {
      name: this.aName, phoneNumber: Number(this.aContact), email: this.aEmail,
      address: this.aCity, category: this.aCategory, amountPending: this.aPending ?? 0,
      note: this.aNotes, dueDate: this.aDueDate || new Date().toISOString().split('T')[0]
    };
    this.createVendor(payload);
    this.closeAddModal();
  }

  openEditModal(vendorId: number): void {
    const v = this.vendors.find(v => v.vendorId === vendorId);
    if (!v) return;
    this.eId = v.vendorId; this.eName = v.name; this.eContact = v.phoneNumber.toString();
    this.eEmail = v.email; this.eCity = v.address; this.eCategory = v.category;
    this.ePending = v.amountPending; this.eNotes = v.note; this.eDueDate = v.dueDate;
    this.showEditModal = true;
  }

  saveEdit(): void {
    const payload: VendorUpdatePayload = {
      name: this.eName, phoneNumber: Number(this.eContact), email: this.eEmail,
      address: this.eCity, category: this.eCategory, amountPending: this.ePending ?? 0,
      note: this.eNotes, dueDate: this.eDueDate
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

  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg = msg; this.toastType = type; this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 2800);
  }

  closeAddModal(): void { this.showAddModal = false; }
  closeEditModal(): void { this.showEditModal = false; }
  doDelete(): void { this.deleteVendorById(this.eId); this.showConfirm = false; this.showEditModal = false; }
}