import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  StarKeyFilter,
  starKeyFilterAllows,
  starKeyFilterClean,
  StarKeyFilterRule,
} from '@star-ng/ui/utility';

@Component({
  imports: [StarKeyFilter, ReactiveFormsModule],
  template: `
    <input
      aria-label="Value"
      [starKeyFilter]="rule()"
      [validateOnly]="validateOnly()"
      [formControl]="control"
      (validChange)="valid.set($event)"
    />
  `,
})
class Host {
  readonly rule = signal<StarKeyFilterRule>('int');
  readonly validateOnly = signal(false);
  readonly control = new FormControl('');
  readonly valid = signal<boolean | null>(null);
}

function setup(rule: StarKeyFilterRule = 'int', validateOnly = false) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.rule.set(rule);
  fixture.componentInstance.validateOnly.set(validateOnly);
  fixture.detectChanges();
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  return { fixture, input, host: fixture.componentInstance };
}

/** Fires `beforeinput` and returns true when the directive blocked it. */
function type(input: HTMLInputElement, data: string, init: Partial<InputEventInit> = {}): boolean {
  const event = new InputEvent('beforeinput', {
    data,
    inputType: 'insertText',
    cancelable: true,
    bubbles: true,
    ...init,
  });
  input.dispatchEvent(event);
  return event.defaultPrevented;
}

function paste(input: HTMLInputElement, text: string): boolean {
  const event = new Event('paste', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  input.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('starKeyFilter presets', () => {
  const cases: [StarKeyFilterRule, string, string][] = [
    ['int', '-120', '1.5'],
    ['num', '-1.5,2', '1e5'],
    ['money', "1'250.00", '$5'],
    ['hex', 'C0ffee', 'g'],
    ['alpha', 'Zoë_München', 'a1'],
    ['alphanum', 'Order_42', 'a-b'],
    ['email', 'ana.ruiz+b@example.com', 'a b'],
    [/[A-Z]/, 'ABC', 'abc'],
  ];
  for (const [rule, ok, bad] of cases) {
    it(`${rule}: allows "${ok}" and blocks "${bad}"`, () => {
      expect(starKeyFilterAllows(rule, ok)).toBe(true);
      expect(starKeyFilterAllows(rule, bad)).toBe(false);
    });
  }

  it('starKeyFilterClean keeps the allowed characters', () => {
    expect(starKeyFilterClean('int', 'a1b2-3')).toBe('12-3');
    expect(starKeyFilterClean(/[a-z]/g, 'a1b')).toBe('ab');
  });
});

describe('starKeyFilter directive', () => {
  it('blocks a key that the filter does not allow', () => {
    const { input } = setup('int');
    expect(type(input, '7')).toBe(false);
    expect(type(input, 'x')).toBe(true);
    // Deleting is never blocked.
    expect(type(input, '', { inputType: 'deleteContentBackward', data: null })).toBe(false);
  });

  it('inserts only the allowed characters of a paste', () => {
    const { input, host } = setup('int');
    input.value = '1';
    input.setSelectionRange(1, 1);
    expect(paste(input, '2a3')).toBe(true);
    expect(input.value).toBe('123');
    expect(host.control.value).toBe('123');
    // A clean paste goes through as usual.
    expect(paste(input, '45')).toBe(false);
  });

  it('does not block during IME composition and cleans the value after it', () => {
    const { input, host } = setup('alpha');
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    expect(type(input, 'か1', { inputType: 'insertCompositionText', isComposing: true })).toBe(
      false,
    );
    expect(type(input, '1')).toBe(false);
    input.value = 'かな1';
    input.dispatchEvent(new CompositionEvent('compositionend'));
    expect(input.value).toBe('かな');
    expect(host.control.value).toBe('かな');
    expect(type(input, '1')).toBe(true);
  });

  it('validateOnly does not block and sets an error instead', () => {
    const { input, host, fixture } = setup('int', true);
    expect(type(input, 'x')).toBe(false);
    expect(paste(input, 'x')).toBe(false);
    input.value = '12x';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.valid()).toBe(false);
    expect(host.control.hasError('starKeyFilter')).toBe(true);
    expect(input.validationMessage).toBe('The value has a character that is not allowed.');
    expect(input.classList).toContain('star-key-filter--invalid');

    input.value = '12';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.valid()).toBe(true);
    expect(host.control.valid).toBe(true);
    expect(input.classList).not.toContain('star-key-filter--invalid');
  });
});
