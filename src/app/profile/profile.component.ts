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
  altEmail: string;
  restaurantName: string;
  gst: string;
  address: string;
  city: string;
  pincode: string;
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

  // ── Contact form fields ──
  fEmail: string      = '';
  fAltEmail: string   = '';
  fRestaurant: string = '';
  fGst: string        = '';
  fAddress: string    = '';
  fCity: string       = '';
  fPin: string        = '';

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
      restaurantName: 'FinanceTracker Restaurant', gst: '27AAPFU0939F1ZV',
      altEmail: '', address: '123 Main Street, City Center, Mumbai - 400001',
      city: 'Mumbai', pincode: '400001', avatar: this.DEFAULT_AVATAR,
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

    // Contact
    this.fEmail      = p.email;
    this.fAltEmail   = p.altEmail || '';
    this.fRestaurant = p.restaurantName || '';
    this.fGst        = p.gst || '';
    this.fAddress    = p.address || '';
    this.fCity       = p.city || '';
    this.fPin        = p.pincode || '';
  }

  // ── Avatar upload ──
  triggerAvatarUpload(): void {
    document.getElementById('avatarFileInput')?.click();
  }

  onAvatarSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast('Please choose an image file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.profile.avatar = e.target.result;
      this.avatarSrc      = e.target.result;
      this.saveProfileToStorage();
      this.showToast('✓ Profile photo updated!', 'success');
    };
    reader.readAsDataURL(file);
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

  // ── Save Contact ──
  saveContact(): void {
    this.profile.email          = this.fEmail.trim();
    this.profile.altEmail       = this.fAltEmail.trim();
    this.profile.restaurantName = this.fRestaurant.trim();
    this.profile.gst            = this.fGst.trim();
    this.profile.address        = this.fAddress.trim();
    this.profile.city           = this.fCity.trim();
    this.profile.pincode        = this.fPin.trim();
    this.saveProfileToStorage();
    this.populateFields();
    this.showToast('✓ Contact info saved!', 'success');
  }

  resetContact(): void {
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

  // ── Danger zone ──
  deleteAccount(): void {
    if (confirm('⚠️ Delete your account? This cannot be undone.')) {
      localStorage.removeItem('ftProfile');
      this.showToast('Account deleted.', 'error');
      setTimeout(() => this.router.navigate(['/dashboard']), 2000);
    }
  }

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