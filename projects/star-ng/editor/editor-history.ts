/**
 * The undo history of `star-editor`. The browser history does not know the changes that the
 * editor makes to the DOM itself (colors, lists, tables …), so the editor keeps its own: a
 * snapshot of the HTML and the selection after each change. Typing in a row is one step.
 *
 * Ported from Aurora RTE `packages/editor/src/commands.ts` (undo and redo), MIT
 * (https://github.com/ramanacr/aurora-rte, see THIRD_PARTY_NOTICES.md).
 */

/** A selection as child index paths from the area, so it survives a new `innerHTML`. */
export interface StarEditorSelectionPath {
  readonly start: readonly number[];
  readonly startOffset: number;
  readonly end: readonly number[];
  readonly endOffset: number;
}

export interface StarEditorSnapshot {
  readonly html: string;
  readonly selection: StarEditorSelectionPath | null;
}

function pathOf(node: Node, area: Node): number[] | null {
  const path: number[] = [];
  for (let current: Node | null = node; current !== area; current = current.parentNode) {
    if (!current?.parentNode) return null;
    path.unshift([...current.parentNode.childNodes].indexOf(current as ChildNode));
  }
  return path;
}

function nodeAt(area: Node, path: readonly number[]): Node | null {
  let node: Node | null = area;
  for (const index of path) node = node?.childNodes[index] ?? null;
  return node;
}

/** The selection `range` as paths in `area`, or `null` when it is outside. */
export function starEditorSelectionPath(
  area: HTMLElement,
  range: Range | null,
): StarEditorSelectionPath | null {
  if (!range) return null;
  const start = pathOf(range.startContainer, area);
  const end = pathOf(range.endContainer, area);
  return start && end
    ? { start, startOffset: range.startOffset, end, endOffset: range.endOffset }
    : null;
}

/** A range for `path` in `area`, or `null` when the nodes are gone. */
export function starEditorPathRange(
  area: HTMLElement,
  path: StarEditorSelectionPath | null,
): Range | null {
  if (!path) return null;
  const start = nodeAt(area, path.start);
  const end = nodeAt(area, path.end);
  if (!start || !end) return null;
  const length = (node: Node) =>
    node.nodeType === 3 ? (node as Text).length : node.childNodes.length;
  const range = area.ownerDocument.createRange();
  try {
    range.setStart(start, Math.min(path.startOffset, length(start)));
    range.setEnd(end, Math.min(path.endOffset, length(end)));
  } catch {
    return null;
  }
  return range;
}

/** Snapshots with a current position: undo goes back, redo forward, a new change drops the redo. */
export class StarEditorHistory {
  private states: StarEditorSnapshot[] = [];
  private index = -1;

  constructor(private readonly limit = 100) {}

  /** Starts again with one state (a value from outside). */
  reset(state: StarEditorSnapshot): void {
    this.states = [state];
    this.index = 0;
  }

  /**
   * Adds the state after a change. `merge` replaces the last change instead (typing in a row).
   * A state with the same HTML as the current one only updates the selection.
   */
  record(state: StarEditorSnapshot, merge = false): void {
    const current = this.states[this.index];
    if (current && current.html === state.html) {
      this.states[this.index] = state;
      return;
    }
    this.states.length = this.index + 1;
    if (merge && this.index > 0) this.states[this.index] = state;
    else {
      this.states.push(state);
      if (this.states.length > this.limit) this.states.shift();
      this.index = this.states.length - 1;
    }
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.states.length - 1;
  }

  /** The state before the current one, or `null`. */
  undo(): StarEditorSnapshot | null {
    return this.canUndo ? this.states[--this.index] : null;
  }

  /** The state after the current one, or `null`. */
  redo(): StarEditorSnapshot | null {
    return this.canRedo ? this.states[++this.index] : null;
  }
}
