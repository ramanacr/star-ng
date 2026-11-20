import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StarButton } from '@star-ng/ui/button';
import { StarPassThrough } from '@star-ng/ui/core';
import { StarSelect } from '@star-ng/ui/select';
import { DOCS } from '../shared/docs';

@Component({
  selector: 'docs-styling-hooks-guide',
  imports: [DOCS, RouterLink, StarButton, StarSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Styling hooks"
      lead="Every control names its elements as parts. You add your own classes, styles and attributes to a part (pass-through, PrimeNG pt), for one control or for all controls of a kind. The unstyled mode removes the StarNG look of a control and keeps its layout and behavior."
    >
      <h2>Parts</h2>
      <p>
        Each element of a control has a part name in the attribute <code>data-star-part</code>, for
        example <code>trigger</code>, <code>panel</code> and <code>option</code> in the select. The
        host element of the control is the part <code>root</code>. The API section of each control
        page lists its parts. The part names are public API: they stay the same in later versions,
        and a renamed part is a breaking change in the CHANGELOG. The StarNG classes stay on the
        elements.
      </p>
      <h3>How the parts are named</h3>
      <ol>
        <li>
          An element with a StarNG class takes the name of that class:
          <code>star-select__trigger</code> gives <code>trigger</code>,
          <code>star-panel</code> gives <code>panel</code>. Elements with the same class are one
          part, for example all the <code>cell</code> elements of a table.
        </li>
        <li>
          An element without such a class has a name of the form
          <code>&lt;purpose&gt;&lt;Role&gt;</code> in camelCase, at most three words. The purpose
          says what the element does; it never repeats the control name, never names the icon glyph
          and never comes from a UI text. The role is one of <code>Button</code>, <code>Icon</code>,
          <code>Label</code>, <code>Input</code>, <code>Option</code>, <code>List</code>,
          <code>Item</code>, <code>Panel</code>, <code>Header</code>, <code>Cell</code>,
          <code>Row</code>, <code>Text</code> (and <code>Root</code>, <code>Track</code>,
          <code>Thumb</code>, <code>Handle</code> for the parts of a slider or a resizable element).
          A role is not doubled (<code>restoreIcon</code>, not <code>restoreButtonIcon</code>). A
          single word without a role is allowed for a structural element, for example
          <code>head</code> and <code>body</code> of a table.
        </li>
        <li>
          An icon takes the name of what it belongs to: <code>clearIcon</code>,
          <code>firstPageIcon</code>, <code>moreIcon</code>, <code>leadingIcon</code> and
          <code>trailingIcon</code> of the button. The commands of one toolbar share a name
          (<code>toolButton</code>, <code>toolIcon</code>, <code>alignOption</code>); an element
          gets its own name only when you would style it alone.
        </li>
        <li>
          In one control, a name is used for one kind of element only. A tools test fails when a
          name repeats for different elements.
        </li>
        <li>
          Visually hidden text (<code>star-sr-only</code>) is not a part: a class could show it, or
          hide it from screen readers.
        </li>
      </ol>
      <p>
        In a control template, a part is the static attribute <code>data-star-part</code>; only the
        top element of portal content (an overlay panel in an <code>ng-template</code>) has the
        <code>starPart</code> directive, so that the control finds it wherever it renders. While a
        control has no pass-through and is not unstyled, a part costs only its attribute. The first
        <code>pt</code> or the unstyled mode switches the parts of the control on, and a
        <code>MutationObserver</code> finds the parts that the control creates after that. The
        invisible pointer targets of a chart and the rows and cells of the chart data table have no
        part (there is one of them per data point); style them through the part <code>table</code>.
      </p>
      <p>
        Two limits. A template class that you also set through <code>pt</code> is removed when the
        <code>pt</code> drops it. On the server the parts get their pass-through after each render,
        so the HTML of a prerendered page has it too.
      </p>

      <h2>Pass-through for one control</h2>
      <p>
        The input <code>pt</code> maps a part name to <code>class</code>, <code>style</code> and
        <code>attrs</code>. A class adds to the StarNG classes; <code>class</code> takes a string, a
        list or a map, as <code>[class]</code> does. <code>style</code> is a map, as
        <code>[style]</code>. <code>attrs</code> accepts only <code>title</code>,
        <code>data-*</code> and <code>aria-*</code>. An <code>id</code> (other elements of the
        control refer to its ids), an event handler (<code>on*</code>) or any other attribute is
        ignored, with a warning in dev mode. When the pass-through no longer sets an attribute, the
        value of the template comes back.
      </p>
      <docs-example
        heading="Pass-through on a select"
        source="styling-hooks/pt"
        [script]="ptScript"
        note="The trigger and the panel get extra styles and a data attribute. Inspect the elements to see data-star-part and data-test."
      >
        <div class="docs-stack docs-stack--narrow">
          <star-select [options]="cities" [(value)]="city" ariaLabel="City" [pt]="selectPt" />
        </div>
      </docs-example>
      <p>
        With a utility CSS framework, give the classes of the framework. Note that StarNG CSS has no
        cascade layer: a utility class in a layer (for example <code>&#64;layer utilities</code>)
        does not win over a StarNG rule with the same property. Use the unstyled mode, or put the
        StarNG CSS in a layer before yours (see below).
      </p>
      <docs-code [code]="tailwind" label="Utility classes on the parts of a select" />

      <h2>Pass-through for all controls</h2>
      <p>
        <code>provideStarNg(&#123; pt &#125;)</code> maps the tag name of a control to its
        pass-through. The <code>pt</code> input of an instance merges over it: the classes add up,
        and a style or an attribute of the instance wins. The tooltip of the
        <code>starTooltip</code> directive is the control <code>star-tooltip-panel</code>: it has no
        <code>pt</code> input, so style it with the global key <code>'star-tooltip-panel'</code>.
        The other directives (<code>starInput</code>, <code>starRipple</code> and so on) style your
        own element: add your classes to it directly.
      </p>
      <docs-code [code]="global" label="Global pass-through" />

      <h2>Unstyled mode</h2>
      <p>
        <code>provideStarNg(&#123; unstyled: true &#125;)</code>, or the <code>unstyled</code> input
        of one control, removes the StarNG look: colors, borders, corner radius, shadows, fonts and
        the token spacing. The layout that the control needs to work stays: the display and position
        of its elements, sizes, overflow, the hidden states, the visually hidden texts and the
        keyboard behavior. The focus stays visible: the focus ring and the accent turn into the text
        color. Your classes (pass-through) then give the look.
      </p>
      <p>
        The states that StarNG shows only with a color, a background or a shadow go away with the
        look, and your classes must show them: the selected option of a list or select
        (<code>[aria-selected=true]</code>), the selected day of a calendar, the checked swatch of
        the color picker (<code>[aria-checked=true]</code>), the hover and active rows, and the
        background of panels, menus, dialogs and popovers (they become transparent; the unstyled
        select below sets <code>background: Canvas</code>). The marks that are icons, such as the
        check of a selected option, stay.
      </p>
      <p>
        A styled control inside an unstyled one (a button in an unstyled dialog) keeps its look, and
        so does the content of your application inside it.
      </p>
      <docs-example
        heading="Unstyled button"
        source="styling-hooks/unstyled"
        [script]="unstyledScript"
        note="The first button has the StarNG look. The second one is unstyled: the browser look, plus the classes of the pass-through. Press Tab to see the focus."
      >
        <div class="docs-row">
          <star-button variant="primary" (pressed)="count.set(count() + 1)">Save</star-button>
          <star-button variant="primary" unstyled [pt]="buttonPt" (pressed)="count.set(count() + 1)"
            >Save</star-button
          >
        </div>
        <p class="docs-output" role="status">Pressed {{ count() }} times</p>
      </docs-example>

      <docs-example
        heading="Unstyled select"
        source="styling-hooks/unstyled-select"
        [script]="unstyledSelectScript"
        note="The select has no StarNG look; the pass-through gives the trigger and the panel a border. The keyboard and the screen-reader behavior are the same as in the styled select."
      >
        <div class="docs-stack docs-stack--narrow">
          <star-select
            [options]="cities"
            [(value)]="plainCity"
            ariaLabel="Plain city"
            unstyled
            [pt]="plainSelectPt"
          />
        </div>
      </docs-example>

      <h2>How the unstyled mode works</h2>
      <p>
        The control and each of its parts get the attribute <code>data-star-unstyled</code>. One
        rule of the StarNG CSS sets every design token (<code>--star-*</code>) to its initial value
        on these elements, so each property that reads a token falls back to the browser default.
        The control rules do not read tokens for the layout, so it stays. This needs one rule for
        all controls: no second selector per control, and no specificity war with your classes. A
        few sizes that the controls write as plain values (some paddings and font sizes) stay;
        override them with a class. <code>:root</code> keeps a copy of each theme value
        (<code>--star-theme-*</code>), and the elements under an unstyled control that are not its
        parts get the theme back.
      </p>
      <p>
        StarNG CSS is not in a cascade layer, so it keeps the cascade that your application has
        today. To let your layered utility classes win, import the StarNG CSS into an earlier layer
        of your own:
      </p>
      <docs-code [code]="layers" label="StarNG CSS in a cascade layer before the utilities" />

      <h2>Accessibility</h2>
      <p>
        The parts keep their roles, names and states. A pass-through cannot set an event handler. In
        unstyled mode, check the contrast of your own classes, and keep a visible focus. See
        <a routerLink="/guides/accessibility">Accessibility</a>.
      </p>
    </docs-page>
  `,
})
export class StylingHooksGuide {
  protected readonly cities = ['Lisbon', 'Oslo', 'Porto', 'Vienna'];
  protected readonly city = signal<string | null>('Oslo');
  protected readonly count = signal(0);
  protected readonly plainCity = signal<string | null>('Porto');
  protected readonly plainSelectPt: StarPassThrough = {
    trigger: { style: { padding: '0.375rem 0.5rem', border: '1px solid currentColor' } },
    panel: {
      style: { padding: '0.25rem', border: '1px solid currentColor', background: 'Canvas' },
    },
    option: { style: { padding: '0.25rem 0.5rem' } },
  };
  protected readonly selectPt: StarPassThrough = {
    root: { style: { 'max-width': '16rem' } },
    trigger: { style: { 'font-weight': '600' }, attrs: { 'data-test': 'city-trigger' } },
    panel: { style: { 'border-radius': '0' } },
  };
  protected readonly buttonPt: StarPassThrough = {
    button: {
      style: {
        padding: '0.5rem 1rem',
        border: '2px solid currentColor',
        'border-radius': '0.25rem',
        background: 'transparent',
        cursor: 'pointer',
      },
    },
  };

  protected readonly ptScript = `readonly selectPt: StarPassThrough = {
  root: { style: { 'max-width': '16rem' } },
  trigger: { style: { 'font-weight': '600' }, attrs: { 'data-test': 'city-trigger' } },
  panel: { style: { 'border-radius': '0' } },
};`;
  protected readonly unstyledScript = `readonly buttonPt: StarPassThrough = {
  button: {
    style: {
      padding: '0.5rem 1rem',
      border: '2px solid currentColor',
      'border-radius': '0.25rem',
      background: 'transparent',
      cursor: 'pointer',
    },
  },
};`;
  protected readonly unstyledSelectScript = `readonly plainSelectPt: StarPassThrough = {
  trigger: { style: { padding: '0.375rem 0.5rem', border: '1px solid currentColor' } },
  panel: { style: { padding: '0.25rem', border: '1px solid currentColor', background: 'Canvas' } },
  option: { style: { padding: '0.25rem 0.5rem' } },
};`;
  protected readonly tailwind = `<star-select
  [options]="cities"
  [(value)]="city"
  ariaLabel="City"
  unstyled
  [pt]="{
    root: { class: 'relative w-64' },
    trigger: { class: 'flex items-center rounded-md border border-slate-300 px-3 py-2' },
    panel: { class: 'rounded-md border border-slate-200 bg-white shadow-lg' },
    option: { class: 'px-3 py-2 aria-selected:bg-indigo-50' },
  }"
/>`;
  protected readonly global = `bootstrapApplication(App, {
  providers: [
    provideStarNg({
      pt: {
        'star-select': { panel: { class: 'app-panel' } },
        'star-button': { button: { attrs: { 'data-analytics': 'button' } } },
      },
    }),
  ],
});`;
  protected readonly layers = `/* styles.css of the application */
@layer starng, theme, base, components, utilities;
@import '@star-ng/ui/styles/star-ng.css' layer(starng);`;
}
