import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface MonthData {
  date:      string;
  month:     string;
  income:    number;
  expense:   number;
  breakdown: { [key: string]: number };
}

export interface ReportSummary {
  totalIncome:  number;
  totalExpense: number;
  netProfit:    number;
}

export interface BreakdownResult {
  labels: string[];
  values: number[];
}

interface ReportEntry {
  userId:      number;
  monthlyData: MonthData[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {

  private readonly JSON_URL = 'assets/data/reports.json';

  // ── TODO: swap with real API base when ready ──
  // private readonly API_BASE = 'http://localhost:8080/api/reports';

  // ── In-memory cache ──
  private cache: MonthData[] = [];

  constructor(private http: HttpClient) {}

  // ════════════════════════════════════════
  // GET ALL MONTHLY DATA BY USER ID
  // ════════════════════════════════════════

  // ── CURRENT (JSON) ──
  getAllByUserId(userId: number): Observable<MonthData[]> {
    return this.http.get<ReportEntry[]>(this.JSON_URL).pipe(
      map(entries => {
        const found = entries.find(e => e.userId === userId);
        const list  = found ? found.monthlyData : [];
        this.cache  = [...list];
        return list;
      })
    );
  }

  // ── TODO: replace with this when API is ready ──
  // getAllByUserId(userId: number): Observable<MonthData[]> {
  //   return this.http.get<MonthData[]>(
  //     `${this.API_BASE}/user/${userId}`
  //   ).pipe(
  //     tap(list => { this.cache = [...list]; })
  //   );
  // }

  // ════════════════════════════════════════
  // GET FILTERED BY DATE RANGE
  // ════════════════════════════════════════

  // ── CURRENT (client-side filter on cache) ──
  getByDateRange(
    userId: number,
    startDate: string,
    endDate: string
  ): Observable<MonthData[]> {
    return this.getAllByUserId(userId).pipe(
      map(list => {
        if (!startDate || !endDate) return list;
        return list.filter(m => m.date >= startDate && m.date <= endDate);
      })
    );
  }

  // ── TODO: replace with this when API is ready ──
  // getByDateRange(userId: number, startDate: string, endDate: string): Observable<MonthData[]> {
  //   return this.http.get<MonthData[]>(
  //     `${this.API_BASE}/user/${userId}/filter?start=${startDate}&end=${endDate}`
  //   );
  // }

  // ════════════════════════════════════════
  // GET SUMMARY (total income, expense, profit)
  // ════════════════════════════════════════

  // ── CURRENT (computed client-side) ──
  getSummary(userId: number, startDate: string, endDate: string): Observable<ReportSummary> {
    return this.getByDateRange(userId, startDate, endDate).pipe(
      map(list => {
        const totalIncome  = list.reduce((s, m) => s + m.income,  0);
        const totalExpense = list.reduce((s, m) => s + m.expense, 0);
        return {
          totalIncome,
          totalExpense,
          netProfit: totalIncome - totalExpense
        };
      })
    );
  }

  // ── TODO: replace with this when API is ready ──
  // getSummary(userId: number, startDate: string, endDate: string): Observable<ReportSummary> {
  //   return this.http.get<ReportSummary>(
  //     `${this.API_BASE}/user/${userId}/summary?start=${startDate}&end=${endDate}`
  //   );
  // }

  // ════════════════════════════════════════
  // GET EXPENSE BREAKDOWN (aggregated by category)
  // ════════════════════════════════════════

  // ── CURRENT (computed client-side) ──
  getExpenseBreakdown(
    userId: number,
    startDate: string,
    endDate: string
  ): Observable<BreakdownResult> {
    return this.getByDateRange(userId, startDate, endDate).pipe(
      map(list => this.aggregateBreakdown(list))
    );
  }

  // ── TODO: replace with this when API is ready ──
  // getExpenseBreakdown(userId: number, startDate: string, endDate: string): Observable<BreakdownResult> {
  //   return this.http.get<BreakdownResult>(
  //     `${this.API_BASE}/user/${userId}/breakdown?start=${startDate}&end=${endDate}`
  //   );
  // }

  // ════════════════════════════════════════
  // GET PROFIT TREND
  // ════════════════════════════════════════

  // ── CURRENT (computed client-side) ──
  getProfitTrend(
    userId: number,
    startDate: string,
    endDate: string
  ): Observable<{ months: string[]; profits: number[] }> {
    return this.getByDateRange(userId, startDate, endDate).pipe(
      map(list => ({
        months:  list.map(m => m.month),
        profits: list.map(m => m.income - m.expense)
      }))
    );
  }

  // ── TODO: replace with this when API is ready ──
  // getProfitTrend(userId: number, startDate: string, endDate: string): Observable<{ months: string[]; profits: number[] }> {
  //   return this.http.get<{ months: string[]; profits: number[] }>(
  //     `${this.API_BASE}/user/${userId}/profit-trend?start=${startDate}&end=${endDate}`
  //   );
  // }

  // ════════════════════════════════════════
  // GET INCOME VS EXPENSE (for bar chart)
  // ════════════════════════════════════════

  // ── CURRENT (computed client-side) ──
  getIncomeVsExpense(
    userId: number,
    startDate: string,
    endDate: string
  ): Observable<{ months: string[]; incomes: number[]; expenses: number[] }> {
    return this.getByDateRange(userId, startDate, endDate).pipe(
      map(list => ({
        months:   list.map(m => m.month),
        incomes:  list.map(m => m.income),
        expenses: list.map(m => m.expense)
      }))
    );
  }

  // ── TODO: replace with this when API is ready ──
  // getIncomeVsExpense(userId: number, startDate: string, endDate: string) {
  //   return this.http.get<{ months: string[]; incomes: number[]; expenses: number[] }>(
  //     `${this.API_BASE}/user/${userId}/income-vs-expense?start=${startDate}&end=${endDate}`
  //   );
  // }

  // ════════════════════════════════════════
  // GET AVAILABLE DATE RANGE (min/max dates)
  // ════════════════════════════════════════

  // ── CURRENT (computed from cache) ──
  getAvailableDateRange(userId: number): Observable<{ min: string; max: string }> {
    return this.getAllByUserId(userId).pipe(
      map(list => {
        if (list.length === 0) return { min: '', max: '' };
        const dates = list.map(m => m.date).sort();
        return { min: dates[0], max: dates[dates.length - 1] };
      })
    );
  }

  // ── TODO: replace with this when API is ready ──
  // getAvailableDateRange(userId: number): Observable<{ min: string; max: string }> {
  //   return this.http.get<{ min: string; max: string }>(
  //     `${this.API_BASE}/user/${userId}/date-range`
  //   );
  // }

  // ════════════════════════════════════════
  // HELPER — aggregate breakdown across months
  // ════════════════════════════════════════

  aggregateBreakdown(months: MonthData[]): BreakdownResult {
    const totals: { [key: string]: number } = {};
    months.forEach(m => {
      Object.entries(m.breakdown).forEach(([cat, val]) => {
        totals[cat] = (totals[cat] || 0) + val;
      });
    });
    return {
      labels: Object.keys(totals),
      values: Object.values(totals)
    };
  }
}