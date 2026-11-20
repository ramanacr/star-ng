import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  ElementRef,
  forwardRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  StarIconContext,
  StarSeverity,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

export type StarButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'ghost-danger'
  | 'success'
  | 'warning'
  | 'info'
  | 'help'
  | 'contrast';

export type StarButtonSize = 'sm' | 'md' | 'lg';

/**
 * How a button draws its variant: `'filled'` (default), `'outlined'` (border and text in the
 * color of the variant), `'text'` (no fill and no border) or `'link'` (looks like a link).
 * PrimeNG `outlined`, `text` and `link`.
 */
export type StarButtonAppearance = 'filled' | 'outlined' | 'text' | 'link';

/**
 * Button: the one component for every call to action. Variants, sizes, icons, a loading
 * state and an icon-only form. Styles: `@star-ng/ui/styles/controls/_button.scss` (`.star-btn`).
 *
 * `<star-button variant="primary" trailingIcon="ph-bold ph-arrow-right" (pressed)="next()">Next</star-button>`
 *
 * Slots (content children): the content (or `label`) is the text; `starIcon="icon"` replaces the
 * leading icon and `starIcon="loading"` the loading icon.
 *
 * PrimeNG names that star-ng covers in another way: `severity` = `variant` (`primary`,
 * `secondary`, `success`, `info`, `warning`, `help`, `danger`, `contrast`; `plain` = `secondary`
 * or `ghost`), `icon` =
 * `leadingIcon`, `iconPos` = `leadingIcon` or `trailingIcon`, `fluid` = `fullWidth`, `onClick` =
 * `pressed`, `onFocus` and `onBlur` = the native `focusin` and `focusout` events of the host (they
 * bubble from the inner button), `style`, `styleClass` and `buttonProps` = `pt` (part
 * `nativeButton`), the `content` template = the projected content.
 */
@Component({
  selector: 'star-button',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarButton) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.star-button--full]': 'fullWidth()' },
  template: `
    <button
      #native
      data-star-part="nativeButton"
      [type]="type()"
      [class]="classes()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-label]="ariaLabel() ?? (iconOnly() ? label() : null)"
      [attr.tabindex]="tabindex()"
      (click)="onClick($event)"
    >
      @if (loading()) {
        @if (icons().get('loading'); as custom) {
          <span data-star-part="loadingIcon" class="star-btn__icon" aria-hidden="true">
            <ng-container *ngTemplateOutlet="custom; context: iconContext" />
          </span>
        } @else {
          <i
            data-star-part="loadingIcon"
            [class]="loadingIcon() ?? 'ph-bold ph-spinner-gap star-spin'"
            aria-hidden="true"
          ></i>
        }
      } @else if (icons().get('icon'); as custom) {
        <span data-star-part="leadingIcon" class="star-btn__icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: iconContext" />
        </span>
      } @else if (leadingIcon()) {
        <i data-star-part="leadingIcon" [class]="leadingIcon()" aria-hidden="true"></i>
      }
      @if (!iconOnly()) {
        <span data-star-part="text">{{ label() }}<ng-content /></span>
      }
      @if (trailingIcon() && !loading()) {
        <i data-star-part="trailingIcon" [class]="trailingIcon()" aria-hidden="true"></i>
      }
      @if (badge() !== null && badge() !== '') {
        <span
          data-star-part="badgeText"
          class="star-badge star-badge--sm star-btn__badge"
          [class]="'star-badge--' + badgeSeverity()"
          >{{ badge() }}</span
        >
      }
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    :host(.star-button--full) {
      display: flex;
      width: 100%;
    }
  `,
})
export class StarButton {
  readonly variant = input<StarButtonVariant>('primary');
  readonly size = input<StarButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly leadingIcon = input<string | null>(null);
  readonly trailingIcon = input<string | null>(null);
  readonly iconOnly = input(false, { transform: booleanAttribute });
  readonly fullWidth = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);
  /**
   * Text of the button, before the projected content. With `iconOnly` it is the accessible name
   * (when `ariaLabel` is not set). PrimeNG `label`.
   */
  readonly label = input<string | null>(null);
  /** Icon classes of the loading state (default: a turning spinner). PrimeNG `loadingIcon`. */
  readonly loadingIcon = input<string | null>(null);
  /** `'outlined'`, `'text'` or `'link'` draw the variant without its fill. Default `'filled'`. */
  readonly appearance = input<StarButtonAppearance>('filled');
  /** A shadow under the button. PrimeNG `raised`. */
  readonly raised = input(false, { transform: booleanAttribute });
  /** Fully round ends. PrimeNG `rounded`. */
  readonly rounded = input(false, { transform: booleanAttribute });
  /**
   * A small badge after the text, for example a count. The badge text is part of the accessible
   * name; an `ariaLabel` must keep the visible text (WCAG 2.5.3). PrimeNG `badge`.
   */
  readonly badge = input<string | number | null>(null);
  /** Color of the badge. PrimeNG `badgeSeverity`. */
  readonly badgeSeverity = input<StarSeverity>('danger');
  /** `tabindex` of the inner button. */
  readonly tabindex = input<number | null>(null);
  /** Focuses the button once, after the first render (browser only). PrimeNG `autofocus`. */
  readonly autofocus = input(false, { transform: booleanAttribute });

  readonly pressed = output<MouseEvent>();

  private readonly native = viewChild.required<ElementRef<HTMLButtonElement>>('native');
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};

  protected readonly classes = computed(() =>
    [
      'star-btn',
      `star-btn--${this.variant()}`,
      `star-btn--${this.size()}`,
      this.iconOnly() ? 'star-btn--icon' : '',
      this.fullWidth() ? 'star-btn--full' : '',
      this.appearance() !== 'filled' ? `star-btn--${this.appearance()}` : '',
      this.raised() ? 'star-btn--raised' : '',
      this.rounded() ? 'star-btn--rounded' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) this.native().nativeElement.focus();
    });
  }

  onClick(event: MouseEvent): void {
    if (this.disabled() || this.loading()) {
      event.preventDefault();
      return;
    }
    this.pressed.emit(event);
  }
}
