/**
 * Template and host bindings shared by `star-date-picker`, `star-date-range-picker` and
 * `star-multi-date-picker` (see `StarDateInputBase`). Internal.
 */
export const STAR_DATE_TEMPLATE = `
  <div #control class="star-date__control" cdkOverlayOrigin #origin="cdkOverlayOrigin">
    <input
      #input
      type="text"
      class="star-date__input"
      autocomplete="off"
      inputmode="numeric"
      aria-haspopup="dialog"
      [id]="inputId()"
      [attr.name]="name() || null"
      [value]="typed()"
      [attr.placeholder]="hint()"
      [disabled]="disabled()"
      [readOnly]="readonly() || readonlyInput()"
      [required]="required()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-controls]="open() ? panelId : null"
      [attr.aria-describedby]="fieldDescribedBy()"
      [attr.aria-invalid]="showInvalid() || null"
      (input)="typed.set(input.value)"
      (click)="readonlyInput() && togglePanel()"
      (keydown)="onInputKeydown($event)"
      (focus)="onInputFocus()"
      (blur)="onInputBlur()"
    />
    @if (showClear() && hasValue() && interactive()) {
      <button type="button" class="star-select__icon-btn" [attr.aria-label]="text.clear" (click)="onClearClick()">
        <i class="ph-bold ph-x" aria-hidden="true"></i>
      </button>
    }
    <button
      type="button"
      class="star-date__toggle"
      [disabled]="!interactive()"
      aria-haspopup="dialog"
      [attr.aria-label]="text.chooseDate"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? panelId : null"
      (click)="togglePanel()"
    >
      <i class="ph-bold ph-calendar-blank" aria-hidden="true"></i>
    </button>
  </div>

  <ng-template
    cdkConnectedOverlay
    cdkConnectedOverlayUsePopover="inline"
    [cdkConnectedOverlayOrigin]="origin"
    [cdkConnectedOverlayOpen]="open() && !sheet.active()"
    [cdkConnectedOverlayPositions]="positions"
    [cdkConnectedOverlayPush]="true"
    [cdkConnectedOverlayViewportMargin]="viewportMargin"
    (attach)="onAttached()"
    (detach)="closePanel(false)"
    (overlayOutsideClick)="onOutsideClick($event)"
  >
    <ng-container *ngTemplateOutlet="panel" />
  </ng-template>

  <!-- touchUI / breakpoint: the same panel in a modal native dialog. Escape fires cancel; a click
       on the backdrop has the dialog itself as its target. -->
  @if (open() && sheet.active()) {
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <dialog
      #sheetDialog
      class="star-date__sheet"
      [attr.aria-label]="text.chooseDate"
      (cancel)="onSheetCancel($event)"
      (click)="onSheetClick($event)"
    >
      <ng-container *ngTemplateOutlet="panel" />
    </dialog>
  }

  <ng-template #panel>
    <div
      class="star-panel star-date__panel"
      [class.star-date__panel--time]="timeEnabled()"
      [class.star-date__panel--months]="numberOfMonths() > 1"
      [class.star-date__panel--sheet]="sheet.active()"
      [attr.role]="sheet.active() ? null : 'dialog'"
      [id]="panelId"
      [attr.aria-label]="sheet.active() ? null : text.chooseDate"
      (keydown)="onPanelKeydown($event)"
    >
      @if (headerSlot(); as header) {
        <ng-container *ngTemplateOutlet="header" />
      }
      <star-calendar
        [mode]="mode"
        [selected]="calendarSelected()"
        [range]="calendarRange()"
        [selectedDates]="calendarDates()"
        [granularity]="granularity()"
        [numberOfMonths]="numberOfMonths()"
        [showWeek]="showWeek()"
        [showOtherMonths]="showOtherMonths()"
        [selectOtherMonths]="selectOtherMonths()"
        [specialDates]="specialDates()"
        [minDate]="minDate()"
        [maxDate]="maxDate()"
        [disabledDates]="disabledDates()"
        [disabledDays]="disabledDays()"
        [dateDisabled]="dateDisabled()"
        [firstDayOfWeek]="firstDayOfWeek()"
        [locale]="locale()"
        [dateTemplate]="dateSlot()"
        (dateSelect)="onDateSelect($event)"
        (monthChange)="monthChange.emit($event)"
        (yearChange)="yearChange.emit($event)"
        (viewChange)="viewChange.emit($event)"
      />
      @if (timeEnabled()) {
        <div class="star-date__time">
          @for (field of timeFields(); track field.label) {
            <div class="star-date__time-field" role="group" [attr.aria-label]="field.label">
              <span class="star-date__time-label" aria-hidden="true">{{ field.label }}</span>
              <star-time-columns
                [value]="field.value || null"
                [min]="field.min"
                [max]="field.max"
                [stepHour]="stepHour()"
                [stepMinute]="timeStep() / 60"
                [stepSecond]="stepSecond()"
                [showSeconds]="showSeconds()"
                [hourFormat]="hourFormat()"
                [disabled]="!field.value"
                (valueChange)="$event && field.set($event)"
              />
            </div>
          }
        </div>
        <div class="star-date__done">
          <button type="button" class="star-btn star-btn--primary star-btn--sm" (click)="closePanel()">{{ text.done }}</button>
        </div>
      }
      @if (showButtonBar()) {
        <div class="star-date__bar">
          <button type="button" class="star-btn star-btn--ghost star-btn--sm" (click)="today()">{{ text.today }}</button>
          <button type="button" class="star-btn star-btn--ghost star-btn--sm" (click)="onClearClick()">{{ text.clear }}</button>
        </div>
      }
      <!-- The footer is last, below the button bar. PrimeNG \`#footer\` template. -->
      @if (footerSlot(); as footer) {
        <ng-container *ngTemplateOutlet="footer" />
      }
    </div>
  </ng-template>
`;

export const STAR_DATE_HOST = {
  class: 'star-date',
  '[class.star-date--open]': 'open()',
  '[class.star-date--disabled]': 'disabled()',
  '[class.star-date--invalid]': 'showInvalid()',
  '[class.star-date--sm]': "size() === 'sm'",
};
