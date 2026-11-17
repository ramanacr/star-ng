import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarAvatar } from '@star-ng/ui/avatar';
import { StarOverlayBadge } from '@star-ng/ui/badge';
import { StarButton } from '@star-ng/ui/button';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-overlay-badge-page',
  imports: [DOCS, StarAvatar, StarButton, StarOverlayBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Overlay badge"
      lead="Puts a badge on a corner of other content, for example an icon button or an avatar. The badge is hidden from screen readers. The ariaLabel input adds hidden text that says what the badge means. The PrimeNG equivalent is p-overlaybadge."
      importFrom="import { StarOverlayBadge } from '@star-ng/ui/badge';"
    >
      <docs-example
        heading="Count on an icon button"
        source="overlay-badge/count"
        [script]="countScript"
        note="A screen reader reads the button name and then the hidden text, for example '3 new orders'."
      >
        <div class="docs-row">
          <star-overlay-badge [value]="orders()" severity="danger" ariaLabel="new orders">
            <star-button
              variant="secondary"
              iconOnly
              leadingIcon="ph-bold ph-shopping-cart"
              ariaLabel="Orders"
              (pressed)="orders.set(orders() + 1)"
            />
          </star-overlay-badge>
          <star-overlay-badge [value]="128" ariaLabel="unread invoices">
            <star-button
              variant="secondary"
              iconOnly
              leadingIcon="ph-bold ph-receipt"
              ariaLabel="Invoices"
            />
          </star-overlay-badge>
        </div>
      </docs-example>

      <docs-example
        heading="Dot and corners"
        source="overlay-badge/positions"
        note="The position input takes top-end (default), top-start, bottom-end or bottom-start. Start and end follow the text direction."
      >
        <div class="docs-row">
          <star-overlay-badge dot severity="success" position="bottom-end" ariaLabel="online">
            <star-avatar name="Jane Doe" />
          </star-overlay-badge>
          <star-overlay-badge [value]="2" position="top-start" ariaLabel="new comments">
            <star-avatar name="Sam Lee" shape="square" />
          </star-overlay-badge>
          <star-overlay-badge [value]="5" severity="warn" position="bottom-start" size="md">
            <star-avatar icon="ph-bold ph-folder" />
          </star-overlay-badge>
        </div>
      </docs-example>

      <docs-api [of]="['StarOverlayBadge']" [slots]="slots" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class OverlayBadgePage {
  protected readonly orders = signal(3);

  protected readonly countScript = `readonly orders = signal(3);`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The content that carries the badge.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-tone', description: 'Fill of the badge. Set by the severity.' },
    { name: '--star-surface', description: 'Ring around the badge, so it stands off the content.' },
  ];
}
