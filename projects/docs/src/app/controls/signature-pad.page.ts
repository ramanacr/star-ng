import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { StarButton } from '@star-ng/ui/button';
import { StarField } from '@star-ng/ui/field';
import { StarSignaturePad } from '@star-ng/ui/signature-pad';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-signature-pad-page',
  imports: [DOCS, FormField, StarButton, StarField, StarSignaturePad],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .preview {
      max-inline-size: 16rem;
      max-block-size: 5rem;
      border: 1px solid var(--star-border);
      border-radius: var(--star-radius-sm);
      background: var(--star-surface);
    }
  `,
  template: `
    <docs-page
      heading="Signature pad"
      lead="A drawing area for a handwritten signature with a mouse, a pen or a finger. The value is a PNG or SVG data URL. The Kendo UI equivalent is SignaturePad."
      importFrom="import { StarSignaturePad } from '@star-ng/ui/signature-pad';"
    >
      <docs-example
        heading="Draw a signature"
        source="signature-pad/basic"
        note="Strokes are smoothed with quadratic curves. A pen draws thicker when pressed harder. Undo removes the last stroke, Clear removes all. The value is a PNG data URL, '' while the pad is empty."
      >
        <div class="docs-stack">
          <star-signature-pad [(value)]="signature" ariaLabel="Customer signature" />
          @if (signature()) {
            <img class="preview" [src]="signature()" alt="Preview of the signature" />
          }
          <p class="docs-output" role="status">Value: {{ summary() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Type the name instead (keyboard)"
        source="signature-pad/typed"
        note="The canvas cannot be drawn with the keyboard. allowTyped adds a Draw / Type switch: the typed name is drawn in a script-like system font into the value. This pad stores SVG (valueFormat='svg'), built from the stroke points."
      >
        <star-signature-pad
          [(value)]="typedSignature"
          allowTyped
          valueFormat="svg"
          [strokeWidth]="2.5"
          ariaLabel="Approver signature"
        />
        <p class="docs-output" role="status">
          Format: {{ typedSignature() ? typedSignature().slice(0, 26) + '…' : '(empty)' }}
        </p>
      </docs-example>

      <docs-example
        heading="In a form, required"
        source="signature-pad/form"
        note="Signal Forms: required fails on an empty pad. Reactive Forms work through SignalFormControl, like the other fields. The default stroke color follows the theme (light ink in the dark theme); this pad sets strokeColor and backgroundColor, so the stored image looks the same in both themes."
      >
        <div class="docs-stack">
          <star-field label="Signature" [state]="f.signature()">
            <star-signature-pad
              [formField]="f.signature"
              allowTyped
              strokeColor="#000000"
              backgroundColor="#ffffff"
            />
          </star-field>
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="model.set({ signature: '' })">
              Reset
            </star-button>
          </div>
          <p class="docs-output" role="status">Valid: {{ f.signature().valid() ? 'yes' : 'no' }}</p>
        </div>
      </docs-example>

      <docs-example heading="Disabled" source="signature-pad/disabled">
        <star-signature-pad disabled ariaLabel="Signature (locked)" />
      </docs-example>

      <h2>High-DPI screens and resizing</h2>
      <p>
        In the browser the canvas has as many pixels as the screen shows (it is scaled by
        <code>devicePixelRatio</code>), so lines stay sharp. When the pad changes size, a
        <code>ResizeObserver</code> draws the stored strokes again. On the server nothing is drawn.
      </p>

      <docs-api [of]="['StarSignaturePad']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class SignaturePadPage {
  protected readonly signature = signal('');
  protected readonly typedSignature = signal('');
  protected readonly summary = computed(() => {
    const value = this.signature();
    return value ? `${value.slice(0, 22)}… (${value.length} characters)` : '(empty)';
  });

  protected readonly model = signal({ signature: '' });
  protected readonly f = form(this.model, (p) => {
    required(p.signature, { message: 'Please sign.' });
  });

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-signature-stroke', description: 'Stroke color when strokeColor is not set.' },
    { name: '--star-signature-height', description: 'Height of the drawing area (10rem).' },
    { name: '--star-border-strong', description: 'Border of the pad and the signing line.' },
    { name: '--star-danger', description: 'Border color when invalid.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves to Draw, Type, the name field, Undo and Clear.' },
    { name: 'Enter / Space', description: 'Presses the focused button.' },
    {
      name: 'Typing (Type mode)',
      description: 'Writes the name into the value. The canvas is not drawn by keys.',
    },
  ];
}
