import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarCellTemplate, StarColumn, StarTable } from './table';
import { countMatches, highlightParts } from './table-search';

describe('search helpers', () => {
  it('counts the matches without case and accents', () => {
    expect(countMatches('Málaga and Malmö', 'mal', null)).toBe(2);
    expect(countMatches('Oslo', 'lima', null)).toBe(0);
    expect(countMatches('Oslo', '  ', null)).toBe(0);
    expect(countMatches('', 'a', null)).toBe(0);
  });

  it('marks the parts and the active match', () => {
    expect(highlightParts('banana', 'an', null, 1)).toEqual([
      { text: 'b', match: false, active: false },
      { text: 'an', match: true, active: false },
      { text: 'an', match: true, active: true },
      { text: 'a', match: false, active: false },
    ]);
    expect(highlightParts('Oslo', '', null, -1)).toEqual([
      { text: 'Oslo', match: false, active: false },
    ]);
  });
});

interface Site {
  code: string;
  city: string;
  note: string;
}

const SITES: Site[] = Array.from({ length: 12 }, (_, i) => ({
  code: `W-${i + 1}`,
  city: ['Oslo', 'Lima', 'Málaga', 'Perth'][i % 4],
  note: i === 5 ? '<b>Dock</b> at Lima pier' : `Shelf ${i + 1}`,
}));

@Component({
  imports: [StarTable, StarCellTemplate],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    dataKey="code"
    ariaLabel="Sites"
    [paginator]="paged()"
    [rows]="4"
    [(first)]="first"
    [(searchText)]="search"
  >
    @if (custom()) {
      <ng-template starCell="city" [starCellOf]="rows" let-row let-highlight="highlight">
        <em class="custom">
          @for (part of highlight(row.city); track $index) {
            @if (part.match) {
              <b class="hit">{{ part.text }}</b>
            } @else {
              <span>{{ part.text }}</span>
            }
          }
        </em>
      </ng-template>
    }
  </star-table>`,
})
class SearchHost {
  readonly table = viewChild.required<StarTable<Site>>(StarTable);
  readonly rows = SITES;
  readonly paged = signal(false);
  readonly custom = signal(false);
  readonly first = signal(0);
  readonly search = signal('');
  readonly columns: StarColumn<Site>[] = [
    { field: 'code', header: 'Code' },
    { field: 'city', header: 'City' },
    { field: 'note', header: 'Note' },
  ];
}

async function setup(change: (host: SearchHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(SearchHost);
  const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce').mockResolvedValue();
  change(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const marks = () => [...el.querySelectorAll<HTMLElement>('mark.star-table__mark')];
  const active = () => el.querySelector<HTMLElement>('mark.star-table__mark--active');
  return { fixture, el, host: fixture.componentInstance, marks, active, announce };
}

describe('StarTable search highlight', () => {
  it('marks the matches in the cells and counts them over all rows', async () => {
    const { fixture, host, marks, el } = await setup();
    const table = host.table();
    expect(marks()).toEqual([]);
    host.search.set('lima');
    await fixture.whenStable();
    // Three Lima cells and the note "Dock at Lima pier".
    expect(table.searchMatches()).toEqual({ count: 4, active: -1 });
    expect(marks().map((mark) => mark.textContent)).toEqual(['Lima', 'Lima', 'Lima', 'Lima']);
    // The text stays text: the angle brackets of a cell are not markup.
    const note = el.querySelector('tbody tr:nth-child(6) td:nth-child(3)')!;
    expect(note.querySelector('b')).toBeNull();
    expect(note.textContent).toContain('<b>Dock</b> at Lima pier');
    expect(note.textContent?.replace(/\s+/g, ' ').trim()).toBe('<b>Dock</b> at Lima pier');

    host.search.set('MALAGA');
    await fixture.whenStable();
    expect(marks().map((mark) => mark.textContent)).toEqual(['Málaga', 'Málaga', 'Málaga']);
  });

  it('steps through the matches with wrap and clears the search', async () => {
    const { fixture, host, active, marks, announce } = await setup((h) => h.search.set('oslo'));
    const table = host.table();
    expect(table.findNext()).toBe(3);
    await fixture.whenStable();
    expect(table.searchMatches().active).toBe(0);
    expect(active()?.closest('tr')?.textContent).toContain('W-1');
    expect(announce).toHaveBeenLastCalledWith('1 of 3', 'polite');
    table.findPrevious();
    await fixture.whenStable();
    expect(table.searchMatches().active).toBe(2);
    expect(active()?.closest('tr')?.textContent).toContain('W-9');
    table.findNext();
    await fixture.whenStable();
    expect(table.searchMatches().active).toBe(0);

    table.clearSearch();
    await fixture.whenStable();
    expect(host.search()).toBe('');
    expect(marks()).toEqual([]);
    expect(table.findNext()).toBe(0);
    expect(table.searchMatches()).toEqual({ count: 0, active: -1 });
  });

  it('opens the page of the active match', async () => {
    const { fixture, host, active } = await setup((h) => {
      h.paged.set(true);
      h.search.set('perth');
    });
    const table = host.table();
    table.findNext();
    await fixture.whenStable();
    expect(host.first()).toBe(0);
    table.findNext();
    await fixture.whenStable();
    expect(host.first()).toBe(4);
    expect(active()?.closest('tr')?.textContent).toContain('W-8');
  });

  it('marks a cell template that opts in with highlight(text)', async () => {
    const { fixture, host, el } = await setup((h) => {
      h.custom.set(true);
      h.search.set('per');
    });
    host.table().findNext();
    await fixture.whenStable();
    const hits = [...el.querySelectorAll('em.custom b.hit')].map((hit) => hit.textContent);
    expect(hits).toEqual(['Per', 'Per', 'Per']);
    expect(el.querySelector('em.custom')!.textContent).toBe('Oslo');
  });
});
