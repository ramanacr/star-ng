import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEmptyTemplate, StarFooterTemplate, StarHeaderTemplate } from '@star-ng/ui/core';
import { StarNodeTemplate, StarTree, StarTreeNode } from '@star-ng/ui/tree';
import { StarTreeTable, StarTreeTableColumn } from './tree-table';

type Row = Record<string, unknown>;

const NODES: StarTreeNode<Row>[] = [
  {
    key: 'eng',
    label: 'Engineering',
    data: { name: 'Engineering', staff: 42 },
    children: [{ key: 'web', label: 'Web', data: { name: 'Web', staff: 14 } }],
  },
  { key: 'fin', label: 'Finance', data: { name: 'Finance', staff: 9 } },
];

const COLUMNS: StarTreeTableColumn[] = [
  { field: 'name', header: 'Department' },
  { field: 'staff', header: 'Staff' },
];

@Component({
  imports: [
    StarTreeTable,
    StarTree,
    StarNodeTemplate,
    StarHeaderTemplate,
    StarFooterTemplate,
    StarEmptyTemplate,
  ],
  template: `
    <star-tree-table
      class="slotted"
      [nodes]="nodes"
      [columns]="columns"
      [(expanded)]="open"
      ariaLabel="Slotted"
    >
      <ng-template
        starNode
        [starNodeOf]="nodes"
        let-node
        let-level="level"
        let-on="expanded"
        let-sel="selected"
      >
        <b class="mine"
          >{{ node.label }}:{{ node.data?.['staff'] }}:{{ level }}:{{ on }}:{{ sel }}</b
        >
      </ng-template>
      <ng-template starHeader><i class="head">Head</i></ng-template>
      <ng-template starFooter><i class="foot">Foot</i></ng-template>
    </star-tree-table>

    <star-tree-table
      class="plain"
      [nodes]="nodes"
      [columns]="columns"
      [expanded]="['eng']"
      ariaLabel="Plain"
    />

    <star-tree-table class="none" [nodes]="[]" [columns]="columns" ariaLabel="None">
      <ng-template starEmpty let-text
        ><b class="nothing">Nothing [{{ text }}]</b></ng-template
      >
    </star-tree-table>

    <star-tree-table class="none-plain" [nodes]="[]" [columns]="columns" ariaLabel="None plain" />

    <star-tree-table
      class="none-windowed"
      [nodes]="[]"
      [columns]="columns"
      virtualScroll
      scrollHeight="10rem"
      ariaLabel="None windowed"
    >
      <ng-template starEmpty><b class="nothing">Empty</b></ng-template>
    </star-tree-table>

    <star-tree-table
      class="outer"
      [nodes]="nodes"
      [columns]="columns"
      [expanded]="['eng']"
      ariaLabel="Outer"
    >
      <star-tree [nodes]="nodes" ariaLabel="Inner">
        <ng-template starNode let-node
          ><b class="leak">{{ node.label }}</b></ng-template
        >
        <ng-template starHeader><i class="leak">Inner head</i></ng-template>
        <ng-template starFooter><i class="leak">Inner foot</i></ng-template>
        <ng-template starEmpty><i class="leak">Inner empty</i></ng-template>
      </star-tree>
      <ng-template starNode let-node
        ><b class="own">{{ node.label }}</b></ng-template
      >
    </star-tree-table>

    <star-tree-table
      class="windowed"
      [nodes]="nodes"
      [columns]="columns"
      [expanded]="['eng']"
      virtualScroll
      scrollHeight="10rem"
      [virtualItemSize]="40"
      ariaLabel="Windowed"
    >
      <ng-template starNode let-node
        ><b class="mine">{{ node.label }}</b></ng-template
      >
    </star-tree-table>
  `,
})
class Host {
  readonly nodes = NODES;
  readonly columns = COLUMNS;
  readonly open = signal<readonly string[]>(['eng']);
}

function key(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('tree table slots', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('starNode gets node, level, expanded and selected', async () => {
    const { el } = await setup();
    const texts = [...el.querySelectorAll('.slotted .mine')].map((n) => n.textContent);
    expect(texts).toEqual([
      'Engineering:42:1:true:false',
      'Web:14:2:false:false',
      'Finance:9:1:false:false',
    ]);
  });

  it('starNode replaces only the label in the first column', async () => {
    const { el } = await setup();
    const first = el.querySelector('.slotted tbody tr td')!;
    expect(first.querySelector('.star-tree-table__first .mine')).not.toBeNull();
    expect(first.querySelector('button.star-tree-table__toggle')).not.toBeNull();
    // The other columns keep the cell values.
    const cells = [...el.querySelectorAll('.slotted tbody tr:first-child td')].map((n) =>
      n.textContent?.trim(),
    );
    expect(cells[1]).toBe('42');
  });

  it('keeps the keys, the toggle and the ARIA attributes with starNode', async () => {
    const { fixture, el } = await setup();
    const rows = () => [...el.querySelectorAll<HTMLElement>('.slotted tbody tr')];
    expect(rows()[0].getAttribute('aria-level')).toBe('1');
    expect(rows()[0].getAttribute('aria-expanded')).toBe('true');
    expect(rows()[1].getAttribute('aria-level')).toBe('2');
    key(rows()[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toEqual([]);
    expect(rows().length).toBe(2);
    rows()[0].querySelector<HTMLElement>('button.star-tree-table__toggle')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toEqual(['eng']);
    expect(rows()[0].querySelector('.mine')?.textContent).toBe('Engineering:42:1:true:false');
  });

  it('header and footer render above and below the table', async () => {
    const { el } = await setup();
    const host = el.querySelector('.slotted')!;
    expect(host.querySelector('.head')?.textContent).toBe('Head');
    expect(host.querySelector('.foot')?.textContent).toBe('Foot');
    expect(host.firstElementChild).toBe(host.querySelector('.head'));
    expect(host.lastElementChild).toBe(host.querySelector('.foot'));
  });

  it('starEmpty renders one row over all columns and gets an empty text', async () => {
    const { el } = await setup();
    const cells = el.querySelectorAll('.none tbody td');
    expect(cells.length).toBe(1);
    expect(cells[0].getAttribute('colspan')).toBe('2');
    expect(cells[0].querySelector('.nothing')?.textContent).toBe('Nothing []');
  });

  it('starEmpty counts as a row in a windowed table', async () => {
    const { el } = await setup();
    const table = el.querySelector('.none-windowed [role=treegrid]')!;
    expect(table.getAttribute('aria-rowcount')).toBe('2');
    expect(table.querySelector('tbody tr')?.getAttribute('aria-rowindex')).toBe('2');
    expect(table.querySelector('.nothing')?.textContent).toBe('Empty');
  });

  it('shows no empty row without the slot', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('.none-plain tbody tr').length).toBe(0);
    expect(el.querySelector('.none-plain .star-table__empty')).toBeNull();
  });

  it('keeps default cell text unchanged without slots', async () => {
    const { el } = await setup();
    const cells = [...el.querySelectorAll('.plain tbody td')].map((n) => n.textContent);
    expect(cells).toEqual([' Engineering ', ' 42 ', ' Web ', ' 14 ', ' Finance ', ' 9 ']);
    expect(el.querySelector('.plain .head')).toBeNull();
  });

  it('does not use the slots of a control nested in the table', async () => {
    const { el } = await setup();
    const table = el.querySelector('.outer')!;
    expect([...table.querySelectorAll('tbody .own')].map((n) => n.textContent)).toEqual([
      'Engineering',
      'Web',
      'Finance',
    ]);
    // The inner tree is not projected by the table, and none of its slots shows in the table.
    expect(table.querySelector('.leak')).toBeNull();
    expect(table.querySelector('.star-table__empty')).toBeNull();
  });

  it('renders starNode in a windowed table with row indexes', async () => {
    const { el } = await setup();
    const rows = el.querySelectorAll<HTMLElement>('.windowed tbody tr[data-key]');
    expect(rows.length).toBe(3);
    expect(rows[0].querySelector('.mine')?.textContent).toBe('Engineering');
    expect(rows[0].getAttribute('aria-rowindex')).toBe('2');
  });
});
