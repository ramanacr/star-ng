import { FlexibleConnectedPositionStrategy, OverlayRef } from '@angular/cdk/overlay';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarPopover, StarPopoverPosition } from '@star-ng/ui/popover';

/**
 * `position` of `star-popover`. jsdom has no layout: the positions given to the CDK overlay are
 * checked here; where the panel really shows (also right-to-left, and the flip near the bottom of
 * the window) is checked in `e2e/controls-overlays.spec.ts`.
 */

afterEach(() => {
  document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
  document.documentElement.removeAttribute('dir');
});

@Component({
  imports: [StarPopover],
  template: `
    <button type="button" id="plain" (click)="plain.toggle($event)">Plain</button>
    <star-popover #plain ariaLabel="Plain"><p>Plain</p></star-popover>
    <button type="button" id="placed" (click)="placed.toggle($event)">Placed</button>
    <star-popover #placed ariaLabel="Placed" [position]="position()"><p>Placed</p></star-popover>
  `,
})
class PositionHost {
  readonly position = signal<StarPopoverPosition>('below-end');
  readonly plain = viewChild.required<StarPopover>('plain');
  readonly placed = viewChild.required<StarPopover>('placed');
}

type Row = [string, string, string, string];

function strategyOf(popover: StarPopover): FlexibleConnectedPositionStrategy {
  const ref = (popover as unknown as { overlayRef: OverlayRef }).overlayRef;
  return ref.getConfig().positionStrategy as FlexibleConnectedPositionStrategy;
}

function rows(strategy: FlexibleConnectedPositionStrategy): Row[] {
  return strategy.positions.map((p) => [p.originX, p.originY, p.overlayX, p.overlayY]);
}

async function open(id: 'plain' | 'placed', position?: StarPopoverPosition) {
  const fixture = TestBed.createComponent(PositionHost);
  if (position) fixture.componentInstance.position.set(position);
  await fixture.whenStable();
  document.getElementById(id)!.click();
  await fixture.whenStable();
  const popover = fixture.componentInstance[id]();
  return { fixture, popover, strategy: strategyOf(popover) };
}

const BELOW_START: Row = ['start', 'bottom', 'start', 'top'];
const BELOW_END: Row = ['end', 'bottom', 'end', 'top'];
const ABOVE_START: Row = ['start', 'top', 'start', 'bottom'];
const ABOVE_END: Row = ['end', 'top', 'end', 'bottom'];

describe('StarPopover position', () => {
  it('keeps the default positions: below, start edges aligned, with the same fallbacks', async () => {
    const { popover, strategy } = await open('plain');
    expect(popover.position()).toBe('below-start');
    expect(rows(strategy)).toEqual([BELOW_START, BELOW_END, ABOVE_START, ABOVE_END]);
    expect(strategy.positions.map((p) => p.offsetY)).toEqual([8, 8, -8, -8]);
  });

  it.each<[StarPopoverPosition, Row[]]>([
    ['below-start', [BELOW_START, BELOW_END, ABOVE_START, ABOVE_END]],
    ['below-end', [BELOW_END, BELOW_START, ABOVE_END, ABOVE_START]],
    ['above-start', [ABOVE_START, ABOVE_END, BELOW_START, BELOW_END]],
    ['above-end', [ABOVE_END, ABOVE_START, BELOW_END, BELOW_START]],
  ])('%s prefers that position, then the fallbacks', async (position, expected) => {
    const { strategy } = await open('placed', position);
    expect(rows(strategy)).toEqual(expected);
    // The panel keeps its gap to the anchor on both sides.
    expect(strategy.positions.map((p) => p.offsetY)).toEqual(
      expected.map(([, originY]) => (originY === 'bottom' ? 8 : -8)),
    );
  });

  it('keeps the panel inside the window', async () => {
    const { strategy } = await open('placed');
    const s = strategy as unknown as { _canPush: boolean; _viewportMargin: number };
    expect(s._canPush).toBe(true);
    expect(s._viewportMargin).toBe(8);
  });

  it('gives an open panel the new positions when the input changes', async () => {
    const { fixture, strategy } = await open('placed');
    expect(rows(strategy)[0]).toEqual(BELOW_END);
    fixture.componentInstance.position.set('above-start');
    await fixture.whenStable();
    expect(rows(strategy)[0]).toEqual(ABOVE_START);
  });

  it('uses logical edges, so the panel follows a right-to-left page', async () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const { popover, strategy } = await open('placed');
    // `end` (not `right`): CDK puts the panel at the left edge of the anchor in this direction.
    expect(rows(strategy)[0]).toEqual(BELOW_END);
    const ref = (popover as unknown as { overlayRef: OverlayRef }).overlayRef;
    expect(ref.getDirection()).toBe('rtl');
  });
});
