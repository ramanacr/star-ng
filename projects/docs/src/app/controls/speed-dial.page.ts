import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarMenuItem } from 'star-ng/menu';
import { StarSpeedDial } from 'star-ng/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-speed-dial-page',
  imports: [DOCS, StarSpeedDial],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Speed dial"
      lead="A round button that opens a short list of actions. The list opens up, down, left or right. The button has aria-expanded, the list is inert while it is closed, and Escape closes it."
      importFrom="import { StarSpeedDial } from 'star-ng/utility';"
    >
      <docs-example
        heading="Actions"
        source="speed-dial/basic"
        [script]="basicScript"
        note="items are menu items: label, icon, command. The label is the accessible name of each round button. itemClick fires after the command."
      >
        <div class="docs-row docs-dial-area">
          <star-speed-dial
            [items]="actions"
            direction="right"
            ariaLabel="Quick actions"
            (itemClick)="last.set($event.label ?? '')"
          />
          <p class="docs-output" role="status">Last action: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Directions"
        source="speed-dial/directions"
        note="direction is up (default), down, left or right. Leave room in that direction: the list overlays the page."
      >
        <div class="docs-row docs-dial-area docs-dial-area--wide">
          <star-speed-dial [items]="actions" direction="up" ariaLabel="Actions up" />
          <star-speed-dial [items]="actions" direction="down" ariaLabel="Actions down" />
          <star-speed-dial [items]="actions" direction="left" ariaLabel="Actions left" />
          <star-speed-dial [items]="actions" direction="right" ariaLabel="Actions right" />
        </div>
      </docs-example>

      <docs-example
        heading="Current choice and own icon"
        source="speed-dial/choice"
        [script]="choiceScript"
        note="activeIndex marks one item as the current choice (aria-pressed). A different icon stops the button from turning into a cross. size sm gives a smaller button."
      >
        <div class="docs-row docs-dial-area">
          <star-speed-dial
            size="sm"
            direction="down"
            icon="ph-bold ph-sort-ascending"
            [items]="sortItems"
            [activeIndex]="sortIndex()"
            ariaLabel="Sort"
          />
          <p class="docs-output" role="status">Sorted by: {{ sortItems[sortIndex()].label }}</p>
        </div>
      </docs-example>

      <docs-api [of]="['StarSpeedDial']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
  styles: `
    .docs-dial-area {
      min-height: 12rem;
      align-items: center;
      padding-inline: 4rem;
    }
    .docs-dial-area--wide {
      gap: 8rem;
    }
  `,
})
export class SpeedDialPage {
  protected readonly last = signal('none');
  protected readonly sortIndex = signal(0);

  protected readonly actions: readonly StarMenuItem[] = [
    { label: 'New order', icon: 'ph-bold ph-plus-circle' },
    { label: 'Search', icon: 'ph-bold ph-magnifying-glass' },
    { label: 'Print', icon: 'ph-bold ph-printer' },
  ];
  protected readonly sortItems: readonly StarMenuItem[] = [
    { label: 'Date', icon: 'ph-bold ph-calendar-blank', command: () => this.sortIndex.set(0) },
    { label: 'Amount', icon: 'ph-bold ph-coins', command: () => this.sortIndex.set(1) },
    { label: 'Customer', icon: 'ph-bold ph-user', command: () => this.sortIndex.set(2) },
  ];

  protected readonly basicScript = `readonly last = signal('none');

readonly actions: readonly StarMenuItem[] = [
  { label: 'New order', icon: 'ph-bold ph-plus-circle' },
  { label: 'Search', icon: 'ph-bold ph-magnifying-glass' },
  { label: 'Print', icon: 'ph-bold ph-printer' },
];`;
  protected readonly choiceScript = `readonly sortIndex = signal(0);

readonly sortItems: readonly StarMenuItem[] = [
  { label: 'Date', icon: 'ph-bold ph-calendar-blank', command: () => this.sortIndex.set(0) },
  { label: 'Amount', icon: 'ph-bold ph-coins', command: () => this.sortIndex.set(1) },
  { label: 'Customer', icon: 'ph-bold ph-user', command: () => this.sortIndex.set(2) },
];`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary-fill', description: 'Background of the main button.' },
    { name: '--star-shadow-glow-primary', description: 'Shadow of the main button.' },
    { name: '--star-surface', description: 'Background of an action.' },
    { name: '--star-border', description: 'Border of an action.' },
    {
      name: '--star-primary',
      description: 'Color of an action on hover and of the current choice.',
    },
    { name: '--star-duration-base', description: 'Duration of the open and close motion.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Enter / Space',
      description:
        'On the main button: opens or closes the list. The focus moves to the first action.',
    },
    {
      name: 'Arrow key in the direction of the list',
      description:
        'While the list is open: moves the focus to the next action, away from the main button. For direction down this is Arrow down.',
    },
    {
      name: 'Arrow key against the direction of the list',
      description: 'While the list is open: moves the focus to the previous action.',
    },
    {
      name: 'Home / End',
      description: 'While the list is open: moves to the first or last action.',
    },
    {
      name: 'Enter / Space',
      description:
        'On an action: runs it, closes the list and returns the focus to the main button.',
    },
    { name: 'Escape', description: 'Closes the list and returns the focus to the main button.' },
  ];
}
