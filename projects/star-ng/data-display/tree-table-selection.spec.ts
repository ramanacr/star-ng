import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarTreeTable,
  StarTreeTableColumn,
  StarTreeTableNode,
  StarTreeTableNodeEvent,
} from './tree-table';

// Projects with tasks.
const NODES: StarTreeTableNode[] = [
  {
    key: 'web',
    label: 'Website',
    data: { name: 'Website' },
    children: [
      { key: 'w1', label: 'Layout', data: { name: 'Layout' } },
      {
        key: 'w2',
        label: 'Content',
        data: { name: 'Content' },
        children: [
          { key: 'w2a', label: 'Texts', data: { name: 'Texts' } },
          { key: 'w2b', label: 'Images', data: { name: 'Images' } },
        ],
      },
    ],
  },
  { key: 'app', label: 'App', data: { name: 'App' }, selectable: false },
];

const COLUMNS: StarTreeTableColumn[] = [{ field: 'name', header: 'Project' }];

@Component({
  imports: [StarTreeTable],
  template: `
    <star-tree-table
      [nodes]="nodes"
      [columns]="columns"
      [expanded]="['web', 'w2']"
      [selectionMode]="mode()"
      [(selection)]="selection"
      [propagateSelectionUp]="up()"
      [propagateSelectionDown]="down()"
      (nodeSelect)="events.push('select:' + $event.node.key)"
      (nodeUnselect)="events.push('unselect:' + $event.node.key)"
      ariaLabel="Projects"
    />
  `,
})
class Host {
  readonly nodes = NODES;
  readonly columns = COLUMNS;
  readonly mode = signal<'single' | 'multiple' | 'checkbox' | null>('checkbox');
  readonly selection = signal<readonly string[]>([]);
  readonly up = signal(true);
  readonly down = signal(true);
  readonly events: string[] = [];
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const row = (key: string) => el.querySelector<HTMLElement>(`tbody tr[data-key="${key}"]`)!;
  const check = (key: string) => row(key).querySelector<HTMLElement>('[role="checkbox"]')!;
  const press = async (target: Element, key: string, init: KeyboardEventInit = {}) => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
    );
    await fixture.whenStable();
  };
  return {
    fixture,
    el,
    host: fixture.componentInstance,
    row,
    check,
    press,
    stable: () => fixture.whenStable(),
  };
}

describe('tree table checkbox selection', () => {
  it('checks a branch with its descendants and shows mixed ancestors', async () => {
    const { el, host, check, row, stable } = await setup();
    expect(el.querySelector('table')!.getAttribute('aria-multiselectable')).toBe('true');
    expect(check('w2').getAttribute('aria-checked')).toBe('false');
    expect(check('w2').getAttribute('aria-label')).toBe('Content');
    check('w2').click();
    await stable();
    expect([...host.selection()].sort()).toEqual(['w2', 'w2a', 'w2b']);
    expect(check('w2').getAttribute('aria-checked')).toBe('true');
    expect(check('w2a').getAttribute('aria-checked')).toBe('true');
    expect(check('web').getAttribute('aria-checked')).toBe('mixed');
    expect(row('web').getAttribute('aria-selected')).toBe('false');
    expect(row('w2').getAttribute('aria-selected')).toBe('true');
    expect(host.events).toEqual(['select:w2']);
  });

  it('checks the parent when the last child is checked, and unchecks it again', async () => {
    const { host, check, stable } = await setup();
    check('w2').click();
    check('w1').click();
    await stable();
    expect(check('web').getAttribute('aria-checked')).toBe('true');
    check('w2a').click();
    await stable();
    expect(check('w2a').getAttribute('aria-checked')).toBe('false');
    expect(check('w2').getAttribute('aria-checked')).toBe('mixed');
    expect(check('web').getAttribute('aria-checked')).toBe('mixed');
    expect([...host.selection()].sort()).toEqual(['w1', 'w2b']);
    expect(host.events.at(-1)).toBe('unselect:w2a');
  });

  it('Space on a row toggles its check, and a click on the row too', async () => {
    const { host, row, press, stable } = await setup();
    await press(row('w1'), ' ');
    expect(host.selection()).toEqual(['w1']);
    row('w1').querySelector('td')!.click();
    await stable();
    expect(host.selection()).toEqual([]);
  });

  it('without propagation only the node changes and no parent is mixed', async () => {
    const { host, check, stable } = await setup();
    host.up.set(false);
    host.down.set(false);
    await stable();
    check('w2').click();
    await stable();
    expect(host.selection()).toEqual(['w2']);
    expect(check('w2a').getAttribute('aria-checked')).toBe('false');
    expect(check('web').getAttribute('aria-checked')).toBe('false');
  });

  it('a node with selectable false does not change', async () => {
    const { host, check, stable } = await setup();
    check('app').click();
    await stable();
    expect(host.selection()).toEqual([]);
    expect(host.events).toEqual([]);
  });
});

describe('tree table row selection', () => {
  it('single: a click selects one row, a second click unselects it', async () => {
    const { el, host, row, stable } = await setup();
    host.mode.set('single');
    await stable();
    expect(el.querySelector('[role="checkbox"]')).toBeNull();
    expect(el.querySelector('table')!.hasAttribute('aria-multiselectable')).toBe(false);
    row('w1').querySelector('td')!.click();
    await stable();
    expect(host.selection()).toEqual(['w1']);
    expect(row('w1').getAttribute('aria-selected')).toBe('true');
    expect(row('w1').classList).toContain('star-table__row--selected');
    row('w2').querySelector('td')!.click();
    await stable();
    expect(host.selection()).toEqual(['w2']);
    row('w2').querySelector('td')!.click();
    await stable();
    expect(host.selection()).toEqual([]);
    expect(host.events).toEqual(['select:w1', 'select:w2', 'unselect:w2']);
  });

  it('multiple: Space toggles each row and keeps the others', async () => {
    const { host, row, press, stable } = await setup();
    host.mode.set('multiple');
    await stable();
    await press(row('w1'), ' ');
    await press(row('w2a'), ' ');
    expect(host.selection()).toEqual(['w1', 'w2a']);
    await press(row('w1'), ' ');
    expect(host.selection()).toEqual(['w2a']);
  });

  it('a click on the toggle opens the row and does not select it', async () => {
    const { host, row, stable } = await setup();
    host.mode.set('single');
    await stable();
    row('w2').querySelector<HTMLElement>('.star-tree-table__toggle')!.click();
    await stable();
    expect(host.selection()).toEqual([]);
    expect(row('w2').getAttribute('aria-expanded')).toBe('false');
  });

  it('without selectionMode rows have no aria-selected', async () => {
    const { host, row, press, stable } = await setup();
    host.mode.set(null);
    await stable();
    await press(row('w1'), ' ');
    expect(row('w1').hasAttribute('aria-selected')).toBe(false);
    expect(host.selection()).toEqual([]);
  });

  it('emits the node as it is in nodes', async () => {
    const fixture = TestBed.createComponent(StarTreeTable);
    fixture.componentRef.setInput('nodes', NODES);
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('selectionMode', 'single');
    const seen: StarTreeTableNodeEvent[] = [];
    fixture.componentInstance.nodeSelect.subscribe((event) => seen.push(event));
    await fixture.whenStable();
    fixture.componentInstance.toggleSelection(NODES[0]);
    expect(seen[0].node).toBe(NODES[0]);
  });
});
