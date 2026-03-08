import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { RestaurantService, Restaurant } from './restaurant.service';

export interface MenuItemOption {
  id:    number;
  name:  string;
  price: number;
}

export interface VoucherOption {
  id:    number;
  code:  string;
  type:  'percent' | 'flat';
  value: number;
  label: string;
}

export interface BillPayload {
  paymentMode:  string;
  customerType: string;
  phoneNo:      string;
}

export interface BillResponse {
  billId:       number;
  billNumber?:  string;
  id?:          number;
  bill_id?:     number;
  billID?:      number;
}

@Injectable({ providedIn: 'root' })
export class BillService {

  private readonly BASE = 'http://192.168.1.21:8080';

  constructor(
    private http:        HttpClient,
    private authService: AuthService,
    private restaurantService: RestaurantService
  ) {}

  private get userId(): number {
    return this.authService.getCurrentUserId();
  }

  // ════════════════════════════════════════
  // RESTAURANT
  // ════════════════════════════════════════

  getRestaurant(): Observable<Restaurant[]> {
    return this.restaurantService.getAll();
  }

  // ════════════════════════════════════════
  // MENU
  // ════════════════════════════════════════

  getMenuItems(): Observable<MenuItemOption[]> {
    return this.http.get<any[]>(
      `${this.BASE}/menu/user/${this.userId}`
    ).pipe(
      map(list => {
        console.log('[Menu] raw API response:', list);  // ← add this
        return list.map(m => ({
          id:    m.menuId    ?? m.itemId  ?? m.id    ?? 0,
          name:  m.menuName  ?? m.itemName ?? m.name  ?? '',
          price: m.menuPrice ?? m.itemPrice ?? m.price ?? 0,
        }));
      })
    );
  }

  // ════════════════════════════════════════
  // VOUCHERS
  // GET /vouchers/user/{userId}
  // ════════════════════════════════════════

  getVouchers(): Observable<VoucherOption[]> {
    return this.http.get<any[]>(
      `${this.BASE}/vouchers/user/${this.userId}`
    ).pipe(
      map(list => list.map(v => ({
        id:    v.voucherId  ?? v.id    ?? 0,
        code:  v.code       ?? '',
        type:  (v.type === 'percent' || v.type === 'PERCENT') ? 'percent' : 'flat',
        value: v.value      ?? v.discountValue ?? 0,
        label: v.label      ?? v.description   ?? v.code ?? '',
      })))
    );
  }

  // ════════════════════════════════════════
  // BILL — POST
  // With voucher:    POST /bills/user/{userId}/voucher/{voucherId}
  // Without voucher: POST /bills/user/{userId}/voucher/0
  // ════════════════════════════════════════

  createBill(payload: BillPayload, voucherId: number = 0): Observable<BillResponse> {
    console.log('[Bill] POST /bills/user/', this.userId, '/voucher/', voucherId);
    return this.http.post<BillResponse>(
      `${this.BASE}/bills/user/${this.userId}/voucher/${voucherId}`,
      payload
    );
  }

  // ════════════════════════════════════════
  // BILL ITEMS — POST
  // POST /bill-items/bill/{billId}/item/{menuItemId}
  // Body: { quantity: number }
  // ════════════════════════════════════════

  addBillItem(
    billId:     number,
    menuItemId: number,
    quantity:   number
  ): Observable<any> {
    return this.http.post<any>(
      `${this.BASE}/bill-items/bill/${billId}/item/${menuItemId}`,
      { quantity }
    );
  }

  // ════════════════════════════════════════
  // GET ALL BILLS
  // ════════════════════════════════════════

  getAllBills(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.BASE}/bills/user/${this.userId}`
    );
  }

  // ════════════════════════════════════════
  // GET BILL ITEMS BY BILL ID
  // ════════════════════════════════════════

  getBillItems(billId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.BASE}/bill-items/bill/${billId}`
    );
  }

  // ════════════════════════════════════════
  // DELETE BILL
  // ════════════════════════════════════════

  deleteBill(billId: number): Observable<any> {
    return this.http.delete(
      `${this.BASE}/bills/${billId}`,
      { responseType: 'text' }
    );
  }
}