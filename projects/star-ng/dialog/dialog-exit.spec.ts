import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  STAR_BOTTOM_SHEET_DATA,
  StarBottomSheet,
  StarBottomSheetRef,
} from '@star-ng/ui/bottom-sheet';
import { ɵstarOverrideDialogExit } from '@star-ng/ui/core';
import { StarDialog, StarDialogRef, StarDialogService } from '@star-ng/ui/dialog';
import { StarWindow, StarWindowRef, StarWindowService } from '@star-ng/ui/window';

// The exit of the native dialogs in a browser without CSS `overlay` (Firefox, WebKit): the motion
// runs on the open dialog, then close() follows. The specs share one window with other files
// (an earlier spec may leave `data-star-motion`, a `matchMedia` stub or its own dialog stubs),
// so each test sets the overlay answer, the motion setting, the dialog stand-ins and the
// animations itself, and puts back what was there after it.
const view = document.defaultView!;
const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const STUBBED = ['showModal', 'show', 'close', 'getAnimations'] as const;
let saved: Record<string, PropertyDescriptor | undefined> = {};
let realMatchMedia = view.matchMedia;

/** The exit motion of every dialog in the test: one running animation of the dialog itself. */
let motion: { finished: Promise<void> } | null = null;
function startMotion(): () => void {
  let end!: () => void;
  motion = { finished: new Promise<void>((resolve) => (end = resolve)) };
  return end;
}

beforeEach(() => {
  ɵstarOverrideDialogExit(false);
  document.documentElement.removeAttribute('data-star-motion');
  realMatchMedia = view.matchMedia;
  view.matchMedia = ((query: string) =>
    ({ matches: false, media: query }) as MediaQueryList) as typeof view.matchMedia;
  saved = Object.fromEntries(
    STUBBED.map((name) => [name, Object.getOwnPropertyDescriptor(dialogProto, name)]),
  );
  dialogProto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto['show'] = dialogProto['showModal'];
  dialogProto['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  dialogProto['getAnimations'] = function (this: HTMLDialogElement) {
    if (!motion || !this.hasAttribute('data-star-closing')) return [];
    const effect = { getComputedTiming: () => ({ iterations: 1 }), target: this };
    return [{ finished: motion.finished, effect }];
  };
  motion = null;
});

afterEach(() => {
  ɵstarOverrideDialogExit(null);
  view.matchMedia = realMatchMedia;
  // Put back the prototype as it was: a property that was not there is deleted, not undefined.
  for (const name of STUBBED) {
    const descriptor = saved[name];
    if (descriptor) Object.defineProperty(dialogProto, name, descriptor);
    else delete dialogProto[name];
  }
});

const turn = () => new Promise((resolve) => setTimeout(resolve));

// ---------------------------------------------------------------- dialog

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
class DialogHost {
  readonly open = signal(true);
  readonly events: string[] = [];
}

async function dialogSetup() {
  const fixture = TestBed.createComponent(DialogHost);
  await fixture.whenStable();
  const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
  return { fixture, host: fixture.componentInstance, dialog };
}

describe('StarDialog exit without CSS overlay', () => {
  it('runs the exit on the open dialog, then closes and emits hidden once', async () => {
    const { fixture, host, dialog } = await dialogSetup();
    expect(host.events).toEqual(['shown']);
    const end = startMotion();

    host.open.set(false);
    await fixture.whenStable();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.hasAttribute('data-star-closing')).toBe(true);
    expect(host.events).toEqual(['shown']);

    end();
    await turn();
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(dialog.hasAttribute('data-star-closing')).toBe(false);
    expect(host.events).toEqual(['shown', 'hidden']);
  });

  it('waits only for the motion of the dialog itself, not of its content', async () => {
    const { fixture, host, dialog } = await dialogSetup();
    // A finite animation of the content only: the modal must not stay on the page for it.
    dialogProto['getAnimations'] = function (this: HTMLDialogElement) {
      const effect = {
        getComputedTiming: () => ({ iterations: 1 }),
        target: this.querySelector('p'),
      };
      return [{ finished: new Promise<void>(() => undefined), effect }];
    };
    host.open.set(false);
    await fixture.whenStable();
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(host.events).toEqual(['shown', 'hidden']);
  });

  it('a re-open during the exit ends it at once: hidden, then shown', async () => {
    const { fixture, host, dialog } = await dialogSetup();
    startMotion();
    host.open.set(false);
    await fixture.whenStable();
    expect(dialog.hasAttribute('data-star-closing')).toBe(true);

    host.open.set(true);
    await fixture.whenStable();
    expect(host.events).toEqual(['shown', 'hidden', 'shown']);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.hasAttribute('data-star-closing')).toBe(false);
  });

  it('Escape during the exit changes nothing: one hidden after the motion', async () => {
    const { fixture, host, dialog } = await dialogSetup();
    const end = startMotion();
    host.open.set(false);
    await fixture.whenStable();
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    await fixture.whenStable();
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.hasAttribute('data-star-closing')).toBe(true);
    expect(host.events).toEqual(['shown']);

    end();
    await turn();
    expect(host.events).toEqual(['shown', 'hidden']);
  });

  it('a destroy during the exit emits nothing more and clears the fallback timer', async () => {
    const { fixture, host } = await dialogSetup();
    const end = startMotion();
    const setTimer = vi.spyOn(globalThis, 'setTimeout');
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout');
    try {
      host.open.set(false);
      await fixture.whenStable();
      // The 4 s fallback of the wait for the exit motion.
      const index = setTimer.mock.calls.findIndex((call) => call[1] === 4000);
      expect(index).toBeGreaterThanOrEqual(0);
      const timer = setTimer.mock.results[index].value;
      fixture.destroy();
      expect(clearTimer).toHaveBeenCalledWith(timer);
    } finally {
      setTimer.mockRestore();
      clearTimer.mockRestore();
    }
    end();
    await turn();
    expect(host.events).toEqual(['shown']);
  });

  it('with CSS overlay, a late close event of an earlier close does not close a re-opened dialog', async () => {
    ɵstarOverrideDialogExit(true);
    const { fixture, host, dialog } = await dialogSetup();
    // The browser queues the close event; here it arrives after the dialog opened again.
    let late: Event | null = null;
    dialogProto['close'] = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      late = new Event('close');
    };
    host.open.set(false);
    await fixture.whenStable();
    host.open.set(true);
    await fixture.whenStable();
    expect(dialog.hasAttribute('open')).toBe(true);

    dialog.dispatchEvent(late!);
    await fixture.whenStable();
    expect(host.open()).toBe(true);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(host.events).toEqual(['shown', 'hidden', 'shown']);
  });
});

// ---------------------------------------------------------------- window

@Component({
  imports: [StarWindow],
  template: `
    <star-window
      [(visible)]="open"
      header="Notes"
      [position]="{ x: 10, y: 10 }"
      (closed)="events.push('closed')"
    >
      <p>Body</p>
    </star-window>
  `,
})
class WindowHost {
  readonly open = signal(true);
  readonly events: string[] = [];
}

async function windowSetup() {
  const fixture = TestBed.createComponent(WindowHost);
  await fixture.whenStable();
  const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
  return { fixture, host: fixture.componentInstance, dialog };
}

describe('StarWindow exit without CSS overlay', () => {
  it('runs the exit on the open window, then closes and emits closed once', async () => {
    const { fixture, host, dialog } = await windowSetup();
    const end = startMotion();
    host.open.set(false);
    await fixture.whenStable();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.hasAttribute('data-star-closing')).toBe(true);
    expect(host.events).toEqual([]);

    end();
    await turn();
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(host.events).toEqual(['closed']);
  });

  it('a re-open during the exit ends it at once: closed, then open again', async () => {
    const { fixture, host, dialog } = await windowSetup();
    startMotion();
    host.open.set(false);
    await fixture.whenStable();
    host.open.set(true);
    await fixture.whenStable();
    expect(host.events).toEqual(['closed']);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.hasAttribute('data-star-closing')).toBe(false);
  });

  it('a destroy during the exit emits no closed', async () => {
    const { fixture, host } = await windowSetup();
    const end = startMotion();
    host.open.set(false);
    await fixture.whenStable();
    fixture.destroy();
    end();
    await turn();
    expect(host.events).toEqual([]);
  });
});

// ---------------------------------------------------------------- bottom sheet

@Component({
  template: `<button id="ok" type="button" (click)="ref.dismiss(data)">OK</button>`,
})
class SheetContent {
  readonly data = inject<string>(STAR_BOTTOM_SHEET_DATA);
  readonly ref = inject<StarBottomSheetRef<string>>(StarBottomSheetRef);
}

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    TestBed.tick();
    await turn();
  }
};
const sheet = () => document.querySelector<HTMLDialogElement>('dialog.star-bottom-sheet');

describe('StarBottomSheet exit without CSS overlay', () => {
  afterEach(() =>
    document.querySelectorAll('star-bottom-sheet-container').forEach((node) => node.remove()),
  );

  it('a second dismiss during the exit changes nothing: one result after the motion', async () => {
    const service = TestBed.inject(StarBottomSheet);
    const ref = service.open<SheetContent, string, string>(SheetContent, { data: 'pdf' });
    await settle();
    const end = startMotion();
    let results = 0;
    void ref.afterDismissed().then(() => results++);

    ref.dismiss('pdf');
    ref.dismiss('csv');
    await settle();
    expect(sheet()!.hasAttribute('open')).toBe(true);
    expect(sheet()!.hasAttribute('data-star-closing')).toBe(true);
    expect(results).toBe(0);

    end();
    await settle();
    expect(results).toBe(1);
    await expect(ref.afterDismissed()).resolves.toBe('pdf');
    expect(document.querySelector('star-bottom-sheet-container')).toBeNull();
  });

  it('a destroy during the exit still gives the result', async () => {
    const service = TestBed.inject(StarBottomSheet);
    const ref = service.open<SheetContent, string, string>(SheetContent, { data: 'pdf' });
    await settle();
    const end = startMotion();
    ref.dismiss('pdf');
    await settle();
    expect(sheet()!.hasAttribute('data-star-closing')).toBe(true);

    // The application goes away during the exit: no hidden runs, the result still settles.
    TestBed.resetTestingModule();
    end();
    await turn();
    await expect(ref.afterDismissed()).resolves.toBe('pdf');
  });
});

// ------------------------------------------- first close wins (service refs)

@Component({ template: `<p>Content</p>` })
class ServiceContent {}

describe('service refs: the first close wins in every browser', () => {
  afterEach(() =>
    document
      .querySelectorAll('star-dialog-container, star-window-container')
      .forEach((node) => node.remove()),
  );

  it('dialog: Escape, then close("saved") during the exit gives undefined', async () => {
    const ref: StarDialogRef<string> = TestBed.inject(StarDialogService).open(ServiceContent);
    await settle();
    const dialog = document.querySelector<HTMLDialogElement>('star-dialog-container dialog')!;
    const end = startMotion();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();
    expect(dialog.hasAttribute('data-star-closing')).toBe(true);
    ref.close('saved');
    end();
    await settle();
    await expect(ref.closed).resolves.toBeUndefined();
  });

  it('window: Escape, then close("saved") during the exit gives undefined', async () => {
    const ref: StarWindowRef<string> = TestBed.inject(StarWindowService).open(ServiceContent, {
      closeOnEscape: true,
    });
    await settle();
    const dialog = document.querySelector<HTMLDialogElement>('star-window-container dialog')!;
    const end = startMotion();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();
    expect(dialog.hasAttribute('data-star-closing')).toBe(true);
    ref.close('saved');
    end();
    await settle();
    await expect(ref.closed).resolves.toBeUndefined();
  });
});
