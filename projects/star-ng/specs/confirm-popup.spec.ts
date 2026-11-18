import { Component, ElementRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarConfirmHost,
  StarConfirmMessageTemplate,
  StarConfirmService,
} from '@star-ng/ui/dialog';

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

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

@Component({
  imports: [StarConfirmHost, StarConfirmMessageTemplate],
  template: `
    <button type="button" id="target" #target>Delete invoice</button>
    <button type="button" id="outside">Elsewhere</button>
    <star-confirm-host>
      @if (custom) {
        <ng-template starConfirmMessage let-options>
          <strong class="custom">Sure? {{ options.message }}</strong>
        </ng-template>
      }
    </star-confirm-host>
  `,
})
class Host {
  custom = false;
  readonly target = viewChild.required<ElementRef<HTMLButtonElement>>('target');
}

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
  }
};

async function setup(custom = false) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.custom = custom;
  await fixture.whenStable();
  const confirm = TestBed.inject(StarConfirmService);
  const target = fixture.componentInstance.target();
  target.nativeElement.focus();
  return { fixture, confirm, target };
}

const popup = () => document.querySelector<HTMLElement>('.star-popover')!;
const button = (label: string) =>
  [...popup().querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;

describe('confirm popup', () => {
  it('anchors an alertdialog to an ElementRef target, labelled by the message', async () => {
    const { confirm, target } = await setup();
    void confirm.ask({ message: 'Delete invoice INV-2041?', target });
    await settle();

    const panel = popup();
    expect(panel.getAttribute('role')).toBe('alertdialog');
    expect(panel.getAttribute('aria-modal')).toBe('false');
    const labelId = panel.getAttribute('aria-labelledby')!;
    expect(document.getElementById(labelId)?.textContent?.trim()).toBe('Delete invoice INV-2041?');
    expect(panel.hasAttribute('aria-label')).toBe(false);
    expect(target.nativeElement.getAttribute('aria-expanded')).toBe('true');
    // The modal confirm dialog stays closed.
    expect(document.querySelector('star-confirm-host dialog')?.hasAttribute('open')).toBe(false);
  });

  it('focuses reject by default, also for danger, and accept with defaultFocus', async () => {
    const { confirm, target } = await setup();
    const first = confirm.ask({ message: 'Delete invoice?', severity: 'danger', target });
    await settle();
    expect(document.activeElement).toBe(button('Cancel'));
    expect(button('Confirm').className).toContain('star-btn--danger');
    button('Cancel').click();
    await expect(first).resolves.toBe(false);

    void confirm.ask({ message: 'Send order?', defaultFocus: 'accept', target });
    await settle();
    expect(document.activeElement).toBe(button('Confirm'));
    expect(button('Confirm').className).toContain('star-btn--primary');
  });

  it('resolves true on accept and returns the focus to the target', async () => {
    const { confirm, target } = await setup();
    const result = confirm.ask({ message: 'Archive?', acceptLabel: 'Archive', target });
    await settle();
    button('Archive').click();
    await expect(result).resolves.toBe(true);
    await settle();
    expect(document.querySelector('.star-popover')).toBeNull();
    expect(document.activeElement).toBe(target.nativeElement);
    expect(target.nativeElement.getAttribute('aria-expanded')).toBe('false');
  });

  it('rejects on Escape and returns the focus to the target', async () => {
    const { confirm, target } = await setup();
    const result = confirm.ask({ message: 'Archive?', target: target.nativeElement });
    await settle();
    button('Cancel').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await expect(result).resolves.toBe(false);
    await settle();
    expect(document.querySelector('.star-popover')).toBeNull();
    expect(document.activeElement).toBe(target.nativeElement);
  });

  it('rejects on a click outside', async () => {
    const { confirm, target } = await setup();
    const result = confirm.ask({ message: 'Archive?', target });
    await settle();
    const outside = document.getElementById('outside')!;
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    outside.click();
    await expect(result).resolves.toBe(false);
    await settle();
    expect(document.querySelector('.star-popover')).toBeNull();
  });

  it('keeps Tab and Shift+Tab inside the popup', async () => {
    const { confirm, target } = await setup();
    void confirm.ask({ message: 'Archive?', target });
    await settle();
    const tab = (from: HTMLElement, shiftKey = false) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      from.focus();
      from.dispatchEvent(event);
      return event.defaultPrevented;
    };
    // Tab on the last button wraps to the first one; Shift+Tab on the first wraps to the last.
    expect(tab(button('Confirm'))).toBe(true);
    expect(document.activeElement).toBe(button('Cancel'));
    expect(tab(button('Cancel'), true)).toBe(true);
    expect(document.activeElement).toBe(button('Confirm'));
    // Inside the popup the browser moves the focus.
    expect(tab(button('Cancel'))).toBe(false);
  });

  it('shows the next queued popup after an answer', async () => {
    const { confirm, target } = await setup();
    const first = confirm.ask({ message: 'First?', target });
    const second = confirm.ask({ message: 'Second?', target });
    await settle();
    expect(popup().textContent).toContain('First?');
    button('Confirm').click();
    await expect(first).resolves.toBe(true);
    await settle();
    expect(popup().textContent).toContain('Second?');
    button('Cancel').click();
    await expect(second).resolves.toBe(false);
  });

  it('renders the starConfirmMessage slot in the popup and the dialog', async () => {
    const { fixture, confirm, target } = await setup(true);
    const result = confirm.ask({ message: 'Close project?', target });
    await settle();
    expect(popup().querySelector('.custom')?.textContent).toBe('Sure? Close project?');
    button('Confirm').click();
    await expect(result).resolves.toBe(true);

    void confirm.ask({ message: 'Close all projects?' });
    await settle();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    expect(dialog.querySelector('.custom')?.textContent).toBe('Sure? Close all projects?');
    // Without a header the message names the dialog.
    expect(dialog.getAttribute('aria-label')).toBe('Close all projects?');
    confirm.settle(false);
  });
});
