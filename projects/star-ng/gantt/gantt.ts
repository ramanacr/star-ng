import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
} from '@angular/core';
import {
  injectStarControlDefaults,
  STAR_UI_TEXT,
  starInlineKey,
  starIsRtl,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { addDays, localeFirstDay, startOfDay } from '@star-ng/ui/date-picker';
import {
  STAR_GANTT_DAY_WIDTH,
  starGanttDays,
  starGanttDependencyPath,
  StarGanttDependencyType,
  StarGanttId,
  starGanttRange,
  StarGanttRow,
  starGanttRows,
  StarGanttScale,
  starGanttShift,
  starGanttShiftDays,
  StarGanttTask,
  starGanttTicks,
  starGanttWindow,
  starGanttX,
} from './gantt-model';

/**
 * Payload of `taskChange` (drag or keyboard). The Gantt does not change `tasks`: update them in
 * the handler, or call `cancel()`.
 */
export interface StarGanttTaskChange {
  readonly task: StarGanttTask;
  readonly kind: 'move' | 'resize' | 'progress';
  readonly start: Date;
  readonly end: Date;
  readonly progress: number;
  /** Rejects the change: the Gantt announces "Change canceled". */
  cancel(): void;
  readonly canceled: boolean;
}

/** Payload of `taskSelect`. */
export interface StarGanttTaskSelect {
  readonly task: StarGanttTask;
}

interface Preview {
  readonly id: string;
  readonly start: Date;
  readonly end: Date;
  readonly progress: number;
}

interface DragState {
  readonly row: StarGanttRow;
  readonly mode: 'move' | 'end' | 'progress';
  readonly x: number;
  readonly barWidth: number;
  moved: boolean;
}

/** A drawn bar. */
interface Bar {
  readonly row: StarGanttRow;
  readonly x: number;
  readonly width: number;
  readonly y: number;
  readonly color: string | null;
}

const HEADER = 56;
const BAR_INSET = 8;
const key = (id: StarGanttId | null | undefined) =>
  id === null || id === undefined ? '' : String(id);

/**
 * Gantt chart (Kendo UI Gantt, Syncfusion Gantt, DevExtreme Gantt): a task tree grid on the
 * start side and a timeline on the end side, in one scroll area, so both scroll together.
 *
 * - `tasks` with `start`, exclusive `end`, `progress`, `parentId`, `dependencies` (FS, SS, FF,
 *   SF) and `milestone`. A summary task spans its children; its rows collapse and expand
 *   (`collapsed` model). Dependencies are drawn as orthogonal arrows, milestones as diamonds.
 * - `scale`: `day`, `week` or `month`, with weekends shaded and a today line in the browser.
 * - The Gantt never changes `tasks`. Drag a bar to move it, its end to resize it, or the progress
 *   handle; `taskChange` reports the result on drop, in whole days, and `cancel()` rejects it.
 * - Keyboard: the tree grid is the entry (tree grid pattern, one row in the tab order). Up and
 *   Down move between rows, Right and Left expand and collapse, Enter selects. Alt and Left or
 *   Right move the task by one scale unit, Alt, Shift and Left or Right change its end, Alt and Up
 *   or Down change its progress by 10; a live region reads the result. In right-to-left the
 *   timeline is mirrored and Left and Right swap.
 * - Each row is named like its bar ("Design, 3 March to 14 March, 40 percent") and lists its
 *   dependencies as text. The timeline is hidden from assistive technology, because the grid
 *   gives the same data.
 * - Rows are virtualized: only the rows in view (plus a few) are rendered, so 1,000 tasks and
 *   more stay fast.
 *
 * ```html
 * <star-gantt [tasks]="tasks()" scale="week" [(collapsed)]="collapsed" (taskChange)="apply($event)" />
 * ```
 */
@Component({
  selector: 'star-gantt',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-gantt',
    '[style.--star-gantt-row-height.px]': 'rowHeight()',
    '[style.--star-gantt-header-height.px]': 'header',
    '[style.--star-gantt-timeline-width.px]': 'timelineWidth()',
  },
  template: `
    <div data-star-part="scroll" class="star-gantt__scroll" (scroll)="onScroll($event)">
      <div data-star-part="panes" class="star-gantt__panes">
        <!-- The keys of the focused row bubble to the tree grid (roving tabindex). -->
        <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
        <div
          data-star-part="grid"
          class="star-gantt__grid"
          role="treegrid"
          [attr.aria-label]="ariaLabel() ?? text.ganttTasks"
          [attr.aria-rowcount]="rows().length + 1"
          aria-colcount="5"
          (keydown)="onKey($event)"
        >
          <div
            data-star-part="row"
            class="star-gantt__row star-gantt__row--head"
            role="row"
            aria-rowindex="1"
          >
            <div
              data-star-part="cell"
              role="columnheader"
              class="star-gantt__cell star-gantt__cell--name"
            >
              {{ text.name }}
            </div>
            <div data-star-part="cell" role="columnheader" class="star-gantt__cell">
              {{ text.start }}
            </div>
            <div data-star-part="cell" role="columnheader" class="star-gantt__cell">
              {{ text.end }}
            </div>
            <div
              data-star-part="cell"
              role="columnheader"
              class="star-gantt__cell star-gantt__cell--number"
            >
              {{ text.duration }}
            </div>
            <div
              data-star-part="cell"
              role="columnheader"
              class="star-gantt__cell star-gantt__cell--number"
            >
              {{ text.progress }}
            </div>
          </div>
          <div
            data-star-part="body"
            class="star-gantt__body"
            role="rowgroup"
            [style.padding-block-start.px]="window().start * rowHeight()"
            [style.block-size.px]="rows().length * rowHeight()"
          >
            @for (row of shownRows(); track row.task.id) {
              <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
              <div
                data-star-part="row"
                class="star-gantt__row"
                role="row"
                [class.star-gantt__row--summary]="row.summary"
                [class.star-gantt__row--active]="row.index === activeIndex()"
                [attr.tabindex]="row.index === tabRow() ? 0 : -1"
                [attr.aria-rowindex]="row.index + 2"
                [attr.aria-level]="row.level"
                [attr.aria-posinset]="row.posinset"
                [attr.aria-setsize]="row.setsize"
                [attr.aria-expanded]="row.summary ? row.expanded : null"
                [attr.aria-label]="rowName(row)"
                [attr.aria-describedby]="canChange(row) ? hintId : null"
                [attr.data-task-id]="row.task.id"
                (click)="onRowClick(row)"
                (focus)="activeIndex.set(row.index)"
              >
                <div
                  data-star-part="cell"
                  role="gridcell"
                  class="star-gantt__cell star-gantt__cell--name"
                  [style.--star-gantt-level]="row.level - 1"
                >
                  @if (row.summary) {
                    <span
                      data-star-part="toggle"
                      class="star-gantt__toggle"
                      aria-hidden="true"
                      (click)="toggle(row, $event)"
                    >
                      <i
                        data-star-part="toggleIcon"
                        class="ph-bold star-icon-mirror"
                        [class.ph-caret-down]="row.expanded"
                        [class.ph-caret-right]="!row.expanded"
                      ></i>
                    </span>
                  } @else {
                    <span
                      data-star-part="toggle"
                      class="star-gantt__toggle"
                      aria-hidden="true"
                    ></span>
                  }
                  <span data-star-part="name" class="star-gantt__name">{{ row.task.name }}</span>
                </div>
                <div data-star-part="cell" role="gridcell" class="star-gantt__cell">
                  {{ shortDate(row.start) }}
                </div>
                <div data-star-part="cell" role="gridcell" class="star-gantt__cell">
                  {{ row.milestone ? shortDate(row.start) : shortDate(lastDay(row)) }}
                </div>
                <div
                  data-star-part="cell"
                  role="gridcell"
                  class="star-gantt__cell star-gantt__cell--number"
                >
                  {{ text.durationDays(durationOf(row)) }}
                </div>
                <div
                  data-star-part="cell"
                  role="gridcell"
                  class="star-gantt__cell star-gantt__cell--number"
                >
                  {{ row.milestone ? '' : row.progress + '%' }}
                </div>
              </div>
            }
          </div>
        </div>

        <div data-star-part="timeline" class="star-gantt__timeline" aria-hidden="true">
          <div data-star-part="scale" class="star-gantt__scale">
            @for (tier of [ticks().upper, ticks().lower]; track $index) {
              <div data-star-part="tier" class="star-gantt__tier">
                @for (tick of tier; track tick.x) {
                  <span
                    data-star-part="tick"
                    class="star-gantt__tick"
                    [style.inset-inline-start.px]="tick.x"
                    [style.inline-size.px]="tick.width"
                    [attr.title]="tick.title"
                    >{{ tick.label }}</span
                  >
                }
              </div>
            }
          </div>
          <svg
            data-star-part="svg"
            class="star-gantt__svg"
            [attr.width]="timelineWidth()"
            [attr.height]="rows().length * rowHeight()"
            [attr.viewBox]="'0 0 ' + timelineWidth() + ' ' + rows().length * rowHeight()"
            focusable="false"
          >
            <defs>
              <marker
                [attr.id]="markerId"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path
                  data-star-part="arrowHead"
                  d="M 0 0 L 8 4 L 0 8 z"
                  class="star-gantt__arrow-head"
                />
              </marker>
            </defs>
            @for (weekend of weekends(); track weekend) {
              <rect
                data-star-part="weekend"
                class="star-gantt__weekend"
                [attr.x]="weekend"
                y="0"
                [attr.width]="dayWidth()"
                [attr.height]="rows().length * rowHeight()"
              />
            }
            @for (row of shownRows(); track row.task.id) {
              @if (row.index % 2 === 1) {
                <rect
                  data-star-part="stripe"
                  class="star-gantt__stripe"
                  x="0"
                  [attr.y]="row.index * rowHeight()"
                  [attr.width]="timelineWidth()"
                  [attr.height]="rowHeight()"
                />
              }
            }
            @for (path of dependencyPaths(); track path.key) {
              <path
                data-star-part="dependency"
                class="star-gantt__dependency"
                [attr.d]="path.d"
                [attr.marker-end]="'url(#' + markerId + ')'"
              />
            }
            @for (bar of bars(); track bar.row.task.id) {
              <g
                data-star-part="bar"
                class="star-gantt__bar"
                [class.star-gantt__bar--summary]="bar.row.summary"
                [class.star-gantt__bar--milestone]="bar.row.milestone"
                [class.star-gantt__bar--readonly]="!canChange(bar.row)"
                [class.star-gantt__bar--dragging]="preview()?.id === key(bar.row.task.id)"
                [attr.data-task-id]="bar.row.task.id"
                [style.--star-gantt-bar-color]="bar.color"
              >
                @if (bar.row.milestone) {
                  <path
                    data-star-part="milestone"
                    class="star-gantt__milestone"
                    [attr.d]="diamond(bar)"
                    (pointerdown)="onPointerDown($event, bar, 'move')"
                  />
                } @else {
                  <rect
                    data-star-part="barTrack"
                    class="star-gantt__bar-track"
                    [attr.x]="bar.x"
                    [attr.y]="bar.y"
                    [attr.width]="bar.width"
                    [attr.height]="barHeight()"
                    rx="3"
                    (pointerdown)="onPointerDown($event, bar, 'move')"
                  />
                  <rect
                    data-star-part="barProgress"
                    class="star-gantt__bar-progress"
                    [attr.x]="bar.x"
                    [attr.y]="bar.y"
                    [attr.width]="(bar.width * bar.row.progress) / 100"
                    [attr.height]="barHeight()"
                    rx="3"
                  />
                  @if (canChange(bar.row)) {
                    <rect
                      data-star-part="handle"
                      class="star-gantt__handle"
                      [attr.x]="bar.x + bar.width - 5"
                      [attr.y]="bar.y"
                      width="6"
                      [attr.height]="barHeight()"
                      (pointerdown)="onPointerDown($event, bar, 'end')"
                    />
                    <path
                      data-star-part="progressHandle"
                      class="star-gantt__progress-handle"
                      [attr.d]="progressHandle(bar)"
                      (pointerdown)="onPointerDown($event, bar, 'progress')"
                    />
                  }
                }
              </g>
            }
            @if (todayX() !== null) {
              <line
                data-star-part="today"
                class="star-gantt__today"
                [attr.x1]="todayX()"
                [attr.x2]="todayX()"
                y1="0"
                [attr.y2]="rows().length * rowHeight()"
              />
            }
          </svg>
        </div>
      </div>
    </div>
    <p class="star-sr-only" [id]="hintId">{{ text.ganttMoveHint }}</p>
    <p class="star-sr-only" aria-live="polite">{{ announcement() }}</p>
  `,
})
export class StarGantt {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  private readonly ids = inject(_IdGenerator);
  protected readonly hintId = this.ids.getId('star-gantt-hint-');
  protected readonly markerId = this.ids.getId('star-gantt-arrow-');
  protected readonly header = HEADER;
  protected readonly key = key;

  /** The tasks. The Gantt never changes this array. */
  readonly tasks = input<readonly StarGanttTask[]>([]);
  /** Unit of the time scale and of keyboard moves. */
  readonly scale = model<StarGanttScale>('week');
  /** Ids of the collapsed summary tasks. */
  readonly collapsed = model<readonly StarGanttId[]>([]);
  /** Height of a row in pixels. */
  readonly rowHeight = input(36, { transform: numberAttribute });
  /** Weekdays shaded as weekend (0 = Sunday), in the day and week scales. */
  readonly weekendDays = input<readonly number[]>([0, 6]);
  /** First day of the week (0 = Sunday). Default: from the locale. */
  readonly firstDayOfWeek = input<number | null>(null);
  private readonly defaults = injectStarControlDefaults([]);
  /** Locale of dates and times. Default: `provideStarNg({ locale })`, else the browser. */
  readonly locale = input<string | undefined>(this.defaults.locale ?? undefined);
  /** No task moves, resizes or changes progress. */
  readonly readonly = input(false, { transform: booleanAttribute });
  /** Name of the tree grid. Default: "Tasks". */
  readonly ariaLabel = input<string | null>(null);

  readonly taskChange = output<StarGanttTaskChange>();
  readonly taskSelect = output<StarGanttTaskSelect>();

  /** @internal Index of the active row. */
  readonly activeIndex = signal(0);
  /** @internal Drag preview. */
  readonly preview = signal<Preview | null>(null);
  protected readonly announcement = signal('');
  private readonly scrollTop = signal(0);
  private readonly viewport = signal(600);
  private readonly today = signal<Date | null>(null);
  private drag: DragState | null = null;
  /** Drops the drag in progress; `null` without a drag. */
  private endDrag: (() => void) | null = null;
  private pendingFocus: string | null = null;

  private readonly firstDay = computed(
    () => this.firstDayOfWeek() ?? localeFirstDay(this.locale()),
  );
  private readonly collapsedSet = computed(() => new Set(this.collapsed().map(key)));

  /** @internal The shown rows, with the drag preview applied. */
  readonly rows = computed(() => {
    const preview = this.preview();
    const tasks = preview
      ? this.tasks().map((t) =>
          key(t.id) === preview.id
            ? { ...t, start: preview.start, end: preview.end, progress: preview.progress }
            : t,
        )
      : this.tasks();
    return starGanttRows(tasks, this.collapsedSet());
  });
  private readonly allRows = computed(() => starGanttRows(this.tasks()));
  /** Names of all tasks by id, for the dependency summaries. */
  private readonly taskNames = computed(
    () => new Map(this.tasks().map((t) => [key(t.id), t.name])),
  );
  /** Index of each shown row by task id. */
  private readonly rowIndex = computed(
    () => new Map(this.rows().map((row) => [key(row.task.id), row.index])),
  );

  /** @internal Rendered rows: `[start, end)`. */
  readonly window = computed(() =>
    starGanttWindow(
      this.scrollTop(),
      this.viewport() - HEADER,
      this.rowHeight(),
      this.rows().length,
    ),
  );
  protected readonly shownRows = computed(() => {
    const { start, end } = this.window();
    return this.rows().slice(start, end);
  });

  protected readonly dayWidth = computed(() => STAR_GANTT_DAY_WIDTH[this.scale()]);
  /** The range is fixed by the tasks without the preview, so a drag does not move the scale. */
  protected readonly range = computed(() =>
    starGanttRange(this.allRows(), this.scale(), this.firstDay(), startOfDay(new Date())),
  );
  protected readonly timelineWidth = computed(() =>
    Math.max(1, Math.round(starGanttDays(this.range().start, this.range().end) * this.dayWidth())),
  );
  protected readonly ticks = computed(() =>
    starGanttTicks(this.range(), this.scale(), this.locale(), this.firstDay()),
  );
  protected readonly barHeight = computed(() => Math.max(8, this.rowHeight() - 2 * BAR_INSET));

  protected readonly weekends = computed(() => {
    if (this.scale() === 'month') return [];
    const { start, end } = this.range();
    const days = this.weekendDays();
    const xs: number[] = [];
    for (let d = start, i = 0; d < end && i < 3700; d = addDays(d, 1), i++) {
      if (days.includes(d.getDay())) xs.push(starGanttX(d, start, this.dayWidth()));
    }
    return xs;
  });

  protected readonly todayX = computed(() => {
    const today = this.today();
    const { start, end } = this.range();
    if (!today || today < start || today >= end) return null;
    return starGanttX(today, start, this.dayWidth());
  });

  private barOf(row: StarGanttRow): Bar {
    const start = this.range().start;
    const x = starGanttX(row.start, start, this.dayWidth());
    const width = row.milestone ? 0 : Math.max(2, starGanttX(row.end, start, this.dayWidth()) - x);
    const color = row.task.color ? `var(--star-chart-${row.task.color})` : null;
    return { row, x, width, y: row.index * this.rowHeight() + BAR_INSET, color };
  }

  protected readonly bars = computed(() => this.shownRows().map((row) => this.barOf(row)));

  /** Dependency arrows whose rows overlap the rendered window. */
  protected readonly dependencyPaths = computed(() => {
    const rows = this.rows();
    const byId = new Map(rows.map((row) => [key(row.task.id), row]));
    const { start, end } = this.window();
    const half = this.rowHeight() / 2;
    const paths: { key: string; d: string }[] = [];
    for (const row of rows) {
      for (const dependency of row.task.dependencies ?? []) {
        const from = byId.get(key(dependency.from));
        if (!from) continue;
        const top = Math.min(from.index, row.index);
        const bottom = Math.max(from.index, row.index);
        if (bottom < start || top >= end) continue;
        const a = this.barOf(from);
        const b = this.barOf(row);
        paths.push({
          key: `${key(dependency.from)}>${key(row.task.id)}:${dependency.type}`,
          d: starGanttDependencyPath(
            dependency.type,
            { start: a.x, end: a.x + a.width, y: from.index * this.rowHeight() + half },
            { start: b.x, end: b.x + b.width, y: row.index * this.rowHeight() + half },
            this.rowHeight(),
          ),
        });
      }
    }
    return paths;
  });

  /** @internal Row with the tab stop: the active one, or the first rendered one. */
  readonly tabRow = computed(() => {
    const active = Math.min(this.activeIndex(), Math.max(0, this.rows().length - 1));
    const { start, end } = this.window();
    return active >= start && active < end ? active : start;
  });

  constructor() {
    afterNextRender(() => {
      this.today.set(startOfDay(new Date()));
      const scroller = this.scroller();
      const view = this.host.ownerDocument.defaultView;
      if (!scroller || !view) return;
      const measure = () => {
        if (scroller.clientHeight > 0) this.viewport.set(scroller.clientHeight);
      };
      measure();
      if (typeof view.ResizeObserver === 'function') {
        const observer = new view.ResizeObserver(measure);
        observer.observe(scroller);
        this.destroyRef.onDestroy(() => observer.disconnect());
      }
    });
    afterEveryRender(() => this.restoreFocus());
    this.destroyRef.onDestroy(() => this.endDrag?.());
  }

  private scroller(): HTMLElement | null {
    return this.host.querySelector<HTMLElement>('.star-gantt__scroll');
  }

  protected onScroll(event: Event): void {
    this.scrollTop.set((event.target as HTMLElement).scrollTop);
  }

  // Texts

  protected shortDate(date: Date): string {
    return new Intl.DateTimeFormat(this.locale(), { dateStyle: 'medium' }).format(date);
  }

  private longDate(date: Date): string {
    return new Intl.DateTimeFormat(this.locale(), { day: 'numeric', month: 'long' }).format(date);
  }

  /** The last day a task covers (its end is exclusive). */
  protected lastDay(row: { start: Date; end: Date }): Date {
    const last = +row.end === +startOfDay(row.end) ? addDays(row.end, -1) : row.end;
    return last < row.start ? row.start : last;
  }

  protected durationOf(row: StarGanttRow): number {
    return row.milestone ? 0 : Math.max(0, Math.round(starGanttDays(row.start, row.end)));
  }

  private whenText(start: Date, end: Date, milestone: boolean): string {
    if (milestone) return this.longDate(start);
    return this.text.timeRange(this.longDate(start), this.longDate(this.lastDay({ start, end })));
  }

  private typeName(type: StarGanttDependencyType): string {
    const names: Record<StarGanttDependencyType, string> = {
      FS: this.text.dependencyFS,
      SS: this.text.dependencySS,
      FF: this.text.dependencyFF,
      SF: this.text.dependencySF,
    };
    return names[type];
  }

  /** "Design, 3 March to 14 March, 40 percent", then the kind and the dependencies. */
  protected rowName(row: StarGanttRow): string {
    const parts = [row.task.name, this.whenText(row.start, row.end, row.milestone)];
    if (row.milestone) parts.push(this.text.milestone);
    else parts.push(this.text.percentComplete(row.progress));
    if (row.summary) parts.push(this.text.summaryTask);
    const names = this.taskNames();
    const dependencies = (row.task.dependencies ?? [])
      .filter((d) => names.has(key(d.from)))
      .map((d) => `${names.get(key(d.from))} (${this.typeName(d.type)})`);
    if (dependencies.length) parts.push(this.text.dependsOn(dependencies.join(', ')));
    return parts.join(', ');
  }

  // Tree

  protected canChange(row: StarGanttRow): boolean {
    return !this.readonly() && !row.summary;
  }

  /** Collapses or expands a summary task. */
  toggle(row: StarGanttRow, event?: Event): void {
    event?.stopPropagation();
    if (!row.summary) return;
    const id = key(row.task.id);
    this.collapsed.update((list) =>
      row.expanded ? [...list, row.task.id] : list.filter((item) => key(item) !== id),
    );
  }

  protected onRowClick(row: StarGanttRow): void {
    this.activeIndex.set(row.index);
    this.taskSelect.emit({ task: row.task });
  }

  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (!target.matches('[role="row"][data-task-id]')) return;
    const rows = this.rows();
    const index = this.rowIndex().get(target.dataset['taskId'] ?? '') ?? -1;
    const row = rows[index];
    if (!row) return;
    this.activeIndex.set(index);
    const name = starInlineKey(event, this.host);
    if (event.altKey) {
      if (!name.startsWith('Arrow')) return;
      event.preventDefault();
      this.keyboardChange(row, name, event.shiftKey);
      return;
    }
    let next = index;
    switch (name) {
      case 'ArrowDown':
        next = index + 1;
        break;
      case 'ArrowUp':
        next = index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = rows.length - 1;
        break;
      case 'PageDown':
      case 'PageUp': {
        const page = Math.max(1, Math.floor((this.viewport() - HEADER) / this.rowHeight()) - 1);
        next = index + (name === 'PageDown' ? page : -page);
        break;
      }
      case 'ArrowRight':
        if (row.summary && !row.expanded) this.toggle(row);
        else if (row.summary) next = index + 1;
        else return;
        break;
      case 'ArrowLeft':
        if (row.summary && row.expanded) this.toggle(row);
        else if (row.parentId !== null) next = this.rowIndex().get(key(row.parentId)) ?? index;
        else return;
        break;
      case 'Enter':
      case ' ':
        this.taskSelect.emit({ task: row.task });
        break;
      default:
        return;
    }
    event.preventDefault();
    this.focusRow(Math.min(Math.max(next, 0), rows.length - 1));
  }

  /** Moves the active row, scrolls it into view and focuses it. */
  focusRow(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.activeIndex.set(index);
    const scroller = this.scroller();
    if (scroller) {
      const top = index * this.rowHeight();
      const view = this.viewport() - HEADER;
      const current = this.scrollTop();
      let next = current;
      if (top < current) next = top;
      else if (top + this.rowHeight() > current + view) next = top + this.rowHeight() - view;
      if (next !== current) {
        scroller.scrollTop = next;
        this.scrollTop.set(next);
      }
    }
    this.pendingFocus = key(row.task.id);
    this.restoreFocus();
  }

  private restoreFocus(): void {
    const id = this.pendingFocus;
    if (id === null) return;
    const element = Array.from(
      this.host.querySelectorAll<HTMLElement>('[role="row"][data-task-id]'),
    ).find((e) => e.dataset['taskId'] === id);
    if (!element) return;
    this.pendingFocus = null;
    const active = this.host.ownerDocument.activeElement;
    if (!active || active === this.host.ownerDocument.body || this.host.contains(active)) {
      element.focus();
    }
  }

  // Changes

  private keyboardChange(row: StarGanttRow, name: string, shift: boolean): void {
    if (!this.canChange(row)) {
      this.announce(this.text.readOnly);
      return;
    }
    const scale = this.scale();
    const forward = name === 'ArrowRight' || name === 'ArrowUp';
    const sign = forward ? 1 : -1;
    if (name === 'ArrowUp' || name === 'ArrowDown') {
      if (row.milestone) return;
      const progress = Math.min(100, Math.max(0, row.progress + sign * 10));
      if (progress !== row.progress) this.commit(row, row.start, row.end, progress, 'progress');
      return;
    }
    if (shift) {
      if (row.milestone) return;
      const end = starGanttShift(row.end, scale, sign);
      const min = starGanttShiftDays(row.start, 1);
      this.commit(row, row.start, end < min ? min : end, row.progress, 'resize');
      return;
    }
    const start = starGanttShift(row.start, scale, sign);
    const end = row.milestone
      ? start
      : starGanttShiftDays(start, Math.round(starGanttDays(row.start, row.end)));
    this.commit(row, start, end, row.progress, 'move');
  }

  private commit(
    row: StarGanttRow,
    start: Date,
    end: Date,
    progress: number,
    kind: 'move' | 'resize' | 'progress',
  ): boolean {
    let canceled = false;
    this.taskChange.emit({
      task: row.task,
      kind,
      start,
      end,
      progress,
      cancel: () => {
        canceled = true;
      },
      get canceled() {
        return canceled;
      },
    });
    if (canceled) {
      this.announce(this.text.changeCanceled);
      return false;
    }
    const when = this.whenText(start, end, row.milestone);
    this.announce(
      kind === 'move'
        ? this.text.eventMoved(row.task.name, when)
        : kind === 'resize'
          ? this.text.eventResized(row.task.name, when)
          : this.text.eventResized(row.task.name, this.text.percentComplete(progress)),
    );
    return true;
  }

  /**
   * Sets the live region. The same text twice gets a trailing space, so the region changes and a
   * screen reader reads it again.
   */
  private announce(text: string): void {
    this.announcement.update((now) => (now === text ? `${text} ` : text));
  }

  // Pointer

  protected diamond(bar: Bar): string {
    const size = this.barHeight() / 2 + 2;
    const cy = bar.y + this.barHeight() / 2;
    return `M ${bar.x} ${cy - size} L ${bar.x + size} ${cy} L ${bar.x} ${cy + size} L ${bar.x - size} ${cy} Z`;
  }

  protected progressHandle(bar: Bar): string {
    const x = bar.x + (bar.width * bar.row.progress) / 100;
    const y = bar.y + this.barHeight();
    return `M ${x} ${y - 4} L ${x + 5} ${y + 4} L ${x - 5} ${y + 4} Z`;
  }

  protected onPointerDown(event: PointerEvent, bar: Bar, mode: 'move' | 'end' | 'progress'): void {
    event.stopPropagation();
    if (event.button !== 0 || !this.canChange(bar.row) || this.drag) return;
    event.preventDefault();
    this.activeIndex.set(bar.row.index);
    // The original row (without a preview) is the base of the change.
    const row = this.rows()[this.rowIndex().get(key(bar.row.task.id)) ?? -1] ?? bar.row;
    this.drag = { row, mode, x: event.clientX, barWidth: bar.width, moved: false };
    // Touch and pen: keep the pointer on the bar while it drags (the CSS sets touch-action: none).
    const target = event.target as Element;
    if (typeof event.pointerId === 'number' && typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is already released: the document listeners still finish the drag.
      }
    }
    const doc = this.host.ownerDocument;
    const move = (e: PointerEvent) => this.onPointerMove(e);
    const stop = (e: PointerEvent | null) => {
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', cancel);
      doc.removeEventListener('keydown', escape, true);
      this.endDrag = null;
      const drag = this.drag;
      const preview = this.preview();
      this.drag = null;
      this.preview.set(null);
      if (!e || !drag?.moved || !preview) return;
      const r = drag.row;
      if (
        +preview.start === +r.start &&
        +preview.end === +r.end &&
        preview.progress === r.progress
      ) {
        return;
      }
      this.commit(
        r,
        preview.start,
        preview.end,
        preview.progress,
        drag.mode === 'move' ? 'move' : drag.mode === 'end' ? 'resize' : 'progress',
      );
    };
    const up = (e: PointerEvent) => stop(e);
    // pointercancel, Escape and destroy drop the drag without a change.
    const cancel = () => stop(null);
    // Escape is caught at the document in the capture phase while the drag lasts, so other
    // Escape handlers do not see it. Edge case: when the pointerup is lost (the window lost the
    // pointer), the listeners stay until the next pointerup, pointercancel, Escape or destroy;
    // that Escape then only drops the drag.
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      cancel();
    };
    this.endDrag = cancel;
    doc.addEventListener('pointermove', move);
    doc.addEventListener('pointerup', up);
    doc.addEventListener('pointercancel', cancel);
    doc.addEventListener('keydown', escape, true);
  }

  private onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;
    const rtl = starIsRtl(this.host);
    const dx = (event.clientX - drag.x) * (rtl ? -1 : 1);
    if (!drag.moved && Math.abs(dx) < 3) return;
    drag.moved = true;
    const row = drag.row;
    const days = Math.round(dx / this.dayWidth());
    const id = key(row.task.id);
    if (drag.mode === 'move') {
      const start = starGanttShiftDays(row.start, days);
      const end = row.milestone ? start : starGanttShiftDays(row.end, days);
      this.preview.set({ id, start, end, progress: row.progress });
    } else if (drag.mode === 'end') {
      const min = starGanttShiftDays(row.start, 1);
      const moved = starGanttShiftDays(row.end, days);
      this.preview.set({
        id,
        start: row.start,
        end: moved < min ? min : moved,
        progress: row.progress,
      });
    } else {
      const width = Math.max(1, drag.barWidth);
      const progress = Math.min(100, Math.max(0, Math.round(row.progress + (dx / width) * 100)));
      this.preview.set({ id, start: row.start, end: row.end, progress });
    }
  }
}
