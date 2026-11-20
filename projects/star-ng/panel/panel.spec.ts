import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarHeaderTemplate, StarIconTemplate } from '@star-ng/ui/core';
import { StarPanel, StarPanelToggleEvent } from './panel';

@Component({
  imports: [StarPanel, StarHeaderTemplate, StarIconTemplate],
  template: `
    <star-panel
      header="Order notes"
      toggleable
      [(collapsed)]="collapsed"
      [toggler]="toggler()"
      [iconPos]="iconPos()"
      [showHeader]="showHeader()"
      (beforeToggle)="events.push(['before', $event])"
      (afterToggle)="events.push(['after', $event])"
    >
      Pack with care.
      @if (slots()) {
        <ng-template starHeader><b class="own-title">Notes</b></ng-template>
        <ng-template starIcon="toggle" let-open
          ><i class="own-icon">{{ open }}</i></ng-template
        >
      }
    </star-panel>
  `,
})
class Host {
  readonly collapsed = signal(false);
  readonly toggler = signal<'icon' | 'header'>('icon');
  readonly iconPos = signal<'start' | 'end'>('end');
  readonly showHeader = signal(true);
  readonly slots = signal(false);
  readonly events: [string, StarPanelToggleEvent][] = [];
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { el, host: fixture.componentInstance, stable: () => fixture.whenStable() };
}

describe('StarPanel depth', () => {
  it('emits beforeToggle with the old state and afterToggle with the new one', async () => {
    const t = await setup();
    t.el.querySelector<HTMLButtonElement>('.star-panel-box__toggle')!.click();
    await t.stable();
    expect(t.host.collapsed()).toBe(true);
    expect(t.host.events).toEqual([
      ['before', { collapsed: false }],
      ['after', { collapsed: true }],
    ]);
  });

  it('makes the title the toggle button with toggler="header"', async () => {
    const t = await setup((h) => h.toggler.set('header'));
    expect(t.el.querySelector('[data-star-part=toggleButton]')).toBeNull();
    const button = t.el.querySelector<HTMLButtonElement>('h3 button')!;
    expect(button.textContent!.trim()).toBe('Order notes');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.click();
    await t.stable();
    expect(t.host.collapsed()).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('puts the toggle at the start and can hide the header', async () => {
    const t = await setup((h) => h.iconPos.set('start'));
    expect(t.el.querySelector('star-panel')!.classList).toContain('star-panel-box--toggle-start');
    t.host.showHeader.set(false);
    await t.stable();
    expect(t.el.querySelector('header')).toBeNull();
    const region = t.el.querySelector('[role=region]')!;
    expect(region.getAttribute('aria-label')).toBe('Order notes');
    expect(region.getAttribute('aria-labelledby')).toBeNull();
  });

  it('renders the header and toggle icon slots', async () => {
    const t = await setup((h) => h.slots.set(true));
    expect(t.el.querySelector('h3 .own-title')!.textContent).toBe('Notes');
    const icon = t.el.querySelector('.own-icon')!;
    expect(icon.textContent).toBe('true');
    expect(icon.closest('[aria-hidden=true]')).not.toBeNull();
  });
});
