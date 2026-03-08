import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface Restaurant {
  id:             number;
  restaurantName: string;
  gstNumber:      string;
  address:        string;
  userId:         number;
}

export interface RestaurantPayload {
  restaurantName: string;
  gstNumber:      string;
  address:        string;
}

@Injectable({ providedIn: 'root' })
export class RestaurantService {

  private readonly BASE = 'http://192.168.1.39:3000/api/restaurants';

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
      console.log('[RestaurantService] Using adminId for API calls:', adminId);
      return adminId;
    }

    console.log('[RestaurantService] Using userId for API calls:', userId);
    return userId;
  }

  // GET ALL — GET /api/restaurants/{userId}/all
  getAll(): Observable<Restaurant[]> {
    return this.http.get<Restaurant[]>(
      `${this.BASE}/${this.getApiUserId()}/all`
    );
  }

  // GET BY ID — GET /api/restaurants/{userId}/get/{restaurantId}
  getById(restaurantId: number): Observable<Restaurant> {
    return this.http.get<Restaurant>(
      `${this.BASE}/${this.getApiUserId()}/get/${restaurantId}`
    );
  }

  // ADD — POST /api/restaurants/{userId}/add
  add(payload: RestaurantPayload): Observable<Restaurant> {
    return this.http.post<Restaurant>(
      `${this.BASE}/${this.getApiUserId()}/add`,
      payload
    );
  }

  // UPDATE — PUT /api/restaurants/{userId}/update/{restaurantId}
  update(restaurantId: number, payload: RestaurantPayload): Observable<Restaurant> {
    return this.http.put<Restaurant>(
      `${this.BASE}/${this.getApiUserId()}/update/${restaurantId}`,
      payload
    );
  }

  // DELETE — DELETE /api/restaurants/{userId}/delete/{restaurantId}
  delete(restaurantId: number): Observable<string> {
    return this.http.delete(
      `${this.BASE}/${this.getApiUserId()}/delete/${restaurantId}`,
      { responseType: 'text' }
    );
  }
}