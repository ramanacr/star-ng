import { CdkDropList } from '@angular/cdk/drag-drop';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarUiText } from '@star-ng/ui/core';
import { StarTile, StarTileLayout, StarTileResize } from '@star-ng/ui/tile-layout';

function key(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

@Component({
  imports: [StarTileLayout, StarTile],
  template: `
    <div [attr.dir]="dir()">
      <star-tile-layout
        [columns]="columns()"
        rowHeight="8rem"
        gap="0.5rem"
        [breakpoints]="{ sm: 1, md: 2 }"
        [reorderable]="reorderable()"
        [resizable]="resizable()"
        [(order)]="order"
        (tileResize)="resized.push($event)"
      >
        @for (key of order(); track key) {
          <star-tile
            [key]="key"
            [label]="key === 'c' ? '' : 'Tile ' + key"
            [(colSpan)]="spans[key]"
          >
            <span starTileHeader>Header {{ key }}</span>
            <button type="button">Inside {{ key }}</button>
          </star-tile>
        }
      </star-tile-layout>
    </div>
  `,
})
class TileHost {
  readonly layout = viewChild.required(StarTileLayout);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly reorderable = signal(true);
  readonly resizable = signal(true);
  readonly columns = signal(3);
  readonly order = signal<readonly string[]>(['a', 'b', 'c', 'd']);
  readonly spans: Record<string, number> = { a: 1, b: 2, c: 1, d: 1 };
  readonly resized: StarTileResize[] = [];
}

async function setup() {
  const fixture = TestBed.createComponent(TileHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const layout = root.querySelector<HTMLElement>('star-tile-layout')!;
  const tiles = () => [...root.querySelectorAll<HTMLElement>('star-tile')];
  const tile = (k: string) =>
    tiles().find((t) => t.querySelector('button')?.textContent?.includes(`Inside ${k}`))!;
  const live = () => layout.querySelector('[aria-live]')?.textContent?.trim();
  return { fixture, root, layout, tiles, tile, live };
}

describe('StarTileLayout', () => {
  it('sets the grid from columns, rowHeight, gap and breakpoints', async () => {
    const { layout } = await setup();
    expect(layout.style.getPropertyValue('--star-tile-columns')).toBe('3');
    expect(layout.style.getPropertyValue('--star-tile-row-height')).toBe('8rem');
    expect(layout.style.getPropertyValue('--star-tile-gap')).toBe('0.5rem');
    expect(layout.style.getPropertyValue('--star-tile-columns-sm')).toBe('1');
    expect(layout.style.getPropertyValue('--star-tile-columns-md')).toBe('2');
    expect(layout.style.getPropertyValue('--star-tile-columns-lg')).toBe('');
  });

  it('gives each tile role group, a name and its spans', async () => {
    const { tile } = await setup();
    const a = tile('a');
    expect(a.getAttribute('role')).toBe('group');
    expect(a.getAttribute('aria-label')).toBe('Tile a');
    expect(a.hasAttribute('aria-labelledby')).toBe(false);
    expect(tile('b').style.getPropertyValue('--star-tile-col-span')).toBe('2');
    expect(tile('b').style.getPropertyValue('--star-tile-row-span')).toBe('1');
    // Without a label the header names the group.
    const c = tile('c');
    const header = c.querySelector('.star-tile__header')!;
    expect(c.getAttribute('aria-labelledby')).toBe(header.id);
    expect(header.textContent?.trim()).toBe('Header c');
  });

  it('makes the tiles focusable with a hint only when they can move or resize', async () => {
    const { fixture, layout, tile } = await setup();
    const a = tile('a');
    expect(a.getAttribute('tabindex')).toBe('0');
    const hint = layout.querySelector(`#${a.getAttribute('aria-describedby')}`);
    expect(hint?.textContent).toContain('Control and an arrow key');
    expect(hint?.textContent).toContain('Control, Shift and an arrow key');

    fixture.componentInstance.reorderable.set(false);
    fixture.componentInstance.resizable.set(false);
    await fixture.whenStable();
    expect(a.hasAttribute('tabindex')).toBe(false);
    expect(a.hasAttribute('aria-describedby')).toBe(false);
    expect(a.querySelector('.star-tile__resize')).toBeNull();
  });

  it('moves the focused tile with Control and the arrow keys, and announces it', async () => {
    const { fixture, tile, live } = await setup();
    const a = tile('a');
    a.focus();
    const event = key(a, 'ArrowRight', { ctrlKey: true });
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.order()).toEqual(['b', 'a', 'c', 'd']);
    expect(live()).toBe('Tile a, position 2 of 4');
    expect(document.activeElement).toBe(tile('a'));

    // Down moves by one row (3 columns), clamped to the end.
    key(tile('a'), 'ArrowDown', { ctrlKey: true });
    await fixture.whenStable();
    expect(fixture.componentInstance.order()).toEqual(['b', 'c', 'd', 'a']);
    key(tile('a'), 'ArrowUp', { ctrlKey: true });
    await fixture.whenStable();
    expect(fixture.componentInstance.order()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('swaps the arrow keys in right-to-left', async () => {
    const { fixture, tile } = await setup();
    fixture.componentInstance.dir.set('rtl');
    await fixture.whenStable();
    key(tile('a'), 'ArrowLeft', { ctrlKey: true });
    await fixture.whenStable();
    expect(fixture.componentInstance.order()).toEqual(['b', 'a', 'c', 'd']);
  });

  it('ignores plain arrows, keys from content and moves when not reorderable', async () => {
    const { fixture, tile } = await setup();
    key(tile('a'), 'ArrowRight');
    key(tile('a').querySelector('button')!, 'ArrowRight', { ctrlKey: true });
    await fixture.whenStable();
    expect(fixture.componentInstance.order()).toEqual(['a', 'b', 'c', 'd']);
    fixture.componentInstance.reorderable.set(false);
    await fixture.whenStable();
    const event = key(tile('a'), 'ArrowRight', { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.order()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('resizes with Control, Shift and the arrow keys within the columns', async () => {
    const { fixture, tile, live } = await setup();
    const b = tile('b');
    key(b, 'ArrowRight', { ctrlKey: true, shiftKey: true });
    await fixture.whenStable();
    expect(fixture.componentInstance.spans['b']).toBe(3);
    expect(b.style.getPropertyValue('--star-tile-col-span')).toBe('3');
    expect(live()).toBe('Tile b: 3 columns, 1 row');
    // Not wider than the 3 columns.
    key(b, 'ArrowRight', { ctrlKey: true, shiftKey: true });
    key(b, 'ArrowDown', { ctrlKey: true, shiftKey: true });
    await fixture.whenStable();
    expect(b.style.getPropertyValue('--star-tile-row-span')).toBe('2');
    expect(fixture.componentInstance.resized).toEqual([
      { key: 'b', colSpan: 3, rowSpan: 1 },
      { key: 'b', colSpan: 3, rowSpan: 2 },
    ]);
    // Not smaller than one cell.
    key(tile('a'), 'ArrowLeft', { ctrlKey: true, shiftKey: true });
    key(tile('a'), 'ArrowUp', { ctrlKey: true, shiftKey: true });
    expect(fixture.componentInstance.resized.length).toBe(2);
  });

  it('keeps the stored column span on a row-only resize at a narrow width', async () => {
    const { fixture, tile } = await setup();
    const host = fixture.componentInstance;
    host.spans['b'] = 3;
    host.columns.set(1);
    await fixture.whenStable();
    const b = tile('b');
    expect(b.style.getPropertyValue('--star-tile-col-span-now')).toBe('1');
    key(b, 'ArrowDown', { ctrlKey: true, shiftKey: true });
    await fixture.whenStable();
    expect(host.spans['b']).toBe(3);
    expect(b.style.getPropertyValue('--star-tile-row-span')).toBe('2');
    expect(host.resized).toEqual([{ key: 'b', colSpan: 3, rowSpan: 2 }]);
    // Wider or narrower than the one column in force: nothing changes.
    key(b, 'ArrowRight', { ctrlKey: true, shiftKey: true });
    key(b, 'ArrowLeft', { ctrlKey: true, shiftKey: true });
    await fixture.whenStable();
    expect(host.spans['b']).toBe(3);
    expect(host.resized.length).toBe(1);
  });

  it('steps the column span from the span in force', async () => {
    const { fixture, tile } = await setup();
    const host = fixture.componentInstance;
    host.spans['b'] = 3;
    host.columns.set(2);
    await fixture.whenStable();
    // 2 columns in force: one step narrower is 1, not 2.
    key(tile('b'), 'ArrowLeft', { ctrlKey: true, shiftKey: true });
    await fixture.whenStable();
    expect(host.spans['b']).toBe(1);
    expect(host.resized).toEqual([{ key: 'b', colSpan: 1, rowSpan: 1 }]);
  });

  it('keeps the stored column span when a pointer resize does not change the width', async () => {
    const { fixture, tile } = await setup();
    const host = fixture.componentInstance;
    host.spans['b'] = 3;
    host.columns.set(1);
    await fixture.whenStable();
    const b = tile('b');
    // jsdom has no layout: give the grid and the tile a size (one 300px column, 100px rows).
    Object.defineProperty(b.parentElement!, 'clientWidth', { value: 300 });
    Object.defineProperty(b, 'offsetHeight', { value: 100 });
    b.getBoundingClientRect = () => ({ width: 300, height: 100 }) as DOMRect;
    const handle = b.querySelector('.star-tile__resize')!;
    const press = (type: string, x: number, y: number) =>
      handle.dispatchEvent(
        new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true }),
      );
    press('pointerdown', 300, 100);
    press('pointermove', 300, 210);
    press('pointerup', 300, 210);
    await fixture.whenStable();
    expect(host.spans['b']).toBe(3);
    expect(host.resized).toEqual([{ key: 'b', colSpan: 3, rowSpan: 2 }]);
  });

  it('writes the order after a drop', async () => {
    const { fixture, layout } = await setup();
    const dropList = fixture.debugElement
      .query((d) => d.nativeElement === layout)
      .injector.get(CdkDropList);
    expect(dropList.orientation).toBe('mixed');
    expect(dropList.disabled).toBe(false);
    dropList.dropped.emit({ previousIndex: 3, currentIndex: 0 } as never);
    await fixture.whenStable();
    expect(fixture.componentInstance.order()).toEqual(['d', 'a', 'b', 'c']);

    fixture.componentInstance.reorderable.set(false);
    await fixture.whenStable();
    expect(dropList.disabled).toBe(true);
  });

  it('reads its texts from STAR_UI_TEXT', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideStarUiText({
          tileMoveHint: 'Verschieben',
          tileResizeHint: 'Größe',
          itemPosition: (label, position, total) => `${label} ${position}/${total}`,
        }),
      ],
    });
    const { fixture, layout, tile, live } = await setup();
    expect(
      layout.querySelector(`#${tile('a').getAttribute('aria-describedby')}`)?.textContent,
    ).toBe('Verschieben Größe');
    key(tile('a'), 'ArrowRight', { ctrlKey: true });
    await fixture.whenStable();
    expect(live()).toBe('Tile a 2/4');
  });
});

@Component({
  imports: [StarTileLayout, StarTile],
  template: `
    <star-tile-layout>
      <star-tile key="plain">Body only</star-tile>
      <star-tile key="titled"><span starTileHeader>Titled</span>Body</star-tile>
    </star-tile-layout>
  `,
})
class PlainHost {}

describe('StarTile without a label', () => {
  it('falls back to the key as its name when there is no header either', async () => {
    const fixture = TestBed.createComponent(PlainHost);
    await fixture.whenStable();
    const [plain, titled] = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('star-tile'),
    ];
    expect(plain.getAttribute('aria-label')).toBe('plain');
    expect(plain.hasAttribute('aria-labelledby')).toBe(false);
    expect(titled.hasAttribute('aria-label')).toBe(false);
    expect(titled.getAttribute('aria-labelledby')).toBe(
      titled.querySelector('.star-tile__header')?.id,
    );
  });
});
