import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTab, StarTabCloseEvent, StarTabs } from '@star-ng/ui/tabs';

/** Gives an element a fake scroll size; jsdom has no layout. */
function fakeScroll(element: HTMLElement, client: number, total: number): void {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: client });
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: total });
}

const key = (target: Element, init: KeyboardEventInit) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

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

@Component({
  imports: [StarTabs, StarTab],
  template: `
    <star-tabs [(value)]="tab" ariaLabel="Files" (tabClose)="onClose($event)">
      @for (name of names(); track name) {
        <star-tab [value]="name" [label]="name" [closable]="name !== 'Fixed'">{{ name }}</star-tab>
      }
    </star-tabs>
  `,
})
class CloseHost {
  readonly tab = signal<string | null>('Two');
  readonly names = signal(['One', 'Two', 'Three', 'Fixed']);
  readonly events: StarTabCloseEvent[] = [];
  keep = false;
  onClose(event: StarTabCloseEvent): void {
    this.events.push(event);
    if (this.keep) event.cancel();
    else this.names.update((names) => names.filter((name) => name !== event.value));
  }
}

describe('StarTabs closable', () => {
  it('has a close button per closable tab, outside the tab, named "Close {label}"', async () => {
    const fixture = TestBed.createComponent(CloseHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const closes = [...el.querySelectorAll<HTMLButtonElement>('.star-tabs__close')];
    expect(closes.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Close One',
      'Close Two',
      'Close Three',
    ]);
    for (const button of closes) {
      expect(button.closest('[role=tab]')).toBeNull();
      expect(button.tabIndex).toBe(-1);
      expect(button.getAttribute('aria-hidden')).toBe('true');
    }
    const tabs = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    expect(tabs[0].getAttribute('aria-keyshortcuts')).toBe('Delete');
    expect(tabs[3].getAttribute('aria-keyshortcuts')).toBeNull();
    const hint = document.getElementById(tabs[0].getAttribute('aria-describedby')!);
    expect(hint?.textContent?.trim()).toBe('Press Delete to close the tab.');
  });

  it('emits tabClose on a click; the owner removes the tab and the next one is selected', async () => {
    const fixture = TestBed.createComponent(CloseHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelectorAll<HTMLButtonElement>('.star-tabs__close')[1].click();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    expect(host.events.map((e) => [e.value, e.index])).toEqual([['Two', 1]]);
    expect(host.names()).toEqual(['One', 'Three', 'Fixed']);
    expect(host.tab()).toBe('Three');
  });

  it('closes the focused tab with Delete, moves the focus, and cancel() keeps the tab', async () => {
    const fixture = TestBed.createComponent(CloseHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const host = fixture.componentInstance;
    let tabs = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    tabs[2].focus();
    key(tabs[2], { key: 'Delete' });
    await fixture.whenStable();
    expect(host.names()).toEqual(['One', 'Two', 'Fixed']);
    expect(host.tab()).toBe('Two'); // the closed tab was not selected
    tabs = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    expect(document.activeElement).toBe(tabs[2]); // "Fixed" took the place

    // A handler that calls cancel() keeps the tab.
    host.keep = true;
    key(tabs[1], { key: 'Delete' });
    await fixture.whenStable();
    expect(host.events.at(-1)?.canceled).toBe(true);
    expect(host.names()).toEqual(['One', 'Two', 'Fixed']);
    expect(host.tab()).toBe('Two');

    // Delete on a tab that is not closable does nothing.
    key(tabs[2], { key: 'Delete' });
    expect(host.events.length).toBe(2);
  });
});
