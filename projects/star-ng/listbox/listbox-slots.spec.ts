import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarEmptyTemplate,
  StarFooterTemplate,
  StarGroupTemplate,
  StarHeaderTemplate,
} from '@star-ng/ui/core';
import { StarListbox } from './listbox';

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
  imports: [StarListbox, StarHeaderTemplate, StarFooterTemplate, StarEmptyTemplate],
  template: `
    <star-listbox
      class="plain"
      [options]="cities"
      optionLabel="name"
      optionValue="id"
      ariaLabel="Plain"
      filter
    >
      <ng-template starHeader><b class="head">Head</b></ng-template>
      <ng-template starFooter><b class="foot">Foot</b></ng-template>
      <ng-template starEmpty let-text
        ><b class="none">No match for {{ text }}</b></ng-template
      >
    </star-listbox>
    <star-listbox class="bare" [options]="cities" optionLabel="name" ariaLabel="Bare" />
    <star-listbox
      class="bare-grouped"
      [options]="cities"
      optionLabel="name"
      optionGroup="country"
      ariaLabel="Bare grouped"
    />
    <star-listbox class="bare-empty" [options]="[]" ariaLabel="Bare empty" />
  `,
})
class PlainHost {
  readonly cities = CITIES;
}

@Component({
  imports: [StarListbox, StarGroupTemplate],
  template: `
    <star-listbox
      [options]="cities"
      optionLabel="name"
      optionValue="id"
      optionGroup="country"
      multiple
      [(value)]="picked"
      ariaLabel="Grouped"
    >
      <ng-template starGroup let-label let-count="count">
        <b class="grp">{{ label }} ({{ count }})</b>
      </ng-template>
    </star-listbox>
  `,
})
class GroupedHost {
  readonly cities = CITIES;
  readonly picked = signal<unknown>([]);
}

describe('StarListbox slots', () => {
  it('header and footer render around the list', () => {
    const fixture = TestBed.createComponent(PlainHost);
    fixture.detectChanges();
    const box = (fixture.nativeElement as HTMLElement).querySelector('.plain') as HTMLElement;
    const head = box.querySelector('.head') as HTMLElement;
    const foot = box.querySelector('.foot') as HTMLElement;
    const filter = box.querySelector('.star-panel__filter') as HTMLElement;
    const list = box.querySelector('[role="listbox"]') as HTMLElement;
    expect(head.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(list.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('empty slot receives the filter text', () => {
    const fixture = TestBed.createComponent(PlainHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('.plain input') as HTMLInputElement;
    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.querySelector('.plain .none')?.textContent).toBe('No match for zzz');
  });

  it('group slot gets label and count', () => {
    const fixture = TestBed.createComponent(GroupedHost);
    fixture.detectChanges();
    const groups = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.grp'),
      (el) => el.textContent?.trim(),
    );
    expect(groups).toEqual(['Germany (2)', 'India (1)']);
  });

  it('checkbox or multiple selection still works with starGroup', () => {
    const fixture = TestBed.createComponent(GroupedHost);
    fixture.detectChanges();
    const options = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      '[role="option"]',
    );
    options[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.picked()).toContain(2);
  });

  it('keeps default text unchanged without slots', () => {
    const fixture = TestBed.createComponent(PlainHost);
    fixture.detectChanges();
    const bare = (fixture.nativeElement as HTMLElement).querySelector('.bare') as HTMLElement;
    const labels = Array.from(
      bare.querySelectorAll('.star-listbox__label'),
      (el) => el.textContent,
    );
    expect(labels).toEqual([' Berlin ', ' Munich ', ' Pune ']);
  });

  it('keeps default group and empty text free of extra whitespace', () => {
    const fixture = TestBed.createComponent(PlainHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const groups = Array.from(
      root.querySelectorAll('.bare-grouped .star-listbox__group'),
      (el) => el.textContent,
    );
    expect(groups).toEqual(['Germany', 'India']);
    expect(root.querySelector('.bare-empty .star-listbox__empty')?.textContent).toBe(
      'No results found',
    );
  });
});
