import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { InventoryComponent } from './inventory/inventory.component';
import { IncomeComponent } from './income/income.component';
import { ExpenseComponent } from './expense/expense.component';
import { MenuComponent } from './menu/menu.component';
import { GenerateBillComponent } from './generate-bill/generate-bill.component';
import { EmployeesComponent } from './employees/employees.component';
import { ProfileComponent } from './profile/profile.component';
import { VendorsComponent } from './vendors/vendors.component';
import { RegisterComponent } from './register/register.component';
import { LandingComponent } from './landing/landing.component';
import { ViewBillsComponent } from './view-bills/view-bills.component';
import { ReportsComponent } from './reports/reports.component';

import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '',        redirectTo: 'login', pathMatch: 'full' },
  { path: 'login',   component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // All protected routes — AuthGuard redirects to /login if no token
  { path: 'dashboard',    component: DashboardComponent,   canActivate: [AuthGuard] },
  { path: 'inventory',    component: InventoryComponent,   canActivate: [AuthGuard] },
  { path: 'income',       component: IncomeComponent,      canActivate: [AuthGuard] },
  { path: 'expense',      component: ExpenseComponent,     canActivate: [AuthGuard] },
  { path: 'vendors',      component: VendorsComponent,     canActivate: [AuthGuard] },
  { path: 'employees',    component: EmployeesComponent,   canActivate: [AuthGuard] },
  { path: 'menu',         component: MenuComponent,        canActivate: [AuthGuard] },
  { path: 'generate-bill',component: GenerateBillComponent,canActivate: [AuthGuard] },
  { path: 'view-bills',   component: ViewBillsComponent,   canActivate: [AuthGuard] },
  { path: 'reports',      component: ReportsComponent,     canActivate: [AuthGuard] },
  { path: 'profile',      component: ProfileComponent,     canActivate: [AuthGuard] },

  { path: '**', redirectTo: 'login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }