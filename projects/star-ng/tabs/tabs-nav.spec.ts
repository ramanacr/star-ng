import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { StarTabLink, StarTabNav, StarTabNavPanel } from './tab-nav';
import { StarTab, StarTabs } from './tabs';

@Component({ template: 'page' })
class Page {}

@Component({
  imports: [StarTabNav, StarTabLink, StarTabNavPanel, RouterLink, RouterLinkActive],
  template: `
    <star-tab-nav ariaLabel="Order pages" [tabPanel]="withPanel() ? panel : null">
      <a starTabLink routerLink="/details" routerLinkActive>Details</a>
      <a starTabLink routerLink="/history" routerLinkActive>History</a>
      <a starTabLink routerLink="/files" routerLinkActive disabled>Files</a>
    </star-tab-nav>
    <star-tab-nav-panel #panel>Content</star-tab-nav-panel>
  `,
})
class NavHost {
  readonly withPanel = signal(true);
}

async function setup(change?: (host: NavHost) => void) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'details', component: Page },
        { path: 'history', component: Page },
        { path: 'files', component: Page },
      ]),
    ],
  });
  const fixture = TestBed.createComponent(NavHost);
  change?.(fixture.componentInstance);
  await TestBed.inject(Router).navigateByUrl('/history');
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const links = [...el.querySelectorAll<HTMLAnchorElement>('a[starTabLink]')];
  return { fixture, el, links };
}

describe('StarTabNav', () => {
  it('follows the tabs pattern with a panel: tablist, tabs, selection from the router', async () => {
    const { el, links, fixture } = await setup();
    const list = el.querySelector('[role=tablist]')!;
    expect(list.getAttribute('aria-label')).toBe('Order pages');
    expect(links.map((l) => l.getAttribute('role'))).toEqual(['tab', 'tab', 'tab']);
    expect(links.map((l) => l.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(links.map((l) => l.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(links[2].getAttribute('aria-disabled')).toBe('true');
    const panel = el.querySelector('star-tab-nav-panel')!;
    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(links[1].getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(links[1].id);
    await TestBed.inject(Router).navigateByUrl('/details');
    await fixture.whenStable();
    expect(links[0].getAttribute('aria-selected')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe(links[0].id);
  });

  it('moves the focus with the arrow keys, Home and End, and skips a disabled link', async () => {
    const { links } = await setup();
    links[1].focus();
    links[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(links[0]);
    links[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(links[1]);
    links[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(links[0]);
  });

  it('is a navigation with aria-current links without a panel', async () => {
    const { el, links } = await setup((h) => h.withPanel.set(false));
    expect(el.querySelector('[role=tablist]')).toBeNull();
    expect(el.querySelector('[role=navigation]')!.getAttribute('aria-label')).toBe('Order pages');
    expect(links.map((l) => l.getAttribute('role'))).toEqual([null, null, null]);
    expect(links[1].getAttribute('aria-current')).toBe('page');
    expect(links[0].hasAttribute('tabindex')).toBe(false);
  });
});

// RouterLink first: its click handler is set up before the one of the tab link.
@Component({
  imports: [RouterLink, RouterLinkActive, StarTabNav, StarTabLink, StarTabNavPanel],
  template: `
    <star-tab-nav ariaLabel="Pages" [tabPanel]="panel">
      <a starTabLink routerLink="/details" routerLinkActive>Details</a>
      <a starTabLink routerLink="/files" routerLinkActive disabled>Files</a>
    </star-tab-nav>
    <star-tab-nav-panel #panel>Content</star-tab-nav-panel>
  `,
})
class DisabledHost {}

describe('StarTabLink disabled', () => {
  it('does not navigate on a click or Enter, and says so with aria-disabled', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'details', component: Page },
          { path: 'files', component: Page },
        ]),
      ],
    });
    const fixture = TestBed.createComponent(DisabledHost);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/details');
    await fixture.whenStable();
    const files = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
      'a[starTabLink]',
    )[1];
    expect(files.getAttribute('aria-disabled')).toBe('true');
    files.click();
    await fixture.whenStable();
    expect(router.url).toBe('/details');
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    files.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    await fixture.whenStable();
    expect(router.url).toBe('/details');
  });
});

@Component({
  imports: [StarTabs, StarTab],
  template: `
    <star-tabs [(value)]="tab" dynamicHeight animationDuration="200ms">
      <star-tab value="a" label="A"><div style="height: 40px">A</div></star-tab>
      <star-tab value="b" label="B"><div style="height: 80px">B</div></star-tab>
    </star-tabs>
  `,
})
class TabsHost {
  readonly tab = signal('a');
}

describe('StarTabs dynamicHeight and animationDuration', () => {
  it('animates the panel height and fades the panel in, unless motion is reduced', async () => {
    const calls: { keyframes: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
    const original = (Element.prototype as { animate?: unknown }).animate;
    Element.prototype.animate = function (
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions,
    ) {
      calls.push({ keyframes, options });
      return { cancel: () => undefined, finished: Promise.resolve() } as unknown as Animation;
    } as typeof Element.prototype.animate;
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    document.documentElement.removeAttribute('data-star-motion');
    try {
      const fixture = TestBed.createComponent(TabsHost);
      await fixture.whenStable();
      const host = fixture.nativeElement.querySelector('star-tabs') as HTMLElement;
      expect(host.style.getPropertyValue('--star-tabs-duration')).toBe('200ms');
      fixture.componentInstance.tab.set('b');
      await fixture.whenStable();
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((c) => c.options.duration === 200)).toBe(true);
      expect(calls.some((c) => 'opacity' in c.keyframes[0])).toBe(true);
    } finally {
      window.matchMedia = matchMedia;
      if (original) Element.prototype.animate = original as typeof Element.prototype.animate;
      else delete (Element.prototype as { animate?: unknown }).animate;
    }
  });
});
