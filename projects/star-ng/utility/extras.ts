import { _IdGenerator, CdkTrapFocus } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  signal,
  TemplateRef,
} from '@angular/core';
import {
  STAR_UI_TEXT,
  starPrefersReducedMotion,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

/** Read view of `star-inplace`: `<ng-template starInplaceDisplay>…</ng-template>`. */
@Directive({ selector: 'ng-template[starInplaceDisplay]' })
export class StarInplaceDisplay {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/** Edit view of `star-inplace`: `<ng-template starInplaceContent>…</ng-template>`. */
@Directive({ selector: 'ng-template[starInplaceContent]' })
export class StarInplaceContent {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * Inplace (PrimeNG `p-inplace`): shows a value as a button; a click replaces it with the
 * edit content in the same place. Escape or the close button goes back to the value.
 *
 * ```html
 * <star-inplace ariaLabel="Edit requester" closable>
 *   <ng-template starInplaceDisplay>{{ name() }}</ng-template>
 *   <ng-template starInplaceContent><input starInput [(value)]="name" /></ng-template>
 * </star-inplace>
 * ```
 */
@Component({
  selector: 'star-inplace',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-inplace', '(keydown.escape)': 'onEscape($event)' },
  template: `
    @if (active()) {
      <span data-star-part="content" class="star-inplace__content">
        @if (content(); as edit) {
          <ng-container *ngTemplateOutlet="edit.template" />
        }
        @if (closable()) {
          <button
            data-star-part="closeButton"
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.close"
            (click)="deactivate()"
          >
            <i data-star-part="closeIcon" class="ph-bold ph-check" aria-hidden="true"></i>
          </button>
        }
      </span>
    } @else {
      <button
        data-star-part="displayButton"
        type="button"
        class="star-inplace__display"
        [disabled]="disabled()"
        (click)="activate()"
      >
        <!-- The label is part of the name, so the visible value is too (WCAG 2.5.3). -->
        @if (ariaLabel(); as label) {
          <span class="star-sr-only">{{ label }}: </span>
        }
        @if (display(); as view) {
          <ng-container *ngTemplateOutlet="view.template" />
        }
        <i
          data-star-part="icon"
          class="ph-bold ph-pencil-simple star-inplace__icon"
          aria-hidden="true"
        ></i>
      </button>
    }
  `,
})
export class StarInplace {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** The edit content shows. Two-way. */
  readonly active = model(false);
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Adds a button that goes back to the value. */
  readonly closable = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);

  protected readonly display = contentChild(StarInplaceDisplay);
  protected readonly content = contentChild(StarInplaceContent);

  activate(): void {
    if (this.disabled() || this.active()) return;
    this.active.set(true);
    this.focusAfterRender('input, select, textarea, [tabindex]:not([tabindex="-1"]), button');
  }

  deactivate(): void {
    if (!this.active()) return;
    this.active.set(false);
    this.focusAfterRender('.star-inplace__display');
  }

  protected onEscape(event: Event): void {
    if (!this.active()) return;
    event.stopPropagation();
    this.deactivate();
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

/**
 * Scroll panel (PrimeNG `p-scrollpanel`): a region with a fixed height and a thin scrollbar
 * in the StarNG colors. It can take keyboard focus, so a keyboard user can scroll it; give
 * it a name with `ariaLabel`.
 *
 * `<star-scroll-panel height="12rem" ariaLabel="Case narrative">…</star-scroll-panel>`
 */
@Component({
  selector: 'star-scroll-panel',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-scroll-panel',
    role: 'region',
    tabindex: '0',
    '[style.height]': 'height()',
    '[style.max-height]': 'maxHeight()',
    '[attr.aria-label]': 'ariaLabel()',
  },
  template: `<ng-content />`,
})
export class StarScrollPanel {
  readonly height = input<string | null>(null);
  readonly maxHeight = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
}

/**
 * Keeps Tab and Shift+Tab inside an element (PrimeNG `pFocusTrap`), on the CDK focus trap.
 * `star-dialog` and `star-drawer` already trap focus; use this for a custom overlay.
 *
 * `<div [starFocusTrap]="open()" autoCapture>…</div>`
 */
@Directive({
  selector: '[starFocusTrap]',
  hostDirectives: [
    {
      directive: CdkTrapFocus,
      inputs: ['cdkTrapFocus: starFocusTrap', 'cdkTrapFocusAutoCapture: autoCapture'],
    },
  ],
})
export class StarFocusTrap {}

/**
 * Floating label (PrimeNG `p-floatlabel`): the label sits inside the input and moves above
 * it when the input has focus or a value. Wrap one text input, textarea or `star-select`.
 *
 * `<star-float-label label="Reporter name"><input starInput [(value)]="name" /></star-float-label>`
 *
 * The control gets an empty placeholder when it has none (the CSS needs one).
 *
 * The label is a real `<label>` around the control, so a click focuses the control and a
 * screen reader reads the label.
 */
@Component({
  selector: 'star-float-label',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-float' },
  template: `
    <!-- The control is projected into the label, so the label wraps it at run time. -->
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label data-star-part="wrapLabel" class="star-float__wrap">
      <ng-content />
      <span data-star-part="label" class="star-float__label">{{ label() }}</span>
    </label>
  `,
})
export class StarFloatLabel {
  readonly label = input.required<string>();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // The CSS reads `:placeholder-shown`, which needs a placeholder. Give the control an
    // empty one when it has none, so the page does not have to.
    afterNextRender(() => {
      const control = host.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
      if (control && !control.getAttribute('placeholder')) control.setAttribute('placeholder', ' ');
    });
  }
}

/**
 * Ripple (PrimeNG `pRipple`): a short ink circle from the point of a press. Decoration only;
 * it does nothing when the user asks for reduced motion.
 *
 * `<button class="star-btn star-btn--secondary" starRipple>Save</button>`
 */
@Directive({
  selector: '[starRipple]',
  host: { class: 'star-ripple', '(pointerdown)': 'show($event)' },
})
export class StarRipple {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected show(event: PointerEvent): void {
    if (starPrefersReducedMotion(this.host.ownerDocument)) return;
    const box = this.host.getBoundingClientRect();
    const size = Math.max(box.width, box.height) * 2;
    const ink = this.host.ownerDocument.createElement('span');
    ink.className = 'star-ripple__ink';
    ink.setAttribute('aria-hidden', 'true');
    ink.style.width = ink.style.height = `${size}px`;
    ink.style.left = `${event.clientX - box.left - size / 2}px`;
    ink.style.top = `${event.clientY - box.top - size / 2}px`;
    ink.addEventListener('animationend', () => ink.remove());
    this.host.append(ink);
  }
}

/**
 * Animate on scroll (PrimeNG `pAnimateOnScroll`): the element fades and moves in the first
 * time it comes into view. Content is visible at once when the user asks for reduced motion
 * or the browser has no `IntersectionObserver`.
 *
 * `<star-card starAnimateOnScroll>…</star-card>`
 */
@Directive({
  selector: '[starAnimateOnScroll]',
  host: { class: 'star-reveal', '[class.star-reveal--in]': 'shown()' },
})
export class StarAnimateOnScroll {
  /** Part of the element that must be in view, 0 to 1. */
  readonly threshold = input(0.15);
  protected readonly shown = signal(false);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        this.shown.set(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            this.shown.set(true);
            observer.disconnect();
          }
        },
        { threshold: this.threshold() },
      );
      observer.observe(host);
      destroy.onDestroy(() => observer.disconnect());
    });
  }
}

/**
 * Image compare (PrimeNG `p-imagecompare`): two images on top of each other with a divider
 * that the user moves. The divider is a native range input, so arrow keys, Home and End work.
 *
 * `<star-image-compare leftSrc="before.png" rightSrc="after.png" leftAlt="Before" rightAlt="After" />`
 */
@Component({
  selector: 'star-image-compare',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],

  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-compare', '[style.--star-compare.%]': 'value()' },
  template: `
    <img
      data-star-part="picture"
      class="star-compare__image"
      [src]="rightSrc()"
      [alt]="rightAlt()"
    />
    <img
      data-star-part="picture"
      class="star-compare__image star-compare__image--left"
      [src]="leftSrc()"
      [alt]="leftAlt()"
    />
    <span data-star-part="divider" class="star-compare__divider" aria-hidden="true">
      <i data-star-part="dividerIcon" class="ph-bold ph-arrows-horizontal"></i>
    </span>
    <input
      data-star-part="rangeInput"
      type="range"
      class="star-compare__range"
      min="0"
      max="100"
      step="1"
      [id]="rangeId"
      [value]="value()"
      [attr.aria-label]="ariaLabel() ?? text.compareImages"
      [attr.aria-valuetext]="value() + '%'"
      (input)="value.set($any($event.target).valueAsNumber)"
    />
  `,
})
export class StarImageCompare {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly rangeId = inject(_IdGenerator).getId('star-compare-');

  readonly leftSrc = input.required<string>();
  readonly rightSrc = input.required<string>();
  readonly leftAlt = input('');
  readonly rightAlt = input('');
  readonly ariaLabel = input<string | null>(null);
  /** Divider position: percent of the width that shows the left image. Two-way. */
  readonly value = model(50);
}
