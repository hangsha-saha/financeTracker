import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { AuthGuard } from './guards/auth.guard';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { InventoryComponent } from './inventory/inventory.component';
import { IncomeComponent } from './income/income.component';
import { ExpenseComponent } from './expense/expense.component';
import { MenuComponent } from './menu/menu.component';

// ── NEW ──
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { GenerateBillComponent } from './generate-bill/generate-bill.component';
import { EmployeesComponent } from './employees/employees.component';
import { ProfileComponent } from './profile/profile.component';
import { VendorsComponent } from './vendors/vendors.component';
import { RegisterComponent } from './register/register.component';
import { LandingComponent } from './landing/landing.component';
import { ViewBillsComponent } from './view-bills/view-bills.component';
import { ReportsComponent } from './reports/reports.component';
import { NgApexchartsModule } from 'ng-apexcharts';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    AppComponent, LoginComponent, DashboardComponent,
    InventoryComponent, IncomeComponent, ExpenseComponent,
    MenuComponent,
    SidebarComponent,
    GenerateBillComponent,
    EmployeesComponent,
    ProfileComponent,
    VendorsComponent,
    RegisterComponent,
    LandingComponent,
    ViewBillsComponent,
    ReportsComponent   // ← add here
  ],
  imports: [BrowserModule, CommonModule, AppRoutingModule, FormsModule, NgApexchartsModule, HttpClientModule],
  providers: [AuthGuard,
  {
    provide:  HTTP_INTERCEPTORS,
    useClass: AuthInterceptor,
    multi:    true,
  }],
  bootstrap: [AppComponent]
})
export class AppModule { }