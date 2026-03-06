import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface AuthUser {
  userId:    number;
  userName:  string;
  email:     string;
  role:      string | null;
  createdAt: string;
}

export interface LoginResponse {
  token:   string;
  message: string;
  user:    AuthUser;
}

export interface RegisterPayload {
  username: string;
  password: string;
  email:    string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly BASE = 'http://192.168.1.39:3000/api';

  private readonly TOKEN_KEY  = 'ft_token';
  private readonly USER_KEY   = 'ft_user';
  private readonly REMEMBER_KEY = 'ft_remember';

  constructor(private http: HttpClient) {}

  // ════════════════════════════════════════
  // REGISTER OWNER — POST /api/users/register-owner
  // Returns token + user, auto logs in
  // ════════════════════════════════════════

  registerOwner(payload: RegisterPayload): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.BASE}/register-owner`,
      payload
    ).pipe(
      tap(res => this.persistSession(res.token, res.user))
    );
  }

  // ── TODO: in-memory fallback ──
  // registerOwner(payload: RegisterPayload): Observable<LoginResponse> {
  //   const fakeRes: LoginResponse = {
  //     token: 'fake-token',
  //     message: 'Registration successful',
  //     user: { userId: 1, userName: payload.username, email: payload.email, role: null, createdAt: new Date().toISOString() }
  //   };
  //   this.persistSession(fakeRes.token, fakeRes.user);
  //   return of(fakeRes);
  // }

  // ════════════════════════════════════════
  // LOGIN — POST /api/users/register-owner
  // (uses same endpoint since it returns a token)
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

  // ── TODO: hardcoded fallback — remove when API is ready ──
  // login(username: string, password: string, rememberMe: boolean): Observable<LoginResponse> {
  //   if (username === 'admin' && password === 'admin') {
  //     const fakeRes: LoginResponse = {
  //       token: 'fake-token-admin',
  //       message: 'Login successful',
  //       user: { userId: 1, userName: 'admin', email: 'admin@demo.com', role: null, createdAt: new Date().toISOString() }
  //     };
  //     this.persistSession(fakeRes.token, fakeRes.user);
  //     if (rememberMe) localStorage.setItem(this.REMEMBER_KEY, username);
  //     return of(fakeRes);
  //   }
  //   return throwError(() => ({ error: { message: 'Invalid username or password.' } }));
  // }

  // ════════════════════════════════════════
  // GET USER BY ID — GET /api/users/get/{userId}
  // ════════════════════════════════════════

  getUserById(userId: number): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.BASE}/get/${userId}`);
  }

  // ════════════════════════════════════════
  // UPDATE USER — PUT /api/users/update/{userId}
  // ════════════════════════════════════════

  updateUser(userId: number, changes: Partial<Pick<AuthUser, 'userName' | 'email'>>): Observable<AuthUser> {
    return this.http.put<AuthUser>(
      `${this.BASE}/update/${userId}`,
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
  // DELETE USER — DELETE /api/users/delete/{userId}
  // Returns plain text string
  // ════════════════════════════════════════

  deleteUser(userId: number): Observable<string> {
    return this.http.delete(
      `${this.BASE}/delete/${userId}`,
      { responseType: 'text' }
    );
  }

  // ════════════════════════════════════════
  // LOGOUT
  // ════════════════════════════════════════

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  // ════════════════════════════════════════
  // HELPERS — token / user from localStorage
  // ════════════════════════════════════════

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): AuthUser | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  getCurrentUserId(): number {
    return this.getCurrentUser()?.userId ?? 1;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getRememberedUsername(): string {
    return localStorage.getItem(this.REMEMBER_KEY) ?? '';
  }

  private persistSession(token: string, user: AuthUser): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }
}