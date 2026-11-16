import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarPaginator } from '@star-ng/ui/paginator';
import { StarTab, StarTabContent, StarTabs } from '@star-ng/ui/tabs';

@Component({
  imports: [StarPaginator],
  template: `<star-paginator [totalRecords]="95" [(first)]="first" [(rows)]="rows" />`,
})
class PaginatorHost {
  readonly first = signal(0);
  readonly rows = signal(10);
}

@Component({
  imports: [StarTabs, StarTab, StarTabContent],
  template: `
    <star-tabs [(value)]="tab" ariaLabel="Sections">
      <star-tab value="a" label="A">Panel A</star-tab>
      <star-tab value="b" label="B" disabled>Panel B</star-tab>
      <star-tab value="c" label="C"><ng-template starTabContent>Lazy C</ng-template></star-tab>
    </star-tabs>
  `,
})
class TabsHost {
  readonly tab = signal<string | null>(null);
}

describe('StarPaginator', () => {
  it('pages forward, reports range and changes rows per page', async () => {
    const fixture = TestBed.createComponent(PaginatorHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.star-paginator__report')?.textContent).toContain('1–10 of 95');
    el.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.first()).toBe(10);
    el.querySelector<HTMLButtonElement>('[aria-label="Last page"]')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.first()).toBe(90);
    expect(el.querySelector('.star-paginator__report')?.textContent).toContain('91–95 of 95');
    expect(el.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.disabled).toBe(true);
    // Rows per page is a StarNG select (no native popup), labelled by the visible text.
    expect(el.querySelector('select')).toBeNull();
    const rows = el.querySelector<HTMLElement>('star-select [role=combobox]')!;
    const label = document.getElementById(rows.getAttribute('aria-labelledby')!);
    expect(label?.textContent).toBe('Rows per page');
    expect(rows.textContent?.trim()).toBe('10');
    expect(el.querySelector('star-select')!.classList).toContain('star-select--sm');
    rows.click();
    await fixture.whenStable();
    const options = [...document.querySelectorAll<HTMLElement>('[role=option]')];
    expect(options.map((option) => option.textContent?.trim())).toEqual(['10', '25', '50']);
    options[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.rows()).toBe(25);
    expect(fixture.componentInstance.first()).toBe(75);
    expect(el.querySelector('[aria-current=page]')?.textContent?.trim()).toBe('4');
  });
});

describe('StarTabs', () => {
  it('selects the first tab by default, skips disabled tabs and renders lazy content once', async () => {
    const fixture = TestBed.createComponent(TabsHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const tabs = [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    const panels = [...el.querySelectorAll<HTMLElement>('[role=tabpanel]')];
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].tabIndex).toBe(0);
    expect(tabs[2].tabIndex).toBe(-1);
    expect(panels[2].textContent).not.toContain('Lazy C');

    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.tab()).toBe('c');
    expect(panels[2].hidden).toBe(false);
    expect(panels[2].textContent).toContain('Lazy C');
    expect(panels[2].getAttribute('aria-labelledby')).toBe(tabs[2].id);

    tabs[0].click();
    await fixture.whenStable();
    expect(panels[2].hidden).toBe(true);
    expect(panels[2].textContent).toContain('Lazy C');
  });
});
