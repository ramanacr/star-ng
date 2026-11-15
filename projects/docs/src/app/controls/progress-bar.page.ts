import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarProgressBar } from '@star-ng/ui/progress-bar';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-progress-bar-page',
  imports: [DOCS, StarProgressBar, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Progress bar"
      lead="A bar that shows how far a task has come, or that a task is running when the end is not known. The PrimeNG equivalent is p-progressbar."
      importFrom="import { StarProgressBar } from '@star-ng/ui/progress-bar';"
    >
      <docs-example
        heading="Determinate"
        source="progress-bar/basic"
        [script]="basicScript"
        note="The value is a number from 0 to 100. A value outside the range is clamped. The bar has role progressbar with aria-valuenow."
      >
        <div class="docs-stack">
          <star-progress-bar [value]="value()" showValue ariaLabel="Upload" />
          <div class="docs-row">
            <star-button size="sm" variant="secondary" (pressed)="step(-20)">Less</star-button>
            <star-button size="sm" variant="secondary" (pressed)="step(20)">More</star-button>
          </div>
        </div>
      </docs-example>

      <docs-example heading="Severities and size" source="progress-bar/severities">
        <div class="docs-stack">
          <star-progress-bar [value]="60" ariaLabel="Primary" />
          <star-progress-bar [value]="80" severity="success" ariaLabel="Success" />
          <star-progress-bar [value]="45" severity="warn" ariaLabel="Warning" />
          <star-progress-bar [value]="25" severity="danger" ariaLabel="Danger" />
          <star-progress-bar [value]="70" severity="info" size="sm" ariaLabel="Info, thin" />
        </div>
      </docs-example>

      <docs-example
        heading="Indeterminate"
        source="progress-bar/indeterminate"
        note="Use it when the progress is not known. The bar has no aria-valuenow. Users who prefer reduced motion get a still bar."
      >
        <div class="docs-stack">
          <star-progress-bar indeterminate ariaLabel="Loading" />
        </div>
      </docs-example>

      <docs-api [of]="['StarProgressBar']" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class ProgressBarPage {
  protected readonly value = signal(40);

  protected step(delta: number): void {
    this.value.update((value) => Math.min(100, Math.max(0, value + delta)));
  }

  protected readonly basicScript = `readonly value = signal(40);

step(delta: number): void {
  this.value.update((value) => Math.min(100, Math.max(0, value + delta)));
}`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-tone', description: 'Color of the filled part. Set by the severity.' },
    { name: '--star-border', description: 'Color of the track.' },
    { name: '--star-duration-slow', description: 'Time of the width animation.' },
  ];
}
