import { _IdGenerator } from '@angular/cdk/a11y';
import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  isDevMode,
  model,
  numberAttribute,
  output,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_UI_TEXT, StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';

/** One sampled point of a stroke, in CSS pixels of the drawing area. */
export interface StarSignaturePoint {
  readonly x: number;
  readonly y: number;
  /** Pen pressure from 0 to 1. A mouse or a finger records 0.5. */
  readonly pressure: number;
}

/** One stroke: the points from pointer down to pointer up. */
export type StarSignatureStroke = readonly StarSignaturePoint[];

/** Format of the value of `star-signature-pad`. */
export type StarSignatureFormat = 'png' | 'svg';

/** Input of `starSignatureSvg`. */
export interface StarSignatureSvgOptions {
  readonly width: number;
  readonly height: number;
  readonly strokes: readonly StarSignatureStroke[];
  readonly strokeColor: string;
  readonly strokeWidth: number;
  /** Fill of the whole image. `null` or empty: transparent. */
  readonly backgroundColor?: string | null;
  /** A typed name, drawn in a script-like font instead of strokes. */
  readonly typedText?: string;
  /** An earlier value (a data URL) drawn under the strokes. */
  readonly image?: string | null;
}

/** Script-like system fonts for a typed name. No web font is loaded. */
export const STAR_SIGNATURE_FONT =
  "'Segoe Script', 'Bradley Hand', 'Brush Script MT', 'Snell Roundhand', 'URW Chancery L', cursive";

const round = (value: number) => Math.round(value * 100) / 100;

/** Stroke width for the average pressure of a stroke: 0.5 (mouse) keeps `width`. */
function strokeWidthFor(stroke: StarSignatureStroke, width: number): number {
  const pressure = stroke.reduce((sum, point) => sum + point.pressure, 0) / (stroke.length || 1);
  return round(width * (0.5 + pressure));
}

/** Font size of a typed name for the height of the drawing area. */
function typedFontSize(height: number): number {
  return Math.max(16, Math.min(56, Math.round(height * 0.4)));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * SVG path data of a smooth stroke: quadratic curves through the midpoints of the sampled points.
 * One point is a dot (a very short line with round caps).
 */
export function starSignaturePath(points: StarSignatureStroke): string {
  if (!points.length) return '';
  const [first] = points;
  if (points.length === 1)
    return `M${round(first.x)} ${round(first.y)}L${round(first.x + 0.01)} ${round(first.y)}`;
  let d = `M${round(first.x)} ${round(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const next = points[i + 1];
    d += `Q${round(point.x)} ${round(point.y)} ${round((point.x + next.x) / 2)} ${round((point.y + next.y) / 2)}`;
  }
  const last = points[points.length - 1];
  return `${d}L${round(last.x)} ${round(last.y)}`;
}

/** The signature as SVG markup: background, an earlier image, the strokes and a typed name. */
export function starSignatureSvg(options: StarSignatureSvgOptions): string {
  const { width, height } = options;
  const color = escapeXml(options.strokeColor);
  let body = '';
  if (options.backgroundColor) {
    body += `<rect width="100%" height="100%" fill="${escapeXml(options.backgroundColor)}"/>`;
  }
  if (options.image) {
    body += `<image href="${escapeXml(options.image)}" width="${round(width)}" height="${round(height)}"/>`;
  }
  for (const stroke of options.strokes) {
    if (!stroke.length) continue;
    body +=
      `<path d="${starSignaturePath(stroke)}" fill="none" stroke="${color}" ` +
      `stroke-width="${strokeWidthFor(stroke, options.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const typed = options.typedText?.trim();
  if (typed) {
    body +=
      `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="${color}" ` +
      `font-family="${escapeXml(STAR_SIGNATURE_FONT)}" font-style="italic" ` +
      `font-size="${typedFontSize(height)}">${escapeXml(typed)}</text>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" ` +
    `viewBox="0 0 ${round(width)} ${round(height)}">${body}</svg>`
  );
}

/** Size of the drawing area before it is measured (the default size of a canvas). */
const FALLBACK_SIZE = { width: 300, height: 150 };

/**
 * Signature pad (Kendo UI `SignaturePad`; PrimeNG, Ignite UI and Syncfusion Angular have none in
 * their Angular suites, Syncfusion has `ejs-signature`): a canvas that records strokes drawn with
 * a mouse, a pen (with its pressure) or a finger, smoothed with quadratic curves.
 *
 * The value is a data URL: a PNG of the canvas (`valueFormat="png"`, default) or an SVG built
 * from the stroke points (`valueFormat="svg"`). An empty pad has the value `''`, so a `required`
 * rule of the form fails on it. Works with `[(value)]`, Signal Forms (`[formField]`) and Reactive
 * Forms (through `SignalFormControl`).
 *
 * Accessibility: the pad is a labelled `group`. The canvas cannot be drawn with the keyboard: it
 * is an image whose name says whether it holds a signature. With `allowTyped`, a Draw / Type
 * switch offers a text field; the typed name is drawn in a script-like system font into the value.
 * Clear and Undo are buttons, and a live region announces them.
 *
 * ```html
 * <star-signature-pad [formField]="form.signature" allowTyped valueFormat="svg" />
 * ```
 */
@Component({
  selector: 'star-signature-pad',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-signature',
    role: 'group',
    '[attr.aria-label]': 'labelledBy() ? null : (ariaLabel() ?? text.signaturePad)',
    '[attr.aria-labelledby]': 'labelledBy()',
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.aria-disabled]': 'disabled() || null',
    '[class.star-signature--disabled]': 'disabled()',
    '[class.star-signature--readonly]': 'readonly()',
    '[class.star-signature--typed]': "mode() === 'type'",
    '[class.star-signature--invalid]': '(invalid() && touched()) || !!field?.errorText()',
  },
  template: `
    <div starPart="surface" class="star-signature__surface">
      <canvas
        starPart="canvas"
        #canvas
        class="star-signature__canvas"
        role="img"
        [attr.aria-label]="isEmpty() ? text.signatureArea : text.signatureAreaSigned"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)"
      ></canvas>
    </div>
    <div starPart="bar" class="star-signature__bar">
      @if (allowTyped()) {
        <div starPart="modes" class="star-signature__modes">
          <button
            starPart="drawSignatureButton"
            type="button"
            class="star-btn star-btn--ghost star-btn--sm"
            [attr.aria-pressed]="mode() === 'draw'"
            [disabled]="!interactive()"
            (click)="setMode('draw')"
          >
            <i starPart="drawSignatureIcon" class="ph-bold ph-pen-nib" aria-hidden="true"></i
            >{{ text.drawSignature }}
          </button>
          <button
            starPart="typeSignatureButton"
            type="button"
            class="star-btn star-btn--ghost star-btn--sm"
            [attr.aria-pressed]="mode() === 'type'"
            [disabled]="!interactive()"
            (click)="setMode('type')"
          >
            <i starPart="typeSignatureIcon" class="ph-bold ph-keyboard" aria-hidden="true"></i
            >{{ text.typeSignature }}
          </button>
        </div>
      }
      @if (mode() === 'type') {
        <input
          starPart="typed"
          #typedInput
          type="text"
          class="star-input star-input--sm star-signature__typed"
          autocomplete="name"
          [attr.aria-label]="text.typeYourName"
          [attr.placeholder]="text.typeYourName"
          [attr.aria-required]="required() || null"
          [value]="typed()"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          (input)="onTyped($event)"
          (blur)="touch.emit()"
        />
      }
      <div starPart="actions" class="star-signature__actions">
        @if (mode() === 'draw') {
          <button
            starPart="undoButton"
            type="button"
            class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
            [attr.aria-label]="text.undo"
            [disabled]="!interactive() || !strokes().length"
            (click)="undo()"
          >
            <i
              starPart="undoIcon"
              class="ph-bold ph-arrow-counter-clockwise"
              aria-hidden="true"
            ></i>
          </button>
        }
        <button
          starPart="clearSignatureButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.clearSignature"
          [disabled]="!interactive() || isEmpty()"
          (click)="clear()"
        >
          <i starPart="clearSignatureIcon" class="ph-bold ph-eraser" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    <p class="star-sr-only" [id]="hintId">
      {{ text.signatureHint }}
      @if (allowTyped()) {
        {{ text.signatureTypedHint }}
      }
    </p>
    <p class="star-sr-only" aria-live="polite">{{ status() }}</p>
  `,
})
export class StarSignaturePad implements FormValueControl<string> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  /** Canvas drawing and measuring run in the browser only (the server DOM has no 2D context). */
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * The signature as a data URL (PNG or SVG), `''` while the pad is empty. Only `data:image/`
   * values are drawn; another value stays in the form but the pad shows it as empty.
   */
  readonly value = model('');
  /** Format of the value. `svg` is built from the stroke points and scales without loss. */
  readonly valueFormat = input<StarSignatureFormat>('png');
  /**
   * Color of the strokes on screen. Defaults to the `--star-signature-stroke` token (the strong text
   * color), so it follows the theme. The value uses `exportColor`.
   */
  readonly strokeColor = input<string | null>(null);
  /** Width of a stroke in CSS pixels. A pen with pressure draws from half to one and a half times it. */
  readonly strokeWidth = input(2, { transform: numberAttribute });
  /**
   * Fill of the drawing area on screen. `null` (default): transparent, the page surface shows
   * through. The value uses `exportBackground`.
   */
  readonly backgroundColor = input<string | null>(null);
  /**
   * Ink of the stored value (PNG or SVG). A stored signature is a document, not UI: it does not
   * follow the theme. Default black.
   */
  readonly exportColor = input('#000000');
  /** Fill of the stored value. `null` (default): transparent pixels. */
  readonly exportBackground = input<string | null>(null);
  /** Shows a Draw / Type switch: the user may type the name instead of drawing (keyboard access). */
  readonly allowTyped = input(false, { transform: booleanAttribute });
  /** Accessible name of the group. Defaults to the `signaturePad` text or the `star-field` label. */
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  /** Emits when the user finished a stroke or left the typed name field. */
  readonly touch = output<void>();

  protected readonly field = injectStarFieldLink(null, () => this.focus());
  protected readonly labelledBy = computed(() => starFieldLabelledBy(this.field, this.ariaLabel()));
  protected readonly hintId = inject(_IdGenerator).getId('star-signature-hint-');
  protected readonly describedBy = computed(() =>
    starJoinIds(this.hintId, this.field?.describedBy()),
  );
  protected readonly interactive = computed(() => !this.disabled() && !this.readonly());

  private readonly strokeList = signal<readonly StarSignatureStroke[]>([]);
  /** The finished strokes, oldest first. */
  readonly strokes = this.strokeList.asReadonly();
  /** `draw` or `type` (with `allowTyped`). */
  readonly mode = signal<'draw' | 'type'>('draw');
  protected readonly typed = signal('');
  /** An earlier value that was set from outside: drawn under new strokes. */
  private readonly image = signal<string | null>(null);
  /** True when the pad holds no stroke, no typed name and no earlier image. */
  readonly isEmpty = computed(
    () => !this.strokeList().length && !this.typed().trim() && !this.image(),
  );
  protected readonly status = signal('');
  private announceToggle = false;

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly typedInput = viewChild<ElementRef<HTMLInputElement>>('typedInput');

  /** The stroke being drawn and its pointer. */
  private current: StarSignaturePoint[] | null = null;
  private pointerId: number | null = null;
  /** Size of the drawing area in CSS pixels. */
  private size = { ...FALLBACK_SIZE };
  /** True once `size` was measured (not the fallback). */
  private measured = false;
  private imageElement: HTMLImageElement | null = null;
  /** The last value this pad emitted, to tell outside changes from its own. */
  private emitted = '';

  constructor() {
    // A value from outside (a reset, or a stored signature) replaces the content of the pad.
    effect(() => {
      const value = this.value();
      untracked(() => {
        if (value === this.emitted) return;
        this.emitted = value;
        this.strokeList.set([]);
        this.typed.set('');
        // Only a data URL of an image is drawn: another URL would taint the canvas, and then the
        // PNG export throws. Any other value shows an empty pad.
        const image = value && /^data:image\//i.test(value.trim()) ? value : null;
        if (value && !image && isDevMode()) {
          // Only the scheme: the address itself may hold private data.
          const scheme = /^([a-z][a-z\d+.-]*):/i.exec(value.trim())?.[1];
          console.warn(
            `star-signature-pad: the value must be a data:image/ URL; a ${scheme ? `${scheme.toLowerCase()}: value` : 'non-data URL value'} is shown as an empty pad.`,
          );
        }
        this.image.set(image);
        this.loadImage(image ?? '');
        this.redraw();
      });
    });
    // Redraw when the inputs that change the picture change.
    effect(() => {
      this.strokeColor();
      this.strokeWidth();
      this.backgroundColor();
      untracked(() => this.redraw());
    });
    // A new format, export ink or stroke width changes the stored picture.
    let started = false;
    effect(() => {
      this.valueFormat();
      this.exportColor();
      this.exportBackground();
      this.strokeWidth();
      untracked(() => {
        if (started && this.canRewrite()) this.commit();
        started = true;
      });
    });
    afterNextRender(() => {
      this.measure();
      this.watchTheme();
      const canvas = this.canvas()?.nativeElement;
      if (!canvas) return;
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(canvas);
      this.injector.get(DestroyRef).onDestroy(() => {
        observer.disconnect();
        if (this.frame !== null)
          canvas.ownerDocument.defaultView?.cancelAnimationFrame?.(this.frame);
      });
    });
  }

  /** Removes every stroke and the typed name. Announces it. */
  clear(): void {
    this.current = null;
    this.strokeList.set([]);
    this.typed.set('');
    this.image.set(null);
    this.imageElement = null;
    const field = this.typedInput()?.nativeElement;
    if (field) field.value = '';
    this.redraw();
    this.commit();
    this.announce(this.text.signatureCleared);
  }

  /** Removes the last stroke. Announces it. */
  undo(): void {
    if (!this.strokeList().length) return;
    this.strokeList.update((strokes) => strokes.slice(0, -1));
    this.redraw();
    this.commit();
    this.announce(this.text.strokeUndone);
  }

  /** Focuses the typed name field, else the first enabled button of the pad. */
  focus(): void {
    const target =
      this.typedInput()?.nativeElement ??
      this.host.nativeElement.querySelector<HTMLElement>('button:not([disabled])');
    target?.focus();
  }

  protected setMode(mode: 'draw' | 'type'): void {
    if (mode === this.mode()) return;
    if (!this.isEmpty()) this.clear();
    this.mode.set(mode);
    if (mode === 'type') {
      afterNextRender(() => this.typedInput()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  protected onTyped(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
    this.redraw();
    this.commit();
  }

  protected onPointerDown(event: PointerEvent): void {
    if (!this.interactive() || this.mode() !== 'draw' || event.button > 0) return;
    event.preventDefault();
    this.pointerId = event.pointerId ?? null;
    try {
      this.canvas()?.nativeElement.setPointerCapture?.(event.pointerId);
    } catch {
      // A synthetic pointer cannot be captured.
    }
    this.current = [this.pointOf(event)];
    this.redraw();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.current || (event.pointerId ?? null) !== this.pointerId) return;
    const events = event.getCoalescedEvents?.() ?? [];
    for (const sample of events.length ? events : [event]) this.current.push(this.pointOf(sample));
    this.redraw();
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.current || (event.pointerId ?? null) !== this.pointerId) return;
    const stroke = this.current;
    this.current = null;
    this.pointerId = null;
    this.strokeList.update((strokes) => [...strokes, stroke]);
    this.redraw();
    this.commit();
    this.touch.emit();
  }

  private pointOf(event: PointerEvent): StarSignaturePoint {
    const rect = this.canvas()?.nativeElement.getBoundingClientRect() ?? { left: 0, top: 0 };
    const pressure = event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5;
    return { x: round(event.clientX - rect.left), y: round(event.clientY - rect.top), pressure };
  }

  private announce(message: string): void {
    // A trailing no-break space makes the same message a change, so it is read again.
    this.announceToggle = !this.announceToggle;
    this.status.set(message + (this.announceToggle ? '' : ' '));
  }

  /** Redraws the screen ink when the theme changes (`data-theme`, `class` or the system scheme). */
  private watchTheme(): void {
    const doc = this.host.nativeElement.ownerDocument;
    const view = doc.defaultView;
    const redraw = () => this.redraw();
    const destroyRef = this.injector.get(DestroyRef);
    if (view && typeof view.MutationObserver === 'function') {
      const observer = new view.MutationObserver(redraw);
      observer.observe(doc.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class', 'style'],
      });
      destroyRef.onDestroy(() => observer.disconnect());
    }
    const scheme = view?.matchMedia?.('(prefers-color-scheme: dark)');
    if (scheme?.addEventListener) {
      scheme.addEventListener('change', redraw);
      destroyRef.onDestroy(() => scheme.removeEventListener('change', redraw));
    }
  }

  /**
   * True when the pad may write its value again without a user action (resize, export input
   * change): only an interactive pad with its own strokes or typed text. A stored value alone
   * (an image) stays as it is, so a read-only pad never rewrites the bound value.
   */
  private canRewrite(): boolean {
    return this.interactive() && (this.strokeList().length > 0 || !!this.typed().trim());
  }

  private frame: number | null = null;

  /** Commits once on the next animation frame (browser only): resizes come in bursts. */
  private commitNextFrame(): void {
    const view = this.host.nativeElement.ownerDocument.defaultView;
    if (!this.browser || !view) return;
    if (this.frame !== null) view.cancelAnimationFrame?.(this.frame);
    this.frame = view.requestAnimationFrame(() => {
      this.frame = null;
      if (this.canRewrite()) this.commit();
    });
  }

  /** Writes the value from the current content. */
  private commit(): void {
    let value = '';
    if (!this.isEmpty()) {
      value = this.valueFormat() === 'svg' ? this.svgValue() : this.pngValue();
    }
    this.emitted = value;
    this.value.set(value);
  }

  private svgValue(): string {
    const svg = starSignatureSvg({
      ...this.size,
      strokes: this.strokeList(),
      strokeColor: this.exportColor(),
      strokeWidth: this.strokeWidth(),
      backgroundColor: this.exportBackground(),
      typedText: this.typed(),
      image: this.image(),
    });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  /** The PNG value, drawn on an offscreen canvas with the export ink and fill. */
  private pngValue(): string {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas || !this.browser) return this.svgValue();
    const offscreen = canvas.ownerDocument.createElement('canvas');
    offscreen.width = canvas.width || Math.round(this.size.width);
    offscreen.height = canvas.height || Math.round(this.size.height);
    const context = offscreen.getContext('2d');
    // Without a 2D context (old engines) the SVG is the only picture there is.
    if (!context) return this.svgValue();
    this.paint(context, offscreen.width, this.exportColor(), this.exportBackground(), false);
    try {
      return offscreen.toDataURL('image/png');
    } catch {
      // A tainted canvas (for example an image that a browser treats as cross-origin) cannot be
      // read; the SVG holds the same picture.
      return this.svgValue();
    }
  }

  /** The stroke color: the input, else the token on the host. */
  private resolvedColor(): string {
    const color = this.strokeColor();
    if (color) return color;
    const view = this.host.nativeElement.ownerDocument.defaultView;
    const token = view
      ?.getComputedStyle?.(this.host.nativeElement)
      .getPropertyValue('--star-signature-stroke')
      .trim();
    return token || '#000';
  }

  /** Measures the canvas and scales its pixels by the device pixel ratio. Browser only. */
  private measure(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = canvas.ownerDocument.defaultView?.devicePixelRatio || 1;
    const previous = this.measured ? this.size : null;
    this.size = { width: rect.width, height: rect.height };
    this.measured = true;
    // Points are in CSS pixels: a new size scales them, so the signature keeps its place and shape.
    const scaled = !!previous && (previous.width !== rect.width || previous.height !== rect.height);
    if (scaled) {
      const scale = (stroke: readonly StarSignaturePoint[]) =>
        stroke.map((point) => ({
          x: round((point.x * rect.width) / previous.width),
          y: round((point.y * rect.height) / previous.height),
          pressure: point.pressure,
        }));
      this.strokeList.update((strokes) => strokes.map(scale));
      if (this.current) this.current = scale(this.current);
    }
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    this.redraw();
    if (scaled && this.canRewrite()) this.commitNextFrame();
  }

  private loadImage(value: string): void {
    this.imageElement = null;
    const view = this.host.nativeElement.ownerDocument.defaultView;
    if (!this.browser || !value || !view || typeof view.Image !== 'function') return;
    const image = new view.Image();
    image.onload = () => {
      if (this.image() !== value) return;
      this.imageElement = image;
      this.redraw();
    };
    image.src = value;
  }

  /** Draws the screen canvas: theme ink and screen fill, and the stroke being drawn. */
  private redraw(): void {
    if (!this.browser) return;
    const canvas = this.canvas()?.nativeElement;
    const context = canvas?.getContext?.('2d');
    if (!canvas || !context) return;
    this.paint(context, canvas.width, this.resolvedColor(), this.backgroundColor(), true);
  }

  /** Draws the background, the earlier image, the strokes and the typed name on a context. */
  private paint(
    context: CanvasRenderingContext2D,
    pixelWidth: number,
    color: string,
    background: string | null,
    withCurrent: boolean,
  ): void {
    const ratio = pixelWidth / (this.size.width || FALLBACK_SIZE.width) || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, this.size.width, this.size.height);
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, this.size.width, this.size.height);
    }
    if (this.imageElement) {
      context.drawImage(this.imageElement, 0, 0, this.size.width, this.size.height);
    }
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const strokes =
      withCurrent && this.current ? [...this.strokeList(), this.current] : this.strokeList();
    for (const stroke of strokes) this.drawStroke(context, stroke);
    const typed = this.typed().trim();
    if (typed) {
      context.font = `italic ${typedFontSize(this.size.height)}px ${STAR_SIGNATURE_FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(typed, this.size.width / 2, this.size.height / 2, this.size.width - 16);
    }
  }

  private drawStroke(context: CanvasRenderingContext2D, stroke: StarSignatureStroke): void {
    if (!stroke.length) return;
    context.lineWidth = strokeWidthFor(stroke, this.strokeWidth());
    context.beginPath();
    const [first] = stroke;
    context.moveTo(first.x, first.y);
    if (stroke.length === 1) {
      context.lineTo(first.x + 0.01, first.y);
    } else {
      for (let i = 1; i < stroke.length - 1; i++) {
        const point = stroke[i];
        const next = stroke[i + 1];
        context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
      }
      const last = stroke[stroke.length - 1];
      context.lineTo(last.x, last.y);
    }
    context.stroke();
  }
}
