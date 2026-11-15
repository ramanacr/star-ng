import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DOCS_NAV } from './nav';
import { DOCS } from './shared/docs';

@Component({
  selector: 'docs-home-page',
  imports: [DOCS, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="StarNG"
      lead="Accessible Angular controls built on signals, Signal Forms and the Angular CDK. No Angular Material, no other UI kit."
    >
      <docs-code [code]="install" label="Install command" />
      <ul>
        <li>Standalone components with signal inputs, models and outputs. OnPush everywhere.</li>
        <li>Form controls implement the Signal Forms control interfaces.</li>
        <li>One set of CSS tokens (<code>--star-*</code>) with light and dark themes.</li>
        <li>One entry point per control group, so an application bundles only what it uses.</li>
        <li>Control text in one place, ready for translation.</li>
      </ul>

      @for (group of nav; track group.label) {
        <h2>{{ group.label }}</h2>
        <ul class="docs-cards">
          @for (item of group.items; track item.path) {
            <li>
              <a class="docs-card" [routerLink]="'/' + item.path">
                <strong>{{ item.label }}</strong>
              </a>
            </li>
          }
        </ul>
      }
    </docs-page>
  `,
})
export class HomePage {
  protected readonly nav = DOCS_NAV;
  protected readonly install = `pnpm add @star-ng/ui @angular/cdk @phosphor-icons/web`;
}
