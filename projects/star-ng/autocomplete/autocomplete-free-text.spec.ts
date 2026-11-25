import { Component, signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { StarIconField } from '@star-ng/ui/input-group';
import {
  StarAutoComplete,
  StarAutoCompleteLeadingTemplate,
  StarAutoCompleteTrailingTemplate,
  StarMultiAutoComplete,
} from './autocomplete';

// Free-text search mode (`freeText`, `submitted`, `submit()`), `openOnFocus`, option icons
// (`optionIcon`), the leading and trailing slots, and `star-icon-field` around the autocomplete.

interface Search {
  readonly label: string;
  readonly group: string;
  readonly icon: string;
}

const SEARCHES: readonly Search[] = [
  { label: 'Open orders this week', group: 'Recent', icon: 'ph-bold ph-clock' },
  { label: 'Late deliveries', group: 'Saved', icon: 'ph-fill ph-bookmark-simple' },
  { label: 'Orders over 1000', group: 'Recent', icon: 'ph-bold ph-clock' },
];

@Component({
  imports: [StarAutoComplete, StarAutoCompleteLeadingTemplate, StarAutoCompleteTrailingTemplate],
  template: `
    <star-autocomplete
      #search
      freeText
      openOnFocus
      [minQueryLength]="0"
      [delay]="0"
      [options]="searches"
      optionLabel="label"
      optionGroup="group"
      optionIcon="icon"
      [(value)]="text"
      ariaLabel="Search"
      showClear
      (submitted)="submitted.set($event)"
      (optionSelect)="picked.set($event.label)"
      (selectionChanging)="changes.set(changes() + 1)"
    >
      <ng-template starAutoCompleteLeading let-query let-disabled="disabled">
        <i
          class="lead ph-bold ph-sparkle"
          aria-hidden="true"
          [attr.data-query]="query"
          [attr.data-disabled]="disabled"
        ></i>
      </ng-template>
      <ng-template starAutoCompleteTrailing>
        <kbd class="hint">/</kbd>
        <button type="button" class="go" (click)="search.submit()">Search</button>
      </ng-template>
    </star-autocomplete>
    <button type="button" class="after">After</button>
  `,
})
class FreeTextHost {
  readonly searches = SEARCHES;
  readonly text = signal<string | null>(null);
  readonly submitted = signal<string | null>(null);
  readonly picked = signal<string | null>(null);
  readonly changes = signal(0);
}

@Component({
  imports: [StarAutoComplete, FormField],
  template: `<star-autocomplete
    freeText
    [options]="names"
    ariaLabel="Query"
    [formField]="f.query"
  />`,
})
class FormHost {
  readonly names = ['Alpha', 'Beta'];
  readonly model = signal({ query: 'start' });
  readonly f = form(this.model);
}

@Component({
  imports: [StarAutoComplete],
  template: `<star-autocomplete
    [options]="names"
    [(value)]="value"
    ariaLabel="Plain"
    [minQueryLength]="0"
  />`,
})
class PlainHost {
  readonly names = ['Alpha', 'Beta'];
  readonly value = signal<string | null>('Alpha');
}

@Component({
  imports: [StarAutoComplete, StarMultiAutoComplete, StarIconField],
  template: `
    <star-icon-field icon="ph-bold ph-globe-hemisphere-west">
      <star-autocomplete
        class="single"
        [options]="countries"
        ariaLabel="Country"
        showClear
        dropdown
      />
    </star-icon-field>
    <star-icon-field icon="ph-bold ph-globe-hemisphere-west">
      <star-multi-autocomplete class="multi" [options]="countries" ariaLabel="Countries" />
    </star-icon-field>
  `,
})
class IconFieldHost {
  readonly countries = ['Austria', 'Belgium', 'Chile'];
}

function key(target: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const panel = () => document.querySelector<HTMLElement>('.star-panel');
const options = () => [...document.querySelectorAll<HTMLElement>('[role=option]')];

async function create<T>(host: Type<T>) {
  const fixture: ComponentFixture<T> = TestBed.createComponent(host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector<HTMLInputElement>('[role=combobox]')!;
  return { fixture, el, input, host: fixture.componentInstance };
}

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

describe('star-autocomplete freeText', () => {
  it('opens on focus with an empty text, with groups and an icon per option', async () => {
    const { fixture, input } = await create(FreeTextHost);
    input.focus();
    await fixture.whenStable();
    expect(panel()).not.toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe(document.querySelector('[role=listbox]')!.id);
    const groups = [...document.querySelectorAll('.star-listbox__group')].map((g) =>
      g.textContent!.trim(),
    );
    expect(groups).toEqual(['Recent', 'Saved']);
    const icons = options().map((o) => o.querySelector('[data-star-part=optionIcon]'));
    expect(icons.every((icon) => icon?.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(icons[0]!.classList).toContain('ph-clock');
    expect(icons[2]!.classList).toContain('ph-bookmark-simple');
  });

  it('makes the typed text the value and keeps it on blur', async () => {
    const { fixture, input, host, el } = await create(FreeTextHost);
    input.focus();
    type(input, 'shipped today');
    await fixture.whenStable();
    expect(host.text()).toBe('shipped today');
    expect(host.changes()).toBe(0);
    key(input, 'Escape');
    el.querySelector<HTMLButtonElement>('.after')!.focus();
    await fixture.whenStable();
    expect(input.value).toBe('shipped today');
    expect(host.text()).toBe('shipped today');
  });

  it('emits submitted on Enter with no highlighted option, without choosing one', async () => {
    const { fixture, input, host } = await create(FreeTextHost);
    input.focus();
    type(input, 'orders');
    await fixture.whenStable();
    expect(panel()).not.toBeNull();
    const enter = key(input, 'Enter');
    await fixture.whenStable();
    expect(host.submitted()).toBe('orders');
    expect(host.picked()).toBeNull();
    expect(host.text()).toBe('orders');
    expect(enter.defaultPrevented).toBe(false);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('emits submitted on Enter with a closed panel, and not for blank text', async () => {
    const { fixture, input, host } = await create(FreeTextHost);
    input.focus();
    await fixture.whenStable();
    key(input, 'Escape');
    key(input, 'Enter');
    expect(host.submitted()).toBeNull();
    type(input, 'late');
    key(input, 'Escape');
    await fixture.whenStable();
    key(input, 'Enter');
    expect(host.submitted()).toBe('late');
  });

  it('highlights with the arrow keys and chooses with Enter (optionSelect)', async () => {
    const { fixture, input, host } = await create(FreeTextHost);
    input.focus();
    await fixture.whenStable();
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    await fixture.whenStable();
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[1].id);
    key(input, 'Enter');
    await fixture.whenStable();
    expect(host.picked()).toBe('Orders over 1000');
    expect(host.text()).toBe('Orders over 1000');
    expect(input.value).toBe('Orders over 1000');
    expect(host.submitted()).toBeNull();
  });

  it('does not open the panel again when it closes and gives focus back', async () => {
    const { fixture, input } = await create(FreeTextHost);
    input.focus();
    await fixture.whenStable();
    key(input, 'Escape');
    await fixture.whenStable();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    input.click();
    await fixture.whenStable();
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders the leading and trailing slots with the context, and submits from a button', async () => {
    const { fixture, input, host, el } = await create(FreeTextHost);
    const lead = el.querySelector('[data-star-part=leadingPanel] .lead')!;
    const trail = el.querySelector('[data-star-part=trailingPanel]')!;
    expect(lead).not.toBeNull();
    expect(trail.querySelector('.hint')!.textContent).toBe('/');
    // The trailing slot comes after the clear button.
    input.focus();
    type(input, 'weekly');
    await fixture.whenStable();
    expect(lead.getAttribute('data-query')).toBe('weekly');
    expect(lead.getAttribute('data-disabled')).toBe('false');
    const control = el.querySelector('[data-star-part=controlPanel]')!;
    const parts = [...control.children].map((c) => c.getAttribute('data-star-part'));
    expect(parts).toEqual(['leadingPanel', 'mainPanel', 'clearButton', 'trailingPanel']);
    const go = trail.querySelector<HTMLButtonElement>('.go')!;
    go.focus();
    await fixture.whenStable();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    go.click();
    expect(host.submitted()).toBe('weekly');
  });

  it('clears to an empty text', async () => {
    const { fixture, input, host, el } = await create(FreeTextHost);
    type(input, 'abc');
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('[data-star-part=clearButton]')!.click();
    await fixture.whenStable();
    expect(host.text()).toBe('');
    expect(input.value).toBe('');
    expect(el.querySelector('[data-star-part=clearButton]')).toBeNull();
  });

  it('works with Signal Forms', async () => {
    const { fixture, input, host } = await create(FormHost);
    expect(input.value).toBe('start');
    type(input, 'free words');
    await fixture.whenStable();
    expect(host.model().query).toBe('free words');
    host.model.set({ query: 'from model' });
    await fixture.whenStable();
    expect(input.value).toBe('from model');
  });
});

describe('star-autocomplete without the new options', () => {
  it('does not open on focus and reverts free text on blur', async () => {
    const { fixture, input, host, el } = await create(PlainHost);
    input.focus();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(el.querySelector('[data-star-part=leadingPanel]')).toBeNull();
    expect(el.querySelector('[data-star-part=trailingPanel]')).toBeNull();
    type(input, 'zzz');
    key(input, 'Escape');
    input.blur();
    await fixture.whenStable();
    expect(input.value).toBe('Alpha');
    expect(host.value()).toBe('Alpha');
  });
});

describe('star-icon-field around the autocomplete', () => {
  it('keeps the icon decorative before the control, and the buttons in place', async () => {
    const { el } = await create(IconFieldHost);
    const fields = el.querySelectorAll('star-icon-field');
    expect(fields).toHaveLength(2);
    for (const field of fields) {
      const icon = field.querySelector('.star-icon-field__icon')!;
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(field.firstElementChild).toBe(icon);
      expect(field.querySelector('.star-ac')).not.toBeNull();
    }
    const single = el.querySelector('star-autocomplete.single [data-star-part=controlPanel]')!;
    expect(single.lastElementChild!.querySelector('[data-star-part=dropdownIcon]')).not.toBeNull();
  });
});
