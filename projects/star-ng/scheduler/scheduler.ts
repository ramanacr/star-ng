import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  injectStarControlDefaults,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  starInlineKey,
  StarSlot,
  starSlot,
} from '@star-ng/ui/core';
import { addDays, localeFirstDay, sameDay, startOfDay } from '@star-ng/ui/date-picker';
import { StarDialogService } from '@star-ng/ui/dialog';
import { StarPopover } from '@star-ng/ui/popover';
import {
  StarSchedulerEditor,
  StarSchedulerEditorData,
  StarSchedulerEditorResult,
  StarSchedulerEditorValue,
} from './scheduler-editor';
import {
  starDaySegments,
  starDaySpans,
  starMinutesOf,
  starMonthCell,
  starOccursOn,
  starPackColumns,
  StarSchedulerColor,
  StarSchedulerEvent,
  StarSchedulerId,
  StarSchedulerOccurrence,
  starSchedulerOccurrences,
  starSchedulerRange,
  StarSchedulerResource,
  starSchedulerStep,
  StarSchedulerView,
  starShiftDate,
  starSnapToSlot,
  starWallMinutes,
} from './scheduler-model';

export type { StarSchedulerEditorValue } from './scheduler-editor';

/** Payload of `slotSelect`: the chosen slot (or day). */
export interface StarSchedulerSlotSelect {
  readonly start: Date;
  readonly end: Date;
  readonly allDay: boolean;
  readonly resourceId: StarSchedulerId | null;
}

/** Payload of `eventSelect` and `eventDelete`. */
export interface StarSchedulerEventSelect {
  readonly event: StarSchedulerEvent;
  /** The shown occurrence (for a series: its start and end). */
  readonly occurrence: StarSchedulerOccurrence;
}

/**
 * Payload of `eventChange` (move or resize by pointer or keyboard). The scheduler does not change
 * `events`: update them in the handler, or call `cancel()`. For an occurrence of a series,
 * `occurrence.recurring` is true; it is your decision to change the series or only this one
 * occurrence (for example add an exception and a new single event).
 */
export interface StarSchedulerEventChange {
  readonly event: StarSchedulerEvent;
  readonly occurrence: StarSchedulerOccurrence;
  readonly kind: 'move' | 'resize';
  readonly start: Date;
  readonly end: Date;
  readonly resourceId: StarSchedulerId | null;
  /** Rejects the change: the scheduler announces "Change canceled". */
  cancel(): void;
  readonly canceled: boolean;
}

/** Payload of `editorSave`: `event` is `null` for a new event. */
export interface StarSchedulerEditorSave {
  readonly event: StarSchedulerEvent | null;
  readonly occurrence: StarSchedulerOccurrence | null;
  readonly value: StarSchedulerEditorValue;
}

/** Context of the `starSchedulerEvent` template. */
export interface StarSchedulerEventContext {
  readonly $implicit: StarSchedulerOccurrence;
  readonly event: StarSchedulerEvent;
  /** Time text of the occurrence, for example "10:00 – 11:00". */
  readonly time: string;
}

/**
 * Content of an event in `star-scheduler`. The content goes inside the event button, which keeps
 * its accessible name, keyboard and drag behaviour: do not add focusable elements.
 *
 * ```html
 * <ng-template starSchedulerEvent let-occurrence let-time="time">
 *   <strong>{{ occurrence.event.title }}</strong> {{ time }}
 * </ng-template>
 * ```
 */
@Directive({
  selector: 'ng-template[starSchedulerEvent]',
  providers: [{ provide: StarSlot, useExisting: StarSchedulerEventTemplate }],
})
export class StarSchedulerEventTemplate extends StarSlot<StarSchedulerEventContext> {
  readonly name = 'event';

  static ngTemplateContextGuard(
    _dir: StarSchedulerEventTemplate,
    _ctx: unknown,
  ): _ctx is StarSchedulerEventContext {
    return true;
  }
}

/** An event placed in a cell: CSS custom properties give its place. */
interface Placed {
  readonly occurrence: StarSchedulerOccurrence;
  readonly style: Record<string, string | number>;
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
}

/** What a cell stands for. */
interface CellTime {
  readonly start: Date;
  readonly end: Date;
  readonly allDay: boolean;
  readonly resourceId: StarSchedulerId | null;
}

interface DragState {
  readonly occurrence: StarSchedulerOccurrence;
  readonly mode: 'move' | 'start' | 'end';
  readonly origin: string;
  moved: boolean;
}

interface Preview {
  readonly key: string;
  readonly start: Date;
  readonly end: Date;
  readonly resourceId: StarSchedulerId | null;
}

const ALL_VIEWS: readonly StarSchedulerView[] = [
  'day',
  'week',
  'work-week',
  'month',
  'agenda',
  'timeline-day',
];
const ALL_DAY_ROW = -1;
/** Views with the current-time line. */
const TIME_VIEWS: ReadonlySet<StarSchedulerView> = new Set(['day', 'week', 'work-week']);

/**
 * Scheduler (Kendo UI Scheduler, Syncfusion Schedule, DevExtreme Scheduler; PrimeNG had the
 * deprecated `p-fullcalendar`): events in a day, week, work-week, month, agenda or timeline view.
 *
 * - `events` with `start`, `end`, `allDay`, `resourceId`, `color` (chart palette 1–8) and an RRULE
 *   `recurrence` with `exceptions`. Overlapping events stand side by side; a month cell shows
 *   "+N more" when it is full, and the button opens the list of the day.
 * - The scheduler never changes `events`. A click on an empty slot emits `slotSelect`, a click on
 *   an event `eventSelect`. Dragging an event (or the top or bottom edge) emits `eventChange` on
 *   drop, snapped to `slotMinutes`; call `cancel()` to reject it.
 * - Keyboard: the views are grids (`role="grid"`). The arrow keys move between slots or days,
 *   Enter selects the slot. Events are buttons with one tab stop per view; the arrow keys move
 *   between events in reading order (in the time grid that is row by row: all events of a time
 *   slot, then the next slot), and past the first or last event to its slot. Alt and an arrow
 *   key move the focused event by one slot or day, Alt, Shift and an arrow key change its length.
 *   A live region reads the change. In right-to-left the left and right keys are mirrored.
 * - `editor`: a built-in dialog edits title, start, end, all day and resource, and emits
 *   `editorSave` or `eventDelete`.
 * - Times are the local time of the browser; there is no time-zone conversion.
 *
 * ```html
 * <star-scheduler [events]="events()" [(view)]="view" [(date)]="date" [resources]="rooms"
 *   (eventChange)="move($event)" (slotSelect)="add($event)" />
 * ```
 */
@Component({
  selector: 'star-scheduler',
  imports: [NgTemplateOutlet, StarPopover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarScheduler) }],
  host: {
    class: 'star-scheduler',
    '[class.star-scheduler--dragging]': 'dragging()',
    role: 'group',
    '[attr.aria-label]': 'ariaLabel() ?? text.scheduler',
    '[style.--star-scheduler-days]': 'days().length',
    '[style.--star-scheduler-slots]': 'slots().length',
  },
  template: `
    <div class="star-scheduler__toolbar">
      <div class="star-scheduler__nav">
        <button type="button" class="star-scheduler__button" (click)="goToday()">
          {{ text.today }}
        </button>
        <button
          type="button"
          class="star-scheduler__button star-scheduler__button--icon"
          [attr.aria-label]="text.previousPeriod"
          (click)="page(-1)"
        >
          <i class="ph-bold ph-caret-left star-icon-mirror" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="star-scheduler__button star-scheduler__button--icon"
          [attr.aria-label]="text.nextPeriod"
          (click)="page(1)"
        >
          <i class="ph-bold ph-caret-right star-icon-mirror" aria-hidden="true"></i>
        </button>
      </div>
      <h2 class="star-scheduler__title" [id]="titleId" aria-live="polite">{{ rangeTitle() }}</h2>
      <div class="star-scheduler__views" role="group" [attr.aria-label]="text.schedulerView">
        @for (option of shownViews(); track option) {
          <button
            type="button"
            class="star-scheduler__button"
            [class.star-scheduler__button--active]="option === view()"
            [attr.aria-pressed]="option === view()"
            (click)="view.set(option)"
          >
            {{ viewLabel(option) }}
          </button>
        }
      </div>
    </div>

    @switch (view()) {
      @case ('month') {
        <!-- The keys of the focused cell bubble to the grid (roving tabindex). -->
        <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
        <div
          class="star-scheduler__grid star-scheduler__grid--month"
          role="grid"
          [attr.aria-labelledby]="titleId"
          (keydown)="onGridKey($event)"
        >
          <div role="row" class="star-scheduler__row">
            @for (day of days().slice(0, 7); track day.getTime()) {
              <div role="columnheader" class="star-scheduler__head">
                <span aria-hidden="true">{{ weekdayShort(day) }}</span>
                <span class="star-sr-only">{{ weekdayLong(day) }}</span>
              </div>
            }
          </div>
          @for (week of weeks(); track $index; let r = $index) {
            <div role="row" class="star-scheduler__row">
              @for (day of week; track day.getTime(); let c = $index) {
                <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
                <div
                  role="gridcell"
                  class="star-scheduler__cell star-scheduler__cell--day"
                  [class.star-scheduler__cell--outside]="day.getMonth() !== date().getMonth()"
                  [class.star-scheduler__cell--today]="isToday(day)"
                  [attr.data-cell]="r + ':' + c"
                  [attr.tabindex]="cellTabIndex(r, c)"
                  (click)="onCellClick($event, r, c)"
                  (focus)="active.set([r, c])"
                >
                  <span class="star-scheduler__date">
                    <span aria-hidden="true">{{ day.getDate() }}</span>
                    <span class="star-sr-only">{{ dayLabel(day) }}</span>
                  </span>
                  @let cell = monthCell(day);
                  @for (occurrence of cell.shown; track occurrence.key) {
                    <ng-container
                      *ngTemplateOutlet="
                        eventButton;
                        context: { $implicit: occurrence, style: null, compact: true }
                      "
                    />
                  }
                  @if (cell.more) {
                    <button
                      type="button"
                      class="star-scheduler__more"
                      (click)="openMore($event, day)"
                    >
                      {{ text.moreEvents(cell.more) }}
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
      @case ('agenda') {
        <div class="star-scheduler__agenda" role="list" [attr.aria-labelledby]="titleId">
          @for (group of agenda(); track group.day.getTime()) {
            <div class="star-scheduler__agenda-day" role="listitem">
              <h3 class="star-scheduler__agenda-date">{{ dayLabel(group.day) }}</h3>
              <ul class="star-scheduler__agenda-list">
                @for (occurrence of group.occurrences; track occurrence.key) {
                  <li class="star-scheduler__agenda-item">
                    <span class="star-scheduler__agenda-time" aria-hidden="true">
                      {{ occurrence.event.allDay ? text.allDay : timeText(occurrence) }}
                    </span>
                    <ng-container
                      *ngTemplateOutlet="
                        eventButton;
                        context: { $implicit: occurrence, style: null, compact: false }
                      "
                    />
                  </li>
                }
              </ul>
            </div>
          } @empty {
            <p class="star-scheduler__empty" role="listitem">{{ text.noEvents }}</p>
          }
        </div>
      }
      @case ('timeline-day') {
        <div class="star-scheduler__scroll" #scroll>
          <!-- The keys of the focused cell bubble to the grid (roving tabindex). -->
          <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
          <div
            class="star-scheduler__grid star-scheduler__grid--timeline"
            role="grid"
            [attr.aria-labelledby]="titleId"
            (keydown)="onGridKey($event)"
          >
            <div role="row" class="star-scheduler__row">
              <div role="columnheader" class="star-scheduler__head star-scheduler__corner">
                {{ text.resource }}
              </div>
              @for (slot of slots(); track slot; let c = $index) {
                <div role="columnheader" class="star-scheduler__head star-scheduler__head--slot">
                  @if (slot % 60 === 0) {
                    {{ slotLabel(slot) }}
                  } @else {
                    <span class="star-sr-only">{{ slotLabel(slot) }}</span>
                  }
                </div>
              }
            </div>
            @for (resource of resources(); track resource.id; let r = $index) {
              <div role="row" class="star-scheduler__row">
                <div role="rowheader" class="star-scheduler__resource">{{ resource.name }}</div>
                @for (slot of slots(); track slot; let c = $index) {
                  <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
                  <div
                    role="gridcell"
                    class="star-scheduler__cell star-scheduler__cell--slot"
                    [class.star-scheduler__cell--off]="!isWorkSlot(slot)"
                    [style.--star-scheduler-lanes]="timelineLanes(resource.id)"
                    [attr.data-cell]="r + ':' + c"
                    [attr.tabindex]="cellTabIndex(r, c)"
                    (click)="onCellClick($event, r, c)"
                    (focus)="active.set([r, c])"
                  >
                    @for (item of placed(r + ':' + c); track item.occurrence.key) {
                      <ng-container
                        *ngTemplateOutlet="
                          eventButton;
                          context: {
                            $implicit: item.occurrence,
                            style: item.style,
                            compact: false,
                            item: item,
                          }
                        "
                      />
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }
      @default {
        <div class="star-scheduler__scroll" #scroll>
          <!-- The keys of the focused cell bubble to the grid (roving tabindex). -->
          <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
          <div
            class="star-scheduler__grid star-scheduler__grid--time"
            role="grid"
            [attr.aria-labelledby]="titleId"
            (keydown)="onGridKey($event)"
          >
            <div role="row" class="star-scheduler__row">
              <div role="columnheader" class="star-scheduler__head star-scheduler__corner">
                <span class="star-sr-only">{{ text.time }}</span>
              </div>
              @for (day of days(); track day.getTime()) {
                <div
                  role="columnheader"
                  class="star-scheduler__head"
                  [class.star-scheduler__head--today]="isToday(day)"
                >
                  <span class="star-scheduler__weekday" aria-hidden="true">{{
                    weekdayShort(day)
                  }}</span>
                  <span class="star-scheduler__day-number" aria-hidden="true">{{
                    day.getDate()
                  }}</span>
                  <span class="star-sr-only">{{ dayLabel(day) }}</span>
                </div>
              }
            </div>
            <div role="row" class="star-scheduler__row">
              <div role="rowheader" class="star-scheduler__time star-scheduler__time--all-day">
                {{ text.allDay }}
              </div>
              @for (day of days(); track day.getTime(); let c = $index) {
                <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
                <div
                  role="gridcell"
                  class="star-scheduler__cell star-scheduler__cell--all-day"
                  [style.--star-scheduler-col-z]="days().length - c"
                  [style.--star-scheduler-lanes]="allDayLanes()"
                  [attr.data-cell]="'-1:' + c"
                  [attr.tabindex]="cellTabIndex(-1, c)"
                  (click)="onCellClick($event, -1, c)"
                  (focus)="active.set([-1, c])"
                >
                  @for (item of placed('-1:' + c); track item.occurrence.key) {
                    <ng-container
                      *ngTemplateOutlet="
                        eventButton;
                        context: {
                          $implicit: item.occurrence,
                          style: item.style,
                          compact: true,
                          item: item,
                        }
                      "
                    />
                  }
                </div>
              }
            </div>
            @for (slot of slots(); track slot; let r = $index) {
              <div role="row" class="star-scheduler__row">
                <div
                  role="rowheader"
                  class="star-scheduler__time"
                  [class.star-scheduler__time--hour]="slot % 60 === 0"
                >
                  @if (slot % 60 === 0) {
                    {{ slotLabel(slot) }}
                  } @else {
                    <span class="star-sr-only">{{ slotLabel(slot) }}</span>
                  }
                </div>
                @for (day of days(); track day.getTime(); let c = $index) {
                  <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
                  <div
                    role="gridcell"
                    class="star-scheduler__cell star-scheduler__cell--slot"
                    [class.star-scheduler__cell--off]="!isWorkSlot(slot)"
                    [class.star-scheduler__cell--hour]="slot % 60 === 0"
                    [attr.data-cell]="r + ':' + c"
                    [attr.tabindex]="cellTabIndex(r, c)"
                    (click)="onCellClick($event, r, c)"
                    (focus)="active.set([r, c])"
                  >
                    @if (nowCell() === r + ':' + c) {
                      <span
                        class="star-scheduler__now"
                        role="img"
                        [attr.aria-label]="text.currentTime"
                        [style.--star-scheduler-now]="nowOffset()"
                      ></span>
                    }
                    @for (item of placed(r + ':' + c); track item.occurrence.key) {
                      <ng-container
                        *ngTemplateOutlet="
                          eventButton;
                          context: {
                            $implicit: item.occurrence,
                            style: item.style,
                            compact: false,
                            item: item,
                          }
                        "
                      />
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }
    }

    <ng-template
      #eventButton
      let-occurrence
      let-style="style"
      let-compact="compact"
      let-item="item"
      let-inList="inList"
    >
      <button
        type="button"
        class="star-scheduler__event"
        [class.star-scheduler__event--compact]="compact"
        [class.star-scheduler__event--placed]="!!style"
        [class.star-scheduler__event--short]="isShort(style)"
        [class.star-scheduler__event--readonly]="!canChange(occurrence)"
        [class.star-scheduler__event--dragging]="preview()?.key === occurrence.key"
        [class.star-scheduler__event--continues-before]="item?.continuesBefore"
        [class.star-scheduler__event--continues-after]="item?.continuesAfter"
        [style]="style"
        [style.--star-scheduler-event-color]="colorOf(occurrence.event)"
        [attr.data-event-id]="occurrence.event.id"
        [attr.data-start]="occurrence.start.getTime()"
        [attr.data-key]="occurrence.key"
        [attr.tabindex]="inList || occurrence.key === activeEvent() ? 0 : -1"
        [attr.aria-label]="
          eventSlot() ? null : eventLabel(occurrence, !occurrence.event.allDay && !compact)
        "
        [attr.aria-describedby]="canChange(occurrence) ? hintId : null"
        (click)="onEventClick($event, occurrence, !!inList)"
        (focus)="inList || activeEvent.set(occurrence.key)"
        (keydown)="onEventKey($event, occurrence)"
        (pointerdown)="onPointerDown($event, occurrence, 'move')"
      >
        <!-- Default content: the name is aria-label, which starts with the visible text. A custom
             template is the content of the name, followed by the full name for screen readers. -->
        @if (eventSlot(); as custom) {
          <span class="star-scheduler__event-content">
            <ng-container
              *ngTemplateOutlet="
                custom;
                context: {
                  $implicit: occurrence,
                  event: occurrence.event,
                  time: timeText(occurrence),
                }
              "
            />
          </span>
          <span class="star-sr-only">{{ eventName(occurrence) }}</span>
        } @else {
          <!-- The trailing space keeps the visible text "Title 10:00 to 11:00" one phrase for the
               name check (axe label-content-name-mismatch joins the spans without a space). -->
          <span class="star-scheduler__event-title">{{ occurrence.event.title + ' ' }}</span>
          @if (!occurrence.event.allDay && !compact) {
            <span class="star-scheduler__event-time">{{ timeSpan(occurrence) }}</span>
          }
          @if (occurrence.recurring) {
            <i class="ph-bold ph-repeat star-scheduler__event-repeat" aria-hidden="true"></i>
          }
        }
        @if (style && canChange(occurrence) && !occurrence.event.allDay) {
          <span
            class="star-scheduler__handle star-scheduler__handle--start"
            aria-hidden="true"
            (pointerdown)="onPointerDown($event, occurrence, 'start')"
          ></span>
          <span
            class="star-scheduler__handle star-scheduler__handle--end"
            aria-hidden="true"
            (pointerdown)="onPointerDown($event, occurrence, 'end')"
          ></span>
        }
      </button>
    </ng-template>

    <star-popover #morePopover [ariaLabel]="moreDay() ? dayLabel(moreDay()!) : null">
      @if (moreDay(); as day) {
        <p class="star-scheduler__more-title" aria-hidden="true">{{ dayLabel(day) }}</p>
        <div class="star-scheduler__more-list">
          @for (occurrence of dayOccurrences(day); track occurrence.key) {
            <ng-container
              *ngTemplateOutlet="
                eventButton;
                context: { $implicit: occurrence, style: null, compact: true, inList: true }
              "
            />
          }
        </div>
      }
    </star-popover>

    <p class="star-sr-only" [id]="hintId">{{ text.eventMoveHint }}</p>
    <p class="star-sr-only" aria-live="polite">{{ announcement() }}</p>
  `,
})
export class StarScheduler {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly dialogs = inject(StarDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ids = inject(_IdGenerator);
  protected readonly titleId = this.ids.getId('star-scheduler-title-');
  protected readonly hintId = this.ids.getId('star-scheduler-hint-');

  /** The events. The scheduler never changes this array. */
  readonly events = input<readonly StarSchedulerEvent[]>([]);
  /**
   * Rows of the timeline view, options of the editor, and colours of their events. The timeline
   * shows only the events whose `resourceId` is one of these resources.
   */
  readonly resources = input<readonly StarSchedulerResource[]>([]);
  /** The shown view. */
  readonly view = model<StarSchedulerView>('week');
  /** Anchor date of the view: a day of the shown range. */
  readonly date = model<Date>(startOfDay(new Date()));
  /**
   * Views in the toolbar. `timeline-day` is offered only with `resources`, and it shows only the
   * events of the listed resources (an event without a listed `resourceId` is not in it).
   */
  readonly views = input<readonly StarSchedulerView[]>(ALL_VIEWS);
  /** Length of a slot in minutes; drags and keyboard moves snap to it. */
  readonly slotMinutes = input(30, { transform: numberAttribute });
  /** Start of the work day, `HH:mm`. Slots outside the work day are shaded. */
  readonly workDayStart = input('08:00');
  /** End of the work day, `HH:mm`. */
  readonly workDayEnd = input('17:00');
  /** Weekdays of the work-week view (0 = Sunday). */
  readonly workWeekDays = input<readonly number[]>([1, 2, 3, 4, 5]);
  /** First day of the week (0 = Sunday). Default: from the locale. */
  readonly firstDayOfWeek = input<number | null>(null);
  /** Days in the agenda view. */
  readonly agendaDays = input(7, { transform: numberAttribute });
  /** Events per month cell, including the "+N more" button. */
  readonly monthEventLimit = input(3, { transform: numberAttribute });
  private readonly defaults = injectStarControlDefaults([]);
  /** Locale of dates and times. Default: `provideStarNg({ locale })`, else the browser. */
  readonly locale = input<string | undefined>(this.defaults.locale ?? undefined);
  readonly hourFormat = input<'24' | '12'>('24');
  /** Opens the built-in editor dialog on a slot or event selection. */
  readonly editor = input(false, { transform: booleanAttribute });
  /** No event moves, resizes or edits. */
  readonly readonly = input(false, { transform: booleanAttribute });
  /** Shows the current-time line in the browser. */
  readonly showCurrentTime = input(true, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);

  readonly slotSelect = output<StarSchedulerSlotSelect>();
  readonly eventSelect = output<StarSchedulerEventSelect>();
  readonly eventChange = output<StarSchedulerEventChange>();
  readonly editorSave = output<StarSchedulerEditorSave>();
  readonly eventDelete = output<StarSchedulerEventSelect>();

  private readonly slotsQuery = contentChildren(StarSlot, { descendants: true });
  protected readonly eventSlot = starSlot<StarSchedulerEventContext>(
    this.slotsQuery,
    this,
    'event',
  );
  private readonly morePopover = viewChild<StarPopover>('morePopover');

  /** @internal Active cell of the grid: row and column. */
  readonly active = signal<readonly [number, number]>([0, 0]);
  protected readonly announcement = signal('');
  /**
   * @internal Key of the event with the tab stop of the view: events are one tab stop (roving
   * tabindex), like the cells. Set on focus; the first event of the view when unset or gone.
   */
  readonly activeEvent = signal<string | null>(null);
  protected readonly moreDay = signal<Date | null>(null);
  /** @internal Drag preview. */
  readonly preview = signal<Preview | null>(null);
  /** @internal True while the pointer drags an event: the events let the pointer through. */
  readonly dragging = signal(false);
  private readonly now = signal<Date | null>(null);
  /** True after the first render in the browser. */
  private readonly rendered = signal(false);
  private drag: DragState | null = null;
  /** The "+N more" button of the open list. */
  private moreAnchor: HTMLElement | null = null;
  /** Drops the drag in progress; `null` without a drag. */
  private endDrag: (() => void) | null = null;
  private suppressClick = false;
  private pendingFocus: { id: StarSchedulerId; start: number; tries: number } | null = null;
  private scrollPending = true;

  protected readonly firstDay = computed(
    () => this.firstDayOfWeek() ?? localeFirstDay(this.locale()),
  );
  /** @internal */
  readonly range = computed(() =>
    starSchedulerRange(this.view(), this.date(), {
      firstDayOfWeek: this.firstDay(),
      workWeekDays: this.workWeekDays(),
      agendaDays: this.agendaDays(),
    }),
  );
  /** @internal */
  readonly days = computed(() => this.range().days);
  protected readonly weeks = computed(() => {
    const days = this.days();
    return Array.from({ length: Math.ceil(days.length / 7) }, (_, w) =>
      days.slice(w * 7, w * 7 + 7),
    );
  });
  protected readonly step = computed(() => Math.max(5, Math.min(240, this.slotMinutes() || 30)));
  /** Minutes from midnight of each slot. */
  protected readonly slots = computed(() =>
    Array.from({ length: Math.ceil(1440 / this.step()) }, (_, i) => i * this.step()),
  );
  protected readonly shownViews = computed(() =>
    this.views().filter((v) => v !== 'timeline-day' || this.resources().length > 0),
  );

  /** @internal The shown occurrences, with the drag preview applied. */
  readonly occurrences = computed(() => {
    const occurrences = starSchedulerOccurrences(this.events(), this.range());
    const preview = this.preview();
    if (!preview) return occurrences;
    return occurrences.map((o) =>
      o.key === preview.key
        ? {
            ...o,
            start: preview.start,
            end: preview.end,
            event: { ...o.event, resourceId: preview.resourceId },
          }
        : o,
    );
  });

  protected readonly allDayLanes = computed(() => {
    let lanes = 1;
    for (const [key, items] of this.layout()) {
      if (!key.startsWith(`${ALL_DAY_ROW}:`)) continue;
      for (const item of items) {
        lanes = Math.max(lanes, Number(item.style['--star-scheduler-lane']) + 1);
      }
    }
    return lanes;
  });

  /** Placed events per cell key (`row:column`). */
  private readonly layout = computed(() => {
    const view = this.view();
    const map = new Map<string, Placed[]>();
    const add = (key: string, placed: Placed) => {
      const list = map.get(key);
      if (list) list.push(placed);
      else map.set(key, [placed]);
    };
    const step = this.step();
    const occurrences = this.occurrences();
    if (view === 'day' || view === 'week' || view === 'work-week') {
      const days = this.days();
      const allDay = occurrences.filter((o) => o.event.allDay);
      for (const span of starDaySpans(allDay, days)) {
        add(`${ALL_DAY_ROW}:${span.first}`, {
          occurrence: span.occurrence,
          continuesBefore: span.occurrence.start < days[span.first],
          continuesAfter: span.occurrence.end > addDays(days[span.last], 1),
          style: {
            '--star-scheduler-lane': span.lane,
            '--star-scheduler-span': span.last - span.first + 1,
          },
        });
      }
      days.forEach((day, column) => {
        const segments = starDaySegments(occurrences, day);
        const packed = starPackColumns(
          segments.map((s) => ({ start: s.startMinute, end: s.endMinute })),
        );
        segments.forEach((segment, i) => {
          const row = Math.min(this.slots().length - 1, Math.floor(segment.startMinute / step));
          add(`${row}:${column}`, {
            occurrence: segment.occurrence,
            continuesBefore: segment.continuesBefore,
            continuesAfter: segment.continuesAfter,
            style: {
              '--star-scheduler-top': (segment.startMinute - row * step) / step,
              '--star-scheduler-length': (segment.endMinute - segment.startMinute) / step,
              '--star-scheduler-column': packed[i].column,
              '--star-scheduler-columns': packed[i].columns,
            },
          });
        });
      });
    } else if (view === 'timeline-day') {
      const day = this.days()[0];
      this.resources().forEach((resource, row) => {
        const segments = starDaySegments(
          occurrences.filter((o) => sameId(o.event.resourceId, resource.id)),
          day,
        );
        const allDay = occurrences
          .filter((o) => o.event.allDay && sameId(o.event.resourceId, resource.id))
          .filter((o) => starOccursOn(o, day));
        const items = [
          ...allDay.map((o) => ({
            occurrence: o,
            start: 0,
            end: 1440,
            before: false,
            after: false,
          })),
          ...segments.map((s) => ({
            occurrence: s.occurrence,
            start: s.startMinute,
            end: s.endMinute,
            before: s.continuesBefore,
            after: s.continuesAfter,
          })),
        ];
        const lanes = starPackColumns(items);
        items.forEach((item, i) => {
          const column = Math.min(this.slots().length - 1, Math.floor(item.start / step));
          add(`${row}:${column}`, {
            occurrence: item.occurrence,
            continuesBefore: item.before,
            continuesAfter: item.after,
            style: {
              '--star-scheduler-top': (item.start - column * step) / step,
              '--star-scheduler-length': (item.end - item.start) / step,
              '--star-scheduler-lane': lanes[i].column,
            },
          });
        });
      });
    }
    return map;
  });

  protected readonly agenda = computed(() =>
    this.days()
      .map((day) => ({ day, occurrences: this.dayOccurrences(day) }))
      .filter((group) => group.occurrences.length > 0),
  );

  protected readonly rangeTitle = computed(() => {
    const locale = this.locale();
    const { days } = this.range();
    const view = this.view();
    if (view === 'day' || view === 'timeline-day') {
      return format(days[0], locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (view === 'month') return format(this.date(), locale, { month: 'long', year: 'numeric' });
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const formatter = new Intl.DateTimeFormat(locale, options);
    const first = days[0];
    const last = days[days.length - 1];
    return typeof formatter.formatRange === 'function'
      ? formatter.formatRange(first, last)
      : `${formatter.format(first)} – ${formatter.format(last)}`;
  });

  /** Row and column of the slot that holds the current time, in the browser. */
  protected readonly nowCell = computed(() => {
    const now = this.now();
    if (!now || !this.showCurrentTime()) return null;
    const column = this.days().findIndex((day) => sameDay(day, now));
    if (column < 0) return null;
    const minutes = now.getHours() * 60 + now.getMinutes();
    return `${Math.floor(minutes / this.step())}:${column}`;
  });
  protected readonly nowOffset = computed(() => {
    const now = this.now();
    if (!now) return 0;
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes % this.step()) / this.step();
  });

  constructor() {
    // Today is known in the browser only. The minute timer runs only while a time view shows
    // the current-time line.
    afterNextRender(() => {
      this.now.set(new Date());
      this.rendered.set(true);
    });
    effect((onCleanup) => {
      const view = this.host.ownerDocument.defaultView;
      if (!this.rendered() || !view || !this.showCurrentTime() || !TIME_VIEWS.has(this.view())) {
        return;
      }
      this.now.set(new Date());
      const timer = view.setInterval(() => this.now.set(new Date()), 60_000);
      onCleanup(() => view.clearInterval(timer));
    });
    this.destroyRef.onDestroy(() => this.endDrag?.());
    afterEveryRender(() => {
      this.keepEventTabStop();
      this.restoreFocus();
      this.scrollToWorkDay();
    });
  }

  // Toolbar

  /** Moves the anchor date one page back (`-1`) or forward (`1`). */
  page(direction: 1 | -1): void {
    this.date.set(starSchedulerStep(this.view(), this.date(), direction, this.agendaDays()));
    this.scrollPending = true;
  }

  goToday(): void {
    this.date.set(startOfDay(new Date()));
    this.scrollPending = true;
  }

  protected viewLabel(view: StarSchedulerView): string {
    const t = this.text;
    const labels: Record<StarSchedulerView, string> = {
      day: t.viewDay,
      week: t.viewWeek,
      'work-week': t.viewWorkWeek,
      month: t.viewMonth,
      agenda: t.viewAgenda,
      'timeline-day': t.viewTimeline,
    };
    return labels[view];
  }

  // Texts

  protected isToday(day: Date): boolean {
    return sameDay(day, this.now() ?? null);
  }

  protected weekdayShort(day: Date): string {
    return format(day, this.locale(), { weekday: 'short' });
  }

  protected weekdayLong(day: Date): string {
    return format(day, this.locale(), { weekday: 'long' });
  }

  /** "Tuesday 3 March" (locale order). */
  protected dayLabel(day: Date): string {
    return format(day, this.locale(), { weekday: 'long', day: 'numeric', month: 'long' });
  }

  protected slotLabel(minutes: number): string {
    return this.clock(new Date(2000, 0, 1, 0, minutes));
  }

  private clock(date: Date): string {
    return format(date, this.locale(), {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: this.hourFormat() === '12' ? 'h12' : 'h23',
    });
  }

  protected timeText(occurrence: StarSchedulerOccurrence): string {
    return `${this.clock(occurrence.start)} – ${this.clock(occurrence.end)}`;
  }

  /** Time span of an occurrence for an accessible name or an announcement. */
  private whenText(
    start: Date,
    end: Date,
    allDay: boolean,
    resourceId: StarSchedulerId | null,
  ): string {
    const parts: string[] = [];
    if (allDay) {
      const last = addDays(end, -1);
      parts.push(
        sameDay(start, last) || last < start
          ? this.dayLabel(start)
          : this.text.timeRange(this.dayLabel(start), this.dayLabel(last)),
        this.text.allDay,
      );
    } else if (sameDay(start, end) || (+end === +startOfDay(end) && +addDays(start, 1) >= +end)) {
      parts.push(this.dayLabel(start), this.text.timeRange(this.clock(start), this.clock(end)));
    } else {
      parts.push(
        this.text.timeRange(
          `${this.dayLabel(start)} ${this.clock(start)}`,
          `${this.dayLabel(end)} ${this.clock(end)}`,
        ),
      );
    }
    const resource = this.resources().find((r) => sameId(r.id, resourceId));
    if (resource) parts.push(resource.name);
    return parts.join(', ');
  }

  /** The time span in words, as shown on a timed event: "10:00 to 11:00". */
  protected timeSpan(occurrence: StarSchedulerOccurrence): string {
    return this.text.timeRange(this.clock(occurrence.start), this.clock(occurrence.end));
  }

  /**
   * Accessible name of an event button with the default content. It starts with the visible
   * text: with the time shown, "Team meeting, 10:00 to 11:00, Tuesday 3 March, Room A"; without,
   * the full name "Fair, Thursday 5 March to Friday 6 March, All day". "Repeats" ends the name of a
   * series occurrence.
   */
  protected eventLabel(occurrence: StarSchedulerOccurrence, timeShown: boolean): string {
    if (!timeShown) return this.eventName(occurrence);
    const parts = [
      occurrence.event.title,
      this.timeSpan(occurrence),
      this.dayLabel(occurrence.start),
    ];
    const resource = this.resources().find((r) => sameId(r.id, occurrence.event.resourceId));
    if (resource) parts.push(resource.name);
    if (occurrence.recurring) parts.push(this.text.repeats);
    return parts.join(', ');
  }

  /** Full name: "Team meeting, Tuesday 3 March, 10:00 to 11:00, Room A". */
  protected eventName(occurrence: StarSchedulerOccurrence): string {
    const parts = [
      occurrence.event.title,
      this.whenText(
        occurrence.start,
        occurrence.end,
        !!occurrence.event.allDay,
        occurrence.event.resourceId ?? null,
      ),
    ];
    if (occurrence.recurring) parts.push(this.text.repeats);
    return parts.join(', ');
  }

  /** A timed event of at most one slot shows its title and time on one line. */
  protected isShort(style: Record<string, string | number> | null): boolean {
    const length = style?.['--star-scheduler-length'];
    return (
      typeof length === 'number' && length <= 1 && style?.['--star-scheduler-lane'] === undefined
    );
  }

  protected colorOf(event: StarSchedulerEvent): string | null {
    const color: StarSchedulerColor | undefined =
      event.color ?? this.resources().find((r) => sameId(r.id, event.resourceId))?.color;
    return color ? `var(--star-chart-${color})` : null;
  }

  // Layout helpers used by the template

  protected placed(key: string): readonly Placed[] {
    return this.layout().get(key) ?? [];
  }

  protected timelineLanes(resourceId: StarSchedulerId): number {
    const row = this.resources().findIndex((r) => sameId(r.id, resourceId));
    let lanes = 1;
    for (const [key, items] of this.layout()) {
      if (!key.startsWith(`${row}:`)) continue;
      for (const item of items) {
        lanes = Math.max(lanes, Number(item.style['--star-scheduler-lane']) + 1);
      }
    }
    return lanes;
  }

  protected dayOccurrences(day: Date): StarSchedulerOccurrence[] {
    return this.occurrences().filter((o) => starOccursOn(o, day));
  }

  protected monthCell(day: Date): { shown: StarSchedulerOccurrence[]; more: number } {
    return starMonthCell(this.dayOccurrences(day), this.monthEventLimit());
  }

  protected isWorkSlot(minutes: number): boolean {
    const start = starMinutesOf(this.workDayStart(), 480);
    const end = starMinutesOf(this.workDayEnd(), 1020);
    return minutes >= start && minutes < end;
  }

  protected openMore(event: MouseEvent, day: Date): void {
    event.stopPropagation();
    this.moreAnchor = event.currentTarget as HTMLElement;
    this.moreDay.set(day);
    this.morePopover()?.show(event.currentTarget as HTMLElement);
  }

  // Grid keyboard

  /** Rows of the grid: the all-day row is -1 in the time views. */
  private rowBounds(): [number, number] {
    switch (this.view()) {
      case 'month':
        return [0, this.weeks().length - 1];
      case 'timeline-day':
        return [0, Math.max(0, this.resources().length - 1)];
      default:
        return [ALL_DAY_ROW, this.slots().length - 1];
    }
  }

  private columnCount(): number {
    switch (this.view()) {
      case 'month':
        return 7;
      case 'timeline-day':
        return this.slots().length;
      default:
        return this.days().length;
    }
  }

  protected cellTabIndex(row: number, column: number): number {
    const [r, c] = this.activeCell();
    return r === row && c === column ? 0 : -1;
  }

  /** The active cell, kept inside the grid. */
  private activeCell(): [number, number] {
    const [minRow, maxRow] = this.rowBounds();
    const [row, column] = this.active();
    return [clamp(row, minRow, maxRow), clamp(column, 0, this.columnCount() - 1)];
  }

  protected onGridKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (!target.matches('[data-cell]')) return;
    const [row, column] = this.activeCell();
    const [minRow, maxRow] = this.rowBounds();
    const last = this.columnCount() - 1;
    let next: [number, number];
    switch (starInlineKey(event, this.host)) {
      case 'ArrowUp':
        next = [Math.max(minRow, row - 1), column];
        break;
      case 'ArrowDown':
        next = [Math.min(maxRow, row + 1), column];
        break;
      case 'ArrowLeft':
        next = [row, Math.max(0, column - 1)];
        break;
      case 'ArrowRight':
        next = [row, Math.min(last, column + 1)];
        break;
      case 'Home':
        next = event.ctrlKey ? [minRow, 0] : [row, 0];
        break;
      case 'End':
        next = event.ctrlKey ? [maxRow, last] : [row, last];
        break;
      case 'PageUp':
        event.preventDefault();
        this.page(-1);
        return;
      case 'PageDown':
        event.preventDefault();
        this.page(1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.selectCell(row, column);
        return;
      default:
        return;
    }
    event.preventDefault();
    this.focusCell(next[0], next[1]);
  }

  /** Moves the active cell and the focus. */
  focusCell(row: number, column: number): void {
    this.active.set([row, column]);
    this.host.querySelector<HTMLElement>(`[data-cell="${row}:${column}"]`)?.focus();
  }

  protected onCellClick(event: MouseEvent, row: number, column: number): void {
    if ((event.target as HTMLElement).closest('.star-scheduler__event, .star-scheduler__more')) {
      return;
    }
    this.active.set([row, column]);
    this.selectCell(row, column);
  }

  /** @internal What a cell stands for: its time, and its resource in the timeline. */
  cellTime(row: number, column: number): CellTime | null {
    const view = this.view();
    const step = this.step();
    if (view === 'month') {
      const day = this.days()[row * 7 + column];
      return day ? { start: day, end: addDays(day, 1), allDay: true, resourceId: null } : null;
    }
    if (view === 'timeline-day') {
      const resource = this.resources()[row];
      if (!resource) return null;
      const start = starShiftDate(this.days()[0], 0, column * step);
      return { start, end: starShiftDate(start, 0, step), allDay: false, resourceId: resource.id };
    }
    const day = this.days()[column];
    if (!day) return null;
    if (row === ALL_DAY_ROW) {
      return { start: day, end: addDays(day, 1), allDay: true, resourceId: null };
    }
    const start = starShiftDate(day, 0, row * step);
    return { start, end: starShiftDate(start, 0, step), allDay: false, resourceId: null };
  }

  private selectCell(row: number, column: number): void {
    const cell = this.cellTime(row, column);
    if (!cell) return;
    this.slotSelect.emit({ ...cell });
    if (this.editor() && !this.readonly()) {
      const opener = this.host.querySelector<HTMLElement>(`[data-cell="${row}:${column}"]`);
      this.openEditor(null, opener, {
        title: '',
        start: cell.start,
        end: cell.end,
        allDay: cell.allDay,
        resourceId: cell.resourceId,
      });
    }
  }

  // Events

  protected canChange(occurrence: StarSchedulerOccurrence): boolean {
    return !this.readonly() && !occurrence.event.readonly;
  }

  protected onEventClick(
    event: MouseEvent,
    occurrence: StarSchedulerOccurrence,
    inList: boolean,
  ): void {
    event.stopPropagation();
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    // A pick in the "+N more" list closes it and gives the focus back to its button.
    const popover = this.morePopover();
    const opener = inList ? this.moreAnchor : (event.currentTarget as HTMLElement);
    if (inList) popover?.hide();
    else popover?.hide(false);
    this.selectEvent(occurrence, opener);
  }

  /** The event buttons of the view, in reading order (not the "+N more" list). */
  private eventButtons(): HTMLElement[] {
    return Array.from(
      this.host.querySelectorAll<HTMLElement>(
        '.star-scheduler__grid .star-scheduler__event, .star-scheduler__agenda .star-scheduler__event',
      ),
    );
  }

  /** Gives the view one event tab stop: the active event, else the first one. */
  private keepEventTabStop(): void {
    const buttons = this.eventButtons();
    if (!buttons.length) return;
    const active = this.activeEvent();
    if (active === null || !buttons.some((b) => b.dataset['key'] === active)) {
      this.activeEvent.set(buttons[0].dataset['key'] ?? null);
    }
  }

  private selectEvent(occurrence: StarSchedulerOccurrence, opener: HTMLElement | null): void {
    const original = this.original(occurrence);
    this.eventSelect.emit({ event: original.event, occurrence: original });
    if (this.editor() && this.canChange(original)) {
      this.openEditor(original, opener, {
        title: original.event.title,
        start: original.start,
        end: original.end,
        allDay: !!original.event.allDay,
        resourceId: original.event.resourceId ?? null,
      });
    }
  }

  /** The occurrence without the drag preview. */
  private original(occurrence: StarSchedulerOccurrence): StarSchedulerOccurrence {
    if (this.preview()?.key !== occurrence.key) return occurrence;
    return (
      starSchedulerOccurrences(this.events(), this.range()).find((o) => o.key === occurrence.key) ??
      occurrence
    );
  }

  protected onEventKey(event: KeyboardEvent, occurrence: StarSchedulerOccurrence): void {
    if (!event.key.startsWith('Arrow')) return;
    event.stopPropagation();
    event.preventDefault();
    if (!event.altKey) {
      this.focusNeighbour(event);
      return;
    }
    if (!this.canChange(occurrence)) {
      this.announce(this.text.readOnly);
      return;
    }
    const key = starInlineKey(event, this.host);
    const forward = key === 'ArrowDown' || key === 'ArrowRight';
    const sign = forward ? 1 : -1;
    const vertical = key === 'ArrowUp' || key === 'ArrowDown';
    const view = this.view();
    const step = this.step();
    const allDay = !!occurrence.event.allDay;
    const resourceId = occurrence.event.resourceId ?? null;

    if (event.shiftKey) {
      // Resize: the end moves by one unit, never before the start plus one unit.
      let unit: number;
      if (view === 'month' || allDay) {
        if (vertical) return;
        unit = 1440;
      } else if (view === 'timeline-day') {
        if (vertical) return;
        unit = step;
      } else {
        if (!vertical) return;
        unit = step;
      }
      const end = starShiftDate(occurrence.end, 0, sign * unit);
      const min = starShiftDate(occurrence.start, 0, unit);
      this.commit(occurrence, occurrence.start, end < min ? min : end, resourceId, 'resize');
      return;
    }

    let minutes = 0;
    let target = resourceId;
    if (view === 'month') {
      minutes = (vertical ? 7 : 1) * 1440 * sign;
    } else if (view === 'timeline-day') {
      if (vertical) {
        const resources = this.resources();
        const index = resources.findIndex((r) => sameId(r.id, resourceId));
        const next = resources[clamp(index + sign, 0, resources.length - 1)];
        if (!next || sameId(next.id, resourceId)) return;
        target = next.id;
      } else {
        minutes = sign * step;
      }
    } else if (allDay) {
      if (vertical) return;
      minutes = sign * 1440;
    } else {
      minutes = vertical ? sign * step : sign * 1440;
    }
    const base =
      allDay || view === 'month' ? occurrence.start : starSnapToSlot(occurrence.start, step);
    const start = starShiftDate(base, 0, minutes);
    const end = starShiftDate(start, 0, starWallMinutes(occurrence.start, occurrence.end));
    this.commit(occurrence, start, end, target, 'move');
  }

  /**
   * Arrow keys on an event (without Alt): Right or Down go to the next event of the view, Left or
   * Up to the one before. Past the first or the last event the focus goes to the event's slot.
   * In the "+N more" list they move inside the list.
   */
  private focusNeighbour(event: KeyboardEvent): void {
    const current = event.currentTarget as HTMLElement;
    const list = current.closest('.star-scheduler__more-list');
    const buttons = list
      ? Array.from(list.querySelectorAll<HTMLElement>('.star-scheduler__event'))
      : this.eventButtons();
    const key = starInlineKey(event, this.host);
    const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
    const next = buttons[buttons.indexOf(current) + step];
    if (next) {
      next.focus();
      return;
    }
    const cell = current.closest<HTMLElement>('[data-cell]');
    if (cell && !list) {
      const [row, column] = (cell.dataset['cell'] ?? '0:0').split(':').map(Number);
      this.focusCell(row, column);
    }
  }

  /**
   * Emits `eventChange` and announces the result. Returns `false` when a handler canceled.
   */
  private commit(
    occurrence: StarSchedulerOccurrence,
    start: Date,
    end: Date,
    resourceId: StarSchedulerId | null,
    kind: 'move' | 'resize',
  ): boolean {
    let canceled = false;
    const original = this.original(occurrence);
    this.eventChange.emit({
      event: original.event,
      occurrence: original,
      kind,
      start,
      end,
      resourceId,
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
    const when = this.whenText(start, end, !!original.event.allDay, resourceId);
    this.announce(
      kind === 'move'
        ? this.text.eventMoved(original.event.title, when)
        : this.text.eventResized(original.event.title, when),
    );
    this.pendingFocus = { id: original.event.id, start: start.getTime(), tries: 0 };
    return true;
  }

  /** Puts the focus back on a moved event after `events` changed. */
  private restoreFocus(): void {
    const pending = this.pendingFocus;
    if (!pending) return;
    const doc = this.host.ownerDocument;
    const element = Array.from(
      this.host.querySelectorAll<HTMLElement>('.star-scheduler__event'),
    ).find(
      (e) =>
        e.dataset['eventId'] === String(pending.id) && e.dataset['start'] === String(pending.start),
    );
    if (element) {
      const active = doc.activeElement;
      // Move the focus only when it is still in the scheduler, or was lost with the old button.
      if (!active || active === doc.body || this.host.contains(active)) element.focus();
      this.pendingFocus = null;
    } else if (++pending.tries > 5) {
      this.pendingFocus = null;
    }
  }

  private scrollToWorkDay(): void {
    if (!this.scrollPending) return;
    const scroller = this.host.querySelector<HTMLElement>('.star-scheduler__scroll');
    if (!scroller) return;
    this.scrollPending = false;
    const view = this.view();
    const row = Math.floor(starMinutesOf(this.workDayStart(), 480) / this.step());
    if (view === 'timeline-day') {
      const cell = this.host.querySelector<HTMLElement>(`[data-cell="0:${row}"]`);
      if (cell)
        scroller.scrollLeft =
          cell.offsetLeft -
          (scroller.querySelector<HTMLElement>('.star-scheduler__resource')?.offsetWidth ?? 0);
    } else {
      const cell = this.host.querySelector<HTMLElement>(`[data-cell="${row}:0"]`);
      // The day headers and the all-day row stick to the top and cover the first rows.
      const header = this.host.querySelector<HTMLElement>('.star-scheduler__head');
      const allDay = this.host.querySelector<HTMLElement>('.star-scheduler__time--all-day');
      if (cell) {
        scroller.scrollTop =
          cell.offsetTop - (header?.offsetHeight ?? 0) - (allDay?.offsetHeight ?? 0);
      }
    }
  }

  /**
   * Sets the live region. The same text twice gets a trailing space, so the region changes and a
   * screen reader reads it again.
   */
  private announce(text: string): void {
    this.announcement.update((now) => (now === text ? `${text} ` : text));
  }

  // Pointer drag

  protected onPointerDown(
    event: PointerEvent,
    occurrence: StarSchedulerOccurrence,
    mode: 'move' | 'start' | 'end',
  ): void {
    event.stopPropagation();
    if (event.button !== 0 || !this.canChange(occurrence) || this.drag) return;
    // The slot under the pointer, not the slot where the event starts: a 2-slot event grabbed in
    // its second slot keeps that grab offset while it moves.
    const button = event.currentTarget as HTMLElement;
    const origin =
      this.cellAt(event.clientX, event.clientY) ??
      button.closest<HTMLElement>('[data-cell]')?.dataset['cell'] ??
      null;
    if (!origin) return;
    // The drag state (pointer-events: none on the events) starts only when the pointer leaves the
    // first slot: a held click must still land on the event, not on the slot below it.
    this.drag = { occurrence, mode, origin, moved: false };
    const doc = this.host.ownerDocument;
    const move = (e: PointerEvent) => this.onPointerMove(e);
    const teardown = () => {
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', cancel);
      doc.removeEventListener('keydown', escape, true);
      this.endDrag = null;
    };
    const up = (e: PointerEvent) => {
      teardown();
      this.onPointerUp(e);
    };
    // pointercancel, Escape and destroy drop the drag without a change.
    const cancel = () => {
      teardown();
      if (this.drag?.moved) {
        this.suppressClick = true;
        setTimeout(() => (this.suppressClick = false));
      }
      this.drag = null;
      this.dragging.set(false);
      this.preview.set(null);
    };
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

  /**
   * Key (`row:column`) of the slot under a point, or `null`. All elements at the point are
   * checked, so an event button (or its preview) over the slot does not hide it.
   */
  private cellAt(x: number, y: number): string | null {
    const doc = this.host.ownerDocument;
    if (typeof doc.elementsFromPoint !== 'function') return null;
    const cell = doc
      .elementsFromPoint(x, y)
      .find(
        (element): element is HTMLElement =>
          element instanceof HTMLElement &&
          element.matches('[data-cell]') &&
          this.host.contains(element),
      );
    return cell?.dataset['cell'] ?? null;
  }

  private onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;
    const key = this.cellAt(event.clientX, event.clientY);
    if (!key) return;
    if (key !== drag.origin && !drag.moved) {
      drag.moved = true;
      this.dragging.set(true);
    }
    if (!drag.moved) return;
    this.preview.set(this.dragResult(drag, key));
  }

  private onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    this.drag = null;
    this.dragging.set(false);
    if (!drag) return;
    const key = this.cellAt(event.clientX, event.clientY);
    const result = drag.moved ? (key ? this.dragResult(drag, key) : this.preview()) : null;
    this.preview.set(null);
    if (!drag.moved) return;
    this.suppressClick = true;
    // The click that follows a drag lands on the button; forget the flag if none comes.
    setTimeout(() => (this.suppressClick = false));
    if (!result) return;
    const o = drag.occurrence;
    const resourceId = o.event.resourceId ?? null;
    if (
      +result.start === +o.start &&
      +result.end === +o.end &&
      sameId(result.resourceId, resourceId)
    ) {
      return;
    }
    this.commit(
      o,
      result.start,
      result.end,
      result.resourceId,
      drag.mode === 'move' ? 'move' : 'resize',
    );
  }

  /** New times of a dragged occurrence over the cell `key`. */
  private dragResult(drag: DragState, key: string): Preview | null {
    const parse = (text: string) => text.split(':').map(Number) as [number, number];
    const from = this.cellTime(...parse(drag.origin));
    const to = this.cellTime(...parse(key));
    if (!from || !to) return null;
    const o = drag.occurrence;
    const step = this.step();
    const allDay = !!o.event.allDay;
    // A timed event does not go into the all-day row, and an all-day event stays in it.
    if (this.view() !== 'month' && this.view() !== 'timeline-day' && to.allDay !== allDay) {
      return null;
    }
    const resourceId = to.resourceId ?? o.event.resourceId ?? null;
    if (drag.mode === 'move') {
      const delta = starWallMinutes(from.start, to.start);
      const base = allDay || to.allDay ? o.start : starSnapToSlot(o.start, step);
      const start = starShiftDate(base, 0, delta);
      const end = starShiftDate(start, 0, starWallMinutes(o.start, o.end));
      return {
        key: o.key,
        start,
        end,
        resourceId: this.view() === 'timeline-day' ? resourceId : (o.event.resourceId ?? null),
      };
    }
    if (drag.mode === 'end') {
      const min = starShiftDate(o.start, 0, step);
      const end = to.end < min ? min : to.end;
      return { key: o.key, start: o.start, end, resourceId: o.event.resourceId ?? null };
    }
    const max = starShiftDate(o.end, 0, -step);
    const start = to.start > max ? max : to.start;
    return { key: o.key, start, end: o.end, resourceId: o.event.resourceId ?? null };
  }

  // Editor

  private openEditor(
    occurrence: StarSchedulerOccurrence | null,
    opener: HTMLElement | null,
    value: StarSchedulerEditorValue,
  ): void {
    const data: StarSchedulerEditorData = {
      value,
      isNew: !occurrence,
      canDelete: !!occurrence,
      resources: this.resources(),
      locale: this.locale(),
      hourFormat: this.hourFormat(),
      slotMinutes: this.step(),
    };
    const ref = this.dialogs.open<
      StarSchedulerEditor,
      StarSchedulerEditorData,
      StarSchedulerEditorResult
    >(
      StarSchedulerEditor,
      {
        header: occurrence ? this.text.editEvent : this.text.newEvent,
        data,
        size: 'sm',
      },
      this.injector,
    );
    void ref.closed.then((result) => {
      // The focus goes back to the slot or event that opened the editor, or to the active cell.
      afterNextRender(
        () => {
          const [row, column] = this.activeCell();
          const target = opener?.isConnected
            ? opener
            : this.host.querySelector<HTMLElement>(`[data-cell="${row}:${column}"]`);
          target?.focus();
        },
        { injector: this.injector },
      );
      if (!result) return;
      if (result.action === 'delete' && occurrence) {
        this.eventDelete.emit({ event: occurrence.event, occurrence });
      } else if (result.action === 'save') {
        this.editorSave.emit({ event: occurrence?.event ?? null, occurrence, value: result.value });
      }
    });
  }
}

function format(
  date: Date,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function sameId(
  a: StarSchedulerId | null | undefined,
  b: StarSchedulerId | null | undefined,
): boolean {
  return a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);
}
