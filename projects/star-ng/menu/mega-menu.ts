import { CdkMenu, CdkMenuBar, CdkMenuGroup, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  forwardRef,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  STAR_SLOT_HOST,
  StarDirectionService,
  StarIconContext,
  StarPart,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
  ɵstarLeaveWithClass,
} from '@star-ng/ui/core';
import { STAR_MENU_POSITIONS, StarMenuInDialog, StarMenuItem, StarMenuItemContext } from './menu';

/**
 * Mega menu (PrimeNG `p-megamenu`) on CDK Menu Bar: a top-level item opens one wide panel
 * with its child items as columns. Three levels of `StarMenuItem`:
 *
 * 1. top-level item (the bar),
 * 2. its `items`: the columns (`label` is the column heading),
 * 3. each column's `items`: the links or actions.
 *
 * A top-level item without `items` is a plain link or action. Keyboard: Left / Right on the
 * bar, Down opens a panel, Up / Down move through all items of the panel, Escape closes.
 *
 * `<star-mega-menu ariaLabel="Products" [items]="catalogue" />`
 *
 * Slots (content children): `starMenuTemplate` with `item` (bar items and panel items), `itemIcon`,
 * `submenuHeader` (the column headings), `start` and `end` (next to the bar items);
 * `starIcon="submenu"` replaces the arrow of a bar item.
 *
 * PrimeNG names that star-ng covers in another way: `model` = `items`. Not applicable:
 * `orientation` (a vertical mega menu is `star-panel-menu` or `star-menu` with submenus),
 * `breakpoint`, `#menuicon`, `#button` and `#buttonicon` (no separate small-screen mode),
 * `scrollHeight` (the panel grows with its columns).
 */
@Component({
  selector: 'star-mega-menu',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [
    StarPart,
    CdkMenu,
    CdkMenuBar,
    CdkMenuGroup,
    CdkMenuItem,
    CdkMenuTrigger,
    NgTemplateOutlet,
    RouterLink,
    StarMenuInDialog,
  ],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarMegaMenu) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-menubar star-mega-menu' },
  // CDK resolves the menu of an item by DI, so every `cdkMenuItem` is written in place:
  // a shared `ng-template` for the items would be outside the menu.
  template: `
    @if (slots().get('start'); as start) {
      <div data-star-part="startPanel" class="star-menubar__start">
        <ng-container *ngTemplateOutlet="start" />
      </div>
    }
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
            data-star-part="item"
            type="button"
            class="star-menubar__item"
            cdkMenuItem
            [cdkMenuTriggerFor]="panel"
            [cdkMenuTriggerData]="{ $implicit: item.items }"
            [cdkMenuPosition]="positions"
            [cdkMenuItemDisabled]="!!item.disabled"
          >
            <ng-container *ngTemplateOutlet="barContent; context: { $implicit: item, sub: true }" />
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
            [routerLink]="item.routerLink"
            [cdkMenuItemDisabled]="!!item.disabled"
            (cdkMenuItemTriggered)="run(item)"
          >
            <ng-container *ngTemplateOutlet="barContent; context: { $implicit: item }" />
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
            <ng-container *ngTemplateOutlet="barContent; context: { $implicit: item }" />
          </button>
        }
      }
    </div>
    @if (slots().get('end'); as end) {
      <div data-star-part="endPanel" class="star-menubar__end">
        <ng-container *ngTemplateOutlet="end" />
      </div>
    }

    <ng-template #panel let-columns>
      <div
        starPart="panel"
        class="star-menu star-mega-menu__panel"
        (animate.leave)="leavePanel($event)"
        cdkMenu
      >
        @for (column of columns; track $index; let c = $index) {
          <div
            data-star-part="column"
            class="star-mega-menu__column"
            cdkMenuGroup
            [attr.aria-labelledby]="column.label ? panelId + '-' + c : null"
          >
            @if (column.label) {
              <div
                data-star-part="headingPanel"
                class="star-mega-menu__heading"
                [id]="panelId + '-' + c"
              >
                @if (slots().get('submenuHeader'); as header) {
                  <ng-container *ngTemplateOutlet="header; context: context(column, 1, false)" />
                } @else {
                  {{ column.label }}
                }
              </div>
            }
            @for (entry of column.items ?? []; track $index) {
              @if (entry.separator) {
                <div data-star-part="separator" class="star-menu__separator" role="separator"></div>
              } @else if (entry.routerLink) {
                <a
                  data-star-part="item"
                  class="star-menu__item"
                  cdkMenuItem
                  [routerLink]="entry.routerLink"
                  [cdkMenuItemDisabled]="!!entry.disabled"
                  (cdkMenuItemTriggered)="run(entry)"
                >
                  <ng-container *ngTemplateOutlet="entryContent; context: { $implicit: entry }" />
                </a>
              } @else if (entry.url) {
                <a
                  data-star-part="item"
                  class="star-menu__item"
                  cdkMenuItem
                  [href]="entry.url"
                  [cdkMenuItemDisabled]="!!entry.disabled"
                  (cdkMenuItemTriggered)="run(entry)"
                >
                  <ng-container *ngTemplateOutlet="entryContent; context: { $implicit: entry }" />
                </a>
              } @else {
                <button
                  data-star-part="item"
                  type="button"
                  class="star-menu__item"
                  cdkMenuItem
                  [class.star-menu__item--danger]="entry.danger"
                  [cdkMenuItemDisabled]="!!entry.disabled"
                  (cdkMenuItemTriggered)="run(entry)"
                >
                  <ng-container *ngTemplateOutlet="entryContent; context: { $implicit: entry }" />
                </button>
              }
            }
          </div>
        }
      </div>
    </ng-template>

    <ng-template #barContent let-item let-sub="sub">
      @if (slots().get('item'); as custom) {
        <ng-container *ngTemplateOutlet="custom; context: context(item, 0, !!sub)" />
      } @else {
        @if (item.icon) {
          @if (slots().get('itemIcon'); as custom) {
            <span data-star-part="itemIcon" aria-hidden="true">
              <ng-container *ngTemplateOutlet="custom; context: context(item, 0, !!sub)" />
            </span>
          } @else {
            <i data-star-part="itemIcon" [class]="item.icon" aria-hidden="true"></i>
          }
        }
        {{ item.label }}
      }
    </ng-template>

    <ng-template #entryContent let-entry>
      @if (slots().get('item'); as custom) {
        <ng-container *ngTemplateOutlet="custom; context: context(entry, 2, false)" />
      } @else {
        @if (entry.icon) {
          @if (slots().get('itemIcon'); as custom) {
            <span data-star-part="icon" class="star-menu__icon" aria-hidden="true">
              <ng-container *ngTemplateOutlet="custom; context: context(entry, 2, false)" />
            </span>
          } @else {
            <i
              data-star-part="icon"
              class="star-menu__icon"
              [class]="entry.icon"
              aria-hidden="true"
            ></i>
          }
        }
        <span data-star-part="label" class="star-menu__label">{{ entry.label }}</span>
      }
    </ng-template>
  `,
})
export class StarMegaMenu {
  /** Keeps the CDK direction (overlays and menus) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  /** Leave motion of a panel; the focus leaves the panel first. */
  protected readonly leavePanel = ɵstarLeaveWithClass('star-menu--leaving', { blurFocus: true });
  readonly items = input<readonly StarMenuItem[]>([]);
  readonly ariaLabel = input<string | null>(null);
  /** Id of an element that names the bar, when there is no `ariaLabel`. PrimeNG `ariaLabelledBy`. */
  readonly ariaLabelledBy = input<string | null>(null);
  readonly itemClick = output<StarMenuItem>();

  protected readonly positions = STAR_MENU_POSITIONS;
  private readonly contentSlots = contentChildren(StarSlot, { descendants: true });
  protected readonly slots = starSlotMap<StarMenuItemContext>(
    this.contentSlots,
    this,
    'menuTemplate',
  );
  protected readonly icons = starSlotMap<StarIconContext>(this.contentSlots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};
  protected context(item: StarMenuItem, level: number, sub: boolean): StarMenuItemContext {
    return { $implicit: item, level, hasSubmenu: sub };
  }
  protected readonly panelId = `star-mega-${Math.random().toString(36).slice(2)}`;

  protected run(item: StarMenuItem): void {
    if (item.disabled) return;
    item.command?.(item);
    this.itemClick.emit(item);
  }
}
