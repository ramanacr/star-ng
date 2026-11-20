import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarSelect } from '@star-ng/ui/select';
import {
  STAR_WINDOW_DATA,
  StarWindow,
  StarWindowPosition,
  StarWindowRef,
  StarWindowService,
  StarWindowSize,
  StarWindowState,
} from '@star-ng/ui/window';
import { DOCS, DocsRow } from '../shared/docs';

/** Content of the window that the service example opens. */
@Component({
  selector: 'docs-order-window',
  imports: [StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>Order {{ data.order }} ships from {{ data.city }}.</p>
    <star-button variant="secondary" size="sm" (pressed)="ref.close('Marked as checked')">
      Mark as checked
    </star-button>
  `,
})
export class DocsOrderWindow {
  protected readonly data = inject<{ order: string; city: string }>(STAR_WINDOW_DATA);
  protected readonly ref = inject(StarWindowRef<string>);
}

@Component({
  selector: 'docs-window-page',
  imports: [DOCS, StarButton, StarSelect, StarWindow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Window"
      lead="A floating, non-modal window that the user can move, resize, minimize and maximize, while the page stays usable. Several windows stack; the one in use comes to the front. The Kendo UI equivalent is Window."
      importFrom="import { StarWindow, StarWindowService } from '@star-ng/ui/window';"
    >
      <docs-example
        heading="Windows in the page"
        source="window/basic"
        [script]="basicScript"
        note="Drag a window by its title bar, or focus the title bar and press Alt and an arrow key. Shift and an arrow key, or the corner handle, resize it. Double-click the title bar to maximize. Escape closes Order summary only (closeOnEscape)."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="notesOpen.set(true)"
              >Open notes</star-button
            >
            <star-button variant="secondary" (pressed)="summaryOpen.set(true)">
              Open order summary
            </star-button>
          </div>
          <star-window
            header="Notes"
            [(visible)]="notesOpen"
            [(position)]="notesAt"
            [(size)]="notesSize"
            [(state)]="notesState"
          >
            <p>Call the warehouse in Lisbon before noon.</p>
            <p>Check the open orders of the week.</p>
            <star-select
              [options]="priorities"
              [(value)]="priority"
              placeholder="Priority"
              ariaLabel="Priority"
            />
          </star-window>
          <star-window header="Order summary" [(visible)]="summaryOpen" closeOnEscape>
            <dl class="docs-stack">
              <div>
                <dt>Order</dt>
                <dd>1001</dd>
              </div>
              <div>
                <dt>Items</dt>
                <dd>3</dd>
              </div>
              <div>
                <dt>Ships from</dt>
                <dd>Oslo</dd>
              </div>
            </dl>
          </star-window>
          <p class="docs-output" role="status">
            Notes: {{ notesState() }}, at {{ notesAt()?.x ?? '–' }}, {{ notesAt()?.y ?? '–' }}
            @if (notesSize(); as size) {
              , {{ size.width }} × {{ size.height }}
            }
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Open from code"
        source="window/service"
        [script]="serviceScript"
        note="StarWindowService.open() puts a component in a window at the end of the body. The component reads STAR_WINDOW_DATA and closes with a result through StarWindowRef. New windows cascade."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="openOrder()">Open order window</star-button>
          </div>
          <p class="docs-output" role="status">Result: {{ result() }}</p>
        </div>
      </docs-example>

      <docs-api [of]="['StarWindow']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class WindowPage {
  private readonly windows = inject(StarWindowService);

  protected readonly notesOpen = signal(false);
  protected readonly notesAt = signal<StarWindowPosition | null>(null);
  protected readonly notesSize = signal<StarWindowSize | null>(null);
  protected readonly notesState = signal<StarWindowState>('normal');
  protected readonly summaryOpen = signal(false);
  protected readonly priorities: readonly string[] = ['Low', 'Normal', 'High'];
  protected readonly priority = signal<string | null>(null);
  protected readonly result = signal('none');
  private count = 0;

  constructor() {
    // Windows from the service live in the body: close them when the page goes.
    inject(DestroyRef).onDestroy(() => this.windows.closeAll());
  }

  protected async openOrder(): Promise<void> {
    this.count++;
    const ref = this.windows.open<DocsOrderWindow, { order: string; city: string }, string>(
      DocsOrderWindow,
      {
        header: `Order ${1000 + this.count}`,
        data: { order: `${1000 + this.count}`, city: this.count % 2 ? 'Porto' : 'Turin' },
        size: { width: 320, height: 200 },
      },
    );
    this.result.set((await ref.closed) ?? 'closed');
  }

  protected readonly basicScript = `readonly notesOpen = signal(false);
readonly notesAt = signal<StarWindowPosition | null>(null);
readonly notesSize = signal<StarWindowSize | null>(null);
readonly notesState = signal<StarWindowState>('normal');
readonly summaryOpen = signal(false);
readonly priorities = ['Low', 'Normal', 'High'];
readonly priority = signal<string | null>(null);`;
  protected readonly serviceScript = `private readonly windows = inject(StarWindowService);
readonly result = signal('none');

async openOrder(): Promise<void> {
  const ref = this.windows.open(OrderWindow, {
    header: 'Order 1001',
    data: { order: '1001', city: 'Porto' },
    size: { width: 320, height: 200 },
  });
  this.result.set((await ref.closed) ?? 'closed');
}

// In OrderWindow:
readonly data = inject(STAR_WINDOW_DATA);
readonly ref = inject(StarWindowRef<string>);
// (pressed)="ref.close('Marked as checked')"`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '(default)',
      description: 'Body of the window. It scrolls when the content is taller.',
    },
    { name: '[starWindowHeader]', description: 'Content after the title in the title bar.' },
    { name: '[starWindowFooter]', description: 'Footer below the body, for example buttons.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-window-width', description: 'Width before the user resizes (default 28rem).' },
    {
      name: '--star-window-z',
      description:
        'Base z-index of the window stack (default: --star-z-index-base minus 100, so 900). The z-index stays one below the CDK overlay container (--star-z-index-base, default 1000, provideStarNg overlay.zIndexBase), so popups opened in a window stay on top.',
    },
    { name: '--star-surface-muted', description: 'Background of the title bar.' },
    { name: '--star-shadow-xl', description: 'Shadow of the window.' },
    { name: '--star-accent', description: 'Focus ring of the title bar.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description: 'Moves to the title bar, its buttons and the content of the window.',
    },
    { name: 'Alt + Arrow keys', description: 'On the title bar: moves the window by 16 pixels.' },
    {
      name: 'Shift + Arrow keys',
      description: 'On the title bar: makes the window wider, narrower, taller or shorter.',
    },
    { name: 'Escape', description: 'Closes the window, only with closeOnEscape.' },
  ];
}
