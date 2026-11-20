import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  output,
} from '@angular/core';
import { STAR_UI_TEXT, StarUiText } from '@star-ng/ui/core';
import { STAR_EDITOR_PALETTE } from './editor-format';

/** Names of the palette colors, in the order of the palette. */
const NAMES: readonly (keyof StarUiText)[] = [
  'spreadsheetBackgroundAccent',
  'spreadsheetBackgroundSuccess',
  'spreadsheetBackgroundWarning',
  'spreadsheetBackgroundDanger',
  'spreadsheetBackgroundMuted',
];

/** `#rrggbb` for the custom color field, from a stored value (a token gives black). */
function hexOf(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
  if (rgb)
    return `#${rgb
      .slice(1, 4)
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')}`;
  return '#000000';
}

/**
 * The color panel of `star-editor` (internal): palette swatches from the theme tokens, "No
 * color", and a custom color field. It sits under the toolbar like the link form; Escape closes
 * it and the editor gives the focus back to the text.
 */
@Component({
  selector: 'star-editor-color',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-editor__panel star-editor__color',
    role: 'group',
    '[attr.aria-label]': 'label()',
    '(keydown.escape)': 'onEscape($event)',
  },
  template: `
    <div class="star-editor__swatches">
      <button
        type="button"
        class="star-btn star-btn--ghost star-btn--sm"
        [attr.aria-pressed]="value() === ''"
        (click)="pick.emit('')"
      >
        {{ text.editorNoColor }}
      </button>
      @for (swatch of swatches(); track swatch.value) {
        <button
          type="button"
          class="star-editor__swatch"
          [style.background]="swatch.value"
          [attr.aria-label]="swatch.name"
          [attr.aria-pressed]="value() === swatch.value"
          [attr.title]="swatch.name"
          (click)="pick.emit(swatch.value)"
        ></button>
      }
    </div>
    <label class="star-editor__color-custom">
      {{ text.customColor }}
      <input #custom type="color" [value]="hex()" (change)="pick.emit(custom.value)" />
    </label>
    <button type="button" class="star-btn star-btn--ghost star-btn--sm" (click)="dismissed.emit()">
      {{ text.close }}
    </button>
  `,
})
export class StarEditorColor {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** `'textColor'` or `'highlight'`. */
  readonly kind = input<'textColor' | 'highlight'>('textColor');
  /** The color at the caret, `''` for none. */
  readonly value = input('');
  readonly pick = output<string>();
  readonly dismissed = output<void>();

  protected readonly label = computed(() =>
    this.kind() === 'textColor' ? this.text.editorTextColor : this.text.editorHighlight,
  );
  protected readonly swatches = computed(() =>
    STAR_EDITOR_PALETTE[this.kind() === 'textColor' ? 'text' : 'highlight'].map((token, index) => ({
      value: `var(--star-${token})`,
      name: this.text[NAMES[index]] as string,
    })),
  );
  protected readonly hex = computed(() => hexOf(this.value()));

  constructor() {
    const injector = inject(Injector);
    afterNextRender(
      () => {
        const pressed = this.host.nativeElement.querySelector<HTMLElement>('[aria-pressed=true]');
        (pressed ?? this.host.nativeElement.querySelector<HTMLElement>('button'))?.focus();
      },
      { injector },
    );
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismissed.emit();
  }
}
