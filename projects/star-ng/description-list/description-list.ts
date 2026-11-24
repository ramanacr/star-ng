import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  ElementRef,
  inject,
  input,
  numberAttribute,
  signal,
  TemplateRef,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { STAR_UI_TEXT, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarTooltip } from '@star-ng/ui/tooltip';

/** One label and value pair of the `items` input of `star-description-list`. */
export interface StarDescriptionEntry {
  /** The label (the term, `<dt>`). */
  readonly label: string;
  /** The value (`<dd>`). `null`, `undefined` and `''` show the placeholder. */
  readonly value: string | number | null | undefined;
  /** A short help text under the value. */
  readonly hint?: string;
}

/**
 * `stacked`: the label above the value. `inline`: label and value in one row, with a fixed label
 * width. `columns`: stacked pairs that flow into `columns` columns.
 */
export type StarDescriptionListLayout = 'stacked' | 'inline' | 'columns';

/**
 * One pair of `star-description-list` as content: the `label` input and the value as content,
 * for a value with links, tags or icons. The list renders the label and the value in its own
 * `<dt>` and `<dd>`; this element itself is not rendered.
 *
 * ```html
 * <star-description-item label="Status"><star-tag severity="success" value="Paid" /></star-description-item>
 * ```
 */
@Component({
  selector: 'star-description-item',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-template #body><ng-content /></ng-template>',
})
export class StarDescriptionItem {
  /** The label (the term, `<dt>`). */
  readonly label = input.required<string>();
  /** A short help text under the value. */
  readonly hint = input<string | null>(null);
  /** @internal */
  readonly body = viewChild.required<TemplateRef<unknown>>('body');
}

/** A pair as the list renders it: from `items` (`value`) or from content (`template`). */
interface Row {
  readonly label: string;
  readonly hint: string | null;
  readonly value: string | null;
  readonly template: TemplateRef<unknown> | null;
}

/** What the browser measured on the value of one row. */
interface Measured {
  /** The full text of the value (the tooltip of a truncated value). */
  readonly text: string;
  /** The value is cut (`truncate`) and needs the tooltip. */
  readonly overflow: boolean;
  /** A projected value without text and without elements. */
  readonly empty: boolean;
}

const isBlank = (value: string | number | null | undefined): boolean =>
  value === null || value === undefined || value === '';

/**
 * Description list: read-only label and value pairs, for example in a record preview panel. It
 * renders `<dl>`, `<dt>` and `<dd>`, so screen readers announce the pairs. PrimeNG has no
 * description list control.
 *
 * ```html
 * <star-description-list layout="inline" [items]="[{ label: 'City', value: 'Lyon' }]" />
 * <star-description-list layout="columns" [columns]="2">
 *   <star-description-item label="Owner"><a href="mailto:owner@example.com">Owner</a></star-description-item>
 * </star-description-list>
 * ```
 *
 * The pairs of `items` come first, then the projected `star-description-item` elements. An empty
 * value shows the placeholder (default "—", text `emptyValue` of `STAR_UI_TEXT`; screen readers
 * read `noValue`). Long values wrap; with `truncate` they stay on one line and a value that is cut
 * shows its full text in a tooltip on hover and keyboard focus.
 */
@Component({
  selector: 'star-description-list',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet, StarTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]':
      "'star-description-list star-description-list--' + layout() + ' star-description-list--' + size()",
    '[class.star-description-list--truncate]': 'truncate()',
    '[style.--star-description-list-columns]': 'columns()',
    '[style.--star-description-list-label-width]': 'labelWidth()',
  },
  template: `
    <dl data-star-part="list" class="star-description-list__list">
      @for (row of rows(); track $index; let i = $index) {
        <div data-star-part="item" class="star-description-list__item">
          <dt data-star-part="label" class="star-description-list__label">{{ row.label }}</dt>
          <dd data-star-part="description" class="star-description-list__value">
            @if (truncate()) {
              <span
                #value
                data-star-part="valueText"
                class="star-description-list__text"
                [starTooltip]="measured()[i]?.overflow ? measured()[i].text : ''"
                [attr.tabindex]="measured()[i]?.overflow ? 0 : null"
                ><ng-container *ngTemplateOutlet="valueContent; context: { $implicit: row }"
              /></span>
            } @else {
              <span #value data-star-part="valueText" class="star-description-list__text"
                ><ng-container *ngTemplateOutlet="valueContent; context: { $implicit: row }"
              /></span>
            }
            @if (row.template ? measured()[i]?.empty : row.value === null) {
              @if (placeholder() === null) {
                <span
                  data-star-part="placeholderText"
                  class="star-description-list__placeholder"
                  aria-hidden="true"
                  >{{ text.emptyValue }}</span
                >
                <span class="star-sr-only">{{ text.noValue }}</span>
              } @else {
                <span data-star-part="placeholderText" class="star-description-list__placeholder">{{
                  placeholder()
                }}</span>
              }
            }
            @if (row.hint) {
              <span data-star-part="hintText" class="star-description-list__hint">{{
                row.hint
              }}</span>
            }
          </dd>
        </div>
      }
    </dl>
    <ng-template #valueContent let-row>
      @if (row.template) {
        <ng-container *ngTemplateOutlet="row.template" />
      } @else if (row.value !== null) {
        {{ row.value }}
      }
    </ng-template>
  `,
})
export class StarDescriptionList {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  /** The pairs as data. They come before the projected `star-description-item` elements. */
  readonly items = input<readonly StarDescriptionEntry[] | null>(null);
  /** `stacked` (default): label above value. `inline`: one row per pair. `columns`: see `columns`. */
  readonly layout = input<StarDescriptionListLayout>('stacked');
  /**
   * Number of columns of the `columns` layout (default 2). A column is at least 12rem wide, so a
   * narrow list has fewer columns.
   */
  readonly columns = input(2, { transform: numberAttribute });
  /** Width of the labels in the `inline` layout, a CSS length. Default: the token (10rem). */
  readonly labelWidth = input<string | null>(null);
  /** `sm` or `md` (default): text size and gaps. */
  readonly size = input<'sm' | 'md'>('md');
  /**
   * Text of an empty value. Default (`null`): "—" (`emptyValue` of `STAR_UI_TEXT`), which screen
   * readers read as `noValue` ("No value").
   */
  readonly placeholder = input<string | null>(null);
  /** Keeps each value on one line; a value that is cut shows its full text in a tooltip. */
  readonly truncate = input(false, { transform: booleanAttribute });

  private readonly projected = contentChildren(StarDescriptionItem);
  private readonly values = viewChildren<ElementRef<HTMLElement>>('value');

  protected readonly rows = computed<readonly Row[]>(() => [
    ...(this.items() ?? []).map((item) => ({
      label: item.label,
      hint: item.hint || null,
      value: isBlank(item.value) ? null : String(item.value),
      template: null,
    })),
    ...this.projected().map((item) => ({
      label: item.label(),
      hint: item.hint(),
      value: null,
      template: item.body(),
    })),
  ]);

  /** Measured in the browser after each render (and on resize). Empty on the server. */
  protected readonly measured = signal<readonly Measured[]>([]);

  constructor() {
    afterRenderEffect(() => {
      this.values();
      this.rows();
      this.truncate();
      this.measure();
    });
    // A wider or narrower list cuts other values: measure again on resize.
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => {
        if (untracked(this.truncate)) this.measure();
      });
      observer.observe(this.host);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private measure(): void {
    const truncate = untracked(this.truncate);
    const rows = untracked(this.rows);
    const next = untracked(this.values).map((ref, index): Measured => {
      const element = ref.nativeElement;
      const text = (element.textContent ?? '').trim();
      return {
        text,
        overflow: truncate && element.scrollWidth > element.clientWidth,
        empty: !!rows[index]?.template && text === '' && element.children.length === 0,
      };
    });
    const current = untracked(this.measured);
    const same =
      current.length === next.length &&
      current.every(
        (item, index) =>
          item.text === next[index].text &&
          item.overflow === next[index].overflow &&
          item.empty === next[index].empty,
      );
    if (!same) this.measured.set(next);
  }
}
