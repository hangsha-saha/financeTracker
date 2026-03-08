import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface AuthUser {
  userId:    number;
  userName:  string;
  email:     string;
  role:      string | null;
  createdAt: string | null;
  password?: string;
  adminId?:  number;   // ← add this
}
export interface LoginResponse {
  token:    string;
  message:  string;
  user:     AuthUser;
  adminId?: number;   // ← present for MANAGER / WAITER, null for OWNER
}

export interface RegisterPayload {
  username: string;
  password: string;
  email:    string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly BASE               = 'http://192.168.1.39:3000/api';
  private readonly TOKEN_KEY          = 'ft_token';
  private readonly USER_KEY           = 'ft_user';
  private readonly REMEMBER_KEY       = 'ft_remember';
  private readonly EMPLOYEE_ADMIN_KEY = 'ft_employee_admin_id';
  private readonly RESOLVED_ROLE_KEY  = 'ft_resolved_role';

  constructor(private http: HttpClient) {}

  // ════════════════════════════════════════
  // REGISTER
  // ════════════════════════════════════════

  registerOwner(payload: RegisterPayload): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.BASE}/users/register-owner`,
      payload
    ).pipe(
      tap(res => this.persistSession(res.token, res.user))
    );
  }

  // ════════════════════════════════════════
  // LOGIN
  // ════════════════════════════════════════

  login(username: string, password: string, rememberMe: boolean): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.BASE}/auth/v1/sign-in`,
      { username, password }
    ).pipe(
      tap(res => {
        this.persistSession(res.token, res.user);
        if (rememberMe) {
          localStorage.setItem(this.REMEMBER_KEY, username);
        } else {
          localStorage.removeItem(this.REMEMBER_KEY);
        }
      })
    );
  }

  // ════════════════════════════════════════
  // GET USER BY ID
  // ════════════════════════════════════════

  getUserById(userId: number): Observable<AuthUser> {
    return this.http.get<AuthUser>(
      `${this.BASE}/users/get/${userId}`
    );
  }

  // ════════════════════════════════════════
  // UPDATE USER
  // ════════════════════════════════════════

  updateUser(
    userId:  number,
    changes: Partial<Pick<AuthUser, 'userName' | 'email'>>
  ): Observable<AuthUser> {
    return this.http.put<AuthUser>(
      `${this.BASE}/users/update/${userId}`,
      changes
    ).pipe(
      tap(updated => {
        const current = this.getCurrentUser();
        if (current && current.userId === userId) {
          this.persistSession(this.getToken()!, updated);
        }
      })
    );
  }

  // ════════════════════════════════════════
  // DELETE USER
  // ════════════════════════════════════════

  deleteUser(userId: number): Observable<string> {
    return this.http.delete(
      `${this.BASE}/users/delete/${userId}`,
      { responseType: 'text' }
    );
  }

  // ════════════════════════════════════════
  // LOGOUT
  // ════════════════════════════════════════

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.REMEMBER_KEY);
    localStorage.removeItem(this.EMPLOYEE_ADMIN_KEY);
    localStorage.removeItem(this.RESOLVED_ROLE_KEY);
    localStorage.removeItem('ftProfile');
  }

  // ════════════════════════════════════════
  // SESSION HELPERS
  // ════════════════════════════════════════

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): AuthUser | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.userName && (parsed.username || parsed.name)) {
        parsed.userName = parsed.username ?? parsed.name;
      }
      if (!parsed.userId && (parsed.id || parsed.user_id)) {
        parsed.userId = parsed.id ?? parsed.user_id;
      }
      return parsed as AuthUser;
    } catch {
      return null;
    }
  }

  getCurrentUserId(): number {
    const user = this.getCurrentUser();
    if (!user || !user.userId) {
      console.warn('[AuthService] getCurrentUserId → no valid user in storage');
      return 0;
    }
    return user.userId;
  }

  getCurrentUsername(): string {
    return this.getCurrentUser()?.userName ?? '';
  }

  getCurrentEmail(): string {
    return this.getCurrentUser()?.email ?? '';
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getRememberedUsername(): string {
    return localStorage.getItem(this.REMEMBER_KEY) ?? '';
  }

  updateStoredUser(updated: Partial<AuthUser>): void {
    const token   = this.getToken();
    const current = this.getCurrentUser();

    if (token) {
      if ((updated as AuthUser).userId) {
        this.persistSession(token, updated as AuthUser);
      } else if (current) {
        this.persistSession(token, { ...current, ...updated });
      }
    } else if (current) {
      const merged = (updated as AuthUser).userId
        ? (updated as AuthUser)
        : { ...current, ...updated };
      localStorage.setItem(this.USER_KEY, JSON.stringify(merged));
    }
  }

  // ════════════════════════════════════════
  // EMPLOYEE ADMIN ID
  // ft_employee_admin_id — set at login from res.adminId
  // for MANAGER / WAITER only. Cleared for OWNER.
  // ════════════════════════════════════════

  setEmployeeAdminId(id: number): void {
    localStorage.setItem(this.EMPLOYEE_ADMIN_KEY, String(id));
  }

  clearEmployeeAdminId(): void {
    localStorage.removeItem(this.EMPLOYEE_ADMIN_KEY);
  }

  getEmployeeAdminId(): number {
    const stored = localStorage.getItem(this.EMPLOYEE_ADMIN_KEY);
    if (stored && !isNaN(Number(stored))) return Number(stored);
    console.warn('[AuthService] getEmployeeAdminId → falling back to userId');
    return this.getCurrentUserId();
  }

  // ════════════════════════════════════════
  // GET OWNER ID
  //
  // Use this in ALL services/components that
  // fetch data belonging to the restaurant owner.
  //
  // OWNER / ADMIN → returns their own userId
  // MANAGER / WAITER → returns adminId (ft_employee_admin_id)
  //   stored at login from res.adminId
  // ════════════════════════════════════════

  getOwnerId(): number {
    const role = (this.getResolvedRole() ?? '').toLowerCase();

    if (role === 'admin' || role === 'owner') {
      return this.getCurrentUserId();
    }

    // manager / waiter → use owner's adminId
    const adminId = this.getEmployeeAdminId();
    console.log('[AuthService] getOwnerId → role:', role, '→ adminId:', adminId);
    return adminId;
  }

  // ════════════════════════════════════════
  // RESOLVED ROLE
  // ft_resolved_role — set at login
  // 'admin' for OWNER, 'manager' / 'waiter' for employees
  // ════════════════════════════════════════

  setResolvedRole(role: string): void {
    localStorage.setItem(this.RESOLVED_ROLE_KEY, role.toLowerCase());
  }

  getResolvedRole(): string {
    return localStorage.getItem(this.RESOLVED_ROLE_KEY) ?? 'admin';
  }

  // ════════════════════════════════════════
  // PRIVATE
  // ════════════════════════════════════════

  private persistSession(token: string, user: AuthUser): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY,  JSON.stringify(user));
  }
}