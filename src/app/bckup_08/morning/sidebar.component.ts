import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

// ── Role → allowed pages map ──
const ROLE_PAGES: { [role: string]: string[] } = {
  admin: [
    'dashboard', 'income', 'expense', 'menu', 'inventory',
    'vendors', 'employees', 'reports', 'generate-bill', 'view-bills', 'profile'
  ],
  manager: [
    'dashboard', 'income', 'menu', 'reports',
    'generate-bill', 'view-bills', 'profile'
  ],
  waiter: [
    'view-bills', 'profile'
  ],
};

@Component({
  selector:    'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls:   ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {

  // ── Profile ──
  sidebarName:    string = '';
  sidebarEmail:   string = '';
  sidebarInitial: string = '';
  sidebarRole:    string = '';
  avatarSrc:      string = '';

  // ── Role key for page filtering ──
  private roleKey: string = 'admin';

  // ── Active route ──
  currentUrl: string = '';

  // ── Toast ──
  toastMsg:     string  = '';
  toastType:    string  = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  private routerSub!: Subscription;

  constructor(
    private router:      Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUrl = this.router.url.split('?')[0];
    this.loadRoleAndProfile();

    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.currentUrl = e.urlAfterRedirects.split('?')[0];
      this.loadProfile();
    });
  }

  ngOnDestroy(): void {
    if (this.routerSub) this.routerSub.unsubscribe();
    clearTimeout(this.toastTimer);
  }

  // ════════════════════════════════════════
  // LOAD ROLE — reads ft_resolved_role set
  // during login. No extra API call needed.
  // ════════════════════════════════════════

  loadRoleAndProfile(): void {
    const resolvedRole = this.authService.getResolvedRole(); // e.g. 'manager', 'waiter', 'admin'
    this.roleKey       = this.normalizeRole(resolvedRole);
    console.log('[Sidebar] Resolved role from storage:', resolvedRole, '→ roleKey:', this.roleKey);
    this.loadProfile();
  }

  // ════════════════════════════════════════
  // LOAD DISPLAY PROFILE
  // ════════════════════════════════════════

  loadProfile(): void {
    try {
      // ── Auth session (ft_user) ──
      const authUser = this.authService.getCurrentUser();
      if (authUser) {
        this.sidebarName    = authUser.userName || 'User';
        this.sidebarEmail   = authUser.email    || '';
        this.sidebarInitial = (authUser.userName?.[0] || 'U').toUpperCase();
      }

      // ── Role display label ──
      const resolvedRole = this.authService.getResolvedRole();
      this.roleKey       = this.normalizeRole(resolvedRole);
      this.sidebarRole   = this.roleKey.charAt(0).toUpperCase()
                         + this.roleKey.slice(1);

      // ── Override display name/avatar from profile page if saved ──
      const rawProfile = localStorage.getItem('ftProfile');
      if (rawProfile) {
        const p           = JSON.parse(rawProfile);
        const profileName = p.displayName
          || (p.firstName ? `${p.firstName} ${p.lastName}`.trim() : '');
        if (profileName) this.sidebarName    = profileName;
        if (p.email)     this.sidebarEmail   = p.email;
        this.sidebarInitial = (this.sidebarName[0] || 'U').toUpperCase();
        this.avatarSrc = (p.avatar && p.avatar.startsWith('data:image'))
          ? p.avatar : '';
      }

    } catch (e) {
      console.error('[Sidebar] loadProfile error:', e);
      this.sidebarName    = 'User';
      this.sidebarEmail   = '';
      this.sidebarInitial = 'U';
      this.sidebarRole    = 'Admin';
      this.roleKey        = 'admin';
    }
  }

  // ════════════════════════════════════════
  // ROLE NORMALIZATION
  // Maps any role string → 'admin' | 'manager' | 'waiter'
  // Handles: 'MANAGER', 'manager', 'Manager', 'WAITER', etc.
  // ════════════════════════════════════════

  private normalizeRole(role: string): string {
    if (!role) return 'admin';
    const r = role.toLowerCase().replace(/_/g, '');
    if (r.includes('manager')) return 'manager';
    if (r.includes('waiter'))  return 'waiter';
    return 'admin';
  }

  // ════════════════════════════════════════
  // PAGE VISIBILITY
  // ════════════════════════════════════════

  canSee(page: string): boolean {
    const allowed = ROLE_PAGES[this.roleKey] ?? ROLE_PAGES['admin'];
    return allowed.includes(page);
  }

  // ════════════════════════════════════════
  // NAVIGATION
  // ════════════════════════════════════════

  isActive(route: string): boolean {
    return this.currentUrl === '/' + route ||
           this.currentUrl.startsWith('/' + route + '/');
  }

  goTo(page: string): void {
    if (!this.canSee(page)) {
      this.showToast(`Access denied for "${this.capitalize(page)}"`, 'danger');
      return;
    }
    this.router.navigate(['/' + page]);
  }

  // ════════════════════════════════════════
  // LOGOUT
  // ════════════════════════════════════════

  handleLogout(): void {
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
  }

  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer   = setTimeout(() => this.toastVisible = false, 2800);
  }
}