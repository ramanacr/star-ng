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
        page lists its parts. The names come from the StarNG classes of the elements (<code
          >star-select__trigger</code
        >
        gives <code>trigger</code>), so they are stable. The StarNG classes stay on the elements.
      </p>

      <h2>Pass-through for one control</h2>
      <p>
        The input <code>pt</code> maps a part name to <code>class</code>, <code>style</code> and
        <code>attrs</code>. A class adds to the StarNG classes; <code>class</code> takes a string, a
        list or a map, as <code>[class]</code> does. <code>style</code> is a map, as
        <code>[style]</code>. <code>attrs</code> accepts only <code>id</code>, <code>title</code>,
        <code>data-*</code> and <code>aria-*</code>: an event handler (<code>on*</code>) or any
        other attribute is ignored, with a warning in dev mode.
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
        and a style or an attribute of the instance wins.
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
        override them with a class.
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
