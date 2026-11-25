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

  it('opens a side sheet at the end edge by default and at the start edge with position start', async () => {
    const service = TestBed.inject(StarDialogService);
    service.open(Content, { header: 'Sheet', data: { name: 'Ada' }, sheet: true, width: '40rem' });
    await settle();
    const dialog = document.querySelector<HTMLDialogElement>('star-dialog-container dialog')!;
    expect(dialog.classList).toContain('star-dialog--sheet');
    expect(dialog.classList).toContain('star-dialog--at-end');
    expect(dialog.style.width).toBe('40rem');
    service.closeAll();
    await settle();

    service.open(Content, { data: { name: 'Ada' }, sheet: true, position: 'start' });
    await settle();
    const start = document.querySelector<HTMLDialogElement>('star-dialog-container dialog')!;
    expect(start.classList).toContain('star-dialog--at-start');

    service.open(Content, { data: { name: 'Ada' } });
    await settle();
    const plain = document.querySelectorAll<HTMLDialogElement>('star-dialog-container dialog')[1];
    expect(plain.classList).not.toContain('star-dialog--sheet');
    expect(plain.classList).toContain('star-dialog--at-center');
  });

  it('stacks a sheet opened from an open dialog, and Escape closes only the top one', async () => {
    @Component({
      template: `<button id="more" (click)="openSheet()">More</button>`,
    })
    class Opener {
      private readonly dialogs = inject(StarDialogService);
      sheet: StarDialogRef<unknown> | null = null;
      openSheet(): void {
        this.sheet = this.dialogs.open(Content, {
          header: 'Top',
          sheet: true,
          data: { name: 'B' },
        });
      }
    }
    const service = TestBed.inject(StarDialogService);
    const parent = service.open(Opener, { header: 'Parent' });
    await settle();
    document.querySelector<HTMLButtonElement>('#more')!.click();
    await settle();
    const dialogs = document.querySelectorAll<HTMLDialogElement>('star-dialog-container dialog');
    expect(dialogs.length).toBe(2);
    // The later container comes later in the body: showModal() put it on top of the top layer.
    const [below, top] = dialogs;
    expect(top.classList).toContain('star-dialog--sheet');
    expect(below.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The browser sends Escape (the cancel event) to the top modal dialog only.
    top.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();
    expect(top.hasAttribute('open')).toBe(false);
    expect(below.hasAttribute('open')).toBe(true);
    let parentDone = false;
    void parent.closed.then(() => (parentDone = true));
    await Promise.resolve();
    expect(parentDone).toBe(false);

    below.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();
    await expect(parent.closed).resolves.toBeUndefined();
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
