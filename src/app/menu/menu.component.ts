import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

export interface MenuItem {
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

  // ── Sidebar ──
  sidebarName: string    = 'Admin User';
  sidebarRole: string    = 'Admin';
  sidebarInitial: string = 'A';
  sidebarEmail: string   = 'admin@restaurant.com';

  // ── Data ──
  menuData: MenuItem[] = [
    { id:1,  name:'Chicken Biryani',     type:'Non-Veg', price:220, available:'yes', description:'Aromatic basmati rice with spiced chicken' },
    { id:2,  name:'Veg Biryani',         type:'Veg',     price:160, available:'yes', description:'Fragrant rice with mixed vegetables and saffron' },
    { id:3,  name:'Mutton Biryani',      type:'Non-Veg', price:280, available:'yes', description:'Slow-cooked mutton with aged basmati' },
    { id:4,  name:'Paneer Butter Masala',type:'Veg',     price:180, available:'yes', description:'Creamy tomato-based paneer curry' },
    { id:5,  name:'Chicken Tikka Masala',type:'Non-Veg', price:210, available:'yes', description:'Tandoor chicken in rich masala gravy' },
    { id:6,  name:'Dal Tadka',           type:'Vegan',   price:120, available:'yes', description:'Yellow lentils tempered with cumin and garlic' },
    { id:7,  name:'Butter Naan',         type:'Veg',     price:40,  available:'yes', description:'Soft leavened bread brushed with butter' },
    { id:8,  name:'Garlic Roti',         type:'Vegan',   price:35,  available:'yes', description:'Whole wheat roti with garlic and herbs' },
    { id:9,  name:'Laccha Paratha',      type:'Veg',     price:50,  available:'yes', description:'Layered flaky wheat paratha' },
    { id:10, name:'Chicken 65',          type:'Non-Veg', price:190, available:'yes', description:'Spicy fried chicken with curry leaves' },
    { id:11, name:'Gobi Manchurian',     type:'Veg',     price:150, available:'yes', description:'Crispy cauliflower in Indo-Chinese sauce' },
    { id:12, name:'Egg Bhurji',          type:'Egg',     price:100, available:'yes', description:'Scrambled eggs with onion and spices' },
    { id:13, name:'Raita',               type:'Veg',     price:50,  available:'yes', description:'Chilled yoghurt with cucumber and cumin' },
    { id:14, name:'Mango Lassi',         type:'Veg',     price:80,  available:'yes', description:'Thick yoghurt drink with Alphonso mango' },
    { id:15, name:'Masala Chai',         type:'Veg',     price:30,  available:'yes', description:'Spiced milk tea with ginger and cardamom' },
    { id:16, name:'Gulab Jamun',         type:'Veg',     price:70,  available:'yes', description:'Soft milk-solid balls in rose sugar syrup' },
    { id:17, name:'Rasmalai',            type:'Veg',     price:90,  available:'no',  description:'Soft cheese dumplings in sweetened milk' },
    { id:18, name:'Mutton Rogan Josh',   type:'Non-Veg', price:260, available:'yes', description:'Kashmiri slow-braised mutton in aromatic spices' },
    { id:19, name:'Palak Paneer',        type:'Veg',     price:165, available:'yes', description:'Cottage cheese in spiced spinach gravy' },
    { id:20, name:'Fish Curry',          type:'Non-Veg', price:230, available:'no',  description:'Kerala-style coconut fish curry' },
    { id:21, name:'Veg Fried Rice',      type:'Vegan',   price:140, available:'yes', description:'Wok-tossed rice with seasonal vegetables' },
    { id:22, name:'Cold Coffee',         type:'Veg',     price:90,  available:'yes', description:'Chilled coffee with ice cream' },
    { id:23, name:'Chicken Shawarma',    type:'Non-Veg', price:130, available:'yes', description:'Marinated chicken wrap with garlic sauce' },
    { id:24, name:'Kheer',               type:'Veg',     price:75,  available:'yes', description:'Rice pudding with cardamom and pistachios' },
    { id:25, name:'Tandoori Roti',       type:'Vegan',   price:30,  available:'yes', description:'Whole wheat roti baked in tandoor oven' },
  ];

  private nextId = 26;

  // ── Filter state ──
  fType: string       = '';
  fAvailable: string  = '';
  fMinPrice: number | null = null;
  fMaxPrice: number | null = null;
  fSearch: string     = '';

  // ── Filtered + sorted ──
  filtered: MenuItem[] = [];
  sortCol: string          = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  // ── Pagination ──
  page: number   = 1;
  pgSize: number = 10;

  // ── Selection (bulk) ──
  selectedIds: Set<number> = new Set();
  selectAllChecked: boolean     = false;
  selectAllIndeterminate: boolean = false;

  // ── Modal ──
  showModal: boolean    = false;
  isEditing: boolean    = false;
  editingId: number | null = null;

  fName: string        = '';
  fTypeModal: string   = '';
  fPrice: number | null = null;
  fAvailModal: string  = 'yes';
  fDesc: string        = '';

  errName: boolean  = false;
  errType: boolean  = false;
  errPrice: boolean = false;

  // ── Confirm delete ──
  showConfirm: boolean  = false;
  confirmMsg: string    = '';
  private confirmCb: (() => void) | null = null;

  // ── Toast ──
  toastMsg: string      = '';
  toastType: string     = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  // ── Badge maps ──
  readonly TYPE_CLS: any = {
    'Veg':     'b-veg',
    'Non-Veg': 'b-nonveg',
    'Egg':     'b-egg',
    'Vegan':   'b-vegan',
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadSidebarProfile();
    this.applyFilters();
  }

  // ── Profile ──
  loadSidebarProfile(): void {
    try {
      const raw = localStorage.getItem('ftProfile');
      if (raw) {
        const p = JSON.parse(raw);
        const roleMap: any = { admin:'Admin', manager:'Manager', cashier:'Cashier', staff:'Staff' };
        this.sidebarName    = p.displayName || `${p.firstName} ${p.lastName}`;
        this.sidebarRole    = roleMap[p.role] || 'Admin';
        this.sidebarInitial = (p.firstName || 'A')[0].toUpperCase();
        this.sidebarEmail   = p.email || 'admin@restaurant.com';
      }
    } catch(e) {}
  }

  // ── Navigation ──
  readonly BUILT_PAGES = ['dashboard','login','inventory','income','expense','menu', 'generate-bill'];

  goTo(page: string): void {
    if (this.BUILT_PAGES.includes(page)) this.router.navigate(['/' + page]);
  }

  handleLogout(): void {
    if (confirm('Are you sure you want to logout?')) this.router.navigate(['/login']);
  }

  // ── Helpers ──
  inr(n: number): string { return '₹' + Number(n).toLocaleString('en-IN'); }
  typeBadgeClass(type: string): string { return this.TYPE_CLS[type] || ''; }

  // ── Filter ──
  applyFilters(): void {
    const minP   = this.fMinPrice ?? 0;
    const maxP   = this.fMaxPrice ?? Infinity;
    const search = this.fSearch.trim().toLowerCase(); // FIX: was never applied in original

    this.filtered = this.menuData.filter(r => {
      if (this.fType      && r.type      !== this.fType)      return false;
      if (this.fAvailable && r.available !== this.fAvailable) return false;
      if (r.price < minP || r.price > maxP)                   return false;
      // FIX: search now actually filters
      if (search && !`${r.name} ${r.description} ${r.type}`.toLowerCase().includes(search)) return false;
      return true;
    });

    this.page = 1;
    this.sortData();
    this.clearAllSelections();
  }

  clearFilters(): void {
    this.fType = ''; this.fAvailable = '';
    this.fMinPrice = null; this.fMaxPrice = null; this.fSearch = '';
    this.applyFilters();
  }

  // ── Sort ──
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
      if (av > bv) return this.sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  getSortIcon(col: string): string {
    if (this.sortCol !== col) return '⇅';
    return this.sortDir === 'asc' ? '▲' : '▼';
  }

  isSortActive(col: string): boolean { return this.sortCol === col; }

  // ── Pagination ──
  get pagedItems(): MenuItem[] {
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
    if (p >= 1 && p <= this.totalPages) { this.page = p; this.clearAllSelections(); }
  }

  onPgSizeChange(event: Event): void {
    this.pgSize = parseInt((event.target as HTMLSelectElement).value);
    this.page = 1;
    this.clearAllSelections();
  }

  // ── Selection ──
  isSelected(id: number): boolean { return this.selectedIds.has(id); }

  get selectedCount(): number { return this.selectedIds.size; }

  get showBulkToolbar(): boolean { return this.selectedIds.size > 0; }

  get canBulkEdit(): boolean { return this.selectedIds.size === 1; }

  toggleRow(id: number, checked: boolean): void {
    if (checked) this.selectedIds.add(id);
    else         this.selectedIds.delete(id);
    this.updateSelectAllState();
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) this.pagedItems.forEach(r => this.selectedIds.add(r.id));
    else         this.pagedItems.forEach(r => this.selectedIds.delete(r.id));
    this.updateSelectAllState();
  }

  updateSelectAllState(): void {
    const pageIds    = this.pagedItems.map(r => r.id);
    const selectedOnPage = pageIds.filter(id => this.selectedIds.has(id)).length;
    this.selectAllChecked       = selectedOnPage === pageIds.length && pageIds.length > 0;
    this.selectAllIndeterminate = selectedOnPage > 0 && selectedOnPage < pageIds.length;
  }

  clearAllSelections(): void {
    this.selectedIds.clear();
    this.selectAllChecked       = false;
    this.selectAllIndeterminate = false;
  }

  // ── Bulk Edit (opens edit modal for 1 selected item) ──
  bulkEdit(): void {
    if (this.selectedIds.size !== 1) return;
    const id = [...this.selectedIds][0];
    this.openEditModal(id);
  }

  // ── Bulk Delete ──
  bulkDelete(): void {
    const ids   = [...this.selectedIds];
    const count = ids.length;
    this.openConfirm(
      `Delete ${count} item${count > 1 ? 's' : ''}? This cannot be undone.`,
      () => {
        this.menuData = this.menuData.filter(r => !ids.includes(r.id));
        this.applyFilters();
        this.showToast(`${count} item${count > 1 ? 's' : ''} deleted`, 'danger');
      }
    );
  }

  // ── Add Modal ──
  openAddModal(): void {
    this.isEditing = false; this.editingId = null;
    this.clearForm();
    this.showModal = true;
  }

  // ── Edit Modal ──
  openEditModal(id: number): void {
    const item = this.menuData.find(r => r.id === id);
    if (!item) return;
    this.isEditing   = true;
    this.editingId   = id;
    this.fName       = item.name;
    this.fTypeModal  = item.type;
    this.fPrice      = item.price;
    this.fAvailModal = item.available;
    this.fDesc       = item.description;
    this.clearErrors();
    this.showModal   = true;
  }

  closeModal(): void { this.showModal = false; this.clearForm(); }

  clearForm(): void {
    this.fName = ''; this.fTypeModal = ''; this.fPrice = null;
    this.fAvailModal = 'yes'; this.fDesc = '';
    this.clearErrors();
  }

  clearErrors(): void { this.errName = false; this.errType = false; this.errPrice = false; }

  // ── Save ──
  saveItem(): void {
    this.clearErrors();
    let ok = true;
    if (!this.fName.trim())                                             { this.errName  = true; ok = false; }
    if (!this.fTypeModal)                                              { this.errType  = true; ok = false; }
    if (this.fPrice === null || isNaN(this.fPrice) || this.fPrice < 0){ this.errPrice = true; ok = false; }
    if (!ok) return;

    const payload = {
      name:        this.fName.trim(),
      type:        this.fTypeModal,
      price:       this.fPrice!,
      available:   this.fAvailModal,
      description: this.fDesc.trim(),
    };

    if (this.isEditing && this.editingId !== null) {
      const idx = this.menuData.findIndex(r => r.id === this.editingId);
      if (idx > -1) this.menuData[idx] = { ...this.menuData[idx], ...payload };
      this.showToast(`"${payload.name}" updated`, 'success');
    } else {
      this.menuData.push({ id: this.nextId++, ...payload });
      this.showToast(`"${payload.name}" added to menu`, 'success');
    }

    this.closeModal();
    this.applyFilters();
  }

  // ── Confirm Dialog ──
  openConfirm(msg: string, cb: () => void): void {
    this.confirmMsg = msg;
    this.confirmCb  = cb;
    this.showConfirm = true;
  }

  cancelConfirm(): void { this.showConfirm = false; this.confirmCb = null; }

  doConfirm(): void {
    this.showConfirm = false;
    if (this.confirmCb) { this.confirmCb(); this.confirmCb = null; }
  }

  // ── Toast ──
  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 2800);
  }
}