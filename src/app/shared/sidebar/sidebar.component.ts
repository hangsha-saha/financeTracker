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
    'generate-bill', 'view-bills'
  ],
  waiter: [
    'view-bills', 'generate-bill'
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
  roleKey: string = 'admin';

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

    // Re-read profile on every navigation so profile-page saves are reflected immediately
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
  // LOAD ROLE + PROFILE
  // ════════════════════════════════════════

  loadRoleAndProfile(): void {
    const resolvedRole = this.authService.getResolvedRole();
    this.roleKey       = this.normalizeRole(resolvedRole);
    console.log('[Sidebar] resolvedRole:', resolvedRole, '→ roleKey:', this.roleKey);
    this.loadProfile();
  }

  loadProfile(): void {
    try {
      // ── Step 1: read from ft_user (set during login) ──
      const authUser = this.authService.getCurrentUser();
      console.log('[Sidebar] authUser from storage:', authUser);

      if (authUser) {
        // userName may come back as 'userName', 'username', or 'name' depending on API
        const name =
          authUser.userName ||
          (authUser as any).username ||
          (authUser as any).name ||
          '';

        this.sidebarName    = name || 'User';
        this.sidebarEmail   = authUser.email || (authUser as any).emailId || '';
        this.sidebarInitial = (this.sidebarName[0] || 'U').toUpperCase();
      } else {
        // No session — set safe defaults
        this.sidebarName    = 'User';
        this.sidebarEmail   = '';
        this.sidebarInitial = 'U';
      }

      // ── Step 2: role display ──
      const resolvedRole  = this.authService.getResolvedRole();
      this.roleKey        = this.normalizeRole(resolvedRole);
      this.sidebarRole    = this.capitalize(this.roleKey);

      // ── Step 3: override with ftProfile if the user saved extra info ──
      const rawProfile = localStorage.getItem('ftProfile');
      if (rawProfile) {
        try {
          const p = JSON.parse(rawProfile);

          // Prefer explicit displayName, fall back to firstName+lastName
          const profileName =
            p.displayName ||
            (p.firstName ? `${p.firstName} ${p.lastName || ''}`.trim() : '') ||
            '';

          if (profileName) {
            this.sidebarName    = profileName;
            this.sidebarInitial = (profileName[0] || 'U').toUpperCase();
          }

          if (p.email)  this.sidebarEmail = p.email;

          // Avatar: only use if it's a valid data URI
          this.avatarSrc = (p.avatar && p.avatar.startsWith('data:image'))
            ? p.avatar
            : '';
        } catch (parseErr) {
          console.warn('[Sidebar] ftProfile parse error:', parseErr);
        }
      }

      console.log('[Sidebar] Final display → name:', this.sidebarName,
                  '| role:', this.sidebarRole, '| email:', this.sidebarEmail);

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
  // ════════════════════════════════════════

  private normalizeRole(role: string): string {
    if (!role) return 'admin';
    const r = role.toLowerCase().replace(/[_\s]/g, '');
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
    if (!s) return '';
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