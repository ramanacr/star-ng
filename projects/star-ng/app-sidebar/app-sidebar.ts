import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DOCUMENT,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  STAR_UI_TEXT,
  starInlineKey,
  StarPart,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarDrawer } from '@star-ng/ui/drawer';
import { StarTooltip } from '@star-ng/ui/tooltip';

/** Display of `star-app-sidebar`: in the page layout, or in a drawer below the breakpoint. */
export type StarAppSidebarMode = 'static' | 'overlay';

/** Class of every link and button of the sidebar; the roving focus moves between them. */
const LINK = '.star-app-sidebar__link';

/**
 * Application sidebar (PrimeNG 22 `p-sidebar` with its compound parts): the main navigation of
 * an application. It is a `<nav>` landmark named by `ariaLabel` (default "Main navigation").
 *
 * Parts: `star-app-sidebar-header`, `star-app-sidebar-section` (a heading and its items),
 * `star-app-sidebar-item` (icon, label, `routerLink` or `href`, badge, nested items) and
 * `star-app-sidebar-footer`.
 *
 * - `mode="static"` keeps the sidebar in the layout. `mode="overlay"` does the same above
 *   `breakpoint`; below it the sidebar moves into a `star-drawer` at the inline start, opened with
 *   `[(visible)]` (for example from a menu button in the app bar).
 * - `[(collapsed)]` shows only the icons; the labels become tooltips (`starTooltip`) and stay the
 *   accessible names.
 * - Keyboard: one tab stop. Arrow down and Arrow up move between the visible items, Home and End
 *   go to the first and the last. Enter follows a link or opens a group. Arrow right opens a group
 *   or moves into it, Arrow left closes it or moves to its parent (swapped in right-to-left).
 *
 * ```html
 * <star-app-sidebar mode="overlay" [(collapsed)]="collapsed" [(visible)]="menuOpen">
 *   <star-app-sidebar-header>Acme</star-app-sidebar-header>
 *   <star-app-sidebar-section heading="Sales">
 *     <star-app-sidebar-item label="Orders" icon="ph-bold ph-package" routerLink="/orders" badge="4" />
 *     <star-app-sidebar-item label="Reports" icon="ph-bold ph-chart-bar">
 *       <star-app-sidebar-item label="Monthly" routerLink="/reports/monthly" />
 *     </star-app-sidebar-item>
 *   </star-app-sidebar-section>
 * </star-app-sidebar>
 * ```
 */
@Component({
  selector: 'star-app-sidebar',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet, StarDrawer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-app-sidebar',
    '[class.star-app-sidebar--collapsed]': 'iconOnly()',
    '[class.star-app-sidebar--drawer]': 'inDrawer()',
  },
  template: `
    <ng-template #content>
      <!-- The keys come from the links inside (roving focus); the nav itself is not focusable. -->
      <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
      <nav
        starPart="nav"
        class="star-app-sidebar__nav"
        [attr.aria-label]="label()"
        (keydown)="onKeydown($event)"
        (focusin)="onFocusin($event)"
      >
        <ng-content select="star-app-sidebar-header" />
        <div starPart="body" class="star-app-sidebar__body"><ng-content /></div>
        <ng-content select="star-app-sidebar-footer" />
      </nav>
    </ng-template>
    @if (inDrawer()) {
      <star-drawer
        [(visible)]="visible"
        position="start"
        [drawerSize]="drawerSize()"
        [ariaLabel]="label()"
        dismissableMask
      >
        <ng-container *ngTemplateOutlet="content" />
      </star-drawer>
    } @else {
      <ng-container *ngTemplateOutlet="content" />
    }
  `,
})
export class StarAppSidebar {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** `static`: always in the layout. `overlay`: in a drawer below `breakpoint`. */
  readonly mode = input<StarAppSidebarMode>('static');
  /** Width in pixels below which an `overlay` sidebar moves into a drawer. */
  readonly breakpoint = input(768, { transform: numberAttribute });
  /** Icons only; the labels become tooltips. No effect in the drawer. */
  readonly collapsed = model(false);
  /** Open state of the drawer (`overlay` mode below the breakpoint). */
  readonly visible = model(false);
  /** Name of the `<nav>` landmark. Defaults to the `mainNavigation` text. */
  readonly ariaLabel = input<string | null>(null);
  /** Width of the drawer, a CSS length. */
  readonly drawerSize = input('18rem');

  /** `true` while the viewport is narrower than `breakpoint` (browser only). */
  private readonly narrow = signal(false);
  private readonly browser = signal(false);
  /** @internal The sidebar is in its drawer. */
  readonly inDrawer = computed(() => this.mode() === 'overlay' && this.narrow());
  /** @internal Icons only. */
  readonly iconOnly = computed(() => this.collapsed() && !this.inDrawer());
  protected readonly label = computed(() => this.ariaLabel() ?? this.text.mainNavigation);

  /** The link that keeps the tab stop: the last one with the focus. */
  private focused: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => this.browser.set(true));
    effect((onCleanup) => {
      const view = this.document.defaultView;
      if (!this.browser() || this.mode() !== 'overlay' || !view?.matchMedia) {
        this.narrow.set(false);
        return;
      }
      const query = view.matchMedia(`(max-width: ${this.breakpoint() - 0.02}px)`);
      const update = () => this.narrow.set(query.matches);
      update();
      query.addEventListener?.('change', update);
      onCleanup(() => query.removeEventListener?.('change', update));
    });
    // Leaving drawer mode (wider viewport, or mode "static") closes the drawer state, so the
    // drawer does not open by itself when the viewport becomes narrow again.
    effect(() => {
      if (!this.inDrawer() && untracked(this.visible)) this.visible.set(false);
    });
    afterEveryRender(() => this.syncTabStops());
  }

  /** @internal A leaf item was activated: the drawer closes. */
  onNavigate(): void {
    if (this.inDrawer()) this.visible.set(false);
  }

  /** The links and buttons that are shown now, in order. */
  private links(): HTMLElement[] {
    const nav = this.navElement();
    if (!nav) return [];
    return [...nav.querySelectorAll<HTMLElement>(LINK)].filter((link) => !link.closest('[hidden]'));
  }

  private navElement(): HTMLElement | null {
    // The nav lives in the host or, below the breakpoint, in the drawer inside the host.
    return this.host.querySelector<HTMLElement>('.star-app-sidebar__nav');
  }

  /** Gives the tab stop to one link: the last focused, the current page or the first. */
  private syncTabStops(): void {
    const links = this.links();
    if (!links.length) return;
    const stop =
      (this.focused && links.includes(this.focused) ? this.focused : null) ??
      links.find((link) => link.getAttribute('aria-current') === 'page') ??
      links.find((link) => link.hasAttribute('aria-current')) ??
      links[0];
    for (const link of this.host.querySelectorAll<HTMLElement>(LINK)) {
      const index = link === stop ? 0 : -1;
      // The attribute, not only the property: links are focusable without it.
      if (link.getAttribute('tabindex') !== String(index))
        link.setAttribute('tabindex', String(index));
    }
  }

  protected onFocusin(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    if (!target.matches?.(LINK)) return;
    this.focused = target;
    this.syncTabStops();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (!target.matches?.(LINK)) return;
    const links = this.links();
    const index = links.indexOf(target);
    let next: HTMLElement | undefined;
    switch (event.key) {
      case 'ArrowDown':
        next = links[Math.min(index + 1, links.length - 1)];
        break;
      case 'ArrowUp':
        next = links[Math.max(index - 1, 0)];
        break;
      case 'Home':
        next = links[0];
        break;
      case 'End':
        next = links[links.length - 1];
        break;
      default:
        return;
    }
    event.preventDefault();
    this.focusLink(next);
  }

  /** @internal Moves the focus and the tab stop to a link. */
  focusLink(link: HTMLElement | undefined): void {
    if (!link) return;
    this.focused = link;
    this.syncTabStops();
    link.focus();
  }
}

/** Top area of `star-app-sidebar`, for example the product name or logo. */
@Component({
  selector: 'star-app-sidebar-header',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-app-sidebar__header' },
  template: `<ng-content />`,
})
export class StarAppSidebarHeader {}

/** Bottom area of `star-app-sidebar`, for example the user or a collapse button. */
@Component({
  selector: 'star-app-sidebar-footer',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-app-sidebar__footer' },
  template: `<ng-content />`,
})
export class StarAppSidebarFooter {}

/**
 * A titled group of items in `star-app-sidebar`. The heading names the group for screen readers.
 * In the collapsed sidebar the heading is hidden visually and a line separates the sections.
 */
@Component({
  selector: 'star-app-sidebar-section',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-app-sidebar__section' },
  template: `
    @if (heading()) {
      <div starPart="heading" class="star-app-sidebar__heading" [id]="headingId">
        {{ heading() }}
      </div>
    }
    <div
      starPart="items"
      class="star-app-sidebar__items"
      role="group"
      [attr.aria-labelledby]="heading() ? headingId : null"
    >
      <ng-content />
    </div>
  `,
})
export class StarAppSidebarSection {
  /** Heading of the section. */
  readonly heading = input('');
  protected readonly headingId = inject(_IdGenerator).getId('star-app-sidebar-heading-');
}

/**
 * One destination of `star-app-sidebar`. With `routerLink` it is a router link with
 * `aria-current="page"` while its route is active (`routerLinkActive`); with `href` a plain link
 * (set `active` yourself); without either, a button that emits `activated`. With nested
 * `star-app-sidebar-item` children it is a button that opens and closes them (`expanded`).
 */
@Component({
  selector: 'star-app-sidebar-item',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet, RouterLink, RouterLinkActive, StarTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-app-sidebar__item',
    '[class.star-app-sidebar__item--nested]': 'parent !== null',
  },
  template: `
    <ng-template #body>
      @if (icon(); as icon) {
        <i starPart="icon" class="star-app-sidebar__icon" [class]="icon" aria-hidden="true"></i>
      } @else if (sidebar.iconOnly()) {
        <span
          starPart="icon"
          class="star-app-sidebar__icon star-app-sidebar__initial"
          aria-hidden="true"
          >{{ label().charAt(0) }}</span
        >
      }
      <span starPart="label" class="star-app-sidebar__label">{{ label() }}</span>
      @if (badge() !== null) {
        <!-- The space keeps the label and the badge apart in the accessible name. -->
        {{ ' ' }}
        <span
          starPart="badge"
          class="star-badge star-badge--danger star-badge--sm star-app-sidebar__badge"
          [attr.aria-hidden]="badgeLabel() ? 'true' : null"
          >{{ badge() }}</span
        >
        @if (badgeLabel()) {
          <span class="star-sr-only">{{ badgeLabel() }}</span>
        }
      }
      @if (hasChildren()) {
        <i
          starPart="chevron"
          class="ph-bold ph-caret-right star-app-sidebar__chevron"
          aria-hidden="true"
        ></i>
      }
    </ng-template>
    @if (hasChildren()) {
      <button
        starPart="link"
        type="button"
        class="star-app-sidebar__link"
        [attr.aria-expanded]="expanded()"
        [attr.aria-controls]="groupId"
        [starTooltip]="tooltip()"
        starTooltipPosition="end"
        (click)="toggle()"
        (keydown)="onKeydown($event)"
      >
        <ng-container *ngTemplateOutlet="body" />
      </button>
    } @else if (routerLink() !== null) {
      <a
        starPart="link"
        class="star-app-sidebar__link"
        [routerLink]="routerLink()"
        routerLinkActive="star-app-sidebar__link--active"
        ariaCurrentWhenActive="page"
        [routerLinkActiveOptions]="{ exact: exact() }"
        [starTooltip]="tooltip()"
        starTooltipPosition="end"
        (click)="activate()"
        (keydown)="onKeydown($event)"
      >
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else if (href() !== null) {
      <a
        starPart="link"
        class="star-app-sidebar__link"
        [class.star-app-sidebar__link--active]="active()"
        [attr.href]="href()"
        [attr.aria-current]="active() ? 'page' : null"
        [starTooltip]="tooltip()"
        starTooltipPosition="end"
        (click)="activate()"
        (keydown)="onKeydown($event)"
      >
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else {
      <button
        starPart="link"
        type="button"
        class="star-app-sidebar__link"
        [class.star-app-sidebar__link--active]="active()"
        [attr.aria-current]="active() ? 'true' : null"
        [starTooltip]="tooltip()"
        starTooltipPosition="end"
        (click)="activate()"
        (keydown)="onKeydown($event)"
      >
        <ng-container *ngTemplateOutlet="body" />
      </button>
    }
    <div
      starPart="group"
      class="star-app-sidebar__group"
      role="group"
      [id]="groupId"
      [attr.aria-label]="label()"
      [hidden]="!hasChildren() || !expanded()"
    >
      <ng-content select="star-app-sidebar-item" />
    </div>
  `,
})
export class StarAppSidebarItem {
  protected readonly sidebar = inject(StarAppSidebar);
  /** @internal The item this one is nested in. */
  readonly parent = inject(StarAppSidebarItem, { optional: true, skipSelf: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Text of the item. In the collapsed sidebar it is the tooltip and stays the accessible name. */
  readonly label = input.required<string>();
  /** Icon classes, for example `ph-bold ph-house`. Without one, the collapsed sidebar shows the first letter. */
  readonly icon = input<string | null>(null);
  /** Router link. `aria-current="page"` follows the active route. */
  readonly routerLink = input<string | readonly unknown[] | null>(null);
  /** With `routerLink`: the item is active only on an exact URL match. */
  readonly exact = input(false, { transform: booleanAttribute });
  /** Plain link address, when there is no `routerLink`. */
  readonly href = input<string | null>(null);
  /**
   * Marks the item as the current one: `aria-current="page"` on an `href` link, `aria-current="true"`
   * on a button item.
   */
  readonly active = input(false, { transform: booleanAttribute });
  /** Badge text after the label, for example a count. */
  readonly badge = input<string | number | null>(null);
  /** Screen-reader text of the badge, for example "4 new". Replaces the badge text when set. */
  readonly badgeLabel = input<string | null>(null);
  /** Open state of the nested items. */
  readonly expanded = model(false);

  /** Emits when the user activates a link or button item (not a group). */
  readonly activated = output<void>();

  private readonly children = contentChildren(forwardRef(() => StarAppSidebarItem));
  protected readonly hasChildren = computed(() => this.children().length > 0);
  protected readonly groupId = inject(_IdGenerator).getId('star-app-sidebar-group-');
  protected readonly tooltip = computed(() => (this.sidebar.iconOnly() ? this.label() : ''));

  /** Opens or closes the nested items. */
  toggle(): void {
    this.expanded.update((open) => !open);
  }

  protected activate(): void {
    this.activated.emit();
    this.sidebar.onNavigate();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const key = starInlineKey(event, this.host);
    if (key !== 'ArrowRight' && key !== 'ArrowLeft') return;
    if (key === 'ArrowRight') {
      if (!this.hasChildren()) return;
      event.preventDefault();
      if (!this.expanded()) this.expanded.set(true);
      else this.sidebar.focusLink(this.firstChildLink());
      return;
    }
    if (this.hasChildren() && this.expanded()) {
      event.preventDefault();
      this.expanded.set(false);
    } else if (this.parent) {
      event.preventDefault();
      this.sidebar.focusLink(this.parent.ownLink());
    }
  }

  /** @internal The link or button of this item. */
  ownLink(): HTMLElement | undefined {
    return this.host.querySelector<HTMLElement>(`:scope > ${LINK}`) ?? undefined;
  }

  private firstChildLink(): HTMLElement | undefined {
    return (
      this.host.querySelector<HTMLElement>(`:scope > .star-app-sidebar__group ${LINK}`) ?? undefined
    );
  }
}
