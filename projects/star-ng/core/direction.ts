import { Directionality } from '@angular/cdk/bidi';
import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  EnvironmentProviders,
  Injectable,
  inject,
  provideEnvironmentInitializer,
  signal,
} from '@angular/core';

/** Text direction of an element: left-to-right or right-to-left. */
export type StarDirection = 'ltr' | 'rtl';

/**
 * Text direction in force at one element. A `dir` attribute on the element or on an ancestor
 * decides; with `dir="auto"` or no attribute the computed `direction` decides. The function
 * reads the DOM each time it is called, so a handler that calls it follows a direction change at
 * run time, and a part of the page that has its own `dir` attribute is respected.
 *
 * Controls use it in key handlers and pointer math: the horizontal arrow keys follow the visual
 * direction, so in `rtl` the left arrow means "next".
 */
export function starDirectionOf(element: Element | null | undefined): StarDirection {
  if (!element) return 'ltr';
  const attribute = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
  if (attribute === 'rtl' || attribute === 'ltr') return attribute;
  const view = element.ownerDocument.defaultView;
  return view?.getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
}

/** `true` when the element is laid out right-to-left. See `starDirectionOf`. */
export function starIsRtl(element: Element | null | undefined): boolean {
  return starDirectionOf(element) === 'rtl';
}

/**
 * Key of a keyboard event in "inline" terms: `'ArrowRight'` means toward the end of the line and
 * `'ArrowLeft'` toward the start, whatever the direction. In right-to-left the two arrow keys are
 * swapped; every other key is returned as it is. A handler can then be written once, as for
 * left-to-right text:
 *
 * ```ts
 * switch (starInlineKey(event)) {
 *   case 'ArrowRight': // next item in reading order
 * }
 * ```
 *
 * The element decides the direction; it defaults to `event.currentTarget`.
 */
export function starInlineKey(event: KeyboardEvent, element?: Element | null): string {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return event.key;
  const target = element ?? (event.currentTarget instanceof Element ? event.currentTarget : null);
  if (!starIsRtl(target ?? (event.target instanceof Element ? event.target : null)))
    return event.key;
  return event.key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
}

/**
 * Direction of the application: the `dir` attribute of `<html>` (or `<body>`), followed at run
 * time. Controls that open an overlay or a menu (CDK `Overlay`, `CdkMenu`) inject it. It does
 * two things:
 *
 * 1. `value` is a signal, so a control can react when the application switches the direction.
 * 2. It keeps the root `Directionality` of `@angular/cdk/bidi` in step with the page. That
 *    service reads the attribute once when it is created; without this, overlays and menus
 *    would keep the old direction after a switch.
 *
 * The application only sets `dir` on `<html>`: `document.documentElement.dir = 'rtl'`.
 */
@Injectable({ providedIn: 'root' })
export class StarDirectionService {
  private readonly document = inject(DOCUMENT);
  private readonly directionality = inject(Directionality, { optional: true });

  private readonly current = signal<StarDirection>(this.read());
  /** The direction of the page now. */
  readonly value = this.current.asReadonly();

  constructor() {
    this.sync();
    const view = this.document.defaultView;
    if (!view || typeof view.MutationObserver !== 'function') return;
    const observer = new view.MutationObserver(() => this.refresh());
    const options = { attributes: true, attributeFilter: ['dir'] };
    observer.observe(this.document.documentElement, options);
    if (this.document.body) observer.observe(this.document.body, options);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  /** Reads the attribute again. The observer calls it; call it by hand after a change that the observer cannot see. */
  refresh(): void {
    const next = this.read();
    if (next === this.current()) return;
    this.current.set(next);
    this.sync();
  }

  private read(): StarDirection {
    const raw = (
      this.document.body?.dir ||
      this.document.documentElement.dir ||
      'ltr'
    ).toLowerCase();
    if (raw === 'auto') {
      return this.document.defaultView?.getComputedStyle(this.document.documentElement)
        .direction === 'rtl'
        ? 'rtl'
        : 'ltr';
    }
    return raw === 'rtl' ? 'rtl' : 'ltr';
  }

  private sync(): void {
    const target = this.directionality;
    if (!target || target.valueSignal() === this.current()) return;
    target.valueSignal.set(this.current());
    target.change.emit(this.current());
  }
}

/**
 * Starts `StarDirectionService` when the application starts. Optional: the controls that open
 * an overlay start the service themselves. Use it when the direction changes at run time before
 * any such control exists, or when your own code reads `StarDirectionService.value`.
 *
 * ```ts
 * bootstrapApplication(App, { providers: [provideStarDirection()] });
 * ```
 */
export function provideStarDirection(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    inject(StarDirectionService);
  });
}
