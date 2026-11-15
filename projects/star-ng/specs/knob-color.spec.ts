import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColorPicker, StarKnob } from '@star-ng/ui/knob';

function key(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

@Component({
  imports: [StarKnob, StarColorPicker],
  template: `
    <star-knob [(value)]="knob" [step]="5" ariaLabel="Knob" />
    <star-color-picker [(value)]="color" />
  `,
})
class DialHost {
  readonly knob = signal(50);
  readonly color = signal('#4f46e5');
}

describe('Knob, color picker', () => {
  it('knob is a slider with keyboard steps and limits', async () => {
    const fixture = TestBed.createComponent(DialHost);
    await fixture.whenStable();
    const knob = (fixture.nativeElement as HTMLElement).querySelector('[role=slider]')!;
    key(knob, 'ArrowUp');
    expect(fixture.componentInstance.knob()).toBe(55);
    key(knob, 'End');
    expect(fixture.componentInstance.knob()).toBe(100);
  });

  it('color picker takes swatches and validates hex input', async () => {
    const fixture = TestBed.createComponent(DialHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelectorAll<HTMLButtonElement>('.star-color__swatch')[1].click();
    expect(fixture.componentInstance.color()).toBe('#0369a1');
    const hex = el.querySelector<HTMLInputElement>('.star-color__hex')!;
    hex.value = 'zzz';
    hex.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.color()).toBe('#0369a1');
    hex.value = '16A34A';
    hex.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.color()).toBe('#16a34a');
  });
});
