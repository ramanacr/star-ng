// Row classes and row tones (`rowClass`, `rowTone`): classes on the body row from the row data.

/**
 * Built-in tint of a whole row (`rowTone`). The names follow `StarSeverity`, plus `muted` (soft
 * text on a subtle surface). The tint is decorative: keep the state as text in a cell too.
 */
export type StarTableRowTone = 'success' | 'info' | 'warn' | 'danger' | 'muted';

/** Classes for a body row (`rowClass`): the forms of an Angular `[class]` binding. */
export type StarTableRowClass =
  string | readonly string[] | Record<string, boolean> | null | undefined;

/** Function of the `rowClass` input. `index` is the position in the shown rows; -1 for a pinned row. */
export type StarTableRowClassFn<T> = (row: T, index: number) => StarTableRowClass;

/** Function of the `rowTone` input. */
export type StarTableRowToneFn<T> = (row: T) => StarTableRowTone | null | undefined;

const TONES: ReadonlySet<string> = new Set<StarTableRowTone>([
  'success',
  'info',
  'warn',
  'danger',
  'muted',
]);

/**
 * The extra classes of one body row: the tone classes, then the consumer classes. `null` when
 * there are none, so the row keeps only its own classes. The result goes to a `[class]` binding,
 * which Angular merges with the static `class` and the `[class.x]` bindings of the row.
 */
export function starRowClasses(
  tone: StarTableRowTone | null | undefined,
  extra: StarTableRowClass,
): string[] | null {
  const classes: string[] = [];
  if (tone && TONES.has(tone)) {
    classes.push('star-table__row--tone', `star-table__row--tone-${tone}`);
  }
  if (typeof extra === 'string') {
    classes.push(...extra.split(/\s+/).filter(Boolean));
  } else if (Array.isArray(extra)) {
    for (const name of extra as readonly string[]) {
      if (typeof name === 'string') classes.push(...name.split(/\s+/).filter(Boolean));
    }
  } else if (extra && typeof extra === 'object') {
    for (const [name, on] of Object.entries(extra)) if (on) classes.push(name);
  }
  return classes.length ? classes : null;
}
