import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

/**
 * Page of an address that matches no docs page. GitHub Pages serves the client-rendered shell
 * (`404.html`, status 404) for such an address; the router then shows this page. It names the
 * address, so the visitor sees which link is wrong, and points to the ways forward.
 */
@Component({
  selector: 'docs-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="docs-page docs-not-found">
      <header class="docs-page__header">
        <h1>Page not found</h1>
        <p class="docs-page__lead">
          No docs page has the address <code>{{ address }}</code>. The page can have a new name, or
          the link has a typing error.
        </p>
      </header>
      <ul class="docs-not-found__actions">
        <li>
          <a class="docs-cta docs-cta--primary" routerLink="/">Go to the home page</a>
        </li>
        <li>
          <a class="docs-cta" routerLink="/guides/getting-started">Read Getting started</a>
        </li>
      </ul>
      <p>
        To find a control, type its name in <strong>Search pages</strong> in the navigation
        (keyboard shortcut <kbd>/</kbd>).
      </p>
    </div>
  `,
})
export class NotFoundPage {
  protected readonly address = inject(Router).url;
}
