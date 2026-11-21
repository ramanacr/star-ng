import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarImageCompare } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

/** An inline SVG as a data URL: the docs ship no image files and load nothing from the network. */
function svg(background: string, shapes: string): string {
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220">` +
    `<rect width="400" height="220" fill="${background}"/>${shapes}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

const BEFORE = svg(
  '#cbd5e1',
  '<circle cx="120" cy="110" r="50" fill="#64748b"/><rect x="220" y="60" width="120" height="100" rx="8" fill="#94a3b8"/>',
);
const AFTER = svg(
  '#fde68a',
  '<circle cx="120" cy="110" r="50" fill="#d97706"/><rect x="220" y="60" width="120" height="100" rx="8" fill="#0f766e"/>',
);

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './image-compare.page.scss',
  selector: 'docs-image-compare-page',
  imports: [DOCS, StarImageCompare],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Image compare"
      lead="Two images on top of each other with a divider that the user moves. The divider is a native range input, so the arrow keys, Home and End work and a screen reader announces the position."
      importFrom="import { StarImageCompare } from '@star-ng/ui/utility';"
    >
      <docs-example
        heading="Before and after"
        source="image-compare/basic"
        [script]="script"
        note="leftSrc shows on the left of the divider, rightSrc on the right. Both need an alt text (leftAlt and rightAlt). value is the position in percent, a two-way model. The images here are inline SVG data URLs."
      >
        <div class="docs-stack">
          <star-image-compare
            [leftSrc]="before"
            [rightSrc]="after"
            leftAlt="Before: grey shapes"
            rightAlt="After: colored shapes"
            ariaLabel="Compare before and after"
            [(value)]="position"
          />
          <p class="docs-output" role="status">Divider at {{ position() }}%</p>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The control keeps its left-to-right geometry in a right-to-left page: the left image stays
        on the left, and the divider position is a percentage from the left edge. See the
        Right-to-left guide.
      </p>

      <docs-api [of]="['StarImageCompare']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class ImageComparePage {
  protected readonly before = BEFORE;
  protected readonly after = AFTER;
  protected readonly position = signal(50);

  protected readonly script = `readonly position = signal(50);
readonly before = 'data:image/svg+xml;…'; // or a normal image URL
readonly after = 'data:image/svg+xml;…';`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-compare', description: 'Position of the divider. The component sets it.' },
    { name: '--star-border', description: 'Border of the control.' },
    { name: '--star-border-strong', description: 'Border of the divider and its handle.' },
    { name: '--star-surface', description: 'Color of the divider line and handle.' },
    { name: '--star-accent', description: 'Focus ring.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow left / Arrow right', description: 'Moves the divider by 1 %.' },
    { name: 'Page up / Page down', description: 'Moves the divider by a larger step.' },
    { name: 'Home / End', description: 'Moves the divider to 0 % or 100 %.' },
  ];
}
