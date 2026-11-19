import { CdkDropList } from '@angular/cdk/drag-drop';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  StarKanban,
  starKanbanApplyMove,
  StarKanbanCard,
  StarKanbanColumn,
  StarKanbanHeader,
  StarKanbanMove,
  StarKanbanSwimlane,
} from '@star-ng/ui/kanban';

interface Task {
  id: number;
  title: string;
  status: string;
  rank: number;
  lane?: string;
}

function key(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

const TASKS: Task[] = [
  { id: 1, title: 'Task 1', status: 'todo', rank: 1, lane: 'a' },
  { id: 2, title: 'Task 2', status: 'todo', rank: 0, lane: 'a' },
  { id: 3, title: 'Task 3', status: 'doing', rank: 0, lane: 'b' },
  { id: 4, title: 'Task 4', status: 'done', rank: 0, lane: 'a' },
  { id: 5, title: 'Task 5', status: 'done', rank: 1, lane: 'b' },
  { id: 6, title: 'Task 6', status: 'done', rank: 2, lane: 'a' },
];

@Component({
  imports: [StarKanban, StarKanbanCard, StarKanbanHeader],
  template: `
    <div [attr.dir]="dir()">
      <star-kanban
        [columns]="columns()"
        [items]="tasks()"
        columnKey="status"
        itemKey="id"
        order="rank"
        itemLabel="title"
        [swimlanes]="lanes()"
        swimlaneKey="lane"
        [enforceLimits]="enforce()"
        collapsible
        [(collapsed)]="collapsed"
        (itemMove)="onMove($event)"
      >
        <ng-template starKanbanCard [starKanbanCardOf]="tasks()" let-task let-column="column">
          <span class="card-title">{{ task.title }}</span>
          <small class="card-column">{{ column.key }}</small>
        </ng-template>
        @if (customHeader()) {
          <ng-template starKanbanHeader let-column let-count="count" let-over="over">
            <b class="custom-head">{{ column.title }} ({{ count }}{{ over ? '!' : '' }})</b>
          </ng-template>
        }
      </star-kanban>
    </div>
  `,
})
class Host {
  readonly board = viewChild.required(StarKanban);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly columns = signal<StarKanbanColumn[]>([
    { key: 'todo', title: 'To do', limit: 3 },
    { key: 'doing', title: 'In progress', limit: 1 },
    { key: 'done', title: 'Done', limit: 2 },
  ]);
  readonly lanes = signal<StarKanbanSwimlane[]>([]);
  readonly tasks = signal<readonly Task[]>(TASKS);
  readonly enforce = signal(false);
  readonly customHeader = signal(false);
  readonly collapsed = signal<readonly string[]>([]);
  readonly moves: StarKanbanMove<Task>[] = [];
  apply = true;
  refuse = false;
  onMove(move: StarKanbanMove<Task>): void {
    this.moves.push(move);
    if (this.refuse) move.cancel();
    else if (this.apply) {
      this.tasks.update((tasks) =>
        starKanbanApplyMove(tasks, move, {
          column: 'status',
          order: 'rank',
          swimlane: this.lanes().length ? 'lane' : undefined,
        }),
      );
    }
  }
}

async function setup(init?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  init?.(fixture.componentInstance);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const columns = () => [...root.querySelectorAll<HTMLElement>('.star-kanban__column')];
  const card = (id: number) =>
    root.querySelector<HTMLElement>(`.star-kanban__card[data-key="${id}"]`)!;
  const titles = (column: HTMLElement) =>
    [...column.querySelectorAll('.card-title')].map((t) => t.textContent?.trim());
  const live = () => root.querySelector('[aria-live]')?.textContent?.trim();
  const stable = () => fixture.whenStable();
  return { fixture, root, host, columns, card, titles, live, stable };
}

describe('StarKanban', () => {
  it('renders columns as named groups with lists of cards in order', async () => {
    const { columns, titles, card, root } = await setup();
    expect(columns().map((c) => c.getAttribute('aria-label'))).toEqual([
      'To do, 2 items, limit 3',
      'In progress, 1 item, limit 1',
      'Done, 3 items, limit 2',
    ]);
    expect(columns().every((c) => c.getAttribute('role') === 'group')).toBe(true);
    expect(columns()[0].querySelector('[role="list"]')).not.toBeNull();
    // `order` sorts the cards of a column.
    expect(titles(columns()[0])).toEqual(['Task 2', 'Task 1']);
    expect(card(2).getAttribute('role')).toBe('listitem');
    const hint = root.querySelector(`#${card(2).getAttribute('aria-describedby')}`);
    expect(hint?.textContent).toContain('Press Space to pick up the card');
    // One card is the Tab stop.
    expect([...root.querySelectorAll('.star-kanban__card[tabindex="0"]')]).toEqual([card(2)]);
    expect(card(2).querySelector('.card-column')?.textContent).toBe('todo');
    // Counts and limits: Done is over its limit, In progress is full.
    expect(columns()[2].classList).toContain('star-kanban__column--over');
    expect(columns()[1].classList).toContain('star-kanban__column--full');
    expect(columns()[1].classList).not.toContain('star-kanban__column--over');
    expect(columns()[0].querySelector('.star-kanban__count')?.textContent?.trim()).toBe('2 / 3');
  });

  it('a header template replaces the default header', async () => {
    const { columns } = await setup((host) => host.customHeader.set(true));
    expect(columns()[2].querySelector('.custom-head')?.textContent).toBe('Done (3!)');
    expect(columns()[0].querySelector('.star-kanban__title')).toBeNull();
  });

  it('arrow keys move the focus between cards and columns; RTL mirrors', async () => {
    const { host, card, stable } = await setup();
    card(2).focus();
    key(card(2), 'ArrowDown');
    await stable();
    expect(document.activeElement).toBe(card(1));
    expect(card(1).tabIndex).toBe(0);
    expect(card(2).tabIndex).toBe(-1);
    key(card(1), 'ArrowRight');
    await stable();
    // Same index, clamped to the shorter column.
    expect(document.activeElement).toBe(card(3));
    key(card(3), 'ArrowRight');
    await stable();
    expect(document.activeElement).toBe(card(4));
    key(card(4), 'ArrowUp');
    await stable();
    expect(document.activeElement).toBe(card(4));

    host.dir.set('rtl');
    await stable();
    key(card(4), 'ArrowRight');
    await stable();
    expect(document.activeElement).toBe(card(3));
  });

  it('Space picks a card up, arrows move it, Space drops it with announcements', async () => {
    const { host, card, columns, titles, live, stable } = await setup();
    const before = host.tasks();
    card(2).focus();
    expect(key(card(2), ' ').defaultPrevented).toBe(true);
    await stable();
    expect(live()).toBe('Picked up Task 2 in To do');
    expect(card(2).classList).toContain('star-kanban__card--grabbed');

    key(card(2), 'ArrowDown');
    await stable();
    expect(live()).toBe('Moved to To do, position 2 of 2');
    expect(titles(columns()[0])).toEqual(['Task 1', 'Task 2']);

    key(card(2), 'ArrowRight');
    await stable();
    expect(live()).toBe('Moved to In progress, position 2 of 2');
    expect(titles(columns()[1])).toEqual(['Task 3', 'Task 2']);
    expect(document.activeElement).toBe(card(2));
    // The board does not change the items while a card is held.
    expect(host.tasks()).toBe(before);

    key(card(2), ' ');
    await stable();
    expect(host.moves).toHaveLength(1);
    const move = host.moves[0];
    expect([move.fromColumn, move.fromIndex, move.toColumn, move.toIndex, move.source]).toEqual([
      'todo',
      0,
      'doing',
      1,
      'keyboard',
    ]);
    expect(move.item).toBe(before[1]);
    expect(move.swimlane).toBeNull();
    expect(live()).toBe('Task 2 dropped in In progress, position 2 of 2');
    expect(titles(columns()[1])).toEqual(['Task 3', 'Task 2']);
    expect(host.tasks().find((t) => t.id === 2)).toEqual({
      ...before[1],
      status: 'doing',
      rank: 1,
    });
    expect(document.activeElement).toBe(card(2));
  });

  it('Escape cancels a keyboard move; cancel() in the handler refuses it', async () => {
    const { host, card, columns, titles, live, stable } = await setup();
    card(2).focus();
    key(card(2), ' ');
    key(card(2), 'ArrowRight');
    await stable();
    key(card(2), 'Escape');
    await stable();
    expect(live()).toBe('Move cancelled. Task 2 is back in To do');
    expect(titles(columns()[0])).toEqual(['Task 2', 'Task 1']);
    expect(host.moves).toHaveLength(0);

    host.refuse = true;
    key(card(2), ' ');
    key(card(2), 'ArrowRight');
    await stable();
    key(card(2), ' ');
    await stable();
    expect(host.moves).toHaveLength(1);
    expect(host.moves[0].canceled).toBe(true);
    expect(live()).toBe('Move cancelled. Task 2 is back in To do');
    expect(titles(columns()[0])).toEqual(['Task 2', 'Task 1']);
  });

  it('Tab while a card is held cancels the move and lets the focus leave', async () => {
    const { card, columns, titles, live, stable } = await setup();
    card(2).focus();
    key(card(2), ' ');
    key(card(2), 'ArrowRight');
    await stable();
    const tab = key(card(2), 'Tab');
    // The browser moves the focus on; simulate that.
    expect(tab.defaultPrevented).toBe(false);
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    await stable();
    expect(live()).toBe('Move cancelled. Task 2 is back in To do');
    expect(titles(columns()[0])).toEqual(['Task 2', 'Task 1']);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('enforceLimits blocks a move into a full column', async () => {
    const { fixture, host, card, live, stable } = await setup((h) => h.enforce.set(true));
    card(2).focus();
    key(card(2), ' ');
    key(card(2), 'ArrowRight');
    await stable();
    expect(live()).toBe('In progress is at its limit');
    key(card(2), ' ');
    await stable();
    expect(host.moves).toHaveLength(0);

    // The pointer drop list refuses the card too.
    const lists = fixture.debugElement.queryAll(By.directive(CdkDropList));
    const doing = lists[1].injector.get(CdkDropList);
    const todo = lists[0].injector.get(CdkDropList);
    const drag = { data: host.tasks()[0] } as never;
    expect(doing.enterPredicate(drag, doing)).toBe(false);
    expect(todo.enterPredicate(drag, todo)).toBe(true);
  });

  it('a pointer drop emits itemMove; the owner applies it', async () => {
    const { fixture, host, columns, titles, live, stable } = await setup();
    const lists = fixture.debugElement.queryAll(By.directive(CdkDropList));
    const from = lists[0].injector.get(CdkDropList);
    const to = lists[2].injector.get(CdkDropList);
    const item = host.tasks()[0];
    to.dropped.emit({
      previousContainer: from,
      container: to,
      previousIndex: 1,
      currentIndex: 0,
      item: { data: item },
    } as never);
    await stable();
    expect(host.moves[0]).toMatchObject({
      fromColumn: 'todo',
      toColumn: 'done',
      fromIndex: 1,
      toIndex: 0,
      source: 'pointer',
    });
    expect(live()).toBe('Task 1 dropped in Done, position 1 of 4');
    expect(titles(columns()[2])).toEqual(['Task 1', 'Task 4', 'Task 5', 'Task 6']);
    // A drop on the same place emits nothing.
    to.dropped.emit({
      previousContainer: to,
      container: to,
      previousIndex: 0,
      currentIndex: 0,
      item: { data: item },
    } as never);
    expect(host.moves).toHaveLength(1);
  });

  it('swimlanes: one group per column and lane; moves carry the lane', async () => {
    const { host, card, columns, titles, stable, root } = await setup((h) =>
      h.lanes.set([
        { key: 'a', title: 'Expedite' },
        { key: 'b', title: 'Standard' },
      ]),
    );
    expect(columns().map((c) => c.getAttribute('aria-label'))).toEqual([
      'To do, Expedite, 2 items, limit 3',
      'In progress, Expedite, 0 items, limit 1',
      'Done, Expedite, 2 items, limit 2',
      'To do, Standard, 0 items, limit 3',
      'In progress, Standard, 1 item, limit 1',
      'Done, Standard, 1 item, limit 2',
    ]);
    expect(
      [...root.querySelectorAll('.star-kanban__lane-title')].map((t) => t.textContent?.trim()),
    ).toEqual(['Expedite', 'Standard']);
    // Down from the last card of a lane goes on in the next lane of the same column.
    card(6).focus();
    key(card(6), 'ArrowDown');
    await stable();
    expect(document.activeElement).toBe(card(5));
    // A held card moves down into the next lane.
    card(1).focus();
    key(card(1), ' ');
    key(card(1), 'ArrowDown');
    await stable();
    expect(titles(columns()[3])).toEqual(['Task 1']);
    key(card(1), ' ');
    await stable();
    expect(host.moves[0]).toMatchObject({ swimlane: 'b', fromSwimlane: 'a', toColumn: 'todo' });
    expect(host.tasks().find((t) => t.id === 1)?.lane).toBe('b');
  });

  it('keeps cells with similar keys apart and gives the lists index-based ids', async () => {
    const { root, columns, titles } = await setup((h) => {
      h.columns.set([
        { key: 'a-b', title: 'AB' },
        { key: 'a', title: 'A' },
      ]);
      h.lanes.set([
        { key: 'c', title: 'C' },
        { key: 'b-c', title: 'BC' },
      ]);
      h.tasks.set([
        { id: 1, title: 'In a-b / c', status: 'a-b', rank: 0, lane: 'c' },
        { id: 2, title: 'In a / b-c', status: 'a', rank: 0, lane: 'b-c' },
      ]);
    });
    expect(columns().map(titles)).toEqual([['In a-b / c'], [], [], ['In a / b-c']]);
    const ids = [...root.querySelectorAll('.star-kanban__list')].map((list) => list.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => /-c\d+-l\d+$/.test(id))).toBe(true);
  });

  it('collapsible columns hide their cards and keep a count', async () => {
    const { host, root, columns, card, stable } = await setup();
    const button = columns()[2].querySelector<HTMLButtonElement>('.star-kanban__collapse')!;
    expect(button.getAttribute('aria-label')).toBe('Collapse Done');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.click();
    await stable();
    expect(host.collapsed()).toEqual(['done']);
    expect(columns()[2].classList).toContain('star-kanban__column--collapsed');
    expect(columns()[2].querySelector('.star-kanban__card')).toBeNull();
    expect(
      root.querySelector<HTMLButtonElement>('.star-kanban__collapse[aria-expanded="false"]'),
    ).not.toBeNull();
    // The focus skips a collapsed column.
    card(3).focus();
    key(card(3), 'ArrowRight');
    await stable();
    expect(document.activeElement).toBe(card(3));
  });
});

describe('starKanbanApplyMove', () => {
  const move = (over: Partial<StarKanbanMove<Task>>): StarKanbanMove<Task> => ({
    item: TASKS[0],
    fromColumn: 'todo',
    toColumn: 'done',
    fromIndex: 1,
    toIndex: 1,
    swimlane: null,
    fromSwimlane: null,
    source: 'pointer',
    cancel: () => undefined,
    canceled: false,
    ...over,
  });

  it('moves an item to another column and numbers both cells again', () => {
    const next = starKanbanApplyMove(TASKS, move({}), { column: 'status', order: 'rank' });
    expect(next).not.toBe(TASKS);
    const done = next.filter((t) => t.status === 'done').sort((a, b) => a.rank - b.rank);
    expect(done.map((t) => t.id)).toEqual([4, 1, 5, 6]);
    expect(next.find((t) => t.id === 2)).toEqual({ ...TASKS[1], rank: 0 });
    // Unchanged items keep their identity.
    expect(next.find((t) => t.id === 3)).toBe(TASKS[2]);
    expect(TASKS[0].status).toBe('todo');
  });

  it('reorders within a column', () => {
    const next = starKanbanApplyMove(
      TASKS,
      move({ item: TASKS[3], fromColumn: 'done', fromIndex: 0, toIndex: 2 }),
      { column: 'status', order: 'rank' },
    );
    const done = next.filter((t) => t.status === 'done').sort((a, b) => a.rank - b.rank);
    expect(done.map((t) => t.id)).toEqual([5, 6, 4]);
  });

  it('without an order field, moves the item in the array', () => {
    const items = TASKS.map(({ rank: _rank, ...task }) => task);
    const next = starKanbanApplyMove(
      items,
      { ...move({}), item: items[0] } as unknown as StarKanbanMove<(typeof items)[number]>,
      { column: 'status' },
    );
    expect(next.filter((t) => t.status === 'done').map((t) => t.id)).toEqual([4, 1, 5, 6]);
  });
});
