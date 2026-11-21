import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEditor, StarEditorSelectionChange, StarEditorTextChange } from '@star-ng/ui/editor';

@Component({
  imports: [StarEditor],
  template: `
    <star-editor
      [(value)]="html"
      [format]="format()"
      ariaLabel="Note"
      (textChange)="texts.push($event)"
      (selectionChange)="selections.push($event)"
    />
  `,
})
class EventsHost {
  readonly html = signal('<p>Ship the order</p>');
  readonly format = signal<'html' | 'text'>('html');
  readonly texts: StarEditorTextChange[] = [];
  readonly selections: (StarEditorSelectionChange | null)[] = [];
}

async function setup() {
  const fixture = TestBed.createComponent(EventsHost);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const area = el.querySelector<HTMLElement>('.star-editor__area')!;
  return { fixture, area, host: fixture.componentInstance };
}

function select(node: Node, start: number, end: number): void {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

describe('StarEditor textChange and selectionChange', () => {
  afterEach(() => document.getSelection()?.removeAllRanges());

  it('emits textChange with the HTML and the plain text when the user edits', async () => {
    const { area, host, fixture } = await setup();
    area.querySelector('p')!.textContent = 'Ship the order today';
    area.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.texts).toEqual([
      { html: '<p>Ship the order today</p>', text: 'Ship the order today' },
    ]);
  });

  it('does not emit textChange for a value from the owner or for an input without a change', async () => {
    const { area, host, fixture } = await setup();
    host.html.set('<p>Invoice 12</p>');
    await fixture.whenStable();
    expect(host.texts).toEqual([]);
    area.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.texts).toEqual([]);
  });

  it('gives the text value as both fields with format="text"', async () => {
    const { area, host, fixture } = await setup();
    host.format.set('text');
    host.html.set('Line one');
    await fixture.whenStable();
    area.querySelector('p')!.textContent = 'Line two';
    area.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.texts.at(-1)).toEqual({ html: '<p>Line two</p>', text: 'Line two' });
  });

  it('emits selectionChange with the text offset and length, and null when it leaves', async () => {
    const { area, host, fixture } = await setup();
    const text = area.querySelector('p')!.firstChild!;
    select(text, 5, 8);
    await fixture.whenStable();
    expect(host.selections).toEqual([{ index: 5, length: 3, text: 'the' }]);
    // The same range again: no new event.
    select(text, 5, 8);
    expect(host.selections.length).toBe(1);
    select(text, 2, 2);
    expect(host.selections.at(-1)).toEqual({ index: 2, length: 0, text: '' });
    const outside = document.createElement('p');
    outside.textContent = 'elsewhere';
    document.body.appendChild(outside);
    select(outside.firstChild!, 0, 4);
    expect(host.selections.at(-1)).toBeNull();
    // Still outside: no second null.
    select(outside.firstChild!, 1, 4);
    expect(host.selections.filter((s) => s === null).length).toBe(1);
    outside.remove();
  });
});
