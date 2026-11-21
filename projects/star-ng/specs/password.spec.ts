import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarPassword } from '@star-ng/ui/password';

@Component({
  imports: [StarPassword],
  template: `<star-password [(value)]="password" feedback />`,
})
class PasswordHost {
  readonly password = signal('');
}

@Component({
  imports: [StarPassword],
  template: `<star-password [(value)]="password" [toggleMask]="mask()" />`,
})
class MaskToggleHost {
  readonly password = signal('secret');
  readonly mask = signal(true);
}

describe('StarPassword', () => {
  it('password goes back to masked when toggleMask turns off while revealed', async () => {
    const fixture = TestBed.createComponent(MaskToggleHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('star-password input')!;
    el.querySelector<HTMLButtonElement>('star-password button')!.click();
    await fixture.whenStable();
    expect(input.type).toBe('text');
    fixture.componentInstance.mask.set(false);
    await fixture.whenStable();
    expect(el.querySelector('star-password button')).toBeNull();
    expect(input.type).toBe('password');
  });

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
