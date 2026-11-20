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
        role="list"
        tabindex="0"
        [orientation]="orientation()"
        [itemSize]="size()"
        [minBufferPx]="size() * 4"
        [maxBufferPx]="size() * 8"
        [style.height]="scrollHeight()"
        [style.width]="scrollWidth()"
        [style.--star-scroller-item-size.px]="size()"
        [attr.aria-label]="ariaLabel()"
      >
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
          @if (itemSlot(); as custom) {
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
      </cdk-virtual-scroll-viewport>
      @if (loading()) {
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
  /** Scroll direction. */
  readonly orientation = input<'vertical' | 'horizontal'>('vertical');
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
      const measure = () => {
        // `start` is the inline start (left in LTR, right in RTL); `top` the block start.
        this.offset.set(viewport.measureScrollOffset(horizontal ? 'start' : 'top'));
        this.viewportSize.set(viewport.getViewportSize());
      };
      const scrolled = viewport.elementScrolled().subscribe(measure);
      const rendered = viewport.renderedRangeStream.subscribe((range) => this.emitLazy(range));
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
    this.lazyLoad.emit(next);
  }
}

/** The scroller and its item slot, for one-line imports. */
export const STAR_VIRTUAL_SCROLLER = [StarVirtualScroller, StarVirtualItemTemplate] as const;
