import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface MenuItemOption {
  name:     string;
  price:    number;
  category: string;
}

export interface VoucherData {
  code:  string;
  type:  'percent' | 'flat';
  value: number;
  label: string;
}

// ── Shape of each entry in menu.json ──
interface MenuEntry {
  userId: number;
  menu:   MenuItemOption[];
}

// ── Shape of each entry in vouchers.json ──
interface VoucherEntry {
  userId:   number;
  vouchers: VoucherData[];
}

@Injectable({ providedIn: 'root' })
export class BillService {

  private readonly MENU_URL    = 'assets/data/menu.json';
  private readonly VOUCHER_URL = 'assets/data/vouchers.json';

  constructor(private http: HttpClient) {}

  // Returns menu items for a specific userId
  getMenuItemsByUserId(userId: number): Observable<MenuItemOption[]> {
    return this.http.get<MenuEntry[]>(this.MENU_URL).pipe(
      map(entries => {
        const found = entries.find(e => e.userId === userId);
        return found ? found.menu : [];
      })
    );
  }

  // Returns vouchers for a specific userId
  getVouchersByUserId(userId: number): Observable<VoucherData[]> {
    return this.http.get<VoucherEntry[]>(this.VOUCHER_URL).pipe(
      map(entries => {
        const found = entries.find(e => e.userId === userId);
        return found ? found.vouchers : [];
      })
    );
  }
}