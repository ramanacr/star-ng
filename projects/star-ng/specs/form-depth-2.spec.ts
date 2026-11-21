import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarInputMask } from '@star-ng/ui/input-mask';
import { StarInputNumber } from '@star-ng/ui/input-number';
import { StarInputTags } from '@star-ng/ui/input-tags';
import { StarColorPicker, StarKnob, ɵstarColorFromHex, ɵstarColorToHex } from '@star-ng/ui/knob';
import { StarPassword } from '@star-ng/ui/password';
import { StarRating } from '@star-ng/ui/rating';
import {
  StarSelectButton,
  StarToggleButton,
  StarToggleButtonContentTemplate,
} from '@star-ng/ui/select-button';
import { StarRangeSlider, StarSlider } from '@star-ng/ui/slider';
import { StarToggleSwitch } from '@star-ng/ui/toggle-switch';

/** Every form control: `ariaLabelledBy` and `required`. */
@Component({
  imports: [
    StarPassword,
    StarInputMask,
    StarInputTags,
    StarInputNumber,
    StarCheckbox,
    StarToggleSwitch,
    StarToggleButton,
    StarRating,
    StarSlider,
    StarRangeSlider,
    StarKnob,
    StarColorPicker,
    StarSelectButton,
  ],
  template: `
    <span id="lbl">Shared label</span>
    <star-password class="c-password" ariaLabelledBy="lbl" required />
    <star-input-mask class="c-mask" mask="99" ariaLabelledBy="lbl" required />
    <star-input-tags class="c-tags" ariaLabelledBy="lbl" required />
    <star-input-number class="c-number" ariaLabelledBy="lbl" required />
    <star-checkbox class="c-checkbox" ariaLabelledBy="lbl" required />
    <star-toggle-switch class="c-switch" ariaLabelledBy="lbl" required [hasLabel]="false" />
    <star-toggle-button class="c-toggle" ariaLabelledBy="lbl" required />
    <star-rating class="c-rating" ariaLabelledBy="lbl" required />
    <star-slider class="c-slider" ariaLabelledBy="lbl" required />
    <star-range-slider class="c-range" ariaLabelledBy="lbl" required />
    <star-knob class="c-knob" ariaLabelledBy="lbl" required />
    <star-color-picker class="c-color" ariaLabelledBy="lbl" required />
    <star-select-button class="c-select" [options]="['A', 'B']" ariaLabelledBy="lbl" required />
  `,
})
class AriaHost {}

@Component({
  imports: [StarInputTags, StarToggleSwitch, FormField],
  template: `
    <star-input-tags class="f-tags" [formField]="f.tags" ariaLabel="Tags" />
    <star-toggle-switch class="f-switch" [formField]="f.on">On</star-toggle-switch>
  `,
})
class SignalFormsHost {
  readonly model = signal({ tags: [] as readonly string[], on: false });
  readonly f = form(this.model, (path) => {
    required(path.tags);
    required(path.on);
  });
}

@Component({
  imports: [
    StarToggleSwitch,
    StarToggleButton,
    StarToggleButtonContentTemplate,
    StarIconTemplate,
    StarColorPicker,
    StarKnob,
    StarInputNumber,
    StarInputMask,
    StarRating,
    StarRangeSlider,
  ],
  template: `
    <star-toggle-switch class="sw" [(checked)]="on" onLabel="Yes" offLabel="No">
      Mail
      <ng-template starIcon="on"><b class="sw-on">I</b></ng-template>
      <ng-template starIcon="off"><b class="sw-off">O</b></ng-template>
    </star-toggle-switch>

    <star-toggle-button class="tb" [(checked)]="on" iconPos="end" onIcon="x" offIcon="y">
      <ng-template starIcon="on"><b class="tb-on">+</b></ng-template>
      <ng-template starIcon="off"><b class="tb-off">-</b></ng-template>
    </star-toggle-button>
    <star-toggle-button class="tc" [(checked)]="on">
      <ng-template starToggleButtonContent let-checked
        ><b class="tc-content">{{ checked ? 'ON' : 'OFF' }}</b></ng-template
      >
    </star-toggle-button>

    <star-color-picker class="cp" [(value)]="color" [format]="format()" ariaLabel="Color" />

    <star-knob
      class="kn"
      [value]="40"
      [strokeWidth]="12"
      [showValue]="showValue()"
      ariaLabel="Knob"
    />

    <star-input-number
      class="nb"
      [(value)]="price"
      mode="currency"
      currency="EUR"
      currencyDisplay="code"
      locale="en-US"
      showClear
      ariaLabel="Price"
    />

    <star-input-mask
      class="mk"
      mask="99-99"
      [(value)]="code"
      showClear
      keepCharPositions
      variant="filled"
      ariaLabel="Code"
    />

    <star-rating
      class="rt"
      [(value)]="rating"
      allowHalf
      orientation="vertical"
      ariaLabel="Rating"
    />

    <star-range-slider
      class="rs"
      [(value)]="range"
      orientation="vertical"
      [minStepsBetweenHandles]="10"
      [disabledMinHandle]="lockLow()"
      ariaLabel="Range"
      (slideEnd)="ends.push($event)"
    />
  `,
})
class DepthHost {
  readonly on = signal(false);
  readonly color = signal('#ff0000');
  readonly format = signal<'hex' | 'rgb' | 'hsb'>('hex');
  readonly showValue = signal(true);
  readonly price = signal<number | null>(12.5);
  readonly code = signal('');
  readonly rating = signal<number | null>(2.5);
  readonly range = signal<readonly [number, number]>([20, 80]);
  readonly lockLow = signal(false);
  readonly ends: (readonly [number, number])[] = [];
}

const q = <E extends Element = HTMLElement>(root: Element, selector: string) =>
  root.querySelector(selector) as E;

describe('form controls: ariaLabelledBy and required', () => {
  it('every control points at the given label and marks itself required', async () => {
    const fixture = TestBed.createComponent(AriaHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const labelled = (selector: string) => q(root, selector).getAttribute('aria-labelledby');
    expect(labelled('.c-password input')).toBe('lbl');
    expect(labelled('.c-mask input')).toBe('lbl');
    expect(labelled('.c-tags input')).toBe('lbl');
    expect(labelled('.c-number input')).toBe('lbl');
    expect(labelled('.c-checkbox input')).toBe('lbl');
    expect(labelled('.c-switch input')).toBe('lbl');
    expect(labelled('.c-toggle button')).toBe('lbl');
    expect(labelled('.c-rating')).toBe('lbl');
    expect(labelled('.c-slider input')).toBe('lbl');
    expect(labelled('.c-range')).toBe('lbl');
    expect(q(root, '.c-range').getAttribute('role')).toBe('group');
    expect(labelled('.c-knob svg')).toBe('lbl');
    expect(labelled('.c-color [role="radiogroup"]')).toBe('lbl');
    expect(labelled('.c-select')).toBe('lbl');

    // Native `required` where the element takes it; `aria-required` where the role allows it.
    expect(q<HTMLInputElement>(root, '.c-password input').required).toBe(true);
    expect(q<HTMLInputElement>(root, '.c-mask input').required).toBe(true);
    expect(q(root, '.c-tags input').getAttribute('aria-required')).toBe('true');
    expect(q<HTMLInputElement>(root, '.c-number input').required).toBe(true);
    expect(q<HTMLInputElement>(root, '.c-checkbox input').required).toBe(true);
    expect(q<HTMLInputElement>(root, '.c-switch input').required).toBe(true);
    expect(q(root, '.c-rating').getAttribute('aria-required')).toBe('true');
    expect(q(root, '.c-color [role="radiogroup"]').getAttribute('aria-required')).toBe('true');
    expect(q(root, '.c-select').getAttribute('aria-required')).toBe('true');
    // Button and slider roles do not take aria-required: the `required` input only feeds forms.
    expect(q(root, '.c-toggle button').getAttribute('aria-required')).toBeNull();
    expect(q(root, '.c-slider input').getAttribute('aria-required')).toBeNull();
  });

  it('Signal Forms required() reaches the controls', async () => {
    const fixture = TestBed.createComponent(SignalFormsHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(q(root, '.f-tags input').getAttribute('aria-required')).toBe('true');
    expect(q<HTMLInputElement>(root, '.f-switch input').required).toBe(true);
  });
});

describe('form controls depth, part 2 (N1)', () => {
  async function setup() {
    const fixture = TestBed.createComponent(DepthHost);
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
  }

  it('toggle switch: on / off labels and icon slots in the handle', async () => {
    const { fixture, host, root } = await setup();
    const sw = q(root, '.sw');
    expect(q(sw, '[data-star-part="stateText"]').textContent?.trim()).toBe('No');
    expect(q(sw, '.sw-off')).not.toBeNull();
    expect(q(sw, '.sw-off').closest('[aria-hidden="true"]')).not.toBeNull();
    host.on.set(true);
    await fixture.whenStable();
    expect(q(sw, '[data-star-part="stateText"]').textContent?.trim()).toBe('Yes');
    expect(q(sw, '.sw-on')).not.toBeNull();
  });

  it('toggle button: icon slots, iconPos and the content slot', async () => {
    const { fixture, host, root } = await setup();
    const button = q(root, '.tb button');
    expect(q(button, '.tb-off')).not.toBeNull();
    // iconPos end: the icon comes after the label.
    expect(button.lastElementChild?.querySelector('.tb-off')).not.toBeNull();
    host.on.set(true);
    await fixture.whenStable();
    expect(q(button, '.tb-on')).not.toBeNull();
    expect(q(root, '.tc button').textContent?.trim()).toBe('ON');
    expect(q(root, '.tc button').getAttribute('aria-pressed')).toBe('true');
  });

  it('color picker: format writes rgb and hsb values and reads them back', async () => {
    const { fixture, host, root } = await setup();
    const hex = q<HTMLInputElement>(root, '.cp input[data-star-part="hexInput"]');
    host.format.set('rgb');
    await fixture.whenStable();
    hex.value = '#00ff00';
    hex.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.color()).toBe('rgb(0, 255, 0)');
    host.format.set('hsb');
    await fixture.whenStable();
    hex.value = '#0000ff';
    hex.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.color()).toBe('hsb(240, 100%, 100%)');
    expect(hex.value.toLowerCase()).toBe('#0000ff');
    host.color.set('rgb(255, 0, 0)');
    await fixture.whenStable();
    expect(hex.value.toLowerCase()).toBe('#ff0000');
  });

  it('knob: strokeWidth and showValue', async () => {
    const { fixture, host, root } = await setup();
    expect(q(root, '.kn [data-star-part="valueItem"]').getAttribute('stroke-width')).toBe('12');
    expect(q(root, '.kn [data-star-part="track"]').getAttribute('stroke-width')).toBe('12');
    expect(q(root, '.kn text')).not.toBeNull();
    host.showValue.set(false);
    await fixture.whenStable();
    expect(q(root, '.kn text')).toBeNull();
    expect(q(root, '.kn svg').getAttribute('aria-valuetext')).toBe('40');
  });

  it('input number: currencyDisplay and showClear', async () => {
    const { fixture, host, root } = await setup();
    const input = q<HTMLInputElement>(root, '.nb input');
    expect(input.value.replace(/\s/g, ' ')).toBe('EUR 12.50');
    q<HTMLButtonElement>(root, '.nb [data-star-part="clearButton"]').click();
    await fixture.whenStable();
    expect(host.price()).toBeNull();
    expect(q(root, '.nb [data-star-part="clearButton"]')).toBeNull();
  });

  it('input mask: variant, showClear and keepCharPositions', async () => {
    const { fixture, host, root } = await setup();
    const mask = q(root, '.mk');
    expect(mask.classList).toContain('star-mask--filled');
    const input = q<HTMLInputElement>(mask, 'input');
    input.dispatchEvent(new Event('focus'));
    input.value = '1234';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.code()).toBe('12-34');
    q<HTMLButtonElement>(mask, '[data-star-part="clearButton"]').click();
    await fixture.whenStable();
    expect(host.code()).toBe('');
  });

  it('input mask: keepCharPositions with real Backspace, Delete, typing and paste', async () => {
    const { fixture, host, root } = await setup();
    const input = q<HTMLInputElement>(root, '.mk input');
    /** One key press: a cancelable `beforeinput` at the caret, as the browser sends it. */
    const press = async (
      inputType: string,
      from: number,
      to = from,
      data: string | null = null,
    ) => {
      input.focus();
      input.setSelectionRange(from, to);
      const event = new InputEvent('beforeinput', {
        inputType,
        data,
        cancelable: true,
        bubbles: true,
      });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      await fixture.whenStable();
    };
    input.dispatchEvent(new Event('focus'));
    for (const [i, digit] of [...'1234'].entries()) {
      await press('insertText', [0, 1, 3, 4][i], undefined, digit);
    }
    expect(input.value).toBe('12-34');
    expect(host.code()).toBe('12-34');
    // Backspace after "2": its slot empties, "34" stays in place.
    await press('deleteContentBackward', 2);
    expect(input.value).toBe('1_-34');
    expect(input.selectionStart).toBe(1);
    // Delete before "3".
    await press('deleteContentForward', 3);
    expect(input.value).toBe('1_-_4');
    // Typing fills the slot at the caret and jumps over the literal.
    await press('insertText', 1, 1, '9');
    expect(input.value).toBe('19-_4');
    expect(input.selectionStart).toBe(3);
    // Paste fills the slots from the caret, over the old characters.
    await press('insertFromPaste', 3, 3, '56');
    expect(input.value).toBe('19-56');
    expect(host.code()).toBe('19-56');
    // A typed character that the slot does not take is ignored.
    await press('insertText', 0, 0, 'x');
    expect(input.value).toBe('19-56');
    // Backspace over a selection empties all of its slots.
    await press('deleteContentBackward', 0, 5);
    expect(input.value).toBe('__-__');
    expect(host.code()).toBe('');
  });

  it('rating: half steps with the keys, valuetext and vertical orientation', async () => {
    const { fixture, host, root } = await setup();
    const rating = q(root, '.rt');
    expect(rating.getAttribute('aria-orientation')).toBe('vertical');
    const radios = Array.from(rating.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios.length).toBe(10);
    expect(radios[4].getAttribute('aria-label')).toBe('2.5 of 5');
    expect(radios[4].checked).toBe(true);
    expect(q(rating, '.star-rating__star--half')).not.toBeNull();
    radios[5].click();
    await fixture.whenStable();
    expect(host.rating()).toBe(3);
  });

  it('range slider: vertical, slideEnd, handle gap and a locked handle', async () => {
    const { fixture, host, root } = await setup();
    const range = q(root, '.rs');
    expect(range.classList).toContain('star-slider--vertical');
    const [low, high] = Array.from(range.querySelectorAll<HTMLInputElement>('input'));
    expect(low.getAttribute('aria-orientation')).toBe('vertical');
    low.value = '75';
    low.dispatchEvent(new Event('input'));
    low.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    // 10 steps of 1 between the handles.
    expect(host.range()).toEqual([70, 80]);
    expect(host.ends).toEqual([[70, 80]]);
    high.value = '72';
    high.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.range()).toEqual([70, 80]);
    host.lockLow.set(true);
    await fixture.whenStable();
    expect(low.disabled).toBe(true);
    expect(high.disabled).toBe(false);
  });
});

describe('color picker format round trip (N1 review)', () => {
  @Component({
    imports: [StarColorPicker],
    template: `<star-color-picker [(value)]="color" format="hsb" ariaLabel="Color" />`,
  })
  class HsbHost {
    readonly color = signal('hsb(0, 0%, 0%)');
  }

  it('the default swatches and 2,000 random colors read back the same in hex, rgb and hsb', async () => {
    const fixture = TestBed.createComponent(HsbHost);
    await fixture.whenStable();
    const swatches = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-star-part="swatchButton"]'),
    ).map((button) => button.getAttribute('aria-label')!.toLowerCase());
    expect(swatches.length).toBeGreaterThan(0);
    let seed = 7;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) % 16777216;
    const colors = [
      ...swatches,
      ...Array.from({ length: 2000 }, () => '#' + random().toString(16).padStart(6, '0')),
    ];
    for (const format of ['hex', 'rgb', 'hsb'] as const) {
      const lost = colors.filter((hex) => ɵstarColorToHex(ɵstarColorFromHex(hex, format)) !== hex);
      expect(lost, format).toEqual([]);
    }
  });

  it('with format hsb a picked swatch stays checked and the hex field shows it', async () => {
    const fixture = TestBed.createComponent(HsbHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-star-part="swatchButton"]'),
    );
    for (const button of buttons) {
      button.click();
      await fixture.whenStable();
      expect(fixture.componentInstance.color()).toMatch(/^hsb\(/);
      expect(button.getAttribute('aria-checked')).toBe('true');
      const hex = root.querySelector<HTMLInputElement>('[data-star-part="hexInput"]')!.value;
      expect(hex).toBe(button.getAttribute('aria-label')!.toLowerCase());
    }
  });
});
