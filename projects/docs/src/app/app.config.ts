import { DOCUMENT } from '@angular/common';
import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { starPrefersReducedMotion } from '@star-ng/ui/core';
import { routes } from './app.routes';
import { provideDocsWebMcpTools } from './webmcp';

/** The route config of the deepest active route: the page that the snapshot shows. */
function pageOf(snapshot: ActivatedRouteSnapshot): unknown {
  let route = snapshot;
  while (route.firstChild) route = route.firstChild;
  return route.routeConfig;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      // Route components read query parameters as inputs (the Tabs page reads `view`).
      withComponentInputBinding(),
      // A page change cross-fades with the View Transitions API (no effect in a browser without
      // it). Not on the first page, not when the visitor asks for reduced motion, and not when
      // only the query or the fragment changes (the same page stays, for example a tab link or
      // an anchor link).
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition, from, to }) => {
          if (starPrefersReducedMotion(inject(DOCUMENT)) || pageOf(from) === pageOf(to)) {
            transition.skipTransition();
          }
        },
      }),
    ),
    // The build prerenders every page (see `app.routes.server.ts`). Hydration reuses that DOM
    // instead of drawing the page a second time. Incremental hydration (which turns on event
    // replay) lets a `@defer (hydrate on ...)` block keep its prerendered DOM and load its code
    // later. It is the default of Angular 22; the feature is named here so the choice is visible.
    // Event replay adds two inline scripts to each page; `tools/csp-hashes.mjs` adds their
    // hashes to the Content Security Policy of that page after the build.
    provideClientHydration(withIncrementalHydration()),
    // Experimental WebMCP tools for AI agents in the browser (see `webmcp.ts`). They register
    // only in a browser that has the WebMCP API.
    provideDocsWebMcpTools(),
  ],
};
