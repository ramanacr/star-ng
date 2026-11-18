import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarButton } from '@star-ng/ui/button';
import {
  StarDropdown,
  StarDropdownItem,
  StarDropdownSelection,
  StarDropdownTrigger,
} from '@star-ng/ui/dropdown';

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

function key(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

const tick = () => new Promise((resolve) => setTimeout(resolve));

@Component({
  imports: [StarButton, StarDropdown, StarDropdownItem, StarDropdownTrigger],
  template: `
    <button type="button" id="trigger" [starDropdownTrigger]="formats">Export</button>
    <star-button id="wrapper" [starDropdownTrigger]="formats">Export (wrapper)</star-button>
    <star-dropdown
      #formats
      ariaLabel="Export format"
      [(value)]="value"
      [closeOnSelect]="closeOnSelect()"
      (selectionChange)="changes.push($event)"
    >
      <star-dropdown-item header>Documents</star-dropdown-item>
      <star-dropdown-item value="pdf">PDF</star-dropdown-item>
      <star-dropdown-item value="docx" disabled>Word</star-dropdown-item>
      <star-dropdown-item divider />
      <star-dropdown-item header>Data</star-dropdown-item>
      <star-dropdown-item value="csv">CSV</star-dropdown-item>
      <star-dropdown-item value="xlsx">Spreadsheet</star-dropdown-item>
    </star-dropdown>
  `,
})
class DropdownHost {
  readonly value = signal<unknown>(undefined);
  readonly closeOnSelect = signal(true);
  readonly changes: StarDropdownSelection[] = [];
}

async function setup() {
  const fixture = TestBed.createComponent(DropdownHost);
  await fixture.whenStable();
  await tick();
  const root = fixture.nativeElement as HTMLElement;
  const trigger = root.querySelector<HTMLButtonElement>('#trigger')!;
  const listbox = () => document.querySelector<HTMLElement>('[role=listbox]');
  const options = () => [...document.querySelectorAll<HTMLElement>('[role=option]')];
  const active = () => {
    const id = listbox()?.getAttribute('aria-activedescendant');
    return id ? document.getElementById(id)?.textContent?.trim() : null;
  };
  const open = async () => {
    trigger.click();
    await fixture.whenStable();
    await tick();
  };
  return { fixture, root, trigger, listbox, options, active, open };
}

describe('StarDropdown', () => {
  it('marks the trigger as a listbox popup and opens on click', async () => {
    const { trigger, listbox, open } = await setup();
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
    expect(listbox()).toBeNull();

    await open();
    const list = listbox()!;
    expect(list).not.toBeNull();
    expect(list.getAttribute('aria-label')).toBe('Export format');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(list.id);
    expect(document.activeElement).toBe(list);
  });

  it('renders options, a header and a divider with the right roles', async () => {
    const { options, open } = await setup();
    await open();
    expect(options().map((option) => option.textContent?.trim())).toEqual([
      'PDF',
      'Word',
      'CSV',
      'Spreadsheet',
    ]);
    const [pdf, word, csv] = options();
    expect(word.getAttribute('aria-disabled')).toBe('true');
    expect(pdf.getAttribute('aria-selected')).toBe('false');
    const headers = [...document.querySelectorAll<HTMLElement>('.star-dropdown__header')];
    expect(headers.map((header) => header.getAttribute('role'))).toEqual([
      'presentation',
      'presentation',
    ]);
    // An option is described by the header of its group.
    expect(pdf.getAttribute('aria-describedby')).toBe(headers[0].id);
    expect(csv.getAttribute('aria-describedby')).toBe(headers[1].id);
    const divider = document.querySelector<HTMLElement>('.star-dropdown__divider')!;
    expect(divider.getAttribute('role')).toBe('none');
    expect(divider.getAttribute('aria-hidden')).toBe('true');
  });

  it('moves the active option with arrows, Home and End, skipping disabled options', async () => {
    const { fixture, listbox, active, open } = await setup();
    const press = async (name: string) => {
      key(listbox()!, name);
      await fixture.whenStable();
    };
    await open();
    expect(active()).toBe('PDF');
    await press('ArrowDown');
    expect(active()).toBe('CSV');
    await press('End');
    expect(active()).toBe('Spreadsheet');
    await press('Home');
    expect(active()).toBe('PDF');
    await press('ArrowUp');
    expect(active()).toBe('PDF');
  });

  it('moves to an option by typeahead', async () => {
    const { listbox, active, open } = await setup();
    await open();
    key(listbox()!, 's');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(active()).toBe('Spreadsheet');
  });

  it('selects with Enter, emits selectionChange, closes and returns the focus', async () => {
    const { fixture, trigger, listbox, open } = await setup();
    await open();
    key(listbox()!, 'ArrowDown');
    await fixture.whenStable();
    const event = key(listbox()!, 'Enter');
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.changes).toEqual([{ value: 'csv', label: 'CSV' }]);
    expect(fixture.componentInstance.value()).toBe('csv');
    expect(listbox()).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);

    await open();
    const selected = document.querySelector('[aria-selected=true]')!;
    expect(selected.textContent?.trim()).toBe('CSV');
    // It opens on the selected option.
    expect(listbox()!.getAttribute('aria-activedescendant')).toBe(selected.id);
  });

  it('selects with a click and ignores disabled options and headers', async () => {
    const { fixture, options, listbox, open } = await setup();
    fixture.componentInstance.closeOnSelect.set(false);
    await open();
    options()[1].click();
    document.querySelector<HTMLElement>('.star-dropdown__header')!.click();
    expect(fixture.componentInstance.changes).toEqual([]);
    options()[3].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.changes).toEqual([{ value: 'xlsx', label: 'Spreadsheet' }]);
    // closeOnSelect false keeps the list open.
    expect(listbox()).not.toBeNull();
  });

  it('closes on Escape and returns the focus to the trigger', async () => {
    const { fixture, trigger, listbox, open } = await setup();
    await open();
    const event = key(listbox()!, 'Escape');
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(fixture.componentInstance.changes).toEqual([]);
  });

  it('closes on Tab and returns the focus to the trigger without selecting', async () => {
    const { fixture, trigger, listbox, open } = await setup();
    await open();
    const event = key(listbox()!, 'Tab');
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(false);
    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('opens from the trigger with Arrow down (first) and Arrow up (last)', async () => {
    const { fixture, trigger, listbox, active } = await setup();
    trigger.focus();
    key(trigger, 'ArrowDown');
    await fixture.whenStable();
    await tick();
    expect(listbox()).not.toBeNull();
    expect(active()).toBe('PDF');
    key(listbox()!, 'Escape');
    await fixture.whenStable();

    key(trigger, 'ArrowUp');
    await fixture.whenStable();
    await tick();
    expect(active()).toBe('Spreadsheet');
  });

  it('puts the popup state on the inner button of a star-button trigger', async () => {
    const { fixture, root, listbox } = await setup();
    const wrapper = root.querySelector<HTMLElement>('#wrapper')!;
    const inner = wrapper.querySelector('button')!;
    expect(inner.getAttribute('aria-haspopup')).toBe('listbox');
    expect(wrapper.hasAttribute('aria-haspopup')).toBe(false);
    inner.click();
    await fixture.whenStable();
    await tick();
    expect(inner.getAttribute('aria-expanded')).toBe('true');
    key(listbox()!, 'Escape');
    await fixture.whenStable();
    expect(document.activeElement).toBe(inner);
  });
});
