import { DOCUMENT } from '@angular/common';
import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { starPrefersReducedMotion } from '@star-ng/ui/core';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      // Route components read query parameters as inputs (the Tabs page reads `view`).
      withComponentInputBinding(),
      // A page change cross-fades with the View Transitions API (no effect in a browser without
      // it). Not on the first page, and not when the visitor asks for reduced motion.
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition }) => {
          if (starPrefersReducedMotion(inject(DOCUMENT))) transition.skipTransition();
        },
      }),
    ),
    // The build prerenders every page (see `app.routes.server.ts`). Hydration reuses that DOM
    // instead of drawing the page a second time. Incremental hydration (which turns on event
    // replay) lets a `@defer (hydrate on ...)` block keep its prerendered DOM and load its code
    // later. Event replay adds two inline scripts to each page; `tools/csp-hashes.mjs` adds their
    // hashes to the Content Security Policy of that page after the build.
    provideClientHydration(withIncrementalHydration()),
  ],
};
