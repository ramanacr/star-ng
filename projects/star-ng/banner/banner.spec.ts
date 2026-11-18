import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarUiText } from '@star-ng/ui/core';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';
import { StarBanner, StarBannerSeverity } from './banner';

@Component({
  imports: [StarBanner],
  template: `
    <star-banner
      [severity]="severity()"
      [icon]="icon()"
      [dismissible]="dismissible()"
      [(open)]="open"
      (dismissed)="dismissals = dismissals + 1"
    >
      The export service is slow today.
      <button starBannerActions type="button" class="details">Details</button>
    </star-banner>
  `,
})
class Host {
  readonly severity = signal<StarBannerSeverity>('info');
  readonly icon = signal<string | null | undefined>(undefined);
  readonly dismissible = signal(true);
  readonly open = signal(true);
  dismissals = 0;
}

describe('StarBanner', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const banner = el.querySelector<HTMLElement>('star-banner')!;
    return { fixture, host: fixture.componentInstance, banner };
  }

  it('is a status region with the message, the severity icon and the actions', async () => {
    const { banner } = await setup();
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.classList).toContain('star-banner--info');
    expect(banner.querySelector('.star-banner__text')?.textContent?.trim()).toBe(
      'The export service is slow today.',
    );
    const icon = banner.querySelector('.star-banner__icon')!;
    expect(icon.className).toContain('ph-info');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(banner.querySelector('.star-banner__actions .details')).not.toBeNull();
  });

  it('is an alert for danger and changes the default icon with the severity', async () => {
    const { fixture, host, banner } = await setup();
    host.severity.set('danger');
    await fixture.whenStable();
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.classList).toContain('star-banner--danger');
    expect(banner.querySelector('.star-banner__icon')!.className).toContain('ph-warning-circle');
    host.severity.set('success');
    await fixture.whenStable();
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.querySelector('.star-banner__icon')!.className).toContain('ph-check-circle');
  });

  it('takes a custom icon, or none', async () => {
    const { fixture, host, banner } = await setup();
    host.icon.set('ph-fill ph-cloud-warning');
    await fixture.whenStable();
    expect(banner.querySelector('.star-banner__icon')!.className).toContain('ph-cloud-warning');
    host.icon.set('');
    await fixture.whenStable();
    expect(banner.querySelector('.star-banner__icon')).toBeNull();
    host.icon.set(null);
    await fixture.whenStable();
    expect(banner.querySelector('.star-banner__icon')).toBeNull();
  });

  it('the dismiss button hides the banner, updates open and emits dismissed', async () => {
    const { fixture, host, banner } = await setup();
    const dismiss = banner.querySelector<HTMLButtonElement>('.star-banner__dismiss')!;
    expect(dismiss.getAttribute('aria-label')).toBe('Dismiss');
    dismiss.click();
    await fixture.whenStable();
    expect(host.open()).toBe(false);
    expect(host.dismissals).toBe(1);
    expect(banner.hidden).toBe(true);
    expect(banner.querySelector('.star-banner__inner')).toBeNull();
    // The live region stays in the page, so showing the banner again is announced.
    expect(banner.getAttribute('role')).toBe('status');
  });

  it('opens again from the model', async () => {
    const { fixture, host, banner } = await setup();
    host.open.set(false);
    await fixture.whenStable();
    expect(banner.hidden).toBe(true);
    expect(host.dismissals).toBe(0);
    host.open.set(true);
    await fixture.whenStable();
    expect(banner.hidden).toBe(false);
    expect(banner.querySelector('.star-banner__text')).not.toBeNull();
  });

  it('has no dismiss button unless dismissible', async () => {
    const { fixture, host, banner } = await setup();
    host.dismissible.set(false);
    await fixture.whenStable();
    expect(banner.querySelector('.star-banner__dismiss')).toBeNull();
  });

  it('labels the dismiss button from STAR_UI_TEXT', async () => {
    TestBed.configureTestingModule({ providers: [provideStarUiText(STAR_UI_TEXT_DE)] });
    const { banner } = await setup();
    expect(banner.querySelector('.star-banner__dismiss')!.getAttribute('aria-label')).toBe(
      'Ausblenden',
    );
  });
});
