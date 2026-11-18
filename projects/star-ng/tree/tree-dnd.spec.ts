import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTree, StarTreeNode } from './tree';
import {
  dropPositionAt,
  isWithin,
  keyboardDrop,
  scopesMatch,
  StarTreeDropValidator,
  StarTreeNodeDropEvent,
} from './tree-dnd';
import { parentsOf } from './tree-model';

const NODES: StarTreeNode[] = [
  {
    key: 'eng',
    label: 'Engineering',
    children: [
      { key: 'web', label: 'Web' },
      { key: 'ops', label: 'Operations' },
      { key: 'qa', label: 'Quality', draggable: false },
    ],
  },
  { key: 'fin', label: 'Finance', droppable: false },
  { key: 'hr', label: 'People' },
  { key: 'lab', label: 'Lab', leaf: false },
  { key: 'it', label: 'IT' },
];

describe('tree drop rules', () => {
  it('splits a row into before, inside and after', () => {
    expect(dropPositionAt(2, 40, true)).toBe('before');
    expect(dropPositionAt(20, 40, true)).toBe('inside');
    expect(dropPositionAt(38, 40, true)).toBe('after');
    expect(dropPositionAt(19, 40, false)).toBe('before');
    expect(dropPositionAt(21, 40, false)).toBe('after');
  });

  it('matches scopes by a shared name', () => {
    expect(scopesMatch('files', 'files')).toBe(true);
    expect(scopesMatch(['a', 'files'], ['files'])).toBe(true);
    expect(scopesMatch('files', 'mail')).toBe(false);
    expect(scopesMatch(null, 'files')).toBe(false);
    expect(scopesMatch('files', null)).toBe(false);
  });

  it('knows when a node is in the subtree of another', () => {
    const parents = parentsOf(NODES);
    expect(isWithin(parents, 'web', 'eng')).toBe(true);
    expect(isWithin(parents, 'eng', 'eng')).toBe(true);
    expect(isWithin(parents, 'eng', 'web')).toBe(false);
  });

  it('turns the keyboard moves into drops', () => {
    expect(keyboardDrop(NODES, 'ops', 'up')).toEqual({
      target: NODES[0].children![0],
      position: 'before',
    });
    expect(keyboardDrop(NODES, 'ops', 'down')?.target.key).toBe('qa');
    expect(keyboardDrop(NODES, 'qa', 'down')).toBeNull();
    expect(keyboardDrop(NODES, 'web', 'up')).toBeNull();
    expect(keyboardDrop(NODES, 'ops', 'in')).toEqual({
      target: NODES[0].children![0],
      position: 'inside',
    });
    expect(keyboardDrop(NODES, 'web', 'in')).toBeNull();
    expect(keyboardDrop(NODES, 'web', 'out')).toEqual({ target: NODES[0], position: 'after' });
    expect(keyboardDrop(NODES, 'eng', 'out')).toBeNull();
    expect(keyboardDrop(NODES, 'missing', 'up')).toBeNull();
  });
});

@Component({
  imports: [StarTree],
  template: `
    @if (showFirst()) {
      <star-tree
        class="one"
        [nodes]="nodes"
        [expanded]="['eng']"
        [draggableNodes]="drag()"
        droppableNodes
        draggableScope="org"
        [validateDrop]="validate()"
        filter
        ariaLabel="Departments"
        (nodeDrop)="drops.push($event)"
        (nodeExpand)="expands.push($event.node.key)"
      />
    }
    <star-tree
      class="two"
      [nodes]="others"
      droppableNodes
      [droppableScope]="scope()"
      ariaLabel="Archive"
      (nodeDrop)="otherDrops.push($event)"
    />
  `,
})
class DndHost {
  readonly nodes = NODES;
  readonly others: StarTreeNode[] = [{ key: 'old', label: 'Old teams' }];
  readonly drag = signal(true);
  readonly showFirst = signal(true);
  readonly expands: string[] = [];
  readonly scope = signal<string | null>('org');
  readonly validate = signal<StarTreeDropValidator | null>(null);
  readonly drops: StarTreeNodeDropEvent[] = [];
  readonly otherDrops: StarTreeNodeDropEvent[] = [];
}

/** The data of a drag: the types it carries, as the browser shows them during dragover. */
class FakeDataTransfer {
  effectAllowed = 'all';
  dropEffect = 'none';
  readonly types: string[];
  constructor(types: readonly string[] = []) {
    this.types = [...types];
  }
  setData(type: string): void {
    if (!this.types.includes(type)) this.types.push(type);
  }
}

/** The data of the current tree drag: dragstart fills it, later events of the drag share it. */
let transfer = new FakeDataTransfer();

/**
 * A drag event as the browser sends it (jsdom has no DragEvent), at a vertical offset in a row.
 * `dragstart` begins a new drag; pass `data` for a drag that comes from outside (a file, a text).
 */
function dragEvent(type: string, target: HTMLElement, offset = 20, data?: FakeDataTransfer): Event {
  if (type === 'dragstart' && !data) transfer = new FakeDataTransfer();
  const event = new Event(type, { bubbles: true, cancelable: true });
  const top = target.getBoundingClientRect().top;
  Object.defineProperty(event, 'clientY', { value: top + offset });
  Object.defineProperty(event, 'dataTransfer', { value: data ?? transfer });
  target.dispatchEvent(event);
  return event;
}

describe('StarTree drag and drop', () => {
  async function setup() {
    const fixture = TestBed.createComponent(DndHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const row = (key: string, tree = 'one') =>
      el.querySelector<HTMLElement>(`star-tree.${tree} [data-key="${key}"]`)!;
    // Rows are 40 px high for the drop position math.
    for (const item of el.querySelectorAll<HTMLElement>('[data-key]')) {
      item.getBoundingClientRect = () => ({ top: 0, height: 40, bottom: 40 }) as DOMRect;
    }
    const press = async (target: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
      );
      await fixture.whenStable();
      await Promise.resolve();
      await fixture.whenStable();
    };
    const live = () => el.querySelector('star-tree.one [aria-live]')?.textContent?.trim();
    return { fixture, host: fixture.componentInstance, el, row, press, live };
  }

  it('marks draggable rows and names the move keys', async () => {
    const { fixture, host, el, row } = await setup();
    expect(row('web').getAttribute('draggable')).toBe('true');
    expect(row('qa').getAttribute('draggable')).toBeNull();
    const tree = el.querySelector('star-tree.one [role=tree]')!;
    const hint = el.querySelector(`#${tree.getAttribute('aria-describedby')}`);
    expect(hint?.textContent).toContain('arrow keys');
    host.drag.set(false);
    await fixture.whenStable();
    expect(row('web').getAttribute('draggable')).toBeNull();
    expect(tree.getAttribute('aria-describedby')).toBeNull();
  });

  it('drops with the pointer: before, inside, after, with the indicator', async () => {
    const { fixture, host, row } = await setup();
    dragEvent('dragstart', row('web'));
    await fixture.whenStable();
    expect(row('web').classList).toContain('star-tree__item--dragging');
    const over = dragEvent('dragover', row('hr'), 20);
    await fixture.whenStable();
    expect(over.defaultPrevented).toBe(true);
    expect(row('hr').classList).toContain('star-tree__item--drop-inside');
    dragEvent('dragover', row('hr'), 2);
    await fixture.whenStable();
    expect(row('hr').classList).toContain('star-tree__item--drop-before');
    dragEvent('drop', row('hr'), 2);
    await fixture.whenStable();
    expect(host.drops).toEqual([
      { dragNode: NODES[0].children![0], dropNode: NODES[2], position: 'before' },
    ]);
    expect(row('hr').classList).not.toContain('star-tree__item--drop-before');
    expect(row('web').classList).not.toContain('star-tree__item--dragging');
  });

  it('refuses a drop on itself, into its own subtree, or inside a node that is not droppable', async () => {
    const { fixture, row } = await setup();
    dragEvent('dragstart', row('eng'));
    expect(dragEvent('dragover', row('eng')).defaultPrevented).toBe(false);
    expect(dragEvent('dragover', row('web')).defaultPrevented).toBe(false);
    dragEvent('dragend', row('eng'));
    dragEvent('dragstart', row('web'));
    // Finance is not droppable: the middle of its row means after, not inside.
    dragEvent('dragover', row('fin'), 20);
    await fixture.whenStable();
    expect(row('fin').classList).toContain('star-tree__item--drop-after');
  });

  it('validateDrop can refuse a drop', async () => {
    const { fixture, host, row } = await setup();
    host.validate.set((_drag, target) => target.key !== 'hr');
    await fixture.whenStable();
    dragEvent('dragstart', row('web'));
    expect(dragEvent('dragover', row('hr')).defaultPrevented).toBe(false);
    expect(dragEvent('dragover', row('fin')).defaultPrevented).toBe(true);
  });

  it('drops into another tree when the scopes match, with fromTree', async () => {
    const { fixture, host, row } = await setup();
    dragEvent('dragstart', row('ops'));
    dragEvent('dragover', row('old', 'two'), 20);
    dragEvent('drop', row('old', 'two'), 20);
    await fixture.whenStable();
    expect(host.otherDrops.length).toBe(1);
    expect(host.otherDrops[0].dragNode.key).toBe('ops');
    expect(host.otherDrops[0].position).toBe('inside');
    expect(host.otherDrops[0].fromTree).toBeInstanceOf(StarTree);
    host.scope.set('mail');
    await fixture.whenStable();
    dragEvent('dragstart', row('ops'));
    expect(dragEvent('dragover', row('old', 'two')).defaultPrevented).toBe(false);
  });

  it('moves with Ctrl+Shift and the arrows, and announces the move', async () => {
    const { host, row, press, live } = await setup();
    row('ops').focus();
    await press(row('ops'), 'ArrowUp', { ctrlKey: true, shiftKey: true });
    expect(host.drops.at(-1)).toMatchObject({ dropNode: { key: 'web' }, position: 'before' });
    expect(live()).toBe('Operations moved before Web');
    await press(row('ops'), 'ArrowDown', { ctrlKey: true, shiftKey: true });
    expect(host.drops.at(-1)).toMatchObject({ dropNode: { key: 'qa' }, position: 'after' });
    await press(row('ops'), 'ArrowRight', { ctrlKey: true, shiftKey: true });
    expect(host.drops.at(-1)).toMatchObject({ dropNode: { key: 'web' }, position: 'inside' });
    expect(live()).toBe('Operations moved into Web');
    await press(row('ops'), 'ArrowLeft', { ctrlKey: true, shiftKey: true });
    expect(host.drops.at(-1)).toMatchObject({ dropNode: { key: 'eng' }, position: 'after' });
    // A plain arrow still navigates.
    await press(row('ops'), 'ArrowUp');
    expect(host.drops.length).toBe(4);
  });

  it('announces a refused keyboard move and emits nothing', async () => {
    const { host, row, press, live } = await setup();
    // People would go inside Finance, which is not droppable.
    row('hr').focus();
    await press(row('hr'), 'ArrowRight', { ctrlKey: true, shiftKey: true });
    expect(host.drops).toEqual([]);
    expect(live()).toBe('People cannot move there');
    // A node that is not draggable does not move.
    await press(row('qa'), 'ArrowUp', { ctrlKey: true, shiftKey: true });
    expect(host.drops).toEqual([]);
  });

  it('mirrors the inline arrows in right-to-left', async () => {
    const { host, row, press, el } = await setup();
    el.setAttribute('dir', 'rtl');
    await press(row('ops'), 'ArrowLeft', { ctrlKey: true, shiftKey: true });
    expect(host.drops.at(-1)).toMatchObject({ dropNode: { key: 'web' }, position: 'inside' });
  });

  it('a tree drag carries its own data type', async () => {
    const { row } = await setup();
    dragEvent('dragstart', row('web'));
    expect(transfer.types).toContain('application/x-star-tree');
  });

  it('ignores an outside drag after a tree drag that never ended', async () => {
    const { fixture, host, row } = await setup();
    // The source row leaves the DOM or the user presses Escape: no dragend reaches the tree.
    dragEvent('dragstart', row('web'));
    const files = new FakeDataTransfer(['Files']);
    const over = dragEvent('dragover', row('hr'), 20, files);
    await fixture.whenStable();
    expect(over.defaultPrevented).toBe(false);
    expect(row('hr').className).not.toMatch(/drop-/);
    dragEvent('drop', row('hr'), 20, files);
    expect(host.drops).toEqual([]);
  });

  it('a new drag start clears a stale drag', async () => {
    const { fixture, row } = await setup();
    dragEvent('dragstart', row('web'));
    await fixture.whenStable();
    expect(row('web').classList).toContain('star-tree__item--dragging');
    // A drag from a row that cannot drag (for example a text selection) starts a new drag.
    dragEvent('dragstart', row('qa'));
    await fixture.whenStable();
    expect(row('web').classList).not.toContain('star-tree__item--dragging');
  });

  it('destroying the source tree clears its drag', async () => {
    const { fixture, host, row } = await setup();
    dragEvent('dragstart', row('web'));
    host.showFirst.set(false);
    await fixture.whenStable();
    const other = fixture.nativeElement.querySelector(
      'star-tree.two [data-key="old"]',
    ) as HTMLElement;
    other.getBoundingClientRect = () => ({ top: 0, height: 40, bottom: 40 }) as DOMRect;
    expect(dragEvent('dragover', other).defaultPrevented).toBe(false);
  });

  it('Ctrl+Shift and an arrow navigate as usual while the moves are off', async () => {
    const { fixture, host, row, press } = await setup();
    host.drag.set(false);
    await fixture.whenStable();
    row('ops').focus();
    await press(row('ops'), 'ArrowUp', { ctrlKey: true, shiftKey: true });
    expect(host.drops).toEqual([]);
    expect(document.activeElement).toBe(row('web'));
  });

  it('turns the keyboard moves off while a filter query is active', async () => {
    const { fixture, host, el, row, press } = await setup();
    const input = el.querySelector<HTMLInputElement>('star-tree.one input[type=search]')!;
    input.value = 'o';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const tree = el.querySelector('star-tree.one [role=tree]')!;
    expect(tree.getAttribute('aria-describedby')).toBeNull();
    row('ops').focus();
    await press(row('ops'), 'ArrowUp', { ctrlKey: true, shiftKey: true });
    expect(host.drops).toEqual([]);
  });

  it('a move inside a closed lazy node opens it with nodeExpand', async () => {
    const { host, row, press } = await setup();
    row('it').focus();
    await press(row('it'), 'ArrowRight', { ctrlKey: true, shiftKey: true });
    expect(host.drops.at(-1)).toMatchObject({ dropNode: { key: 'lab' }, position: 'inside' });
    expect(host.expands).toEqual(['lab']);
  });
});
