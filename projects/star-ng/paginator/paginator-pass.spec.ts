import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarPaginator, StarPaginatorOption } from './paginator';

@Component({
  imports: [StarPaginator, StarPaginatorOption, StarIconTemplate],
  template: `
    <star-paginator
      [totalRecords]="30"
      [rows]="10"
      [rowsPerPageOptions]="[10, 20]"
      [showJumpToPageDropdown]="true"
    >
      @if (slots()) {
        <ng-template starPaginatorOption="rows" let-rows let-selected="selected"
          ><b class="own-rows">{{ rows }} rows{{ selected ? '*' : '' }}</b></ng-template
        >
        <ng-template starPaginatorOption="jump" let-page let-label="label"
          ><b class="own-jump">#{{ page }} ({{ label }})</b></ng-template
        >
        <ng-template starIcon="dropdown"><b class="own-caret">v</b></ng-template>
      }
    </star-paginator>
  `,
})
class Host {
  readonly slots = signal(true);
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const combos = [...el.querySelectorAll<HTMLElement>('[role=combobox]')];
  return { el, fixture, combos, stable: () => fixture.whenStable() };
}

describe('StarPaginator option and icon pass-through', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => c.remove()));

  it('passes the dropdown icon to both inner selects', async () => {
    const t = await setup();
    expect(t.combos.length).toBe(2);
    expect(t.el.querySelectorAll('.own-caret').length).toBe(2);
    expect(t.el.querySelector('.own-caret')!.closest('[aria-hidden=true]')).not.toBeNull();
  });

  it('renders the rows option template with the rows count and the selected flag', async () => {
    const t = await setup();
    t.combos[1].click();
    await t.stable();
    const rows = [...document.querySelectorAll('.own-rows')].map((n) => n.textContent);
    expect(rows).toEqual(['10 rows*', '20 rows']);
  });

  it('renders the jump option template with the page number from 1 and its label', async () => {
    const t = await setup();
    t.combos[0].click();
    await t.stable();
    const pages = [...document.querySelectorAll('.own-jump')].map((n) => n.textContent);
    expect(pages).toEqual(['#1 (1)', '#2 (2)', '#3 (3)']);
  });

  it('keeps the default options without the slots', async () => {
    const t = await setup();
    t.fixture.componentInstance.slots.set(false);
    await t.stable();
    expect(t.el.querySelector('.own-caret')).toBeNull();
    t.combos[1].click();
    await t.stable();
    expect(document.querySelector('.own-rows')).toBeNull();
    expect(document.querySelectorAll('[role=option]').length).toBe(2);
  });
});
