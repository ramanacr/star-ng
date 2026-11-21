import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  Directive,
  forwardRef,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

export interface StarBreadcrumbItem {
  readonly label: string;
  readonly routerLink?: string | readonly unknown[];
  readonly url?: string;
  readonly icon?: string;
  /** Action of an item without a link: the item renders as a button. */
  readonly command?: () => void;
}

/** Context of the `starBreadcrumbTemplate` slots. */
export interface StarBreadcrumbItemContext {
  /** The item (the home item is the first one). */
  readonly $implicit: StarBreadcrumbItem;
  /** Position in the trail, from `0`. */
  readonly index: number;
  /** The item is the current page (the last one). */
  readonly current: boolean;
}

/**
 * Template slot of `star-breadcrumb`:
 * - `item`: the content of each item (icon and label). The link, the button and
 *   `aria-current` stay. PrimeNG `#item`.
 * - `separator`: the separator after each item but the last. It is decorative (`aria-hidden`).
 *   PrimeNG `#separator`.
 *
 * Do not add focusable elements in `item`: the item is already a link or a button. Keep the label
 * text in it: it is the accessible name.
 */
@Directive({
  selector: 'ng-template[starBreadcrumbTemplate]',
  providers: [{ provide: StarSlot, useExisting: StarBreadcrumbTemplate }],
})
export class StarBreadcrumbTemplate extends StarSlot<StarBreadcrumbItemContext> {
  readonly name = 'breadcrumb';
  readonly starBreadcrumbTemplate = input.required<'item' | 'separator'>();

  override slotKey(): string {
    return this.starBreadcrumbTemplate();
  }

  static ngTemplateContextGuard(
    _dir: StarBreadcrumbTemplate,
    _ctx: unknown,
  ): _ctx is StarBreadcrumbItemContext {
    return true;
  }
}

/**
 * Breadcrumb (PrimeNG `p-breadcrumb`): `nav` landmark, ordered list, `aria-current="page"` on
 * the last item, optional home link.
 *
 * `<star-breadcrumb [home]="{ label: 'Home', icon: 'ph-bold ph-house', routerLink: '/' }" [items]="trail" />`
 *
 * Slots (content children): `starBreadcrumbTemplate` with `item` and `separator`.
 *
 * PrimeNG names that star-ng covers in another way: `model` = `items`, `homeAriaLabel` = the
 * `label` of `home` (it names the icon link), `onItemClick` = `itemClick`, `style` and
 * `styleClass` = `pt`.
 */
@Component({
  selector: 'star-breadcrumb',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [RouterLink, NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarBreadcrumb) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      data-star-part="trailPanel"
      class="star-breadcrumb"
      [attr.aria-label]="ariaLabel() ?? text.breadcrumb"
    >
      <ol data-star-part="list" class="star-breadcrumb__list">
        @for (item of all(); track $index; let last = $last, i = $index) {
          @let custom = slots().get('item');
          @let ctx = { $implicit: item, index: i, current: last };
          <li data-star-part="item" class="star-breadcrumb__item">
            @if (last) {
              <span
                data-star-part="currentPanel"
                class="star-breadcrumb__current"
                aria-current="page"
              >
                @if (custom) {
                  <ng-container *ngTemplateOutlet="custom; context: ctx" />
                } @else {
                  @if (item.icon) {
                    <i data-star-part="currentIcon" [class]="item.icon" aria-hidden="true"></i>
                  }
                  {{ item.label }}
                }
              </span>
            } @else {
              @if (item.routerLink) {
                <a
                  data-star-part="linkItem"
                  class="star-breadcrumb__link"
                  [routerLink]="item.routerLink"
                  [attr.aria-label]="!custom && item.icon && $first && home() ? item.label : null"
                  (click)="itemClick.emit(item)"
                >
                  @if (custom) {
                    <ng-container *ngTemplateOutlet="custom; context: ctx" />
                  } @else {
                    @if (item.icon) {
                      <i data-star-part="linkIcon" [class]="item.icon" aria-hidden="true"></i>
                    }
                    @if (!(item.icon && $first && home())) {
                      {{ item.label }}
                    }
                  }
                </a>
              } @else if (item.url) {
                <a
                  data-star-part="linkItem"
                  class="star-breadcrumb__link"
                  [href]="item.url"
                  (click)="itemClick.emit(item)"
                >
                  @if (custom) {
                    <ng-container *ngTemplateOutlet="custom; context: ctx" />
                  } @else {
                    {{ item.label }}
                  }
                </a>
              } @else if (item.command) {
                <button
                  data-star-part="linkButton"
                  type="button"
                  class="star-breadcrumb__link"
                  (click)="item.command(); itemClick.emit(item)"
                >
                  @if (custom) {
                    <ng-container *ngTemplateOutlet="custom; context: ctx" />
                  } @else {
                    @if (item.icon) {
                      <i data-star-part="linkIcon" [class]="item.icon" aria-hidden="true"></i>
                    }
                    {{ item.label }}
                  }
                </button>
              } @else {
                <span data-star-part="itemText">
                  @if (custom) {
                    <ng-container *ngTemplateOutlet="custom; context: ctx" />
                  } @else {
                    {{ item.label }}
                  }
                </span>
              }
              @if (slots().get('separator'); as separator) {
                <span data-star-part="separator" class="star-breadcrumb__sep" aria-hidden="true">
                  <ng-container *ngTemplateOutlet="separator; context: ctx" />
                </span>
              } @else {
                <i
                  data-star-part="separator"
                  class="ph-bold ph-caret-right star-breadcrumb__sep star-icon-mirror"
                  aria-hidden="true"
                ></i>
              }
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class StarBreadcrumb {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly items = input<readonly StarBreadcrumbItem[]>([]);
  /** First item; when it has an icon, only the icon shows (label stays for screen readers). */
  readonly home = input<StarBreadcrumbItem | null>(null);
  readonly ariaLabel = input<string | null>(null);
  /** Emits the item of a link or button that the user activated. PrimeNG `onItemClick`. */
  readonly itemClick = output<StarBreadcrumbItem>();

  private readonly contentSlots = contentChildren(StarSlot, { descendants: true });
  protected readonly slots = starSlotMap<StarBreadcrumbItemContext>(
    this.contentSlots,
    this,
    'breadcrumb',
  );

  protected all(): readonly StarBreadcrumbItem[] {
    const home = this.home();
    return home ? [home, ...this.items()] : this.items();
  }
}
