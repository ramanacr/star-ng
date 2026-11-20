import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

export type StarButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'danger' | 'ghost-danger' | 'success' | 'warning';

export type StarButtonSize = 'sm' | 'md' | 'lg';

/**
 * Button: the one component for every call to action. Variants, sizes, icons, a loading
 * state and an icon-only form. Styles: `@star-ng/ui/styles/controls/_button.scss` (`.star-btn`).
 *
 * `<star-button variant="primary" trailingIcon="ph-bold ph-arrow-right" (pressed)="next()">Next</star-button>`
 */
@Component({
  selector: 'star-button',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.star-button--full]': 'fullWidth()' },
  template: `
    <button
      data-star-part="nativeButton"
      [type]="type()"
      [class]="classes()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-label]="ariaLabel()"
      (click)="onClick($event)"
    >
      @if (loading()) {
        <i
          data-star-part="loadingIcon"
          class="ph-bold ph-spinner-gap star-spin"
          aria-hidden="true"
        ></i>
      } @else if (leadingIcon()) {
        <i data-star-part="leadingIcon" [class]="leadingIcon()" aria-hidden="true"></i>
      }
      @if (!iconOnly()) {
        <span data-star-part="text"><ng-content /></span>
      }
      @if (trailingIcon() && !loading()) {
        <i data-star-part="trailingIcon" [class]="trailingIcon()" aria-hidden="true"></i>
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

  readonly pressed = output<MouseEvent>();

  protected readonly classes = computed(() =>
    [
      'star-btn',
      `star-btn--${this.variant()}`,
      `star-btn--${this.size()}`,
      this.iconOnly() ? 'star-btn--icon' : '',
      this.fullWidth() ? 'star-btn--full' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  onClick(event: MouseEvent): void {
    if (this.disabled() || this.loading()) {
      event.preventDefault();
      return;
    }
    this.pressed.emit(event);
  }
}
