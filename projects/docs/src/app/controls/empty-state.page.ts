import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarEmptyState } from '@star-ng/ui/empty-state';
import { StarSpinner } from '@star-ng/ui/spinner';
import { StarColumn, StarTable } from '@star-ng/ui/table';
import { DOCS, DocsRow } from '../shared/docs';

interface Order {
  readonly id: number;
  readonly customer: string;
  readonly city: string;
}

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './empty-state.page.scss',
  selector: 'docs-empty-state-page',
  imports: [DOCS, StarButton, StarEmptyState, StarSpinner, StarTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Empty state"
      lead="What a list, a table, a panel or a page area shows when it has nothing to show: an icon or an image, a title, a description and actions. The table, the data view and the list use it as their default empty template, so the look is the same everywhere. PrimeNG has no empty state control."
      importFrom="import { StarEmptyState } from '@star-ng/ui/empty-state';"
    >
      <docs-example
        heading="Variants"
        source="empty-state/variants"
        note="The variant gives the reason and sets the default icon and its tone: empty (nothing yet), no-results (filters hide everything), error (could not load) and success (all done). retryable adds a Retry button that emits retry."
      >
        <div class="docs-stack">
          <star-empty-state
            title="No orders yet"
            description="Orders appear here after the first sale."
          >
            <star-button starEmptyStateActions size="sm">New order</star-button>
          </star-empty-state>
          <star-empty-state
            variant="no-results"
            title="No orders found"
            description="No orders match the search criteria."
          >
            <star-button starEmptyStateActions variant="secondary" size="sm">
              Clear criteria
            </star-button>
          </star-empty-state>
          <star-empty-state
            variant="error"
            title="Could not load the orders"
            description="The order service did not answer."
            retryable
            (retry)="retries.set(retries() + 1)"
          />
          @if (retries()) {
            <p class="docs-output">Retry pressed {{ retries() }} times.</p>
          }
          <star-empty-state
            variant="success"
            icon="ph-check-circle"
            title="You're all caught up"
            description="No notifications right now."
          />
        </div>
      </docs-example>

      <docs-example
        heading="Sizes"
        source="empty-state/sizes"
        note="sm fits in a card or a panel, md (the default) in a table or a list, lg in a whole page area. icon takes any Phosphor name, with or without the ph- prefix."
      >
        <div class="docs-stack">
          <star-empty-state
            size="sm"
            icon="ph-bell"
            title="No reminders"
            description="Reminders that you set show here."
          />
          <star-empty-state
            icon="ph-folder-open"
            title="This folder is empty"
            description="Drop files here or use the upload button."
          />
          <star-empty-state
            size="lg"
            icon="ph-chart-bar"
            title="No reports yet"
            description="Create a report to see the sales of each city."
          >
            <star-button starEmptyStateActions>Create report</star-button>
          </star-empty-state>
        </div>
      </docs-example>

      <docs-example
        heading="Image instead of the icon"
        source="empty-state/image"
        note="An element with the attribute starEmptyStateImage replaces the icon tile. Give an image that only decorates an empty alt text or aria-hidden. The default content goes under the description."
      >
        <div class="docs-stack">
          <star-empty-state title="No projects" description="Projects group the orders of a team.">
            <svg
              starEmptyStateImage
              viewBox="0 0 120 80"
              width="120"
              height="80"
              aria-hidden="true"
            >
              <rect
                x="22"
                y="10"
                width="40"
                height="16"
                rx="4"
                fill="currentColor"
                opacity="0.25"
              />
              <rect
                x="10"
                y="20"
                width="100"
                height="50"
                rx="8"
                fill="currentColor"
                opacity="0.12"
              />
              <circle cx="60" cy="45" r="10" fill="currentColor" opacity="0.35" />
            </svg>
            Ask an administrator to add you to a project.
          </star-empty-state>
        </div>
      </docs-example>

      <docs-example
        heading="Heading level and status region"
        source="empty-state/status"
        [script]="statusScript"
        note="The title is a heading. Set headingLevel to fit the outline of the page (default 3), or null for plain text. With status, the area is a polite live region, so screen readers announce the empty state when it replaces the loading content."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button size="sm" variant="secondary" (pressed)="load()"
              >Load messages</star-button
            >
          </div>
          @if (loading()) {
            <star-spinner size="1.5rem" ariaLabel="Loading messages" />
          } @else if (loaded()) {
            <star-empty-state
              status
              [headingLevel]="3"
              icon="ph-chat-circle"
              title="No messages"
              description="New messages from your team show here."
            />
          }
        </div>
      </docs-example>

      <docs-example
        heading="In a table"
        source="empty-state/table"
        note="The table, the data view and the list show an empty state when they have no rows. The emptyMessage input sets its title; the starEmpty template replaces the text."
      >
        <div class="docs-stack">
          <star-table
            [value]="[]"
            [columns]="columns"
            ariaLabel="Orders of today"
            emptyMessage="No orders today."
          />
        </div>
      </docs-example>

      <docs-api
        [of]="['StarEmptyState']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class EmptyStatePage {
  protected readonly retries = signal(0);
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);

  protected readonly columns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    { field: 'customer', header: 'Customer' },
    { field: 'city', header: 'City' },
  ];

  protected readonly statusScript = `readonly loading = signal(false);
readonly loaded = signal(false);

load(): void {
  this.loading.set(true);
  setTimeout(() => {
    this.loading.set(false);
    this.loaded.set(true);
  }, 800);
}`;

  protected load(): void {
    this.loading.set(true);
    this.loaded.set(false);
    setTimeout(() => {
      this.loading.set(false);
      this.loaded.set(true);
    }, 800);
  }

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '[starEmptyStateImage]',
      description: 'An image or an illustration in place of the icon tile.',
    },
    { name: '[starEmptyStateActions]', description: 'Buttons or links under the description.' },
    { name: '(default)', description: 'More content under the description.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-empty-state-icon-color',
      description: 'Color of the icon. Set by the variant.',
    },
    {
      name: '--star-empty-state-icon-surface',
      description: 'Fill of the icon tile. Set by the variant.',
    },
    { name: '--star-empty-state-title-color', description: 'Color of the title.' },
    { name: '--star-empty-state-description-color', description: 'Color of the description.' },
    {
      name: '--star-empty-state-tile-size / --star-empty-state-icon-size',
      description: 'Size of the icon tile and of the icon. Set by the size.',
    },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves through the actions and the Retry button.' },
  ];
}
