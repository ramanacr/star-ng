import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTab, StarTabs } from '@star-ng/ui/tabs';

/** Gives an element a fake scroll size; jsdom has no layout. */
function fakeScroll(element: HTMLElement, client: number, total: number): void {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: client });
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: total });
}

@Component({
  imports: [StarTabs, StarTab],
  template: `
    <star-tabs [(value)]="tab" [scrollable]="scrollable()" ariaLabel="Sections">
      @for (name of names; track name) {
        <star-tab [value]="name" [label]="name">Panel {{ name }}</star-tab>
      }
    </star-tabs>
  `,
})
class ScrollHost {
  readonly tab = signal<string | null>(null);
  readonly scrollable = signal(true);
  readonly names = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
}

describe('StarTabs scrollable', () => {
  it('shows the scroll buttons only when the list overflows, out of the tab order', async () => {
    const fixture = TestBed.createComponent(ScrollHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const host = el.querySelector('star-tabs')!;
    expect(host.classList).toContain('star-tabs--scrollable');
    const list = el.querySelector<HTMLElement>('[role=tablist]')!;
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.star-tabs__scroll')];
    expect(buttons.length).toBe(2);
    for (const button of buttons) {
      expect(button.getAttribute('aria-hidden')).toBe('true');
      expect(button.tabIndex).toBe(-1);
      expect(button.hidden).toBe(true);
      expect(list.contains(button)).toBe(false);
    }

    fakeScroll(list, 200, 600);
    list.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(buttons[0].hidden).toBe(true); // at the start
    expect(buttons[1].hidden).toBe(false);

    list.scrollLeft = 100;
    list.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(buttons[0].hidden).toBe(false);
    expect(buttons[1].hidden).toBe(false);

    list.scrollLeft = 400;
    list.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(buttons[1].hidden).toBe(true);
  });

  it('scrolls by a page in reading order and keeps the selected tab in view', async () => {
    const fixture = TestBed.createComponent(ScrollHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const list = el.querySelector<HTMLElement>('[role=tablist]')!;
    fakeScroll(list, 200, 600);
    list.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    const [, next] = el.querySelectorAll<HTMLButtonElement>('.star-tabs__scroll');
    next.click();
    expect(list.scrollLeft).toBe(160);

    // The selected tab scrolls into the visible part of the list.
    list.getBoundingClientRect = () => ({ left: 0, right: 200, top: 0, bottom: 40 }) as DOMRect;
    const tabs = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    tabs[5].getBoundingClientRect = () =>
      ({ left: 500, right: 580, top: 0, bottom: 40 }) as DOMRect;
    list.scrollLeft = 0;
    fixture.componentInstance.tab.set('Six');
    await fixture.whenStable();
    expect(list.scrollLeft).toBe(380);
  });

  it('has no scroll buttons when scrollable is off', async () => {
    const fixture = TestBed.createComponent(ScrollHost);
    fixture.componentInstance.scrollable.set(false);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.star-tabs__scroll')).toBeNull();
    expect(el.querySelector('star-tabs')!.classList).not.toContain('star-tabs--scrollable');
  });
});
