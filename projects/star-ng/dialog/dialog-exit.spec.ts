import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ɵstarOverrideDialogExit } from '@star-ng/ui/core';
import { StarDialog } from '@star-ng/ui/dialog';

// A browser without CSS `overlay` (Firefox, WebKit): the exit motion runs before close(). The
// spec sets the feature answer and the motion setting itself, so the order of the spec files in
// one shared window (an earlier spec may leave `data-star-motion` or a `matchMedia` stub) does
// not matter.
const view = document.defaultView!;
let realMatchMedia = view.matchMedia;
beforeEach(() => {
  realMatchMedia = view.matchMedia;
  ɵstarOverrideDialogExit(false);
  document.documentElement.removeAttribute('data-star-motion');
  view.matchMedia = ((query: string) =>
    ({ matches: false, media: query }) as MediaQueryList) as typeof view.matchMedia;
});
afterEach(() => {
  ɵstarOverrideDialogExit(null);
  view.matchMedia = realMatchMedia;
});

// jsdom has no HTMLDialogElement methods: stand-ins set for each test, as other spec files in
// the same window may have put their own on the prototype.
const dialogProto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
let realDialogMethods: Partial<HTMLDialogElement> = {};
beforeEach(() => {
  // What was there before this test (stubs of other files included) comes back after it.
  realDialogMethods = {
    showModal: dialogProto.showModal,
    show: dialogProto.show,
    close: dialogProto.close,
  };
  dialogProto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto.show = dialogProto.showModal;
  dialogProto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => Object.assign(dialogProto, realDialogMethods));

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
