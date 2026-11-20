import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAnnouncer } from '@star-ng/ui/core';
import {
  StarDragEndEvent,
  StarDragEvent,
  StarDraggable,
  StarDropEvent,
  StarDroppable,
} from './drag-drop';

interface Order {
  readonly id: string;
}

@Component({
  imports: [StarDraggable, StarDroppable],
  template: `
    <div [attr.dir]="dir()">
      <div
        class="item"
        [starDraggable]="order"
        [dragScope]="scope()"
        [dragDisabled]="disabled()"
        dragEffect="copyMove"
        dragLabel="Order 1"
        (dragStart)="starts.push($event)"
        (dragEnd)="ends.push($event)"
      >
        Order 1
      </div>
      <section
        class="zone open"
        starDroppable="orders"
        dropLabel="Open"
        (dragEnter)="enters.push('open')"
        (dragLeave)="leaves.push('open')"
        (dropped)="drops.push($event)"
      >
        Open
      </section>
      <section
        class="zone other"
        starDroppable="mail"
        dropLabel="Mail"
        (dropped)="drops.push($event)"
      >
        Mail
      </section>
      <section
        class="zone done"
        [starDroppable]="['orders', 'archive']"
        dropLabel="Done"
        dropEffect="copy"
        (dropped)="drops.push($event)"
      >
        Done
      </section>
    </div>
  `,
})
class Host {
  readonly order: Order = { id: 'ORD-1' };
  readonly scope = signal<string | readonly string[]>('orders');
  readonly disabled = signal(false);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly starts: StarDragEvent<Order>[] = [];
  readonly ends: StarDragEndEvent<Order>[] = [];
  readonly enters: string[] = [];
  readonly leaves: string[] = [];
  readonly drops: StarDropEvent[] = [];
}

/** The data of a drag as the browser gives it (jsdom has no DataTransfer). */
class FakeDataTransfer {
  effectAllowed = 'uninitialized';
  dropEffect = 'none';
  readonly data = new Map<string, string>();
  image: Element | null = null;
  setData(type: string, value: string): void {
    this.data.set(type, value);
  }
  setDragImage(image: Element): void {
    this.image = image;
  }
}

let transfer = new FakeDataTransfer();

/** A drag event as the browser sends it (jsdom has no DragEvent). */
function drag(type: string, target: Element): Event {
  if (type === 'dragstart') transfer = new FakeDataTransfer();
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  target.dispatchEvent(event);
  return event;
}

function key(target: Element, name: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

async function setup() {
  const announce = vi.spyOn(TestBed.inject(StarAnnouncer), 'announce').mockResolvedValue();
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const item = el.querySelector<HTMLElement>('.item')!;
  const open = el.querySelector<HTMLElement>('.open')!;
  const other = el.querySelector<HTMLElement>('.other')!;
  const done = el.querySelector<HTMLElement>('.done')!;
  const stable = () => fixture.whenStable();
  return {
    fixture,
    host: fixture.componentInstance,
    el,
    item,
    open,
    other,
    done,
    announce,
    stable,
  };
}

describe('starDraggable and starDroppable', () => {
  afterEach(() => document.querySelectorAll('.star-drag-ghost').forEach((node) => node.remove()));

  it('makes the host draggable and focusable, with a keyboard hint', async () => {
    const { host, item, stable } = await setup();
    expect(item.getAttribute('draggable')).toBe('true');
    expect(item.getAttribute('tabindex')).toBe('0');
    const hint = document.getElementById(item.getAttribute('aria-describedby')!);
    expect(hint?.textContent).toContain('Press Space to pick up');
    host.disabled.set(true);
    await stable();
    expect(item.getAttribute('draggable')).toBe('false');
    expect(item.getAttribute('tabindex')).toBeNull();
  });

  it('drags with the pointer: data, effects, enter, leave and drop', async () => {
    const { host, item, open, done, stable } = await setup();
    drag('dragstart', item);
    await stable();
    expect(transfer.effectAllowed).toBe('copyMove');
    expect(transfer.data.get('text/plain')).toBe('Order 1');
    expect(host.starts[0]).toMatchObject({ data: { id: 'ORD-1' }, mode: 'pointer' });
    expect(item.classList).toContain('star-draggable--dragging');
    expect(open.classList).toContain('star-droppable--active');

    drag('dragenter', open);
    const over = drag('dragover', open);
    await stable();
    expect(over.defaultPrevented).toBe(true);
    expect(transfer.dropEffect).toBe('move');
    expect(host.enters).toEqual(['open']);
    expect(open.classList).toContain('star-droppable--over');
    // A child of the zone does not leave the zone.
    drag('dragenter', open);
    drag('dragleave', open);
    expect(host.leaves).toEqual([]);
    drag('dragleave', open);
    await stable();
    expect(host.leaves).toEqual(['open']);
    expect(open.classList).not.toContain('star-droppable--over');

    drag('dragenter', done);
    drag('dragover', done);
    expect(transfer.dropEffect).toBe('copy');
    const drop = drag('drop', done);
    drag('dragend', item);
    await stable();
    expect(drop.defaultPrevented).toBe(true);
    expect(host.drops).toHaveLength(1);
    expect(host.drops[0]).toMatchObject({
      data: { id: 'ORD-1' },
      mode: 'pointer',
      dropEffect: 'copy',
    });
    expect(host.drops[0].target.dropLabel()).toBe('Done');
    expect(host.ends[0]).toMatchObject({ dropped: true });
    expect(item.classList).not.toContain('star-draggable--dragging');
    expect(done.classList).not.toContain('star-droppable--active');
  });

  it('refuses a zone whose scope does not match', async () => {
    const { host, item, other } = await setup();
    drag('dragstart', item);
    drag('dragenter', other);
    const over = drag('dragover', other);
    expect(over.defaultPrevented).toBe(false);
    drag('drop', other);
    drag('dragend', item);
    expect(host.drops).toEqual([]);
    expect(host.ends[0]).toMatchObject({ dropped: false });
  });

  it('does not start a drag when disabled', async () => {
    const { host, item, stable } = await setup();
    host.disabled.set(true);
    await stable();
    const start = drag('dragstart', item);
    expect(start.defaultPrevented).toBe(true);
    expect(host.starts).toEqual([]);
    key(item, ' ');
    expect(host.starts).toEqual([]);
  });

  it('moves with the keyboard between the matching zones and drops with Space', async () => {
    const { host, item, open, done, other, announce, stable } = await setup();
    item.focus();
    expect(key(item, ' ').defaultPrevented).toBe(true);
    await stable();
    expect(host.starts[0]).toMatchObject({ mode: 'keyboard' });
    expect(announce).toHaveBeenLastCalledWith('Picked up Order 1', 'assertive');

    key(item, 'ArrowDown');
    await stable();
    expect(open.classList).toContain('star-droppable--over');
    expect(announce).toHaveBeenLastCalledWith('Over Open', 'assertive');
    // The mail zone has another scope: the next zone is Done.
    key(item, 'ArrowRight');
    await stable();
    expect(open.classList).not.toContain('star-droppable--over');
    expect(other.classList).not.toContain('star-droppable--over');
    expect(done.classList).toContain('star-droppable--over');
    expect(host.enters).toEqual(['open']);
    expect(host.leaves).toEqual(['open']);
    // The list wraps.
    key(item, 'ArrowDown');
    key(item, 'ArrowUp');
    await stable();
    expect(done.classList).toContain('star-droppable--over');

    key(item, ' ');
    await stable();
    expect(host.drops[0]).toMatchObject({ data: { id: 'ORD-1' }, mode: 'keyboard' });
    expect(host.ends[0]).toMatchObject({ dropped: true, mode: 'keyboard' });
    expect(announce).toHaveBeenLastCalledWith('Order 1 dropped on Done', 'assertive');
    expect(done.classList).not.toContain('star-droppable--over');
    expect(document.activeElement).toBe(item);
  });

  it('cancels a keyboard drag with Escape', async () => {
    const { host, item, open, announce, stable } = await setup();
    item.focus();
    key(item, 'Enter');
    key(item, 'ArrowDown');
    const escape = key(item, 'Escape');
    await stable();
    expect(escape.defaultPrevented).toBe(true);
    expect(host.drops).toEqual([]);
    expect(host.ends[0]).toMatchObject({ dropped: false });
    expect(open.classList).not.toContain('star-droppable--over');
    expect(announce).toHaveBeenLastCalledWith('Drag cancelled. Order 1 did not move', 'assertive');
  });

  it('mirrors the arrow keys in right-to-left', async () => {
    const { host, item, open, done, stable } = await setup();
    host.dir.set('rtl');
    await stable();
    item.focus();
    key(item, ' ');
    key(item, 'ArrowLeft');
    await stable();
    expect(open.classList).toContain('star-droppable--over');
    key(item, 'ArrowLeft');
    await stable();
    expect(done.classList).toContain('star-droppable--over');
  });

  it('says when no zone accepts the item', async () => {
    const { host, item, announce, stable } = await setup();
    host.scope.set('nothing');
    await stable();
    item.focus();
    key(item, ' ');
    await stable();
    expect(announce).toHaveBeenLastCalledWith('No drop zone accepts this item', 'assertive');
    expect(host.ends[0]).toMatchObject({ dropped: false });
  });

  describe('touch', () => {
    afterEach(() => vi.useRealTimers());
    const fakeTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    function pointer(type: string, target: EventTarget, x: number, y: number): Event {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, {
        pointerType: 'touch',
        pointerId: 7,
        clientX: x,
        clientY: y,
        button: 0,
      });
      target.dispatchEvent(event);
      return event;
    }

    it('starts after a long press, follows the finger and drops on the zone under it', async () => {
      const { fixture, host, item, done } = await setup();
      fakeTimers();
      const hit = vi.fn<(x: number, y: number) => Element | null>().mockReturnValue(done);
      Object.defineProperty(document, 'elementFromPoint', { value: hit, configurable: true });
      pointer('pointerdown', item, 10, 10);
      vi.advanceTimersByTime(500);
      fixture.detectChanges();
      expect(host.starts[0]).toMatchObject({ mode: 'touch' });
      expect(document.querySelector('.star-drag-ghost')).not.toBeNull();
      pointer('pointermove', document, 40, 200);
      fixture.detectChanges();
      expect(done.classList).toContain('star-droppable--over');
      pointer('pointerup', document, 40, 200);
      fixture.detectChanges();
      expect(host.drops[0]).toMatchObject({ mode: 'touch' });
      expect(host.ends[0]).toMatchObject({ dropped: true });
      expect(document.querySelector('.star-drag-ghost')).toBeNull();
    });

    it('lets the page scroll when the finger moves before the long press', async () => {
      const { host, item } = await setup();
      fakeTimers();
      pointer('pointerdown', item, 10, 10);
      pointer('pointermove', item, 10, 60);
      vi.advanceTimersByTime(500);
      expect(host.starts).toEqual([]);
    });
  });
});

@Component({
  imports: [StarDraggable, StarDroppable],
  template: `
    <ul class="from" starDroppable dropLabel="From" (dropped)="move($event, 'to')">
      @for (item of from(); track item) {
        <li [starDraggable]="item" [dragLabel]="item">{{ item }}</li>
      }
    </ul>
    <ul class="to" starDroppable dropLabel="To" (dropped)="move($event, 'from')">
      @for (item of to(); track item) {
        <li [starDraggable]="item" [dragLabel]="item">{{ item }}</li>
      }
    </ul>
  `,
})
class ListsHost {
  readonly from = signal(['ORD-1', 'ORD-2']);
  readonly to = signal<string[]>([]);
  move(event: StarDropEvent, into: 'from' | 'to'): void {
    const item = event.data as string;
    const source = into === 'to' ? this.from : this.to;
    const target = into === 'to' ? this.to : this.from;
    // The handler of a zone gets the item of that zone: `into` names the other list.
    if (!source().includes(item)) {
      target.update((list) => list.filter((value) => value !== item));
      source.update((list) => [...list, item]);
    }
  }
}

describe('focus after a keyboard drop', () => {
  it('moves the focus to the new element of the moved item', async () => {
    vi.spyOn(TestBed.inject(StarAnnouncer), 'announce').mockResolvedValue();
    const fixture = TestBed.createComponent(ListsHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const item = el.querySelector<HTMLElement>('.from li')!;
    item.focus();
    key(item, ' ');
    key(item, 'ArrowDown');
    key(item, 'ArrowDown');
    key(item, ' ');
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const moved = el.querySelector<HTMLElement>('.to li')!;
    expect(moved.textContent?.trim()).toBe('ORD-1');
    expect(document.activeElement).toBe(moved);
  });
});

@Component({
  imports: [StarDraggable],
  template: `<p id="own-note">Note</p>
    <div starDraggable aria-describedby="own-note">Item</div>`,
})
class DescribedHost {}

describe('the keyboard hint', () => {
  it('keeps a description that the application set, and follows the UI text', async () => {
    const fixture = TestBed.createComponent(DescribedHost);
    await fixture.whenStable();
    const item = (fixture.nativeElement as HTMLElement).querySelector('[starDraggable]')!;
    const ids = item.getAttribute('aria-describedby')!.split(' ');
    expect(ids[0]).toBe('own-note');
    expect(ids).toContain('star-drag-hint');
    expect(document.getElementById('star-drag-hint')!.textContent).toContain('Space');
  });
});
