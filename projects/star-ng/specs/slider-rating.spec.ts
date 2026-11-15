import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarRating } from '@star-ng/ui/rating';
import { StarRangeSlider, StarSlider } from '@star-ng/ui/slider';

@Component({
  imports: [StarSlider, StarRangeSlider, StarRating],
  template: `
    <star-slider [(value)]="level" [min]="0" [max]="10" ariaLabel="Level" />
    <star-range-slider [(value)]="range" [bounds]="[0, 100]" ariaLabel="Range" />
    <star-rating [(value)]="stars" />
  `,
})
class InputsHost {
  readonly level = signal(2);
  readonly range = signal<readonly [number, number]>([20, 40]);
  readonly stars = signal<number | null>(null);
}

describe('Slider, rating', () => {
  it('slider and range slider write values; handles cannot cross', async () => {
    const fixture = TestBed.createComponent(InputsHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const level = el.querySelector<HTMLInputElement>('star-slider input')!;
    level.value = '7';
    level.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.level()).toBe(7);
    const [low] = el.querySelectorAll<HTMLInputElement>('star-range-slider input');
    low.value = '90';
    low.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.range()).toEqual([40, 40]);
  });

  it('rating is a radio group of stars', async () => {
    const fixture = TestBed.createComponent(InputsHost);
    await fixture.whenStable();
    const radios = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      'star-rating input',
    );
    expect(radios.length).toBe(5);
    expect(radios[2].getAttribute('aria-label')).toBe('3 of 5');
    radios[2].click();
    expect(fixture.componentInstance.stars()).toBe(3);
  });
});
