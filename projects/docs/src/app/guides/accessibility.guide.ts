import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DOCS } from '../shared/docs';

@Component({
  selector: 'docs-accessibility-guide',
  imports: [DOCS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Accessibility"
      lead="The controls target WCAG 2.2 level AA. This page lists what the library does and what the application must do."
    >
      <h2>What the library does</h2>
      <ul>
        <li>
          <strong>Native elements first.</strong> Buttons are <code>button</code> elements,
          checkboxes, radios and switches are native inputs, dialogs are
          <code>dialog</code> elements. Keyboard and screen-reader behavior comes from the browser.
        </li>
        <li>
          <strong>Keyboard.</strong> Every action works without a pointer. Composite controls
          (menus, lists, tabs, trees) follow the WAI-ARIA Authoring Practices key patterns. Each
          control page has a keyboard table.
        </li>
        <li>
          <strong>Focus.</strong> Focus is always visible (<code>:focus-visible</code> with the
          <code>--star-focus-ring</code> tokens). Overlays move focus in, keep it inside and return
          it to the trigger.
        </li>
        <li>
          <strong>Names and states.</strong> Controls set roles, <code>aria-*</code> states and live
          regions. Built-in text comes from <code>STAR_UI_TEXT</code>, so it can be translated.
        </li>
        <li>
          <strong>Contrast.</strong> The default tokens give at least 4.5:1 for text on filled
          controls, for text on the page and for placeholder text, in both themes. The axe scan and
          two end-to-end tests measure this.
        </li>
        <li>
          <strong>Motion.</strong> Animations stop when the user sets
          <code>prefers-reduced-motion</code>.
        </li>
        <li>
          <strong>Errors.</strong> A field shows its error as text with
          <code>role="alert"</code> and links it to the control with <code>aria-describedby</code>.
          Color is never the only signal.
        </li>
      </ul>

      <h2>What the application must do</h2>
      <ul>
        <li>
          Give every control a name: a <code>star-field</code> label, projected label text, or the
          <code>ariaLabel</code> input (required for an icon-only button).
        </li>
        <li>
          Keep the contrast when you change tokens. See the contrast rules in
          <strong>Theming and tokens</strong>.
        </li>
        <li>Translate the built-in text when the page language is not English.</li>
        <li>Do not use a tag or badge color as the only way to tell a status: add text.</li>
        <li>Set the page language (<code>&lt;html lang&gt;</code>) and a page title.</li>
      </ul>

      <h2>Helper classes</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Helper classes
          </caption>
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">Use</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row"><code>star-sr-only</code></th>
              <td>Hides text on screen and keeps it for screen readers.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>How StarNG is tested</h2>
      <ul>
        <li>Unit tests check roles, states and keyboard handling of each control.</li>
        <li>End-to-end tests run the docs pages in a browser with keyboard only.</li>
        <li>A contrast test measures filled controls in the light and the dark theme.</li>
        <li>
          An automated scan with axe-core (<code>@axe-core/playwright</code>) checks every docs page
          and many opened states. See the next section.
        </li>
        <li>
          A placeholder test measures the color of <code>::placeholder</code> text. axe does not
          read it.
        </li>
      </ul>

      <h3>The axe scan</h3>
      <p>
        The file <code>e2e/a11y.spec.ts</code> runs axe-core with the rule sets <code>wcag2a</code>,
        <code>wcag2aa</code>, <code>wcag21a</code>, <code>wcag21aa</code>, <code>wcag22aa</code> and
        <code>best-practice</code>. Run it with <code>corepack pnpm e2e:a11y</code>. A test fails on
        any violation that is not in the allow-list. The failure shows the rule id, the impact, the
        selector and the help link.
      </p>
      <ul>
        <li>
          <strong>Pages at rest.</strong> Every page of the navigation (97 pages), in the light
          theme and in the dark theme. Contrast differs between the themes.
        </li>
        <li>
          <strong>Opened states.</strong> 65 states that are hidden at rest, in both themes: panels
          of select, multi-select, cascade select, tree select and autocomplete; the date picker
          popup; menus with a submenu, menubar, context menu and mega menu; dialog, confirm dialog,
          notice, drawer, popover, tooltip and toasts; open accordion, panel and panel menu; an
          invalid field with its error; a table with the column panel, a filter, an expanded row and
          a cell in edit mode; an expanded tree; a file upload with a file and with a rejected file;
          a stepper on a later step; carousel, galleria and image preview; a speed dial; a terminal
          with output; an editor with content; and the virtual-scroll listbox, tree and table,
          scrolled to the middle.
        </li>
        <li>
          <strong>Setup.</strong> The scan runs with reduced motion, so no animation changes a color
          while axe reads it.
        </li>
      </ul>

      <h3>Allow-list</h3>
      <p>
        No rule is switched off. A rule that cannot be satisfied is listed with the smallest
        selector, and each entry has a reason. The scan has two entries.
      </p>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Violations that the axe scan accepts
          </caption>
          <thead>
            <tr>
              <th scope="col">Rule</th>
              <th scope="col">Elements</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row"><code>region</code></th>
              <td><code>.cdk-overlay-container</code> and what it holds</td>
              <td>
                The Angular CDK moves a popup (menu, tooltip) to the end of <code>body</code>,
                outside <code>main</code>. A popup is a transient widget. It takes the focus or is
                tied to its trigger. axe reports every such popup as content outside a landmark. The
                rest of the page is still checked.
              </td>
            </tr>
            <tr>
              <th scope="row"><code>scrollable-region-focusable</code></th>
              <td><code>.star-listbox[aria-disabled="true"]</code></td>
              <td>
                A disabled listbox leaves the tab order on purpose, like a disabled button. Its
                options cannot be used. axe reports a disabled list that is taller than its maximum
                height. An enabled list is still checked.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>What an automated scan cannot find</h3>
      <p>
        An automated scan finds only a part of the accessibility problems. It does not replace
        manual tests. Nothing in this list is checked by the scan:
      </p>
      <ul>
        <li>What a screen reader says, and whether the names and the text make sense.</li>
        <li>
          Zoom and reflow (WCAG 1.4.4 and 1.4.10), text spacing, and the use of the controls in a
          small window.
        </li>
        <li>High-contrast mode and forced colors.</li>
        <li>
          Keyboard use of a whole task: focus order, focus that returns to the right place, and
          traps. Only the keyboard tests of each control cover this.
        </li>
        <li>
          Color as the only signal, the quality of error texts, and alternatives to dragging (WCAG
          2.5.7).
        </li>
        <li>
          Every state that is not in the list above, and the right-to-left layout (the scan runs in
          left-to-right).
        </li>
        <li>The contrast of text on images and gradients, which axe cannot compute.</li>
      </ul>
    </docs-page>
  `,
})
export class AccessibilityGuide {}
