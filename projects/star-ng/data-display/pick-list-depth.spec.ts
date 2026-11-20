import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEmptyTemplate, StarIconTemplate } from '@star-ng/ui/core';
import {
  StarListFilterEvent,
  StarListFilterTemplate,
  StarListItemsEvent,
  StarPickListHeaderTemplate,
} from './data-display-slots';
import { StarPickList, ɵstarReorderPicked } from './pick-list';

interface City {
  readonly id: number;
  readonly name: string;
  readonly code: string;
}

const CITIES: readonly City[] = [
  { id: 1, name: 'Oslo', code: 'OSL' },
  { id: 2, name: 'Lyon', code: 'LYS' },
  { id: 3, name: 'Porto', code: 'OPO' },
  { id: 4, name: 'Lille', code: 'LIL' },
];

@Component({
  imports: [
    StarPickList,
    StarPickListHeaderTemplate,
    StarListFilterTemplate,
    StarEmptyTemplate,
    StarIconTemplate,
  ],
  template: `
    <star-pick-list
      [(source)]="source"
      [(target)]="target"
      optionLabel="name"
      [filter]="filter()"
      [filterBy]="filterBy()"
      [filterMatchMode]="mode()"
      [disabled]="disabled()"
      [stripedRows]="striped()"
      [scrollHeight]="height()"
      [metaKeySelection]="meta()"
      [keepSelection]="keep()"
      [sourceOptionDisabled]="locked()"
      [showSourceControls]="controls()"
      [showTargetControls]="controls()"
      [dragdrop]="drag()"
      [showTargetFilter]="targetFilter()"
      sourceFilterPlaceholder="Find a city"
      (moveToTarget)="log.push(['toTarget', $event])"
      (moveAllToTarget)="log.push(['allToTarget', $event])"
      (moveToSource)="log.push(['toSource', $event])"
      (moveAllToSource)="log.push(['allToSource', $event])"
      (sourceReorder)="log.push(['sourceReorder', $event])"
      (targetReorder)="log.push(['targetReorder', $event])"
      (sourceSelect)="log.push(['sourceSelect', $event])"
      (targetSelect)="log.push(['targetSelect', $event])"
      (sourceFilter)="filters.push($event)"
      (targetFilter)="filters.push($event)"
    >
      @if (slots()) {
        <ng-template starPickListHeader let-list let-count="count"
          ><b class="head">{{ list }}={{ count }}</b></ng-template
        >
        <ng-template starEmpty let-query let-list="list"
          ><i class="none">{{ list }}:{{ query }}</i></ng-template
        >
        <ng-template starListFilter let-query let-list="list" let-filter="filter"
          ><button class="own-filter" type="button" (click)="filter('ly')">
            {{ list }}:{{ query }}
          </button></ng-template
        >
        <ng-template starIcon="moveToTarget"><b class="icon-to">to</b></ng-template>
      }
    </star-pick-list>
  `,
})
class Host {
  readonly source = signal<readonly City[]>(CITIES);
  readonly target = signal<readonly City[]>([]);
  readonly filter = signal(false);
  readonly filterBy = signal<'name' | 'code' | null>(null);
  readonly mode = signal<'contains' | 'startsWith'>('contains');
  readonly disabled = signal(false);
  readonly striped = signal(false);
  readonly height = signal<string | null>(null);
  readonly meta = signal(false);
  readonly keep = signal(false);
  readonly locked = signal<((city: City) => boolean) | null>(null);
  readonly controls = signal(false);
  readonly drag = signal(false);
  readonly targetFilter = signal(true);
  readonly slots = signal(false);
  readonly log: [string, StarListItemsEvent<City>][] = [];
  readonly filters: StarListFilterEvent<City>[] = [];
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const lists = () => [...el.querySelectorAll<HTMLElement>('[role=listbox]')];
  const options = (list: 0 | 1) => [
    ...lists()[list].querySelectorAll<HTMLElement>('[role=option]'),
  ];
  const labels = (list: 0 | 1) => options(list).map((o) => o.textContent!.trim());
  const button = (label: string) => el.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const stable = () => fixture.whenStable();
  return { fixture, el, host: fixture.componentInstance, lists, options, labels, button, stable };
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('StarPickList depth', () => {
  it('filters each list with the match mode and emits the filter events', async () => {
    const t = await setup((h) => h.filter.set(true));
    const inputs = [...t.el.querySelectorAll<HTMLInputElement>('input[type=search]')];
    expect(inputs.length).toBe(2);
    expect(inputs[0].placeholder).toBe('Find a city');
    expect(inputs[0].getAttribute('aria-label')).toBe('Find a city');
    expect(inputs[1].placeholder).toBe('Search');
    type(inputs[0], 'l');
    await t.stable();
    expect(t.labels(0)).toEqual(['Oslo', 'Lyon', 'Lille']);
    t.host.mode.set('startsWith');
    await t.stable();
    type(inputs[0], 'l');
    await t.stable();
    expect(t.labels(0)).toEqual(['Lyon', 'Lille']);
    expect(t.host.filters.at(-1)).toEqual({ query: 'l', value: [CITIES[1], CITIES[3]] });
    type(inputs[0], 'zz');
    await t.stable();
    expect(t.el.querySelector('.star-pick-list__empty')!.textContent!.trim()).toBe(
      'No results found',
    );
  });

  it('filters by other fields and can hide the target filter', async () => {
    const t = await setup((h) => {
      h.filter.set(true);
      h.filterBy.set('code');
      h.targetFilter.set(false);
    });
    const inputs = [...t.el.querySelectorAll<HTMLInputElement>('input[type=search]')];
    expect(inputs.length).toBe(1);
    type(inputs[0], 'op');
    await t.stable();
    expect(t.labels(0)).toEqual(['Porto']);
  });

  it('"Move all" moves only the shown items and emits moveAllToTarget', async () => {
    const t = await setup((h) => h.filter.set(true));
    type(t.el.querySelector<HTMLInputElement>('input[type=search]')!, 'li');
    await t.stable();
    t.button('Move all to target').click();
    await t.stable();
    expect(t.host.target().map((c) => c.name)).toEqual(['Lille']);
    expect(t.host.log.at(-1)).toEqual(['allToTarget', { items: [CITIES[3]] }]);
  });

  it('emits the select and move events and keeps the selection with keepSelection', async () => {
    const t = await setup((h) => h.keep.set(true));
    t.options(0)[1].click();
    await t.stable();
    expect(t.host.log.at(-1)).toEqual(['sourceSelect', { items: [CITIES[1]] }]);
    t.button('Move selected to target').click();
    await t.stable();
    expect(t.host.log.at(-1)).toEqual(['toTarget', { items: [CITIES[1]] }]);
    expect(t.options(1)[0].getAttribute('aria-selected')).toBe('true');
    t.button('Move selected to source').click();
    await t.stable();
    expect(t.host.log.at(-1)).toEqual(['toSource', { items: [CITIES[1]] }]);
    t.button('Move all to source').click();
    await t.stable();
    expect(t.host.log.filter(([name]) => name === 'allToSource')).toEqual([]);
  });

  it('with metaKeySelection a click selects one item and Ctrl+click adds', async () => {
    const t = await setup((h) => h.meta.set(true));
    t.options(0)[0].click();
    t.options(0)[1].click();
    await t.stable();
    expect(t.options(0).map((o) => o.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    t.options(0)[2].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    await t.stable();
    expect(t.options(0).filter((o) => o.getAttribute('aria-selected') === 'true').length).toBe(2);
  });

  it('marks disabled options and does not select or move them', async () => {
    const t = await setup((h) => h.locked.set(() => true));
    const first = t.options(0)[0];
    expect(first.getAttribute('aria-disabled')).toBe('true');
    first.click();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await t.stable();
    expect(first.getAttribute('aria-selected')).toBe('false');
    expect(t.host.target()).toEqual([]);
    expect(t.button('Move all to target').disabled).toBe(true);
  });

  it('disables everything with disabled, and styles with stripedRows and scrollHeight', async () => {
    const t = await setup((h) => {
      h.disabled.set(true);
      h.striped.set(true);
      h.height.set('12rem');
    });
    expect(t.el.querySelector('star-pick-list')!.classList).toContain('star-pick-list--disabled');
    expect(t.lists()[0].getAttribute('aria-disabled')).toBe('true');
    expect(t.lists()[0].classList).toContain('star-pick-list__list--striped');
    expect(t.lists()[0].style.maxHeight).toBe('12rem');
    expect(t.options(0)[0].getAttribute('tabindex')).toBe('-1');
    expect(t.button('Move all to target').disabled).toBe(true);
    t.options(0)[0].click();
    await t.stable();
    expect(t.options(0)[0].getAttribute('aria-selected')).toBe('false');
  });

  it('reorders the selected items of a list with its controls', async () => {
    const t = await setup((h) => h.controls.set(true));
    expect(t.el.querySelectorAll('[data-star-part=reorderPanel]').length).toBe(2);
    t.options(0)[2].click();
    await t.stable();
    const panel = t.el.querySelectorAll('[data-star-part=reorderPanel]')[0];
    panel.querySelector<HTMLButtonElement>('[aria-label="Move up"]')!.click();
    await t.stable();
    expect(t.labels(0)).toEqual(['Oslo', 'Porto', 'Lyon', 'Lille']);
    panel.querySelector<HTMLButtonElement>('[aria-label="Move to bottom"]')!.click();
    await t.stable();
    expect(t.labels(0)).toEqual(['Oslo', 'Lyon', 'Lille', 'Porto']);
    expect(t.host.log.at(-1)).toEqual(['sourceReorder', { items: [CITIES[2]] }]);
  });

  it('moves items by drag and drop between the lists and inside a list', async () => {
    const t = await setup((h) => {
      h.drag.set(true);
      h.target.set([CITIES[3]]);
      h.source.set(CITIES.slice(0, 3));
    });
    const drag = (from: HTMLElement, to: HTMLElement) => {
      from.dispatchEvent(new Event('dragstart', { bubbles: true }));
      const over = new Event('dragover', { bubbles: true, cancelable: true });
      to.dispatchEvent(over);
      expect(over.defaultPrevented).toBe(true);
      to.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    };
    expect(t.options(0)[0].getAttribute('draggable')).toBe('true');
    drag(t.options(0)[0], t.options(1)[0]);
    await t.stable();
    expect(t.labels(1)).toEqual(['Oslo', 'Lille']);
    expect(t.host.log.at(-1)).toEqual(['toTarget', { items: [CITIES[0]] }]);
    drag(t.options(0)[1], t.options(0)[0]);
    await t.stable();
    expect(t.labels(0)).toEqual(['Porto', 'Lyon']);
    expect(t.host.log.at(-1)).toEqual(['sourceReorder', { items: [CITIES[2]] }]);
    drag(t.options(1)[1], t.lists()[0]);
    await t.stable();
    expect(t.labels(0)).toEqual(['Porto', 'Lyon', 'Lille']);
  });

  it('renders the header, empty, filter and icon slots', async () => {
    const t = await setup((h) => {
      h.slots.set(true);
      h.filter.set(true);
    });
    expect([...t.el.querySelectorAll('.head')].map((n) => n.textContent)).toEqual([
      'source=4',
      'target=0',
    ]);
    expect(t.el.querySelector('.none')!.textContent).toBe('target:');
    expect(t.el.querySelector('.icon-to')!.closest('[aria-hidden=true]')).not.toBeNull();
    const own = t.el.querySelectorAll<HTMLButtonElement>('.own-filter');
    expect(own[0].textContent!.trim()).toBe('source:');
    own[0].click();
    await t.stable();
    expect(t.labels(0)).toEqual(['Lyon']);
  });
});

describe('ɵstarReorderPicked', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  it('moves a block of picked items one step or to an end', () => {
    expect(ɵstarReorderPicked(items, ['b', 'c'], 'up')).toEqual(['b', 'c', 'a', 'd', 'e']);
    expect(ɵstarReorderPicked(items, ['b', 'd'], 'down')).toEqual(['a', 'c', 'b', 'e', 'd']);
    expect(ɵstarReorderPicked(items, ['a', 'b'], 'up')).toEqual(items);
    expect(ɵstarReorderPicked(items, ['d', 'b'], 'top')).toEqual(['b', 'd', 'a', 'c', 'e']);
    expect(ɵstarReorderPicked(items, ['a', 'c'], 'bottom')).toEqual(['b', 'd', 'e', 'a', 'c']);
  });
});
