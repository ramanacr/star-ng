import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import { provideStarUiText } from '@star-ng/ui/core';
import { StarRadio, StarRadioGroup } from '@star-ng/ui/radio';
import { StarField, StarFieldStateLike, StarInput } from './field';

@Component({
  imports: [StarField, StarInput],
  template: `
    <star-field label="User name" hint="Letters and digits." [state]="state">
      <input starInput />
    </star-field>
  `,
})
class Host {
  readonly pending = signal(false);
  readonly state: StarFieldStateLike = {
    touched: () => false,
    invalid: () => false,
    errors: () => [],
    pending: () => this.pending(),
  };
}

describe('StarField pending state', () => {
  it('is aria-busy and shows a busy icon while an async validator runs', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const field = (fixture.nativeElement as HTMLElement).querySelector('star-field')!;
    expect(field.getAttribute('aria-busy')).toBeNull();
    expect(field.querySelector('[data-star-part=pendingIcon]')).toBeNull();

    fixture.componentInstance.pending.set(true);
    await fixture.whenStable();
    expect(field.getAttribute('aria-busy')).toBe('true');
    // The control is busy too: a screen reader reads the state of the focused control.
    expect(field.querySelector('input')!.getAttribute('aria-busy')).toBe('true');
    expect(field.classList).toContain('star-field--pending');
    const icon = field.querySelector('[data-star-part=pendingIcon]')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(field.querySelector('.star-field__hint')?.textContent).toContain('Letters and digits.');

    fixture.componentInstance.pending.set(false);
    await fixture.whenStable();
    expect(field.getAttribute('aria-busy')).toBeNull();
    expect(field.querySelector('input')!.getAttribute('aria-busy')).toBeNull();
  });

  it('works with a state that has no pending()', async () => {
    @Component({
      imports: [StarField],
      template: `<star-field label="A" [state]="state"><input /></star-field>`,
    })
    class Plain {
      readonly state: StarFieldStateLike = {
        touched: () => false,
        invalid: () => false,
        errors: () => [],
      };
    }
    const fixture = TestBed.createComponent(Plain);
    await fixture.whenStable();
    const field = (fixture.nativeElement as HTMLElement).querySelector('star-field')!;
    expect(field.getAttribute('aria-busy')).toBeNull();
  });

  it('says "Checking…" in a polite status while an async validator runs', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const field = (fixture.nativeElement as HTMLElement).querySelector('star-field')!;
    // The live region is in the DOM before its text changes, so screen readers announce it.
    const status = field.querySelector('[data-star-part=pendingStatus]')!;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.classList).toContain('star-sr-only');
    expect(status.textContent!.trim()).toBe('');

    fixture.componentInstance.pending.set(true);
    await fixture.whenStable();
    expect(status.textContent!.trim()).toBe('Checking…');
    // The status is not the description of the control: the hint stays the description.
    expect(field.querySelector('input')!.getAttribute('aria-describedby')).toBe(
      field.querySelector('.star-field__hint')!.id,
    );

    fixture.componentInstance.pending.set(false);
    await fixture.whenStable();
    expect(status.textContent!.trim()).toBe('');
  });

  it('takes the status text from STAR_UI_TEXT', async () => {
    TestBed.configureTestingModule({ providers: [provideStarUiText({ fieldPending: 'Prüfe' })] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.pending.set(true);
    await fixture.whenStable();
    const status = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-star-part=pendingStatus]',
    )!;
    expect(status.textContent!.trim()).toBe('Prüfe');
  });
});

@Component({
  imports: [StarField, StarCheckbox, StarRadio, StarRadioGroup],
  template: `
    <star-field id="toppings" label="Toppings" hint="Pick one or more." [state]="state">
      <star-checkbox>Cheese</star-checkbox>
      <star-checkbox>Olives</star-checkbox>
    </star-field>
    <star-field id="plan" label="Plan" hint="Pick a plan." [state]="state">
      <star-radio-group>
        <star-radio value="free">Free</star-radio>
        <star-radio value="pro">Pro</star-radio>
      </star-radio-group>
    </star-field>
  `,
})
class GroupHost {
  readonly pending = signal(false);
  readonly error = signal(false);
  readonly state: StarFieldStateLike = {
    touched: () => this.error(),
    invalid: () => this.error(),
    errors: () => (this.error() ? [{ kind: 'taken', message: 'Not available.' }] : []),
    pending: () => this.pending(),
  };
}

describe('StarField hint and error on every box of a group (Narrator pass)', () => {
  afterEach(() => document.querySelectorAll('[ng-version]').forEach((n) => n.remove()));
  async function setup() {
    const fixture = TestBed.createComponent(GroupHost);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const boxes = [...el.querySelectorAll<HTMLInputElement>('#toppings input[type=checkbox]')];
    const radios = [...el.querySelectorAll<HTMLInputElement>('#plan input[type=radio]')];
    const text = (ids: string | null) =>
      (ids ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .join('|');
    return { fixture, el, boxes, radios, text };
  }

  it('describes every checkbox in the field with the hint, then the error', async () => {
    const { fixture, boxes, text } = await setup();
    expect(boxes.length).toBe(2);
    for (const box of boxes)
      expect(text(box.getAttribute('aria-describedby'))).toBe('Pick one or more.');

    fixture.componentInstance.pending.set(true);
    await fixture.whenStable();
    for (const box of boxes) expect(box.getAttribute('aria-busy')).toBe('true');

    fixture.componentInstance.pending.set(false);
    fixture.componentInstance.error.set(true);
    await fixture.whenStable();
    for (const box of boxes) {
      expect(box.getAttribute('aria-busy')).toBeNull();
      expect(box.getAttribute('aria-invalid')).toBe('true');
      expect(text(box.getAttribute('aria-describedby'))).toBe('Not available.');
    }
  });

  it('only the first checkbox takes the field label', async () => {
    const { boxes } = await setup();
    const label = document.querySelector<HTMLLabelElement>('#toppings label.star-field__label')!;
    expect(label.htmlFor).toBe(boxes[0].id);
  });

  it('describes every radio with the hint or the error of the field', async () => {
    const { fixture, radios, text, el } = await setup();
    const group = el.querySelector('#plan [role=radiogroup]')!;
    for (const radio of radios) {
      expect(text(radio.getAttribute('aria-describedby'))).toBe('Pick a plan.');
      expect(radio.hasAttribute('aria-invalid')).toBe(false);
    }
    fixture.componentInstance.error.set(true);
    await fixture.whenStable();
    expect(group.getAttribute('aria-invalid')).toBe('true');
    for (const radio of radios) {
      expect(radio.getAttribute('aria-invalid')).toBe('true');
      expect(text(radio.getAttribute('aria-describedby'))).toBe('Not available.');
    }
  });

  it('a radio group outside a field sets no description on its radios', async () => {
    @Component({
      imports: [StarRadio, StarRadioGroup],
      template: `<star-radio-group ariaLabel="Size"
        ><star-radio value="s">S</star-radio></star-radio-group
      >`,
    })
    class Bare {}
    const fixture = TestBed.createComponent(Bare);
    await fixture.whenStable();
    const radio = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expect(radio.hasAttribute('aria-describedby')).toBe(false);
    expect(radio.hasAttribute('aria-invalid')).toBe(false);
  });
});
