import { Component, signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StarFooterTemplate, StarHeaderTemplate } from '@star-ng/ui/core';
import { StarAutoComplete, StarMultiAutoComplete } from './autocomplete';

// Keyboard model of the panel header and footer, as in `star-select`: Tab moves from the text
// field into the buttons and links of the panel, Tab past the last one leaves the control,
// Shift+Tab from the first one returns to the text field, and Escape closes the panel. jsdom does
// not move focus on Tab: a key that the control does not cancel leaves focus to the browser.

const CITIES = ['Berlin', 'Munich', 'Pune', 'Lyon'];

abstract class PanelHost {
  readonly cities = signal<readonly string[]>(CITIES);
  readonly touched = signal(0);
  reverse(): void {
    this.cities.update((list) => [...list].reverse());
  }
}

@Component({
  imports: [StarAutoComplete, StarHeaderTemplate, StarFooterTemplate],
  template: `
    <button type="button" class="before">Before</button>
    <star-autocomplete
      [options]="cities()"
      ariaLabel="City"
      autoHighlight
      [minQueryLength]="0"
      (touch)="touched.set(touched() + 1)"
    >
      <ng-template starHeader>
        <button type="button" class="head-a">A</button>
        <button type="button" class="head-b" (click)="reverse()">Reverse</button>
      </ng-template>
      <ng-template starFooter><a class="foot" href="#more">More</a></ng-template>
    </star-autocomplete>
    <button type="button" class="after">After</button>
  `,
})
class AutoCompleteHost extends PanelHost {}

@Component({
  imports: [StarMultiAutoComplete, StarHeaderTemplate, StarFooterTemplate],
  template: `
    <button type="button" class="before">Before</button>
    <star-multi-autocomplete
      [options]="cities()"
      ariaLabel="City"
      autoHighlight
      [minQueryLength]="0"
      (touch)="touched.set(touched() + 1)"
    >
      <ng-template starHeader>
        <button type="button" class="head-a">A</button>
        <button type="button" class="head-b" (click)="reverse()">Reverse</button>
      </ng-template>
      <ng-template starFooter><a class="foot" href="#more">More</a></ng-template>
    </star-multi-autocomplete>
    <button type="button" class="after">After</button>
  `,
})
class MultiAutoCompleteHost extends PanelHost {}

@Component({
  imports: [StarAutoComplete, StarHeaderTemplate],
  template: `
    <star-autocomplete [options]="cities()" ariaLabel="City" autoHighlight [minQueryLength]="0">
      <ng-template starHeader><b>Cities</b></ng-template>
    </star-autocomplete>
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

async function open<H extends PanelHost>(host: Type<H>) {
  const fixture: ComponentFixture<H> = TestBed.createComponent(host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector<HTMLInputElement>('[role=combobox]')!;
  input.focus();
  key(input, 'ArrowDown');
  await fixture.whenStable();
  return { fixture, el, input, host: fixture.componentInstance };
}

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

describe.each([
  ['star-autocomplete', AutoCompleteHost],
  ['star-multi-autocomplete', MultiAutoCompleteHost],
] as const)('%s panel header and footer keyboard', (_name, Host) => {
  it('moves focus from the text field into the header with Tab', async () => {
    const { fixture, input } = await open<PanelHost>(Host);
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();
    const tab = key(input, 'Tab');
    await fixture.whenStable();
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(inPanel('.head-a'));
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('moves with Tab from the header to the footer, and back with Shift+Tab', async () => {
    const { input } = await open<PanelHost>(Host);
    key(input, 'Tab');
    expect(key(inPanel('.head-a'), 'Tab').defaultPrevented).toBe(true);
    expect(key(inPanel('.head-b'), 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(inPanel('.foot'));
    key(inPanel('.foot'), 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(inPanel('.head-b'));
  });

  it('closes the panel with Tab past the last element and leaves focus to the browser', async () => {
    const { fixture, el, input, host } = await open<PanelHost>(Host);
    key(input, 'Tab');
    inPanel<HTMLElement>('.foot').focus();
    const tab = key(inPanel('.foot'), 'Tab');
    expect(tab.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(host.touched()).toBe(0);
    el.querySelector<HTMLElement>('.after')!.focus();
    expect(host.touched()).toBe(1);
  });

  it('returns focus to the text field with Shift+Tab from the first element', async () => {
    const { fixture, input } = await open<PanelHost>(Host);
    key(input, 'Tab');
    await fixture.whenStable();
    expect(key(inPanel('.head-a'), 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    await fixture.whenStable();
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();
  });

  it('closes the panel with Escape in the panel and focuses the text field', async () => {
    const { fixture, input } = await open<PanelHost>(Host);
    key(input, 'Tab');
    expect(key(inPanel('.foot'), 'Escape').defaultPrevented).toBe(true);
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('closes the panel and emits touch when focus leaves the panel and the control', async () => {
    const { fixture, el, input, host } = await open<PanelHost>(Host);
    key(input, 'Tab');
    el.querySelector<HTMLElement>('.before')!.focus();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(host.touched()).toBe(1);
  });

  it('does not cancel a mouse press on a header button, but does on an option', async () => {
    await open<PanelHost>(Host);
    expect(mousedown(inPanel('.head-b')).defaultPrevented).toBe(false);
    expect(mousedown(inPanel('.foot')).defaultPrevented).toBe(false);
    expect(mousedown(inPanel('[role=option]')).defaultPrevented).toBe(true);
  });

  it('keeps a valid active option when a header button changes the options', async () => {
    const { fixture, input } = await open<PanelHost>(Host);
    key(input, 'Tab');
    inPanel<HTMLButtonElement>('.head-b').click();
    await fixture.whenStable();
    key(inPanel('.head-a'), 'Tab', { shiftKey: true });
    await fixture.whenStable();
    // New results highlight the first one (autoHighlight), and the id names a rendered option.
    const id = input.getAttribute('aria-activedescendant')!;
    expect(document.getElementById(id)?.textContent?.trim()).toBe('Lyon');
  });
});

describe('star-autocomplete panel without focusable content', () => {
  it('closes the panel with Tab and leaves focus to the browser, as before', async () => {
    const { fixture, input } = await open(PlainHost);
    expect(panel()).not.toBeNull();
    const tab = key(input, 'Tab');
    await fixture.whenStable();
    expect(tab.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(panel()).toBeNull();
  });
});
