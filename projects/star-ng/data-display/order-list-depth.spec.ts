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

  it('selects several items: Ctrl or Cmd toggles, Shift selects a range, Space toggles', async () => {
    const t = await setup();
    const click = (i: number, init: MouseEventInit = {}) =>
      t.options()[i].dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));
    expect(t.el.querySelector('[role=listbox]')!.getAttribute('aria-multiselectable')).toBe('true');
    click(0);
    click(2, { ctrlKey: true });
    await t.stable();
    expect(t.host.selection()).toEqual(['Plan', 'Test']);
    click(0, { metaKey: true });
    await t.stable();
    expect(t.host.selection()).toEqual(['Test']);
    click(1);
    click(3, { shiftKey: true });
    await t.stable();
    expect(t.host.selection()).toEqual(['Build', 'Test', 'Ship']);
    click(0);
    t.options()[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }),
    );
    await t.stable();
    expect(t.host.selection()).toEqual(['Plan', 'Build']);
    t.options()[3].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await t.stable();
    expect(t.host.selection()).toEqual(['Plan', 'Build', 'Ship']);
    t.options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await t.stable();
    expect(t.host.selection()).toEqual(['Build', 'Ship']);
  });

  it('keeps a Shift range inside the shown items and does not toggle while disabled', async () => {
    const t = await setup((h) => {
      h.filter.set(true);
      h.steps.set(['Pack', 'Build', 'Plan', 'Print']);
    });
    const input = t.el.querySelector<HTMLInputElement>('input[type=search]')!;
    input.value = 'p';
    input.dispatchEvent(new Event('input'));
    await t.stable();
    const shown = t.labels();
    expect(shown).toEqual(['Pack', 'Plan', 'Print']);
    t.options()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    t.options()[2].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    await t.stable();
    // Build is hidden by the filter, so the range leaves it out.
    expect(t.host.selection()).toEqual(shown);
    t.host.disabled.set(true);
    await t.stable();
    t.options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await t.stable();
    expect(t.host.selection()).toEqual(shown);
  });

  it('forgets a pointer press that ends without a click', async () => {
    const t = await setup();
    t.options()[1].dispatchEvent(new Event('pointerdown', { bubbles: true }));
    t.options()[1].dispatchEvent(new Event('pointerup', { bubbles: true }));
    t.options()[2].focus();
    await t.stable();
    expect(t.host.selection()).toEqual(['Test']);
    t.options()[2].blur();
  });

  it('moves every selected item and keeps their order', async () => {
    const t = await setup((h) => h.selection.set(['Ship', 'Build']));
    expect(t.options().map((o) => o.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
      'true',
    ]);
    t.button('Move up').click();
    await t.stable();
    expect(t.host.steps()).toEqual(['Build', 'Plan', 'Ship', 'Test']);
    expect(t.host.moves.at(-1)).toEqual({ items: ['Build', 'Ship'] });
    expect(t.button('Move up').disabled).toBe(false);
    t.button('Move to bottom').click();
    await t.stable();
    expect(t.host.steps()).toEqual(['Plan', 'Test', 'Build', 'Ship']);
    expect(t.button('Move down').disabled).toBe(true);
    expect(t.host.selection()).toEqual(['Ship', 'Build']);
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
