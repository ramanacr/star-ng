import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { applyMask, StarInputMask, unmask } from 'star-ng/input-mask';
import { StarInputOtp } from 'star-ng/input-otp';

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

describe('Input mask and OTP', () => {
  it('mask helpers apply and strip literals', () => {
    expect(applyMask('99999-9999-99', '123456789')).toBe('12345-6789-__');
    expect(applyMask('aa-99', '1a2b34')).toBe('ab-34');
    expect(unmask('99999-9999-99', '12345-6789-__')).toBe('123456789');
  });

  it('mask field formats typing and clears incomplete values on blur', async () => {
    @Component({
      imports: [StarInputMask],
      template: `<star-input-mask mask="(999) 999-9999" [(value)]="phone" />`,
    })
    class Host {
      readonly phone = signal('');
    }
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    input.value = '5551234567';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(input.value).toBe('(555) 123-4567');
    expect(fixture.componentInstance.phone()).toBe('(555) 123-4567');
    input.value = '555';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(fixture.componentInstance.phone()).toBe('');
  });

  it('OTP accepts digits, advances, pastes a full code and emits completed', async () => {
    @Component({
      imports: [StarInputOtp],
      template: `<star-input-otp
        [(value)]="code"
        [length]="4"
        integerOnly
        (completed)="done = $event"
      />`,
    })
    class Host {
      readonly code = signal('');
      done = '';
    }
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const boxes = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      'input',
    );
    expect(boxes.length).toBe(4);
    expect(boxes[0].getAttribute('autocomplete')).toBe('one-time-code');
    boxes[0].value = 'x';
    boxes[0].dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.code()).toBe('');
    boxes[0].value = '7';
    boxes[0].dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.code()).toBe('7');
    expect(document.activeElement).toBe(boxes[1]);
    const paste = new Event('paste', { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '4 5 6' } });
    boxes[1].dispatchEvent(paste);
    await fixture.whenStable();
    expect(fixture.componentInstance.code()).toBe('7456');
    expect(fixture.componentInstance.done).toBe('7456');
  });
});
