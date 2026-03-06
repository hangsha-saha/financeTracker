import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface BillItem {
  name:  string;
  qty:   number;
  price: number;
  total: number;
}

export interface Bill {
  userId:   number;        // ← added
  id:       string;
  customer: string;
  date:     string;
  payment:  string;
  subtotal: number;
  tax:      number;
  discount: number;
  items:    BillItem[];
}

@Injectable({ providedIn: 'root' })
export class ViewBillsService {

  private readonly JSON_URL = 'assets/data/bills.json';

  constructor(private http: HttpClient) {}

  // Fetch ALL bills
  getBills(): Observable<Bill[]> {
    return this.http.get<Bill[]>(this.JSON_URL);
  }

  // Fetch bills filtered by userId (restaurantId)
  getByUserId(userId: number): Observable<Bill[]> {
    return this.http.get<Bill[]>(this.JSON_URL).pipe(
      map(bills => bills.filter(b => b.userId === userId))
    );
  }
}