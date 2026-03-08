import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface Employee {
  id:        number;
  name:      string;
  phone:     string;
  email:     string;
  joining:   string;
  role:      string;
  dept:      string;
  salary:    number;
  month:     string;
  username?: string;
  password?: string;
}

export interface SalaryRecord {
  id:          number;
  employeeId:  number;
  salary:      number;
  paymentDate: string;
  paymentMode: string;
}

@Injectable({ providedIn: 'root' })
export class EmployeesService {

  private readonly BASE        = 'http://192.168.1.39:3000/employee';
  private readonly SALARY_BASE = 'http://192.168.1.39:3000/salary';
  private readonly AUTH_BASE   = 'http://192.168.1.39:3000/api';

  readonly CREDENTIAL_ROLES = ['Manager', 'Waiter'];

  private cache:       Employee[]     = [];
  private salaryCache: SalaryRecord[] = [];

  constructor(
    private http:        HttpClient,
    private authService: AuthService
  ) {}

  private get adminId(): number {
    return this.authService.getCurrentUserId();
  }

  // ════════════════════════════════════════
  // ROLE MAPS
  // ════════════════════════════════════════

  private readonly ROLE_FROM_API: { [key: string]: string } = {
    'HEAD_CHEF':         'Head Chef',
    'SOUS_CHEF':         'Sous Chef',
    'CHEF':              'Chef',
    'KITCHEN_ASSISTANT': 'Kitchen Assistant',
    'WAITER':            'Waiter',
    'CASHIER':           'Cashier',
    'DELIVERY_BOY':      'Delivery Boy',
    'MANAGER':           'Manager',
    'HEAD CHEF':         'Head Chef',
    'SOUS CHEF':         'Sous Chef',
    'KITCHEN ASSISTANT': 'Kitchen Assistant',
    'DELIVERY BOY':      'Delivery Boy',
  };

  private readonly ROLE_TO_API: { [key: string]: string } = {
    'Head Chef':         'HEAD_CHEF',
    'Sous Chef':         'SOUS_CHEF',
    'Chef':              'CHEF',
    'Kitchen Assistant': 'KITCHEN_ASSISTANT',
    'Waiter':            'WAITER',
    'Cashier':           'CASHIER',
    'Delivery Boy':      'DELIVERY_BOY',
    'Manager':           'MANAGER',
  };

  // ════════════════════════════════════════
  // DATE HELPERS
  // ════════════════════════════════════════

  private parseDate(raw: any): string {
    if (!raw) return '';
    if (Array.isArray(raw) && raw.length >= 3) {
      const [y, m, d] = raw;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    if (typeof raw === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(raw)) {
      const [dd, mm, yyyy] = raw.split('-');
      return `${yyyy}-${mm}-${dd}`;
    }
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (typeof raw === 'string' && raw.includes('T')) return raw.split('T')[0];
    if (typeof raw === 'number') return new Date(raw).toISOString().split('T')[0];
    return '';
  }

  private formatDateForApi(yyyymmdd: string): string {
    if (!yyyymmdd) return '';
    const [yyyy, mm, dd] = yyyymmdd.split('-');
    return `${dd}-${mm}-${yyyy}`;
  }

  // ════════════════════════════════════════
  // MAP HELPERS
  // ════════════════════════════════════════

  private mapEmployee(e: any): Employee {
    const rawRole     = e.role ?? '';
    const displayRole = this.ROLE_FROM_API[rawRole]
      ?? rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase();
    return {
      id:       e.empId      ?? e.id          ?? 0,
      name:     e.empName    ?? e.name        ?? '',
      phone:    e.phone      ?? '',
      email:    e.email      ?? '',
      joining:  this.parseDate(
                  e.joinDate   ?? e.joining    ??
                  e.joinedDate ?? e.joiningDate
                ),
      role:     displayRole,
      dept:     e.dept       ?? '',
      salary:   e.salary     ?? 0,
      month:    e.month      ?? new Date().toISOString().slice(0, 7),
      username: e.username,
      password: e.password,
    };
  }

  private mapSalaryRecord(r: any, fallbackEmpId: number): SalaryRecord {
    return {
      id:          r.salaryId    ?? r.id     ?? 0,
      employeeId:  r.employeeId  ?? r.empId  ?? fallbackEmpId,
      salary:      r.amount      ?? r.salary ?? 0,
      paymentDate: this.parseDate(r.paymentDate ?? r.paidOn),
      paymentMode: r.paymentMode ?? '',
    };
  }

  private toApiPayload(emp: Partial<Employee>): any {
    const payload: any = {};
    if (emp.name    !== undefined) payload.empName  = emp.name;
    if (emp.phone   !== undefined) payload.phone    = emp.phone;
    if (emp.email   !== undefined) payload.email    = emp.email;
    if (emp.salary  !== undefined) payload.salary   = emp.salary;
    if (emp.role    !== undefined) {
      payload.role = this.ROLE_TO_API[emp.role] ?? emp.role.toUpperCase();
    }
    if (emp.joining !== undefined && emp.joining) {
      payload.joinDate = this.formatDateForApi(emp.joining);
    }
    return payload;
  }

  // ════════════════════════════════════════
  // USER REGISTRATION (Auth server)
  // Called only for Manager / Waiter
  //
  // Payload sent to POST /api/users/register-owner:
  //   {
  //     username: string,
  //     password: string,
  //     email:    string,
  //     role:     "MANAGER" | "WAITER"   ← exact API enum value
  //   }
  // ════════════════════════════════════════

  private registerUserCredentials(
    username: string,
    password: string,
    email:    string,
    role:     string   // display value e.g. "Manager" — converted to API enum below
  ): Observable<any> {

    // Convert display role → API enum: "Manager" → "MANAGER", "Waiter" → "WAITER"
    const apiRole = this.ROLE_TO_API[role] ?? role.toUpperCase();

    const payload = { username, password, email, role: apiRole };

    console.log('[AUTH 192.168.1.39:3000] REGISTER USER — payload:', payload);

    return this.http.post<any>(
      `${this.AUTH_BASE}/users/register-owner`,
      payload
    );
  }

  private rollbackUserRegistration(userId: number): void {
    console.warn('[AUTH 192.168.1.39:3000] ROLLBACK — deleting userId:', userId);
    this.http.delete(
      `${this.AUTH_BASE}/users/delete/${userId}`,
      { responseType: 'text' }
    ).subscribe({
      next:  () => console.log('[AUTH] Rollback success — user deleted'),
      error: (e) => console.error('[AUTH] Rollback failed:', e)
    });
  }

  // ════════════════════════════════════════
  // CRUD
  // ════════════════════════════════════════

  getAll(): Observable<Employee[]> {
    console.log('[EMP] GET ALL — adminId:', this.adminId);
    return this.http.get<any[]>(
      `${this.BASE}/user/${this.adminId}`
    ).pipe(
      map(list => list.map(e => this.mapEmployee(e))),
      tap(list => { this.cache = [...list]; })
    );
  }

  getById(id: number): Observable<Employee> {
    return this.http.get<any>(`${this.BASE}/${id}`).pipe(
      map(e => this.mapEmployee(e))
    );
  }

  // ════════════════════════════════════════
  // CREATE
  //
  // Manager / Waiter → 2 steps:
  //   Step 1: POST /api/users/register-owner
  //           { username, password, email, role: "MANAGER"|"WAITER" }
  //   Step 2: POST /employee/{adminId}
  //           { empName, phone, email, salary, role, joinDate }
  //   Step 2 fails → rollback Step 1
  //
  // Other roles → Step 2 only
  // ════════════════════════════════════════

  create(employee: Omit<Employee, 'id'>): Observable<Employee> {
    const needsCredentials = this.CREDENTIAL_ROLES.includes(employee.role);

    if (needsCredentials && employee.username && employee.password) {

      // ── STEP 1: Register on auth server ──
      return this.registerUserCredentials(
        employee.username,
        employee.password,
        employee.email,
        employee.role      // e.g. "Manager" or "Waiter" — converted inside method
      ).pipe(
        tap(userRes =>
          console.log('[AUTH] User registered — userId:',
            userRes?.user?.userId ?? userRes?.userId ?? 'unknown')
        ),

        // ── STEP 2: Insert employee record ──
        switchMap(userRes => {
          const body = this.toApiPayload(employee);
          console.log('[EMP] INSERT — adminId:', this.adminId, '— payload:', body);

          return this.http.post<any>(
            `${this.BASE}/${this.adminId}`,
            body
          ).pipe(
            map(e => this.mapEmployee(e)),
            tap(e => this.cache.push(e)),

            // Employee insert failed → rollback user on auth server
            catchError(empErr => {
              console.error('[EMP] Insert failed — rolling back auth user');
              const createdUserId =
                userRes?.user?.userId ?? userRes?.userId ?? null;
              if (createdUserId) {
                this.rollbackUserRegistration(createdUserId);
              }
              return throwError(() => empErr);
            })
          );
        })
      );

    } else {
      // ── Non-credential role: single step ──
      const body = this.toApiPayload(employee);
      console.log('[EMP] CREATE (no credentials) — adminId:',
        this.adminId, '— payload:', body);

      return this.http.post<any>(
        `${this.BASE}/${this.adminId}`,
        body
      ).pipe(
        map(e => this.mapEmployee(e)),
        tap(e => this.cache.push(e))
      );
    }
  }

  update(id: number, changes: Partial<Employee>): Observable<Employee> {
    const body = this.toApiPayload(changes);
    console.log('[EMP] UPDATE — id:', id, '— payload:', body);
    return this.http.put<any>(`${this.BASE}/${id}`, body).pipe(
      map(e => this.mapEmployee(e)),
      tap(updated => {
        const idx = this.cache.findIndex(e => e.id === id);
        if (idx > -1) this.cache[idx] = updated;
      })
    );
  }

  delete(id: number): Observable<string> {
    console.log('[EMP] DELETE — id:', id);
    return this.http.delete(
      `${this.BASE}/${id}`,
      { responseType: 'text' }
    ).pipe(
      tap(msg => console.log('[EMP] DELETE response:', msg))
    );
  }

  paySalary(
    employeeId:  number,
    amount:      number,
    paymentDate: string,
    paymentMode: string
  ): Observable<any> {
    const body = { amount, paymentDate, paymentMode };
    console.log('[SALARY] PAY — employeeId:', employeeId, '— payload:', body);
    return this.http.post<any>(
      `${this.SALARY_BASE}/${employeeId}`,
      body
    ).pipe(
      tap(r  => console.log('[SALARY] Success:', r)),
      map(r  => this.mapSalaryRecord(r, employeeId)),
      tap(r  => this.salaryCache.push(r))
    );
  }

  getAllSalaries(): Observable<SalaryRecord[]> {
    return this.http.get<any[]>(`${this.SALARY_BASE}`).pipe(
      map(list => list.map(r => this.mapSalaryRecord(r, 0))),
      tap(list => { this.salaryCache = [...list]; })
    );
  }

  // Add this method to EmployeesService

  getSalariesByEmployee(employeeId: number): Observable<SalaryRecord[]> {
    return this.http.get<any[]>(`${this.SALARY_BASE}/${employeeId}`).pipe(
      map(list => list.map(r => this.mapSalaryRecord(r, employeeId)))
    );
  }
}