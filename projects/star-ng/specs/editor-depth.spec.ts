import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  STAR_EDITOR_FULL_TOOLBAR,
  StarEditor,
  starEditorSafeUrl,
  StarEditorToolbarItem,
  StarEditorToolbarTemplate,
} from '@star-ng/ui/editor';

@Component({
  imports: [StarEditor],
  template: `
    <star-editor [(value)]="html" [toolbar]="toolbar()" [readonly]="readonly()" ariaLabel="Note" />
  `,
})
class EditorHost {
  readonly html = signal('<p>Leave at the dock</p>');
  readonly toolbar = signal<readonly StarEditorToolbarItem[]>(STAR_EDITOR_FULL_TOOLBAR);
  readonly readonly = signal(false);
}

async function setup(change?: (host: EditorHost) => void) {
  const fixture = TestBed.createComponent(EditorHost);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const area = el.querySelector<HTMLElement>('.star-editor__area')!;
  const button = (name: string) => el.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
  return { fixture, el, area, button, host: fixture.componentInstance };
}

/** Selects the text of `node` from `start` to `end` (the whole text by default). */
function select(node: Node, start = 0, end = node.textContent?.length ?? 0): void {
  const text = node.nodeType === 3 ? node : node.firstChild!;
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, end);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

const key = (target: Element, init: KeyboardEventInit) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

describe('StarEditor toolbar', () => {
  it('renders the toolbar list in groups, as a WAI-ARIA toolbar with one tab stop', async () => {
    const { el, area } = await setup();
    const toolbar = el.querySelector('[role=toolbar]')!;
    expect(toolbar.getAttribute('aria-label')).toBe('Note formatting');
    expect(toolbar.getAttribute('aria-controls')).toBe(area.id);
    expect(el.querySelectorAll('[role=separator]').length).toBe(5);
    const controls = [...el.querySelectorAll<HTMLElement>('[data-editor-control]')];
    expect(controls.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Undo',
      'Redo',
      'Text style',
      'Bold',
      'Italic',
      'Underline',
      'Strikethrough',
      'Code',
      'Bulleted list',
      'Numbered list',
      'Quote',
      'Align to the start',
      'Center',
      'Align to the end',
      'Link',
      'Clear formatting',
    ]);
    expect(controls.map((c) => c.tabIndex)).toEqual([0, ...controls.slice(1).map(() => -1)]);
    expect(controls[2].tagName).toBe('SELECT');
    expect([...controls[2].querySelectorAll('option')].map((o) => o.textContent?.trim())).toEqual([
      'Paragraph',
      'Heading 1',
      'Heading 2',
      'Heading 3',
    ]);
    // Toggle buttons have aria-pressed; actions do not.
    expect(controls[3].getAttribute('aria-pressed')).toBe('false');
    expect(controls[0].hasAttribute('aria-pressed')).toBe(false);
  });

  it('moves the focus with the arrow keys, Home and End, and keeps one tab stop', async () => {
    const { el, fixture } = await setup();
    const controls = [...el.querySelectorAll<HTMLElement>('[data-editor-control]')];
    controls[0].focus();
    key(controls[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(controls[1]);
    await fixture.whenStable();
    expect(controls[1].tabIndex).toBe(0);
    expect(controls[0].tabIndex).toBe(-1);
    key(controls[1], { key: 'End' });
    expect(document.activeElement).toBe(controls.at(-1));
    key(controls.at(-1)!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(controls[0]);
    // On the select, Left and Right move on too.
    controls[2].focus();
    key(controls[2], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(controls[1]);
  });

  it('leaves out unknown names and empty groups', async () => {
    const { el } = await setup((host) =>
      host.toolbar.set(['bold', '|', '|', 'nothing' as never, 'italic']),
    );
    expect(el.querySelectorAll('[data-editor-control]').length).toBe(2);
    expect(el.querySelectorAll('[role=separator]').length).toBe(1);
  });

  it('shows aria-pressed from a selection walk', async () => {
    const { area, button, fixture } = await setup((host) =>
      host.html.set('<blockquote><p><b>Fragile</b> <code>ORD-1</code></p></blockquote>'),
    );
    select(area.querySelector('b')!);
    area.dispatchEvent(new KeyboardEvent('keyup'));
    await fixture.whenStable();
    expect(button('Bold').getAttribute('aria-pressed')).toBe('true');
    expect(button('Quote').getAttribute('aria-pressed')).toBe('true');
    expect(button('Code').getAttribute('aria-pressed')).toBe('false');
    expect(button('Align to the start').getAttribute('aria-pressed')).toBe('true');
    select(area.querySelector('code')!);
    area.dispatchEvent(new KeyboardEvent('keyup'));
    await fixture.whenStable();
    expect(button('Code').getAttribute('aria-pressed')).toBe('true');
    expect(button('Bold').getAttribute('aria-pressed')).toBe('false');
  });

  it('wraps and unwraps inline code', async () => {
    const { area, button, host } = await setup();
    select(area.querySelector('p')!, 9, 12);
    button('Code').click();
    expect(host.html()).toBe('<p>Leave at <code>the</code> dock</p>');
    select(area.querySelector('code')!);
    button('Code').click();
    expect(host.html()).toBe('<p>Leave at the dock</p>');
  });

  it('aligns the block to the center and the end with a class, and back to the start', async () => {
    const { area, button, host } = await setup();
    select(area.querySelector('p')!, 2, 4);
    button('Center').click();
    expect(host.html()).toBe('<p class="star-text-center">Leave at the dock</p>');
    button('Align to the end').click();
    expect(host.html()).toBe('<p class="star-text-end">Leave at the dock</p>');
    button('Align to the start').click();
    expect(host.html()).toBe('<p>Leave at the dock</p>');
  });

  it('runs the browser commands, with the text style from the select', async () => {
    const { el, area, button } = await setup();
    const calls: unknown[][] = [];
    const original = document.execCommand;
    document.execCommand = ((...args: unknown[]) => {
      calls.push(args);
      return true;
    }) as typeof document.execCommand;
    try {
      select(area.querySelector('p')!, 0, 5);
      button('Strikethrough').click();
      button('Undo').click();
      const style = el.querySelector<HTMLSelectElement>('select')!;
      style.value = 'h2';
      style.dispatchEvent(new Event('change'));
      button('Quote').click();
    } finally {
      document.execCommand = original;
    }
    expect(calls).toEqual([
      ['strikeThrough', false, undefined],
      ['undo', false, undefined],
      ['formatBlock', false, 'h2'],
      ['formatBlock', false, 'blockquote'],
    ]);
  });

  it('turns the toolbar off when read-only', async () => {
    const { el, area, host, fixture } = await setup((h) => h.readonly.set(true));
    const controls = [...el.querySelectorAll<HTMLButtonElement>('[data-editor-control]')];
    expect(controls.every((control) => control.disabled)).toBe(true);
    expect(area.getAttribute('contenteditable')).toBe('false');
    expect(area.getAttribute('aria-readonly')).toBe('true');
    const editor = fixture.debugElement.query(By.directive(StarEditor))
      .componentInstance as StarEditor;
    select(area.querySelector('p')!, 0, 5);
    editor.exec('code');
    expect(host.html()).toBe('<p>Leave at the dock</p>');
  });
});

describe('StarEditor link popover', () => {
  it('links the selection to a safe address, with rel for a new tab', async () => {
    const { el, area, button, host, fixture } = await setup();
    select(area.querySelector('p')!, 13, 17);
    button('Link').click();
    await fixture.whenStable();
    expect(button('Link').getAttribute('aria-expanded')).toBe('true');
    const popover = el.querySelector<HTMLElement>('star-editor-link')!;
    expect(popover.getAttribute('role')).toBe('group');
    const field = popover.querySelector<HTMLInputElement>('input[inputmode=url]')!;
    expect(document.activeElement).toBe(field);
    // No native URL check: it would block "example.com/x" and "/orders/1".
    expect(field.type).toBe('text');
    expect(popover.querySelector('form')!.noValidate).toBe(true);
    expect(popover.textContent).not.toContain('Remove link');

    // An unsafe address is refused with a message.
    field.value = 'javascript:alert(1)';
    field.dispatchEvent(new Event('input'));
    popover.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(field.getAttribute('aria-describedby')!)?.textContent).toContain(
      'https://',
    );
    expect(area.querySelector('a')).toBeNull();

    field.value = 'https://example.com/dock';
    field.dispatchEvent(new Event('input'));
    const newTab = popover.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    newTab.checked = true;
    newTab.dispatchEvent(new Event('change'));
    popover.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(el.querySelector('star-editor-link')).toBeNull();
    expect(host.html()).toBe(
      '<p>Leave at the <a href="https://example.com/dock" target="_blank" rel="noopener noreferrer">dock</a></p>',
    );
    expect(document.activeElement).toBe(area);
  });

  it('edits and removes an existing link, and Escape cancels', async () => {
    const { el, area, button, host, fixture } = await setup((h) =>
      h.html.set('<p>See <a href="https://example.com/a">orders</a></p>'),
    );
    select(area.querySelector('a')!, 1, 2);
    button('Link').click();
    await fixture.whenStable();
    let popover = el.querySelector<HTMLElement>('star-editor-link')!;
    const field = popover.querySelector<HTMLInputElement>('input[inputmode=url]')!;
    expect(field.value).toBe('https://example.com/a');
    key(field, { key: 'Escape' });
    await fixture.whenStable();
    expect(el.querySelector('star-editor-link')).toBeNull();
    expect(document.activeElement).toBe(area);

    select(area.querySelector('a')!, 1, 2);
    button('Link').click();
    await fixture.whenStable();
    popover = el.querySelector<HTMLElement>('star-editor-link')!;
    const remove = [...popover.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Remove link',
    )!;
    remove.click();
    await fixture.whenStable();
    expect(host.html()).toBe('<p>See orders</p>');
  });

  it('accepts only safe link addresses', () => {
    expect(starEditorSafeUrl(' https://example.com/a ')).toBe('https://example.com/a');
    expect(starEditorSafeUrl('mailto:orders@example.com')).toBe('mailto:orders@example.com');
    expect(starEditorSafeUrl('tel:+15550100')).toBe('tel:+15550100');
    expect(starEditorSafeUrl('/orders/1042')).toBe('/orders/1042');
    expect(starEditorSafeUrl('example.com/orders')).toBe('https://example.com/orders');
    expect(starEditorSafeUrl('javascript:alert(1)')).toBeNull();
    expect(starEditorSafeUrl('JAVASCRIPT:alert(1)')).toBeNull();
    expect(starEditorSafeUrl('data:text/html,x')).toBeNull();
    expect(starEditorSafeUrl('//evil.example.com')).toBeNull();
    expect(starEditorSafeUrl('https://example.com/a b')).toBeNull();
    expect(starEditorSafeUrl('')).toBeNull();
  });
});

@Component({
  imports: [StarEditor],
  template: `
    <star-editor
      [(value)]="value"
      [format]="format()"
      [maxLength]="maxLength()"
      [readonly]="readonly()"
      ariaLabel="Comment"
    />
  `,
})
class FormatHost {
  readonly value = signal('First line\nSecond <line>');
  readonly format = signal<'html' | 'text'>('text');
  readonly maxLength = signal<number | null>(30);
  readonly readonly = signal(false);
}

describe('StarEditor format and maxLength', () => {
  async function setupFormat(change?: (host: FormatHost) => void) {
    const fixture = TestBed.createComponent(FormatHost);
    change?.(fixture.componentInstance);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      el,
      area: el.querySelector<HTMLElement>('.star-editor__area')!,
      host: fixture.componentInstance,
    };
  }

  it('shows plain text as paragraphs and stores plain text', async () => {
    const { area, host, fixture } = await setupFormat();
    expect(area.innerHTML).toBe('<p>First line</p><p>Second &lt;line&gt;</p>');
    area.innerHTML = '<p>One <b>bold</b></p><ul><li>Two</li></ul>';
    area.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.value()).toBe('One bold\nTwo');
  });

  it('counts the text, describes the area with the counter and announces the rest near the end', async () => {
    const { el, area, fixture } = await setupFormat();
    const counter = document.getElementById(
      area.getAttribute('aria-describedby')!.split(' ').at(-1)!,
    );
    expect(counter?.textContent?.trim()).toBe('23 of 30 characters');
    area.innerHTML = '<p>' + 'x'.repeat(28) + '</p>';
    area.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(counter?.textContent?.trim()).toBe('28 of 30 characters');
    expect(el.querySelector('[aria-live=polite]')?.textContent?.trim()).toBe('2 characters left');
  });

  it('blocks text input past maxLength', async () => {
    const { area, fixture } = await setupFormat((host) => host.value.set('x'.repeat(30)));
    await fixture.whenStable();
    const event = new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: 'y',
      cancelable: true,
      bubbles: true,
    });
    area.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const lineBreak = new InputEvent('beforeinput', {
      inputType: 'insertParagraph',
      cancelable: true,
      bubbles: true,
    });
    area.dispatchEvent(lineBreak);
    expect(lineBreak.defaultPrevented).toBe(false);
  });

  it('has no counter without maxLength, and keeps HTML by default', async () => {
    const { el, area } = await setupFormat((host) => {
      host.maxLength.set(null);
      host.format.set('html');
      host.value.set('<p>A <b>b</b></p>');
    });
    expect(el.querySelector('.star-editor__counter')).toBeNull();
    expect(area.innerHTML).toBe('<p>A <b>b</b></p>');
  });
});

@Component({
  imports: [StarEditor],
  template: `<star-editor [(value)]="html" [pasteAsText]="asText()" ariaLabel="Body" />`,
})
class PasteHost {
  readonly html = signal('<p>Start</p>');
  readonly asText = signal(false);
}

/** A paste event with clipboard data (jsdom has no ClipboardEvent). */
function paste(target: Element, data: Record<string, string>): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => data[type] ?? '' },
  });
  target.dispatchEvent(event);
  return event;
}

describe('StarEditor paste', () => {
  async function setupPaste(asText: boolean) {
    const fixture = TestBed.createComponent(PasteHost);
    fixture.componentInstance.asText.set(asText);
    await fixture.whenStable();
    const area = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.star-editor__area',
    )!;
    select(area.querySelector('p')!, 5, 5);
    return { area, host: fixture.componentInstance };
  }

  it('pastes sanitized HTML: no script, style or event handler', async () => {
    const { area, host } = await setupPaste(false);
    const event = paste(area, {
      'text/html':
        '<style>p { color: red }</style><b onclick="alert(1)" style="color: red">bold</b><script>alert(1)</script><img src="x" onerror="alert(1)">',
      'text/plain': 'bold',
    });
    expect(event.defaultPrevented).toBe(true);
    const html = host.html();
    expect(html).toContain('<b>bold</b>');
    expect(html).not.toMatch(/script|onclick|onerror|style|color/);
    expect(area.innerHTML).not.toMatch(/script|onclick|onerror|style=/);
  });

  it('pastes plain text with pasteAsText', async () => {
    const { area, host } = await setupPaste(true);
    paste(area, { 'text/html': '<b>bold</b>', 'text/plain': ' & more' });
    expect(host.html()).toBe('<p>Start &amp; more</p>');
  });
});

@Component({
  imports: [StarEditor, StarEditorToolbarTemplate],
  template: `
    <star-editor [(value)]="html" [readonly]="readonly()" ariaLabel="Memo">
      <ng-template
        starEditorToolbar
        let-exec="exec"
        let-isActive="isActive"
        let-disabled="disabled"
      >
        <div role="toolbar" aria-label="Memo tools" class="own">
          <button
            type="button"
            [attr.aria-pressed]="isActive('code')"
            [disabled]="disabled"
            (click)="exec('code')"
          >
            Code
          </button>
        </div>
      </ng-template>
    </star-editor>
  `,
})
class SlotHost {
  readonly html = signal('<p>Order ORD-1</p>');
  readonly readonly = signal(false);
}

describe('StarEditor toolbar slot', () => {
  it('replaces the toolbar; the context runs commands and reads their state', async () => {
    const fixture = TestBed.createComponent(SlotHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[role=toolbar]').length).toBe(1);
    expect(el.querySelector('[role=toolbar]')!.classList).toContain('own');
    expect(el.querySelector('[data-editor-control]')).toBeNull();
    const area = el.querySelector<HTMLElement>('.star-editor__area')!;
    const button = el.querySelector<HTMLButtonElement>('.own button')!;
    select(area.querySelector('p')!, 6, 11);
    button.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.html()).toBe('<p>Order <code>ORD-1</code></p>');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fixture.componentInstance.readonly.set(true);
    await fixture.whenStable();
    expect(button.disabled).toBe(true);
  });
});

describe('StarEditor links that open a new tab', () => {
  it('gives every link with a target rel="noopener noreferrer", from the model, a paste and an edit', async () => {
    const fixture = TestBed.createComponent(PasteHost);
    fixture.componentInstance.html.set(
      '<p>See <a href="https://example.com/a" target="_blank" rel="opener">orders</a> and <a href="https://example.com/b" target="_top">cities</a></p>',
    );
    await fixture.whenStable();
    const area = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.star-editor__area',
    )!;
    const [first, second] = [...area.querySelectorAll('a')];
    expect(first.getAttribute('target')).toBe('_blank');
    expect(first.getAttribute('rel')).toBe('noopener noreferrer');
    expect(second.hasAttribute('target')).toBe(false);

    select(area.querySelector('p')!.firstChild!, 4, 4);
    paste(area, {
      'text/html': '<a href="https://example.com/c" target="win" rel="opener">invoices</a>',
      'text/plain': 'invoices',
    });
    const host = fixture.componentInstance;
    expect(host.html()).toContain(
      '<a href="https://example.com/c" target="_blank" rel="noopener noreferrer">invoices</a>',
    );
    expect(host.html()).not.toContain('rel="opener"');
    expect(host.html()).not.toContain('_top');
  });
});

describe('StarEditor fix round 1', () => {
  it('keeps the focus on the text style select after a change', async () => {
    const { el, area } = await setup();
    select(area.querySelector('p')!, 0, 3);
    const style = el.querySelector<HTMLSelectElement>('select')!;
    style.focus();
    style.value = 'h2';
    style.dispatchEvent(new Event('change'));
    expect(document.activeElement).toBe(style);
  });
});

describe('StarEditor drop', () => {
  it('handles a drop like a paste: sanitized HTML', async () => {
    const fixture = TestBed.createComponent(PasteHost);
    await fixture.whenStable();
    const area = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.star-editor__area',
    )!;
    select(area.querySelector('p')!, 5, 5);
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        getData: (type: string) =>
          type === 'text/html' ? '<i onclick="alert(1)">x</i>' : type === 'text/plain' ? 'x' : '',
      },
    });
    area.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.html()).toBe('<p>Start<i>x</i></p>');
  });
});

describe('StarEditor state outside the area', () => {
  it('ignores the document state without a selection in the area, and refreshes on focus', async () => {
    const { area, button, fixture } = await setup((h) => h.html.set('<p><b>Bold</b> text</p>'));
    const outside = document.createElement('p');
    outside.textContent = 'Outside';
    document.body.append(outside);
    const original = document.queryCommandState;
    document.queryCommandState = (() => true) as typeof document.queryCommandState;
    try {
      select(outside);
      area.dispatchEvent(new KeyboardEvent('keyup'));
      await fixture.whenStable();
      expect(button('Bold').getAttribute('aria-pressed')).toBe('false');
      select(area.querySelector('b')!);
      area.dispatchEvent(new FocusEvent('focus'));
      await fixture.whenStable();
      expect(button('Bold').getAttribute('aria-pressed')).toBe('true');
    } finally {
      document.queryCommandState = original;
      outside.remove();
    }
  });
});
