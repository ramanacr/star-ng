import { Routes } from '@angular/router';
import { DOCS_ROUTES } from './nav';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'StarNG',
    loadComponent: () => import('./home.page').then((m) => m.HomePage),
  },
  ...DOCS_ROUTES,
  { path: '**', redirectTo: '' },
];
