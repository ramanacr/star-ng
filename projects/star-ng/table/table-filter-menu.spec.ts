import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarFilterService } from '@star-ng/ui/core';
import { StarColumn, StarColumnFilters, StarTable } from './table';

interface Invoice {
  id: number;
  customer: string;
  status: string;
  amount: number;
}

const INVOICES: Invoice[] = [
  { id: 1, customer: 'Málaga Trading', status: 'Paid', amount: 120 },
  { id: 2, customer: 'Berlin Supplies', status: 'Open', amount: 45 },
  { id: 3, customer: 'Zürich Office', status: 'Overdue', amount: 300 },
  { id: 4, customer: 'Oslo Parts', status: 'Open', amount: 80 },
];

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

@Component({
  imports: [StarTable],
  template: `
    <star-table
      [value]="rows"
      [columns]="columns"
      dataKey="id"
      filterDisplay="menu"
      [showApplyButton]="showApply()"
      [filterMaxRules]="3"
      [(filters)]="filters"
    />
  `,
})
class Host {
  readonly rows = INVOICES;
  readonly columns: StarColumn<Invoice>[] = [
    { field: 'customer', header: 'Customer', filter: 'text' },
    { field: 'status', header: 'Status', filter: 'multiselect' },
    { field: 'amount', header: 'Amount', filter: 'number' },
    { field: 'id', header: 'Invoice', filter: 'number', filterMatchModes: ['gt', 'lt', 'even'] },
  ];
  readonly filters = signal<StarColumnFilters>({});
  readonly showApply = signal(true);
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('StarTable filter menu', () => {
  async function setup(change?: (host: Host) => void) {
    TestBed.inject(StarFilterService).register('even', (v) => Number(v) % 2 === 0, 'Even');
    const fixture = TestBed.createComponent(Host);
    change?.(fixture.componentInstance);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const host = fixture.componentInstance;
    const stable = async () => {
      await fixture.whenStable();
      await settle();
      await fixture.whenStable();
    };
    const button = (field: string) =>
      el.querySelector<HTMLButtonElement>(`th[data-field="${field}"] .star-table__filter-button`)!;
    const dialog = () => document.querySelector<HTMLElement>('.star-popover');
    const open = async (field: string) => {
      button(field).click();
      await stable();
      return dialog()!;
    };
    const names = () =>
      [...el.querySelectorAll('tbody tr.star-table__row td:first-child')].map((cell) =>
        cell.textContent?.trim(),
      );
    const input = (target: HTMLInputElement | HTMLSelectElement, value: string) => {
      target.value = value;
      target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input'));
    };
    const press = (root: HTMLElement, text: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('button')]
        .find((b) => b.textContent?.trim() === text)!
        .click();
    return { fixture, el, host, button, dialog, open, names, input, press, stable };
  }

  it('shows a filter button per filter column instead of the filter row', async () => {
    const { el, button } = await setup();
    expect(el.querySelector('.star-table__filters')).toBeNull();
    const customer = button('customer');
    expect(customer.getAttribute('aria-haspopup')).toBe('dialog');
    expect(customer.getAttribute('aria-expanded')).toBe('false');
    expect(customer.getAttribute('aria-label')).toBe('Filter Customer');
  });

  it('opens a labelled dialog with the text modes, applies a rule and returns the focus', async () => {
    const { open, host, names, input, press, stable, button } = await setup();
    const dialog = await open('customer');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Filter Customer');
    expect(button('customer').getAttribute('aria-expanded')).toBe('true');
    expect(dialog.querySelector('[cdktrapfocus]')).toBeTruthy();
    const mode = dialog.querySelector<HTMLSelectElement>('select[aria-label="Match mode"]')!;
    expect([...mode.options].map((o) => o.textContent?.trim())).toEqual([
      'Contains',
      'Starts with',
      'Ends with',
      'Equals',
      'Does not contain',
    ]);
    input(mode, 'endsWith');
    input(
      dialog.querySelector<HTMLInputElement>('input[aria-label="Filter by Customer"]')!,
      'parts',
    );
    expect(host.filters()).toEqual({});
    press(dialog, 'Apply');
    await stable();
    expect(host.filters()).toEqual({
      customer: { operator: 'and', rules: [{ matchMode: 'endsWith', value: 'parts' }] },
    });
    expect(names()).toEqual(['Oslo Parts']);
    expect(document.querySelector('.star-popover')).toBeNull();
    expect(document.activeElement).toBe(button('customer'));
    expect(button('customer').getAttribute('aria-label')).toBe('Filter Customer, active');
  });

  it('adds rules up to the limit and joins them with Match any', async () => {
    const { open, host, names, input, press, stable, dialog } = await setup();
    await open('id');
    const modes = () => [
      ...dialog()!.querySelectorAll<HTMLSelectElement>('select[aria-label="Match mode"]'),
    ];
    expect([...modes()[0].options].map((o) => o.textContent?.trim())).toEqual([
      'Greater than',
      'Less than',
      'Even',
    ]);
    input(dialog()!.querySelector<HTMLInputElement>('input[type=number]')!, '3');
    press(dialog()!, 'Add rule');
    await stable();
    press(dialog()!, 'Add rule');
    await stable();
    expect(dialog()!.textContent).not.toContain('Add rule');
    expect(dialog()!.querySelectorAll('fieldset')).toHaveLength(3);
    dialog()!.querySelector<HTMLButtonElement>('button[aria-label="Remove rule 3"]')!.click();
    await stable();
    input(modes()[1], 'lt');
    input(dialog()!.querySelectorAll<HTMLInputElement>('input[type=number]')[1], '2');
    const operator = dialog()!.querySelector<HTMLSelectElement>(
      'select[aria-label="Combine rules"]',
    )!;
    expect([...operator.options].map((o) => o.textContent?.trim())).toEqual([
      'Match all',
      'Match any',
    ]);
    input(operator, 'or');
    press(dialog()!, 'Apply');
    await stable();
    expect(host.filters()['id']).toEqual({
      operator: 'or',
      rules: [
        { matchMode: 'gt', value: 3 },
        { matchMode: 'lt', value: 2 },
      ],
    });
    expect(names()).toEqual(['Málaga Trading', 'Oslo Parts']);
  });

  it('a multiselect column keeps the text list value; Clear removes the filter', async () => {
    const { open, host, names, press, stable } = await setup();
    const dialog = await open('status');
    expect(dialog.querySelector('select[aria-label="Match mode"]')).toBeNull();
    const boxes = [...dialog.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    expect(boxes.map((b) => b.parentElement?.textContent?.trim())).toEqual([
      'Open',
      'Overdue',
      'Paid',
    ]);
    boxes[0].click();
    press(dialog, 'Apply');
    await stable();
    expect(host.filters()).toEqual({ status: ['Open'] });
    expect(names()).toEqual(['Berlin Supplies', 'Oslo Parts']);
    const again = await open('status');
    expect(again.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(true);
    press(again, 'Clear');
    await stable();
    expect(host.filters()).toEqual({ status: '' });
    expect(names()).toHaveLength(4);
  });

  it('Enter in a value field applies and does not reach the filter button', async () => {
    const { open, host, input, stable, button } = await setup();
    const dialog = await open('customer');
    const field = dialog.querySelector<HTMLInputElement>('input[aria-label="Filter by Customer"]')!;
    input(field, 'oslo');
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    field.dispatchEvent(enter);
    await stable();
    expect(enter.defaultPrevented).toBe(true);
    expect(host.filters()['customer']).toBeTruthy();
    expect(document.activeElement).toBe(button('customer'));
  });

  it('without the Apply button every change filters at once', async () => {
    const { open, host, input, stable, names } = await setup((h) => h.showApply.set(false));
    const dialog = await open('customer');
    expect(dialog.textContent).not.toContain('Apply');
    input(
      dialog.querySelector<HTMLInputElement>('input[aria-label="Filter by Customer"]')!,
      'oslo',
    );
    await stable();
    expect(host.filters()['customer']).toEqual({
      operator: 'and',
      rules: [{ matchMode: 'contains', value: 'oslo' }],
    });
    expect(names()).toEqual(['Oslo Parts']);
    expect(document.querySelector('.star-popover')).not.toBeNull();
  });

  it('a between rule has two labelled fields', async () => {
    const { open, host, input, press, stable } = await setup();
    const dialog = await open('amount');
    input(dialog.querySelector<HTMLSelectElement>('select[aria-label="Match mode"]')!, 'between');
    await stable();
    input(dialog.querySelector<HTMLInputElement>('input[aria-label="Amount from"]')!, '50');
    input(dialog.querySelector<HTMLInputElement>('input[aria-label="Amount to"]')!, '150');
    press(dialog, 'Apply');
    await stable();
    expect(host.filters()['amount']).toEqual({
      operator: 'and',
      rules: [{ matchMode: 'between', value: { min: 50, max: 150 } }],
    });
  });
});
