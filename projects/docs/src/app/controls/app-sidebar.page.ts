import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import {
  StarAppSidebar,
  StarAppSidebarFooter,
  StarAppSidebarHeader,
  StarAppSidebarItem,
  StarAppSidebarSection,
} from '@star-ng/ui/app-sidebar';
import { StarButton } from '@star-ng/ui/button';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-app-sidebar-page-content',
  imports: [
    DOCS,
    StarButton,
    StarAppSidebar,
    StarAppSidebarHeader,
    StarAppSidebarFooter,
    StarAppSidebarSection,
    StarAppSidebarItem,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .shell {
      display: flex;
      width: 100%;
      height: 28rem;
      overflow: hidden;
      border: 1px solid var(--star-border);
      border-radius: var(--star-radius-lg);
    }
    .shell .content {
      flex: 1;
      min-width: 0;
      padding: 1rem 1.25rem;
      background: var(--star-surface-muted);
    }
    .shell .content p {
      margin: 0.5rem 0 0;
    }
  `,
  template: `
    <docs-page
      heading="App sidebar"
      lead="The main navigation of an application: a nav landmark at the inline start, with a header, titled sections, items with icons, badges and nested items, and a footer. It collapses to icons and moves into a drawer on small screens. The PrimeNG equivalent is p-sidebar (PrimeNG 22)."
      importFrom="import { StarAppSidebar, StarAppSidebarItem } from '@star-ng/ui/app-sidebar';"
    >
      <docs-example
        heading="Sections, badges and nested items"
        source="app-sidebar/basic"
        [script]="basicScript"
        note="Tab reaches the current item; Arrow down and Arrow up move, Arrow right opens Reports and enters it, Arrow left goes back. The collapse button shows the icons only; the labels become tooltips. The item This page is a router link: routerLinkActive sets aria-current page."
      >
        <div class="shell">
          <star-app-sidebar [(collapsed)]="collapsed" ariaLabel="Workspace">
            <star-app-sidebar-header>
              <i class="ph-bold ph-star" aria-hidden="true"></i>
              @if (!collapsed()) {
                <span>Workspace</span>
              }
            </star-app-sidebar-header>
            <star-app-sidebar-section heading="Overview">
              <star-app-sidebar-item
                label="Dashboard"
                icon="ph-bold ph-house"
                [active]="current() === 'Dashboard'"
                (activated)="current.set('Dashboard')"
              />
              <star-app-sidebar-item
                label="Orders"
                icon="ph-bold ph-package"
                badge="4"
                badgeLabel="4 new"
                [active]="current() === 'Orders'"
                (activated)="current.set('Orders')"
              />
              <star-app-sidebar-item label="Reports" icon="ph-bold ph-chart-bar">
                <star-app-sidebar-item
                  label="Monthly"
                  icon="ph-bold ph-calendar"
                  [active]="current() === 'Monthly'"
                  (activated)="current.set('Monthly')"
                />
                <star-app-sidebar-item
                  label="Yearly"
                  icon="ph-bold ph-calendar-blank"
                  [active]="current() === 'Yearly'"
                  (activated)="current.set('Yearly')"
                />
              </star-app-sidebar-item>
            </star-app-sidebar-section>
            <star-app-sidebar-section heading="Docs">
              <star-app-sidebar-item
                label="This page"
                icon="ph-bold ph-book-open"
                routerLink="/controls/app-sidebar"
              />
            </star-app-sidebar-section>
            <star-app-sidebar-footer>
              <star-button
                variant="ghost"
                size="sm"
                [iconOnly]="true"
                [ariaLabel]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
                (pressed)="collapsed.set(!collapsed())"
              >
                <i
                  [class]="
                    collapsed() ? 'ph-bold ph-sidebar-simple' : 'ph-bold ph-caret-double-left'
                  "
                  aria-hidden="true"
                ></i>
              </star-button>
            </star-app-sidebar-footer>
          </star-app-sidebar>
          <div class="content">
            <strong>{{ current() }}</strong>
            <p>Content of the page.</p>
          </div>
        </div>
      </docs-example>

      <docs-example
        heading="Overlay mode"
        source="app-sidebar/overlay"
        [script]="overlayScript"
        note="mode overlay keeps the sidebar in the layout above breakpoint and moves it into a drawer below. Here the breakpoint is very large, so the drawer shows at every width. A menu button opens it; Escape, the close button or a choice closes it."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="menuOpen.set(true)">
              <i class="ph-bold ph-list" aria-hidden="true"></i>
              Menu
            </star-button>
          </div>
          <star-app-sidebar
            mode="overlay"
            [breakpoint]="100000"
            [(visible)]="menuOpen"
            ariaLabel="Shop"
          >
            <star-app-sidebar-header>Shop</star-app-sidebar-header>
            <star-app-sidebar-section heading="Catalog">
              <star-app-sidebar-item
                label="Products"
                icon="ph-bold ph-cube"
                [active]="shopPage() === 'Products'"
                (activated)="shopPage.set('Products')"
              />
              <star-app-sidebar-item
                label="Customers"
                icon="ph-bold ph-users"
                [active]="shopPage() === 'Customers'"
                (activated)="shopPage.set('Customers')"
              />
            </star-app-sidebar-section>
          </star-app-sidebar>
          <p class="docs-output" role="status">Page: {{ shopPage() }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="[
          'StarAppSidebar',
          'StarAppSidebarItem',
          'StarAppSidebarSection',
          'StarAppSidebarHeader',
          'StarAppSidebarFooter',
        ]"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class AppSidebarPageContent {
  protected readonly collapsed = signal(false);
  protected readonly current = signal('Dashboard');
  protected readonly menuOpen = signal(false);
  protected readonly shopPage = signal('Products');

  protected readonly basicScript = `readonly collapsed = signal(false);
readonly current = signal('Dashboard');`;
  protected readonly overlayScript = `readonly menuOpen = signal(false);
readonly shopPage = signal('Products');`;

  protected readonly slots: readonly DocsRow[] = [
    { name: 'star-app-sidebar-header', description: 'Top area, for example the product name.' },
    { name: 'star-app-sidebar-section', description: 'A heading and its items.' },
    {
      name: 'star-app-sidebar-item',
      description:
        'A router link, a link or a button. Nested items make it a group that opens and closes.',
    },
    { name: 'star-app-sidebar-footer', description: 'Bottom area, for example a collapse button.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-app-sidebar-width', description: 'Width of the sidebar (default 16rem).' },
    {
      name: '--star-app-sidebar-collapsed-width',
      description: 'Width of the collapsed sidebar (default 4.25rem).',
    },
    { name: '--star-primary-soft', description: 'Background of the current item.' },
    { name: '--star-primary', description: 'Icon and bar of the current item.' },
    { name: '--star-border', description: 'Edge and separators.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description: 'Moves into the navigation (one tab stop: the current item) and out of it.',
    },
    {
      name: 'Arrow down / Arrow up',
      description: 'Moves to the next or the previous visible item.',
    },
    { name: 'Home / End', description: 'Moves to the first or the last visible item.' },
    { name: 'Enter', description: 'Follows the link, or opens and closes a group.' },
    {
      name: 'Arrow right',
      description: 'Opens a closed group; in an open group, moves to its first item.',
    },
    {
      name: 'Arrow left',
      description: 'Closes an open group; in a nested item, moves to its group.',
    },
  ];
}

/**
 * Route component of the page. It loads the route styles (`app-sidebar.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-app-sidebar-page',
  imports: [AppSidebarPageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './app-sidebar.page.scss',
  template: '<docs-app-sidebar-page-content />',
})
export class AppSidebarPage {}
