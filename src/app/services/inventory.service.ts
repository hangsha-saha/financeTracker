import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// ── API response structures ──
export interface InventoryApiItem {
  inventoryId:     number;
  itemName:        string;
  category:        string;
  unit:            string;
  unitCost:        number;
  quantity:        number;
  usedQuantity:    number;
  minimumQuantity: number;
  note:            string;
  currentDate:     string;
  vendorName:      string;   // flat string in new API
  vendorId:        number;   // flat number in new API
  userId:          number;   // flat number in new API
}

export interface VendorNameItem {
  vendorId: number;
  name:     string;
}

// ── Payloads ──
export interface InventoryAddPayload {
  itemName:        string;
  category:        string;
  unit:            string;
  unitCost:        number;
  quantity:        number;
  usedQuantity:    number;
  minimumQuantity: number;
  note:            string;
  vendorId:        number;
}

export interface InventoryUpdatePayload {
  itemName:        string;
  category:        string;
  unit:            string;
  unitCost:        number;
  quantity:        number;
  usedQuantity:    number;
  minimumQuantity: number;
  note:            string;
  vendorId:        number;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {

  private readonly BASE     = 'http://192.168.1.39:3000/inventory';
  private readonly VEND_BASE = 'http://192.168.1.39:3000/vendors';

  // ── Current user — replace with AuthService later ──
  readonly CURRENT_USER_ID: number = 1;

  constructor(private http: HttpClient) {}

  // ════════════════════════════════════════
  // GET ALL — GET /inventory/{userId}/all
  // ════════════════════════════════════════

  getAll(): Observable<InventoryApiItem[]> {
    return this.http.get<InventoryApiItem[]>(
      `${this.BASE}/${this.CURRENT_USER_ID}/all`
    );
  }

  // ════════════════════════════════════════
  // GET BY ID — GET /inventory/{userId}/get/{inventoryId}
  // ════════════════════════════════════════

  getById(inventoryId: number): Observable<InventoryApiItem> {
    return this.http.get<InventoryApiItem>(
      `${this.BASE}/${this.CURRENT_USER_ID}/get/${inventoryId}`
    );
  }

  // ════════════════════════════════════════
  // GET BY VENDOR — GET /inventory/{userId}/vendor/{vendorId}
  // ════════════════════════════════════════

  getByVendor(vendorId: number): Observable<InventoryApiItem[]> {
    return this.http.get<InventoryApiItem[]>(
      `${this.BASE}/${this.CURRENT_USER_ID}/vendor/${vendorId}`
    );
  }

  // ════════════════════════════════════════
  // CREATE — POST /inventory/{userId}/add
  // ════════════════════════════════════════

  add(payload: InventoryAddPayload): Observable<InventoryApiItem> {
    return this.http.post<InventoryApiItem>(
      `${this.BASE}/${this.CURRENT_USER_ID}/add`,
      payload
    );
  }

  // ════════════════════════════════════════
  // UPDATE — PUT /inventory/{userId}/update/{inventoryId}
  // ════════════════════════════════════════

  update(
    inventoryId: number,
    payload: InventoryUpdatePayload
  ): Observable<InventoryApiItem> {
    return this.http.put<InventoryApiItem>(
      `${this.BASE}/${this.CURRENT_USER_ID}/update/${inventoryId}`,
      payload
    );
  }

  // ════════════════════════════════════════
  // DELETE — DELETE /inventory/{userId}/delete/{inventoryId}
  // ════════════════════════════════════════

  delete(inventoryId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.BASE}/${this.CURRENT_USER_ID}/delete/${inventoryId}`
    );
  }

  // ════════════════════════════════════════
  // VENDOR NAMES — GET /vendors/{userId}/names
  // (for the vendor dropdown in the modal)
  // ════════════════════════════════════════

  getVendorNames(): Observable<VendorNameItem[]> {
    return this.http.get<VendorNameItem[]>(
      `${this.VEND_BASE}/${this.CURRENT_USER_ID}/names`
    );
  }
}