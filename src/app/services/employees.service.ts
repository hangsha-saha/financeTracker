import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface Employee {
  id:        number;
  name:      string;
  phone:     string;
  email:     string;
  joining:   string;   // stored internally as YYYY-MM-DD
  role:      string;   // display form e.g. "Head Chef"
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

  // ── Static admin ID — replace with AuthService later ──
  readonly ADMIN_ID: number = 2;

  private readonly BASE        = 'http://192.168.1.21:8080/employee';
  private readonly SALARY_BASE = 'http://192.168.1.21:8080/salary';

  private cache:       Employee[]     = [];
  private salaryCache: SalaryRecord[] = [];

  constructor(private http: HttpClient) {}

  // ════════════════════════════════════════
  // ROLE MAPS
  // API sends UPPER_SNAKE → display Title Case
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
    // plain uppercase fallbacks
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

  // Any API date format → YYYY-MM-DD (for input[type=date])
  private parseDate(raw: any): string {
    if (!raw) return '';

    // Array [YYYY, MM, DD] — Jackson default
    if (Array.isArray(raw) && raw.length >= 3) {
      const [y, m, d] = raw;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // Backend format dd-MM-yyyy e.g. "06-03-2026"
    if (typeof raw === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(raw)) {
      const [dd, mm, yyyy] = raw.split('-');
      return `${yyyy}-${mm}-${dd}`;
    }

    // Already YYYY-MM-DD
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    // ISO with time e.g. "2026-01-01T00:00:00"
    if (typeof raw === 'string' && raw.includes('T')) {
      return raw.split('T')[0];
    }

    // Epoch number
    if (typeof raw === 'number') {
      return new Date(raw).toISOString().split('T')[0];
    }

    return '';
  }

  // YYYY-MM-DD → dd-MM-yyyy (what backend expects)
  private formatDateForApi(yyyymmdd: string): string {
    if (!yyyymmdd) return '';
    const [yyyy, mm, dd] = yyyymmdd.split('-');
    return `${dd}-${mm}-${yyyy}`;
  }

  // ════════════════════════════════════════
  // MAP HELPERS
  // ════════════════════════════════════════

  private mapEmployee(e: any): Employee {
    console.log('API employee raw:', e);  // remove after confirming field names

    const rawRole     = e.role ?? '';
    const displayRole = this.ROLE_FROM_API[rawRole]
      ?? rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase();

    return {
      id:       e.empId      ?? e.id          ?? 0,
      name:     e.empName    ?? e.name        ?? '',
      phone:    e.phone      ?? '',
      email:    e.email      ?? '',
      joining:  this.parseDate(
                  e.joinDate   ??
                  e.joining    ??
                  e.joinedDate ??
                  e.joiningDate
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
      id:          r.salaryId   ?? r.id          ?? 0,
      employeeId:  r.employeeId ?? r.empId       ?? fallbackEmpId,
      salary:      r.amount     ?? r.salary      ?? 0,
      paymentDate: this.parseDate(r.paymentDate  ?? r.paidOn),
      paymentMode: r.paymentMode ?? '',
    };
  }

  // Builds POST / PUT body — converts dates and roles to API format
  private toApiPayload(emp: Partial<Employee>): any {
    const payload: any = {};

    if (emp.name    !== undefined) payload.empName  = emp.name;
    if (emp.phone   !== undefined) payload.phone    = emp.phone;
    if (emp.email   !== undefined) payload.email    = emp.email;
    if (emp.salary  !== undefined) payload.salary   = emp.salary;

    // role: display → UPPER_SNAKE
    if (emp.role !== undefined) {
      payload.role = this.ROLE_TO_API[emp.role] ?? emp.role.toUpperCase();
    }

    // date: YYYY-MM-DD → dd-MM-yyyy
    if (emp.joining !== undefined && emp.joining) {
      payload.joinDate = this.formatDateForApi(emp.joining);
    }

    return payload;
  }

  // ════════════════════════════════════════
  // GET ALL — GET /employee/user/{adminId}
  // ════════════════════════════════════════

  getAll(): Observable<Employee[]> {
    return this.http.get<any[]>(
      `${this.BASE}/user/${this.ADMIN_ID}`
    ).pipe(
      map(list => list.map(e => this.mapEmployee(e))),
      tap(list => { this.cache = [...list]; })
    );
  }

  // ── TODO: JSON fallback — uncomment if API is down ──
  // getAll(): Observable<Employee[]> {
  //   return this.http.get<any[]>('assets/data/employees.json').pipe(
  //     map(entries => {
  //       const found = entries.find((e: any) => e.userId === this.ADMIN_ID);
  //       const list  = found ? found.employees : [];
  //       this.cache = [...list];
  //       return list;
  //     })
  //   );
  // }

  // ════════════════════════════════════════
  // GET SINGLE — GET /employee/{id}
  // ════════════════════════════════════════

  getById(id: number): Observable<Employee> {
    return this.http.get<any>(`${this.BASE}/${id}`).pipe(
      map(e => this.mapEmployee(e))
    );
  }

  // ════════════════════════════════════════
  // CREATE — POST /employee/{adminId}
  // body: { empName, role, salary, joinDate(dd-MM-yyyy), phone, email }
  // ════════════════════════════════════════

  create(employee: Omit<Employee, 'id'>): Observable<Employee> {
    const body = this.toApiPayload(employee);
    console.log('CREATE payload:', body);   // remove after confirming
    return this.http.post<any>(
      `${this.BASE}/${this.ADMIN_ID}`,
      body
    ).pipe(
      map(e => this.mapEmployee(e)),
      tap(e => this.cache.push(e))
    );
  }

  // ── TODO: in-memory fallback ──
  // create(employee: Omit<Employee, 'id'>): Observable<Employee> {
  //   const newEmp: Employee = { id: Date.now(), ...employee };
  //   this.cache.push(newEmp);
  //   return of(newEmp);
  // }

  // ════════════════════════════════════════
  // UPDATE — PUT /employee/{id}
  // body: same shape as create
  // ════════════════════════════════════════

  update(id: number, changes: Partial<Employee>): Observable<Employee> {
    const body = this.toApiPayload(changes);
    console.log('UPDATE payload:', body);   // remove after confirming
    return this.http.put<any>(
      `${this.BASE}/${id}`,
      body
    ).pipe(
      map(e => this.mapEmployee(e)),
      tap(updated => {
        const idx = this.cache.findIndex(e => e.id === id);
        if (idx > -1) this.cache[idx] = updated;
      })
    );
  }

  // ── TODO: in-memory fallback ──
  // update(id: number, changes: Partial<Employee>): Observable<Employee> {
  //   const idx = this.cache.findIndex(e => e.id === id);
  //   if (idx > -1) {
  //     this.cache[idx] = { ...this.cache[idx], ...changes };
  //     return of(this.cache[idx]);
  //   }
  //   throw new Error(`Employee ${id} not found`);
  // }

  // ════════════════════════════════════════
  // DELETE — DELETE /employee/{id}
  // ════════════════════════════════════════

  delete(id: number): Observable<string> {
    console.log('DELETE id:', id);
    return this.http.delete(
      `${this.BASE}/${id}`,
      { responseType: 'text' }   // ← backend returns plain string
    ).pipe(
      tap(msg => console.log('DELETE response:', msg)),
      map(msg => msg)
    );
  }

  // ── TODO: in-memory fallback ──
  // delete(id: number): Observable<void> {
  //   this.cache = this.cache.filter(e => e.id !== id);
  //   return of(void 0);
  // }

  // ════════════════════════════════════════
  // PAY SALARY — POST /salary/{employeeId}
  // body: { amount, paymentDate(dd-MM-yyyy), paymentMode }
  // ════════════════════════════════════════

  paySalary(
    employeeId:  number,
    amount:      number,
    paymentDate: string,   // comes in as YYYY-MM-DD from date input
    paymentMode: string
  ): Observable<any> {
    const body = {
      amount:      amount,
      paymentDate: paymentDate,   // ← send as-is: YYYY-MM-DD (salary backend expects this)
      paymentMode: paymentMode,
    };

    console.log('PAY SALARY payload being sent:', JSON.stringify(body));

    return this.http.post<any>(
      `${this.SALARY_BASE}/${employeeId}`,
      body
    ).pipe(
      tap(r  => console.log('PAY SALARY success response:', r)),
      map(r  => this.mapSalaryRecord(r, employeeId)),
      tap(r  => this.salaryCache.push(r))
    );
  }

  // ── TODO: in-memory fallback ──
  // paySalary(employeeId: number, amount: number, paymentDate: string, paymentMode: string): Observable<SalaryRecord> {
  //   const record: SalaryRecord = {
  //     id: Date.now(),
  //     employeeId,
  //     salary: amount,
  //     paymentDate,
  //     paymentMode
  //   };
  //   this.salaryCache.push(record);
  //   return of(record);
  // }

  // ════════════════════════════════════════
  // GET ALL SALARIES — GET /salary
  // ════════════════════════════════════════

  getAllSalaries(): Observable<SalaryRecord[]> {
    return this.http.get<any[]>(`${this.SALARY_BASE}`).pipe(
      map(list => list.map(r => this.mapSalaryRecord(r, 0))),
      tap(list => { this.salaryCache = [...list]; })
    );
  }

  // ── TODO: in-memory fallback ──
  // getAllSalaries(): Observable<SalaryRecord[]> {
  //   return of([...this.salaryCache]);
  // }
}