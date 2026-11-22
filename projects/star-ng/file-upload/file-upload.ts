import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  injectStarControlDefaults,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarEmptyContext,
  starFormatFileSize,
  StarIconContext,
  StarSlot,
  starSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { injectStarFieldLink, starJoinIds } from '@star-ng/ui/field';
import type { StarFileContext, StarFileUploadContext } from './file-upload-slots';

/** Payload of `uploadHandler`: the files to upload. PrimeNG `FileUploadHandlerEvent`. */
export interface StarFileUploadHandlerEvent {
  readonly files: readonly File[];
}

export interface StarRejectedFile {
  readonly file: File;
  readonly reason: 'type' | 'size' | 'limit';
}

/** Upload state of one file. The page that uploads the files owns this state. */
export interface StarFileStatus {
  /** Percent sent, 0 to 100. Shows a progress bar while `state` is `'uploading'`. */
  readonly progress?: number;
  readonly state?: 'uploading' | 'done' | 'error';
  /** Error text, shown with `state: 'error'`. */
  readonly message?: string;
}

/**
 * Human-readable size with `Intl.NumberFormat` byte units (kB, MB).
 * @deprecated Use `starFormatFileSize` from `@star-ng/ui/core` (also `null`, terabytes and a
 * `digits` option); the controls use it. This function keeps its 0.3.1 behaviour: gigabytes are
 * the largest unit and `NaN` formats as "NaN byte".
 */
export function formatFileSize(bytes: number, locale?: string): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: units[unit],
    unitDisplay: 'short',
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
}

/** Matches a file against an `accept` list such as `.pdf,image/*,application/msword`. */
export function fileMatchesAccept(file: File, accept: string): boolean {
  if (!accept.trim()) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .some((rule) =>
      rule.startsWith('.')
        ? name.endsWith(rule)
        : rule.endsWith('/*')
          ? type.startsWith(rule.slice(0, -1))
          : type === rule,
    );
}

/**
 * File picker with drag and drop (PrimeNG `p-fileupload`, "advanced" mode without the HTTP
 * part). The value is the list of chosen `File`s; upload them in your own service.
 * Validates `accept`, `maxFileSize` and `fileLimit`, and lists rejected files with a reason.
 *
 * `fileStatus` shows the upload state of each file (progress bar, done, error); the control
 * does not upload (`toUploadStatus()` maps an `HttpClient` upload to that state).
 * `reorderable` lets the user change the file order (buttons or drag). `thumbnails` shows a
 * picture for image files. Files pasted while focus is in the control are added.
 *
 * `<star-file-upload [formField]="form.attachments" accept=".pdf,image/*" [maxFileSize]="10_000_000" multiple />`
 *
 * Slots: `ng-template[starFile]` replaces one row of the file list (`StarFileTemplate`).
 * `ng-template[starEmpty]` shows content in place of the list while no file is chosen. The context
 * of `starEmpty` is `''`, because this control has no filter. `starHeader` adds content above the
 * control; `starFileUploadTemplate` with `toolbar`, `content` or `fileLabel` replaces that part;
 * `starIcon` with `choose`, `upload` or `cancel` replaces the icon of a button.
 *
 * Uploads stay with the owner (no built-in HTTP): `uploadHandler` emits the files when the user
 * presses Upload (`showUploadButton`) or right after they are chosen (`auto`); report the progress
 * with `fileStatus`. PrimeNG names that star-ng covers in another way: `customUpload` = always on;
 * `onSelect` = `selected`; `onBeforeUpload` = `uploadHandler`; the `invalidFile*Message*` inputs =
 * `STAR_UI_TEXT.fileTypeNotAllowed`, `fileTooLarge` and `fileLimitReached`; `style`, `styleClass`,
 * the `*StyleClass` and `*ButtonProps` inputs = `pt`. Not applicable (the owner does the HTTP
 * request): `url`, `method`, `headers`, `withCredentials`, `onSend`, `onUpload`, `onProgress`,
 * `onError` and `onRemoveUploadedFile`.
 */
@Component({
  selector: 'star-file-upload',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarFileUpload) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-upload',
    '[class.star-upload--dragging]': 'dragging()',
    '[class.star-upload--disabled]': 'disabled()',
    '[class.star-upload--invalid]': 'invalid() && touched()',
    '(paste)': 'onPaste($event)',
  },
  template: `
    @if (headerSlot(); as header) {
      <div data-star-part="header" class="star-upload__header">
        <ng-container *ngTemplateOutlet="header" />
      </div>
    }
    <ng-template #buttonIcon let-name="name" let-icon="icon">
      @if (icons().get(name); as custom) {
        <span data-star-part="buttonIcon" class="star-upload__button-icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: iconContext" />
        </span>
      } @else if (icon) {
        <i data-star-part="buttonIcon" [class]="icon" aria-hidden="true"></i>
      }
    </ng-template>
    @if (
      mode() === 'advanced' &&
      (showUploadButton() || showCancelButton() || templates().get('toolbar'))
    ) {
      <div data-star-part="toolbarPanel" class="star-upload__toolbar">
        @if (templates().get('toolbar'); as custom) {
          <ng-container *ngTemplateOutlet="custom; context: actions()" />
        } @else {
          @if (showUploadButton()) {
            <button
              data-star-part="uploadButton"
              type="button"
              class="star-btn star-btn--primary star-btn--sm"
              [disabled]="!interactive() || !value().length"
              (click)="upload()"
            >
              <ng-container
                *ngTemplateOutlet="buttonIcon; context: { name: 'upload', icon: uploadIcon() }"
              />
              {{ uploadLabel() ?? text.upload }}
            </button>
          }
          @if (showCancelButton()) {
            <button
              data-star-part="cancelButton"
              type="button"
              class="star-btn star-btn--secondary star-btn--sm"
              [disabled]="!interactive() || !value().length"
              (click)="clear()"
            >
              <ng-container
                *ngTemplateOutlet="buttonIcon; context: { name: 'cancel', icon: cancelIcon() }"
              />
              {{ cancelLabel() ?? text.cancel }}
            </button>
          }
        }
      </div>
    }
    @if (mode() === 'basic') {
      <label
        data-star-part="chooseButton"
        class="star-btn star-btn--secondary star-btn--sm star-upload__choose"
        [class.star-upload__choose--disabled]="!interactive()"
        [for]="inputId"
      >
        <ng-container
          *ngTemplateOutlet="buttonIcon; context: { name: 'choose', icon: chooseIcon() }"
        />
        @if (templates().get('fileLabel'); as custom) {
          <ng-container *ngTemplateOutlet="custom; context: actions()" />
        } @else {
          {{ basicLabel() }}
        }
      </label>
      <ng-container *ngTemplateOutlet="fileInput" />
    } @else {
      <div
        data-star-part="zonePanel"
        class="star-upload__zone"
        (dragenter)="onDrag($event, true)"
        (dragover)="onDrag($event, true)"
        (dragleave)="onDrag($event, false)"
        (drop)="onDrop($event)"
      >
        <i
          data-star-part="icon"
          class="ph-bold ph-cloud-arrow-up star-upload__icon"
          aria-hidden="true"
        ></i>
        <p data-star-part="leadText" class="star-upload__lead">{{ text.dropFiles }}</p>
        <label
          data-star-part="chooseButton"
          class="star-btn star-btn--secondary star-btn--sm star-upload__choose"
          [for]="inputId"
        >
          <ng-container
            *ngTemplateOutlet="buttonIcon; context: { name: 'choose', icon: chooseIcon() }"
          />
          {{ chooseLabel() ?? text.chooseFiles }}
        </label>
        <ng-container *ngTemplateOutlet="fileInput" />
        @if (hint()) {
          <p data-star-part="hintText" class="star-upload__hint" [id]="hintId">{{ hint() }}</p>
        }
      </div>
    }
    <ng-template #fileInput>
      <input
        #input
        type="file"
        class="star-sr-only"
        [id]="inputId"
        [attr.name]="name() || null"
        [attr.accept]="accept() || null"
        [multiple]="multiple()"
        [disabled]="disabled() || readonly()"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-busy]="fieldBusy()"
        (change)="onPicked(input)"
        (blur)="touch.emit()"
      />
    </ng-template>

    @if (mode() === 'basic') {
      <!-- Basic mode: the button shows the chosen files; no list. -->
    } @else if (templates().get('content'); as custom) {
      <ng-container *ngTemplateOutlet="custom; context: actions()" />
    } @else if (value().length) {
      <ul data-star-part="list" class="star-upload__list" [attr.aria-label]="text.chooseFiles">
        @for (file of value(); track file; let i = $index; let first = $first; let last = $last) {
          @let status = statusOf(file);
          <li
            data-star-part="fileItem"
            class="star-upload__file"
            [class.star-upload__file--error]="status?.state === 'error'"
            [class.star-upload__file--drop]="dropIndex() === i"
            [attr.draggable]="canReorder() ? 'true' : null"
            (dragstart)="onFileDragStart(i, $event)"
            (dragover)="onFileDragOver(i, $event)"
            (drop)="onFileDrop(i, $event)"
            (dragend)="endFileDrag()"
          >
            @if (fileSlot(); as slot) {
              <ng-container *ngTemplateOutlet="slot; context: fileContext(file, i, status)" />
            } @else {
              @if (status?.state === 'done') {
                <i
                  data-star-part="typeIcon"
                  class="ph-fill ph-check-circle star-upload__state--done"
                  aria-hidden="true"
                ></i>
              } @else if (status?.state === 'error') {
                <i
                  data-star-part="typeIcon"
                  class="ph-fill ph-warning-circle star-upload__state--error"
                  aria-hidden="true"
                ></i>
              } @else if (thumbnailOf(file); as thumbnail) {
                <img
                  data-star-part="thumbnail"
                  class="star-upload__thumb"
                  alt=""
                  [src]="thumbnail"
                  [style.width.px]="previewWidth()"
                  [style.height.px]="previewWidth()"
                  (error)="imageError.emit($event)"
                />
              } @else {
                <i
                  data-star-part="typeIcon"
                  class="ph-bold ph-file star-upload__file-icon"
                  aria-hidden="true"
                ></i>
              }
              <span data-star-part="mainPanel" class="star-upload__main">
                <span data-star-part="nameText" class="star-upload__name">{{ file.name }}</span>
                @if (status?.state === 'uploading') {
                  <span
                    data-star-part="progressPanel"
                    class="star-upload__progress"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-valuenow]="percent(status)"
                    [attr.aria-label]="text.uploadingFile(file.name)"
                  >
                    <span
                      data-star-part="progressTrack"
                      class="star-upload__progress-bar"
                      [style.width.%]="percent(status)"
                    ></span>
                  </span>
                } @else if (status?.state === 'error' && status?.message) {
                  <span data-star-part="messageText" class="star-upload__message">{{
                    status?.message
                  }}</span>
                } @else if (status?.state === 'done') {
                  <span class="star-sr-only">{{ text.uploaded }}</span>
                }
              </span>
              @if (status?.state === 'uploading') {
                <span data-star-part="sizeText" class="star-upload__size"
                  >{{ percent(status) }}%</span
                >
              } @else {
                <span data-star-part="sizeText" class="star-upload__size">{{ size(file) }}</span>
              }
              @if (canReorder()) {
                <button
                  data-star-part="clearButton"
                  type="button"
                  class="star-select__icon-btn"
                  [disabled]="first"
                  [attr.aria-label]="text.moveUp + ': ' + file.name"
                  (click)="move(i, i - 1)"
                >
                  <i data-star-part="moveIcon" class="ph-bold ph-arrow-up" aria-hidden="true"></i>
                </button>
                <button
                  data-star-part="clearButton"
                  type="button"
                  class="star-select__icon-btn"
                  [disabled]="last"
                  [attr.aria-label]="text.moveDown + ': ' + file.name"
                  (click)="move(i, i + 1)"
                >
                  <i data-star-part="moveIcon" class="ph-bold ph-arrow-down" aria-hidden="true"></i>
                </button>
              }
              @if (!disabled() && !readonly()) {
                <button
                  data-star-part="clearButton"
                  type="button"
                  class="star-select__icon-btn"
                  [attr.aria-label]="text.removeItem(file.name)"
                  (click)="removeByUser(file)"
                >
                  <i data-star-part="removeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
                </button>
              }
            }
          </li>
        }
      </ul>
    } @else if (emptySlot(); as slot) {
      <ng-container *ngTemplateOutlet="slot; context: emptyContext" />
    }

    @if (rejected().length) {
      <div data-star-part="sectionPanel" role="alert">
        <ul data-star-part="errorsList" class="star-upload__errors">
          @for (item of rejected(); track $index) {
            <li data-star-part="errorsItem">{{ rejectionText(item) }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class StarFileUpload implements FormValueControl<readonly File[]> {
  private readonly defaults = injectStarControlDefaults([]);
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const url of this.thumbnailUrls.values()) URL.revokeObjectURL(url);
    });
  }

  /** The chosen files, in list order. */
  readonly value = model<readonly File[]>([]);
  /** Allowed files: extensions and MIME types such as `.pdf,image/*`. Empty allows every file. */
  readonly accept = input('');
  /** Allows more than one file. Without it a new file replaces the old one. */
  readonly multiple = input(false, { transform: booleanAttribute });
  /** Bytes (0 = no limit). */
  readonly maxFileSize = input(0);
  /** Maximum number of files (0 = no limit). */
  readonly fileLimit = input(0);
  /** Locale for the file sizes. Default: `locale` of `provideStarNg`, else the browser locale. */
  readonly locale = input<string | undefined>(this.defaults.locale ?? undefined);
  /**
   * Upload state of a file, or `null`. Read your own signal in the function: the list then
   * follows the upload.
   */
  readonly fileStatus = input<((file: File) => StarFileStatus | null | undefined) | null>(null);
  /** The user can change the order of the files. */
  readonly reorderable = input(false, { transform: booleanAttribute });
  /** Shows a small picture in place of the file icon for image files. */
  readonly thumbnails = input(false, { transform: booleanAttribute });

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  /** Emits the files that passed the checks, each time files are added. */
  readonly selected = output<readonly File[]>();
  /** Emits the files that failed a check, with the reason (`type`, `size` or `limit`). */
  readonly rejectedChange = output<readonly StarRejectedFile[]>();
  /**
   * `'advanced'` (default): a drop zone and a file list. `'basic'`: one button that chooses the
   * files and shows their names. PrimeNG `mode`.
   */
  readonly mode = input<'advanced' | 'basic'>('advanced');
  /** `name` of the file input, for a native form post (a Signal Forms field sets it too). */
  readonly name = input('');
  /** Emits `uploadHandler` right after files are chosen. PrimeNG `auto`. */
  readonly auto = input(false, { transform: booleanAttribute });
  /** Shows an Upload button above the list that emits `uploadHandler`. */
  readonly showUploadButton = input(false, { transform: booleanAttribute });
  /** Shows a Cancel button above the list that removes every file (`clear`). */
  readonly showCancelButton = input(false, { transform: booleanAttribute });
  /** Text of the choose button (default `STAR_UI_TEXT.chooseFiles`). */
  readonly chooseLabel = input<string | null>(null);
  /** Text of the upload button (default `STAR_UI_TEXT.upload`). */
  readonly uploadLabel = input<string | null>(null);
  /** Text of the cancel button (default `STAR_UI_TEXT.cancel`). */
  readonly cancelLabel = input<string | null>(null);
  /** Icon classes of the choose button (default: none). */
  readonly chooseIcon = input<string | null>(null);
  /** Icon classes of the upload button (default an upload arrow). */
  readonly uploadIcon = input<string | null>('ph-bold ph-upload-simple');
  /** Icon classes of the cancel button (default a cross). */
  readonly cancelIcon = input<string | null>('ph-bold ph-x');
  /** Width and height of the image thumbnails in pixels (with `thumbnails`). */
  readonly previewWidth = input<number | null>(null);
  /**
   * Emits the files to upload when the user presses Upload, or after the choice with `auto`.
   * Upload them in your own service and report the state with `fileStatus`. PrimeNG
   * `uploadHandler` (with `customUpload`).
   */
  readonly uploadHandler = output<StarFileUploadHandlerEvent>();
  /** Emits after Cancel or `clear()` removed every file. PrimeNG `onClear`. */
  readonly cleared = output<void>();
  /** Emits a file that the user removed from the list. PrimeNG `onRemove`. */
  readonly fileRemove = output<File>();
  /** Emits the `error` event of a thumbnail that cannot load. PrimeNG `onImageError`. */
  readonly imageError = output<Event>();

  protected readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly fileSlot = starSlot<StarFileContext>(this.slots, this, 'file');
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly templates = starSlotMap<StarFileUploadContext>(this.slots, this, 'fileUpload');
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};
  /** The context of the toolbar, content and file label slots. */
  protected readonly actions = computed<StarFileUploadContext>(() => ({
    $implicit: this.value(),
    choose: () => this.choose(),
    upload: () => this.upload(),
    clear: () => this.clear(),
    remove: (file: File) => {
      if (this.interactive()) this.removeByUser(file);
    },
    interactive: this.interactive(),
  }));
  /** Text of the basic mode button: the chosen file names, else the choose label. */
  protected readonly basicLabel = computed(() =>
    this.value().length
      ? this.value()
          .map((file) => file.name)
          .join(', ')
      : (this.chooseLabel() ?? this.text.chooseFiles),
  );
  /** The control has no filter, so the empty slot always gets `''`. */
  protected readonly emptyContext: StarEmptyContext = { $implicit: '' };

  protected readonly inputId = this.ids.getId('star-upload-');
  protected readonly hintId = this.ids.getId('star-upload-hint-');
  /** The parent `star-field` when it labels the file input: the label points at it. */
  private readonly field = injectStarFieldLink(() => this.inputId);
  /** `aria-busy` of the control while an async validator of the parent `star-field` runs. */
  protected readonly fieldBusy = computed(() => this.field?.pending() || null);
  /** The hint of the control and the hint or error of the parent `star-field`. */
  protected readonly describedBy = computed(() =>
    starJoinIds(this.hint() ? this.hintId : null, this.field?.describedBy()),
  );
  protected readonly dragging = signal(false);
  protected readonly rejected = signal<readonly StarRejectedFile[]>([]);
  protected readonly dropIndex = signal<number | null>(null);
  private dragIndex: number | null = null;
  protected readonly interactive = computed(() => !this.disabled() && !this.readonly());
  protected readonly canReorder = computed(
    () => this.reorderable() && !this.disabled() && !this.readonly() && this.value().length > 1,
  );
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly hint = computed(() => {
    const parts: string[] = [];
    if (this.accept()) parts.push(this.accept().split(',').join(', '));
    if (this.maxFileSize())
      parts.push(this.text.fileMaxSize(starFormatFileSize(this.maxFileSize(), this.locale())));
    if (this.fileLimit()) parts.push(this.text.fileUpTo(this.fileLimit()));
    return parts.join(' · ');
  });

  protected fileContext(file: File, index: number, status: StarFileStatus | null): StarFileContext {
    return {
      $implicit: file,
      status,
      index,
      interactive: this.interactive(),
      remove: () => {
        if (this.interactive()) this.removeByUser(file);
      },
    };
  }

  protected statusOf(file: File): StarFileStatus | null {
    return this.fileStatus()?.(file) ?? null;
  }

  protected percent(status: StarFileStatus | null): number {
    return Math.round(Math.min(100, Math.max(0, status?.progress ?? 0)));
  }

  /** Moves the file at index `from` to index `to`. */
  move(from: number, to: number): void {
    const files = [...this.value()];
    if (from === to || from < 0 || to < 0 || from >= files.length || to >= files.length) return;
    files.splice(to, 0, ...files.splice(from, 1));
    this.value.set(files);
  }

  protected onFileDragStart(index: number, event: DragEvent): void {
    if (!this.canReorder()) return;
    this.dragIndex = index;
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected onFileDragOver(index: number, event: DragEvent): void {
    if (this.dragIndex === null || this.dragIndex === index) return;
    event.preventDefault();
    this.dropIndex.set(index);
  }

  protected onFileDrop(index: number, event: DragEvent): void {
    if (this.dragIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    this.move(this.dragIndex, index);
    this.endFileDrag();
  }

  protected endFileDrag(): void {
    this.dragIndex = null;
    this.dropIndex.set(null);
  }

  protected size(file: File): string {
    return starFormatFileSize(file.size, this.locale());
  }

  protected rejectionText(item: StarRejectedFile): string {
    switch (item.reason) {
      case 'type':
        return this.text.fileTypeNotAllowed(item.file.name);
      case 'size':
        return this.text.fileTooLarge(
          item.file.name,
          starFormatFileSize(this.maxFileSize(), this.locale()),
        );
      default:
        return this.text.fileLimitReached(this.fileLimit());
    }
  }

  protected onDrag(event: DragEvent, over: boolean): void {
    if (this.disabled() || this.readonly()) return;
    event.preventDefault();
    this.dragging.set(over);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.disabled() || this.readonly() || this.dragIndex !== null) return;
    this.add([...(event.dataTransfer?.files ?? [])]);
  }

  protected onPicked(input: HTMLInputElement): void {
    this.add([...(input.files ?? [])]);
    input.value = '';
  }

  /** Validates and adds files (also usable from code, for example paste handlers). */
  add(files: readonly File[]): void {
    const accepted: File[] = [];
    const rejected: StarRejectedFile[] = [];
    const current = this.multiple() ? this.value() : [];
    const limit = this.multiple() ? this.fileLimit() : 1;
    for (const file of this.multiple() ? files : files.slice(0, 1)) {
      if (!fileMatchesAccept(file, this.accept())) rejected.push({ file, reason: 'type' });
      else if (this.maxFileSize() && file.size > this.maxFileSize())
        rejected.push({ file, reason: 'size' });
      else if (limit && current.length + accepted.length >= limit)
        rejected.push({ file, reason: 'limit' });
      else accepted.push(file);
    }
    this.rejected.set(rejected);
    if (rejected.length) this.rejectedChange.emit(rejected);
    if (accepted.length) {
      this.value.set([...current, ...accepted]);
      this.selected.emit(accepted);
      if (this.auto()) this.uploadHandler.emit({ files: accepted });
    }
    this.touch.emit();
  }

  /** Opens the file dialog of the browser. */
  choose(): void {
    if (this.interactive()) this.input().nativeElement.click();
  }

  /** Emits `uploadHandler` with the chosen files. */
  upload(): void {
    if (!this.interactive() || !this.value().length) return;
    this.uploadHandler.emit({ files: this.value() });
  }

  /** Removes every file and emits `cleared`. */
  clear(): void {
    for (const file of this.value()) this.releaseThumbnail(file);
    this.value.set([]);
    this.rejected.set([]);
    this.cleared.emit();
  }

  /** A remove by the user: the file goes and `fileRemove` emits. */
  protected removeByUser(file: File): void {
    this.remove(file);
    this.fileRemove.emit(file);
  }

  remove(file: File): void {
    this.value.update((files) => files.filter((f) => f !== file));
    this.rejected.set([]);
    this.releaseThumbnail(file);
  }

  /** Object URL per image file, made when first shown and released when the file goes. */
  private readonly thumbnailUrls = new Map<File, string>();

  protected thumbnailOf(file: File): string | null {
    if (!this.thumbnails() || !file.type.startsWith('image/')) return null;
    let url = this.thumbnailUrls.get(file);
    if (!url && typeof URL.createObjectURL === 'function') {
      url = URL.createObjectURL(file);
      this.thumbnailUrls.set(file, url);
    }
    return url ?? null;
  }

  private releaseThumbnail(file: File): void {
    const url = this.thumbnailUrls.get(file);
    if (!url) return;
    URL.revokeObjectURL(url);
    this.thumbnailUrls.delete(file);
  }

  /** Files on the clipboard (a screenshot, a copied file) are added while focus is in the control. */
  protected onPaste(event: ClipboardEvent): void {
    const files = [...(event.clipboardData?.files ?? [])];
    if (!files.length || this.disabled() || this.readonly()) return;
    event.preventDefault();
    this.add(files);
  }

  focus(): void {
    this.input().nativeElement.focus();
  }
}
