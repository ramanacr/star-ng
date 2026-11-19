import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarGantt,
  StarGanttId,
  StarGanttScale,
  StarGanttTask,
  StarGanttTaskChange,
  StarGanttTaskSelect,
} from '@star-ng/ui/gantt';

const at = (m: number, d: number): Date => new Date(2026, m - 1, d);

const PLAN: StarGanttTask[] = [
  { id: 'research', name: 'Research', start: at(3, 2), end: at(3, 7), progress: 100 },
  {
    id: 'design',
    name: 'Design',
    start: at(3, 3),
    end: at(3, 15),
    progress: 40,
    dependencies: [{ from: 'research', type: 'FS' }],
    color: 3,
  },
  { id: 'build', name: 'Build', start: at(3, 1), end: at(3, 1) },
  {
    id: 'frontend',
    name: 'Frontend',
    start: at(3, 16),
    end: at(3, 21),
    progress: 20,
    parentId: 'build',
    dependencies: [{ from: 'design', type: 'FS' }],
  },
  {
    id: 'backend',
    name: 'Backend',
    start: at(3, 16),
    end: at(3, 28),
    progress: 0,
    parentId: 'build',
    dependencies: [{ from: 'design', type: 'SS' }],
  },
  {
    id: 'launch',
    name: 'Launch',
    start: at(3, 30),
    end: at(3, 30),
    milestone: true,
    dependencies: [{ from: 'backend', type: 'FS' }],
  },
];

@Component({
  imports: [StarGantt],
  template: `
    <div [attr.dir]="dir()">
      <star-gantt
        [tasks]="tasks()"
        [(scale)]="scale"
        [(collapsed)]="collapsed"
        [readonly]="readonly()"
        locale="en-GB"
        [firstDayOfWeek]="1"
        (taskChange)="onChange($event)"
        (taskSelect)="selected.push($event)"
      />
    </div>
  `,
})
class Host {
  readonly gantt = viewChild.required(StarGantt);
  readonly tasks = signal<readonly StarGanttTask[]>(PLAN);
  readonly scale = signal<StarGanttScale>('week');
  readonly collapsed = signal<readonly StarGanttId[]>([]);
  readonly readonly = signal(false);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  cancel = false;
  readonly changes: StarGanttTaskChange[] = [];
  readonly selected: StarGanttTaskSelect[] = [];

  onChange(change: StarGanttTaskChange): void {
    this.changes.push(change);
    if (this.cancel) change.cancel();
  }
}

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

const pointer = (target: EventTarget, type: string, clientX: number) =>
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY: 5 }),
  );

async function setup(configure?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  configure?.(fixture.componentInstance);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const gantt = root.querySelector<HTMLElement>('star-gantt')!;
  const stable = () => fixture.whenStable();
  const row = (id: string) =>
    gantt.querySelector<HTMLElement>(`[role="row"][data-task-id="${id}"]`)!;
  const bar = (id: string) => gantt.querySelector<SVGGElement>(`g[data-task-id="${id}"]`)!;
  const live = () => gantt.querySelector('[aria-live="polite"]')?.textContent?.trim();
  return { fixture, host: fixture.componentInstance, gantt, stable, row, bar, live };
}

describe('StarGantt', () => {
  describe('tree grid', () => {
    it('is a tree grid with levels, sizes, and named rows', async () => {
      const { gantt, row } = await setup();
      const grid = gantt.querySelector('[role="treegrid"]')!;
      expect(grid.getAttribute('aria-label')).toBe('Tasks');
      expect(grid.getAttribute('aria-rowcount')).toBe('7');
      expect(
        [...grid.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent?.trim()),
      ).toEqual(['Name', 'Start', 'End', 'Duration', 'Progress']);
      expect(row('design').getAttribute('aria-label')).toBe(
        'Design, 3 March to 14 March, 40 percent, Depends on Research (Finish to start)',
      );
      expect(row('frontend').getAttribute('aria-level')).toBe('2');
      expect(row('frontend').getAttribute('aria-posinset')).toBe('1');
      expect(row('frontend').getAttribute('aria-setsize')).toBe('2');
      expect(row('build').getAttribute('aria-expanded')).toBe('true');
      expect(row('design').hasAttribute('aria-expanded')).toBe(false);
      expect(row('launch').getAttribute('aria-label')).toBe(
        'Launch, 30 March, Milestone, Depends on Backend (Finish to start)',
      );
    });

    it('shows dates, duration and progress, and lets a summary span its children', async () => {
      const { row } = await setup();
      const cells = (id: string) =>
        [...row(id).querySelectorAll('[role="gridcell"]')].map((c) => c.textContent?.trim());
      expect(cells('design')).toEqual(['Design', '3 Mar 2026', '14 Mar 2026', '12 days', '40%']);
      // Build spans Frontend and Backend: 16 to 27 March; progress weighted by duration.
      expect(cells('build')).toEqual(['Build', '16 Mar 2026', '27 Mar 2026', '12 days', '6%']);
      expect(row('build').getAttribute('aria-label')).toContain('Summary task');
    });

    it('collapses and expands a summary task with the arrow keys', async () => {
      const { host, row, gantt, stable } = await setup();
      row('build').focus();
      key(row('build'), 'ArrowLeft');
      await stable();
      expect(host.collapsed()).toEqual(['build']);
      expect(gantt.querySelector('[data-task-id="frontend"]')).toBeNull();
      expect(row('build').getAttribute('aria-expanded')).toBe('false');
      key(row('build'), 'ArrowRight');
      await stable();
      expect(host.collapsed()).toEqual([]);
      key(row('build'), 'ArrowRight');
      await stable();
      expect(document.activeElement).toBe(row('frontend'));
      key(row('frontend'), 'ArrowLeft');
      await stable();
      expect(document.activeElement).toBe(row('build'));
    });

    it('collapses with a click on the toggle', async () => {
      const { host, row, stable } = await setup();
      row('build').querySelector<HTMLElement>('.star-gantt__toggle')!.click();
      await stable();
      expect(host.collapsed()).toEqual(['build']);
    });

    it('moves between rows with the arrow keys, Home and End, and selects with Enter', async () => {
      const { host, row, stable } = await setup();
      expect(row('research').tabIndex).toBe(0);
      expect(row('design').tabIndex).toBe(-1);
      row('research').focus();
      key(row('research'), 'ArrowDown');
      await stable();
      expect(document.activeElement).toBe(row('design'));
      key(row('design'), 'End');
      await stable();
      expect(document.activeElement).toBe(row('launch'));
      key(row('launch'), 'Home');
      await stable();
      expect(document.activeElement).toBe(row('research'));
      key(row('research'), 'Enter');
      expect(host.selected.at(-1)?.task.id).toBe('research');
    });
  });

  describe('timeline', () => {
    it('draws bars, a diamond milestone and dependency arrows, and hides them from assistive technology', async () => {
      const { gantt, bar } = await setup();
      expect(gantt.querySelector('.star-gantt__timeline')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
      // The week scale starts on Monday 23 February (one week before the first task); 16 px a day.
      const design = bar('design').querySelector('.star-gantt__bar-track')!;
      expect(design.getAttribute('x')).toBe(String(8 * 16));
      expect(design.getAttribute('width')).toBe(String(12 * 16));
      expect(bar('design').style.getPropertyValue('--star-gantt-bar-color')).toBe(
        'var(--star-chart-3)',
      );
      expect(bar('design').querySelector('.star-gantt__bar-progress')?.getAttribute('width')).toBe(
        '76.8',
      );
      expect(bar('launch').querySelector('.star-gantt__milestone')?.getAttribute('d')).toMatch(
        /^M /,
      );
      const paths = [...gantt.querySelectorAll('.star-gantt__dependency')];
      expect(paths).toHaveLength(4);
      // Research (row 0) ends on 7 March; Design (row 1) starts on 3 March: routed around.
      expect(paths[0].getAttribute('d')).toBe('M 192 18 H 200 V 36 H 120 V 54 H 128');
    });

    it('builds the time scale and shades weekends in the day scale', async () => {
      const { gantt, stable, host } = await setup();
      const lower = [
        ...gantt.querySelectorAll('.star-gantt__tier')[1].querySelectorAll('.star-gantt__tick'),
      ];
      expect(lower[0].textContent?.trim()).toBe('23 Feb');
      expect(gantt.querySelectorAll('.star-gantt__weekend').length).toBeGreaterThan(0);
      host.scale.set('month');
      await stable();
      expect(gantt.querySelectorAll('.star-gantt__weekend')).toHaveLength(0);
      const months = [
        ...gantt.querySelectorAll('.star-gantt__tier')[1].querySelectorAll('.star-gantt__tick'),
      ];
      expect(months.map((m) => m.textContent?.trim())).toEqual(['Feb', 'Mar', 'Apr']);
    });
  });

  describe('keyboard changes', () => {
    it('moves a task by one scale unit with Alt+arrow and announces it', async () => {
      const { host, row, live, stable } = await setup();
      row('design').focus();
      key(row('design'), 'ArrowRight', { altKey: true });
      await stable();
      expect(host.changes[0]).toMatchObject({
        kind: 'move',
        start: at(3, 10),
        end: at(3, 22),
        progress: 40,
      });
      expect(live()).toBe('Design moved to 10 March to 21 March');
      host.scale.set('day');
      await stable();
      key(row('design'), 'ArrowLeft', { altKey: true });
      expect(host.changes[1]).toMatchObject({ start: at(3, 2), end: at(3, 14) });
    });

    it('resizes with Alt+Shift+arrow and keeps at least one day', async () => {
      const { host, row } = await setup((h) => h.scale.set('day'));
      key(row('design'), 'ArrowRight', { altKey: true, shiftKey: true });
      expect(host.changes[0]).toMatchObject({ kind: 'resize', start: at(3, 3), end: at(3, 16) });
      key(row('research'), 'ArrowLeft', { altKey: true, shiftKey: true });
      expect(host.changes[1].end).toEqual(at(3, 6));
    });

    it('changes the progress by 10 with Alt+up and down', async () => {
      const { host, row, live, stable } = await setup();
      key(row('design'), 'ArrowUp', { altKey: true });
      await stable();
      expect(host.changes[0]).toMatchObject({ kind: 'progress', progress: 50 });
      expect(live()).toBe('Design now 50 percent');
    });

    it('mirrors Alt+left and right in right-to-left', async () => {
      const { host, row } = await setup((h) => h.dir.set('rtl'));
      key(row('design'), 'ArrowLeft', { altKey: true });
      expect(host.changes[0].start).toEqual(at(3, 10));
    });

    it('announces a canceled change', async () => {
      const { host, row, live, stable } = await setup((h) => (h.cancel = true));
      key(row('design'), 'ArrowRight', { altKey: true });
      await stable();
      expect(host.changes[0].canceled).toBe(true);
      expect(live()).toBe('Change canceled');
    });

    it('does not change summary tasks or a readonly Gantt', async () => {
      const { host, row, stable } = await setup();
      key(row('build'), 'ArrowRight', { altKey: true });
      expect(host.changes).toHaveLength(0);
      host.readonly.set(true);
      await stable();
      key(row('design'), 'ArrowRight', { altKey: true });
      expect(host.changes).toHaveLength(0);
      expect(row('design').hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('pointer drag', () => {
    it('moves a bar in whole days, with a preview while dragging', async () => {
      const { host, bar, stable } = await setup();
      const track = bar('design').querySelector('.star-gantt__bar-track')!;
      pointer(track, 'pointerdown', 100);
      pointer(document, 'pointermove', 100 + 3 * 16 + 4);
      await stable();
      expect(bar('design').querySelector('.star-gantt__bar-track')?.getAttribute('x')).toBe(
        String(11 * 16),
      );
      pointer(document, 'pointerup', 152);
      await stable();
      expect(host.changes[0]).toMatchObject({ kind: 'move', start: at(3, 6), end: at(3, 18) });
      expect(bar('design').querySelector('.star-gantt__bar-track')?.getAttribute('x')).toBe(
        String(8 * 16),
      );
    });

    it('resizes from the end handle', async () => {
      const { host, bar } = await setup();
      pointer(bar('design').querySelector('.star-gantt__handle')!, 'pointerdown', 300);
      pointer(document, 'pointermove', 300 - 2 * 16);
      pointer(document, 'pointerup', 300 - 2 * 16);
      expect(host.changes[0]).toMatchObject({ kind: 'resize', start: at(3, 3), end: at(3, 13) });
    });

    it('changes the progress from the progress handle', async () => {
      const { host, bar } = await setup();
      // The bar is 192 px wide: 96 px more is 50 percent more.
      pointer(bar('design').querySelector('.star-gantt__progress-handle')!, 'pointerdown', 200);
      pointer(document, 'pointermove', 296);
      pointer(document, 'pointerup', 296);
      expect(host.changes[0]).toMatchObject({ kind: 'progress', progress: 90 });
    });

    it('captures the pointer on the dragged element', async () => {
      const { bar } = await setup();
      const track = bar('design').querySelector('.star-gantt__bar-track')!;
      const capture = vi.fn();
      Object.defineProperty(track, 'setPointerCapture', { value: capture, configurable: true });
      const down = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
      Object.defineProperty(down, 'pointerId', { value: 7 });
      track.dispatchEvent(down);
      expect(capture).toHaveBeenCalledWith(7);
      pointer(document, 'pointerup', 0);
    });

    it('drops the drag on Escape, without a change', async () => {
      const { host, bar, stable } = await setup();
      pointer(bar('design').querySelector('.star-gantt__bar-track')!, 'pointerdown', 100);
      pointer(document, 'pointermove', 164);
      await stable();
      expect(bar('design').querySelector('.star-gantt__bar-track')?.getAttribute('x')).toBe(
        String(12 * 16),
      );
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await stable();
      expect(bar('design').querySelector('.star-gantt__bar-track')?.getAttribute('x')).toBe(
        String(8 * 16),
      );
      pointer(document, 'pointerup', 164);
      expect(host.changes).toHaveLength(0);
    });

    it('removes the drag listeners when the Gantt is destroyed', async () => {
      const { host, bar, fixture } = await setup();
      const removed = vi.spyOn(document, 'removeEventListener');
      pointer(bar('design').querySelector('.star-gantt__bar-track')!, 'pointerdown', 100);
      fixture.destroy();
      expect(removed.mock.calls.map((c) => c[0])).toEqual(
        expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel', 'keydown']),
      );
      pointer(document, 'pointerup', 200);
      expect(host.changes).toHaveLength(0);
      removed.mockRestore();
    });

    it('mirrors the drag in right-to-left', async () => {
      const { host, bar } = await setup((h) => h.dir.set('rtl'));
      pointer(bar('design').querySelector('.star-gantt__bar-track')!, 'pointerdown', 300);
      pointer(document, 'pointermove', 300 - 32);
      pointer(document, 'pointerup', 300 - 32);
      expect(host.changes[0].start).toEqual(at(3, 5));
    });
  });

  describe('virtualization', () => {
    const many = (): StarGanttTask[] =>
      Array.from({ length: 1500 }, (_, i) => ({
        id: i,
        name: `Task ${i + 1}`,
        start: at(3, 1 + (i % 20)),
        end: at(3, 3 + (i % 20)),
        progress: i % 100,
      }));

    it('renders only the rows in view for 1,500 tasks, and follows the scroll', async () => {
      const { gantt, stable } = await setup((h) => h.tasks.set(many()));
      const rows = () => [...gantt.querySelectorAll('[role="row"][data-task-id]')];
      expect(gantt.querySelector('[role="treegrid"]')?.getAttribute('aria-rowcount')).toBe('1501');
      expect(rows().length).toBeLessThan(40);
      expect(gantt.querySelectorAll('g.star-gantt__bar').length).toBe(rows().length);
      const scroller = gantt.querySelector<HTMLElement>('.star-gantt__scroll')!;
      scroller.scrollTop = 36 * 1000;
      scroller.dispatchEvent(new Event('scroll'));
      await stable();
      const ids = rows().map((r) => Number(r.getAttribute('data-task-id')));
      expect(ids).toContain(1000);
      expect(ids).not.toContain(0);
      expect(rows()[0].getAttribute('aria-rowindex')).toBe(String(ids[0] + 2));
    });

    it('scrolls the row into view when End moves the focus', async () => {
      const { gantt, stable, row } = await setup((h) => h.tasks.set(many()));
      row('0').focus();
      key(row('0'), 'End');
      await stable();
      await stable();
      expect(document.activeElement?.getAttribute('data-task-id')).toBe('1499');
      expect(gantt.querySelector('[data-task-id="0"]')).toBeNull();
    });
  });

  it('renders on the server platform without the today line', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const { gantt } = await setup();
    expect(gantt.querySelector('[role="treegrid"]')).not.toBeNull();
    expect(gantt.querySelector('.star-gantt__today')).toBeNull();
  });
});
