import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {

  // ── Profile ──
  sidebarName: string    = 'Admin User';
  sidebarRole: string    = 'Admin';
  sidebarInitial: string = 'A';
  sidebarEmail: string   = 'admin@restaurant.com';
  avatarSrc: string      = '';

  // ── Active route ──
  currentUrl: string = '';

  // ── Built pages (others show "coming soon" toast) ──
  readonly BUILT_PAGES = [
    'dashboard', 'login', 'inventory', 'income', 'expense',
    'menu', 'generate-bill', 'employees', 'profile', 'vendors', 'view-bills', 'reports'
  ];

  // ── Toast ──
  toastMsg: string      = '';
  toastType: string     = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  private routerSub!: Subscription;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.currentUrl = this.router.url;

    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.currentUrl = e.urlAfterRedirects;
      this.loadProfile();
    });

    this.loadProfile();
  }

  ngOnDestroy(): void {
    if (this.routerSub) this.routerSub.unsubscribe();
    clearTimeout(this.toastTimer);
  }

  // ── Active check ──
  isActive(route: string): boolean {
    return this.currentUrl === '/' + route ||
           this.currentUrl.startsWith('/' + route + '/');
  }

  // ── Navigation ──
  goTo(page: string): void {
    if (this.BUILT_PAGES.includes(page)) {
      this.router.navigate(['/' + page]);
    } else {
      this.showToast(`"${this.capitalize(page)}" page coming soon!`, 'info');
    }
  }

  handleLogout(): void {
    if (confirm('Are you sure you want to logout?')) {
      this.router.navigate(['/login']);
    }
  }

  // ── Load profile from localStorage ──
  loadProfile(): void {
    try {
      const raw = localStorage.getItem('ftProfile');
      if (raw) {
        const p = JSON.parse(raw);
        const roleMap: any = {
          admin: 'Admin', manager: 'Manager',
          cashier: 'Cashier', staff: 'Staff'
        };
        this.sidebarName    = p.displayName || `${p.firstName} ${p.lastName}`;
        this.sidebarRole    = roleMap[p.role] || 'Admin';
        this.sidebarInitial = (p.firstName || 'A')[0].toUpperCase();
        this.sidebarEmail   = p.email || 'admin@restaurant.com';
        this.avatarSrc      = (p.avatar && p.avatar.startsWith('data:image')) ? p.avatar : '';
      }
    } catch(e) {}
  }

  // ── Helpers ──
  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
  }

  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 2800);
  }
}