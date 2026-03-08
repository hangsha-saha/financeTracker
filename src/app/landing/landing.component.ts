import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit, OnDestroy {

  // ── Navbar ──
  isScrolled: boolean    = false;
  mobileMenuOpen: boolean = false;

  // ── Animated counter state ──
  counters = [
    { label: 'Restaurants Using',  target: 500,  current: 10, suffix: '+' },
    { label: 'Bills Generated',    target: 50000, current: 10, suffix: '+' },
    { label: 'Revenue Tracked',    target: 99,   current: 10, suffix: '%' },
    { label: 'Uptime Guaranteed',  target: 99.9, current: 10, suffix: '%', isDecimal: true },
  ];

  // ── Active FAQ ──
  activeFaq: number | null = null;

  readonly FEATURES = [
    {
      icon: '📊',
      title: 'Smart Dashboard',
      desc: 'Real-time revenue charts, expense breakdowns, and profit trends — all in one beautiful view.',
      color: '#FF8C00'
    },
    {
      icon: '🧾',
      title: 'Instant Bill Generation',
      desc: 'Create professional bills with voucher support, tax calculation, and one-click printing.',
      color: '#4CAF50'
    },
    {
      icon: '📦',
      title: 'Inventory Control',
      desc: 'Track stock levels, get low-stock alerts at 30% threshold, and never run out unexpectedly.',
      color: '#2196F3'
    },
    {
      icon: '👥',
      title: 'Employee Management',
      desc: 'Manage staff records, salary tracking, and payment status all from one place.',
      color: '#9C27B0'
    },
    {
      icon: '🏪',
      title: 'Vendor Payments',
      desc: 'Track vendor dues, mark payments as cleared, and keep your supplier relationships healthy.',
      color: '#EF5350'
    },
    {
      icon: '📈',
      title: 'Financial Reports',
      desc: 'Income vs expense analysis, category-wise breakdowns, and exportable monthly reports.',
      color: '#FF8C00'
    },
  ];

  readonly FAQS = [
    {
      q: 'Is FinanceTracker suitable for small restaurants?',
      a: 'Absolutely. FinanceTracker is built specifically for small to medium restaurants. The interface is simple enough for non-technical staff and powerful enough for full financial management.'
    },
    {
      q: 'Can multiple staff members use the same account?',
      a: 'Yes. Managers and Waiters can have their own login credentials with role-based access. Admin controls what each role can see and do.'
    },
    {
      q: 'Is my data safe?',
      a: 'All your data is stored securely. We use industry-standard encryption for sensitive fields and your profile data is never shared with third parties.'
    },
    {
      q: 'Can I print bills directly from the app?',
      a: 'Yes. The Generate Bill page has a built-in print preview that hides the interface and prints only the clean bill — ready for the customer.'
    },
    {
      q: 'Does it work on mobile?',
      a: 'FinanceTracker is fully responsive. All pages adapt to mobile and tablet screens so you can manage your restaurant on the go.'
    },
  ];

  private counterInterval: any;
  private counterStarted = false;

  constructor(private router: Router) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    clearInterval(this.counterInterval);
  }

  // ── Scroll listener for navbar + counter trigger ──
  @HostListener('window:scroll', [])
  onScroll(): void {
    this.isScrolled = window.scrollY > 60;

    // Start counters when stats section is in view
    if (!this.counterStarted) {
      const el = document.getElementById('statsSection');
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight - 100) {
          this.startCounters();
        }
      }
    }
  }

  // ── Animated counters ──
  startCounters(): void {
    this.counterStarted = true;
    const duration = 2000;
    const steps    = 60;
    const interval = duration / steps;

    this.counterInterval = setInterval(() => {
      let allDone = true;
      this.counters.forEach(c => {
        if (c.current < c.target) {
          allDone = false;
          const increment = c.target / steps;
          c.current = Math.min(
            c.isDecimal
              ? Math.round((c.current + increment) * 10) / 10
              : Math.round(c.current + increment),
            c.target
          );
        }
      });
      if (allDone) clearInterval(this.counterInterval);
    }, interval);
  }

  // ── FAQ toggle ──
  toggleFaq(index: number): void {
    this.activeFaq = this.activeFaq === index ? null : index;
  }

  // ── Navigation ──
  goToLogin(): void    { this.router.navigate(['/login']); }
  goToRegister(): void { this.router.navigate(['/register']); }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  scrollTo(sectionId: string): void {
    this.mobileMenuOpen = false;
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}