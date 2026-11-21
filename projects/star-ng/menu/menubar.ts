import { CdkContextMenuTrigger, CdkMenuBar, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  STAR_SLOT_HOST,
  StarDirectionService,
  StarIconContext,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import {
  keepMenuInsideDialog,
  STAR_MENU_POSITIONS,
  StarMenu,
  StarMenuInDialog,
  StarMenuItem,
} from './menu';

/**
 * Menu bar (PrimeNG `p-menubar`) on CDK Menu Bar: top-level items with dropdown submenus,
 * Left / Right between items, Down opens, typeahead, Escape closes. Uses `star-menu` for the
 * submenus, so nesting works to any depth.
 *
 * `<star-menubar ariaLabel="Main" [items]="nav"><star-button starMenubarEnd>…</star-button></star-menubar>`
 *
 * Slots (content children): `starMenuTemplate` with `item`, `itemIcon`, `start` and `end` (also
 * for the submenus), `starIcon="submenu"` (the arrow of a bar item and of a submenu item). Content
 * with the `starMenubarStart` and `starMenubarEnd` attributes is projected at the start and the end.
 *
 * PrimeNG names that star-ng covers in another way: `model` = `items`, `onFocus` / `onBlur` = the
 * native `focusin` / `focusout` events. Not applicable: `autoZIndex`, `baseZIndex` (top layer),
 * `breakpoint` and `#menuicon` (no separate small-screen mode), `autoHide` and `autoHideDelay`
 * (the CDK menu closes on a click outside, Escape and Tab).
 */
@Component({
  selector: 'star-menubar',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [
    CdkMenuBar,
    CdkMenuItem,
    CdkMenuTrigger,
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    StarMenu,
    StarMenuInDialog,
  ],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarMenubar) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-menubar' },
  template: `
    @if (slots().get('start'); as start) {
      <div data-star-part="startPanel" class="star-menubar__start">
        <ng-container *ngTemplateOutlet="start" />
      </div>
    }
    <ng-content select="[starMenubarStart]" />
    <div
      data-star-part="barPanel"
      class="star-menubar__bar"
      cdkMenuBar
      [attr.aria-label]="ariaLabel()"
      [attr.aria-labelledby]="ariaLabel() ? null : ariaLabelledBy()"
    >
      @for (item of items(); track $index) {
        @if (item.items?.length) {
          <button
            #trigger="cdkMenuTriggerFor"
            data-star-part="item"
            type="button"
            class="star-menubar__item"
            cdkMenuItem
            [cdkMenuTriggerFor]="submenu.template()"
            [cdkMenuTriggerData]="{ $implicit: item.items, level: 1, parent: item }"
            [cdkMenuItemDisabled]="!!item.disabled"
            (mouseenter)="hoverOpen(trigger, !!item.disabled)"
          >
            <ng-container *ngTemplateOutlet="content; context: { $implicit: item, sub: true }" />
            @if (icons().get('submenu'); as custom) {
              <span data-star-part="submenuIcon" class="star-menubar__caret" aria-hidden="true">
                <ng-container *ngTemplateOutlet="custom; context: iconContext" />
              </span>
            } @else {
              <i
                data-star-part="submenuIcon"
                class="ph-bold ph-caret-down star-menubar__caret"
                aria-hidden="true"
              ></i>
            }
          </button>
        } @else if (item.routerLink) {
          <a
            data-star-part="item"
            class="star-menubar__item"
            cdkMenuItem
            routerLinkActive="star-menubar__item--active"
            [routerLink]="item.routerLink"
            [cdkMenuItemDisabled]="!!item.disabled"
            (cdkMenuItemTriggered)="run(item)"
          >
            <ng-container *ngTemplateOutlet="content; context: { $implicit: item }" />
          </a>
        } @else {
          <button
            data-star-part="item"
            type="button"
            class="star-menubar__item"
            cdkMenuItem
            [cdkMenuItemDisabled]="!!item.disabled"
            (cdkMenuItemTriggered)="run(item)"
          >
            <ng-container *ngTemplateOutlet="content; context: { $implicit: item }" />
          </button>
        }
      }
    </div>
    <span data-star-part="endPanel" class="star-menubar__end">
      @if (slots().get('end'); as end) {
        <ng-container *ngTemplateOutlet="end" />
      }
      <ng-content select="[starMenubarEnd]"
    /></span>
    <star-menu
      #submenu
      [inheritedSlots]="inherited()"
      (itemClick)="itemClick.emit($event)"
      (submenuShow)="submenuShow.emit($event)"
      (submenuHide)="submenuHide.emit($event)"
    />

    <ng-template #content let-item let-sub="sub">
      @if (slots().get('item'); as custom) {
        <ng-container
          *ngTemplateOutlet="custom; context: { $implicit: item, level: 0, hasSubmenu: !!sub }"
        />
      } @else {
        @if (item.icon) {
          @if (slots().get('itemIcon'); as custom) {
            <span data-star-part="itemIcon" aria-hidden="true">
              <ng-container
                *ngTemplateOutlet="
                  custom;
                  context: { $implicit: item, level: 0, hasSubmenu: !!sub }
                "
              />
            </span>
          } @else {
            <i data-star-part="itemIcon" [class]="item.icon" aria-hidden="true"></i>
          }
        }
        {{ item.label }}
      }
    </ng-template>
  `,
})
export class StarMenubar {
  /** Keeps the CDK direction (overlays and menus) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  readonly items = input<readonly StarMenuItem[]>([]);
  readonly ariaLabel = input<string | null>(null);
  /** Id of an element that names the bar, when there is no `ariaLabel`. PrimeNG `ariaLabelledBy`. */
  readonly ariaLabelledBy = input<string | null>(null);
  /**
   * Opens the menu of a bar item when the pointer moves onto it, without a click first. Without
   * it, the first menu opens on a click and the next ones follow the pointer (CDK menu bar).
   * PrimeNG `autoDisplay`.
   */
  readonly autoDisplay = input(false, { transform: booleanAttribute });
  readonly itemClick = output<StarMenuItem>();
  /** Emits the bar item (or submenu item) whose menu opened. */
  readonly submenuShow = output<StarMenuItem>();
  /** Emits the bar item (or submenu item) whose menu closed. */
  readonly submenuHide = output<StarMenuItem>();

  private readonly contentSlots = contentChildren(StarSlot, { descendants: true });
  protected readonly slots = starSlotMap<unknown>(this.contentSlots, this, 'menuTemplate');
  protected readonly icons = starSlotMap<StarIconContext>(this.contentSlots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};
  /** The item slots and the icons, for the submenus (`start` and `end` stay in the bar). */
  protected readonly inherited = computed(() => {
    const map = new Map<string, TemplateRef<unknown>>();
    for (const [key, template] of this.slots()) {
      if (key !== 'start' && key !== 'end') map.set(key, template);
    }
    for (const [key, template] of this.icons()) map.set(`icon:${key}`, template);
    return map;
  });

  protected hoverOpen(trigger: CdkMenuTrigger, disabled: boolean): void {
    if (!this.autoDisplay() || disabled || trigger.isOpen()) return;
    // The CDK bar switches menus on hover while one is open; it acts on the same event.
    queueMicrotask(() => {
      if (!trigger.isOpen()) trigger.open();
    });
  }

  protected run(item: StarMenuItem): void {
    if (item.disabled) return;
    item.command?.(item);
    this.itemClick.emit(item);
  }
}

/**
 * Right-click (and Shift+F10 / context-menu key) menu on any element (PrimeNG `p-contextmenu`).
 * `<tr [starContextMenu]="rowMenu">…</tr> <star-menu #rowMenu [items]="rowActions" />`
 *
 * Inside a modal `star-dialog` the menu goes into the dialog (`keepMenuInsideDialog`).
 *
 * PrimeNG names that star-ng covers in another way: `model` = the `items` of the `star-menu`,
 * `onShow` / `onHide` = `menuOpened` / `menuClosed` (or `show` / `hide` of the `star-menu`), the
 * `#item` and `#submenuicon` templates = the slots of the `star-menu`. Not applicable: `global`
 * and `target` (put the directive on the element, for example `<body>` content), `appendTo`,
 * `autoZIndex`, `baseZIndex` (top layer), `breakpoint`.
 */
@Directive({
  selector: '[starContextMenu]',
  hostDirectives: [
    {
      directive: CdkContextMenuTrigger,
      outputs: ['cdkContextMenuOpened: menuOpened', 'cdkContextMenuClosed: menuClosed'],
    },
  ],
})
export class StarContextMenu {
  /** Keeps the CDK direction (overlays and menus) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  readonly starContextMenu = input.required<StarMenu>();
  private readonly trigger = inject(CdkContextMenuTrigger);

  constructor() {
    this.trigger.menuPosition = STAR_MENU_POSITIONS;
    keepMenuInsideDialog(this.trigger, inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
    effect(() => {
      const menu = this.starContextMenu();
      this.trigger.menuTemplateRef = menu.template();
      this.trigger.menuData = { $implicit: menu.items() };
    });
  }
}
