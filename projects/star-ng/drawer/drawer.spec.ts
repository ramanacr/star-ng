import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarDrawer } from '@star-ng/ui/drawer';

// jsdom has no HTMLDialogElement methods. Minimal stand-ins (real browsers implement these).
const dialogProto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
dialogProto.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
dialogProto.show ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
dialogProto.close ??= function (this: HTMLDialogElement) {
  if (!this.hasAttribute('open')) return;
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};

type Position = 'left' | 'right' | 'start' | 'end' | 'top' | 'bottom';

@Component({
  imports: [StarDrawer],
  template: `
    <star-drawer
      [(visible)]="open"
      header="Order ORD-1042"
      [position]="position()"
      [modal]="modal()"
      [fullScreen]="full()"
      [dismissible]="dismissible()"
      [blockScroll]="block()"
      (shown)="events.push('shown')"
      (hidden)="events.push('hidden')"
    >
      <p>Body</p>
    </star-drawer>
  `,
})
class DrawerHost {
  readonly open = signal(false);
  readonly position = signal<Position>('end');
  readonly modal = signal(true);
  readonly full = signal(false);
  readonly dismissible = signal(false);
  readonly block = signal<boolean | undefined>(undefined);
  readonly events: string[] = [];
}

async function setup() {
  const fixture = TestBed.createComponent(DrawerHost);
  await fixture.whenStable();
  const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
  return { fixture, host: fixture.componentInstance, dialog };
}

describe('StarDrawer modes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('pins to a logical or physical edge', async () => {
    const { fixture, host, dialog } = await setup();
    for (const position of ['start', 'end', 'top', 'bottom', 'left'] as const) {
      host.position.set(position);
      await fixture.whenStable();
      expect(dialog.classList).toContain(`star-drawer--${position}`);
      expect(dialog.classList).toContain('star-drawer');
    }
  });

  it('opens modal with showModal, blocks the scroll and reports shown and hidden', async () => {
    const { fixture, host, dialog } = await setup();
    const showModal = vi.spyOn(dialog, 'showModal');
    const show = vi.spyOn(dialog, 'show');
    host.open.set(true);
    await fixture.whenStable();
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(show).not.toHaveBeenCalled();
    expect(dialog.classList).toContain('star-dialog--modal');
    expect(dialog.classList).toContain('star-dialog--block-scroll');
    host.open.set(false);
    await fixture.whenStable();
    expect(host.events).toEqual(['shown', 'hidden']);
  });

  it('opens non-modal with show(), without backdrop close or scroll block', async () => {
    const { fixture, host, dialog } = await setup();
    host.modal.set(false);
    host.dismissible.set(true);
    const show = vi.spyOn(dialog, 'show');
    host.open.set(true);
    await fixture.whenStable();
    expect(show).toHaveBeenCalledTimes(1);
    expect(dialog.classList).not.toContain('star-dialog--modal');
    expect(dialog.classList).not.toContain('star-dialog--block-scroll');
    // A non-modal drawer has no backdrop, so a click on the box itself does not close it.
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(host.open()).toBe(true);

    host.block.set(true);
    await fixture.whenStable();
    expect(dialog.classList).toContain('star-dialog--block-scroll');
  });

  it('closes on a backdrop click only when dismissible', async () => {
    const { fixture, host, dialog } = await setup();
    host.open.set(true);
    await fixture.whenStable();
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(host.open()).toBe(true);

    host.dismissible.set(true);
    await fixture.whenStable();
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(host.open()).toBe(false);
  });

  it('covers the window with fullScreen', async () => {
    const { fixture, host, dialog } = await setup();
    expect(dialog.classList).not.toContain('star-drawer--full');
    host.full.set(true);
    await fixture.whenStable();
    expect(dialog.classList).toContain('star-drawer--full');
  });
});
