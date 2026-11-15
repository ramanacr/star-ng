import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Every route of the router config is rendered to a static HTML file at build time. The builder
 * reads the route list from `app.routes.ts`, so a new page in `nav.ts` is prerendered without a
 * change here. The result is plain files: no server runs after the build.
 */
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Prerender }];
