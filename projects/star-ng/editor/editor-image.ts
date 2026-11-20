import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarEditorImageValue, starEditorReadFile, StarEditorUpload } from './editor-media';
import { starEditorUrlAllowed } from './editor-sanitize';

/** Focuses the first field of a panel after it renders. */
function focusFirst(host: ElementRef<HTMLElement>): void {
  const injector = inject(Injector);
  afterNextRender(() => host.nativeElement.querySelector<HTMLElement>('input, button')?.focus(), {
    injector,
  });
}

/**
 * The image panel of `star-editor` (internal): an address or a file, the alternative text
 * (required, or the image is marked decorative), a caption and a width. It sits under the
 * toolbar like the link form; Escape closes it.
 */
@Component({
  selector: 'star-editor-image',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-editor__panel star-editor__image-panel',
    role: 'group',
    '[attr.aria-label]': 'text.editorImage',
    '(keydown.escape)': 'onEscape($event)',
  },
  template: `
    <form
      data-star-part="panelForm"
      class="star-editor__panel-form"
      novalidate
      (submit)="submit($event)"
    >
      <label data-star-part="field" class="star-editor__field">
        <span data-star-part="addressLabel">{{ text.editorImageAddress }}</span>
        <input
          data-star-part="input"
          class="star-input star-input--sm"
          type="text"
          inputmode="url"
          [value]="src().startsWith('data:') ? '' : src()"
          [attr.aria-invalid]="sourceError() ? 'true' : null"
          [attr.aria-describedby]="sourceError() ? sourceErrorId : null"
          (input)="src.set($any($event.target).value); sourceError.set(false)"
        />
      </label>
      <label data-star-part="field" class="star-editor__field">
        <span data-star-part="fileLabel">{{ text.editorImageFile }}</span>
        <input
          data-star-part="fieldInput"
          type="file"
          accept="image/*"
          (change)="chooseFile($any($event.target).files)"
        />
      </label>
      @if (sourceError()) {
        <span data-star-part="panelError" class="star-editor__panel-error" [id]="sourceErrorId">{{
          busy() ? text.editorImageUploading : text.editorImageInvalid
        }}</span>
      }
      <label data-star-part="field" class="star-editor__field">
        <span data-star-part="altLabel">{{ text.editorAltText }}</span>
        <input
          data-star-part="input"
          #altField
          class="star-input star-input--sm"
          type="text"
          [value]="alt()"
          [disabled]="decorative()"
          [attr.aria-invalid]="altError() ? 'true' : null"
          [attr.aria-describedby]="altError() ? altErrorId : null"
          (input)="alt.set(altField.value); altError.set(false)"
        />
      </label>
      @if (altError()) {
        <span data-star-part="panelError" class="star-editor__panel-error" [id]="altErrorId">{{
          text.editorAltRequired
        }}</span>
      }
      <label data-star-part="linkCheck" class="star-editor__link-check">
        <input
          data-star-part="linkCheckInput"
          type="checkbox"
          [checked]="decorative()"
          (change)="decorative.set($any($event.target).checked); altError.set(false)"
        />
        {{ text.editorDecorative }}
      </label>
      <label data-star-part="field" class="star-editor__field">
        <span data-star-part="captionLabel">{{ text.editorCaption }}</span>
        <input
          data-star-part="input"
          class="star-input star-input--sm"
          type="text"
          [value]="caption()"
          (input)="caption.set($any($event.target).value)"
        />
      </label>
      <label data-star-part="field" class="star-editor__field star-editor__field--narrow">
        <span data-star-part="imageWidthText">{{ text.imageWidth }}</span>
        <input
          data-star-part="input"
          class="star-input star-input--sm"
          type="number"
          min="16"
          max="4000"
          step="10"
          [value]="width() ?? ''"
          (input)="width.set(+$any($event.target).value || null)"
        />
      </label>
      <div data-star-part="linkActions" class="star-editor__link-actions">
        <button
          data-star-part="applyButton"
          type="submit"
          class="star-btn star-btn--primary star-btn--sm"
          [disabled]="busy()"
        >
          {{ text.apply }}
        </button>
        <button
          data-star-part="cancelButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm"
          (click)="dismissed.emit()"
        >
          {{ text.cancel }}
        </button>
      </div>
    </form>
  `,
})
export class StarEditorImage {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  protected readonly sourceErrorId = this.ids.getId('star-editor-image-error-');
  protected readonly altErrorId = this.ids.getId('star-editor-alt-error-');

  /** The image at the caret, or `null` for a new image. */
  readonly initial = input<StarEditorImageValue | null>(null);
  /** The owner's upload of a chosen file; without it, a file becomes a `data:` address. */
  readonly upload = input<StarEditorUpload | null>(null);
  /** URL protocols of the allow-list (`sanitize` of the editor). */
  readonly protocols = input<readonly string[]>(['http:', 'https:']);
  readonly apply = output<StarEditorImageValue>();
  readonly dismissed = output<void>();

  protected readonly src = linkedSignal(() => this.initial()?.src ?? '');
  protected readonly alt = linkedSignal(() => this.initial()?.alt ?? '');
  protected readonly decorative = linkedSignal(
    () => !!this.initial() && this.initial()!.alt === '',
  );
  protected readonly caption = linkedSignal(() => this.initial()?.caption ?? '');
  protected readonly width = linkedSignal(() => this.initial()?.width ?? null);
  protected readonly sourceError = signal(false);
  protected readonly altError = signal(false);
  protected readonly busy = signal(false);
  private readonly altField = viewChild.required<ElementRef<HTMLInputElement>>('altField');

  constructor() {
    focusFirst(inject(ElementRef));
  }

  protected async chooseFile(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.sourceError.set(true);
      return;
    }
    this.busy.set(true);
    try {
      const upload = this.upload();
      this.src.set(upload ? await upload(file) : await starEditorReadFile(file));
      this.sourceError.set(false);
    } catch {
      this.sourceError.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const src = this.src().trim();
    const valid =
      !!src &&
      !/[\s<>"]/.test(src) &&
      starEditorUrlAllowed(src, this.protocols(), true) &&
      !/^javascript:/i.test(src);
    this.sourceError.set(!valid);
    const alt = this.decorative() ? '' : this.alt().trim();
    this.altError.set(!this.decorative() && !alt);
    if (!valid || this.altError()) {
      if (this.altError()) this.altField().nativeElement.focus();
      return;
    }
    this.apply.emit({ src, alt, caption: this.caption().trim(), width: this.width() });
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismissed.emit();
  }
}

/**
 * The embed panel of `star-editor` (internal): a video or page address and a title (required:
 * the name of the frame). Only addresses whose player is on the embed hosts of the allow-list
 * pass.
 */
@Component({
  selector: 'star-editor-embed',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],

  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-editor__panel',
    role: 'group',
    '[attr.aria-label]': 'text.editorEmbed',
    '(keydown.escape)': 'onEscape($event)',
  },
  template: `
    <form
      data-star-part="panelForm"
      class="star-editor__panel-form"
      novalidate
      (submit)="submit($event)"
    >
      <label data-star-part="field" class="star-editor__field">
        <span data-star-part="addressLabel">{{ text.editorEmbedAddress }}</span>
        <input
          data-star-part="input"
          #address
          class="star-input star-input--sm"
          type="text"
          inputmode="url"
          [attr.aria-invalid]="urlError() ? 'true' : null"
          [attr.aria-describedby]="urlError() ? urlErrorId : null"
          (input)="urlError.set(false)"
        />
      </label>
      @if (urlError()) {
        <span data-star-part="panelError" class="star-editor__panel-error" [id]="urlErrorId">{{
          text.editorEmbedNotAllowed
        }}</span>
      }
      <label data-star-part="field" class="star-editor__field">
        <span data-star-part="titleText">{{ text.title }}</span>
        <input
          data-star-part="input"
          #name
          class="star-input star-input--sm"
          type="text"
          [attr.aria-invalid]="titleError() ? 'true' : null"
          [attr.aria-describedby]="titleError() ? titleErrorId : null"
          (input)="titleError.set(false)"
        />
      </label>
      @if (titleError()) {
        <span data-star-part="panelError" class="star-editor__panel-error" [id]="titleErrorId">{{
          text.valueRequired
        }}</span>
      }
      <div data-star-part="linkActions" class="star-editor__link-actions">
        <button
          data-star-part="applyButton"
          type="submit"
          class="star-btn star-btn--primary star-btn--sm"
        >
          {{ text.apply }}
        </button>
        <button
          data-star-part="cancelButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm"
          (click)="dismissed.emit()"
        >
          {{ text.cancel }}
        </button>
      </div>
    </form>
  `,
})
export class StarEditorEmbed {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  protected readonly urlErrorId = this.ids.getId('star-editor-embed-error-');
  protected readonly titleErrorId = this.ids.getId('star-editor-embed-title-');

  /** Turns the address into a player address on the allowed hosts, or `null`. */
  readonly resolve = input.required<(url: string) => string | null>();
  readonly apply = output<{ src: string; title: string }>();
  readonly dismissed = output<void>();

  protected readonly urlError = signal(false);
  protected readonly titleError = signal(false);
  private readonly address = viewChild.required<ElementRef<HTMLInputElement>>('address');
  private readonly name = viewChild.required<ElementRef<HTMLInputElement>>('name');

  constructor() {
    focusFirst(inject(ElementRef));
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const src = this.resolve()(this.address().nativeElement.value);
    const title = this.name().nativeElement.value.trim();
    this.urlError.set(!src);
    this.titleError.set(!title);
    if (!src) this.address().nativeElement.focus();
    else if (!title) this.name().nativeElement.focus();
    else this.apply.emit({ src, title });
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismissed.emit();
  }
}
