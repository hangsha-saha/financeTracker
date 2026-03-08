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

    private get adminId(): number {
    return this.authService.getCurrentUserId();
  }

  // GET menu
  getMenu(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.baseUrl}/user/${this.adminId}`);
  }

  // ADD menu
  addMenu(item: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/${this.adminId}`, item);
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