import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarTooltip } from '@star-ng/ui/tooltip';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-tooltip-page',
  imports: [DOCS, StarButton, StarTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Tooltip"
      lead="A short text label for an element. It shows on hover and on keyboard focus, and it hides on Escape. The element gets aria-describedby while the tooltip is visible."
      importFrom="import { StarTooltip } from '@star-ng/ui/tooltip';"
    >
      <docs-example
        heading="Positions"
        source="tooltip/positions"
        note="starTooltipPosition is top (default), bottom, left, right, start or end. left and right are the sides of the screen, start and end follow the writing direction. When there is no room, the tooltip moves to the opposite side."
      >
        <star-button variant="secondary" starTooltip="Shown on hover and focus">Top</star-button>
        <star-button
          variant="secondary"
          starTooltip="Below the button"
          starTooltipPosition="bottom"
        >
          Bottom
        </star-button>
        <star-button variant="secondary" starTooltip="On the left" starTooltipPosition="left">
          Left
        </star-button>
        <star-button variant="secondary" starTooltip="On the right" starTooltipPosition="right">
          Right
        </star-button>
        <star-button variant="secondary" starTooltip="At the start" starTooltipPosition="start">
          Start
        </star-button>
        <star-button variant="secondary" starTooltip="At the end" starTooltipPosition="end">
          End
        </star-button>
      </docs-example>

      <docs-example
        heading="Icon button"
        source="tooltip/icon"
        note="A tooltip shows the purpose of an icon button to sighted users. Keep an aria-label on the button: the tooltip text is a description, not the name."
      >
        <button
          type="button"
          class="star-btn star-btn--secondary star-btn--icon"
          aria-label="Export orders"
          starTooltip="Export orders to CSV"
        >
          <i class="ph-bold ph-export" aria-hidden="true"></i>
        </button>
      </docs-example>

      <docs-example
        heading="Delay and disabled"
        source="tooltip/delay"
        note="starTooltipShowDelay and starTooltipHideDelay are in milliseconds (default 300 and 0). starTooltipDisabled turns the tooltip off and keeps the text."
      >
        <star-button variant="secondary" starTooltip="Appears at once" [starTooltipShowDelay]="0">
          No delay
        </star-button>
        <star-button
          variant="secondary"
          starTooltip="Appears after one second"
          [starTooltipShowDelay]="1000"
        >
          Slow
        </star-button>
        <star-button variant="secondary" starTooltip="Never shown" starTooltipDisabled>
          Disabled tooltip
        </star-button>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        <code>left</code> and <code>right</code> are physical sides of the host.
        <code>start</code> and <code>end</code> follow the writing direction (<code>start</code> is
        the right side in a right-to-left page). A tooltip that opens after <code>dir</code> changed
        uses the new direction. See the Right-to-left guide.
      </p>

      <docs-api [of]="['StarTooltip']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />

      <h2>Technical notes</h2>
      <p>
        The tooltip is a native popover in the top layer, so it shows above a modal dialog. It has
        the role <code>tooltip</code> and takes no pointer events. Do not put important information
        only in a tooltip: touch users and some assistive technologies do not trigger it.
      </p>
    </docs-page>
  `,
})
export class TooltipPage {
  protected readonly slots: readonly DocsRow[] = [
    { name: '(none)', description: 'The text comes from the starTooltip input.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-tooltip-surface', description: 'Background of the tooltip.' },
    { name: '--star-radius-sm', description: 'Corner radius of the tooltip.' },
    { name: '--star-shadow-md', description: 'Shadow of the tooltip.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Focus on the element shows the tooltip. Focus out hides it.' },
    { name: 'Escape', description: 'Hides the tooltip while the focus stays on the element.' },
  ];
}
