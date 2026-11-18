import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarBanner } from '@star-ng/ui/banner';
import { StarButton } from '@star-ng/ui/button';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-banner-page',
  imports: [DOCS, StarBanner, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Banner"
      lead="A persistent notice for the whole page, under the app bar. It stays until the user dismisses it or the application closes it. For short messages that go away on their own, use the toast; for a message inside a form or a card, use the message. The Ignite UI equivalent is igx-banner."
      importFrom="import { StarBanner } from '@star-ng/ui/banner';"
    >
      <docs-example
        heading="Dismissible banner with actions"
        source="banner/basic"
        [script]="basicScript"
        note="The dismiss button sets the open model to false and emits dismissed. Actions go in the starBannerActions area."
      >
        <div class="docs-stack">
          <star-banner severity="warn" dismissible [(open)]="open">
            Invoice export is slow today. Large exports can take up to ten minutes.
            <star-button starBannerActions variant="ghost" size="sm">Status page</star-button>
          </star-banner>
          @if (!open()) {
            <div class="docs-row">
              <star-button size="sm" variant="secondary" (pressed)="open.set(true)">
                Show the banner again
              </star-button>
            </div>
          }
        </div>
      </docs-example>

      <docs-example
        heading="Severities"
        source="banner/severity"
        note="info, success and warn are status regions. danger is an alert region: screen readers read it at once. icon takes another Phosphor class, or an empty string for no icon."
      >
        <div class="docs-stack">
          <star-banner>Projects can now have more than one owner.</star-banner>
          <star-banner severity="success">All orders of March are invoiced.</star-banner>
          <star-banner severity="warn" icon="ph-fill ph-cloud-warning">
            Some cities report slow deliveries.
          </star-banner>
          <star-banner severity="danger">The order service is not available.</star-banner>
          <star-banner icon="">A banner without an icon.</star-banner>
        </div>
      </docs-example>

      <docs-api [of]="['StarBanner']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class BannerPage {
  protected readonly open = signal(true);

  protected readonly basicScript = `readonly open = signal(true);`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The message.' },
    {
      name: '[starBannerActions]',
      description: 'Buttons or links at the end, before the dismiss button.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-accent / --star-success / --star-warning / --star-danger',
      description: 'Color of the icon and the start border, per severity.',
    },
    {
      name: '--star-accent-soft / --star-success-soft / --star-warning-soft / --star-danger-soft',
      description: 'Background, per severity.',
    },
    { name: '--star-duration-slow', description: 'Duration of the enter animation.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves through the actions and the dismiss button.' },
    { name: 'Enter / Space', description: 'On the dismiss button: hides the banner.' },
  ];
}
