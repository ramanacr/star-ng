import { CdkContextMenuTrigger, CdkMenuBar, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { StarDirectionService, StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
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
 */
@Component({
  selector: 'star-menubar',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [
    StarPart,
    CdkMenuBar,
    CdkMenuItem,
    CdkMenuTrigger,
    RouterLink,
    RouterLinkActive,
    StarMenu,
    StarMenuInDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-menubar' },
  template: `
    <ng-content select="[starMenubarStart]" />
    <div starPart="bar" class="star-menubar__bar" cdkMenuBar [attr.aria-label]="ariaLabel()">
      @for (item of items(); track $index) {
        @if (item.items?.length) {
          <button
            starPart="item"
            type="button"
            class="star-menubar__item"
            cdkMenuItem
            [cdkMenuTriggerFor]="submenu.template()"
            [cdkMenuTriggerData]="{ $implicit: item.items }"
            [cdkMenuItemDisabled]="!!item.disabled"
          >
            @if (item.icon) {
              <i starPart="icon" [class]="item.icon" aria-hidden="true"></i>
            }
            {{ item.label }}
            <i
              starPart="caret"
              class="ph-bold ph-caret-down star-menubar__caret"
              aria-hidden="true"
            ></i>
          </button>
        } @else if (item.routerLink) {
          <a
            starPart="item"
            class="star-menubar__item"
            cdkMenuItem
            routerLinkActive="star-menubar__item--active"
            [routerLink]="item.routerLink"
            [cdkMenuItemDisabled]="!!item.disabled"
            (cdkMenuItemTriggered)="run(item)"
          >
            @if (item.icon) {
              <i starPart="icon" [class]="item.icon" aria-hidden="true"></i>
            }
            {{ item.label }}
          </a>
        } @else {
          <button
            starPart="item"
            type="button"
            class="star-menubar__item"
            cdkMenuItem
            [cdkMenuItemDisabled]="!!item.disabled"
            (cdkMenuItemTriggered)="run(item)"
          >
            @if (item.icon) {
              <i starPart="icon" [class]="item.icon" aria-hidden="true"></i>
            }
            {{ item.label }}
          </button>
        }
      }
    </div>
    <span starPart="end" class="star-menubar__end"><ng-content select="[starMenubarEnd]" /></span>
    <star-menu #submenu (itemClick)="itemClick.emit($event)" />
  `,
})
export class StarMenubar {
  /** Keeps the CDK direction (overlays and menus) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  readonly items = input<readonly StarMenuItem[]>([]);
  readonly ariaLabel = input<string | null>(null);
  readonly itemClick = output<StarMenuItem>();

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
