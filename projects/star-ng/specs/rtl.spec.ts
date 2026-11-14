import { Directionality } from '@angular/cdk/bidi';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideStarDirection,
  starDirectionOf,
  StarDirectionService,
  starInlineKey,
  starIsRtl,
} from 'star-ng/core';
import { StarTreeTable } from 'star-ng/data-display';
import { StarCalendar } from 'star-ng/date-picker';
import { StarDrawer } from 'star-ng/drawer';
import { StarInputOtp } from 'star-ng/input-otp';
import { StarKnob } from 'star-ng/knob';
import { StarToolbar } from 'star-ng/layout';
import { StarGalleria } from 'star-ng/media';
import { StarSelectButton } from 'star-ng/select-button';
import { StarTab, StarTabs } from 'star-ng/tabs';
import { StarToast } from 'star-ng/toast';
import { StarTree, StarTreeNode } from 'star-ng/tree';
import { StarDock, StarSpeedDial, StarSplitter } from 'star-ng/utility';

/**
 * Right-to-left behavior of the controls. A control reads the direction from the `dir` attribute
 * (or the CSS `direction`) of its own element, so a `dir="rtl"` wrapper is enough. jsdom has no
 * layout: key handling and class names are checked here, geometry and mirrored icons are checked
 * in `e2e/rtl-controls.spec.ts`.
 */

function key(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

const NODES: StarTreeNode<Record<string, unknown>>[] = [
  {
    key: 'a',
    label: 'Alpha',
    data: { name: 'Alpha' },
    children: [{ key: 'a1', label: 'Alpha one', data: { name: 'Alpha one' } }],
  },
  { key: 'b', label: 'Beta', data: { name: 'Beta' } },
];

@Component({
  imports: [
    StarTabs,
    StarTab,
    StarSelectButton,
    StarInputOtp,
    StarCalendar,
    StarTree,
    StarTreeTable,
    StarSplitter,
    StarToolbar,
    StarGalleria,
    StarKnob,
  ],
  template: `
    @for (direction of ['ltr', 'rtl']; track direction) {
      <section [attr.dir]="direction" [id]="direction">
        <star-tabs [(value)]="tab" ariaLabel="Sections">
          <star-tab value="a" label="A">A</star-tab>
          <star-tab value="b" label="B">B</star-tab>
          <star-tab value="c" label="C">C</star-tab>
        </star-tabs>
        <star-select-button [options]="['d', 'w', 'm']" [(value)]="period" ariaLabel="Period" />
        <star-input-otp [(value)]="code" [length]="4" ariaLabel="Code" />
        <star-calendar
          locale="en-GB"
          [firstDayOfWeek]="1"
          [selected]="date()"
          (dateSelect)="date.set($event)"
        />
        <star-tree [nodes]="nodes" [(expanded)]="open" ariaLabel="Tree" />
        <star-tree-table
          [nodes]="nodes"
          [columns]="[{ field: 'name', header: 'Name' }]"
          [(expanded)]="tableOpen"
          ariaLabel="Tree table"
        />
        <star-splitter [(size)]="split" ariaLabel="Panes">
          <div starSplitterStart>One</div>
          <div starSplitterEnd>Two</div>
        </star-splitter>
        <star-toolbar ariaLabel="Tools">
          <ng-container starToolbarStart>
            <button type="button" class="t">One</button>
            <button type="button" class="t">Two</button>
          </ng-container>
        </star-toolbar>
        <star-galleria
          [images]="[
            { src: 'a.png', alt: 'One' },
            { src: 'b.png', alt: 'Two' },
            { src: 'c.png', alt: 'Three' },
          ]"
          [(activeIndex)]="shown"
        />
        <star-knob [(value)]="level" ariaLabel="Level" />
      </section>
    }
  `,
})
class KeysHost {
  readonly nodes = NODES;
  readonly tab = signal<string | null>('a');
  readonly period = signal<string | readonly string[] | null>('d');
  readonly code = signal('');
  readonly date = signal<Date | null>(new Date(2026, 10, 18));
  readonly open = signal<readonly string[]>([]);
  readonly tableOpen = signal<readonly string[]>([]);
  readonly split = signal(50);
  readonly shown = signal(0);
  readonly level = signal(50);
}

describe('direction helpers', () => {
  it('reads dir from the element or the nearest ancestor and treats no attribute as ltr', () => {
    const root = document.createElement('div');
    root.innerHTML = `<div id="a" dir="rtl"><span id="b"></span><p id="c" dir="ltr"></p></div><i id="d"></i>`;
    document.body.append(root);
    const get = (id: string) => root.querySelector(`#${id}`)!;
    expect(starDirectionOf(get('a'))).toBe('rtl');
    expect(starDirectionOf(get('b'))).toBe('rtl');
    expect(starDirectionOf(get('c'))).toBe('ltr');
    expect(starIsRtl(get('d'))).toBe(false);
    expect(starIsRtl(null)).toBe(false);
    root.remove();
  });

  it('swaps the arrow keys in rtl and leaves every other key alone', () => {
    const rtl = document.createElement('div');
    rtl.dir = 'rtl';
    document.body.append(rtl);
    const read = (element: Element, name: string): string => {
      let result = '';
      element.addEventListener(
        'keydown',
        (event) => (result = starInlineKey(event as KeyboardEvent)),
        { once: true },
      );
      key(element, name);
      return result;
    };
    expect(read(rtl, 'ArrowLeft')).toBe('ArrowRight');
    expect(read(rtl, 'ArrowRight')).toBe('ArrowLeft');
    expect(read(rtl, 'ArrowDown')).toBe('ArrowDown');
    expect(read(rtl, 'Home')).toBe('Home');
    const ltr = document.createElement('div');
    document.body.append(ltr);
    expect(read(ltr, 'ArrowLeft')).toBe('ArrowLeft');
    rtl.remove();
    ltr.remove();
  });
});

describe('StarDirectionService', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('dir');
  });

  it('follows <html dir> at run time and keeps the CDK Directionality in step', () => {
    const service = TestBed.inject(StarDirectionService);
    const directionality = TestBed.inject(Directionality);
    expect(service.value()).toBe('ltr');
    expect(directionality.value).toBe('ltr');

    const changes: string[] = [];
    directionality.change.subscribe((value) => changes.push(value));
    document.documentElement.dir = 'rtl';
    service.refresh(); // the observer does the same one microtask later
    expect(service.value()).toBe('rtl');
    expect(directionality.value).toBe('rtl');

    document.documentElement.dir = 'ltr';
    service.refresh();
    expect(directionality.value).toBe('ltr');
    expect(changes).toEqual(['rtl', 'ltr']);
  });

  it('starts in rtl when the page already is rtl', () => {
    document.documentElement.dir = 'rtl';
    expect(TestBed.inject(StarDirectionService).value()).toBe('rtl');
    expect(TestBed.inject(Directionality).value).toBe('rtl');
  });

  it('provideStarDirection starts the service when the application starts', async () => {
    TestBed.configureTestingModule({ providers: [provideStarDirection()] });
    // Creating the injector runs the initializer: no control and no inject(StarDirectionService).
    const directionality = TestBed.inject(Directionality);
    expect(directionality.value).toBe('ltr');
    document.documentElement.dir = 'rtl';
    await new Promise((resolve) => setTimeout(resolve));
    expect(directionality.value).toBe('rtl');
  });

  it('is observed without a manual refresh', async () => {
    const service = TestBed.inject(StarDirectionService);
    document.documentElement.dir = 'rtl';
    await new Promise((resolve) => setTimeout(resolve));
    expect(service.value()).toBe('rtl');
  });
});

describe('keys in right-to-left', () => {
  async function setup() {
    const fixture = TestBed.createComponent(KeysHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const part = (dir: 'ltr' | 'rtl') => root.querySelector<HTMLElement>(`#${dir}`)!;
    return { fixture, host: fixture.componentInstance, part };
  }

  it('tabs: Arrow left is the next tab in rtl and the previous tab in ltr', async () => {
    const { fixture, host, part } = await setup();
    const tabs = (dir: 'ltr' | 'rtl') => [...part(dir).querySelectorAll<HTMLElement>('[role=tab]')];

    key(tabs('rtl')[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(host.tab()).toBe('b');
    key(tabs('rtl')[1], 'ArrowRight');
    await fixture.whenStable();
    expect(host.tab()).toBe('a');

    key(tabs('ltr')[0], 'ArrowRight');
    await fixture.whenStable();
    expect(host.tab()).toBe('b');
    key(tabs('ltr')[1], 'ArrowLeft');
    await fixture.whenStable();
    expect(host.tab()).toBe('a');
  });

  it('select button: Arrow left is the next choice in rtl', async () => {
    const { fixture, host, part } = await setup();
    const radios = (dir: 'ltr' | 'rtl') => [
      ...part(dir).querySelectorAll<HTMLElement>('star-select-button [role=radio]'),
    ];
    key(radios('rtl')[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(host.period()).toBe('w');
    key(radios('rtl')[1], 'ArrowRight');
    await fixture.whenStable();
    expect(host.period()).toBe('d');
    key(radios('rtl')[0], 'ArrowDown'); // vertical arrows do not change
    await fixture.whenStable();
    expect(host.period()).toBe('w');
  });

  it('one-time code: Arrow left moves to the next box in rtl', async () => {
    const { fixture, part } = await setup();
    const boxes = [...part('rtl').querySelectorAll<HTMLInputElement>('star-input-otp input')];
    boxes[1].focus();
    key(boxes[1], 'ArrowLeft');
    await fixture.whenStable();
    expect(document.activeElement).toBe(boxes[2]);
    key(boxes[2], 'ArrowRight');
    await fixture.whenStable();
    expect(document.activeElement).toBe(boxes[1]);

    const ltr = [...part('ltr').querySelectorAll<HTMLInputElement>('star-input-otp input')];
    ltr[1].focus();
    key(ltr[1], 'ArrowLeft');
    await fixture.whenStable();
    expect(document.activeElement).toBe(ltr[0]);
  });

  it('calendar: Arrow left is the following day in rtl, Arrow up still goes a week back', async () => {
    const { fixture, part } = await setup();
    const focusable = (dir: 'ltr' | 'rtl') =>
      part(dir).querySelector<HTMLElement>('.star-calendar__day[tabindex="0"]')!.dataset['date'];
    const grid = (dir: 'ltr' | 'rtl') => part(dir).querySelector('[role=grid]')!;
    expect(focusable('rtl')).toBe('2026-11-18');

    key(grid('rtl'), 'ArrowLeft');
    await fixture.whenStable();
    expect(focusable('rtl')).toBe('2026-11-19');
    key(grid('rtl'), 'ArrowRight');
    key(grid('rtl'), 'ArrowRight');
    await fixture.whenStable();
    expect(focusable('rtl')).toBe('2026-11-17');
    key(grid('rtl'), 'ArrowUp');
    await fixture.whenStable();
    expect(focusable('rtl')).toBe('2026-11-10');

    key(grid('ltr'), 'ArrowLeft');
    await fixture.whenStable();
    expect(focusable('ltr')).toBe('2026-11-17');
  });

  it('tree: Arrow left opens and Arrow right closes a branch in rtl (WAI-ARIA, mirrored)', async () => {
    const { fixture, host, part } = await setup();
    const items = (dir: 'ltr' | 'rtl') => [
      ...part(dir).querySelectorAll<HTMLElement>('star-tree [role=treeitem]'),
    ];
    key(items('rtl')[0], 'ArrowRight'); // the closing key does nothing on a closed branch
    await fixture.whenStable();
    expect(host.open()).toEqual([]);
    key(items('rtl')[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(host.open()).toEqual(['a']);
    expect(items('rtl').map((row) => row.dataset['key'])).toEqual(['a', 'a1', 'b']);
    // Arrow right on the child goes to its parent, then closes the parent.
    key(items('rtl')[1], 'ArrowRight');
    await fixture.whenStable();
    expect(document.activeElement).toBe(items('rtl')[0]);
    key(items('rtl')[0], 'ArrowRight');
    await fixture.whenStable();
    expect(host.open()).toEqual([]);
  });

  it('tree table: Arrow left opens a branch in rtl', async () => {
    const { fixture, host, part } = await setup();
    const rows = (dir: 'ltr' | 'rtl') => [
      ...part(dir).querySelectorAll<HTMLElement>('[role=treegrid] tbody tr'),
    ];
    key(rows('rtl')[0], 'ArrowRight');
    await fixture.whenStable();
    expect(host.tableOpen()).toEqual([]);
    key(rows('rtl')[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(host.tableOpen()).toEqual(['a']);
    expect(rows('rtl').length).toBe(3);
    key(rows('rtl')[0], 'ArrowRight');
    await fixture.whenStable();
    expect(host.tableOpen()).toEqual([]);
  });

  it('splitter: Arrow left makes the first pane larger in rtl (it is on the right)', async () => {
    const { fixture, host, part } = await setup();
    const gutter = part('rtl').querySelector('[role=separator]')!;
    key(gutter, 'ArrowLeft');
    await fixture.whenStable();
    expect(host.split()).toBe(52);
    key(gutter, 'ArrowRight');
    key(gutter, 'ArrowRight');
    await fixture.whenStable();
    expect(host.split()).toBe(48);
    // Left-to-right is unchanged.
    key(part('ltr').querySelector('[role=separator]')!, 'ArrowRight');
    await fixture.whenStable();
    expect(host.split()).toBe(50);
  });

  it('toolbar: Arrow left moves to the next control in rtl', async () => {
    const { part } = await setup();
    const buttons = [...part('rtl').querySelectorAll<HTMLElement>('.t')];
    buttons[0].focus();
    key(buttons[0], 'ArrowLeft');
    expect(document.activeElement).toBe(buttons[1]);
    key(buttons[1], 'ArrowRight');
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('galleria: Arrow left shows the next image in rtl', async () => {
    const { fixture, host, part } = await setup();
    const stage = part('rtl').querySelector('.star-galleria__stage')!;
    key(stage, 'ArrowLeft');
    await fixture.whenStable();
    expect(host.shown()).toBe(1);
    key(stage, 'ArrowRight');
    await fixture.whenStable();
    expect(host.shown()).toBe(0);
    key(part('ltr').querySelector('.star-galleria__stage')!, 'ArrowRight');
    await fixture.whenStable();
    expect(host.shown()).toBe(1);
  });

  it('knob keeps its clockwise keys in rtl (a dial is a physical object, like a clock)', async () => {
    const { fixture, host, part } = await setup();
    const knob = part('rtl').querySelector('star-knob [role=slider]')!;
    key(knob, 'ArrowRight');
    await fixture.whenStable();
    expect(host.level()).toBe(51);
    key(knob, 'ArrowLeft');
    await fixture.whenStable();
    expect(host.level()).toBe(50);
  });
});

@Component({
  imports: [StarSpeedDial, StarDock, StarDrawer, StarToast],
  template: `
    <div dir="rtl" id="rtl">
      @for (direction of directions; track direction) {
        <star-speed-dial
          [attr.data-direction]="direction"
          [direction]="direction"
          [items]="items"
          [ariaLabel]="direction"
        />
      }
      <star-dock [items]="items" position="start" />
      <star-drawer [visible]="true" position="start" header="Start" />
      <star-toast position="bottom-start" />
    </div>
  `,
})
class ClassesHost {
  readonly directions = ['up', 'down', 'left', 'right', 'start', 'end'] as const;
  readonly items = [
    { label: 'One', icon: 'ph-bold ph-plus' },
    { label: 'Two', icon: 'ph-bold ph-minus' },
    { label: 'Three', icon: 'ph-bold ph-x' },
  ];
}

describe('side names', () => {
  it('speed dial: arrow keys follow the visual side; start and end resolve by direction', async () => {
    const fixture = TestBed.createComponent(ClassesHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const dial = (direction: string) =>
      el.querySelector<HTMLElement>(`star-speed-dial[data-direction="${direction}"]`)!;
    const open = async (direction: string) => {
      const fab = dial(direction).querySelector<HTMLButtonElement>('.star-speed-dial__fab')!;
      fab.click();
      await fixture.whenStable();
      return [...dial(direction).querySelectorAll<HTMLButtonElement>('.star-speed-dial__action')];
    };
    expect(dial('start').classList.contains('star-speed-dial--start')).toBe(true);

    // In rtl "start" is the right side: the list runs to the right, so Arrow right goes on.
    let actions = await open('start');
    actions[0].focus();
    key(dial('start'), 'ArrowRight');
    expect(document.activeElement).toBe(actions[1]);
    key(dial('start'), 'ArrowLeft');
    expect(document.activeElement).toBe(actions[0]);

    // "left" is the physical left, in rtl too: Arrow left goes on.
    actions = await open('left');
    actions[0].focus();
    key(dial('left'), 'ArrowLeft');
    expect(document.activeElement).toBe(actions[1]);

    // "end" is the left side in rtl.
    actions = await open('end');
    actions[0].focus();
    key(dial('end'), 'ArrowLeft');
    expect(document.activeElement).toBe(actions[1]);
  });

  it('dock, drawer and toast accept start and end names', async () => {
    const fixture = TestBed.createComponent(ClassesHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('star-dock')!.classList.contains('star-dock--start')).toBe(true);
    expect(el.querySelector('dialog')!.classList.contains('star-drawer--start')).toBe(true);
    expect(
      el.querySelector('star-toast')!.classList.contains('star-toast-stack--bottom-start'),
    ).toBe(true);
  });
});
