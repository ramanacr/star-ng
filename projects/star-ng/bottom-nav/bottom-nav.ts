import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { starInlineKey } from '@star-ng/ui/core';

/**
 * One destination of `star-bottom-nav` (Ignite `igx-bottom-nav-item`). With `routerLink` or `href`
 * it is a link; without, a button that sets the `value` of the bar.
 */
@Component({
  selector: 'star-bottom-nav-item',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-bottom-nav__entry',
    role: 'listitem',
    '(focusin)': 'nav.onFocus(this)',
  },
  template: `
    <ng-template #body>
      @if (icon(); as icon) {
        <i class="star-bottom-nav__icon" [class]="icon" aria-hidden="true"></i>
      }
      <span class="star-bottom-nav__label">{{ label() }}</span>
      @if (badge() !== null) {
        <!-- The space keeps the label and the badge apart in the accessible name. -->
        {{ ' ' }}
        <span class="star-badge star-badge--danger star-badge--sm star-bottom-nav__badge">{{
          badge()
        }}</span>
      }
    </ng-template>
    @if (disabled()) {
      <button #focusable type="button" class="star-bottom-nav__item" disabled>
        <ng-container *ngTemplateOutlet="body" />
      </button>
    } @else if (routerLink() !== null) {
      <a
        #focusable
        class="star-bottom-nav__item"
        [routerLink]="routerLink()"
        routerLinkActive="star-bottom-nav__item--active"
        ariaCurrentWhenActive="page"
        [routerLinkActiveOptions]="{ exact: exact() }"
        [attr.tabindex]="tabIndex()"
        (isActiveChange)="routerActive.set($event)"
        (click)="nav.activate(this)"
        (keydown)="nav.onKeydown($event, this)"
      >
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else if (href() !== null) {
      <a
        #focusable
        class="star-bottom-nav__item"
        [class.star-bottom-nav__item--active]="active()"
        [href]="href()"
        [attr.aria-current]="active() ? 'page' : null"
        [attr.tabindex]="tabIndex()"
        (click)="nav.activate(this)"
        (keydown)="nav.onKeydown($event, this)"
      >
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else {
      <button
        #focusable
        type="button"
        class="star-bottom-nav__item"
        [class.star-bottom-nav__item--active]="active()"
        [attr.aria-current]="active() ? 'true' : null"
        [attr.tabindex]="tabIndex()"
        (click)="nav.activate(this)"
        (keydown)="nav.onKeydown($event, this)"
      >
        <ng-container *ngTemplateOutlet="body" />
      </button>
    }
  `,
})
export class StarBottomNavItem {
  protected readonly nav = inject(forwardRef(() => StarBottomNav));

  /** Key of the item. A button item sets the `value` of the bar to it. */
  readonly value = input<string | null>(null);
  /** Visible label, also the accessible name. */
  readonly label = input.required<string>();
  /** Phosphor icon class, for example `ph ph-house`. */
  readonly icon = input<string | null>(null);
  /** Short text on the icon, for example a count. A screen reader reads it after the label. */
  readonly badge = input<string | number | null>(null);
  /** Router link. The item is active (`aria-current="page"`) while its route is active. */
  readonly routerLink = input<string | readonly unknown[] | null>(null);
  /** With `routerLink`: active only on an exact URL match. */
  readonly exact = input(false, { transform: booleanAttribute });
  /** Link address. The item is active while `value` equals the `value` of the bar. */
  readonly href = input<string | null>(null);
  /** A disabled item is a disabled button, and the arrow keys skip it. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** @internal Set by `routerLinkActive`. */
  readonly routerActive = signal(false);
  private readonly focusable = viewChild<ElementRef<HTMLElement>>('focusable');

  /** Whether this item is the current destination. */
  readonly active = computed(() => {
    if (this.routerLink() !== null) return this.routerActive();
    const value = this.value();
    return value !== null && this.nav.value() === value;
  });

  protected readonly tabIndex = computed(() => (this.nav.tabStop() === this ? 0 : -1));

  /** Moves the focus to the item. */
  focus(): void {
    this.focusable()?.nativeElement.focus();
  }
}

/**
 * Bottom navigation (Ignite `igx-bottom-nav`, Kendo BottomNavigation): the tab bar at the bottom
 * of a mobile layout, with three to five destinations.
 *
 * ```html
 * <star-bottom-nav [(value)]="section" ariaLabel="Sections">
 *   <star-bottom-nav-item value="orders" label="Orders" icon="ph ph-package" badge="3" />
 *   <star-bottom-nav-item value="cities" label="Cities" icon="ph ph-map-pin" />
 * </star-bottom-nav>
 * ```
 *
 * Use it with `value` (button items, the page shows the view of the value) or with router links
 * (`routerLink`; the active route marks the item). The bar is a `nav` landmark with a list. The
 * current item has `aria-current` (`page` for links, `true` for buttons). The bar is one Tab stop:
 * the arrow keys, Home and End move between the items (roving tabindex).
 */
@Component({
  selector: 'star-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-bottom-nav',
    '[class.star-bottom-nav--fixed]': 'fixed()',
  },
  template: `
    <nav class="star-bottom-nav__nav" [attr.aria-label]="ariaLabel()">
      <div class="star-bottom-nav__list" role="list"><ng-content /></div>
    </nav>
  `,
})
export class StarBottomNav {
  /** Value of the active button item. */
  readonly value = model<string | null>(null);
  /** Accessible name of the navigation landmark. */
  readonly ariaLabel = input<string | null>(null);
  /** Fixed to the bottom of the window, above the safe area of the device. */
  readonly fixed = input(false, { transform: booleanAttribute });

  private readonly items = contentChildren(StarBottomNavItem, { descendants: true });
  private readonly focused = signal<StarBottomNavItem | null>(null);

  /** @internal The item in the Tab order: the last focused one, else the active one, else the first. */
  readonly tabStop = computed(() => {
    const items = this.items().filter((item) => !item.disabled());
    const focused = this.focused();
    if (focused && items.includes(focused)) return focused;
    return items.find((item) => item.active()) ?? items[0] ?? null;
  });

  /** @internal Keeps the Tab stop on the item that took focus. */
  onFocus(item: StarBottomNavItem): void {
    if (!item.disabled()) this.focused.set(item);
  }

  /** @internal */
  activate(item: StarBottomNavItem): void {
    this.focused.set(item);
    const value = item.value();
    if (value !== null) this.value.set(value);
  }

  /** @internal Arrow keys, Home and End move the focus; Space activates a link. */
  onKeydown(event: KeyboardEvent, current: StarBottomNavItem): void {
    const items = this.items().filter((item) => !item.disabled());
    const index = items.indexOf(current);
    let next: StarBottomNavItem | undefined;
    // Arrow right means "next item in reading order": the left arrow in right-to-left.
    switch (starInlineKey(event)) {
      case 'ArrowRight':
        next = items[(index + 1) % items.length];
        break;
      case 'ArrowLeft':
        next = items[(index - 1 + items.length) % items.length];
        break;
      case 'Home':
        next = items[0];
        break;
      case 'End':
        next = items.at(-1);
        break;
      case ' ':
        // A link opens with Enter only; a tab bar item opens with Space too.
        if (event.target instanceof HTMLAnchorElement) {
          event.preventDefault();
          event.target.click();
        }
        return;
      default:
        return;
    }
    if (!next) return;
    event.preventDefault();
    this.focused.set(next);
    next.focus();
  }
}

/** The bar and its item, for one-line imports. */
export const STAR_BOTTOM_NAV = [StarBottomNav, StarBottomNavItem] as const;
