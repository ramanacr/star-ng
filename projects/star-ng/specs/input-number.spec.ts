import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarInputNumber } from '@star-ng/ui/input-number';

/** Intl uses no-break spaces in currency output. */
const spaces = (text: string) => text.replace(/\s/gu, ' ');

function key(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

@Component({
  imports: [StarInputNumber],
  template: `
    <star-input-number
      [(value)]="quantity"
      [min]="0"
      [max]="100"
      [step]="10"
      locale="en-US"
      showButtons
    />
    <star-input-number [(value)]="price" mode="currency" currency="EUR" locale="de-DE" />
    <star-input-number [value]="250" suffix=" kg" locale="en-US" />
    <star-input-number [value]="2" mode="unit" unit="gram" locale="en-US" />
    <star-input-number [value]="2" mode="unit" unit="kilogram" locale="en-US" />
  `,
})
class NumberHost {
  readonly quantity = signal<number | null>(95);
  readonly price = signal<number | null>(1234.5);
}

describe('StarInputNumber', () => {
  it('formats on blur, parses locale input, clamps and steps', async () => {
    const fixture = TestBed.createComponent(NumberHost);
    await fixture.whenStable();
    const [quantity, price] = (
      fixture.nativeElement as HTMLElement
    ).querySelectorAll<HTMLInputElement>('input');
    expect(spaces(price.value)).toBe('1.234,50 €');
    expect(quantity.getAttribute('role')).toBe('spinbutton');

    key(quantity, 'ArrowUp');
    await fixture.whenStable();
    expect(fixture.componentInstance.quantity()).toBe(100);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button')[1].disabled).toBe(
      true,
    );

    price.dispatchEvent(new Event('focus'));
    await fixture.whenStable();
    expect(price.value).toBe('1234,5');
    price.value = '99,9';
    price.dispatchEvent(new Event('input'));
    price.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(fixture.componentInstance.price()).toBe(99.9);
    expect(spaces(price.value)).toBe('99,90 €');

    quantity.dispatchEvent(new Event('focus'));
    quantity.value = '250';
    quantity.dispatchEvent(new Event('input'));
    quantity.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(fixture.componentInstance.quantity()).toBe(100);
  });
});
