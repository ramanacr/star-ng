import { _IdGenerator } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_UI_TEXT } from '@star-ng/ui/core';

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

/** Human-readable size with `Intl.NumberFormat` byte units (kB, MB). */
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
 */
@Component({
  selector: 'star-file-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-upload',
    '[class.star-upload--dragging]': 'dragging()',
    '[class.star-upload--disabled]': 'disabled()',
    '[class.star-upload--invalid]': 'invalid() && touched()',
    '(paste)': 'onPaste($event)',
  },
  template: `
    <div
      class="star-upload__zone"
      (dragenter)="onDrag($event, true)"
      (dragover)="onDrag($event, true)"
      (dragleave)="onDrag($event, false)"
      (drop)="onDrop($event)"
    >
      <i class="ph-bold ph-cloud-arrow-up star-upload__icon" aria-hidden="true"></i>
      <p class="star-upload__lead">{{ text.dropFiles }}</p>
      <label class="star-btn star-btn--secondary star-btn--sm star-upload__choose" [for]="inputId">
        {{ text.chooseFiles }}
      </label>
      <input
        #input
        type="file"
        class="star-sr-only"
        [id]="inputId"
        [attr.accept]="accept() || null"
        [multiple]="multiple()"
        [disabled]="disabled() || readonly()"
        [attr.aria-describedby]="hintId"
        (change)="onPicked(input)"
        (blur)="touch.emit()"
      />
      @if (hint()) {
        <p class="star-upload__hint" [id]="hintId">{{ hint() }}</p>
      }
    </div>

    @if (value().length) {
      <ul class="star-upload__list" [attr.aria-label]="text.chooseFiles">
        @for (file of value(); track file; let i = $index; let first = $first; let last = $last) {
          @let status = statusOf(file);
          <li
            class="star-upload__file"
            [class.star-upload__file--error]="status?.state === 'error'"
            [class.star-upload__file--drop]="dropIndex() === i"
            [attr.draggable]="canReorder() ? 'true' : null"
            (dragstart)="onFileDragStart(i, $event)"
            (dragover)="onFileDragOver(i, $event)"
            (drop)="onFileDrop(i, $event)"
            (dragend)="endFileDrag()"
          >
            @if (status?.state === 'done') {
              <i class="ph-fill ph-check-circle star-upload__state--done" aria-hidden="true"></i>
            } @else if (status?.state === 'error') {
              <i class="ph-fill ph-warning-circle star-upload__state--error" aria-hidden="true"></i>
            } @else if (thumbnailOf(file); as thumbnail) {
              <img class="star-upload__thumb" alt="" [src]="thumbnail" />
            } @else {
              <i class="ph-bold ph-file star-upload__file-icon" aria-hidden="true"></i>
            }
            <span class="star-upload__main">
              <span class="star-upload__name">{{ file.name }}</span>
              @if (status?.state === 'uploading') {
                <span
                  class="star-upload__progress"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-valuenow]="percent(status)"
                  [attr.aria-label]="text.uploadingFile(file.name)"
                >
                  <span class="star-upload__progress-bar" [style.width.%]="percent(status)"></span>
                </span>
              } @else if (status?.state === 'error' && status?.message) {
                <span class="star-upload__message">{{ status?.message }}</span>
              } @else if (status?.state === 'done') {
                <span class="star-sr-only">{{ text.uploaded }}</span>
              }
            </span>
            @if (status?.state === 'uploading') {
              <span class="star-upload__size">{{ percent(status) }}%</span>
            } @else {
              <span class="star-upload__size">{{ size(file) }}</span>
            }
            @if (canReorder()) {
              <button
                type="button"
                class="star-select__icon-btn"
                [disabled]="first"
                [attr.aria-label]="text.moveUp + ': ' + file.name"
                (click)="move(i, i - 1)"
              >
                <i class="ph-bold ph-arrow-up" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                class="star-select__icon-btn"
                [disabled]="last"
                [attr.aria-label]="text.moveDown + ': ' + file.name"
                (click)="move(i, i + 1)"
              >
                <i class="ph-bold ph-arrow-down" aria-hidden="true"></i>
              </button>
            }
            @if (!disabled() && !readonly()) {
              <button
                type="button"
                class="star-select__icon-btn"
                [attr.aria-label]="text.removeItem(file.name)"
                (click)="remove(file)"
              >
                <i class="ph-bold ph-x" aria-hidden="true"></i>
              </button>
            }
          </li>
        }
      </ul>
    }

    @if (rejected().length) {
      <div role="alert">
        <ul class="star-upload__errors">
          @for (item of rejected(); track $index) {
            <li>{{ rejectionText(item) }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class StarFileUpload implements FormValueControl<readonly File[]> {
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
  /** Locale for the file sizes (default: the application locale). */
  readonly locale = input<string | undefined>(undefined);
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

  protected readonly inputId = this.ids.getId('star-upload-');
  protected readonly hintId = this.ids.getId('star-upload-hint-');
  protected readonly dragging = signal(false);
  protected readonly rejected = signal<readonly StarRejectedFile[]>([]);
  protected readonly dropIndex = signal<number | null>(null);
  private dragIndex: number | null = null;
  protected readonly canReorder = computed(
    () => this.reorderable() && !this.disabled() && !this.readonly() && this.value().length > 1,
  );
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly hint = computed(() => {
    const parts: string[] = [];
    if (this.accept()) parts.push(this.accept().split(',').join(', '));
    if (this.maxFileSize())
      parts.push(this.text.fileMaxSize(formatFileSize(this.maxFileSize(), this.locale())));
    if (this.fileLimit()) parts.push(this.text.fileUpTo(this.fileLimit()));
    return parts.join(' · ');
  });

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
    return formatFileSize(file.size, this.locale());
  }

  protected rejectionText(item: StarRejectedFile): string {
    switch (item.reason) {
      case 'type':
        return this.text.fileTypeNotAllowed(item.file.name);
      case 'size':
        return this.text.fileTooLarge(
          item.file.name,
          formatFileSize(this.maxFileSize(), this.locale()),
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
    }
    this.touch.emit();
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
