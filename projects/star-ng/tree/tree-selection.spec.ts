import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StarMenuItem } from '@star-ng/ui/menu';
import { StarTree, StarTreeContextMenuEvent, StarTreeNode, StarTreeNodeEvent } from './tree';
import { toggleChecked } from './tree-model';

const NODES: StarTreeNode[] = [
  {
    key: 'eng',
    label: 'Engineering',
    children: [
      { key: 'web', label: 'Web' },
      { key: 'ops', label: 'Operations' },
      { key: 'sec', label: 'Security', disabled: true },
    ],
  },
  {
    key: 'fin',
    label: 'Finance',
    children: [
      { key: 'pay', label: 'Payroll' },
      { key: 'tax', label: 'Tax', selectable: false },
    ],
  },
];

const MENU: StarMenuItem[] = [{ label: 'Rename' }, { label: 'Archive' }];

@Component({
  imports: [StarTree],
  template: `
    <star-tree
      [nodes]="nodes"
      [selectionMode]="mode()"
      [(value)]="value"
      [expanded]="['eng', 'fin']"
      [propagateSelectionUp]="up()"
      [propagateSelectionDown]="down()"
      [contextMenu]="menu()"
      ariaLabel="Departments"
      (nodeSelect)="selected.push($event.key)"
      (nodeUnselect)="unselected.push($event.key)"
      (nodeDoubleClick)="doubles.push($event)"
      (nodeContextMenu)="contexts.push($event)"
      (contextMenuSelect)="chosen.push($event)"
    />
  `,
})
class SelectionHost {
  readonly nodes = NODES;
  readonly mode = signal<'single' | 'multiple' | 'checkbox'>('checkbox');
  readonly value = signal<readonly string[]>([]);
  readonly up = signal(true);
  readonly down = signal(true);
  readonly menu = signal<readonly StarMenuItem[]>([]);
  readonly selected: string[] = [];
  readonly unselected: string[] = [];
  readonly doubles: StarTreeNodeEvent[] = [];
  readonly contexts: StarTreeNodeEvent[] = [];
  readonly chosen: StarTreeContextMenuEvent[] = [];
}

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

async function setup() {
  const fixture = TestBed.createComponent(SelectionHost);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const row = (key: string) => el.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const press = async (target: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
    );
    await settle();
  };
  return { fixture, host: fixture.componentInstance, row, settle, press };
}

describe('StarTree selection propagation', () => {
  it('both propagations (the default) keep leaf keys and skip locked nodes', async () => {
    const { host, row, settle } = await setup();
    row('eng').click();
    await settle();
    expect(host.value()).toEqual(['web', 'ops']);
    expect(row('eng').getAttribute('aria-checked')).toBe('true');
    expect(row('sec').getAttribute('aria-checked')).toBe('false');
    row('web').click();
    await settle();
    expect(host.value()).toEqual(['ops']);
    expect(row('eng').getAttribute('aria-checked')).toBe('mixed');
    expect(host.selected).toEqual(['eng']);
    expect(host.unselected).toEqual(['web']);
  });

  it('a locked node keeps its state and cannot be toggled', async () => {
    const { host, fixture, row, settle } = await setup();
    host.value.set(['tax']);
    await fixture.whenStable();
    row('fin').click();
    await settle();
    expect(host.value()).toEqual(['tax', 'pay']);
    row('fin').click();
    await settle();
    expect(host.value()).toEqual(['tax']);
    row('tax').click();
    row('sec').click();
    await settle();
    expect(host.value()).toEqual(['tax']);
  });

  it('without propagation down a parent checks only itself', async () => {
    const { host, fixture, row, settle } = await setup();
    host.down.set(false);
    await fixture.whenStable();
    row('eng').click();
    await settle();
    expect(host.value()).toEqual(['eng']);
    expect(row('web').getAttribute('aria-checked')).toBe('false');
    // Propagation up still runs: the parent turns off with one child, on with all.
    row('web').click();
    await settle();
    expect(host.value()).toEqual(['web']);
    row('ops').click();
    await settle();
    expect(host.value()).toEqual(['web', 'ops', 'eng']);
  });

  it('without propagation up a parent shows no mixed state', async () => {
    const { host, fixture, row, settle } = await setup();
    host.up.set(false);
    await fixture.whenStable();
    row('web').click();
    await settle();
    expect(host.value()).toEqual(['web']);
    expect(row('eng').getAttribute('aria-checked')).toBe('false');
    row('ops').click();
    await settle();
    expect(row('eng').getAttribute('aria-checked')).toBe('false');
  });

  it('toggleChecked keeps a locked ancestor and its locked subtree', () => {
    const next = toggleChecked(NODES, 'eng', true, ['sec'], { up: true, down: true });
    expect(next).toEqual(['sec', 'eng', 'web', 'ops']);
  });

  it('multiple mode emits nodeUnselect when a node turns off', async () => {
    const { host, fixture, row, settle } = await setup();
    host.mode.set('multiple');
    await fixture.whenStable();
    row('web').click();
    row('web').click();
    await settle();
    expect(host.value()).toEqual([]);
    expect(host.selected).toEqual(['web']);
    expect(host.unselected).toEqual(['web']);
  });

  it('emits nodeDoubleClick with the node', async () => {
    const { host, row } = await setup();
    row('ops').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(host.doubles.map((e) => e.node.key)).toEqual(['ops']);
  });
});

describe('StarTree context menu', () => {
  const items = () => [...document.querySelectorAll<HTMLElement>('.star-menu [role="menuitem"]')];

  it('right click opens the menu; a choice emits the node and the item', async () => {
    const { host, fixture, row, settle } = await setup();
    host.menu.set(MENU);
    await fixture.whenStable();
    row('web').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }),
    );
    await settle();
    expect(host.contexts.map((e) => e.node.key)).toEqual(['web']);
    expect(items().map((i) => i.textContent?.trim())).toEqual(['Rename', 'Archive']);
    items()[1].click();
    await settle();
    expect(host.chosen).toEqual([{ node: NODES[0].children![0], item: MENU[1] }]);
  });

  it('Shift+F10 and the context menu key open the menu on the focused node', async () => {
    const { host, fixture, row, press, settle } = await setup();
    host.menu.set(MENU);
    await fixture.whenStable();
    row('pay').focus();
    await press(row('pay'), 'F10', { shiftKey: true });
    expect(items().length).toBe(2);
    items()[0].click();
    await settle();
    expect(host.chosen[0]).toEqual({ node: NODES[1].children![0], item: MENU[0] });
    row('fin').focus();
    await press(row('fin'), 'ContextMenu');
    items()[0].click();
    await settle();
    expect(host.chosen[1].node).toBe(NODES[1]);
  });

  it('without items the browser menu stays, and nodeContextMenu still fires', async () => {
    const { host, row } = await setup();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    row('ops').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(host.contexts.map((e) => e.node.key)).toEqual(['ops']);
  });
});
