import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideStarDialogDefaults,
  STAR_DIALOG_DATA,
  StarDialogRef,
  StarDialogService,
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

@Component({
  template: `
    <p class="greeting">Hello {{ data.name }}</p>
    <button id="ok" (click)="ref.close('saved')">OK</button>
  `,
})
class Content {
  readonly data = inject<{ name: string }>(STAR_DIALOG_DATA);
  readonly ref = inject<StarDialogRef<string>>(StarDialogRef);
}

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    TestBed.tick();
    await Promise.resolve();
  }
};

describe('StarDialogService', () => {
  afterEach(() => TestBed.inject(StarDialogService).closeAll());

  it('opens a component with data in a modal dialog and resolves the result', async () => {
    const service = TestBed.inject(StarDialogService);
    const ref = service.open<Content, { name: string }, string>(Content, {
      header: 'Greeting',
      data: { name: 'Ada' },
    });
    await settle();
    const dialog = document.querySelector<HTMLDialogElement>('star-dialog-container dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.querySelector('h2')?.textContent).toContain('Greeting');
    expect(dialog.querySelector('.greeting')?.textContent).toContain('Hello Ada');

    dialog.querySelector<HTMLButtonElement>('#ok')!.click();
    await settle();
    await expect(ref.closed).resolves.toBe('saved');
    expect(document.querySelector('star-dialog-container')).toBeNull();
  });

  it('keeps the dialog in the DOM until its close transition ends, then removes it', async () => {
    const service = TestBed.inject(StarDialogService);
    const ref = service.open<Content, { name: string }, string>(Content, { data: { name: 'Ada' } });
    await settle();
    const host = document.querySelector<HTMLElement>('star-dialog-container')!;
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => (finish = resolve));
    const transition = { finished, effect: { getComputedTiming: () => ({ iterations: 1 }) } };
    (host as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [transition];

    host.querySelector<HTMLButtonElement>('#ok')!.click();
    await settle();
    // The result comes at once; only the element waits for the exit motion.
    await expect(ref.closed).resolves.toBe('saved');
    expect(host.isConnected).toBe(true);
    expect(host.querySelector('dialog')!.hasAttribute('open')).toBe(false);

    finish();
    await new Promise((resolve) => setTimeout(resolve));
    expect(host.isConnected).toBe(false);
  });

  it('passes the position, drag, resize and maximize options to the dialog', async () => {
    const service = TestBed.inject(StarDialogService);
    service.open(Content, {
      header: 'Options',
      data: { name: 'Ada' },
      position: 'top-end',
      draggable: true,
      resizable: true,
      maximizable: true,
      blockScroll: false,
    });
    await settle();
    const dialog = document.querySelector<HTMLDialogElement>('star-dialog-container dialog')!;
    expect(dialog.classList).toContain('star-dialog--at-top-end');
    expect(dialog.classList).not.toContain('star-dialog--block-scroll');
    expect(dialog.querySelector('[aria-label="Move dialog"]')).not.toBeNull();
    expect(dialog.querySelector('[aria-label="Resize dialog"]')).not.toBeNull();
    expect(dialog.querySelector('[aria-label="Maximize"]')).not.toBeNull();
  });

  it('resolves undefined when the user dismisses it, and closeAll() closes every dialog', async () => {
    const service = TestBed.inject(StarDialogService);
    const first = service.open(Content, { data: { name: 'A' } });
    const second = service.open(Content, { data: { name: 'B' } });
    await settle();
    expect(document.querySelectorAll('star-dialog-container').length).toBe(2);

    document
      .querySelectorAll<HTMLButtonElement>('star-dialog-container [aria-label=Close]')[1]
      .click();
    await settle();
    await expect(second.closed).resolves.toBeUndefined();

    service.closeAll();
    await settle();
    await expect(first.closed).resolves.toBeUndefined();
    expect(document.querySelector('star-dialog-container')).toBeNull();
  });
});

describe('StarDialogService with STAR_DIALOG_DEFAULTS', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideStarDialogDefaults({
          size: 'lg',
          closable: false,
          closeOnEscape: false,
          dismissableMask: true,
        }),
      ],
    }),
  );
  afterEach(() => TestBed.inject(StarDialogService).closeAll());

  const dialog = () => document.querySelector<HTMLDialogElement>('star-dialog-container dialog')!;

  it('uses the token for size, closable and dismissableMask', async () => {
    const ref = TestBed.inject(StarDialogService).open(Content, {
      header: 'Defaults',
      data: { name: 'Ada' },
    });
    await settle();
    expect(dialog().classList).toContain('star-dialog--lg');
    expect(dialog().querySelector('[aria-label="Close"]')).toBeNull();
    dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    await expect(ref.closed).resolves.toBeUndefined();
  });

  it('uses the token for closeOnEscape, and the open() config wins over the token', async () => {
    const ref = TestBed.inject(StarDialogService).open(Content, {
      header: 'Config wins',
      data: { name: 'Ada' },
      size: 'sm',
      closable: true,
      dismissableMask: false,
    });
    await settle();
    expect(dialog().classList).toContain('star-dialog--sm');
    expect(dialog().querySelector('[aria-label="Close"]')).not.toBeNull();
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(dialog().hasAttribute('open')).toBe(true);
    ref.close();
    await settle();
  });
});
