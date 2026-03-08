import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { Vendor, VendorCreatePayload, VendorUpdatePayload } from '../vendors/vendors.component';

@Injectable({
  providedIn: 'root'
})
export class VendorsService {

  private readonly API_BASE = 'http://192.168.1.39:3000/vendors';

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
      console.log('[VendorsService] Using adminId for API calls:', adminId);
      return adminId;
    }

    console.log('[VendorsService] Using userId for API calls:', userId);
    return userId;
  }

  // GET /vendors/{userId}/all
  getAll(): Observable<Vendor[]> {
    return this.http.get<Vendor[]>(
      `${this.API_BASE}/${this.getApiUserId()}/all`
    );
  }

  // GET /vendors/{userId}/get/{vendorId}
  getById(vendorId: number): Observable<Vendor> {
    return this.http.get<Vendor>(
      `${this.API_BASE}/${this.getApiUserId()}/get/${vendorId}`
    );
  }

  // POST /vendors/{userId}/add
  add(payload: VendorCreatePayload): Observable<Vendor> {
    return this.http.post<Vendor>(
      `${this.API_BASE}/${this.getApiUserId()}/add`,
      payload
    );
  }

  // PUT /vendors/{userId}/update/{vendorId}
  update(vendorId: number, payload: VendorUpdatePayload): Observable<Vendor> {
    return this.http.put<Vendor>(
      `${this.API_BASE}/${this.getApiUserId()}/update/${vendorId}`,
      payload
    );
  }

  // DELETE /vendors/{userId}/delete/{vendorId}
  delete(vendorId: number): Observable<string> {
    return this.http.delete(
      `${this.API_BASE}/${this.getApiUserId()}/delete/${vendorId}`,
      { responseType: 'text' }
    );
  }

  // GET /vendors/{userId}/names
  getVendorNames(): Observable<{ vendorId: number; name: string }[]> {
    return this.http.get<{ vendorId: number; name: string }[]>(
      `${this.API_BASE}/${this.getApiUserId()}/names`
    );
  }
}