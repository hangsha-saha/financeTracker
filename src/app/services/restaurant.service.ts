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

  private get userId(): number {
    return this.authService.getCurrentUserId();
  }

  // ════════════════════════════════════════
  // GET ALL — GET /api/restaurants/{userId}/all
  // ════════════════════════════════════════

  getAll(): Observable<Restaurant[]> {
    return this.http.get<Restaurant[]>(
      `${this.BASE}/${this.userId}/all`
    );
  }

  // ════════════════════════════════════════
  // GET BY ID — GET /api/restaurants/{userId}/get/{restaurantId}
  // ════════════════════════════════════════

  getById(restaurantId: number): Observable<Restaurant> {
    return this.http.get<Restaurant>(
      `${this.BASE}/${this.userId}/get/${restaurantId}`
    );
  }

  // ════════════════════════════════════════
  // ADD — POST /api/restaurants/{userId}/add
  // ════════════════════════════════════════

  add(payload: RestaurantPayload): Observable<Restaurant> {
    return this.http.post<Restaurant>(
      `${this.BASE}/${this.userId}/add`,
      payload
    );
  }

  // ════════════════════════════════════════
  // UPDATE — PUT /api/restaurants/{userId}/update/{restaurantId}
  // ════════════════════════════════════════

  update(restaurantId: number, payload: RestaurantPayload): Observable<Restaurant> {
    return this.http.put<Restaurant>(
      `${this.BASE}/${this.userId}/update/${restaurantId}`,
      payload
    );
  }

  // ════════════════════════════════════════
  // DELETE — DELETE /api/restaurants/{userId}/delete/{restaurantId}
  // Returns plain text
  // ════════════════════════════════════════

  delete(restaurantId: number): Observable<string> {
    return this.http.delete(
      `${this.BASE}/${this.userId}/delete/${restaurantId}`,
      { responseType: 'text' }
    );
  }
}