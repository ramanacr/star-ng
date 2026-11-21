import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';
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
  forwardRef,
  inject,
  Injector,
  input,
  output,
  signal,
  TrackByFunction,
  viewChild,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  starSlot,
  StarSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
  type StarEmptyContext,
} from '@star-ng/ui/core';
import { StarSpinner } from '@star-ng/ui/spinner';

/** Context of the item slot of `star-virtual-scroller`. */
export interface StarVirtualItemContext<T> {
  /** The item (`let-item`). In lazy mode it can be a placeholder (for example `null`) until its page loads. */
  readonly $implicit: T;
  /** Position of the item in `items`. */
  readonly index: number;
  /** Number of items. */
  readonly count: number;
  readonly first: boolean;
  readonly last: boolean;
  readonly even: boolean;
  readonly odd: boolean;
  /** With `orientation="both"`: the column of the cell (`$implicit` is the cell, `index` the row). */
  readonly column?: number;
}

/** Context of the loader slot of `star-virtual-scroller`. */
export interface StarVirtualLoaderContext {
  /** Position of the item that is loading. */
  readonly index: number;
  /** Number of items. */
  readonly count: number;
}

/** Context of the content slot of `star-virtual-scroller`. */
export interface StarVirtualContentContext<T> {
  /** The items that are rendered now (in view and the buffer). */
  readonly $implicit: readonly T[];
  /** Position of the first rendered item in `items`. */
  readonly first: number;
  /** Number of items. */
  readonly count: number;
  /** Size of one item in pixels. */
  readonly itemSize: number;
}

/** A range of item positions. `first` is included, `last` is not (like `Array.slice`). */
export interface StarVirtualRange {
  readonly first: number;
  readonly last: number;
}

/**
 * Renders one item of `star-virtual-scroller`:
 * `<ng-template starVirtualItem let-order let-i="index">…</ng-template>`. PrimeNG `#item` template.
 */
@Directive({
  selector: 'ng-template[starVirtualItem]',
  providers: [{ provide: StarSlot, useExisting: StarVirtualItemTemplate }],
})
export class StarVirtualItemTemplate<T = unknown> extends StarSlot<StarVirtualItemContext<T>> {
  readonly name = 'virtualItem';
  /** Optional: pass the items array to type `let-item` in strict templates. */
  readonly starVirtualItemOf = input<readonly T[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarVirtualItemTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarVirtualItemContext<T> {
    return true;
  }
}

/**
 * Renders a placeholder in place of each rendered item while `loading` is on:
 * `<ng-template starVirtualLoader let-i="index">…</ng-template>`. PrimeNG `#loader` template.
 * Without it, `loading` shows one spinner over the items.
 */
@Directive({
  selector: 'ng-template[starVirtualLoader]',
  providers: [{ provide: StarSlot, useExisting: StarVirtualLoaderTemplate }],
})
export class StarVirtualLoaderTemplate extends StarSlot<StarVirtualLoaderContext> {
  readonly name = 'virtualLoader';

  static ngTemplateContextGuard(
    _dir: StarVirtualLoaderTemplate,
    _ctx: unknown,
  ): _ctx is StarVirtualLoaderContext {
    return true;
  }
}

/**
 * Renders the rendered items in one template, in place of one item template per item:
 * `<ng-template starVirtualContent let-items let-first="first">…</ng-template>`. The template is
 * placed at the scroll offset of the first rendered item, so draw the items one after the other
 * with the size `itemSize`. PrimeNG `#content` template. Give the items your own roles (for
 * example a table or a list): the viewport has no list role then.
 */
@Directive({
  selector: 'ng-template[starVirtualContent]',
  providers: [{ provide: StarSlot, useExisting: StarVirtualContentTemplate }],
})
export class StarVirtualContentTemplate<T = unknown> extends StarSlot<
  StarVirtualContentContext<T>
> {
  readonly name = 'virtualContent';
  /** Optional: pass the items array to type `let-items` in strict templates. */
  readonly starVirtualContentOf = input<readonly T[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarVirtualContentTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarVirtualContentContext<T> {
    return true;
  }
}

/**
 * Virtual scroller (PrimeNG `p-scroller`, Angular CDK `cdk-virtual-scroll-viewport`): renders only
 * the items in and near the view, so a list of thousands of items stays fast. Every item has the
 * same size (`itemSize`, in pixels). Vertical or horizontal. With `lazy`, the scroller emits
 * `lazyLoad` with the range it renders, and the application loads the data for that range.
 *
 * ```html
 * <star-virtual-scroller [items]="orders" [itemSize]="48" scrollHeight="20rem" ariaLabel="Orders">
 *   <ng-template starVirtualItem let-order>{{ order.number }}</ng-template>
 * </star-virtual-scroller>
 * ```
 *
 * The viewport is a `list` that can take focus, so the keyboard can scroll it. Only the rendered
 * items are in the DOM; each has `aria-setsize` and `aria-posinset`, so a screen reader announces
 * the real position. Do not put focusable elements in the items: an item that scrolls out of view
 * leaves the DOM, and its focus is lost. For a selectable list, use `star-listbox` with
 * `virtualScroll`.
 *
 * With an empty `items` array the viewport does not render, so it never emits a range. Lazy mode
 * therefore needs an array of the full length, with placeholders for the items not loaded yet.
 *
 * With `orientation="both"`, `items` is an array of rows and each row an array of cells: the rows
 * scroll virtually, and each row renders only the columns in view (`columnSize` wide).
 *
 * Slots (content children): `starVirtualItem` (PrimeNG `#item`), `starVirtualLoader` (`#loader`),
 * `starVirtualContent` (`#content`), `starLoading` (`#loadericon`), `starEmpty`.
 *
 * PrimeNG names that star-ng covers in another way: `onLazyLoad` = `lazyLoad`, `onScrollIndexChange`
 * = `visibleRange`, `showLoader` = the `starVirtualLoader` slot, `step` and `appendOnly` = the
 * buffer of the CDK viewport. Not applicable: `autoSize` (every item has the same size),
 * `inline` (the viewport is always a block).
 */
@Component({
  selector: 'star-virtual-scroller',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [
    NgTemplateOutlet,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    StarSpinner,
  ],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarVirtualScroller) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-scroller',
    '[class.star-scroller--horizontal]': "orientation() === 'horizontal'",
    '[class.star-scroller--both]': "orientation() === 'both'",
    '[attr.aria-busy]': 'loading() || null',
  },
  template: `
    @if (items().length === 0) {
      <div
        data-star-part="emptyPanel"
        class="star-scroller__empty"
        [style.height]="orientation() === 'horizontal' ? scrollHeight() : null"
      >
        @if (loading()) {
          @if (loadingSlot(); as custom) {
            <ng-container *ngTemplateOutlet="custom" />
          } @else {
            <star-spinner size="1.5rem" />
          }
        } @else if (emptySlot(); as custom) {
          <ng-container *ngTemplateOutlet="custom; context: { $implicit: '' }" />
        } @else {
          {{ text.noData }}
        }
      </div>
    } @else {
      <cdk-virtual-scroll-viewport
        class="star-scroller__viewport"
        tabindex="0"
        [attr.role]="contentSlot() ? null : 'list'"
        [orientation]="orientation() === 'horizontal' ? 'horizontal' : 'vertical'"
        [itemSize]="size()"
        [minBufferPx]="size() * 4"
        [maxBufferPx]="size() * 8"
        [style.height]="scrollHeight()"
        [style.width]="scrollWidth()"
        [style.--star-scroller-item-size.px]="size()"
        [attr.aria-label]="ariaLabel()"
      >
        @if (contentSlot(); as custom) {
          <!-- The CDK loop drives the range and the total size; the content slot draws the items. -->
          <ng-container *cdkVirtualFor="let item of items(); trackBy: trackBy() ?? undefined" />
          <div data-star-part="contentPanel" class="star-scroller__content">
            <ng-container *ngTemplateOutlet="custom; context: contentContext()" />
          </div>
        } @else {
          <div
            data-star-part="item"
            *cdkVirtualFor="
              let item of items();
              let i = index;
              let count = count;
              let first = first;
              let last = last;
              let even = even;
              let odd = odd;
              trackBy: trackBy() ?? undefined
            "
            class="star-scroller__item"
            role="listitem"
            [attr.aria-setsize]="count"
            [attr.aria-posinset]="i + 1"
          >
            @if (loading() && loaderSlot(); as loader) {
              <ng-container *ngTemplateOutlet="loader; context: { index: i, count: count }" />
            } @else if (orientation() === 'both') {
              <div
                data-star-part="rowPanel"
                class="star-scroller__row"
                [style.width.px]="columns().total * colSize()"
                [style.padding-inline-start.px]="columns().first * colSize()"
              >
                @for (entry of cells(item); track entry.column) {
                  <span
                    data-star-part="cellPanel"
                    class="star-scroller__cell"
                    [style.width.px]="colSize()"
                  >
                    @if (itemSlot(); as custom) {
                      <ng-container
                        *ngTemplateOutlet="
                          custom;
                          context: {
                            $implicit: entry.cell,
                            index: i,
                            column: entry.column,
                            count: count,
                            first: first,
                            last: last,
                            even: even,
                            odd: odd,
                          }
                        "
                      />
                    } @else {
                      {{ entry.cell }}
                    }
                  </span>
                }
              </div>
            } @else if (itemSlot(); as custom) {
              <ng-container
                *ngTemplateOutlet="
                  custom;
                  context: {
                    $implicit: item,
                    index: i,
                    count: count,
                    first: first,
                    last: last,
                    even: even,
                    odd: odd,
                  }
                "
              />
            } @else {
              {{ item }}
            }
          </div>
        }
      </cdk-virtual-scroll-viewport>
      @if (loading() && !loaderSlot()) {
        <div data-star-part="loadingItem" class="star-scroller__loading">
          @if (loadingSlot(); as custom) {
            <ng-container *ngTemplateOutlet="custom" />
          } @else {
            <star-spinner size="1.5rem" />
          }
        </div>
      }
    }
  `,
})
export class StarVirtualScroller<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly injector = inject(Injector);

  /** The items. In lazy mode, an array with one entry per item, where items not loaded yet are placeholders. */
  readonly items = input<readonly T[]>([]);
  /** Size of one item in pixels: the height (vertical) or the width (horizontal). Every item has this size. */
  readonly itemSize = input(40);
  /**
   * Scroll direction. `'both'`: `items` are rows of cells; the rows and the columns scroll.
   * PrimeNG `orientation`.
   */
  readonly orientation = input<'vertical' | 'horizontal' | 'both'>('vertical');
  /** With `orientation="both"`: width of one column in pixels (default `itemSize`). */
  readonly columnSize = input<number | null>(null);
  /**
   * Milliseconds to wait after the rendered range changes before `lazyLoad` emits, so a fast
   * scroll asks once (default `0`). PrimeNG `delay`.
   */
  readonly delay = input(0);
  /** CSS height of the viewport. A horizontal scroller needs it too: the viewport does not grow with its items. */
  readonly scrollHeight = input('20rem');
  /** CSS width of the viewport. */
  readonly scrollWidth = input('100%');
  /** Emits `lazyLoad` when the rendered range changes. */
  readonly lazy = input(false, { transform: booleanAttribute });
  /** Shows the loading slot (or a spinner) over the items, and sets `aria-busy`. */
  readonly loading = input(false, { transform: booleanAttribute });
  /** Identity of an item, so the scroller keeps its DOM when the array changes. Default: the item itself. */
  readonly trackBy = input<TrackByFunction<T> | null>(null);
  /** Accessible name of the list. */
  readonly ariaLabel = input<string | null>(null);

  /** Lazy mode: the range of items that is rendered now (with the buffer), so their data is needed. */
  readonly lazyLoad = output<StarVirtualRange>();

  private readonly viewport = viewChild(CdkVirtualScrollViewport);
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly itemSlot = starSlot<StarVirtualItemContext<T>>(
    this.slots,
    this,
    'virtualItem',
  );
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  protected readonly loadingSlot = starSlot<object>(this.slots, this, 'loading');
  protected readonly loaderSlot = starSlot<StarVirtualLoaderContext>(
    this.slots,
    this,
    'virtualLoader',
  );
  protected readonly contentSlot = starSlot<StarVirtualContentContext<T>>(
    this.slots,
    this,
    'virtualContent',
  );
  /** The range that the viewport renders now (with the buffer). */
  private readonly rendered = signal<{ readonly start: number; readonly end: number }>({
    start: 0,
    end: 0,
  });
  /** Context of the content slot. */
  protected readonly contentContext = computed<StarVirtualContentContext<T>>(() => {
    const { start, end } = this.rendered();
    return {
      $implicit: this.items().slice(start, end),
      first: start,
      count: this.items().length,
      itemSize: this.size(),
    };
  });
  protected readonly colSize = computed(() => Math.max(1, this.columnSize() ?? this.itemSize()));
  private readonly offsetX = signal(0);
  private readonly widthX = signal(0);
  /** With `orientation="both"`: the columns to render (in view and two on each side). */
  protected readonly columns = computed(() => {
    const size = this.colSize();
    const total = Math.max(
      0,
      ...this.items().map((row) => (row as readonly unknown[]).length ?? 0),
    );
    const first = Math.max(0, Math.floor(this.offsetX() / size) - 2);
    const last = Math.min(total, Math.ceil((this.offsetX() + this.widthX()) / size) + 2);
    return { first, last: Math.max(first, last), total };
  });
  /** The cells of a row to render, with their column. */
  protected cells(row: unknown): { readonly cell: T; readonly column: number }[] {
    const { first, last } = this.columns();
    const cells = (row as readonly T[]) ?? [];
    const out: { cell: T; column: number }[] = [];
    for (let c = first; c < Math.min(last, cells.length); c++)
      out.push({ cell: cells[c], column: c });
    return out;
  }
  private lazyTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly size = computed(() => Math.max(1, this.itemSize()));
  private readonly offset = signal(0);
  private readonly viewportSize = signal(0);
  private lastLazy: StarVirtualRange | null = null;

  /** The items in view now (without the buffer). `last` is not included. */
  readonly visibleRange = computed<StarVirtualRange>(() => {
    const count = this.items().length;
    const size = this.size();
    const first = Math.min(count, Math.floor(this.offset() / size));
    const last = Math.min(count, Math.ceil((this.offset() + this.viewportSize()) / size));
    return { first, last: Math.max(first, last) };
  });

  constructor() {
    // Lazy mode asks for the range in view at once, so the first page loads without a scroll.
    // Without lazy mode, the last range is forgotten: a later switch to lazy emits again.
    effect(() => {
      const viewport = this.viewport();
      if (!this.lazy()) {
        this.lastLazy = null;
        return;
      }
      if (viewport) this.emitLazy(viewport.getRenderedRange());
    });
    effect((onCleanup) => {
      const viewport = this.viewport();
      if (!viewport) return;
      // Read here, so a new orientation or item size runs the effect again and measures again.
      const horizontal = this.orientation() === 'horizontal';
      this.size();
      const element = viewport.getElementRef().nativeElement;
      const both = this.orientation() === 'both';
      const measure = () => {
        // `start` is the inline start (left in LTR, right in RTL); `top` the block start.
        this.offset.set(viewport.measureScrollOffset(horizontal ? 'start' : 'top'));
        this.viewportSize.set(viewport.getViewportSize());
        if (both) {
          this.offsetX.set(Math.abs(viewport.measureScrollOffset('start')));
          // Without layout (a test, a hidden parent) the width is 0: render the first columns.
          this.widthX.set(element.clientWidth || this.colSize() * 10);
        }
      };
      const scrolled = viewport.elementScrolled().subscribe(measure);
      const rendered = viewport.renderedRangeStream.subscribe((range) => {
        this.rendered.set(range);
        this.emitLazy(range);
      });
      if (both) this.widthX.set(element.clientWidth || this.colSize() * 10);
      afterNextRender(
        () => {
          // The rows are list items of the viewport: the wrapper between them has no role.
          element
            .querySelector('.cdk-virtual-scroll-content-wrapper')
            ?.setAttribute('role', 'presentation');
          measure();
        },
        { injector: this.injector },
      );
      // The viewport measures its size once; a new size (hidden parent, window resize) needs a new measure.
      const observer =
        typeof ResizeObserver === 'undefined'
          ? null
          : new ResizeObserver(() => {
              viewport.checkViewportSize();
              measure();
            });
      observer?.observe(element);
      onCleanup(() => {
        scrolled.unsubscribe();
        rendered.unsubscribe();
        observer?.disconnect();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.lazyTimer) clearTimeout(this.lazyTimer);
    });
  }

  /** Scrolls so that the item at `index` is at the start of the view. */
  scrollToIndex(index: number, behavior: ScrollBehavior = 'auto'): void {
    this.viewport()?.scrollToIndex(index, behavior);
  }

  /** Scrolls to an offset in pixels from the start. */
  scrollTo(offset: number, behavior: ScrollBehavior = 'auto'): void {
    this.viewport()?.scrollToOffset(offset, behavior);
  }

  private emitLazy(range: { readonly start: number; readonly end: number }): void {
    // The CDK range is {0, 0} until the viewport attaches its strategy: that is not a range to load.
    if (!this.lazy() || range.end <= range.start) return;
    const next = { first: range.start, last: range.end };
    const previous = this.lastLazy;
    if (previous && previous.first === next.first && previous.last === next.last) return;
    this.lastLazy = next;
    const delay = this.delay();
    if (delay <= 0) {
      this.lazyLoad.emit(next);
      return;
    }
    // Debounce: only the last range of a fast scroll is asked for.
    if (this.lazyTimer) clearTimeout(this.lazyTimer);
    this.lazyTimer = setTimeout(() => {
      this.lazyTimer = null;
      if (this.lastLazy === next) this.lazyLoad.emit(next);
    }, delay);
  }
}

/** The scroller and its item slot, for one-line imports. */
export const STAR_VIRTUAL_SCROLLER = [
  StarVirtualScroller,
  StarVirtualItemTemplate,
  StarVirtualLoaderTemplate,
  StarVirtualContentTemplate,
] as const;
