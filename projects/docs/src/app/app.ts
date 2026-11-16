import { DOCUMENT, ViewportScroller } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StarConfirmHost } from '@star-ng/ui/dialog';
import { StarThemeSwitch } from '@star-ng/ui/theme-switch';
import { StarToast } from '@star-ng/ui/toast';
import { DOCS_NAV, DocsNavGroup } from './nav';

/** `localStorage` key of the saved text direction of the docs application. */
export const DIRECTION_KEY = 'star-direction';

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
    <header #header class="docs-header">
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
        <span class="docs-header__mark" aria-hidden="true"><i class="ph-fill ph-star"></i></span>
        <span>StarNG</span>
      </a>
      <span class="docs-header__spacer"></span>
      <button
        type="button"
        class="docs-header__dir"
        [attr.aria-label]="'Text direction: ' + (rtl() ? 'RTL' : 'LTR')"
        [attr.aria-pressed]="rtl()"
        (click)="toggleDirection()"
      >
        {{ rtl() ? 'RTL' : 'LTR' }}
      </button>
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
  private readonly document = inject(DOCUMENT);
  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');
  protected readonly navOpen = signal(false);
  /** Right-to-left layout: sets `dir` on `<html>` and is remembered in `localStorage`. */
  protected readonly rtl = signal(this.storedRtl());

  constructor() {
    // The header stays on top of the page. A link to an anchor (`#api`, an example heading)
    // scrolls the target to just below the header, not under it.
    inject(ViewportScroller).setOffset(() => [0, this.header().nativeElement.offsetHeight + 16]);
    // Set at once (not only in the effect), so the first render already has the direction.
    this.document.documentElement.dir = this.rtl() ? 'rtl' : 'ltr';
    effect(() => {
      this.document.documentElement.dir = this.rtl() ? 'rtl' : 'ltr';
    });
  }

  protected toggleDirection(): void {
    const next = !this.rtl();
    this.rtl.set(next);
    try {
      this.document.defaultView?.localStorage.setItem(DIRECTION_KEY, next ? 'rtl' : 'ltr');
    } catch {
      // Storage can be blocked (private mode): the choice then lasts for this visit only.
    }
  }

  private storedRtl(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem(DIRECTION_KEY) === 'rtl';
    } catch {
      return false;
    }
  }
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
