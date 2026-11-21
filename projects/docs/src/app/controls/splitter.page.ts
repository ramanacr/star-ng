import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarSplitter } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-splitter-page-content',
  imports: [DOCS, StarSplitter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Splitter"
      lead="Two panes with a gutter between them. The user drags the gutter or uses the arrow keys to change the size of the first pane. The gutter is a separator with a value, so a screen reader announces the size."
      importFrom="import { StarSplitter } from '@star-ng/ui/utility';"
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

      <h2>Right-to-left</h2>
      <p>
        With <code>dir="rtl"</code> the first pane is on the right. Arrow left makes it larger,
        Arrow right makes it smaller, and a drag with the pointer measures from the right edge. A
        vertical splitter is not changed. See the Right-to-left guide.
      </p>

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
export class SplitterPageContent {
  protected readonly split = signal(50);

  protected readonly basicScript = `readonly split = signal(50);`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starSplitterGutter]',
      description:
        'Content child. Replaces the handle in the gutter; it is decorative. stateKey keeps the size in the local or session storage (stateStorage); resizeStart and resizeEnd report a drag or a key resize.',
    },
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

/**
 * Route component of the page. It loads the route styles (`splitter.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-splitter-page',
  imports: [SplitterPageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './splitter.page.scss',
  template: '<docs-splitter-page-content />',
})
export class SplitterPage {}
