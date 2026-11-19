import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { injectStarControlDefaults, STAR_UI_TEXT, StarDirectionService } from '@star-ng/ui/core';
import { injectStarFieldLink, starJoinIds } from '@star-ng/ui/field';
import { StarTimeColumns } from './time-columns';

const PANEL_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
];

/**
 * Time picker: a time of day without a date (PrimeNG `p-datepicker timeOnly`, Ignite UI
 * `igx-time-picker`). The value is 24-hour `HH:mm` text (`HH:mm:ss` with `showSeconds`), or `null`.
 *
 * The field is the native time input in the StarNG field style, so typing, the arrow keys on a
 * part and the picker on a phone work as the browser gives them. The clock button opens a StarNG
 * panel (not the popup of the browser) with an hour, a minute and, in the 12-hour clock, an
 * am / pm column, and a second column with `showSeconds`. Times outside `min` … `max` are disabled,
 * and the columns follow `stepHour`, `stepMinute` and `stepSecond`.
 *
 * `<star-time-picker [formField]="form.callAt" min="08:00" max="18:00" [stepMinute]="15" />`
 */
@Component({
  selector: 'star-time-picker',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, StarTimeColumns],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-time star-date',
    '[class.star-date--open]': 'open()',
    '[class.star-date--disabled]': 'disabled()',
    '[class.star-date--invalid]': 'showInvalid()',
    '[class.star-date--sm]': "size() === 'sm'",
  },
  template: `
    <div #control class="star-date__control" cdkOverlayOrigin #origin="cdkOverlayOrigin">
      <input
        #input
        type="time"
        class="star-date__input star-time__input"
        [id]="inputId()"
        [attr.name]="name() || null"
        [value]="value() ?? ''"
        [attr.min]="min() ?? null"
        [attr.max]="max() ?? null"
        [step]="step()"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        [required]="required()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-controls]="open() ? panelId : null"
        [attr.aria-describedby]="fieldDescribedBy()"
        [attr.aria-invalid]="showInvalid() || null"
        (change)="onChange(input.value)"
        (keydown)="onInputKeydown($event)"
        (blur)="touch.emit()"
      />
      <button
        #toggle
        type="button"
        class="star-date__toggle"
        [disabled]="!interactive()"
        aria-haspopup="dialog"
        [attr.aria-label]="text.chooseTime"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="open() ? panelId : null"
        (click)="togglePanel(toggle)"
      >
        <i class="ph-bold ph-clock" aria-hidden="true"></i>
      </button>
    </div>

    <ng-template
      cdkConnectedOverlay
      cdkConnectedOverlayUsePopover="inline"
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayPush]="true"
      [cdkConnectedOverlayViewportMargin]="8"
      (attach)="focusActive()"
      (detach)="closePanel(false)"
      (overlayOutsideClick)="onOutsideClick($event)"
    >
      <div
        class="star-panel star-date__panel star-time__panel"
        role="dialog"
        [id]="panelId"
        [attr.aria-label]="text.chooseTime"
        (keydown)="onPanelKeydown($event)"
      >
        <star-time-columns
          [(value)]="value"
          [min]="min()"
          [max]="max()"
          [stepHour]="stepHour()"
          [stepMinute]="stepMinute()"
          [stepSecond]="stepSecond()"
          [showSeconds]="showSeconds()"
          [hourFormat]="hourFormat()"
        />
        <div class="star-time__bar">
          <button
            type="button"
            class="star-btn star-btn--primary star-btn--sm"
            (click)="closePanel()"
          >
            {{ text.done }}
          </button>
        </div>
      </div>
    </ng-template>
  `,
})
export class StarTimePicker implements FormValueControl<string | null> {
  /** Keeps the CDK direction (overlays) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  private readonly defaults = injectStarControlDefaults(['sm', 'md']);
  private readonly injector = inject(Injector);
  /** The parent `star-field` when it labels the input (with `for`); its hint or error describes it. */
  private readonly field = injectStarFieldLink(() => this.inputId());

  /** `HH:mm` (or `HH:mm:ss` with `showSeconds`) in the 24-hour clock, or `null`. */
  readonly value = model<string | null>(null);
  /**
   * Earliest and latest time, `HH:mm` or `HH:mm:ss` (PrimeNG `minDate` / `maxDate` with
   * `timeOnly`, Ignite UI `minValue` / `maxValue`).
   */
  readonly min = input<string | undefined>(undefined);
  readonly max = input<string | undefined>(undefined);
  /** Hour step of the panel's hour column (PrimeNG `stepHour`). */
  readonly stepHour = input(1);
  /** Minute step of the field's arrow keys and of the panel's minute column. */
  readonly stepMinute = input(1);
  /** Second step of the panel's second column and, with `showSeconds`, of the field's arrow keys. */
  readonly stepSecond = input(1);
  /** Adds seconds: the field and the panel show them, and the value is `HH:mm:ss`. */
  readonly showSeconds = input(false, { transform: booleanAttribute });
  /**
   * Clock of the panel: `'24'` (an hour column 00–23) or `'12'` (1–12 and an am / pm column).
   * Default: the clock of the browser locale, which is the clock the field shows. The value is
   * always 24-hour text.
   */
  readonly hourFormat = input<'12' | '24' | undefined>(undefined);
  /** Size. Default: `size` of `provideStarNg` (`small` or `medium`), else `md`. */
  readonly size = input<'sm' | 'md'>(this.defaults.size ?? 'md');
  readonly ariaLabel = input<string | null>(null);
  readonly inputId = input(this.ids.getId('star-time-'));
  readonly name = input('');

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();

  protected readonly positions = PANEL_POSITIONS;
  protected readonly panelId = this.ids.getId('star-time-panel-');
  protected readonly open = signal(false);
  protected readonly interactive = computed(() => !this.disabled() && !this.readonly());
  /** Invalid after touch, or while the parent `star-field` shows an error. */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.field?.errorText(),
  );
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));
  /** Step of the native field, in seconds. */
  protected readonly step = computed(() =>
    this.showSeconds() ? Math.max(1, Math.floor(this.stepSecond())) : this.minuteStep() * 60,
  );

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly control = viewChild.required<ElementRef<HTMLElement>>('control');
  /** The element that opened the panel: the focus goes back to it. */
  private opener: HTMLElement | null = null;

  private readonly minuteStep = computed(() => Math.max(1, Math.floor(this.stepMinute())));
  private readonly timeColumns = viewChild(StarTimeColumns);

  protected onChange(text: string): void {
    // The native input gives `HH:mm` or `HH:mm:ss`; empty text clears the value.
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(text);
    if (!match) this.value.set(null);
    else if (this.showSeconds()) this.value.set(`${match[1]}:${match[2]}:${match[3] ?? '00'}`);
    else this.value.set(`${match[1]}:${match[2]}`);
  }

  focus(options?: FocusOptions): void {
    this.input().nativeElement.focus(options);
  }

  /** Opens the panel. The focus goes to the chosen hour (or the first one that can be chosen). */
  openPanel(opener: HTMLElement | null = null): void {
    if (!this.interactive() || this.open()) return;
    this.opener = opener ?? this.input().nativeElement;
    this.open.set(true);
  }

  /** Closes the panel; by default the focus goes back to the element that opened it. */
  closePanel(focusOpener = true): void {
    if (!this.open()) return;
    this.open.set(false);
    if (focusOpener) (this.opener ?? this.input().nativeElement).focus();
  }

  protected togglePanel(opener: HTMLElement): void {
    if (this.open()) this.closePanel();
    else this.openPanel(opener);
  }

  protected onOutsideClick(event: MouseEvent): void {
    if (this.control().nativeElement.contains(event.target as Node)) return;
    this.closePanel(false);
    this.touch.emit();
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    // Alt + Arrow down and F4 open the popup of a field: the StarNG panel, not the browser's.
    if ((event.key === 'ArrowDown' && event.altKey) || event.key === 'F4') {
      event.preventDefault();
      this.openPanel(this.input().nativeElement);
    } else if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      this.closePanel();
    }
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closePanel();
    }
  }

  /** Moves the focus into the panel, to the chosen hour (or the first one that can be chosen). */
  protected focusActive(): void {
    // The columns are rendered after the panel is attached.
    afterNextRender(() => this.timeColumns()?.focus(), { injector: this.injector });
  }
}
