import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { disabled, FormField, required } from '@angular/forms/signals';
import { SignalFormControl } from '@angular/forms/signals/compat';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import { syncSignalFormControls } from '@star-ng/ui/core';
import { StarDatePicker } from '@star-ng/ui/date-picker';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarInputNumber } from '@star-ng/ui/input-number';
import { StarMultiSelect, StarSelect } from '@star-ng/ui/select';

/**
 * Reactive Forms interop: StarNG controls inside a classic `FormGroup`, through Angular's
 * `SignalFormControl` (the supported bridge since Angular 22). The control is bound with
 * `[formField]="group.controls.x.fieldTree"`; the group sees value, validity, touched and
 * disabled like any other control.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    FormField,
    StarField,
    StarInput,
    StarSelect,
    StarMultiSelect,
    StarCheckbox,
    StarDatePicker,
    StarInputNumber,
  ],
  template: `
    <form [formGroup]="form">
      <input id="legacy" starInput formControlName="note" />
      <star-field label="Country" [state]="form.controls.country.fieldTree()">
        <star-select
          [formField]="form.controls.country.fieldTree"
          [options]="['IN', 'DE', 'FR']"
          ariaLabel="Country"
        />
      </star-field>
      <star-multi-select
        [formField]="form.controls.tags.fieldTree"
        [options]="['a', 'b']"
        ariaLabel="Tags"
      />
      <star-checkbox [formField]="form.controls.agree.fieldTree">Agree</star-checkbox>
      <star-date-picker
        [formField]="form.controls.received.fieldTree"
        locale="en-GB"
        ariaLabel="Received"
      />
      <star-input-number
        [formField]="form.controls.quantity.fieldTree"
        locale="en-US"
        ariaLabel="Quantity"
      />
    </form>
  `,
})
class Host {
  /** Signal Forms derive disabled state from rules; SignalFormControl.disable() is not supported. */
  readonly locked = signal(false);
  readonly form = new FormGroup({
    note: new FormControl('legacy'),
    country: new SignalFormControl<string | null>(null, (p) => {
      required(p, { message: 'Choose a country.' });
    }),
    tags: new SignalFormControl<readonly string[]>([]),
    agree: new SignalFormControl(false, (p) => {
      disabled(p, { when: () => this.locked() });
    }),
    received: new SignalFormControl<Date | null>(null, (p) => {
      required(p, { when: () => !this.locked() });
      disabled(p, { when: () => this.locked() });
    }),
    quantity: new SignalFormControl<number | null>(10),
  });
  private readonly sync = syncSignalFormControls(this.form);
}

describe('Reactive Forms interop (SignalFormControl)', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return {
      fixture,
      form: fixture.componentInstance.form,
      el: fixture.nativeElement as HTMLElement,
    };
  }

  it('puts StarNG controls in a FormGroup next to classic controls', async () => {
    const { form } = await setup();
    expect(form.value).toEqual({
      note: 'legacy',
      country: null,
      tags: [],
      agree: false,
      received: null,
      quantity: 10,
    });
    expect(form.valid).toBe(false);
    expect(form.controls.country.errors).toBeTruthy();
  });

  it('writes user input from the controls into the FormGroup', async () => {
    const { fixture, form, el } = await setup();
    el.querySelector<HTMLElement>('star-select [role=combobox]')!.click();
    await fixture.whenStable();
    document.querySelectorAll<HTMLElement>('[role=option]')[1].click();
    el.querySelector<HTMLInputElement>('star-checkbox input')!.click();
    const date = el.querySelector<HTMLInputElement>('star-date-picker input')!;
    date.value = '05/03/2026';
    date.dispatchEvent(new Event('input'));
    date.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(form.value.country).toBe('DE');
    expect(form.value.agree).toBe(true);
    expect(form.value.received).toEqual(new Date(2026, 2, 5));
    expect(form.valid).toBe(true);
    expect(form.dirty).toBe(true);
  });

  it('writes FormGroup values, rule-based disabled state and touched into the controls', async () => {
    const { fixture, form, el } = await setup();
    form.patchValue({ country: 'FR', tags: ['b'], quantity: 42 });
    fixture.componentInstance.locked.set(true);
    await fixture.whenStable();
    expect(el.querySelector('star-select [role=combobox]')!.textContent).toContain('FR');
    expect(el.querySelector('star-multi-select [role=combobox]')!.textContent).toContain('b');
    expect(el.querySelector<HTMLInputElement>('star-input-number input')!.value).toBe('42');
    expect(el.querySelector<HTMLInputElement>('star-checkbox input')!.disabled).toBe(true);
    expect(form.controls.agree.disabled).toBe(true);

    form.patchValue({ country: null });
    el.querySelector<HTMLElement>('star-select [role=combobox]')!.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(form.controls.country.touched).toBe(true);
    expect(el.querySelector('.star-field__error')?.textContent).toContain('Choose a country.');
  });

  it('a field locked by rule stops blocking validity when its validator is conditional', async () => {
    const { fixture, form, el } = await setup();
    form.patchValue({ country: 'IN' });
    await fixture.whenStable();
    expect(form.valid).toBe(false); // received is required and empty
    fixture.componentInstance.locked.set(true);
    await fixture.whenStable();
    expect(el.querySelector<HTMLInputElement>('star-date-picker input')!.disabled).toBe(true);
    expect(form.valid).toBe(true);
  });
});
