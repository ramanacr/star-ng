import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarCommand, StarCommandPalette, StarCommandTemplate } from '@star-ng/ui/command-palette';
import { StarEmptyTemplate } from '@star-ng/ui/core';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-command-palette-page-content',
  imports: [DOCS, StarButton, StarCommandPalette, StarCommandTemplate, StarEmptyTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .option {
      display: grid;
      flex: 1;
      min-width: 0;
    }
    .option small {
      color: var(--star-text-muted);
    }
  `,
  template: `
    <docs-page
      heading="Command palette"
      lead="A modal search over commands. It opens with a global shortcut, Control+K or Command+K by default, filters as you type and runs the chosen command. The PrimeNG equivalent is p-commandmenu."
      importFrom="import { StarCommandPalette } from '@star-ng/ui/command-palette';"
    >
      <docs-example
        heading="Commands in groups"
        source="command-palette/basic"
        [script]="basicScript"
        note="Press Control+K (Command+K on a Mac) anywhere on the page, or use the button. Type to filter: a label that starts with the text comes first, then a word that starts with it, then any match, then the keywords. Accents and case do not matter. The commands you ran come first under Recent."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="open.set(true)">
              Open command palette
            </star-button>
          </div>
          <star-command-palette
            [commands]="commands"
            [(visible)]="open"
            (commandRun)="last.set($event.label)"
          />
          <p class="docs-output" role="status">Last command: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Option and empty templates"
        source="command-palette/templates"
        [script]="templatesScript"
        note="ng-template starCommand renders each option; ng-template starEmpty shows when nothing matches. This palette has no global shortcut (hotkey is null), so it does not answer Control+K."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="peopleOpen.set(true)">
              Find a person
            </star-button>
          </div>
          <star-command-palette
            [commands]="people"
            [(visible)]="peopleOpen"
            [hotkey]="null"
            [maxRecent]="0"
            placeholder="Search people"
            ariaLabel="Find a person"
            (commandRun)="person.set($event.label)"
          >
            <ng-template starCommand let-command>
              <i class="ph-bold ph-user-circle" aria-hidden="true"></i>
              <span class="option">
                <span>{{ command.label }}</span>
                <small>{{ command.group }} · {{ command.keywords?.[0] }}</small>
              </span>
            </ng-template>
            <ng-template starEmpty let-query>No person matches “{{ query }}”.</ng-template>
          </star-command-palette>
          <p class="docs-output" role="status">Chosen: {{ person() }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarCommandPalette']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class CommandPalettePageContent {
  protected readonly open = signal(false);
  protected readonly last = signal('none');
  protected readonly peopleOpen = signal(false);
  protected readonly person = signal('none');

  protected readonly commands: readonly StarCommand[] = [
    {
      id: 'new-order',
      label: 'New order',
      group: 'Orders',
      icon: 'ph-bold ph-plus',
      shortcut: 'Alt+N',
    },
    { id: 'find-order', label: 'Find order', group: 'Orders', icon: 'ph-bold ph-magnifying-glass' },
    {
      id: 'export',
      label: 'Export orders',
      group: 'Orders',
      icon: 'ph-bold ph-download-simple',
      keywords: ['csv', 'download'],
    },
    {
      id: 'archive',
      label: 'Archive orders',
      group: 'Orders',
      icon: 'ph-bold ph-archive',
      disabled: true,
    },
    { id: 'dashboard', label: 'Go to dashboard', group: 'Navigation', icon: 'ph-bold ph-house' },
    {
      id: 'settings',
      label: 'Go to settings',
      group: 'Navigation',
      icon: 'ph-bold ph-gear',
      keywords: ['preferences', 'options'],
    },
    { id: 'cafe', label: 'Café locations', group: 'Navigation', icon: 'ph-bold ph-map-pin' },
    { id: 'theme', label: 'Switch theme', group: 'View', icon: 'ph-bold ph-moon' },
  ];

  protected readonly people: readonly StarCommand[] = [
    { id: 'p1', label: 'Ana Silva', group: 'Lisbon', keywords: ['Sales'] },
    { id: 'p2', label: 'Jonas Berg', group: 'Oslo', keywords: ['Support'] },
    { id: 'p3', label: 'Lucía Ortega', group: 'Madrid', keywords: ['Finance'] },
    { id: 'p4', label: 'Marco Bianchi', group: 'Turin', keywords: ['Sales'] },
  ];

  protected readonly basicScript = `readonly open = signal(false);
readonly last = signal('none');
readonly commands: readonly StarCommand[] = [
  { id: 'new-order', label: 'New order', group: 'Orders', icon: 'ph-bold ph-plus', shortcut: 'Alt+N' },
  { id: 'find-order', label: 'Find order', group: 'Orders', icon: 'ph-bold ph-magnifying-glass' },
  { id: 'export', label: 'Export orders', group: 'Orders', icon: 'ph-bold ph-download-simple', keywords: ['csv', 'download'] },
  { id: 'archive', label: 'Archive orders', group: 'Orders', icon: 'ph-bold ph-archive', disabled: true },
  { id: 'dashboard', label: 'Go to dashboard', group: 'Navigation', icon: 'ph-bold ph-house' },
  { id: 'settings', label: 'Go to settings', group: 'Navigation', icon: 'ph-bold ph-gear', keywords: ['preferences', 'options'] },
  { id: 'cafe', label: 'Café locations', group: 'Navigation', icon: 'ph-bold ph-map-pin' },
  // run() is called after the palette closed.
  { id: 'theme', label: 'Switch theme', group: 'View', icon: 'ph-bold ph-moon', run: () => this.toggleTheme() },
];`;
  protected readonly templatesScript = `readonly peopleOpen = signal(false);
readonly person = signal('none');
readonly people: readonly StarCommand[] = [
  { id: 'p1', label: 'Ana Silva', group: 'Lisbon', keywords: ['Sales'] },
  { id: 'p2', label: 'Jonas Berg', group: 'Oslo', keywords: ['Support'] },
  { id: 'p3', label: 'Lucía Ortega', group: 'Madrid', keywords: ['Finance'] },
  { id: 'p4', label: 'Marco Bianchi', group: 'Turin', keywords: ['Sales'] },
];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starCommand]',
      description:
        'Content of each option. Context: the command ($implicit), active and query. No focusable elements.',
    },
    {
      name: 'ng-template[starEmpty]',
      description: 'Shown when no command matches. Context: the filter text ($implicit).',
    },
    {
      name: 'ng-template[starLoading]',
      description: 'Shown after the options while loading is true.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the palette.' },
    { name: '--star-primary-soft', description: 'Background of the active option.' },
    { name: '--star-accent', description: 'Line under the search field while it has the focus.' },
    { name: '--star-scrim-modal', description: 'Backdrop.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Control+K / Command+K',
      description: 'Opens or closes the palette (the hotkey input).',
    },
    {
      name: 'Arrow down / Arrow up',
      description: 'Moves to the next or previous enabled option, and wraps.',
    },
    { name: 'Page up / Page down', description: 'Moves to the first or the last enabled option.' },
    { name: 'Enter', description: 'Runs the active command and closes the palette.' },
    { name: 'Escape', description: 'Closes the palette. The focus goes back where it was.' },
  ];
}

/**
 * Route component of the page. It loads the route styles (`command-palette.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-command-palette-page',
  imports: [CommandPalettePageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './command-palette.page.scss',
  template: '<docs-command-palette-page-content />',
})
export class CommandPalettePage {}
