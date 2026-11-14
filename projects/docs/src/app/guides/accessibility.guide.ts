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
          controls in both themes. An end-to-end test measures this.
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
      </ul>
    </docs-page>
  `,
})
export class AccessibilityGuide {}
