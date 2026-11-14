import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required, validate } from '@angular/forms/signals';
import { StarCheckbox } from 'star-ng/checkbox';
import { StarField, StarInput } from 'star-ng/field';
import { StarRadio, StarRadioGroup } from 'star-ng/radio';
import { StarToggleSwitch } from 'star-ng/toggle-switch';

interface Model {
  name: string;
  agree: boolean;
  notify: boolean;
  channel: string | null;
}

@Component({
  imports: [
    FormField,
    StarField,
    StarInput,
    StarCheckbox,
    StarToggleSwitch,
    StarRadioGroup,
    StarRadio,
  ],
  template: `
    <star-field label="Name" hint="Full name" [state]="f.name()">
      <input starInput [formField]="f.name" />
    </star-field>
    <star-checkbox [formField]="f.agree">Agree</star-checkbox>
    <star-toggle-switch [formField]="f.notify">Notify</star-toggle-switch>
    <star-radio-group [formField]="f.channel" ariaLabel="Channel">
      <star-radio value="email">Email</star-radio>
      <star-radio value="phone">Phone</star-radio>
    </star-radio-group>
  `,
})
class Host {
  readonly model = signal<Model>({ name: '', agree: false, notify: false, channel: null });
  readonly f = form(this.model, (p) => {
    required(p.name, { message: 'Name is required.' });
    validate(p.agree, ({ value }) => (value() ? undefined : { kind: 'agree' }));
  });
}

describe('Signal Forms controls', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('links label, control and hint through star-field', async () => {
    const { el } = await setup();
    const input = el.querySelector('input.star-input')!;
    const label = el.querySelector('label.star-field__label')!;
    expect(input.id).toBeTruthy();
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('aria-describedby')).toBe(el.querySelector('.star-field__hint')!.id);
    expect(label.textContent).toContain('*');
  });

  it('shows the field error only after the control is touched', async () => {
    const { fixture, el } = await setup();
    const input = el.querySelector<HTMLInputElement>('input.star-input')!;
    expect(el.querySelector('.star-field__error')).toBeNull();
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(el.querySelector('.star-field__error')?.textContent).toContain('Name is required.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('checkbox writes the model and reflects form validity', async () => {
    const { fixture, host, el } = await setup();
    const box = el.querySelector<HTMLInputElement>('star-checkbox input')!;
    expect(host.f.agree().invalid()).toBe(true);
    box.click();
    await fixture.whenStable();
    expect(host.model().agree).toBe(true);
    expect(host.f.agree().invalid()).toBe(false);
  });

  it('toggle switch exposes role=switch and writes the model', async () => {
    const { fixture, host, el } = await setup();
    const sw = el.querySelector<HTMLInputElement>('[role=switch]')!;
    sw.click();
    await fixture.whenStable();
    expect(host.model().notify).toBe(true);
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('radio group shares one name and writes the chosen value', async () => {
    const { fixture, host, el } = await setup();
    const radios = [...el.querySelectorAll<HTMLInputElement>('input[type=radio]')];
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    radios[1].click();
    await fixture.whenStable();
    expect(host.model().channel).toBe('phone');
    host.model.update((m) => ({ ...m, channel: 'email' }));
    await fixture.whenStable();
    expect(radios[0].checked).toBe(true);
  });
});
