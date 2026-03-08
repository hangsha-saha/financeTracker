import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface ExpenseBreakdown {
  category: string;
  amount:   number;
}

export interface AnalyticsResponse {
  totalIncome:      number;
  totalExpense:     number;
  netProfit:        number;
  expenseBreakdown: ExpenseBreakdown[];
  todayIncome:      number;
  todayExpense:     number;
  monthlyIncome:    number;
  monthlyExpense:   number;
  monthlyNetProfit: number;
  yearlyIncome:     number;
  yearlyExpense:    number;
}

export interface ChartDataPoint {
  label:   string;
  income:  number;
  expense: number;
}

export interface ChartApiResponse {
  period:   string;
  category: string;
  data:     ChartDataPoint[];
}

export type ChartPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'QUARTERLY' | 'FINANCIAL_YEAR' | 'PREVIOUS_YEAR';

@Injectable({ providedIn: 'root' })
export class ReportsService {

  private readonly BASE = 'http://192.168.1.39:3000';

  constructor(
    private http:        HttpClient,
    private authService: AuthService
  ) {}

  // ════════════════════════════════════════
  // RESOLVE WHICH ID TO USE FOR API CALLS
  //
  // OWNER / ADMIN  → use their own userId
  // MANAGER/WAITER → use adminId stored in ft_user if present,
  //                  otherwise fall back to their own userId
  // ════════════════════════════════════════

  getApiUserId(): number {
    const currentUser = this.authService.getCurrentUser();
    const adminId     = (currentUser as any)?.adminId ?? 0;
    const userId      = this.authService.getCurrentUserId();

    if (adminId && adminId !== 0) {
      console.log('[ReportsService] Using adminId for API calls:', adminId);
      return adminId;
    }

    console.log('[ReportsService] Using userId for API calls:', userId);
    return userId;
  }

  // ════════════════════════════════════════
  // API 1 — summary scalars for metric cards + donut
  // Automatically resolves the correct userId/adminId
  // ════════════════════════════════════════

  getAnalytics(startDate: string, endDate: string): Observable<AnalyticsResponse>;
  getAnalytics(userId: number, startDate: string, endDate: string): Observable<AnalyticsResponse>;
  getAnalytics(
    userIdOrStart: number | string,
    startOrEnd:    string,
    endDate?:      string
  ): Observable<AnalyticsResponse> {
    let resolvedId: number;
    let start:      string;
    let end:        string;

    if (typeof userIdOrStart === 'number') {
      // Called with explicit userId (legacy callers)
      resolvedId = userIdOrStart;
      start      = startOrEnd;
      end        = endDate!;
    } else {
      // Called without userId — resolve automatically
      resolvedId = this.getApiUserId();
      start      = userIdOrStart;
      end        = startOrEnd;
    }

    return this.http.get<AnalyticsResponse>(
      `${this.BASE}/analytics/user/${resolvedId}?startDate=${start}&endDate=${end}`
    );
  }

  // ════════════════════════════════════════
  // API 2 — chart data points for bar / area charts
  // Automatically resolves the correct ownerId/adminId
  // ════════════════════════════════════════

  getChartData(period: ChartPeriod, category?: string): Observable<ChartApiResponse>;
  getChartData(ownerId: number, period: ChartPeriod, category?: string): Observable<ChartApiResponse>;
  getChartData(
    ownerIdOrPeriod: number | ChartPeriod,
    periodOrCategory?: ChartPeriod | string,
    category = 'ALL'
  ): Observable<ChartApiResponse> {
    let resolvedId: number;
    let period:     ChartPeriod;
    let cat:        string;

    if (typeof ownerIdOrPeriod === 'number') {
      // Called with explicit ownerId (legacy callers)
      resolvedId = ownerIdOrPeriod;
      period     = periodOrCategory as ChartPeriod;
      cat        = category;
    } else {
      // Called without ownerId — resolve automatically
      resolvedId = this.getApiUserId();
      period     = ownerIdOrPeriod as ChartPeriod;
      cat        = (periodOrCategory as string) ?? 'ALL';
    }

    return this.http.get<ChartApiResponse>(
      `${this.BASE}/analytics/income-expense?ownerId=${resolvedId}&period=${period}&category=${cat}`
    );
  }

  // ════════════════════════════════════════
  // DATE UTILITIES
  // ════════════════════════════════════════

  /** Convert YYYY-MM-DD (HTML date input) → DD-MM-YYYY (API 1) */
  static toApiDate(htmlDate: string): string {
    if (!htmlDate) return '';
    const [y, m, d] = htmlDate.split('-');
    return `${d}-${m}-${y}`;
  }

  /** Convert DD-MM-YYYY (API) → YYYY-MM-DD (HTML input) */
  static toHtmlDate(apiDate: string): string {
    if (!apiDate) return '';
    const [d, m, y] = apiDate.split('-');
    return `${y}-${m}-${d}`;
  }
}