import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAutoComplete } from '@star-ng/ui/autocomplete';
import { StarMultiSelect, StarSelect } from '@star-ng/ui/select';

// The option list of select, multi-select and autocomplete draws only a window of a long list
// (`virtualScroll`). jsdom has no layout: the list height is 0, so the window uses the fallback
// height of 256 px (6 lines of 40 px, and 5 options for one page), and the tests move the window
// with a scroll event.

interface Batch {
  id: number;
  name: string;
  region: string;
}

const MANY: Batch[] = Array.from({ length: 2000 }, (_, i) => ({
  id: i,
  name: `Batch ${i}`,
  region: `Region ${Math.floor(i / 500) + 1}`,
}));
const LABELS = MANY.map((batch) => batch.name);

@Component({
  imports: [StarSelect, StarMultiSelect, StarAutoComplete],
  template: `
    <star-select
      [options]="many"
      optionLabel="name"
      optionValue="id"
      [(value)]="one"
      virtualScroll
      ariaLabel="One"
    />
    <star-select
      [options]="many"
      optionLabel="name"
      optionValue="id"
      optionGroup="region"
      [(value)]="grouped"
      virtualScroll
      ariaLabel="Grouped"
    />
    <star-select
      [options]="many"
      optionLabel="name"
      optionValue="id"
      [(value)]="filtered"
      virtualScroll
      filter
      ariaLabel="Filtered"
    />
    <star-multi-select
      [options]="many"
      optionLabel="name"
      optionValue="id"
      [(value)]="several"
      virtualScroll
      ariaLabel="Several"
    />
    <star-autocomplete
      [options]="labels"
      [(value)]="typed"
      virtualScroll
      dropdown
      ariaLabel="Typed"
      [delay]="0"
    />
  `,
})
class Host {
  readonly many = MANY;
  readonly labels = LABELS;
  readonly one = signal<number | null>(null);
  readonly grouped = signal<number | null>(null);
  readonly filtered = signal<number | null>(null);
  readonly several = signal<readonly number[]>([]);
  readonly typed = signal<string | null>(null);
}

function key(target: Element, name: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function typeKeys(target: Element, text: string): void {
  for (const char of text) key(target, char);
}

const options = () => [...document.querySelectorAll<HTMLElement>('[role=option]')];
const labels = () => options().map((option) => option.textContent?.trim());
const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** Makes `scrollTop` of a list writable in jsdom and returns the values that were written. */
function trackScroll(
  list: HTMLElement,
  start = 0,
): { writes: number[]; scrollTo(top: number): void } {
  let top = start;
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
    // What the user does with the wheel or the scroll bar.
    scrollTo(value: number) {
      top = value;
      list.dispatchEvent(new Event('scroll'));
    },
  };
}

/** Every `aria-activedescendant` and `aria-describedby` in the page names an element. */
function referencesExist(): boolean {
  return [...document.querySelectorAll('[aria-activedescendant], [aria-describedby]')].every(
    (element) =>
      ['aria-activedescendant', 'aria-describedby']
        .map((name) => element.getAttribute(name))
        .filter((id): id is string => !!id)
        .every((id) => !!document.getElementById(id)),
  );
}

describe('option list with virtualScroll', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = (label: string) => el.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
    const list = () => document.querySelector<HTMLElement>('[role=listbox]')!;
    return { fixture, host: fixture.componentInstance, trigger, list };
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('names an active option in aria-activedescendant only while it is in the DOM', async () => {
    const { fixture, trigger, list } = await setup();
    const one = trigger('One');
    key(one, 'ArrowDown');
    await fixture.whenStable();
    key(one, 'End');
    await fixture.whenStable();
    expect(one.getAttribute('aria-activedescendant')).toMatch(/-1999$/);
    expect(referencesExist()).toBe(true);

    // The user scrolls to the top with the wheel: the active option leaves the DOM.
    const scroll = trackScroll(list(), 2000 * 40);
    scroll.scrollTo(0);
    await fixture.whenStable();
    expect(labels()).not.toContain('Batch 1999');
    expect(one.hasAttribute('aria-activedescendant')).toBe(false);
    expect(referencesExist()).toBe(true);

    // The next key brings the active option back into view and names it again.
    key(one, 'ArrowUp');
    await fixture.whenStable();
    await wait();
    await fixture.whenStable();
    expect(labels()).toContain('Batch 1998');
    expect(one.getAttribute('aria-activedescendant')).toMatch(/-1998$/);
    expect(referencesExist()).toBe(true);
  });

  it('describes an option by its group heading only while the heading is in the DOM', async () => {
    const { fixture, trigger } = await setup();
    const grouped = trigger('Grouped');
    key(grouped, 'ArrowDown');
    await fixture.whenStable();
    const first = options()[0];
    const heading = document.querySelector('.star-listbox__group')!;
    expect(first.getAttribute('aria-describedby')).toBe(heading.id);

    key(grouped, 'End');
    await fixture.whenStable();
    expect(options().at(-1)?.textContent?.trim()).toBe('Batch 1999');
    // The heading of the last group is 500 rows away.
    expect(options().at(-1)?.hasAttribute('aria-describedby')).toBe(false);
    expect(referencesExist()).toBe(true);
  });

  it('moves the active option by a page with Page down and Page up, over all options', async () => {
    const { fixture, trigger } = await setup();
    const one = trigger('One');
    const closed = key(one, 'PageDown');
    expect(closed.defaultPrevented).toBe(false);

    key(one, 'ArrowDown');
    await fixture.whenStable();
    const down = key(one, 'PageDown');
    await fixture.whenStable();
    expect(down.defaultPrevented).toBe(true);
    const active = () =>
      document.querySelector('.star-listbox__option--active')?.textContent?.trim();
    // 256 px / 40 px = 6 lines in view, minus one line of overlap.
    expect(active()).toBe('Batch 5');
    key(one, 'PageDown');
    key(one, 'PageDown');
    await fixture.whenStable();
    expect(active()).toBe('Batch 15');
    key(one, 'PageUp');
    await fixture.whenStable();
    expect(active()).toBe('Batch 10');
    key(one, 'End');
    key(one, 'PageDown');
    await fixture.whenStable();
    expect(active()).toBe('Batch 1999');
    key(one, 'PageUp');
    await fixture.whenStable();
    expect(active()).toBe('Batch 1994');
    expect(referencesExist()).toBe(true);
  });

  it('shows a new filter result from the top of the list', async () => {
    const { fixture, trigger, list } = await setup();
    const filtered = trigger('Filtered');
    key(filtered, 'ArrowDown');
    await fixture.whenStable();
    const scroll = trackScroll(list(), 0);
    scroll.scrollTo(900 * 40);
    await fixture.whenStable();
    expect(labels()).toContain('Batch 900');

    const search = document.querySelector<HTMLInputElement>('.star-panel__filter input')!;
    search.value = 'Batch 1';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    // The element is scrolled to its top too, not only the window.
    expect(scroll.writes.at(-1)).toBe(0);
    expect(list().scrollTop).toBe(0);
    expect(labels()[0]).toBe('Batch 1');
    expect(labels()[1]).toBe('Batch 10');
  });

  it('shows the suggestions of autocomplete from the top when the typed text changes', async () => {
    const { fixture, trigger, list } = await setup();
    const typed = trigger('Typed') as HTMLInputElement;
    const button = typed.closest('.star-ac__control')!.querySelector<HTMLButtonElement>('button')!;
    button.click();
    await fixture.whenStable();
    const scroll = trackScroll(list(), 0);
    scroll.scrollTo(1500 * 40);
    await fixture.whenStable();
    expect(labels()).toContain('Batch 1500');

    typed.value = 'Batch 1';
    typed.dispatchEvent(new Event('input'));
    await wait();
    await fixture.whenStable();
    expect(scroll.writes.at(-1)).toBe(0);
    expect(labels()[0]).toBe('Batch 1');
  });

  it('keeps Space in the typed text while the user types ahead', async () => {
    const { fixture, host, trigger } = await setup();
    const one = trigger('One');
    typeKeys(one, 'Batch 1500');
    await fixture.whenStable();
    // A closed select chooses while the user types. Space did not open the panel.
    expect(host.one()).toBe(1500);
    expect(one.getAttribute('aria-expanded')).toBe('false');

    // Without typing, Space opens the panel.
    await wait(550);
    key(one, ' ');
    await fixture.whenStable();
    expect(one.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not toggle an option of a multi-select while the user types ahead', async () => {
    const { fixture, host, trigger } = await setup();
    const several = trigger('Several');
    key(several, 'ArrowDown');
    await fixture.whenStable();
    typeKeys(several, 'Batch 15');
    await fixture.whenStable();
    expect(host.several()).toEqual([]);
    expect(document.querySelector('.star-listbox__option--active')?.textContent?.trim()).toBe(
      'Batch 15',
    );
    await wait(550);
    key(several, ' ');
    await fixture.whenStable();
    expect(host.several()).toEqual([15]);
  });

  it('draws enough lines for a list that is taller than the fallback height', async () => {
    // A list of 640 px has 16 lines in view. The window must not stop at 7 lines + buffer.
    const height = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (
      this: Element,
    ) {
      return this.getAttribute('role') === 'listbox' ? 640 : 0;
    });
    try {
      const { fixture, trigger } = await setup();
      key(trigger('One'), 'ArrowDown');
      await fixture.whenStable();
      expect(options().length).toBeGreaterThanOrEqual(16);
      expect(options().length).toBeLessThan(40);
    } finally {
      height.mockRestore();
    }
  });
});

@Component({
  imports: [StarMultiSelect],
  template: `
    <star-multi-select
      [options]="many"
      optionLabel="name"
      optionValue="id"
      [(value)]="chosen"
      virtualScroll
      ariaLabel="All"
    />
  `,
})
class SelectAllHost {
  readonly many = Array.from({ length: 10_000 }, (_, i) => ({ id: i, name: `Batch ${i}` }));
  readonly chosen = signal<readonly number[]>([]);
}

describe('multi-select with 10,000 options', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('chooses and clears all options without a scan of the value for each option', async () => {
    const fixture = TestBed.createComponent(SelectAllHost);
    await fixture.whenStable();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[role=combobox]',
    )!;
    key(trigger, 'ArrowDown');
    await fixture.whenStable();
    const all = document.querySelector<HTMLElement>('.star-panel__toggle-all')!;

    // One scan of the value for each of 10,000 options took many seconds. A lookup in a Set does not.
    const start = performance.now();
    all.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.chosen().length).toBe(10_000);
    expect(all.getAttribute('aria-checked')).toBe('true');
    all.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.chosen()).toEqual([]);
    expect(performance.now() - start).toBeLessThan(2500);
  });
});
