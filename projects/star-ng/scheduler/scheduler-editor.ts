import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import { STAR_UI_TEXT } from '@star-ng/ui/core';
import { addDays, StarDatePicker, startOfDay } from '@star-ng/ui/date-picker';
import { STAR_DIALOG_DATA, StarDialogRef } from '@star-ng/ui/dialog';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarSelect } from '@star-ng/ui/select';
import type { StarSchedulerId, StarSchedulerResource } from './scheduler-model';

/** Values of the event editor. */
export interface StarSchedulerEditorValue {
  readonly title: string;
  readonly start: Date;
  readonly end: Date;
  readonly allDay: boolean;
  readonly resourceId: StarSchedulerId | null;
}

/** @internal Data of the editor dialog. */
export interface StarSchedulerEditorData {
  readonly value: StarSchedulerEditorValue;
  readonly isNew: boolean;
  readonly canDelete: boolean;
  readonly resources: readonly StarSchedulerResource[];
  readonly locale: string | undefined;
  readonly hourFormat: '12' | '24';
  readonly slotMinutes: number;
}

/** @internal Result of the editor dialog. */
export type StarSchedulerEditorResult =
  | { readonly action: 'save'; readonly value: StarSchedulerEditorValue }
  | { readonly action: 'delete' };

/**
 * @internal The built-in event editor of `star-scheduler` (`editor` input), opened with
 * `StarDialogService`. It edits a copy and returns it; the scheduler emits `editorSave`.
 */
@Component({
  selector: 'star-scheduler-editor',
  imports: [StarButton, StarCheckbox, StarDatePicker, StarField, StarInput, StarSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-scheduler-editor' },
  template: `
    <form class="star-scheduler-editor__form" (submit)="save($event)">
      <star-field [label]="text.title">
        <input
          starInput
          required
          data-autofocus
          [value]="title()"
          (input)="title.set($any($event.target).value)"
        />
      </star-field>
      <star-checkbox [(checked)]="allDay">{{ text.allDay }}</star-checkbox>
      <star-field [label]="text.start">
        <star-date-picker
          [(value)]="start"
          [showTime]="!allDay()"
          [stepMinute]="data.slotMinutes"
          [hourFormat]="data.hourFormat"
          [locale]="data.locale"
        />
      </star-field>
      <star-field [label]="text.end" [error]="endError()">
        <star-date-picker
          [(value)]="end"
          [showTime]="!allDay()"
          [stepMinute]="data.slotMinutes"
          [hourFormat]="data.hourFormat"
          [locale]="data.locale"
          [invalid]="!!endError()"
        />
      </star-field>
      @if (data.resources.length) {
        <star-field [label]="text.resource">
          <star-select
            [options]="data.resources"
            optionLabel="name"
            optionValue="id"
            showClear
            [(value)]="resourceId"
          />
        </star-field>
      }
      <div class="star-dialog__footer star-dialog__footer--inline">
        @if (data.canDelete) {
          <star-button variant="danger" (pressed)="ref.close({ action: 'delete' })">
            {{ text.deleteEvent }}
          </star-button>
        }
        <star-button variant="ghost" (pressed)="ref.close()">{{ text.cancel }}</star-button>
        <star-button type="submit" [disabled]="!valid()">{{ text.save }}</star-button>
      </div>
    </form>
  `,
})
export class StarSchedulerEditor {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly data = inject<StarSchedulerEditorData>(STAR_DIALOG_DATA);
  protected readonly ref = inject<StarDialogRef<StarSchedulerEditorResult>>(StarDialogRef);

  protected readonly title = signal(this.data.value.title);
  protected readonly allDay = signal(this.data.value.allDay);
  protected readonly start = signal<Date | null>(this.data.value.start);
  protected readonly end = signal<Date | null>(
    // An all-day event stores an exclusive end; the editor shows the last day.
    this.data.value.allDay ? addDays(this.data.value.end, -1) : this.data.value.end,
  );
  protected readonly resourceId = signal<StarSchedulerId | null>(this.data.value.resourceId);

  protected readonly endError = computed(() => {
    const start = this.start();
    const end = this.end();
    if (!start || !end) return null;
    const invalid = this.allDay() ? end < startOfDay(start) : end <= start;
    return invalid ? this.text.endBeforeStart : null;
  });
  protected readonly valid = computed(
    () => !!this.title().trim() && !!this.start() && !!this.end() && !this.endError(),
  );

  protected save(event: Event): void {
    event.preventDefault();
    const start = this.start();
    const end = this.end();
    if (!this.valid() || !start || !end) return;
    const allDay = this.allDay();
    this.ref.close({
      action: 'save',
      value: {
        title: this.title().trim(),
        start: allDay ? startOfDay(start) : start,
        end: allDay ? addDays(startOfDay(end), 1) : end,
        allDay,
        resourceId: this.resourceId() ?? null,
      },
    });
  }
}
