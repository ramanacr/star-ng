import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ApplicationConfig,
  ApplicationRef,
  EnvironmentInjector,
  inject,
  PLATFORM_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
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

/** True in a browser that has the WebMCP API (`document.modelContext` or `navigator.modelContext`). */
function hasWebMcp(): boolean {
  const hosts = [globalThis.document, globalThis.navigator] as unknown as ({
    modelContext?: { registerTool?: unknown };
  } | null)[];
  return hosts.some((host) => typeof host?.modelContext?.registerTool === 'function');
}

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
      //
      // The scroll (to the top, or to the anchor) happens in the update callback of the
      // transition, so the new page is shown with its final scroll position and layout
      // (`e2e/docs-navigation.spec.ts` checks it). While the fade runs, the browser sends every
      // pointer event to the document element, not to the page: a press during the fade does
      // nothing. So the first press ends the fade at once, and the next one reaches the page.
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition, from, to }) => {
          const doc = inject(DOCUMENT);
          if (starPrefersReducedMotion(doc) || pageOf(from) === pageOf(to)) {
            transition.skipTransition();
            return;
          }
          const skip = () => transition.skipTransition();
          const stop = () => doc.removeEventListener('pointerdown', skip, true);
          doc.addEventListener('pointerdown', skip, true);
          transition.finished.then(stop, stop);
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
    // Experimental WebMCP tools for AI agents in the browser (see `webmcp.ts`). The tools module
    // loads with a dynamic `import()` after the application is stable, and only in a browser
    // that has the WebMCP API, so the initial bundle does not carry it. The initializer does not
    // wait for the import.
    provideAppInitializer(() => {
      if (!isPlatformBrowser(inject(PLATFORM_ID)) || !hasWebMcp()) return;
      const injector = inject(EnvironmentInjector);
      inject(ApplicationRef)
        .whenStable()
        .then(() => import('./webmcp'))
        .then((module) => module.declareDocsWebMcpTools(injector))
        .catch(() => undefined);
    }),
  ],
};
