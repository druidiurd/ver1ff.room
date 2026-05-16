import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/dashboard').then(m => m.DashboardComponent),
    title: 'Ver1ff Room',
  },
  {
    path: 'tool/:id',
    loadComponent: () => import('./components/terminal').then(m => m.TerminalComponent),
  },
  { path: '**', redirectTo: '' },
];
