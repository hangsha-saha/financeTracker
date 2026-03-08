import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, AuthUser } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  username: string = '';
  password: string = '';
  rememberMe: boolean = false;
  passwordVisible: boolean = false;
  isLoading: boolean = false;
  showSuccess: boolean = false;

  usernameError: string = '';
  passwordError: string = '';
  loginError: string = '';

  private returnUrl: string = '/dashboard';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const remembered = this.authService.getRememberedUsername();
    if (remembered) {
      this.username   = remembered;
      this.rememberMe = true;
    }

    this.returnUrl =
      this.route.snapshot.queryParams['returnUrl'] || '/dashboard';

    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.returnUrl]);
    }
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  clearFieldError(field: 'username' | 'password'): void {
    if (field === 'username') this.usernameError = '';
    if (field === 'password') this.passwordError = '';
    this.loginError = '';
  }

  handleLogin(): void {
    this.usernameError = '';
    this.passwordError = '';
    this.loginError    = '';

    let valid = true;
    if (!this.username.trim()) {
      this.usernameError = 'Please enter your username.';
      valid = false;
    }
    if (!this.password) {
      this.passwordError = 'Please enter your password.';
      valid = false;
    }
    if (!valid) return;

    this.isLoading = true;

    this.authService
      .login(this.username.trim(), this.password, this.rememberMe)
      .subscribe({
        next: (res: any) => {
          console.log('[Login] Raw response:', res);

          // ── Normalise user object ──
          const raw: any = res.user || res;

          // ── Grab adminId from response root level FIRST ──
          // Response shape: { token, message, user: {...}, adminId: 30 }
          // adminId is present for MANAGER / WAITER — null/missing for OWNER
          const adminId = res.adminId ?? res.admin_id ?? null;

          // ── Build normalised user WITH adminId included from the start ──
          const normalised: AuthUser = {
            userId:    raw.userId    ?? raw.id         ?? raw.user_id ?? 0,
            userName:  raw.userName  ?? raw.username   ?? raw.name   ?? this.username,
            email:     raw.email     ?? raw.emailId    ?? raw.emailAddress ?? '',
            role:      raw.role      ?? raw.userRole   ?? null,
            createdAt: raw.createdAt ?? raw.created_at ?? null,
            // ← embed adminId directly into the user object if present
            ...(adminId && adminId !== (raw.userId ?? raw.id ?? 0)
              ? { adminId }
              : {}),
          };

          console.log('[Login] Normalised user (with adminId):', normalised);

          // ── Persist to ft_user in one single call ──
          this.authService.updateStoredUser(normalised);

          // ── Also store adminId in ft_employee_admin_id (separate key) ──
          if (adminId && adminId !== normalised.userId) {
            console.log('[Login] Storing adminId in ft_employee_admin_id:', adminId);
            this.authService.setEmployeeAdminId(adminId);
          } else {
            // OWNER — clear any stale adminId from previous session
            this.authService.clearEmployeeAdminId();
          }

          // ── Role resolution ──
          const rawRole   = (normalised.role ?? '').toUpperCase();
          const isWaiter  = rawRole === 'WAITER';
          const isManager = rawRole === 'MANAGER';

          if (isWaiter || isManager) {
            this.authService.setResolvedRole(rawRole.toLowerCase());
          } else {
            this.authService.setResolvedRole('admin');
          }

          // ── Route ──
          this.returnUrl = isWaiter ? '/view-bills' : '/dashboard';

          this.navigateAfterLogin();
        },
        error: (err) => {
          console.error('[Login] Failed:', err.status, err.error);
          this.isLoading = false;

          if (err.status === 401 || err.status === 403) {
            this.loginError    = 'Invalid username or password. Please try again.';
            this.usernameError = ' ';
            this.passwordError = ' ';
          } else if (err.status === 0) {
            this.loginError = 'Cannot reach server. Please check your connection.';
          } else {
            this.loginError = err.error?.message || 'Login failed. Please try again.';
          }
        },
      });
  }

  private navigateAfterLogin(): void {
    this.isLoading   = false;
    this.showSuccess = true;
    setTimeout(() => {
      this.router.navigate([this.returnUrl]);
    }, 1500);
  }

  onRegisterClick(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/register']);
  }
}