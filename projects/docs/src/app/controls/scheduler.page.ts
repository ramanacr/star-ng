import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  StarScheduler,
  StarSchedulerEditorSave,
  StarSchedulerEvent,
  StarSchedulerEventChange,
  StarSchedulerEventSelect,
  StarSchedulerEventTemplate,
  StarSchedulerResource,
  StarSchedulerSlotSelect,
  StarSchedulerView,
} from '@star-ng/ui/scheduler';
import { DOCS, DocsRow } from '../shared/docs';

const at = (d: number, h = 0, min = 0): Date => new Date(2026, 2, d, h, min);

const ROOMS: StarSchedulerResource[] = [
  { id: 'a', name: 'Room A', color: 1 },
  { id: 'b', name: 'Room B', color: 3 },
  { id: 'c', name: 'Room C', color: 7 },
];

/** A team calendar for the week of 2 March 2026. */
function teamEvents(): StarSchedulerEvent[] {
  return [
    {
      id: 1,
      title: 'Stand-up',
      start: at(2, 9),
      end: at(2, 9, 15),
      resourceId: 'a',
      recurrence: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
      exceptions: [at(6)],
    },
    { id: 2, title: 'Team meeting', start: at(3, 10), end: at(3, 11), resourceId: 'a' },
    { id: 3, title: 'Design review', start: at(3, 10, 30), end: at(3, 12), resourceId: 'b' },
    { id: 4, title: 'Budget planning', start: at(4, 13), end: at(4, 15), resourceId: 'c' },
    { id: 5, title: 'Supplier call', start: at(5, 11), end: at(5, 11, 30), resourceId: 'b' },
    { id: 6, title: 'Trade fair', start: at(5), end: at(7), allDay: true, color: 4 },
    {
      id: 7,
      title: 'Quarterly audit',
      start: at(6, 14),
      end: at(6, 16),
      resourceId: 'c',
      readonly: true,
    },
    {
      id: 8,
      title: 'Monthly report',
      start: at(2, 16),
      end: at(2, 17),
      resourceId: 'b',
      recurrence: 'FREQ=MONTHLY;BYDAY=1MO',
      color: 2,
    },
  ];
}

/** A busy month for the month view. */
function monthEvents(): StarSchedulerEvent[] {
  const base = teamEvents();
  const busyDay = ['Order review', 'Invoice check', 'Stock count', 'Training', 'Customer visit'];
  return [
    ...base,
    ...busyDay.map((title, i) => ({
      id: 100 + i,
      title,
      start: at(18, 9 + i),
      end: at(18, 10 + i),
      resourceId: ROOMS[i % 3].id,
    })),
    { id: 120, title: 'Office move', start: at(23), end: at(26), allDay: true, color: 6 as const },
  ];
}

@Component({
  selector: 'docs-scheduler-page',
  imports: [DOCS, StarScheduler, StarSchedulerEventTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .event-room {
      color: var(--star-text);
    }
  `,
  template: `
    <docs-page
      heading="Scheduler"
      lead="Events in a day, week, work-week, month, agenda or timeline view, with recurrence rules (RRULE), drag and drop and full keyboard support. The Kendo UI equivalent is Scheduler, the Syncfusion one is Schedule and the DevExtreme one is Scheduler."
      importFrom="import { StarScheduler } from '@star-ng/ui/scheduler';"
    >
      <docs-example
        heading="Team calendar"
        source="scheduler/team"
        [script]="teamScript"
        note="Drag an event, or its top or bottom edge, to move or resize it; the change snaps to slotMinutes (30). With an event focused, Alt and an arrow key move it, Alt, Shift and an arrow key change its length. The scheduler never changes events: the page applies eventChange. The stand-up repeats every weekday (FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR) except Friday 6 March. Quarterly audit is readonly. A click on an empty slot adds an event."
      >
        <div class="docs-stack">
          <star-scheduler
            [events]="events()"
            [resources]="rooms"
            locale="en-GB"
            [(view)]="view"
            [(date)]="date"
            workDayStart="08:00"
            workDayEnd="18:00"
            ariaLabel="Team calendar"
            (eventChange)="onChange($event)"
            (slotSelect)="onSlot($event)"
            (eventSelect)="onSelect($event)"
          />
          <p class="docs-output" role="status">{{ log() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Month view"
        source="scheduler/month"
        [script]="monthScript"
        note="A full day shows '+N more'; the button opens a list of all events of the day. Arrow keys move between days, Page Up and Page Down change the month."
      >
        <star-scheduler
          [events]="busyMonth"
          [resources]="rooms"
          locale="en-GB"
          view="month"
          [date]="march"
          [views]="['month', 'agenda']"
          ariaLabel="Month of March"
        />
      </docs-example>

      <docs-example
        heading="Rooms on a timeline, with the editor"
        source="scheduler/timeline"
        [script]="timelineScript"
        note="timeline-day shows the resources as rows; it shows only the events whose resourceId is one of the listed resources. With editor, a slot or event opens a dialog with title, start, end, all day and room; the page applies editorSave."
      >
        <star-scheduler
          [events]="roomEvents()"
          [resources]="rooms"
          locale="en-GB"
          view="timeline-day"
          [date]="march3"
          [views]="['timeline-day', 'day']"
          editor
          ariaLabel="Room bookings"
          (editorSave)="onSave($event)"
          (eventChange)="onRoomChange($event)"
          (eventDelete)="onDelete($event)"
        />
      </docs-example>

      <docs-example
        heading="Agenda with an event template"
        source="scheduler/agenda"
        note="The starSchedulerEvent template replaces the content of an event button. The button keeps its accessible name."
      >
        <star-scheduler
          [events]="agendaEvents"
          [resources]="rooms"
          locale="en-GB"
          view="agenda"
          [date]="march2"
          [views]="['agenda', 'week']"
          ariaLabel="Agenda"
        >
          <ng-template starSchedulerEvent let-occurrence>
            <strong>{{ occurrence.event.title }}</strong>
            <span class="event-room">{{ roomName(occurrence.event.resourceId) }}</span>
          </ng-template>
        </star-scheduler>
      </docs-example>

      <h2>Recurrence</h2>
      <p>
        <code>recurrence</code> takes iCalendar RRULE text (RFC 5545): FREQ (DAILY, WEEKLY, MONTHLY,
        YEARLY), INTERVAL, COUNT, UNTIL, BYDAY with ordinals such as <code>2MO</code> or
        <code>-1FR</code>, BYMONTHDAY, BYMONTH and WKST. <code>exceptions</code> removes days. The
        pure functions <code>starParseRrule</code> and <code>starExpandRrule</code> are exported
        too. When the user changes one occurrence, <code>eventChange</code> has
        <code>occurrence.recurring</code>: it is your decision to change the series, or to add an
        exception and a new single event.
      </p>
      <h2>Time zones</h2>
      <p>
        Events are shown in the local time of the browser. There is no time-zone conversion; convert
        the dates before you pass them. Occurrences of a series keep their wall-clock time across a
        change of daylight saving time.
      </p>

      <docs-api
        [of]="['StarScheduler', 'StarSchedulerEventTemplate']"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class SchedulerPage {
  protected readonly rooms = ROOMS;
  protected readonly events = signal<readonly StarSchedulerEvent[]>(teamEvents());
  protected readonly view = signal<StarSchedulerView>('week');
  protected readonly date = signal(at(4));
  protected readonly log = signal('Drag, click or use the keyboard.');
  protected readonly busyMonth = monthEvents();
  protected readonly march = at(1);
  protected readonly march2 = at(2);
  protected readonly march3 = at(3);
  protected readonly agendaEvents = teamEvents();
  protected readonly roomEvents = signal<readonly StarSchedulerEvent[]>(teamEvents());
  private nextId = 1000;

  protected onChange(change: StarSchedulerEventChange): void {
    this.events.update((list) => applyChange(list, change));
    this.log.set(`${change.event.title}: ${change.start.toLocaleString()}`);
  }

  protected onSlot(slot: StarSchedulerSlotSelect): void {
    const id = this.nextId++;
    this.events.update((list) => [
      ...list,
      { id, title: 'New booking', start: slot.start, end: slot.end, allDay: slot.allDay },
    ]);
    this.log.set(`Added "New booking" at ${slot.start.toLocaleString()}`);
  }

  protected onSelect(selected: StarSchedulerEventSelect): void {
    this.log.set(`Selected ${selected.event.title}`);
  }

  protected onSave(save: StarSchedulerEditorSave): void {
    const value = save.value;
    this.roomEvents.update((list) =>
      save.event
        ? list.map((e) => (e.id === save.event!.id ? { ...e, ...value } : e))
        : [...list, { id: this.nextId++, ...value }],
    );
  }

  protected onRoomChange(change: StarSchedulerEventChange): void {
    this.roomEvents.update((list) => applyChange(list, change));
  }

  protected onDelete(deleted: StarSchedulerEventSelect): void {
    this.roomEvents.update((list) => list.filter((e) => e.id !== deleted.event.id));
  }

  protected roomName(id: string | number | null | undefined): string {
    return ROOMS.find((room) => room.id === id)?.name ?? '';
  }

  protected readonly teamScript = `readonly events = signal<readonly StarSchedulerEvent[]>([...]);
readonly view = signal<StarSchedulerView>('week');
readonly date = signal(new Date(2026, 2, 4));

onChange(change: StarSchedulerEventChange) {
  // One occurrence of a series moves the whole series here.
  this.events.update((list) =>
    list.map((e) => {
      if (e.id !== change.event.id) return e;
      const delta = change.start.getTime() - change.occurrence.start.getTime();
      const length = change.end.getTime() - change.start.getTime();
      const start = new Date(e.start.getTime() + delta);
      return { ...e, start, end: new Date(start.getTime() + length), resourceId: change.resourceId };
    }),
  );
}

onSlot(slot: StarSchedulerSlotSelect) {
  this.events.update((list) => [
    ...list,
    { id: crypto.randomUUID(), title: 'New booking', start: slot.start, end: slot.end, allDay: slot.allDay },
  ]);
}`;

  protected readonly monthScript = `readonly busyMonth: StarSchedulerEvent[] = [...];
readonly march = new Date(2026, 2, 1);`;

  protected readonly timelineScript = `onSave(save: StarSchedulerEditorSave) {
  this.roomEvents.update((list) =>
    save.event
      ? list.map((e) => (e.id === save.event!.id ? { ...e, ...save.value } : e))
      : [...list, { id: crypto.randomUUID(), ...save.value }],
  );
}

onDelete(deleted: StarSchedulerEventSelect) {
  this.roomEvents.update((list) => list.filter((e) => e.id !== deleted.event.id));
}`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-scheduler-slot-height', description: 'Height of a time slot (1.75rem).' },
    { name: '--star-scheduler-slot-width', description: 'Width of a timeline slot (3.5rem).' },
    {
      name: '--star-scheduler-height',
      description: 'Largest height of the scrolling grid (36rem).',
    },
    { name: '--star-chart-1 … --star-chart-8', description: 'Event colours (color 1 to 8).' },
    {
      name: '--star-surface-muted',
      description: 'Slots outside the work day, days of other months.',
    },
  ];

  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow keys',
      description: 'Move between slots or days (left and right mirror in RTL).',
    },
    {
      name: 'Home / End',
      description: 'First or last cell of the row; with Control, of the grid.',
    },
    { name: 'Page Up / Page Down', description: 'Previous or next day, week or month.' },
    {
      name: 'Enter / Space',
      description: 'On a cell: slotSelect (and the editor). On an event: eventSelect.',
    },
    { name: 'Alt + arrow keys', description: 'Move the focused event by one slot or day.' },
    { name: 'Alt + Shift + arrow keys', description: 'Make the focused event longer or shorter.' },
    { name: 'Tab', description: 'From the grid to the events: the events are one tab stop.' },
    {
      name: 'Arrow keys on an event',
      description: 'Next or previous event of the view; past the first or last one, its slot.',
    },
  ];
}

/** Moves the event, or the whole series of a recurring occurrence, as the change says. */
function applyChange(
  list: readonly StarSchedulerEvent[],
  change: StarSchedulerEventChange,
): StarSchedulerEvent[] {
  return list.map((e) => {
    if (e.id !== change.event.id) return e;
    const delta = change.start.getTime() - change.occurrence.start.getTime();
    const length = change.end.getTime() - change.start.getTime();
    const start = new Date(e.start.getTime() + delta);
    return {
      ...e,
      start,
      end: new Date(start.getTime() + length),
      resourceId: change.resourceId,
    };
  });
}
