import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarMenuItem } from '@star-ng/ui/menu';
import {
  StarSpeedDial,
  StarSpeedDialDirection,
  StarSpeedDialTemplate,
  StarSpeedDialType,
  ɵstarSpeedDialOffsets,
} from './speed-dial';

@Component({
  imports: [StarSpeedDial, StarSpeedDialTemplate, StarIconTemplate],
  template: `
    <star-speed-dial
      [items]="items"
      [(visible)]="visible"
      [type]="type()"
      [direction]="direction()"
      [radius]="radius()"
      [mask]="mask()"
      [hideOnClickOutside]="outside()"
      [disabled]="disabled()"
      [hideIcon]="hideIcon()"
      [rotateAnimation]="rotate()"
      [transitionDelay]="50"
      [ariaLabelledBy]="labelledBy()"
      (show)="events.push('show')"
      (hide)="events.push('hide')"
      (pressed)="events.push('pressed')"
    >
      @if (slots()) {
        <ng-template starSpeedDialTemplate="item" let-item let-i="index"
          ><b class="own-item">{{ i }}:{{ item?.label }}</b></ng-template
        >
        <ng-template starIcon="icon"><b class="own-icon">*</b></ng-template>
      }
    </star-speed-dial>
    <p id="outside">Outside</p>
  `,
})
class Host {
  readonly items: readonly StarMenuItem[] = [
    { label: 'Copy', icon: 'ph-bold ph-copy' },
    { label: 'Share', icon: 'ph-bold ph-share' },
    { label: 'Print', icon: 'ph-bold ph-printer' },
  ];
  readonly visible = signal(false);
  readonly type = signal<StarSpeedDialType>('linear');
  readonly direction = signal<StarSpeedDialDirection>('up');
  readonly radius = signal(0);
  readonly mask = signal(false);
  readonly outside = signal(true);
  readonly disabled = signal(false);
  readonly hideIcon = signal<string | null>(null);
  readonly rotate = signal(true);
  readonly labelledBy = signal<string | null>(null);
  readonly slots = signal(false);
  readonly events: string[] = [];
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    el,
    host: fixture.componentInstance,
    dial: el.querySelector<HTMLElement>('star-speed-dial')!,
    fab: el.querySelector<HTMLButtonElement>('.star-speed-dial__fab')!,
    stable: () => fixture.whenStable(),
  };
}

describe('StarSpeedDial depth', () => {
  it('has a visible model with show and hide outputs and pressed', async () => {
    const t = await setup();
    t.fab.click();
    await t.stable();
    expect(t.host.visible()).toBe(true);
    expect(t.fab.getAttribute('aria-expanded')).toBe('true');
    t.fab.click();
    await t.stable();
    expect(t.host.visible()).toBe(false);
    expect(t.host.events).toEqual(['pressed', 'show', 'pressed', 'hide']);
    t.host.visible.set(true);
    await t.stable();
    expect(t.dial.classList).toContain('star-speed-dial--open');
  });

  it('closes on a pointer press outside, unless hideOnClickOutside is off', async () => {
    const t = await setup();
    t.fab.click();
    await t.stable();
    const outside = t.el.querySelector('#outside')!;
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await t.stable();
    expect(t.host.visible()).toBe(false);
    t.host.outside.set(false);
    t.host.visible.set(true);
    await t.stable();
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await t.stable();
    expect(t.host.visible()).toBe(true);
  });

  it('shows a mask that closes on click', async () => {
    const t = await setup((h) => h.mask.set(true));
    expect(t.el.querySelector('.star-speed-dial__mask')).toBeNull();
    t.fab.click();
    await t.stable();
    const mask = t.el.querySelector<HTMLElement>('.star-speed-dial__mask')!;
    expect(t.dial.classList).toContain('star-speed-dial--masked');
    mask.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await t.stable();
    expect(t.host.visible()).toBe(false);
  });

  it('places the actions on a circle with the radius', async () => {
    const t = await setup((h) => {
      h.type.set('circle');
      h.radius.set(100);
    });
    expect(t.dial.classList).toContain('star-speed-dial--circular');
    const items = [...t.el.querySelectorAll<HTMLElement>('.star-speed-dial__list li')];
    expect(items[0].style.translate).toBe('0px -100px');
  });

  it('switches the icon with hideIcon and turns only the default icon', async () => {
    const t = await setup((h) => h.hideIcon.set('ph-bold ph-x'));
    expect(t.dial.classList).toContain('star-speed-dial--static');
    t.fab.click();
    await t.stable();
    expect(t.fab.querySelector('i')!.className).toBe('ph-bold ph-x');
    t.host.hideIcon.set(null);
    t.host.rotate.set(false);
    await t.stable();
    expect(t.dial.classList).toContain('star-speed-dial--static');
    t.host.rotate.set(true);
    await t.stable();
    expect(t.dial.classList).not.toContain('star-speed-dial--static');
  });

  it('can be disabled, named by another element and sets the delay', async () => {
    const t = await setup((h) => {
      h.disabled.set(true);
      h.labelledBy.set('outside');
    });
    expect(t.fab.disabled).toBe(true);
    expect(t.fab.getAttribute('aria-labelledby')).toBe('outside');
    expect(t.fab.getAttribute('aria-label')).toBeNull();
    expect(t.dial.style.getPropertyValue('--star-speed-dial-delay')).toBe('50ms');
  });

  it('moves the focus with the arrow keys on a circle', async () => {
    const t = await setup((h) => h.type.set('circle'));
    t.fab.click();
    await t.stable();
    await new Promise((resolve) => setTimeout(resolve));
    const actions = [...t.el.querySelectorAll<HTMLButtonElement>('.star-speed-dial__action')];
    actions[0].focus();
    actions[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(actions[1]);
    actions[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(actions[0]);
  });

  it('renders the item and icon slots', async () => {
    const t = await setup((h) => h.slots.set(true));
    expect([...t.el.querySelectorAll('.own-item')].map((n) => n.textContent)).toEqual([
      '0:Copy',
      '1:Share',
      '2:Print',
    ]);
    expect(t.fab.querySelector('.own-icon')!.closest('[aria-hidden=true]')).not.toBeNull();
    expect(t.el.querySelector('.star-speed-dial__action')!.getAttribute('aria-label')).toBe('Copy');
  });
});

describe('ɵstarSpeedDialOffsets', () => {
  it('spreads a semi circle and a quarter circle toward the side', () => {
    expect(ɵstarSpeedDialOffsets(3, 'semi-circle', 'up', 10)).toEqual([
      { x: -10, y: 0 },
      { x: 0, y: -10 },
      { x: 10, y: 0 },
    ]);
    expect(ɵstarSpeedDialOffsets(2, 'quarter-circle', 'down-right', 10)).toEqual([
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ]);
    expect(ɵstarSpeedDialOffsets(1, 'semi-circle', 'right', 10)).toEqual([{ x: 10, y: 0 }]);
  });
});
