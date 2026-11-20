import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarMenuItem, StarSplitButton } from './menu';

@Component({
  imports: [StarSplitButton, StarIconTemplate],
  template: `
    <star-split-button
      label="Send"
      icon="ph-bold ph-paper-plane"
      [items]="items"
      [iconPos]="iconPos()"
      [appearance]="appearance()"
      [raised]="raised()"
      [rounded]="rounded()"
      [buttonDisabled]="buttonDisabled()"
      [menuButtonDisabled]="menuDisabled()"
      [dropdownIcon]="dropdownIcon()"
      [expandAriaLabel]="expandLabel()"
      [tabindex]="tabindex()"
      (pressed)="events.push('pressed')"
      (dropdownClick)="events.push('dropdown')"
      (menuShow)="events.push('show')"
      (menuHide)="events.push('hide')"
      ><em class="extra">now</em>
      @if (slots()) {
        <ng-template starIcon="dropdown"><b class="own-caret">v</b></ng-template>
      }
    </star-split-button>
  `,
})
class Host {
  readonly items: readonly StarMenuItem[] = [{ label: 'Send later' }, { label: 'Save draft' }];
  readonly iconPos = signal<'start' | 'end'>('start');
  readonly appearance = signal<'filled' | 'outlined'>('filled');
  readonly raised = signal(false);
  readonly rounded = signal(false);
  readonly buttonDisabled = signal(false);
  readonly menuDisabled = signal(false);
  readonly dropdownIcon = signal('ph-bold ph-caret-down');
  readonly expandLabel = signal<string | null>(null);
  readonly tabindex = signal<number | null>(null);
  readonly slots = signal(false);
  readonly events: string[] = [];
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const [main, toggle] = [
    ...el.querySelectorAll<HTMLButtonElement>('star-split-button > * button, .star-split__toggle'),
  ];
  return {
    fixture,
    el,
    host: fixture.componentInstance,
    main,
    toggle,
    stable: () => fixture.whenStable(),
  };
}

describe('StarSplitButton depth', () => {
  it('projects content after the label and puts the icon at the end with iconPos', async () => {
    const t = await setup((h) => h.iconPos.set('end'));
    expect(t.main.textContent!.replace(/\s+/g, ' ').trim()).toBe('Send now');
    expect(t.main.querySelector('[data-star-part=trailingIcon]')).not.toBeNull();
    expect(t.main.querySelector('[data-star-part=leadingIcon]')).toBeNull();
  });

  it('disables each part on its own', async () => {
    const t = await setup((h) => h.buttonDisabled.set(true));
    expect(t.main.disabled).toBe(true);
    expect(t.toggle.disabled).toBe(false);
    t.host.buttonDisabled.set(false);
    t.host.menuDisabled.set(true);
    await t.stable();
    expect(t.main.disabled).toBe(false);
    expect(t.toggle.disabled).toBe(true);
  });

  it('passes appearance, raised and rounded to both buttons', async () => {
    const t = await setup((h) => {
      h.appearance.set('outlined');
      h.raised.set(true);
      h.rounded.set(true);
    });
    for (const button of [t.main, t.toggle]) {
      expect(button.className).toContain('star-btn--outlined');
      expect(button.className).toContain('star-btn--raised');
      expect(button.className).toContain('star-btn--rounded');
    }
  });

  it('names the menu button, sets its icon and tabindex, and emits the menu events', async () => {
    const t = await setup((h) => {
      h.expandLabel.set('More send options');
      h.dropdownIcon.set('ph-bold ph-dots-three');
      h.tabindex.set(-1);
    });
    expect(t.toggle.getAttribute('aria-label')).toBe('More send options');
    expect(t.toggle.querySelector('i')!.className).toBe('ph-bold ph-dots-three');
    expect(t.toggle.getAttribute('tabindex')).toBe('-1');
    expect(t.main.getAttribute('tabindex')).toBe('-1');
    t.toggle.click();
    await t.stable();
    expect([...t.host.events].sort()).toEqual(['dropdown', 'show']);
    t.toggle.click();
    await t.stable();
    expect([...t.host.events].sort()).toEqual(['dropdown', 'dropdown', 'hide', 'show']);
    t.main.click();
    expect(t.host.events.at(-1)).toBe('pressed');
  });

  it('renders the dropdown icon slot', async () => {
    const t = await setup((h) => h.slots.set(true));
    expect(t.toggle.querySelector('.own-caret')!.closest('[aria-hidden=true]')).not.toBeNull();
  });
});
