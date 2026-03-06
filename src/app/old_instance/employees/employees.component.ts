import { Component, OnInit, OnDestroy } from '@angular/core';
import { EmployeesService, Employee, SalaryRecord } from '../services/employees.service';
import { Subscription } from 'rxjs';

@Component({
  selector:    'app-employees',
  templateUrl: './employees.component.html',
  styleUrls:   ['./employees.component.css']
})
export class EmployeesComponent implements OnInit, OnDestroy {

  private readonly CURRENT_USER_ID: number = 1;

  employees: Employee[] = [];
  filtered:  Employee[] = [];

  isLoading: boolean = false;
  apiError:  string  = '';

  private subs: Subscription[] = [];

  readonly ROLES = [
    'Head Chef', 'Sous Chef', 'Chef', 'Kitchen Assistant',
    'Waiter', 'Cashier', 'Delivery Boy', 'Manager'
  ];
  readonly DEPTS            = ['Kitchen', 'Front of House', 'Delivery', 'Management'];
  readonly CREDENTIAL_ROLES = ['Manager', 'Waiter'];
  readonly PAY_MODES        = ['Cash', 'Bank Transfer', 'UPI', 'Cheque'];

  readonly DEPT_CLASS: any = {
    'Kitchen':        'dept-kitchen',
    'Front of House': 'dept-front',
    'Delivery':       'dept-delivery',
    'Management':     'dept-management',
  };

  searchText:   string = '';
  statusFilter: string = 'all';
  deptFilter:   string = 'all';
  roleFilter:   string = 'all';
  monthFilter:  string = 'all';

  months: { value: string; label: string }[] = [
    { value: '2026-02', label: 'Feb 2026' },
    { value: '2026-01', label: 'Jan 2026' },
    { value: '2025-12', label: 'Dec 2025' },
  ];

  page:            number = 1;
  readonly PAGE_SIZE      = 6;

  showModal:  boolean      = false;
  isEditing:  boolean      = false;
  editingId:  number | null = null;

  fName:     string       = '';
  fPhone:    string       = '';
  fEmail:    string       = '';
  fJoining:  string       = '';
  fRole:     string       = '';
  fDept:     string       = '';
  fSalary:   number | null = null;
  fMonth:    string       = '';
  fStatus:   string       = 'pending';
  fUsername: string       = '';
  fPassword: string       = '';
  showPassword: boolean   = false;

  errName:     boolean = false;
  errPhone:    boolean = false;
  errEmail:    boolean = false;
  errJoining:  boolean = false;
  errRole:     boolean = false;
  errDept:     boolean = false;
  errSalary:   boolean = false;
  errMonth:    boolean = false;
  errUsername: boolean = false;
  errPassword: boolean = false;

  showConfirm:     boolean      = false;
  confirmMsg:      string       = '';
  pendingDeleteId: number | null = null;

  toastMsg:     string  = '';
  toastType:    string  = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  showSalaryModal:   boolean      = false;
  salaryEmpId:       number | null = null;
  salaryEmpName:     string       = '';
  salaryEmpRole:     string       = '';
  salaryEmpDept:     string       = '';
  salaryAmount:      number | null = null;
  salaryMonth:       string       = '';
  salaryPaidOn:      string       = '';
  salaryPayMode:     string       = 'Cash';
  showSalaryHistory: boolean      = false;

  errSalaryMonth:   boolean = false;
  errSalaryPaidOn:  boolean = false;
  errSalaryAmount:  boolean = false;
  errSalaryPayMode: boolean = false;

  // ── Salary history for currently open modal ──
  currentEmpHistory: SalaryRecord[] = [];

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

    const sub = this.employeesService
      .getByUserId(this.CURRENT_USER_ID)
      .subscribe({
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
               !e.role.toLowerCase().includes(s))    return false;
      if (this.statusFilter !== 'all' && e.status !== this.statusFilter) return false;
      if (this.deptFilter   !== 'all' && e.dept   !== this.deptFilter)   return false;
      if (this.roleFilter   !== 'all' && e.role   !== this.roleFilter)   return false;
      if (this.monthFilter  !== 'all' && e.month  !== this.monthFilter)  return false;
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
  // MARK PAID — uses service
  // ════════════════════════════════════════

  markPaid(id: number): void {
    const sub = this.employeesService.markPaid(id).subscribe({
      next: updated => {
        const idx = this.employees.findIndex(e => e.id === id);
        if (idx > -1) this.employees[idx] = updated;
        this.applyFilters();
        this.showToast(`"${updated.name}" marked as paid!`, 'success');
      },
      error: () => this.showToast('Failed to update status.', 'danger')
    });
    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // MODAL
  // ════════════════════════════════════════

  openAddModal(): void {
    this.isEditing = false;
    this.editingId = null;
    this.clearForm();
    const now      = new Date();
    this.fJoining  = now.toISOString().split('T')[0];
    this.fMonth    = now.toISOString().slice(0, 7);
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
    this.fDept        = emp.dept;
    this.fSalary      = emp.salary;
    this.fMonth       = emp.month;
    this.fStatus      = emp.status;
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
    this.fJoining = ''; this.fRole = ''; this.fDept = '';
    this.fSalary = null; this.fMonth = ''; this.fStatus = 'pending';
    this.fUsername = ''; this.fPassword = '';
    this.showPassword = false;
    this.clearErrors();
  }

  clearErrors(): void {
    this.errName = false; this.errPhone = false; this.errEmail = false;
    this.errJoining = false; this.errRole = false; this.errDept = false;
    this.errSalary = false; this.errMonth = false;
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
  // SAVE — uses service.create() or service.update()
  // ════════════════════════════════════════

  saveEmployee(): void {
    this.clearErrors();
    let ok = true;

    if (!this.fName.trim())                              { this.errName     = true; ok = false; }
    if (!this.fPhone.trim())                             { this.errPhone    = true; ok = false; }
    if (!this.fEmail.trim())                             { this.errEmail    = true; ok = false; }
    if (!this.fJoining)                                  { this.errJoining  = true; ok = false; }
    if (!this.fRole)                                     { this.errRole     = true; ok = false; }
    if (!this.fDept)                                     { this.errDept     = true; ok = false; }
    if (this.fSalary === null || this.fSalary < 0)       { this.errSalary   = true; ok = false; }
    if (!this.fMonth)                                    { this.errMonth    = true; ok = false; }
    if (this.needsCredentials && !this.fUsername.trim()) { this.errUsername = true; ok = false; }
    if (this.needsCredentials && !this.fPassword.trim()) { this.errPassword = true; ok = false; }

    if (!ok) return;

    const payload: Omit<Employee, 'id'> = {
      name:    this.fName.trim(),
      phone:   this.fPhone.trim(),
      email:   this.fEmail.trim(),
      joining: this.fJoining,
      role:    this.fRole,
      dept:    this.fDept,
      salary:  this.fSalary!,
      month:   this.fMonth,
      status:  this.fStatus as 'paid' | 'pending',
      ...(this.needsCredentials && {
        username: this.fUsername.trim(),
        password: this.fPassword.trim()
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
            this.closeModal();
          },
          error: () => this.showToast('Failed to update employee.', 'danger')
        });
      this.subs.push(sub);

    } else {
      // ── CREATE ──
      const sub = this.employeesService.create(payload).subscribe({
        next: created => {
          this.employees.push(created);
          this.ensureMonthInFilter(created.month);
          this.applyFilters();
          this.showToast(`"${created.name}" added successfully!`, 'success');
          this.closeModal();
        },
        error: () => this.showToast('Failed to add employee.', 'danger')
      });
      this.subs.push(sub);
    }
  }

  // ════════════════════════════════════════
  // DELETE — uses service.delete()
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

    const empName = this.employees.find(
      e => e.id === this.pendingDeleteId
    )?.name;

    const sub = this.employeesService.delete(this.pendingDeleteId).subscribe({
      next: () => {
        this.employees   = this.employees.filter(
          e => e.id !== this.pendingDeleteId
        );
        this.pendingDeleteId = null;
        this.showConfirm     = false;
        this.closeModal();
        this.applyFilters();
        this.showToast(`"${empName}" deleted.`, 'danger');
      },
      error: () => this.showToast('Failed to delete employee.', 'danger')
    });
    this.subs.push(sub);
  }

  // ════════════════════════════════════════
  // SALARY MODAL — uses service salary methods
  // ════════════════════════════════════════

  openSalaryModal(id: number): void {
    const emp = this.employees.find(e => e.id === id);
    if (!emp) return;

    this.salaryEmpId       = emp.id;
    this.salaryEmpName     = emp.name;
    this.salaryEmpRole     = emp.role;
    this.salaryEmpDept     = emp.dept;
    this.salaryAmount      = emp.salary;
    this.salaryMonth       = emp.month;
    this.salaryPaidOn      = new Date().toISOString().split('T')[0];
    this.salaryPayMode     = 'Cash';
    this.showSalaryHistory = false;
    this.currentEmpHistory = [];
    this.clearSalaryErrors();
    this.showSalaryModal   = true;

    // Load salary history for this employee
    const sub = this.employeesService
      .getSalaryRecordsByEmployee(emp.id)
      .subscribe({
        next: records => { this.currentEmpHistory = records; },
        error: () => { this.currentEmpHistory = []; }
      });
    this.subs.push(sub);
  }

  closeSalaryModal(): void {
    this.showSalaryModal   = false;
    this.salaryEmpId       = null;
    this.currentEmpHistory = [];
    this.showSalaryHistory = false;
    this.clearSalaryErrors();
  }

  clearSalaryErrors(): void {
    this.errSalaryMonth   = false;
    this.errSalaryPaidOn  = false;
    this.errSalaryAmount  = false;
    this.errSalaryPayMode = false;
  }

  saveSalary(): void {
    this.clearSalaryErrors();
    let ok = true;

    if (!this.salaryMonth)                                    { this.errSalaryMonth   = true; ok = false; }
    if (!this.salaryPaidOn)                                   { this.errSalaryPaidOn  = true; ok = false; }
    if (this.salaryAmount === null || this.salaryAmount <= 0) { this.errSalaryAmount  = true; ok = false; }
    if (!this.salaryPayMode)                                  { this.errSalaryPayMode = true; ok = false; }

    if (!ok) return;

    // ── Check duplicate first ──
    const checkSub = this.employeesService
      .isSalaryAlreadyPaid(this.salaryEmpId!, this.salaryMonth)
      .subscribe({
        next: alreadyPaid => {
          if (alreadyPaid) {
            this.showToast(
              `Salary already paid for ${this.formatMonth(this.salaryMonth)}!`,
              'danger'
            );
            return;
          }

          // ── Create salary record ──
          const record: Omit<SalaryRecord, 'id'> = {
            employeeId:   this.salaryEmpId!,
            employeeName: this.salaryEmpName,
            role:         this.salaryEmpRole,
            dept:         this.salaryEmpDept,
            salary:       this.salaryAmount!,
            month:        this.salaryMonth,
            paidOn:       this.salaryPaidOn,
            paymentMode:  this.salaryPayMode,
          };

          const saveSub = this.employeesService
            .createSalaryRecord(record)
            .subscribe({
              next: newRecord => {
                // Add to local history list
                this.currentEmpHistory = [newRecord, ...this.currentEmpHistory]
                  .sort((a, b) => b.month.localeCompare(a.month));

                // Mark employee as paid if month matches
                const emp = this.employees.find(e => e.id === this.salaryEmpId);
                if (emp && emp.month === this.salaryMonth) {
                  const markSub = this.employeesService
                    .markPaid(this.salaryEmpId!)
                    .subscribe({
                      next: updated => {
                        const idx = this.employees.findIndex(
                          e => e.id === this.salaryEmpId
                        );
                        if (idx > -1) this.employees[idx] = updated;
                        this.applyFilters();
                      }
                    });
                  this.subs.push(markSub);
                }

                this.showToast(
                  `₹${this.salaryAmount!.toLocaleString('en-IN')} paid to "${this.salaryEmpName}"!`,
                  'success'
                );
                this.closeSalaryModal();
              },
              error: () => this.showToast('Failed to record salary payment.', 'danger')
            });
          this.subs.push(saveSub);
        }
      });
    this.subs.push(checkSub);
  }

  // ── Computed from local history array (no separate getter needed) ──
  get currentEmpSalaryHistory(): SalaryRecord[] {
    return this.currentEmpHistory;
  }

  get currentEmpTotalPaid(): number {
    return this.currentEmpHistory.reduce((s, r) => s + r.salary, 0);
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  ensureMonthInFilter(month: string): void {
    if (this.months.some(m => m.value === month)) return;
    const [y, m] = month.split('-');
    const label  = new Date(+y, +m - 1).toLocaleString('en-IN', {
      month: 'short', year: 'numeric'
    });
    this.months.push({ value: month, label });
  }

  formatMonth(m: string): string {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1).toLocaleString('en-IN', {
      month: 'short', year: 'numeric'
    });
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