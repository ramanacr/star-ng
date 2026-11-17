import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarDatePicker } from '@star-ng/ui/date-picker';
import { StarIftaLabel, StarInput } from '@star-ng/ui/field';
import { StarInputNumber } from '@star-ng/ui/input-number';
import { StarSelect } from '@star-ng/ui/select';

@Component({
  imports: [StarDatePicker, StarIftaLabel, StarInput, StarInputNumber, StarSelect],
  template: `
    <star-ifta-label id="i-text" label="Customer name" hint="As on the invoice" [error]="error()">
      <input starInput />
    </star-ifta-label>
    <star-ifta-label id="i-select" label="City" required>
      <star-select [options]="cities" />
    </star-ifta-label>
    <star-ifta-label id="i-date" label="Due date"><star-date-picker /></star-ifta-label>
    <star-ifta-label id="i-number" label="Quantity"><star-input-number /></star-ifta-label>
  `,
})
class IftaHost {
  readonly cities = ['Berlin', 'Madrid', 'Paris'];
  readonly error = signal<string | null>(null);
}

async function setup() {
  const fixture = TestBed.createComponent(IftaHost);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const part = (id: string) => {
    const field = el.querySelector<HTMLElement>(`#${id}`)!;
    return { field, label: field.querySelector<HTMLLabelElement>('label.star-ifta__label')! };
  };
  return { fixture, el, part };
}

describe('StarIftaLabel', () => {
  it('puts the label inside the field box, above the control', async () => {
    const { part } = await setup();
    const { field, label } = part('i-text');
    expect(field.classList).toContain('star-ifta');
    const box = field.querySelector('.star-ifta__box')!;
    expect(box.firstElementChild).toBe(label);
    expect(box.querySelector('input.star-input')).not.toBeNull();
    expect(label.textContent?.trim()).toBe('Customer name');
  });

  it('links the label to a text input, a date picker and an input number with for', async () => {
    const { part } = await setup();
    for (const [id, selector] of [
      ['i-text', 'input.star-input'],
      ['i-date', 'input.star-date__input'],
      ['i-number', 'input.star-number__input'],
    ]) {
      const { field, label } = part(id);
      const control = field.querySelector<HTMLInputElement>(selector)!;
      expect(control.id, id).toBeTruthy();
      expect(label.htmlFor, id).toBe(control.id);
      expect(label.control, id).toBe(control);
    }
  });

  it('names a select with aria-labelledby and focuses it on a label click', async () => {
    const { fixture, part } = await setup();
    const { field, label } = part('i-select');
    const combobox = field.querySelector<HTMLElement>('[role=combobox]')!;
    expect(label.hasAttribute('for')).toBe(false);
    expect(combobox.getAttribute('aria-labelledby')).toBe(label.id);
    expect(label.querySelector('.star-field__required')).not.toBeNull();
    label.click();
    await fixture.whenStable();
    expect(field.contains(document.activeElement)).toBe(true);
  });

  it('describes the control with the hint, then with the error', async () => {
    const { fixture, part } = await setup();
    const { field } = part('i-text');
    const input = field.querySelector('input')!;
    const hint = field.querySelector('.star-field__hint')!;
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);

    fixture.componentInstance.error.set('Enter a name.');
    await fixture.whenStable();
    const error = field.querySelector('.star-field__error')!;
    expect(error.textContent?.trim()).toBe('Enter a name.');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(field.classList).toContain('star-field--invalid');
  });
});
