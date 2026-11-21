import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarEmptyTemplate,
  StarFooterTemplate,
  StarGroupTemplate,
  StarHeaderTemplate,
  StarLoadingTemplate,
} from '@star-ng/ui/core';
import { StarOptionTemplate } from '@star-ng/ui/select';
import { StarAutoComplete, StarMultiAutoComplete } from './autocomplete';

interface City {
  id: number;
  name: string;
  country: string;
}

const CITIES: City[] = [
  { id: 1, name: 'Berlin', country: 'Germany' },
  { id: 2, name: 'Munich', country: 'Germany' },
  { id: 3, name: 'Pune', country: 'India' },
];

@Component({
  imports: [
    StarAutoComplete,
    StarMultiAutoComplete,
    StarOptionTemplate,
    StarHeaderTemplate,
    StarFooterTemplate,
    StarEmptyTemplate,
    StarGroupTemplate,
  ],
  template: `
    <star-autocomplete
      class="single"
      [options]="cities"
      optionLabel="name"
      optionValue="id"
      optionGroup="country"
      ariaLabel="Single"
    >
      <ng-template starOption [starOptionOf]="cities" let-option
        ><b class="opt">{{ option.name }}!</b></ng-template
      >
      <ng-template starHeader><b class="head">Head</b></ng-template>
      <ng-template starFooter><b class="foot">Foot</b></ng-template>
      <ng-template starEmpty let-text
        ><b class="none">No match for {{ text }}</b></ng-template
      >
      <ng-template starGroup let-label let-count="count"
        ><b class="grp">{{ label }} ({{ count }})</b></ng-template
      >
    </star-autocomplete>
    <star-multi-autocomplete
      class="multi"
      [options]="cities"
      optionLabel="name"
      optionValue="id"
      ariaLabel="Multi"
    >
      <ng-template starHeader><b class="head">Multi head</b></ng-template>
      <ng-template starEmpty let-text
        ><b class="none">Multi none {{ text }}</b></ng-template
      >
    </star-multi-autocomplete>
    <star-autocomplete
      class="bare"
      [options]="cities"
      optionLabel="name"
      optionValue="id"
      optionGroup="country"
      ariaLabel="Bare"
    />
  `,
})
class Host {
  readonly cities = CITIES;
}

@Component({
  imports: [StarAutoComplete, StarLoadingTemplate],
  template: `
    <star-autocomplete
      [suggestions]="results()"
      [delay]="0"
      [loading]="busy()"
      optionLabel="name"
      optionValue="id"
      ariaLabel="Remote"
      (completeMethod)="queries.push($event.query)"
    >
      <ng-template starLoading><b class="busy">Loading</b></ng-template>
    </star-autocomplete>
  `,
})
class RemoteHost {
  readonly results = signal<readonly City[]>([]);
  readonly busy = signal(false);
  readonly queries: string[] = [];
}

function typeInto(root: HTMLElement, selector: string, text: string): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>(`${selector} input`)!;
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input'));
  return input;
}

function panelText(): string {
  return document.querySelector('.star-panel')?.textContent ?? '';
}

describe('StarAutoComplete slots', () => {
  it('option template draws each suggestion', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    typeInto(fixture.nativeElement, '.single', 'er');
    fixture.detectChanges();
    await fixture.whenStable();
    const options = [...document.querySelectorAll('[role="option"] .opt')].map(
      (el) => el.textContent,
    );
    expect(options).toEqual(['Berlin!']);
  });

  it('group slot gets the label and the count', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    typeInto(fixture.nativeElement, '.single', 'r');
    fixture.detectChanges();
    await fixture.whenStable();
    const groups = [...document.querySelectorAll('.grp')].map((el) => el.textContent);
    expect(groups).toEqual(['Germany (1)']);
  });

  it('empty slot receives the query', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    typeInto(fixture.nativeElement, '.single', 'zzz');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.none')?.textContent).toBe('No match for zzz');
  });

  it('header and footer render in the panel, outside the listbox', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    typeInto(fixture.nativeElement, '.single', 'er');
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = document.querySelector('.star-panel')!;
    expect(panel.querySelector('.head')).not.toBeNull();
    expect(panel.querySelector('.foot')).not.toBeNull();
    expect(panel.querySelector('[role="listbox"] .head')).toBeNull();
    expect(panel.querySelector('[role="listbox"] .foot')).toBeNull();
    expect(
      panel.querySelector('[data-star-part="panelHeader"].star-panel__header .head'),
    ).not.toBeNull();
    expect(
      panel.querySelector('[data-star-part="panelFooter"].star-panel__footer .foot'),
    ).not.toBeNull();
  });

  it('loading slot shows while loading is true, not from typing alone', async () => {
    const fixture = TestBed.createComponent(RemoteHost);
    fixture.detectChanges();
    typeInto(fixture.nativeElement, 'star-autocomplete', 'ber');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));
    fixture.detectChanges();
    expect(fixture.componentInstance.queries).toEqual(['ber']);
    expect(document.querySelector('.busy')).toBeNull();
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    expect(document.querySelector('.busy')).not.toBeNull();
    fixture.componentInstance.results.set([CITIES[0]]);
    fixture.componentInstance.busy.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.querySelector('.busy')).toBeNull();
    expect(panelText()).toContain('Berlin');
  });

  it('multi-autocomplete uses the same slots', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    typeInto(fixture.nativeElement, '.multi', 'zzz');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.head')?.textContent).toBe('Multi head');
    expect(document.querySelector('.none')?.textContent).toBe('Multi none zzz');
  });

  it('keeps the default text without slots', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    typeInto(fixture.nativeElement, '.bare', 'u');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(panelText().replace(/\s+/g, ' ').trim()).toBe('Germany Munich India Pune');
  });

  it('arrow keys skip group headings and Enter chooses the active option', async () => {
    const fixture = TestBed.createComponent(KeyHost);
    fixture.detectChanges();
    const input = typeInto(fixture.nativeElement, '.keyed', 'n');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.querySelectorAll('.grp').length).toBe(2);
    const press = async (key: string) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const active = () => {
      const id = input.getAttribute('aria-activedescendant');
      return id ? document.getElementById(id) : null;
    };
    const seen: (string | undefined)[] = [];
    await press('ArrowDown');
    for (let i = 0; i < 3; i++) {
      const el = active();
      expect(el?.getAttribute('role')).toBe('option');
      seen.push(el?.textContent?.trim());
      await press('ArrowDown');
    }
    // The three options come in order; headings are never the active element.
    expect(seen).toEqual(['Berlin!', 'Munich!', 'Pune!']);
    // The last ArrowDown stays on the last option. ArrowUp from Pune crosses the India heading.
    expect(active()?.textContent?.trim()).toBe('Pune!');
    await press('ArrowUp');
    expect(active()?.getAttribute('role')).toBe('option');
    expect(active()?.textContent?.trim()).toBe('Munich!');
    await press('Enter');
    expect(fixture.componentInstance.picked()).toBe(2);
  });
});

@Component({
  imports: [StarAutoComplete, StarOptionTemplate, StarGroupTemplate],
  template: `
    <star-autocomplete
      class="keyed"
      [options]="cities"
      optionLabel="name"
      optionValue="id"
      optionGroup="country"
      [(value)]="picked"
      ariaLabel="Keyed"
    >
      <ng-template starOption [starOptionOf]="cities" let-option
        ><b class="opt">{{ option.name }}!</b></ng-template
      >
      <ng-template starGroup let-label let-count="count"
        ><b class="grp">{{ label }} ({{ count }})</b></ng-template
      >
    </star-autocomplete>
  `,
})
class KeyHost {
  readonly cities = CITIES;
  readonly picked = signal<number | null>(null);
}
