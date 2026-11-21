import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarFooterTemplate, StarHeaderTemplate, StarIconTemplate } from '@star-ng/ui/core';
import { StarCascadeGroupChangeEvent, StarCascadeSelect } from './cascade-select';

interface Place {
  name: string;
  code?: string;
  children?: Place[];
}

const PLACES: Place[] = [
  {
    name: 'Germany',
    children: [{ name: 'Bavaria', children: [{ name: 'Munich', code: 'MUC' }] }],
  },
  { name: 'Remote', code: 'REMOTE' },
];

@Component({
  imports: [StarCascadeSelect, StarHeaderTemplate, StarFooterTemplate, StarIconTemplate],
  template: `
    <star-cascade-select
      ariaLabel="Place"
      [options]="options"
      optionLabel="name"
      optionValue="code"
      (beforeShow)="log('beforeShow')"
      (show)="log('show')"
      (beforeHide)="log('beforeHide')"
      (hide)="log('hide')"
      (groupChange)="groups.push($event)"
    >
      <ng-template starHeader><b class="own-header">Pick a place</b></ng-template>
      <ng-template starFooter><b class="own-footer">Only active places</b></ng-template>
      <ng-template starIcon="group"><b class="own-group">></b></ng-template>
    </star-cascade-select>
  `,
})
class Host {
  readonly options = PLACES;
  readonly events: string[] = [];
  readonly groups: StarCascadeGroupChangeEvent<Place>[] = [];
  log(name: string): void {
    // Records whether the menu list is in the page at the time of the event.
    this.events.push(`${name}:${document.querySelector('[role=menu]') ? 'open' : 'none'}`);
  }
}

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => c.remove()));

describe('StarCascadeSelect panel slots and events', () => {
  it('shows the header, footer and group icon, and reports the group changes', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button',
    )!;
    trigger.click();
    await fixture.whenStable();
    expect(host.events).toEqual(['beforeShow:none', 'show:open']);
    const header = document.querySelector('.own-header')!;
    expect(header).not.toBeNull();
    expect(header.closest('[role=menu]')).toBeNull();
    expect(document.querySelector('.own-footer')!.closest('[role=menu]')).toBeNull();
    // The shared slot regions of the panels.
    expect(
      header.parentElement!.matches('[data-star-part="headerSlotPanel"].star-panel__header'),
    ).toBe(true);
    expect(
      document
        .querySelector('.own-footer')!
        .parentElement!.matches('[data-star-part="footerSlotPanel"].star-panel__footer'),
    ).toBe(true);
    expect(document.querySelectorAll('.own-group').length).toBe(1);
    const germany = document.querySelector<HTMLElement>('[role=menuitem]')!;
    germany.click();
    await fixture.whenStable();
    expect(host.groups.map((g) => [g.option.name, g.level])).toEqual([['Germany', 1]]);
    // The header and footer stay with the root list only.
    expect(document.querySelectorAll('.own-header').length).toBe(1);
    const bavaria = [...document.querySelectorAll<HTMLElement>('[role=menuitem]')].find((i) =>
      i.textContent!.includes('Bavaria'),
    )!;
    bavaria.click();
    await fixture.whenStable();
    expect(host.groups.map((g) => [g.option.name, g.level])).toEqual([
      ['Germany', 1],
      ['Bavaria', 2],
    ]);
    trigger.click();
    await fixture.whenStable();
    expect(host.events.slice(2)).toEqual(['beforeHide:open', 'hide:none']);
  });
});
