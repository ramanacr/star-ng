import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTreeTable, StarTreeTableColumn, StarTreeTableNode } from './tree-table';

const NODES: StarTreeTableNode[] = [
  {
    key: 'p1',
    label: 'Project 1',
    data: { name: 'Project 1', city: 'Lyon', hours: 40 },
    children: [{ key: 't1', label: 'Task 1', data: { name: 'Task 1', city: 'Lyon', hours: 8 } }],
  },
];

const COLUMNS: StarTreeTableColumn[] = [
  { field: 'city', header: 'City' },
  { field: 'hours', header: 'Hours' },
  { field: 'name', header: 'Project', frozen: true },
];

@Component({
  imports: [StarTreeTable],
  template: `
    <star-tree-table
      [nodes]="nodes"
      [columns]="columns"
      [expanded]="['p1']"
      resizableColumns
      reorderableColumns
      [(columnWidths)]="widths"
      [(columnOrder)]="order"
      ariaLabel="Projects"
    />
  `,
})
class Host {
  readonly nodes = NODES;
  readonly columns = COLUMNS;
  readonly widths = signal<Readonly<Record<string, number>>>({});
  readonly order = signal<readonly string[]>([]);
}

describe('tree table columns', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const headers = () =>
      [...el.querySelectorAll<HTMLElement>('thead th')].map((th) => th.dataset['field']);
    const th = (field: string) => el.querySelector<HTMLElement>(`thead th[data-field="${field}"]`)!;
    return { fixture, el, host: fixture.componentInstance, headers, th };
  }

  it('puts the frozen column first, sticky, with the tree toggle in it', async () => {
    const { el, headers, th } = await setup();
    expect(headers()).toEqual(['name', 'city', 'hours']);
    expect(th('name').classList).toContain('star-table__cell--frozen');
    expect(th('name').style.insetInlineStart).toBe('0px');
    const first = el.querySelector('tbody tr[data-key="p1"] td')!;
    expect(first.classList).toContain('star-table__cell--frozen');
    expect(first.querySelector('.star-tree-table__toggle')).not.toBeNull();
    // A frozen column has no move buttons and cannot be dragged.
    expect(th('name').querySelector('.star-tree-table__move')).toBeNull();
    expect(th('name').hasAttribute('draggable')).toBe(false);
  });

  it('moves a column with its buttons and keeps it out of the frozen columns', async () => {
    const { fixture, host, headers, th } = await setup();
    const earlier = th('city').querySelector<HTMLButtonElement>(
      'button[aria-label="Move City earlier"]',
    )!;
    expect(earlier.disabled).toBe(true);
    th('city').querySelector<HTMLButtonElement>('button[aria-label="Move City later"]')!.click();
    await fixture.whenStable();
    expect(host.order()).toEqual(['name', 'hours', 'city']);
    expect(headers()).toEqual(['name', 'hours', 'city']);
    expect(
      th('city').querySelector<HTMLButtonElement>('button[aria-label="Move City later"]')!.disabled,
    ).toBe(true);
    // Cells follow the header order.
    const cells = [
      ...fixture.nativeElement.querySelectorAll('tbody tr[data-key="t1"] td'),
    ] as HTMLElement[];
    expect(cells.map((td) => td.textContent?.trim())).toEqual(['Task 1', '8', 'Lyon']);
  });

  it('resizes a column with the arrow keys on its separator', async () => {
    const { fixture, host, th } = await setup();
    const handle = th('hours').querySelector<HTMLElement>('[role="separator"]')!;
    expect(handle.getAttribute('aria-label')).toBe('Resize Hours');
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(handle.getAttribute('aria-valuenow')).not.toBeNull();
    host.widths.set({ hours: 120 });
    await fixture.whenStable();
    expect(th('hours').style.width).toBe('120px');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(host.widths()).toEqual({ hours: 136 });
    expect(handle.getAttribute('aria-valuenow')).toBe('136');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await fixture.whenStable();
    expect(host.widths()).toEqual({ hours: 104 });
  });

  it('moves a column by drag and drop on the headers', async () => {
    const { fixture, host, th } = await setup();
    const drag = (target: HTMLElement, type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
      target.dispatchEvent(event);
    };
    drag(th('hours'), 'dragstart');
    drag(th('city'), 'dragover');
    drag(th('city'), 'drop');
    await fixture.whenStable();
    expect(host.order()).toEqual(['name', 'hours', 'city']);
  });
});
