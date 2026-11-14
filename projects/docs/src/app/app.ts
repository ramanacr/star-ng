import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StarConfirmHost } from 'star-ng/dialog';
import { StarThemeSwitch } from 'star-ng/theme-switch';
import { StarToast } from 'star-ng/toast';
import { DOCS_NAV, DocsNavGroup } from './nav';

/** Shell of the docs application: header, grouped side navigation with search, page outlet. */
@Component({
  selector: 'docs-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    StarToast,
    StarConfirmHost,
    StarThemeSwitch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="docs-skip" href="#main">Skip to content</a>
    <header class="docs-header">
      <button
        type="button"
        class="docs-header__menu"
        aria-controls="docs-nav"
        [attr.aria-expanded]="navOpen()"
        aria-label="Navigation"
        (click)="navOpen.set(!navOpen())"
      >
        <i class="ph-bold ph-list" aria-hidden="true"></i>
      </button>
      <a class="docs-header__brand" routerLink="/">
        <i class="ph-fill ph-star" aria-hidden="true"></i>
        <span>StarNG</span>
      </a>
      <span class="docs-header__spacer"></span>
      <star-theme-switch />
      <a
        class="docs-header__link"
        href="https://github.com/ramanacr/star-ng"
        aria-label="StarNG on GitHub"
      >
        <i class="ph-bold ph-github-logo" aria-hidden="true"></i>
      </a>
    </header>

    <div class="docs-body">
      <nav id="docs-nav" class="docs-nav" [class.docs-nav--open]="navOpen()" aria-label="Pages">
        <label class="docs-nav__search">
          <span class="star-sr-only">Search pages</span>
          <i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i>
          <input
            type="search"
            placeholder="Search pages"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        </label>
        @for (group of groups(); track group.label) {
          <section class="docs-nav__group">
            <h2 class="docs-nav__heading">{{ group.label }}</h2>
            <ul>
              @for (item of group.items; track item.path) {
                <li>
                  <a
                    class="docs-nav__link"
                    [routerLink]="'/' + item.path"
                    routerLinkActive="docs-nav__link--active"
                    ariaCurrentWhenActive="page"
                    (click)="navOpen.set(false)"
                    >{{ item.label }}</a
                  >
                </li>
              }
            </ul>
          </section>
        } @empty {
          <p class="docs-nav__empty" role="status">No page matches "{{ query() }}".</p>
        }
      </nav>
      <main id="main" class="docs-main" tabindex="-1">
        <router-outlet />
      </main>
    </div>
    <star-toast />
    <star-confirm-host />
  `,
})
export class App {
  protected readonly navOpen = signal(false);
  protected readonly query = signal('');

  /** Navigation groups, filtered by the search text (label and keywords). */
  protected readonly groups = computed<readonly DocsNavGroup[]>(() => {
    const words = this.query().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return DOCS_NAV;
    return DOCS_NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const text = `${item.label} ${item.keywords ?? ''} ${group.label}`.toLocaleLowerCase();
        return words.every((word) => text.includes(word));
      }),
    })).filter((group) => group.items.length);
  });
}
