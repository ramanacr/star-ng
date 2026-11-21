import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarMenuItem } from '@star-ng/ui/menu';
import { StarDock } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './dock.page.scss',
  selector: 'docs-dock-page',
  imports: [DOCS, StarDock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Dock"
      lead="A bar of shortcuts. An item grows when the pointer or the keyboard focus is on it, and its neighbours grow a little. Each item is a button with an accessible name. The bar uses the glass tokens."
      importFrom="import { StarDock } from '@star-ng/ui/utility';"
    >
      <docs-example
        heading="Bottom dock"
        source="dock/basic"
        [script]="script"
        note="items are menu items: label, icon, command. The label is the accessible name and the tooltip. itemClick fires after the command."
      >
        <div class="docs-stack">
          <star-dock [items]="apps" ariaLabel="Apps" (itemClick)="last.set($event.label ?? '')" />
          <p class="docs-output" role="status">Opened: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Left position"
        source="dock/left"
        note="position is bottom (default), top, left, right, start or end. On a side the bar is a column. start and end follow the writing direction."
      >
        <star-dock [items]="apps" position="left" ariaLabel="Apps on the left" />
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        <code>left</code> and <code>right</code> are physical, <code>start</code> and
        <code>end</code> follow the writing direction. A column dock has no other change. See the
        Right-to-left guide.
      </p>

      <docs-api [of]="['StarDock']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class DockPage {
  protected readonly last = signal('none');

  protected readonly apps: readonly StarMenuItem[] = [
    { label: 'Inbox', icon: 'ph-bold ph-tray' },
    { label: 'Calendar', icon: 'ph-bold ph-calendar-blank' },
    { label: 'Reports', icon: 'ph-bold ph-chart-line' },
    { label: 'Library', icon: 'ph-bold ph-books' },
    { label: 'Settings', icon: 'ph-bold ph-gear' },
  ];

  protected readonly script = `readonly last = signal('none');

readonly apps: readonly StarMenuItem[] = [
  { label: 'Inbox', icon: 'ph-bold ph-tray' },
  { label: 'Calendar', icon: 'ph-bold ph-calendar-blank' },
  { label: 'Reports', icon: 'ph-bold ph-chart-line' },
  { label: 'Library', icon: 'ph-bold ph-books' },
  { label: 'Settings', icon: 'ph-bold ph-gear' },
];`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-glass-surface-strong', description: 'Background of the bar.' },
    { name: '--star-glass-border', description: 'Border of the bar.' },
    { name: '--star-blur-md', description: 'Blur of what is behind the bar.' },
    { name: '--star-shadow-lg', description: 'Shadow of the bar.' },
    { name: '--star-surface-muted', description: 'Background of an item.' },
    { name: '--star-primary', description: 'Color of an item on hover and focus.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab / Shift+Tab', description: 'Moves between the items. The focused item grows.' },
    { name: 'Enter / Space', description: 'Runs the focused item.' },
  ];
}
