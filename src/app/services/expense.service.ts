import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

// ── Matches ExpenseResponseDTO from Spring Boot ──
export interface Expense {
  expenseId:   number;
  expenseName: string;
  expenseType: string;
  amount:      number;
  expenseDate: string;   // "YYYY-MM-DD"
  description: string;
}

// ── Matches ExpenseRequestDTO from Spring Boot ──
export interface ExpensePayload {
  expenseName: string;
  expenseType: string;
  amount:      number;
  expenseDate: string;
  description: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {

  private readonly BASE = 'http://localhost:8080/api/expenses';

  constructor(private http: HttpClient) {}

  // GET all
  getAll(): Observable<Expense[]> {
    return this.http.get<ApiResponse<Expense[]>>(this.BASE)
      .pipe(map(r => r.data), catchError(this.handleError));
  }

  // POST create
  create(payload: ExpensePayload): Observable<Expense> {
    return this.http.post<ApiResponse<Expense>>(this.BASE, payload)
      .pipe(map(r => r.data), catchError(this.handleError));
  }

  // PUT update
  update(id: number, payload: ExpensePayload): Observable<Expense> {
    return this.http.put<ApiResponse<Expense>>(`${this.BASE}/${id}`, payload)
      .pipe(map(r => r.data), catchError(this.handleError));
  }

  // DELETE
  delete(id: number): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.BASE}/${id}`)
      .pipe(map(() => void 0), catchError(this.handleError));
  }

  // GET filter
  filter(type?: string, start?: string, end?: string): Observable<Expense[]> {
    let params = new HttpParams();
    if (type)  params = params.set('type',  type);
    if (start) params = params.set('start', start);
    if (end)   params = params.set('end',   end);
    return this.http.get<ApiResponse<Expense[]>>(`${this.BASE}/filter`, { params })
      .pipe(map(r => r.data), catchError(this.handleError));
  }

  // GET types
  getTypes(): Observable<string[]> {
    return this.http.get<ApiResponse<string[]>>(`${this.BASE}/types`)
      .pipe(map(r => r.data), catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const msg = error.error?.message || 'Something went wrong.';
    return throwError(() => ({ status: error.status, message: msg }));
  }
}