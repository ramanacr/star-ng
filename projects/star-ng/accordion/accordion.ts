import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
  linkedSignal,
  model,
  TemplateRef,
} from '@angular/core';
import { StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/** Lazy panel body: `<ng-template starAccordionContent>` renders on first expand only. */
@Directive({ selector: 'ng-template[starAccordionContent]' })
export class StarAccordionContent {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/** One section of `star-accordion`. */
@Component({
  selector: 'star-accordion-panel',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-accordion__panel',
    '[class.star-accordion__panel--open]': 'expanded()',
    '[class.star-accordion__panel--disabled]': 'disabled()',
  },
  template: `
    <h3 data-star-part="heading" class="star-accordion__heading">
      <button
        data-star-part="header"
        type="button"
        class="star-accordion__header"
        [id]="headerId"
        [attr.aria-expanded]="expanded()"
        [attr.aria-controls]="regionId"
        [disabled]="disabled()"
        (click)="accordion.toggle(value())"
        (keydown)="accordion.onHeaderKeydown($event)"
      >
        @if (icon(); as icon) {
          <i data-star-part="headerIcon" [class]="icon" aria-hidden="true"></i>
        }
        <span data-star-part="titleText" class="star-accordion__title">{{ header() }}</span>
        <ng-content select="[starAccordionHeader]" />
        <i
          data-star-part="expandIcon"
          class="ph-bold ph-caret-down star-accordion__caret"
          aria-hidden="true"
        ></i>
      </button>
    </h3>
    <div
      data-star-part="region"
      class="star-accordion__region"
      role="region"
      [id]="regionId"
      [attr.aria-labelledby]="headerId"
      [attr.inert]="expanded() ? null : ''"
    >
      <div data-star-part="inner" class="star-accordion__inner">
        <div data-star-part="body" class="star-accordion__body">
          @if (lazy(); as lazyContent) {
            @if (rendered()) {
              <ng-container *ngTemplateOutlet="lazyContent.template" />
            }
          }
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class StarAccordionPanel {
  protected readonly accordion = inject(forwardRef(() => StarAccordion));
  private readonly ids = inject(_IdGenerator);

  readonly value = input.required<string>();
  readonly header = input('');
  readonly icon = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly headerId = this.ids.getId('star-accordion-header-');
  protected readonly regionId = this.ids.getId('star-accordion-region-');
  protected readonly lazy = contentChild(StarAccordionContent);

  readonly expanded = computed(() => this.accordion.isOpen(this.value()));
  protected readonly rendered = linkedSignal<boolean, boolean>({
    source: this.expanded,
    computation: (open, previous) => open || (previous?.value ?? false),
  });
}

/**
 * Accordion (PrimeNG `p-accordion`): `[(value)]` holds the open panel values, `multiple`
 * allows several open, lazy panel bodies, WAI-ARIA accordion keyboard (Arrow Up / Down,
 * Home / End between headers). Height animates with `grid-template-rows`.
 *
 * ```html
 * <star-accordion [(value)]="open" multiple>
 *   <star-accordion-panel value="shipping" header="Shipping">…</star-accordion-panel>
 * </star-accordion>
 * ```
 */
@Component({
  selector: 'star-accordion',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-accordion' },
  template: `<ng-content />`,
})
export class StarAccordion {
  readonly value = model<readonly string[]>([]);
  readonly multiple = input(false, { transform: booleanAttribute });

  private readonly panels = contentChildren(StarAccordionPanel);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  isOpen(value: string): boolean {
    return this.value().includes(value);
  }

  toggle(value: string): void {
    const open = this.isOpen(value);
    if (this.multiple()) {
      this.value.update((values) =>
        open ? values.filter((v) => v !== value) : [...values, value],
      );
    } else {
      this.value.set(open ? [] : [value]);
    }
  }

  onHeaderKeydown(event: KeyboardEvent): void {
    const headers = [
      ...this.host.nativeElement.querySelectorAll<HTMLButtonElement>(
        ':scope > star-accordion-panel .star-accordion__header:not(:disabled)',
      ),
    ];
    const index = headers.indexOf(event.target as HTMLButtonElement);
    const targets: Record<string, number> = {
      ArrowDown: (index + 1) % headers.length,
      ArrowUp: (index - 1 + headers.length) % headers.length,
      Home: 0,
      End: headers.length - 1,
    };
    if (!(event.key in targets) || index < 0) return;
    event.preventDefault();
    headers[targets[event.key]]?.focus();
  }

  /** Number of panels (used by tests and demos). */
  readonly count = computed(() => this.panels().length);
}
