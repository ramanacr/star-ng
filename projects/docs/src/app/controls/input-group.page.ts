import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarButton } from 'star-ng/button';
import { StarField, StarInput } from 'star-ng/field';
import { StarIconField, StarInputGroup, StarInputGroupAddon } from 'star-ng/input-group';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-input-group-page',
  imports: [
    DOCS,
    StarIconField,
    StarInputGroup,
    StarInputGroupAddon,
    StarInput,
    StarField,
    StarButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Input group and icon field"
      lead="star-icon-field puts an icon inside an input. star-input-group joins an input with text, icons or buttons into one control."
      importFrom="import { StarIconField, StarInputGroup, StarInputGroupAddon } from 'star-ng/input-group';"
    >
      <docs-example heading="Icon field" source="input-group/icon">
        <div class="docs-stack">
          <star-icon-field icon="ph-bold ph-magnifying-glass">
            <input starInput type="search" placeholder="Search orders" aria-label="Search orders" />
          </star-icon-field>
          <star-icon-field icon="ph-bold ph-envelope-simple" iconPosition="end">
            <input starInput type="email" placeholder="name@example.com" aria-label="Email" />
          </star-icon-field>
        </div>
      </docs-example>

      <docs-example heading="Add-ons" source="input-group/addons">
        <div class="docs-stack">
          <star-field label="Website">
            <star-input-group>
              <star-input-group-addon>https://</star-input-group-addon>
              <input starInput placeholder="example.com" />
            </star-input-group>
          </star-field>
          <star-input-group ariaLabel="Weight">
            <input starInput inputmode="decimal" aria-label="Weight" placeholder="0.0" />
            <star-input-group-addon>kg</star-input-group-addon>
          </star-input-group>
        </div>
      </docs-example>

      <docs-example heading="With a button" source="input-group/button">
        <div class="docs-stack">
          <star-input-group ariaLabel="Coupon">
            <input starInput aria-label="Coupon code" placeholder="Coupon code" />
            <star-button variant="secondary">Apply</star-button>
          </star-input-group>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarIconField', 'StarInputGroup', 'StarInputGroupAddon']"
        [slots]="slots"
        [cssVars]="cssVars"
      />
    </docs-page>
  `,
})
export class InputGroupPage {
  protected readonly slots: readonly DocsRow[] = [
    { name: 'star-icon-field (default)', description: 'One input with starInput.' },
    {
      name: 'star-input-group (default)',
      description: 'Inputs, star-input-group-addon elements and buttons, in visual order.',
    },
    { name: 'star-input-group-addon (default)', description: 'Text or an icon.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Radius of the outer corners of the group.' },
    { name: '--star-surface', description: 'Fill of an add-on.' },
    { name: '--star-text-muted', description: 'Color of add-on text.' },
    { name: '--star-text-soft', description: 'Color of the icon of an icon field.' },
    { name: '--star-accent', description: 'Color of the icon while the input has focus.' },
  ];
}
