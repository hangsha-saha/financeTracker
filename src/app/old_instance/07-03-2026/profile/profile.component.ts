import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

interface Profile {
  firstName: string;
  lastName: string;
  displayName: string;
  role: string;
  phone: string;
  dob: string;
  bio: string;
  email: string;
  restaurantName: string;
  gst: string;
  address: string;
  avatar: string;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {

  readonly ROLE_LABELS: any = {
    admin: 'Admin', manager: 'Manager',
    cashier: 'Cashier', staff: 'Staff'
  };

  readonly DEFAULT_AVATAR =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E" +
    "%3Crect width='120' height='120' fill='%23ff8c00' rx='60'/%3E" +
    "%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' " +
    "font-size='52' font-family='sans-serif' fill='white'%3EA%3C/text%3E%3C/svg%3E";

  // ── Profile state ──
  profile!: Profile;

  // ── Left card ──
  leftName: string  = '';
  leftBadge: string = '';
  leftEmail: string = '';
  avatarSrc: string = '';

  // ── Personal form fields ──
  fFirst: string   = '';
  fLast: string    = '';
  fDisplay: string = '';
  fRole: string    = 'admin';
  fPhone: string   = '';
  fDob: string     = '';
  fBio: string     = '';

  // ── Restaurant fields (shown in summary card) ──
  fRestaurant: string = '';
  fGst: string        = '';
  fAddress: string    = '';

  // ── Restaurant Modal ──
  restaurantModalOpen: boolean = false;
  mRestaurant: string = '';
  mGst: string        = '';
  mAddress: string    = '';

  // ── Password fields ──
  fCurPw: string  = '';
  fNewPw: string  = '';
  fConfPw: string = '';

  // Password visibility toggles
  showCurPw: boolean  = false;
  showNewPw: boolean  = false;
  showConfPw: boolean = false;

  // Password strength
  pwStrengthWidth: string = '0%';
  pwStrengthColor: string = '';
  pwStrengthLabel: string = 'Enter a password';

  // ── Toast ──
  toastMsg: string      = '';
  toastType: string     = '';
  toastVisible: boolean = false;
  private toastTimer: any;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.profile = this.getProfile();
    this.populateFields();
  }

  // ── Profile helpers ──
  getProfile(): Profile {
    try {
      const raw = localStorage.getItem('ftProfile');
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return {
      firstName: 'Admin', lastName: 'User', displayName: 'Admin User',
      role: 'admin', phone: '+91 98765 43210',
      email: 'admin@restaurant.com', dob: '1990-06-15',
      bio: 'Restaurant finance admin managing daily operations, billing, and vendor payments.',
      restaurantName: '', gst: '',
      address: '', avatar: this.DEFAULT_AVATAR,
    };
  }

  saveProfileToStorage(): void {
    localStorage.setItem('ftProfile', JSON.stringify(this.profile));
  }

  populateFields(): void {
    const p = this.profile;
    const rl = this.ROLE_LABELS[p.role] || 'Admin';
    const dn = p.displayName || `${p.firstName} ${p.lastName}`;

    // Left card
    this.leftName  = dn;
    this.leftBadge = rl;
    this.leftEmail = p.email;
    this.avatarSrc = p.avatar || this.DEFAULT_AVATAR;

    // Personal
    this.fFirst   = p.firstName;
    this.fLast    = p.lastName;
    this.fDisplay = p.displayName;
    this.fRole    = p.role;
    this.fPhone   = p.phone;
    this.fDob     = p.dob || '';
    this.fBio     = p.bio || '';

    // Restaurant summary fields
    this.fRestaurant = p.restaurantName || '';
    this.fGst        = p.gst || '';
    this.fAddress    = p.address || '';
  }

  // ── Restaurant data check ──
  hasRestaurantData(): boolean {
    return !!(this.fRestaurant || this.fGst || this.fAddress);
  }

  // ── Restaurant Modal ──
  openRestaurantModal(): void {
    this.mRestaurant = this.fRestaurant;
    this.mGst        = this.fGst;
    this.mAddress    = this.fAddress;
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
    this.profile.restaurantName = this.mRestaurant.trim();
    this.profile.gst            = this.mGst.trim();
    this.profile.address        = this.mAddress.trim();
    this.saveProfileToStorage();
    this.populateFields();
    this.closeRestaurantModal();
    this.showToast('✓ Restaurant details saved!', 'success');
  }

  // ── Save Personal ──
  savePersonal(): void {
    this.profile.firstName   = this.fFirst.trim();
    this.profile.lastName    = this.fLast.trim();
    this.profile.displayName = this.fDisplay.trim() || `${this.fFirst} ${this.fLast}`;
    this.profile.role        = this.fRole;
    this.profile.phone       = this.fPhone.trim();
    this.profile.dob         = this.fDob;
    this.profile.bio         = this.fBio.trim();
    this.saveProfileToStorage();
    this.populateFields();
    this.showToast('✓ Personal info saved!', 'success');
  }

  resetPersonal(): void {
    this.populateFields();
    this.showToast('Fields reset.', 'info');
  }

  // ── Password ──
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
      { w: '0%',   c: '',                  t: 'Enter a password' },
      { w: '25%',  c: 'var(--danger)',     t: 'Weak' },
      { w: '50%',  c: 'var(--warning)',    t: 'Fair' },
      { w: '75%',  c: 'var(--info)',       t: 'Good' },
      { w: '100%', c: 'var(--success)',    t: 'Strong ✓' },
    ];
    const m = levels[s];
    this.pwStrengthWidth = m.w;
    this.pwStrengthColor = m.c;
    this.pwStrengthLabel = m.t;
  }

  savePassword(): void {
    if (!this.fCurPw)            { this.showToast('Enter your current password.', 'error'); return; }
    if (this.fNewPw.length < 8)  { this.showToast('Password must be ≥ 8 characters.', 'error'); return; }
    if (this.fNewPw !== this.fConfPw) { this.showToast('Passwords do not match.', 'error'); return; }
    this.fCurPw = ''; this.fNewPw = ''; this.fConfPw = '';
    this.pwStrengthWidth = '0%'; this.pwStrengthColor = ''; this.pwStrengthLabel = 'Enter a password';
    this.showToast('✓ Password updated!', 'success');
  }

  // ── Session ──
  handleLogout(): void {
    if (confirm('Are you sure you want to logout?')) {
      this.router.navigate(['/login']);
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  // ── Toast ──
  showToast(msg: string, type: string = 'info'): void {
    this.toastMsg     = msg;
    this.toastType    = type;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible = false, 3000);
  }
}