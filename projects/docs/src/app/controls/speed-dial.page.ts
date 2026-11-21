import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarMenuItem } from '@star-ng/ui/menu';
import { StarSpeedDial } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-speed-dial-page',
  imports: [DOCS, StarSpeedDial],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Speed dial"
      lead="A round button that opens a short list of actions. The list opens up, down, left, right, to the start or to the end. The button has aria-expanded, the list is inert while it is closed, and Escape closes it."
      importFrom="import { StarSpeedDial } from '@star-ng/ui/utility';"
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
        note="direction is up (default), down, left or right. Leave room in that direction: the list overlays the page. left and right are the sides of the screen."
      >
        <div class="docs-row docs-dial-area docs-dial-area--wide">
          <star-speed-dial [items]="actions" direction="up" ariaLabel="Actions up" />
          <star-speed-dial [items]="actions" direction="down" ariaLabel="Actions down" />
          <star-speed-dial [items]="actions" direction="left" ariaLabel="Actions left" />
          <star-speed-dial [items]="actions" direction="right" ariaLabel="Actions right" />
        </div>
      </docs-example>

      <docs-example
        heading="Start and end"
        source="speed-dial/logical"
        note="start and end follow the writing direction. In a left-to-right page start is the left side, in a right-to-left page it is the right side. Use them when the list must open toward the same edge of the content in both directions."
      >
        <div class="docs-row docs-dial-area docs-dial-area--center">
          <star-speed-dial [items]="actions" direction="start" ariaLabel="Actions at the start" />
          <star-speed-dial [items]="actions" direction="end" ariaLabel="Actions at the end" />
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

      <docs-example
        heading="Circle layouts, mask and events"
        source="speed-dial/circle"
        [script]="circleScript"
        note="type circle puts the actions on a full circle, semi-circle on half a circle toward direction (up, down, left, right) and quarter-circle on a quarter toward up-left, up-right, down-left or down-right; radius is the distance in pixels (default 80). mask puts a scrim behind the open actions. A click outside closes them (hideOnClickOutside, on by default). visible is a two-way model, and show and hide report the changes. hideIcon is the icon while open; transitionDelay is the time between two actions when they appear (no motion with reduced motion)."
      >
        <div class="docs-stack">
          <div class="docs-row docs-dial-area docs-dial-area--center">
            <star-speed-dial
              [items]="actions"
              type="semi-circle"
              direction="up"
              [radius]="72"
              ariaLabel="Actions on a half circle"
              hideIcon="ph-bold ph-x"
              (show)="dialLog.set('open')"
              (hide)="dialLog.set('closed')"
            />
            <star-speed-dial
              [items]="actions"
              type="quarter-circle"
              direction="up-right"
              [radius]="72"
              mask
              ariaLabel="Actions on a quarter circle"
            />
          </div>
          <p class="docs-output" role="status">Half circle: {{ dialLog() }}</p>
        </div>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The PrimeNG p-speeddial names that StarNG gives in another way: model is items;
        onVisibleChange is visibleChange of the visible model; onClick is pressed; showIcon is icon;
        id is the id attribute of the host; style, className, buttonStyle, buttonClassName,
        maskStyle, maskClassName and buttonProps are the pass-through pt (parts triggerButton,
        maskPanel) and the class and style of the host; tooltipOptions: each action shows its label
        as a native tooltip. The button and item templates are starSpeedDialTemplate, and the icon
        template is starIcon with icon.
      </p>

      <h2>Right-to-left</h2>
      <p>
        <code>left</code> and <code>right</code> are the physical sides of the screen, as in CSS.
        <code>start</code> and <code>end</code> follow the writing direction: <code>start</code> is
        the right side in a right-to-left page. The arrow keys follow the side the list opens to.
        See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarSpeedDial', 'StarSpeedDialTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
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
    .docs-dial-area--center {
      justify-content: center;
      gap: 16rem;
    }
  `,
})
export class SpeedDialPage {
  protected readonly last = signal('none');
  protected readonly sortIndex = signal(0);
  protected readonly dialLog = signal('closed');
  protected readonly circleScript = `readonly dialLog = signal('closed');
// actions as in the first example`;

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

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starSpeedDialTemplate]',
      description:
        'Content child. "button" replaces the content of the main button, "item" the content of each action (context: $implicit the item, index, visible). The buttons keep their names: no focusable content. PrimeNG button and item templates.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. "icon" replaces the icon of the main button. PrimeNG icon template.',
    },
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
