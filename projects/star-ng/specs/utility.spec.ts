import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarBlockUi, StarMeterGroup, StarSpeedDial, StarSplitter } from 'star-ng/utility';

function key(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

@Component({
  imports: [StarSplitter, StarSpeedDial, StarBlockUi, StarMeterGroup],
  template: `
    <star-splitter [(size)]="split"
      ><div starSplitterStart>A</div>
      <div starSplitterEnd>B</div></star-splitter
    >
    <star-speed-dial [items]="[{ label: 'New', icon: 'ph-bold ph-plus' }]" />
    <star-block-ui [blocked]="blocked()"><button id="inside">Save</button></star-block-ui>
    <star-meter-group
      [items]="[
        { label: 'A', value: 30 },
        { label: 'B', value: 20 },
      ]"
      [max]="100"
      unit="GB"
    />
  `,
})
class Host {
  readonly split = signal(50);
  readonly blocked = signal(false);
}

describe('splitter, speed dial, block UI, meter group', () => {
  it('splitter gutter resizes with arrow keys within limits', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const gutter = (fixture.nativeElement as HTMLElement).querySelector('[role=separator]')!;
    key(gutter, 'ArrowRight');
    expect(fixture.componentInstance.split()).toBe(52);
    key(gutter, 'Home');
    expect(fixture.componentInstance.split()).toBe(15);
  });

  it('speed dial toggles aria-expanded; block UI makes content inert; meter group renders', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const fab = el.querySelector<HTMLButtonElement>('.star-speed-dial__fab')!;
    fab.click();
    await fixture.whenStable();
    expect(fab.getAttribute('aria-expanded')).toBe('true');
    key(fab, 'Escape');
    await fixture.whenStable();
    expect(fab.getAttribute('aria-expanded')).toBe('false');

    fixture.componentInstance.blocked.set(true);
    await fixture.whenStable();
    expect(el.querySelector('.star-block-ui__content')?.hasAttribute('inert')).toBe(true);
    expect(el.querySelector('star-block-ui')?.getAttribute('aria-busy')).toBe('true');

    const parts = el.querySelectorAll('[role=meter]');
    expect(parts[0].getAttribute('aria-valuetext')).toBe('30 GB of 100');
  });
});
