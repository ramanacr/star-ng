import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarUiText } from '@star-ng/ui/core';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';
import {
  StarEmptyState,
  StarEmptyStateHeadingLevel,
  StarEmptyStateSize,
  StarEmptyStateVariant,
} from './empty-state';

@Component({
  imports: [StarEmptyState],
  template: `
    <star-empty-state
      class="main"
      [variant]="variant()"
      [size]="size()"
      [icon]="icon()"
      [title]="title()"
      [description]="description()"
      [headingLevel]="level()"
      [status]="status()"
      [retryable]="retryable()"
      (retry)="retries = retries + 1"
    >
      <button starEmptyStateActions type="button" class="clear">Clear criteria</button>
    </star-empty-state>
    <star-empty-state class="image" title="No invoices">
      <img starEmptyStateImage src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" />
      <span class="extra">Invoices appear after the first order.</span>
    </star-empty-state>
  `,
})
class Host {
  readonly variant = signal<StarEmptyStateVariant>('empty');
  readonly size = signal<StarEmptyStateSize>('md');
  readonly icon = signal<string | null | undefined>(undefined);
  readonly title = signal('No orders found');
  readonly description = signal('No orders match the search criteria.');
  readonly level = signal<StarEmptyStateHeadingLevel>(3);
  readonly status = signal(false);
  readonly retryable = signal(false);
  retries = 0;
}

describe('StarEmptyState', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const main = el.querySelector<HTMLElement>('star-empty-state.main')!;
    return { fixture, host: fixture.componentInstance, el, main };
  }

  it('shows the icon tile, the title as an h3, the description and the actions', async () => {
    const { main } = await setup();
    expect(main.classList).toContain('star-empty-state--empty');
    expect(main.classList).toContain('star-empty-state--md');
    expect(main.querySelector('.star-empty-state__tile .ph-tray')).not.toBeNull();
    expect(main.querySelector('star-icon')?.getAttribute('aria-hidden')).toBe('true');
    const title = main.querySelector('.star-empty-state__title')!;
    expect(title.tagName).toBe('H3');
    expect(title.textContent?.trim()).toBe('No orders found');
    expect(main.querySelector('.star-empty-state__description')?.textContent?.trim()).toBe(
      'No orders match the search criteria.',
    );
    expect(main.querySelector('.star-empty-state__actions .clear')).not.toBeNull();
    // `title` is an input, not a tooltip of the whole area.
    expect(main.hasAttribute('title')).toBe(false);
    expect(main.hasAttribute('role')).toBe(false);
  });

  it('changes the default icon and the tone with the variant', async () => {
    const { fixture, host, main } = await setup();
    const cases: [StarEmptyStateVariant, string][] = [
      ['no-results', 'ph-magnifying-glass'],
      ['error', 'ph-warning-circle'],
      ['success', 'ph-check-circle'],
    ];
    for (const [variant, icon] of cases) {
      host.variant.set(variant);
      await fixture.whenStable();
      expect(main.classList).toContain(`star-empty-state--${variant}`);
      expect(main.querySelector(`.star-empty-state__tile .${icon}`), variant).not.toBeNull();
    }
  });

  it('takes a Phosphor name with or without the ph- prefix, and hides the icon for null', async () => {
    const { fixture, host, main } = await setup();
    host.icon.set('ph-package');
    await fixture.whenStable();
    expect(main.querySelector('.star-empty-state__tile .ph-package')).not.toBeNull();
    host.icon.set('bell');
    await fixture.whenStable();
    expect(main.querySelector('.star-empty-state__tile .ph-bell')).not.toBeNull();
    host.icon.set(null);
    await fixture.whenStable();
    expect(main.querySelector('.star-empty-state__tile')).toBeNull();
    host.icon.set('');
    await fixture.whenStable();
    expect(main.querySelector('.star-empty-state__tile')).toBeNull();
  });

  it('sets the size class', async () => {
    const { fixture, host, main } = await setup();
    for (const size of ['sm', 'lg'] as const) {
      host.size.set(size);
      await fixture.whenStable();
      expect(main.classList).toContain(`star-empty-state--${size}`);
    }
  });

  it('renders the heading level, or plain text for null', async () => {
    const { fixture, host, main } = await setup();
    for (const level of [1, 2, 4, 5, 6] as const) {
      host.level.set(level);
      await fixture.whenStable();
      expect(main.querySelector('.star-empty-state__title')?.tagName).toBe(`H${level}`);
    }
    host.level.set(null);
    await fixture.whenStable();
    expect(main.querySelector('.star-empty-state__title')?.tagName).toBe('P');
  });

  it('leaves out an empty title and description', async () => {
    const { fixture, host, main } = await setup();
    host.title.set('');
    host.description.set('');
    await fixture.whenStable();
    expect(main.querySelector('.star-empty-state__title')).toBeNull();
    expect(main.querySelector('.star-empty-state__description')).toBeNull();
  });

  it('is a status region with status', async () => {
    const { fixture, host, main } = await setup();
    host.status.set(true);
    await fixture.whenStable();
    expect(main.getAttribute('role')).toBe('status');
  });

  it('shows a retry button that emits retry', async () => {
    const { fixture, host, main } = await setup();
    expect(main.querySelector('.star-empty-state__actions button.star-btn')).toBeNull();
    host.variant.set('error');
    host.retryable.set(true);
    await fixture.whenStable();
    const retry = main.querySelector<HTMLButtonElement>('[data-star-part=retryButton]')!;
    expect(retry.type).toBe('button');
    expect(retry.textContent?.trim()).toBe('Retry');
    retry.click();
    expect(host.retries).toBe(1);
    // The projected actions come first.
    expect(retry.previousElementSibling?.classList).toContain('clear');
  });

  it('replaces the icon with the image slot and projects the default content', async () => {
    const { el } = await setup();
    const image = el.querySelector('star-empty-state.image')!;
    expect(image.querySelector('.star-empty-state__graphic > img')).not.toBeNull();
    expect(image.querySelector('.star-empty-state__tile')).toBeNull();
    expect(image.querySelector('.star-empty-state__content .extra')).not.toBeNull();
  });

  it('reads the retry text from STAR_UI_TEXT', async () => {
    TestBed.configureTestingModule({ providers: [provideStarUiText(STAR_UI_TEXT_DE)] });
    const { fixture, host, main } = await setup();
    host.retryable.set(true);
    await fixture.whenStable();
    expect(main.querySelector('[data-star-part=retryButton]')?.textContent?.trim()).toBe(
      'Erneut versuchen',
    );
  });
});
