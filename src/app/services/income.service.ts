import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface IncomeRaw {
  user_id: number;
  date:    string;
  type:    string;
  payment: string;
  gross:   number;
}

export interface IncomeRecord {
  user_id: number;
  date:    string;
  type:    string;
  payment: string;
  gross:   number;
}

@Injectable({ providedIn: 'root' })
export class IncomeService {

  private readonly JSON_URL = 'assets/data/income.json';

  constructor(private http: HttpClient) {}

  getByUserId(userId: number): Observable<IncomeRecord[]> {
    return this.http.get<IncomeRaw[]>(this.JSON_URL).pipe(
      map(records => records.filter(r => r.user_id === userId))
    );
  }
}