import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarSplitter } from 'star-ng/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-splitter-page',
  imports: [DOCS, StarSplitter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Splitter"
      lead="Two panes with a gutter between them. The user drags the gutter or uses the arrow keys to change the size of the first pane. The gutter is a separator with a value, so a screen reader announces the size."
      importFrom="import { StarSplitter } from 'star-ng/utility';"
    >
      <docs-example
        heading="Horizontal"
        source="splitter/basic"
        [script]="basicScript"
        note="Mark the first pane with starSplitterStart and the second with starSplitterEnd. size is a two-way model: the size of the first pane in percent."
      >
        <star-splitter class="docs-splitter" [(size)]="split" ariaLabel="Resize the order panes">
          <div starSplitterStart>
            <strong>Orders</strong>
            <p class="docs-output">Drag the gutter or use the arrow keys.</p>
          </div>
          <div starSplitterEnd>
            <strong>Details</strong>
            <p class="docs-output" role="status">First pane: {{ split() }}%</p>
          </div>
        </star-splitter>
      </docs-example>

      <docs-example
        heading="Vertical with a minimum size"
        source="splitter/vertical"
        note="layout vertical stacks the panes. minSize (default 15) is the smallest size of each pane in percent."
      >
        <star-splitter
          class="docs-splitter"
          layout="vertical"
          [size]="40"
          [minSize]="25"
          ariaLabel="Resize the invoice panes"
        >
          <div starSplitterStart><strong>Invoices</strong></div>
          <div starSplitterEnd><strong>Preview</strong></div>
        </star-splitter>
      </docs-example>

      <docs-api [of]="['StarSplitter']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
  styles: `
    .docs-splitter {
      width: 100%;
      height: 12rem;
    }
  `,
})
export class SplitterPage {
  protected readonly split = signal(50);

  protected readonly basicScript = `readonly split = signal(50);`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '[starSplitterStart]', description: 'Content of the first pane.' },
    { name: '[starSplitterEnd]', description: 'Content of the second pane.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-split', description: 'Size of the first pane. The component sets it.' },
    { name: '--star-border', description: 'Border of the splitter.' },
    { name: '--star-surface-muted', description: 'Background of the gutter.' },
    { name: '--star-primary-soft', description: 'Background of the gutter on hover and focus.' },
    { name: '--star-accent', description: 'Focus ring of the gutter.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow left / Arrow right',
      description: 'Horizontal layout: moves the gutter by 2 %.',
    },
    {
      name: 'Arrow up / Arrow down',
      description: 'Vertical layout: moves the gutter by 2 %.',
    },
    { name: 'Home / End', description: 'Moves the gutter to the minimum or the maximum size.' },
  ];
}
