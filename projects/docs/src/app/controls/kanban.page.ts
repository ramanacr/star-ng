import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import {
  StarKanban,
  starKanbanApplyMove,
  StarKanbanCard,
  StarKanbanColumn,
  StarKanbanHeader,
  StarKanbanMove,
  StarKanbanSwimlane,
} from '@star-ng/ui/kanban';
import { StarTag } from '@star-ng/ui/tag';
import { DOCS, DocsRow } from '../shared/docs';

interface Task {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly rank: number;
  readonly owner: string;
  readonly lane: string;
}

const TASKS: readonly Task[] = [
  {
    id: 'T-101',
    title: 'Draft the order form',
    status: 'todo',
    rank: 0,
    owner: 'Ava',
    lane: 'standard',
  },
  {
    id: 'T-102',
    title: 'Price list import',
    status: 'todo',
    rank: 1,
    owner: 'Ben',
    lane: 'standard',
  },
  {
    id: 'T-103',
    title: 'Invoice PDF layout',
    status: 'todo',
    rank: 2,
    owner: 'Chloe',
    lane: 'expedite',
  },
  { id: 'T-104', title: 'Stock alerts', status: 'doing', rank: 0, owner: 'Dev', lane: 'expedite' },
  {
    id: 'T-105',
    title: 'Shipping labels',
    status: 'doing',
    rank: 1,
    owner: 'Elena',
    lane: 'standard',
  },
  {
    id: 'T-106',
    title: 'Refund flow',
    status: 'review',
    rank: 0,
    owner: 'Farid',
    lane: 'standard',
  },
  {
    id: 'T-107',
    title: 'Customer search',
    status: 'done',
    rank: 0,
    owner: 'Grace',
    lane: 'standard',
  },
  {
    id: 'T-108',
    title: 'Order history page',
    status: 'done',
    rank: 1,
    owner: 'Hugo',
    lane: 'expedite',
  },
];

@Component({
  selector: 'docs-kanban-page-content',
  imports: [DOCS, StarKanban, StarKanbanCard, StarKanbanHeader, StarTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .card-title {
      display: block;
      font-weight: 600;
      color: var(--star-text-strong);
    }
    .card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-block-start: 0.5rem;
      color: var(--star-text-muted);
    }
  `,
  template: `
    <docs-page
      heading="Kanban board"
      lead="Columns of cards that move with the pointer and the keyboard, with work-in-progress limits, swimlanes and collapsible columns. The board never changes the items: it reports each move, and the owner applies it. The Syncfusion equivalent is ejs-kanban; the Kendo UI equivalent is TaskBoard; Ignite UI has no kanban board."
      importFrom="import { StarKanban, StarKanbanCard, starKanbanApplyMove } from '@star-ng/ui/kanban';"
    >
      <docs-example
        heading="Task board"
        source="kanban/basic"
        [script]="basicScript"
        note="Drag a card, or focus it and press Space, the arrow keys and Space again. itemMove reports the move; starKanbanApplyMove writes the new column and numbers the rank field again. A column over its limit shows a warning."
      >
        <div class="docs-stack">
          <star-kanban
            [columns]="columns"
            [items]="tasks()"
            columnKey="status"
            itemKey="id"
            order="rank"
            itemLabel="title"
            (itemMove)="onMove($event)"
          >
            <ng-template starKanbanCard [starKanbanCardOf]="tasks()" let-task>
              <span class="card-title">{{ task.title }}</span>
              <span class="card-meta">
                <span>{{ task.owner }}</span>
                <star-tag [value]="task.id" severity="secondary" />
              </span>
            </ng-template>
          </star-kanban>
          <p class="docs-output" role="status">{{ lastMove() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Swimlanes, enforced limits and collapsible columns"
        source="kanban/lanes"
        [script]="lanesScript"
        note="swimlanes and swimlaneKey add rows. enforceLimits blocks a move into a full column (the pointer list refuses it; the keyboard announces it). collapsible adds a button to each header; collapsed is a model of column keys."
      >
        <star-kanban
          [columns]="columns"
          [items]="laneTasks()"
          columnKey="status"
          itemKey="id"
          order="rank"
          itemLabel="title"
          [swimlanes]="lanes"
          swimlaneKey="lane"
          enforceLimits
          collapsible
          [(collapsed)]="collapsed"
          (itemMove)="onLaneMove($event)"
        >
          <ng-template starKanbanHeader let-column let-count="count" let-over="over">
            <span class="card-title">{{ column.title }}</span>
            <star-tag
              [value]="column.limit ? count + ' of ' + column.limit : '' + count"
              [severity]="over ? 'warn' : 'secondary'"
            />
          </ng-template>
          <ng-template starKanbanCard [starKanbanCardOf]="laneTasks()" let-task>
            <span class="card-title">{{ task.title }}</span>
            <span class="card-meta">{{ task.owner }}</span>
          </ng-template>
        </star-kanban>
      </docs-example>

      <docs-example
        heading="Cancel a move"
        source="kanban/cancel"
        [script]="cancelScript"
        note="Call cancel() on the move to refuse it: the board announces that the move was cancelled, and the card stays. Here a card cannot leave Done."
      >
        <div class="docs-stack">
          <star-kanban
            [columns]="columns"
            [items]="lockedTasks()"
            columnKey="status"
            itemKey="id"
            order="rank"
            itemLabel="title"
            (itemMove)="onLockedMove($event)"
          >
            <ng-template starKanbanCard [starKanbanCardOf]="lockedTasks()" let-task>{{
              task.title
            }}</ng-template>
          </star-kanban>
          <p class="docs-output" role="status">{{ refused() }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarKanban', 'StarKanbanCard', 'StarKanbanHeader']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class KanbanPageContent {
  protected readonly columns: readonly StarKanbanColumn[] = [
    { key: 'todo', title: 'To do' },
    { key: 'doing', title: 'In progress', limit: 2 },
    { key: 'review', title: 'Review', limit: 1 },
    { key: 'done', title: 'Done' },
  ];
  protected readonly lanes: readonly StarKanbanSwimlane[] = [
    { key: 'expedite', title: 'Expedite' },
    { key: 'standard', title: 'Standard' },
  ];

  protected readonly tasks = signal<readonly Task[]>(TASKS);
  protected readonly lastMove = signal('No move yet.');
  protected readonly laneTasks = signal<readonly Task[]>(TASKS);
  protected readonly collapsed = signal<readonly string[]>([]);
  protected readonly lockedTasks = signal<readonly Task[]>(TASKS);
  protected readonly refused = signal('');

  protected onMove(move: StarKanbanMove<Task>): void {
    this.tasks.update((tasks) =>
      starKanbanApplyMove(tasks, move, { column: 'status', order: 'rank' }),
    );
    this.lastMove.set(
      `${move.item.title}: ${move.fromColumn} → ${move.toColumn}, position ${move.toIndex + 1}.`,
    );
  }

  protected onLaneMove(move: StarKanbanMove<Task>): void {
    this.laneTasks.update((tasks) =>
      starKanbanApplyMove(tasks, move, { column: 'status', order: 'rank', swimlane: 'lane' }),
    );
  }

  protected onLockedMove(move: StarKanbanMove<Task>): void {
    if (move.fromColumn === 'done' && move.toColumn !== 'done') {
      move.cancel();
      this.refused.set(`${move.item.title} is done and stays in Done.`);
      return;
    }
    this.refused.set('');
    this.lockedTasks.update((tasks) =>
      starKanbanApplyMove(tasks, move, { column: 'status', order: 'rank' }),
    );
  }

  protected readonly basicScript = `readonly columns: StarKanbanColumn[] = [
  { key: 'todo', title: 'To do' },
  { key: 'doing', title: 'In progress', limit: 2 },
  { key: 'review', title: 'Review', limit: 1 },
  { key: 'done', title: 'Done' },
];
readonly tasks = signal<readonly Task[]>(TASKS);
readonly lastMove = signal('No move yet.');

onMove(move: StarKanbanMove<Task>): void {
  this.tasks.update((tasks) => starKanbanApplyMove(tasks, move, { column: 'status', order: 'rank' }));
  this.lastMove.set(\`\${move.item.title}: \${move.fromColumn} → \${move.toColumn}, position \${move.toIndex + 1}.\`);
}`;
  protected readonly lanesScript = `readonly lanes: StarKanbanSwimlane[] = [
  { key: 'expedite', title: 'Expedite' },
  { key: 'standard', title: 'Standard' },
];
readonly laneTasks = signal<readonly Task[]>(TASKS);
readonly collapsed = signal<readonly string[]>([]);

onLaneMove(move: StarKanbanMove<Task>): void {
  this.laneTasks.update((tasks) =>
    starKanbanApplyMove(tasks, move, { column: 'status', order: 'rank', swimlane: 'lane' }),
  );
}`;
  protected readonly cancelScript = `onLockedMove(move: StarKanbanMove<Task>): void {
  if (move.fromColumn === 'done' && move.toColumn !== 'done') {
    move.cancel();
    this.refused.set(\`\${move.item.title} is done and stays in Done.\`);
    return;
  }
  this.lockedTasks.update((tasks) => starKanbanApplyMove(tasks, move, { column: 'status', order: 'rank' }));
}`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starKanbanCard]',
      description: 'Content of a card. Context: $implicit and item (the item), column, swimlane.',
    },
    {
      name: 'ng-template[starKanbanHeader]',
      description:
        'Content of a column header. Context: $implicit and column, count (all lanes), over (more than the limit), collapsed.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface-muted', description: 'Background of a column.' },
    { name: '--star-surface', description: 'Background of a card.' },
    { name: '--star-border', description: 'Border of a column and a card.' },
    { name: '--star-warning', description: 'Border of a column over its limit.' },
    { name: '--star-warning-soft', description: 'Background of a column over its limit.' },
    { name: '--star-accent', description: 'Focus ring, and the dashed outline of a held card.' },
    { name: '--star-shadow-lg', description: 'Shadow of the card that is dragged.' },
    { name: '--star-duration-base', description: 'Duration of the drag animation.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves to the cards (one Tab stop) and to the collapse buttons.' },
    {
      name: 'Arrow keys',
      description:
        'Move the focus to the card above or below, or to the next column (right-to-left mirrors the inline arrows).',
    },
    { name: 'Space', description: 'Picks the focused card up; with a held card, drops it.' },
    {
      name: 'Arrow keys (card held)',
      description:
        'Move the held card up or down in its column, or to the next column or swimlane. A full column refuses it with enforceLimits.',
    },
    { name: 'Escape', description: 'Puts a held card back where it was.' },
  ];
}

/**
 * Route component of the page. It loads the route styles (`kanban.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-kanban-page',
  imports: [KanbanPageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './kanban.page.scss',
  template: '<docs-kanban-page-content />',
})
export class KanbanPage {}
