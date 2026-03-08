import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MenuService } from '../services/menu.service';
import { AuthService } from '../services/auth.service';

interface MenuItem {
  id: number;
  name: string;
  type: string;
  price: number;
  available: string;
  description: string;
}

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {

  menuData: MenuItem[] = [];
  filtered: MenuItem[] = [];
  pagedItems: MenuItem[] = [];

  selectedIds: number[] = [];
  editId: number | null = null;

  sortField = '';
  sortDir: 'asc' | 'desc' = 'asc';

  showConfirm = false;
  confirmMsg = '';

  private adminId: number = 0;

  constructor(
    private menuService: MenuService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.adminId = this.authService.getCurrentUserId();
    this.loadMenu();
  }

  // ================= API =================

  loadMenu() {
    this.menuService.getMenu().subscribe((data: any[]) => {
      this.menuData = data.map(item => ({
        id:          item.itemId,
        name:        item.itemName,
        type:        item.category,
        price:       item.price,
        available:   item.status === 'AVAILABLE' ? 'yes' : 'no',
        description: ''
      }));
      this.filtered    = [...this.menuData];
      this.selectedIds = [];
      this.updatePagination();
    });
  }

  // ================= Filters =================

  fType      = '';
  fAvailable = '';
  fMinPrice: number | null = null;
  fMaxPrice: number | null = null;
  fSearch    = '';

  applyFilters() {
    this.filtered = this.menuData.filter(item => {
      const typeMatch   = !this.fType      || item.type      === this.fType;
      const availMatch  = !this.fAvailable || item.available === this.fAvailable;
      const minMatch    = this.fMinPrice == null || item.price >= this.fMinPrice;
      const maxMatch    = this.fMaxPrice == null || item.price <= this.fMaxPrice;
      const searchMatch = !this.fSearch    ||
        item.name.toLowerCase().includes(this.fSearch.toLowerCase());
      return typeMatch && availMatch && minMatch && maxMatch && searchMatch;
    });
    this.page        = 1;
    this.selectedIds = [];
    this.updatePagination();
  }

  clearFilters() {
    this.fType      = '';
    this.fAvailable = '';
    this.fMinPrice  = null;
    this.fMaxPrice  = null;
    this.fSearch    = '';
    this.filtered    = [...this.menuData];
    this.selectedIds = [];
    this.updatePagination();
  }

  // ================= Pagination =================

  page      = 1;
  pageSize  = 10;
  totalPages  = 1;
  pageNumbers: number[] = [];

  updatePagination() {
    this.totalPages = Math.ceil(this.filtered.length / this.pageSize);
    const start = (this.page - 1) * this.pageSize;
    const end   = start + this.pageSize;
    this.pagedItems  = this.filtered.slice(start, end);
    this.pageNumbers = Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(p: number) {
    this.page = p;
    this.updatePagination();
  }

  onPgSizeChange(event: any) {
    this.pageSize = Number(event.target.value);
    this.page     = 1;
    this.updatePagination();
  }

  // ================= Selection =================

  isSelected(id: number) { return this.selectedIds.includes(id); }

  toggleRow(id: number, checked: boolean) {
    if (checked) {
      if (!this.selectedIds.includes(id)) this.selectedIds.push(id);
    } else {
      this.selectedIds = this.selectedIds.filter(x => x !== id);
    }
  }

  toggleSelectAll(checked: boolean) {
    this.selectedIds = checked ? this.filtered.map(x => x.id) : [];
  }

  clearAllSelections() { this.selectedIds = []; }

  get selectedCount()          { return this.selectedIds.length; }
  get showBulkToolbar()        { return this.selectedIds.length > 0; }
  get canBulkEdit()            { return this.selectedIds.length === 1; }
  get selectAllChecked()       { return this.selectedIds.length === this.filtered.length && this.filtered.length > 0; }
  get selectAllIndeterminate() { return this.selectedIds.length > 0 && this.selectedIds.length < this.filtered.length; }

  // ================= Sorting =================

  setSort(field: string) {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir   = 'asc';
    }
    this.filtered.sort((a: any, b: any) => {
      if (a[field] < b[field]) return this.sortDir === 'asc' ? -1 : 1;
      if (a[field] > b[field]) return this.sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    this.updatePagination();
  }

  isSortActive(field: string) { return this.sortField === field; }
  getSortIcon(field: string) {
    if (this.sortField !== field) return '↕';
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  // ================= Edit =================

  bulkEdit() {
    const id   = this.selectedIds[0];
    const item = this.menuData.find(x => x.id === id);
    if (!item) return;
    this.editId      = id;
    this.isEditing   = true;
    this.showModal   = true;
    this.fName       = item.name;
    this.fTypeModal  = item.type;
    this.fPrice      = item.price;
    this.fAvailModal = item.available;
  }

  // ================= Delete =================

  bulkDelete() {
    this.confirmMsg  = `Delete ${this.selectedIds.length} item(s)?`;
    this.showConfirm = true;
  }

  doConfirm() {
    const ids = [...this.selectedIds];
    this.showConfirm = false;

    // ✅ Wait for ALL delete requests to complete, then reload once
    const deleteRequests = ids.map(id => this.menuService.deleteMenu(id));
    forkJoin(deleteRequests).subscribe({
      next: () => {
        this.showToast('danger', `${ids.length} item(s) deleted`);
        this.loadMenu();
      },
      error: () => {
        this.showToast('danger', 'Some items could not be deleted');
        this.loadMenu(); // reload anyway to sync with backend
      }
    });
  }

  cancelConfirm() { this.showConfirm = false; }

  // ================= Modal =================

  showModal  = false;
  isEditing  = false;

  openAddModal() {
    this.showModal   = true;
    this.isEditing   = false;
    this.fName       = '';
    this.fTypeModal  = '';
    this.fPrice      = null;
    this.fAvailModal = 'yes';
    this.fDesc       = '';
  }

  closeModal() { this.showModal = false; }

  // ================= Form =================

  fName       = '';
  fTypeModal  = '';
  fPrice: number | null = null;
  fAvailModal = 'yes';
  fDesc       = '';

  errName  = false;
  errType  = false;
  errPrice = false;

  saveItem() {
    this.errName  = !this.fName;
    this.errType  = !this.fTypeModal;
    this.errPrice = !this.fPrice;
    if (this.errName || this.errType || this.errPrice) return;

    const payload = {
      itemName: this.fName,
      category: this.fTypeModal,
      price:    this.fPrice,
      status:   this.fAvailModal === 'yes' ? 'AVAILABLE' : 'UNAVAILABLE'
    };

    if (!this.isEditing) {
      this.menuService.addMenu(payload).subscribe(() => {
        this.loadMenu();
        this.showToast('success', 'Menu item added');
        this.showModal = false;
      });
    } else {
      this.menuService.updateMenu(this.editId!, payload).subscribe(() => {
        this.loadMenu();
        this.showToast('success', 'Menu updated');
        this.showModal = false;
      });
    }
  }

  // ================= Toast =================

  toastVisible = false;
  toastType: 'success' | 'danger' | 'info' = 'success';
  toastMsg = '';

  showToast(type: any, msg: string) {
    this.toastType    = type;
    this.toastMsg     = msg;
    this.toastVisible = true;
    setTimeout(() => { this.toastVisible = false; }, 2500);
  }

  // ================= Helpers =================

  inr(value: number) { return '₹' + value; }

  typeBadgeClass(type: string) {
    return {
      veg:    type === 'Veg',
      nonveg: type === 'Non-Veg',
      egg:    type === 'Egg',
      vegan:  type === 'Vegan'
    };
  }
}