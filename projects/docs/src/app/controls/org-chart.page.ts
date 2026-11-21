import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarOrgChart, StarOrgNode, StarOrgNodeTemplate } from '@star-ng/ui/data-display';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './org-chart.page.scss',
  selector: 'docs-org-chart-page',
  imports: [DOCS, StarOrgChart, StarOrgNodeTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Organization chart"
      lead="A hierarchy drawn top-down with connector lines. The markup is a nested list, so assistive technology reads the levels. The PrimeNG equivalent is p-organizationchart."
      importFrom="import { StarOrgChart, StarOrgNode, StarOrgNodeTemplate } from '@star-ng/ui/data-display';"
    >
      <docs-example
        heading="Expand and collapse"
        source="org-chart/basic"
        [script]="basicScript"
        note="A node with children has a round button that hides or shows its branch. collapsedKeys is a two-way list of the keys of the hidden branches. A node needs a unique key and a label. subtitle is an optional second line."
      >
        <div class="docs-stack">
          <star-org-chart ariaLabel="Company" [value]="company" [(collapsedKeys)]="closed" />
          <p class="docs-output" role="status">Collapsed: {{ closed().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Selectable nodes"
        source="org-chart/selectable"
        [script]="selectableScript"
        note="With selectable, each node is a button and one node is selected. selectedKey is a two-way model. The nodeSelect output fires for each click."
      >
        <div class="docs-stack">
          <star-org-chart
            ariaLabel="Company, selectable"
            [value]="company"
            selectable
            [(selectedKey)]="selected"
            (nodeSelect)="last.set($event.label)"
          />
          <p class="docs-output" role="status">Selected: {{ selected() ?? 'none' }}</p>
          <p class="docs-output" role="status">Last node: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Custom node content"
        source="org-chart/template"
        note="An ng-template with starOrgNode replaces the content of every node. The context has the node and its level (the root is 0)."
      >
        <star-org-chart ariaLabel="Company, custom nodes" [value]="company">
          <ng-template starOrgNode let-node let-level="level">
            <strong>{{ node.label }}</strong>
            <small>Level {{ level }}</small>
          </ng-template>
        </star-org-chart>
      </docs-example>

      <docs-api
        [of]="['StarOrgChart', 'StarOrgNodeTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class OrgChartPage {
  protected readonly company: StarOrgNode = {
    key: 'ceo',
    label: 'Maya Brandt',
    subtitle: 'Managing director',
    children: [
      {
        key: 'eng',
        label: 'Leo Fischer',
        subtitle: 'Engineering',
        children: [
          { key: 'platform', label: 'Ines Costa', subtitle: 'Platform' },
          { key: 'apps', label: 'Omar Haddad', subtitle: 'Applications' },
        ],
      },
      { key: 'ops', label: 'Nora Lindqvist', subtitle: 'Operations' },
    ],
  };

  protected readonly closed = signal<readonly string[]>([]);
  protected readonly selected = signal<string | null>(null);
  protected readonly last = signal('none');

  protected readonly basicScript = `readonly company: StarOrgNode = {
  key: 'ceo',
  label: 'Maya Brandt',
  subtitle: 'Managing director',
  children: [
    {
      key: 'eng',
      label: 'Leo Fischer',
      subtitle: 'Engineering',
      children: [{ key: 'platform', label: 'Ines Costa', subtitle: 'Platform' }],
    },
    { key: 'ops', label: 'Nora Lindqvist', subtitle: 'Operations' },
  ],
};
readonly closed = signal<readonly string[]>([]);`;
  protected readonly selectableScript = `readonly selected = signal<string | null>(null);
readonly last = signal('none');`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template starOrgNode',
      description:
        'The content of every node, in place of the label and the subtitle. The context has $implicit (the node) and level.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-org-line',
      description: 'Color of the connector lines. The default is --star-border-strong.',
    },
    { name: '--star-border', description: 'Border of a node.' },
    { name: '--star-radius-md', description: 'Corner radius of a node.' },
    { name: '--star-surface', description: 'Background of a node.' },
    { name: '--star-primary', description: 'Border of the selected node.' },
    { name: '--star-primary-soft', description: 'Background of the selected node.' },
    { name: '--star-accent', description: 'Focus ring of a node and of a toggle.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description: 'Moves between node buttons (when selectable) and branch toggles.',
    },
    {
      name: 'Enter / Space',
      description: 'On a toggle: hides or shows the branch. On a node button: selects the node.',
    },
  ];
}
