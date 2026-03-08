import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, AuthUser } from '../services/auth.service';
import { RestaurantService, Restaurant } from '../services/restaurant.service';
import { BillService, VoucherOption, CreateVoucherPayload } from '../services/bill.service';

@Component({
  selector:    'app-profile',
  templateUrl: './profile.component.html',
  styleUrls:   ['./profile.component.css']
})
export class ProfileComponent implements OnInit {

  readonly DEFAULT_AVATAR =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E" +
    "%3Crect width='120' height='120' fill='%23ff8c00' rx='60'/%3E" +
    "%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' " +
    "font-size='52' font-family='sans-serif' fill='white'%3EA%3C/text%3E%3C/svg%3E";

  // ── Left card ──
  leftName:  string = '';
  leftBadge: string = '';
  leftEmail: string = '';
  avatarSrc: string = '';

  // ── Personal form fields ──
  fFirst:   string = '';
  fLast:    string = '';
  fDisplay: string = '';
  fRole:    string = 'admin';
  fPhone:   string = '';
  fDob:     string = '';
  fBio:     string = '';

  // ── Restaurant state ──
  restaurants:          Restaurant[] = [];
  activeRestaurant:     Restaurant | null = null;
  isLoadingRestaurants: boolean = false;

  // ── Restaurant summary ──
  fRestaurant: string = '';
  fGst:        string = '';
  fAddress:    string = '';

  // ── Restaurant Modal ──
  restaurantModalOpen: boolean = false;
  mRestaurant:         string  = '';
  mGst:                string  = '';
  mAddress:            string  = '';
  isSavingRestaurant:  boolean = false;

  // ── Vouchers ──
  vouchers:         VoucherOption[] = [];
  isLoadingVouchers: boolean        = false;

  // ── Voucher Modal ──
  voucherModalOpen: boolean = false;
  vCode:            string  = '';
  vPercentage:      number | null = null;
  vMinAmount:       number | null = null;
  vExpireDate:      string  = '';
  vStatus:          number  = 1;
  isSavingVoucher:  boolean = false;

  // ── Password ──
  fCurPw:  string = '';
  fNewPw:  string = '';
  fConfPw: string = '';

  showCurPw:  boolean = false;
  showNewPw:  boolean = false;
  showConfPw: boolean = false;

  pwStrengthWidth: string = '0%';
  pwStrengthColor: string = '';
  pwStrengthLabel: string = 'Enter a password';

  // ── Toast ──
  toastMsg:     string  = '';
  toastType:    string  = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  constructor(
    private router:            Router,
    private authService:       AuthService,
    private restaurantService: RestaurantService,
    private billService:       BillService
  ) {}

  ngOnInit(): void {
    this.loadUserFromSession();
    this.loadRestaurants();
    this.loadVouchers();
  }

  // ════════════════════════════════════════
  // LOAD USER FROM ft_user SESSION
  // ════════════════════════════════════════

  loadUserFromSession(): void {
    const authUser = this.authService.getCurrentUser();
    if (authUser) {
      this.leftName  = authUser.userName || 'User';
      this.leftEmail = authUser.email    || '';
      this.leftBadge = this.getRoleLabel(authUser.role);

      this.fDisplay = authUser.userName || '';
      this.fFirst   = authUser.userName || '';
      this.fLast    = '';
      this.fRole    = this.normalizeRole(authUser.role);

      const rawProfile = localStorage.getItem('ftProfile');
      if (rawProfile) {
        try {
          const p = JSON.parse(rawProfile);
          this.avatarSrc = (p.avatar && p.avatar.startsWith('data:image'))
            ? p.avatar : this.generateAvatar(authUser.userName);
          if (p.phone)        this.fPhone   = p.phone;
          if (p.dob)          this.fDob     = p.dob;
          if (p.bio)          this.fBio     = p.bio;
          if (p.firstName)    this.fFirst   = p.firstName;
          if (p.lastName)     this.fLast    = p.lastName;
          if (p.displayName) {
            this.fDisplay  = p.displayName;
            this.leftName  = p.displayName;
          }
        } catch(e) {}
      } else {
        this.avatarSrc = this.generateAvatar(authUser.userName);
      }
    }
  }

  // ════════════════════════════════════════
  // LOAD RESTAURANTS
  // ════════════════════════════════════════

  loadRestaurants(): void {
    this.isLoadingRestaurants = true;
    this.restaurantService.getAll().subscribe({
      next: (list) => {
        this.isLoadingRestaurants = false;
        this.restaurants          = list;
        if (list.length > 0) {
          this.setActiveRestaurant(list[0]);
        }
      },
      error: (err) => {
        this.isLoadingRestaurants = false;
        console.error('Failed to load restaurants:', err);
      }
    });
  }

  setActiveRestaurant(r: Restaurant): void {
    this.activeRestaurant = r;
    this.fRestaurant      = r.restaurantName;
    this.fGst             = r.gstNumber;
    this.fAddress         = r.address;
  }

  hasRestaurantData(): boolean {
    return !!this.activeRestaurant;
  }

  // ════════════════════════════════════════
  // RESTAURANT MODAL
  // ════════════════════════════════════════

  openRestaurantModal(): void {
    if (this.activeRestaurant) {
      this.mRestaurant = this.activeRestaurant.restaurantName;
      this.mGst        = this.activeRestaurant.gstNumber;
      this.mAddress    = this.activeRestaurant.address;
    } else {
      this.mRestaurant = '';
      this.mGst        = '';
      this.mAddress    = '';
    }
    this.restaurantModalOpen = true;
  }

  closeRestaurantModal(): void {
    this.restaurantModalOpen = false;
  }

  saveRestaurant(): void {
    if (!this.mRestaurant.trim()) {
      this.showToast('Restaurant name is required.', 'error');
      return;
    }

    const payload = {
      restaurantName: this.mRestaurant.trim(),
      gstNumber:      this.mGst.trim(),
      address:        this.mAddress.trim()
    };

    this.isSavingRestaurant = true;

    if (this.activeRestaurant) {
      this.restaurantService.update(this.activeRestaurant.id, payload).subscribe({
        next: (updated) => {
          this.isSavingRestaurant = false;
          this.setActiveRestaurant(updated);
          const idx = this.restaurants.findIndex(r => r.id === updated.id);
          if (idx > -1) this.restaurants[idx] = updated;
          this.closeRestaurantModal();
          this.showToast('✓ Restaurant updated!', 'success');
        },
        error: (err) => {
          this.isSavingRestaurant = false;
          console.error('Update restaurant failed:', err);
          this.showToast('Failed to update restaurant.', 'error');
        }
      });
    } else {
      this.restaurantService.add(payload).subscribe({
        next: (created) => {
          this.isSavingRestaurant = false;
          this.restaurants.push(created);
          this.setActiveRestaurant(created);
          this.closeRestaurantModal();
          this.showToast('✓ Restaurant added!', 'success');
        },
        error: (err) => {
          this.isSavingRestaurant = false;
          console.error('Add restaurant failed:', err);
          this.showToast('Failed to add restaurant.', 'error');
        }
      });
    }
  }

  // ════════════════════════════════════════
  // VOUCHERS
  // ════════════════════════════════════════

  loadVouchers(): void {
    this.isLoadingVouchers = true;
    this.billService.getVouchers().subscribe({
      next: (list) => {
        this.isLoadingVouchers = false;
        this.vouchers          = list;
      },
      error: (err) => {
        this.isLoadingVouchers = false;
        console.error('Failed to load vouchers:', err);
      }
    });
  }

  openVoucherModal(): void {
    this.vCode        = '';
    this.vPercentage  = null;
    this.vMinAmount   = null;
    this.vExpireDate  = '';
    this.vStatus      = 1;
    this.voucherModalOpen = true;
  }

  closeVoucherModal(): void {
    this.voucherModalOpen = false;
  }

  saveVoucher(): void {
    // ── Validation ──
    if (!this.vCode.trim()) {
      this.showToast('Voucher code is required.', 'error');
      return;
    }
    if (!this.vPercentage || this.vPercentage <= 0 || this.vPercentage > 100) {
      this.showToast('Enter a valid percentage (1–100).', 'error');
      return;
    }
    if (this.vMinAmount === null || this.vMinAmount < 0) {
      this.showToast('Enter a valid minimum amount.', 'error');
      return;
    }
    if (!this.vExpireDate) {
      this.showToast('Expiry date is required.', 'error');
      return;
    }

    // Convert date from YYYY-MM-DD (input type=date) → DD-MM-YYYY (API format)
    const apiDate = this.formatDateForApi(this.vExpireDate);

    const payload: CreateVoucherPayload = {
      code:       this.vCode.trim().toUpperCase(),
      percentage: this.vPercentage,
      minAmount:  this.vMinAmount,
      expireDate: apiDate,
      status:     this.vStatus,
    };

    this.isSavingVoucher = true;

    this.billService.createVoucher(payload).subscribe({
      next: (res) => {
        this.isSavingVoucher = false;
        console.log('[Voucher] created:', res);
        this.closeVoucherModal();
        this.showToast(`✓ Voucher "${payload.code}" added!`, 'success');
        this.loadVouchers(); // refresh list
      },
      error: (err) => {
        this.isSavingVoucher = false;
        console.error('[Voucher] create failed:', err);
        this.showToast(
          err.error?.message || 'Failed to add voucher. Please try again.',
          'error'
        );
      }
    });
  }

  /** Convert YYYY-MM-DD → DD-MM-YYYY */
  private formatDateForApi(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  /** Convert DD-MM-YYYY → display string */
  formatDateDisplay(dateStr: string): string {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    // if DD-MM-YYYY
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }

  get voucherStatusLabel(): (v: VoucherOption) => string {
    return (v) => v.status === 1 ? 'Active' : 'Inactive';
  }

  // ════════════════════════════════════════
  // SAVE PERSONAL INFO
  // ════════════════════════════════════════

  savePersonal(): void {
    const displayName = this.fDisplay.trim()
      || `${this.fFirst} ${this.fLast}`.trim();

    const userId = this.authService.getCurrentUserId();
    this.authService.updateUser(userId, {
      userName: displayName
    }).subscribe({
      next:  (updated) => console.log('User updated:', updated),
      error: (err)     => console.error('updateUser API failed:', err)
    });

    const existing = this.getStoredProfile();
    const merged = {
      ...existing,
      firstName:   this.fFirst.trim(),
      lastName:    this.fLast.trim(),
      displayName: displayName,
      role:        this.fRole,
      phone:       this.fPhone.trim(),
      dob:         this.fDob,
      bio:         this.fBio.trim(),
      email:       this.leftEmail,
      avatar:      this.avatarSrc,
    };
    localStorage.setItem('ftProfile', JSON.stringify(merged));

    this.leftName  = displayName;
    this.leftBadge = this.getRoleLabel(this.fRole);
    this.authService.updateStoredUser({ userName: displayName });

    this.showToast('✓ Personal info saved!', 'success');
  }

  resetPersonal(): void {
    this.loadUserFromSession();
    this.showToast('Fields reset.', 'info');
  }

  // ════════════════════════════════════════
  // PASSWORD
  // ════════════════════════════════════════

  togglePw(field: 'cur' | 'new' | 'conf'): void {
    if (field === 'cur')  this.showCurPw  = !this.showCurPw;
    if (field === 'new')  this.showNewPw  = !this.showNewPw;
    if (field === 'conf') this.showConfPw = !this.showConfPw;
  }

  checkPwStrength(): void {
    const v = this.fNewPw;
    let s = 0;
    if (v.length >= 8)            s++;
    if (/[A-Z]/.test(v))          s++;
    if (/[0-9]/.test(v))          s++;
    if (/[^A-Za-z0-9]/.test(v))  s++;

    const levels = [
      { w: '0%',   c: '',               t: 'Enter a password' },
      { w: '25%',  c: 'var(--danger)',  t: 'Weak'             },
      { w: '50%',  c: 'var(--warning)', t: 'Fair'             },
      { w: '75%',  c: 'var(--info)',    t: 'Good'             },
      { w: '100%', c: 'var(--success)', t: 'Strong ✓'         },
    ];
    const m = levels[s];
    this.pwStrengthWidth = m.w;
    this.pwStrengthColor = m.c;
    this.pwStrengthLabel = m.t;
  }

  savePassword(): void {
    if (!this.fCurPw)                 { this.showToast('Enter your current password.', 'error'); return; }
    if (this.fNewPw.length < 8)       { this.showToast('Password must be ≥ 8 characters.', 'error'); return; }
    if (this.fNewPw !== this.fConfPw) { this.showToast('Passwords do not match.', 'error'); return; }
    this.fCurPw = ''; this.fNewPw = ''; this.fConfPw = '';
    this.pwStrengthWidth = '0%'; this.pwStrengthColor = ''; this.pwStrengthLabel = 'Enter a password';
    this.showToast('✓ Password updated!', 'success');
  }

  // ════════════════════════════════════════
  // LOGOUT / NAV
  // ════════════════════════════════════════

  handleLogout(): void {
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  private getRoleLabel(role: string | null): string {
    const map: any = {
      admin: 'Admin', manager: 'Manager',
      cashier: 'Cashier', staff: 'Staff', waiter: 'Waiter'
    };
    return map[(role || 'admin').toLowerCase()] || 'Admin';
  }

  private normalizeRole(role: string | null): string {
    if (!role) return 'admin';
    const r = role.toLowerCase();
    if (r.includes('manager')) return 'manager';
    if (r.includes('waiter'))  return 'waiter';
    if (r.includes('cashier')) return 'cashier';
    if (r.includes('staff'))   return 'staff';
    return 'admin';
  }

  private generateAvatar(name: string): string {
    const initial = (name || 'U')[0].toUpperCase();
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E` +
           `%3Crect width='120' height='120' fill='%23ff8c00' rx='60'/%3E` +
           `%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' ` +
           `font-size='52' font-family='sans-serif' fill='white'%3E${initial}%3C/text%3E%3C/svg%3E`;
  }

  private getStoredProfile(): any {
    try {
      const raw = localStorage.getItem('ftProfile');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 3000);
  }
}