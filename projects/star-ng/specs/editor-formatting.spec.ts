import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { STAR_EDITOR_FULL_TOOLBAR, StarEditor, StarEditorToolbarItem } from '@star-ng/ui/editor';

@Component({
  imports: [StarEditor],
  template: `<star-editor [(value)]="html" [toolbar]="toolbar()" ariaLabel="Announcement" />`,
})
class Host {
  readonly html = signal('<p>New release ships today</p>');
  readonly toolbar = signal<readonly StarEditorToolbarItem[]>(STAR_EDITOR_FULL_TOOLBAR);
}

async function setup(html?: string, toolbar?: readonly StarEditorToolbarItem[]) {
  const fixture = TestBed.createComponent(Host);
  if (html !== undefined) fixture.componentInstance.html.set(html);
  if (toolbar) fixture.componentInstance.toolbar.set(toolbar);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const area = el.querySelector<HTMLElement>('.star-editor__area')!;
  const button = (name: string) => el.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
  return { fixture, el, area, button, host: fixture.componentInstance };
}

function select(node: Node, start = 0, end?: number): void {
  const text = node.nodeType === 3 ? node : node.firstChild!;
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, end ?? text.textContent!.length);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

const keydown = (target: Element, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('StarEditor formatting breadth', () => {
  it('sets a palette color, a custom color and no color from the color panel', async () => {
    const { el, area, button, fixture, host } = await setup();
    select(area.querySelector('p')!, 4, 11);
    button('Text color').click();
    await fixture.whenStable();
    expect(button('Text color').getAttribute('aria-expanded')).toBe('true');
    const panel = el.querySelector('[role=group][aria-label="Text color"]')!;
    expect(panel).toBeTruthy();
    panel.querySelector<HTMLButtonElement>('[aria-label="Red"]')!.click();
    await fixture.whenStable();
    expect(host.html()).toBe(
      '<p>New <span style="color: var(--star-danger)">release</span> ships today</p>',
    );
    expect(el.querySelector('star-editor-color')).toBeNull();

    select(area.querySelector('span')!, 0, 7);
    button('Highlight color').click();
    await fixture.whenStable();
    const custom = el.querySelector<HTMLInputElement>('star-editor-color input[type=color]')!;
    custom.value = '#ffee58';
    custom.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    // The browser writes the color as rgb().
    expect(host.html()).toContain('background-color: rgb(255, 238, 88)');

    select(area.querySelector('span')!.firstChild!, 0, 7);
    area.dispatchEvent(new KeyboardEvent('keyup'));
    button('Text color').click();
    await fixture.whenStable();
    expect(
      el.querySelector('star-editor-color [aria-label=Red]')!.getAttribute('aria-pressed'),
    ).toBe('true');
    el.querySelector<HTMLButtonElement>('star-editor-color button')!.click();
    await fixture.whenStable();
    expect(host.html()).toBe(
      '<p>New <span style="background-color: rgb(255, 238, 88)">release</span> ships today</p>',
    );
  });

  it('closes the color panel with Escape and keeps the selection', async () => {
    const { el, area, button, fixture } = await setup();
    select(area.querySelector('p')!, 0, 3);
    button('Highlight color').click();
    await fixture.whenStable();
    keydown(el.querySelector('star-editor-color')!, { key: 'Escape' });
    await fixture.whenStable();
    expect(el.querySelector('star-editor-color')).toBeNull();
    expect(document.getSelection()!.toString()).toBe('New');
  });

  it('sets a font size step with the select and shows the step at the caret', async () => {
    const { el, area, host, fixture } = await setup();
    select(area.querySelector('p')!, 0, 3);
    const size = el.querySelector<HTMLSelectElement>('select[aria-label="Font size"]')!;
    expect([...size.options].map((o) => o.textContent!.trim())).toEqual([
      'Small',
      'Normal',
      'Large',
      'Larger',
      'Largest',
    ]);
    size.value = 'larger';
    size.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.html()).toBe(
      '<p><span style="font-size: 1.5em">New</span> release ships today</p>',
    );
    expect(size.value).toBe('larger');
  });

  it('toggles subscript and superscript', async () => {
    const { area, button, host, fixture } = await setup('<p>H2O and x2</p>');
    select(area.querySelector('p')!, 1, 2);
    button('Subscript').click();
    expect(host.html()).toBe('<p>H<sub>2</sub>O and x2</p>');
    await fixture.whenStable();
    expect(button('Subscript').getAttribute('aria-pressed')).toBe('true');
  });

  it('makes lists, nests them with Tab and Shift+Tab, and checks checklist items', async () => {
    const { area, button, host, fixture } = await setup('<p>Plan</p><p>Build</p>');
    const [plan, build] = area.querySelectorAll('p');
    const range = document.createRange();
    range.setStart(plan.firstChild!, 0);
    range.setEnd(build.firstChild!, 5);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    button('Checklist').click();
    expect(host.html()).toBe(
      '<ul class="star-checklist"><li data-checked="false">Plan</li><li data-checked="false">Build</li></ul>',
    );
    select(area.querySelectorAll('li')[1], 0, 0);
    const tab = keydown(area, { key: 'Tab' });
    expect(tab.defaultPrevented).toBe(true);
    expect(host.html()).toBe(
      '<ul class="star-checklist"><li data-checked="false">Plan<ul class="star-checklist"><li data-checked="false">Build</li></ul></li></ul>',
    );
    // The first item cannot move: Tab leaves the area as usual.
    select(area.querySelector('li')!, 0, 0);
    expect(keydown(area, { key: 'Tab' }).defaultPrevented).toBe(false);
    select(area.querySelectorAll('li')[1], 0, 0);
    expect(keydown(area, { key: 'Tab', shiftKey: true }).defaultPrevented).toBe(true);
    keydown(area, { key: 'Enter', ctrlKey: true });
    expect(host.html()).toContain('<li data-checked="true">Build</li>');
    await fixture.whenStable();
    expect(button('Checklist').getAttribute('aria-pressed')).toBe('true');
    button('Numbered list').click();
    expect(host.html()).toContain('<ol>');
  });

  it('indents paragraphs, inserts a horizontal line, justifies and clears formatting', async () => {
    const { area, button, host } = await setup('<p><b>Bold</b> text</p>');
    select(area.querySelector('b')!, 0, 2);
    button('Increase indent').click();
    expect(host.html()).toBe('<p style="margin-inline-start: 2.5rem"><b>Bold</b> text</p>');
    button('Justify').click();
    expect(host.html()).toContain('class="star-text-justify"');
    select(area.querySelector('b')!, 0, 4);
    button('Clear formatting').click();
    expect(host.html()).toBe('<p>Bold text</p>');
    button('Horizontal line').click();
    expect(area.querySelector('hr')).toBeTruthy();
  });

  it('undoes and redoes every change with the toolbar and the keyboard', async () => {
    const { area, button, host, fixture } = await setup();
    select(area.querySelector('p')!, 0, 3);
    button('Subscript').click();
    await fixture.whenStable();
    expect(button('Undo').getAttribute('aria-disabled')).toBeNull();
    button('Undo').click();
    expect(host.html()).toBe('<p>New release ships today</p>');
    await fixture.whenStable();
    expect(button('Redo').getAttribute('aria-disabled')).toBeNull();
    keydown(area, { key: 'y', ctrlKey: true });
    expect(host.html()).toBe('<p><sub>New</sub> release ships today</p>');
    keydown(area, { key: 'z', ctrlKey: true });
    expect(host.html()).toBe('<p>New release ships today</p>');
    const menu = new InputEvent('beforeinput', { inputType: 'historyRedo', cancelable: true });
    area.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    expect(host.html()).toBe('<p><sub>New</sub> release ships today</p>');
  });

  it('merges typing in a row into one undo step', async () => {
    const { area, host } = await setup('<p>A</p>');
    const type = (text: string) => {
      area.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text }));
      area.querySelector('p')!.firstChild!.textContent += text;
      area.dispatchEvent(new Event('input'));
    };
    type('b');
    type('c');
    expect(host.html()).toBe('<p>Abc</p>');
    keydown(area, { key: 'z', ctrlKey: true });
    expect(host.html()).toBe('<p>A</p>');
  });
});

describe('StarEditor toolbar overflow', () => {
  it('puts the groups that do not fit into the More actions panel', async () => {
    let callback: (() => void) | null = null;
    const original = window.ResizeObserver;
    window.ResizeObserver = class {
      constructor(cb: () => void) {
        callback = cb;
      }
      observe() {
        // The test calls the callback itself.
      }
      disconnect() {
        // Nothing to stop.
      }
    } as unknown as typeof ResizeObserver;
    try {
      const { el, fixture } = await setup();
      const toolbar = el.querySelector<HTMLElement>('[role=toolbar]')!;
      expect(toolbar.classList).toContain('star-editor__toolbar--fit');
      for (const group of toolbar.querySelectorAll<HTMLElement>('[data-editor-group]'))
        Object.defineProperty(group, 'offsetWidth', { value: 100 });
      Object.defineProperty(toolbar, 'clientWidth', { value: 300, configurable: true });
      callback!();
      await fixture.whenStable();
      expect(toolbar.querySelectorAll('[data-editor-group]').length).toBe(2);
      const more = toolbar.querySelector<HTMLButtonElement>('[aria-label="More actions"]')!;
      expect(more.getAttribute('aria-expanded')).toBe('false');
      more.click();
      await fixture.whenStable();
      const overflow = toolbar.querySelector('.star-editor__overflow')!;
      expect(more.getAttribute('aria-controls')).toBe(overflow.id);
      expect(overflow.querySelector('[aria-label="Bold"]')).toBeTruthy();
      // The panel is part of the toolbar: the arrow keys reach its controls.
      more.focus();
      keydown(more, { key: 'ArrowRight' });
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Bold');
      keydown(document.activeElement!, { key: 'Escape' });
      await fixture.whenStable();
      expect(toolbar.querySelector('.star-editor__overflow')).toBeNull();
      expect(document.activeElement).toBe(more);
    } finally {
      window.ResizeObserver = original;
    }
  });
});
