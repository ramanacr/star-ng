import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  StarDialog,
  StarDialogDimensions,
  StarDialogPoint,
  StarDialogPosition,
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

/** jsdom has no layout: every dialog measures as this box (window 1024 x 768). */
const BOX = { left: 100, top: 50, width: 300, height: 200 };

function pointer(type: string, target: EventTarget, x: number, y: number): void {
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
  );
}

function key(target: Element, name: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
  );
}

@Component({
  imports: [StarDialog],
  template: `
    <star-dialog
      [(visible)]="open"
      header="Move order"
      [draggable]="draggable()"
      [keepInViewport]="keep()"
      [rememberPosition]="remember()"
      (dragEnd)="drags.push($event)"
    >
      <p>Body</p>
    </star-dialog>
  `,
})
class DragHost {
  readonly open = signal(true);
  readonly draggable = signal(true);
  readonly keep = signal(true);
  readonly remember = signal(false);
  readonly drags: StarDialogPoint[] = [];
}

async function setup(): Promise<{
  fixture: ComponentFixture<DragHost>;
  dialog: HTMLDialogElement;
}> {
  const fixture = TestBed.createComponent(DragHost);
  await fixture.whenStable();
  const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
  dialog.getBoundingClientRect = () => DOMRect.fromRect({ x: BOX.left, y: BOX.top, ...BOX });
  return { fixture, dialog };
}

describe('StarDialog draggable', () => {
  it('moves with a pointer drag on the header and reports the position', async () => {
    const { fixture, dialog } = await setup();
    const header = dialog.querySelector('header')!;
    pointer('pointerdown', header, 10, 10);
    pointer('pointermove', window, 40, 30);
    pointer('pointerup', window, 40, 30);
    await fixture.whenStable();
    expect(dialog.style.left).toBe('130px');
    expect(dialog.style.top).toBe('70px');
    expect(dialog.classList).toContain('star-dialog--placed');
    expect(fixture.componentInstance.drags).toEqual([{ x: 130, y: 70 }]);

    // Released: later moves do nothing.
    pointer('pointermove', window, 400, 400);
    await fixture.whenStable();
    expect(dialog.style.left).toBe('130px');
  });

  it('does not start a drag on the close button', async () => {
    const { fixture, dialog } = await setup();
    const close = dialog.querySelector<HTMLButtonElement>('[aria-label=Close]')!;
    pointer('pointerdown', close, 10, 10);
    pointer('pointermove', window, 60, 60);
    pointer('pointerup', window, 60, 60);
    await fixture.whenStable();
    expect(dialog.style.left).toBe('');
    expect(fixture.componentInstance.drags).toEqual([]);
  });

  it('keeps the dialog inside the window with keepInViewport, and lets it out without', async () => {
    const { fixture, dialog } = await setup();
    const header = dialog.querySelector('header')!;
    pointer('pointerdown', header, 10, 10);
    pointer('pointermove', window, -500, 2000);
    pointer('pointerup', window, -500, 2000);
    await fixture.whenStable();
    expect(dialog.style.left).toBe('0px');
    expect(dialog.style.top).toBe(`${window.innerHeight - BOX.height}px`);

    fixture.componentInstance.keep.set(false);
    await fixture.whenStable();
    pointer('pointerdown', header, 0, 0);
    pointer('pointermove', window, -50, 0);
    pointer('pointerup', window, -50, 0);
    await fixture.whenStable();
    expect(dialog.style.left).toBe('-50px');
  });

  it('moves by 10 pixels with Alt and the arrow keys on the named move button', async () => {
    const { fixture, dialog } = await setup();
    const move = dialog.querySelector<HTMLButtonElement>('[aria-label="Move dialog"]')!;
    expect(move.getAttribute('aria-keyshortcuts')).toContain('Alt+ArrowLeft');
    key(move, 'ArrowRight', { altKey: true });
    key(move, 'ArrowRight', { altKey: true });
    key(move, 'ArrowUp', { altKey: true });
    await fixture.whenStable();
    expect(dialog.style.left).toBe('120px');
    expect(dialog.style.top).toBe('40px');
    expect(fixture.componentInstance.drags.at(-1)).toEqual({ x: 120, y: 40 });

    // An arrow key without Alt does nothing.
    key(move, 'ArrowRight');
    await fixture.whenStable();
    expect(dialog.style.left).toBe('120px');
  });

  it('resets the position on reopen unless rememberPosition is set', async () => {
    const { fixture, dialog } = await setup();
    const move = () =>
      key(dialog.querySelector('.star-dialog__move')!, 'ArrowDown', { altKey: true });
    const reopen = async () => {
      fixture.componentInstance.open.set(false);
      await fixture.whenStable();
      fixture.componentInstance.open.set(true);
      await fixture.whenStable();
    };
    move();
    await fixture.whenStable();
    expect(dialog.style.top).toBe('60px');
    await reopen();
    expect(dialog.style.top).toBe('');
    expect(dialog.classList).not.toContain('star-dialog--placed');

    fixture.componentInstance.remember.set(true);
    move();
    await fixture.whenStable();
    await reopen();
    expect(dialog.style.top).toBe('60px');
  });

  it('has no move button and ignores a drag when draggable is off', async () => {
    const { fixture, dialog } = await setup();
    fixture.componentInstance.draggable.set(false);
    await fixture.whenStable();
    expect(dialog.querySelector('.star-dialog__move')).toBeNull();
    pointer('pointerdown', dialog.querySelector('header')!, 0, 0);
    pointer('pointermove', window, 30, 30);
    pointer('pointerup', window, 30, 30);
    key(dialog.querySelector('header')!, 'ArrowRight', { altKey: true });
    await fixture.whenStable();
    expect(dialog.style.left).toBe('');
  });
});

@Component({
  imports: [StarDialog],
  template: `
    <star-dialog
      [(visible)]="open"
      header="Resize order"
      resizable
      (resizeEnd)="sizes.push($event)"
    >
      <p>Body</p>
    </star-dialog>
  `,
})
class ResizeHost {
  readonly open = signal(true);
  readonly sizes: StarDialogDimensions[] = [];
}

async function setupResize(): Promise<{
  fixture: ComponentFixture<ResizeHost>;
  dialog: HTMLDialogElement;
  handle: HTMLButtonElement;
}> {
  const fixture = TestBed.createComponent(ResizeHost);
  await fixture.whenStable();
  const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
  dialog.getBoundingClientRect = () => DOMRect.fromRect({ x: BOX.left, y: BOX.top, ...BOX });
  const handle = dialog.querySelector<HTMLButtonElement>('[aria-label="Resize dialog"]')!;
  return { fixture, dialog, handle };
}

describe('StarDialog resizable', () => {
  it('resizes with a pointer drag on the corner handle and keeps the top left corner', async () => {
    const { fixture, dialog, handle } = await setupResize();
    expect(handle.tagName).toBe('BUTTON');
    pointer('pointerdown', handle, 400, 250);
    pointer('pointermove', window, 450, 290);
    pointer('pointerup', window, 450, 290);
    await fixture.whenStable();
    expect(dialog.style.width).toBe('350px');
    expect(dialog.style.height).toBe('240px');
    expect(dialog.style.left).toBe('100px');
    expect(dialog.style.top).toBe('50px');
    expect(dialog.classList).toContain('star-dialog--resized');
    expect(fixture.componentInstance.sizes).toEqual([{ width: 350, height: 240 }]);
  });

  it('stops at the minimum size and at the window edge', async () => {
    const { fixture, dialog, handle } = await setupResize();
    pointer('pointerdown', handle, 400, 250);
    pointer('pointermove', window, 0, 0);
    pointer('pointerup', window, 0, 0);
    await fixture.whenStable();
    expect(dialog.style.width).toBe('240px');
    expect(dialog.style.height).toBe('160px');

    pointer('pointerdown', handle, 0, 0);
    pointer('pointermove', window, 5000, 5000);
    pointer('pointerup', window, 5000, 5000);
    await fixture.whenStable();
    expect(dialog.style.width).toBe(`${window.innerWidth - BOX.left}px`);
    expect(dialog.style.height).toBe(`${window.innerHeight - BOX.top}px`);
  });

  it('resizes by 10 pixels with Shift and the arrow keys on the handle', async () => {
    const { fixture, dialog, handle } = await setupResize();
    expect(handle.getAttribute('aria-keyshortcuts')).toContain('Shift+ArrowRight');
    key(handle, 'ArrowRight', { shiftKey: true });
    key(handle, 'ArrowDown', { shiftKey: true });
    key(handle, 'ArrowDown', { shiftKey: true });
    await fixture.whenStable();
    expect(dialog.style.width).toBe('310px');
    expect(dialog.style.height).toBe('220px');
    expect(fixture.componentInstance.sizes.at(-1)).toEqual({ width: 310, height: 220 });

    key(handle, 'ArrowLeft');
    await fixture.whenStable();
    expect(dialog.style.width).toBe('310px');
  });

  it('grows towards the left in right-to-left and keeps the right edge', async () => {
    const { fixture, dialog, handle } = await setupResize();
    dialog.style.direction = 'rtl';
    key(handle, 'ArrowLeft', { shiftKey: true });
    await fixture.whenStable();
    expect(dialog.style.width).toBe('310px');
    expect(dialog.style.left).toBe('90px');
  });

  it('resets the size on reopen', async () => {
    const { fixture, dialog, handle } = await setupResize();
    key(handle, 'ArrowRight', { shiftKey: true });
    await fixture.whenStable();
    fixture.componentInstance.open.set(false);
    await fixture.whenStable();
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(dialog.style.width).toBe('');
    expect(dialog.style.height).toBe('');
  });
});

@Component({
  imports: [StarDialog],
  template: `
    <star-dialog
      [(visible)]="open"
      [(maximized)]="max"
      header="Order lines"
      maximizable
      draggable
      resizable
      width="30rem"
      (maximize)="events.push('maximize')"
      (restore)="events.push('restore')"
    >
      <p>Body</p>
    </star-dialog>
  `,
})
class MaximizeHost {
  readonly open = signal(true);
  readonly max = signal(false);
  readonly events: string[] = [];
}

describe('StarDialog maximizable', () => {
  it('toggles the full window with the header button and reports both changes', async () => {
    const fixture = TestBed.createComponent(MaximizeHost);
    await fixture.whenStable();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    const button = dialog.querySelector<HTMLButtonElement>('.star-dialog__maximize')!;
    expect(button.getAttribute('aria-label')).toBe('Maximize');
    expect(dialog.style.width).toBe('30rem');

    button.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.max()).toBe(true);
    expect(dialog.classList).toContain('star-dialog--maximized');
    expect(button.getAttribute('aria-label')).toBe('Restore');
    // The fixed width, the move button and the resize handle do not apply while maximized.
    expect(dialog.style.width).toBe('');
    expect(dialog.querySelector('.star-dialog__move')).toBeNull();
    expect(dialog.querySelector('.star-dialog__resize')).toBeNull();

    button.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.max()).toBe(false);
    expect(dialog.classList).not.toContain('star-dialog--maximized');
    expect(dialog.style.width).toBe('30rem');
    expect(fixture.componentInstance.events).toEqual(['maximize', 'restore']);
  });

  it('follows the maximized model, and Escape still closes a maximized dialog', async () => {
    const fixture = TestBed.createComponent(MaximizeHost);
    fixture.componentInstance.max.set(true);
    await fixture.whenStable();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    expect(dialog.classList).toContain('star-dialog--maximized');
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });
});

@Component({
  imports: [StarDialog],
  template: `<star-dialog [(visible)]="open" header="Placed" [position]="position()" />`,
})
class PositionHost {
  readonly open = signal(true);
  readonly position = signal<StarDialogPosition>('center');
}

describe('StarDialog position', () => {
  it('sets one logical position class, center by default', async () => {
    const fixture = TestBed.createComponent(PositionHost);
    await fixture.whenStable();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    const positions = () => [...dialog.classList].filter((name) => name.includes('--at-'));
    expect(positions()).toEqual(['star-dialog--at-center']);
    expect(dialog.classList).toContain('star-dialog--md');

    for (const position of ['top', 'bottom-end', 'start'] as const) {
      fixture.componentInstance.position.set(position);
      await fixture.whenStable();
      expect(positions()).toEqual([`star-dialog--at-${position}`]);
    }
    expect(dialog.classList).toContain('star-dialog');
  });
});

@Component({
  imports: [StarDialog],
  template: `
    <star-dialog
      [(visible)]="open"
      header="Scroll and focus"
      width="40rem"
      [modal]="modal()"
      [blockScroll]="block()"
      [focusOnShow]="focus()"
      [breakpoints]="breakpoints"
    >
      <button type="button" data-autofocus>First</button>
    </star-dialog>
  `,
})
class OptionsHost {
  readonly open = signal(false);
  readonly modal = signal(true);
  readonly block = signal<boolean | undefined>(undefined);
  readonly focus = signal(true);
  readonly breakpoints = { '960px': '75vw', '640px': '100vw' };
}

describe('StarDialog blockScroll, focusOnShow and breakpoints', () => {
  const resize = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    window.dispatchEvent(new Event('resize'));
  };
  const initialWidth = window.innerWidth;
  afterEach(() => resize(initialWidth));

  it('blocks page scroll by default for a modal only, and blockScroll overrides it', async () => {
    const fixture = TestBed.createComponent(OptionsHost);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    expect(dialog.classList).toContain('star-dialog--block-scroll');

    fixture.componentInstance.modal.set(false);
    await fixture.whenStable();
    expect(dialog.classList).not.toContain('star-dialog--block-scroll');

    fixture.componentInstance.block.set(true);
    await fixture.whenStable();
    expect(dialog.classList).toContain('star-dialog--block-scroll');

    fixture.componentInstance.modal.set(true);
    fixture.componentInstance.block.set(false);
    await fixture.whenStable();
    expect(dialog.classList).not.toContain('star-dialog--block-scroll');
  });

  it('focuses the marked element by default, and the dialog box without focusOnShow', async () => {
    const fixture = TestBed.createComponent(OptionsHost);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    document.body.appendChild(fixture.nativeElement);
    expect(dialog.hasAttribute('tabindex')).toBe(false);

    fixture.componentInstance.open.set(false);
    fixture.componentInstance.focus.set(false);
    await fixture.whenStable();
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(dialog.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(dialog);

    fixture.componentInstance.open.set(false);
    fixture.componentInstance.focus.set(true);
    await fixture.whenStable();
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(document.activeElement?.textContent).toBe('First');
    fixture.nativeElement.remove();
  });

  it('takes the width of the matching breakpoint over the width input', async () => {
    resize(1200);
    const fixture = TestBed.createComponent(OptionsHost);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    expect(dialog.style.width).toBe('40rem');
    resize(800);
    await fixture.whenStable();
    expect(dialog.style.width).toBe('75vw');
    resize(400);
    await fixture.whenStable();
    expect(dialog.style.width).toBe('100vw');
  });
});

@Component({
  imports: [StarDialog],
  template: `
    <star-dialog [(visible)]="open" headless ariaLabelledby="own-title" header="Ignored">
      <h2 id="own-title">Shipping label</h2>
      <button type="button" (click)="open.set(false)">Done</button>
      <span starDialogHeader>Header slot</span>
      <div starDialogFooter class="footer">Footer slot</div>
    </star-dialog>
    <star-dialog [visible]="true" header="Hidden title" [showHeader]="false" />
  `,
})
class HeadlessHost {
  readonly open = signal(true);
}

describe('StarDialog headless', () => {
  it('renders only the content and the footer slot, named by the given id', async () => {
    const fixture = TestBed.createComponent(HeadlessHost);
    await fixture.whenStable();
    const [dialog, hidden] = (fixture.nativeElement as HTMLElement).querySelectorAll('dialog');
    expect(dialog.classList).toContain('star-dialog--headless');
    expect(dialog.querySelector('header')).toBeNull();
    expect(dialog.querySelector('[aria-label=Close]')).toBeNull();
    expect(dialog.textContent).not.toContain('Header slot');
    expect(dialog.querySelector('.footer')?.textContent).toBe('Footer slot');
    expect(dialog.getAttribute('aria-labelledby')).toBe('own-title');
    expect(dialog.hasAttribute('aria-label')).toBe(false);

    dialog.querySelector('button')!.click();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);

    // A header that is not shown still names the dialog.
    expect(hidden.getAttribute('aria-label')).toBe('Hidden title');
    expect(hidden.hasAttribute('aria-labelledby')).toBe(false);
  });
});

describe('StarDialog pointer tracking ends with the dialog', () => {
  it('a close in the middle of a drag stops the drag: no dragEnd, no position on reopen', async () => {
    const { fixture, dialog } = await setup();
    pointer('pointerdown', dialog.querySelector('header')!, 10, 10);
    pointer('pointermove', window, 40, 30);
    fixture.componentInstance.open.set(false);
    await fixture.whenStable();
    pointer('pointermove', window, 80, 80);
    pointer('pointerup', window, 80, 80);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(fixture.componentInstance.drags).toEqual([]);
    expect(dialog.style.left).toBe('');
    expect(dialog.classList).not.toContain('star-dialog--placed');
  });

  it('a close in the middle of a resize stops the resize: no resizeEnd, no size on reopen', async () => {
    const { fixture, dialog, handle } = await setupResize();
    pointer('pointerdown', handle, 400, 250);
    pointer('pointermove', window, 450, 290);
    fixture.componentInstance.open.set(false);
    await fixture.whenStable();
    pointer('pointermove', window, 500, 300);
    pointer('pointerup', window, 500, 300);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(fixture.componentInstance.sizes).toEqual([]);
    expect(dialog.style.width).toBe('');
    expect(dialog.style.height).toBe('');
  });

  it('a destroy in the middle of a drag removes the window listeners', async () => {
    const { fixture, dialog } = await setup();
    const removed = vi.spyOn(window, 'removeEventListener');
    pointer('pointerdown', dialog.querySelector('header')!, 10, 10);
    fixture.destroy();
    const types = removed.mock.calls.map(([type]) => type);
    expect(types).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']));
    pointer('pointermove', window, 40, 30);
    pointer('pointerup', window, 40, 30);
    expect(fixture.componentInstance.drags).toEqual([]);
    removed.mockRestore();
  });

  it('ignores the moves of another pointer', async () => {
    const { fixture, dialog } = await setup();
    const header = dialog.querySelector('header')!;
    const event = (type: string, target: EventTarget, x: number, pointerId: number) => {
      const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 0 });
      Object.defineProperty(e, 'pointerId', { value: pointerId });
      target.dispatchEvent(e);
    };
    event('pointerdown', header, 0, 1);
    event('pointermove', window, 50, 2);
    event('pointerup', window, 50, 2);
    await fixture.whenStable();
    expect(dialog.style.left).toBe('');
    event('pointermove', window, 20, 1);
    event('pointerup', window, 20, 1);
    await fixture.whenStable();
    expect(dialog.style.left).toBe('120px');
  });
});

describe('StarDialog viewport without the scrollbar', () => {
  const root = document.documentElement;
  const setClient = (width: number, height: number) => {
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: width });
    Object.defineProperty(root, 'clientHeight', { configurable: true, value: height });
  };
  afterEach(() => {
    delete (root as unknown as Record<string, unknown>)['clientWidth'];
    delete (root as unknown as Record<string, unknown>)['clientHeight'];
  });

  it('clamps a drag to the client area of the page, not the window with its scrollbar', async () => {
    setClient(900, 700);
    const { fixture, dialog } = await setup();
    pointer('pointerdown', dialog.querySelector('header')!, 0, 0);
    pointer('pointermove', window, 5000, 5000);
    pointer('pointerup', window, 5000, 5000);
    await fixture.whenStable();
    expect(dialog.style.left).toBe('600px');
    expect(dialog.style.top).toBe('500px');
  });

  it('pulls a remembered position and size back into a smaller window on reopen', async () => {
    setClient(1000, 700);
    const { fixture, dialog } = await setup();
    fixture.componentInstance.remember.set(true);
    pointer('pointerdown', dialog.querySelector('header')!, 0, 0);
    pointer('pointermove', window, 600, 400);
    pointer('pointerup', window, 600, 400);
    await fixture.whenStable();
    expect(dialog.style.left).toBe('700px');
    expect(dialog.style.top).toBe('450px');

    fixture.componentInstance.open.set(false);
    await fixture.whenStable();
    setClient(800, 500);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(dialog.style.left).toBe('500px');
    expect(dialog.style.top).toBe('300px');
  });
});
