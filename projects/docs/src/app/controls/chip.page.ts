import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarChip, StarChipsArea, StarChipSeverity } from '@star-ng/ui/layout';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './chip.page.scss',
  selector: 'docs-chip-page',
  imports: [DOCS, StarChip, StarChipsArea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Chip"
      lead="A small pill with a label, an optional icon or image and an optional remove button. The PrimeNG equivalent is p-chip."
      importFrom="import { StarChip } from '@star-ng/ui/layout';"
    >
      <docs-example heading="Label and icon" source="chip/basic">
        <star-chip label="Design" />
        <star-chip label="Travel" icon="ph-bold ph-airplane" />
        <star-chip label="Team">(4)</star-chip>
      </docs-example>

      <docs-example
        heading="Removable"
        source="chip/removable"
        [script]="removableScript"
        note="The remove button has the label Remove with the name of the chip. The chip emits removed. The page removes it."
      >
        <div class="docs-row">
          @for (name of names(); track name) {
            <star-chip [label]="name" removable (removed)="remove(name)" />
          }
        </div>
        <p class="docs-output" role="status">{{ names().length }} chips left.</p>
      </docs-example>

      <docs-example
        heading="Filter chips"
        source="chip/filters"
        [script]="filtersScript"
        note="severity sets the tone: neutral, info, primary, success, warn, danger (secondary is the same as neutral). Without it the chip keeps its accent look. With clickable, the label area is a button that emits chipClick (Enter and Space work too); the remove button stays separate. A bold key before the value stays; long values end with an ellipsis at --star-chip-max-width. This example sets the size tokens on the row: --star-chip-height: 30px, --star-chip-font: 13px/18px var(--star-font-sans), --star-chip-max-width: 340px and a round hover fill with --star-chip-remove-surface. A smaller remove button (--star-chip-remove-size: 22px) needs 24 px of free space around it for WCAG 2.5.8."
      >
        <div class="docs-stack">
          <div
            class="docs-row"
            style="
              --star-chip-height: 30px;
              --star-chip-font: 13px/18px var(--star-font-sans);
              --star-chip-max-width: 340px;
              --star-chip-remove-surface: color-mix(in srgb, currentColor 14%, transparent);
            "
          >
            @for (filter of filters(); track filter.key) {
              <star-chip
                [severity]="filter.tone"
                clickable
                removable
                (chipClick)="edit(filter.key)"
                (removed)="removeFilter(filter.key)"
                ><b>{{ filter.key }}:</b> {{ filter.value }}</star-chip
              >
            }
          </div>
          <p class="docs-output" role="status">{{ filterStatus() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Chips area"
        source="chip/area"
        [script]="areaScript"
        note="star-chips-area holds chips that move by drag and drop, or with Control+Shift and an arrow key on the focused chip; Delete removes it with removable. The chips are one tab stop (arrow keys move between them), and each move and removal is announced. Ignite UI igx-chips-area."
      >
        <div class="docs-stack">
          <star-chips-area ariaLabel="Sort order" [(items)]="sortOrder" removable />
          <p class="docs-output" role="status">Sort by: {{ sortOrder().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarChip', 'StarChipsArea', 'StarChipsAreaItem']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class ChipPage {
  protected readonly sortOrder = signal<readonly string[]>(['Customer', 'Order date', 'Total']);
  protected readonly areaScript = `readonly sortOrder = signal<readonly string[]>(['Customer', 'Order date', 'Total']);`;
  protected readonly names = signal(['Alpha', 'Beta', 'Gamma']);

  protected remove(name: string): void {
    this.names.update((names) => names.filter((item) => item !== name));
  }

  protected readonly removableScript = `readonly names = signal(['Alpha', 'Beta', 'Gamma']);

remove(name: string): void {
  this.names.update((names) => names.filter((item) => item !== name));
}`;

  protected readonly filters = signal<
    readonly { key: string; value: string; tone: StarChipSeverity }[]
  >([
    { key: 'Status', value: 'Open', tone: 'info' },
    { key: 'Date range', value: 'Last 30 days', tone: 'primary' },
    { key: 'Keyword', value: 'battery overheating after the latest update', tone: 'neutral' },
  ]);
  protected readonly filterStatus = signal('3 filters.');

  protected edit(key: string): void {
    this.filterStatus.set(`Edit the filter ${key}.`);
  }

  protected removeFilter(key: string): void {
    this.filters.update((filters) => filters.filter((item) => item.key !== key));
    this.filterStatus.set(`Removed ${key}. ${this.filters().length} filters.`);
  }

  protected readonly filtersScript = `readonly filters = signal<
  readonly { key: string; value: string; tone: StarChipSeverity }[]
>([
  { key: 'Status', value: 'Open', tone: 'info' },
  { key: 'Date range', value: 'Last 30 days', tone: 'primary' },
  { key: 'Keyword', value: 'battery overheating after the latest update', tone: 'neutral' },
]);
readonly filterStatus = signal('3 filters.');

edit(key: string): void {
  this.filterStatus.set(\`Edit the filter \${key}.\`);
}

removeFilter(key: string): void {
  this.filters.update((filters) => filters.filter((item) => item.key !== key));
  this.filterStatus.set(\`Removed \${key}. \${this.filters().length} filters.\`);
}`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starIcon="remove"]',
      description: 'Content child. Replaces the icon of the remove button. PrimeNG #removeicon.',
    },
    { name: '(default)', description: 'Extra text after the label.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-accent', description: 'Color of the text (no severity).' },
    { name: '--star-accent-soft', description: 'Fill of the chip (no severity).' },
    {
      name: '--star-tone, --star-tone-soft',
      description:
        'Tone and fill of a chip with a severity (set by the severity class; override them on one chip for a custom tone). The text mixes the tone toward --star-text-strong for 4.5:1.',
    },
    { name: '--star-radius-pill', description: 'Corner radius.' },
    { name: '--star-chip-height', description: 'Minimum height. Default: auto.' },
    {
      name: '--star-chip-font',
      description: 'Font shorthand; the weight stays 600. Default: --star-type-body-sm.',
    },
    {
      name: '--star-chip-padding-inline',
      description: 'Start and end padding. Default: 0.625rem.',
    },
    {
      name: '--star-chip-max-width',
      description: 'Maximum width; the text ends with an ellipsis. Default: 100%.',
    },
    {
      name: '--star-chip-remove-size',
      description: 'Size of the remove button. Default: 1.5rem (24 px, WCAG 2.5.8 target).',
    },
    {
      name: '--star-chip-remove-surface',
      description: 'Fill of the remove button on hover. Default: none.',
    },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description:
        'Moves the focus to the body of a clickable chip, then to the remove button of a removable chip.',
    },
    { name: 'Enter / Space', description: 'On the remove button: removes the chip.' },
    { name: 'Enter / Space', description: 'On the body of a clickable chip: emits chipClick.' },
    {
      name: 'Arrow left / right, Home, End',
      description: 'Chips area: moves the focus between the chips (one tab stop).',
    },
    {
      name: 'Control+Shift+Arrow left / right',
      description: 'Chips area: moves the focused chip one place, and announces the new position.',
    },
    {
      name: 'Delete / Backspace',
      description: 'Chips area with removable: removes the focused chip.',
    },
  ];
}
