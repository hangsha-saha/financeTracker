import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ExpenseBreakdown {
  category: string;
  amount:   number;
}

export interface AnalyticsData {
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

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly BASE = 'http://192.168.1.39:3000';

  constructor(private http: HttpClient) {}

  getAnalytics(userId: number, startDate: string, endDate: string): Observable<AnalyticsData> {
    return this.http.get<AnalyticsData>(
      `${this.BASE}/analytics/user/${userId}?startDate=${startDate}&endDate=${endDate}`
    );
  }
}