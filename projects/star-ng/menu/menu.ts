import { _IdGenerator } from '@angular/cdk/a11y';
import {
  CdkContextMenuTrigger,
  CdkMenu,
  CdkMenuGroup,
  CdkMenuItem,
  CdkMenuTrigger,
} from '@angular/cdk/menu';
import { ConnectedPosition, FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
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
  Injector,
  input,
  OnDestroy,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  StarButton,
  StarButtonAppearance,
  StarButtonSize,
  StarButtonVariant,
} from '@star-ng/ui/button';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarDirectionService,
  StarIconContext,
  StarPart,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

/** One menu entry (PrimeNG `MenuItem`). `items` makes a submenu (tiered menu). */
export interface StarMenuItem {
  readonly label?: string;
  /** Phosphor icon class, for example `ph-bold ph-pencil-simple`. */
  readonly icon?: string;
  readonly command?: (item: StarMenuItem) => void;
  /** Router link; renders the entry as an `<a>`. */
  readonly routerLink?: string | readonly unknown[];
  /** External link; renders an `<a href>`. */
  readonly url?: string;
  readonly disabled?: boolean;
  /** Renders a divider instead of an entry. */
  readonly separator?: boolean;
  /** Danger styling, for destructive actions. */
  readonly danger?: boolean;
  /** Keyboard hint shown at the end, for example `Ctrl+E`. */
  readonly shortcut?: string;
  readonly items?: readonly StarMenuItem[];
  /**
   * `star-menu` only: show `items` in place, as a group under a heading (`label`), not as a
   * submenu. PrimeNG `p-menu` shows every item with `items` this way (`#submenuheader`).
   */
  readonly group?: boolean;
}

/** Context of the `itemTemplate` of `star-menu` and of the `starMenuTemplate` slots. */
export interface StarMenuItemContext {
  /** The menu item. It is the same object that is in `items`, so extra fields are kept. */
  readonly $implicit: StarMenuItem;
  /**
   * Depth of the item, from `0`: `0` for the items of the root list or bar, `1` for the items of
   * their submenus, and so on. `undefined` in `start` and `end`.
   */
  readonly level?: number;
  /** The item opens a submenu (or a section of the panel menu). */
  readonly hasSubmenu?: boolean;
}

/**
 * Slot names of `starMenuTemplate`:
 * - `item`: the content of each item (icon, label and shortcut; the submenu arrow stays).
 *   PrimeNG `#item`.
 * - `itemIcon`: the icon of each item that has an `icon`. PrimeNG `#itemicon`.
 * - `submenuHeader`: the heading of a group (`star-menu` items with `group`, the columns of the
 *   mega menu). PrimeNG `#submenuheader`.
 * - `start` and `end`: content before and after the items. PrimeNG `#start` and `#end`.
 */
export type StarMenuSlotName = 'item' | 'itemIcon' | 'submenuHeader' | 'start' | 'end';

/**
 * Template slot of the menus (`star-menu`, `star-menubar`, `star-mega-menu`, `star-panel-menu`):
 * `<ng-template starMenuTemplate="item" let-item let-level="level">…</ng-template>`.
 *
 * The item is a `menuitem` (or a button or link in the panel menu) that owns focus and the
 * keyboard. Do not add focusable elements in `item`, `itemIcon` or `submenuHeader`, and keep the
 * label text in `item`: it is the accessible name. In a popup menu, Tab closes the menu, so keep
 * `start` and `end` free of focusable elements there too.
 */
@Directive({
  selector: 'ng-template[starMenuTemplate]',
  providers: [{ provide: StarSlot, useExisting: StarMenuTemplate }],
})
export class StarMenuTemplate extends StarSlot<StarMenuItemContext> {
  readonly name = 'menuTemplate';
  readonly starMenuTemplate = input.required<StarMenuSlotName>();

  override slotKey(): string {
    return this.starMenuTemplate();
  }

  static ngTemplateContextGuard(
    _dir: StarMenuTemplate,
    _ctx: unknown,
  ): _ctx is StarMenuItemContext {
    return true;
  }
}

export const STAR_MENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Makes the popup of a CDK menu trigger usable inside a modal `<dialog>`.
 *
 * A modal dialog makes the rest of the page inert. CDK puts a menu popup in the overlay
 * container, outside the dialog, so the popup shows but takes no click and no key. When the
 * trigger is inside a `<dialog>`, the popup goes into that dialog instead.
 *
 * CDK has no public option for this on `CdkMenuTrigger`, so this wraps its position
 * strategy factory. If a CDK update removes that factory, this does nothing and the e2e test
 * "popups inside a modal dialog" fails.
 */
export function keepMenuInsideDialog(
  trigger: CdkMenuTrigger | CdkContextMenuTrigger,
  element: HTMLElement,
): void {
  const target = trigger as unknown as {
    // The context menu trigger passes the pointer coordinates; the menu trigger passes nothing.
    _getOverlayPositionStrategy?: (...args: unknown[]) => FlexibleConnectedPositionStrategy;
  };
  const create = target._getOverlayPositionStrategy;
  if (typeof create !== 'function') return;
  target._getOverlayPositionStrategy = (...args: unknown[]) => {
    const strategy = create.apply(trigger, args);
    const dialog = element.closest('dialog');
    return dialog ? strategy.withPopoverLocation({ type: 'parent', element: dialog }) : strategy;
  };
}

/**
 * Applies `keepMenuInsideDialog` to every `cdkMenuTriggerFor` in a template that imports it
 * (submenus, menu bar items, cascade select).
 */
// The selector is the CDK attribute on purpose: the directive adds behaviour to that trigger.
// eslint-disable-next-line @angular-eslint/directive-selector
@Directive({ selector: '[cdkMenuTriggerFor]' })
export class StarMenuInDialog {
  constructor() {
    keepMenuInsideDialog(
      inject(CdkMenuTrigger),
      inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
    );
  }
}

/**
 * Reports to `star-menu` when one of its lists (the root popup or a submenu) is created and
 * destroyed, because the CDK menu has no event for a submenu. Internal.
 */
@Directive({ selector: '[starMenuLife]' })
class StarMenuLife implements OnInit, OnDestroy {
  /** The item that opened this list, or `null` for the root list. */
  readonly starMenuLife = input<StarMenuItem | null>(null);
  private readonly menu = inject(forwardRef(() => StarMenu));

  // `ngOnInit` stays on purpose: it is the first hook that sees the bound `starMenuLife` input
  // (the constructor sees the default `null`, which would report a submenu as the root popup),
  // and it runs in the change detection that creates the list, so `show` and `submenuShow` fire
  // in the same turn as the CDK open. An effect or `afterNextRender` would fire them one render
  // later, after the list is painted.
  ngOnInit(): void {
    this.menu.listOpened(this.starMenuLife());
  }

  ngOnDestroy(): void {
    this.menu.listClosed(this.starMenuLife());
  }
}

/**
 * Menu (PrimeNG `p-menu` + `p-tieredmenu`) on CDK Menu: roving focus, typeahead, submenus
 * with pointer aim, Escape and focus return come from `@angular/cdk/menu`.
 *
 * Popup: `<star-button [starMenuTrigger]="rowMenu">…</star-button> <star-menu #rowMenu [items]="actions" />`
 * Inline: `<star-menu inline [items]="nav" />`
 *
 * The popup is a native popover. Inside a modal `star-dialog` it goes into the dialog
 * (`keepMenuInsideDialog`), so it stays usable there.
 *
 * Slots (content children): `starMenuTemplate` with `item`, `itemIcon`, `submenuHeader`, `start`
 * and `end`; `starIcon="submenu"` replaces the submenu arrow.
 *
 * PrimeNG names that star-ng covers in another way: `model` = `items`, `popup` = the default
 * (`inline` for an in-place menu), `autoDisplay` = always on (the CDK menu opens a submenu on
 * hover), `onShow` / `onHide` = `show` / `hide`, `onFocus` / `onBlur` = the native `focusin` /
 * `focusout` events, `style` and `styleClass` = `pt`. Not applicable: `appendTo`, `autoZIndex`,
 * `baseZIndex` (the popup is in the top layer), `breakpoint` (no separate small-screen mode).
 */
@Component({
  selector: 'star-menu',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [
    StarPart,
    CdkMenu,
    CdkMenuGroup,
    CdkMenuItem,
    CdkMenuTrigger,
    NgTemplateOutlet,
    RouterLink,
    StarMenuInDialog,
    StarMenuLife,
  ],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarMenu) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-menu-host' },
  template: `
    <ng-template #menu let-items let-level="level" let-parent="parent">
      @let depth = level ?? 0;
      @let ends = !parent && !!(slot('start') || slot('end'));
      <div
        data-star-part="framePanel"
        class="star-menu-frame"
        [class.star-menu-frame--framed]="ends"
        [starMenuLife]="parent ?? null"
      >
        @if (ends) {
          @if (slot('start'); as start) {
            <div data-star-part="startPanel" class="star-menu__start">
              <ng-container *ngTemplateOutlet="start" />
            </div>
          }
        }
        <!-- Items must be in this template, inside cdkMenu: CDK resolves the menu by DI. -->
        <div
          starPart="itemList"
          class="star-menu"
          cdkMenu
          [attr.aria-label]="ariaLabel()"
          [attr.aria-labelledby]="ariaLabel() ? null : ariaLabelledBy()"
        >
          <ng-template #entry let-item>
            @if (item.separator) {
              <div data-star-part="separator" class="star-menu__separator" role="separator"></div>
            } @else if (item.group && item.items?.length) {
              @let headingId = groupId(item);
              <div
                data-star-part="groupPanel"
                class="star-menu__group"
                cdkMenuGroup
                [attr.aria-labelledby]="headingId"
              >
                <div
                  data-star-part="submenuHeader"
                  class="star-menu__group-header"
                  [id]="headingId"
                >
                  @if (slot('submenuHeader'); as header) {
                    <ng-container
                      *ngTemplateOutlet="header; context: context(item, depth, false)"
                    />
                  } @else {
                    {{ item.label }}
                  }
                </div>
                @for (child of item.items; track $index) {
                  <ng-container *ngTemplateOutlet="entry; context: { $implicit: child }" />
                }
              </div>
            } @else if (item.items?.length) {
              <button
                data-star-part="item"
                type="button"
                class="star-menu__item"
                cdkMenuItem
                [cdkMenuTriggerFor]="menu"
                [cdkMenuTriggerData]="{ $implicit: item.items, level: depth + 1, parent: item }"
                [cdkMenuItemDisabled]="!!item.disabled"
              >
                <ng-container
                  *ngTemplateOutlet="content; context: { $implicit: item, level: depth, sub: true }"
                />
                @if (icon('submenu'); as custom) {
                  <span data-star-part="submenuIcon" class="star-menu__sub" aria-hidden="true">
                    <ng-container *ngTemplateOutlet="custom; context: iconContext" />
                  </span>
                } @else {
                  <i
                    data-star-part="submenuIcon"
                    class="ph-bold ph-caret-right star-menu__sub star-icon-mirror"
                    aria-hidden="true"
                  ></i>
                }
              </button>
            } @else if (item.routerLink) {
              <a
                data-star-part="item"
                class="star-menu__item"
                cdkMenuItem
                [class.star-menu__item--danger]="item.danger"
                [routerLink]="item.routerLink"
                [cdkMenuItemDisabled]="!!item.disabled"
                (cdkMenuItemTriggered)="run(item)"
              >
                <ng-container
                  *ngTemplateOutlet="content; context: { $implicit: item, level: depth }"
                />
              </a>
            } @else if (item.url) {
              <a
                data-star-part="item"
                class="star-menu__item"
                cdkMenuItem
                [href]="item.url"
                [cdkMenuItemDisabled]="!!item.disabled"
                (cdkMenuItemTriggered)="run(item)"
              >
                <ng-container
                  *ngTemplateOutlet="content; context: { $implicit: item, level: depth }"
                />
              </a>
            } @else {
              <button
                data-star-part="item"
                type="button"
                class="star-menu__item"
                cdkMenuItem
                [class.star-menu__item--danger]="item.danger"
                [cdkMenuItemDisabled]="!!item.disabled"
                (cdkMenuItemTriggered)="run(item)"
              >
                <ng-container
                  *ngTemplateOutlet="content; context: { $implicit: item, level: depth }"
                />
              </button>
            }
          </ng-template>
          @for (item of items; track $index) {
            <ng-container *ngTemplateOutlet="entry; context: { $implicit: item }" />
          }
        </div>
        @if (ends) {
          @if (slot('end'); as end) {
            <div data-star-part="endPanel" class="star-menu__end">
              <ng-container *ngTemplateOutlet="end" />
            </div>
          }
        }
      </div>
    </ng-template>

    <ng-template #content let-item let-level="level" let-sub="sub">
      @if (slot('item'); as custom) {
        <ng-container *ngTemplateOutlet="custom; context: context(item, level, !!sub)" />
      } @else {
        @if (item.icon) {
          @if (slot('itemIcon'); as custom) {
            <span starPart="icon" class="star-menu__icon" aria-hidden="true">
              <ng-container *ngTemplateOutlet="custom; context: context(item, level, !!sub)" />
            </span>
          } @else {
            <i starPart="icon" class="star-menu__icon" [class]="item.icon" aria-hidden="true"></i>
          }
        }
        <span starPart="label" class="star-menu__label">
          @if (itemTemplate(); as template) {
            <ng-container *ngTemplateOutlet="template; context: { $implicit: item }" />
          } @else {
            <ng-container>{{ item.label }}</ng-container>
          }
        </span>
        @if (item.shortcut) {
          <kbd starPart="shortcutText" class="star-menu__shortcut">{{ item.shortcut }}</kbd>
        }
      }
    </ng-template>

    @if (inline()) {
      <ng-container *ngTemplateOutlet="menu; context: { $implicit: items() }" />
    }
  `,
})
export class StarMenu {
  /** Keeps the CDK direction (overlays and menus) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  private readonly ids = inject(_IdGenerator);
  private readonly groupIds = new WeakMap<StarMenuItem, string>();
  readonly items = input<readonly StarMenuItem[]>([]);
  /** Renders the menu in place instead of as a popup. */
  readonly inline = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);
  /** Id of an element that names the menu, when there is no `ariaLabel`. PrimeNG `ariaLabelledBy`. */
  readonly ariaLabelledBy = input<string | null>(null);
  /**
   * Replaces the label text of each entry. The icon, the shortcut and the submenu arrow
   * stay. Used by `star-cascade-select`. Not public API yet.
   *
   * @internal
   */
  readonly itemTemplate = input<TemplateRef<StarMenuItemContext> | null>(null);
  /**
   * Slots of a control that renders its submenus with this menu (`star-menubar`). The slots
   * written inside this menu win. Not public API.
   *
   * @internal
   */
  readonly inheritedSlots = input<ReadonlyMap<string, TemplateRef<unknown>> | null>(null);
  readonly itemClick = output<StarMenuItem>();
  /** Emits when the popup opens (not for an inline menu). PrimeNG `onShow`. */
  readonly show = output<void>();
  /** Emits when the popup closes (not for an inline menu). PrimeNG `onHide`. */
  readonly hide = output<void>();
  /**
   * Emits the item whose submenu opened. In `star-menubar`, the bar item whose menu opened.
   * The cascade select uses it for `groupChange`.
   */
  readonly submenuShow = output<StarMenuItem>();
  /** Emits the item whose submenu closed. */
  readonly submenuHide = output<StarMenuItem>();

  /** Root menu template, opened by `starMenuTrigger`. */
  readonly template = viewChild.required<TemplateRef<unknown>>('menu');

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  private readonly ownSlots = starSlotMap<unknown>(this.slots, this, 'menuTemplate');
  private readonly ownIcons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};

  /** The `starMenuTemplate` slot with this name (own or inherited). */
  protected slot(name: StarMenuSlotName): TemplateRef<unknown> | null {
    return this.ownSlots().get(name) ?? this.inheritedSlots()?.get(name) ?? null;
  }

  /** The `starIcon` slot with this name (own, or inherited as `icon:<name>`). */
  protected icon(name: string): TemplateRef<StarIconContext> | null {
    return (
      this.ownIcons().get(name) ??
      (this.inheritedSlots()?.get(`icon:${name}`) as TemplateRef<StarIconContext> | undefined) ??
      null
    );
  }

  protected context(
    item: StarMenuItem,
    level: number | undefined,
    sub: boolean,
  ): StarMenuItemContext {
    return { $implicit: item, level: level ?? 0, hasSubmenu: sub };
  }

  protected groupId(item: StarMenuItem): string {
    let id = this.groupIds.get(item);
    if (!id) {
      id = this.ids.getId('star-menu-group-');
      this.groupIds.set(item, id);
    }
    return id;
  }

  /**
   * Called by a popup list or a submenu list when it is created. Not public API.
   *
   * @internal
   */
  listOpened(parent: StarMenuItem | null): void {
    if (parent) this.submenuShow.emit(parent);
    else if (!this.inline()) this.show.emit();
  }

  /**
   * Called by a popup list or a submenu list when it is destroyed. Not public API.
   *
   * @internal
   */
  listClosed(parent: StarMenuItem | null): void {
    if (parent) this.submenuHide.emit(parent);
    else if (!this.inline()) this.hide.emit();
  }

  protected run(item: StarMenuItem): void {
    if (item.disabled) return;
    item.command?.(item);
    this.itemClick.emit(item);
  }
}

/**
 * Opens an `star-menu` as a popup from any element (button, icon button, row action).
 * Adds `aria-haspopup`, `aria-expanded`, Arrow Down / Enter / Space to open.
 */
@Directive({
  selector: '[starMenuTrigger]',
  host: {
    // On a wrapper host the popup state lives on the inner button. These bindings run after the
    // CDK ones, so the first render (also on the server) has no state on the host.
    '[attr.aria-haspopup]': 'wrapper() ? null : trigger.menuTemplateRef ? "menu" : null',
    '[attr.aria-expanded]':
      'wrapper() ? null : trigger.menuTemplateRef == null ? null : trigger.isOpen()',
  },
  hostDirectives: [
    {
      directive: CdkMenuTrigger,
      outputs: ['cdkMenuOpened: menuOpened', 'cdkMenuClosed: menuClosed'],
    },
  ],
})
export class StarMenuTrigger {
  /** Keeps the CDK direction (overlays and menus) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  readonly starMenuTrigger = input.required<StarMenu>();
  protected readonly trigger = inject(CdkMenuTrigger);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  /**
   * The host is a wrapper (a custom element such as `<star-button>`) with the real button inside:
   * the host is presentational and the inner button has the popup state.
   */
  protected readonly wrapper = signal(this.host.nativeElement.tagName.includes('-'));
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    this.trigger.menuPosition = STAR_MENU_POSITIONS;
    keepMenuInsideDialog(this.trigger, this.host.nativeElement);
    effect(() => {
      const menu = this.starMenuTrigger();
      this.trigger.menuTemplateRef = menu.template();
      this.trigger.menuData = { $implicit: menu.items() };
    });
    afterNextRender(() => this.syncInnerButton(false));
    // The CDK host bindings write the new state in the render after the event: sync after it.
    // A menu that closes while the trigger is destroyed registers no hook on the gone view.
    let destroyed = false;
    inject(DestroyRef).onDestroy(() => (destroyed = true));
    const later = (open: boolean) => {
      if (destroyed) return;
      afterNextRender(() => this.syncInnerButton(open), { injector: this.injector });
    };
    this.trigger.opened.pipe(takeUntilDestroyed()).subscribe(() => later(true));
    this.trigger.closed.pipe(takeUntilDestroyed()).subscribe(() => later(false));
    this.adaptWrapperHost();
    this.wrapperRole();
  }

  /**
   * CDK gives the host `role="button"` in its constructor. A wrapper (a custom element such as
   * `<star-button>`) has the real button inside, so its host becomes presentational at once: also
   * in the server render and before hydration, where no after-render hook runs. A plain element
   * (`<div tabindex="0">`) keeps the button role, and so does a host inside a menu (no role
   * from CDK).
   */
  private wrapperRole(): void {
    const host = this.host.nativeElement;
    if (!this.wrapper() || host.getAttribute('role') !== 'button') return;
    host.setAttribute('role', 'none');
  }

  /**
   * CDK opens a menu on Enter or Space itself, unless the host is a native button (then the
   * native click does it). On a wrapper such as `<star-button>` the host is no button, so CDK
   * would toggle on the key and the native click of the inner button would toggle again: the
   * menu opens and closes at once. The key stays with the inner button; its click opens the menu.
   * (Arrow down and Arrow up are still handled by CDK.)
   *
   * CDK also calls `focus()` on the host to return the focus when the menu closes. A wrapper
   * cannot take focus, so the call goes to the inner button.
   */
  private adaptWrapperHost(): void {
    // Only a browser has a user to press a key; the server DOM does not allow the `focus` change.
    if (!this.browser || !this.wrapper()) return;
    const host = this.host.nativeElement;
    const own = host.focus.bind(host);
    host.focus = (options?: FocusOptions) => {
      const inner = host.querySelector('button');
      if (inner) inner.focus(options);
      else own(options);
    };
    host.addEventListener(
      'keydown',
      (event) => {
        const inner = (event.target as HTMLElement | null)?.closest('button');
        if (inner && host.contains(inner) && (event.key === 'Enter' || event.key === ' ')) {
          event.stopPropagation();
        }
      },
      true,
    );
  }

  /**
   * On a wrapper such as `<star-button>`, the real button is inside the host. CDK gives the
   * host `role="button"`, which makes two nested buttons for assistive technology. The host
   * becomes presentational and the inner button gets the popup state.
   */
  private syncInnerButton(open: boolean): void {
    const host = this.host.nativeElement;
    if (!this.wrapper()) return;
    const inner = host.querySelector('button');
    if (!inner) {
      // A custom element without a button inside is the button itself: give the role back.
      if (host.getAttribute('role') === 'none') host.setAttribute('role', 'button');
      this.wrapper.set(false);
      return;
    }
    host.setAttribute('role', 'none');
    host.removeAttribute('aria-haspopup');
    host.removeAttribute('aria-expanded');
    inner.setAttribute('aria-haspopup', 'menu');
    inner.setAttribute('aria-expanded', String(open));
  }
}

/**
 * Split button (PrimeNG `p-splitbutton`): a main action plus a menu of related actions.
 * `<star-split-button label="Send response" [items]="sendOptions" (pressed)="send()" />`
 *
 * Slots (content children): projected content goes after the label in the main button
 * (PrimeNG `#content`); `starIcon="dropdown"` replaces the icon of the menu button.
 *
 * PrimeNG names that star-ng covers in another way: `model` = `items`, `severity` = `variant`
 * (`plain` = `secondary`), `onClick` = `pressed`, `tooltip` and `tooltipOptions` = the
 * `starTooltip` directive on the host, `menuStyle` and `menuStyleClass` = `pt`. Not applicable:
 * `appendTo` (the menu is an overlay of the Angular CDK), `dir` (the direction of the page),
 * `motionOptions` (the motion comes from the theme tokens and stops with reduced motion).
 */
@Component({
  selector: 'star-split-button',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarButton, StarMenu, StarMenuTrigger, NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarSplitButton) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-split' },
  template: `
    <star-button
      class="star-split__main"
      [variant]="variant()"
      [size]="size()"
      [appearance]="appearance()"
      [raised]="raised()"
      [rounded]="rounded()"
      [leadingIcon]="iconPos() === 'start' ? icon() : null"
      [trailingIcon]="iconPos() === 'end' ? icon() : null"
      [disabled]="disabled() || buttonDisabled()"
      [tabindex]="tabindex()"
      [autofocus]="autofocus()"
      (pressed)="pressed.emit($event)"
    >
      {{ label() }} <ng-content />
    </star-button>
    <button
      data-star-part="toggleButton"
      type="button"
      class="star-btn star-split__toggle"
      [class]="toggleClasses()"
      [disabled]="disabled() || menuButtonDisabled()"
      [attr.aria-label]="expandAriaLabel() ?? text.moreActions"
      [attr.tabindex]="tabindex()"
      [starMenuTrigger]="menu"
      (click)="dropdownClick.emit($event)"
      (menuOpened)="menuShow.emit()"
      (menuClosed)="menuHide.emit()"
    >
      @if (icons().get('dropdown'); as custom) {
        <span data-star-part="toggleIcon" class="star-btn__icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: iconContext" />
        </span>
      } @else {
        <i data-star-part="toggleIcon" [class]="dropdownIcon()" aria-hidden="true"></i>
      }
    </button>
    <star-menu #menu [items]="items()" (itemClick)="itemClick.emit($event)" />
  `,
})
export class StarSplitButton {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly label = input.required<string>();
  readonly icon = input<string | null>(null);
  readonly items = input<readonly StarMenuItem[]>([]);
  readonly variant = input<StarButtonVariant>('primary');
  readonly size = input<StarButtonSize>('md');
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Side of `icon` in the main button: `'start'` (default) or `'end'`. PrimeNG `iconPos`. */
  readonly iconPos = input<'start' | 'end'>('start');
  /** `'outlined'`, `'text'` or `'link'` draw both buttons without their fill. PrimeNG `outlined`, `text`. */
  readonly appearance = input<StarButtonAppearance>('filled');
  /** A shadow under both buttons. PrimeNG `raised`. */
  readonly raised = input(false, { transform: booleanAttribute });
  /** Fully round outer ends. PrimeNG `rounded`. */
  readonly rounded = input(false, { transform: booleanAttribute });
  /** Turns off only the main button. PrimeNG `buttonDisabled`. */
  readonly buttonDisabled = input(false, { transform: booleanAttribute });
  /** Turns off only the menu button. PrimeNG `menuButtonDisabled`. */
  readonly menuButtonDisabled = input(false, { transform: booleanAttribute });
  /** Icon classes of the menu button (default a caret). PrimeNG `dropdownIcon`. */
  readonly dropdownIcon = input('ph-bold ph-caret-down');
  /** Accessible name of the menu button (default `STAR_UI_TEXT.moreActions`). PrimeNG `expandAriaLabel`. */
  readonly expandAriaLabel = input<string | null>(null);
  /** `tabindex` of both buttons. */
  readonly tabindex = input<number | null>(null);
  /** Focuses the main button once, after the first render. PrimeNG `autofocus`. */
  readonly autofocus = input(false, { transform: booleanAttribute });
  readonly pressed = output<MouseEvent>();
  readonly itemClick = output<StarMenuItem>();
  /** Emits a click on the menu button. PrimeNG `onDropdownClick`. */
  readonly dropdownClick = output<MouseEvent>();
  /** Emits when the menu opens. PrimeNG `onMenuShow`. */
  readonly menuShow = output<void>();
  /** Emits when the menu closes. PrimeNG `onMenuHide`. */
  readonly menuHide = output<void>();

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};
  protected readonly toggleClasses = computed(() =>
    [
      'star-btn',
      'star-split__toggle',
      `star-btn--${this.variant()}`,
      `star-btn--${this.size()}`,
      this.appearance() !== 'filled' ? `star-btn--${this.appearance()}` : '',
      this.raised() ? 'star-btn--raised' : '',
      this.rounded() ? 'star-btn--rounded' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
