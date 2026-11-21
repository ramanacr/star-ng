import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarEmptyTemplate,
  StarFooterTemplate,
  StarGroupTemplate,
  StarHeaderTemplate,
} from '@star-ng/ui/core';
import { StarOptionTemplate } from '@star-ng/ui/select';
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
  imports: [StarListbox, StarHeaderTemplate, StarFooterTemplate],
  template: `
    <star-listbox
      [options]="cities"
      optionLabel="name"
      ariaLabel="Styled"
      unstyled
      [pt]="{ headerSlotPanel: { class: 'my-head' }, footerSlotPanel: { class: 'my-foot' } }"
    >
      <ng-template starHeader>Head</ng-template>
      <ng-template starFooter>Foot</ng-template>
    </star-listbox>
  `,
})
class PtHost {
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

@Component({
  imports: [StarListbox, StarGroupTemplate, StarOptionTemplate, StarEmptyTemplate],
  template: `
    <star-listbox
      class="virt"
      [options]="cities"
      optionLabel="name"
      optionValue="id"
      optionGroup="country"
      virtualScroll
      ariaLabel="Virtual"
    >
      <ng-template starGroup let-label let-count="count">
        <b class="vgrp">{{ label }} ({{ count }})</b>
      </ng-template>
      <ng-template starOption [starOptionOf]="cities" let-city
        ><i class="vopt">{{ city.name }}!</i></ng-template
      >
    </star-listbox>
    <star-listbox class="virt-empty" [options]="[]" virtualScroll ariaLabel="Virtual empty">
      <ng-template starEmpty><b class="vnone">Nothing</b></ng-template>
    </star-listbox>
    <star-listbox
      class="virt-bare"
      [options]="cities"
      optionLabel="name"
      optionGroup="country"
      virtualScroll
      ariaLabel="Virtual bare"
    />
    <star-listbox
      class="virt-bare-empty"
      [options]="[]"
      virtualScroll
      ariaLabel="Virtual bare empty"
    />
  `,
})
class VirtualHost {
  readonly cities = CITIES;
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
    // The shared slot regions, outside the scrolling list.
    expect(
      head.parentElement!.matches('[data-star-part="headerSlotPanel"].star-panel__header'),
    ).toBe(true);
    expect(
      foot.parentElement!.matches('[data-star-part="footerSlotPanel"].star-panel__footer'),
    ).toBe(true);
    expect(list.contains(foot)).toBe(false);
  });

  it('the slot regions take the pass-through and the unstyled mode', async () => {
    const fixture = TestBed.createComponent(PtHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const head = el.querySelector('[data-star-part="headerSlotPanel"]')!;
    const foot = el.querySelector('[data-star-part="footerSlotPanel"]')!;
    expect(head.classList).toContain('star-panel__header');
    expect(head.classList).toContain('my-head');
    expect(foot.classList).toContain('star-panel__footer');
    expect(foot.classList).toContain('my-foot');
    expect(head.hasAttribute('data-star-unstyled')).toBe(true);
    expect(foot.hasAttribute('data-star-unstyled')).toBe(true);
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

  it('multiple selection with starGroup: aria-selected, deselect and option count', () => {
    const fixture = TestBed.createComponent(GroupedHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const options = () => root.querySelectorAll<HTMLElement>('[role="option"]');
    const selected = () =>
      Array.from(options(), (o) => o.getAttribute('aria-selected')).map((v) => v === 'true');
    expect(options().length).toBe(3);
    expect(root.querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe(
      'true',
    );
    expect(selected()).toEqual([false, false, false]);

    options()[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.picked()).toEqual([2]);
    expect(selected()).toEqual([false, true, false]);

    options()[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.picked()).toEqual([2, 3]);
    expect(selected()).toEqual([false, true, true]);

    // A second click on a selected option removes it.
    options()[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.picked()).toEqual([3]);
    expect(selected()).toEqual([false, false, true]);
    expect(options().length).toBe(3);
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

describe('StarListbox slots with virtualScroll', () => {
  async function setup() {
    const fixture = TestBed.createComponent(VirtualHost);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('starGroup and starOption render in the virtual rows', async () => {
    const { el } = await setup();
    const box = el.querySelector('.virt') as HTMLElement;
    const groups = Array.from(box.querySelectorAll('.vgrp'), (n) => n.textContent?.trim());
    expect(groups).toEqual(['Germany (2)', 'India (1)']);
    const options = Array.from(box.querySelectorAll('.vopt'), (n) => n.textContent);
    expect(options).toEqual(['Berlin!', 'Munich!', 'Pune!']);
    const rows = box.querySelectorAll('[role="option"]');
    expect(rows.length).toBe(3);
    expect(rows[0].getAttribute('aria-setsize')).toBe('3');
    expect(rows[0].getAttribute('aria-describedby')).toBe(
      box.querySelector('.star-listbox__group')?.id,
    );
  });

  it('starEmpty renders outside the virtual viewport', async () => {
    const { el } = await setup();
    const box = el.querySelector('.virt-empty') as HTMLElement;
    const none = box.querySelector('.vnone') as HTMLElement;
    expect(none.textContent).toBe('Nothing');
    expect(box.querySelector('[role="listbox"]')?.contains(none)).toBe(false);
  });

  it('default group heading and empty text stay free of extra whitespace', async () => {
    const { el } = await setup();
    const groups = Array.from(
      el.querySelectorAll('.virt-bare .star-listbox__group'),
      (n) => n.textContent,
    );
    expect(groups).toEqual(['Germany', 'India']);
    expect(el.querySelector('.virt-bare-empty .star-listbox__empty')?.textContent).toBe(
      'No results found',
    );
  });
});
