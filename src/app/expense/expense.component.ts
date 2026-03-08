import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

// ─────────────────────────────────────────────
//  Internal model used everywhere in the view
// ─────────────────────────────────────────────
export interface Expense {
  id:           number;
  date:         string;   // stored as "YYYY-MM-DD" internally
  name:         string;
  category:     string;
  amount:       number;
  description?: string;
}

// ─────────────────────────────────────────────
//  Shape the REST API sends / receives
// ─────────────────────────────────────────────
interface ApiExpense {
  expenseId:   number;
  expenseName: string;
  expenseType: string;
  amount:      number;
  expenseDate: string;   // "DD-MM-YYYY"
  description: string;
}

interface ApiExpensePayload {
  expenseName: string;
  expenseType: string;
  amount:      number;
  expenseDate: string;   // "DD-MM-YYYY"
  description: string;
}

@Component({
  selector:    'app-expense',
  templateUrl: './expense.component.html',
  styleUrls:   ['./expense.component.css']
})
export class ExpenseComponent implements OnInit {

  // ── API endpoints ──────────────────────────────────────────────────────────
  private get USER_ID(): number {
    return this.authService.getCurrentUserId();
  }
  private readonly BASE_URL = 'http://192.168.1.39:3000/expenses';

  private get FETCH_URL()         { return `${this.BASE_URL}/user/${this.USER_ID}`; }  // GET  all
  private get CREATE_URL()        { return `${this.BASE_URL}/${this.USER_ID}`;      }  // POST new
  private editUrl(id: number)     { return `${this.BASE_URL}/${id}`;               }  // PUT
  private deleteUrl(id: number)   { return `${this.BASE_URL}/${id}`;               }  // DELETE

  private readonly JSON_HEADERS = new HttpHeaders({ 'Content-Type': 'application/json' });

  // ── Page state ─────────────────────────────────────────────────────────────
  isLoading:  boolean = false;
  loadError:  string  = '';
  isSaving:   boolean = false;
  isDeleting: boolean = false;

  // ── Sidebar ────────────────────────────────────────────────────────────────
  sidebarName:    string = 'Admin User';
  sidebarRole:    string = 'Admin';
  sidebarInitial: string = 'A';
  sidebarEmail:   string = 'admin@restaurant.com';

  // ── Data ───────────────────────────────────────────────────────────────────
  expenses: Expense[] = [];

  // ── Filters ────────────────────────────────────────────────────────────────
  categoryFilter: string    = '';
  searchInput:    string    = '';
  filtered:       Expense[] = [];

  // ── Pagination ─────────────────────────────────────────────────────────────
  page:                number = 1;
  readonly ROWS_PER_PAGE      = 10;

  // ── Summary ────────────────────────────────────────────────────────────────
  monthlyTotal: number = 0;

  // ── Add / Edit Modal ───────────────────────────────────────────────────────
  showModal:   boolean       = false;
  isEditing:   boolean       = false;
  editingId:   number | null = null;
  modalTitle:  string        = 'Add New Expense';

  fDate:        string        = '';
  fName:        string        = '';
  fCategory:    string        = '';
  fAmount:      number | null = null;
  fDescription: string        = '';

  errDate:     boolean = false;
  errName:     boolean = false;
  errCategory: boolean = false;
  errAmount:   boolean = false;

  // ── Confirm Delete ─────────────────────────────────────────────────────────
  showConfirm:     boolean       = false;
  confirmMsg:      string        = '';
  pendingDeleteId: number | null = null;

  // ── Toast ──────────────────────────────────────────────────────────────────
  toastMsg:     string  = '';
  toastType:    string  = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  // ── Static lookups ─────────────────────────────────────────────────────────
  readonly CATEGORIES = [
    'Rent', 'Utilities', 'Raw Materials', 'Salaries',
    'Marketing', 'Supplies', 'Maintenance', 'Variable', 'Fixed', 'Other'
  ];

  readonly BADGE_CLASS: Record<string, string> = {
    'Rent':          'badge-rent',
    'Utilities':     'badge-utilities',
    'Raw Materials': 'badge-raw-materials',
    'Salaries':      'badge-salaries',
    'Marketing':     'badge-marketing',
    'Supplies':      'badge-supplies',
    'Maintenance':   'badge-maintenance',
    'Variable':      'badge-raw-materials',
    'Fixed':         'badge-salaries',
    'Other':         'badge-rent',
  };

  // ──────────────────────────────────────────────────────────────────────────
  constructor(
    private router:      Router,
    private http:        HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadSidebarProfile();
    this.fDate = this.todayString();
    this.fetchExpenses();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  GET — load all expenses
  // ══════════════════════════════════════════════════════════════════════════
  fetchExpenses(): void {
    this.isLoading = true;
    this.loadError = '';

    this.http.get<ApiExpense[]>(this.FETCH_URL).subscribe({
      next: (data) => {
        this.expenses  = (data || []).map(item => this.mapApiExpense(item));
        this.isLoading = false;
        this.applyFilters();
      },
      error: (err) => {
        console.error('[Expense] GET failed:', err);
        this.loadError = 'Failed to load expenses. Check the server and try again.';
        this.isLoading = false;
        this.applyFilters();
      }
    });
  }

  retryFetch(): void { this.fetchExpenses(); }

  // ══════════════════════════════════════════════════════════════════════════
  //  POST — create new expense
  // ══════════════════════════════════════════════════════════════════════════
  private createExpense(): void {
    const payload: ApiExpensePayload = {
      expenseName: this.fName.trim(),
      expenseType: this.fCategory,
      amount:      this.fAmount!,
      expenseDate: this.toApiDate(this.fDate),
      description: this.fDescription.trim()
    };

    this.isSaving = true;

    this.http.post<ApiExpense>(this.CREATE_URL, payload, { headers: this.JSON_HEADERS })
      .subscribe({
        next: (saved) => {
          this.expenses = [...this.expenses, this.mapApiExpense(saved)];
          this.isSaving = false;
          this.showToast(`"${saved.expenseName}" added successfully`, 'success');
          this.closeModal();
          this.applyFilters();
        },
        error: (err) => {
          console.error('[Expense] POST failed:', err);
          this.isSaving = false;
          this.showToast('Failed to add expense. Please try again.', 'danger');
        }
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PUT — update existing expense
  // ══════════════════════════════════════════════════════════════════════════
  private updateExpense(): void {
    const payload: ApiExpensePayload = {
      expenseName: this.fName.trim(),
      expenseType: this.fCategory,
      amount:      this.fAmount!,
      expenseDate: this.toApiDate(this.fDate),
      description: this.fDescription.trim()
    };

    this.isSaving = true;

    this.http.put<ApiExpense>(this.editUrl(this.editingId!), payload, { headers: this.JSON_HEADERS })
      .subscribe({
        next: (updated) => {
          const idx = this.expenses.findIndex(e => e.id === this.editingId);
          if (idx > -1) {
            const list = [...this.expenses];
            list[idx]  = this.mapApiExpense(updated);
            this.expenses = list;
          }
          this.isSaving = false;
          this.showToast(`"${updated.expenseName}" updated successfully`, 'success');
          this.closeModal();
          this.applyFilters();
        },
        error: (err) => {
          console.error('[Expense] PUT failed:', err);
          this.isSaving = false;
          this.showToast('Failed to update expense. Please try again.', 'danger');
        }
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  DELETE — remove expense
  // ══════════════════════════════════════════════════════════════════════════
  doDelete(): void {
    if (this.pendingDeleteId === null) return;

    const idToDelete = this.pendingDeleteId;   // ← save it first
    const expName    = this.expenses.find(e => e.id === idToDelete)?.name ?? '';

    this.isDeleting  = true;
    this.showConfirm = false;
    this.pendingDeleteId = null;               // ← clear immediately

    this.http.delete(this.deleteUrl(idToDelete), { responseType: 'text' }).subscribe({
      next: () => {
        this.expenses   = this.expenses.filter(e => e.id !== idToDelete);
        this.isDeleting = false;
        this.showToast(`"${expName}" deleted`, 'danger');
        this.applyFilters();
      },
      error: (err) => {
        console.error('[Expense] DELETE failed:', err);
        this.isDeleting = false;
        this.showToast('Failed to delete expense. Please try again.', 'danger');
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Modal helpers
  // ══════════════════════════════════════════════════════════════════════════
  openAddModal(): void {
    this.isEditing  = false;
    this.editingId  = null;
    this.modalTitle = 'Add New Expense';
    this.clearForm();
    this.fDate     = this.todayString();
    this.showModal = true;
  }

  openEditModal(id: number): void {
    const exp = this.expenses.find(e => e.id === id);
    if (!exp) return;
    this.isEditing    = true;
    this.editingId    = id;
    this.modalTitle   = 'Edit Expense';
    this.fDate        = exp.date;
    this.fName        = exp.name;
    this.fCategory    = exp.category;
    this.fAmount      = exp.amount;
    this.fDescription = exp.description || '';
    this.clearErrors();
    this.showModal    = true;
  }

  closeModal(): void {
    if (this.isSaving) return;
    this.showModal = false;
    this.clearForm();
  }

  /** Validate → dispatch to createExpense() or updateExpense() */
  saveExpense(): void {
    this.clearErrors();
    let valid = true;

    if (!this.fDate)                                                          { this.errDate     = true; valid = false; }
    if (!this.fName.trim())                                                   { this.errName     = true; valid = false; }
    if (!this.fCategory)                                                      { this.errCategory = true; valid = false; }
    if (this.fAmount === null || isNaN(+this.fAmount) || +this.fAmount < 0)  { this.errAmount   = true; valid = false; }

    if (!valid) return;

    this.isEditing && this.editingId !== null
      ? this.updateExpense()
      : this.createExpense();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Delete confirmation dialog
  // ══════════════════════════════════════════════════════════════════════════
  confirmDelete(id: number): void {
    const exp = this.expenses.find(e => e.id === id);
    if (!exp) return;
    this.pendingDeleteId = id;
    this.confirmMsg      = `Delete "${exp.name}"? This cannot be undone.`;
    this.showConfirm     = true;
  }

  cancelDelete(): void {
    this.showConfirm     = false;
    this.pendingDeleteId = null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Filters & pagination
  // ══════════════════════════════════════════════════════════════════════════
  applyFilters(): void {
    const cat    = this.categoryFilter.toLowerCase();
    const search = this.searchInput.toLowerCase().trim();

    this.filtered = this.expenses.filter(e => {
      const matchCat    = !cat    || e.category.toLowerCase() === cat;
      const matchSearch = !search ||
        e.name.toLowerCase().includes(search)     ||
        e.category.toLowerCase().includes(search) ||
        e.date.includes(search)                   ||
        e.amount.toString().includes(search);
      return matchCat && matchSearch;
    });

    this.page = 1;
    this.updateMonthlyTotal();
  }

  updateMonthlyTotal(): void {
    this.monthlyTotal = this.expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  get pagedItems(): Expense[] {
    const start = (this.page - 1) * this.ROWS_PER_PAGE;
    return this.filtered.slice(start, start + this.ROWS_PER_PAGE);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.ROWS_PER_PAGE));
  }

  prevPage(): void { if (this.page > 1) this.page--; }
  nextPage(): void { if (this.page < this.totalPages) this.page++; }

  // ══════════════════════════════════════════════════════════════════════════
  //  Date conversion helpers
  // ══════════════════════════════════════════════════════════════════════════

  /** "DD-MM-YYYY" → "YYYY-MM-DD"  (API → HTML input) */
  private convertDate(dateStr: string): string {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const p = dateStr.split('-');
    if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1]}-${p[0]}`;
    return dateStr;
  }

  /** "YYYY-MM-DD" → "DD-MM-YYYY"  (HTML input → API payload) */
  private toApiDate(dateStr: string): string {
    if (!dateStr) return '';
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
    const p = dateStr.split('-');
    if (p.length === 3 && p[0].length === 4) return `${p[2]}-${p[1]}-${p[0]}`;
    return dateStr;
  }

  /** Maps an API response object → internal Expense model */
  private mapApiExpense(item: ApiExpense): Expense {
    return {
      id:          item.expenseId,
      date:        this.convertDate(item.expenseDate),
      name:        item.expenseName,
      category:    item.expenseType,
      amount:      item.amount,
      description: item.description || ''
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Misc helpers
  // ══════════════════════════════════════════════════════════════════════════
  todayString(): string { return new Date().toISOString().split('T')[0]; }

  inr(n: number): string { return '₹' + Number(n).toLocaleString('en-IN'); }

  getBadgeClass(cat: string): string { return this.BADGE_CLASS[cat] ?? 'badge-rent'; }

  clearForm(): void {
    this.fDate = ''; this.fName = ''; this.fCategory = '';
    this.fAmount = null; this.fDescription = '';
    this.clearErrors();
  }

  clearErrors(): void {
    this.errDate = this.errName = this.errCategory = this.errAmount = false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Sidebar profile
  // ══════════════════════════════════════════════════════════════════════════
  loadSidebarProfile(): void {
    try {
      const raw = localStorage.getItem('ftProfile');
      if (raw) {
        const p = JSON.parse(raw);
        const roleMap: Record<string,string> = {
          admin: 'Admin', manager: 'Manager', cashier: 'Cashier', staff: 'Staff'
        };
        this.sidebarName    = p.displayName || `${p.firstName} ${p.lastName}`;
        this.sidebarRole    = roleMap[p.role] ?? 'Admin';
        this.sidebarInitial = (p.firstName || 'A')[0].toUpperCase();
        this.sidebarEmail   = p.email || 'admin@restaurant.com';
      }
    } catch (_) {}
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Navigation
  // ══════════════════════════════════════════════════════════════════════════
  readonly BUILT_PAGES = [
    'dashboard', 'login', 'inventory', 'income', 'expense', 'menu', 'generate-bill'
  ];

  goTo(page: string): void {
    if (this.BUILT_PAGES.includes(page)) this.router.navigate(['/' + page]);
  }

  handleLogout(): void {
    if (confirm('Are you sure you want to logout?')) this.router.navigate(['/login']);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Toast
  // ══════════════════════════════════════════════════════════════════════════
  showToast(msg: string, type: 'success' | 'danger' | 'info' = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastVisible = false), 3000);
  }
}