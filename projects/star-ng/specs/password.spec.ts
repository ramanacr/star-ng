import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarPassword } from 'star-ng/password';

@Component({
  imports: [StarPassword],
  template: `<star-password [(value)]="password" feedback />`,
})
class PasswordHost {
  readonly password = signal('');
}

describe('StarPassword', () => {
  it('password shows strength and toggles masking', async () => {
    const fixture = TestBed.createComponent(PasswordHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const host = fixture.componentInstance;
    const input = el.querySelector<HTMLInputElement>('star-password input')!;
    expect(input.type).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('new-password');
    input.value = 'Abcdefgh1234!';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.password()).toBe('Abcdefgh1234!');
    expect(el.querySelector('.star-password__level')?.textContent).toContain('strong');
    el.querySelector<HTMLButtonElement>('star-password button')!.click();
    await fixture.whenStable();
    expect(input.type).toBe('text');
  });
});
