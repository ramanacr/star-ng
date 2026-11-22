import { ViewportScroller } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  debounced,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StarConfirmHost } from '@star-ng/ui/dialog';
import { StarThemeSwitch } from '@star-ng/ui/theme-switch';
import { StarToast } from '@star-ng/ui/toast';
import { DOCS_NAV, DocsNavGroup } from './nav';

/** `localStorage` key of the saved text direction of the docs application. */
export const DIRECTION_KEY = 'star-direction';

/** Elements that take typed text: the search shortcut must not take their keys. */
const TYPING_TARGET =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="grid"], [role="treegrid"], [role="spinbutton"]';

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
  host: { '(document:keydown)': 'onDocumentKey($event)' },
  template: `
    <a class="docs-skip" href="#main">Skip to content</a>
    <header #header class="docs-header">
      <button
        #menuButton
        type="button"
        class="docs-header__button docs-header__menu"
        aria-controls="docs-nav"
        [attr.aria-expanded]="navOpen()"
        aria-label="Navigation"
        (click)="toggleNav()"
      >
        <i [class]="navOpen() ? 'ph-bold ph-x' : 'ph-bold ph-list'" aria-hidden="true"></i>
      </button>
      <a class="docs-header__brand" routerLink="/">
        <svg class="docs-header__mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <g class="docs-header__mark-brackets">
            <path d="M14 20L4 32L14 44" />
            <path d="M43 46L49 18" />
            <path d="M53 20L61 32L53 44" />
          </g>
          <path
            class="docs-header__mark-star"
            d="M28 19C28.9 28 31 30.1 40 31C31 31.9 28.9 34 28 43C27.1 34 25 31.9 16 31C25 30.1 27.1 28 28 19Z"
          />
        </svg>
        <span translate="no">StarNG</span>
      </a>
      <span class="docs-header__spacer"></span>
      <button
        type="button"
        class="docs-header__button docs-header__dir"
        [attr.aria-label]="'Text direction: ' + (rtl() ? 'RTL' : 'LTR')"
        [attr.aria-pressed]="rtl()"
        (click)="toggleDirection()"
      >
        {{ rtl() ? 'RTL' : 'LTR' }}
      </button>
      <star-theme-switch />
      <a
        class="docs-header__button"
        href="https://github.com/ramanacr/star-ng"
        aria-label="StarNG on GitHub"
      >
        <i class="ph-bold ph-github-logo" aria-hidden="true"></i>
      </a>
    </header>

    <div class="docs-body">
      <!-- Backdrop of the navigation drawer on a small screen. A click on it closes the drawer;
           the keyboard closes it with Escape. -->
      @if (navOpen()) {
        <div class="docs-backdrop" aria-hidden="true" (click)="closeNav(true)"></div>
      }
      <nav id="docs-nav" class="docs-nav" [class.docs-nav--open]="navOpen()" aria-label="Pages">
        <label class="docs-nav__search">
          <span class="star-sr-only">Search pages</span>
          <i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i>
          <input
            #search
            type="search"
            name="docs-search"
            placeholder="Search pages…"
            aria-describedby="docs-nav-search-hint"
            enterkeyhint="go"
            autocomplete="off"
            spellcheck="false"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keydown.enter)="openFirstMatch()"
          />
          <kbd class="docs-nav__key" aria-hidden="true">/</kbd>
        </label>
        <p id="docs-nav-search-hint" class="star-sr-only">
          Enter opens the first match. Slash moves the focus back to this field.
        </p>
        <!-- The live region is always in the page (it must exist before its text changes) and
             is read out once typing pauses. The visible "no match" text follows the list at
             once; it is hidden from screen readers, which get the live region. -->
        <p class="star-sr-only" role="status">{{ status() }}</p>
        @if (noMatch(); as text) {
          <p class="docs-nav__status" aria-hidden="true">{{ text }}</p>
        }
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
                    (click)="closeNav()"
                    >{{ item.label }}</a
                  >
                </li>
              }
            </ul>
          </section>
        }
      </nav>
      <!-- While the drawer is open, the page behind it is inert: Tab stays in the drawer. -->
      <main id="main" class="docs-main" tabindex="-1" [attr.inert]="navOpen() ? '' : null">
        <router-outlet />
      </main>
      <footer class="docs-footer" [attr.inert]="navOpen() ? '' : null">
        <p>
          PrimeNG, Angular Material, Ignite UI, Kendo UI, Syncfusion, DevExtreme and AG Grid are
          trademarks of their respective owners. StarNG has no affiliation with these owners, and
          they do not endorse it. The docs name these products only to show which StarNG API does
          the same job.
        </p>
      </footer>
    </div>
    <star-toast />
    <star-confirm-host />
  `,
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');
  private readonly search = viewChild.required<ElementRef<HTMLInputElement>>('search');
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');
  /** The navigation drawer of a small screen. On a wide screen the navigation is always shown. */
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
    // The drawer exists only on a small screen. When the window becomes wide, it closes, so the
    // page is never left inert behind a drawer that is not shown.
    afterNextRender(() => {
      const wide = this.document.defaultView?.matchMedia('(min-width: 800.02px)');
      wide?.addEventListener('change', (event) => {
        if (event.matches) this.navOpen.set(false);
      });
    });
  }

  protected toggleNav(): void {
    if (this.navOpen()) {
      this.closeNav();
      return;
    }
    this.navOpen.set(true);
    // The drawer shows after the next render; then the search field takes the focus.
    afterNextRender(() => this.search().nativeElement.focus(), { injector: this.injector });
  }

  /** Closes the drawer. With `restoreFocus`, the focus goes back to the menu button. */
  protected closeNav(restoreFocus = false): void {
    if (!this.navOpen()) return;
    this.navOpen.set(false);
    if (restoreFocus) this.menuButton().nativeElement.focus();
  }

  /** Opens the first page that matches the search text. */
  protected openFirstMatch(): void {
    const first = this.groups()[0]?.items[0];
    if (!this.query().trim() || !first) return;
    this.closeNav();
    void this.router.navigateByUrl('/' + first.path);
  }

  /**
   * Escape closes the drawer. Slash moves the focus to the page search. Ctrl+K is left to the
   * pages: the command palette example opens with it.
   */
  protected onDocumentKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.navOpen()) {
      event.preventDefault();
      this.closeNav(true);
      return;
    }
    const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (!slash || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof Element && target.closest(TYPING_TARGET)) return;
    event.preventDefault();
    const input = this.search().nativeElement;
    // On a small screen the field is in the closed drawer: opening the drawer focuses it.
    if (!input.offsetParent) {
      this.toggleNav();
      return;
    }
    input.focus();
    input.select();
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

  /** Navigation groups, filtered by the search text at once (label and keywords). */
  protected readonly groups = computed(() => filterNav(this.query()));

  /**
   * The search text once typing has paused for `SEARCH_STATUS_WAIT` ms. Experimental Angular
   * `debounced()` (22.0), used in the docs application only: the library uses stable APIs only.
   * The list filters at once; only the status below waits, so a screen reader reads the result
   * once per pause instead of once per key.
   */
  private readonly settledQuery = debounced(() => this.query(), SEARCH_STATUS_WAIT);

  /** Result of the settled search, for a screen reader (the live region). */
  protected readonly status = computed(() => {
    const query = this.settledQuery.value().trim();
    if (!query) return '';
    const count = countPages(filterNav(query));
    if (!count) return noMatchText(query);
    return count === 1 ? '1 page matches.' : `${count} pages match.`;
  });

  /** The visible "no match" text, at once with the list (empty while pages match). */
  protected readonly noMatch = computed(() => {
    const query = this.query().trim();
    return query && !this.groups().length ? noMatchText(query) : '';
  });
}

function noMatchText(query: string): string {
  return `No page matches “${query}”.`;
}

/** Wait of the search status after the last key, in ms. */
const SEARCH_STATUS_WAIT = 400;

/** The navigation groups whose pages contain every word of `query` (label, keywords, group). */
function filterNav(query: string): readonly DocsNavGroup[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return DOCS_NAV;
  return DOCS_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const text = `${item.label} ${item.keywords ?? ''} ${group.label}`.toLocaleLowerCase();
      return words.every((word) => text.includes(word));
    }),
  })).filter((group) => group.items.length);
}

function countPages(groups: readonly DocsNavGroup[]): number {
  return groups.reduce((sum, group) => sum + group.items.length, 0);
}
