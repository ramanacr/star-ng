import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarMenubar, StarMenuItem } from '@star-ng/ui/menu';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-menubar-page',
  imports: [DOCS, StarButton, StarMenubar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Menubar"
      lead="A horizontal bar of top-level items. An item with child items opens a dropdown. Submenus can go to any depth."
      importFrom="import { StarMenubar } from '@star-ng/ui/menu';"
    >
      <docs-example
        heading="File, edit and view"
        source="menubar/basic"
        [script]="navScript"
        note="A top-level item with items opens a dropdown. A top-level item without items is an action."
      >
        <div class="docs-stack">
          <star-menubar ariaLabel="Main" [items]="nav" (itemClick)="last.set($event.label ?? '')" />
          <p class="docs-output" role="status">Last action: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Content at the end"
        source="menubar/end"
        note="Content with the attribute starMenubarEnd goes to the end of the bar. Content with starMenubarStart goes to the start of the bar. In a left-to-right page the start is the left side."
      >
        <star-menubar ariaLabel="Main with action" [items]="nav">
          <star-button starMenubarEnd size="sm" variant="ghost" leadingIcon="ph-bold ph-plus"
            >New</star-button
          >
        </star-menubar>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        With <code>dir="rtl"</code> the first item is on the right. Arrow left moves to the next
        item, and a dropdown is aligned with the start edge of its item. Content with
        <code>starMenubarStart</code> goes to the right end. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarMenubar', 'StarMenuTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class MenubarPage {
  protected readonly last = signal('none');

  protected readonly nav: readonly StarMenuItem[] = [
    {
      label: 'File',
      icon: 'ph-bold ph-file',
      items: [
        { label: 'New file' },
        { label: 'Open folder' },
        { separator: true },
        { label: 'Export', items: [{ label: 'As PDF' }, { label: 'As CSV' }] },
      ],
    },
    {
      label: 'Edit',
      icon: 'ph-bold ph-pencil-simple',
      items: [{ label: 'Undo' }, { label: 'Redo' }, { label: 'Find', disabled: true }],
    },
    {
      label: 'View',
      icon: 'ph-bold ph-eye',
      items: [{ label: 'Zoom in' }, { label: 'Zoom out' }],
    },
    { label: 'Help', icon: 'ph-bold ph-question' },
  ];

  protected readonly navScript = `readonly last = signal('none');

readonly nav: readonly StarMenuItem[] = [
  {
    label: 'File',
    icon: 'ph-bold ph-file',
    items: [
      { label: 'New file' },
      { label: 'Open folder' },
      { separator: true },
      { label: 'Export', items: [{ label: 'As PDF' }, { label: 'As CSV' }] },
    ],
  },
  {
    label: 'Edit',
    icon: 'ph-bold ph-pencil-simple',
    items: [{ label: 'Undo' }, { label: 'Redo' }, { label: 'Find', disabled: true }],
  },
  {
    label: 'View',
    icon: 'ph-bold ph-eye',
    items: [{ label: 'Zoom in' }, { label: 'Zoom out' }],
  },
  { label: 'Help', icon: 'ph-bold ph-question' },
];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starMenuTemplate]',
      description:
        'Content child. "item" replaces the content of each item (icon, label, shortcut; let-level, let-hasSubmenu), "itemIcon" the icon of an item with an icon, "start" and "end" add content before and after the items. PrimeNG #item, #itemicon, #start and #end.',
    },
    {
      name: 'ng-template[starIcon="submenu"]',
      description: 'Content child. Replaces the submenu arrow. PrimeNG #submenuicon.',
    },
    {
      name: '[starMenubarStart]',
      description: 'Content at the start of the bar, for example a logo.',
    },
    {
      name: '[starMenubarEnd]',
      description: 'Content at the end of the bar, for example a button.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the bar.' },
    { name: '--star-border', description: 'Border of the bar.' },
    { name: '--star-radius-lg', description: 'Corner radius of the bar.' },
    { name: '--star-surface-muted', description: 'Background of the hovered or open item.' },
    { name: '--star-primary', description: 'Text color of an active router link item.' },
    { name: '--star-accent', description: 'Focus ring of an item.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow left / Arrow right', description: 'Moves between the top-level items.' },
    {
      name: 'Arrow down / Enter / Space',
      description: 'Opens the dropdown of the focused item.',
    },
    { name: 'Arrow up / Arrow down', description: 'Moves inside a dropdown.' },
    { name: 'Arrow right / Arrow left', description: 'Opens or closes a nested submenu.' },
    { name: 'Letter keys', description: 'Typeahead inside a dropdown.' },
    {
      name: 'Escape',
      description: 'Closes the dropdown. The focus returns to its top-level item.',
    },
  ];
}
