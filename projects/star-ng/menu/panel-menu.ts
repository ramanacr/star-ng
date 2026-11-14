import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { StarMenuItem } from './menu';

/**
 * Panel menu (PrimeNG `p-panelmenu`): a vertical menu where an item with child items opens
 * and closes in place, to any depth. Use it for side navigation with sections.
 *
 * Each parent is a button with `aria-expanded`; each leaf is a link or a button. Tab moves
 * through the open items; Enter or Space opens a section or runs an item.
 *
 * `<star-panel-menu ariaLabel="Settings" [items]="sections" [(expandedKeys)]="open" />`
 *
 * An item is identified by its position (`0`, `0.2`, `1.0.3`) in `expandedKeys`.
 */
@Component({
  selector: 'star-panel-menu',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-panel-menu' },
  template: `
    <nav [attr.aria-label]="ariaLabel()">
      <ng-container *ngTemplateOutlet="list; context: { $implicit: items(), path: '', level: 0 }" />
    </nav>

    <ng-template #list let-entries let-path="path" let-level="level">
      <ul class="star-panel-menu__list" [class.star-panel-menu__list--nested]="level > 0">
        @for (item of entries; track $index; let i = $index) {
          @let key = path ? path + '.' + i : '' + i;
          @if (item.separator) {
            <li class="star-panel-menu__separator" role="separator"></li>
          } @else if (item.items?.length) {
            <li>
              <button
                type="button"
                class="star-panel-menu__item star-panel-menu__item--parent"
                [class.star-panel-menu__item--root]="level === 0"
                [style.--star-level]="level"
                [disabled]="item.disabled"
                [attr.aria-expanded]="isOpen(key)"
                [attr.aria-controls]="isOpen(key) ? regionId(key) : null"
                (click)="toggle(key)"
              >
                @if (item.icon) {
                  <i class="star-panel-menu__icon" [class]="item.icon" aria-hidden="true"></i>
                }
                <span class="star-panel-menu__label">{{ item.label }}</span>
                <i class="ph-bold ph-caret-down star-panel-menu__caret" aria-hidden="true"></i>
              </button>
              @if (isOpen(key)) {
                <div [id]="regionId(key)">
                  <ng-container
                    *ngTemplateOutlet="
                      list;
                      context: { $implicit: item.items, path: key, level: level + 1 }
                    "
                  />
                </div>
              }
            </li>
          } @else if (item.routerLink) {
            <li>
              <a
                class="star-panel-menu__item"
                routerLinkActive="star-panel-menu__item--active"
                ariaCurrentWhenActive="page"
                [style.--star-level]="level"
                [routerLink]="item.disabled ? null : item.routerLink"
                [attr.aria-disabled]="item.disabled || null"
                (click)="run(item)"
              >
                <ng-container *ngTemplateOutlet="content; context: { $implicit: item }" />
              </a>
            </li>
          } @else if (item.url) {
            <li>
              <a
                class="star-panel-menu__item"
                [style.--star-level]="level"
                [attr.href]="item.disabled ? null : item.url"
                [attr.aria-disabled]="item.disabled || null"
                (click)="run(item)"
              >
                <ng-container *ngTemplateOutlet="content; context: { $implicit: item }" />
              </a>
            </li>
          } @else {
            <li>
              <button
                type="button"
                class="star-panel-menu__item"
                [class.star-panel-menu__item--danger]="item.danger"
                [style.--star-level]="level"
                [disabled]="item.disabled"
                (click)="run(item)"
              >
                <ng-container *ngTemplateOutlet="content; context: { $implicit: item }" />
              </button>
            </li>
          }
        }
      </ul>
    </ng-template>

    <ng-template #content let-item>
      @if (item.icon) {
        <i class="star-panel-menu__icon" [class]="item.icon" aria-hidden="true"></i>
      }
      <span class="star-panel-menu__label">{{ item.label }}</span>
    </ng-template>
  `,
})
export class StarPanelMenu {
  private readonly id = inject(_IdGenerator).getId('star-panel-menu-');

  readonly items = input<readonly StarMenuItem[]>([]);
  readonly ariaLabel = input<string | null>(null);
  /** Open one section at a time: opening a section closes its sibling sections. */
  readonly single = input(false, { transform: booleanAttribute });
  /** Positions of the open sections (`'0'`, `'0.2'`). Two-way. */
  readonly expandedKeys = model<readonly string[]>([]);
  readonly itemClick = output<StarMenuItem>();

  protected isOpen(key: string): boolean {
    return this.expandedKeys().includes(key);
  }

  protected regionId(key: string): string {
    return `${this.id}-${key.replaceAll('.', '-')}`;
  }

  /** Opens or closes the section at a position. */
  toggle(key: string): void {
    if (this.isOpen(key)) {
      // Closing a section also closes the sections inside it.
      this.expandedKeys.update((keys) =>
        keys.filter((open) => open !== key && !open.startsWith(`${key}.`)),
      );
      return;
    }
    const parent = key.includes('.') ? key.slice(0, key.lastIndexOf('.')) : '';
    const isSibling = (open: string) =>
      (open.includes('.') ? open.slice(0, open.lastIndexOf('.')) : '') === parent;
    this.expandedKeys.update((keys) => [
      ...(this.single()
        ? keys.filter(
            (open) =>
              !isSibling(open) && !keys.some((k) => isSibling(k) && open.startsWith(`${k}.`)),
          )
        : keys),
      key,
    ]);
  }

  protected run(item: StarMenuItem): void {
    if (item.disabled) return;
    item.command?.(item);
    this.itemClick.emit(item);
  }
}
