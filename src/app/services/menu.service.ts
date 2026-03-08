import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface MenuItem {
  id: number;
  itemName: string;
  category: string;
  price: number;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {

  private baseUrl = 'http://192.168.1.39:3000/menu';

  constructor(private http: HttpClient,
    private authService: AuthService) {}

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
      console.log('[MenuService] Using adminId for API calls:', adminId);
      return adminId;
    }

    console.log('[MenuService] Using userId for API calls:', userId);
    return userId;
  }

  // GET menu
  getMenu(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.baseUrl}/user/${this.getApiUserId()}`);
  }

  // ADD menu
  addMenu(item: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/${this.getApiUserId()}`, item);
  }

  // UPDATE menu
  updateMenu(id: number, item: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}`, item);
  }

  // DELETE menu
  deleteMenu(itemId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${itemId}`);
  }

}