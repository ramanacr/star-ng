import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  STAR_EDITOR_FULL_TOOLBAR,
  StarEditor,
  StarEditorToolbarItem,
  StarEditorToolbarTemplate,
} from '@star-ng/ui/editor';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-editor-page',
  imports: [DOCS, StarEditor, StarEditorToolbarTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Editor"
      lead="A rich text field: an editable area with a formatting toolbar. The value is an HTML string."
      importFrom="import { StarEditor } from '@star-ng/ui/editor';"
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
          <pre class="docs-output" role="group" aria-label="Value of the editor">{{ note() }}</pre>
        </div>
      </docs-example>

      <docs-example
        heading="Full toolbar"
        source="editor/full-toolbar"
        [script]="fullScript"
        note="toolbar lists the commands in order; '|' starts a new group. STAR_EDITOR_FULL_TOOLBAR has every command: undo and redo, text style (paragraph, heading 1 to 3) and font size, bold, italic, underline, strikethrough, subscript, superscript, inline code, text color and highlight (palette colors from the theme tokens, no color, or a custom color), bulleted, numbered and checklist lists, decrease and increase indent, quote, alignment to the start, the center and the end and justify (logical: the start is on the right in right-to-left), link, horizontal line and clear formatting. Groups that do not fit in the width go into the More actions panel at the end of the toolbar."
      >
        <div class="docs-stack">
          <star-editor
            [(value)]="report"
            [toolbar]="fullToolbar"
            ariaLabel="Product announcement"
          />
          <pre class="docs-output" role="group" aria-label="Value of the full editor">{{
            report()
          }}</pre>
        </div>
      </docs-example>

      <docs-example
        heading="Lists, checklists and nesting"
        source="editor/lists"
        [script]="listsScript"
        note="The list buttons turn the selected paragraphs into items, change the kind of a list, or turn the items back into paragraphs. In a list item, Tab nests the item under the item before it and Shift+Tab takes it out one level; when the item cannot move, Tab leaves the area as usual. A checklist is a bulleted list with the class star-checklist and data-checked on each item: click the box or press Ctrl+Enter to check an item. Outside lists, the indent buttons indent the paragraph in steps."
      >
        <div class="docs-stack">
          <star-editor [(value)]="plan" [toolbar]="listToolbar" ariaLabel="Launch plan" />
        </div>
      </docs-example>

      <docs-example
        heading="Own toolbar list"
        source="editor/own-toolbar"
        [script]="ownScript"
        note="Any list of command names works, for example a short toolbar for comments."
      >
        <div class="docs-stack">
          <star-editor [toolbar]="shortToolbar" ariaLabel="Short comment" minHeight="4rem" />
        </div>
      </docs-example>

      <docs-example
        heading="Plain text and a length limit"
        source="editor/text-limit"
        [script]="limitScript"
        note="With format text, the value is plain text: one line per paragraph, no markup. maxLength counts the characters of text (line breaks do not count). Typing stops at the limit. The counter under the area describes it, and a live message gives the characters left near the end. A signal form field with a maxLength rule sets it too."
      >
        <div class="docs-stack">
          <star-editor
            [(value)]="summary"
            format="text"
            [maxLength]="120"
            ariaLabel="Delivery summary"
          />
          <pre class="docs-output" role="group" aria-label="Value of the text editor">{{
            summary()
          }}</pre>
        </div>
      </docs-example>

      <docs-example
        heading="Paste as plain text"
        source="editor/paste"
        note="By default, pasted HTML is sanitized before it goes in: no script, no style element or attribute, no event handler. With pasteAsText, a paste inserts only the plain text. Copy formatted text from another page and paste it in both editors."
      >
        <div class="docs-stack">
          <star-editor ariaLabel="Pasted with formats" minHeight="4rem" />
          <star-editor pasteAsText ariaLabel="Pasted as plain text" minHeight="4rem" />
        </div>
      </docs-example>

      <docs-example
        heading="Own toolbar template"
        source="editor/toolbar-slot"
        note="ng-template starEditorToolbar replaces the toolbar. Its context has exec(command, value?), isActive(command) and disabled. Give the container role toolbar and a name, and stop mousedown on the buttons so the text keeps its selection."
      >
        <div class="docs-stack">
          <star-editor ariaLabel="Release note" minHeight="4rem">
            <ng-template
              starEditorToolbar
              let-exec="exec"
              let-isActive="isActive"
              let-disabled="disabled"
            >
              <div
                class="star-toolbar star-editor__toolbar"
                role="toolbar"
                aria-label="Release note tools"
              >
                <button
                  type="button"
                  class="star-btn star-btn--ghost star-btn--sm"
                  [attr.aria-pressed]="isActive('bold')"
                  [disabled]="disabled"
                  (mousedown)="$event.preventDefault()"
                  (click)="exec('bold')"
                >
                  Bold
                </button>
                <button
                  type="button"
                  class="star-btn star-btn--ghost star-btn--sm"
                  [attr.aria-pressed]="isActive('code')"
                  [disabled]="disabled"
                  (mousedown)="$event.preventDefault()"
                  (click)="exec('code')"
                >
                  Code
                </button>
              </div>
            </ng-template>
          </star-editor>
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
        note="disabled and readonly make the area not editable and turn off every toolbar control (buttons and the text style select). A disabled area also leaves the tab order. A read-only area keeps its focus, so a user can select and copy the text."
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
        note="This value has a script element, an event handler, a style that is not allowed (position) next to an allowed one (color) and a javascript: link. The area shows the sanitized HTML: no script, no handler, only the color, and the link has no address. The value of the model is not changed until the user edits the area: then the model gets the sanitized HTML of the area. Type in the area and look at the value below."
      >
        <div class="docs-stack">
          <star-editor [(value)]="unsafe" ariaLabel="Sanitized content" />
          <pre class="docs-output" aria-label="Value after sanitizing">{{ unsafe() }}</pre>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarEditor', 'StarEditorToolbarTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>What the editor does with HTML</h2>
      <p>
        The editor sanitizes HTML with its own allow-list sanitizer (the rules of Aurora RTE) in two
        places:
      </p>
      <ol>
        <li>
          <strong>Value to area.</strong> When the value changes from outside, the editor parses the
          value in an inert template (no script runs, no image loads), keeps only the allowed
          elements and attributes and sets the result as the <code>innerHTML</code> of the area.
          Script, style, iframe, object, SVG and form elements go with their content; unknown
          elements are unwrapped (their text stays); event handler attributes such as
          <code>onclick</code>, <code>id</code> and <code>name</code> go; a link or image address
          needs an allowed protocol (<code>javascript:</code>, <code>vbscript:</code> and
          <code>data:</code> never pass, except a <code>data:</code> image); only known style
          properties with safe values stay (color, background color, font size, text alignment,
          indentation, width and height). Legacy <code>&lt;font&gt;</code>,
          <code>&lt;center&gt;</code>, <code>&lt;strike&gt;</code> and <code>align</code> become
          current markup. A link that opens a new tab gets <code>rel="noopener noreferrer"</code>.
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
        server before you store it, and use a sanitizer when you show the value in another page.
        Note that <code>[innerHTML]</code> uses the Angular sanitizer, which removes every
        <code>style</code> attribute (colors, sizes and indentation are then lost; alignment and
        checklists are classes and stay). Never mark the value as trusted without a server check.
      </p>
      <p>
        The area is treated as empty when it has no text (the stored value is an empty string). A
        value that has only an image or a divider is therefore stored as an empty string.
      </p>
      <p>
        The link button opens a small form under the toolbar: an address field, "Open in a new tab",
        Apply, Remove link (for a link at the caret) and Cancel. Escape cancels. The form accepts
        <code>https://</code>, <code>http://</code>, <code>mailto:</code> and
        <code>tel:</code> addresses and addresses on the same site (<code>/path</code>,
        <code>#part</code>). A host name such as <code>example.com/orders</code> gets
        <code>https://</code>. Any other address (for example <code>javascript:</code>) shows an
        error and makes no link. A link that opens in a new tab gets
        <code>rel="noopener noreferrer"</code>.
      </p>

      <h2>Technical notes</h2>
      <p>
        Bold, italic, underline, strikethrough and the text style use
        <code>document.execCommand</code>. Browsers still support it, but it is no longer developed,
        and the HTML that it makes can differ between browsers. The other commands change the DOM
        directly. The editor keeps its own undo history of every change.
      </p>
    </docs-page>
  `,
})
export class EditorPage {
  protected readonly note = signal('');
  protected readonly comment = signal('');
  protected readonly saved = signal('<p>Leave the parcel at the <b>loading dock</b>.</p>');
  protected readonly unsafe = signal(
    '<p onclick="alert(1)" style="color: #c62828; position: fixed">Order <b>ORD-1042</b> <script>alert(1)</script><a href="javascript:alert(1)">open</a></p>',
  );

  protected readonly report = signal(
    '<h2>Release 4.2 is here</h2><p>The <b>new dashboard</b> ships today with <span style="color: var(--star-accent)">faster reports</span> and <span style="background-color: var(--star-warning-soft)">saved filters</span>. Read the <a href="https://example.com/release">release notes</a>.</p>',
  );
  protected readonly plan = signal(
    '<ul class="star-checklist"><li data-checked="true">Write the release notes</li><li data-checked="false">Update the screenshots<ul class="star-checklist"><li data-checked="false">Dashboard</li><li data-checked="false">Reports</li></ul></li><li data-checked="false">Send the announcement</li></ul>',
  );
  protected readonly listToolbar: readonly StarEditorToolbarItem[] = [
    'insertUnorderedList',
    'insertOrderedList',
    'checklist',
    '|',
    'outdent',
    'indent',
  ];
  protected readonly listsScript = `readonly plan = signal('<ul class="star-checklist"><li data-checked="true">Write the release notes</li>…</ul>');
readonly listToolbar: readonly StarEditorToolbarItem[] = [
  'insertUnorderedList', 'insertOrderedList', 'checklist', '|', 'outdent', 'indent',
];`;
  protected readonly fullToolbar = STAR_EDITOR_FULL_TOOLBAR;
  protected readonly shortToolbar: readonly StarEditorToolbarItem[] = [
    'bold',
    'italic',
    '|',
    'link',
  ];
  protected readonly fullScript = `readonly report = signal('<h2>Release 4.2 is here</h2><p>The <b>new dashboard</b> ships today.</p>');
readonly fullToolbar = STAR_EDITOR_FULL_TOOLBAR;`;
  protected readonly ownScript = `readonly shortToolbar: readonly StarEditorToolbarItem[] = ['bold', 'italic', '|', 'link'];`;
  protected readonly summary = signal('Two boxes for Orchard Supply.\nDeliver before noon.');
  protected readonly limitScript = `readonly summary = signal('Two boxes for Orchard Supply.\\nDeliver before noon.');`;
  protected readonly basicScript = `readonly note = signal('');`;
  protected readonly sizeScript = `readonly comment = signal('');`;
  protected readonly statesScript = `readonly saved = signal('<p>Leave the parcel at the <b>loading dock</b>.</p>');`;
  protected readonly sanitizeScript = `readonly unsafe = signal(
  '<p onclick="alert(1)" style="color: #c62828; position: fixed">Order <b>ORD-1042</b> <script>alert(1)</script><a href="javascript:alert(1)">open</a></p>',
);`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template starEditorToolbar',
      description:
        'Replaces the toolbar. Context: exec(command, value?), isActive(command), disabled; $implicit is exec.',
    },
  ];
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
      description:
        'In the toolbar: moves between the buttons and the text style select. Only one toolbar control is in the tab order.',
    },
    {
      name: 'Arrow Up / Arrow Down',
      description: 'On the text style select: chooses the style.',
    },
    {
      name: 'Escape',
      description: 'In the link form: closes it, and the focus goes back to the text.',
    },
    {
      name: 'Enter / Space',
      description: 'On a toolbar button: runs the command on the selected text.',
    },
    {
      name: 'Ctrl+B / Ctrl+I / Ctrl+U',
      description: 'In the area: bold, italic and underline, from the browser.',
    },
    {
      name: 'Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z)',
      description: 'In the area: undo and redo, with the history of the editor (every change).',
    },
    {
      name: 'Tab / Shift+Tab in a list item',
      description:
        'Nests the item under the item before it, or takes it out one level. When the item cannot move, Tab leaves the area as usual.',
    },
    { name: 'Ctrl+Enter in a checklist item', description: 'Checks or unchecks the item.' },
    {
      name: 'Escape',
      description:
        'In the color panel or the More actions panel: closes it; the focus goes back to the text or to the More actions button.',
    },
  ];
}
