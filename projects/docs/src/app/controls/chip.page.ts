import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarChip, StarChipsArea } from '@star-ng/ui/layout';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
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

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starIcon="remove"]',
      description: 'Content child. Replaces the icon of the remove button. PrimeNG #removeicon.',
    },
    { name: '(default)', description: 'Extra text after the label.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-accent', description: 'Color of the text.' },
    { name: '--star-accent-soft', description: 'Fill of the chip.' },
    { name: '--star-radius-pill', description: 'Corner radius.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves the focus to the remove button of a removable chip.' },
    { name: 'Enter / Space', description: 'On the remove button: removes the chip.' },
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
