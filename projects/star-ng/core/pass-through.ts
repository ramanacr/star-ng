// Styling hooks per element (PrimeNG pass-through `pt`) and the unstyled mode. Each control has the
// host directive `StarStyled` (inputs `pt` and `unstyled`); each visible element in its template
// has `starPart="name"`, which sets `data-star-part` and applies the classes, styles and safe
// attributes of that part.
import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewChecked,
  ApplicationRef,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  HostAttributeToken,
  inject,
  InjectionToken,
  input,
  isDevMode,
  PLATFORM_ID,
  Renderer2,
  RendererStyleFlags2,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StarConfigService } from './config';

/** Classes of a part: a string, a list, or a map of class name to on/off (like `[class]`). */
export type StarPassThroughClass = string | readonly string[] | Readonly<Record<string, boolean>>;

/** What a consumer adds to one part of a control. */
export interface StarPassThroughOptions {
  /** Classes added to the part. The classes of the control stay. */
  readonly class?: StarPassThroughClass;
  /** Inline styles, for example `{ 'max-width': '20rem' }` (like `[style]`). */
  readonly style?: Readonly<Record<string, string | number | null>>;
  /**
   * Attributes. Only `title`, `data-*` and `aria-*` are applied; any other name (`id`, every `on*`
   * event handler) is ignored, with a warning in dev mode. `null` or `false` removes it. When the
   * pass-through drops an attribute again, the value of the template comes back.
   */
  readonly attrs?: Readonly<Record<string, string | number | boolean | null>>;
}

/** The pass-through of one control instance: part name to options (`[pt]` input). */
export type StarPassThrough = Readonly<Record<string, StarPassThroughOptions | undefined>>;

/**
 * The global pass-through of `provideStarNg({ pt })`: control tag name (for example
 * `star-select`) to its pass-through. The `pt` input of an instance merges over it.
 */
export type StarGlobalPassThrough = Readonly<Record<string, StarPassThrough | undefined>>;

/** `true` for an attribute name that a pass-through may set. @internal */
export function ɵstarSafePassThroughAttr(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith('on') || lower.startsWith('data-star-')) return false;
  // `id` is refused: other elements of a control refer to its ids (`aria-controls`, labels).
  return lower === 'title' || /^(data|aria)-[a-z0-9_.-]+$/.test(lower);
}

/** The class names of a pass-through `class`. @internal */
export function ɵstarClassList(value: StarPassThroughClass | undefined): string[] {
  if (!value) return [];
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  if (Array.isArray(value)) return value.flatMap((item: string) => ɵstarClassList(item));
  return Object.entries(value as Record<string, boolean>)
    .filter(([, on]) => on)
    .map(([name]) => name);
}

/** The options of one part: `instance` over `global`. Classes add up; styles and attributes merge. @internal */
export function ɵstarMergePassThrough(
  global: StarPassThroughOptions | undefined,
  instance: StarPassThroughOptions | undefined,
): StarPassThroughOptions | null {
  if (!global && !instance) return null;
  if (!global || !instance) return (global ?? instance)!;
  return {
    class: [...ɵstarClassList(global.class), ...ɵstarClassList(instance.class)],
    style: global.style || instance.style ? { ...global.style, ...instance.style } : undefined,
    attrs: global.attrs || instance.attrs ? { ...global.attrs, ...instance.attrs } : undefined,
  };
}

/**
 * The `StarStyled` of the control whose template declares a part. A control provides it in
 * `viewProviders`, so an element that the control projects from another template keeps the
 * pass-through of its own control. @internal
 */
export const ɵSTAR_PART_HOST = new InjectionToken<StarStyled>('STAR_PART_HOST');

/** What the pass-through set on one part element, to undo it. */
interface PartState {
  readonly name: string;
  classes: readonly string[];
  /** Style properties set, with the inline value that the element had before. */
  readonly styles: Map<string, string>;
  /** Attributes set, with the value that the template had before (`null`: none). */
  readonly attrs: Map<string, string | null>;
}

/**
 * Host directive of every control with styling hooks: the inputs `pt` and `unstyled`, the
 * `data-star-unstyled` attribute and the `root` part (the host element). The control name for
 * `provideStarNg({ pt })` is the tag name of the host, for example `star-select`. A control adds:
 *
 * ```ts
 * hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
 * viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
 * ```
 *
 * Fast path: while no pass-through exists for the control and it is not unstyled, the parts are
 * only static `data-star-part` attributes. The first `pt` (or the unstyled mode) switches the parts
 * of the control on, once; a `MutationObserver` then finds the parts that the control creates.
 */
@Directive({
  selector: '[starStyled]',
  host: { 'data-star-part': 'root' },
})
export class StarStyled implements AfterViewChecked {
  private readonly config = inject(StarConfigService).config;
  private readonly renderer = inject(Renderer2);
  private readonly host = inject(ElementRef).nativeElement as Element;
  private readonly name = this.host.localName;

  /**
   * Classes, styles and attributes per part of the control (PrimeNG `pt`), for example
   * `{ root: { class: 'w-full' }, panel: { class: 'shadow-lg' } }`. Merges over the global
   * `provideStarNg({ pt })`. The parts are listed in the API section of each control.
   */
  readonly pt = input<StarPassThrough | null>(null);
  /**
   * `true` removes the visual styles of the control (colors, borders, radius, shadows, fonts and
   * token spacing) and keeps the layout that it needs to work. Unset: `provideStarNg({ unstyled })`.
   */
  readonly unstyled = input<boolean | undefined, unknown>(undefined, {
    transform: (value: unknown) => (value === undefined ? undefined : booleanAttribute(value)),
  });

  /** `true` when the control is unstyled. */
  readonly isUnstyled = computed(() => this.unstyled() ?? this.config().unstyled ?? false);

  private readonly merged = computed(() => {
    const global = this.config().pt?.[this.name];
    const instance = this.pt();
    if (!global) return instance;
    if (!instance) return global;
    const names = new Set([...Object.keys(global), ...Object.keys(instance)]);
    const result: Record<string, StarPassThroughOptions | null> = {};
    for (const name of names) result[name] = ɵstarMergePassThrough(global[name], instance[name]);
    return result as StarPassThrough;
  });
  /** `true` once a pass-through or the unstyled mode applies to the control. */
  private readonly active = computed(() => !!this.merged() || this.isUnstyled());
  /** The part elements that the pass-through or the unstyled mode touched. Empty on the fast path. */
  private readonly parts = new Map<Element, PartState>();
  /**
   * The roots of the portal content of the control (overlay panels, `starPart` on the top element
   * of an `ng-template`): they can render outside the control element.
   */
  private readonly portals = new Set<Element>();
  private observer: MutationObserver | null = null;
  private switchedOn = false;
  /** A browser with `MutationObserver`; on the server the parts are adopted after each render. */
  private readonly canObserve =
    isPlatformBrowser(inject(PLATFORM_ID)) && typeof MutationObserver !== 'undefined';

  constructor() {
    // One effect per control. It does nothing while the fast path holds.
    effect(() => {
      const active = this.active();
      const merged = this.merged();
      const unstyled = this.isUnstyled();
      if (!active && !this.switchedOn) return;
      untracked(() => {
        if (!this.switchedOn) this.switchOn();
        for (const [element, state] of this.parts) {
          if (element !== this.host && !element.isConnected) this.parts.delete(element);
          else this.apply(element, state, merged?.[state.name] ?? null, unstyled);
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
    // On the server a control view can render again on its own (a signal of the control), and
    // then the view hook below does not run: adopt again each time the application becomes
    // stable, so the HTML written after the last render has every part.
    if (!this.canObserve) {
      inject(ApplicationRef)
        .isStable.pipe(takeUntilDestroyed())
        .subscribe((stable) => {
          if (stable) this.adoptAll();
        });
    }
  }

  private adoptAll(): void {
    if (!this.switchedOn || this.observer) return;
    this.adopt(this.host);
    for (const portal of this.portals) this.adopt(portal);
  }

  /** A portal root (`starPart` directive). Tracked at once after the switch. @internal */
  attach(element: Element): void {
    this.portals.add(element);
    if (this.switchedOn) this.adopt(element);
    else if (untracked(this.active)) this.switchOn();
  }

  /** A portal root that goes away: it is no longer tracked or watched. @internal */
  detach(element: Element): void {
    this.portals.delete(element);
    // The records of this task go through the handler first, or the parts in them are lost; a
    // record that added a part of this portal is then undone by `forget`.
    if (this.observer) this.handle(this.observer.takeRecords());
    this.forget(element);
    if (this.observer) {
      // A MutationObserver cannot stop watching one node: watch the host and the portals again.
      this.observer.disconnect();
      this.watch(this.host);
      for (const portal of this.portals) this.watch(portal);
    }
  }

  /**
   * Without a `MutationObserver` (on the server), the parts that a render created are adopted
   * after the render, so the server HTML has the pass-through and the unstyled mode of every part.
   */
  ngAfterViewChecked(): void {
    this.adoptAll();
  }

  /** Tracks the parts that the records add and forgets the ones that they remove. */
  private handle(records: readonly MutationRecord[]): void {
    for (const record of records) {
      // Removed rows and closed panels leave the map, so it holds only parts on the page.
      for (const node of Array.from(record.removedNodes)) {
        if (node.nodeType === 1 && node !== this.host) this.forget(node as Element);
      }
      for (const node of Array.from(record.addedNodes)) {
        if (node.nodeType === 1) this.adopt(node as Element);
      }
    }
  }

  /** Stops tracking `element` and the parts below it (they left the page). */
  private forget(element: Element): void {
    this.parts.delete(element);
    for (const item of Array.from(element.querySelectorAll('[data-star-part]'))) {
      this.parts.delete(item);
    }
  }

  private watch(element: Element): void {
    this.observer?.observe(element, { childList: true, subtree: true });
  }

  /**
   * Switches the parts on: tracks the root and every part of this control that exists now (not
   * those of nested controls), then watches the control and its portals for new parts. The parts
   * are static `data-star-part` attributes, so the fast path has no per-element cost.
   */
  private switchOn(): void {
    this.switchedOn = true;
    this.track(this.host, 'root');
    if (this.canObserve) {
      this.observer = new MutationObserver((records) => this.handle(records));
      this.watch(this.host);
    }
    this.adopt(this.host);
    for (const portal of this.portals) this.adopt(portal);
  }

  /** Tracks `element` and the parts below it that belong to this control, and applies to them. */
  private adopt(element: Element): void {
    if (this.portals.has(element) && element !== this.host) this.watch(element);
    const candidates = [element, ...Array.from(element.querySelectorAll('[data-star-part]'))];
    const merged = untracked(this.merged);
    const unstyled = untracked(this.isUnstyled);
    for (const item of candidates) {
      const name = item.getAttribute('data-star-part');
      if (!name || item === this.host || !this.owns(item)) continue;
      const state = this.track(item, name);
      this.apply(item, state, merged?.[name] ?? null, unstyled);
    }
  }

  /** `true` when the part belongs to this control (not to a control nested in it). */
  private owns(element: Element): boolean {
    if (element.getAttribute('data-star-part') === 'root') return false;
    if (this.portals.has(element)) return true;
    for (let node = element.parentElement; node; node = node.parentElement) {
      if (node === this.host || this.portals.has(node)) return true;
      if (node.getAttribute('data-star-part') === 'root') return false;
    }
    return false;
  }

  private track(element: Element, name: string): PartState {
    let state = this.parts.get(element);
    if (!state) {
      state = { name, classes: [], styles: new Map(), attrs: new Map() };
      this.parts.set(element, state);
    }
    return state;
  }

  private apply(
    element: Element,
    state: PartState,
    options: StarPassThroughOptions | null,
    unstyled: boolean,
  ): void {
    const renderer = this.renderer;
    if (unstyled) renderer.setAttribute(element, 'data-star-unstyled', '');
    else renderer.removeAttribute(element, 'data-star-unstyled');

    const classes = ɵstarClassList(options?.class);
    for (const name of state.classes) {
      if (!classes.includes(name)) renderer.removeClass(element, name);
    }
    for (const name of classes) renderer.addClass(element, name);
    state.classes = classes;

    const inline = (element as HTMLElement).style;
    const styles = options?.style ?? {};
    for (const [name, before] of state.styles) {
      if (styles[name] !== undefined && styles[name] !== null) continue;
      if (before) renderer.setStyle(element, name, before, RendererStyleFlags2.DashCase);
      else renderer.removeStyle(element, name, RendererStyleFlags2.DashCase);
      state.styles.delete(name);
    }
    for (const [name, value] of Object.entries(styles)) {
      if (value === null || value === undefined) continue;
      if (!state.styles.has(name)) state.styles.set(name, inline?.getPropertyValue?.(name) ?? '');
      renderer.setStyle(element, name, String(value), RendererStyleFlags2.DashCase);
    }

    const attrs = options?.attrs ?? {};
    for (const [name, before] of state.attrs) {
      if (name in attrs) continue;
      if (before === null) renderer.removeAttribute(element, name);
      else renderer.setAttribute(element, name, before);
      state.attrs.delete(name);
    }
    for (const [name, value] of Object.entries(attrs)) {
      if (!ɵstarSafePassThroughAttr(name)) {
        if (isDevMode()) console.warn(`StarNG: pass-through attribute "${name}" is not allowed.`);
        continue;
      }
      if (!state.attrs.has(name)) state.attrs.set(name, element.getAttribute(name));
      if (value === null || value === false) renderer.removeAttribute(element, name);
      else renderer.setAttribute(element, name, value === true ? '' : String(value));
    }
  }
}

/**
 * Names the top element of portal content of a control (an overlay panel in an `ng-template`) as
 * a part: `<div starPart="panel">` (a static attribute). It sets `data-star-part="panel"` and lets
 * the control find the panel wherever it renders. Every other element of a template carries the
 * static attribute `data-star-part` only, with no directive. The classes, styles and safe
 * attributes of `pt` and the unstyled mode come from the control (`StarStyled`).
 */
@Directive({ selector: '[starPart]' })
export class StarPart {
  constructor() {
    const name = inject(new HostAttributeToken('starPart'));
    const element = inject(ElementRef).nativeElement as Element;
    inject(Renderer2).setAttribute(element, 'data-star-part', name);
    const host = inject(ɵSTAR_PART_HOST, { optional: true });
    if (!host) return;
    host.attach(element);
    inject(DestroyRef).onDestroy(() => host.detach(element));
  }
}
