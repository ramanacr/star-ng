import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarChip } from '@star-ng/ui/layout';
import { StarMegaMenu } from '@star-ng/ui/menu';
import { StarMessage } from '@star-ng/ui/message';
import { StarSplitter } from '@star-ng/ui/utility';

@Component({
  imports: [StarMegaMenu, StarMessage, StarSplitter, StarChip],
  template: `
    <span id="mega-label">Catalogue</span>
    <star-mega-menu ariaLabelledBy="mega-label" [items]="[{ label: 'Shop' }]" />
    <star-message size="sm">Small</star-message>
    <star-splitter disabled [(size)]="size">
      <div starSplitterStart>A</div>
      <div starSplitterEnd>B</div>
    </star-splitter>
    <star-chip label="Design" removable disabled (removed)="removed = true" />
  `,
})
class Host {
  readonly size = signal(50);
  removed = false;
}

describe('Small members of wave N2', () => {
  it('mega menu ariaLabelledBy, message size, splitter and chip disabled', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=menubar]')!.getAttribute('aria-labelledby')).toBe('mega-label');
    expect(el.querySelector('star-message')!.classList).toContain('star-message--sm');
    const gutter = el.querySelector<HTMLElement>('[role=separator]')!;
    expect(gutter.getAttribute('aria-disabled')).toBe('true');
    expect(gutter.getAttribute('tabindex')).toBe('-1');
    gutter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.size()).toBe(50);
    const chip = el.querySelector('star-chip')!;
    expect(chip.classList).toContain('star-chip--disabled');
    expect(chip.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
  });
});
