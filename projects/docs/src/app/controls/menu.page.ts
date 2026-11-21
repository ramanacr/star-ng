import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarMenu, StarMenuItem, StarMenuTemplate, StarMenuTrigger } from '@star-ng/ui/menu';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-menu-page',
  imports: [DOCS, StarButton, StarMenu, StarMenuTemplate, StarMenuTrigger],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Menu"
      lead="A list of actions. It opens as a popup from any trigger, or it stays in place as an inline list. Built on the Angular CDK menu: roving focus, typeahead, submenus and focus return are included."
      importFrom="import { StarMenu, StarMenuTrigger } from '@star-ng/ui/menu';"
    >
      <docs-example
        heading="Popup menu"
        source="menu/popup"
        [script]="fileScript"
        note="Put starMenuTrigger on a button and point it at a star-menu. Enter, Space or Arrow down on the button opens the menu. Escape closes it and returns the focus to the button."
      >
        <div class="docs-stack">
          <star-button variant="secondary" [starMenuTrigger]="fileMenu">File</star-button>
          <star-menu #fileMenu [items]="fileItems" (itemClick)="last.set($event.label ?? '')" />
          <p class="docs-output" role="status">Last action: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Icons and shortcuts"
        source="menu/icons"
        [script]="iconScript"
        note="An icon is a Phosphor icon class. A shortcut is only a hint: the menu does not listen to it."
      >
        <star-button variant="secondary" [starMenuTrigger]="editMenu">Edit</star-button>
        <star-menu #editMenu [items]="editItems" />
      </docs-example>

      <docs-example
        heading="Separators, disabled and danger items"
        source="menu/states"
        [script]="statesScript"
        note="A separator groups items. A disabled item has aria-disabled and does not run. A danger item has a red tone for destructive actions."
      >
        <star-button variant="secondary" [starMenuTrigger]="orderMenu">Order actions</star-button>
        <star-menu #orderMenu [items]="orderItems" />
      </docs-example>

      <docs-example
        heading="Nested submenu"
        source="menu/nested"
        [script]="nestedScript"
        note="An item with items opens a submenu. Arrow right opens it, Arrow left closes it."
      >
        <star-button variant="secondary" [starMenuTrigger]="viewMenu">View</star-button>
        <star-menu #viewMenu [items]="viewItems" />
      </docs-example>

      <docs-example
        heading="Icon button trigger"
        source="menu/icon-trigger"
        note="A trigger without text needs an accessible name. Use an aria-label on the button."
      >
        <button
          type="button"
          class="star-btn star-btn--secondary star-btn--icon"
          aria-label="Row actions"
          [starMenuTrigger]="rowMenu"
        >
          <i class="ph-bold ph-dots-three-vertical" aria-hidden="true"></i>
        </button>
        <star-menu #rowMenu [items]="fileItems" />
      </docs-example>

      <docs-example
        heading="Inline menu"
        source="menu/inline"
        note="With inline, the menu renders in place. Use an ariaLabel to name it."
      >
        <star-menu inline ariaLabel="Inline menu" [items]="viewItems" />
      </docs-example>

      <docs-example
        heading="Groups, start and end"
        source="menu/groups"
        [script]="groupScript"
        note="An item with group shows its items in place under a heading (a group with aria-labelledby), as p-menu does. starMenuTemplate with start and end adds content around the items, outside the menu role; submenuHeader replaces the heading. show and hide report the popup, submenuShow and submenuHide a submenu."
      >
        <star-menu inline ariaLabel="Workspace menu" [items]="groupItems">
          <ng-template starMenuTemplate="start">
            <span class="docs-output">Workspace: Orders</span>
          </ng-template>
          <ng-template starMenuTemplate="submenuHeader" let-item>
            {{ item.label }} actions
          </ng-template>
          <ng-template starMenuTemplate="end">
            <span class="docs-output">2 people online</span>
          </ng-template>
        </star-menu>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The p-menu and p-tieredmenu names that StarNG gives in another way: model is items, popup is
        the default (inline for an in-place menu), onShow and onHide are show and hide, onFocus and
        onBlur are the native focusin and focusout events, autoDisplay is always on (a submenu opens
        on hover), and style and styleClass are the pass-through pt. Not needed: appendTo,
        autoZIndex and baseZIndex (the popup is in the top layer) and breakpoint (no separate
        small-screen mode).
      </p>

      <h2>Right-to-left</h2>
      <p>
        Submenus open toward the start side of the menu: to the left in a right-to-left page. Arrow
        left opens a submenu and Arrow right closes it, and the submenu arrow turns around. A popup
        is aligned with the start edge of its trigger. The menu follows a change of
        <code>dir</code> at run time. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarMenu', 'StarMenuTrigger', 'StarMenuTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Technical notes</h2>
      <p>
        A modal <code>dialog</code> makes the rest of the page inert. The Angular CDK menu puts its
        popup in the overlay container, outside the dialog, so the popup would show but take no
        click and no key. The function <code>keepMenuInsideDialog</code> in
        <code>@star-ng/ui/menu</code> moves the popup into the dialog when the trigger is inside
        one. The menu trigger, the context menu and every submenu trigger apply it.
      </p>
      <p>
        <code>keepMenuInsideDialog</code> wraps a private factory of the CDK menu trigger, because
        the CDK has no public option for this. If a CDK update removes the factory, the function
        does nothing and the end-to-end test for popups inside a modal dialog fails.
      </p>
    </docs-page>
  `,
})
export class MenuPage {
  protected readonly last = signal('none');

  protected readonly fileItems: readonly StarMenuItem[] = [
    { label: 'New file' },
    { label: 'Open folder' },
    { label: 'Save' },
    { label: 'Exit' },
  ];
  protected readonly editItems: readonly StarMenuItem[] = [
    { label: 'Cut', icon: 'ph-bold ph-scissors', shortcut: 'Ctrl+X' },
    { label: 'Copy', icon: 'ph-bold ph-copy', shortcut: 'Ctrl+C' },
    { label: 'Paste', icon: 'ph-bold ph-clipboard', shortcut: 'Ctrl+V' },
  ];
  protected readonly orderItems: readonly StarMenuItem[] = [
    { label: 'Open', icon: 'ph-bold ph-arrow-square-out' },
    { label: 'Duplicate', icon: 'ph-bold ph-copy' },
    { separator: true },
    { label: 'Export', icon: 'ph-bold ph-export', disabled: true },
    { label: 'Delete', icon: 'ph-bold ph-trash', danger: true },
  ];
  protected readonly viewItems: readonly StarMenuItem[] = [
    { label: 'Zoom in' },
    { label: 'Zoom out' },
    {
      label: 'Layout',
      items: [{ label: 'Single column' }, { label: 'Two columns' }, { label: 'Grid' }],
    },
  ];

  protected readonly groupItems: readonly StarMenuItem[] = [
    { label: 'Search', icon: 'ph-bold ph-magnifying-glass' },
    {
      label: 'Orders',
      group: true,
      items: [{ label: 'New order' }, { label: 'Import orders' }],
    },
    {
      label: 'Invoices',
      group: true,
      items: [{ label: 'New invoice' }, { label: 'Send reminders' }],
    },
  ];
  protected readonly groupScript = `readonly groupItems: readonly StarMenuItem[] = [
  { label: 'Search', icon: 'ph-bold ph-magnifying-glass' },
  {
    label: 'Orders',
    group: true,
    items: [{ label: 'New order' }, { label: 'Import orders' }],
  },
  {
    label: 'Invoices',
    group: true,
    items: [{ label: 'New invoice' }, { label: 'Send reminders' }],
  },
];`;

  protected readonly fileScript = `readonly last = signal('none');

readonly fileItems: readonly StarMenuItem[] = [
  { label: 'New file' },
  { label: 'Open folder' },
  { label: 'Save' },
  { label: 'Exit' },
];`;
  protected readonly iconScript = `readonly editItems: readonly StarMenuItem[] = [
  { label: 'Cut', icon: 'ph-bold ph-scissors', shortcut: 'Ctrl+X' },
  { label: 'Copy', icon: 'ph-bold ph-copy', shortcut: 'Ctrl+C' },
  { label: 'Paste', icon: 'ph-bold ph-clipboard', shortcut: 'Ctrl+V' },
];`;
  protected readonly statesScript = `readonly orderItems: readonly StarMenuItem[] = [
  { label: 'Open', icon: 'ph-bold ph-arrow-square-out' },
  { label: 'Duplicate', icon: 'ph-bold ph-copy' },
  { separator: true },
  { label: 'Export', icon: 'ph-bold ph-export', disabled: true },
  { label: 'Delete', icon: 'ph-bold ph-trash', danger: true },
];`;
  protected readonly nestedScript = `readonly viewItems: readonly StarMenuItem[] = [
  { label: 'Zoom in' },
  { label: 'Zoom out' },
  {
    label: 'Layout',
    items: [{ label: 'Single column' }, { label: 'Two columns' }, { label: 'Grid' }],
  },
];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starMenuTemplate]',
      description:
        'Content child. "item" replaces the content of each item (icon, label, shortcut; let-level, let-hasSubmenu), "itemIcon" the icon of an item with an icon, "submenuHeader" the heading of a group, "start" and "end" add content before and after the items. PrimeNG #item, #itemicon, #submenuheader, #start and #end.',
    },
    {
      name: 'ng-template[starIcon="submenu"]',
      description: 'Content child. Replaces the submenu arrow. PrimeNG #submenuicon.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the popup.' },
    { name: '--star-border', description: 'Border of the popup and the separators.' },
    { name: '--star-radius-lg', description: 'Corner radius of the popup.' },
    { name: '--star-shadow-lg', description: 'Shadow of the popup.' },
    { name: '--star-surface-muted', description: 'Background of the active item.' },
    { name: '--star-danger', description: 'Text color of a danger item.' },
    { name: '--star-accent', description: 'Focus ring of an item.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter / Space / Arrow down', description: 'On the trigger: opens the menu.' },
    { name: 'Arrow up / Arrow down', description: 'Moves between items. The focus wraps around.' },
    { name: 'Home / End', description: 'Moves to the first or the last item.' },
    {
      name: 'Letter keys',
      description: 'Typeahead: moves to the item that starts with the typed text.',
    },
    { name: 'Arrow right', description: 'Opens the submenu of the focused item.' },
    { name: 'Arrow left', description: 'Closes a submenu and returns to its parent item.' },
    { name: 'Enter / Space', description: 'Runs the focused item and closes the menu.' },
    { name: 'Escape', description: 'Closes the menu. The focus returns to the trigger.' },
  ];
}
