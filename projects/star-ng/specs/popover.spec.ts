import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarConfirmHost, StarConfirmService } from '@star-ng/ui/dialog';
import { StarPopover } from '@star-ng/ui/popover';

// jsdom has no HTMLDialogElement methods. Minimal stand-ins (real browsers implement these).
const dialogProto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
dialogProto.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
dialogProto.show ??= dialogProto.showModal;
dialogProto.close ??= function (this: HTMLDialogElement) {
  if (!this.hasAttribute('open')) return;
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};

function key(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

@Component({
  imports: [StarPopover, StarConfirmHost],
  template: `
    <button type="button" id="anchor" (click)="pop.toggle($event)">Info</button>
    <star-popover #pop ariaLabel="Info"><button type="button" id="inside">OK</button></star-popover>
    <star-confirm-host />
  `,
})
class PopoverHost {}

describe('StarPopover and confirm popup', () => {
  it('toggles, focuses inside, sets aria-expanded and closes on Escape', async () => {
    const fixture = TestBed.createComponent(PopoverHost);
    await fixture.whenStable();
    const anchor = document.getElementById('anchor') as HTMLButtonElement;
    anchor.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    expect(anchor.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.id).toBe('inside');
    key(document.querySelector('.star-popover')!, 'Escape');
    await fixture.whenStable();
    expect(document.querySelector('.star-popover')).toBeNull();
    expect(anchor.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(anchor);
  });

  it('confirm with a target opens a popup instead of a dialog and resolves', async () => {
    const fixture = TestBed.createComponent(PopoverHost);
    await fixture.whenStable();
    const confirm = TestBed.inject(StarConfirmService);
    const result = confirm.ask({
      header: 'Archive?',
      message: 'Moves to archive.',
      acceptLabel: 'Archive',
      target: document.getElementById('anchor')!,
    });
    await fixture.whenStable();
    expect(document.querySelector('star-confirm-host dialog')?.hasAttribute('open')).toBe(false);
    const popup = document.querySelector('.star-popover')!;
    expect(popup.textContent).toContain('Moves to archive.');
    [...popup.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Archive')!.click();
    await expect(result).resolves.toBe(true);
  });
});
