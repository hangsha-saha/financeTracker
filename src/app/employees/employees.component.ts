import { Component, OnInit, OnDestroy } from '@angular/core';
import { EmployeesService, Employee, SalaryRecord } from '../services/employees.service';
import { Subscription } from 'rxjs';

@Component({
  selector:    'app-employees',
  templateUrl: './employees.component.html',
  styleUrls:   ['./employees.component.css']
})
export class EmployeesComponent implements OnInit, OnDestroy {

  // ── Data ──
  employees: Employee[] = [];
  filtered:  Employee[] = [];

  // ── Loading / error ──
  isLoading:  boolean = false;
  isSaving:   boolean = false;
  isDeleting: boolean = false;
  apiError:   string  = '';

  private subs: Subscription[] = [];

  // ── Constants ──
  readonly ROLES = [
    'Head Chef', 'Sous Chef', 'Chef', 'Kitchen Assistant',
    'Waiter', 'Cashier', 'Delivery Boy', 'Manager'
  ];
  readonly CREDENTIAL_ROLES = ['Manager', 'Waiter'];
  readonly PAY_MODES        = ['Cash', 'Bank Transfer', 'UPI', 'Cheque'];

  // ── Filters ──
  searchText: string = '';
  roleFilter: string = 'all';

  // ── Pagination ──
  page:            number = 1;
  readonly PAGE_SIZE      = 6;

  // ── Add/Edit modal ──
  showModal:    boolean      = false;
  isEditing:    boolean      = false;
  editingId:    number | null = null;

  fName:        string       = '';
  fPhone:       string       = '';
  fEmail:       string       = '';
  fJoining:     string       = '';
  fRole:        string       = '';
  fSalary:      number | null = null;
  fUsername:    string       = '';
  fPassword:    string       = '';
  showPassword: boolean      = false;

  errName:     boolean = false;
  errPhone:    boolean = false;
  errEmail:    boolean = false;
  errJoining:  boolean = false;
  errRole:     boolean = false;
  errSalary:   boolean = false;
  errUsername: boolean = false;
  errPassword: boolean = false;

  // ── Confirm delete ──
  showConfirm:     boolean      = false;
  confirmMsg:      string       = '';
  pendingDeleteId: number | null = null;

  // ── Salary modal ──
  showSalaryModal: boolean      = false;
  salaryEmpId:     number | null = null;
  salaryEmpName:   string       = '';
  salaryEmpRole:   string       = '';
  salaryAmount:    number | null = null;
  salaryPaidOn:    string       = '';
  salaryPayMode:   string       = '';
  isSavingSalary:  boolean      = false;

  errSalaryAmount:  boolean = false;
  errSalaryPaidOn:  boolean = false;
  errSalaryPayMode: boolean = false;

  // ── Toast ──
  toastMsg:     string  = '';
  toastType:    string  = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  constructor(private employeesService: EmployeesService) {}

  ngOnInit(): void {
    this.loadEmployees();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearTimeout(this.toastTimer);
  }

  // ════════════════════════════════════════
  // LOAD
  // ════════════════════════════════════════

  loadEmployees(): void {
    this.isLoading = true;
    this.apiError  = '';

    const sub = this.employeesService.getAll().subscribe({
      next: list => {
        this.employees = list;
        this.isLoading = false;
        this.applyFilters();
      },
      error: () => {
        this.apiError  = 'Failed to load employees. Please try again.';
        this.isLoading = false;
      }
    });

    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // FILTERS + PAGINATION
  // ════════════════════════════════════════

  applyFilters(): void {
    const s = this.searchText.toLowerCase().trim();
    this.filtered = this.employees.filter(e => {
      if (s && !e.name.toLowerCase().includes(s) &&
               !e.role.toLowerCase().includes(s)) return false;
      if (this.roleFilter !== 'all' && e.role !== this.roleFilter) return false;
      return true;
    });
    this.page = 1;
  }

  get pagedItems(): Employee[] {
    const start = (this.page - 1) * this.PAGE_SIZE;
    return this.filtered.slice(start, start + this.PAGE_SIZE);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.PAGE_SIZE));
  }

  prevPage(): void { if (this.page > 1) this.page--; }
  nextPage(): void { if (this.page < this.totalPages) this.page++; }

  // ════════════════════════════════════════
  // MODAL OPEN / CLOSE
  // ════════════════════════════════════════

  openAddModal(): void {
    this.isEditing = false;
    this.editingId = null;
    this.clearForm();
    this.fJoining  = new Date().toISOString().split('T')[0];
    this.showModal = true;
  }

  openEditModal(id: number): void {
    const emp = this.employees.find(e => e.id === id);
    if (!emp) return;
    this.isEditing    = true;
    this.editingId    = id;
    this.fName        = emp.name;
    this.fPhone       = emp.phone;
    this.fEmail       = emp.email;
    this.fJoining     = emp.joining;
    this.fRole        = emp.role;
    this.fSalary      = emp.salary;
    this.fUsername    = emp.username || '';
    this.fPassword    = emp.password || '';
    this.showPassword = false;
    this.clearErrors();
    this.showModal    = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.clearForm();
  }

  clearForm(): void {
    this.fName = ''; this.fPhone = ''; this.fEmail = '';
    this.fJoining = ''; this.fRole = '';
    this.fSalary = null;
    this.fUsername = ''; this.fPassword = '';
    this.showPassword = false;
    this.clearErrors();
  }

  clearErrors(): void {
    this.errName = false; this.errPhone = false; this.errEmail = false;
    this.errJoining = false; this.errRole = false; this.errSalary = false;
    this.errUsername = false; this.errPassword = false;
  }

  get needsCredentials(): boolean {
    return this.CREDENTIAL_ROLES.includes(this.fRole);
  }

  onRoleChange(): void {
    if (!this.needsCredentials) {
      this.fUsername = ''; this.fPassword = '';
      this.errUsername = false; this.errPassword = false;
    }
  }

  togglePassword(): void { this.showPassword = !this.showPassword; }

  // ════════════════════════════════════════
  // SAVE — create or update
  // ════════════════════════════════════════

  saveEmployee(): void {
    this.clearErrors();
    let ok = true;

    if (!this.fName.trim())  { this.errName    = true; ok = false; }
    if (!this.fPhone.trim()) { this.errPhone   = true; ok = false; }
    if (!this.fEmail.trim()) { this.errEmail   = true; ok = false; }
    if (!this.fJoining)      { this.errJoining = true; ok = false; }
    if (!this.fRole)         { this.errRole    = true; ok = false; }
    if (this.fSalary === null || this.fSalary < 0)
                             { this.errSalary  = true; ok = false; }

    // Credentials only required on ADD for eligible roles
    if (this.needsCredentials && !this.isEditing) {
      if (!this.fUsername.trim()) { this.errUsername = true; ok = false; }
      if (!this.fPassword.trim()) { this.errPassword = true; ok = false; }
    }

    if (!ok) return;

    this.isSaving = true;

    const payload: Omit<Employee, 'id'> = {
      name:    this.fName.trim(),
      phone:   this.fPhone.trim(),
      email:   this.fEmail.trim(),
      joining: this.fJoining,
      role:    this.fRole,
      dept:    '',
      salary:  this.fSalary!,
      month:   new Date().toISOString().slice(0, 7),
      ...(this.needsCredentials && {
        username: this.fUsername.trim() || undefined,
        password: this.fPassword.trim() || undefined,
      })
    };

    if (this.isEditing && this.editingId !== null) {
      // ── UPDATE ──
      const sub = this.employeesService
        .update(this.editingId, payload)
        .subscribe({
          next: updated => {
            const idx = this.employees.findIndex(e => e.id === this.editingId);
            if (idx > -1) this.employees[idx] = updated;
            this.applyFilters();
            this.showToast(`"${updated.name}" updated!`, 'success');
            this.isSaving = false;
            this.closeModal();
          },
          error: () => {
            this.showToast('Failed to update employee.', 'danger');
            this.isSaving = false;
          }
        });
      this.subs.push(sub);

    } else {
      // ── CREATE ──
      const sub = this.employeesService.create(payload).subscribe({
        next: created => {
          this.employees.push(created);
          this.applyFilters();
          this.showToast(`"${created.name}" added successfully!`, 'success');
          this.isSaving = false;
          this.closeModal();
        },
        error: () => {
          this.showToast('Failed to add employee.', 'danger');
          this.isSaving = false;
        }
      });
      this.subs.push(sub);
    }
  }

  // ════════════════════════════════════════
  // DELETE
  // ════════════════════════════════════════

  confirmDelete(id: number): void {
    const emp = this.employees.find(e => e.id === id);
    if (!emp) return;
    this.pendingDeleteId = id;
    this.confirmMsg      = `Delete "${emp.name}"? This cannot be undone.`;
    this.showConfirm     = true;
  }

  cancelDelete(): void {
    this.showConfirm     = false;
    this.pendingDeleteId = null;
  }

  doDelete(): void {
    if (this.pendingDeleteId === null) return;
    this.isDeleting = true;

    const empName = this.employees.find(
      e => e.id === this.pendingDeleteId
    )?.name;

    const sub = this.employeesService.delete(this.pendingDeleteId).subscribe({
      next: (msg: any) => {
        console.log('Delete success:', msg);
        this.employees       = this.employees.filter(
          e => e.id !== this.pendingDeleteId
        );
        this.pendingDeleteId = null;
        this.showConfirm     = false;
        this.isDeleting      = false;
        this.closeModal();
        this.applyFilters();
        this.showToast(`"${empName}" deleted.`, 'danger');
      },
      error: (err) => {
        console.error('Delete failed:', err.status, err.message, err.error);
        this.showToast('Failed to delete employee.', 'danger');
        this.isDeleting = false;
      }
    });
    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // SALARY MODAL
  // ════════════════════════════════════════

  openSalaryModal(id: number): void {
    const emp = this.employees.find(e => e.id === id);
    if (!emp) return;

    this.salaryEmpId    = emp.id;
    this.salaryEmpName  = emp.name;
    this.salaryEmpRole  = emp.role;
    this.salaryAmount   = emp.salary;
    this.salaryPaidOn   = new Date().toISOString().split('T')[0];
    this.salaryPayMode  = '';
    this.isSavingSalary = false;
    this.clearSalaryErrors();
    this.showSalaryModal = true;
  }

  closeSalaryModal(): void {
    this.showSalaryModal = false;
    this.salaryEmpId     = null;
    this.clearSalaryErrors();
  }

  clearSalaryErrors(): void {
    this.errSalaryAmount  = false;
    this.errSalaryPaidOn  = false;
    this.errSalaryPayMode = false;
  }

  // ── Confirm payment ──
  saveSalary(): void {
    this.clearSalaryErrors();
    let ok = true;

    if (this.salaryAmount === null || this.salaryAmount <= 0)
      { this.errSalaryAmount  = true; ok = false; }
    if (!this.salaryPaidOn)
      { this.errSalaryPaidOn  = true; ok = false; }
    if (!this.salaryPayMode)
      { this.errSalaryPayMode = true; ok = false; }

    if (!ok) return;

    this.isSavingSalary = true;

    const sub = this.employeesService
      .paySalary(
        this.salaryEmpId!,
        this.salaryAmount!,
        this.salaryPaidOn,
        this.salaryPayMode
      )
      .subscribe({
        next: (record) => {
          console.log('Salary saved:', record);
          const idx = this.employees.findIndex(e => e.id === this.salaryEmpId);
          if (idx > -1) {
            this.employees[idx] = {
              ...this.employees[idx],
              salary: this.salaryAmount!
            };
          }
          this.applyFilters();
          this.showToast(
            `₹${this.salaryAmount!.toLocaleString('en-IN')} paid to "${this.salaryEmpName}"!`,
            'success'
          );
          this.isSavingSalary  = false;
          this.closeSalaryModal();
        },
        error: (err) => {
          console.error('Salary insert failed — status:', err.status);
          console.error('Salary insert failed — error body:', err.error);
          console.error('Salary insert failed — full error:', err);
          this.showToast('Failed to record salary payment. Check console for details.', 'danger');
          this.isSavingSalary = false;
        }
      });

    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  hasCredentials(emp: Employee): boolean {
    return this.CREDENTIAL_ROLES.includes(emp.role);
  }

  fmtDate(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 2800);
  }
}