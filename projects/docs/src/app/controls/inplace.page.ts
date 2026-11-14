import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarInput } from 'star-ng/field';
import { StarInplace, StarInplaceContent, StarInplaceDisplay } from 'star-ng/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-inplace-page',
  imports: [DOCS, StarInplace, StarInplaceDisplay, StarInplaceContent, StarInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Inplace"
      lead="Shows a value as a button. A click replaces it with an editor in the same place. Escape, or the close button, goes back to the value. The focus moves to the editor and back."
      importFrom="import { StarInplace, StarInplaceDisplay, StarInplaceContent } from 'star-ng/utility';"
    >
      <docs-example
        heading="Edit a value"
        source="inplace/basic"
        [script]="script"
        note="Two templates: starInplaceDisplay is the read view, starInplaceContent is the edit view. closable adds a button that goes back to the value."
      >
        <div class="docs-stack">
          <p class="docs-output">
            Requester:
            <star-inplace ariaLabel="Edit requester" closable>
              <ng-template starInplaceDisplay>{{ name() }}</ng-template>
              <ng-template starInplaceContent>
                <input
                  starInput
                  size="sm"
                  aria-label="Requester"
                  [value]="name()"
                  (input)="name.set($any($event.target).value)"
                />
              </ng-template>
            </star-inplace>
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Two-way active state and disabled"
        source="inplace/active"
        note="active is a two-way model, so the page can open or close the editor. A disabled inplace shows the value only."
      >
        <div class="docs-stack">
          <star-inplace ariaLabel="Edit title" [(active)]="editing">
            <ng-template starInplaceDisplay>{{ title() }}</ng-template>
            <ng-template starInplaceContent>
              <input
                starInput
                size="sm"
                aria-label="Title"
                [value]="title()"
                (input)="title.set($any($event.target).value)"
                (keydown.enter)="editing.set(false)"
              />
            </ng-template>
          </star-inplace>
          <p class="docs-output" role="status">Editing: {{ editing() }}</p>
          <star-inplace disabled ariaLabel="Locked value">
            <ng-template starInplaceDisplay>Locked value</ng-template>
            <ng-template starInplaceContent>Not shown</ng-template>
          </star-inplace>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarInplace', 'StarInplaceDisplay', 'StarInplaceContent']"
        [keyboard]="keyboard"
        [cssVars]="cssVars"
      />
    </docs-page>
  `,
})
export class InplacePage {
  protected readonly name = signal('Ana Rivera');
  protected readonly title = signal('Quarterly report');
  protected readonly editing = signal(false);

  protected readonly script = `readonly name = signal('Ana Rivera');`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border-strong', description: 'Dashed border of the value on hover and focus.' },
    { name: '--star-surface-muted', description: 'Background of the value on hover and focus.' },
    { name: '--star-text-soft', description: 'Color of the pencil icon.' },
    { name: '--star-accent', description: 'Focus ring of the value.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter / Space', description: 'On the value: opens the editor and focuses it.' },
    {
      name: 'Escape',
      description: 'In the editor: goes back to the value and returns the focus to it.',
    },
    { name: 'Enter / Space', description: 'On the close button: goes back to the value.' },
  ];
}
