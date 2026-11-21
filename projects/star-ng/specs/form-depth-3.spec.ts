import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, validate } from '@angular/forms/signals';
import { StarInputNumber } from '@star-ng/ui/input-number';
import { StarColorPicker, StarKnob } from '@star-ng/ui/knob';
import { StarPassword } from '@star-ng/ui/password';
import { StarRating } from '@star-ng/ui/rating';
import { StarRangeSlider, StarSlider } from '@star-ng/ui/slider';

@Component({
  imports: [
    StarPassword,
    StarColorPicker,
    StarInputNumber,
    StarKnob,
    StarRating,
    StarSlider,
    StarRangeSlider,
  ],
  template: `
    <star-password class="pw-off" [toggleMask]="false" ariaLabel="No toggle" />
    <star-password class="pw-on" ariaLabel="With toggle" />

    <star-color-picker class="cp" inline [(value)]="color" ariaLabel="Color" />

    <star-input-number
      class="nb"
      [value]="1234.5"
      [format]="false"
      localeMatcher="lookup"
      locale="en-US"
      ariaLabel="Plain"
    />

    <star-knob class="kn" invalid touched name="level" [value]="30" ariaLabel="Knob" />
    <star-rating class="rt" invalid touched name="stars" [value]="2" ariaLabel="Rating" />
    <star-slider class="sl" invalid touched name="volume" [value]="5" ariaLabel="Slider" />
    <star-range-slider class="rs" invalid touched name="span" ariaLabel="Range" />
    <star-color-picker class="cv" invalid touched name="tint" value="#ff0000" ariaLabel="Tint" />
    <star-knob class="kn-ok" invalid name="untouched" ariaLabel="Untouched" />
  `,
})
class Host {
  readonly color = signal('#336699');
}

@Component({
  imports: [StarKnob, FormField],
  template: `<star-knob [formField]="f.level" ariaLabel="Level" />`,
})
class FormsHost {
  readonly model = signal({ level: 10 });
  readonly f = form(this.model, (path) => {
    validate(path.level, ({ value }) =>
      value() < 50 ? { kind: 'tooLow', message: 'Too low' } : null,
    );
  });
}

const q = <E extends Element = HTMLElement>(root: Element, selector: string) =>
  root.querySelector(selector) as E;

describe('form inputs, final round (N1)', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
  }

  it('password: toggleMask shows the show / hide button; it keeps the focus', async () => {
    const { fixture, root } = await setup();
    expect(q(root, '.pw-off [data-star-part="revealButton"]')).toBeNull();
    const button = q<HTMLButtonElement>(root, '.pw-on [data-star-part="revealButton"]');
    expect(button.getAttribute('aria-label')).toBe('Show password');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.focus();
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Hide password');
    expect(q<HTMLInputElement>(root, '.pw-on input').type).toBe('text');
    expect(document.activeElement).toBe(button);
  });

  it('color picker: inline shows the panel in place, with keys and ARIA', async () => {
    const { fixture, host, root } = await setup();
    const picker = q(root, '.cp');
    expect(q(picker, '[data-star-part="customButton"]')).toBeNull();
    const panel = q(picker, '[data-star-part="panel"]');
    expect(panel.getAttribute('role')).toBe('group');
    expect(panel.getAttribute('aria-label')).toBe('Custom color');
    const hue = q(panel, '[data-star-part="hueTrack"]');
    expect(hue.getAttribute('role')).toBe('slider');
    const before = host.color();
    hue.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(host.color()).not.toBe(before);
    expect(q(panel, '[data-star-part="barButton"]')).toBeNull();
  });

  it('input number: format false shows plain digits; localeMatcher goes to Intl', async () => {
    const spy = vi.spyOn(Intl, 'NumberFormat');
    const { root } = await setup();
    expect(q<HTMLInputElement>(root, '.nb input').value).toBe('1234.5');
    expect(spy.mock.calls.some(([, options]) => options?.localeMatcher === 'lookup')).toBe(true);
    spy.mockRestore();
  });

  it('invalid and name on knob, rating, slider, range slider and color picker', async () => {
    const { root } = await setup();
    expect(q(root, '.kn svg').getAttribute('aria-invalid')).toBe('true');
    expect(q(root, '.kn').classList).toContain('star-knob--invalid');
    expect(q<HTMLInputElement>(root, '.kn input[type="hidden"]').name).toBe('level');
    expect(q<HTMLInputElement>(root, '.kn input[type="hidden"]').value).toBe('30');

    expect(q(root, '.rt').getAttribute('aria-invalid')).toBe('true');
    expect(q(root, '.rt').classList).toContain('star-rating--invalid');
    expect(q<HTMLInputElement>(root, '.rt input').name).toBe('stars');

    expect(q(root, '.sl input').getAttribute('aria-invalid')).toBe('true');
    expect(q(root, '.sl').classList).toContain('star-slider--invalid');
    expect(q<HTMLInputElement>(root, '.sl input').name).toBe('volume');

    const range = Array.from(root.querySelectorAll<HTMLInputElement>('.rs input'));
    expect(range.map((input) => input.getAttribute('aria-invalid'))).toEqual(['true', 'true']);
    expect(range.map((input) => input.name)).toEqual(['span', 'span']);

    expect(q(root, '.cv [role="radiogroup"]').getAttribute('aria-invalid')).toBe('true');
    expect(q(root, '.cv').classList).toContain('star-color--invalid');
    expect(q<HTMLInputElement>(root, '.cv input[type="hidden"]').name).toBe('tint');
    expect(q<HTMLInputElement>(root, '.cv input[type="hidden"]').value).toBe('#ff0000');

    // Not touched yet: no error shows (as in the other form controls).
    expect(q(root, '.kn-ok svg').getAttribute('aria-invalid')).toBeNull();
  });

  it('Signal Forms: invalid and touched reach the knob', async () => {
    const fixture = TestBed.createComponent(FormsHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(q(root, 'svg').getAttribute('aria-invalid')).toBeNull();
    fixture.componentInstance.f.level().markAsTouched();
    await fixture.whenStable();
    expect(q(root, 'svg').getAttribute('aria-invalid')).toBe('true');
  });
});
