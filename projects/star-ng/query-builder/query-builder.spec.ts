import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { form, FormField } from '@angular/forms/signals';
import { SignalFormControl } from '@angular/forms/signals/compat';
import { By } from '@angular/platform-browser';
import { StarFilterService } from '@star-ng/ui/core';
import { StarDatePicker } from '@star-ng/ui/date-picker';
import { StarInputNumber } from '@star-ng/ui/input-number';
import {
  StarQueryBuilder,
  starQueryComplete,
  StarQueryField,
  StarQueryGroup,
  StarQueryValue,
} from '@star-ng/ui/query-builder';
import { StarMultiSelect, StarSelect } from '@star-ng/ui/select';
import { StarSelectButton } from '@star-ng/ui/select-button';
import { StarToggleSwitch } from '@star-ng/ui/toggle-switch';

function key(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

const FIELDS: StarQueryField<never>[] = [
  { field: 'customer', label: 'Customer', type: 'text' },
  { field: 'total', label: 'Total', type: 'number' },
  { field: 'placed', label: 'Placed', type: 'date' },
  { field: 'status', label: 'Status', type: 'select', options: ['open', 'paid'] },
  { field: 'paid', label: 'Paid', type: 'boolean' },
  { field: 'region', label: 'Region', type: 'text', matchModes: ['equals', 'nearby'] },
];

@Component({
  imports: [StarQueryBuilder, StarQueryValue],
  template: `
    <star-query-builder
      [fields]="fields"
      [maxDepth]="maxDepth()"
      [(value)]="query"
      (touch)="touches = touches + 1"
    >
      <ng-template starQueryValue="region" let-rule let-setValue="setValue">
        <button type="button" class="custom" (click)="setValue('north')">
          {{ rule.value ?? 'none' }}
        </button>
      </ng-template>
    </star-query-builder>
  `,
})
class Host {
  readonly builder = viewChild.required(StarQueryBuilder);
  readonly fields = FIELDS;
  readonly maxDepth = signal(3);
  touches = 0;
  readonly query = signal<StarQueryGroup>({
    operator: 'and',
    rules: [
      { field: 'customer', matchMode: 'contains', value: 'an' },
      { field: 'total', matchMode: 'gt', value: 100 },
      {
        operator: 'or',
        rules: [{ field: 'status', matchMode: 'equals', value: 'open' }],
      },
    ],
  });
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const rows = () => [...root.querySelectorAll<HTMLElement>('.star-query__rule')];
  const groups = () => [...root.querySelectorAll<HTMLElement>('.star-query__group')];
  const live = () => root.querySelector('[aria-live]')?.textContent?.trim();
  const stable = () => fixture.whenStable();
  return { fixture, root, host, rows, groups, live, stable };
}

describe('StarQueryBuilder', () => {
  it('renders groups as labelled groups and rules as focusable rows', async () => {
    const { rows, groups, root } = await setup();
    expect(groups().map((g) => g.getAttribute('aria-label'))).toEqual([
      'Match all of',
      'Match any of',
    ]);
    expect(groups().every((g) => g.getAttribute('role') === 'group')).toBe(true);
    expect(rows().map((r) => r.getAttribute('aria-label'))).toEqual(['Rule 1', 'Rule 2', 'Rule 1']);
    const hint = root.querySelector(`#${rows()[0].getAttribute('aria-describedby')}`);
    expect(hint?.textContent).toContain('Delete removes the rule');
    expect(rows()[0].tabIndex).toBe(0);
    // The operator toggle is a segmented control with Match all / Match any.
    const toggle = root.querySelector('star-select-button')!;
    expect(toggle.getAttribute('aria-label')).toBe('Combine rules');
    expect(toggle.textContent).toContain('Match all');
    expect(toggle.textContent).toContain('Match any');
  });

  it('a value editor by field type: text, number, select, date, boolean, between, custom', async () => {
    const { fixture, host, rows, stable } = await setup();
    const row = (i: number) => fixture.debugElement.queryAll(By.css('.star-query__rule'))[i];
    expect(rows()[0].querySelector('input.star-input')).not.toBeNull();
    expect(row(1).query(By.directive(StarInputNumber))).not.toBeNull();
    expect(
      row(2).query(By.css('.star-query__value')).query(By.directive(StarSelect)),
    ).not.toBeNull();

    host.query.set({
      operator: 'and',
      rules: [
        { field: 'placed', matchMode: 'dateIs', value: '2026-03-02' },
        { field: 'paid', matchMode: 'equals', value: true },
        { field: 'total', matchMode: 'between', value: { min: 1, max: 9 } },
        { field: 'status', matchMode: 'in', value: ['open'] },
        { field: 'region', matchMode: 'equals', value: null },
      ],
    });
    await stable();
    expect(row(0).query(By.directive(StarDatePicker)).componentInstance.value()).toBe('2026-03-02');
    expect(row(1).query(By.directive(StarToggleSwitch)).componentInstance.checked()).toBe(true);
    expect(rows()[1].textContent).toContain('Yes');
    const bounds = row(2).queryAll(By.directive(StarInputNumber));
    expect(bounds.map((b) => b.componentInstance.ariaLabel())).toEqual(['Total from', 'Total to']);
    expect(row(3).query(By.directive(StarMultiSelect)).componentInstance.value()).toEqual(['open']);
    // A single-mode field has no mode select; the custom template edits the value.
    const custom = rows()[4].querySelector<HTMLButtonElement>('button.custom')!;
    expect(custom.textContent?.trim()).toBe('none');
    custom.click();
    await stable();
    expect((host.query().rules[4] as { value: unknown }).value).toBe('north');
  });

  it('writes edits as new values: operator, field, mode, value and bounds', async () => {
    const { fixture, host, rows, stable } = await setup();
    const before = host.query();
    const row = (i: number) => fixture.debugElement.queryAll(By.css('.star-query__rule'))[i];

    fixture.debugElement.query(By.directive(StarSelectButton)).componentInstance.value.set('or');
    await stable();
    expect(host.query().operator).toBe('or');
    expect(before.operator).toBe('and');

    const input = rows()[0].querySelector<HTMLInputElement>('input.star-input')!;
    input.value = 'ben';
    input.dispatchEvent(new Event('input'));
    await stable();
    expect(host.query().rules[0]).toEqual({
      field: 'customer',
      matchMode: 'contains',
      value: 'ben',
    });

    // A new field takes its first mode and an empty value.
    row(0).query(By.css('.star-query__field')).componentInstance.value.set('total');
    await stable();
    expect(host.query().rules[0]).toEqual({ field: 'total', matchMode: 'equals', value: null });

    // A mode of another shape resets the value; one of the same shape keeps it.
    row(1).query(By.css('.star-query__mode')).componentInstance.value.set('gte');
    await stable();
    expect(host.query().rules[1]).toEqual({ field: 'total', matchMode: 'gte', value: 100 });
    row(1).query(By.css('.star-query__mode')).componentInstance.value.set('between');
    await stable();
    expect(host.query().rules[1]).toEqual({ field: 'total', matchMode: 'between', value: null });
    row(1).queryAll(By.directive(StarInputNumber))[1].componentInstance.value.set(500);
    await stable();
    expect(host.query().rules[1]).toEqual({
      field: 'total',
      matchMode: 'between',
      value: { max: 500 },
    });
  });

  it('adds rules and groups up to maxDepth, and removes groups', async () => {
    const { host, groups, stable } = await setup();
    host.builder().addRule();
    await stable();
    expect(host.query().rules[3]).toEqual({
      field: 'customer',
      matchMode: 'contains',
      value: null,
    });
    expect(document.activeElement?.getAttribute('data-path')).toBe('3');

    host.builder().addGroup('2');
    await stable();
    expect(groups()).toHaveLength(3);
    // The third level is the limit: it has no "Add group" button and addGroup does nothing.
    const third = groups()[2];
    expect(third.querySelector('.star-query__add-group')).toBeNull();
    expect(groups()[1].querySelector('.star-query__add-group')).not.toBeNull();
    host.builder().addGroup('2.1');
    await stable();
    expect(groups()).toHaveLength(3);

    third.querySelector<HTMLButtonElement>('.star-query__remove-group button')!.click();
    await stable();
    expect(groups()).toHaveLength(2);
    expect(
      groups()[0].querySelector(':scope > .star-query__header .star-query__remove-group'),
    ).toBeNull();
  });

  it('Delete removes a focused rule with an announcement; Control+Z restores it', async () => {
    const { host, rows, live, root, stable } = await setup();
    const row = rows()[1];
    row.focus();
    // Keys from a control inside the row do not remove the row.
    key(rows()[0].querySelector('input')!, 'Delete');
    expect(host.query().rules).toHaveLength(3);

    expect(key(row, 'Delete').defaultPrevented).toBe(true);
    await stable();
    expect(host.query().rules).toHaveLength(2);
    expect(live()).toBe('Rule 2 removed. Press Control and Z to undo.');
    // The next item is the group: its "Add rule" button takes the focus.
    expect(document.activeElement?.closest('.star-query__group')?.getAttribute('data-path')).toBe(
      '1',
    );

    key(root.querySelector('star-query-builder')!, 'z', { ctrlKey: true });
    await stable();
    expect(host.query().rules[1]).toEqual({ field: 'total', matchMode: 'gt', value: 100 });
    expect(live()).toBe('Rule 2 restored.');
    expect(document.activeElement).toBe(rows()[1]);
    expect(host.builder().undo()).toBe(false);
  });

  it('Backspace also removes a focused rule; undo forgets the removal after other edits', async () => {
    const { host, rows, root, stable } = await setup();
    key(rows()[1], 'Backspace');
    await stable();
    expect(host.query().rules).toHaveLength(2);
    // Another edit clears the undo.
    host.builder().setOperator('', 'or');
    await stable();
    expect(host.builder().undo()).toBe(false);

    key(rows()[0], 'Delete');
    await stable();
    // A change from outside clears it too.
    host.query.set({ operator: 'and', rules: [] });
    await stable();
    const event = key(root.querySelector('star-query-builder')!, 'z', { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(host.query().rules).toEqual([]);
  });

  it('numbers only the rules of a group, not its sub-groups', async () => {
    const { host, rows, live, stable } = await setup();
    host.query.set({
      operator: 'and',
      rules: [
        { field: 'customer', matchMode: 'contains', value: 'a' },
        { operator: 'or', rules: [{ field: 'total', matchMode: 'gt', value: 1 }] },
        { field: 'total', matchMode: 'gt', value: 2 },
      ],
    });
    await stable();
    expect(rows().map((r) => r.getAttribute('aria-label'))).toEqual(['Rule 1', 'Rule 1', 'Rule 2']);
    expect(rows()[2].querySelector('.star-query__remove button')?.getAttribute('aria-label')).toBe(
      'Remove rule 2',
    );
    key(rows()[2], 'Delete');
    await stable();
    expect(live()).toBe('Rule 2 removed. Press Control and Z to undo.');
  });

  it('Alt+Arrow keys move a rule in its group with an announcement', async () => {
    const { host, rows, live, stable } = await setup();
    rows()[0].focus();
    expect(key(rows()[0], 'ArrowDown', { altKey: true }).defaultPrevented).toBe(true);
    await stable();
    expect(host.query().rules.map((r) => ('field' in r ? r.field : 'group'))).toEqual([
      'total',
      'customer',
      'group',
    ]);
    expect(live()).toBe('Rule 1, position 2 of 3');
    expect(document.activeElement).toBe(rows()[1]);
    key(rows()[1], 'ArrowUp', { altKey: true });
    await stable();
    expect((host.query().rules[0] as { field: string }).field).toBe('customer');
    // The first rule cannot move up.
    key(rows()[0], 'ArrowUp', { altKey: true });
    await stable();
    expect((host.query().rules[0] as { field: string }).field).toBe('customer');
  });

  it('marks incomplete rules after the focus leaves, and emits touch', async () => {
    const { host, rows, root, stable } = await setup();
    host.builder().addRule();
    await stable();
    expect(rows()[3].classList).not.toContain('star-query__rule--invalid');
    const outside = document.createElement('button');
    document.body.append(outside);
    rows()[3].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    await stable();
    expect(host.touches).toBe(1);
    expect(rows()[3].classList).toContain('star-query__rule--invalid');
    expect(rows()[3].querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
    expect(rows()[0].classList).not.toContain('star-query__rule--invalid');
    expect(root.querySelector('star-query-builder')!.classList).not.toContain(
      'star-query--invalid',
    );
    outside.remove();
  });

  it('incomplete non-text rules mark their editor invalid and show a linked error text', async () => {
    const { fixture, host, rows, root, stable } = await setup();
    host.query.set({
      operator: 'and',
      rules: [
        { field: 'total', matchMode: 'gt', value: null },
        { field: 'placed', matchMode: 'dateIs', value: null },
        { field: 'status', matchMode: 'equals', value: null },
        { field: 'status', matchMode: 'in', value: [] },
        { field: 'total', matchMode: 'between', value: { min: 5 } },
        { field: 'customer', matchMode: 'contains', value: 'ok' },
      ],
    });
    await stable();
    expect(root.querySelector('.star-query__error')).toBeNull();
    const outside = document.createElement('button');
    document.body.append(outside);
    rows()[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    await stable();
    const row = (i: number) => fixture.debugElement.queryAll(By.css('.star-query__rule'))[i];
    const invalidOf = (i: number, type: unknown) =>
      row(i)
        .queryAll(By.directive(type as never))
        .map((editor) => (editor.componentInstance as { invalid(): boolean }).invalid());
    expect(invalidOf(0, StarInputNumber)).toEqual([true]);
    expect(invalidOf(1, StarDatePicker)).toEqual([true]);
    expect(
      row(2)
        .query(By.css('.star-query__value'))
        .query(By.directive(StarSelect))
        .componentInstance.invalid(),
    ).toBe(true);
    expect(invalidOf(3, StarMultiSelect)).toEqual([true]);
    expect(invalidOf(4, StarInputNumber)).toEqual([true, true]);
    expect(rows()[0].querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
    // A complete rule is not marked.
    expect(rows()[5].querySelector('input')?.getAttribute('aria-invalid')).toBeNull();

    const error = root.querySelector<HTMLElement>('.star-query__error')!;
    expect(error.textContent?.trim()).toBe('Complete or remove the rules without a value.');
    expect(rows()[0].getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
    expect(rows()[5].getAttribute('aria-describedby')?.split(' ')).not.toContain(error.id);

    // Completing the rules removes the error text.
    host.query.set({
      operator: 'and',
      rules: [{ field: 'customer', matchMode: 'contains', value: 'ok' }],
    });
    await stable();
    expect(root.querySelector('.star-query__error')).toBeNull();
    outside.remove();
  });

  it('custom match modes show the registered label', async () => {
    TestBed.inject(StarFilterService).register('nearby', () => true, 'Is nearby');
    const { fixture, host, stable } = await setup();
    host.query.set({
      operator: 'and',
      rules: [{ field: 'region', matchMode: 'nearby', value: 'x' }],
    });
    await stable();
    const mode = fixture.debugElement.query(By.css('.star-query__mode')).componentInstance;
    expect(mode.options().map((o: { label: string }) => o.label)).toEqual(['Equals', 'Is nearby']);
  });
});

@Component({
  imports: [StarQueryBuilder, FormField],
  template: `
    <star-query-builder id="signal" [fields]="fields" [formField]="filter" />
    <star-query-builder
      id="reactive"
      [fields]="fields"
      [formField]="group.controls.query.fieldTree"
    />
  `,
})
class FormsHost {
  readonly fields = FIELDS;
  readonly model = signal<StarQueryGroup>({
    operator: 'and',
    rules: [{ field: 'customer', matchMode: 'contains', value: '' }],
  });
  readonly filter = form(this.model, (path) => starQueryComplete(path, FIELDS));
  readonly group = new FormGroup({
    query: new SignalFormControl<StarQueryGroup>({ operator: 'and', rules: [] }, (path) =>
      starQueryComplete(path, () => FIELDS, { message: () => 'Finish the rules.' }),
    ),
  });
}

describe('StarQueryBuilder forms', () => {
  it('Signal Forms: incomplete rules make the field invalid; edits flow both ways', async () => {
    const fixture = TestBed.createComponent(FormsHost);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    expect(host.filter().invalid()).toBe(true);
    expect(host.filter().errors()[0].kind).toBe('incompleteQuery');
    const input = root.querySelector<HTMLInputElement>('#signal input.star-input')!;
    input.value = 'ann';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    // Signal Forms tags array items with a symbol key, so compare the fields only.
    expect(host.model().rules[0]).toMatchObject({
      field: 'customer',
      matchMode: 'contains',
      value: 'ann',
    });
    expect(host.filter().valid()).toBe(true);
  });

  it('Reactive Forms through SignalFormControl', async () => {
    const fixture = TestBed.createComponent(FormsHost);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const builder = fixture.debugElement.queryAll(By.directive(StarQueryBuilder))[1]
      .componentInstance as StarQueryBuilder;
    expect(host.group.valid).toBe(true);
    builder.addRule();
    await fixture.whenStable();
    expect(host.group.value.query?.rules).toHaveLength(1);
    expect(host.group.controls.query.fieldTree().errors()[0].message).toBe('Finish the rules.');
    host.group.controls.query.setValue({
      operator: 'or',
      rules: [{ field: 'paid', matchMode: 'equals', value: false }],
    });
    await fixture.whenStable();
    expect(builder.value().operator).toBe('or');
    expect(host.group.controls.query.fieldTree().valid()).toBe(true);
  });
});
