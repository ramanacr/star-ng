// Generic drag and drop directives (PrimeNG `pDraggable` / `pDroppable`, Ignite `igxDrag` /
// `igxDrop`). The pointer uses the native HTML drag and drop of the browser (drag image, drop
// effects); a long press starts a touch drag; Space picks an item up for the keyboard. The
// directives never move anything: the owner moves the data in `dropped`.
import { DOCUMENT } from '@angular/common';
import {
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injectable,
  input,
  output,
  signal,
} from '@angular/core';
import { STAR_UI_TEXT, StarAnnouncer, starInlineKey } from '@star-ng/ui/core';

/** A drag scope: one name or a list of names. A drop zone accepts a drag when a name is shared. */
export type StarDragScope = string | readonly string[];

/** The operations that a draggable allows (`DataTransfer.effectAllowed`). */
export type StarDragEffect =
  'move' | 'copy' | 'link' | 'copyMove' | 'copyLink' | 'linkMove' | 'all';

/** The operation of a drop (`DataTransfer.dropEffect`). */
export type StarDropEffect = 'move' | 'copy' | 'link';

/** How the drag runs: the mouse or a pen (native drag), a long press on a touch screen, or the keyboard. */
export type StarDragMode = 'pointer' | 'touch' | 'keyboard';

/** Payload of `dragStart` (PrimeNG `onDragStart`, Ignite `dragStart`). */
export interface StarDragEvent<T = unknown> {
  /** The value of `[starDraggable]`. */
  readonly data: T;
  readonly source: StarDraggable<T>;
  readonly mode: StarDragMode;
  /** The browser event, when there is one. */
  readonly originalEvent: Event | null;
}

/** Payload of `dragEnd` (PrimeNG `onDragEnd`). `dropped` is `false` after a cancel. */
export interface StarDragEndEvent<T = unknown> extends StarDragEvent<T> {
  readonly dropped: boolean;
}

/** Payload of `dragEnter` and `dragLeave` of a drop zone. */
export interface StarDragZoneEvent<T = unknown> extends StarDragEvent<T> {
  readonly target: StarDroppable;
}

/** Payload of `dropped` (PrimeNG `onDrop`, Ignite `dropped`). Move `data` in your model. */
export interface StarDropEvent<T = unknown> extends StarDragZoneEvent<T> {
  readonly dropEffect: StarDropEffect;
}

/** A drag in progress. */
interface ActiveDrag {
  readonly source: StarDraggable;
  readonly mode: StarDragMode;
  over: StarDroppable | null;
  dropped: boolean;
}

const DEFAULT_SCOPE = 'default';
const HINT_ID = 'star-drag-hint';
/** Milliseconds of a touch press before a drag starts. */
const LONG_PRESS_MS = 400;
/** Pixels that a finger may move before the long press (a larger move is a scroll). */
const SLOP_PX = 8;

function scopeList(scope: StarDragScope | null | undefined): readonly string[] {
  if (scope === null || scope === undefined || scope === '') return [DEFAULT_SCOPE];
  return typeof scope === 'string' ? [scope] : scope.length ? scope : [DEFAULT_SCOPE];
}

/** The drop effect that `allowed` lets a zone use; `null` when none fits. @internal */
export function ɵstarDropEffect(
  allowed: StarDragEffect,
  wanted: StarDropEffect | null,
): StarDropEffect | null {
  const effects: Record<StarDragEffect, readonly StarDropEffect[]> = {
    move: ['move'],
    copy: ['copy'],
    link: ['link'],
    copyMove: ['move', 'copy'],
    copyLink: ['copy', 'link'],
    linkMove: ['move', 'link'],
    all: ['move', 'copy', 'link'],
  };
  const list = effects[allowed] ?? ['move'];
  if (wanted === null) return list[0];
  return list.includes(wanted) ? wanted : null;
}

/** The registered drop zones and the drag in progress, shared by the page. @internal */
@Injectable({ providedIn: 'root' })
export class ɵStarDragRegistry {
  private readonly doc = inject(DOCUMENT);
  private readonly text = inject(STAR_UI_TEXT);
  readonly zones = new Set<StarDroppable>();
  readonly active = signal<ActiveDrag | null>(null);

  /** The id of one hidden element with the keyboard hint, for `aria-describedby`. */
  hintId(): string {
    const body = this.doc.body;
    if (body && !this.doc.getElementById(HINT_ID)) {
      const hint = this.doc.createElement('span');
      hint.id = HINT_ID;
      hint.className = 'star-sr-only';
      hint.hidden = true;
      hint.textContent = this.text.dragHint;
      body.appendChild(hint);
    }
    return HINT_ID;
  }

  /** The zones that accept `source`, in document order. */
  targetsFor(source: StarDraggable): StarDroppable[] {
    return [...this.zones]
      .filter((zone) => zone.accepts(source))
      .sort((a, b) =>
        a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
  }

  /** The accepting zone at a point of the viewport (touch drags). */
  zoneAt(x: number, y: number, source: StarDraggable): StarDroppable | null {
    const hit = this.doc.elementFromPoint?.(x, y) ?? null;
    if (!hit) return null;
    let best: StarDroppable | null = null;
    for (const zone of this.zones) {
      if (!zone.element.contains(hit) || !zone.accepts(source)) continue;
      // The innermost zone wins.
      if (!best || best.element.contains(zone.element)) best = zone;
    }
    return best;
  }
}

/**
 * Makes an element draggable (PrimeNG `pDraggable`, Ignite `igxDrag`). The value is the data
 * payload that the drop zone receives.
 *
 * - **Mouse and pen:** the native drag of the browser, with its drag image (`dragImage`) and the
 *   drop effects (`dragEffect`).
 * - **Touch:** a long press starts the drag; a copy of the element follows the finger. A finger
 *   that moves before the long press scrolls the page.
 * - **Keyboard:** the element is focusable. Space (or Enter) picks it up, the arrow keys move
 *   between the drop zones that accept it (in right-to-left the left and right arrows swap), Space
 *   drops and Escape cancels. `StarAnnouncer` reads each step.
 *
 * `<li [starDraggable]="order" dragScope="orders" (dragEnd)="...">ORD-1042</li>`
 */
@Directive({
  selector: '[starDraggable]',
  exportAs: 'starDraggable',
  host: {
    class: 'star-draggable',
    '[attr.draggable]': 'dragDisabled() ? "false" : "true"',
    '[attr.tabindex]': 'dragDisabled() ? null : 0',
    '[attr.aria-describedby]': 'dragDisabled() ? null : hintId',
    '[class.star-draggable--dragging]': 'dragging()',
    '[class.star-draggable--picked]': 'picked()',
    '[class.star-draggable--disabled]': 'dragDisabled()',
    '(dragstart)': 'onDragStart($event)',
    '(dragend)': 'onDragEnd($event)',
    '(keydown)': 'onKeydown($event)',
    '(blur)': 'cancelKeyboard()',
    '(pointerdown)': 'onPointerDown($event)',
    '(contextmenu)': 'onContextMenu($event)',
  },
})
export class StarDraggable<T = unknown> {
  private readonly registry = inject(ɵStarDragRegistry);
  private readonly announcer = inject(StarAnnouncer);
  private readonly text = inject(STAR_UI_TEXT);
  private readonly doc = inject(DOCUMENT);
  /** The host element. */
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** The data payload of the drag. */
  readonly data = input<T>(undefined as T, { alias: 'starDraggable' });
  /** The scope names. A drop zone accepts the drag when it shares a name (default `default`). */
  readonly dragScope = input<StarDragScope>(DEFAULT_SCOPE);
  /** The operations allowed (`effectAllowed`, PrimeNG `dragEffect`). Default `move`. */
  readonly dragEffect = input<StarDragEffect>('move');
  /** A CSS selector: the drag starts only from a matching element inside the host (PrimeNG `dragHandle`). */
  readonly dragHandle = input<string | null>(null);
  /** The element that the browser shows under the pointer, and the touch copy. Default: the host. */
  readonly dragImage = input<HTMLElement | null>(null);
  /** The name of the item in the announcements. Default: the text of the host. */
  readonly dragLabel = input<string | null>(null);
  readonly dragDisabled = input(false, { transform: booleanAttribute });

  readonly dragStart = output<StarDragEvent<T>>();
  readonly dragEnd = output<StarDragEndEvent<T>>();

  protected readonly hintId = this.registry.hintId();
  protected readonly dragging = computed(() => this.registry.active()?.source === this);
  protected readonly picked = computed(
    () => this.dragging() && this.registry.active()?.mode === 'keyboard',
  );

  /** `true` when the last press started inside the handle (or there is no handle). */
  private fromHandle = true;
  private touch: TouchDrag | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.touch?.stop();
      if (this.dragging()) this.registry.active.set(null);
    });
  }

  /** The scope names, never empty. */
  scopes(): readonly string[] {
    return scopeList(this.dragScope());
  }

  /** The label of the item in the announcements. */
  label(): string {
    return this.dragLabel() || this.element.getAttribute('aria-label') || this.text_();
  }

  private text_(): string {
    return (this.element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  }

  private event(originalEvent: Event | null): StarDragEvent<T> {
    const active = this.registry.active();
    return { data: this.data(), source: this, mode: active?.mode ?? 'pointer', originalEvent };
  }

  private begin(mode: StarDragMode, originalEvent: Event | null): void {
    this.registry.active.set({ source: this as StarDraggable, mode, over: null, dropped: false });
    this.dragStart.emit(this.event(originalEvent));
  }

  /** Ends the drag in progress; the zone under it drops when `drop` is true. */
  private finish(drop: boolean, originalEvent: Event | null): void {
    const active = this.registry.active();
    if (!active || active.source !== this) return;
    const zone = active.over;
    if (drop && zone) {
      zone.drop(originalEvent);
    } else if (zone) {
      zone.leave(originalEvent);
    }
    const event = { ...this.event(originalEvent), dropped: active.dropped };
    this.registry.active.set(null);
    this.dragEnd.emit(event);
  }

  protected onDragStart(event: DragEvent): void {
    if (this.dragDisabled() || !this.fromHandle || this.touch?.dragging) {
      event.preventDefault();
      return;
    }
    // A drag of a nested draggable is not a drag of this one.
    event.stopPropagation();
    const transfer = event.dataTransfer;
    if (transfer) {
      transfer.effectAllowed = this.dragEffect();
      // Firefox starts a drag only with data.
      transfer.setData('text/plain', this.label());
      const image = this.dragImage();
      if (image) transfer.setDragImage(image, 0, 0);
    }
    this.begin('pointer', event);
  }

  protected onDragEnd(event: DragEvent): void {
    if (this.registry.active()?.mode !== 'pointer') return;
    this.finish(false, event);
  }

  protected onPointerDown(event: PointerEvent): void {
    const handle = this.dragHandle();
    const target = event.target as Element | null;
    this.fromHandle = !handle || !!target?.closest?.(handle);
    if (event.pointerType !== 'touch' || this.dragDisabled() || !this.fromHandle) return;
    this.touch?.stop();
    this.touch = null;
    this.touch = new TouchDrag(this.doc, event, {
      start: (origin) => this.startTouch(origin),
      move: (x, y, origin) => this.moveTouch(x, y, origin),
      end: (drop, origin) => {
        this.touch = null;
        this.finish(drop, origin);
      },
    });
  }

  protected onContextMenu(event: Event): void {
    // A long press opens the context menu on touch screens: not while it starts a drag.
    if (this.touch) event.preventDefault();
  }

  private startTouch(origin: Event): HTMLElement {
    this.begin('touch', origin);
    return (this.dragImage() ?? this.element) as HTMLElement;
  }

  private moveTouch(x: number, y: number, origin: Event): void {
    const active = this.registry.active();
    if (!active || active.source !== this) return;
    this.over(this.registry.zoneAt(x, y, this as StarDraggable), origin);
  }

  /** Moves the drag over `zone` (or off every zone). */
  private over(zone: StarDroppable | null, origin: Event | null): void {
    const active = this.registry.active();
    if (!active || active.over === zone) return;
    active.over?.leave(origin);
    active.over = zone;
    zone?.enter(origin);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.target !== this.element || this.dragDisabled()) return;
    const active = this.registry.active();
    const mine = active?.source === this && active.mode === 'keyboard';
    const key = starInlineKey(event, this.element);
    if (!mine) {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      this.pickUp(event);
      return;
    }
    switch (key) {
      case 'ArrowDown':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowLeft': {
        event.preventDefault();
        const forward = key === 'ArrowDown' || key === 'ArrowRight';
        this.step(forward ? 1 : -1, event);
        return;
      }
      case ' ':
      case 'Enter': {
        event.preventDefault();
        const zone = active.over;
        if (!zone) {
          this.cancel(event);
          return;
        }
        const label = this.label();
        this.finish(true, event);
        this.say(this.text.dragDropped(label, zone.label()));
        return;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.cancel(event);
        return;
      case 'Tab':
        this.cancel(event);
        return;
    }
  }

  /** Ends a keyboard drag without a drop (for example when the focus leaves the item). */
  cancelKeyboard(): void {
    const active = this.registry.active();
    if (active?.source === this && active.mode === 'keyboard') this.cancel(null);
  }

  private pickUp(event: KeyboardEvent): void {
    this.registry.active()?.source.cancelKeyboard();
    this.begin('keyboard', event);
    if (!this.registry.targetsFor(this as StarDraggable).length) {
      this.finish(false, event);
      this.say(this.text.dragNoTarget);
      return;
    }
    this.say(this.text.dragPickedUp(this.label()));
  }

  private step(by: number, event: Event): void {
    const targets = this.registry.targetsFor(this as StarDraggable);
    if (!targets.length) return;
    const current = this.registry.active()?.over ?? null;
    const at = current ? targets.indexOf(current) : -1;
    const next =
      at < 0 ? (by > 0 ? 0 : targets.length - 1) : (at + by + targets.length) % targets.length;
    this.over(targets[next], event);
    this.say(this.text.dragOver(targets[next].label()));
  }

  private cancel(event: Event | null): void {
    const label = this.label();
    this.finish(false, event);
    this.say(this.text.dragCanceled(label));
  }

  private say(message: string): void {
    void this.announcer.announce(message, 'assertive');
  }
}

/**
 * A drop zone (PrimeNG `pDroppable`, Ignite `igxDrop`). The value is the scope (one name or a
 * list); the zone accepts a `starDraggable` that shares a name. While an accepted drag runs, the
 * zone has the class `star-droppable--active`; while the drag is over it, `star-droppable--over`.
 *
 * `<section starDroppable="orders" dropLabel="Shipped" (dropped)="ship($event.data)">...</section>`
 */
@Directive({
  selector: '[starDroppable]',
  exportAs: 'starDroppable',
  host: {
    class: 'star-droppable',
    '[class.star-droppable--active]': 'active()',
    '[class.star-droppable--over]': 'isOver()',
    '(dragenter)': 'onDragEnter($event)',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)',
  },
})
export class StarDroppable {
  private readonly registry = inject(ɵStarDragRegistry);
  /** The host element. */
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** The scope names that the zone accepts (default `default`). */
  readonly dropScope = input<StarDragScope>(DEFAULT_SCOPE, { alias: 'starDroppable' });
  /**
   * The drop effect of the zone (`dropEffect`). `null` (default) uses the first operation that
   * the draggable allows. An effect that the draggable does not allow refuses the drop.
   */
  readonly dropEffect = input<StarDropEffect | null>(null);
  /** The name of the zone in the announcements. Default: `aria-label`, else the text of the host. */
  readonly dropLabel = input<string | null>(null);
  /** An extra rule: return `false` to refuse a drag (PrimeNG `validateDrop`). */
  readonly dropAccept = input<((data: unknown, source: StarDraggable) => boolean) | null>(null);
  readonly dropDisabled = input(false, { transform: booleanAttribute });

  readonly dragEnter = output<StarDragZoneEvent>();
  readonly dragLeave = output<StarDragZoneEvent>();
  readonly dropped = output<StarDropEvent>();

  private readonly overSignal = signal(false);
  protected readonly isOver = this.overSignal.asReadonly();
  protected readonly active = computed(() => {
    const drag = this.registry.active();
    return !!drag && this.accepts(drag.source);
  });
  /** dragenter minus dragleave events: children of the zone fire them too. */
  private depth = 0;

  constructor() {
    this.registry.zones.add(this);
    inject(DestroyRef).onDestroy(() => this.registry.zones.delete(this));
  }

  /** The name of the zone in the announcements. */
  label(): string {
    return (
      this.dropLabel() ||
      this.element.getAttribute('aria-label') ||
      (this.element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
    );
  }

  /** `true` when the zone takes a drag of `source`. */
  accepts(source: StarDraggable): boolean {
    if (this.dropDisabled() || source.element === this.element) return false;
    if (source.element.contains(this.element)) return false;
    const scopes = scopeList(this.dropScope());
    if (!source.scopes().some((name) => scopes.includes(name))) return false;
    if (ɵstarDropEffect(source.dragEffect(), this.dropEffect()) === null) return false;
    const rule = this.dropAccept();
    return !rule || rule(source.data(), source);
  }

  private zoneEvent(originalEvent: Event | null): StarDragZoneEvent | null {
    const drag = this.registry.active();
    if (!drag) return null;
    return {
      data: drag.source.data(),
      source: drag.source,
      mode: drag.mode,
      originalEvent,
      target: this,
    };
  }

  /** The drag enters the zone. @internal */
  enter(originalEvent: Event | null): void {
    const event = this.zoneEvent(originalEvent);
    if (!event) return;
    this.overSignal.set(true);
    this.dragEnter.emit(event);
  }

  /** The drag leaves the zone. @internal */
  leave(originalEvent: Event | null): void {
    this.depth = 0;
    if (!this.overSignal()) return;
    this.overSignal.set(false);
    const event = this.zoneEvent(originalEvent);
    if (event) this.dragLeave.emit(event);
  }

  /** The drag drops on the zone. @internal */
  drop(originalEvent: Event | null): void {
    const drag = this.registry.active();
    const event = this.zoneEvent(originalEvent);
    this.depth = 0;
    this.overSignal.set(false);
    if (!drag || !event) return;
    drag.dropped = true;
    drag.over = null;
    const dropEffect = ɵstarDropEffect(drag.source.dragEffect(), this.dropEffect()) ?? 'move';
    this.dropped.emit({ ...event, dropEffect });
  }

  /** The accepted pointer drag, or null. */
  private pointerDrag(): ActiveDrag | null {
    const drag = this.registry.active();
    return drag && drag.mode === 'pointer' && this.accepts(drag.source) ? drag : null;
  }

  protected onDragEnter(event: DragEvent): void {
    const drag = this.pointerDrag();
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    this.depth++;
    if (this.depth > 1) return;
    if (drag.over && drag.over !== this) drag.over.leave(event);
    drag.over = this;
    this.enter(event);
  }

  protected onDragOver(event: DragEvent): void {
    const drag = this.pointerDrag();
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const effect = ɵstarDropEffect(drag.source.dragEffect(), this.dropEffect());
    if (event.dataTransfer && effect) event.dataTransfer.dropEffect = effect;
  }

  protected onDragLeave(event: DragEvent): void {
    const drag = this.pointerDrag();
    if (!drag || this.depth === 0) return;
    event.stopPropagation();
    this.depth--;
    if (this.depth > 0) return;
    if (drag.over === this) drag.over = null;
    this.leave(event);
  }

  protected onDrop(event: DragEvent): void {
    const drag = this.pointerDrag();
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    this.drop(event);
  }
}

interface TouchCallbacks {
  /** The drag starts; returns the element to copy under the finger. */
  readonly start: (origin: Event) => HTMLElement;
  readonly move: (x: number, y: number, origin: Event) => void;
  readonly end: (drop: boolean, origin: Event) => void;
}

/** A touch press that turns into a drag after a long press. @internal */
class TouchDrag {
  dragging = false;
  private readonly timer: ReturnType<typeof setTimeout>;
  private ghost: HTMLElement | null = null;
  private readonly startX: number;
  private readonly startY: number;
  private offsetX = 0;
  private offsetY = 0;
  private readonly pointerId: number;
  private readonly listeners: [string, EventListener, AddEventListenerOptions][] = [];

  constructor(
    private readonly doc: Document,
    down: PointerEvent,
    private readonly callbacks: TouchCallbacks,
  ) {
    this.startX = down.clientX;
    this.startY = down.clientY;
    this.pointerId = down.pointerId;
    this.timer = setTimeout(() => this.begin(down), LONG_PRESS_MS);
    this.listen('pointermove', (event) => this.onMove(event as PointerEvent));
    this.listen('pointerup', (event) => this.onEnd(event as PointerEvent, true));
    this.listen('pointercancel', (event) => this.onEnd(event as PointerEvent, false));
    // While the drag runs, the finger must not scroll the page.
    this.listen(
      'touchmove',
      (event) => this.dragging && event.cancelable && event.preventDefault(),
      {
        passive: false,
      },
    );
  }

  private listen(
    type: string,
    listener: EventListener,
    options: AddEventListenerOptions = {},
  ): void {
    this.doc.addEventListener(type, listener, options);
    this.listeners.push([type, listener, options]);
  }

  private begin(down: PointerEvent): void {
    this.dragging = true;
    const source = this.callbacks.start(down);
    const box = source.getBoundingClientRect();
    this.offsetX = down.clientX - box.left;
    this.offsetY = down.clientY - box.top;
    const ghost = source.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('id');
    ghost.classList.add('star-drag-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${box.width}px`;
    this.doc.body.append(ghost);
    this.ghost = ghost;
    this.place(down.clientX, down.clientY);
  }

  private place(x: number, y: number): void {
    if (!this.ghost) return;
    this.ghost.style.transform = `translate(${x - this.offsetX}px, ${y - this.offsetY}px)`;
  }

  private onMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    if (!this.dragging) {
      if (Math.hypot(event.clientX - this.startX, event.clientY - this.startY) > SLOP_PX) {
        this.stop();
      }
      return;
    }
    event.preventDefault();
    this.place(event.clientX, event.clientY);
    this.callbacks.move(event.clientX, event.clientY, event);
  }

  private onEnd(event: PointerEvent, drop: boolean): void {
    if (event.pointerId !== this.pointerId) return;
    const dragging = this.dragging;
    this.stop();
    if (dragging) this.callbacks.end(drop, event);
  }

  stop(): void {
    clearTimeout(this.timer);
    this.dragging = false;
    this.ghost?.remove();
    this.ghost = null;
    for (const [type, listener, options] of this.listeners) {
      this.doc.removeEventListener(type, listener, options);
    }
    this.listeners.length = 0;
  }
}
