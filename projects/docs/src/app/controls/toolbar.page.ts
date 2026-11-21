import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarDivider, StarToolbar } from '@star-ng/ui/layout';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './toolbar.page.scss',
  selector: 'docs-toolbar-page',
  imports: [DOCS, StarToolbar, StarDivider, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Toolbar"
      lead="A bar of actions with a start group, a center group and an end group. The arrow keys move the focus between its controls. The PrimeNG equivalent is p-toolbar."
      importFrom="import { StarToolbar } from '@star-ng/ui/layout';"
    >
      <docs-example
        heading="Start and end groups"
        source="toolbar/basic"
        [script]="basicScript"
        note="The toolbar has role toolbar and needs the ariaLabel input. Only one control is in the tab order. Tab enters the toolbar once and leaves it once."
      >
        <div class="docs-stack">
          <star-toolbar ariaLabel="Order actions">
            <ng-container starToolbarStart>
              <star-button size="sm" leadingIcon="ph-bold ph-plus" (pressed)="last.set('New')">
                New
              </star-button>
              <star-button
                size="sm"
                variant="secondary"
                leadingIcon="ph-bold ph-pencil-simple"
                (pressed)="last.set('Edit')"
              >
                Edit
              </star-button>
            </ng-container>
            <ng-container starToolbarEnd>
              <star-button
                size="sm"
                variant="ghost"
                leadingIcon="ph-bold ph-export"
                (pressed)="last.set('Export')"
              >
                Export
              </star-button>
            </ng-container>
          </star-toolbar>
          <p class="docs-output" role="status">Last action: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-example heading="Three groups" source="toolbar/center">
        <div class="docs-stack">
          <star-toolbar ariaLabel="Page controls">
            <ng-container starToolbarStart>
              <star-button size="sm" variant="secondary">Back</star-button>
            </ng-container>
            <ng-container starToolbarCenter>
              <star-button size="sm" variant="ghost">Day</star-button>
              <star-divider layout="vertical" />
              <star-button size="sm" variant="ghost">Week</star-button>
            </ng-container>
            <ng-container starToolbarEnd>
              <star-button size="sm">Save</star-button>
            </ng-container>
          </star-toolbar>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The arrow keys follow the visual direction: with <code>dir="rtl"</code> Arrow left moves to
        the next control. The start group is on the right. See the Right-to-left guide.
      </p>

      <docs-api [of]="['StarToolbar']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class ToolbarPage {
  protected readonly last = signal('none');

  protected readonly basicScript = `readonly last = signal('none');`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '[starToolbarStart]', description: 'Controls at the start of the bar.' },
    { name: '[starToolbarCenter]', description: 'Controls in the middle of the bar.' },
    { name: '[starToolbarEnd]', description: 'Controls at the end of the bar.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the toolbar.' },
    { name: '--star-border', description: 'Outline of the toolbar.' },
    { name: '--star-radius-lg', description: 'Corner radius.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow Right / Arrow Left',
      description: 'Moves the focus to the next or previous control. It wraps around.',
    },
    { name: 'Home / End', description: 'Moves the focus to the first or last control.' },
    {
      name: 'Tab',
      description:
        'Enters the toolbar at the last focused control. The next Tab leaves the toolbar.',
    },
  ];
}
