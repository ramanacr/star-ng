import { _IdGenerator } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLinkActive } from '@angular/router';
import { starInlineKey, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/**
 * The panel of a `star-tab-nav` (the `tabpanel` of the tabs pattern), for example around the
 * `router-outlet`: `<star-tab-nav-panel #panel><router-outlet /></star-tab-nav-panel>`. Pass it
 * to the bar with `[tabPanel]="panel"`. Material `mat-tab-nav-panel`.
 */
@Component({
  selector: 'star-tab-nav-panel',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-tab-nav-panel',
    role: 'tabpanel',
    tabindex: '0',
    '[id]': 'id',
    '[attr.aria-labelledby]': 'activeLinkId()',
  },
  template: `<ng-content />`,
})
export class StarTabNavPanel {
  readonly id = inject(_IdGenerator).getId('star-tab-nav-panel-');
  /** Id of the active link; set by the bar. */
  readonly activeLinkId = signal<string | null>(null);
}

/**
 * One link of `star-tab-nav`: `<a starTabLink routerLink="/orders" routerLinkActive>Orders</a>`.
 * The active state comes from `routerLinkActive` on the same link, or from the `active` input.
 * With a `tabPanel` on the bar, the link is a `tab`: `aria-selected`, `aria-controls` and a
 * roving `tabindex`. Without it, the link is a plain link with `aria-current="page"` when active.
 * Material `mat-tab-link`.
 */
@Directive({
  selector: 'a[starTabLink]',
  host: {
    class: 'star-tabs__tab star-tab-link',
    '[class.star-tabs__tab--active]': 'isActive()',
    '[class.star-tab-link--disabled]': 'disabled()',
    '[id]': 'id',
    '[attr.role]': 'nav.tabPanel() ? "tab" : null',
    '[attr.aria-selected]': 'nav.tabPanel() ? isActive() : null',
    '[attr.aria-controls]': 'nav.tabPanel()?.id ?? null',
    '[attr.aria-current]': '!nav.tabPanel() && isActive() ? "page" : null',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.tabindex]': 'tabIndex()',
    '(click)': 'onClick($event)',
    '(keydown)': 'nav.onKeydown($event, this)',
  },
})
export class StarTabLink {
  protected readonly nav = inject(forwardRef(() => StarTabNav));
  readonly element = inject<ElementRef<HTMLAnchorElement>>(ElementRef).nativeElement;
  readonly id = inject(_IdGenerator).getId('star-tab-link-');
  /** The link is the current page. Default: from `routerLinkActive` on the same link. */
  readonly active = input<boolean | null>(null);
  /** The link cannot be followed and the arrow keys skip it. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly routerActive = signal(false);
  readonly isActive = computed(() => this.active() ?? this.routerActive());
  protected readonly tabIndex = computed(() => {
    if (!this.nav.tabPanel()) return this.disabled() ? -1 : null;
    return this.nav.focusTarget() === this ? 0 : -1;
  });

  constructor() {
    const routerLinkActive = inject(RouterLinkActive, { self: true, optional: true });
    if (routerLinkActive) {
      const subscription = routerLinkActive.isActiveChange.subscribe((active) =>
        this.routerActive.set(active),
      );
      inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    }
  }

  protected onClick(event: MouseEvent): void {
    if (!this.disabled()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

/**
 * A bar of navigation links that look like tabs (Material `mat-tab-nav-bar`). Each link is an
 * `a[starTabLink]` with `routerLink`; the router decides the active one.
 *
 * ```html
 * <star-tab-nav ariaLabel="Order pages" [tabPanel]="panel">
 *   <a starTabLink routerLink="details" routerLinkActive>Details</a>
 *   <a starTabLink routerLink="history" routerLinkActive>History</a>
 * </star-tab-nav>
 * <star-tab-nav-panel #panel><router-outlet /></star-tab-nav-panel>
 * ```
 *
 * With `tabPanel`, the bar follows the WAI-ARIA tabs pattern: a `tablist` of `tab` links, one of
 * them in the tab order, Arrow left / right (Arrow up / down too), Home and End move the focus,
 * and Enter or Space follows the link. Without `tabPanel` it is a `navigation` landmark of plain
 * links (`aria-current="page"` on the active one), in the normal tab order.
 */
@Component({
  selector: 'star-tab-nav',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-tabs star-tab-nav',
    '[class.star-tabs--pill]': "variant() === 'pill'",
    '[class.star-tabs--align-center]': "alignment() === 'center'",
    '[class.star-tabs--align-end]': "alignment() === 'end'",
    '[class.star-tabs--align-stretch]': "alignment() === 'stretch'",
  },
  template: `
    <div data-star-part="navigation" class="star-tabs__nav">
      <div
        data-star-part="list"
        class="star-tabs__list"
        [attr.role]="tabPanel() ? 'tablist' : 'navigation'"
        [attr.aria-label]="ariaLabel()"
      >
        <ng-content />
      </div>
    </div>
  `,
})
export class StarTabNav {
  /** Accessible name of the bar. */
  readonly ariaLabel = input<string | null>(null);
  /** The panel that shows the content of the active link; turns on the tabs pattern. */
  readonly tabPanel = input<StarTabNavPanel | null>(null);
  readonly variant = input<'line' | 'pill'>('line');
  readonly alignment = input<'start' | 'center' | 'end' | 'stretch'>('start');

  private readonly links = contentChildren(StarTabLink, { descendants: true });
  /** The active link. */
  readonly activeLink = computed(() => this.links().find((link) => link.isActive()) ?? null);
  /** The link in the tab order (tabs pattern): the active one, else the first enabled one. */
  readonly focusTarget = computed(() => {
    const active = this.activeLink();
    if (active && !active.disabled()) return active;
    return this.links().find((link) => !link.disabled()) ?? null;
  });

  constructor() {
    effect(() => this.tabPanel()?.activeLinkId.set(this.activeLink()?.id ?? null));
  }

  /** Arrow keys, Home and End move the focus between the enabled links (tabs pattern only). */
  onKeydown(event: KeyboardEvent, link: StarTabLink): void {
    if (!this.tabPanel()) return;
    if (event.key === ' ') {
      event.preventDefault();
      link.element.click();
      return;
    }
    const enabled = this.links().filter((item) => !item.disabled());
    const index = enabled.indexOf(link);
    const key = starInlineKey(event, link.element);
    let next: StarTabLink | undefined;
    if (key === 'ArrowRight' || key === 'ArrowDown') next = enabled[(index + 1) % enabled.length];
    else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      next = enabled[(index - 1 + enabled.length) % enabled.length];
    } else if (key === 'Home') next = enabled[0];
    else if (key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    event.preventDefault();
    next.element.focus();
  }
}
