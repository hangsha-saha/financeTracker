import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

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
  vendorName:      string;
  vendorId:        number;
  userId:          number;
}

export interface VendorNameItem {
  vendorId: number;
  name:     string;
}

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

  private readonly BASE      = 'http://192.168.1.39:3000/inventory';
  private readonly VEND_BASE = 'http://192.168.1.39:3000/vendors';

  constructor(
    private http:        HttpClient,
    private authService: AuthService
  ) {}

  // ── Always reads fresh from AuthService ──
  private get adminId(): number {
    return this.authService.getCurrentUserId();
  }

  // ════════════════════════════════════════
  // GET ALL — GET /inventory/{userId}/all
  // ════════════════════════════════════════

  getAll(): Observable<InventoryApiItem[]> {
    return this.http.get<InventoryApiItem[]>(
      `${this.BASE}/${this.adminId}/all`
    );
  }

  // ════════════════════════════════════════
  // GET BY ID — GET /inventory/{userId}/get/{inventoryId}
  // ════════════════════════════════════════

  getById(inventoryId: number): Observable<InventoryApiItem> {
    return this.http.get<InventoryApiItem>(
      `${this.BASE}/${this.adminId}/get/${inventoryId}`
    );
  }

  // ════════════════════════════════════════
  // GET BY VENDOR — GET /inventory/{userId}/vendor/{vendorId}
  // ════════════════════════════════════════

  getByVendor(vendorId: number): Observable<InventoryApiItem[]> {
    return this.http.get<InventoryApiItem[]>(
      `${this.BASE}/${this.adminId}/vendor/${vendorId}`
    );
  }

  // ════════════════════════════════════════
  // CREATE — POST /inventory/{userId}/add
  // ════════════════════════════════════════

  add(payload: InventoryAddPayload): Observable<InventoryApiItem> {
    return this.http.post<InventoryApiItem>(
      `${this.BASE}/${this.adminId}/add`,
      payload
    );
  }

  // ════════════════════════════════════════
  // UPDATE — PUT /inventory/{userId}/update/{inventoryId}
  // ════════════════════════════════════════

  update(
    inventoryId: number,
    payload:     InventoryUpdatePayload
  ): Observable<InventoryApiItem> {
    return this.http.put<InventoryApiItem>(
      `${this.BASE}/${this.adminId}/update/${inventoryId}`,
      payload
    );
  }

  // ════════════════════════════════════════
  // DELETE — DELETE /inventory/{userId}/delete/{inventoryId}
  // ════════════════════════════════════════

  delete(inventoryId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.BASE}/${this.adminId}/delete/${inventoryId}`
    );
  }

  // ════════════════════════════════════════
  // VENDOR NAMES — GET /vendors/{userId}/names
  // ════════════════════════════════════════

  getVendorNames(): Observable<VendorNameItem[]> {
    return this.http.get<VendorNameItem[]>(
      `${this.VEND_BASE}/${this.adminId}/names`
    );
  }
}