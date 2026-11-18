import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import {
  StarDropdown,
  StarDropdownItem,
  StarDropdownSelection,
  StarDropdownTrigger,
} from '@star-ng/ui/dropdown';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-dropdown-page',
  imports: [DOCS, StarButton, StarDropdown, StarDropdownItem, StarDropdownTrigger],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Drop-down"
      lead="A list of items that opens from any trigger and reports the chosen item. It is not bound to a form value: for a form field, use the select. For a list of commands, use the menu. The Ignite UI equivalent is igx-drop-down."
      importFrom="import { StarDropdown, StarDropdownItem, StarDropdownTrigger } from '@star-ng/ui/dropdown';"
    >
      <docs-example
        heading="Choose from a list"
        source="dropdown/basic"
        [script]="basicScript"
        note="The list is a listbox. It takes the focus and shows the active option with aria-activedescendant. The trigger gets aria-haspopup, aria-expanded and aria-controls."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              variant="secondary"
              trailingIcon="ph-bold ph-caret-down"
              [starDropdownTrigger]="formats"
            >
              Export as
            </star-button>
          </div>
          <star-dropdown
            #formats
            ariaLabel="Export format"
            [(value)]="format"
            (selectionChange)="onSelect($event)"
          >
            <star-dropdown-item header>Documents</star-dropdown-item>
            <star-dropdown-item value="pdf">PDF</star-dropdown-item>
            <star-dropdown-item value="docx" disabled>Word document</star-dropdown-item>
            <star-dropdown-item divider />
            <star-dropdown-item header>Data</star-dropdown-item>
            <star-dropdown-item value="csv">CSV</star-dropdown-item>
            <star-dropdown-item value="xlsx">Spreadsheet</star-dropdown-item>
            <star-dropdown-item value="json">JSON</star-dropdown-item>
          </star-dropdown>
          <p class="docs-output" role="status">Export format: {{ chosen() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Keep the list open"
        source="dropdown/keep-open"
        [script]="keepScript"
        note="With closeOnSelect set to false, the list stays open after a choice. Escape or Tab closes it."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button variant="secondary" [starDropdownTrigger]="cities">
              Add a city
            </star-button>
          </div>
          <star-dropdown
            #cities
            ariaLabel="Cities"
            [closeOnSelect]="false"
            (selectionChange)="added.set(added() + $event.label + ' ')"
          >
            <star-dropdown-item value="berlin">Berlin</star-dropdown-item>
            <star-dropdown-item value="lisbon">Lisbon</star-dropdown-item>
            <star-dropdown-item value="oslo">Oslo</star-dropdown-item>
            <star-dropdown-item value="toronto">Toronto</star-dropdown-item>
          </star-dropdown>
          <p class="docs-output" role="status">Added: {{ added() || 'none' }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarDropdown', 'StarDropdownItem', 'StarDropdownTrigger']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Technical notes</h2>
      <p>
        The menu (CDK Menu) has menu semantics: its items are commands. A drop-down reports a choice
        and marks the chosen item, so it is a listbox, built on the active-descendant key manager of
        the CDK. The list is a native popover that the CDK places next to the trigger, like the
        panels of the select and the popover.
      </p>
    </docs-page>
  `,
})
export class DropdownPage {
  protected readonly format = signal<unknown>(undefined);
  protected readonly chosen = signal('none');
  protected readonly added = signal('');

  protected onSelect(selection: StarDropdownSelection): void {
    this.chosen.set(selection.label);
  }

  protected readonly basicScript = `readonly format = signal<unknown>(undefined);
readonly chosen = signal('none');

onSelect(selection: StarDropdownSelection): void {
  this.chosen.set(selection.label);
}`;
  protected readonly keepScript = `readonly added = signal('');`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '(default) of star-dropdown',
      description: 'The star-dropdown-item elements.',
    },
    { name: '(default) of star-dropdown-item', description: 'The label of the item.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the list.' },
    { name: '--star-surface-muted', description: 'Background of the active option.' },
    { name: '--star-primary-soft', description: 'Background of the chosen option.' },
    {
      name: '--star-accent',
      description: 'Ring of the active option while the list has the focus.',
    },
    { name: '--star-border', description: 'Border of the list and the divider line.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Enter / Space / Arrow down',
      description: 'On the trigger: opens the list on the chosen option, else on the first one.',
    },
    {
      name: 'Arrow up',
      description: 'On the trigger: opens the list on the chosen option, else on the last one.',
    },
    {
      name: 'Arrow down / Arrow up',
      description: 'Moves to the next or the previous option. Disabled options are skipped.',
    },
    { name: 'Home / End', description: 'Moves to the first or the last option.' },
    { name: 'Letters', description: 'Moves to the next option that starts with the typed text.' },
    { name: 'Enter / Space', description: 'Chooses the active option.' },
    { name: 'Escape', description: 'Closes the list. The focus returns to the trigger.' },
    { name: 'Tab', description: 'Closes the list and moves on from the trigger.' },
  ];
}
