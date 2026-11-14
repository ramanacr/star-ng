import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarConfirmHost, StarConfirmService, StarDialog } from 'star-ng/dialog';
import { StarDrawer } from 'star-ng/drawer';
import { StarToast, StarToastService } from 'star-ng/toast';

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
    <star-dialog [(visible)]="open" header="Edit" dismissableMask>
      <p>Body</p>
    </star-dialog>
  `,
})
class DialogHost {
  readonly open = signal(false);
}

describe('StarDialog', () => {
  it('opens and closes the native dialog from the visible model', async () => {
    const fixture = TestBed.createComponent(DialogHost);
    await fixture.whenStable();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    expect(dialog.open).toBe(false);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe(dialog.querySelector('h2')!.id);

    dialog.querySelector<HTMLButtonElement>('[aria-label=Close]')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(dialog.open).toBe(false);
  });

  it('closes on Escape (cancel) and on a backdrop click', async () => {
    const fixture = TestBed.createComponent(DialogHost);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);

    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });
});

describe('StarConfirmService', () => {
  it('resolves true on accept and false on reject, in queue order', async () => {
    const fixture = TestBed.createComponent(StarConfirmHost);
    const service = TestBed.inject(StarConfirmService);
    const first = service.ask({
      header: 'Delete?',
      message: 'Gone for good.',
      acceptLabel: 'Delete',
    });
    const second = service.ask({ header: 'Archive?', message: 'Moves to archive.' });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('dialog')!.open).toBe(true);
    expect(el.textContent).toContain('Gone for good.');

    const button = (label: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;
    button('Delete').click();
    await expect(first).resolves.toBe(true);
    await fixture.whenStable();
    expect(el.textContent).toContain('Moves to archive.');
    button('Cancel').click();
    await expect(second).resolves.toBe(false);
  });
});

describe('StarToastService', () => {
  afterEach(() => vi.useRealTimers());

  it('adds, de-duplicates and auto-removes messages', () => {
    vi.useFakeTimers();
    const toasts = TestBed.inject(StarToastService);
    toasts.success('Saved');
    toasts.success('Saved');
    toasts.show({ summary: 'Pinned', sticky: true });
    expect(toasts.messages().map((m) => m.summary)).toEqual(['Saved', 'Pinned']);
    vi.advanceTimersByTime(5001);
    expect(toasts.messages().map((m) => m.summary)).toEqual(['Pinned']);
  });

  it('pauses the timer while hovered', () => {
    vi.useFakeTimers();
    const toasts = TestBed.inject(StarToastService);
    const id = toasts.info('Hold');
    vi.advanceTimersByTime(3000);
    toasts.pause(id);
    vi.advanceTimersByTime(10000);
    expect(toasts.messages().length).toBe(1);
    toasts.resume(id);
    vi.advanceTimersByTime(2001);
    expect(toasts.messages().length).toBe(0);
  });

  it('renders messages with status / alert roles and a close button', async () => {
    const fixture = TestBed.createComponent(StarToast);
    const toasts = TestBed.inject(StarToastService);
    toasts.info('Assigned', 'ORD-1');
    toasts.error('Failed');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('.star-toast')].map((t) => t.getAttribute('role'))).toEqual([
      'status',
      'alert',
    ]);
    el.querySelector<HTMLButtonElement>('.star-toast__close')!.click();
    expect(toasts.messages().map((m) => m.summary)).toEqual(['Failed']);
    toasts.clear();
  });
});

@Component({
  imports: [StarDrawer],
  template: `
    <star-drawer [(visible)]="drawer" header="Details" position="left">Drawer body</star-drawer>
  `,
})
class DrawerHost {
  readonly drawer = signal(false);
}

describe('StarDrawer', () => {
  it('opens from visible and closes from its close button', async () => {
    const fixture = TestBed.createComponent(DrawerHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.drawer.set(true);
    await fixture.whenStable();
    const dialog = el.querySelector<HTMLDialogElement>('dialog.star-drawer')!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.classList).toContain('star-drawer--left');
    dialog.querySelector<HTMLButtonElement>('[aria-label=Close]')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.drawer()).toBe(false);
  });
});
