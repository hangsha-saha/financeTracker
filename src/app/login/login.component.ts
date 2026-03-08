import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, AuthUser } from '../services/auth.service';

@Component({
  selector:    'app-login',
  templateUrl: './login.component.html',
  styleUrls:   ['./login.component.css']
})
export class LoginComponent implements OnInit {

  username:        string  = '';
  password:        string  = '';
  rememberMe:      boolean = false;
  passwordVisible: boolean = false;
  isLoading:       boolean = false;
  showSuccess:     boolean = false;

  usernameError: string = '';
  passwordError: string = '';
  loginError:    string = '';

  private returnUrl: string = '/dashboard';

  constructor(
    private authService: AuthService,
    private router:      Router,
    private route:       ActivatedRoute
  ) {}

  ngOnInit(): void {
    const remembered = this.authService.getRememberedUsername();
    if (remembered) {
      this.username   = remembered;
      this.rememberMe = true;
    }

    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';

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
    if (!this.username.trim()) { this.usernameError = 'Please enter your username.'; valid = false; }
    if (!this.password)        { this.passwordError = 'Please enter your password.'; valid = false; }
    if (!valid) return;

    this.isLoading = true;

    this.authService.login(this.username.trim(), this.password, this.rememberMe)
      .subscribe({
        next: res => {
          console.log('[Login] Raw response:', res);
          console.log('[Login] res.user:', res.user);

          // ── Normalise the user object ──
          // Different backends return different field names.
          // We normalise to AuthUser before storing.
          const raw: any   = res.user || res;
          const normalised: AuthUser = {
            userId:    raw.userId    ?? raw.id         ?? raw.user_id ?? 0,
            userName:  raw.userName  ?? raw.username   ?? raw.name   ?? this.username,
            email:     raw.email     ?? raw.emailId    ?? raw.emailAddress ?? '',
            role:      raw.role      ?? raw.userRole   ?? null,
            createdAt: raw.createdAt ?? raw.created_at ?? null,
          };

          console.log('[Login] Normalised user to store:', normalised);

          // Persist the normalised user so sidebar can read it reliably
          this.authService.updateStoredUser(normalised);

          // ── Resolve role ──
          const rawRole = normalised.role ?? 'ADMIN';
          this.authService.setResolvedRole(rawRole);

          // ── Route by role ──
          const r = rawRole.toLowerCase();
          this.returnUrl = r.includes('waiter') ? '/view-bills' : '/dashboard';

          this.navigateAfterLogin();
        },
        error: err => {
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
        }
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