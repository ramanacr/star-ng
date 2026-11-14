import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarChip, StarDivider, StarTimeline, StarToolbar } from 'star-ng/layout';

function key(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

@Component({
  imports: [StarToolbar, StarDivider, StarTimeline, StarChip],
  template: `
    <star-toolbar ariaLabel="Actions">
      <ng-container starToolbarStart
        ><button id="t1">One</button><button id="t2">Two</button></ng-container
      >
    </star-toolbar>
    <star-divider>or</star-divider>
    <star-timeline [events]="[{ title: 'Received' }, { title: 'Shipped', severity: 'success' }]" />
    <star-chip label="Tag" removable (removed)="removed = true" />
  `,
})
class LayoutHost {
  removed = false;
}

describe('Toolbar, divider, timeline, chip', () => {
  it('toolbar moves focus with arrows; divider, timeline and chip render', async () => {
    const fixture = TestBed.createComponent(LayoutHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('star-toolbar')?.getAttribute('role')).toBe('toolbar');
    const one = document.getElementById('t1')!;
    one.focus();
    key(one, 'ArrowRight');
    expect(document.activeElement?.id).toBe('t2');
    expect(el.querySelector('star-divider')?.getAttribute('role')).toBe('separator');
    expect(el.querySelectorAll('.star-timeline__event').length).toBe(2);
    el.querySelector<HTMLButtonElement>('star-chip button')!.click();
    expect(fixture.componentInstance.removed).toBe(true);
  });
});
