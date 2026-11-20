import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import {
  STAR_UI_TEXT,
  starInlineKey,
  StarPart,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import {
  StarKanbanAccessor,
  StarKanbanColumn,
  StarKanbanMove,
  starKanbanRead,
  StarKanbanSwimlane,
} from './kanban-model';

/** Context of a card template (`ng-template[starKanbanCard]`). */
export interface StarKanbanCardContext<T> {
  readonly $implicit: T;
  readonly item: T;
  readonly column: StarKanbanColumn;
  readonly swimlane: StarKanbanSwimlane | null;
}

/** Context of a column header template (`ng-template[starKanbanHeader]`). */
export interface StarKanbanHeaderContext {
  readonly $implicit: StarKanbanColumn;
  readonly column: StarKanbanColumn;
  /** Items in the column (all swimlanes). */
  readonly count: number;
  /** More items than the limit. */
  readonly over: boolean;
  readonly collapsed: boolean;
}

/** Template of a card. Context: the item (`let-task`), `column` and `swimlane`. */
@Directive({ selector: 'ng-template[starKanbanCard]' })
export class StarKanbanCard<T = unknown> {
  readonly template = inject<TemplateRef<StarKanbanCardContext<T>>>(TemplateRef);
  /** Optional: pass the items to type `let-item` in strict templates. */
  readonly starKanbanCardOf = input<readonly T[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarKanbanCard<T>,
    _ctx: unknown,
  ): _ctx is StarKanbanCardContext<T> {
    return true;
  }
}

/** Template of a column header. Context: the column, `count`, `over` and `collapsed`. */
@Directive({ selector: 'ng-template[starKanbanHeader]' })
export class StarKanbanHeader {
  readonly template = inject<TemplateRef<StarKanbanHeaderContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: StarKanbanHeader,
    _ctx: unknown,
  ): _ctx is StarKanbanHeaderContext {
    return true;
  }
}

/** One list of cards: a column in a swimlane. */
interface Cell<T> {
  readonly id: string;
  readonly column: StarKanbanColumn;
  readonly lane: StarKanbanSwimlane | null;
  readonly items: readonly T[];
}

/** A card that the keyboard holds. `column`, `lane` and `index` are its place on the board now. */
interface Grab {
  readonly key: unknown;
  readonly fromColumn: string;
  readonly fromLane: string | null;
  readonly fromIndex: number;
  readonly column: string;
  readonly lane: string | null;
  readonly index: number;
}

/**
 * Kanban board (Syncfusion `ejs-kanban`, Kendo UI `kendo-taskboard`; Ignite UI has none): columns
 * of cards, optional swimlanes, work-in-progress limits and collapsible columns.
 *
 * - Cards move with the pointer (CDK drag and drop) between and within columns, and with the
 *   keyboard: Space picks the focused card up, the arrow keys move it, Space drops it and Escape
 *   cancels. A polite live region reads each step.
 * - The board never changes `items`. `itemMove` reports each move; apply it in the handler (see
 *   `starKanbanApplyMove`) or call `cancel()`.
 * - `limit` on a column shows a warning state above the limit; `enforceLimits` blocks a move into a
 *   full column.
 * - Each column (each cell with swimlanes) is a group named with its title and count, and holds a
 *   list of cards (`role="listitem"`). The cards are one Tab stop; the arrow keys move the focus
 *   (the inline arrows follow the reading direction).
 * - All cards of a column render: for very large boards, page or filter the items (no virtual
 *   scrolling).
 *
 * ```html
 * <star-kanban [columns]="columns" [items]="tasks()" columnKey="status" itemKey="id" order="rank"
 *              (itemMove)="onMove($event)">
 *   <ng-template starKanbanCard [starKanbanCardOf]="tasks()" let-task>{{ task.title }}</ng-template>
 * </star-kanban>
 * ```
 */
@Component({
  selector: 'star-kanban',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, CdkDropListGroup, CdkDropList, CdkDrag, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-kanban',
    '[class.star-kanban--lanes]': 'lanes().length > 0',
    '[style.--star-kanban-columns]': 'gridColumns()',
  },
  template: `
    <div data-star-part="board" class="star-kanban__board" cdkDropListGroup>
      @if (lanes().length) {
        @for (column of columns(); track column.key) {
          <div
            data-star-part="head"
            class="star-kanban__head"
            [class.star-kanban__head--collapsed]="isCollapsed(column)"
          >
            <ng-container
              [ngTemplateOutlet]="headTpl"
              [ngTemplateOutletContext]="{ $implicit: column }"
            />
          </div>
        }
      }
      @for (row of rows(); track row.lane?.key ?? '') {
        @if (row.lane) {
          <div
            data-star-part="laneLabel"
            class="star-kanban__lane-title"
            role="heading"
            aria-level="3"
          >
            {{ row.lane.title }}
          </div>
        }
        @for (cell of row.cells; track cell.id) {
          <section
            data-star-part="column"
            class="star-kanban__column"
            role="group"
            [attr.aria-label]="cellLabel(cell)"
            [class.star-kanban__column--over]="isOver(cell.column)"
            [class.star-kanban__column--full]="isFull(cell.column)"
            [class.star-kanban__column--collapsed]="isCollapsed(cell.column)"
          >
            @if (!row.lane) {
              <ng-container
                [ngTemplateOutlet]="headTpl"
                [ngTemplateOutletContext]="{ $implicit: cell.column }"
              />
            }
            @if (!isCollapsed(cell.column)) {
              <div
                data-star-part="list"
                class="star-kanban__list"
                role="list"
                cdkDropList
                [id]="cell.id"
                [cdkDropListData]="cell"
                [cdkDropListDisabled]="disabled()"
                [cdkDropListEnterPredicate]="canEnter"
                (cdkDropListDropped)="onDrop($event)"
              >
                @for (item of cell.items; track keyOf(item); let i = $index) {
                  <div
                    data-star-part="card"
                    class="star-kanban__card"
                    role="listitem"
                    cdkDrag
                    [cdkDragData]="item"
                    [attr.data-key]="keyText(item)"
                    [attr.tabindex]="isActive(item) ? 0 : -1"
                    [attr.aria-describedby]="hintId"
                    [class.star-kanban__card--grabbed]="isGrabbed(item)"
                    (focus)="activeKey.set(keyOf(item))"
                    (keydown)="onCardKeydown($event, item, cell)"
                  >
                    @if (cardTpl(); as tpl) {
                      <ng-container
                        [ngTemplateOutlet]="tpl.template"
                        [ngTemplateOutletContext]="{
                          $implicit: item,
                          item: item,
                          column: cell.column,
                          swimlane: cell.lane,
                        }"
                      />
                    } @else {
                      {{ labelOf(item) }}
                    }
                  </div>
                }
              </div>
            }
          </section>
        }
      }
    </div>
    <p class="star-sr-only" [id]="hintId">{{ text.kanbanCardHint }}</p>
    <p class="star-sr-only" aria-live="polite">{{ announcement() }}</p>

    <ng-template #headTpl let-column>
      <div starPart="header" class="star-kanban__header">
        @if (headerTpl(); as tpl) {
          <ng-container
            [ngTemplateOutlet]="tpl.template"
            [ngTemplateOutletContext]="{
              $implicit: column,
              column: column,
              count: countOf(column.key),
              over: isOver(column),
              collapsed: isCollapsed(column),
            }"
          />
        } @else {
          <span data-star-part="titleText" class="star-kanban__title">{{ column.title }}</span>
          <span data-star-part="count" class="star-kanban__count" aria-hidden="true">
            {{ column.limit ? countOf(column.key) + ' / ' + column.limit : countOf(column.key) }}
          </span>
        }
        @if (collapsible()) {
          <button
            data-star-part="collapse"
            type="button"
            class="star-kanban__collapse"
            [attr.aria-expanded]="!isCollapsed(column)"
            [attr.aria-label]="
              isCollapsed(column) ? text.expandItem(column.title) : text.collapseItem(column.title)
            "
            (click)="toggleColumn(column.key)"
          >
            <i
              data-star-part="collapseIcon"
              [class]="
                isCollapsed(column)
                  ? 'ph-bold ph-arrows-out-line-horizontal'
                  : 'ph-bold ph-arrows-in-line-horizontal'
              "
              aria-hidden="true"
            ></i>
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class StarKanban<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  readonly columns = input<readonly StarKanbanColumn[]>([]);
  /** The cards. The board never changes this array or its items. */
  readonly items = input<readonly T[]>([]);
  /** Column key of an item: a property name or a function. */
  readonly columnKey = input.required<StarKanbanAccessor<T, string>>();
  /** Unique key of an item (default: the `id` property). */
  readonly itemKey = input<StarKanbanAccessor<T, unknown>>('id');
  /** Number that sorts the cards in a cell (default: the order of `items`). */
  readonly order = input<StarKanbanAccessor<T, number> | null>(null);
  /** Name of a card in the announcements (default: its key). */
  readonly itemLabel = input<StarKanbanAccessor<T, string> | null>(null);
  /** Rows of the board; empty for a board without swimlanes. */
  readonly swimlanes = input<readonly StarKanbanSwimlane[]>([]);
  /** Swimlane key of an item. Items with an unknown key go to the first lane. */
  readonly swimlaneKey = input<StarKanbanAccessor<T, string> | null>(null);
  /** Blocks a move into a column that has `limit` items or more. */
  readonly enforceLimits = input(false, { transform: booleanAttribute });
  /** Shows a button that collapses and expands each column. */
  readonly collapsible = input(false, { transform: booleanAttribute });
  /** Keys of the collapsed columns. */
  readonly collapsed = model<readonly string[]>([]);
  /** Turns drag and drop and the keyboard moves off. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Emits each move of a card; the owner applies it to `items`. */
  readonly itemMove = output<StarKanbanMove<T>>();

  protected readonly cardTpl = contentChild(StarKanbanCard);
  protected readonly headerTpl = contentChild(StarKanbanHeader);

  /** @internal */
  readonly hintId = inject(_IdGenerator).getId('star-kanban-hint-');
  private readonly idPrefix = inject(_IdGenerator).getId('star-kanban-');
  protected readonly announcement = signal('');
  /** Key of the card in the Tab order. */
  protected readonly activeKey = signal<unknown>(undefined);
  /** The card that the keyboard holds, with its place now. */
  protected readonly grab = signal<Grab | null>(null);

  protected readonly lanes = computed(() => this.swimlanes());

  protected readonly gridColumns = computed(() =>
    this.columns()
      .map((column) =>
        this.isCollapsed(column) ? 'minmax(3rem, max-content)' : 'minmax(15rem, 1fr)',
      )
      .join(' '),
  );

  /** Cells by column and lane, in board order, without the held card. */
  private readonly baseCells = computed(() => {
    const columns = this.columns();
    const lanes = this.lanes();
    const laneKeys = new Set(lanes.map((lane) => lane.key));
    const laneOf = (item: T): string | null => {
      const accessor = this.swimlaneKey();
      if (!lanes.length) return null;
      const key = accessor ? String(starKanbanRead(item, accessor) ?? '') : '';
      return laneKeys.has(key) ? key : lanes[0].key;
    };
    const map = new Map<string, T[]>();
    for (const item of this.items()) {
      const id = this.cellKey(String(starKanbanRead(item, this.columnKey()) ?? ''), laneOf(item));
      let list = map.get(id);
      if (!list) map.set(id, (list = []));
      list.push(item);
    }
    const order = this.order();
    if (order) {
      for (const list of map.values()) {
        // A stable sort keeps the array order for equal numbers.
        list.sort((a, b) => Number(starKanbanRead(a, order)) - Number(starKanbanRead(b, order)));
      }
    }
    const result = new Map<string, readonly T[]>();
    for (const lane of lanes.length ? lanes : [null]) {
      for (const column of columns) {
        const id = this.cellKey(column.key, lane?.key ?? null);
        result.set(id, map.get(id) ?? []);
      }
    }
    return result;
  });

  /** The rows of cells as shown: the held card at its new place. */
  protected readonly rows = computed(() => {
    const base = this.baseCells();
    const grab = this.grab();
    const lanes = this.lanes();
    const held = grab ? this.findItem(grab.key) : undefined;
    return (lanes.length ? lanes : [null]).map((lane, laneIndex) => ({
      lane,
      cells: this.columns().map((column, columnIndex): Cell<T> => {
        // The DOM id comes from the positions, so any key text is safe in it.
        const id = `${this.idPrefix}-c${columnIndex}-l${laneIndex}`;
        let items = base.get(this.cellKey(column.key, lane?.key ?? null)) ?? [];
        if (grab && held !== undefined) {
          items = items.filter((item) => !Object.is(this.keyOf(item), grab.key));
          if (grab.column === column.key && grab.lane === (lane?.key ?? null)) {
            items = [...items.slice(0, grab.index), held, ...items.slice(grab.index)];
          }
        }
        return { id, column, lane, items };
      }),
    }));
  });

  /** Items per column (all lanes), from `items`. */
  private readonly counts = computed(() => {
    const counts = new Map<string, number>();
    for (const item of this.items()) {
      const key = String(starKanbanRead(item, this.columnKey()) ?? '');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  });

  /** Map key of a cell; JSON keeps keys like "a-b" and "a" + "b" apart. */
  private cellKey(column: string, lane: string | null): string {
    return JSON.stringify([column, lane]);
  }

  /** Items by key, so a lookup does not scan `items`. */
  private readonly byKey = computed(() => {
    const map = new Map<unknown, T>();
    for (const item of this.items()) map.set(this.keyOf(item), item);
    return map;
  });
  private readonly collapsedKeys = computed(() => new Set(this.collapsed()));
  /** Key of the card in the Tab order: the last focused card, else the first visible card. */
  private readonly tabStopKey = computed(() => {
    const key = this.activeKey();
    if (key !== undefined && this.byKey().has(key)) return key;
    for (const row of this.rows()) {
      for (const cell of row.cells) {
        if (cell.items.length && !this.isCollapsed(cell.column)) return this.keyOf(cell.items[0]);
      }
    }
    return undefined;
  });

  /** @internal */
  keyOf(item: T): unknown {
    return starKanbanRead(item, this.itemKey());
  }
  protected keyText(item: T): string {
    return String(this.keyOf(item));
  }
  protected labelOf(item: T): string {
    const accessor = this.itemLabel();
    return accessor ? String(starKanbanRead(item, accessor) ?? '') : this.keyText(item);
  }
  private findItem(key: unknown): T | undefined {
    return this.byKey().get(key);
  }

  protected countOf(key: string): number {
    return this.counts().get(key) ?? 0;
  }
  protected isOver(column: StarKanbanColumn): boolean {
    return column.limit !== undefined && this.countOf(column.key) > column.limit;
  }
  protected isFull(column: StarKanbanColumn): boolean {
    return column.limit !== undefined && this.countOf(column.key) >= column.limit;
  }
  protected isCollapsed(column: StarKanbanColumn): boolean {
    return this.collapsible() && this.collapsedKeys().has(column.key);
  }
  protected cellLabel(cell: Cell<T>): string {
    const title = cell.lane ? `${cell.column.title}, ${cell.lane.title}` : cell.column.title;
    const count = cell.lane ? cell.items.length : this.countOf(cell.column.key);
    return cell.column.limit === undefined
      ? this.text.kanbanColumnLabel(title, count)
      : this.text.kanbanColumnLimit(title, count, cell.column.limit);
  }

  /** The first card is the Tab stop until another card had the focus. */
  protected isActive(item: T): boolean {
    const key = this.tabStopKey();
    return key !== undefined && Object.is(this.keyOf(item), key);
  }
  protected isGrabbed(item: T): boolean {
    const grab = this.grab();
    return !!grab && Object.is(grab.key, this.keyOf(item));
  }

  /** Collapses or expands a column. */
  toggleColumn(key: string): void {
    this.collapsed.update((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
    );
  }

  /** A full column refuses cards from other columns while `enforceLimits` is on. */
  protected readonly canEnter = (drag: CdkDrag<T>, drop: CdkDropList<Cell<T>>): boolean => {
    const column = drop.data.column;
    const from = String(starKanbanRead(drag.data, this.columnKey()) ?? '');
    return !this.blocked(column, from);
  };

  private blocked(column: StarKanbanColumn, fromColumn: string): boolean {
    return (
      this.enforceLimits() &&
      column.key !== fromColumn &&
      column.limit !== undefined &&
      this.countOf(column.key) >= column.limit
    );
  }

  // ---- Pointer ----

  protected onDrop(event: CdkDragDrop<Cell<T>, Cell<T>, T>): void {
    const from = event.previousContainer.data;
    const to = event.container.data;
    if (from === to && event.previousIndex === event.currentIndex) return;
    this.emitMove(event.item.data, from, event.previousIndex, to, event.currentIndex, 'pointer');
  }

  private emitMove(
    item: T,
    from: { column: StarKanbanColumn; lane: StarKanbanSwimlane | null } | Cell<T>,
    fromIndex: number,
    to: { column: StarKanbanColumn; lane: StarKanbanSwimlane | null },
    toIndex: number,
    source: 'pointer' | 'keyboard',
  ): boolean {
    // Size of the target cell after the move, read before the owner changes `items`.
    const sameCell = from.column.key === to.column.key && from.lane?.key === to.lane?.key;
    const before = this.baseCells().get(this.cellKey(to.column.key, to.lane?.key ?? null))?.length;
    const total = (before ?? 0) + (sameCell ? 0 : 1);
    let canceled = false;
    const move: StarKanbanMove<T> = {
      item,
      fromColumn: from.column.key,
      toColumn: to.column.key,
      fromIndex,
      toIndex,
      swimlane: to.lane?.key ?? null,
      fromSwimlane: from.lane?.key ?? null,
      source,
      cancel: () => (canceled = true),
      get canceled() {
        return canceled;
      },
    };
    this.itemMove.emit(move);
    const label = this.labelOf(item);
    if (canceled) {
      this.announcement.set(this.text.kanbanCanceled(label, from.column.title));
      return false;
    }
    this.announcement.set(this.text.kanbanDropped(label, to.column.title, toIndex + 1, total));
    return true;
  }

  // ---- Keyboard ----

  protected onCardKeydown(event: KeyboardEvent, item: T, cell: Cell<T>): void {
    if (event.target !== event.currentTarget) return;
    const grab = this.grab();
    const key = starInlineKey(event, this.host);
    if (grab) {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        this.drop();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.cancelGrab();
      } else if (key === 'ArrowUp' || key === 'ArrowDown') {
        event.preventDefault();
        this.moveHeld(0, key === 'ArrowUp' ? -1 : 1);
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        event.preventDefault();
        this.moveHeld(key === 'ArrowLeft' ? -1 : 1, 0);
      } else if (event.key === 'Tab') {
        // The focus moves on with Tab: cancel the move without pulling the focus back.
        this.cancelGrab(false);
      }
      return;
    }
    if (event.key === ' ' && !this.disabled()) {
      event.preventDefault();
      this.pickUp(item, cell);
      return;
    }
    const step: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const delta = step[key];
    if (!delta) return;
    event.preventDefault();
    this.moveFocus(item, cell, delta[0], delta[1]);
  }

  /** The visible cells of a lane row, in column order. */
  private cellsOf(lane: string | null): Cell<T>[] {
    const row = this.rows().find((r) => (r.lane?.key ?? null) === lane);
    return row ? [...row.cells] : [];
  }

  private moveFocus(item: T, cell: Cell<T>, dx: number, dy: number): void {
    const index = cell.items.indexOf(item);
    let target: T | undefined;
    if (dy) {
      target = cell.items[index + dy];
      if (target === undefined && this.lanes().length) {
        // Up from the first card or down from the last one: the same column in the next lane.
        const lanes = this.lanes();
        const at = lanes.findIndex((lane) => lane.key === cell.lane?.key);
        for (let l = at + dy; l >= 0 && l < lanes.length && target === undefined; l += dy) {
          const next = this.cellsOf(lanes[l].key).find((c) => c.column.key === cell.column.key);
          if (next?.items.length)
            target = dy > 0 ? next.items[0] : next.items[next.items.length - 1];
        }
      }
    } else {
      const cells = this.cellsOf(cell.lane?.key ?? null);
      const at = cells.findIndex((c) => c.id === cell.id);
      for (let c = at + dx; c >= 0 && c < cells.length; c += dx) {
        const next = cells[c];
        if (!next.items.length || this.isCollapsed(next.column)) continue;
        target = next.items[Math.min(index, next.items.length - 1)];
        break;
      }
    }
    if (target !== undefined) this.focusCard(this.keyOf(target));
  }

  private pickUp(item: T, cell: Cell<T>): void {
    const index = cell.items.indexOf(item);
    const lane = cell.lane?.key ?? null;
    this.grab.set({
      key: this.keyOf(item),
      fromColumn: cell.column.key,
      fromLane: lane,
      fromIndex: index,
      column: cell.column.key,
      lane,
      index,
    });
    this.announcement.set(this.text.kanbanPickedUp(this.labelOf(item), cell.column.title));
  }

  private moveHeld(dx: number, dy: number): void {
    const grab = this.grab();
    if (!grab) return;
    const cells = this.cellsOf(grab.lane);
    const at = cells.findIndex((c) => c.column.key === grab.column);
    const current = cells[at];
    if (!current) return;
    let next: Grab = grab;
    if (dy) {
      const index = grab.index + dy;
      if (index >= 0 && index < current.items.length) {
        next = { ...grab, index };
      } else if (this.lanes().length) {
        const lanes = this.lanes();
        const l = lanes.findIndex((lane) => lane.key === grab.lane) + dy;
        if (l < 0 || l >= lanes.length) return;
        const others = this.cellsOf(lanes[l].key).find((c) => c.column.key === grab.column);
        const size = others ? others.items.length : 0;
        next = { ...grab, lane: lanes[l].key, index: dy > 0 ? 0 : size };
      } else {
        return;
      }
    } else {
      let c = at + dx;
      while (c >= 0 && c < cells.length && this.isCollapsed(cells[c].column)) c += dx;
      const target = cells[c];
      if (!target) return;
      if (this.blocked(target.column, grab.fromColumn)) {
        this.announcement.set(this.text.kanbanLimitReached(target.column.title));
        return;
      }
      next = {
        ...grab,
        column: target.column.key,
        index: Math.min(grab.index, target.items.length),
      };
    }
    if (next === grab) return;
    this.grab.set(next);
    const target = this.cellsOf(next.lane).find((c) => c.column.key === next.column);
    if (target) {
      this.announcement.set(
        this.text.kanbanMoved(target.column.title, next.index + 1, target.items.length),
      );
    }
    this.focusCard(grab.key);
  }

  private drop(): void {
    const grab = this.grab();
    if (!grab) return;
    this.grab.set(null);
    const item = this.findItem(grab.key);
    const columns = this.columns();
    const column = columns.find((c) => c.key === grab.column);
    const fromColumn = columns.find((c) => c.key === grab.fromColumn);
    if (item === undefined || !column || !fromColumn) return;
    const lane = this.lanes().find((l) => l.key === grab.lane) ?? null;
    const fromLane = this.lanes().find((l) => l.key === grab.fromLane) ?? null;
    if (
      grab.column === grab.fromColumn &&
      grab.lane === grab.fromLane &&
      grab.index === grab.fromIndex
    ) {
      const total = this.baseCells().get(this.cellKey(column.key, grab.lane))?.length ?? 1;
      this.announcement.set(
        this.text.kanbanDropped(this.labelOf(item), column.title, grab.index + 1, total),
      );
    } else {
      this.emitMove(
        item,
        { column: fromColumn, lane: fromLane },
        grab.fromIndex,
        { column, lane },
        grab.index,
        'keyboard',
      );
    }
    this.focusCard(grab.key);
  }

  /** Puts a held card back. `restoreFocus` focuses the card again after the render. */
  private cancelGrab(restoreFocus = true): void {
    const grab = this.grab();
    if (!grab) return;
    this.grab.set(null);
    const item = this.findItem(grab.key);
    const column = this.columns().find((c) => c.key === grab.fromColumn);
    if (item !== undefined && column) {
      this.announcement.set(this.text.kanbanCanceled(this.labelOf(item), column.title));
    }
    if (restoreFocus) this.focusCard(grab.key);
    else this.activeKey.set(grab.key);
  }

  private focusCard(key: unknown): void {
    this.activeKey.set(key);
    afterNextRender(
      () => {
        const cards = this.host.querySelectorAll<HTMLElement>('.star-kanban__card');
        const card = [...cards].find((element) => element.dataset['key'] === String(key));
        if (card && card.ownerDocument.activeElement !== card) card.focus();
      },
      { injector: this.injector },
    );
  }
}
