// Styling hooks per element (PrimeNG pass-through `pt`) and the unstyled mode. Each control has the
// host directive `StarStyled` (inputs `pt` and `unstyled`); each visible element in its template
// has `starPart="name"`, which sets `data-star-part` and applies the classes, styles and safe
// attributes of that part.
import {
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  input,
  isDevMode,
  OnInit,
  Renderer2,
  Signal,
  untracked,
} from '@angular/core';
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
   * Attributes. Only `id`, `title`, `data-*` and `aria-*` are applied; any other name (and every
   * `on*` event handler) is ignored, with a warning in dev mode. `null` or `false` removes it.
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
  return lower === 'id' || lower === 'title' || /^(data|aria)-[a-z0-9_.-]+$/.test(lower);
}

function classList(value: StarPassThroughClass | undefined): string[] {
  if (!value) return [];
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  if (Array.isArray(value)) return value.flatMap((item: string) => classList(item));
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
    class: [...classList(global.class), ...classList(instance.class)],
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

/**
 * Host directive of every control with styling hooks: the inputs `pt` and `unstyled`, the
 * `data-star-unstyled` attribute and the `root` part (the host element). The control name for
 * `provideStarNg({ pt })` is the tag name of the host, for example `star-select`. A control adds:
 *
 * ```ts
 * hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
 * viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
 * ```
 */
@Directive({
  selector: '[starStyled]',
  host: {
    'data-star-part': 'root',
    '[attr.data-star-unstyled]': 'isUnstyled() ? "" : null',
    '[class]': 'rootOptions()?.class ?? null',
    '[style]': 'rootOptions()?.style ?? null',
  },
})
export class StarStyled {
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
  private readonly parts = new Map<string, Signal<StarPassThroughOptions | null>>();
  protected readonly rootOptions = this.part('root');
  /** The part elements with the attributes that this directive set on them. */
  private readonly elements = new Map<Element, { name: string; applied: readonly string[] }>();

  constructor() {
    this.elements.set(this.host, { name: 'root', applied: [] });
    // One effect per control (not per part) applies the attributes of every part.
    effect(() => {
      const merged = this.merged();
      if (!merged && ![...this.elements.values()].some((entry) => entry.applied.length)) return;
      for (const element of this.elements.keys()) this.applyAttrs(element);
    });
  }

  /** The merged options of one part, as a signal. */
  part(name: string): Signal<StarPassThroughOptions | null> {
    let signal = this.parts.get(name);
    if (!signal) {
      signal = computed(() => this.merged()?.[name] ?? null);
      this.parts.set(name, signal);
    }
    return signal;
  }

  /** Adds a part element; its attributes follow the pass-through. @internal */
  register(element: Element, name: string): void {
    this.elements.set(element, { name, applied: [] });
    untracked(() => this.applyAttrs(element));
  }

  /** Removes a part element. @internal */
  unregister(element: Element): void {
    this.elements.delete(element);
  }

  private applyAttrs(element: Element): void {
    const entry = this.elements.get(element);
    if (!entry) return;
    const attrs = this.part(entry.name)()?.attrs ?? {};
    for (const name of entry.applied) {
      if (!(name in attrs)) this.renderer.removeAttribute(element, name);
    }
    const applied: string[] = [];
    for (const [name, value] of Object.entries(attrs)) {
      if (!ɵstarSafePassThroughAttr(name)) {
        if (isDevMode()) console.warn(`StarNG: pass-through attribute "${name}" is not allowed.`);
        continue;
      }
      if (value === null || value === false) {
        this.renderer.removeAttribute(element, name);
      } else {
        this.renderer.setAttribute(element, name, value === true ? '' : String(value));
        applied.push(name);
      }
    }
    entry.applied = applied;
  }
}

/**
 * Names an element of a control template as a part: `<div starPart="header">`. It sets
 * `data-star-part="header"`, the classes, styles and safe attributes of `pt.header`, and
 * `data-star-unstyled` when the control is unstyled. Outside a control it only sets the name.
 */
@Directive({
  selector: '[starPart]',
  host: {
    '[attr.data-star-part]': 'starPart()',
    '[attr.data-star-unstyled]': 'host?.isUnstyled() ? "" : null',
    '[class]': 'options()?.class ?? null',
    '[style]': 'options()?.style ?? null',
  },
})
export class StarPart implements OnInit {
  protected readonly host = inject(ɵSTAR_PART_HOST, { optional: true });
  private readonly element = inject(ElementRef).nativeElement as Element;
  /** The part name, for example `header`. */
  readonly starPart = input.required<string>();
  protected readonly options = computed(() => this.host?.part(this.starPart())() ?? null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.host?.unregister(this.element));
  }

  ngOnInit(): void {
    this.host?.register(this.element, this.starPart());
  }
}
