import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarBlockUi } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-block-ui-page',
  imports: [DOCS, StarBlockUi, StarButton, StarField, StarInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Block UI"
      lead="Blocks a region while work runs. The content becomes inert: no focus, no clicks, and hidden from assistive technology. A busy mask with a spinner and a message shows over it."
      importFrom="import { StarBlockUi } from '@star-ng/ui/utility';"
    >
      <docs-example
        heading="Block a form"
        source="block-ui/basic"
        [script]="script"
        note="Set blocked while work runs. message is optional; it is also the accessible name of the spinner. Put the button that starts the work outside the block."
      >
        <div class="docs-stack">
          <star-block-ui [blocked]="blocked()" message="Saving…">
            <div class="docs-stack">
              <star-field label="Note">
                <input starInput value="Waiting for approval" />
              </star-field>
              <star-field label="Reference">
                <input starInput value="PO-1042" />
              </star-field>
            </div>
          </star-block-ui>
          <star-button variant="secondary" (pressed)="blockFor(1500)">
            Save (blocks for 1.5 s)
          </star-button>
          <star-button variant="secondary" (pressed)="blocked.set(!blocked())">
            {{ blocked() ? 'Unblock' : 'Block' }}
          </star-button>
        </div>
      </docs-example>

      <docs-api [of]="['StarBlockUi']" [slots]="slots" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class BlockUiPage {
  protected readonly blocked = signal(false);

  protected blockFor(ms: number): void {
    this.blocked.set(true);
    setTimeout(() => this.blocked.set(false), ms);
  }

  protected readonly script = `readonly blocked = signal(false);

blockFor(ms: number): void {
  this.blocked.set(true);
  setTimeout(() => this.blocked.set(false), ms);
}`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starLoading]',
      description:
        'Content child. Replaces the spinner and the message on the mask. PrimeNG #content.',
    },
    { name: '(default)', description: 'The content that the block covers.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Color of the mask (70 % opacity).' },
    { name: '--star-blur-xs', description: 'Blur of the content under the mask.' },
    { name: '--star-text-strong', description: 'Color of the message.' },
  ];
}
