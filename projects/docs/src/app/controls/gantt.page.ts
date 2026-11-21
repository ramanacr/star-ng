import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import {
  StarGantt,
  StarGanttId,
  StarGanttScale,
  StarGanttTask,
  StarGanttTaskChange,
} from '@star-ng/ui/gantt';
import { StarSelectButton } from '@star-ng/ui/select-button';
import { DOCS, DocsRow } from '../shared/docs';

const at = (m: number, d: number): Date => new Date(2026, m - 1, d);

/** A product launch plan in spring 2026. */
function launchPlan(): StarGanttTask[] {
  return [
    { id: 'discovery', name: 'Discovery', start: at(3, 2), end: at(3, 2) },
    {
      id: 'research',
      name: 'Market research',
      start: at(3, 2),
      end: at(3, 7),
      progress: 100,
      parentId: 'discovery',
    },
    {
      id: 'requirements',
      name: 'Requirements',
      start: at(3, 5),
      end: at(3, 12),
      progress: 80,
      parentId: 'discovery',
      dependencies: [{ from: 'research', type: 'SS' }],
    },
    {
      id: 'design',
      name: 'Design',
      start: at(3, 12),
      end: at(3, 24),
      progress: 40,
      dependencies: [{ from: 'requirements', type: 'FS' }],
      color: 7,
    },
    { id: 'build', name: 'Build', start: at(3, 1), end: at(3, 1) },
    {
      id: 'frontend',
      name: 'Web shop pages',
      start: at(3, 24),
      end: at(4, 11),
      progress: 10,
      parentId: 'build',
      dependencies: [{ from: 'design', type: 'FS' }],
    },
    {
      id: 'backend',
      name: 'Order service',
      start: at(3, 19),
      end: at(4, 11),
      progress: 25,
      parentId: 'build',
      dependencies: [{ from: 'design', type: 'SS' }],
    },
    {
      id: 'testing',
      name: 'Acceptance tests',
      start: at(4, 6),
      end: at(4, 18),
      parentId: 'build',
      dependencies: [{ from: 'frontend', type: 'FF' }],
      color: 3,
    },
    {
      id: 'launch',
      name: 'Launch',
      start: at(4, 20),
      end: at(4, 20),
      milestone: true,
      dependencies: [{ from: 'testing', type: 'FS' }],
    },
  ];
}

/** 1,000 tasks in 50 groups. */
function largePlan(): StarGanttTask[] {
  const tasks: StarGanttTask[] = [];
  for (let g = 0; g < 50; g++) {
    tasks.push({ id: `g${g}`, name: `Work package ${g + 1}`, start: at(3, 1), end: at(3, 1) });
    for (let i = 0; i < 19; i++) {
      const offset = (g * 3 + i * 2) % 60;
      tasks.push({
        id: `g${g}-${i}`,
        name: `Order batch ${g * 19 + i + 1}`,
        start: new Date(2026, 2, 1 + offset),
        end: new Date(2026, 2, 4 + offset + (i % 5)),
        progress: (i * 13) % 100,
        parentId: `g${g}`,
        color: (((g + i) % 8) + 1) as StarGanttTask['color'],
      });
    }
  }
  return tasks;
}

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './gantt.page.scss',
  selector: 'docs-gantt-page',
  imports: [DOCS, StarGantt, StarSelectButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Gantt chart"
      lead="A task tree grid with a timeline: bars, milestones, summary tasks and dependency arrows, with drag and drop and full keyboard support. The Kendo UI, Syncfusion and DevExtreme equivalents are all called Gantt."
      importFrom="import { StarGantt } from '@star-ng/ui/gantt';"
    >
      <docs-example
        heading="Product launch plan"
        source="gantt/launch"
        [script]="launchScript"
        note="Drag a bar to move it, its end to resize it, or the triangle under it to change the progress. With a row focused, Alt and Left or Right move the task by one scale unit, Alt, Shift and Left or Right change its end, Alt and Up or Down change the progress. The Gantt never changes tasks: the page applies taskChange. Summary tasks span their children; Left and Right collapse and expand them."
      >
        <div class="docs-stack">
          <star-select-button
            [options]="scales"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            size="sm"
            ariaLabel="Scale"
            [(value)]="scale"
          />
          <star-gantt
            [tasks]="tasks()"
            [(scale)]="scale"
            [(collapsed)]="collapsed"
            locale="en-GB"
            ariaLabel="Launch plan"
            (taskChange)="onChange($event)"
          />
          <p class="docs-output" role="status">{{ log() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="1,000 tasks"
        source="gantt/large"
        note="Only the rows in view are rendered, in the grid and in the timeline. The tree grid announces the full row count (aria-rowcount) and the position of each row."
      >
        <star-gantt [tasks]="large" scale="month" ariaLabel="Order batches" readonly />
      </docs-example>

      <h2>Dates and dependencies</h2>
      <p>
        <code>end</code> is exclusive: a task on 3 and 4 March ends on 5 March at 00:00, and the
        grid shows 4 March as its last day. Dependencies are finish to start (FS), start to start
        (SS), finish to finish (FF) and start to finish (SF). The timeline is hidden from screen
        readers: each row is named like its bar ("Design, 12 March to 23 March, 40 percent") and
        lists its dependencies.
      </p>

      <docs-api [of]="['StarGantt']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class GanttPage {
  protected readonly scales: readonly { label: string; value: StarGanttScale }[] = [
    { label: 'Day', value: 'day' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
  ];
  protected readonly tasks = signal<readonly StarGanttTask[]>(launchPlan());
  protected readonly scale = signal<StarGanttScale>('week');
  protected readonly collapsed = signal<readonly StarGanttId[]>([]);
  protected readonly log = signal('Drag a bar or use the keyboard.');
  protected readonly large = largePlan();

  protected onChange(change: StarGanttTaskChange): void {
    this.tasks.update((list) =>
      list.map((t) =>
        t.id === change.task.id
          ? { ...t, start: change.start, end: change.end, progress: change.progress }
          : t,
      ),
    );
    this.log.set(`${change.task.name}: ${change.kind}`);
  }

  protected readonly launchScript = `readonly tasks = signal<readonly StarGanttTask[]>([...]);
readonly scale = signal<StarGanttScale>('week');
readonly collapsed = signal<readonly StarGanttId[]>([]);

onChange(change: StarGanttTaskChange) {
  this.tasks.update((list) =>
    list.map((t) =>
      t.id === change.task.id
        ? { ...t, start: change.start, end: change.end, progress: change.progress }
        : t,
    ),
  );
}`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-gantt-grid-width', description: 'Width of the task grid (30rem).' },
    { name: '--star-gantt-height', description: 'Largest height of the scroll area (28rem).' },
    { name: '--star-gantt-bar-color', description: 'Bar colour without color (the accent).' },
    { name: '--star-chart-1 … --star-chart-8', description: 'Bar colours (color 1 to 8).' },
    { name: '--star-surface-muted', description: 'Weekend columns and row stripes.' },
  ];

  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Up / Down', description: 'Previous or next row.' },
    { name: 'Home / End, Page Up / Page Down', description: 'First, last, or one page of rows.' },
    {
      name: 'Right / Left',
      description: 'Expand or collapse a summary task; go to the first child or to the parent.',
    },
    { name: 'Enter / Space', description: 'taskSelect.' },
    {
      name: 'Alt + Left / Right',
      description: 'Move the task by one scale unit (mirrored in RTL).',
    },
    { name: 'Alt + Shift + Left / Right', description: 'Move the end of the task by one unit.' },
    { name: 'Alt + Up / Down', description: 'Progress plus or minus 10.' },
  ];
}
