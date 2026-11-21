import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarBottomNav, StarBottomNavItem } from '@star-ng/ui/bottom-nav';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-bottom-nav-page-content',
  imports: [DOCS, StarBottomNav, StarBottomNavItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Bottom navigation"
      lead="The tab bar at the bottom of a mobile layout, with three to five destinations. Each item has an icon, a label and an optional badge. The Ignite UI equivalent is igx-bottom-nav."
      importFrom="import { StarBottomNav, StarBottomNavItem } from '@star-ng/ui/bottom-nav';"
    >
      <docs-example
        heading="Switch views with a value"
        source="bottom-nav/value"
        [script]="valueScript"
        note="Items without a link are buttons. A click sets the value model; the page shows the view for the value. The current item has aria-current=true. The bar is one Tab stop: the arrow keys, Home and End move between the items."
      >
        <div class="docs-bottom-nav-frame">
          <p class="docs-bottom-nav-view" role="status">{{ views[section() ?? 'orders'] }}</p>
          <star-bottom-nav [(value)]="section" ariaLabel="Sections">
            <star-bottom-nav-item
              value="orders"
              label="Orders"
              icon="ph-bold ph-package"
              badge="3"
            />
            <star-bottom-nav-item value="cities" label="Cities" icon="ph-bold ph-map-pin" />
            <star-bottom-nav-item value="projects" label="Projects" icon="ph-bold ph-folder" />
            <star-bottom-nav-item value="settings" label="Settings" icon="ph-bold ph-gear" />
          </star-bottom-nav>
        </div>
      </docs-example>

      <docs-example
        heading="Router links"
        source="bottom-nav/router"
        note="With routerLink the items are links. The link of the active route has aria-current=page. Use fixed to keep the bar at the bottom of the window; the bar adds the bottom safe area of the device (env(safe-area-inset-bottom)) as padding."
      >
        <star-bottom-nav ariaLabel="Docs pages">
          <star-bottom-nav-item
            routerLink="/controls/list"
            label="List"
            icon="ph-bold ph-list-bullets"
          />
          <star-bottom-nav-item
            routerLink="/controls/bottom-nav"
            label="Bottom nav"
            icon="ph-bold ph-dots-three-outline"
          />
          <star-bottom-nav-item
            routerLink="/controls/app-bar"
            label="App bar"
            icon="ph-bold ph-browser"
          />
        </star-bottom-nav>
      </docs-example>

      <docs-api
        [of]="['StarBottomNav', 'StarBottomNavItem']"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
  styles: `
    .docs-bottom-nav-frame {
      display: flex;
      flex-direction: column;
      max-inline-size: 24rem;
      border: 1px solid var(--star-border);
      border-radius: var(--star-radius-lg);
      overflow: hidden;
    }
    .docs-bottom-nav-view {
      margin: 0;
      padding: 2.5rem 1rem;
      text-align: center;
      color: var(--star-text-muted);
    }
  `,
})
export class BottomNavPageContent {
  protected readonly section = signal<string | null>('orders');
  protected readonly views: Record<string, string> = {
    orders: '3 new orders today.',
    cities: '8 cities with open deliveries.',
    projects: '12 active projects.',
    settings: 'Settings of the order desk.',
  };

  protected readonly valueScript = `readonly section = signal<string | null>('orders');`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the bar.' },
    { name: '--star-border', description: 'Line above the bar.' },
    { name: '--star-primary-text', description: 'Color of the active item.' },
    { name: '--star-primary-soft', description: 'Background of the icon of the active item.' },
    { name: '--star-text-muted', description: 'Color of the other items.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves the focus to the active item (one Tab stop) and out.' },
    {
      name: 'Arrow Right / Arrow Left',
      description: 'The next or previous item (reversed in right-to-left), with wrap.',
    },
    { name: 'Home / End', description: 'The first or last item.' },
    { name: 'Enter / Space', description: 'Activates the item.' },
  ];
}

/**
 * Route component of the page. It loads the route styles (`bottom-nav.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-bottom-nav-page',
  imports: [BottomNavPageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './bottom-nav.page.scss',
  template: '<docs-bottom-nav-page-content />',
})
export class BottomNavPage {}
