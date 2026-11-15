import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarBreadcrumb, StarBreadcrumbItem } from '@star-ng/ui/breadcrumb';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-breadcrumb-page',
  imports: [DOCS, StarBreadcrumb],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Breadcrumb"
      lead="The path to the current page, as a list of links. The last item is the current page. The PrimeNG equivalent is p-breadcrumb."
      importFrom="import { StarBreadcrumb } from '@star-ng/ui/breadcrumb';"
    >
      <docs-example
        heading="Trail with a home link"
        source="breadcrumb/basic"
        [script]="basicScript"
        note="The nav landmark has the label Breadcrumb. The last item has aria-current page. When the home item has an icon, only the icon shows and the label stays for screen readers."
      >
        <star-breadcrumb [home]="home" [items]="trail" ariaLabel="Breadcrumb of the guide" />
      </docs-example>

      <docs-example
        heading="Plain links"
        source="breadcrumb/links"
        note="An item has either routerLink for the Angular router or url for a plain link. An item without both is plain text."
      >
        <star-breadcrumb
          ariaLabel="Breadcrumb of the install page"
          [items]="[
            { label: 'Docs', url: 'https://example.com/docs' },
            { label: 'Guides', url: 'https://example.com/docs/guides' },
            { label: 'Install' },
          ]"
        />
      </docs-example>

      <h2>Right-to-left</h2>
      <p>The separator arrow turns around in a right-to-left page. See the Right-to-left guide.</p>

      <docs-api [of]="['StarBreadcrumb']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class BreadcrumbPage {
  protected readonly home: StarBreadcrumbItem = {
    label: 'Home',
    icon: 'ph-bold ph-house',
    routerLink: '/',
  };
  protected readonly trail: readonly StarBreadcrumbItem[] = [
    { label: 'Orders', routerLink: '/controls/breadcrumb' },
    { label: 'ORD-1042' },
  ];

  protected readonly basicScript = `readonly home: StarBreadcrumbItem = {
  label: 'Home',
  icon: 'ph-bold ph-house',
  routerLink: '/',
};
readonly trail: readonly StarBreadcrumbItem[] = [
  { label: 'Orders', routerLink: '/orders' },
  { label: 'ORD-1042' },
];`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-text-muted', description: 'Color of the links and the separators.' },
    { name: '--star-primary', description: 'Color of a link on hover.' },
    { name: '--star-text-strong', description: 'Color of the current page.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description: 'Moves the focus through the links. The current page is not a link.',
    },
  ];
}
