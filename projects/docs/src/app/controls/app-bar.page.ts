import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StarAppBar } from '@star-ng/ui/app-bar';
import { StarAvatar } from '@star-ng/ui/avatar';
import { StarButton } from '@star-ng/ui/button';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-app-bar-page-content',
  imports: [DOCS, StarAppBar, StarButton, StarAvatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="App bar"
      lead="The top bar of an application or a view: a start area for a menu button or a logo, a title, and an end area for actions. The Ignite UI equivalent is igx-navbar; in Angular Material it is a mat-toolbar at the top of the page."
      importFrom="import { StarAppBar } from '@star-ng/ui/app-bar';"
    >
      <docs-example
        heading="Title and actions"
        source="app-bar/basic"
        note="At the top level of a page the bar is the banner landmark. The examples on this page are inside the main area of the docs, so they set landmark to false."
      >
        <star-app-bar title="Orders" [landmark]="false">
          <star-button
            starAppBarStart
            variant="ghost"
            iconOnly
            leadingIcon="ph-bold ph-list"
            ariaLabel="Menu"
          />
          <star-button
            starAppBarEnd
            variant="ghost"
            iconOnly
            leadingIcon="ph-bold ph-magnifying-glass"
            ariaLabel="Search orders"
          />
          <star-button
            starAppBarEnd
            variant="ghost"
            iconOnly
            leadingIcon="ph-bold ph-bell"
            ariaLabel="Notifications"
          />
          <star-avatar starAppBarEnd name="Order Desk" size="sm" />
        </star-app-bar>
      </docs-example>

      <docs-example
        heading="Sticky, elevated and dense"
        source="app-bar/sticky"
        note="position sticky keeps the bar at the top of its scroll container, below the safe area of the device (env(safe-area-inset-top)). position fixed keeps it at the top of the window. elevated adds a shadow; dense makes the bar lower."
      >
        <div class="docs-app-bar-frame">
          <star-app-bar position="sticky" elevated dense [landmark]="false">
            <star-button
              starAppBarStart
              variant="ghost"
              iconOnly
              leadingIcon="ph-bold ph-arrow-left"
              ariaLabel="Back to projects"
            />
            Project Apollo
            <star-button starAppBarEnd variant="ghost" size="sm">Share</star-button>
          </star-app-bar>
          @for (week of weeks; track week) {
            <p>Week {{ week }}: 12 tasks planned, 9 done, 3 moved to the next week.</p>
          }
        </div>
      </docs-example>

      <docs-api [of]="['StarAppBar']" [slots]="slots" [cssVars]="cssVars" />
    </docs-page>
  `,
  styles: `
    .docs-app-bar-frame {
      block-size: 14rem;
      overflow: auto;
      border: 1px solid var(--star-border);
      border-radius: var(--star-radius-lg);
    }
    .docs-app-bar-frame p {
      margin: 0;
      padding: 0.75rem 1rem;
    }
  `,
})
export class AppBarPageContent {
  protected readonly weeks = Array.from({ length: 12 }, (_, i) => i + 1);

  protected readonly slots: readonly DocsRow[] = [
    { name: '[starAppBarStart]', description: 'A menu or back button, or a logo.' },
    {
      name: '(default)',
      description: 'The title, after the title input. Use it for a custom title.',
    },
    { name: '[starAppBarEnd]', description: 'Actions at the end of the bar.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-app-bar-height',
      description: 'Minimum height of the bar (3.5rem, dense 2.75rem).',
    },
    { name: '--star-surface', description: 'Background.' },
    { name: '--star-border', description: 'Line under the bar.' },
    { name: '--star-shadow-md', description: 'Shadow of an elevated bar.' },
  ];
}

/**
 * Route component of the page. It loads the route styles (`app-bar.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-app-bar-page',
  imports: [AppBarPageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './app-bar.page.scss',
  template: '<docs-app-bar-page-content />',
})
export class AppBarPage {}
