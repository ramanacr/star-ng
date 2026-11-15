import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarStep, StarStepper } from '@star-ng/ui/stepper';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-stepper-page',
  imports: [DOCS, StarStepper, StarStep, StarButton, StarField, StarInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Stepper"
      lead="A row of numbered steps for a wizard. Each step is done, current or upcoming. The PrimeNG equivalent is p-stepper."
      importFrom="import { StarStepper, StarStep } from '@star-ng/ui/stepper';"
    >
      <docs-example
        heading="Free navigation"
        source="stepper/basic"
        [script]="basicScript"
        note="The value model holds the active step. Without linear, every step can be opened."
      >
        <div class="docs-stack">
          <star-stepper [(value)]="step" ariaLabel="Checkout steps">
            <star-step value="cart" label="Cart" description="Review items" completed>
              Three items in the cart.
            </star-step>
            <star-step value="address" label="Address" description="Where to ship">
              Enter the delivery address.
            </star-step>
            <star-step value="pay" label="Payment">Choose a way to pay.</star-step>
          </star-stepper>
          <p class="docs-output" role="status">Active step: {{ step() ?? 'cart' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Linear wizard"
        source="stepper/linear"
        [script]="linearScript"
        note="With linear, a step opens only after all earlier steps are completed. The next and previous methods move between the steps."
      >
        <div class="docs-stack">
          <star-stepper #wizard [(value)]="wizardStep" linear ariaLabel="Account setup">
            <star-step value="name" label="Name" [completed]="name().trim().length > 0">
              <star-field label="Your name">
                <input starInput [value]="name()" (input)="name.set($any($event.target).value)" />
              </star-field>
            </star-step>
            <star-step value="confirm" label="Confirm">
              Welcome, {{ name() }}. Your account is ready.
            </star-step>
          </star-stepper>
          <div class="docs-row">
            <star-button
              variant="secondary"
              [disabled]="wizard.isFirst()"
              (pressed)="wizard.previous()"
            >
              Back
            </star-button>
            <star-button [disabled]="wizard.isLast() || !name().trim()" (pressed)="wizard.next()">
              Next
            </star-button>
          </div>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarStepper', 'StarStep']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class StepperPage {
  protected readonly step = signal<string | null>('address');
  protected readonly wizardStep = signal<string | null>(null);
  protected readonly name = signal('');

  protected readonly basicScript = `readonly step = signal<string | null>('address');`;
  protected readonly linearScript = `readonly wizardStep = signal<string | null>(null);
readonly name = signal('');`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '(default)',
      description:
        'Inside star-step: the panel of the step. It shows only while the step is active.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-success', description: 'Fill of the number and the line of a done step.' },
    { name: '--star-primary-fill', description: 'Fill of the number of the current step.' },
    { name: '--star-border', description: 'Color of the line between the steps.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description:
        'Moves the focus to the next step header. A locked step is disabled and the focus skips it.',
    },
    { name: 'Enter / Space', description: 'Opens the step of the focused header.' },
  ];
}
