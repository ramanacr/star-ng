import { Component, signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StarFooterTemplate, StarHeaderTemplate, StarLoadingTemplate } from '@star-ng/ui/core';
import { StarMultiSelect } from './multi-select';
import { StarSelect } from './select';

// Keyboard model of the panel header and footer (PrimeNG model): Tab moves from the combobox into
// the buttons and links of the panel, Tab past the last one leaves the control, Shift+Tab from
// the first one returns to the combobox, and Escape closes the panel. jsdom does not move focus
// on Tab: a key that the control does not cancel leaves focus to the browser.

interface Country {
  code: string;
  name: string;
}

const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
];

abstract class PanelHost {
  readonly countries = signal<readonly Country[]>(COUNTRIES);
  readonly touched = signal(0);
  reverse(): void {
    this.countries.update((list) => [...list].reverse());
  }
}

@Component({
  imports: [StarSelect, StarHeaderTemplate, StarFooterTemplate],
  template: `
    <button type="button" class="before">Before</button>
    <star-select
      [options]="countries()"
      optionLabel="name"
      ariaLabel="Country"
      (touch)="touched.set(touched() + 1)"
    >
      <ng-template starHeader>
        <button type="button" class="head-a">A</button>
        <button type="button" class="head-b" (click)="reverse()">Reverse</button>
      </ng-template>
      <ng-template starFooter><a class="foot" href="#more">More</a></ng-template>
    </star-select>
    <button type="button" class="after">After</button>
  `,
})
class SelectHost extends PanelHost {}

@Component({
  imports: [StarMultiSelect, StarHeaderTemplate, StarFooterTemplate],
  template: `
    <button type="button" class="before">Before</button>
    <star-multi-select
      [options]="countries()"
      optionLabel="name"
      ariaLabel="Country"
      (touch)="touched.set(touched() + 1)"
    >
      <ng-template starHeader>
        <button type="button" class="head-a">A</button>
        <button type="button" class="head-b" (click)="reverse()">Reverse</button>
      </ng-template>
      <ng-template starFooter><a class="foot" href="#more">More</a></ng-template>
    </star-multi-select>
    <button type="button" class="after">After</button>
  `,
})
class MultiSelectHost extends PanelHost {}

@Component({
  imports: [StarSelect, StarHeaderTemplate, StarFooterTemplate],
  template: `
    <button type="button" class="before">Before</button>
    <star-select
      [options]="countries()"
      optionLabel="name"
      ariaLabel="Country"
      filter
      (touch)="touched.set(touched() + 1)"
    >
      <ng-template starHeader>
        <button type="button" class="head-a">A</button>
        <button type="button" class="head-b" (click)="reverse()">Reverse</button>
      </ng-template>
      <ng-template starFooter><a class="foot" href="#more">More</a></ng-template>
    </star-select>
    <button type="button" class="after">After</button>
  `,
})
class FilterSelectHost extends PanelHost {}

@Component({
  imports: [StarSelect, StarMultiSelect, StarHeaderTemplate, StarFooterTemplate],
  template: `
    <star-select class="one" [options]="countries()" optionLabel="name" ariaLabel="Country">
      <ng-template starHeader><b>Pick one</b></ng-template>
      <ng-template starFooter><span>4 countries</span></ng-template>
    </star-select>
    <star-multi-select
      class="many"
      [options]="countries()"
      optionLabel="name"
      ariaLabel="Countries"
      filter
    >
      <ng-template starHeader><b>Pick some</b></ng-template>
    </star-multi-select>
  `,
})
class PlainHost extends PanelHost {}

function key(target: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function mousedown(target: Element): MouseEvent {
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

const panel = () => document.querySelector<HTMLElement>('.star-panel');
const inPanel = <T extends HTMLElement>(selector: string) => panel()!.querySelector<T>(selector)!;
const activeLabel = () =>
  document.querySelector('.star-listbox__option--active')?.textContent?.trim();

async function open<H extends PanelHost>(host: Type<H>) {
  const fixture: ComponentFixture<H> = TestBed.createComponent(host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const trigger = el.querySelector<HTMLElement>('[role=combobox]')!;
  trigger.focus();
  key(trigger, 'ArrowDown');
  await fixture.whenStable();
  return { fixture, el, trigger, host: fixture.componentInstance };
}

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

describe.each([
  ['star-select', SelectHost],
  ['star-multi-select', MultiSelectHost],
] as const)('%s panel header and footer keyboard', (_name, Host) => {
  it('moves focus from the combobox into the header with Tab', async () => {
    const { fixture, trigger } = await open<PanelHost>(Host);
    expect(trigger.getAttribute('aria-activedescendant')).toBeTruthy();
    const tab = key(trigger, 'Tab');
    await fixture.whenStable();
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(inPanel('.head-a'));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    // The combobox has no focus: it names no active option.
    expect(trigger.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('moves with Tab from the header to the footer, in DOM order', async () => {
    const { fixture, trigger } = await open<PanelHost>(Host);
    key(trigger, 'Tab');
    expect(key(inPanel('.head-a'), 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(inPanel('.head-b'));
    expect(key(inPanel('.head-b'), 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(inPanel('.foot'));
    // Shift+Tab goes back.
    expect(key(inPanel('.foot'), 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(inPanel('.head-b'));
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the panel with Tab past the last element and leaves focus to the browser', async () => {
    const { fixture, el, trigger, host } = await open<PanelHost>(Host);
    key(trigger, 'Tab');
    inPanel<HTMLElement>('.foot').focus();
    const tab = key(inPanel('.foot'), 'Tab');
    // Not cancelled: the browser moves focus from the trigger to the next element of the page.
    expect(tab.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(trigger);
    // The panel hides at once, so that the browser does not move focus into it.
    expect(panel()?.style.display).toBe('none');
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(host.touched()).toBe(0);
    // What the browser does next: focus leaves the trigger.
    el.querySelector<HTMLElement>('.after')!.focus();
    expect(host.touched()).toBe(1);
  });

  it('returns focus to the combobox with Shift+Tab from the first element', async () => {
    const { fixture, trigger } = await open<PanelHost>(Host);
    key(trigger, 'Tab');
    await fixture.whenStable();
    const back = key(inPanel('.head-a'), 'Tab', { shiftKey: true });
    await fixture.whenStable();
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-activedescendant')).toBeTruthy();
  });

  it('closes the panel with Escape in the panel and focuses the combobox', async () => {
    const { fixture, trigger, host } = await open<PanelHost>(Host);
    key(trigger, 'Tab');
    const escape = key(inPanel('.head-b'), 'Escape');
    await fixture.whenStable();
    expect(escape.defaultPrevented).toBe(true);
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(host.touched()).toBe(0);
  });

  it('closes the panel and emits touch when focus leaves the panel and the control', async () => {
    const { fixture, el, trigger, host } = await open<PanelHost>(Host);
    key(trigger, 'Tab');
    el.querySelector<HTMLElement>('.before')!.focus();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(host.touched()).toBe(1);
  });

  it('does not cancel a mouse press on a header button, but does on an option', async () => {
    const { trigger } = await open<PanelHost>(Host);
    expect(mousedown(inPanel('.head-a')).defaultPrevented).toBe(false);
    expect(mousedown(inPanel('.foot')).defaultPrevented).toBe(false);
    expect(mousedown(inPanel('[role=option]')).defaultPrevented).toBe(true);
    expect(mousedown(inPanel('[role=listbox]')).defaultPrevented).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps the active option when a header button changes the options', async () => {
    const { fixture, trigger } = await open<PanelHost>(Host);
    key(trigger, 'ArrowDown');
    key(trigger, 'ArrowDown');
    await fixture.whenStable();
    expect(activeLabel()).toBe('France');
    key(trigger, 'Tab');
    inPanel<HTMLButtonElement>('.head-b').click();
    await fixture.whenStable();
    expect(activeLabel()).toBe('France');
    key(inPanel('.head-a'), 'Tab', { shiftKey: true });
    await fixture.whenStable();
    const id = trigger.getAttribute('aria-activedescendant')!;
    expect(document.getElementById(id)?.textContent?.trim()).toBe('France');
  });
});

describe('star-select panel header and footer keyboard with a filter', () => {
  it('moves from the filter field into the header with Tab, and back with Shift+Tab', async () => {
    const { fixture } = await open(FilterSelectHost);
    const filter = inPanel<HTMLInputElement>('.star-panel__filter input');
    filter.focus();
    expect(key(filter, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(inPanel('.head-a'));
    key(inPanel('.head-a'), 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(filter);
    await fixture.whenStable();
    expect(filter.getAttribute('aria-activedescendant')).toBeTruthy();
  });

  it('does not cancel a mouse press on the filter field', async () => {
    await open(FilterSelectHost);
    expect(mousedown(inPanel('.star-panel__filter input')).defaultPrevented).toBe(false);
  });

  it('leaves the control backwards with Shift+Tab from the filter field', async () => {
    const { fixture, trigger } = await open(FilterSelectHost);
    const filter = inPanel<HTMLInputElement>('.star-panel__filter input');
    filter.focus();
    // The header is before the filter in the DOM: the browser must start from the trigger.
    const back = key(filter, 'Tab', { shiftKey: true });
    expect(back.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(trigger);
    await fixture.whenStable();
    expect(panel()).toBeNull();
  });
});

describe('panel header and footer without focusable content', () => {
  it('closes the panel with Tab and leaves focus to the browser, as before', async () => {
    const fixture = TestBed.createComponent(PlainHost);
    await fixture.whenStable();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.one [role=combobox]',
    )!;
    trigger.focus();
    key(trigger, 'ArrowDown');
    await fixture.whenStable();
    const tab = key(trigger, 'Tab');
    await fixture.whenStable();
    expect(tab.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(panel()).toBeNull();
  });

  it('closes the panel of a multi-select with Tab from the filter field', async () => {
    const fixture = TestBed.createComponent(PlainHost);
    await fixture.whenStable();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.many [role=combobox]',
    )!;
    key(trigger, 'ArrowDown');
    await fixture.whenStable();
    const filter = inPanel<HTMLInputElement>('.star-panel__filter input');
    filter.focus();
    const tab = key(filter, 'Tab');
    await fixture.whenStable();
    expect(tab.defaultPrevented).toBe(false);
    expect(panel()).toBeNull();
  });

  it('still keeps focus in the combobox on a press on "select all"', async () => {
    const fixture = TestBed.createComponent(PlainHost);
    await fixture.whenStable();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.many [role=combobox]',
    )!;
    key(trigger, 'ArrowDown');
    await fixture.whenStable();
    expect(mousedown(inPanel('.star-panel__toggle-all')).defaultPrevented).toBe(true);
  });
});

interface Batch {
  id: number;
  name: string;
}

@Component({
  imports: [StarSelect, StarLoadingTemplate],
  template: `
    <star-select
      [options]="many"
      optionLabel="name"
      optionValue="id"
      virtualScroll
      [loading]="loading()"
      ariaLabel="Batch"
    >
      <ng-template starLoading>Loading more</ng-template>
    </star-select>
  `,
})
class VirtualLoadingHost {
  readonly many: Batch[] = Array.from({ length: 2000 }, (_, i) => ({ id: i, name: `Batch ${i}` }));
  readonly loading = signal(true);
}

/** Makes `scrollTop` of a list writable in jsdom and returns the values that were written. */
function trackScroll(list: HTMLElement): { writes: number[]; scrollTo(top: number): void } {
  let top = 0;
  const writes: number[] = [];
  Object.defineProperty(list, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = value;
      writes.push(value);
    },
  });
  return {
    writes,
    scrollTo(value: number) {
      top = value;
      list.dispatchEvent(new Event('scroll'));
    },
  };
}

describe('virtualScroll with a loading row', () => {
  // jsdom has no layout: the loading row counts as one line of 40 px, and the list height is the
  // fallback of 256 px.
  async function setup() {
    const fixture = TestBed.createComponent(VirtualLoadingHost);
    await fixture.whenStable();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[role=combobox]',
    )!;
    key(trigger, 'ArrowDown');
    await fixture.whenStable();
    const list = document.querySelector<HTMLElement>('[role=listbox]')!;
    return { fixture, trigger, list, scroll: trackScroll(list) };
  }

  const labels = () =>
    [...document.querySelectorAll('[role=option]')].map((option) => option.textContent?.trim());

  it('counts the loading row above the options in the window', async () => {
    const { fixture, scroll } = await setup();
    // 40 px of loading row + 100 lines of 40 px: the first line in view is "Batch 100".
    scroll.scrollTo(40 + 100 * 40);
    await fixture.whenStable();
    // 6 lines of buffer above the first line in view.
    expect(labels()[0]).toBe('Batch 94');
    fixture.componentInstance.loading.set(false);
    await fixture.whenStable();
    expect(document.querySelector('.star-listbox__empty')).toBeNull();
    // Without the loading row, the same offset is line 101.
    scroll.scrollTo(40 + 100 * 40);
    await fixture.whenStable();
    expect(labels()[0]).toBe('Batch 95');
  });

  it('brings the last option fully into view below the loading row', async () => {
    const { fixture, trigger, scroll } = await setup();
    key(trigger, 'End');
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    // Bottom of the last line: 40 px loading row + 2000 lines of 40 px, minus 256 px in view.
    expect(scroll.writes.at(-1)).toBe(40 + 2000 * 40 - 256);
  });
});
