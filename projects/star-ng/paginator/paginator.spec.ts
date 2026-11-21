import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarPageEvent, StarPaginator, StarPaginatorTemplate } from './paginator';

@Component({
  imports: [StarPaginator, StarPaginatorTemplate, StarIconTemplate],
  template: `
    <star-paginator
      [totalRecords]="total()"
      [(first)]="first"
      [rows]="10"
      [rowsPerPageOptions]="[]"
      [alwaysShow]="alwaysShow()"
      [showPageLinks]="links()"
      [showJumpToPageInput]="jumpInput()"
      [showJumpToPageDropdown]="jumpSelect()"
      [currentPageReportTemplate]="reportTemplate()"
      locale="de-DE"
      (pageChange)="pages.push($event)"
    >
      @if (slots()) {
        <ng-template starPaginatorTemplate="start" let-state
          ><b class="own-start">{{ state.page }}/{{ state.pageCount }}</b></ng-template
        >
        <ng-template starPaginatorTemplate="end"><b class="own-end">end</b></ng-template>
        <ng-template starIcon="next"><b class="own-next">></b></ng-template>
      }
    </star-paginator>
  `,
})
class Host {
  readonly total = signal(12000);
  readonly first = signal(0);
  readonly alwaysShow = signal(true);
  readonly links = signal(true);
  readonly jumpInput = signal(false);
  readonly jumpSelect = signal(false);
  readonly reportTemplate = signal<string | null>(null);
  readonly slots = signal(false);
  readonly pages: StarPageEvent[] = [];
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    el,
    host: fixture.componentInstance,
    paginator: el.querySelector<HTMLElement>('star-paginator')!,
    stable: () => fixture.whenStable(),
  };
}

describe('StarPaginator depth', () => {
  it('fills the report template and formats numbers with the locale', async () => {
    const t = await setup((h) => {
      h.reportTemplate.set(
        'Page {currentPage} of {totalPages}: {first} to {last} of {totalRecords}',
      );
      h.first.set(1000);
    });
    expect(t.el.querySelector('.star-paginator__report')!.textContent!.trim()).toBe(
      'Page 101 of 1.200: 1.001 to 1.010 of 12.000',
    );
    const active = t.el.querySelector('.star-paginator__page--active')!;
    expect(active.textContent!.trim()).toBe('101');
  });

  it('hides with alwaysShow off when there is one page, and hides the page links', async () => {
    const t = await setup((h) => {
      h.alwaysShow.set(false);
      h.total.set(5);
    });
    expect(t.paginator.hidden).toBe(true);
    t.host.total.set(50);
    t.host.links.set(false);
    await t.stable();
    expect(t.paginator.hidden).toBe(false);
    expect(t.el.querySelector('.star-paginator__page')).toBeNull();
  });

  it('jumps to a typed page', async () => {
    const t = await setup((h) => {
      h.jumpInput.set(true);
      h.total.set(100);
    });
    const input = t.el.querySelector<HTMLInputElement>('input[type=number]')!;
    expect(input.closest('label')!.textContent!.trim()).toBe('Go to page');
    input.value = '7';
    input.dispatchEvent(new Event('change'));
    await t.stable();
    expect(t.host.first()).toBe(60);
    expect(t.host.pages.at(-1)!.page).toBe(6);
    input.value = '99';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await t.stable();
    expect(t.host.first()).toBe(90);
    expect(input.value).toBe('10');
  });

  it('shows a page select', async () => {
    const t = await setup((h) => {
      h.jumpSelect.set(true);
      h.total.set(30);
    });
    const combo = t.el.querySelector('[role=combobox]')!;
    expect(combo).not.toBeNull();
    expect(t.el.querySelector('.star-paginator__rows')!.textContent).toContain('Go to page');
  });

  it('renders the start, end and icon slots', async () => {
    const t = await setup((h) => {
      h.slots.set(true);
      h.total.set(30);
    });
    expect(t.el.querySelector('.own-start')!.textContent).toBe('0/3');
    expect(t.el.querySelector('.own-end')).not.toBeNull();
    expect(t.el.querySelector('.own-next')!.closest('[aria-hidden=true]')).not.toBeNull();
  });
});
