import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DOCS_NAV } from './nav';
import { DocsCode } from './shared/docs';

/** Number of pages in the navigation groups that match `test`. */
const pageCount = (test: (label: string) => boolean): number =>
  DOCS_NAV.filter((group) => test(group.label)).reduce((sum, group) => sum + group.items.length, 0);

@Component({
  selector: 'docs-home-page',
  imports: [DocsCode, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="docs-page docs-home">
      <section class="docs-hero" aria-labelledby="docs-hero-title">
        <p class="docs-hero__eyebrow">Angular component library</p>
        <h1 id="docs-hero-title">StarNG</h1>
        <p class="docs-hero__lead">
          Accessible Angular controls built on signals, Signal Forms and the Angular CDK. No Angular
          Material, no other UI kit.
        </p>
        <div class="docs-hero__actions">
          <a class="docs-cta docs-cta--primary" routerLink="/guides/getting-started">
            Get started
            <i class="ph-bold ph-arrow-right star-icon-mirror" aria-hidden="true"></i>
          </a>
          <a class="docs-cta" [routerLink]="'/' + firstControl">Browse the controls</a>
        </div>
        <docs-code [code]="install" label="Install command" />
        <ul class="docs-hero__facts">
          <li>
            <strong>{{ controlCount }}</strong> control pages
          </li>
          <li>
            <strong>{{ guideCount }}</strong> guides
          </li>
          <li><strong>Light and dark</strong> themes</li>
          <li><strong>Right-to-left</strong> layout</li>
        </ul>
      </section>

      <ul class="docs-features">
        <li>
          <i class="ph-bold ph-lightning" aria-hidden="true"></i>
          Standalone components with signal inputs, models and outputs. OnPush everywhere.
        </li>
        <li>
          <i class="ph-bold ph-textbox" aria-hidden="true"></i>
          Form controls implement the Signal Forms control interfaces.
        </li>
        <li>
          <i class="ph-bold ph-palette" aria-hidden="true"></i>
          <!-- One flex item: without the span, the text and the code would be separate items. -->
          <span>One set of CSS tokens (<code>--star-*</code>) with light and dark themes.</span>
        </li>
        <li>
          <i class="ph-bold ph-package" aria-hidden="true"></i>
          One entry point per control group, so an application bundles only what it uses.
        </li>
        <li>
          <i class="ph-bold ph-translate" aria-hidden="true"></i>
          Control text in one place, ready for translation.
        </li>
      </ul>

      @for (group of nav; track group.label) {
        <h2>{{ group.label }}</h2>
        <ul class="docs-cards">
          @for (item of group.items; track item.path) {
            <li>
              <a class="docs-card" [routerLink]="'/' + item.path">
                <strong>{{ item.label }}</strong>
                <i class="ph-bold ph-arrow-right star-icon-mirror" aria-hidden="true"></i>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class HomePage {
  protected readonly nav = DOCS_NAV;
  protected readonly install = `pnpm add @star-ng/ui @angular/cdk @phosphor-icons/web`;
  /** The first control page: the first page after the guides. */
  protected readonly firstControl =
    DOCS_NAV.find((group) => group.label !== 'Guides')?.items[0]?.path ?? '';
  protected readonly guideCount = pageCount((label) => label === 'Guides');
  protected readonly controlCount = pageCount((label) => label !== 'Guides');
}
