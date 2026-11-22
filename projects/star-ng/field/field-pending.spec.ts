import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
    expect(field.classList).toContain('star-field--pending');
    const icon = field.querySelector('[data-star-part=pendingIcon]')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(field.querySelector('.star-field__hint')?.textContent).toContain('Letters and digits.');

    fixture.componentInstance.pending.set(false);
    await fixture.whenStable();
    expect(field.getAttribute('aria-busy')).toBeNull();
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
});
