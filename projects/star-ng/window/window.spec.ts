import { ApplicationRef, Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarUiText } from '@star-ng/ui/core';
import {
  STAR_WINDOW_DATA,
  StarWindow,
  StarWindowPosition,
  StarWindowRef,
  StarWindowService,
  StarWindowSize,
  StarWindowState,
} from '@star-ng/ui/window';

function key(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function pointer(target: Element, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }),
  );
}

@Component({
  imports: [StarWindow],
  template: `
    <star-window
      [(visible)]="open"
      header="Notes"
      [(position)]="position"
      [(size)]="size"
      [(state)]="state"
      [closeOnEscape]="escape()"
      (closed)="closedCount = closedCount + 1"
      (stateChange)="states.push($event)"
    >
      <p>Body</p>
      <button type="button" class="inner">Inner</button>
    </star-window>
    <star-window [(visible)]="otherOpen" ariaLabel="Other" [position]="{ x: 10, y: 10 }">
      <p>Other body</p>
    </star-window>
  `,
})
class WindowHost {
  readonly open = signal(true);
  readonly otherOpen = signal(false);
  readonly position = signal<StarWindowPosition | null>({ x: 100, y: 100 });
  readonly size = signal<StarWindowSize | null>({ width: 300, height: 200 });
  readonly state = signal<StarWindowState>('normal');
  readonly escape = signal(false);
  readonly states: StarWindowState[] = [];
  closedCount = 0;
}

async function setup() {
  const fixture = TestBed.createComponent(WindowHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const dialogs = () => [...root.querySelectorAll<HTMLDialogElement>('dialog')];
  const dialog = dialogs()[0];
  const titlebar = dialog.querySelector<HTMLElement>('.star-window__titlebar')!;
  const button = (name: string) =>
    [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
      (element) => element.getAttribute('aria-label') === name,
    );
  return { fixture, root, dialogs, dialog, titlebar, button };
}

describe('StarWindow', () => {
  it('is a dialog named by its title, with a focusable title bar and its buttons', async () => {
    const { root, dialog, titlebar, button } = await setup();
    const title = root.querySelector(`#${dialog.getAttribute('aria-labelledby')}`);
    expect(title?.textContent).toBe('Notes');
    expect(title?.tagName).toBe('H2');
    expect(titlebar.tabIndex).toBe(0);
    expect(root.querySelector(`#${titlebar.getAttribute('aria-describedby')}`)?.textContent).toBe(
      'Alt and the arrow keys move the window. Shift and the arrow keys resize it.',
    );
    expect(button('Minimize')).toBeDefined();
    expect(button('Maximize')).toBeDefined();
    expect(button('Close')).toBeDefined();
    expect(button('Restore')).toBeUndefined();
    // Without a header, ariaLabel names the window.
    expect(root.querySelectorAll('dialog')[1].getAttribute('aria-label')).toBe('Other');
  });

  it('places and sizes the window from the position and size models', async () => {
    const { dialog } = await setup();
    expect(dialog.style.left).toBe('100px');
    expect(dialog.style.top).toBe('100px');
    expect(dialog.style.width).toBe('300px');
    expect(dialog.style.height).toBe('200px');
  });

  it('minimizes, maximizes and restores, and emits stateChange', async () => {
    const { fixture, dialog, button } = await setup();
    const content = dialog.querySelector<HTMLElement>('.star-window__content')!;
    button('Minimize')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('minimized');
    expect(content.hidden).toBe(true);
    expect(dialog.classList).toContain('star-window--minimized');
    expect(dialog.style.height).toBe('');
    expect(button('Minimize')).toBeUndefined();

    button('Maximize')!.click();
    await fixture.whenStable();
    expect(dialog.classList).toContain('star-window--maximized');
    expect(dialog.style.left).toBe('');
    expect(content.hidden).toBe(false);

    button('Restore')!.click();
    await fixture.whenStable();
    expect(dialog.style.left).toBe('100px');
    expect(fixture.componentInstance.states).toEqual(['minimized', 'maximized', 'normal']);
  });

  it('moves with Alt and the arrow keys and resizes with Shift and the arrow keys', async () => {
    const { fixture, titlebar } = await setup();
    const host = fixture.componentInstance;
    expect(key(titlebar, 'ArrowRight', { altKey: true }).defaultPrevented).toBe(true);
    key(titlebar, 'ArrowDown', { altKey: true });
    expect(host.position()).toEqual({ x: 116, y: 116 });
    key(titlebar, 'ArrowRight', { shiftKey: true });
    key(titlebar, 'ArrowUp', { shiftKey: true });
    expect(host.size()).toEqual({ width: 316, height: 184 });
    // Plain arrows do nothing.
    expect(key(titlebar, 'ArrowRight').defaultPrevented).toBe(false);
    expect(host.position()).toEqual({ x: 116, y: 116 });
  });

  it('keeps the window in the viewport and above the minimum size', async () => {
    const { fixture, titlebar } = await setup();
    const host = fixture.componentInstance;
    host.position.set({ x: 8, y: 8 });
    await fixture.whenStable();
    key(titlebar, 'ArrowLeft', { altKey: true });
    key(titlebar, 'ArrowUp', { altKey: true });
    expect(host.position()).toEqual({ x: 0, y: 0 });
    for (let i = 0; i < 10; i++) key(titlebar, 'ArrowLeft', { shiftKey: true });
    expect(host.size()?.width).toBe(240);
  });

  it('does not move or resize while it is maximized', async () => {
    const { fixture, titlebar } = await setup();
    fixture.componentInstance.state.set('maximized');
    await fixture.whenStable();
    key(titlebar, 'ArrowRight', { altKey: true });
    expect(fixture.componentInstance.position()).toEqual({ x: 100, y: 100 });
  });

  it('drags with the title bar and resizes with the corner handle', async () => {
    const { fixture, dialog, titlebar } = await setup();
    const host = fixture.componentInstance;
    pointer(titlebar, 'pointerdown', 200, 110);
    pointer(titlebar, 'pointermove', 230, 150);
    pointer(titlebar, 'pointerup', 230, 150);
    pointer(titlebar, 'pointermove', 400, 400);
    expect(host.position()).toEqual({ x: 130, y: 140 });

    const handle = dialog.querySelector('.star-window__resize')!;
    expect(handle.getAttribute('aria-hidden')).toBe('true');
    pointer(handle, 'pointerdown', 430, 340);
    pointer(handle, 'pointermove', 470, 360);
    pointer(handle, 'pointerup', 470, 360);
    expect(host.size()).toEqual({ width: 340, height: 220 });
  });

  it('closes with the close button and emits closed; Escape only with closeOnEscape', async () => {
    const { fixture, dialog, button } = await setup();
    key(dialog.querySelector('p')!, 'Escape');
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(true);

    fixture.componentInstance.escape.set(true);
    await fixture.whenStable();
    key(dialog.querySelector('p')!, 'Escape');
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(fixture.componentInstance.closedCount).toBe(1);

    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    button('Close')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(fixture.componentInstance.closedCount).toBe(2);
  });

  it('brings the focused window to the front', async () => {
    const { fixture, dialogs } = await setup();
    fixture.componentInstance.otherOpen.set(true);
    await fixture.whenStable();
    const [first, second] = dialogs();
    const order = (element: HTMLElement) =>
      Number(element.style.getPropertyValue('--star-window-order'));
    expect(order(second)).toBeGreaterThan(order(first));
    first
      .querySelector<HTMLElement>('.star-window__titlebar')!
      .dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await fixture.whenStable();
    expect(order(first)).toBeGreaterThan(order(second));
  });

  it('keeps the stacking order small and below the CDK overlay container', async () => {
    const { fixture, dialogs } = await setup();
    fixture.componentInstance.otherOpen.set(true);
    await fixture.whenStable();
    const [first, second] = dialogs();
    const order = (element: HTMLElement) =>
      Number(element.style.getPropertyValue('--star-window-order'));
    // Many focus changes: the orders are renumbered 1..n, not counted up.
    for (let i = 0; i < 50; i++) {
      for (const dialog of [first, second]) {
        dialog.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      }
    }
    await fixture.whenStable();
    expect([order(first), order(second)].sort()).toEqual([1, 2]);
    expect(order(second)).toBe(2);
    // Closing a window takes it out of the stack.
    fixture.componentInstance.otherOpen.set(false);
    await fixture.whenStable();
    first.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await fixture.whenStable();
    expect(order(first)).toBe(1);
  });

  it('keeps the focus in the window when a title bar button is used with the keyboard', async () => {
    const { fixture, dialog, button } = await setup();
    // jsdom has no show(): mark the dialog open so its content can take the focus.
    dialog.setAttribute('open', '');
    const minimize = button('Minimize')!;
    minimize.focus();
    minimize.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('minimized');
    // The same button is now "Restore" and keeps the focus.
    expect(document.activeElement).toBe(minimize);
    expect(minimize.getAttribute('aria-label')).toBe('Restore');
    minimize.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('normal');
    expect(document.activeElement).toBe(minimize);

    const maximize = button('Maximize')!;
    maximize.focus();
    maximize.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('maximized');
    expect(document.activeElement).toBe(maximize);
    expect(maximize.getAttribute('aria-label')).toBe('Restore');
    maximize.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('normal');
    expect(document.activeElement).toBe(maximize);
  });

  it('moves the focus to the title bar when minimizing hides the focused content', async () => {
    const { fixture, dialog, titlebar } = await setup();
    dialog.setAttribute('open', '');
    dialog.querySelector<HTMLButtonElement>('.inner')!.focus();
    fixture.componentInstance.state.set('minimized');
    await fixture.whenStable();
    expect(document.activeElement).toBe(titlebar);
  });

  it('ignores an Escape that another handler already used', async () => {
    const { fixture, dialog } = await setup();
    fixture.componentInstance.escape.set(true);
    await fixture.whenStable();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    event.preventDefault();
    dialog.querySelector('p')!.dispatchEvent(event);
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(true);
  });

  it('reads its texts from STAR_UI_TEXT', async () => {
    TestBed.configureTestingModule({
      providers: [provideStarUiText({ minimize: 'Minimieren', windowHint: 'Hinweis' })],
    });
    const { root, titlebar, button } = await setup();
    expect(button('Minimieren')).toBeDefined();
    expect(root.querySelector(`#${titlebar.getAttribute('aria-describedby')}`)?.textContent).toBe(
      'Hinweis',
    );
  });
});

@Component({ template: `<p class="opened">{{ data.name }}</p>` })
class NotesContent {
  readonly data = inject<{ name: string }>(STAR_WINDOW_DATA);
  readonly ref = inject(StarWindowRef<string>);
}

describe('StarWindowService', () => {
  it('opens a component in a window and resolves the result on close', async () => {
    const service = TestBed.inject(StarWindowService);
    const ref = service.open<NotesContent, { name: string }, string>(NotesContent, {
      header: 'Order notes',
      data: { name: 'Order 1001' },
    });
    await TestBed.inject(ApplicationRef).whenStable();
    const dialog = document.body.querySelector<HTMLDialogElement>('star-window-container dialog')!;
    expect(dialog.querySelector('.opened')?.textContent).toBe('Order 1001');
    expect(dialog.querySelector('h2')?.textContent).toBe('Order notes');
    ref.close('saved');
    await TestBed.inject(ApplicationRef).whenStable();
    expect(await ref.closed).toBe('saved');
    expect(document.body.querySelector('star-window-container')).toBeNull();
  });
});
