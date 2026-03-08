import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

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

  // ════════════════════════════════════════
  // RESOLVE WHICH ID TO USE FOR API CALLS
  //
  // OWNER / ADMIN  → use their own userId
  // MANAGER/WAITER → use adminId stored in ft_user if present,
  //                  otherwise fall back to their own userId
  // ════════════════════════════════════════

  private getApiUserId(): number {
    const currentUser = this.authService.getCurrentUser();
    const adminId     = (currentUser as any)?.adminId ?? 0;
    const userId      = this.authService.getCurrentUserId();

    if (adminId && adminId !== 0) {
      console.log('[InventoryService] Using adminId for API calls:', adminId);
      return adminId;
    }

    console.log('[InventoryService] Using userId for API calls:', userId);
    return userId;
  }

  // GET ALL — GET /inventory/{userId}/all
  getAll(): Observable<InventoryApiItem[]> {
    return this.http.get<InventoryApiItem[]>(
      `${this.BASE}/${this.getApiUserId()}/all`
    );
  }

  // GET BY ID — GET /inventory/{userId}/get/{inventoryId}
  getById(inventoryId: number): Observable<InventoryApiItem> {
    return this.http.get<InventoryApiItem>(
      `${this.BASE}/${this.getApiUserId()}/get/${inventoryId}`
    );
  }

  // GET BY VENDOR — GET /inventory/{userId}/vendor/{vendorId}
  getByVendor(vendorId: number): Observable<InventoryApiItem[]> {
    return this.http.get<InventoryApiItem[]>(
      `${this.BASE}/${this.getApiUserId()}/vendor/${vendorId}`
    );
  }

  // CREATE — POST /inventory/{userId}/add
  add(payload: InventoryAddPayload): Observable<InventoryApiItem> {
    return this.http.post<InventoryApiItem>(
      `${this.BASE}/${this.getApiUserId()}/add`,
      payload
    );
  }

  // UPDATE — PUT /inventory/{userId}/update/{inventoryId}
  update(
    inventoryId: number,
    payload:     InventoryUpdatePayload
  ): Observable<InventoryApiItem> {
    return this.http.put<InventoryApiItem>(
      `${this.BASE}/${this.getApiUserId()}/update/${inventoryId}`,
      payload
    );
  }

  // DELETE — DELETE /inventory/{userId}/delete/{inventoryId}
  delete(inventoryId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.BASE}/${this.getApiUserId()}/delete/${inventoryId}`
    );
  }

  // VENDOR NAMES — GET /vendors/{userId}/names
  getVendorNames(): Observable<VendorNameItem[]> {
    return this.http.get<VendorNameItem[]>(
      `${this.VEND_BASE}/${this.getApiUserId()}/names`
    );
  }
}