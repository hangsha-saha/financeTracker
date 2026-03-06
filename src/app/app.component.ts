import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  showSidebar: boolean = false;

  private readonly HIDE_SIDEBAR_ROUTES = [
    '/login',
    '/register',
    '/landing',
    '/'
  ];

  constructor(public router: Router) {}

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const fullUrl = event.urlAfterRedirects ?? event.url;

      // Strip query params and fragments before checking
      const path = fullUrl.split('?')[0].split('#')[0];

      this.showSidebar = !this.HIDE_SIDEBAR_ROUTES.includes(path);
    });
  }
}