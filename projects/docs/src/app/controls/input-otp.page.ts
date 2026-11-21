import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarInputOtp } from '@star-ng/ui/input-otp';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './input-otp.page.scss',
  selector: 'docs-input-otp-page',
  imports: [DOCS, StarInputOtp],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="One-time code"
      lead="One box per character. Focus moves forward as the user types. A pasted code fills every box."
      importFrom="import { StarInputOtp } from '@star-ng/ui/input-otp';"
    >
      <docs-example heading="Six digits" source="input-otp/basic">
        <star-input-otp
          [(value)]="code"
          integerOnly
          ariaLabel="Verification code"
          (completed)="done.set($event)"
        />
        <p class="docs-output" role="status">
          Value: {{ code() || '(empty)' }}. Completed: {{ done() || 'no' }}
        </p>
      </docs-example>

      <docs-example heading="Four characters, masked" source="input-otp/masked">
        <star-input-otp [(value)]="pin" [length]="4" mask ariaLabel="PIN" />
      </docs-example>

      <docs-example heading="Disabled" source="input-otp/disabled">
        <star-input-otp value="123456" disabled ariaLabel="Used code" />
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The boxes follow the page direction: in a right-to-left page the first box is on the right
        and Arrow left moves to the next box. A code that must always read from left to right
        belongs in an element with <code>dir="ltr"</code>. See the Right-to-left guide.
      </p>

      <docs-api [of]="['StarInputOtp']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class InputOtpPage {
  protected readonly code = signal('');
  protected readonly done = signal('');
  protected readonly pin = signal('');

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-radius-md', description: 'Corner radius of a box.' },
    { name: '--star-accent', description: 'Border color of the focused box.' },
    { name: '--star-danger', description: 'Border color of the boxes when invalid.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Character', description: 'Fills the box and moves to the next box.' },
    {
      name: 'Backspace',
      description: 'Clears the box. In an empty box: clears the box before and moves to it.',
    },
    { name: 'Arrow left / Arrow right', description: 'Move between the boxes.' },
    { name: 'Paste', description: 'Fills the boxes from the pasted text.' },
  ];
}
