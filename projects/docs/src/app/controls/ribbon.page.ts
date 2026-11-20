import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  StarRibbon,
  StarRibbonBackstage,
  StarRibbonCommand,
  StarRibbonGroup,
  StarRibbonItem,
  StarRibbonItemTemplate,
  StarRibbonTab,
} from '@star-ng/ui/ribbon';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-ribbon-page',
  imports: [
    DOCS,
    StarRibbon,
    StarRibbonTab,
    StarRibbonGroup,
    StarRibbonBackstage,
    StarRibbonItemTemplate,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .narrow {
      max-inline-size: 15rem;
    }
    .size {
      inline-size: 4.5rem;
      block-size: 1.75rem;
      font: var(--star-type-body-sm);
    }
    .backstage {
      margin: 0;
    }
  `,
  template: `
    <docs-page
      heading="Ribbon"
      lead="Tabs of command groups, as in a document editor. Items are buttons, toggle buttons, split buttons, dropdown menus, button groups or custom templates. A narrow ribbon makes its groups small, then collapses them to one button each. Alt or F10 shows KeyTips. The Kendo UI and Syncfusion equivalent is Ribbon."
      importFrom="import { StarRibbon, StarRibbonGroup, StarRibbonTab } from '@star-ng/ui/ribbon';"
    >
      <docs-example
        heading="Document editor"
        source="ribbon/editor"
        [script]="editorScript"
        note="Every item sends command with its id. A toggle button sends the next pressed state, a menu entry sends its id as value. The ribbon never changes the items: the owner sets pressed. Press Alt or F10 in the ribbon, then H and B, to toggle Bold with the keyboard."
      >
        <div class="docs-stack">
          <star-ribbon [(selectedTab)]="tab" (command)="run($event)">
            <star-ribbon-backstage>
              <p class="backstage">Recent documents: Order summary, Project plan, Invoice notes.</p>
            </star-ribbon-backstage>
            <star-ribbon-tab key="home" label="Home" keyTip="H">
              <star-ribbon-group
                label="Clipboard"
                icon="ph-bold ph-clipboard"
                [items]="clipboard"
                dialogLauncher="clipboard-options"
              />
              <star-ribbon-group
                label="Font"
                icon="ph-bold ph-text-aa"
                [items]="font()"
                dialogLauncher="font-options"
              >
                <ng-template starRibbonItem="font-size" let-item>
                  <select class="size" [attr.aria-label]="item.label" (change)="size($event)">
                    <option>11</option>
                    <option>12</option>
                    <option>14</option>
                  </select>
                </ng-template>
              </star-ribbon-group>
              <star-ribbon-group
                label="Paragraph"
                icon="ph-bold ph-paragraph"
                [items]="paragraph()"
              />
            </star-ribbon-tab>
            <star-ribbon-tab key="insert" label="Insert">
              <star-ribbon-group label="Tables" icon="ph-bold ph-table" [items]="tables" />
              <star-ribbon-group label="Media" icon="ph-bold ph-image" [items]="media" />
            </star-ribbon-tab>
            <star-ribbon-tab key="review" label="Review">
              <star-ribbon-group label="Comments" icon="ph-bold ph-chat-text" [items]="comments" />
            </star-ribbon-tab>
          </star-ribbon>
          <p class="docs-output" role="status">Last command: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Narrow ribbon"
        source="ribbon/narrow"
        [script]="narrowScript"
        note="The groups get small from the last to the first, then collapse to one button each. The button opens the group as a flyout; Escape closes it. The ribbon measures itself with a ResizeObserver, in the browser only."
      >
        <div class="narrow">
          <star-ribbon (command)="run($event)">
            <star-ribbon-tab key="home" label="Home">
              <star-ribbon-group
                label="Clipboard"
                icon="ph-bold ph-clipboard"
                [items]="clipboard"
              />
              <star-ribbon-group label="Font" icon="ph-bold ph-text-aa" [items]="font()" />
              <star-ribbon-group
                label="Paragraph"
                icon="ph-bold ph-paragraph"
                [items]="paragraph()"
              />
            </star-ribbon-tab>
          </star-ribbon>
        </div>
      </docs-example>

      <docs-example
        heading="Minimised ribbon"
        source="ribbon/collapsed"
        [script]="collapsedScript"
        note="collapsed shows only the tab headers. A click on a tab shows the panel until the next command, Escape or a click outside. A double click on a tab, or the arrow button, switches the mode."
      >
        <star-ribbon [(collapsed)]="collapsed" (command)="run($event)">
          <star-ribbon-tab key="home" label="Home">
            <star-ribbon-group label="Clipboard" [items]="clipboard" />
          </star-ribbon-tab>
          <star-ribbon-tab key="review" label="Review">
            <star-ribbon-group label="Comments" [items]="comments" />
          </star-ribbon-tab>
        </star-ribbon>
      </docs-example>

      <docs-api
        [of]="['StarRibbon', 'StarRibbonTab', 'StarRibbonGroup', 'StarRibbonBackstage']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class RibbonPage {
  protected readonly tab = signal<string | null>('home');
  protected readonly collapsed = signal(true);
  protected readonly last = signal('none');
  private readonly bold = signal(false);
  private readonly italic = signal(false);
  private readonly align = signal('start');

  protected readonly clipboard: readonly StarRibbonItem[] = [
    {
      id: 'paste',
      label: 'Paste',
      type: 'split',
      size: 'large',
      icon: 'ph-bold ph-clipboard-text',
      keyTip: 'V',
      menu: [
        { id: 'paste-text', label: 'Paste text only' },
        { id: 'paste-format', label: 'Paste formatting' },
      ],
    },
    { id: 'cut', label: 'Cut', icon: 'ph-bold ph-scissors', keyTip: 'X' },
    { id: 'copy', label: 'Copy', icon: 'ph-bold ph-copy', keyTip: 'C' },
    { id: 'format-painter', label: 'Format painter', icon: 'ph-bold ph-paint-brush' },
  ];
  protected readonly font = computed<StarRibbonItem[]>(() => [
    { id: 'font-size', label: 'Font size', type: 'custom' },
    {
      id: 'bold',
      label: 'Bold',
      type: 'toggle',
      icon: 'ph-bold ph-text-b',
      keyTip: 'B',
      pressed: this.bold(),
    },
    {
      id: 'italic',
      label: 'Italic',
      type: 'toggle',
      icon: 'ph-bold ph-text-italic',
      keyTip: 'I',
      pressed: this.italic(),
    },
    {
      id: 'color',
      label: 'Text color',
      type: 'dropdown',
      icon: 'ph-bold ph-palette',
      menu: [
        { id: 'auto', label: 'Automatic' },
        { id: 'accent', label: 'Accent' },
        { id: 'muted', label: 'Muted' },
      ],
    },
  ]);
  protected readonly paragraph = computed<StarRibbonItem[]>(() => [
    {
      id: 'alignment',
      label: 'Alignment',
      type: 'group',
      items: [
        { id: 'start', label: 'Align start', icon: 'ph-bold ph-text-align-left' },
        { id: 'center', label: 'Center', icon: 'ph-bold ph-text-align-center' },
        { id: 'end', label: 'Align end', icon: 'ph-bold ph-text-align-right' },
      ].map((item): StarRibbonItem => ({
        ...item,
        type: 'toggle',
        pressed: item.id === this.align(),
      })),
    },
    { id: 'bullets', label: 'Bullets', icon: 'ph-bold ph-list-bullets' },
    { id: 'numbering', label: 'Numbering', icon: 'ph-bold ph-list-numbers' },
  ]);
  protected readonly tables: readonly StarRibbonItem[] = [
    {
      id: 'table',
      label: 'Table',
      type: 'dropdown',
      size: 'large',
      icon: 'ph-bold ph-table',
      menu: [
        { id: 'table-2', label: 'Two columns' },
        { id: 'table-3', label: 'Three columns' },
        { id: 'table-4', label: 'Four columns' },
      ],
    },
  ];
  protected readonly media: readonly StarRibbonItem[] = [
    { id: 'picture', label: 'Picture', size: 'large', icon: 'ph-bold ph-image' },
    { id: 'chart', label: 'Chart', size: 'large', icon: 'ph-bold ph-chart-bar' },
  ];
  protected readonly comments: readonly StarRibbonItem[] = [
    { id: 'comment', label: 'New comment', size: 'large', icon: 'ph-bold ph-chat-text' },
    { id: 'previous', label: 'Previous', icon: 'ph-bold ph-arrow-up' },
    { id: 'next', label: 'Next', icon: 'ph-bold ph-arrow-down' },
  ];

  protected run(command: StarRibbonCommand): void {
    if (command.id === 'bold') this.bold.set(!!command.value);
    if (command.id === 'italic') this.italic.set(!!command.value);
    if (['start', 'center', 'end'].includes(command.id)) this.align.set(command.id);
    this.last.set(command.value === undefined ? command.id : `${command.id} (${command.value})`);
  }

  protected size(event: Event): void {
    this.last.set(`font-size (${(event.target as HTMLSelectElement).value})`);
  }

  protected readonly editorScript = `readonly tab = signal<string | null>('home');
readonly last = signal('none');
readonly bold = signal(false);

readonly clipboard: StarRibbonItem[] = [
  {
    id: 'paste', label: 'Paste', type: 'split', size: 'large', icon: 'ph-bold ph-clipboard-text', keyTip: 'V',
    menu: [
      { id: 'paste-text', label: 'Paste text only' },
      { id: 'paste-format', label: 'Paste formatting' },
    ],
  },
  { id: 'cut', label: 'Cut', icon: 'ph-bold ph-scissors', keyTip: 'X' },
  { id: 'copy', label: 'Copy', icon: 'ph-bold ph-copy', keyTip: 'C' },
];
// The owner keeps the pressed state.
readonly font = computed<StarRibbonItem[]>(() => [
  { id: 'font-size', label: 'Font size', type: 'custom' },
  { id: 'bold', label: 'Bold', type: 'toggle', icon: 'ph-bold ph-text-b', keyTip: 'B', pressed: this.bold() },
]);

run(command: StarRibbonCommand): void {
  if (command.id === 'bold') this.bold.set(!!command.value);
  this.last.set(command.id);
}`;
  protected readonly narrowScript = `// The same groups as the document editor, in a 15rem wide container.`;
  protected readonly collapsedScript = `readonly collapsed = signal(true);`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starRibbonItem]',
      description:
        'Custom item of a group: the value is the id of an item with type "custom". Context: $implicit is the item.',
    },
    { name: 'star-ribbon-backstage', description: 'Content of the backstage (file) view.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-surface',
      description: 'Background of the ribbon, the flyouts and the KeyTips.',
    },
    {
      name: '--star-border',
      description: 'Border of the ribbon and the separators of the groups.',
    },
    { name: '--star-primary', description: 'Line under the selected tab.' },
    { name: '--star-primary-soft', description: 'Background of a pressed toggle button.' },
    { name: '--star-accent', description: 'Focus ring.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow left / Arrow right',
      description: 'Moves between the tabs, or between the items of a group.',
    },
    { name: 'Home / End', description: 'First or last tab, or first or last item of a group.' },
    { name: 'Tab', description: 'Moves to the next group. Each group has one tab stop.' },
    { name: 'Alt or F10', description: 'Shows or hides the KeyTips.' },
    {
      name: 'KeyTip letters',
      description: 'Selects the tab, then activates the item with these letters.',
    },
    {
      name: 'Escape',
      description:
        'Steps back one KeyTip level, closes a group flyout, the shown panel of a minimised ribbon or the backstage.',
    },
    { name: 'Arrow down', description: 'Opens the menu of a dropdown or split button.' },
  ];
}
