import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarContextMenu, StarMenu, StarMenuItem } from '@star-ng/ui/menu';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './context-menu.page.scss',
  selector: 'docs-context-menu-page',
  imports: [DOCS, StarContextMenu, StarMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Context menu"
      lead="A menu that opens at the pointer on right-click, or with the context-menu key. Add it to any element, for example a table row."
      importFrom="import { StarContextMenu, StarMenu } from '@star-ng/ui/menu';"
    >
      <docs-example
        heading="Right-click area"
        source="context-menu/basic"
        [script]="basicScript"
        note="The element needs tabindex 0 when the menu must be reachable with the keyboard. The context-menu key or Shift+F10 sends a contextmenu event, which opens the menu."
      >
        <div class="docs-stack">
          <div class="docs-output" tabindex="0" aria-label="Order row" [starContextMenu]="rowMenu">
            Order 1042: right-click here
          </div>
          <star-menu #rowMenu [items]="rowItems" (itemClick)="last.set($event.label ?? '')" />
          <p class="docs-output" role="status">Last action: {{ last() }}</p>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        Arrow left opens a submenu and Arrow right closes it in a right-to-left page. See the
        Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarContextMenu']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Technical notes</h2>
      <p>
        A modal <code>dialog</code> makes the rest of the page inert. When the element is inside a
        dialog, the context menu goes into that dialog (<code>keepMenuInsideDialog</code> in
        <code>@star-ng/ui/menu</code>), so the menu stays usable. The function accepts both
        <code>CdkMenuTrigger</code> and <code>CdkContextMenuTrigger</code>.
      </p>
    </docs-page>
  `,
})
export class ContextMenuPage {
  protected readonly last = signal('none');

  protected readonly rowItems: readonly StarMenuItem[] = [
    { label: 'Open', icon: 'ph-bold ph-arrow-square-out' },
    { label: 'Copy link', icon: 'ph-bold ph-link' },
    { separator: true },
    { label: 'Delete', icon: 'ph-bold ph-trash', danger: true },
  ];

  protected readonly basicScript = `readonly last = signal('none');

readonly rowItems: readonly StarMenuItem[] = [
  { label: 'Open', icon: 'ph-bold ph-arrow-square-out' },
  { label: 'Copy link', icon: 'ph-bold ph-link' },
  { separator: true },
  { label: 'Delete', icon: 'ph-bold ph-trash', danger: true },
];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'star-menu slots',
      description:
        'Write starMenuTemplate and starIcon="submenu" inside the star-menu that the directive opens. PrimeNG #item and #submenuicon. show and hide of the star-menu are PrimeNG onShow and onHide.',
    },
    {
      name: '(none)',
      description: 'A directive: it adds the behavior to the element that has it.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the popup.' },
    { name: '--star-border', description: 'Border of the popup.' },
    { name: '--star-shadow-lg', description: 'Shadow of the popup.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Context-menu key / Shift+F10',
      description: 'Opens the menu (the browser sends a contextmenu event).',
    },
    { name: 'Arrow up / Arrow down', description: 'Moves between items.' },
    { name: 'Arrow right / Arrow left', description: 'Opens or closes a submenu.' },
    { name: 'Enter / Space', description: 'Runs the focused item and closes the menu.' },
    { name: 'Escape', description: 'Closes the menu.' },
  ];
}
