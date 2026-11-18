import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarListbox } from './listbox';
import { StarListboxDropEvent, starListboxDropIndex } from './listbox-dragdrop';

@Component({
  imports: [StarListbox],
  template: `
    <star-listbox
      class="checks"
      [options]="cities"
      [(value)]="checked"
      checkbox
      optionDisabled="closed"
      optionLabel="name"
      optionValue="code"
      ariaLabel="Cities with check boxes"
      (optionDblClick)="dbl.push($event.option.code)"
    />
    <star-listbox
      #source
      class="source"
      [options]="left()"
      [(value)]="leftValue"
      dragdrop
      dropListData="left"
      [connectedTo]="[target]"
      ariaLabel="Available"
      (dropped)="drops.push($event)"
    />
    <star-listbox
      #target
      class="target"
      [options]="right()"
      [(value)]="rightValue"
      dragdrop
      dropListData="right"
      [connectedTo]="[source]"
      ariaLabel="Chosen"
      (dropped)="drops.push($event)"
    />
  `,
})
class Host {
  readonly cities = [
    { code: 'BER', name: 'Berlin' },
    { code: 'PAR', name: 'Paris' },
    { code: 'LIS', name: 'Lisbon', closed: true },
  ];
  readonly checked = signal<string | readonly string[] | null>(null);
  readonly left = signal<readonly string[]>(['Order 1', 'Order 2', 'Order 3']);
  readonly right = signal<readonly string[]>(['Order 9']);
  readonly leftValue = signal<string | readonly string[] | null>(null);
  readonly rightValue = signal<string | readonly string[] | null>(null);
  readonly drops: StarListboxDropEvent<string>[] = [];
  readonly dbl: string[] = [];
}

function key(target: Element, name: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
  );
}

describe('listbox checkbox, drag and drop, double click', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, el };
  }

  it('checkbox: multiple implied, aria-checked on options, tri-state select all', async () => {
    const { fixture, host, el } = await setup();
    const list = el.querySelector('.checks [role=listbox]')!;
    expect(list.getAttribute('aria-multiselectable')).toBe('true');
    const options = [...el.querySelectorAll<HTMLElement>('.checks [role=option]')];
    expect(options.map((o) => o.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false']);
    const all = el.querySelector<HTMLButtonElement>('.checks [role=checkbox]')!;
    expect(all.getAttribute('aria-label')).toBe('Select all');
    expect(all.getAttribute('aria-checked')).toBe('false');

    options[0].click();
    await fixture.whenStable();
    expect(host.checked()).toEqual(['BER']);
    expect(all.getAttribute('aria-checked')).toBe('mixed');
    expect(options[0].getAttribute('aria-checked')).toBe('true');

    all.click();
    await fixture.whenStable();
    // The closed city is disabled: select all skips it.
    expect(host.checked()).toEqual(['BER', 'PAR']);
    expect(all.getAttribute('aria-checked')).toBe('true');
    all.click();
    await fixture.whenStable();
    expect(host.checked()).toEqual([]);
  });

  it('optionDblClick emits the option', async () => {
    const { fixture, host, el } = await setup();
    el.querySelector<HTMLElement>('.checks [role=option]')!.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true }),
    );
    await fixture.whenStable();
    expect(host.dbl).toEqual(['BER']);
  });

  it('dragdrop: Alt + Arrow keys move the active option and announce the position', async () => {
    const { fixture, host, el } = await setup();
    const list = el.querySelector<HTMLElement>('.source [role=listbox]')!;
    expect(list.getAttribute('aria-describedby')).toBeTruthy();
    list.dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();
    key(list, 'ArrowDown', { altKey: true });
    await fixture.whenStable();
    expect(host.drops).toEqual([
      { item: 'Order 1', from: 'left', to: 'left', previousIndex: 0, index: 1 },
    ]);
    expect(el.querySelector('.source [aria-live]')!.textContent).toContain(
      'Order 1, position 2 of 3',
    );
    expect(list.getAttribute('aria-activedescendant')).toMatch(/-1$/);
    // Alt + Arrow up at the top does nothing.
    key(list, 'ArrowUp', { altKey: true });
    key(list, 'ArrowUp', { altKey: true });
    expect(host.drops.length).toBe(2);
  });

  it('dragdrop: the lists are CDK drop lists connected to each other', async () => {
    const { el } = await setup();
    const source = el.querySelector<HTMLElement>('.source [role=listbox]')!;
    expect(source.classList).toContain('cdk-drop-list');
    expect(el.querySelectorAll('.source .cdk-drag').length).toBe(3);
    expect(el.querySelectorAll('.checks .cdk-drag').length).toBe(0);
  });
});

describe('starListboxDropIndex', () => {
  const options = ['a', 'b', 'c', 'd'];
  it('maps a position in the shown options to the options array', () => {
    expect(starListboxDropIndex(options, options, 2, true)).toBe(2);
    expect(starListboxDropIndex(options, ['b', 'd'], 1, true)).toBe(3);
    expect(starListboxDropIndex(options, ['b', 'd'], 0, false)).toBe(1);
    expect(starListboxDropIndex(options, ['b', 'd'], 2, false)).toBe(4);
    expect(starListboxDropIndex([], [], 0, false)).toBe(0);
  });
});
