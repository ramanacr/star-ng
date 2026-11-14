import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarEditor } from 'star-ng/editor';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-editor-page',
  imports: [DOCS, StarEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Editor"
      lead="A rich text field: an editable area with a formatting toolbar. The value is an HTML string."
      importFrom="import { StarEditor } from 'star-ng/editor';"
    >
      <docs-example
        heading="Toolbar and value"
        source="editor/basic"
        [script]="basicScript"
        note="The toolbar has bold, italic, underline, heading, bulleted list, numbered list, clear formatting and link. The value is the HTML of the editing area. It is an empty string when the area has no text. The keyboard shortcuts of the browser also work in the area (for example Ctrl+B for bold). The bold, italic, underline and list buttons show aria-pressed for the text at the caret."
      >
        <div class="docs-stack">
          <star-editor
            [(value)]="note"
            ariaLabel="Delivery note"
            placeholder="Write the delivery note"
          />
          <pre class="docs-output" aria-label="Value of the editor">{{ note() }}</pre>
        </div>
      </docs-example>

      <docs-example
        heading="Placeholder and height"
        source="editor/size"
        [script]="sizeScript"
        note="placeholder shows while the area is empty. minHeight is a CSS length for the smallest height of the area. The area grows with its content."
      >
        <div class="docs-stack">
          <star-editor
            [(value)]="comment"
            ariaLabel="Order comment"
            placeholder="Add a comment"
            minHeight="4rem"
          />
        </div>
      </docs-example>

      <docs-example
        heading="Disabled and read-only"
        source="editor/states"
        [script]="statesScript"
        note="disabled and readonly make the area not editable and turn off the toolbar buttons. A disabled area also leaves the tab order. A read-only area keeps its focus, so a user can select and copy the text."
      >
        <div class="docs-stack">
          <star-editor [value]="saved()" ariaLabel="Saved note" readonly />
          <star-editor [value]="saved()" ariaLabel="Locked note" disabled />
        </div>
      </docs-example>

      <docs-example
        heading="HTML that is sanitized"
        source="editor/sanitize"
        [script]="sanitizeScript"
        note="This value has a script element, an event handler, a style attribute and a javascript: link. The area shows the sanitized HTML: no script, no handler, no style, and the link address starts with unsafe:. The value of the model is not changed until the user edits the area: then the model gets the sanitized HTML of the area. Type in the area and look at the value below."
      >
        <div class="docs-stack">
          <star-editor [(value)]="unsafe" ariaLabel="Sanitized content" />
          <pre class="docs-output" aria-label="Value after sanitizing">{{ unsafe() }}</pre>
        </div>
      </docs-example>

      <docs-api [of]="['StarEditor']" [cssVars]="cssVars" [keyboard]="keyboard" />

      <h2>What the editor does with HTML</h2>
      <p>
        The editor sanitizes HTML with the Angular <code>DomSanitizer</code>
        (<code>SecurityContext.HTML</code>) in two places:
      </p>
      <ol>
        <li>
          <strong>Value to area.</strong> When the value changes from outside, the editor sets the
          <code>innerHTML</code> of the area to the sanitized value. The sanitizer removes script
          elements (with their content) and other unsafe elements, event handler attributes such as
          <code>onclick</code>, and <code>style</code> attributes. It does not remove an unsafe URL
          such as <code>javascript:alert(1)</code>: it keeps the attribute and puts
          <code>unsafe:</code> in front of the address, so the link does not run script. In
          development mode, Angular writes a warning to the console when it changes something.
        </li>
        <li>
          <strong>Area to value.</strong> After each edit (typing, a toolbar command, or a paste)
          the editor reads the <code>innerHTML</code> of the area, sanitizes it and stores the
          result in the model. The area itself is not rewritten, so the area can show something that
          the stored value does not contain (for example a style that the browser added during a
          paste).
        </li>
      </ol>
      <p>
        The model value is not sanitized when your code sets it. It stays as you set it until the
        user edits the area. Sanitizing in the editor is a protection for the editing area. It is
        not a protection for the place where you use the value. Sanitize the HTML again on the
        server before you store it, and use <code>[innerHTML]</code> (Angular sanitizes it) or a
        sanitizer when you show the value in another page. Never mark the value as trusted without a
        server check.
      </p>
      <p>
        The area is treated as empty when it has no text (the stored value is an empty string). A
        value that has only an image or a divider is therefore stored as an empty string.
      </p>
      <p>
        The link button asks for an address with the <code>prompt</code> dialog of the browser and
        accepts only addresses that start with <code>http://</code> or <code>https://</code>. Other
        input is ignored.
      </p>

      <h2>Technical notes</h2>
      <p>
        Formatting uses <code>document.execCommand</code>. Browsers still support it, but it is no
        longer developed, and the HTML that it makes can differ between browsers. For complex
        documents use a dedicated editor library.
      </p>
    </docs-page>
  `,
})
export class EditorPage {
  protected readonly note = signal('');
  protected readonly comment = signal('');
  protected readonly saved = signal('<p>Leave the parcel at the <b>loading dock</b>.</p>');
  protected readonly unsafe = signal(
    '<p onclick="alert(1)" style="color: red">Order <b>ORD-1042</b> <script>alert(1)</script><a href="javascript:alert(1)">open</a></p>',
  );

  protected readonly basicScript = `readonly note = signal('');`;
  protected readonly sizeScript = `readonly comment = signal('');`;
  protected readonly statesScript = `readonly saved = signal('<p>Leave the parcel at the <b>loading dock</b>.</p>');`;
  protected readonly sanitizeScript = `readonly unsafe = signal(
  '<p onclick="alert(1)" style="color: red">Order <b>ORD-1042</b> <script>alert(1)</script><a href="javascript:alert(1)">open</a></p>',
);`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border', description: 'Border of the editor and line under the toolbar.' },
    { name: '--star-surface-muted', description: 'Background of the toolbar.' },
    {
      name: '--star-accent',
      description: 'Border color while the area has the focus, and the color of links in the text.',
    },
    { name: '--star-primary-soft', description: 'Background of a pressed toolbar button.' },
    { name: '--star-danger', description: 'Border when the control is invalid and touched.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab / Shift+Tab',
      description: 'Moves between the toolbar (one tab stop) and the editing area.',
    },
    {
      name: 'ArrowLeft / ArrowRight / Home / End',
      description: 'In the toolbar: moves between the buttons.',
    },
    {
      name: 'Enter / Space',
      description: 'On a toolbar button: runs the command on the selected text.',
    },
    {
      name: 'Ctrl+B / Ctrl+I / Ctrl+U',
      description: 'In the area: bold, italic and underline, from the browser.',
    },
    { name: 'Ctrl+Z / Ctrl+Y', description: 'In the area: undo and redo, from the browser.' },
  ];
}
