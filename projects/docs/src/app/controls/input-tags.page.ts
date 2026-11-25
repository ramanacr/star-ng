import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarField } from '@star-ng/ui/field';
import {
  StarInputTags,
  StarInputTagsActionTemplate,
  StarInputTagTemplate,
} from '@star-ng/ui/input-tags';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './input-tags.page.scss',
  selector: 'docs-input-tags-page',
  imports: [
    DOCS,
    StarInputTags,
    StarInputTagTemplate,
    StarInputTagsActionTemplate,
    StarIconTemplate,
    StarField,
    StarButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Tags field"
      lead="Free-text values as chips. Type a value and press Enter or a separator. Pasted text splits at the separators."
      importFrom="import { StarInputTags } from '@star-ng/ui/input-tags';"
    >
      <docs-example heading="Basic" source="input-tags/basic">
        <div class="docs-stack">
          <star-field label="Labels" hint="Press Enter or a comma to add a label.">
            <star-input-tags [(value)]="labels" showClear />
          </star-field>
          <p class="docs-output" role="status">{{ labels().join(', ') || '(none)' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Validation and limit"
        source="input-tags/validate"
        [script]="validateScript"
        note="A value that fails validate, a duplicate and a value over the limit are rejected. A screen reader hears the reason."
      >
        <div class="docs-stack">
          <star-field label="Recipients" hint="Email addresses, three at most.">
            <star-input-tags
              [(value)]="recipients"
              [validate]="isEmail"
              [maxTags]="3"
              (rejected)="rejected.set($event.tag + ': ' + $event.reason)"
            />
          </star-field>
          <p class="docs-output" role="status">Rejected: {{ rejected() || '(nothing)' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Invalid chips and an action"
        source="input-tags/keep-invalid"
        [script]="keepInvalidScript"
        note="With keepInvalid, text that fails validate becomes a red chip with aria-invalid instead of staying in the field. invalidTags lists those chips; they are part of the value, so give the form a validator with the same check to block submit. Backspace in the empty field puts the last invalid chip back into the field to fix it. An ng-template with starInputTagsAction adds a button at the end of the box."
      >
        <div class="docs-stack">
          <star-field label="To" hint="Email addresses. Fix or remove the red ones.">
            <star-input-tags #toField [(value)]="to" [validate]="isEmail" keepInvalid showClear>
              <ng-template starInputTagsAction let-disabled="disabled">
                <star-button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  leadingIcon="ph-bold ph-address-book"
                  ariaLabel="Address book"
                  [disabled]="disabled"
                  (pressed)="addFromBook()"
                />
              </ng-template>
            </star-input-tags>
          </star-field>
          <p class="docs-output" role="status">
            Invalid: {{ toField.invalidTags().join(', ') || '(none)' }}
          </p>
        </div>
      </docs-example>

      <docs-example heading="Disabled" source="input-tags/disabled">
        <div class="docs-stack">
          <star-input-tags [value]="['north', 'south']" disabled ariaLabel="Regions" />
        </div>
      </docs-example>

      <docs-example
        heading="Custom chips"
        source="input-tags/chips"
        note="An ng-template with starInputTag replaces the text of each chip (context: the tag and its index). starIcon remove and clear replace the remove and clear icons."
      >
        <star-input-tags [(value)]="chipTags" ariaLabel="Topics" showClear>
          <ng-template starInputTag let-tag><i class="ph-bold ph-hash"></i>{{ tag }}</ng-template>
          <ng-template starIcon="remove"><i class="ph-bold ph-trash"></i></ng-template>
        </star-input-tags>
      </docs-example>

      <docs-api
        [of]="['StarInputTags']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class InputTagsPage {
  protected readonly labels = signal<readonly string[]>(['urgent', 'billing']);
  protected readonly chipTags = signal<readonly string[]>(['design', 'review']);
  protected readonly recipients = signal<readonly string[]>(['avery@example.com']);
  protected readonly rejected = signal('');
  protected readonly to = signal<readonly string[]>(['dana.lee@example.com', 'not-an-email']);
  private readonly book = ['kim@example.com', 'lee@example.com', 'sam@example.com'];
  /** Adds the next address book entry that is not in the field yet. */
  protected addFromBook(): void {
    const next = this.book.find((entry) => !this.to().includes(entry));
    if (next) this.to.update((tags) => [...tags, next]);
  }
  protected readonly isEmail = (tag: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tag);

  protected readonly validateScript = `readonly recipients = signal<readonly string[]>(['avery@example.com']);
readonly rejected = signal('');
readonly isEmail = (tag: string) => /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(tag);`;

  protected readonly keepInvalidScript = `readonly to = signal<readonly string[]>(['dana.lee@example.com', 'not-an-email']);
readonly isEmail = (tag: string) => /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(tag);
private readonly book = ['kim@example.com', 'lee@example.com', 'sam@example.com'];
addFromBook(): void {
  const next = this.book.find((entry) => !this.to().includes(entry));
  if (next) this.to.update((tags) => [...tags, next]);
}
// In a Signal Form, block submit with the same check:
// validate(p.to, ({ value }) => (value().every(isEmail) ? undefined : { kind: 'email' }));`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starInputTag]',
      description: 'Replaces the text of each chip. Context: the tag and its index.',
    },
    {
      name: 'ng-template[starInputTagsAction]',
      description:
        'A trailing action inside the box, for example an icon button. It sits at the end, vertically centred; the chips wrap before it. Context: disabled and readonly.',
    },
    { name: 'ng-template[starIcon="remove"]', description: 'The remove icon of a chip.' },
    { name: 'ng-template[starIcon="clear"]', description: 'The clear icon.' },
  ];

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the field.' },
    { name: '--star-accent-soft', description: 'Fill of a chip.' },
    { name: '--star-surface-muted', description: 'Fill of the field.' },
    { name: '--star-accent', description: 'Border color on focus and text color of a chip.' },
    {
      name: '--star-tags-invalid-color',
      description:
        'Text color of an invalid chip. Default: the danger color mixed toward the strong text.',
    },
    {
      name: '--star-tags-invalid-surface',
      description: 'Fill of an invalid chip. Default --star-danger-soft.',
    },
    {
      name: '--star-tags-invalid-border',
      description: 'Border of an invalid chip. Default --star-danger.',
    },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter', description: 'Adds the typed value.' },
    { name: 'Separator (comma, semicolon)', description: 'Adds the typed value.' },
    { name: 'Tab', description: 'With typed text: adds it and keeps the focus in the field.' },
    {
      name: 'Backspace',
      description:
        'In the empty field: removes the last chip. A last invalid chip (keepInvalid) goes back into the field to fix it.',
    },
    { name: 'Escape', description: 'Clears the typed text.' },
  ];
}
