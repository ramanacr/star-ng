import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  Directive,
  ElementRef,
  inject,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { STAR_UI_TEXT } from 'star-ng/core';

/**
 * Divider (PrimeNG `p-divider`): horizontal or vertical rule with an optional label.
 * `<star-divider>or</star-divider>`, `<star-divider layout="vertical" />`
 */
@Component({
  selector: 'star-divider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'separator',
    '[attr.aria-orientation]': 'layout()',
    '[class]':
      "'star-divider star-divider--' + layout() + ' star-divider--' + type() + ' star-divider--' + align()",
  },
  template: `<span class="star-divider__content"><ng-content /></span>`,
})
export class StarDivider {
  readonly layout = input<'horizontal' | 'vertical'>('horizontal');
  readonly type = input<'solid' | 'dashed' | 'dotted'>('solid');
  readonly align = input<'start' | 'center' | 'end'>('center');
}

/**
 * Toolbar (PrimeNG `p-toolbar`): start, center and end groups, `role="toolbar"` with
 * Arrow-key focus movement between its controls (Tab enters and leaves once).
 *
 * ```html
 * <star-toolbar ariaLabel="Order actions">
 *   <ng-container starToolbarStart>…</ng-container>
 *   <ng-container starToolbarEnd>…</ng-container>
 * </star-toolbar>
 * ```
 */
@Component({
  selector: 'star-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-toolbar',
    role: 'toolbar',
    '[attr.aria-label]': 'ariaLabel()',
    '(keydown)': 'onKeydown($event)',
    '(focusin)': 'onFocusIn($event)',
  },
  template: `
    <div class="star-toolbar__group"><ng-content select="[starToolbarStart]" /></div>
    <div class="star-toolbar__group star-toolbar__group--center">
      <ng-content select="[starToolbarCenter]" />
    </div>
    <div class="star-toolbar__group star-toolbar__group--end">
      <ng-content select="[starToolbarEnd]" />
    </div>
  `,
})
export class StarToolbar {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly ariaLabel = input.required<string>();

  private controls(): HTMLElement[] {
    return [
      ...this.host.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => !el.closest('[role=menu], .star-panel, .star-popover'));
  }

  /** Roving tabindex: only the focused control is in the Tab order. */
  protected onFocusIn(event: FocusEvent): void {
    const controls = this.controls();
    if (!controls.includes(event.target as HTMLElement)) return;
    for (const control of controls) control.tabIndex = control === event.target ? 0 : -1;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement && event.key !== 'Tab') return;
    const controls = this.controls();
    const index = controls.indexOf(event.target as HTMLElement);
    if (index < 0) return;
    const target = {
      ArrowRight: (index + 1) % controls.length,
      ArrowLeft: (index - 1 + controls.length) % controls.length,
      Home: 0,
      End: controls.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    controls[target].focus();
  }
}

export interface StarTimelineEvent {
  readonly title: string;
  readonly date?: string | Date;
  readonly description?: string;
  /** Phosphor icon class shown in the marker. */
  readonly icon?: string;
  readonly severity?: 'primary' | 'success' | 'info' | 'warn' | 'danger' | 'secondary';
}

/** Custom event body: `<ng-template starTimelineContent let-event>…</ng-template>`. */
@Directive({ selector: 'ng-template[starTimelineContent]' })
export class StarTimelineContent {
  readonly template =
    inject<TemplateRef<{ $implicit: StarTimelineEvent; index: number }>>(TemplateRef);
}

/**
 * Timeline (PrimeNG `p-timeline`): ordered list of events with markers, dates and severity
 * colors; vertical (left or alternate) or horizontal.
 *
 * `<star-timeline [events]="history" align="left" />`
 */
@Component({
  selector: 'star-timeline',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-timeline star-timeline--' + layout() + ' star-timeline--' + align()",
  },
  template: `
    <ol class="star-timeline__list" [attr.aria-label]="ariaLabel()">
      @for (event of events(); track $index; let i = $index) {
        <li
          class="star-timeline__event"
          [class]="'star-timeline__event star-timeline__event--' + (event.severity ?? 'primary')"
        >
          <span class="star-timeline__marker" aria-hidden="true">
            @if (event.icon) {
              <i [class]="event.icon"></i>
            }
          </span>
          <div class="star-timeline__body">
            @if (content(); as custom) {
              <ng-container
                *ngTemplateOutlet="custom.template; context: { $implicit: event, index: i }"
              />
            } @else {
              @if (event.date) {
                <time class="star-timeline__date" [attr.datetime]="isoDate(event.date)">{{
                  dateText(event.date)
                }}</time>
              }
              <p class="star-timeline__title">{{ event.title }}</p>
              @if (event.description) {
                <p class="star-timeline__desc">{{ event.description }}</p>
              }
            }
          </div>
        </li>
      }
    </ol>
  `,
})
export class StarTimeline {
  readonly events = input<readonly StarTimelineEvent[]>([]);
  readonly layout = input<'vertical' | 'horizontal'>('vertical');
  readonly align = input<'left' | 'alternate'>('left');
  readonly locale = input<string | undefined>(undefined);
  readonly ariaLabel = input<string | null>(null);
  protected readonly content = contentChild(StarTimelineContent);

  protected isoDate(date: string | Date): string | null {
    return date instanceof Date ? date.toISOString() : null;
  }
  protected dateText(date: string | Date): string {
    return date instanceof Date
      ? new Intl.DateTimeFormat(this.locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
          date,
        )
      : date;
  }
}

/**
 * Chip (PrimeNG `p-chip`): label with optional icon or image and a remove button.
 * `<star-chip label="Design" icon="ph-bold ph-palette" removable (removed)="drop()" />`
 */
@Component({
  selector: 'star-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-chip' },
  template: `
    @if (image()) {
      <img class="star-chip__image" [src]="image()" alt="" />
    } @else if (icon()) {
      <i [class]="icon()" aria-hidden="true"></i>
    }
    <span>{{ label() }}<ng-content /></span>
    @if (removable()) {
      <button
        type="button"
        class="star-chip__remove"
        [attr.aria-label]="text.removeItem(label())"
        (click)="removed.emit()"
      >
        <i class="ph-bold ph-x" aria-hidden="true"></i>
      </button>
    }
  `,
})
export class StarChip {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly label = input('');
  readonly icon = input<string | null>(null);
  readonly image = input<string | null>(null);
  readonly removable = input(false, { transform: booleanAttribute });
  readonly removed = output<void>();
}
