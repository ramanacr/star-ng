import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { StarTimePicker } from '@star-ng/ui/date-picker';
import { StarField } from '@star-ng/ui/field';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-time-picker-page',
  imports: [DOCS, StarTimePicker, StarField, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Time picker"
      lead="A time of day without a date. You type in the native time input, so the browser gives the keyboard model of the field and the 12 or 24-hour display of the locale. The clock button opens a StarNG panel with an hour, a minute, an optional second and an am / pm column. The value is 24-hour text (HH:mm, or HH:mm:ss with showSeconds), or null. This is the PrimeNG p-datepicker with the timeOnly option."
      importFrom="import { StarTimePicker } from '@star-ng/ui/date-picker';"
    >
      <docs-example
        heading="Time of day"
        source="time-picker/basic"
        [script]="basicScript"
        note="The value is always HH:mm in the 24-hour clock, also when the browser shows am and pm. An empty field gives null."
      >
        <div class="docs-stack">
          <star-time-picker [(value)]="meeting" ariaLabel="Meeting time" />
          <p class="docs-output" role="status">Meeting: {{ meeting() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Limits and step"
        source="time-picker/limits"
        [script]="limitsScript"
        note="min and max are HH:mm text. stepMinute sets the step of the arrow keys and of the minute column (15 minutes here). hourFormat='24' gives the panel the 24-hour clock in every locale. In the panel, the times outside the limits are disabled. A typed value outside the limits stays: the browser marks it as invalid."
      >
        <div class="docs-stack">
          <star-time-picker
            [(value)]="opening"
            min="08:00"
            max="18:00"
            [stepMinute]="15"
            hourFormat="24"
            ariaLabel="Opening time"
          />
          <p class="docs-output" role="status">Opening: {{ opening() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="12-hour clock"
        source="time-picker/hour-format"
        [script]="hourFormatScript"
        note="hourFormat='12' gives the panel an hour column from 1 to 12 and an am / pm column. The default is the clock of the browser locale. The value stays 24-hour text."
      >
        <div class="docs-stack">
          <star-time-picker [(value)]="cutOff" hourFormat="12" ariaLabel="Cut-off time" />
          <p class="docs-output" role="status">Cut-off: {{ cutOff() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Seconds and steps"
        source="time-picker/seconds"
        [script]="secondsScript"
        note="showSeconds adds a second column, and the value is HH:mm:ss. stepHour, stepMinute and stepSecond set the values of the columns (every 2 hours, 15 minutes and 10 seconds here). min and max can have seconds too. The seconds also work with the 12-hour clock."
      >
        <div class="docs-stack">
          <star-time-picker
            [(value)]="exportAt"
            showSeconds
            min="06:00:00"
            max="20:00:00"
            [stepHour]="2"
            [stepMinute]="15"
            [stepSecond]="10"
            ariaLabel="Export time"
          />
          <p class="docs-output" role="status">Export: {{ exportAt() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Sizes and states"
        source="time-picker/states"
        note="size='sm' makes the field smaller. A disabled or read-only field does not open the panel."
      >
        <div class="docs-stack">
          <star-time-picker size="sm" ariaLabel="Small time picker" />
          <star-time-picker disabled [value]="'09:30'" ariaLabel="Disabled time picker" />
          <star-time-picker readonly [value]="'09:30'" ariaLabel="Read-only time picker" />
        </div>
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="time-picker/form"
        [script]="formScript"
        note="star-time-picker is a Signal Forms control: bind it with formField. The error shows after the user leaves the control."
      >
        <div class="docs-stack">
          <star-field label="Pick-up time" for="time-form-pickup" [state]="slot.pickup()">
            <star-time-picker
              inputId="time-form-pickup"
              [formField]="slot.pickup"
              ariaLabel="Pick-up time"
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ slot().valid() }}</p>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The fields and the panel follow the page direction. In right-to-left, the hour column is on
        the right, and Arrow left moves to the next column. See the Right-to-left guide.
      </p>

      <docs-api [of]="['StarTimePicker']" [cssVars]="cssVars" [keyboard]="keyboard" />

      <h2>Technical notes</h2>
      <p>
        Use this control for a time alone. To choose a date and a time together, use the date picker
        with <code>showTime</code>. The panel uses the surface, border, shadow and radius tokens of
        the date picker panel, and the browser's own time popup is hidden. On a phone, a tap in the
        field can still open the time picker of the system.
      </p>
    </docs-page>
  `,
})
export class TimePickerPage {
  protected readonly meeting = signal<string | null>('09:30');
  protected readonly opening = signal<string | null>('08:30');
  protected readonly cutOff = signal<string | null>('17:15');
  protected readonly exportAt = signal<string | null>('08:30:20');

  protected readonly slotModel = signal<{ pickup: string | null }>({ pickup: null });
  protected readonly slot = form(this.slotModel, (path) => {
    required(path.pickup, { message: 'Choose a pick-up time.' });
  });

  protected readonly basicScript = `readonly meeting = signal<string | null>('09:30');`;
  protected readonly limitsScript = `readonly opening = signal<string | null>('08:30');`;
  protected readonly hourFormatScript = `readonly cutOff = signal<string | null>('17:15');`;
  protected readonly secondsScript = `readonly exportAt = signal<string | null>('08:30:20');`;
  protected readonly formScript = `readonly slotModel = signal<{ pickup: string | null }>({ pickup: null });
readonly slot = form(this.slotModel, (path) => {
  required(path.pickup, { message: 'Choose a pick-up time.' });
});`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the field.' },
    { name: '--star-border', description: 'Border of the field and the panel.' },
    { name: '--star-accent', description: 'Border of the focused field and cell.' },
    { name: '--star-danger', description: 'Border of an invalid field.' },
    { name: '--star-surface', description: 'Background of the panel.' },
    { name: '--star-shadow-lg', description: 'Shadow of the panel.' },
    { name: '--star-radius-lg', description: 'Corner radius of the panel.' },
    { name: '--star-primary', description: 'Background of the chosen hour, minute and period.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Field: Arrow left / Arrow right',
      description: 'Moves between the hour, the minute and the am / pm part (the browser decides).',
    },
    { name: 'Field: Arrow up / Arrow down', description: 'Changes the part that has the focus.' },
    { name: 'Field: Digits', description: 'Type a part of the time directly.' },
    {
      name: 'Field: Backspace / Delete',
      description: 'Clears a part. A time with an empty part gives null.',
    },
    { name: 'Field: Alt + Arrow down', description: 'Opens the panel.' },
    {
      name: 'Panel: Arrow up / Arrow down',
      description: 'Moves in the column. Home and End go to the first and the last cell.',
    },
    {
      name: 'Panel: Arrow left / Arrow right',
      description: 'Moves to the column before or after. In right-to-left the two keys swap.',
    },
    {
      name: 'Panel: Enter / Space',
      description: 'Chooses the cell. A disabled cell does nothing.',
    },
    {
      name: 'Panel: Escape',
      description:
        'Closes the panel. The focus goes back to the button or the field that opened it.',
    },
  ];
}
