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
} from '@angular/core';
import { STAR_UI_TEXT, StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import type { StarEditorTableAlign, StarEditorTableBorders } from './editor-table';

/** Rows and columns of the pointer picker. */
const PICKER_ROWS = 8;
const PICKER_COLS = 10;

/**
 * The insert table panel of `star-editor` (internal): rows, columns and a header row, with a
 * grid that a pointer can pick the size from (the fields are the keyboard way). Escape closes it.
 */
@Component({
  selector: 'star-editor-table-insert',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-editor__panel',
    role: 'group',
    '[attr.aria-label]': 'text.editorTable',
    '(keydown.escape)': 'onEscape($event)',
  },
  template: `
    <form starPart="panelForm" class="star-editor__panel-form" novalidate (submit)="submit($event)">
      <div
        starPart="tablePicker"
        class="star-editor__table-picker"
        aria-hidden="true"
        (mouseleave)="hover.set(null)"
      >
        @for (r of pickerRows; track r) {
          @for (c of pickerCols; track c) {
            <button
              starPart="tablePickerCell"
              type="button"
              tabindex="-1"
              class="star-editor__table-picker-cell"
              [class.star-editor__table-picker-cell--on]="
                hover() ? r <= hover()![0] && c <= hover()![1] : r <= rows() && c <= cols()
              "
              (mouseenter)="hover.set([r, c])"
              (click)="pick(r, c)"
            ></button>
          }
        }
        <span starPart="tablePickerSize" class="star-editor__table-picker-size"
          >{{ hover()?.[0] ?? rows() }} × {{ hover()?.[1] ?? cols() }}</span
        >
      </div>
      <label starPart="field" class="star-editor__field star-editor__field--narrow">
        <span starPart="text">{{ text.editorRows }}</span>
        <input
          starPart="input"
          class="star-input star-input--sm"
          type="number"
          min="1"
          max="50"
          [value]="rows()"
          (input)="rows.set(clamp($any($event.target).value, 50))"
        />
      </label>
      <label starPart="field" class="star-editor__field star-editor__field--narrow">
        <span starPart="text">{{ text.columns }}</span>
        <input
          starPart="input"
          class="star-input star-input--sm"
          type="number"
          min="1"
          max="20"
          [value]="cols()"
          (input)="cols.set(clamp($any($event.target).value, 20))"
        />
      </label>
      <label starPart="linkCheck" class="star-editor__link-check">
        <input
          starPart="input"
          type="checkbox"
          [checked]="header()"
          (change)="header.set($any($event.target).checked)"
        />
        {{ text.editorHeaderRow }}
      </label>
      <div starPart="linkActions" class="star-editor__link-actions">
        <button starPart="button" type="submit" class="star-btn star-btn--primary star-btn--sm">
          {{ text.apply }}
        </button>
        <button
          starPart="button"
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
export class StarEditorTableInsert {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly apply = output<{ rows: number; cols: number; header: boolean }>();
  readonly dismissed = output<void>();

  protected readonly pickerRows = Array.from({ length: PICKER_ROWS }, (_, i) => i + 1);
  protected readonly pickerCols = Array.from({ length: PICKER_COLS }, (_, i) => i + 1);
  protected readonly rows = signal(3);
  protected readonly cols = signal(3);
  protected readonly header = signal(true);
  protected readonly hover = signal<[number, number] | null>(null);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const injector = inject(Injector);
    afterNextRender(() => host.nativeElement.querySelector<HTMLElement>('input')?.focus(), {
      injector,
    });
  }

  protected clamp(value: string, max: number): number {
    return Math.max(1, Math.min(max, Math.round(Number(value) || 1)));
  }

  protected pick(rows: number, cols: number): void {
    this.apply.emit({ rows, cols, header: this.header() });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.apply.emit({ rows: this.rows(), cols: this.cols(), header: this.header() });
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismissed.emit();
  }
}

/** The table properties panel of `star-editor` (internal): borders and alignment. */
@Component({
  selector: 'star-editor-table-properties',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-editor__panel',
    role: 'group',
    '[attr.aria-label]': 'text.editorTableProperties',
    '(keydown.escape)': 'onEscape($event)',
  },
  template: `
    <form starPart="panelForm" class="star-editor__panel-form" novalidate (submit)="submit($event)">
      <label starPart="field" class="star-editor__field">
        <span starPart="text">{{ text.editorBorders }}</span>
        <select
          starPart="select"
          class="star-editor__select"
          (change)="borders.set($any($event.target).value)"
        >
          <option starPart="option" value="all" [selected]="borders() === 'all'">
            {{ text.editorBordersAll }}
          </option>
          <option starPart="option" value="rows" [selected]="borders() === 'rows'">
            {{ text.editorBordersRows }}
          </option>
          <option starPart="option" value="none" [selected]="borders() === 'none'">
            {{ text.editorBordersNone }}
          </option>
        </select>
      </label>
      <label starPart="field" class="star-editor__field">
        <span starPart="text">{{ text.editorTableAlign }}</span>
        <select
          starPart="select"
          class="star-editor__select"
          (change)="align.set($any($event.target).value)"
        >
          <option starPart="option" value="start" [selected]="align() === 'start'">
            {{ text.editorAlignStart }}
          </option>
          <option starPart="option" value="center" [selected]="align() === 'center'">
            {{ text.editorAlignCenter }}
          </option>
          <option starPart="option" value="end" [selected]="align() === 'end'">
            {{ text.editorAlignEnd }}
          </option>
        </select>
      </label>
      <div starPart="linkActions" class="star-editor__link-actions">
        <button starPart="button" type="submit" class="star-btn star-btn--primary star-btn--sm">
          {{ text.apply }}
        </button>
        <button
          starPart="button"
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
export class StarEditorTableProperties {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly initial = input<{ borders: StarEditorTableBorders; align: StarEditorTableAlign }>({
    borders: 'all',
    align: 'start',
  });
  readonly apply = output<{ borders: StarEditorTableBorders; align: StarEditorTableAlign }>();
  readonly dismissed = output<void>();

  protected readonly borders = linkedSignal(() => this.initial().borders);
  protected readonly align = linkedSignal(() => this.initial().align);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const injector = inject(Injector);
    afterNextRender(() => host.nativeElement.querySelector<HTMLElement>('select')?.focus(), {
      injector,
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.apply.emit({ borders: this.borders(), align: this.align() });
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismissed.emit();
  }
}
