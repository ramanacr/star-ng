import { computed, Signal, signal } from '@angular/core';
import type { StarUiText } from '@star-ng/ui/core';

/**
 * Edit state of `star-table`: validation, the editor drafts of the rows in edit, and the pending
 * change set of batch edit with its undo and redo history. The table only holds this state. It
 * never changes its `value`: every change leaves the table as an event, and the owner applies it.
 *
 * The state uses plain signals, not Angular signal forms. The editors change with the rows and
 * columns on the page, and a signal form needs one model object per form. A map of drafts and one
 * validation function per cell are smaller.
 */

/** Checks a cell value. Returns the message to show, or `null` when the value is valid. */
export type StarCellValidator<T> = (value: unknown, row: T) => string | null;

/**
 * The validation rules of an editable column (part of `StarColumn`). An editor with an invalid
 * value shows the message (`aria-invalid`, `aria-describedby`) and the table does not save it.
 * Ignite column `validators`; PrimeNG has no built-in cell validation.
 */
export interface StarColumnRules<T> {
  /** The value must not be empty. */
  readonly required?: boolean;
  /** Smallest number. */
  readonly min?: number;
  /** Largest number. */
  readonly max?: number;
  /** The text must match. A string pattern must match the whole value (`^…$`). */
  readonly pattern?: string | RegExp;
  /**
   * Own checks, in order after the rules above. Each returns the message, or `null`. In an editor
   * the row holds the editor values of the other fields too, so a rule can compare fields.
   */
  readonly validators?: StarCellValidator<T> | readonly StarCellValidator<T>[];
}

/** A cell enters or leaves edit without a save (`editInit`, `editCancel`). PrimeNG `onEditInit`, `onEditCancel`. */
export interface StarEditCellEvent<T> {
  readonly row: T;
  readonly field: string;
}

/** A row event: `rowEditInit`, `rowEditCancel`, `rowAdd`, `rowDelete`. */
export interface StarRowEvent<T> {
  readonly row: T;
}

/** Changed fields of one row, with the values before the change. */
export interface StarRowChange<T> {
  readonly row: T;
  /** New values by column `field`. Only the fields that changed. */
  readonly changes: Readonly<Record<string, unknown>>;
  /** Values before the change, by column `field`. */
  readonly previous: Readonly<Record<string, unknown>>;
}

/** The user saved a row in row edit mode (`rowEditSave`). */
export type StarRowEditSaveEvent<T> = StarRowChange<T>;

/** The pending changes of batch edit (`pendingChanges()`, `batchSave`). */
export interface StarBatchChanges<T> {
  /** Existing rows with changed cells. */
  readonly updated: readonly StarRowChange<T>[];
  /** New rows, with their edited values merged into them (by `field`). */
  readonly added: readonly T[];
  /** Existing rows to delete. */
  readonly deleted: readonly T[];
}

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

/** Same value for the editor: `Object.is`, and an empty text equals a missing value. */
export function sameEditValue(a: unknown, b: unknown): boolean {
  return Object.is(a, b) || (isEmpty(a) && isEmpty(b));
}

/** The first error of a cell value, or `null`. Order: required, min, max, pattern, validators. */
export function starCellError<T>(
  rules: StarColumnRules<T>,
  value: unknown,
  row: T,
  text: Pick<
    StarUiText,
    'valueRequired' | 'valueMin' | 'valueMax' | 'valuePattern' | 'valueNumber'
  >,
): string | null {
  // An editor that holds text that is not a number (`validity.badInput`) gives `NaN`.
  if (typeof value === 'number' && Number.isNaN(value)) return text.valueNumber;
  if (isEmpty(value)) {
    if (rules.required) return text.valueRequired;
  } else {
    const number = typeof value === 'number' ? value : Number(value);
    if (rules.min !== undefined && number < rules.min) return text.valueMin(rules.min);
    if (rules.max !== undefined && number > rules.max) return text.valueMax(rules.max);
    if (rules.pattern !== undefined) {
      // A text pattern must match the whole value, as in Angular `Validators.pattern`.
      const pattern =
        typeof rules.pattern === 'string' ? new RegExp(`^(?:${rules.pattern})$`) : rules.pattern;
      pattern.lastIndex = 0;
      if (!pattern.test(String(value))) return text.valuePattern;
    }
  }
  const validators = rules.validators;
  const list = typeof validators === 'function' ? [validators] : (validators ?? []);
  for (const validator of list) {
    const message = validator(value, row);
    if (message) return message;
  }
  return null;
}

type Draft = Readonly<Record<string, unknown>>;

/**
 * Editor values of the rows in edit (row mode) or of the cell in edit (cell mode), by row key,
 * and the rows whose errors show. An error shows after the user changed the field, or after a
 * save attempt.
 */
export class StarEditDrafts {
  private readonly drafts = signal<ReadonlyMap<unknown, Draft>>(new Map());
  private readonly attempted = signal<ReadonlySet<unknown>>(new Set());
  /** The raw editor texts, by row key and field: what the user typed, as typed. */
  private readonly texts = signal<ReadonlyMap<unknown, Readonly<Record<string, string>>>>(
    new Map(),
  );

  /** The raw text of an editor, or `undefined` when it has none. */
  text(key: unknown, field: string): string | undefined {
    return this.texts().get(key)?.[field];
  }

  /** Keeps the raw text of an editor. It does not count as a change (no error shows). */
  setText(key: unknown, field: string, text: string): void {
    this.texts.update((texts) => new Map(texts).set(key, { ...texts.get(key), [field]: text }));
  }

  has(key: unknown, field: string): boolean {
    const draft = this.drafts().get(key);
    return !!draft && Object.prototype.hasOwnProperty.call(draft, field);
  }

  get(key: unknown, field: string): unknown {
    return this.drafts().get(key)?.[field];
  }

  /** All editor values of a row, by field, or `undefined`. */
  values(key: unknown): Draft | undefined {
    return this.drafts().get(key);
  }

  set(key: unknown, field: string, value: unknown): void {
    this.drafts.update((drafts) => {
      const next = new Map(drafts);
      next.set(key, { ...drafts.get(key), [field]: value });
      return next;
    });
  }

  /** Shows the errors of every field of the row. */
  attempt(key: unknown): void {
    this.attempted.update((keys) => new Set(keys).add(key));
  }

  /** The error of the field shows: changed, or a save was attempted. */
  shown(key: unknown, field: string): boolean {
    return this.has(key, field) || this.attempted().has(key);
  }

  clear(key: unknown): void {
    if (this.texts().has(key)) {
      this.texts.update((texts) => {
        const next = new Map(texts);
        next.delete(key);
        return next;
      });
    }
    if (this.drafts().has(key)) {
      this.drafts.update((drafts) => {
        const next = new Map(drafts);
        next.delete(key);
        return next;
      });
    }
    if (this.attempted().has(key)) {
      this.attempted.update((keys) => {
        const next = new Set(keys);
        next.delete(key);
        return next;
      });
    }
  }
}

interface RowUpdate<T> {
  readonly row: T;
  readonly changes: Draft;
  readonly previous: Draft;
}

interface AddedRow<T> {
  readonly row: T;
  readonly position: 'top' | 'bottom';
}

/** One state of the batch change set. Each user action makes a new state (undo history). */
interface ChangeSet<T> {
  readonly updates: ReadonlyMap<unknown, RowUpdate<T>>;
  readonly added: readonly AddedRow<T>[];
  readonly deleted: ReadonlyMap<unknown, T>;
}

/** One cell change: the new value and the value in the row (`value`) before any change. */
export interface StarCellChange {
  readonly field: string;
  readonly value: unknown;
  readonly original: unknown;
}

/**
 * The pending change set of batch edit, with undo and redo. Ignite `batchEditing` with its
 * transaction service. Each call that changes the set is one step of the history.
 */
export class StarEditBatch<T> {
  private readonly state = signal<ChangeSet<T>>(this.empty());
  private readonly past = signal<readonly ChangeSet<T>[]>([]);
  private readonly future = signal<readonly ChangeSet<T>[]>([]);

  readonly canUndo: Signal<boolean> = computed(() => this.past().length > 0);
  readonly canRedo: Signal<boolean> = computed(() => this.future().length > 0);
  /** New rows at the top and at the bottom of the table. */
  readonly addedTop = computed(() =>
    this.state()
      .added.filter((added) => added.position === 'top')
      .map((added) => added.row),
  );
  readonly addedBottom = computed(() =>
    this.state()
      .added.filter((added) => added.position === 'bottom')
      .map((added) => added.row),
  );
  readonly hasUpdates = computed(() => this.state().updates.size > 0);

  readonly changes: Signal<StarBatchChanges<T>> = computed(() => {
    const { updates, added, deleted } = this.state();
    const addedKeys = new Set(added.map((entry) => this.keyOf(entry.row)));
    return {
      updated: [...updates]
        .filter(([key]) => !addedKeys.has(key) && !deleted.has(key))
        .map(([, update]) => update),
      added: added.map(({ row }) => {
        const changes = updates.get(this.keyOf(row))?.changes;
        return changes ? ({ ...row, ...changes } as T) : row;
      }),
      deleted: [...deleted.values()],
    };
  });

  constructor(private readonly keyOf: (row: T) => unknown) {}

  private empty(): ChangeSet<T> {
    return { updates: new Map(), added: [], deleted: new Map() };
  }

  private commitState(next: ChangeSet<T>): void {
    this.past.update((past) => [...past, this.state()]);
    this.future.set([]);
    this.state.set(next);
  }

  /** The pending value of a cell: `{ value }`, or `null` when the cell has no change. */
  pending(row: T, field: string): { readonly value: unknown } | null {
    const updates = this.state().updates;
    if (!updates.size) return null;
    const changes = updates.get(this.keyOf(row))?.changes;
    return changes && Object.prototype.hasOwnProperty.call(changes, field)
      ? { value: changes[field] }
      : null;
  }

  isAdded(row: T): boolean {
    const key = this.keyOf(row);
    return this.state().added.some((added) => Object.is(this.keyOf(added.row), key));
  }

  isDeleted(row: T): boolean {
    const deleted = this.state().deleted;
    return deleted.size > 0 && deleted.has(this.keyOf(row));
  }

  /** Records cell changes of one row as one step. Returns `false` when nothing changed. */
  change(row: T, cells: readonly StarCellChange[]): boolean {
    const state = this.state();
    const updates = this.updatesWith(state, row, cells);
    if (!updates) return false;
    this.commitState({ ...state, updates });
    return true;
  }

  /** The updates of `state` with cell changes of one row, or `null` when nothing changed. */
  private updatesWith(
    state: ChangeSet<T>,
    row: T,
    cells: readonly StarCellChange[],
  ): Map<unknown, RowUpdate<T>> | null {
    const key = this.keyOf(row);
    const current = state.updates.get(key);
    const changes: Record<string, unknown> = { ...current?.changes };
    const previous: Record<string, unknown> = { ...current?.previous };
    let changed = false;
    for (const cell of cells) {
      const before = Object.prototype.hasOwnProperty.call(changes, cell.field)
        ? changes[cell.field]
        : cell.original;
      if (sameEditValue(before, cell.value)) continue;
      changed = true;
      if (sameEditValue(cell.value, cell.original)) {
        delete changes[cell.field];
        delete previous[cell.field];
      } else {
        changes[cell.field] = cell.value;
        previous[cell.field] = cell.original;
      }
    }
    if (!changed) return null;
    const updates = new Map(state.updates);
    if (Object.keys(changes).length) updates.set(key, { row, changes, previous });
    else updates.delete(key);
    return updates;
  }

  /** Adds a new row with its first values (`cells`) as one step. */
  add(row: T, position: 'top' | 'bottom', cells: readonly StarCellChange[] = []): void {
    const state = this.state();
    const updates = this.updatesWith(state, row, cells) ?? state.updates;
    this.commitState({ ...state, updates, added: [...state.added, { row, position }] });
  }

  /** Marks an existing row as deleted, or drops a new row. */
  remove(row: T): void {
    const state = this.state();
    const key = this.keyOf(row);
    if (this.isAdded(row)) {
      const updates = new Map(state.updates);
      updates.delete(key);
      this.commitState({
        ...state,
        updates,
        added: state.added.filter((added) => !Object.is(this.keyOf(added.row), key)),
      });
      return;
    }
    if (state.deleted.has(key)) return;
    this.commitState({ ...state, deleted: new Map(state.deleted).set(key, row) });
  }

  undo(): boolean {
    const past = this.past();
    if (!past.length) return false;
    this.future.update((future) => [this.state(), ...future]);
    this.state.set(past[past.length - 1]);
    this.past.set(past.slice(0, -1));
    return true;
  }

  redo(): boolean {
    const [next, ...rest] = this.future();
    if (!next) return false;
    this.past.update((past) => [...past, this.state()]);
    this.state.set(next);
    this.future.set(rest);
    return true;
  }

  /** Empties the change set and the history. */
  reset(): void {
    this.state.set(this.empty());
    this.past.set([]);
    this.future.set([]);
  }
}
