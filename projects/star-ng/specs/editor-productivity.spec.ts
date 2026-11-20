import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEditor, StarEditorToolbarItem } from '@star-ng/ui/editor';

@Component({
  imports: [StarEditor],
  template: `
    <star-editor
      [(value)]="html"
      [toolbar]="toolbar"
      [maxLength]="max()"
      showCount
      markdownShortcuts
      ariaLabel="Announcement"
    />
  `,
})
class Host {
  readonly html = signal('<p>The new plan and the old plan</p><p>Plan details</p>');
  readonly toolbar: readonly StarEditorToolbarItem[] = [
    'bold',
    '|',
    'find',
    'fullScreen',
    'shortcuts',
  ];
  readonly max = signal<number | undefined>(undefined);
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const area = el.querySelector<HTMLElement>('.star-editor__area')!;
  const button = (name: string) => el.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
  return { fixture, el, area, button, host: fixture.componentInstance };
}

const keydown = (target: Element, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('StarEditor find and replace', () => {
  it('opens with Ctrl+F, counts and moves between matches, and closes with Escape', async () => {
    const { fixture, el, area } = await setup();
    area.focus();
    expect(keydown(area, { key: 'f', ctrlKey: true }).defaultPrevented).toBe(true);
    await fixture.whenStable();
    const panel = el.querySelector('[role=search]')!;
    expect(panel.getAttribute('aria-label')).toBe('Find');
    const field = panel.querySelector<HTMLInputElement>('input[type=search]')!;
    expect(document.activeElement).toBe(field);
    field.value = 'plan';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const status = panel.querySelector('[role=status]')!;
    expect(status.textContent!.trim()).toBe('1 of 3');
    keydown(field, { key: 'Enter' });
    await fixture.whenStable();
    expect(status.textContent!.trim()).toBe('2 of 3');
    keydown(field, { key: 'Enter', shiftKey: true });
    keydown(field, { key: 'Enter', shiftKey: true });
    await fixture.whenStable();
    expect(status.textContent!.trim()).toBe('3 of 3');
    panel.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[0].click();
    await fixture.whenStable();
    expect(status.textContent!.trim()).toBe('1 of 2');
    field.value = 'nothing';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(status.textContent!.trim()).toBe('No results');
    keydown(field, { key: 'Escape' });
    await fixture.whenStable();
    expect(el.querySelector('[role=search]')).toBeNull();
    expect(document.activeElement).toBe(area);
  });

  it('replaces one match and all matches with Ctrl+H', async () => {
    const { fixture, el, area, host } = await setup();
    keydown(area, { key: 'h', ctrlKey: true });
    await fixture.whenStable();
    const panel = el.querySelector('[role=search]')!;
    expect(panel.getAttribute('aria-label')).toBe('Find and replace');
    const [find, replace] = panel.querySelectorAll<HTMLInputElement>('input:not([type=checkbox])');
    find.value = 'plan';
    find.dispatchEvent(new Event('input'));
    replace.value = 'tier';
    replace.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const action = (name: string) =>
      [...panel.querySelectorAll('button')].find((b) => b.textContent!.trim() === name)!;
    action('Replace').click();
    expect(host.html()).toBe('<p>The new tier and the old plan</p><p>Plan details</p>');
    action('Replace all').click();
    await fixture.whenStable();
    expect(host.html()).toBe('<p>The new tier and the old tier</p><p>tier details</p>');
    expect(panel.querySelector('[role=status]')!.textContent!.trim()).toBe('2 matches replaced');
  });
});

describe('StarEditor counts, full screen, shortcuts and input rules', () => {
  it('shows words and characters next to the limit counter', async () => {
    const { fixture, el, host } = await setup();
    host.max.set(100);
    await fixture.whenStable();
    expect(el.querySelector('.star-editor__count')!.textContent!.trim()).toBe(
      '9 words, 41 characters',
    );
    expect(el.querySelector('.star-editor__counter')!.textContent!.trim()).toBe(
      '41 of 100 characters',
    );
  });

  it('toggles full screen and leaves it with Escape', async () => {
    const { fixture, el, area, button } = await setup();
    button('Full screen').click();
    await fixture.whenStable();
    expect(el.querySelector('star-editor')!.classList).toContain('star-editor--full-screen');
    expect(button('Full screen').getAttribute('aria-pressed')).toBe('true');
    keydown(area, { key: 'Escape' });
    await fixture.whenStable();
    expect(el.querySelector('star-editor')!.classList).not.toContain('star-editor--full-screen');
  });

  it('opens the keyboard shortcut help as a dialog', async () => {
    const { fixture, el, button } = await setup();
    button('Keyboard shortcuts').click();
    await fixture.whenStable();
    const dialog = el.querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe(
      'Keyboard shortcuts',
    );
    expect(dialog.querySelectorAll('tbody tr').length).toBe(16);
    dialog.querySelector<HTMLButtonElement>('button')!.click();
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('turns "# " at the start of a paragraph into a heading', async () => {
    const { area, host } = await setup();
    const p = area.querySelectorAll('p')[1];
    p.firstChild!.textContent = '# Plan details';
    const range = document.createRange();
    range.setStart(p.firstChild!, 2);
    range.collapse(true);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    area.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: ' ' }));
    area.dispatchEvent(new Event('input'));
    expect(host.html()).toBe('<p>The new plan and the old plan</p><h1>Plan details</h1>');
  });
});
