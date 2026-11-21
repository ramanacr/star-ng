import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { form, FormField, required } from '@angular/forms/signals';
import { SignalFormControl } from '@angular/forms/signals/compat';
import {
  StarEmptyTemplate,
  StarFilterMatchMode,
  StarFooterTemplate,
  StarHeaderTemplate,
} from '@star-ng/ui/core';
import {
  StarColumnCellTemplate,
  StarComboboxColumn,
  StarMultiColumnCombobox,
} from '@star-ng/ui/multi-column-combobox';

interface Person {
  id: number;
  name: string;
  city: string;
  team: string;
}

const PEOPLE: Person[] = [
  { id: 1, name: 'Ana Silva', city: 'Lisbon', team: 'Sales' },
  { id: 2, name: 'Jonas Berg', city: 'Oslo', team: 'Support' },
  { id: 3, name: 'Lucía Ortega', city: 'Madrid', team: 'Finance' },
  { id: 4, name: 'Marco Bianchi', city: 'Turin', team: 'Sales' },
];

const COLUMNS: StarComboboxColumn<Person>[] = [
  { field: 'name', header: 'Name', width: '10rem' },
  { field: 'city', header: 'City' },
  { field: 'team', header: 'Team', width: '6rem' },
];

function key(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

const options = () => [...document.querySelectorAll<HTMLElement>('[role=option]')];
const firstCells = () =>
  options().map((o) => o.querySelector('.star-mcc__cell')?.textContent?.trim());

@Component({
  imports: [
    StarMultiColumnCombobox,
    StarColumnCellTemplate,
    StarEmptyTemplate,
    StarHeaderTemplate,
    StarFooterTemplate,
  ],
  template: `
    <star-multi-column-combobox
      [options]="people()"
      [columns]="columns"
      optionLabel="name"
      optionValue="id"
      [filterFields]="filterFields()"
      [filterMatchMode]="mode()"
      [virtualScroll]="virtual()"
      [virtualItemSize]="36"
      [(value)]="value"
      ariaLabel="Person"
    >
      @if (custom()) {
        <ng-template starColumnCell let-row let-column="column">
          <b class="custom">{{ column.header }}={{ $any(row)[$any(column).field] }}</b>
        </ng-template>
        <ng-template starEmpty let-query>Nobody called {{ query }}</ng-template>
        <ng-template starHeader>People</ng-template>
        <ng-template starFooter>4 people</ng-template>
      }
    </star-multi-column-combobox>
  `,
})
class Host {
  readonly combo = viewChild.required(StarMultiColumnCombobox);
  readonly people = signal<Person[]>(PEOPLE);
  readonly columns = COLUMNS;
  readonly value = signal<number | null>(null);
  readonly filterFields = signal<(keyof Person & string)[] | null>(null);
  readonly mode = signal<StarFilterMatchMode>('contains');
  readonly custom = signal(false);
  readonly virtual = signal(false);
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const input = root.querySelector<HTMLInputElement>('input[role=combobox]')!;
  const type = async (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const press = async (name: string, init: KeyboardEventInit = {}) => {
    const event = key(input, name, init);
    await fixture.whenStable();
    return event;
  };
  const active = () =>
    document
      .getElementById(input.getAttribute('aria-activedescendant') ?? '')
      ?.querySelector('.star-mcc__cell')
      ?.textContent?.trim();
  return { fixture, root, host: fixture.componentInstance, input, type, press, active };
}

describe('StarMultiColumnCombobox', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('is an editable combobox that opens a listbox with a header row on Alt+Arrow down', async () => {
    const { input, press } = await setup();
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-label')).toBe('Person');
    await press('ArrowDown', { altKey: true });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const listbox = document.querySelector('[role=listbox]')!;
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    const header = document.querySelector('.star-mcc__header')!;
    expect(header.getAttribute('role')).toBe('presentation');
    expect(
      [...header.querySelectorAll('.star-mcc__head')].map((h) => h.textContent?.trim()),
    ).toEqual(['Name', 'City', 'Team']);
    expect(options().length).toBe(4);
    const cells = [...options()[0].querySelectorAll('.star-mcc__cell')].map((c) =>
      c.textContent?.trim(),
    );
    expect(cells).toEqual(['Ana Silva', 'Lisbon', 'Sales']);
    // Screen readers hear the cells as one sentence with separators.
    expect(options()[0].textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Ana Silva , Lisbon , Sales',
    );
    const panel = document.querySelector<HTMLElement>('.star-mcc__panel')!;
    expect(panel.style.getPropertyValue('--star-mcc-columns')).toBe('10rem minmax(0, 1fr) 6rem');
  });

  it('moves the active option with the arrows, Home, End, Page up and Page down', async () => {
    const { press, active } = await setup();
    await press('ArrowDown');
    expect(active()).toBe('Ana Silva');
    await press('ArrowDown');
    expect(active()).toBe('Jonas Berg');
    await press('ArrowUp');
    expect(active()).toBe('Ana Silva');
    await press('End');
    expect(active()).toBe('Marco Bianchi');
    await press('Home');
    expect(active()).toBe('Ana Silva');
    await press('PageDown');
    expect(active()).toBe('Marco Bianchi');
    await press('PageUp');
    expect(active()).toBe('Ana Silva');
  });

  it('chooses with Enter: the value is optionValue and the field shows the label', async () => {
    const { host, input, press } = await setup();
    await press('ArrowDown');
    await press('ArrowDown');
    await press('Enter');
    expect(host.value()).toBe(2);
    expect(input.value).toBe('Jonas Berg');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes with Escape and keeps the value', async () => {
    const { host, input, press } = await setup();
    await press('ArrowDown');
    const event = await press('Escape');
    expect(event.defaultPrevented).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(host.value()).toBeNull();
  });

  it('lets Enter submit the form on a closed field unless the text changed the value (m14)', async () => {
    const { host, input, press, type } = await setup();
    const untouched = await press('Enter');
    expect(untouched.defaultPrevented).toBe(false);
    await type('Jonas Berg');
    await press('Escape');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    const changed = await press('Enter');
    expect(changed.defaultPrevented).toBe(true);
    expect(host.value()).toBe(2);
    const again = await press('Enter');
    expect(again.defaultPrevented).toBe(false);
  });

  it('chooses an option by click', async () => {
    const { host, press, fixture } = await setup();
    await press('ArrowDown');
    options()[2].click();
    await fixture.whenStable();
    expect(host.value()).toBe(3);
  });

  it('filters every column by default, and only the filterFields when set', async () => {
    const { host, fixture, type } = await setup();
    await type('lis');
    expect(firstCells()).toEqual(['Ana Silva']);
    await type('sales');
    expect(firstCells()).toEqual(['Ana Silva', 'Marco Bianchi']);
    host.filterFields.set(['name']);
    await fixture.whenStable();
    await type('sales');
    expect(firstCells()).toEqual([]);
    expect(document.querySelector('.star-listbox__empty')?.textContent?.trim()).toBe(
      'No results found',
    );
    await type('ana');
    expect(firstCells()).toEqual(['Ana Silva']);
  });

  it('uses the filterMatchMode and ignores accents', async () => {
    const { host, fixture, type } = await setup();
    host.mode.set('startsWith');
    await fixture.whenStable();
    await type('luci');
    expect(firstCells()).toEqual(['Lucía Ortega']);
    await type('ortega');
    expect(firstCells()).toEqual([]);
  });

  it('renders the starColumnCell and starEmpty slots', async () => {
    const { host, fixture, type, press } = await setup();
    host.custom.set(true);
    await fixture.whenStable();
    await press('ArrowDown');
    expect(options()[0].querySelector('.custom')?.textContent).toBe('Name=Ana Silva');
    expect(options()[0].querySelectorAll('.custom').length).toBe(3);
    // Header and footer slots sit in the shared slot regions, outside the scrolling list.
    const head = document.querySelector('[data-star-part="panelHeader"]')!;
    const foot = document.querySelector('[data-star-part="panelFooter"]')!;
    expect(head.classList).toContain('star-panel__header');
    expect(foot.classList).toContain('star-panel__footer');
    expect(head.textContent).toBe('People');
    expect(foot.textContent).toBe('4 people');
    expect(document.querySelector('[role=listbox]')!.contains(foot)).toBe(false);
    await type('zzz');
    expect(document.querySelector('.star-listbox__empty')?.textContent?.trim()).toBe(
      'Nobody called zzz',
    );
  });

  it('renders only a window of rows with virtualScroll', async () => {
    const { host, fixture, press } = await setup();
    host.people.set(
      Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Person ${i}`,
        city: 'City',
        team: 'Team',
      })),
    );
    host.virtual.set(true);
    await fixture.whenStable();
    await press('ArrowDown');
    expect(options().length).toBeLessThan(40);
    expect(options()[0].getAttribute('aria-setsize')).toBe('1000');
    expect(options()[0].getAttribute('aria-posinset')).toBe('1');
  });
});

describe('StarMultiColumnCombobox forms', () => {
  @Component({
    imports: [StarMultiColumnCombobox, FormField],
    template: `
      <star-multi-column-combobox
        [formField]="f.person"
        [options]="people"
        [columns]="columns"
        optionLabel="name"
        optionValue="id"
        ariaLabel="Person"
      />
    `,
  })
  class SignalHost {
    readonly people = PEOPLE;
    readonly columns = COLUMNS;
    readonly model = signal<{ person: number | null }>({ person: null });
    readonly f = form(this.model, (p) => required(p.person));
  }

  @Component({
    imports: [StarMultiColumnCombobox, FormField],
    template: `
      <star-multi-column-combobox
        [formField]="group.controls.person.fieldTree"
        [options]="people"
        [columns]="columns"
        optionLabel="name"
        optionValue="id"
        ariaLabel="Person"
      />
    `,
  })
  class ReactiveHost {
    readonly people = PEOPLE;
    readonly columns = COLUMNS;
    readonly group = new FormGroup({
      person: new SignalFormControl<number | null>(4, (p) => required(p)),
    });
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('binds to Signal Forms and marks required', async () => {
    const fixture = TestBed.createComponent(SignalHost);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input')!;
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(fixture.componentInstance.f.person().invalid()).toBe(true);
    key(input, 'ArrowDown');
    await fixture.whenStable();
    key(input, 'Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.model().person).toBe(1);
    expect(fixture.componentInstance.f.person().valid()).toBe(true);
  });

  it('shows the label of a Reactive Forms value and writes the choice back', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input')!;
    expect(input.value).toBe('Marco Bianchi');
    key(input, 'ArrowDown');
    await fixture.whenStable();
    key(input, 'Home');
    await fixture.whenStable();
    key(input, 'Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.group.value.person).toBe(1);
  });
});
