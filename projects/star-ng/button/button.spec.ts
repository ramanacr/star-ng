import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarIconTemplate, StarSeverity } from '@star-ng/ui/core';
import { StarButton, StarButtonAppearance, StarButtonVariant } from './button';

@Component({
  imports: [StarButton, StarIconTemplate],
  template: `
    <star-button
      [label]="label()"
      [iconOnly]="iconOnly()"
      leadingIcon="ph-bold ph-plus"
      [loading]="loading()"
      [loadingIcon]="loadingIcon()"
      [appearance]="appearance()"
      [variant]="variant()"
      [raised]="raised()"
      [rounded]="rounded()"
      [badge]="badge()"
      [badgeSeverity]="severity()"
      [tabindex]="tabindex()"
      [autofocus]="autofocus()"
      (focusin)="events.push('focus')"
      (focusout)="events.push('blur')"
      >{{ content() }}
      @if (slots()) {
        <ng-template starIcon="icon"><b class="own-icon">+</b></ng-template>
        <ng-template starIcon="loading"><b class="own-loading">…</b></ng-template>
      }
    </star-button>
  `,
})
class Host {
  readonly label = signal<string | null>(null);
  readonly content = signal('Add');
  readonly iconOnly = signal(false);
  readonly loading = signal(false);
  readonly loadingIcon = signal<string | null>(null);
  readonly appearance = signal<StarButtonAppearance>('filled');
  readonly variant = signal<StarButtonVariant>('primary');
  readonly raised = signal(false);
  readonly rounded = signal(false);
  readonly badge = signal<string | number | null>(null);
  readonly severity = signal<StarSeverity>('danger');
  readonly tabindex = signal<number | null>(null);
  readonly autofocus = signal(false);
  readonly slots = signal(false);
  readonly events: string[] = [];
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    el,
    host: fixture.componentInstance,
    button: el.querySelector('button')!,
    stable: () => fixture.whenStable(),
  };
}

describe('StarButton depth', () => {
  afterEach(() => (document.activeElement as HTMLElement | null)?.blur());

  it('shows the label before the content, and names an icon-only button with it', async () => {
    const t = await setup((h) => {
      h.label.set('New ');
      h.content.set('order');
    });
    expect(t.button.textContent!.trim()).toBe('New order');
    t.host.iconOnly.set(true);
    t.host.label.set('New order');
    await t.stable();
    expect(t.button.getAttribute('aria-label')).toBe('New order');
  });

  it('sets the appearance, raised and rounded classes', async () => {
    const t = await setup((h) => {
      h.appearance.set('outlined');
      h.raised.set(true);
      h.rounded.set(true);
    });
    expect(t.button.className).toContain('star-btn--outlined');
    expect(t.button.className).toContain('star-btn--raised');
    expect(t.button.className).toContain('star-btn--rounded');
    t.host.appearance.set('link');
    await t.stable();
    expect(t.button.className).toContain('star-btn--link');
    expect(t.button.className).not.toContain('star-btn--outlined');
    t.host.appearance.set('filled');
    await t.stable();
    expect(t.button.className).not.toMatch(/--(link|text|outlined|filled)/);
  });

  it('has the info, help and contrast variants', async () => {
    const t = await setup();
    for (const variant of ['info', 'help', 'contrast'] as const) {
      t.host.variant.set(variant);
      await t.stable();
      expect(t.button.className).toContain(`star-btn--${variant}`);
    }
  });

  it('shows a badge with its severity', async () => {
    const t = await setup((h) => {
      h.badge.set(3);
      h.severity.set('info');
    });
    const badge = t.button.querySelector('.star-badge')!;
    expect(badge.textContent).toBe('3');
    expect(badge.classList).toContain('star-badge--info');
    t.host.badge.set(null);
    await t.stable();
    expect(t.button.querySelector('.star-badge')).toBeNull();
  });

  it('uses the loading icon classes', async () => {
    const t = await setup((h) => {
      h.loading.set(true);
      h.loadingIcon.set('ph-bold ph-circle-notch star-spin');
    });
    expect(t.button.querySelector('[data-star-part=loadingIcon]')!.className).toBe(
      'ph-bold ph-circle-notch star-spin',
    );
  });

  it('sets tabindex, autofocuses, and the host gets focusin and focusout', async () => {
    const t = await setup((h) => {
      h.tabindex.set(-1);
      h.autofocus.set(true);
    });
    expect(t.button.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(t.button);
    t.button.blur();
    expect(t.host.events).toEqual(['focus', 'blur']);
  });

  it('renders the icon and loading slots', async () => {
    const t = await setup((h) => h.slots.set(true));
    expect(t.button.querySelector('.own-icon')!.closest('[aria-hidden=true]')).not.toBeNull();
    t.host.loading.set(true);
    await t.stable();
    expect(t.button.querySelector('.own-loading')).not.toBeNull();
    expect(t.button.querySelector('.own-icon')).toBeNull();
  });
});
