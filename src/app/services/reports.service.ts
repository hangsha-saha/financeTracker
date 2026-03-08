import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  constructor(private http: HttpClient) {}

  /** API 1 — summary scalars for metric cards + donut */
  getAnalytics(userId: number, startDate: string, endDate: string): Observable<AnalyticsResponse> {
    return this.http.get<AnalyticsResponse>(
      `${this.BASE}/analytics/user/${userId}?startDate=${startDate}&endDate=${endDate}`
    );
  }

  /** API 2 — chart data points for bar / area charts */
  getChartData(ownerId: number, period: ChartPeriod, category = 'ALL'): Observable<ChartApiResponse> {
    return this.http.get<ChartApiResponse>(
      `${this.BASE}/analytics/income-expense?ownerId=${ownerId}&period=${period}&category=${category}`
    );
  }

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