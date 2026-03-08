import { Injectable } from '@angular/core';
import {
  HttpRequest, HttpHandler, HttpEvent,
  HttpInterceptor, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  // ── URLs that should NOT trigger auto-logout on 401 ──
  private readonly AUTH_URLS = [
    '/auth/v1/sign-in',
    '/users/register-owner',
    '/users/login',
  ];

  constructor(
    private authService: AuthService,
    private router:      Router
  ) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    const token = this.authService.getToken();

    // Attach Bearer token if available
    const authReq = token
      ? req.clone({
          setHeaders: { Authorization: `Bearer ${token}` }
        })
      : req;

    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {

        // ── Skip auto-logout for auth endpoints ──
        // Login returning 401 = wrong password, NOT expired session
        const isAuthUrl = this.AUTH_URLS.some(url => req.url.includes(url));

        if (err.status === 401 && !isAuthUrl) {
          // Token expired or invalid session — force logout
          console.warn('AuthInterceptor: 401 on protected route — logging out');
          this.authService.logout();
          this.router.navigate(['/login']);
        }

        // Always pass the error through so components can handle it
        return throwError(() => err);
      })
    );
  }
}