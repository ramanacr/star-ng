import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  model,
  numberAttribute,
  output,
  signal,
} from '@angular/core';
import {
  STAR_UI_TEXT,
  starInlineKey,
  starIsRtl,
  StarPart,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

/**
 * Columns per container width of `star-tile-layout`. Each entry applies while the layout is
 * narrower than its width: `sm` below 36rem, `md` below 48rem, `lg` below 64rem. A missing entry
 * takes the value of the next wider one, and `columns` applies above 64rem.
 */
export interface StarTileBreakpoints {
  readonly sm?: number;
  readonly md?: number;
  readonly lg?: number;
}

/** Payload of `tileResize`: the key of the tile and its new spans. */
export interface StarTileResize {
  readonly key: string;
  readonly colSpan: number;
  readonly rowSpan: number;
}

/** Largest row span that the keyboard and the pointer can give a tile. */
const MAX_ROW_SPAN = 12;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Tile layout (Material `mat-grid-list`, Kendo UI `TileLayout`): a CSS grid of tiles with
 * `columns`, `rowHeight` and `gap`. Each `star-tile` spans `colSpan` columns and `rowSpan` rows.
 *
 * - `reorderable`: the tiles move with the pointer (CDK drag and drop) or with Control and an
 *   arrow key on a focused tile. The new order goes to the `order` model (tile keys), and a
 *   polite live region reads the new position. Render the tiles in that order, as in the
 *   example below, so the reading order and the tab order follow the visual order.
 * - `resizable`: Control, Shift and an arrow key change the spans of the focused tile; a handle
 *   in its corner does the same with the pointer. `tileResize` reports each change.
 * - `breakpoints`: fewer columns in a narrow layout, with CSS container queries (no script).
 *
 * ```html
 * <star-tile-layout [columns]="4" rowHeight="9rem" reorderable resizable [(order)]="order">
 *   @for (key of order(); track key) {
 *     <star-tile [key]="key" [label]="titles[key]" [colSpan]="key === 'sales' ? 2 : 1">
 *       <span starTileHeader>{{ titles[key] }}</span>
 *       …body…
 *     </star-tile>
 *   }
 * </star-tile-layout>
 * ```
 */
@Component({
  selector: 'star-tile-layout',
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }, CdkDropList],
  host: {
    class: 'star-tile-layout',
    '[class.star-tile-layout--reorderable]': 'reorderable()',
    '[style.--star-tile-columns]': 'columns()',
    '[style.--star-tile-columns-sm]': 'breakpoints().sm ?? null',
    '[style.--star-tile-columns-md]': 'breakpoints().md ?? null',
    '[style.--star-tile-columns-lg]': 'breakpoints().lg ?? null',
    '[style.--star-tile-row-height]': 'rowHeightCss()',
    '[style.--star-tile-gap]': 'gap()',
  },
  template: `
    <div starPart="grid" class="star-tile-layout__grid" role="presentation"><ng-content /></div>
    <p class="star-sr-only" [id]="hintId">{{ hintText() }}</p>
    <p class="star-sr-only" aria-live="polite">{{ announcement() }}</p>
  `,
})
export class StarTileLayout {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly dropList = inject(CdkDropList);

  /** Number of columns (above the breakpoints). */
  readonly columns = input(3, { transform: numberAttribute });
  /** Height of one row: a CSS length, or a number of pixels. */
  readonly rowHeight = input<string | number>('10rem');
  /** Space between the tiles, a CSS length. */
  readonly gap = input('1rem');
  /** Columns in a narrow layout (container queries). */
  readonly breakpoints = input<StarTileBreakpoints>({});
  /** The tiles move with drag and drop, and with Control and the arrow keys. */
  readonly reorderable = input(false, { transform: booleanAttribute });
  /** The spans change with Control, Shift and the arrow keys, and with a corner handle. */
  readonly resizable = input(false, { transform: booleanAttribute });
  /**
   * Keys of the tiles in their order. The layout writes it after a move. Render the tiles in
   * this order; an empty array means the order of the content.
   */
  readonly order = model<readonly string[]>([]);

  /** Emits after the user changed the spans of a tile. */
  readonly tileResize = output<StarTileResize>();

  /** @internal */
  readonly tiles = contentChildren(forwardRef(() => StarTile));
  /** @internal */
  readonly hintId = inject(_IdGenerator).getId('star-tile-hint-');
  /** @internal */
  readonly interactive = computed(() => this.reorderable() || this.resizable());

  protected readonly announcement = signal('');
  protected readonly rowHeightCss = computed(() => {
    const value = this.rowHeight();
    return typeof value === 'number' ? `${value}px` : value;
  });
  protected readonly hintText = computed(() => {
    const parts = [];
    if (this.reorderable()) parts.push(this.text.tileMoveHint);
    if (this.resizable()) parts.push(this.text.tileResizeHint);
    return parts.join(' ');
  });

  constructor() {
    this.dropList.orientation = 'mixed';
    this.dropList.elementContainerSelector = '.star-tile-layout__grid';
    effect(() => (this.dropList.disabled = !this.reorderable()));
    const subscription = this.dropList.dropped.subscribe((event: CdkDragDrop<unknown>) =>
      this.onDrop(event),
    );
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    // The container queries decide the column count; the tiles need it to clamp their spans.
    afterNextRender(() => {
      const view = this.host.ownerDocument.defaultView;
      const measure = () => this.measured.set(this.readColumns());
      measure();
      if (!view || typeof view.ResizeObserver !== 'function') return;
      const observer = new view.ResizeObserver(measure);
      observer.observe(this.host);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private readonly destroyRef = inject(DestroyRef);
  /** Column count read in the browser; `null` before the first measure (and on the server). */
  private readonly measured = signal<number | null>(null);
  /** @internal Columns in force: the measured breakpoint count, else `columns`. */
  readonly columnsNow = computed(() => this.measured() ?? this.columns());

  /** Number of columns in force now: the breakpoint column count in the browser. */
  currentColumns(): number {
    return this.readColumns() ?? this.columnsNow();
  }

  /** Reads the column count that the container queries resolved, or `null` when unknown. */
  private readColumns(): number | null {
    const grid = this.host.querySelector<HTMLElement>('.star-tile-layout__grid');
    const view = this.host.ownerDocument.defaultView;
    if (!grid || !view) return null;
    const value = parseInt(
      view.getComputedStyle(grid).getPropertyValue('--star-tile-columns-now'),
      10,
    );
    // jsdom does not resolve the custom property.
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  /** Moves the tile `key` by `delta` places in the order, as the keyboard does. */
  move(key: string, delta: number): void {
    const keys = this.tiles().map((tile) => tile.key());
    const from = keys.indexOf(key);
    if (from < 0) return;
    const to = clamp(from + delta, 0, keys.length - 1);
    if (to === from) return;
    moveItemInArray(keys, from, to);
    this.commitOrder(keys, key, to);
  }

  /**
   * Changes the spans of a tile by the given steps, as the keyboard does. A column step starts
   * from the span in force (never wider than the columns now); a row-only step keeps the stored
   * column span, so a tile that is narrow in a narrow layout is wide again in a wide one.
   */
  resize(tile: StarTile, columns: number, rows: number): void {
    this.setSpans(tile, columns === 0 ? null : tile.spanNow() + columns, tile.rowSpan() + rows);
  }

  /**
   * @internal Sets the spans within the limits; emits `tileResize` when they change. A `null`
   * column span, or one that clamps to the span in force, keeps the stored column span.
   */
  setSpans(tile: StarTile, colSpan: number | null, rowSpan: number): boolean {
    let nextCol = tile.colSpan();
    if (colSpan !== null) {
      const clamped = clamp(Math.round(colSpan), 1, this.currentColumns());
      if (clamped !== tile.spanNow()) nextCol = clamped;
    }
    const nextRow = clamp(Math.round(rowSpan), 1, MAX_ROW_SPAN);
    if (nextCol === tile.colSpan() && nextRow === tile.rowSpan()) return false;
    tile.colSpan.set(nextCol);
    tile.rowSpan.set(nextRow);
    const shown = Math.min(nextCol, this.currentColumns());
    this.announcement.set(this.text.tileSize(tile.name(), shown, nextRow));
    this.tileResize.emit({ key: tile.key(), colSpan: nextCol, rowSpan: nextRow });
    return true;
  }

  private onDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    const keys = this.tiles().map((tile) => tile.key());
    const key = keys[event.previousIndex];
    if (key === undefined) return;
    moveItemInArray(keys, event.previousIndex, event.currentIndex);
    this.commitOrder(keys, key, event.currentIndex);
  }

  private commitOrder(keys: string[], key: string, index: number): void {
    const tile = this.tiles().find((item) => item.key() === key);
    this.order.set(keys);
    if (tile) {
      this.announcement.set(this.text.itemPosition(tile.name(), index + 1, keys.length));
      // The tile may be moved in the DOM: give the focus back once the view is updated.
      const element = tile.element;
      const hadFocus = element.ownerDocument.activeElement === element;
      if (hadFocus) {
        afterNextRender(
          () => {
            if (element.ownerDocument.activeElement !== element) element.focus();
          },
          { injector: this.injector },
        );
      }
    }
  }
}

/**
 * One tile of `star-tile-layout` (Material `mat-grid-tile`, Kendo UI `TileLayoutItem`). It is a
 * `role="group"` named by `label`, else by its header, else by its `key`.
 *
 * Areas: `[starTileHeader]` (title row) and the default content (body). In a reorderable or
 * resizable layout the tile is focusable; the keys work while the tile itself has the focus,
 * not a control inside it.
 */
@Component({
  selector: 'star-tile',
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }, CdkDrag],
  host: {
    class: 'star-tile',
    role: 'group',
    '[attr.aria-label]': 'label() || (hasHeader() ? null : key())',
    '[attr.aria-labelledby]': 'label() || !hasHeader() ? null : headerId',
    '[attr.aria-describedby]': 'layout.interactive() ? layout.hintId : null',
    '[attr.tabindex]': 'layout.interactive() ? 0 : null',
    '[style.--star-tile-col-span]': 'colSpan()',
    '[style.--star-tile-col-span-now]': 'spanNow()',
    '[style.--star-tile-row-span]': 'rowSpan()',
    '[class.star-tile--resizing]': 'resizing()',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <div starPart="header" class="star-tile__header" [id]="headerId">
      <ng-content select="[starTileHeader]" />
    </div>
    <div starPart="body" class="star-tile__body"><ng-content /></div>
    @if (layout.resizable()) {
      <span
        starPart="resize"
        class="star-tile__resize"
        aria-hidden="true"
        (pointerdown)="onResizeStart($event)"
        (mousedown)="$event.stopPropagation()"
        (touchstart)="$event.stopPropagation()"
      ></span>
    }
  `,
})
export class StarTile {
  protected readonly layout = inject(StarTileLayout);
  /** @internal */
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly drag = inject(CdkDrag);

  /** Unique key of the tile in its layout; the `order` model lists these keys. */
  readonly key = input.required<string>();
  /** Name of the group, read by screen readers and in the move announcements. */
  readonly label = input('');
  /** Number of columns the tile spans. The layout writes it after a resize. */
  readonly colSpan = model(1);
  /** Number of rows the tile spans. The layout writes it after a resize. */
  readonly rowSpan = model(1);

  /** @internal */
  readonly headerId = inject(_IdGenerator).getId('star-tile-header-');
  protected readonly resizing = signal(false);
  /** @internal The column span, never wider than the columns in force. */
  readonly spanNow = computed(() => Math.min(this.colSpan(), this.layout.columnsNow()));

  /** @internal `true` while the header area has content; without it the key names the tile. */
  readonly hasHeader = signal(false);

  constructor() {
    effect(() => (this.drag.disabled = !this.layout.reorderable()));
    // The header is projected content: check after each render whether it has any.
    afterEveryRender(() => {
      const header = this.element.querySelector('.star-tile__header');
      const has = !!header && (header.children.length > 0 || !!header.textContent?.trim());
      if (has !== this.hasHeader()) this.hasHeader.set(has);
    });
  }

  /** @internal Name for the announcements: the label, the header text or the key. */
  name(): string {
    const header = this.element.querySelector('.star-tile__header')?.textContent?.trim();
    return this.label() || header || this.key();
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Keys of a control inside the tile are not tile moves.
    if (event.target !== this.element || !(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = starInlineKey(event, this.element);
    const step =
      key === 'ArrowRight'
        ? [1, 0]
        : key === 'ArrowLeft'
          ? [-1, 0]
          : key === 'ArrowDown'
            ? [0, 1]
            : key === 'ArrowUp'
              ? [0, -1]
              : null;
    if (!step) return;
    if (event.shiftKey) {
      if (!this.layout.resizable()) return;
      event.preventDefault();
      this.layout.resize(this, step[0], step[1]);
    } else {
      if (!this.layout.reorderable()) return;
      event.preventDefault();
      // Up and Down move by one row of the grid.
      this.layout.move(this.key(), step[0] + step[1] * this.layout.currentColumns());
    }
  }

  protected onResizeStart(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const element = this.element;
    const grid = element.parentElement;
    const view = element.ownerDocument.defaultView;
    if (!grid || !view) return;
    const style = view.getComputedStyle(grid);
    const columns = this.layout.currentColumns();
    const columnGap = parseFloat(style.columnGap) || 0;
    const rowGap = parseFloat(style.rowGap) || 0;
    const cellWidth = (grid.clientWidth - columnGap * (columns - 1)) / columns;
    const cellHeight = parseFloat(style.gridAutoRows) || element.offsetHeight / this.rowSpan();
    const start = { x: event.clientX, y: event.clientY };
    const rect = element.getBoundingClientRect();
    const rtl = starIsRtl(element);
    const startCol = this.colSpan();
    const startSpan = this.spanNow();
    const startRow = this.rowSpan();
    this.resizing.set(true);
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture?.(event.pointerId);
    const onMove = (move: PointerEvent) => {
      const dx = (move.clientX - start.x) * (rtl ? -1 : 1);
      const dy = move.clientY - start.y;
      const span = clamp(
        Math.round((rect.width + dx + columnGap) / (cellWidth + columnGap)),
        1,
        columns,
      );
      // The width did not change: keep the stored span (it may be wider than the columns now).
      this.colSpan.set(span === startSpan ? startCol : span);
      this.rowSpan.set(
        clamp(Math.round((rect.height + dy + rowGap) / (cellHeight + rowGap)), 1, MAX_ROW_SPAN),
      );
    };
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      this.resizing.set(false);
      const colSpan = this.colSpan();
      const rowSpan = this.rowSpan();
      if (colSpan !== startCol || rowSpan !== startRow) {
        // Report the final spans once, from the start values.
        this.colSpan.set(startCol);
        this.rowSpan.set(startRow);
        this.layout.setSpans(this, colSpan === startCol ? null : colSpan, rowSpan);
      }
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  }
}
