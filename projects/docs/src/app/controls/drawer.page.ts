import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarDrawer } from '@star-ng/ui/drawer';
import { StarField, StarInput } from '@star-ng/ui/field';
import { DOCS, DocsRow } from '../shared/docs';

type DrawerPosition = 'left' | 'right' | 'start' | 'end' | 'top' | 'bottom';

@Component({
  selector: 'docs-drawer-page',
  imports: [DOCS, StarButton, StarDrawer, StarField, StarInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Drawer"
      lead="A side sheet pinned to an edge of the window. It is built on the native dialog element and has the same API as the dialog, plus position and drawerSize."
      importFrom="import { StarDrawer } from '@star-ng/ui/drawer';"
    >
      <docs-example
        heading="Details drawer"
        source="drawer/basic"
        [script]="basicScript"
        note="Bind visible with a two-way binding. The drawer opens at the right edge. A click on the backdrop closes it when dismissableMask is set. Escape and the close button close it too. The focus returns to the button."
      >
        <star-button leadingIcon="ph-bold ph-sidebar-simple" (pressed)="basicOpen.set(true)">
          Open details
        </star-button>
        <star-drawer [(visible)]="basicOpen" header="Order ORD-1042" dismissableMask>
          <div class="docs-stack">
            <p class="docs-output">Orchard Supply, 12 items, ships on Friday.</p>
            <star-field label="Internal note">
              <textarea starInput autoResize rows="3"></textarea>
            </star-field>
          </div>
          <div starDialogFooter class="star-dialog__footer">
            <star-button variant="ghost" (pressed)="basicOpen.set(false)">Close</star-button>
          </div>
        </star-drawer>
      </docs-example>

      <docs-example
        heading="Position and size"
        source="drawer/position"
        [script]="positionScript"
        note="position is left, right (default), start, end, top or bottom. left and right are the edges of the screen. start and end follow the writing direction: end is the right edge in a left-to-right page and the left edge in a right-to-left page. drawerSize is a CSS length: the width of a side drawer, or the height of a top or bottom drawer."
      >
        <div class="docs-row">
          @for (item of positions; track item) {
            <star-button variant="secondary" (pressed)="openAt(item)">{{ item }}</star-button>
          }
        </div>
        <star-drawer
          [(visible)]="positionOpen"
          [position]="position()"
          [drawerSize]="position() === 'top' || position() === 'bottom' ? '14rem' : '22rem'"
          [header]="'Drawer at the ' + position()"
        >
          <p>This drawer is pinned to the {{ position() }} edge.</p>
        </star-drawer>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        <code>left</code> and <code>right</code> are the physical edges of the screen. Use
        <code>start</code> and <code>end</code> for a drawer that must change sides with the
        direction: <code>end</code> is the left edge in a right-to-left page. The drawer slides in
        from its own edge. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarDrawer', 'StarDialog']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Technical notes</h2>
      <p>
        StarDrawer extends StarDialog, so it has the inputs and outputs of the dialog: visible,
        header, modal, closable, closeOnEscape, dismissableMask, showHeader, role, ariaLabel, shown
        and hidden. The API tables list StarDrawer and its base class StarDialog. The drawer slides
        in with a transition, and a user who prefers reduced motion gets none.
      </p>
    </docs-page>
  `,
})
export class DrawerPage {
  protected readonly positions: readonly DrawerPosition[] = [
    'left',
    'right',
    'start',
    'end',
    'top',
    'bottom',
  ];
  protected readonly basicOpen = signal(false);
  protected readonly positionOpen = signal(false);
  protected readonly position = signal<DrawerPosition>('right');

  protected openAt(position: DrawerPosition): void {
    this.position.set(position);
    this.positionOpen.set(true);
  }

  protected readonly basicScript = `readonly basicOpen = signal(false);`;
  protected readonly positionScript = `readonly positions = ['left', 'right', 'start', 'end', 'top', 'bottom'] as const;
readonly positionOpen = signal(false);
readonly position = signal<'left' | 'right' | 'start' | 'end' | 'top' | 'bottom'>('right');

openAt(position: 'left' | 'right' | 'start' | 'end' | 'top' | 'bottom'): void {
  this.position.set(position);
  this.positionOpen.set(true);
}`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The body of the drawer.' },
    { name: '[starDialogHeader]', description: 'Extra header content, next to the title.' },
    {
      name: '[starDialogFooter]',
      description: 'The footer. Use the class star-dialog__footer for the standard button row.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-drawer-size',
      description: 'Width or height of the drawer. The drawerSize input sets it.',
    },
    { name: '--star-surface', description: 'Background of the drawer.' },
    { name: '--star-radius-2xl', description: 'Corner radius of the free edge.' },
    { name: '--star-shadow-modal', description: 'Shadow of the drawer.' },
    { name: '--star-scrim-modal', description: 'Color of the backdrop.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Escape', description: 'Closes the drawer, unless closeOnEscape is false.' },
    {
      name: 'Tab / Shift+Tab',
      description: 'Moves the focus inside a modal drawer. The focus does not leave the drawer.',
    },
  ];
}
