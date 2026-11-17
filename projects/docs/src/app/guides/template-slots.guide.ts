import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DOCS } from '../shared/docs';

@Component({
  selector: 'docs-template-slots-guide',
  imports: [DOCS, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Template slots"
      lead="A slot is an ng-template that you write inside a control. It replaces or adds one part of the control, such as the empty message, a header or an icon."
    >
      <h2>What a slot is</h2>
      <p>
        Write an <code>ng-template</code> with a slot directive as a child of the control. The
        control renders the template in the right place and gives it a context. You do not write the
        markup of the whole control, only the part that you change.
      </p>
      <docs-code [code]="basic" label="A slot in a select" />
      <p>
        Import the directives that you use. <code>STAR_SLOTS</code> from
        <code>&#64;star-ng/ui/core</code> lists the shared slots. A control can also have slots of
        its own, such as <code>starSelected</code> or <code>starNode</code>.
      </p>

      <h2>Shared slots</h2>
      <p>These slots have the same name and context in every control that supports them.</p>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Shared slots
          </caption>
          <thead>
            <tr>
              <th scope="col">Slot</th>
              <th scope="col">Use</th>
              <th scope="col">Context</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row"><code>starHeader</code></th>
              <td>Content above the list.</td>
              <td>None.</td>
            </tr>
            <tr>
              <th scope="row"><code>starFooter</code></th>
              <td>Content below the list.</td>
              <td>None.</td>
            </tr>
            <tr>
              <th scope="row"><code>starEmpty</code></th>
              <td>Content when there is nothing to list.</td>
              <td>
                <code>$implicit</code>: the filter or query text. It is empty if there is none.
              </td>
            </tr>
            <tr>
              <th scope="row"><code>starLoading</code></th>
              <td>
                Content while data loads. It shows while the <code>loading</code> input is true.
              </td>
              <td>None.</td>
            </tr>
            <tr>
              <th scope="row"><code>starGroup</code></th>
              <td>The heading row of a group.</td>
              <td>
                <code>$implicit</code>: the group label. <code>count</code>: the items in the group.
                In the table, <code>count</code> is the rows of that group on the current page.
              </td>
            </tr>
            <tr>
              <th scope="row"><code>starIcon="name"</code></th>
              <td>
                Replaces one built-in icon. The names are <code>dropdown</code>, <code>clear</code>,
                <code>filter</code>, <code>check</code> and <code>toggle</code>.
              </td>
              <td>
                None. The <code>toggle</code> icon has <code>$implicit</code>: true if the node is
                expanded.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <code>starIcon="toggle"</code> must have one root element. A control uses only the icon
        names that it has.
      </p>

      <h2>Slots by control</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Slots of each control
          </caption>
          <thead>
            <tr>
              <th scope="col">Control</th>
              <th scope="col">Slots</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <a routerLink="/controls/select">Select</a>,
                <a routerLink="/controls/multi-select">Multi select</a>
              </th>
              <td>
                <code>starHeader</code>, <code>starFooter</code>, <code>starEmpty</code>,
                <code>starLoading</code>, <code>starGroup</code>, <code>starIcon</code>,
                <code>starOption</code>. Select also has <code>starSelected</code>. Multi select
                also has <code>starChip</code>.
              </td>
            </tr>
            <tr>
              <th scope="row"><a routerLink="/controls/listbox">Listbox</a></th>
              <td>
                <code>starHeader</code>, <code>starFooter</code>, <code>starEmpty</code>,
                <code>starGroup</code>, <code>starOption</code>.
              </td>
            </tr>
            <tr>
              <th scope="row">
                <a routerLink="/controls/autocomplete">Autocomplete</a>, multi autocomplete
              </th>
              <td>
                <code>starOption</code>, <code>starHeader</code>, <code>starFooter</code>,
                <code>starEmpty</code>, <code>starLoading</code>, <code>starGroup</code>.
              </td>
            </tr>
            <tr>
              <th scope="row"><a routerLink="/controls/table">Table</a></th>
              <td>
                <code>starEmpty</code>, <code>starLoading</code>, <code>starGroup</code>,
                <code>starHeaderCell="field"</code>. The summary uses content projection with
                <code>[starTableSummary]</code>.
              </td>
            </tr>
            <tr>
              <th scope="row">
                <a routerLink="/controls/tree">Tree</a>,
                <a routerLink="/controls/tree-select">Tree select</a>
              </th>
              <td>
                <code>starNode</code>, <code>starHeader</code>, <code>starFooter</code>,
                <code>starEmpty</code>, <code>starIcon="toggle"</code>.
              </td>
            </tr>
            <tr>
              <th scope="row">
                <a routerLink="/controls/calendar">Calendar</a>,
                <a routerLink="/controls/date-picker">date pickers</a>
              </th>
              <td><code>starDate</code>, <code>starHeader</code>, <code>starFooter</code>.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>A slot belongs to the nearest control</h2>
      <p>
        A slot works for the control that encloses it most closely. A select inside a table cell
        does not take the slots of the table, and a slot written inside the select belongs to the
        select. A slot that is not inside a control that supports it has no effect.
      </p>

      <h2>No focusable elements in item templates</h2>
      <p>
        The control owns the keyboard model of its items. Do not put a button, a link or an input in
        a <code>starOption</code>, <code>starNode</code> or <code>starDate</code> template. Focus
        would leave the item and the arrow keys would stop working. The same applies to
        <code>starSelected</code>, which goes inside the combobox, and to <code>starGroup</code>: in
        the table its content goes inside the button that opens and closes the group.
      </p>
      <p>
        The <code>starChip</code> slot of the multi select needs one more rule. Its context has a
        <code>remove()</code> function. A button that calls it must have <code>tabindex="-1"</code>,
        so that the keyboard model of the control stays in charge. The context also has
        <code>interactive</code>, which is false when the control is disabled or read-only. Show the
        button only when it is true; <code>remove()</code> then does nothing.
      </p>

      <h2>Header and footer in a dropdown panel</h2>
      <p>
        In the panels of the select, the multi select and the autocomplete, focus stays in the
        combobox, and Tab closes the panel. Use <code>starHeader</code> and
        <code>starFooter</code> there only for content that is not interactive: text, counts and
        hints. The listbox, the tree, the table and the date pickers allow interactive content in
        the header and footer, in the normal tab order.
      </p>

      <h2>Icons are hidden from screen readers</h2>
      <p>
        The control puts a <code>starIcon</code> template in a wrapper with
        <code>aria-hidden="true"</code>, so the icon is not read out and does not change the
        accessible name of an option. The wrapper keeps the layout of the built-in icon, for example
        the turn of the dropdown arrow when the panel opens.
      </p>

      <h2>Loading follows the input</h2>
      <p>
        <code>starLoading</code> shows while the <code>[loading]</code> input is true and goes away
        when it is false. The control does not track a request for you. Set the input from your own
        state.
      </p>

      <h2>Virtual scroll</h2>
      <p>
        With <code>virtualScroll</code>, every row keeps the fixed
        <code>virtualItemSize</code> height. A template that is taller than that height is clipped.
        Keep the content of an item to one line, or raise <code>virtualItemSize</code>.
      </p>
    </docs-page>
  `,
})
export class TemplateSlotsGuide {
  protected readonly basic = `<star-select [options]="cities" [(value)]="city" [loading]="loading()">
  <ng-template starHeader>Choose a city</ng-template>
  <ng-template starEmpty let-text>No city matches {{ text }}.</ng-template>
  <ng-template starIcon="dropdown"><span aria-hidden="true">v</span></ng-template>
</star-select>`;
}
