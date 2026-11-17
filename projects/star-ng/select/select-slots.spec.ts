import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarEmptyTemplate,
  StarFooterTemplate,
  StarGroupTemplate,
  StarHeaderTemplate,
  StarIconTemplate,
  StarLoadingTemplate,
} from '@star-ng/ui/core';
import { StarMultiSelect } from './multi-select';
import { StarOptionTemplate } from './option-list-base';
import { StarSelect } from './select';
import { StarChipTemplate, StarSelectedTemplate } from './select-slots';

interface Country {
  code: string;
  name: string;
  region: string;
  disabled?: boolean;
}

const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', region: 'Asia' },
  { code: 'DE', name: 'Germany', region: 'Europe', disabled: true },
  { code: 'FR', name: 'France', region: 'Europe' },
  { code: 'ES', name: 'Spain', region: 'Europe' },
];

@Component({
  imports: [
    StarSelect,
    StarMultiSelect,
    StarOptionTemplate,
    StarHeaderTemplate,
    StarFooterTemplate,
    StarEmptyTemplate,
    StarLoadingTemplate,
    StarGroupTemplate,
    StarIconTemplate,
    StarSelectedTemplate,
    StarChipTemplate,
  ],
  template: `
    <star-select
      class="plain"
      [options]="countries"
      optionLabel="name"
      optionValue="code"
      [(value)]="country"
      ariaLabel="Plain"
      filter
      showClear
      [loading]="loading()"
    >
      <ng-template starHeader>Head</ng-template>
      <ng-template starFooter>Foot</ng-template>
      <ng-template starEmpty let-text>No match for {{ text }}</ng-template>
      <ng-template starLoading><b class="load">Fetching</b></ng-template>
      <ng-template starSelected [starSelectedOf]="countries" let-item>
        {{ item.code }} · {{ item.name }}
      </ng-template>
      <ng-template starIcon="clear"><b class="my-clear">x</b></ng-template>
    </star-select>

    <star-select
      class="grouped"
      [options]="countries"
      optionLabel="name"
      optionValue="code"
      optionGroup="region"
      optionDisabled="disabled"
      ariaLabel="Grouped"
    >
      <ng-template starOption [starOptionOf]="countries" let-item>{{ item.name }}</ng-template>
      <ng-template starGroup let-label let-count="count">
        <b class="grp">{{ label }} ({{ count }})</b>
      </ng-template>
    </star-select>

    <star-multi-select
      class="multi"
      [options]="countries"
      optionLabel="name"
      optionValue="code"
      [(value)]="codes"
      display="chip"
      ariaLabel="Multi"
      [disabled]="multiDisabled()"
      [readonly]="multiReadonly()"
    >
      <ng-template
        starChip
        [starChipOf]="countries"
        let-item
        let-remove="remove"
        let-interactive="interactive"
      >
        <span class="my-chip" [attr.data-interactive]="interactive">{{ item.code }}</span>
        <button type="button" class="my-remove" tabindex="-1" (click)="remove()">drop</button>
      </ng-template>
    </star-multi-select>
  `,
})
class Host {
  readonly countries = COUNTRIES;
  readonly country = signal<string | null>(null);
  readonly codes = signal<readonly string[]>(['IN', 'FR']);
  readonly loading = signal(false);
  readonly multiDisabled = signal(false);
  readonly multiReadonly = signal(false);
}

@Component({
  imports: [StarSelect, StarMultiSelect, StarIconTemplate],
  template: `
    <star-select
      class="icons"
      [options]="countries"
      optionLabel="name"
      optionValue="code"
      [(value)]="country"
      ariaLabel="Icons"
      filter
    >
      <ng-template starIcon="dropdown"><b class="my-caret">v</b></ng-template>
      <ng-template starIcon="check"><b class="my-check">ok</b></ng-template>
      <ng-template starIcon="filter"><b class="my-filter">find</b></ng-template>
    </star-select>

    <star-select
      class="bare"
      [options]="countries"
      optionLabel="name"
      optionValue="code"
      optionGroup="region"
      [(value)]="country"
      ariaLabel="Bare"
      filter
    />

    <star-multi-select
      class="bare-multi"
      [options]="countries"
      optionLabel="name"
      optionValue="code"
      optionGroup="region"
      ariaLabel="Bare multi"
      filter
    />
  `,
})
class PlainHost {
  readonly countries = COUNTRIES;
  readonly country = signal<string | null>('FR');
}

/** Text a screen reader reads: textContent without `aria-hidden` parts. */
function accessibleText(node: Node): string {
  if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  return [...node.childNodes].map(accessibleText).join('');
}

function key(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function options(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[role=option]')];
}

describe('select slots', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      el,
      plain: el.querySelector<HTMLElement>('.plain [role=combobox]')!,
      grouped: el.querySelector<HTMLElement>('.grouped [role=combobox]')!,
    };
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('header and footer render in the open panel', async () => {
    const { fixture, plain } = await setup();
    plain.click();
    await fixture.whenStable();
    const text = document.querySelector('.star-panel')?.textContent ?? '';
    expect(text).toContain('Head');
    expect(text).toContain('Foot');
  });

  it('empty slot receives the filter text', async () => {
    const { fixture, plain } = await setup();
    plain.click();
    await fixture.whenStable();
    const filter = document.querySelector<HTMLInputElement>('[role=searchbox]')!;
    filter.value = 'zz';
    filter.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(document.querySelector('.star-listbox__empty')?.textContent?.trim()).toBe(
      'No match for zz',
    );
    filter.value = 'zzz';
    filter.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(document.querySelector('.star-listbox__empty')?.textContent?.trim()).toBe(
      'No match for zzz',
    );
  });

  it('loading slot replaces the loading row', async () => {
    const { fixture, host, plain } = await setup();
    host.loading.set(true);
    plain.click();
    await fixture.whenStable();
    const panel = document.querySelector('.star-panel')!;
    expect(panel.querySelector('.load')?.textContent).toBe('Fetching');
    expect(panel.textContent).not.toContain('Loading');
  });

  it('group slot gets label and count', async () => {
    const { fixture, grouped } = await setup();
    grouped.click();
    await fixture.whenStable();
    const headings = [...document.querySelectorAll('.grp')].map((n) => n.textContent?.trim());
    expect(headings).toEqual(['Asia (1)', 'Europe (3)']);
  });

  it('selected slot renders in the trigger', async () => {
    const { fixture, host, plain } = await setup();
    plain.click();
    await fixture.whenStable();
    options()[2].click();
    await fixture.whenStable();
    expect(host.country()).toBe('FR');
    expect(plain.textContent?.trim()).toBe('FR · France');
  });

  it('selected slot is not rendered without a value', async () => {
    const { plain } = await setup();
    expect(plain.textContent).toContain('Select');
  });

  it('chip slot remove() removes the value', async () => {
    const { fixture, host, el } = await setup();
    expect([...el.querySelectorAll('.my-chip')].map((n) => n.textContent)).toEqual(['IN', 'FR']);
    el.querySelectorAll<HTMLElement>('.my-remove')[1].click();
    await fixture.whenStable();
    expect(host.codes()).toEqual(['IN']);
  });

  it('chip slot remove() does nothing when the control is disabled', async () => {
    const { fixture, host, el } = await setup();
    host.multiDisabled.set(true);
    await fixture.whenStable();
    expect(el.querySelector('.my-chip')?.getAttribute('data-interactive')).toBe('false');
    el.querySelectorAll<HTMLElement>('.my-remove')[1].click();
    await fixture.whenStable();
    expect(host.codes()).toEqual(['IN', 'FR']);
  });

  it('chip slot remove() does nothing when the control is read-only', async () => {
    const { fixture, host, el } = await setup();
    expect(el.querySelector('.my-chip')?.getAttribute('data-interactive')).toBe('true');
    host.multiReadonly.set(true);
    await fixture.whenStable();
    expect(el.querySelector('.my-chip')?.getAttribute('data-interactive')).toBe('false');
    el.querySelectorAll<HTMLElement>('.my-remove')[0].click();
    await fixture.whenStable();
    expect(host.codes()).toEqual(['IN', 'FR']);
  });

  it('removes a value with the keyboard through the panel when starChip is present', async () => {
    const { fixture, host, el } = await setup();
    const multi = el.querySelector<HTMLElement>('.multi [role=combobox]')!;
    multi.focus();
    key(multi, 'ArrowDown'); // opens, India (first option) active
    await fixture.whenStable();
    key(multi, 'Enter'); // India is chosen: Enter toggles it off
    await fixture.whenStable();
    expect(host.codes()).toEqual(['FR']);
    expect([...el.querySelectorAll('.my-chip')].map((n) => n.textContent)).toEqual(['FR']);
  });

  it('clear icon slot replaces the default icon', async () => {
    const { fixture, host, el } = await setup();
    host.country.set('IN');
    await fixture.whenStable();
    const button = el.querySelector('.plain .star-select__icon-btn')!;
    expect(button.querySelector('.my-clear')).not.toBeNull();
    expect(button.querySelector('.ph-x')).toBeNull();
  });

  it('arrow keys still move the active option with starOption and starGroup', async () => {
    const { fixture, grouped } = await setup();
    key(grouped, 'ArrowDown'); // opens, India active
    await fixture.whenStable();
    key(grouped, 'ArrowDown'); // Germany disabled -> France
    await fixture.whenStable();
    const rows = options();
    expect(rows.map((o) => o.textContent?.trim())).toEqual(['India', 'Germany', 'France', 'Spain']);
    expect(grouped.getAttribute('aria-activedescendant')).toBe(rows[2].id);
  });
});

describe('select icon slots and default text', () => {
  async function setup() {
    const fixture = TestBed.createComponent(PlainHost);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('a custom dropdown icon sits in an aria-hidden wrapper with the caret class', async () => {
    const { el } = await setup();
    const wrapper = el.querySelector('.icons .my-caret')!.parentElement!;
    expect(wrapper.classList).toContain('star-select__caret');
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.icons .ph-caret-down')).toBeNull();
  });

  it('a custom check icon is hidden and not part of the option text', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLElement>('.icons [role=combobox]')!.click();
    await fixture.whenStable();
    const filterWrapper = document.querySelector('.my-filter')!.parentElement!;
    expect(filterWrapper.getAttribute('aria-hidden')).toBe('true');
    const selected = document.querySelector<HTMLElement>('[role=option][aria-selected=true]')!;
    const wrapper = selected.querySelector('.my-check')!.parentElement!;
    expect(wrapper.classList).toContain('star-listbox__check');
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    expect(accessibleText(selected).trim()).toBe('France');
  });

  it('keeps the exact text of the trigger, group heading and empty message without slots', async () => {
    const { fixture, el } = await setup();
    const trigger = el.querySelector<HTMLElement>('.bare [role=combobox]')!;
    expect(trigger.querySelector('.star-select__value')?.textContent).toBe('France');
    trigger.click();
    await fixture.whenStable();
    expect(document.querySelector('.star-listbox__group')?.textContent).toBe('Asia');
    const filter = document.querySelector<HTMLInputElement>('[role=searchbox]')!;
    filter.value = 'zz';
    filter.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(document.querySelector('.star-listbox__empty')?.textContent).toBe('No results found');
  });

  it('keeps the exact text of the multi select group heading and empty message', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLElement>('.bare-multi [role=combobox]')!.click();
    await fixture.whenStable();
    expect(document.querySelector('.star-listbox__group')?.textContent).toBe('Asia');
    const filter = document.querySelector<HTMLInputElement>('[role=searchbox]')!;
    filter.value = 'zz';
    filter.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(document.querySelector('.star-listbox__empty')?.textContent).toBe('No results found');
  });
});
