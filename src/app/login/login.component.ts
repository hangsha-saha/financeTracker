import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

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
    // Pre-fill remembered username
    const remembered = this.authService.getRememberedUsername();
    if (remembered) {
      this.username   = remembered;
      this.rememberMe = true;
    }

    // Capture returnUrl from query params (set by AuthGuard)
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';

    // Already logged in → go straight to dashboard
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

    this.authService.login(this.username.trim(), this.password, this.rememberMe)
      .subscribe({
        next: res => {
          console.log('Login success:', res.user.userName);
          this.isLoading   = false;
          this.showSuccess = true;

          setTimeout(() => {
            this.router.navigate([this.returnUrl]);
          }, 1500);
        },
        error: err => {
          console.error('Login failed:', err.status, err.error);
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

  onRegisterClick(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/register']);
  }
}