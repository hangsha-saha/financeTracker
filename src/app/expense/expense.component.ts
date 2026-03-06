import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

// ── Matches your DB EXPENSE table exactly ──
export interface Expense {
  expenseId:   number;    // expense_id
  expenseName: string;    // expense_name
  expenseType: string;    // expense_type  ← your "category"
  amount:      number;    // amount
  expenseDate: string;    // expense_date  "YYYY-MM-DD"
  description: string;    // description
}

export interface ExpensePayload {
  expenseName: string;
  expenseType: string;
  amount:      number;
  expenseDate: string;
  description: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message?: string;
}

@Component({
  selector: 'app-expense',
  templateUrl: './expense.component.html',
  styleUrls: ['./expense.component.css']
})
export class ExpenseComponent implements OnInit, OnDestroy {

  private readonly BASE = 'http://localhost:8080/api/expenses';

  // ── Data ──
  expenses: Expense[] = [];
  filtered: Expense[] = [];

  // ── Loading / error ──
  isLoading: boolean = false;
  apiError:  string  = '';

  // ── Filter ──
  categoryFilter: string = '';
  searchInput:    string = '';

  // ── Pagination ──
  page: number           = 1;
  readonly ROWS_PER_PAGE = 10;

  // ── Summary ──
  monthlyTotal: number = 0;

  // ── Modal ──
  showModal:  boolean       = false;
  isEditing:  boolean       = false;
  editingId:  number | null = null;
  modalTitle: string        = 'Add New Expense';
  isSaving:   boolean       = false;

  // Form fields
  fDate:        string        = '';
  fName:        string        = '';
  fCategory:    string        = '';
  fAmount:      number | null = null;
  fDescription: string        = '';

  // Form errors
  errDate:     boolean = false;
  errName:     boolean = false;
  errCategory: boolean = false;
  errAmount:   boolean = false;

  // ── Confirm delete ──
  showConfirm:     boolean       = false;
  confirmMsg:      string        = '';
  pendingDeleteId: number | null = null;
  isDeleting:      boolean       = false;

  // ── Toast ──
  toastMsg:     string  = '';
  toastType:    string  = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  readonly CATEGORIES = [
    'Rent', 'Utilities', 'Raw Materials',
    'Salaries', 'Marketing', 'Supplies', 'Maintenance'
  ];

  readonly BADGE_CLASS: any = {
    'Rent':          'badge-rent',
    'Utilities':     'badge-utilities',
    'Raw Materials': 'badge-raw-materials',
    'Salaries':      'badge-salaries',
    'Marketing':     'badge-marketing',
    'Supplies':      'badge-supplies',
    'Maintenance':   'badge-maintenance',
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fDate = this.todayString();
    this.loadExpenses();
  }

  ngOnDestroy(): void {
    clearTimeout(this.toastTimer);
  }

  // ════════════════════════════════════════
  // API CALLS
  // ════════════════════════════════════════

  // GET all  →  SELECT * FROM EXPENSE
  loadExpenses(): void {
    this.isLoading = true;
    this.apiError  = '';

    this.http.get<ApiResponse<Expense[]>>(this.BASE).subscribe({
      next: res => {
        this.expenses  = res.data;
        this.isLoading = false;
        this.applyFilters();
      },
      error: err => {
        this.apiError  = err.error?.message || 'Failed to load expenses.';
        this.isLoading = false;
      }
    });
  }

  // POST  →  INSERT INTO EXPENSE
  private createExpense(payload: ExpensePayload): void {
    this.isSaving = true;

    this.http.post<ApiResponse<Expense>>(this.BASE, payload).subscribe({
      next: res => {
        this.expenses.push(res.data);
        this.applyFilters();
        this.showToast(`"${res.data.expenseName}" added!`, 'success');
        this.isSaving = false;
        this.closeModal();
      },
      error: err => {
        this.showToast(err.error?.message || 'Failed to add expense.', 'danger');
        this.isSaving = false;
      }
    });
  }

  // PUT  →  UPDATE EXPENSE SET ... WHERE expense_id = :id
  private updateExpense(id: number, payload: ExpensePayload): void {
    this.isSaving = true;

    this.http.put<ApiResponse<Expense>>(`${this.BASE}/${id}`, payload).subscribe({
      next: res => {
        const idx = this.expenses.findIndex(e => e.expenseId === id);
        if (idx > -1) this.expenses[idx] = res.data;
        this.applyFilters();
        this.showToast(`"${res.data.expenseName}" updated!`, 'success');
        this.isSaving = false;
        this.closeModal();
      },
      error: err => {
        this.showToast(err.error?.message || 'Failed to update expense.', 'danger');
        this.isSaving = false;
      }
    });
  }

  // DELETE  →  DELETE FROM EXPENSE WHERE expense_id = :id
  doDelete(): void {
    if (this.pendingDeleteId === null) return;
    this.isDeleting = true;

    const expName = this.expenses.find(
      e => e.expenseId === this.pendingDeleteId
    )?.expenseName;

    this.http.delete<ApiResponse<null>>(
      `${this.BASE}/${this.pendingDeleteId}`
    ).subscribe({
      next: () => {
        this.expenses = this.expenses.filter(
          e => e.expenseId !== this.pendingDeleteId
        );
        this.applyFilters();
        this.showToast(`"${expName}" deleted.`, 'danger');
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
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  todayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  inr(n: number): string {
    return '₹' + n.toLocaleString('en-IN');
  }

  getBadgeClass(cat: string): string {
    return this.BADGE_CLASS[cat] || 'badge-rent';
  }

  // ════════════════════════════════════════
  // FILTER + PAGINATION
  // ════════════════════════════════════════

  applyFilters(): void {
    const cat    = this.categoryFilter.toLowerCase();
    const search = this.searchInput.toLowerCase().trim();

    this.filtered = this.expenses.filter(e => {
      const matchCat    = !cat    || e.expenseType.toLowerCase() === cat;
      const matchSearch = !search ||
        e.expenseName.toLowerCase().includes(search)  ||
        e.expenseType.toLowerCase().includes(search)  ||
        e.expenseDate.includes(search)                ||
        e.amount.toString().includes(search);
      return matchCat && matchSearch;
    });

    this.page = 1;
    this.updateMonthlyTotal();
  }

  updateMonthlyTotal(): void {
    this.monthlyTotal = this.expenses.reduce((s, e) => s + e.amount, 0);
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

  // ════════════════════════════════════════
  // MODAL
  // ════════════════════════════════════════

  openAddModal(): void {
    this.isEditing  = false;
    this.editingId  = null;
    this.modalTitle = 'Add New Expense';
    this.clearForm();
    this.fDate     = this.todayString();
    this.showModal = true;
  }

  openEditModal(id: number): void {
    const exp = this.expenses.find(e => e.expenseId === id);
    if (!exp) return;
    this.isEditing    = true;
    this.editingId    = id;
    this.modalTitle   = 'Edit Expense';
    this.fDate        = exp.expenseDate;
    this.fName        = exp.expenseName;
    this.fCategory    = exp.expenseType;
    this.fAmount      = exp.amount;
    this.fDescription = exp.description || '';
    this.clearErrors();
    this.showModal    = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.clearForm();
  }

  clearForm(): void {
    this.fDate = ''; this.fName = ''; this.fCategory = '';
    this.fAmount = null; this.fDescription = '';
    this.clearErrors();
  }

  clearErrors(): void {
    this.errDate = false; this.errName = false;
    this.errCategory = false; this.errAmount = false;
  }

  // ════════════════════════════════════════
  // SAVE — dispatches to create or update
  // ════════════════════════════════════════

  saveExpense(): void {
    this.clearErrors();
    let ok = true;

    if (!this.fDate)                                               { this.errDate     = true; ok = false; }
    if (!this.fName.trim())                                        { this.errName     = true; ok = false; }
    if (!this.fCategory)                                           { this.errCategory = true; ok = false; }
    if (this.fAmount === null || isNaN(this.fAmount) || this.fAmount < 0) {
      this.errAmount = true; ok = false;
    }

    if (!ok) return;

    // ── Build payload matching ExpenseRequestDTO ──
    const payload: ExpensePayload = {
      expenseName: this.fName.trim(),
      expenseType: this.fCategory,
      amount:      this.fAmount!,
      expenseDate: this.fDate,
      description: this.fDescription.trim(),
    };

    if (this.isEditing && this.editingId !== null) {
      this.updateExpense(this.editingId, payload);
    } else {
      this.createExpense(payload);
    }
  }

  // ════════════════════════════════════════
  // DELETE
  // ════════════════════════════════════════

  confirmDelete(id: number): void {
    const exp = this.expenses.find(e => e.expenseId === id);
    if (!exp) return;
    this.pendingDeleteId = id;
    this.confirmMsg      = `Delete "${exp.expenseName}"? This cannot be undone.`;
    this.showConfirm     = true;
  }

  cancelDelete(): void {
    this.showConfirm     = false;
    this.pendingDeleteId = null;
  }

  // ════════════════════════════════════════
  // TOAST
  // ════════════════════════════════════════

  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 2800);
  }
}