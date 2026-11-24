import { CdkMenuTrigger } from '@angular/cdk/menu';
import { FlexibleConnectedPositionStrategy, OverlayRef } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  STAR_MENU_POSITIONS,
  StarMenu,
  StarMenuItem,
  StarMenuPosition,
  StarMenuTrigger,
} from '@star-ng/ui/menu';

/**
 * `starMenuPosition` of the menu trigger and the `header` item of `star-menu`. jsdom has no
 * layout: the positions given to the CDK overlay are checked here; where the popup really shows
 * (also right-to-left) is checked in `e2e/controls-menus.spec.ts` and `e2e/rtl-controls.spec.ts`.
 */

afterEach(() => {
  document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
  document.documentElement.removeAttribute('dir');
});

/** CDK menus read `keyCode`. */
const KEY_CODES: Record<string, number> = { ArrowUp: 38, ArrowDown: 40, Home: 36, End: 35, r: 82 };

function key(target: Element, key: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, keyCode: KEY_CODES[key], bubbles: true, cancelable: true }),
  );
}

@Component({
  imports: [StarMenu, StarMenuTrigger],
  template: `
    <button type="button" id="plain" [starMenuTrigger]="menu">Plain</button>
    <button type="button" id="placed" [starMenuTrigger]="menu" [starMenuPosition]="position()">
      Placed
    </button>
    <star-menu #menu [items]="items" />
  `,
})
class PositionHost {
  readonly position = signal<StarMenuPosition>('below-end');
  readonly items: StarMenuItem[] = [{ label: 'Open' }, { label: 'Copy' }];
}

function cdkTrigger(fixture: { debugElement: import('@angular/core').DebugElement }, id: string) {
  return fixture.debugElement.query(By.css(`#${id}`)).injector.get(CdkMenuTrigger);
}

function overlayOf(trigger: CdkMenuTrigger): OverlayRef | null {
  return (trigger as unknown as { overlayRef: OverlayRef | null }).overlayRef;
}

describe('StarMenuTrigger starMenuPosition', () => {
  it('keeps the default positions: below, start edges aligned, with the same fallbacks', async () => {
    const fixture = TestBed.createComponent(PositionHost);
    await fixture.whenStable();
    const positions = cdkTrigger(fixture, 'plain').menuPosition!;
    expect(positions).toEqual(STAR_MENU_POSITIONS);
    expect(positions.map((p) => [p.originX, p.originY, p.overlayX, p.overlayY])).toEqual([
      ['start', 'bottom', 'start', 'top'],
      ['end', 'bottom', 'end', 'top'],
      ['start', 'top', 'start', 'bottom'],
    ]);
  });

  it.each<[StarMenuPosition, string[][]]>([
    [
      'below-start',
      [
        ['start', 'bottom', 'start', 'top'],
        ['end', 'bottom', 'end', 'top'],
        ['start', 'top', 'start', 'bottom'],
      ],
    ],
    [
      'below-end',
      [
        ['end', 'bottom', 'end', 'top'],
        ['start', 'bottom', 'start', 'top'],
        ['end', 'top', 'end', 'bottom'],
      ],
    ],
    [
      'above-start',
      [
        ['start', 'top', 'start', 'bottom'],
        ['end', 'top', 'end', 'bottom'],
        ['start', 'bottom', 'start', 'top'],
      ],
    ],
    [
      'above-end',
      [
        ['end', 'top', 'end', 'bottom'],
        ['start', 'top', 'start', 'bottom'],
        ['end', 'bottom', 'end', 'top'],
      ],
    ],
  ])('%s prefers that position, then the fallbacks', async (position, expected) => {
    const fixture = TestBed.createComponent(PositionHost);
    fixture.componentInstance.position.set(position);
    await fixture.whenStable();
    const positions = cdkTrigger(fixture, 'placed').menuPosition!;
    expect(positions.map((p) => [p.originX, p.originY, p.overlayX, p.overlayY])).toEqual(expected);
    // The popup keeps its gap to the trigger on both sides.
    expect(positions.map((p) => p.offsetY)).toEqual(
      expected.map(([, originY]) => (originY === 'bottom' ? 4 : -4)),
    );
  });

  it('gives an open popup the new positions when the input changes', async () => {
    const fixture = TestBed.createComponent(PositionHost);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('#placed')!.click();
    await fixture.whenStable();
    const strategy = overlayOf(cdkTrigger(fixture, 'placed'))!.getConfig()
      .positionStrategy as FlexibleConnectedPositionStrategy;
    expect(strategy.positions[0]).toEqual(expect.objectContaining({ originX: 'end' }));

    fixture.componentInstance.position.set('above-start');
    await fixture.whenStable();
    expect(strategy.positions[0]).toEqual(
      expect.objectContaining({ originX: 'start', originY: 'top', overlayY: 'bottom' }),
    );
  });

  it('uses logical edges, so the popup follows a right-to-left page', async () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const fixture = TestBed.createComponent(PositionHost);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#placed')!.click();
    await fixture.whenStable();
    const trigger = cdkTrigger(fixture, 'placed');
    // `end` (not `right`): CDK puts the popup at the left edge of the trigger in this direction.
    expect(trigger.menuPosition![0]).toEqual(
      expect.objectContaining({ originX: 'end', overlayX: 'end' }),
    );
    expect(overlayOf(trigger)!.getDirection()).toBe('rtl');
  });
});

@Component({
  imports: [StarMenu, StarMenuTrigger],
  template: `
    <button type="button" id="trigger" [starMenuTrigger]="menu">Actions</button>
    <star-menu #menu [items]="items" [ariaLabel]="label()" (itemClick)="ran.push($event.label!)" />
  `,
})
class HeaderHost {
  readonly label = signal<string | null>(null);
  readonly ran: string[] = [];
  readonly items: StarMenuItem[] = [
    { label: 'REC-0001', header: true },
    { label: 'Preview' },
    { label: 'Rename' },
    { label: 'Remove', danger: true },
  ];
}

describe('StarMenu header item', () => {
  async function open() {
    const fixture = TestBed.createComponent(HeaderHost);
    await fixture.whenStable();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '#trigger',
    )!;
    trigger.focus();
    key(trigger, 'ArrowDown');
    await fixture.whenStable();
    const menu = document.querySelector<HTMLElement>('[role=menu]')!;
    const header = menu.querySelector<HTMLElement>('[data-star-part=header]')!;
    return { fixture, trigger, menu, header };
  }

  it('renders a plain heading that names the menu and is no menu item', async () => {
    const { menu, header } = await open();
    expect(header.textContent?.trim()).toBe('REC-0001');
    expect(header.classList).toContain('star-menu__header');
    expect(header.getAttribute('aria-hidden')).toBe('true');
    expect(header.hasAttribute('role')).toBe(false);
    expect(header.hasAttribute('tabindex')).toBe(false);
    expect(menu.getAttribute('aria-labelledby')).toBe(header.id);
    const items = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')];
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Preview', 'Rename', 'Remove']);
  });

  it('is skipped by the arrow keys, Home, End and the typeahead', async () => {
    const { menu } = await open();
    const items = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')];
    expect(document.activeElement).toBe(items[0]);
    key(menu, 'ArrowUp');
    expect(document.activeElement).toBe(items[2]);
    key(menu, 'ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    key(menu, 'End');
    expect(document.activeElement).toBe(items[2]);
    key(menu, 'Home');
    expect(document.activeElement).toBe(items[0]);
    // "R" goes to "Rename", not to the heading "REC-0001".
    vi.useFakeTimers();
    try {
      key(menu, 'r');
      vi.advanceTimersByTime(250);
    } finally {
      vi.useRealTimers();
    }
    expect(document.activeElement).toBe(items[1]);
  });

  it('does not run or close the menu on a click', async () => {
    const { fixture, header } = await open();
    header.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.ran).toEqual([]);
    expect(document.querySelector('[role=menu]')).not.toBeNull();
  });

  it('leaves the name to ariaLabel when it is set', async () => {
    const { fixture } = await open();
    fixture.componentInstance.label.set('Record actions');
    await fixture.whenStable();
    const menu = document.querySelector<HTMLElement>('[role=menu]')!;
    expect(menu.getAttribute('aria-label')).toBe('Record actions');
    expect(menu.hasAttribute('aria-labelledby')).toBe(false);
  });
});
