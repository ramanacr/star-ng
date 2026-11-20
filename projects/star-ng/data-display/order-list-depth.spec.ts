import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEmptyTemplate, StarHeaderTemplate, StarIconTemplate } from '@star-ng/ui/core';
import { StarListFilterEvent, StarListItemsEvent } from './data-display-slots';
import { StarOrderList } from './order-list';

@Component({
  imports: [StarOrderList, StarHeaderTemplate, StarEmptyTemplate, StarIconTemplate],
  template: `
    <star-order-list
      [(value)]="steps"
      [(selection)]="selection"
      [header]="header()"
      [filter]="filter()"
      filterMatchMode="startsWith"
      [disabled]="disabled()"
      [stripedRows]="striped()"
      [scrollHeight]="height()"
      [dragdrop]="drag()"
      [controlsPosition]="position()"
      (reorder)="moves.push($event)"
      (listFilter)="filters.push($event)"
    >
      @if (slots()) {
        <ng-template starHeader><b class="head">Steps</b></ng-template>
        <ng-template starEmpty let-query
          ><i class="none">none:{{ query }}</i></ng-template
        >
        <ng-template starIcon="moveUp"><b class="up">up</b></ng-template>
      }
    </star-order-list>
  `,
})
class Host {
  readonly steps = signal<readonly string[]>(['Plan', 'Build', 'Test', 'Ship']);
  readonly selection = signal<readonly string[]>([]);
  readonly header = signal<string | null>(null);
  readonly filter = signal(false);
  readonly disabled = signal(false);
  readonly striped = signal(false);
  readonly height = signal<string | null>(null);
  readonly drag = signal(false);
  readonly position = signal<'start' | 'end'>('start');
  readonly slots = signal(false);
  readonly moves: StarListItemsEvent<string>[] = [];
  readonly filters: StarListFilterEvent<string>[] = [];
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const options = () => [...el.querySelectorAll<HTMLElement>('[role=option]')];
  const labels = () => options().map((o) => o.textContent!.trim());
  const button = (label: string) => el.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  return {
    el,
    host: fixture.componentInstance,
    options,
    labels,
    button,
    stable: () => fixture.whenStable(),
  };
}

describe('StarOrderList depth', () => {
  it('syncs the selection model both ways and emits reorder', async () => {
    const t = await setup();
    t.options()[2].click();
    await t.stable();
    expect(t.host.selection()).toEqual(['Test']);
    t.button('Move up').click();
    await t.stable();
    expect(t.host.steps()).toEqual(['Plan', 'Test', 'Build', 'Ship']);
    expect(t.host.moves).toEqual([{ items: ['Test'] }]);
    t.host.selection.set(['Ship']);
    await t.stable();
    expect(t.options()[3].getAttribute('aria-selected')).toBe('true');
    t.button('Move to top').click();
    await t.stable();
    expect(t.host.steps()).toEqual(['Ship', 'Plan', 'Test', 'Build']);
  });

  it('names the list by its header', async () => {
    const t = await setup((h) => h.header.set('Release steps'));
    const header = t.el.querySelector('.star-order-list__header')!;
    expect(header.textContent!.trim()).toBe('Release steps');
    expect(t.el.querySelector('[role=listbox]')!.getAttribute('aria-labelledby')).toBe(header.id);
  });

  it('filters the items and shows the empty message', async () => {
    const t = await setup((h) => h.filter.set(true));
    const input = t.el.querySelector<HTMLInputElement>('input[type=search]')!;
    input.value = 't';
    input.dispatchEvent(new Event('input'));
    await t.stable();
    expect(t.labels()).toEqual(['Test']);
    expect(t.host.filters.at(-1)).toEqual({ query: 't', value: ['Test'] });
    input.value = 'x';
    input.dispatchEvent(new Event('input'));
    await t.stable();
    expect(t.el.querySelector('.star-order-list__empty')!.textContent!.trim()).toBe(
      'No results found',
    );
  });

  it('turns everything off with disabled, and applies stripedRows, scrollHeight and controlsPosition', async () => {
    const t = await setup((h) => {
      h.disabled.set(true);
      h.striped.set(true);
      h.height.set('9rem');
      h.position.set('end');
    });
    const list = t.el.querySelector<HTMLElement>('[role=listbox]')!;
    expect(list.getAttribute('aria-disabled')).toBe('true');
    expect(list.classList).toContain('star-order-list__list--striped');
    expect(list.style.maxHeight).toBe('9rem');
    expect(t.el.querySelector('star-order-list')!.classList).toContain(
      'star-order-list--controls-end',
    );
    t.options()[1].click();
    await t.stable();
    expect(t.host.selection()).toEqual([]);
    expect(t.button('Move up').disabled).toBe(true);
  });

  it('reorders by drag and drop', async () => {
    const t = await setup((h) => h.drag.set(true));
    const [plan, , test] = t.options();
    expect(plan.getAttribute('draggable')).toBe('true');
    plan.dispatchEvent(new Event('dragstart', { bubbles: true }));
    test.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    await t.stable();
    expect(t.host.steps()).toEqual(['Build', 'Test', 'Plan', 'Ship']);
    expect(t.host.moves).toEqual([{ items: ['Plan'] }]);
    t.options()[0].dispatchEvent(new Event('dragstart', { bubbles: true }));
    t.el
      .querySelector('[role=listbox]')!
      .dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    await t.stable();
    expect(t.host.steps()).toEqual(['Test', 'Plan', 'Ship', 'Build']);
  });

  it('renders the header, empty and icon slots', async () => {
    const t = await setup((h) => {
      h.slots.set(true);
      h.steps.set([]);
    });
    expect(t.el.querySelector('.head')!.textContent).toBe('Steps');
    expect(t.el.querySelector('.none')!.textContent).toBe('none:');
    expect(t.el.querySelector('.up')!.closest('[aria-hidden=true]')).not.toBeNull();
  });
});
