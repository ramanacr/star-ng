import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarToast, StarToastService } from './toast';
import { StarToastMessageTemplate } from './toast-slots';

@Component({
  imports: [StarToast, StarToastMessageTemplate],
  template: `
    <star-toast class="custom" key="custom">
      <ng-template starToastMessage let-message let-close="close">
        <span class="my-copy" [attr.data-id]="message.id" [attr.data-severity]="message.severity">
          {{ message.summary }}
        </span>
        <button type="button" class="my-action" aria-label="Undo" (click)="close()">Undo</button>
      </ng-template>
    </star-toast>
    <star-toast class="plain" key="plain" />
  `,
})
class Host {}

describe('toast slots', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    const toasts = TestBed.inject(StarToastService);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      toasts,
      custom: el.querySelector<HTMLElement>('.custom')!,
      plain: el.querySelector<HTMLElement>('.plain')!,
    };
  }

  afterEach(() => TestBed.inject(StarToastService).clear());

  it('starToastMessage replaces the text and gets the message', async () => {
    const { fixture, toasts, custom } = await setup();
    const id = toasts.show({ severity: 'warn', summary: 'Moved', detail: 'Hidden', key: 'custom' });
    await fixture.whenStable();
    const copy = custom.querySelector('.star-toast__copy')!;
    const mine = copy.querySelector('.my-copy')!;
    expect(mine.textContent?.trim()).toBe('Moved');
    expect(mine.getAttribute('data-id')).toBe(String(id));
    expect(mine.getAttribute('data-severity')).toBe('warn');
    // The built-in summary and detail paragraphs are replaced.
    expect(custom.querySelector('.star-toast__summary')).toBeNull();
    expect(custom.querySelector('.star-toast__detail')).toBeNull();
    expect(copy.textContent).not.toContain('Hidden');
  });

  it('keeps the toast box, the role, the icon and the built-in close button', async () => {
    const { fixture, toasts, custom } = await setup();
    toasts.show({ severity: 'error', summary: 'Failed', key: 'custom' });
    await fixture.whenStable();
    const toast = custom.querySelector('.star-toast')!;
    expect(toast.getAttribute('role')).toBe('alert');
    expect(toast.classList).toContain('star-toast--error');
    expect(toast.querySelector('.star-toast__icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(custom.getAttribute('role')).toBe('region');
    toast.querySelector<HTMLButtonElement>('.star-toast__close')!.click();
    await fixture.whenStable();
    expect(toasts.messages()).toEqual([]);
  });

  it('runs once for each visible toast', async () => {
    const { fixture, toasts, custom } = await setup();
    toasts.show({ summary: 'One', key: 'custom' });
    toasts.show({ summary: 'Two', key: 'custom' });
    await fixture.whenStable();
    expect([...custom.querySelectorAll('.my-copy')].map((n) => n.textContent?.trim())).toEqual([
      'One',
      'Two',
    ]);
  });

  it('close() dismisses only that toast', async () => {
    const { fixture, toasts, custom } = await setup();
    toasts.show({ summary: 'One', key: 'custom', sticky: true });
    toasts.show({ summary: 'Two', key: 'custom', sticky: true });
    await fixture.whenStable();
    custom.querySelectorAll<HTMLButtonElement>('.my-action')[0].click();
    await fixture.whenStable();
    expect(toasts.messages().map((m) => m.summary)).toEqual(['Two']);
    expect([...custom.querySelectorAll('.my-copy')].map((n) => n.textContent?.trim())).toEqual([
      'Two',
    ]);
  });

  it('a button in the template pauses and resumes the close timer with its focus', async () => {
    const { fixture, toasts, custom } = await setup();
    const pause = vi.spyOn(toasts, 'pause');
    const resume = vi.spyOn(toasts, 'resume');
    const id = toasts.show({ summary: 'Timed', key: 'custom' });
    await fixture.whenStable();
    const button = custom.querySelector('.my-action')!;
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(pause).toHaveBeenCalledWith(id);
    button.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(resume).toHaveBeenCalledWith(id);
  });

  it('keeps the default text without a slot', async () => {
    const { fixture, toasts, plain } = await setup();
    toasts.show({ summary: 'Saved', detail: 'Order 1', key: 'plain' });
    await fixture.whenStable();
    const copy = plain.querySelector('.star-toast__copy')!;
    expect(copy.querySelector('.star-toast__summary')?.textContent).toBe('Saved');
    expect(copy.querySelector('.star-toast__detail')?.textContent).toBe('Order 1');
    expect(copy.children.length).toBe(2);
    expect(plain.querySelector('.my-copy')).toBeNull();
  });

  it('a slot of one outlet does not leak into another outlet', async () => {
    const { fixture, toasts, custom, plain } = await setup();
    toasts.show({ summary: 'A', key: 'custom' });
    toasts.show({ summary: 'B', key: 'plain' });
    await fixture.whenStable();
    expect(custom.querySelectorAll('.my-copy').length).toBe(1);
    expect(plain.querySelectorAll('.my-copy').length).toBe(0);
    expect(plain.querySelector('.star-toast__summary')?.textContent).toBe('B');
  });
});
