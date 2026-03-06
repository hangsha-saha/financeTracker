// import { Injectable } from '@angular/core';
// import { HttpClient } from '@angular/common/http';
// import { Observable } from 'rxjs';
// import { Vendor, VendorCreatePayload, VendorUpdatePayload } from '../vendors/vendors.component';

// @Injectable({
//   providedIn: 'root'
// })
// export class VendorsService {
//   private readonly API_BASE = 'http://localhost:8080/vendors'; 

//   constructor(private http: HttpClient) { }

//   /**
//    * Helper to retrieve the owner/restaurant ID.
//    * Replace '1' with your dynamic logic (e.g., localStorage.getItem('ownerId'))
//    */
//   private getOwnerId(): string {
//     return localStorage.getItem('ownerId') || '1'; 
//   }

//   // 11. Get all vendors for the specific owner
//   getAll(): Observable<Vendor[]> {
//     const id = this.getOwnerId();
//     return this.http.get<Vendor[]>(`${this.API_BASE}/all/${id}`);
//   }

//   // 10. Get vendor by ID
//   getById(vendorId: number): Observable<Vendor> {
//     return this.http.get<Vendor>(`${this.API_BASE}/get/${vendorId}`);
//   }

//   // 7. Add vendor for the specific owner
//   add(payload: VendorCreatePayload): Observable<Vendor> {
//     const id = this.getOwnerId();
//     return this.http.post<Vendor>(`${this.API_BASE}/add/${id}`, payload);
//   }

//   // 8. Update vendor
//   update(vendorId: number, payload: VendorUpdatePayload): Observable<Vendor> {
//     return this.http.put<Vendor>(`${this.API_BASE}/update/${vendorId}`, payload);
//   }

//   // 9. Delete vendor
//   delete(vendorId: number): Observable<void> {
//     return this.http.delete<void>(`${this.API_BASE}/delete/${vendorId}`);
//   }
// }

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Vendor, VendorCreatePayload, VendorUpdatePayload } from '../vendors/vendors.component';

@Injectable({
  providedIn: 'root'
})
export class VendorsService {
  
  // ── SET THIS TO TRUE FOR BACKEND, FALSE FOR LOCAL JSON ──
  private readonly isProduction = false; 
  private readonly API_BASE = 'http://localhost:8080/vendors';
  private readonly JSON_FILE = '/assets/data/vendors.json'; 

  constructor(private http: HttpClient) { }

  // Logic to fetch the owner ID - replace '1' with your dynamic user/restaurant ID source
  private getOwnerId(): string {
    return localStorage.getItem('ownerId') || '1';; 
  }

  // 11. Get all vendors for owner
  getAll(): Observable<Vendor[]> {
    const url = this.isProduction ? `${this.API_BASE}/all/${this.getOwnerId()}` : this.JSON_FILE;
    return this.http.get<Vendor[]>(url);
  }

  // 10. Get vendor by ID
  getById(id: number): Observable<Vendor> {
    if (!this.isProduction) return this.http.get<Vendor>(this.JSON_FILE); // Simplistic mock
    return this.http.get<Vendor>(`${this.API_BASE}/get/${id}`);
  }

  // 7. Add vendor for owner
  add(payload: VendorCreatePayload): Observable<Vendor> {
    if (!this.isProduction) {
      console.warn("Mock mode: POST request bypassed.");
      return of({ id: Date.now(), ...payload } as Vendor);
    }
    return this.http.post<Vendor>(`${this.API_BASE}/add/${this.getOwnerId()}`, payload);
  }

  // 8. Update vendor
  update(id: number, payload: VendorUpdatePayload): Observable<Vendor> {
    if (!this.isProduction) {
      console.warn("Mock mode: PUT request bypassed.");
      return of({ id, ...payload } as Vendor);
    }
    return this.http.put<Vendor>(`${this.API_BASE}/update/${id}`, payload);
  }

  // 9. Delete vendor
  delete(id: number): Observable<void> {
    if (!this.isProduction) {
      console.warn("Mock mode: DELETE request bypassed.");
      return of();
    }
    return this.http.delete<void>(`${this.API_BASE}/delete/${id}`);
  }
}