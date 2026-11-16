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
import { STAR_UI_TEXT, StarDirectionService, starInlineKey } from '@star-ng/ui/core';

/** One part of the time: a column of the panel. */
type TimePart = 'hour' | 'minute' | 'period';

interface TimeCell {
  /** Hour 0–23 (24-hour clock) or 1–12 (12-hour clock), minute 0–59, or period 0 (am) / 1 (pm). */
  readonly value: number;
  readonly label: string;
  readonly selected: boolean;
  readonly disabled: boolean;
}

interface TimeColumn {
  readonly part: TimePart;
  readonly label: string;
  readonly cells: readonly TimeCell[];
}

const PANEL_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
];

const DAY_MINUTES = 24 * 60;

/** Minutes after midnight of `HH:mm` text, or `null` when the text is not a time. */
function toMinutes(text: string | null | undefined): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(text ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours > 23 || minutes > 59 ? null : hours * 60 + minutes;
}

/** `HH:mm` text of minutes after midnight. */
function toText(total: number): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** `true` when the locale writes the hour in the 12-hour clock (with am and pm). */
function localeUses12Hours(locale?: string): boolean {
  const parts = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).formatToParts(
    new Date(2000, 0, 1, 13),
  );
  return parts.some((part) => part.type === 'dayPeriod');
}

/** The locale's names of the morning and the afternoon, for example `AM` and `PM`. */
function periodNames(locale?: string): readonly [string, string] {
  const name = (hour: number) =>
    new Intl.DateTimeFormat(locale, { hour: 'numeric', hourCycle: 'h12' })
      .formatToParts(new Date(2000, 0, 1, hour))
      .find((part) => part.type === 'dayPeriod')?.value ?? (hour < 12 ? 'AM' : 'PM');
  return [name(9), name(21)];
}

/**
 * Time picker: a time of day without a date (PrimeNG `p-datepicker timeOnly`). The value is
 * 24-hour `HH:mm` text, or `null`.
 *
 * The field is the native time input in the StarNG field style, so typing, the arrow keys on a
 * part and the picker on a phone work as the browser gives them. The clock button opens a StarNG
 * panel (not the popup of the browser) with an hour, a minute and, in the 12-hour clock, an
 * am / pm column. Times outside `min` … `max` are disabled, and the minutes follow `stepMinute`.
 *
 * `<star-time-picker [formField]="form.callAt" min="08:00" max="18:00" [stepMinute]="15" />`
 */
@Component({
  selector: 'star-time-picker',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-time star-date',
    '[class.star-date--open]': 'open()',
    '[class.star-date--disabled]': 'disabled()',
    '[class.star-date--invalid]': '(invalid() && touched())',
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
        [attr.aria-invalid]="(invalid() && touched()) || null"
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
      (attach)="focusActive()"
      (detach)="closePanel(false)"
      (overlayOutsideClick)="onOutsideClick($event)"
    >
      <div
        #panel
        class="star-panel star-date__panel star-time__panel"
        role="dialog"
        [id]="panelId"
        [attr.aria-label]="text.chooseTime"
        (keydown)="onPanelKeydown($event)"
      >
        <div class="star-time__columns">
          @for (column of columns(); track column.part; let c = $index) {
            <!-- Each option is a button (Enter and Space choose it); the column handles the arrows. -->
            <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
            <div
              class="star-time__column"
              role="listbox"
              [attr.aria-label]="column.label"
              [attr.data-part]="column.part"
              (keydown)="onColumnKeydown($event, c)"
            >
              @for (cell of column.cells; track cell.value) {
                <button
                  type="button"
                  role="option"
                  class="star-time__cell"
                  [class.star-time__cell--selected]="cell.selected"
                  [attr.data-value]="cell.value"
                  [attr.tabindex]="cell.value === activeOf(column) ? 0 : -1"
                  [attr.aria-selected]="cell.selected"
                  [attr.aria-disabled]="cell.disabled || null"
                  (click)="pick(column.part, cell.value)"
                  (focus)="activate(column.part, cell.value)"
                >
                  {{ cell.label }}
                </button>
              }
            </div>
          }
        </div>
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
  private readonly injector = inject(Injector);

  /** `HH:mm` in the 24-hour clock, or `null`. */
  readonly value = model<string | null>(null);
  /** Earliest and latest time, `HH:mm`. */
  readonly min = input<string | undefined>(undefined);
  readonly max = input<string | undefined>(undefined);
  /** Minute step of the field's arrow keys and of the panel's minute column. */
  readonly stepMinute = input(1);
  /**
   * Clock of the panel: `'24'` (an hour column 00–23) or `'12'` (1–12 and an am / pm column).
   * Default: the clock of the browser locale, which is the clock the field shows. The value is
   * always 24-hour text.
   */
  readonly hourFormat = input<'12' | '24' | undefined>(undefined);
  readonly size = input<'sm' | 'md'>('md');
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
  protected readonly step = computed(() => this.minuteStep() * 60);

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly control = viewChild.required<ElementRef<HTMLElement>>('control');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  /** The element that opened the panel: the focus goes back to it. */
  private opener: HTMLElement | null = null;

  private readonly minuteStep = computed(() => Math.max(1, Math.floor(this.stepMinute())));
  private readonly twelveHours = computed(() => {
    const format = this.hourFormat();
    return format ? format === '12' : localeUses12Hours();
  });
  private readonly lower = computed(() => toMinutes(this.min()) ?? 0);
  private readonly upper = computed(() => toMinutes(this.max()) ?? DAY_MINUTES - 1);
  /** Minutes of the minute column. */
  private readonly minutes = computed(() => {
    const list: number[] = [];
    for (let minute = 0; minute < 60; minute += this.minuteStep()) list.push(minute);
    return list;
  });

  /** The value in minutes after midnight, or `null`. */
  private readonly current = computed(() => toMinutes(this.value()));
  /**
   * The time that the columns show: the value, or else the first time that can be chosen. A
   * click in one column keeps the other parts of this time.
   */
  private readonly base = computed(() => {
    const current = this.current();
    if (current !== null) return current;
    return this.allowedTimes()[0] ?? 0;
  });
  /** Every time that the panel offers: on the minute step and inside `min` … `max`. */
  private readonly allowedTimes = computed(() => {
    const times: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of this.minutes()) {
        const time = hour * 60 + minute;
        if (this.inLimits(time)) times.push(time);
      }
    }
    return times;
  });

  /** Focused value of each column (roving tab stop). */
  private readonly active = signal<Partial<Record<TimePart, number>>>({});

  protected readonly columns = computed<readonly TimeColumn[]>(() => {
    const base = this.base();
    const chosen = this.current() !== null;
    const baseHour = Math.floor(base / 60);
    const baseMinute = base % 60;
    const pm = baseHour >= 12 ? 1 : 0;
    const pad = (part: number) => String(part).padStart(2, '0');

    const hourValues = this.twelveHours()
      ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      : Array.from({ length: 24 }, (_, hour) => hour);
    const hours: TimeCell[] = hourValues.map((value) => {
      const hour = this.hour24(value, pm);
      return {
        value,
        label: this.twelveHours() ? String(value) : pad(value),
        selected: chosen && hour === baseHour,
        disabled: !this.minutes().some((minute) => this.inLimits(hour * 60 + minute)),
      };
    });
    const minutes: TimeCell[] = this.minutes().map((value) => ({
      value,
      label: pad(value),
      selected: chosen && value === baseMinute,
      disabled: !this.inLimits(baseHour * 60 + value),
    }));
    const columns: TimeColumn[] = [
      { part: 'hour', label: this.text.hour, cells: hours },
      { part: 'minute', label: this.text.minute, cells: minutes },
    ];
    if (this.twelveHours()) {
      const names = periodNames();
      columns.push({
        part: 'period',
        label: this.text.dayPeriod,
        cells: [0, 1].map((value) => ({
          value,
          label: names[value],
          selected: chosen && value === pm,
          disabled: !this.allowedTimes().some((time) => (time >= 12 * 60 ? 1 : 0) === value),
        })),
      });
    }
    return columns;
  });

  protected onChange(text: string): void {
    // The native input gives `HH:mm` (or `HH:mm:ss`); empty text clears the value.
    const match = /^(\d{2}):(\d{2})/.exec(text);
    this.value.set(match ? `${match[1]}:${match[2]}` : null);
  }

  focus(options?: FocusOptions): void {
    this.input().nativeElement.focus(options);
  }

  /** Opens the panel. The focus goes to the chosen hour (or the first one that can be chosen). */
  openPanel(opener: HTMLElement | null = null): void {
    if (!this.interactive() || this.open()) return;
    this.opener = opener ?? this.input().nativeElement;
    this.active.set({});
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

  /** Arrow up / down and Home / End move in a column; Arrow left / right move between columns. */
  protected onColumnKeydown(event: KeyboardEvent, index: number): void {
    const columns = this.columns();
    const column = columns[index];
    const values = column.cells.map((cell) => cell.value);
    const position = Math.max(0, values.indexOf(this.activeOf(column)));
    // In right-to-left the column before is on the right: the arrows follow what the user sees.
    const key = starInlineKey(event);
    let target: { part: TimePart; value: number } | null = null;
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const next = Math.min(
        values.length - 1,
        Math.max(0, position + (key === 'ArrowUp' ? -1 : 1)),
      );
      target = { part: column.part, value: values[next] };
    } else if (key === 'Home' || key === 'End') {
      target = { part: column.part, value: values[key === 'Home' ? 0 : values.length - 1] };
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const other = columns[index + (key === 'ArrowLeft' ? -1 : 1)];
      if (other) target = { part: other.part, value: this.activeOf(other) };
    }
    if (!target) return;
    event.preventDefault();
    this.activate(target.part, target.value);
    this.focusCell(target.part, target.value);
  }

  /** The focusable value of a column: the focused one, else the chosen one, else the first. */
  protected activeOf(column: TimeColumn): number {
    const active = this.active()[column.part];
    if (active !== undefined && column.cells.some((cell) => cell.value === active)) return active;
    return (
      column.cells.find((cell) => cell.selected)?.value ??
      column.cells.find((cell) => !cell.disabled)?.value ??
      column.cells[0].value
    );
  }

  protected activate(part: TimePart, value: number): void {
    if (this.active()[part] === value) return;
    this.active.update((active) => ({ ...active, [part]: value }));
  }

  /** Chooses one part of the time and keeps the other parts. A disabled cell does nothing. */
  protected pick(part: TimePart, value: number): void {
    const cell = this.columns()
      .find((column) => column.part === part)
      ?.cells.find((item) => item.value === value);
    if (!cell || cell.disabled) return;
    const base = this.base();
    let hour = Math.floor(base / 60);
    let minute = base % 60;
    if (part === 'hour') hour = this.twelveHours() ? this.hour24(value, hour >= 12 ? 1 : 0) : value;
    else if (part === 'minute') minute = value;
    else hour = (hour % 12) + value * 12;
    this.activate(part, value);
    this.value.set(toText(this.nearestAllowed(hour * 60 + minute)));
  }

  /** Moves the focus into the panel, to the active cell of the first column. */
  protected focusActive(): void {
    const first = this.columns()[0];
    // The cells are rendered after the panel is attached.
    afterNextRender(() => this.focusCell(first.part, this.activeOf(first)), {
      injector: this.injector,
    });
  }

  /** Focuses a cell at once, so a key pressed right after a move acts on the new cell. */
  private focusCell(part: TimePart, value: number): void {
    this.panel()
      ?.nativeElement.querySelector<HTMLElement>(`[data-part="${part}"] [data-value="${value}"]`)
      ?.focus();
  }

  /** Hour 0–23 of a 12-hour clock hour (1–12) and a period (0 am, 1 pm). */
  private hour24(value: number, pm: number): number {
    return this.twelveHours() ? (value % 12) + pm * 12 : value;
  }

  private inLimits(time: number): boolean {
    return time >= this.lower() && time <= this.upper();
  }

  /** `time` when the panel offers it, else the offered time that is nearest to it. */
  private nearestAllowed(time: number): number {
    const times = this.allowedTimes();
    if (times.includes(time) || times.length === 0) return time;
    return times.reduce((best, next) =>
      Math.abs(next - time) < Math.abs(best - time) ? next : best,
    );
  }
}
