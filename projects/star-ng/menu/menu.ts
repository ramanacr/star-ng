import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ConnectedPosition, FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  PLATFORM_ID,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { StarButton, StarButtonSize, StarButtonVariant } from '@star-ng/ui/button';
import {
  STAR_UI_TEXT,
  StarDirectionService,
  StarPart,
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
}

/** Context of the `itemTemplate` of `star-menu`. */
export interface StarMenuItemContext {
  /** The menu item. It is the same object that is in `items`, so extra fields are kept. */
  readonly $implicit: StarMenuItem;
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
 * Menu (PrimeNG `p-menu` + `p-tieredmenu`) on CDK Menu: roving focus, typeahead, submenus
 * with pointer aim, Escape and focus return come from `@angular/cdk/menu`.
 *
 * Popup: `<star-button [starMenuTrigger]="rowMenu">…</star-button> <star-menu #rowMenu [items]="actions" />`
 * Inline: `<star-menu inline [items]="nav" />`
 *
 * The popup is a native popover. Inside a modal `star-dialog` it goes into the dialog
 * (`keepMenuInsideDialog`), so it stays usable there.
 */
@Component({
  selector: 'star-menu',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [
    StarPart,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    NgTemplateOutlet,
    RouterLink,
    StarMenuInDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-menu-host' },
  template: `
    <ng-template #menu let-items>
      <!-- Items must be direct template children of cdkMenu: CDK resolves the menu by DI. -->
      <div starPart="menu" class="star-menu" cdkMenu [attr.aria-label]="ariaLabel()">
        @for (item of items; track $index) {
          @if (item.separator) {
            <div starPart="separator" class="star-menu__separator" role="separator"></div>
          } @else if (item.items?.length) {
            <button
              starPart="item"
              type="button"
              class="star-menu__item"
              cdkMenuItem
              [cdkMenuTriggerFor]="menu"
              [cdkMenuTriggerData]="{ $implicit: item.items }"
              [cdkMenuItemDisabled]="!!item.disabled"
            >
              <ng-container *ngTemplateOutlet="content; context: { $implicit: item }" />
              <i
                starPart="sub"
                class="ph-bold ph-caret-right star-menu__sub star-icon-mirror"
                aria-hidden="true"
              ></i>
            </button>
          } @else if (item.routerLink) {
            <a
              starPart="item"
              class="star-menu__item"
              cdkMenuItem
              [class.star-menu__item--danger]="item.danger"
              [routerLink]="item.routerLink"
              [cdkMenuItemDisabled]="!!item.disabled"
              (cdkMenuItemTriggered)="run(item)"
            >
              <ng-container *ngTemplateOutlet="content; context: { $implicit: item }" />
            </a>
          } @else if (item.url) {
            <a
              starPart="item"
              class="star-menu__item"
              cdkMenuItem
              [href]="item.url"
              [cdkMenuItemDisabled]="!!item.disabled"
              (cdkMenuItemTriggered)="run(item)"
            >
              <ng-container *ngTemplateOutlet="content; context: { $implicit: item }" />
            </a>
          } @else {
            <button
              starPart="item"
              type="button"
              class="star-menu__item"
              cdkMenuItem
              [class.star-menu__item--danger]="item.danger"
              [cdkMenuItemDisabled]="!!item.disabled"
              (cdkMenuItemTriggered)="run(item)"
            >
              <ng-container *ngTemplateOutlet="content; context: { $implicit: item }" />
            </button>
          }
        }
      </div>
    </ng-template>

    <ng-template #content let-item>
      @if (item.icon) {
        <i starPart="icon" class="star-menu__icon" [class]="item.icon" aria-hidden="true"></i>
      }
      <span starPart="label" class="star-menu__label">
        @if (itemTemplate(); as template) {
          <ng-container *ngTemplateOutlet="template; context: { $implicit: item }" />
        } @else {
          <ng-container>{{ item.label }}</ng-container>
        }
      </span>
      @if (item.shortcut) {
        <kbd starPart="shortcut" class="star-menu__shortcut">{{ item.shortcut }}</kbd>
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
  readonly items = input<readonly StarMenuItem[]>([]);
  /** Renders the menu in place instead of as a popup. */
  readonly inline = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);
  /**
   * Replaces the label text of each entry. The icon, the shortcut and the submenu arrow
   * stay. Used by `star-cascade-select`. Not public API yet.
   *
   * @internal
   */
  readonly itemTemplate = input<TemplateRef<StarMenuItemContext> | null>(null);
  readonly itemClick = output<StarMenuItem>();

  /** Root menu template, opened by `starMenuTrigger`. */
  readonly template = viewChild.required<TemplateRef<unknown>>('menu');

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
 */
@Component({
  selector: 'star-split-button',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, StarButton, StarMenu, StarMenuTrigger],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-split' },
  template: `
    <star-button
      class="star-split__main"
      [variant]="variant()"
      [size]="size()"
      [leadingIcon]="icon()"
      [disabled]="disabled()"
      (pressed)="pressed.emit($event)"
    >
      {{ label() }}
    </star-button>
    <button
      starPart="toggle"
      type="button"
      class="star-btn star-split__toggle"
      [class]="'star-btn star-split__toggle star-btn--' + variant() + ' star-btn--' + size()"
      [disabled]="disabled()"
      [attr.aria-label]="text.moreActions"
      [starMenuTrigger]="menu"
    >
      <i starPart="icon" class="ph-bold ph-caret-down" aria-hidden="true"></i>
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
  readonly pressed = output<MouseEvent>();
  readonly itemClick = output<StarMenuItem>();
}
