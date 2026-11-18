import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarButton, StarButtonGroup } from '@star-ng/ui/button';

@Component({
  imports: [StarButton, StarButtonGroup],
  template: `
    <star-button-group [ariaLabel]="label()">
      <star-button variant="secondary">Day</star-button>
      <star-button variant="secondary">Week</star-button>
      <star-button variant="secondary">Month</star-button>
    </star-button-group>
  `,
})
class GroupHost {
  readonly label = signal<string | null>('Calendar range');
}

describe('StarButtonGroup', () => {
  it('is a named group that keeps every button in the tab order', async () => {
    const fixture = TestBed.createComponent(GroupHost);
    await fixture.whenStable();
    const group = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'star-button-group',
    )!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Calendar range');
    expect(group.classList).toContain('star-button-group');
    const buttons = [...group.querySelectorAll('button')];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Day', 'Week', 'Month']);
    // Not a selection control: no pressed or selected state, no roving tabindex.
    for (const button of buttons) {
      expect(button.getAttribute('tabindex')).toBeNull();
      expect(button.getAttribute('aria-pressed')).toBeNull();
    }

    fixture.componentInstance.label.set(null);
    await fixture.whenStable();
    expect(group.hasAttribute('aria-label')).toBe(false);
  });
});
