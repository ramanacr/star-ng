import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  Directive,
  forwardRef,
  inject,
  input,
  model,
  TemplateRef,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarEmptyContext,
  starSlot,
  StarSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarPaginator } from '@star-ng/ui/paginator';

// ---------------------------------------------------------------- Data view

/** Item template: `<ng-template starDataViewItem let-item let-layout="layout">`. */
@Directive({ selector: 'ng-template[starDataViewItem]' })
export class StarDataViewItem<T = unknown> {
  readonly starDataViewItemOf = input<readonly T[] | null>(null);
  readonly template =
    inject<TemplateRef<{ $implicit: T; layout: 'list' | 'grid'; index: number }>>(TemplateRef);
  static ngTemplateContextGuard<T>(
    _dir: StarDataViewItem<T>,
    _ctx: unknown,
  ): _ctx is { $implicit: T; layout: 'list' | 'grid'; index: number } {
    return true;
  }
}

/**
 * Data view (PrimeNG `p-dataview`): items in a list or a responsive grid, layout switch,
 * client pagination and an empty state. It does not sort: sort the items before you pass them in.
 * You design each item with a template.
 *
 * ```html
 * <star-data-view [items]="products" [(layout)]="layout" paginator [rows]="6">
 *   <ng-template starDataViewItem let-p let-layout="layout">…</ng-template>
 * </star-data-view>
 * ```
 *
 * Slots (content children): `starHeader` (content above the layout switch), `starFooter`
 * (content below the items and the paginator) and `starEmpty` (replaces the empty message;
 * `$implicit` is `''`, because the data view has no filter). The item template is
 * `starDataViewItem`. Keep interactive content in your own items and in the header and footer
 * slots: the data view has no keyboard model of its own for them.
 */
@Component({
  selector: 'star-data-view',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet, StarPaginator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarDataView) }],
  host: { class: 'star-data-view' },
  template: `
    @if (headerSlot(); as header) {
      <ng-container *ngTemplateOutlet="header" />
    }
    <div data-star-part="header" class="star-data-view__header">
      <ng-content select="[starDataViewHeader]" />
      <div
        data-star-part="segmentedPanel"
        class="star-segmented star-segmented--sm"
        role="radiogroup"
        [attr.aria-label]="text.layout"
      >
        @for (option of layouts; track option.id) {
          <button
            data-star-part="item"
            type="button"
            role="radio"
            class="star-segmented__item"
            [class.star-segmented__item--on]="layout() === option.id"
            [attr.aria-checked]="layout() === option.id"
            [attr.aria-label]="option.label"
            (click)="layout.set(option.id)"
          >
            <i data-star-part="itemIcon" [class]="option.icon" aria-hidden="true"></i>
          </button>
        }
      </div>
    </div>
    <ul
      data-star-part="itemsList"
      class="star-data-view__items"
      [class.star-data-view__items--grid]="layout() === 'grid'"
    >
      @for (item of pageItems(); track $index; let i = $index) {
        <li data-star-part="item" class="star-data-view__item">
          @if (itemTemplate(); as custom) {
            <ng-container
              *ngTemplateOutlet="
                custom.template;
                context: { $implicit: item, layout: layout(), index: i }
              "
            />
          }
        </li>
      } @empty {
        <li data-star-part="emptyItem" class="star-table__empty">
          <i data-star-part="emptyIcon" class="ph-bold ph-tray" aria-hidden="true"></i>
          @if (emptySlot(); as custom) {
            <ng-container *ngTemplateOutlet="custom; context: emptyContext" />
          } @else {
            {{ emptyMessage() ?? text.noData }}
          }
        </li>
      }
    </ul>
    @if (paginator() && items().length > rows()) {
      <star-paginator
        [totalRecords]="items().length"
        [(first)]="first"
        [(rows)]="rows"
        [rowsPerPageOptions]="[]"
      />
    }
    @if (footerSlot(); as footer) {
      <ng-container *ngTemplateOutlet="footer" />
    }
  `,
})
export class StarDataView<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly layouts = [
    { id: 'list' as const, label: this.text.layoutList, icon: 'ph-bold ph-list' },
    { id: 'grid' as const, label: this.text.layoutGrid, icon: 'ph-bold ph-squares-four' },
  ];
  readonly items = input<readonly T[]>([]);
  readonly layout = model<'list' | 'grid'>('list');
  readonly paginator = input(false, { transform: booleanAttribute });
  readonly rows = model(6);
  readonly first = model(0);
  readonly emptyMessage = input<string | null>(null);
  protected readonly itemTemplate = contentChild(StarDataViewItem);

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  /** The data view has no filter, so the empty slot always gets `''`. */
  protected readonly emptyContext: StarEmptyContext = { $implicit: '' };

  protected readonly pageItems = computed(() =>
    this.paginator() ? this.items().slice(this.first(), this.first() + this.rows()) : this.items(),
  );
}

// ---------------------------------------------------------------- Order list and pick list

export * from './order-list';
export * from './pick-list';
