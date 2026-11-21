import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarBreadcrumb } from '@star-ng/ui/breadcrumb';
import { StarPaginator } from '@star-ng/ui/paginator';
import { StarSelectButton } from '@star-ng/ui/select-button';
import { StarTab, StarTabs } from '@star-ng/ui/tabs';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './right-to-left.guide.scss',
  selector: 'docs-right-to-left-guide',
  imports: [DOCS, StarTabs, StarTab, StarBreadcrumb, StarPaginator, StarSelectButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Right-to-left"
      lead="The controls work in right-to-left languages (Arabic, Hebrew, Persian, Urdu). This page shows how to switch it on, what the library does and what the application must do."
    >
      <h2>Switch it on</h2>
      <p>
        Set <code>dir="rtl"</code> on the <code>html</code> element, together with the language.
        Nothing else is needed: the styles use logical properties, and the keys and overlays read
        the direction. The button <strong>LTR / RTL</strong> in the header of this documentation
        does exactly this and saves the choice in <code>localStorage</code>: use it to try every
        page.
      </p>
      <docs-code [code]="html" label="index.html" />
      <p>To change the direction while the application runs, set the attribute again:</p>
      <docs-code [code]="runtime" label="Run time" />
      <p>
        <code>StarDirectionService</code> watches the attribute, so overlays and menus that open
        later use the new direction. The page does not need a reload.
      </p>

      <docs-example
        heading="A right-to-left island"
        source="rtl/island"
        note="A dir attribute on one element is enough for the controls inside it: layout, arrow keys and mirrored icons follow it. The rest of the page stays left to right. (Overlays that open from the island, such as a select list, still follow the dir of the html element, see the limits below.)"
      >
        <div class="docs-stack" dir="rtl">
          <star-breadcrumb [items]="trail" ariaLabel="Island trail" />
          <star-tabs [(value)]="tab" ariaLabel="Island tabs">
            <star-tab value="one" label="One">First panel</star-tab>
            <star-tab value="two" label="Two">Second panel</star-tab>
            <star-tab value="three" label="Three">Third panel</star-tab>
          </star-tabs>
          <star-select-button
            [options]="['Day', 'Week', 'Month']"
            [(value)]="period"
            ariaLabel="Island period"
          />
          <star-paginator [totalRecords]="60" [rows]="10" />
        </div>
      </docs-example>

      <h2>What the library does</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Right-to-left behavior by area
          </caption>
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">Behavior</th>
            </tr>
          </thead>
          <tbody>
            @for (row of areas; track row.name) {
              <tr>
                <th scope="row">{{ row.name }}</th>
                <td>{{ row.description }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h3>Why the CSS uses :dir(rtl)</h3>
      <p>
        Spacing, borders, radii and positions use logical properties
        (<code>margin-inline-start</code>,
        <code>inset-inline-end</code>, <code>border-start-end-radius</code>,
        <code>text-align: start</code>). A few things have no logical form: <code>translate</code>,
        <code>rotate</code>, <code>scale</code> and gradient angles. For these, the library uses the
        <code>:dir(rtl)</code> pseudo-class and not <code>[dir='rtl']</code>. The pseudo-class
        matches the element that is really laid out right to left: it follows
        <code>dir="auto"</code>, a <code>dir="ltr"</code> island inside a right-to-left page, and
        the CSS <code>direction</code> property. <code>[dir='rtl'] .x</code> would turn a
        left-to-right island inside a right-to-left page the wrong way. <code>:dir()</code> is
        supported by all current browsers.
      </p>

      <h3>Icons</h3>
      <p>
        An icon that points along the reading direction turns around in right-to-left: next and
        previous arrows, the submenu arrow, the breadcrumb separator, the tree and table expanders,
        the paginator buttons, the calendar month buttons and the carousel and galleria buttons.
        Icons with a fixed meaning do not turn: the check mark, the clock, the media play symbol and
        the magnifying glass. For an icon of your own, add the class
        <code>star-icon-mirror</code>:
      </p>
      <docs-code [code]="mirror" label="Mirrored icon" />

      <h3>Left, right, start and end</h3>
      <p>
        Where an input names a side, <code>left</code> and <code>right</code> are the physical sides
        of the screen, as in CSS, and they do not change with the direction. The inputs that offer
        them also accept <code>start</code> and <code>end</code> (or <code>top-start</code> and so
        on), which follow the writing direction. Use <code>start</code> and <code>end</code> when a
        control must switch sides together with the page. The defaults are unchanged (<code
          >right</code
        >
        for the drawer, <code>top-right</code> for the toast).
      </p>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Inputs with side names
          </caption>
          <thead>
            <tr>
              <th scope="col">Control</th>
              <th scope="col">Input</th>
              <th scope="col">Logical values</th>
            </tr>
          </thead>
          <tbody>
            @for (row of sides; track row.name) {
              <tr>
                <th scope="row">{{ row.name }}</th>
                <td>
                  <code>{{ row.input }}</code>
                </td>
                <td>
                  <code>{{ row.description }}</code>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h3>Keyboard</h3>
      <p>
        The horizontal arrow keys follow the visual direction. In a right-to-left page the first
        tab, option, box or day is on the right, so Arrow left moves to the next one. This holds for
        tabs, the select button, one-time code boxes, the toolbar, the calendar grid and its month
        and year views, the galleria and the splitter. The vertical arrows do not change.
      </p>
      <p>
        The tree follows the WAI-ARIA tree pattern, mirrored: in right-to-left Arrow left opens a
        branch and Arrow right closes it or moves to the parent. The menu family (menu, menubar,
        mega menu, cascade select, context menu) uses the CDK menu, which reads the CDK
        <code>Directionality</code>: Arrow left opens a submenu in right-to-left.
      </p>
      <p>
        The native range inputs (slider, range slider, image compare divider) and the native radio
        buttons (rating) are flipped by the browser. The knob does not follow the direction: it is a
        dial, so its keys and arc work like a clock.
      </p>

      <h3>Overlays</h3>
      <p>
        Select lists, the date picker, menus, the popover and the tooltip use the CDK overlay, which
        turns <code>start</code> and <code>end</code> around when it knows the direction. The CDK
        reads the direction once, when its <code>Directionality</code> service is created. Controls
        that open an overlay inject <code>StarDirectionService</code>, which keeps that service in
        step with the <code>dir</code> attribute at run time. An application that wants the service
        running before the first control exists can call <code>provideStarDirection()</code>.
      </p>

      <h3>Scrolling</h3>
      <p>
        In right-to-left the browser starts a scroll area at its right edge and reports a
        <code>scrollLeft</code> of zero or less. The carousel scrolls by the distance between a
        slide and the track, not to an absolute offset, so it works in both directions. The table
        scrolls the same way and its frozen columns stick to the inline start edge. If you read
        <code>scrollLeft</code> in your own code, use its absolute value as the distance from the
        start.
      </p>

      <h3>What keeps its left-to-right geometry</h3>
      <ul>
        <li>
          <strong>Chart plot.</strong> Numeric axes run from left to right, as is usual. The title,
          the legend and the data table follow the page direction and start on the right.
        </li>
        <li>
          <strong>Image compare.</strong> The left image stays on the left: the divider position is
          a percentage from the left edge.
        </li>
        <li><strong>Knob.</strong> A dial runs clockwise, like a clock.</li>
        <li>
          <strong>Code.</strong> Code blocks and inline code in this documentation have
          <code>direction: ltr</code>.
        </li>
      </ul>

      <h2>What the application must do</h2>
      <ul>
        <li>
          Set <code>lang</code> and <code>dir</code> on the <code>html</code> element, and translate
          the built-in text. See the <strong>Internationalisation</strong> guide.
        </li>
        <li>
          Put text that must stay left to right (an e-mail address, a URL, a phone number, a part
          number, code) in an element with <code>dir="ltr"</code> or in <code>&lt;bdi&gt;</code>.
          The Unicode bidirectional algorithm reorders punctuation next to such text: "https://" can
          show as "//:https" in a right-to-left sentence.
        </li>
        <li>
          Add <code>star-icon-mirror</code> to your own directional icons, and use logical
          properties in your own CSS.
        </li>
        <li>
          Choose <code>start</code> and <code>end</code> (not <code>left</code> and
          <code>right</code>) for a side input that must follow the direction.
        </li>
        <li>
          Use a font that has the glyphs of the language. The tokens do not set one for Arabic or
          Hebrew.
        </li>
      </ul>

      <h2>Helpers</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Exports of @star-ng/ui/core
          </caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            @for (row of helpers; track row.name) {
              <tr>
                <th scope="row">
                  <code>{{ row.name }}</code>
                </th>
                <td>{{ row.description }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <docs-code [code]="helperCode" label="Own control" />

      <h2>Known limits</h2>
      <ul>
        <li>
          The CDK <code>Directionality</code> is global. A <code>dir</code> attribute on an island
          changes layout, keys and icons inside it, but the overlays that open from the island (a
          select list, a menu, a tooltip) use the direction of the <code>html</code> element. Put
          the controls in a <code>Dir</code> directive from <code>&#64;angular/cdk/bidi</code> if an
          island needs its own overlay direction.
        </li>
        <li>
          <code>dir="auto"</code> on the <code>html</code> element is read when the page loads, and
          again when the attribute changes. It is not re-evaluated when the text changes.
        </li>
        <li>
          The first-paint theme script does not set the direction. An application that saves the
          direction in the browser can set <code>dir</code> in a small script before the first
          paint, or accept a short flash of left-to-right layout.
        </li>
        <li>
          Built-in text packs exist for English, German and Spanish only. An Arabic or Hebrew pack
          is a normal <code>StarUiText</code> object (see the Internationalisation guide).
        </li>
        <li>
          The documentation text is English. In right-to-left mode, punctuation at the end of a
          sentence moves to the left edge. This is how the browser lays out English text in a
          right-to-left block, not a fault of the controls.
        </li>
        <li>
          Printed output, PDF export of the table and the editor toolbar commands are not changed by
          the direction.
        </li>
      </ul>
    </docs-page>
  `,
})
export class RightToLeftGuide {
  protected readonly tab = signal<string | null>('one');
  protected readonly period = signal<string | readonly string[] | null>('Day');
  protected readonly trail = [
    { label: 'Orders', routerLink: '/' },
    { label: 'Open orders', routerLink: '/' },
    { label: 'ORD-1042' },
  ];

  protected readonly html = `<html lang="ar" dir="rtl">`;
  protected readonly runtime = `document.documentElement.lang = 'he';
document.documentElement.dir = 'rtl';`;
  protected readonly mirror = `<i class="ph-bold ph-arrow-right star-icon-mirror" aria-hidden="true"></i>`;
  protected readonly helperCode = `import { starInlineKey, starIsRtl } from '@star-ng/ui/core';

onKeydown(event: KeyboardEvent): void {
  // 'ArrowRight' is "toward the end of the line" in both directions.
  switch (starInlineKey(event)) {
    case 'ArrowRight':
      this.next();
      break;
    case 'ArrowLeft':
      this.previous();
      break;
  }
}

// Pointer math: the distance from the start edge.
const box = this.host.getBoundingClientRect();
const fromStart = starIsRtl(this.host) ? box.right - event.clientX : event.clientX - box.left;`;

  protected readonly areas: readonly DocsRow[] = [
    {
      name: 'Layout',
      description:
        'Logical properties for spacing, borders, radii and positions. Rows, bars and groups are flex or grid containers, so they run from the right.',
    },
    {
      name: 'Icons',
      description: 'Directional icons turn around with :dir(rtl). Icons with a fixed meaning stay.',
    },
    {
      name: 'Tabs, select button, toolbar, one-time code, galleria',
      description: 'Arrow left is the next item in right-to-left.',
    },
    {
      name: 'Calendar, date picker',
      description:
        'The week runs from the right. Arrow left is the following day. The month arrows turn around.',
    },
    {
      name: 'Tree, tree table, tree select',
      description:
        'Arrow left opens a branch, Arrow right closes it. Indentation grows from the right.',
    },
    {
      name: 'Menus',
      description:
        'Submenus open toward the left, Arrow left opens one and Arrow right closes it. Popups are aligned with the start edge of the trigger.',
    },
    {
      name: 'Splitter',
      description:
        'The first pane is on the right. Arrow left makes it larger and a drag measures from the right edge.',
    },
    {
      name: 'Slider, range slider, rating',
      description: 'Native inputs: the minimum is on the right, the track fill follows.',
    },
    {
      name: 'Table',
      description:
        'Columns run from the right. The resize handle is on the left edge of a header, Arrow left makes a column wider, frozen columns stick to the right edge.',
    },
    {
      name: 'Carousel',
      description: 'The first slide is on the right, and the scroll offset is negative.',
    },
    {
      name: 'Progress bar, skeleton',
      description: 'The indeterminate bar and the loading wave run toward the left.',
    },
    {
      name: 'Switch, stepper, timeline, paginator, breadcrumb',
      description:
        'The switch thumb starts on the right. Steps, events, pages and trail items run from the right.',
    },
    {
      name: 'Overlays',
      description:
        'Select lists, the date picker, the popover and menus use the CDK overlay with the current direction. Tooltips treat left and right as physical sides.',
    },
  ];

  protected readonly sides: readonly { name: string; input: string; description: string }[] = [
    { name: 'Drawer', input: 'position', description: "'start' | 'end'" },
    {
      name: 'Toast',
      input: 'position',
      description: "'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'",
    },
    { name: 'Tooltip', input: 'starTooltipPosition', description: "'start' | 'end'" },
    { name: 'Speed dial', input: 'direction', description: "'start' | 'end'" },
    { name: 'Dock', input: 'position', description: "'start' | 'end'" },
  ];

  protected readonly helpers: readonly DocsRow[] = [
    {
      name: 'starDirectionOf(element)',
      description: "Returns 'ltr' or 'rtl' for an element, from its dir attribute or direction.",
    },
    { name: 'starIsRtl(element)', description: 'True when the element is laid out right to left.' },
    {
      name: 'starInlineKey(event)',
      description:
        'The key of a keyboard event with Arrow left and Arrow right swapped in right-to-left, so a handler is written once.',
    },
    {
      name: 'StarDirectionService',
      description:
        'Root service. value is a signal with the direction of the page. It keeps the CDK Directionality in step with the dir attribute.',
    },
    {
      name: 'provideStarDirection()',
      description: 'Starts StarDirectionService when the application starts.',
    },
  ];
}
