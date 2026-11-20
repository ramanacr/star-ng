import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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

// jsdom has no HTMLDialogElement methods. Minimal stand-ins (real browsers implement these).
const dialogProto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
dialogProto.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
dialogProto.close ??= function (this: HTMLDialogElement) {
  if (!this.hasAttribute('open')) return;
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};

const at = (y: number, m: number, d: number, h = 0, min = 0): Date => new Date(y, m - 1, d, h, min);

const ROOMS: StarSchedulerResource[] = [
  { id: 'a', name: 'Room A', color: 1 },
  { id: 'b', name: 'Room B', color: 3 },
];

const EVENTS: StarSchedulerEvent[] = [
  {
    id: 'meeting',
    title: 'Team meeting',
    start: at(2026, 3, 3, 10),
    end: at(2026, 3, 3, 11),
    resourceId: 'a',
  },
  {
    id: 'review',
    title: 'Design review',
    start: at(2026, 3, 3, 10, 30),
    end: at(2026, 3, 3, 12),
    resourceId: 'b',
    color: 5,
  },
  {
    id: 'standup',
    title: 'Stand-up',
    start: at(2026, 3, 2, 9),
    end: at(2026, 3, 2, 9, 15),
    recurrence: 'FREQ=DAILY;COUNT=3',
    resourceId: 'a',
  },
  { id: 'fair', title: 'Fair', start: at(2026, 3, 5), end: at(2026, 3, 7), allDay: true },
  {
    id: 'locked',
    title: 'Audit',
    start: at(2026, 3, 6, 14),
    end: at(2026, 3, 6, 15),
    readonly: true,
  },
];

@Component({
  imports: [StarScheduler, StarSchedulerEventTemplate],
  template: `
    <div [attr.dir]="dir()">
      <star-scheduler
        [events]="events()"
        [resources]="rooms"
        [(view)]="view"
        [(date)]="date"
        locale="en-GB"
        [firstDayOfWeek]="1"
        [editor]="editor()"
        [monthEventLimit]="3"
        (slotSelect)="slots.push($event)"
        (eventSelect)="selected.push($event)"
        (eventChange)="onChange($event)"
        (editorSave)="saved.push($event)"
      >
        @if (custom()) {
          <ng-template starSchedulerEvent let-occurrence let-time="time">
            <em class="custom">{{ occurrence.event.title }} ({{ time }})</em>
          </ng-template>
        }
      </star-scheduler>
    </div>
  `,
})
class Host {
  readonly scheduler = viewChild.required(StarScheduler);
  readonly rooms = ROOMS;
  readonly events = signal<readonly StarSchedulerEvent[]>(EVENTS);
  readonly view = signal<StarSchedulerView>('week');
  readonly date = signal(at(2026, 3, 4));
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly editor = signal(false);
  readonly custom = signal(false);
  cancel = false;
  apply = false;
  readonly slots: StarSchedulerSlotSelect[] = [];
  readonly selected: StarSchedulerEventSelect[] = [];
  readonly changes: StarSchedulerEventChange[] = [];
  readonly saved: StarSchedulerEditorSave[] = [];

  onChange(change: StarSchedulerEventChange): void {
    this.changes.push(change);
    if (this.cancel) change.cancel();
    else if (this.apply) {
      this.events.update((list) =>
        list.map((e) =>
          e.id === change.event.id
            ? { ...e, start: change.start, end: change.end, resourceId: change.resourceId }
            : e,
        ),
      );
    }
  }
}

/** The accessible name of an event button: its aria-label, else its text. */
const nameOf = (element: Element | null | undefined): string =>
  element?.getAttribute('aria-label') ??
  (element?.textContent ?? '').replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();

function key(target: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

async function setup(configure?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  configure?.(fixture.componentInstance);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const scheduler = root.querySelector<HTMLElement>('star-scheduler')!;
  const stable = () => fixture.whenStable();
  const event = (title: string, nth = 0) =>
    [...scheduler.querySelectorAll<HTMLElement>('.star-scheduler__event')].filter((e) =>
      nameOf(e).startsWith(title),
    )[nth];
  const cell = (row: number, column: number) =>
    scheduler.querySelector<HTMLElement>(`[data-cell="${row}:${column}"]`)!;
  const live = () =>
    scheduler.querySelector('[aria-live="polite"].star-sr-only')?.textContent?.trim();
  const button = (name: string) =>
    [...scheduler.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name,
    )!;
  return { fixture, root, host, scheduler, stable, event, cell, live, button };
}

describe('StarScheduler', () => {
  afterEach(() => {
    document.querySelectorAll('dialog').forEach((d) => d.remove());
  });

  describe('week view', () => {
    it('is a grid with a column per day, an all-day row and a row per slot', async () => {
      const { scheduler } = await setup();
      const grid = scheduler.querySelector('[role="grid"]')!;
      const heads = [...grid.querySelectorAll('[role="columnheader"]')].slice(1);
      expect(heads.map((h) => h.querySelector('.star-sr-only')?.textContent)).toEqual([
        'Monday 2 March',
        'Tuesday 3 March',
        'Wednesday 4 March',
        'Thursday 5 March',
        'Friday 6 March',
        'Saturday 7 March',
        'Sunday 8 March',
      ]);
      // Header row, all-day row and 48 slots of 30 minutes.
      expect(grid.querySelectorAll('[role="row"]')).toHaveLength(50);
      expect(grid.querySelectorAll('[role="rowheader"]')[1].textContent?.trim()).toBe('00:00');
      expect(scheduler.querySelector('h2')?.textContent).toContain('2');
      expect(scheduler.querySelector('h2')?.textContent).toContain('8 March 2026');
      expect(scheduler.getAttribute('aria-label')).toBe('Scheduler');
    });

    it('names an event with title, day, time span and resource', async () => {
      const { event } = await setup();
      // The visible title and time come first, so the visible text is part of the name.
      expect(nameOf(event('Team meeting'))).toBe(
        'Team meeting, 10:00 to 11:00, Tuesday 3 March, Room A',
      );
      expect(nameOf(event('Stand-up'))).toBe(
        'Stand-up, 09:00 to 09:15, Monday 2 March, Room A, Repeats',
      );
      expect(nameOf(event('Fair'))).toBe('Fair, Thursday 5 March to Friday 6 March, All day');
      // The visible text is the start of the name, and no hidden text is in the button.
      expect(event('Team meeting').querySelector('.star-sr-only')).toBeNull();
      // The title and the time read as one phrase: "Team meeting 10:00 to 11:00".
      expect(event('Team meeting').textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Team meeting 10:00 to 11:00',
      );
    });

    it('lays overlapping events out side by side', async () => {
      const { event } = await setup();
      const meeting = event('Team meeting');
      const review = event('Design review');
      expect(meeting.style.getPropertyValue('--star-scheduler-columns')).toBe('2');
      expect(review.style.getPropertyValue('--star-scheduler-columns')).toBe('2');
      expect(meeting.style.getPropertyValue('--star-scheduler-column')).toBe('0');
      expect(review.style.getPropertyValue('--star-scheduler-column')).toBe('1');
      // 10:30 to 12:00 starts in the 10:30 slot (row 21) and is three slots long.
      expect(review.closest('[data-cell]')?.getAttribute('data-cell')).toBe('21:1');
      expect(review.style.getPropertyValue('--star-scheduler-length')).toBe('3');
    });

    it('expands recurring events and puts all-day events in the all-day row', async () => {
      const { scheduler, event } = await setup();
      const standups = [...scheduler.querySelectorAll('.star-scheduler__event')].filter((e) =>
        nameOf(e).startsWith('Stand-up'),
      );
      expect(standups).toHaveLength(3);
      const fair = event('Fair');
      expect(fair.closest('[data-cell]')?.getAttribute('data-cell')).toBe('-1:3');
      expect(fair.style.getPropertyValue('--star-scheduler-span')).toBe('2');
    });

    it('colours an event from its colour or its resource', async () => {
      const { event } = await setup();
      expect(event('Design review').style.getPropertyValue('--star-scheduler-event-color')).toBe(
        'var(--star-chart-5)',
      );
      expect(event('Team meeting').style.getPropertyValue('--star-scheduler-event-color')).toBe(
        'var(--star-chart-1)',
      );
    });

    it('renders the event template', async () => {
      const { event } = await setup((h) => h.custom.set(true));
      expect(event('Team meeting').querySelector('.custom')?.textContent).toBe(
        'Team meeting (10:00 – 11:00)',
      );
    });
  });

  describe('visible text of an event (guard of the name check)', () => {
    it('reads "title time" with a space, in a long and in a short event', async () => {
      const { event } = await setup();
      const text = (e: HTMLElement) => e.textContent?.replace(/\s+/g, ' ').trim();
      expect(text(event('Team meeting'))).toBe('Team meeting 10:00 to 11:00');
      expect(text(event('Stand-up'))).toBe('Stand-up 09:00 to 09:15');
      // The aria-label starts with the same words, so the visible text is part of the name.
      const words = (value: string | null | undefined) =>
        (value ?? '')
          .replace(/[^\p{L}\p{N} ]/gu, '')
          .replace(/\s+/g, ' ')
          .toLowerCase();
      for (const title of ['Team meeting', 'Stand-up']) {
        expect(words(event(title).getAttribute('aria-label'))).toContain(words(text(event(title))));
      }
    });
  });

  describe('slots and keyboard', () => {
    it('emits slotSelect for a click on an empty slot', async () => {
      const { host, cell } = await setup();
      cell(28, 2).click();
      expect(host.slots).toEqual([
        { start: at(2026, 3, 4, 14), end: at(2026, 3, 4, 14, 30), allDay: false, resourceId: null },
      ]);
      cell(-1, 0).click();
      expect(host.slots[1]).toMatchObject({
        start: at(2026, 3, 2),
        end: at(2026, 3, 3),
        allDay: true,
      });
    });

    it('moves the active cell with the arrow keys and selects it with Enter', async () => {
      const { host, cell, stable, fixture } = await setup();
      fixture.componentInstance.scheduler().focusCell(20, 1);
      await stable();
      expect(document.activeElement).toBe(cell(20, 1));
      key(cell(20, 1), 'ArrowDown');
      await stable();
      expect(document.activeElement).toBe(cell(21, 1));
      key(cell(21, 1), 'ArrowRight');
      await stable();
      expect(document.activeElement).toBe(cell(21, 2));
      expect(cell(21, 2).tabIndex).toBe(0);
      expect(cell(20, 1).tabIndex).toBe(-1);
      key(cell(21, 2), 'Enter');
      expect(host.slots.at(-1)?.start).toEqual(at(2026, 3, 4, 10, 30));
      key(cell(21, 2), 'Home');
      await stable();
      expect(document.activeElement).toBe(cell(21, 0));
    });

    it('mirrors the left and right keys in right-to-left', async () => {
      const { cell, stable, fixture } = await setup((h) => h.dir.set('rtl'));
      fixture.componentInstance.scheduler().focusCell(5, 3);
      key(cell(5, 3), 'ArrowLeft');
      await stable();
      expect(document.activeElement).toBe(cell(5, 4));
    });

    it('selects an event with a click', async () => {
      const { host, event } = await setup();
      event('Team meeting').click();
      expect(host.selected).toHaveLength(1);
      expect(host.selected[0].event.id).toBe('meeting');
      expect(host.slots).toHaveLength(0);
    });
  });

  describe('event focus', () => {
    it('gives the events of a view one tab stop', async () => {
      const { scheduler, event, stable } = await setup();
      const stops = () =>
        [
          ...scheduler.querySelectorAll<HTMLElement>(
            '.star-scheduler__grid .star-scheduler__event',
          ),
        ].filter((e) => e.tabIndex === 0);
      expect(stops()).toHaveLength(1);
      event('Team meeting').focus();
      await stable();
      expect(stops()).toEqual([event('Team meeting')]);
    });

    it('moves to the next and the previous event with the arrow keys, then to the slot', async () => {
      const { scheduler, event, cell, stable } = await setup();
      const buttons = [
        ...scheduler.querySelectorAll<HTMLElement>('.star-scheduler__grid .star-scheduler__event'),
      ];
      buttons[1].focus();
      key(buttons[1], 'ArrowRight');
      await stable();
      expect(document.activeElement).toBe(buttons[2]);
      key(buttons[2], 'ArrowUp');
      expect(document.activeElement).toBe(buttons[1]);
      const last = buttons.at(-1)!;
      last.focus();
      key(last, 'ArrowDown');
      await stable();
      const slot = last.closest<HTMLElement>('[data-cell]')!;
      expect(document.activeElement).toBe(slot);
      expect(event('Team meeting')).toBeTruthy();
      expect(cell(0, 0)).toBeTruthy();
    });
  });

  describe('keyboard move and resize', () => {
    it('moves a focused event by one slot with Alt+arrow and announces it', async () => {
      const { host, event, live, stable } = await setup();
      key(event('Team meeting'), 'ArrowDown', { altKey: true });
      await stable();
      expect(host.changes).toHaveLength(1);
      expect(host.changes[0]).toMatchObject({
        kind: 'move',
        start: at(2026, 3, 3, 10, 30),
        end: at(2026, 3, 3, 11, 30),
        resourceId: 'a',
      });
      expect(live()).toBe('Team meeting moved to Tuesday 3 March, 10:30 to 11:30, Room A');
      key(event('Team meeting'), 'ArrowRight', { altKey: true });
      expect(host.changes[1].start).toEqual(at(2026, 3, 4, 10));
    });

    it('snaps an off-grid start to the slot', async () => {
      const { host, event, stable } = await setup((h) =>
        h.events.set([
          { id: 1, title: 'Call', start: at(2026, 3, 3, 10, 10), end: at(2026, 3, 3, 10, 40) },
        ]),
      );
      key(event('Call'), 'ArrowDown', { altKey: true });
      await stable();
      expect(host.changes[0].start).toEqual(at(2026, 3, 3, 10, 30));
      expect(host.changes[0].end).toEqual(at(2026, 3, 3, 11));
    });

    it('resizes with Alt+Shift+arrow, never below one slot', async () => {
      const { host, event } = await setup();
      key(event('Team meeting'), 'ArrowDown', { altKey: true, shiftKey: true });
      expect(host.changes[0]).toMatchObject({ kind: 'resize', end: at(2026, 3, 3, 11, 30) });
      key(event('Team meeting'), 'ArrowUp', { altKey: true, shiftKey: true });
      key(event('Team meeting'), 'ArrowUp', { altKey: true, shiftKey: true });
      expect(host.changes[1].end).toEqual(at(2026, 3, 3, 10, 30));
    });

    it('mirrors Alt+left and right in right-to-left', async () => {
      const { host, event } = await setup((h) => h.dir.set('rtl'));
      key(event('Team meeting'), 'ArrowRight', { altKey: true });
      expect(host.changes[0].start).toEqual(at(2026, 3, 2, 10));
    });

    it('announces a canceled change and keeps the events', async () => {
      const { host, event, live, stable } = await setup((h) => (h.cancel = true));
      key(event('Team meeting'), 'ArrowDown', { altKey: true });
      await stable();
      expect(host.changes[0].canceled).toBe(true);
      expect(live()).toBe('Change canceled');
      expect(nameOf(event('Team meeting'))).toContain('10:00 to 11:00');
    });

    it('keeps the focus on the event after the owner applied the move', async () => {
      const { event, stable } = await setup((h) => (h.apply = true));
      event('Stand-up', 1).focus();
      key(event('Stand-up', 1), 'ArrowDown', { altKey: true });
      await stable();
      await stable();
      expect(nameOf(document.activeElement)).toBe(
        'Stand-up, 09:30 to 09:45, Tuesday 3 March, Room A, Repeats',
      );
    });

    it('does not move a readonly event, and says so', async () => {
      const { host, event, live, stable, scheduler } = await setup();
      key(event('Audit'), 'ArrowDown', { altKey: true });
      await stable();
      expect(host.changes).toHaveLength(0);
      expect(live()).toBe('Read only');
      // The same message again still changes the live region, so it is read again.
      const region = () =>
        scheduler.querySelector('[aria-live="polite"].star-sr-only')!.textContent;
      const first = region();
      key(event('Audit'), 'ArrowDown', { altKey: true });
      await stable();
      expect(region()).not.toBe(first);
      expect(region()?.trim()).toBe('Read only');
      expect(event('Audit').hasAttribute('aria-describedby')).toBe(false);
      expect(event('Team meeting').getAttribute('aria-describedby')).toMatch(/hint/);
    });

    it('marks the change of a series occurrence as recurring', async () => {
      const { host, event } = await setup();
      key(event('Stand-up', 2), 'ArrowDown', { altKey: true });
      expect(host.changes[0].occurrence.recurring).toBe(true);
      expect(host.changes[0].occurrence.start).toEqual(at(2026, 3, 4, 9));
      expect(host.changes[0].start).toEqual(at(2026, 3, 4, 9, 30));
    });
  });

  describe('pointer drag', () => {
    // jsdom has no layout. The stubs give what a browser gives: the elements at the point from the
    // top, an event button (`over`) above the slot (`under`). The slot must be found below it.
    const doc = document as Document & {
      elementsFromPoint?: (x: number, y: number) => Element[];
    };
    let originalAll: typeof doc.elementsFromPoint;
    let originalOne: typeof document.elementFromPoint;
    let under: HTMLElement | null = null;
    let over: HTMLElement | null = null;
    beforeEach(() => {
      originalAll = doc.elementsFromPoint;
      originalOne = document.elementFromPoint;
      doc.elementsFromPoint = () =>
        [over, under].filter(
          (e): e is HTMLElement =>
            !!e && !e.closest('.star-scheduler--dragging .star-scheduler__event'),
        );
      document.elementFromPoint = () => over ?? under;
    });
    afterEach(() => {
      doc.elementsFromPoint = originalAll;
      document.elementFromPoint = originalOne;
      over = null;
    });

    const pointer = (target: EventTarget, type: string) =>
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 1,
          clientY: 1,
        }),
      );

    it('moves an event to the slot under the pointer, with a preview while dragging', async () => {
      const { host, event, cell, stable } = await setup();
      over = event('Team meeting');
      under = cell(20, 1);
      pointer(event('Team meeting'), 'pointerdown');
      under = cell(24, 2);
      pointer(document, 'pointermove');
      await stable();
      // The preview shows the event at its new place (Wednesday 12:00).
      expect(event('Team meeting').closest('[data-cell]')?.getAttribute('data-cell')).toBe('24:2');
      pointer(document, 'pointerup');
      await stable();
      expect(host.changes[0]).toMatchObject({
        kind: 'move',
        start: at(2026, 3, 4, 12),
        end: at(2026, 3, 4, 13),
      });
      // Without an update from the owner the event is back at its place.
      expect(event('Team meeting').closest('[data-cell]')?.getAttribute('data-cell')).toBe('20:1');
      // The click after the drag does not select the event.
      event('Team meeting').click();
      expect(host.selected).toHaveLength(0);
    });

    it('keeps the grab offset: a 2-slot event grabbed in its second slot moves by one slot', async () => {
      const { host, event, cell, scheduler, stable } = await setup();
      // The pointer is on the event, over its second slot (10:30).
      over = event('Team meeting');
      under = cell(21, 1);
      pointer(over, 'pointerdown');
      await stable();
      // Not a drag yet: a click must still reach the event.
      expect(scheduler.classList).not.toContain('star-scheduler--dragging');
      under = cell(22, 1);
      pointer(document, 'pointermove');
      await stable();
      expect(scheduler.classList).toContain('star-scheduler--dragging');
      pointer(document, 'pointerup');
      await stable();
      expect(host.changes[0]).toMatchObject({
        kind: 'move',
        start: at(2026, 3, 3, 10, 30),
        end: at(2026, 3, 3, 11, 30),
      });
      expect(scheduler.classList).not.toContain('star-scheduler--dragging');
    });

    it('resizes from the end handle, snapped to the slot', async () => {
      const { host, event, cell } = await setup();
      under = cell(21, 1);
      pointer(event('Team meeting').querySelector('.star-scheduler__handle--end')!, 'pointerdown');
      under = cell(24, 1);
      pointer(document, 'pointermove');
      pointer(document, 'pointerup');
      expect(host.changes[0]).toMatchObject({
        kind: 'resize',
        start: at(2026, 3, 3, 10),
        end: at(2026, 3, 3, 12, 30),
      });
    });

    it('resizes from the start handle and keeps one slot', async () => {
      const { host, event, cell } = await setup();
      under = cell(20, 1);
      pointer(
        event('Team meeting').querySelector('.star-scheduler__handle--start')!,
        'pointerdown',
      );
      under = cell(23, 1);
      pointer(document, 'pointermove');
      pointer(document, 'pointerup');
      expect(host.changes[0]).toMatchObject({
        start: at(2026, 3, 3, 10, 30),
        end: at(2026, 3, 3, 11),
      });
    });

    it('drops the drag on Escape, without a change', async () => {
      const { host, event, cell, stable } = await setup();
      under = cell(20, 1);
      pointer(event('Team meeting'), 'pointerdown');
      under = cell(24, 1);
      pointer(document, 'pointermove');
      await stable();
      expect(event('Team meeting').closest('[data-cell]')?.getAttribute('data-cell')).toBe('24:1');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await stable();
      expect(event('Team meeting').closest('[data-cell]')?.getAttribute('data-cell')).toBe('20:1');
      pointer(document, 'pointerup');
      expect(host.changes).toHaveLength(0);
    });

    it('removes the drag listeners when the scheduler is destroyed', async () => {
      const { host, event, cell, fixture } = await setup();
      const removed = vi.spyOn(document, 'removeEventListener');
      under = cell(20, 1);
      pointer(event('Team meeting'), 'pointerdown');
      fixture.destroy();
      expect(removed.mock.calls.map((c) => c[0])).toEqual(
        expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel', 'keydown']),
      );
      pointer(document, 'pointerup');
      expect(host.changes).toHaveLength(0);
      removed.mockRestore();
    });

    it('selects an editable event on a held click: no drag state before the pointer moves', async () => {
      const { host, event, cell, scheduler, stable } = await setup((h) => h.editor.set(true));
      over = event('Team meeting');
      under = cell(20, 1);
      pointer(over, 'pointerdown');
      await stable();
      // The pointer is held in place: the event keeps its pointer events.
      expect(scheduler.classList).not.toContain('star-scheduler--dragging');
      pointer(document, 'pointermove');
      await stable();
      expect(scheduler.classList).not.toContain('star-scheduler--dragging');
      pointer(over, 'pointerup');
      over.click();
      await stable();
      for (let i = 0; i < 3; i++) {
        TestBed.tick();
        await Promise.resolve();
      }
      expect(host.selected.map((s) => s.event.id)).toEqual(['meeting']);
      expect(host.slots).toHaveLength(0);
      const dialog = document.querySelector('dialog')!;
      expect(dialog.textContent).toContain('Edit event');
      expect(dialog.textContent).not.toContain('New event');
    });

    it('does nothing when the pointer stays in the same cell', async () => {
      const { host, event, cell } = await setup();
      under = cell(20, 1);
      pointer(event('Team meeting'), 'pointerdown');
      pointer(document, 'pointermove');
      pointer(document, 'pointerup');
      expect(host.changes).toHaveLength(0);
    });
  });

  describe('month view', () => {
    const busy = (): StarSchedulerEvent[] =>
      Array.from({ length: 5 }, (_, i) => ({
        id: i,
        title: `Order review ${i + 1}`,
        start: at(2026, 3, 10, 9 + i),
        end: at(2026, 3, 10, 10 + i),
      }));

    it('shows six weeks and "+N more" in a full cell, which opens the list of the day', async () => {
      const { scheduler, stable, button } = await setup((h) => {
        h.view.set('month');
        h.events.set(busy());
      });
      const grid = scheduler.querySelector('[role="grid"]')!;
      expect(grid.querySelectorAll('[role="gridcell"]')).toHaveLength(42);
      expect(scheduler.querySelector('h2')?.textContent).toBe('March 2026');
      const more = button('+3 more');
      expect(more).toBeTruthy();
      expect(
        more.closest('[role="gridcell"]')?.querySelectorAll('.star-scheduler__event'),
      ).toHaveLength(2);
      more.click();
      await stable();
      const popover = document.querySelector('.star-popover')!;
      expect(popover.getAttribute('aria-label')).toBe('Tuesday 10 March');
      const listed = popover.querySelectorAll<HTMLElement>('.star-scheduler__event');
      expect(listed).toHaveLength(5);
      // Every entry of the list is in the tab order of the list.
      expect([...listed].every((e) => e.tabIndex === 0)).toBe(true);
      // A pick closes the list and gives the focus back to its button.
      listed[2].focus();
      listed[2].click();
      await stable();
      expect(document.querySelector('.star-popover')).toBeNull();
      expect(document.activeElement).toBe(more);
    });

    it('moves an event by a week with Alt+arrow down', async () => {
      const { host, event } = await setup((h) => h.view.set('month'));
      key(event('Team meeting'), 'ArrowDown', { altKey: true });
      expect(host.changes[0].start).toEqual(at(2026, 3, 10, 10));
    });

    it('selects a whole day from a cell', async () => {
      const { host, cell } = await setup((h) => h.view.set('month'));
      cell(1, 2).click();
      expect(host.slots[0]).toEqual({
        start: at(2026, 3, 4),
        end: at(2026, 3, 5),
        allDay: true,
        resourceId: null,
      });
    });
  });

  describe('other views and navigation', () => {
    it('pages, goes to today and switches the view', async () => {
      const { host, button, stable, scheduler } = await setup();
      button('Next').click();
      await stable();
      expect(host.date()).toEqual(at(2026, 3, 11));
      button('Previous').click();
      button('Previous').click();
      await stable();
      expect(host.date()).toEqual(at(2026, 2, 25));
      button('Day').click();
      await stable();
      expect(host.view()).toBe('day');
      expect(button('Day').getAttribute('aria-pressed')).toBe('true');
      expect(scheduler.querySelector('h2')?.textContent).toBe('Wednesday, 25 February 2026');
      button('Today').click();
      await stable();
      const today = new Date();
      expect(host.date().getDate()).toBe(today.getDate());
    });

    it('shows the resources as rows in the timeline view', async () => {
      const { scheduler, host, event, stable } = await setup((h) => {
        h.view.set('timeline-day');
        h.date.set(at(2026, 3, 3));
      });
      const rows = [...scheduler.querySelectorAll('[role="rowheader"]')].map((r) =>
        r.textContent?.trim(),
      );
      expect(rows).toEqual(['Room A', 'Room B']);
      expect(event('Team meeting').closest('[data-cell]')?.getAttribute('data-cell')).toBe('0:20');
      expect(event('Design review').closest('[data-cell]')?.getAttribute('data-cell')).toBe('1:21');
      key(event('Team meeting'), 'ArrowDown', { altKey: true });
      await stable();
      expect(host.changes[0]).toMatchObject({ resourceId: 'b', start: at(2026, 3, 3, 10) });
      key(event('Team meeting'), 'ArrowRight', { altKey: true });
      expect(host.changes[1]).toMatchObject({ resourceId: 'a', start: at(2026, 3, 3, 10, 30) });
    });

    it('offers the timeline only with resources', async () => {
      const { button } = await setup();
      expect(button('Timeline')).toBeTruthy();
    });

    it('lists the days with events in the agenda view', async () => {
      const { scheduler } = await setup((h) => {
        h.view.set('agenda');
        h.date.set(at(2026, 3, 2));
      });
      const days = [...scheduler.querySelectorAll('.star-scheduler__agenda-date')].map((d) =>
        d.textContent?.trim(),
      );
      expect(days).toEqual([
        'Monday 2 March',
        'Tuesday 3 March',
        'Wednesday 4 March',
        'Thursday 5 March',
        'Friday 6 March',
      ]);
    });

    it('shows "No events" in an empty agenda', async () => {
      const { scheduler } = await setup((h) => {
        h.view.set('agenda');
        h.events.set([]);
      });
      expect(scheduler.querySelector('.star-scheduler__empty')?.textContent).toBe('No events');
    });
  });

  describe('editor', () => {
    it('opens the editor on a slot and emits editorSave', async () => {
      const { host, cell, stable } = await setup((h) => h.editor.set(true));
      cell(28, 2).click();
      await stable();
      const dialog = document.querySelector('dialog')!;
      expect(dialog.textContent).toContain('New event');
      const title = dialog.querySelector<HTMLInputElement>('input[starInput]')!;
      title.value = 'Budget review';
      title.dispatchEvent(new Event('input'));
      await stable();
      dialog.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      for (let i = 0; i < 4; i++) {
        TestBed.tick();
        await Promise.resolve();
      }
      expect(host.saved).toHaveLength(1);
      expect(host.saved[0].event).toBeNull();
      // The focus goes back to the slot that opened the editor.
      expect(document.activeElement).toBe(cell(28, 2));
      expect(host.saved[0].value).toMatchObject({
        title: 'Budget review',
        start: at(2026, 3, 4, 14),
        end: at(2026, 3, 4, 14, 30),
        allDay: false,
      });
    });
  });

  describe('current time', () => {
    it('runs the minute timer only while a time view is shown', async () => {
      const set = vi.spyOn(window, 'setInterval');
      const clear = vi.spyOn(window, 'clearInterval');
      const { host, stable } = await setup();
      await stable();
      const minute = () => set.mock.calls.filter((c) => c[1] === 60_000).length;
      expect(minute()).toBe(1);
      host.view.set('month');
      await stable();
      expect(clear).toHaveBeenCalled();
      expect(minute()).toBe(1);
      host.view.set('agenda');
      await stable();
      expect(minute()).toBe(1);
      host.view.set('day');
      await stable();
      expect(minute()).toBe(2);
      set.mockRestore();
      clear.mockRestore();
    });
  });

  describe('server rendering', () => {
    it('renders on the server platform without the current-time line', async () => {
      TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
      const { scheduler } = await setup();
      expect(scheduler.querySelector('[role="grid"]')).not.toBeNull();
      expect(scheduler.querySelector('.star-scheduler__now')).toBeNull();
    });
  });
});
