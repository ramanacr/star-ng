import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarField } from '@star-ng/ui/field';
import { StarInputTags, StarInputTagTemplate } from '@star-ng/ui/input-tags';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-input-tags-page',
  imports: [DOCS, StarInputTags, StarInputTagTemplate, StarIconTemplate, StarField],
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

      <docs-api [of]="['StarInputTags']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class InputTagsPage {
  protected readonly labels = signal<readonly string[]>(['urgent', 'billing']);
  protected readonly chipTags = signal<readonly string[]>(['design', 'review']);
  protected readonly recipients = signal<readonly string[]>(['avery@example.com']);
  protected readonly rejected = signal('');
  protected readonly isEmail = (tag: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tag);

  protected readonly validateScript = `readonly recipients = signal<readonly string[]>(['avery@example.com']);
readonly rejected = signal('');
readonly isEmail = (tag: string) => /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(tag);`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the field.' },
    { name: '--star-accent-soft', description: 'Fill of a chip.' },
    { name: '--star-surface-muted', description: 'Fill of the field.' },
    { name: '--star-accent', description: 'Border color on focus and text color of a chip.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter', description: 'Adds the typed value.' },
    { name: 'Separator (comma, semicolon)', description: 'Adds the typed value.' },
    { name: 'Tab', description: 'With typed text: adds it and keeps the focus in the field.' },
    { name: 'Backspace', description: 'In the empty field: removes the last chip.' },
    { name: 'Escape', description: 'Clears the typed text.' },
  ];
}
