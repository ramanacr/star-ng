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
  // An unknown address shows a "Page not found" page (see `not-found.page.ts`). The prerender
  // step skips this wildcard route; GitHub Pages serves the client shell `404.html` for it.
  {
    path: '**',
    title: 'Page not found · StarNG',
    loadComponent: () => import('./not-found.page').then((m) => m.NotFoundPage),
  },
];
