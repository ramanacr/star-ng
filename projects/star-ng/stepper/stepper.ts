import { _IdGenerator } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  forwardRef,
  inject,
  input,
  model,
} from '@angular/core';
import { STAR_UI_TEXT, StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/** One step of `star-stepper`; its content is the step panel. */
@Component({
  selector: 'star-step',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-stepper__panel',
    role: 'region',
    '[id]': 'panelId',
    '[attr.aria-labelledby]': 'headerId',
    '[hidden]': '!active()',
  },
  template: `<ng-content />`,
})
export class StarStep {
  private readonly stepper = inject(forwardRef(() => StarStepper));
  private readonly ids = inject(_IdGenerator);

  readonly value = input.required<string>();
  readonly label = input.required<string>();
  readonly description = input('');
  /** Marks the step done (check icon). In linear mode, later steps unlock only after this. */
  readonly completed = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  readonly headerId = this.ids.getId('star-step-');
  readonly panelId = this.ids.getId('star-step-panel-');
  readonly active = computed(() => this.stepper.current() === this.value());
}

/**
 * Stepper (PrimeNG `p-stepper`): numbered steps with completed / current / upcoming states,
 * `[(value)]` for the active step, `linear` mode (a step opens only after all earlier steps
 * are `completed`), and `next()` / `previous()` for wizard buttons.
 *
 * ```html
 * <star-stepper #wizard [(value)]="step" linear>
 *   <star-step value="requester" label="Requester" [completed]="form.requester().valid()">…</star-step>
 *   <star-step value="question" label="Question">…</star-step>
 * </star-stepper>
 * ```
 */
@Component({
  selector: 'star-stepper',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-stepper' },
  template: `
    <ol
      starPart="list"
      class="star-stepper__list"
      [attr.aria-label]="ariaLabel() ?? text.stepperLabel"
    >
      @for (step of steps(); track step.value(); let i = $index; let last = $last) {
        <li
          starPart="item"
          class="star-stepper__item"
          [class.star-stepper__item--active]="step.active()"
          [class.star-stepper__item--done]="step.completed()"
        >
          <button
            starPart="header"
            type="button"
            class="star-stepper__header"
            [id]="step.headerId"
            [attr.aria-controls]="step.panelId"
            [attr.aria-current]="step.active() ? 'step' : null"
            [disabled]="!reachable(i)"
            (click)="value.set(step.value())"
          >
            <span starPart="number" class="star-stepper__number" aria-hidden="true">
              @if (step.completed() && !step.active()) {
                <i starPart="numberIcon" class="ph-bold ph-check"></i>
              } @else {
                {{ i + 1 }}
              }
            </span>
            <span starPart="text" class="star-stepper__text">
              <span starPart="label" class="star-stepper__label">{{ step.label() }}</span>
              @if (step.description()) {
                <span starPart="desc" class="star-stepper__desc">{{ step.description() }}</span>
              }
            </span>
            @if (step.completed()) {
              <span class="star-sr-only">{{ text.stepCompleted }}</span>
            }
          </button>
          @if (!last) {
            <span starPart="line" class="star-stepper__line" aria-hidden="true"></span>
          }
        </li>
      }
    </ol>
    <ng-content />
  `,
})
export class StarStepper {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly value = model<string | null>(null);
  readonly linear = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);

  protected readonly steps = contentChildren(StarStep);

  readonly current = computed(() => this.value() ?? this.steps()[0]?.value() ?? null);
  readonly index = computed(() => this.steps().findIndex((s) => s.value() === this.current()));
  readonly isFirst = computed(() => this.index() <= 0);
  readonly isLast = computed(() => this.index() === this.steps().length - 1);

  protected reachable(index: number): boolean {
    const steps = this.steps();
    if (steps[index]?.disabled()) return false;
    if (!this.linear()) return true;
    return steps.slice(0, index).every((step) => step.completed());
  }

  next(): void {
    const index = this.index();
    if (index < this.steps().length - 1 && this.reachable(index + 1)) {
      this.value.set(this.steps()[index + 1].value());
    }
  }

  previous(): void {
    const index = this.index();
    if (index > 0) this.value.set(this.steps()[index - 1].value());
  }
}
