import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarSelectButton, StarToggleButton } from '@star-ng/ui/select-button';

function key(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

@Component({
  imports: [StarSelectButton, StarToggleButton],
  template: `
    <star-select-button [options]="['a', 'b', 'c']" [(value)]="one" ariaLabel="One" />
    <star-select-button [options]="['x', 'y']" [(value)]="many" multiple ariaLabel="Many" />
    <star-toggle-button [(checked)]="on" onLabel="On" offLabel="Off" />
  `,
})
class ChoiceHost {
  readonly one = signal<string | readonly string[] | null>('a');
  readonly many = signal<string | readonly string[] | null>([]);
  readonly on = signal(false);
}

interface Filter {
  readonly label: string;
  readonly value: string;
  readonly count?: number | null;
}

@Component({
  imports: [StarSelectButton],
  template: `
    <star-select-button
      [look]="look()"
      [options]="filters"
      optionLabel="label"
      optionValue="value"
      optionCount="count"
      [(value)]="filter"
      ariaLabel="Filter"
    />
  `,
})
class PillsHost {
  readonly look = signal<'segmented' | 'pills'>('pills');
  readonly filters: readonly Filter[] = [
    { label: 'All', value: '' },
    { label: 'Open', value: 'open', count: 2 },
    { label: 'Closed', value: 'closed', count: 0 },
    { label: 'Draft', value: 'draft', count: null },
  ];
  readonly filter = signal<string | readonly string[] | null>('');
}

describe('Select button, toggle button', () => {
  it('select button: radio semantics, arrows move the choice; multiple uses aria-pressed', async () => {
    const fixture = TestBed.createComponent(ChoiceHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const [single, multi] = el.querySelectorAll('star-select-button');
    expect(single.getAttribute('role')).toBe('radiogroup');
    const radios = single.querySelectorAll<HTMLButtonElement>('button');
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect(radios[1].tabIndex).toBe(-1);
    key(radios[0], 'ArrowRight');
    await fixture.whenStable();
    expect(fixture.componentInstance.one()).toBe('b');

    const toggles = multi.querySelectorAll<HTMLButtonElement>('button');
    toggles[0].click();
    toggles[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.many()).toEqual(['x', 'y']);
    expect(toggles[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('toggle button flips aria-pressed and label', async () => {
    const fixture = TestBed.createComponent(ChoiceHost);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'star-toggle-button button',
    )!;
    button.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.on()).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent?.trim()).toBe('On');
  });

  it('default look keeps the segmented markup: no pill class, no count, no aria-label', async () => {
    const fixture = TestBed.createComponent(ChoiceHost);
    await fixture.whenStable();
    const single = (fixture.nativeElement as HTMLElement).querySelector('star-select-button')!;
    expect(single.className).toContain('star-segmented');
    expect(single.classList.contains('star-select-button--pills')).toBe(false);
    const button = single.querySelector('button')!;
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.querySelectorAll('span').length).toBe(1);
    expect(button.querySelector('[data-star-part="countText"]')).toBeNull();
  });

  it('pills: host class, counts after the label (0 shown, null hidden), count in the name', async () => {
    const fixture = TestBed.createComponent(PillsHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as HTMLElement).querySelector('star-select-button')!;
    expect(host.classList).toContain('star-select-button--pills');
    expect(host.classList).toContain('star-segmented');
    expect(host.getAttribute('role')).toBe('radiogroup');
    const [all, open, closed, draft] = host.querySelectorAll<HTMLButtonElement>('button');
    expect(all.getAttribute('role')).toBe('radio');
    expect(all.querySelector('.star-segmented__count')).toBeNull();
    expect(all.hasAttribute('aria-label')).toBe(false);

    const count = open.querySelector('[data-star-part="countText"]')!;
    expect(count.classList).toContain('star-segmented__count');
    expect(count.textContent?.trim()).toBe('2');
    expect(count.hasAttribute('aria-hidden')).toBe(false);
    expect(count.previousElementSibling?.textContent).toBe('Open');
    expect(open.getAttribute('aria-label')).toBe('Open, 2');

    expect(closed.querySelector('.star-segmented__count')?.textContent?.trim()).toBe('0');
    expect(closed.getAttribute('aria-label')).toBe('Closed, 0');
    expect(draft.querySelector('.star-segmented__count')).toBeNull();
    expect(draft.hasAttribute('aria-label')).toBe(false);
  });

  it('pills: roving tabindex, arrows move and select (wrapping), Enter / Space click selects', async () => {
    const fixture = TestBed.createComponent(PillsHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as HTMLElement).querySelector('star-select-button')!;
    const buttons = host.querySelectorAll<HTMLButtonElement>('button');
    expect([...buttons].map((b) => b.tabIndex)).toEqual([0, -1, -1, -1]);
    key(buttons[0], 'ArrowRight');
    await fixture.whenStable();
    expect(fixture.componentInstance.filter()).toBe('open');
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1].getAttribute('aria-checked')).toBe('true');
    expect(buttons[1].classList).toContain('star-segmented__item--on');
    expect(buttons[1].tabIndex).toBe(0);
    key(buttons[1], 'ArrowLeft');
    key(buttons[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(fixture.componentInstance.filter()).toBe('draft');
    // Enter and Space activate a native button (a click).
    buttons[2].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.filter()).toBe('closed');
  });

  it('optionCount also works with the segmented look', async () => {
    const fixture = TestBed.createComponent(PillsHost);
    fixture.componentInstance.look.set('segmented');
    await fixture.whenStable();
    const host = (fixture.nativeElement as HTMLElement).querySelector('star-select-button')!;
    expect(host.classList.contains('star-select-button--pills')).toBe(false);
    const open = host.querySelectorAll('button')[1];
    expect(open.querySelector('.star-segmented__count')?.textContent?.trim()).toBe('2');
    expect(open.getAttribute('aria-label')).toBe('Open, 2');
  });
});
