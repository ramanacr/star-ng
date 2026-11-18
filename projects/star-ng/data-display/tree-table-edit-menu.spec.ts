import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StarMenuItem } from '@star-ng/ui/menu';
import {
  StarTreeTable,
  StarTreeTableCellEditEvent,
  StarTreeTableColumn,
  StarTreeTableContextMenuEvent,
  StarTreeTableNode,
} from './tree-table';

// Orders with their lines.
const NODES: StarTreeTableNode[] = [
  {
    key: 'o1',
    label: 'Order 1001',
    data: { name: 'Order 1001', qty: 3, note: 'Express' },
    children: [{ key: 'l1', label: 'Line 1', data: { name: 'Line 1', qty: 1, note: '' } }],
  },
  { key: 'o2', label: 'Order 1002', data: { name: 'Order 1002', qty: 5, note: 'Gift' } },
];

const COLUMNS: StarTreeTableColumn[] = [
  { field: 'name', header: 'Order' },
  { field: 'qty', header: 'Quantity', editable: true, editor: 'number' },
  { field: 'note', header: 'Note', editable: (node) => node.key !== 'o2' },
];

const MENU: StarMenuItem[] = [{ label: 'Open' }, { label: 'Archive' }];

@Component({
  imports: [StarTreeTable],
  template: `
    <star-tree-table
      [nodes]="nodes"
      [columns]="columns()"
      [cellNavigation]="cells()"
      [(expanded)]="open"
      [contextMenu]="menu()"
      (cellEdit)="edits.push($event)"
      (contextMenuSelect)="chosen.push($event)"
      ariaLabel="Orders"
    />
  `,
})
class Host {
  readonly nodes = NODES;
  readonly columns = signal<readonly StarTreeTableColumn[]>(COLUMNS);
  readonly open = signal<readonly string[]>(['o1']);
  readonly menu = signal<readonly StarMenuItem[]>([]);
  readonly cells = signal<boolean | undefined>(undefined);
  readonly edits: StarTreeTableCellEditEvent[] = [];
  readonly chosen: StarTreeTableContextMenuEvent[] = [];
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const row = (key: string) => el.querySelector<HTMLElement>(`tbody tr[data-key="${key}"]`)!;
  const cell = (key: string, col: number) =>
    row(key).querySelector<HTMLElement>(`td[data-col="${col}"]`)!;
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const press = async (key: string, init: KeyboardEventInit = {}) => {
    (document.activeElement ?? el).dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
    );
    await settle();
  };
  return { fixture, el, host: fixture.componentInstance, row, cell, press, settle };
}

describe('tree table cell navigation', () => {
  it('Right moves from an open branch or a leaf into the row, Left goes back', async () => {
    const { row, cell, press } = await setup();
    row('o1').focus();
    expect(cell('o1', 0).getAttribute('tabindex')).toBe('-1');
    await press('ArrowRight');
    expect(document.activeElement).toBe(cell('o1', 0));
    expect(cell('o1', 0).getAttribute('tabindex')).toBe('0');
    expect(row('o1').getAttribute('tabindex')).toBe('-1');
    await press('ArrowRight');
    expect(document.activeElement).toBe(cell('o1', 1));
    await press('End');
    expect(document.activeElement).toBe(cell('o1', 2));
    await press('ArrowDown');
    expect(document.activeElement).toBe(cell('l1', 2));
    await press('Home');
    expect(document.activeElement).toBe(cell('l1', 0));
    await press('ArrowLeft');
    expect(document.activeElement).toBe(row('l1'));
    await press('ArrowLeft');
    expect(document.activeElement).toBe(row('o1'));
  });

  it('cellNavigation false turns the cell focus off, also with editable columns', async () => {
    const { host, fixture, row, cell, press } = await setup();
    host.cells.set(false);
    await fixture.whenStable();
    expect(cell('o1', 0).hasAttribute('tabindex')).toBe(false);
    row('o2').focus();
    await press('ArrowRight');
    expect(document.activeElement).toBe(row('o2'));
  });

  it('cellNavigation true turns the cell focus on without editable columns', async () => {
    const { host, fixture, row, cell, press } = await setup();
    host.columns.set([
      { field: 'name', header: 'Order' },
      { field: 'qty', header: 'Quantity' },
    ]);
    host.cells.set(true);
    await fixture.whenStable();
    row('o2').focus();
    await press('ArrowRight');
    expect(document.activeElement).toBe(cell('o2', 0));
    await press('ArrowRight');
    expect(document.activeElement).toBe(cell('o2', 1));
    // No editable column: F2 opens nothing.
    await press('F2');
    expect(document.querySelector('.star-tree-table__editor')).toBeNull();
  });

  it('right-to-left: Arrow left moves into the row and to the next cell, Arrow right back', async () => {
    const { row, cell, press, fixture } = await setup();
    const host = fixture.nativeElement as HTMLElement;
    host.setAttribute('dir', 'rtl');
    row('o2').focus();
    await press('ArrowLeft'); // a leaf: into the row
    expect(document.activeElement).toBe(cell('o2', 0));
    await press('ArrowLeft');
    expect(document.activeElement).toBe(cell('o2', 1));
    await press('ArrowRight');
    expect(document.activeElement).toBe(cell('o2', 0));
    await press('ArrowRight'); // first cell: back to the row
    expect(document.activeElement).toBe(row('o2'));
    // Row mode: Arrow right closes an open branch, then goes to the parent.
    row('o1').focus();
    await press('ArrowRight');
    expect(row('o1').getAttribute('aria-expanded')).toBe('false');
    host.removeAttribute('dir');
  });

  it('automatic (not set): without editable columns the cells take no focus', async () => {
    const { host, fixture, row, cell, press } = await setup();
    host.columns.set([{ field: 'name', header: 'Order' }]);
    await fixture.whenStable();
    expect(cell('o1', 0).hasAttribute('tabindex')).toBe(false);
    row('o2').focus();
    await press('ArrowRight');
    expect(document.activeElement).toBe(row('o2'));
  });
});

describe('tree table cell edit', () => {
  it('F2 edits the cell, Enter commits a number and emits cellEdit', async () => {
    const { el, host, cell, press } = await setup();
    cell('o1', 1).focus();
    await press('F2');
    const input = el.querySelector<HTMLInputElement>('.star-tree-table__editor')!;
    expect(input.type).toBe('number');
    expect(input.getAttribute('aria-label')).toBe('Edit Quantity');
    expect(document.activeElement).toBe(input);
    // The cell in edit is no focus target of its own: the editor is.
    expect(cell('o1', 1).hasAttribute('tabindex')).toBe(false);
    input.value = '7';
    await press('Enter');
    expect(el.querySelector('.star-tree-table__editor')).toBeNull();
    expect(host.edits).toEqual([{ node: NODES[0], field: 'qty', value: 7, previous: 3 }]);
    expect(document.activeElement).toBe(cell('o1', 1));
    // The table never changes the nodes.
    expect(NODES[0].data?.['qty']).toBe(3);
  });

  it('Escape cancels without an event', async () => {
    const { el, host, cell, press } = await setup();
    cell('o1', 2).focus();
    await press('Enter');
    const input = el.querySelector<HTMLInputElement>('.star-tree-table__editor')!;
    expect(input.value).toBe('Express');
    input.value = 'Standard';
    await press('Escape');
    expect(el.querySelector('.star-tree-table__editor')).toBeNull();
    expect(host.edits).toEqual([]);
    expect(document.activeElement).toBe(cell('o1', 2));
  });

  it('Enter on the row edits its first editable cell; an editable function can say no', async () => {
    const { el, row, press } = await setup();
    row('o2').focus();
    await press('Enter');
    expect(el.querySelector('.star-tree-table__editor')!.getAttribute('aria-label')).toBe(
      'Edit Quantity',
    );
    await press('Escape');
    const note = row('o2').querySelector<HTMLElement>('td[data-col="2"]')!;
    note.focus();
    await press('F2');
    expect(el.querySelector('.star-tree-table__editor')).toBeNull();
  });

  it('keys in the editor do not move the row focus, and an unchanged value emits nothing', async () => {
    const { el, host, cell, press } = await setup();
    cell('l1', 2).focus();
    await press('F2');
    const input = el.querySelector<HTMLInputElement>('.star-tree-table__editor')!;
    await press('ArrowUp');
    await press(' ');
    expect(document.activeElement).toBe(input);
    await press('Enter');
    expect(host.edits).toEqual([]);
  });
});

describe('tree table context menu', () => {
  it('right click on a row opens the menu and a choice emits the node and the item', async () => {
    const { host, fixture, row, settle } = await setup();
    host.menu.set(MENU);
    await fixture.whenStable();
    row('o2').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }),
    );
    await settle();
    const items = [...document.querySelectorAll<HTMLElement>('.star-menu [role="menuitem"]')];
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Open', 'Archive']);
    items[1].click();
    await settle();
    expect(host.chosen).toEqual([{ node: NODES[1], item: MENU[1] }]);
  });

  it('Shift+F10 and the context menu key open the menu on the focused row', async () => {
    const { host, fixture, row, press, settle } = await setup();
    host.menu.set(MENU);
    await fixture.whenStable();
    row('l1').focus();
    await press('F10', { shiftKey: true });
    let items = [...document.querySelectorAll<HTMLElement>('.star-menu [role="menuitem"]')];
    expect(items.length).toBe(2);
    items[0].click();
    await settle();
    expect(host.chosen[0].node).toBe(NODES[0].children![0]);
    row('o2').focus();
    await press('ContextMenu');
    items = [...document.querySelectorAll<HTMLElement>('.star-menu [role="menuitem"]')];
    items[0].click();
    await settle();
    expect(host.chosen[1]).toEqual({ node: NODES[1], item: MENU[0] });
  });

  it('without items the table leaves the browser menu alone', async () => {
    const { row } = await setup();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    row('o1').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
