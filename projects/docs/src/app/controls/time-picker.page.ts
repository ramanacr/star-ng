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
      lead="A time of day without a date. It is the native time input in the StarNG input style, so the browser gives the keyboard model, the 12 or 24-hour display of the locale, and the time picker on a phone. The value is 24-hour text (HH:mm), or null. This is the PrimeNG p-datepicker with the timeOnly option."
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
        note="min and max are HH:mm text. stepMinute sets the step of the arrow keys (15 minutes here). The browser marks a value outside the limits as invalid, but it does not change the value."
      >
        <div class="docs-stack">
          <star-time-picker
            [(value)]="opening"
            min="08:00"
            max="18:00"
            [stepMinute]="15"
            ariaLabel="Opening time"
          />
          <p class="docs-output" role="status">Opening: {{ opening() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Sizes and states"
        source="time-picker/states"
        note="size='sm' makes the input smaller. Disabled and read-only work as on a native input."
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
      <p>The fields follow the page direction. See the Right-to-left guide.</p>

      <docs-api [of]="['StarTimePicker']" [cssVars]="cssVars" [keyboard]="keyboard" />

      <h2>Technical notes</h2>
      <p>
        Use this control for a time alone. To choose a date and a time together, use the date picker
        with <code>showTime</code>. The time picker has no popup of its own: the browser draws it,
        so the look of the time list is the look of the browser.
      </p>
    </docs-page>
  `,
})
export class TimePickerPage {
  protected readonly meeting = signal<string | null>('09:30');
  protected readonly opening = signal<string | null>('08:30');

  protected readonly slotModel = signal<{ pickup: string | null }>({ pickup: null });
  protected readonly slot = form(this.slotModel, (path) => {
    required(path.pickup, { message: 'Choose a pick-up time.' });
  });

  protected readonly basicScript = `readonly meeting = signal<string | null>('09:30');`;
  protected readonly limitsScript = `readonly opening = signal<string | null>('08:30');`;
  protected readonly formScript = `readonly slotModel = signal<{ pickup: string | null }>({ pickup: null });
readonly slot = form(this.slotModel, (path) => {
  required(path.pickup, { message: 'Choose a pick-up time.' });
});`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the input.' },
    { name: '--star-border', description: 'Border of the input.' },
    { name: '--star-accent', description: 'Border of the focused input.' },
    { name: '--star-danger', description: 'Border of an invalid input.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow left / Arrow right',
      description: 'Moves between the hour, the minute and the am / pm part (the browser decides).',
    },
    { name: 'Arrow up / Arrow down', description: 'Changes the part that has the focus.' },
    { name: 'Digits', description: 'Type a part of the time directly.' },
    {
      name: 'Backspace / Delete',
      description: 'Clears a part. A time with an empty part gives null.',
    },
  ];
}
