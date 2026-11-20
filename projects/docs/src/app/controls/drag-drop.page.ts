import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarDraggable, StarDropEvent, StarDroppable } from '@star-ng/ui/drag-drop';
import { DOCS, DocsRow } from '../shared/docs';

interface Order {
  readonly id: string;
  readonly city: string;
}

@Component({
  selector: 'docs-drag-drop-page',
  imports: [DOCS, StarDraggable, StarDroppable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .boards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: 1rem;
      width: min(100%, 40rem);
    }
    .zone {
      display: grid;
      align-content: start;
      gap: 0.5rem;
      min-block-size: 8rem;
      margin: 0;
      padding: 0.75rem;
      border: 1px solid var(--star-border);
      border-radius: var(--star-radius-md);
      background: var(--star-surface-muted);
      list-style: none;
    }
    .zone-title {
      margin: 0;
      font-size: var(--star-type-body-sm);
      font-weight: 600;
    }
    .order {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--star-border);
      border-radius: var(--star-radius-sm);
      background: var(--star-surface);
    }
    .handle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .grip {
      cursor: grab;
      color: var(--star-text-muted);
    }
  `,
  template: `
    <docs-page
      heading="Drag and drop"
      lead="Two directives that make any element draggable and any element a drop zone. They work with the mouse, with touch (a long press) and with the keyboard. The directives move nothing: the dropped output gives the data, and your code moves it. The PrimeNG equivalents are pDraggable and pDroppable; Ignite UI has igxDrag and igxDrop."
      importFrom="import { StarDraggable, StarDroppable } from '@star-ng/ui/drag-drop';"
    >
      <docs-example
        heading="Move orders between lists"
        source="drag-drop/basic"
        note="Drag an order to the other list. With the keyboard: Tab to an order, Space picks it up, the arrow keys go to a list, Space drops and Escape cancels."
      >
        <div class="docs-stack">
          <div class="boards">
            <section
              class="zone"
              starDroppable="orders"
              dropLabel="Open orders"
              aria-label="Open orders"
              (dropped)="move($event, 'open')"
            >
              <p class="zone-title">Open</p>
              @for (order of open(); track order.id) {
                <div
                  class="order"
                  [starDraggable]="order"
                  dragScope="orders"
                  [dragLabel]="order.id"
                >
                  {{ order.id }}, {{ order.city }}
                </div>
              }
            </section>
            <section
              class="zone"
              starDroppable="orders"
              dropLabel="Shipped orders"
              aria-label="Shipped orders"
              (dropped)="move($event, 'shipped')"
            >
              <p class="zone-title">Shipped</p>
              @for (order of shipped(); track order.id) {
                <div
                  class="order"
                  [starDraggable]="order"
                  dragScope="orders"
                  [dragLabel]="order.id"
                >
                  {{ order.id }}, {{ order.city }}
                </div>
              }
            </section>
          </div>
          <p class="docs-output" role="status">{{ last() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Scopes, a handle and a copy effect"
        source="drag-drop/scopes"
        note="The invoice drags only from its grip. The archive accepts invoices only, and it copies: the invoice stays in the list. No zone accepts the draft order."
      >
        <div class="boards">
          <section class="zone" aria-label="Documents">
            <div
              class="order handle"
              [starDraggable]="'INV-2031'"
              dragScope="invoices"
              dragEffect="copy"
              dragHandle=".grip"
              dragLabel="Invoice INV-2031"
            >
              <i class="ph-bold ph-dots-six-vertical grip" aria-hidden="true"></i>
              Invoice INV-2031
            </div>
            <div class="order" [starDraggable]="'ORD-1050'" dragScope="drafts">
              Draft order ORD-1050
            </div>
          </section>
          <section
            class="zone"
            starDroppable="invoices"
            dropEffect="copy"
            dropLabel="Archive"
            aria-label="Archive"
            (dropped)="archive($event)"
          >
            <p class="zone-title">Archive</p>
            @for (item of archived(); track $index) {
              <span class="order">{{ item }}</span>
            }
          </section>
        </div>
      </docs-example>

      <h2>Keyboard, touch and right-to-left</h2>
      <p>
        A draggable element gets <code>tabindex="0"</code> and a hidden description with the
        keyboard keys (<code>STAR_UI_TEXT.dragHint</code>). Space or Enter picks it up. The arrow
        keys go to the next or the previous drop zone that accepts it, in the order of the page; the
        focus stays on the item. Space or Enter drops; Escape, Tab and a lost focus cancel.
        <code>StarAnnouncer</code> reads each step. In right-to-left, Arrow left goes to the next
        zone. After a keyboard drop the focus goes to the item again, also when your code moves it
        to another list: the new element whose <code>[starDraggable]</code> value is the same object
        (<code>===</code>) takes the focus. Keep the same object when you move an item; an item
        without data keeps the focus only when it stays in place.
      </p>
      <p>
        On a touch screen, a long press (400 ms) starts the drag and a copy of the element follows
        the finger. A finger that moves before that scrolls the page as usual. The mouse and the pen
        use the native drag of the browser, so <code>dragImage</code> and the drop effects
        (<code>dragEffect</code>, <code>dropEffect</code>) work as in any HTML drag. A drop zone
        accepts only drags that start from a <code>starDraggable</code> with a shared scope, not
        files or text from outside the page.
      </p>
      <p>
        Do not put <code>starDraggable</code> on a button or a link that has its own Space or Enter
        action: the directive uses those keys. Put it on the row or the card, and keep the actions
        inside. The tree, the kanban board, the tile layout and the file manager have their own drag
        and drop; use these directives for other content.
      </p>

      <docs-api
        [of]="['StarDraggable', 'StarDroppable']"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class DragDropPage {
  protected readonly open = signal<readonly Order[]>([
    { id: 'ORD-1042', city: 'Lisbon' },
    { id: 'ORD-1043', city: 'Oslo' },
    { id: 'ORD-1044', city: 'Porto' },
  ]);
  protected readonly shipped = signal<readonly Order[]>([{ id: 'ORD-1039', city: 'Vienna' }]);
  protected readonly archived = signal<readonly string[]>([]);
  protected readonly last = signal('No move yet');

  protected move(event: StarDropEvent, to: 'open' | 'shipped'): void {
    const order = event.data as Order;
    const from = to === 'open' ? this.shipped : this.open;
    const target = to === 'open' ? this.open : this.shipped;
    if (!from().includes(order)) return;
    from.update((list) => list.filter((item) => item !== order));
    target.update((list) => [...list, order]);
    this.last.set(`${order.id} moved to ${to === 'open' ? 'Open' : 'Shipped'}`);
  }

  protected archive(event: StarDropEvent): void {
    this.archived.update((list) => [...list, String(event.data)]);
  }

  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-accent',
      description: 'Focus outline, picked-up outline and outline of the zone under the drag.',
    },
    { name: '--star-accent-soft', description: 'Background of the zone under the drag.' },
    {
      name: '--star-border-strong',
      description: 'Dashed outline of the zones that accept the drag.',
    },
    { name: '--star-shadow-lg', description: 'Shadow of the touch copy.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Space / Enter',
      description: 'Picks up the focused item. While it is picked up: drops it.',
    },
    {
      name: 'Arrow down / Arrow right',
      description:
        'Goes to the next drop zone that accepts the item (Arrow left in right-to-left).',
    },
    {
      name: 'Arrow up / Arrow left',
      description: 'Goes to the previous drop zone (Arrow right in right-to-left).',
    },
    { name: 'Escape / Tab', description: 'Cancels the drag. The item does not move.' },
  ];
}
