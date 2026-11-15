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
});
