import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-button-page',
  imports: [DOCS, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Button"
      lead="The call to action. One component for every variant, size and state."
      importFrom="import { StarButton } from '@star-ng/ui/button';"
    >
      <docs-example heading="Variants" source="button/variants">
        <star-button variant="primary">Save</star-button>
        <star-button variant="secondary">Cancel</star-button>
        <star-button variant="ghost">Skip</star-button>
        <star-button variant="success">Approve</star-button>
        <star-button variant="warning">Hold</star-button>
        <star-button variant="danger">Delete</star-button>
        <star-button variant="ghost-danger">Remove</star-button>
      </docs-example>

      <docs-example heading="Sizes" source="button/sizes">
        <star-button size="sm">Small</star-button>
        <star-button size="md">Medium</star-button>
        <star-button size="lg">Large</star-button>
      </docs-example>

      <docs-example
        heading="Icons"
        source="button/icons"
        note="Icons are Phosphor icon classes. An icon-only button needs an ariaLabel."
      >
        <star-button leadingIcon="ph-bold ph-plus">New order</star-button>
        <star-button variant="secondary" trailingIcon="ph-bold ph-arrow-right star-icon-mirror"
          >Next</star-button
        >
        <star-button variant="ghost" iconOnly leadingIcon="ph-bold ph-gear" ariaLabel="Settings" />
      </docs-example>

      <docs-example
        heading="Loading and disabled"
        source="button/states"
        [script]="statesScript"
        note="A loading button is disabled, shows a spinner and sets aria-busy."
      >
        <star-button [loading]="saving()" (pressed)="save()">Save changes</star-button>
        <star-button variant="secondary" disabled>Disabled</star-button>
        <p class="docs-output" role="status">Saved {{ saves() }} times</p>
      </docs-example>

      <docs-example heading="Full width" source="button/full">
        <div class="docs-stack">
          <star-button fullWidth>Continue</star-button>
        </div>
      </docs-example>

      <docs-example
        heading="Appearance, badge and label"
        source="button/appearance"
        note="appearance draws the variant without its fill: outlined (border and text in the variant color), text (no border) or link (underlined). raised adds a shadow and rounded makes fully round ends. badge shows a small count after the text, in the badgeSeverity color; the count is part of the accessible name (here Inbox 4), so keep the visible text in any ariaLabel you set. label sets the text without content; with iconOnly it is the accessible name. loadingIcon changes the icon of the loading state, and starIcon with icon or loading replaces those icons with a template."
      >
        <div class="docs-row">
          <star-button appearance="outlined">Outlined</star-button>
          <star-button appearance="text" variant="secondary">Text</star-button>
          <star-button appearance="link">Link</star-button>
          <star-button variant="danger" appearance="outlined">Delete</star-button>
          <star-button raised>Raised</star-button>
          <star-button rounded variant="secondary">Rounded</star-button>
          <star-button variant="secondary" label="Inbox" [badge]="4" badgeSeverity="info" />
          <star-button iconOnly leadingIcon="ph-bold ph-gear" label="Settings" variant="ghost" />
        </div>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The PrimeNG p-button names that StarNG gives in another way: severity is variant (plain is
        secondary or ghost); outlined, text and link are appearance; icon and iconPos are
        leadingIcon and trailingIcon; fluid is fullWidth; onClick is pressed; onFocus and onBlur are
        the native focusin and focusout events of the host; style, styleClass and buttonProps are
        the pass-through pt (part nativeButton); the content template is the projected content.
      </p>

      <docs-api [of]="['StarButton']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class ButtonPage {
  protected readonly saving = signal(false);
  protected readonly saves = signal(0);

  protected readonly statesScript = `readonly saving = signal(false);
readonly saves = signal(0);

save(): void {
  this.saving.set(true);
  setTimeout(() => {
    this.saving.set(false);
    this.saves.update((count) => count + 1);
  }, 800);
}`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The button text. Not rendered when iconOnly is set.' },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. "icon" replaces the leading icon, "loading" the loading icon. PrimeNG icon and loadingicon templates.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary-fill', description: 'Fill of the primary variant.' },
    { name: '--star-primary-hover', description: 'Fill of the primary variant on hover.' },
    { name: '--star-button-radius', description: 'Corner radius.' },
    { name: '--star-button-font-weight', description: 'Font weight of the text.' },
    { name: '--star-button-text-transform', description: 'For example uppercase.' },
    { name: '--star-button-letter-spacing', description: 'Letter spacing of the text.' },
    { name: '--star-shadow-glow-primary', description: 'Shadow under the primary variant.' },
    { name: '--star-focus-ring', description: 'Focus ring (box-shadow).' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter / Space', description: 'Activates the button (native button behavior).' },
  ];

  protected save(): void {
    this.saving.set(true);
    setTimeout(() => {
      this.saving.set(false);
      this.saves.update((count) => count + 1);
    }, 800);
  }
}
