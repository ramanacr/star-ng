import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEditor, StarEditorToolbarItem } from '@star-ng/ui/editor';

@Component({
  imports: [StarEditor],
  template: `<star-editor [(value)]="html" [toolbar]="toolbar" ariaLabel="Plans" />`,
})
class Host {
  readonly html = signal('<p>Plans</p>');
  readonly toolbar: readonly StarEditorToolbarItem[] = ['bold', '|', 'table'];
}

const TABLE =
  '<table class="star-editor-table"><thead><tr><th scope="col">Plan</th><th scope="col">Price</th></tr></thead><tbody><tr><td>Basic</td><td>10</td></tr></tbody></table>';

async function setup(html?: string) {
  const fixture = TestBed.createComponent(Host);
  if (html) fixture.componentInstance.html.set(html);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const area = el.querySelector<HTMLElement>('.star-editor__area')!;
  return { fixture, el, area, host: fixture.componentInstance };
}

function caretIn(node: Node): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(true);
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(range);
}

const keydown = (target: Element, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('StarEditor tables', () => {
  it('inserts a table with a header row from the insert panel', async () => {
    const { fixture, el, area, host } = await setup();
    caretIn(area.querySelector('p')!.firstChild!);
    el.querySelector<HTMLButtonElement>('[aria-label=Table]')!.click();
    await fixture.whenStable();
    const panel = el.querySelector('star-editor-table-insert')!;
    expect(panel.getAttribute('role')).toBe('group');
    const [rows, cols] = panel.querySelectorAll<HTMLInputElement>('input[type=number]');
    rows.value = '2';
    rows.dispatchEvent(new Event('input'));
    cols.value = '2';
    cols.dispatchEvent(new Event('input'));
    panel.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(host.html()).toBe(
      '<p>Plans</p><table class="star-editor-table"><thead><tr><th scope="col"><br></th><th scope="col"><br></th></tr></thead><tbody><tr><td><br></td><td><br></td></tr></tbody></table><p><br></p>',
    );
    expect(document.getSelection()!.anchorNode).toBe(area.querySelector('th'));
  });

  it('moves between cells with Tab and Shift+Tab, and leaves at the last cell', async () => {
    const { area } = await setup(TABLE);
    const cells = area.querySelectorAll('th, td');
    caretIn(cells[1].firstChild!);
    expect(keydown(area, { key: 'Tab' }).defaultPrevented).toBe(true);
    expect(document.getSelection()!.toString()).toBe('Basic');
    expect(keydown(area, { key: 'Tab', shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.getSelection()!.toString()).toBe('Price');
    caretIn(cells[3].firstChild!);
    expect(keydown(area, { key: 'Tab' }).defaultPrevented).toBe(false);
  });

  it('opens the table menu with Shift+F10 in a cell and runs its commands', async () => {
    const { fixture, area, host } = await setup(TABLE);
    caretIn(area.querySelector('td')!.firstChild!);
    keydown(area, { key: 'F10', shiftKey: true });
    await fixture.whenStable();
    const menu = document.querySelector('[role=menu]')!;
    expect(menu).toBeTruthy();
    const labels = [...menu.querySelectorAll('[role=menuitem]')].map((item) =>
      item.textContent!.trim(),
    );
    expect(labels).toEqual([
      'Insert row above',
      'Insert row below',
      'Insert column before',
      'Insert column after',
      'Merge with the next cell',
      'Merge with the cell below',
      'Split cell',
      'Header row',
      'Table properties',
      'Delete row',
      'Delete column',
      'Delete table',
    ]);
    [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')]
      .find((item) => item.textContent!.includes('Merge with the next cell'))!
      .click();
    await fixture.whenStable();
    expect(host.html()).toContain('<td colspan="2">Basic<br>10</td>');
  });

  it('resizes a column with Alt+Shift+arrow keys and sets the table look', async () => {
    const { fixture, el, area, host } = await setup(TABLE);
    caretIn(area.querySelector('td')!.firstChild!);
    keydown(area, { key: 'ArrowRight', altKey: true, shiftKey: true });
    // jsdom has no layout: the column starts at 120 pixels.
    expect(host.html()).toContain('<colgroup><col style="width: 130px"><col></colgroup>');
    el.querySelector<HTMLButtonElement>('[aria-label=Table]')!.click();
    await fixture.whenStable();
    const panel = el.querySelector('star-editor-table-properties')!;
    const [borders, align] = panel.querySelectorAll('select');
    borders.value = 'none';
    borders.dispatchEvent(new Event('change'));
    align.value = 'center';
    align.dispatchEvent(new Event('change'));
    panel.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(host.html()).toContain(
      'class="star-editor-table star-editor-table--borderless star-editor-table--center"',
    );
  });
});
