import { CdkMenu, CdkMenuBar, CdkMenuGroup, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StarDirectionService, StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { STAR_MENU_POSITIONS, StarMenuInDialog, StarMenuItem } from './menu';

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
    RouterLink,
    StarMenuInDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-menubar star-mega-menu' },
  // CDK resolves the menu of an item by DI, so every `cdkMenuItem` is written in place:
  // a shared `ng-template` for the items would be outside the menu.
  template: `
    <div data-star-part="bar" class="star-menubar__bar" cdkMenuBar [attr.aria-label]="ariaLabel()">
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
            @if (item.icon) {
              <i data-star-part="itemIcon" [class]="item.icon" aria-hidden="true"></i>
            }
            {{ item.label }}
            <i
              data-star-part="caret"
              class="ph-bold ph-caret-down star-menubar__caret"
              aria-hidden="true"
            ></i>
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
            @if (item.icon) {
              <i data-star-part="itemIcon" [class]="item.icon" aria-hidden="true"></i>
            }
            {{ item.label }}
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
            @if (item.icon) {
              <i data-star-part="itemIcon" [class]="item.icon" aria-hidden="true"></i>
            }
            {{ item.label }}
          </button>
        }
      }
    </div>

    <ng-template #panel let-columns>
      <div starPart="panel" class="star-menu star-mega-menu__panel" cdkMenu>
        @for (column of columns; track $index; let c = $index) {
          <div
            data-star-part="column"
            class="star-mega-menu__column"
            cdkMenuGroup
            [attr.aria-labelledby]="column.label ? panelId + '-' + c : null"
          >
            @if (column.label) {
              <div
                data-star-part="heading"
                class="star-mega-menu__heading"
                [id]="panelId + '-' + c"
              >
                {{ column.label }}
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
                  @if (entry.icon) {
                    <i
                      data-star-part="icon"
                      class="star-menu__icon"
                      [class]="entry.icon"
                      aria-hidden="true"
                    ></i>
                  }
                  <span data-star-part="label" class="star-menu__label">{{ entry.label }}</span>
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
                  @if (entry.icon) {
                    <i
                      data-star-part="icon"
                      class="star-menu__icon"
                      [class]="entry.icon"
                      aria-hidden="true"
                    ></i>
                  }
                  <span data-star-part="label" class="star-menu__label">{{ entry.label }}</span>
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
                  @if (entry.icon) {
                    <i
                      data-star-part="icon"
                      class="star-menu__icon"
                      [class]="entry.icon"
                      aria-hidden="true"
                    ></i>
                  }
                  <span data-star-part="label" class="star-menu__label">{{ entry.label }}</span>
                </button>
              }
            }
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class StarMegaMenu {
  /** Keeps the CDK direction (overlays and menus) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  readonly items = input<readonly StarMenuItem[]>([]);
  readonly ariaLabel = input<string | null>(null);
  readonly itemClick = output<StarMenuItem>();

  protected readonly positions = STAR_MENU_POSITIONS;
  protected readonly panelId = `star-mega-${Math.random().toString(36).slice(2)}`;

  protected run(item: StarMenuItem): void {
    if (item.disabled) return;
    item.command?.(item);
    this.itemClick.emit(item);
  }
}
