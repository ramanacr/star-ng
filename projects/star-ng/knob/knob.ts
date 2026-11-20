import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  STAR_UI_TEXT,
  StarDirectionService,
  starIsRtl,
  StarPart,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';

/**
 * Knob (PrimeNG `p-knob`): circular value dial, `role="slider"` with Arrow / PageUp / PageDown /
 * Home / End keys; drag around the dial with a pointer.
 * `<star-knob [(value)]="completion" [max]="100" valueTemplate="{value}%" ariaLabel="Completion" />`
 */
@Component({
  selector: 'star-knob',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-knob', '[class.star-knob--disabled]': 'disabled()' },
  template: `
    <svg
      data-star-part="svg"
      viewBox="0 0 100 100"
      [attr.width]="size()"
      [attr.height]="size()"
      #dial
      role="slider"
      [attr.tabindex]="disabled() ? -1 : 0"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-describedby]="fieldDescribedBy()"
      [attr.aria-valuemin]="lowest()"
      [attr.aria-valuemax]="highest()"
      [attr.aria-valuenow]="value()"
      [attr.aria-valuetext]="text()"
      [attr.aria-disabled]="disabled() || null"
      (keydown)="onKeydown($event)"
      (pointerdown)="onPointer($event)"
      (pointermove)="$event.buttons === 1 && onPointer($event)"
      (blur)="touch.emit()"
    >
      <path data-star-part="track" class="star-knob__track" [attr.d]="arc(1)" />
      <path data-star-part="value" class="star-knob__value" [attr.d]="arc(ratio())" />
      <text data-star-part="text" class="star-knob__text" x="50" y="57" text-anchor="middle">
        {{ text() }}
      </text>
    </svg>
  `,
})
export class StarKnob implements FormValueControl<number> {
  readonly value = model(0);
  readonly min = input<number | undefined>(0);
  readonly max = input<number | undefined>(100);
  readonly step = input(1);
  readonly size = input(120);
  /** `{value}` is replaced by the number, for example `{value}%`. */
  readonly valueTemplate = input('{value}');
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  protected readonly id = inject(_IdGenerator).getId('star-knob-');
  private readonly dial = viewChild.required<ElementRef<SVGSVGElement>>('dial');
  /** The parent `star-field` when it labels the knob: an SVG slider is not labelable. */
  private readonly field = injectStarFieldLink(null, () => this.focus());
  protected readonly labelledBy = computed(() => starFieldLabelledBy(this.field, this.ariaLabel()));
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));

  focus(options?: FocusOptions): void {
    this.dial().nativeElement.focus(options);
  }

  protected readonly lowest = computed(() => this.min() ?? 0);
  protected readonly highest = computed(() => this.max() ?? 100);
  protected readonly ratio = computed(
    () => (this.value() - this.lowest()) / Math.max(1, this.highest() - this.lowest()),
  );
  protected readonly text = computed(() =>
    this.valueTemplate().replace('{value}', String(this.value())),
  );

  /** 270° arc from the lower left, clockwise. */
  protected arc(ratio: number): string {
    const start = (135 * Math.PI) / 180;
    const end = start + Math.max(0.0001, ratio) * 1.5 * Math.PI;
    const p = (a: number) =>
      `${(50 + 40 * Math.cos(a)).toFixed(2)} ${(50 + 40 * Math.sin(a)).toFixed(2)}`;
    return `M ${p(start)} A 40 40 0 ${end - start > Math.PI ? 1 : 0} 1 ${p(end)}`;
  }

  private set(next: number): void {
    if (this.disabled() || this.readonly()) return;
    const stepped = Math.round(next / this.step()) * this.step();
    this.value.set(Math.min(this.highest(), Math.max(this.lowest(), stepped)));
  }

  protected onKeydown(event: KeyboardEvent): void {
    const big = (this.highest() - this.lowest()) / 10;
    const moves: Record<string, number> = {
      ArrowUp: this.step(),
      ArrowRight: this.step(),
      ArrowDown: -this.step(),
      ArrowLeft: -this.step(),
      PageUp: big,
      PageDown: -big,
    };
    if (event.key in moves) {
      event.preventDefault();
      this.set(this.value() + moves[event.key]);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.set(event.key === 'Home' ? this.lowest() : this.highest());
    }
  }

  protected onPointer(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const angle = Math.atan2(
      event.clientY - (box.top + box.height / 2),
      event.clientX - (box.left + box.width / 2),
    );
    let degrees = (angle * 180) / Math.PI - 135;
    if (degrees < 0) degrees += 360;
    if (degrees > 270) return;
    this.set(this.lowest() + (degrees / 270) * (this.highest() - this.lowest()));
  }
}

/** The default swatches on the server, and when no theme token resolves to a color. */
const SWATCHES = [
  '#4f46e5',
  '#0369a1',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#6250d6',
  '#0f172a',
  '#64748b',
];

/** Theme tokens that give the default swatches, in order. Missing tokens are skipped. */
const THEME_SWATCH_TOKENS = [
  '--star-primary',
  '--star-accent',
  '--star-success',
  '--star-warning',
  '--star-danger',
  '--star-info',
  ...Array.from({ length: 12 }, (_, index) => `--star-chart-${index + 1}`),
];

const toHexByte = (channel: number) =>
  Math.round(clamp(channel, 0, 255))
    .toString(16)
    .padStart(2, '0');

/**
 * Converts a computed CSS color (`rgb()`, `rgba()`, or `color(srgb ...)`, comma or space syntax)
 * to `#rrggbb`. Returns `null` when the text is not one of these forms.
 */
function computedColorToHex(text: string): string | null {
  const color = /^color\(\s*srgb\s+([^)]*)\)$/i.exec(text.trim());
  const rgb = /^rgba?\(([^)]*)\)$/i.exec(text.trim());
  const body = color?.[1] ?? rgb?.[1];
  if (body === undefined) return null;
  const parts = body
    .split('/')[0]
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;
  const scale = color ? 255 : 1;
  const channels = parts.slice(0, 3).map((part) => {
    const percent = part.endsWith('%');
    const number = Number.parseFloat(part);
    return percent ? (number / 100) * 255 : number * scale;
  });
  if (channels.some((channel) => !Number.isFinite(channel))) return null;
  return `#${channels.map(toHexByte).join('')}`;
}

/**
 * Reads the theme tokens on `host` and returns them as `#rrggbb` colors, without failures and
 * duplicates. Each value is resolved through a computed `color` on a probe element.
 */
function readThemeSwatches(doc: Document, host: HTMLElement): string[] {
  const view = doc.defaultView;
  if (!view) return [];
  const hostStyle = view.getComputedStyle(host);
  const probe = doc.createElement('span');
  probe.style.display = 'none';
  host.append(probe);
  const found: string[] = [];
  try {
    for (const token of THEME_SWATCH_TOKENS) {
      const raw = hostStyle.getPropertyValue(token).trim();
      if (!raw) continue;
      probe.style.color = '';
      probe.style.color = raw;
      if (!probe.style.color) continue;
      const hex = computedColorToHex(view.getComputedStyle(probe).color);
      if (hex && !found.includes(hex)) found.push(hex);
    }
  } finally {
    probe.remove();
  }
  return found;
}

const PANEL_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
];

/** A color as hue (0–359), saturation (0–100) and value, the brightness (0–100). */
interface Hsv {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

/** HSV of `#rrggbb` text; `null` when the text is not a hex color. */
function hexToHsv(hex: string): Hsv | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const number = parseInt(match[1], 16);
  const [r, g, b] = [(number >> 16) & 255, (number >> 8) & 255, number & 255].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return {
    h: Math.round((h * 60 + 360) % 360) % 360,
    s: Math.round(max ? (delta / max) * 100 : 0),
    v: Math.round(max * 100),
  };
}

/** `#rrggbb` text of an HSV color. */
function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = (v / 100) * (1 - (s / 100) * Math.max(0, Math.min(k, 4 - k, 1)));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

/** The constructor of the `EyeDropper` browser API (not in the TypeScript DOM types yet). */
type StarEyeDropperType = new () => { open(): Promise<{ sRGBHex: string }> };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Color picker (PrimeNG `p-colorpicker`): preset swatches, a custom color panel and a hex field.
 * Value: `#rrggbb`.
 *
 * The custom tile opens a StarNG panel (not the color dialog of the browser) with a saturation
 * and brightness area and a hue slider. Both are sliders for assistive technology: the arrow
 * keys move them (with Shift in steps of 10), Page up / Page down move in steps of 10, Home and
 * End go to the ends. In right-to-left the panel is mirrored.
 *
 * `<star-color-picker [(value)]="tagColor" ariaLabel="Tag color" />`
 */
@Component({
  selector: 'star-color-picker',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, CdkConnectedOverlay, CdkOverlayOrigin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-color', '[class.star-color--open]': 'open()' },
  template: `
    <div
      data-star-part="swatches"
      class="star-color__swatches"
      role="radiogroup"
      [attr.aria-label]="labelledBy() ? null : (ariaLabel() ?? text.colorLabel)"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-describedby]="fieldDescribedBy()"
    >
      @for (swatch of shownSwatches(); track swatch) {
        <button
          data-star-part="swatch"
          type="button"
          role="radio"
          class="star-color__swatch"
          [style.background]="swatch"
          [attr.aria-checked]="swatch.toLowerCase() === value().toLowerCase()"
          [attr.aria-label]="swatch"
          [disabled]="disabled()"
          (click)="commit(swatch)"
        ></button>
      }
    </div>
    <button
      data-star-part="custom"
      #custom
      type="button"
      class="star-color__custom"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      aria-haspopup="dialog"
      [style.background]="value()"
      [attr.aria-label]="text.customColor"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? panelId : null"
      [disabled]="disabled()"
      (click)="togglePanel()"
    ></button>
    @if (canEyeDrop()) {
      <button
        data-star-part="pickButton"
        type="button"
        class="star-btn star-btn--ghost star-btn--icon star-btn--sm star-color__eyedropper"
        [attr.aria-label]="text.eyeDropper"
        [attr.title]="text.eyeDropper"
        [disabled]="disabled()"
        (click)="pickFromScreen()"
      >
        <i data-star-part="pickIcon" class="ph-bold ph-eyedropper" aria-hidden="true"></i>
      </button>
    }
    <input
      data-star-part="hex"
      class="star-input star-input--sm star-color__hex"
      [value]="value()"
      [disabled]="disabled()"
      [attr.aria-label]="text.hexValue(ariaLabel() ?? (field?.label() || text.colorLabel))"
      maxlength="7"
      (change)="onHex($any($event.target))"
      (blur)="touch.emit()"
    />

    <ng-template
      cdkConnectedOverlay
      cdkConnectedOverlayUsePopover="inline"
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      (attach)="onAttached()"
      (detach)="closePanel(false)"
      (overlayOutsideClick)="onOutsideClick($event)"
    >
      <div
        starPart="panel"
        class="star-panel star-date__panel star-color__panel"
        role="dialog"
        [id]="panelId"
        [attr.dir]="rtl() ? 'rtl' : 'ltr'"
        [attr.aria-label]="text.customColor"
        (keydown)="onPanelKeydown($event)"
      >
        <div
          data-star-part="area"
          #area
          class="star-color__area"
          role="slider"
          tabindex="0"
          aria-valuemin="0"
          aria-valuemax="100"
          [style.background]="areaBackground()"
          [attr.aria-label]="text.colorArea"
          [attr.aria-valuenow]="hsv().s"
          [attr.aria-valuetext]="text.colorAreaValue(hsv().s, hsv().v)"
          (keydown)="onAreaKeydown($event)"
          (pointerdown)="onAreaPointer($event, true)"
          (pointermove)="$event.buttons === 1 && onAreaPointer($event, false)"
        >
          <span
            data-star-part="thumb"
            class="star-color__thumb"
            [style.inset-inline-start.%]="hsv().s"
            [style.top.%]="100 - hsv().v"
            [style.background]="value()"
          ></span>
        </div>
        <div
          data-star-part="hueTrack"
          class="star-color__hue"
          role="slider"
          tabindex="0"
          aria-valuemin="0"
          aria-valuemax="359"
          aria-orientation="horizontal"
          [style.background]="hueBackground()"
          [attr.aria-label]="text.hue"
          [attr.aria-valuenow]="hsv().h"
          [attr.aria-valuetext]="text.hueValue(hsv().h)"
          (keydown)="onHueKeydown($event)"
          (pointerdown)="onHuePointer($event, true)"
          (pointermove)="$event.buttons === 1 && onHuePointer($event, false)"
        >
          <span
            data-star-part="thumb"
            class="star-color__thumb"
            [style.inset-inline-start.%]="(hsv().h / 359) * 100"
            [style.background]="hueColor()"
          ></span>
        </div>
        <div data-star-part="bar" class="star-color__bar">
          <span
            data-star-part="preview"
            class="star-color__preview"
            [style.background]="value()"
            aria-hidden="true"
          ></span>
          <span data-star-part="code" class="star-color__code">{{ value() }}</span>
          <button
            data-star-part="barButton"
            type="button"
            class="star-btn star-btn--primary star-btn--sm"
            (click)="closePanel()"
          >
            {{ text.done }}
          </button>
        </div>
      </div>
    </ng-template>
  `,
})
export class StarColorPicker implements FormValueControl<string> {
  /** Keeps the CDK direction (overlays) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  private readonly injector = inject(Injector);

  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The color, as `#rrggbb`. */
  readonly value = model('#4f46e5');
  /**
   * The preset swatches (`#rrggbb`). When you do not set it, the swatches come from the theme:
   * after the first render, the control reads `--star-primary`, `--star-accent`, `--star-success`,
   * `--star-warning`, `--star-danger`, `--star-info` and `--star-chart-1` to `--star-chart-12` on
   * its own element (the tokens that exist). It reads them once, so a later theme change does not
   * update the swatches. On the server, and when no token gives a color, a fixed list is used.
   * A list that you set is always used as it is, and nothing is read.
   */
  readonly swatches = input<readonly string[] | undefined>(undefined);
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  /**
   * The color that the user chose: a swatch, a typed hex value, the custom color panel or the eye
   * dropper. A value that the application sets does not emit. PrimeNG `onChange`.
   */
  readonly changed = output<string>();
  /** The parent `star-field` when it labels the swatch group (a group is not labelable). */
  protected readonly field = injectStarFieldLink(null, () => this.focus());
  protected readonly labelledBy = computed(() => starFieldLabelledBy(this.field, this.ariaLabel()));
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));

  /** Focuses the chosen swatch, else the first one. */
  focus(options?: FocusOptions): void {
    const swatches = [
      ...this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.star-color__swatch'),
    ];
    const chosen = swatches.find((swatch) => swatch.getAttribute('aria-checked') === 'true');
    (chosen ?? swatches[0])?.focus(options);
  }

  constructor() {
    // Browser only (this callback does not run on the server). One read, no theme-change watcher.
    afterNextRender(() => {
      this.canEyeDrop.set(typeof this.eyeDropperType() === 'function');
      if (this.swatches() !== undefined) return;
      const found = readThemeSwatches(this.doc, this.host.nativeElement);
      if (found.length) this.themeSwatches.set(found);
    });
  }

  private readonly themeSwatches = signal<readonly string[] | null>(null);
  /**
   * `true` in a browser with the `EyeDropper` API (PrimeNG `p-inputcolor-eyedropper`). Set after
   * the first render, so the server and the first client render have no eye dropper button.
   */
  protected readonly canEyeDrop = signal(false);

  private eyeDropperType(): StarEyeDropperType | undefined {
    return (this.doc.defaultView as (Window & { EyeDropper?: StarEyeDropperType }) | null)
      ?.EyeDropper;
  }

  /**
   * Opens the eye dropper of the browser. The color that the user picks becomes the value; a
   * cancel (Escape) keeps the value.
   */
  async pickFromScreen(): Promise<void> {
    const EyeDropper = this.eyeDropperType();
    if (this.disabled() || typeof EyeDropper !== 'function') return;
    try {
      const result = await new EyeDropper().open();
      const hex = result?.sRGBHex?.toLowerCase() ?? '';
      if (/^#[0-9a-f]{6}$/.test(hex)) this.commit(hex);
      // A pick is a user interaction, like a blur: Signal Forms mark the field touched.
      this.touch.emit();
    } catch {
      // The user canceled the eye dropper: keep the value.
    }
  }

  /** Sets the value that the user chose and emits `changed`. */
  protected commit(hex: string): void {
    this.value.set(hex);
    this.changed.emit(hex);
  }
  protected readonly shownSwatches = computed(
    () => this.swatches() ?? this.themeSwatches() ?? SWATCHES,
  );

  protected readonly positions = PANEL_POSITIONS;
  protected readonly panelId = this.ids.getId('star-color-panel-');
  protected readonly open = signal(false);

  private readonly custom = viewChild.required<ElementRef<HTMLButtonElement>>('custom');
  private readonly area = viewChild<ElementRef<HTMLElement>>('area');

  /**
   * The color of the panel. It follows the value, but keeps its own hue (and saturation) while
   * the value is a gray, white or black, where the hex text has no hue.
   */
  protected readonly hsv = linkedSignal<string, Hsv>({
    source: this.value,
    computation: (hex, previous) => {
      const before = previous?.value;
      if (before && hsvToHex(before) === hex.toLowerCase()) return before;
      const next = hexToHsv(hex) ?? before ?? { h: 0, s: 0, v: 0 };
      if (!before) return next;
      if (next.v === 0) return { ...before, v: 0 };
      return next.s === 0 ? { ...next, h: before.h } : next;
    },
  });
  /**
   * `true` when the control is laid out right-to-left (read when the panel opens). The panel
   * takes the same direction, wherever the overlay puts it in the page.
   */
  protected readonly rtl = signal(false);

  protected readonly hueColor = computed(() => hsvToHex({ h: this.hsv().h, s: 100, v: 100 }));
  // The gradients are the color model itself (white to the hue, then to black), not theme colors.
  protected readonly areaBackground = computed(() => {
    const end = this.rtl() ? 'to left' : 'to right';
    return `linear-gradient(to top, #000, transparent), linear-gradient(${end}, #fff, ${this.hueColor()})`;
  });
  protected readonly hueBackground = computed(() => {
    const end = this.rtl() ? 'to left' : 'to right';
    return `linear-gradient(${end}, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)`;
  });

  /** Opens the custom color panel. The focus goes to the saturation and brightness area. */
  openPanel(): void {
    if (this.disabled() || this.open()) return;
    this.rtl.set(starIsRtl(this.custom().nativeElement));
    this.open.set(true);
  }

  /** Closes the panel; by default the focus goes back to the custom color tile. */
  closePanel(focusTile = true): void {
    if (!this.open()) return;
    this.open.set(false);
    this.touch.emit();
    if (focusTile) this.custom().nativeElement.focus();
  }

  protected togglePanel(): void {
    if (this.open()) this.closePanel();
    else this.openPanel();
  }

  protected onAttached(): void {
    // The panel content is rendered after the overlay is attached.
    afterNextRender(() => this.area()?.nativeElement.focus(), { injector: this.injector });
  }

  protected onOutsideClick(event: MouseEvent): void {
    if (this.custom().nativeElement.contains(event.target as Node)) return;
    this.closePanel(false);
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closePanel();
    }
  }

  /** Arrow left / right, Home and End: saturation; Arrow up / down, Page up / down: brightness. */
  protected onAreaKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 10 : 1;
    const { s, v } = this.hsv();
    const moves: Record<string, Partial<Hsv>> = {
      ArrowRight: { s: s + step },
      ArrowLeft: { s: s - step },
      ArrowUp: { v: v + step },
      ArrowDown: { v: v - step },
      PageUp: { v: v + 10 },
      PageDown: { v: v - 10 },
      Home: { s: 0 },
      End: { s: 100 },
    };
    const move = moves[this.inlineKey(event)];
    if (!move) return;
    event.preventDefault();
    this.setHsv(move);
  }

  /** The arrow keys move the hue; Page up / down in steps of 10, Home and End to the ends. */
  protected onHueKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 10 : 1;
    const { h } = this.hsv();
    const moves: Record<string, number> = {
      ArrowRight: h + step,
      ArrowUp: h + step,
      ArrowLeft: h - step,
      ArrowDown: h - step,
      PageUp: h + 10,
      PageDown: h - 10,
      Home: 0,
      End: 359,
    };
    const next = moves[this.inlineKey(event)];
    if (next === undefined) return;
    event.preventDefault();
    this.setHsv({ h: next });
  }

  protected onAreaPointer(event: PointerEvent, start: boolean): void {
    const area = event.currentTarget as HTMLElement;
    if (start) this.capture(event, area);
    const box = area.getBoundingClientRect();
    const y = box.height ? clamp((event.clientY - box.top) / box.height, 0, 1) : 0;
    this.setHsv({ s: this.inlineRatio(event.clientX, box) * 100, v: (1 - y) * 100 });
  }

  protected onHuePointer(event: PointerEvent, start: boolean): void {
    const track = event.currentTarget as HTMLElement;
    if (start) this.capture(event, track);
    this.setHsv({ h: this.inlineRatio(event.clientX, track.getBoundingClientRect()) * 359 });
  }

  protected onHex(input: HTMLInputElement): void {
    const raw = input.value.trim();
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9a-f]{6}$/i.test(hex)) this.commit(hex.toLowerCase());
    else input.value = this.value();
  }

  /** Keeps the pointer on the slider while it drags, and the focus on the slider. */
  private capture(event: PointerEvent, element: HTMLElement): void {
    event.preventDefault();
    element.focus();
    element.setPointerCapture?.(event.pointerId);
  }

  /** The key in inline terms: in right-to-left, Arrow left moves toward the end of the line. */
  private inlineKey(event: KeyboardEvent): string {
    if (!this.rtl() || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return event.key;
    return event.key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
  }

  /** 0 at the start of the line and 1 at its end: the left edge in left-to-right. */
  private inlineRatio(clientX: number, box: DOMRect): number {
    const ratio = box.width ? clamp((clientX - box.left) / box.width, 0, 1) : 0;
    return this.rtl() ? 1 - ratio : ratio;
  }

  private setHsv(change: Partial<Hsv>): void {
    if (this.disabled()) return;
    const current = this.hsv();
    const next: Hsv = {
      h: Math.round(clamp(change.h ?? current.h, 0, 359)),
      s: Math.round(clamp(change.s ?? current.s, 0, 100)),
      v: Math.round(clamp(change.v ?? current.v, 0, 100)),
    };
    this.hsv.set(next);
    this.commit(hsvToHex(next));
  }
}
