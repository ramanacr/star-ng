import { isPlatformBrowser } from '@angular/common';
import {
  afterRenderEffect,
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
  input,
  model,
  output,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { readOption, STAR_UI_TEXT, StarOptionKey } from '@star-ng/ui/core';
import { StarSpinner } from '@star-ng/ui/spinner';
import { StarColumn, StarRowExpansionTemplate, StarTable } from '@star-ng/ui/table';
import { firstValueFrom, isObservable } from 'rxjs';
import { StarRowIsland } from './row-island';

/** `rowExpand` and `rowCollapse`: the row, its level (1 is the root) and its island (`null`: root). */
export interface StarHierarchicalRowEvent<T = unknown> {
  readonly row: T;
  readonly level: number;
  readonly island: StarRowIsland | null;
  /** Keeps the row as it was (expanded or collapsed). */
  cancel(): void;
  readonly canceled: boolean;
}

/** `childGridCreated`: a child grid was created for a parent row and an island. */
export interface StarChildGridCreatedEvent<P = unknown, C = unknown> {
  readonly parentRow: P;
  readonly island: StarRowIsland<C>;
  readonly grid: StarTable<C>;
}

function rowEvent<T>(row: T, level: number, island: StarRowIsland | null) {
  let canceled = false;
  const event: StarHierarchicalRowEvent<T> = {
    row,
    level,
    island,
    cancel: () => (canceled = true),
    get canceled() {
      return canceled;
    },
  };
  return event;
}

/** The key of a row as `star-table` tracks it: the `dataKey` value, else the row object. */
function keyOf<T>(row: T, dataKey: StarOptionKey<T> | null): unknown {
  const key = readOption(row, dataKey);
  return key === null || key === undefined ? row : key;
}

/** The parts of a `star-row-island` that the levels read, for any row type. */
interface IslandView {
  key(): string | null;
  childData(): ((parent: never) => unknown) | null;
  columns(): readonly unknown[];
  dataKey(): unknown;
  label(): string;
  rowLabel(): ((row: never) => string) | null;
  paginator(): boolean;
  rows(): number;
  selectionMode(): 'single' | 'multiple' | 'cell' | 'range' | null;
  editMode(): 'cell' | 'row';
  filterDisplay(): 'row' | 'menu';
  islands(): readonly IslandView[];
}

/** A focusable cell or control of a table body, for a move into a child grid. */
const BODY_FOCUS =
  ':scope > table > tbody > tr > [tabindex="0"], :scope > table > tbody > tr[tabindex="0"]';

/**
 * One level of `star-hierarchical-grid`: a `star-table` whose expanded rows show the child grids
 * of the islands. Internal part of `star-hierarchical-grid`.
 */
@Component({
  selector: 'star-hierarchical-level',
  imports: [StarTable, StarRowExpansionTemplate, forwardRef(() => StarHierarchicalChild)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-hierarchical-level',
  },
  template: `
    <star-table
      [value]="rows()"
      [columns]="tableColumns()"
      [dataKey]="tableKey()"
      [ariaLabel]="ariaLabel()"
      [cellNavigation]="true"
      [expandedKeys]="expanded()"
      (expandedKeysChange)="onExpandedKeys($event)"
      [virtualScroll]="virtualScroll()"
      [virtualRowHeights]="virtualScroll() ? 'variable' : 'auto'"
      [scrollHeight]="scrollHeight()"
      [paginator]="island()?.paginator() ?? false"
      [rows]="island()?.rows() ?? 10"
      [selectionMode]="island()?.selectionMode() ?? null"
      [editMode]="island()?.editMode() ?? 'cell'"
      [filterDisplay]="island()?.filterDisplay() ?? 'row'"
    >
      @if (childIslands().length) {
        <ng-template starRowExpansion let-row>
          <div class="star-hierarchical__children" [attr.data-level]="level() + 1">
            @for (child of childIslands(); track child) {
              <star-hierarchical-child
                [parentRow]="row"
                [parentLabel]="labelOf(row)"
                [island]="child"
                [level]="level() + 1"
              />
            }
          </div>
        </ng-template>
      }
    </star-table>
  `,
})
export class StarHierarchicalLevel {
  private readonly grid = inject(StarHierarchicalGrid);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly rows = input.required<readonly unknown[]>();
  readonly columns = input.required<readonly unknown[]>();
  readonly dataKey = input<unknown>(null);
  readonly ariaLabel = input<string | null>(null);
  /** 1 for the root grid. */
  readonly level = input(1);
  /** The island of this level (`null` for the root). */
  readonly island = input<IslandView | null>(null);
  /** The parent row of a child grid. */
  readonly parentRow = input<unknown>(null);
  readonly childIslands = input<readonly IslandView[]>([]);
  readonly rowLabel = input<((row: never) => string) | null>(null);
  readonly virtualScroll = input(false);
  readonly scrollHeight = input<string | null>(null);
  /** Expanded row keys. Two-way. */
  readonly expanded = model<readonly unknown[]>([]);

  readonly table = viewChild.required(StarTable<unknown>);
  protected readonly tableColumns = computed(
    () => this.columns() as readonly StarColumn<unknown>[],
  );
  protected readonly tableKey = computed(() => this.dataKey() as StarOptionKey<unknown> | null);

  constructor() {
    // Capture phase: the level keys run before the table moves the focus.
    const capture = (event: Event) => this.onKeydownCapture(event);
    this.host.addEventListener('keydown', capture, true);
    inject(DestroyRef).onDestroy(() => this.host.removeEventListener('keydown', capture, true));
    // The child grid is ready: tell the owner (once per created table).
    effect(() => {
      const table = this.table();
      const island = this.island();
      untracked(() => {
        if (island) this.grid.childCreated(this, island, table);
      });
    });
    // Row levels and states for assistive technology: every body row of this table carries
    // `aria-level`, a parent row `aria-expanded`.
    afterRenderEffect({
      write: () => {
        this.expanded();
        this.rows();
        untracked(() => this.markRows());
      },
    });
  }

  protected labelOf(row: unknown): string {
    const label = this.rowLabel();
    if (label) return label(row as never);
    const key = keyOf(row, this.tableKey());
    return typeof key === 'object' ? '' : String(key);
  }

  /** The body rows of this table (not of the nested child grids). */
  private bodyRows(): HTMLTableRowElement[] {
    const body = this.host.querySelector('star-table')?.querySelector('tbody');
    return body ? Array.from(body.querySelectorAll<HTMLTableRowElement>(':scope > tr')) : [];
  }

  private markRows(): void {
    const level = String(this.level());
    for (const tr of this.bodyRows()) {
      if (!tr.classList.contains('star-table__row')) continue;
      if (tr.getAttribute('aria-level') !== level) tr.setAttribute('aria-level', level);
      const toggle = tr.querySelector(':scope > td.star-table__expander button');
      const expanded = toggle?.getAttribute('aria-expanded') ?? null;
      if (expanded === null) tr.removeAttribute('aria-expanded');
      else if (tr.getAttribute('aria-expanded') !== expanded) {
        tr.setAttribute('aria-expanded', expanded);
      }
    }
  }

  protected onExpandedKeys(keys: readonly unknown[]): void {
    const before = this.expanded();
    const added = keys.filter((key) => !before.some((old) => Object.is(old, key)));
    const removed = before.filter((key) => !keys.some((now) => Object.is(now, key)));
    const dataKey = this.tableKey();
    const rowOf = (key: unknown) => this.rows().find((row) => Object.is(keyOf(row, dataKey), key));
    let next = [...keys];
    for (const key of added) {
      const row = rowOf(key);
      if (row !== undefined && !this.grid.emitToggle(true, row, this.level(), this.island())) {
        next = next.filter((item) => !Object.is(item, key));
      }
    }
    for (const key of removed) {
      const row = rowOf(key);
      if (row !== undefined && !this.grid.emitToggle(false, row, this.level(), this.island())) {
        next.push(key);
      }
    }
    // A new array: the table gets the kept state back also when it equals the old one.
    this.expanded.set(next);
  }

  /** All rows of this level expanded (`true`) or collapsed. No events. */
  setAll(open: boolean): void {
    const dataKey = this.tableKey();
    this.expanded.set(open ? this.rows().map((row) => keyOf(row, dataKey)) : []);
  }

  /** The table row of an event target, when it is a body row of this table. */
  private rowOfTarget(target: EventTarget | null): HTMLTableRowElement | null {
    const tr = (target as Element | null)?.closest?.('tr');
    if (!tr || !this.bodyRows().includes(tr as HTMLTableRowElement)) return null;
    return tr.classList.contains('star-table__row') ? (tr as HTMLTableRowElement) : null;
  }

  /**
   * Alt+Arrow Down / Right expands the row, Alt+Arrow Up / Left collapses it. Arrow Down on an
   * expanded row goes into its first child grid. Capture phase: before the table moves the focus.
   */
  private onKeydownCapture(keyEvent: Event): void {
    const event = keyEvent as KeyboardEvent;
    if (this.backToParent(event)) return;
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const tr = this.rowOfTarget(event.target);
    if (!tr || (event.target as Element).closest('input, select, textarea')) return;
    const toggle = tr.querySelector<HTMLButtonElement>(':scope > td.star-table__expander button');
    if (!toggle) return;
    const open = toggle.getAttribute('aria-expanded') === 'true';
    if (event.altKey) {
      const expand = event.key === 'ArrowDown' || event.key === 'ArrowRight';
      const collapse = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
      if (!expand && !collapse) return;
      event.preventDefault();
      event.stopPropagation();
      if (expand !== open) toggle.click();
      this.grid.keepFocus(tr);
      return;
    }
    if (event.key === 'ArrowDown' && open) {
      const detail = tr.nextElementSibling;
      const child = detail?.querySelector<HTMLElement>('star-table');
      const target =
        child?.querySelector<HTMLElement>(BODY_FOCUS) ??
        child?.querySelector<HTMLElement>('tbody [tabindex]');
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      target.focus();
    }
  }

  /**
   * Ctrl+Arrow Up on a cell of a child grid, or Escape on a cell (not in an editor or a cell
   * control), goes back to its parent row. True when it moved the focus.
   */
  private backToParent(event: KeyboardEvent): boolean {
    if (event.defaultPrevented || this.level() === 1) return false;
    const up = event.key === 'ArrowUp' && (event.ctrlKey || event.metaKey) && !event.altKey;
    const escape = event.key === 'Escape' && !event.ctrlKey && !event.metaKey;
    if (!up && !escape) return false;
    const target = event.target as Element;
    if (!this.rowOfTarget(target)) return false;
    if (escape && !target.matches('td, th, tr')) return false;
    const detail = this.host.closest('tr.star-table__expansion');
    const parent = detail?.previousElementSibling as HTMLElement | null;
    if (!parent) return false;
    const cell =
      parent.querySelector<HTMLElement>(':scope > [tabindex="0"]') ??
      parent.querySelector<HTMLElement>(':scope > [tabindex]') ??
      parent.querySelector<HTMLElement>('button');
    if (!cell) return false;
    event.preventDefault();
    event.stopPropagation();
    cell.focus();
    return true;
  }
}

/** The state of the child rows of one parent row and island. */
type ChildState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly rows: readonly unknown[] };

/**
 * The child grid of one parent row and one island: the rows from the island `key` field, or
 * loaded with `childData` (through `resource()`), with a loading row and an error row with retry.
 * Internal part of `star-hierarchical-grid`.
 */
@Component({
  selector: 'star-hierarchical-child',
  imports: [StarSpinner, StarHierarchicalLevel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-hierarchical__child' },
  template: `
    @switch (state().kind) {
      @case ('loading') {
        <div class="star-hierarchical__status" role="status">
          <star-spinner size="1rem" />
          <span>{{ text.loading }}</span>
        </div>
      }
      @case ('error') {
        <div class="star-hierarchical__status star-hierarchical__status--error" role="alert">
          <i class="ph-bold ph-warning-circle" aria-hidden="true"></i>
          <span>{{ text.hierarchicalLoadError }}</span>
          <button type="button" class="star-btn star-btn--secondary star-btn--sm" (click)="retry()">
            {{ text.retry }}
          </button>
        </div>
      }
      @default {
        <star-hierarchical-level
          [rows]="rows()"
          [columns]="island().columns()"
          [dataKey]="island().dataKey()"
          [ariaLabel]="name()"
          [level]="level()"
          [island]="island()"
          [parentRow]="parentRow()"
          [childIslands]="island().islands()"
          [rowLabel]="island().rowLabel()"
          [(expanded)]="expanded"
        />
      }
    }
  `,
})
export class StarHierarchicalChild {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly parentRow = input.required<unknown>();
  readonly parentLabel = input('');
  readonly island = input.required<IslandView>();
  readonly level = input(2);
  protected readonly expanded = signal<readonly unknown[]>([]);

  protected readonly name = computed(() => {
    const label = this.island().label();
    const parent = this.parentLabel();
    return label && parent ? this.text.hierarchicalChildGrid(label, parent) : label || null;
  });

  private readonly loaded = resource({
    params: () => ({ row: this.parentRow(), loader: this.island().childData() }),
    loader: async ({ params }) => {
      if (!params.loader) return null;
      const result = (params.loader as (row: unknown) => unknown)(params.row);
      return (
        isObservable(result) ? await firstValueFrom(result) : await result
      ) as readonly unknown[];
    },
  });

  protected readonly state = computed<ChildState>(() => {
    const island = this.island();
    if (!island.childData()) {
      const key = island.key();
      const value = key ? readOption(this.parentRow(), key as never) : null;
      return { kind: 'ready', rows: Array.isArray(value) ? (value as readonly unknown[]) : [] };
    }
    const status = this.loaded.status();
    if (status === 'error') return { kind: 'error' };
    if (status === 'resolved' || status === 'local') {
      return { kind: 'ready', rows: this.loaded.value() ?? [] };
    }
    return { kind: 'loading' };
  });
  protected readonly rows = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.rows : [];
  });

  /** Loads the child rows again (the retry button of the error row). */
  retry(): void {
    this.loaded.reload();
  }
}

/**
 * Hierarchical grid (Ignite UI `igx-hierarchical-grid`, Kendo UI Grid hierarchy, Syncfusion
 * hierarchy grid, DevExtreme master-detail, AG Grid master/detail, PrimeNG row expansion): a root
 * `star-table` of `data` whose rows expand into child grids, one per `star-row-island`, and so on
 * down the island layout. Every child grid is a `star-table` with cell navigation, configured from
 * its island; `childGridCreated` gives each one to the owner (outputs, `focusCell`, exports).
 * Child rows come from a field (`key`) or a loader (`childData`, with a loading row and an error
 * row with retry). The root can render its rows in a window (`virtualScroll`, measured child
 * heights in the browser; the server renders the collapsed root).
 *
 * Keyboard (as Ignite UI): Alt+Arrow Down / Right expands the focused row, Alt+Arrow Up / Left
 * collapses it, Arrow Down on an expanded row (or Tab) goes into the first child grid, and
 * Ctrl+Arrow Up or Escape in a child grid goes back to its parent row. Rows carry `aria-level`
 * and, for a parent, `aria-expanded`; each grid has its own `aria-rowindex`.
 */
@Component({
  selector: 'star-hierarchical-grid',
  imports: [StarHierarchicalLevel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-hierarchical' },
  template: `
    <star-hierarchical-level
      [rows]="data()"
      [columns]="columns()"
      [dataKey]="dataKey()"
      [ariaLabel]="ariaLabel() ?? text.hierarchicalGrid"
      [level]="1"
      [childIslands]="islands()"
      [rowLabel]="rowLabel()"
      [virtualScroll]="virtualScroll()"
      [scrollHeight]="scrollHeight()"
      [(expanded)]="expandedRows"
    />
  `,
})
export class StarHierarchicalGrid<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The root rows. */
  readonly data = input.required<readonly T[]>();
  /** The columns of the root grid. */
  readonly columns = input.required<readonly StarColumn<T>[]>();
  /** Row key of the root rows (default: the row object); `expandedRows` holds these keys. */
  readonly dataKey = input<StarOptionKey<T> | null>(null);
  /** Text of a root row in the names of its child grids (default: the row key). */
  readonly rowLabel = input<((row: T) => string) | null>(null);
  /** Name of the root grid (default: "Hierarchical grid"). */
  readonly ariaLabel = input<string | null>(null);
  /** Renders the root rows in a window; the heights of the open child grids are measured. */
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /** Height of the scroll area of the root grid, for example `'30rem'` (with `virtualScroll`). */
  readonly scrollHeight = input<string | null>(null);
  /** Keys of the expanded root rows. Two-way. */
  readonly expandedRows = model<readonly unknown[]>([]);

  /** A row is about to expand: `cancel()` keeps it collapsed. */
  readonly rowExpand = output<StarHierarchicalRowEvent<T>>();
  /** A row is about to collapse: `cancel()` keeps it expanded. */
  readonly rowCollapse = output<StarHierarchicalRowEvent<T>>();
  /** A child grid was created. */
  readonly childGridCreated = output<StarChildGridCreatedEvent<T>>();

  /** The islands of the first child level. */
  readonly islands = contentChildren(StarRowIsland, { descendants: false });
  private readonly root = viewChild.required(StarHierarchicalLevel);

  /** The root `star-table`. */
  get grid(): StarTable<T> {
    return this.root().table() as unknown as StarTable<T>;
  }

  /** Expands every root row (no events). Ignite UI `expandAll`. */
  expandAll(): void {
    this.root().setAll(true);
  }

  /** Collapses every root row (no events). Ignite UI `collapseAll`. */
  collapseAll(): void {
    this.root().setAll(false);
  }

  /** @internal Emits `rowExpand` or `rowCollapse`; false when the owner canceled. */
  emitToggle(open: boolean, row: unknown, level: number, island: IslandView | null): boolean {
    const event = rowEvent(row as T, level, island as StarRowIsland | null);
    (open ? this.rowExpand : this.rowCollapse).emit(event);
    return !event.canceled;
  }

  /** @internal */
  childCreated(level: StarHierarchicalLevel, island: IslandView, table: StarTable<unknown>): void {
    this.childGridCreated.emit({
      parentRow: level.parentRow() as T,
      island: island as StarRowIsland,
      grid: table,
    });
  }

  /** @internal Keeps the focus on a row after a toggle (the table renders the detail row). */
  keepFocus(tr: HTMLElement): void {
    if (!this.browser) return;
    const focused = tr.ownerDocument.activeElement;
    if (focused && tr.contains(focused)) return;
    tr.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }
}
