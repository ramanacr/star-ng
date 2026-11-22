import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarDialog } from '@star-ng/ui/dialog';

// A browser without CSS `overlay` (Firefox, WebKit): the exit motion runs before close().
// Set before any dialog closes in this file; the feature check is read once per document.
Object.defineProperty(window, 'CSS', {
  configurable: true,
  value: { supports: (property: string) => property !== 'overlay' },
});

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

@Component({
  imports: [StarDialog],
  template: `
    <star-dialog
      [(visible)]="open"
      header="Edit order"
      (shown)="events.push('shown')"
      (hidden)="events.push('hidden')"
    >
      <p>Body</p>
    </star-dialog>
  `,
})
class Host {
  readonly open = signal(true);
  readonly events: string[] = [];
}

/** Gives the dialog one running exit animation; returns the function that ends it. */
function fade(dialog: HTMLDialogElement): () => void {
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => (finish = resolve));
  const animation = { finished, effect: { getComputedTiming: () => ({ iterations: 1 }) } };
  (dialog as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [animation];
  return finish;
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
  return { fixture, host: fixture.componentInstance, dialog };
}

describe('StarDialog exit without CSS overlay', () => {
  it('runs the exit on the open dialog, then closes and emits hidden once', async () => {
    const { fixture, host, dialog } = await setup();
    expect(host.events).toEqual(['shown']);
    const finish = fade(dialog);

    host.open.set(false);
    await fixture.whenStable();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.hasAttribute('data-star-closing')).toBe(true);
    expect(host.events).toEqual(['shown']);

    finish();
    await new Promise((resolve) => setTimeout(resolve));
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(dialog.hasAttribute('data-star-closing')).toBe(false);
    expect(host.events).toEqual(['shown', 'hidden']);
  });

  it('a re-open during the exit ends it at once: hidden, then shown', async () => {
    const { fixture, host, dialog } = await setup();
    fade(dialog);
    host.open.set(false);
    await fixture.whenStable();
    expect(dialog.hasAttribute('data-star-closing')).toBe(true);

    host.open.set(true);
    await fixture.whenStable();
    expect(host.events).toEqual(['shown', 'hidden', 'shown']);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.hasAttribute('data-star-closing')).toBe(false);
  });

  it('a destroy during the exit emits nothing more', async () => {
    const { fixture, host, dialog } = await setup();
    const finish = fade(dialog);
    host.open.set(false);
    await fixture.whenStable();
    fixture.destroy();
    finish();
    await new Promise((resolve) => setTimeout(resolve));
    expect(host.events).toEqual(['shown']);
  });
});
