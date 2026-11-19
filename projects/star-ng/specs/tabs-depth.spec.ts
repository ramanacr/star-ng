import { moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarTab,
  StarTabCloseEvent,
  StarTabContent,
  StarTabHeader,
  StarTabReorderEvent,
  StarTabs,
} from '@star-ng/ui/tabs';

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

describe('StarTabs close button for assistive technology', () => {
  it('has one named close button for the selected tab, outside the tab list', async () => {
    const fixture = TestBed.createComponent(CloseHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const close = () => el.querySelector<HTMLButtonElement>('.star-tabs__close-selected');
    const list = el.querySelector('[role=tablist]')!;
    expect(close()?.textContent?.trim()).toBe('Close Two');
    expect(close()?.getAttribute('aria-hidden')).toBeNull();
    expect(close()?.tabIndex).toBe(0);
    expect(list.contains(close())).toBe(false);
    expect(close()?.closest('.star-tabs__nav')).not.toBeNull();

    close()!.focus();
    close()!.click();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    expect(host.names()).toEqual(['One', 'Three', 'Fixed']);
    expect(host.tab()).toBe('Three');
    const tabs = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    expect(document.activeElement).toBe(tabs[1]);
    expect(close()?.textContent?.trim()).toBe('Close Three');

    // The selected tab is not closable: no button.
    host.tab.set('Fixed');
    await fixture.whenStable();
    expect(close()).toBeNull();
  });

  it('moves the focus to the neighbour after a click on a pointer close button', async () => {
    const fixture = TestBed.createComponent(CloseHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const pointer = el.querySelectorAll<HTMLButtonElement>('.star-tabs__close')[0];
    pointer.focus();
    pointer.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.names()).toEqual(['Two', 'Three', 'Fixed']);
    expect(document.activeElement?.textContent?.trim()).toBe('Two');
  });
});

@Component({
  imports: [StarTabs, StarTab, StarTabContent],
  template: `
    <star-tabs [(value)]="tab" [lazy]="lazy()" [cache]="cache()" ariaLabel="Views">
      <star-tab value="a" label="A"><ng-template starTabContent>Content A</ng-template></star-tab>
      <star-tab value="b" label="B"><ng-template starTabContent>Content B</ng-template></star-tab>
      <star-tab value="c" label="C"><ng-template starTabContent>Content C</ng-template></star-tab>
    </star-tabs>
  `,
})
class LazyHost {
  readonly tab = signal('a');
  readonly lazy = signal(true);
  readonly cache = signal(true);
}

describe('StarTabs lazy and cache', () => {
  const texts = (el: HTMLElement) =>
    [...el.querySelectorAll('[role=tabpanel]')].map((panel) => panel.textContent?.trim());

  it('renders a panel on its first activation and keeps it by default', async () => {
    const fixture = TestBed.createComponent(LazyHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(texts(el)).toEqual(['Content A', '', '']);
    fixture.componentInstance.tab.set('b');
    await fixture.whenStable();
    expect(texts(el)).toEqual(['Content A', 'Content B', '']);
  });

  it('destroys the content of a panel that is not active without cache', async () => {
    const fixture = TestBed.createComponent(LazyHost);
    fixture.componentInstance.cache.set(false);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.tab.set('b');
    await fixture.whenStable();
    expect(texts(el)).toEqual(['', 'Content B', '']);
  });

  it('renders every panel at once when lazy is off', async () => {
    const fixture = TestBed.createComponent(LazyHost);
    fixture.componentInstance.lazy.set(false);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(texts(el)).toEqual(['Content A', 'Content B', 'Content C']);
    const panels = [...el.querySelectorAll<HTMLElement>('[role=tabpanel]')];
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true, true]);
  });
});

@Component({
  imports: [StarTabs, StarTab],
  template: `
    <star-tabs
      [(value)]="tab"
      [orientation]="orientation()"
      [alignment]="alignment()"
      [attr.dir]="dir()"
      ariaLabel="Settings"
    >
      <star-tab value="a" label="A">A</star-tab>
      <star-tab value="b" label="B">B</star-tab>
      <star-tab value="c" label="C">C</star-tab>
    </star-tabs>
  `,
})
class OrientationHost {
  readonly tab = signal<string | null>(null);
  readonly orientation = signal<'horizontal' | 'vertical'>('vertical');
  readonly alignment = signal<'start' | 'center' | 'end' | 'stretch'>('start');
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('StarTabs orientation and alignment', () => {
  it('uses Up and Down in a vertical tab list', async () => {
    const fixture = TestBed.createComponent(OrientationHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const list = el.querySelector('[role=tablist]')!;
    expect(list.getAttribute('aria-orientation')).toBe('vertical');
    expect(el.querySelector('star-tabs')!.classList).toContain('star-tabs--vertical');
    const tabs = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    key(tabs[0], { key: 'ArrowDown' });
    await fixture.whenStable();
    expect(fixture.componentInstance.tab()).toBe('b');
    expect(document.activeElement).toBe(tabs[1]);
    key(tabs[1], { key: 'ArrowUp' });
    await fixture.whenStable();
    expect(fixture.componentInstance.tab()).toBe('a');
    // Left and Right do nothing in a vertical list.
    key(tabs[0], { key: 'ArrowRight' });
    await fixture.whenStable();
    expect(fixture.componentInstance.tab()).toBe('a');
  });

  it('mirrors Left and Right in a horizontal right-to-left list, and ignores Up and Down', async () => {
    const fixture = TestBed.createComponent(OrientationHost);
    fixture.componentInstance.orientation.set('horizontal');
    fixture.componentInstance.dir.set('rtl');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=tablist]')!.getAttribute('aria-orientation')).toBe('horizontal');
    const tabs = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    key(tabs[0], { key: 'ArrowLeft' });
    await fixture.whenStable();
    expect(fixture.componentInstance.tab()).toBe('b');
    key(tabs[1], { key: 'ArrowDown' });
    await fixture.whenStable();
    expect(fixture.componentInstance.tab()).toBe('b');
  });

  it('sets the alignment class', async () => {
    const fixture = TestBed.createComponent(OrientationHost);
    fixture.componentInstance.alignment.set('stretch');
    await fixture.whenStable();
    const host = (fixture.nativeElement as HTMLElement).querySelector('star-tabs')!;
    expect(host.classList).toContain('star-tabs--align-stretch');
    fixture.componentInstance.alignment.set('center');
    await fixture.whenStable();
    expect(host.classList).toContain('star-tabs--align-center');
    expect(host.classList).not.toContain('star-tabs--align-stretch');
  });
});

@Component({
  imports: [StarTabs, StarTab],
  template: `
    <star-tabs
      reorderable
      [(value)]="tab"
      [attr.dir]="dir()"
      ariaLabel="Boards"
      (tabReorder)="onReorder($event)"
    >
      @for (name of names(); track name) {
        <star-tab [value]="name" [label]="name">{{ name }}</star-tab>
      }
    </star-tabs>
  `,
})
class ReorderHost {
  readonly tab = signal<string | null>(null);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly names = signal(['One', 'Two', 'Three']);
  readonly events: StarTabReorderEvent[] = [];
  onReorder(event: StarTabReorderEvent): void {
    this.events.push(event);
    this.names.update((names) => {
      const next = [...names];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });
  }
}

describe('StarTabs reorderable', () => {
  const labels = (el: HTMLElement) =>
    [...el.querySelectorAll('[role=tab]')].map((tab) => tab.textContent?.trim());

  it('moves the focused tab with Control+Shift+Arrow keys and announces the position', async () => {
    const fixture = TestBed.createComponent(ReorderHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    let tabs = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    expect(tabs[0].getAttribute('aria-keyshortcuts')).toBe(
      'Control+Shift+ArrowLeft Control+Shift+ArrowRight',
    );
    expect(el.querySelector('[role=tablist]')!.classList).toContain('cdk-drop-list');
    tabs[0].focus();
    key(tabs[0], { key: 'ArrowRight', ctrlKey: true, shiftKey: true });
    await fixture.whenStable();
    const host = fixture.componentInstance;
    expect(host.events).toEqual([{ previousIndex: 0, currentIndex: 1 }]);
    expect(labels(el)).toEqual(['Two', 'One', 'Three']);
    expect(host.tab()).toBeNull(); // moving does not select
    tabs = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    expect(document.activeElement).toBe(tabs[1]);
    expect(el.querySelector('.star-tabs__live')?.textContent?.trim()).toBe('One, position 2 of 3');

    // No move past the start.
    key(tabs[0], { key: 'ArrowLeft', ctrlKey: true, shiftKey: true });
    await fixture.whenStable();
    expect(host.events.length).toBe(1);
  });

  it('mirrors the move keys in right-to-left', async () => {
    const fixture = TestBed.createComponent(ReorderHost);
    fixture.componentInstance.dir.set('rtl');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const tabs = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    key(tabs[0], { key: 'ArrowLeft', ctrlKey: true, shiftKey: true });
    await fixture.whenStable();
    expect(labels(el)).toEqual(['Two', 'One', 'Three']);
  });
});

@Component({
  imports: [StarTabs, StarTab, StarTabHeader],
  template: `
    <star-tabs [(value)]="tab" ariaLabel="Queues">
      <ng-template starTabHeader let-tab let-active="active" let-index="index">
        <span class="custom">{{ index + 1 }}. {{ tab.label() }}{{ active ? ' (open)' : '' }}</span>
      </ng-template>
      <star-tab value="a" label="Inbox">A</star-tab>
      <star-tab value="b" label="Sent">
        <ng-template starTabHeader let-tab>Own {{ tab.label() }}</ng-template>
        B
      </star-tab>
    </star-tabs>
  `,
})
class HeaderHost {
  readonly tab = signal<string | null>(null);
}

describe('StarTabs header slot', () => {
  it('renders the header template in the tab, a tab template first', async () => {
    const fixture = TestBed.createComponent(HeaderHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const tabs = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['1. Inbox (open)', 'Own Sent']);
    expect(tabs[0].querySelector('.custom')).not.toBeNull();
    // The panel does not show the header template.
    expect(el.querySelectorAll('[role=tabpanel]')[1].textContent?.trim()).toBe('B');
    fixture.componentInstance.tab.set('b');
    await fixture.whenStable();
    expect(tabs[0].textContent?.trim()).toBe('1. Inbox');
  });
});
