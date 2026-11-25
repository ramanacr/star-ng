import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  contentChildren,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import {
  injectStarControlDefaults,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarIconContext,
  starInlineKey,
  StarSeverity,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

/**
 * Divider (PrimeNG `p-divider`): horizontal or vertical rule with an optional label.
 * `<star-divider>or</star-divider>`, `<star-divider layout="vertical" />`
 */
@Component({
  selector: 'star-divider',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'separator',
    '[attr.aria-orientation]': 'layout()',
    '[class]':
      "'star-divider star-divider--' + layout() + ' star-divider--' + type() + ' star-divider--' + align()",
  },
  template: `<span data-star-part="content" class="star-divider__content"><ng-content /></span>`,
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
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],

  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-toolbar',
    role: 'toolbar',
    '[attr.aria-label]': 'ariaLabel()',
    '(keydown)': 'onKeydown($event)',
    '(focusin)': 'onFocusIn($event)',
  },
  template: `
    <div data-star-part="groupPanel" class="star-toolbar__group">
      <ng-content select="[starToolbarStart]" />
    </div>
    <div data-star-part="groupPanel" class="star-toolbar__group star-toolbar__group--center">
      <ng-content select="[starToolbarCenter]" />
    </div>
    <div data-star-part="groupPanel" class="star-toolbar__group star-toolbar__group--end">
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
    }[starInlineKey(event, this.host.nativeElement)];
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
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-timeline star-timeline--' + layout() + ' star-timeline--' + align()",
  },
  template: `
    <ol data-star-part="list" class="star-timeline__list" [attr.aria-label]="ariaLabel()">
      @for (event of events(); track $index; let i = $index) {
        <li
          data-star-part="eventItem"
          class="star-timeline__event"
          [class]="'star-timeline__event star-timeline__event--' + (event.severity ?? 'primary')"
        >
          <span data-star-part="markerPanel" class="star-timeline__marker" aria-hidden="true">
            @if (event.icon) {
              <i data-star-part="markerIcon" [class]="event.icon"></i>
            }
          </span>
          <div data-star-part="body" class="star-timeline__body">
            @if (content(); as custom) {
              <ng-container
                *ngTemplateOutlet="custom.template; context: { $implicit: event, index: i }"
              />
            } @else {
              @if (event.date) {
                <time
                  data-star-part="dateText"
                  class="star-timeline__date"
                  [attr.datetime]="isoDate(event.date)"
                  >{{ dateText(event.date) }}</time
                >
              }
              <p data-star-part="titleText" class="star-timeline__title">{{ event.title }}</p>
              @if (event.description) {
                <p data-star-part="description" class="star-timeline__desc">
                  {{ event.description }}
                </p>
              }
            }
          </div>
        </li>
      }
    </ol>
  `,
})
export class StarTimeline {
  private readonly defaults = injectStarControlDefaults([]);
  readonly events = input<readonly StarTimelineEvent[]>([]);
  readonly layout = input<'vertical' | 'horizontal'>('vertical');
  readonly align = input<'left' | 'alternate'>('left');
  /** Locale of the event dates. Default: `locale` of `provideStarNg`, else the browser locale. */
  readonly locale = input<string | undefined>(this.defaults.locale ?? undefined);
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
 * Tone of a chip (`severity`): the severities of the tag, and `neutral` (grey, the same as
 * `secondary`). Without a severity, the chip keeps its accent look.
 */
export type StarChipSeverity = StarSeverity | 'neutral';

/**
 * Chip (PrimeNG `p-chip`): label with optional icon or image and a remove button.
 * `<star-chip label="Design" icon="ph-bold ph-palette" removable (removed)="drop()" />`
 *
 * Filter chip: a tone, a clickable body and a remove button.
 * `<star-chip severity="info" clickable removable (chipClick)="edit()" (removed)="drop()"><b>Status:</b> Open</star-chip>`
 *
 * Slots (content children): `starIcon="remove"` replaces the icon of the remove button
 * (PrimeNG `#removeicon`, `removeIcon`).
 */
@Component({
  selector: 'star-chip',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarChip) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-chip',
    '[class.star-chip--disabled]': 'disabled()',
    '[class.star-chip--clickable]': 'clickable()',
    '[class]': "severity() ? 'star-chip--tone star-chip--' + severity() : ''",
  },
  template: `
    <ng-template #body>
      @if (image()) {
        <img data-star-part="picture" class="star-chip__image" [src]="image()" alt="" />
      } @else if (icon()) {
        <i data-star-part="icon" [class]="icon()" aria-hidden="true"></i>
      }
      <span data-star-part="text" class="star-chip__text" [attr.id]="label() ? null : textId"
        >{{ label() }}<ng-content
      /></span>
    </ng-template>
    @if (clickable()) {
      <button
        data-star-part="bodyButton"
        type="button"
        class="star-chip__body"
        [disabled]="disabled()"
        (click)="chipClick.emit()"
      >
        <ng-container *ngTemplateOutlet="body" />
      </button>
    } @else {
      <ng-container *ngTemplateOutlet="body" />
    }
    @if (removable()) {
      <button
        data-star-part="removeButton"
        type="button"
        class="star-chip__remove"
        [attr.id]="label() ? null : removeId"
        [disabled]="disabled()"
        [attr.aria-label]="label() ? text.removeItem(label()) : text.removeItem('').trim()"
        [attr.aria-labelledby]="label() ? null : removeId + ' ' + textId"
        (click)="removed.emit()"
      >
        @if (icons().get('remove'); as custom) {
          <span data-star-part="removeIcon" aria-hidden="true">
            <ng-container *ngTemplateOutlet="custom; context: iconContext" />
          </span>
        } @else {
          <i data-star-part="removeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
        }
      </button>
    }
  `,
})
export class StarChip {
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  protected readonly textId = this.ids.getId('star-chip-text-');
  protected readonly removeId = this.ids.getId('star-chip-remove-');
  readonly label = input('');
  readonly icon = input<string | null>(null);
  readonly image = input<string | null>(null);
  readonly removable = input(false, { transform: booleanAttribute });
  /** The chip looks inactive and its remove button does not work. PrimeNG `disabled`. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /**
   * Tone of the chip: `neutral` (grey), `info`, `primary`, `success`, `warn`, `danger` or
   * `secondary` (the same as `neutral`). `null` (the default) keeps the accent look.
   */
  readonly severity = input<StarChipSeverity | null>(null);
  /**
   * The body (icon, label and content) is a button that emits `chipClick`. It is separate from
   * the remove button. Its accessible name is the text of the chip.
   */
  readonly clickable = input(false, { transform: booleanAttribute });
  readonly removed = output<void>();
  /** A click (or Enter, Space) on the body of a `clickable` chip. */
  readonly chipClick = output<void>();
}
