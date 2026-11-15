import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withNoIncrementalHydration } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    // The build prerenders every page (see `app.routes.server.ts`). Hydration reuses that DOM
    // instead of drawing the page a second time. Incremental hydration is off: it adds an inline
    // script (event replay), which the Content Security Policy of `index.html` does not allow.
    provideClientHydration(withNoIncrementalHydration()),
  ],
};
