import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {

  // ── Form fields ──
  username:  string  = '';
  email:     string  = '';
  password:  string  = '';
  agreement: boolean = false;

  // ── UI state ──
  isLoading:    boolean = false;
  showPassword: boolean = false;
  showSuccess:  boolean = false;

  // ── Validation errors ──
  errUsername:   string = '';
  errEmail:      string = '';
  errPassword:   string = '';
  errAgreement:  string = '';
  registerError: string = '';

  // ── Password strength ──
  strengthWidth: string  = '0%';
  strengthColor: string  = '';
  strengthLabel: string  = '';
  showStrength:  boolean = false;

  private readonly API_URL = 'http://192.168.1.39:3000/api/users/register-owner';

  constructor(
    private http:   HttpClient,
    private router: Router
  ) {}

  // ════════════════════════════════════════
  // TOGGLE PASSWORD
  // ════════════════════════════════════════

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // ════════════════════════════════════════
  // PASSWORD STRENGTH
  // ════════════════════════════════════════

  onPasswordInput(): void {
    const v = this.password;
    if (!v) { this.showStrength = false; return; }

    this.showStrength = true;
    let strength = 0;

    if (v.length >= 8)        strength++;
    if (v.length >= 12)       strength++;
    if (/[a-z]/.test(v))      strength++;
    if (/[A-Z]/.test(v))      strength++;
    if (/\d/.test(v))         strength++;
    if (/[!@#$%^&*]/.test(v)) strength++;

    if (strength <= 2) {
      this.strengthWidth = '33%';
      this.strengthColor = 'var(--danger)';
      this.strengthLabel = 'Password strength: Weak';
    } else if (strength <= 4) {
      this.strengthWidth = '66%';
      this.strengthColor = 'var(--warning)';
      this.strengthLabel = 'Password strength: Fair';
    } else {
      this.strengthWidth = '100%';
      this.strengthColor = 'var(--success)';
      this.strengthLabel = 'Password strength: Strong';
    }

    if (this.errPassword) this.errPassword = '';
  }

  // ════════════════════════════════════════
  // BLUR VALIDATORS
  // ════════════════════════════════════════

  onUsernameBlur(): void {
    if (!this.username.trim()) return;
    if (this.username.length < 3) {
      this.errUsername = 'Username must be at least 3 characters.';
    } else if (!/^[a-zA-Z0-9_]+$/.test(this.username)) {
      this.errUsername = 'Only letters, numbers, and underscores allowed.';
    } else {
      this.errUsername = '';
    }
  }

  onEmailBlur(): void {
    if (!this.email.trim()) return;
    if (!this.validEmail(this.email)) {
      this.errEmail = 'Please enter a valid email address.';
    } else {
      this.errEmail = '';
    }
  }

  // ════════════════════════════════════════
  // VALIDATE
  // ════════════════════════════════════════

  private validate(): boolean {
    this.errUsername   = '';
    this.errEmail      = '';
    this.errPassword   = '';
    this.errAgreement  = '';
    this.registerError = '';
    let ok = true;

    if (!this.username.trim()) {
      this.errUsername = 'Username is required.';
      ok = false;
    } else if (this.username.length < 3) {
      this.errUsername = 'Username must be at least 3 characters.';
      ok = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(this.username)) {
      this.errUsername = 'Only letters, numbers, and underscores allowed.';
      ok = false;
    }

    if (!this.email.trim()) {
      this.errEmail = 'Email is required.';
      ok = false;
    } else if (!this.validEmail(this.email)) {
      this.errEmail = 'Please enter a valid email address.';
      ok = false;
    }

    if (!this.password) {
      this.errPassword = 'Password is required.';
      ok = false;
    } else if (this.password.length < 8) {
      this.errPassword = 'Password must be at least 8 characters.';
      ok = false;
    }

    if (!this.agreement) {
      this.errAgreement = 'You must accept the Terms of Service and Privacy Policy.';
      ok = false;
    }

    return ok;
  }

  // ════════════════════════════════════════
  // REGISTER — POST /api/users/register-owner
  // ════════════════════════════════════════

  register(): void {
    if (!this.validate()) return;

    this.isLoading     = true;
    this.registerError = '';

    const body = {
      username: this.username.trim(),
      password: this.password,
      email:    this.email.trim()
    };

    console.log('Register payload:', { username: body.username, email: body.email });

    this.http.post<any>(this.API_URL, body).subscribe({
      next: (res) => {
        console.log('Register success response:', res);

        // Store token and user in localStorage
        if (res.token) {
          localStorage.setItem('ft_token', res.token);
        }
        if (res.user) {
          localStorage.setItem('ft_user', JSON.stringify(res.user));
        }

        this.isLoading   = false;
        this.showSuccess = true;

        // Redirect to dashboard after 1.5s
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1500);
      },

      error: (err) => {
        console.error('Register failed — status :', err.status);
        console.error('Register failed — message:', err.error?.message);
        console.error('Register failed — full   :', err);

        this.isLoading = false;

        if (err.status === 0) {
          this.registerError =
            'Cannot reach server. Make sure you are on the same network.';
        } else if (err.status === 409) {
          this.registerError =
            'Username or email already exists. Please try another.';
        } else if (err.status === 400) {
          this.registerError =
            err.error?.message || 'Invalid details. Please check and try again.';
        } else if (err.status === 500) {
          this.registerError =
            'Server error. Please try again later.';
        } else {
          this.registerError =
            err.error?.message || 'Registration failed. Please try again.';
        }
      }
    });
  }

  // ════════════════════════════════════════
  // HELPER
  // ════════════════════════════════════════

  private validEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}