import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { Vendor, VendorCreatePayload, VendorUpdatePayload } from '../vendors/vendors.component';

@Injectable({
  providedIn: 'root'
})
export class VendorsService {

  private readonly API_BASE  = 'http://192.168.1.39:3000/vendors';

  constructor(
    private http:        HttpClient,
    private authService: AuthService
  ) {}

  // ── Always reads fresh from AuthService ──
  private get userId(): number {
    return this.authService.getCurrentUserId();
  }

  // GET /vendors/{userId}/all
  getAll(): Observable<Vendor[]> {
    return this.http.get<Vendor[]>(
      `${this.API_BASE}/${this.userId}/all`
    );
  }

  // GET /vendors/{userId}/get/{vendorId}
  getById(vendorId: number): Observable<Vendor> {
    return this.http.get<Vendor>(
      `${this.API_BASE}/${this.userId}/get/${vendorId}`
    );
  }

  // POST /vendors/{userId}/add
  add(payload: VendorCreatePayload): Observable<Vendor> {
    return this.http.post<Vendor>(
      `${this.API_BASE}/${this.userId}/add`,
      payload
    );
  }

  // PUT /vendors/{userId}/update/{vendorId}
  update(vendorId: number, payload: VendorUpdatePayload): Observable<Vendor> {
    return this.http.put<Vendor>(
      `${this.API_BASE}/${this.userId}/update/${vendorId}`,
      payload
    );
  }

  // DELETE /vendors/{userId}/delete/{vendorId}
  delete(vendorId: number): Observable<string> {
    return this.http.delete(
      `${this.API_BASE}/${this.userId}/delete/${vendorId}`,
      { responseType: 'text' }
    );
  }

  // GET /vendors/{userId}/names
  getVendorNames(): Observable<{ vendorId: number; name: string }[]> {
    return this.http.get<{ vendorId: number; name: string }[]>(
      `${this.API_BASE}/${this.userId}/names`
    );
  }
}