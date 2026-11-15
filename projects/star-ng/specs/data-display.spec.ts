import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarOrderList, StarPickList, StarTreeTable } from '@star-ng/ui/data-display';

function key(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

@Component({
  imports: [StarTreeTable, StarOrderList, StarPickList],
  template: `
    <star-tree-table
      [nodes]="nodes"
      [columns]="[
        { field: 'name', header: 'Name' },
        { field: 'n', header: 'N' },
      ]"
      [(expanded)]="open"
      ariaLabel="Tree"
    />
    <star-order-list [(value)]="order" ariaLabel="Order" />
    <star-pick-list [(source)]="source" [(target)]="target" />
  `,
})
class DataHost {
  readonly nodes = [
    {
      key: 'p',
      label: 'Parent',
      data: { name: 'Parent', n: 3 },
      children: [{ key: 'c', label: 'Child', data: { name: 'Child', n: 3 } }],
    },
  ];
  readonly open = signal<readonly string[]>([]);
  readonly order = signal<readonly string[]>(['a', 'b', 'c']);
  readonly source = signal<readonly string[]>(['x', 'y']);
  readonly target = signal<readonly string[]>([]);
}

describe('Tree table, order list, pick list', () => {
  it('tree table expands with ArrowRight and exposes treegrid levels', async () => {
    const fixture = TestBed.createComponent(DataHost);
    await fixture.whenStable();
    const grid = (fixture.nativeElement as HTMLElement).querySelector('[role=treegrid]')!;
    const first = grid.querySelector<HTMLElement>('tbody tr')!;
    expect(first.getAttribute('aria-expanded')).toBe('false');
    key(first, 'ArrowRight');
    await fixture.whenStable();
    const rows = grid.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[1].getAttribute('aria-level')).toBe('2');
  });

  it('order list moves the selected item with Alt+Arrow', async () => {
    const fixture = TestBed.createComponent(DataHost);
    await fixture.whenStable();
    const options = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      'star-order-list [role=option]',
    );
    options[2].dispatchEvent(new Event('focus'));
    key(options[2], 'ArrowUp', { altKey: true });
    await fixture.whenStable();
    expect(fixture.componentInstance.order()).toEqual(['a', 'c', 'b']);
  });

  it('pick list transfers selected and all items', async () => {
    const fixture = TestBed.createComponent(DataHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLElement>('star-pick-list [role=option]')!.click();
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('[aria-label="Move selected to target"]')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.target()).toEqual(['x']);
    el.querySelector<HTMLButtonElement>('[aria-label="Move all to source"]')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.source()).toEqual(['y', 'x']);
  });
});
