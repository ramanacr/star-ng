import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StarBreadcrumb } from '@star-ng/ui/breadcrumb';
import { StarProgressBar } from '@star-ng/ui/progress-bar';
import { StarStep, StarStepper } from '@star-ng/ui/stepper';

@Component({
  imports: [StarStepper, StarStep, StarProgressBar, StarBreadcrumb],
  template: `
    <star-stepper #stepper [(value)]="step" linear>
      <star-step value="one" label="One" [completed]="done()">1</star-step>
      <star-step value="two" label="Two">2</star-step>
    </star-stepper>
    <star-progress-bar [value]="140" ariaLabel="Upload" />
    <star-breadcrumb [items]="[{ label: 'Orders', routerLink: '/x' }, { label: 'ORD-1' }]" />
  `,
})
class MiscHost {
  readonly step = signal<string | null>(null);
  readonly done = signal(false);
}

describe('Stepper, progress, breadcrumb', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(MiscHost);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  }

  it('linear stepper locks later steps until earlier ones are completed', async () => {
    const { fixture, el, host } = await setup();
    const headers = [...el.querySelectorAll<HTMLButtonElement>('.star-stepper__header')];
    expect(headers[0].getAttribute('aria-current')).toBe('step');
    expect(headers[1].disabled).toBe(true);
    host.done.set(true);
    await fixture.whenStable();
    headers[1].click();
    await fixture.whenStable();
    expect(host.step()).toBe('two');
    expect(el.querySelectorAll<HTMLElement>('star-step')[0].hidden).toBe(true);
  });

  it('progress bar clamps and exposes aria values; breadcrumb marks the current page', async () => {
    const { el } = await setup();
    const bar = el.querySelector('star-progress-bar')!;
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(
      el.querySelector('nav[aria-label=Breadcrumb] [aria-current=page]')?.textContent,
    ).toContain('ORD-1');
  });
});
