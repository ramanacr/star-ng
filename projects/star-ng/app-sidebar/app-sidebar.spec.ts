import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  StarAppSidebar,
  StarAppSidebarFooter,
  StarAppSidebarHeader,
  StarAppSidebarItem,
  StarAppSidebarSection,
} from '@star-ng/ui/app-sidebar';
import { provideStarUiText } from '@star-ng/ui/core';

@Component({ template: '' })
class Blank {}

function key(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

@Component({
  imports: [
    StarAppSidebar,
    StarAppSidebarHeader,
    StarAppSidebarFooter,
    StarAppSidebarSection,
    StarAppSidebarItem,
  ],
  template: `
    <div [attr.dir]="dir()">
      <star-app-sidebar
        [mode]="mode()"
        [(collapsed)]="collapsed"
        [(visible)]="open"
        [ariaLabel]="label()"
      >
        <star-app-sidebar-header>Acme</star-app-sidebar-header>
        <star-app-sidebar-section heading="Sales">
          <star-app-sidebar-item label="Orders" icon="ph ph-package" routerLink="/orders" />
          <star-app-sidebar-item
            label="Inbox"
            icon="ph ph-tray"
            badge="4"
            badgeLabel="4 new"
            (activated)="activated.push('inbox')"
          />
          <star-app-sidebar-item label="Reports" icon="ph ph-chart-bar" [(expanded)]="reportsOpen">
            <star-app-sidebar-item label="Monthly" routerLink="/reports/monthly" />
            <star-app-sidebar-item label="Yearly" href="/yearly" />
          </star-app-sidebar-item>
        </star-app-sidebar-section>
        <star-app-sidebar-section heading="Account">
          <star-app-sidebar-item label="Settings" href="/settings" [active]="settingsActive()" />
        </star-app-sidebar-section>
        <star-app-sidebar-footer>Signed in</star-app-sidebar-footer>
      </star-app-sidebar>
    </div>
  `,
})
class SidebarHost {
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly mode = signal<'static' | 'overlay'>('static');
  readonly collapsed = signal(false);
  readonly open = signal(false);
  readonly label = signal<string | null>(null);
  readonly reportsOpen = signal(false);
  readonly settingsActive = signal(false);
  readonly activated: string[] = [];
}

async function setup(url = '/orders') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'orders', component: Blank },
        { path: 'reports/monthly', component: Blank },
      ]),
    ],
  });
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(SidebarHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const links = () => [...root.querySelectorAll<HTMLElement>('.star-app-sidebar__link')];
  const link = (name: string) =>
    links().find(
      (element) => element.querySelector('.star-app-sidebar__label')?.textContent === name,
    )!;
  const stops = () => links().filter((element) => element.tabIndex === 0);
  return { fixture, root, links, link, stops };
}

describe('StarAppSidebar', () => {
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('is a nav landmark with header, sections and footer', async () => {
    const { fixture, root } = await setup();
    const nav = root.querySelector('nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Main navigation');
    expect(nav.querySelector('.star-app-sidebar__header')?.textContent).toBe('Acme');
    expect(nav.querySelector('.star-app-sidebar__footer')?.textContent).toBe('Signed in');
    const group = nav.querySelector('.star-app-sidebar__items')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(
      root.querySelector(`#${group.getAttribute('aria-labelledby')}`)?.textContent?.trim(),
    ).toBe('Sales');
    fixture.componentInstance.label.set('Workspace');
    await fixture.whenStable();
    expect(nav.getAttribute('aria-label')).toBe('Workspace');
  });

  it('marks the current page with aria-current through routerLinkActive', async () => {
    const { fixture, link } = await setup();
    expect(link('Orders').getAttribute('aria-current')).toBe('page');
    expect(link('Orders').getAttribute('href')).toBe('/orders');
    expect(link('Monthly').hasAttribute('aria-current')).toBe(false);
    await TestBed.inject(Router).navigateByUrl('/reports/monthly');
    await fixture.whenStable();
    expect(link('Orders').hasAttribute('aria-current')).toBe(false);
    expect(link('Monthly').getAttribute('aria-current')).toBe('page');
    // href items: the active input.
    fixture.componentInstance.settingsActive.set(true);
    await fixture.whenStable();
    expect(link('Settings').getAttribute('aria-current')).toBe('page');
  });

  it('has one tab stop, the current page, and moves with the arrow keys, Home and End', async () => {
    const { fixture, link, stops } = await setup();
    expect(stops()).toEqual([link('Orders')]);
    link('Orders').focus();
    key(link('Orders'), 'ArrowDown');
    expect(document.activeElement).toBe(link('Inbox'));
    await fixture.whenStable();
    expect(stops()).toEqual([link('Inbox')]);
    key(link('Inbox'), 'ArrowDown');
    // The nested items are hidden: Reports, then Settings.
    expect(document.activeElement).toBe(link('Reports'));
    key(link('Reports'), 'ArrowDown');
    expect(document.activeElement).toBe(link('Settings'));
    key(link('Settings'), 'ArrowDown');
    expect(document.activeElement).toBe(link('Settings'));
    key(link('Settings'), 'Home');
    expect(document.activeElement).toBe(link('Orders'));
    key(link('Orders'), 'End');
    expect(document.activeElement).toBe(link('Settings'));
    key(link('Settings'), 'ArrowUp');
    expect(document.activeElement).toBe(link('Reports'));
  });

  it('opens a group with Arrow right, enters it, and goes back with Arrow left', async () => {
    const { fixture, root, link } = await setup();
    const reports = link('Reports');
    const group = root.querySelector<HTMLElement>(`#${reports.getAttribute('aria-controls')}`)!;
    expect(reports.getAttribute('aria-expanded')).toBe('false');
    expect(group.hidden).toBe(true);
    expect(group.getAttribute('role')).toBe('group');

    reports.focus();
    key(reports, 'ArrowRight');
    await fixture.whenStable();
    expect(fixture.componentInstance.reportsOpen()).toBe(true);
    expect(reports.getAttribute('aria-expanded')).toBe('true');
    expect(group.hidden).toBe(false);
    key(reports, 'ArrowRight');
    expect(document.activeElement).toBe(link('Monthly'));
    key(link('Monthly'), 'ArrowDown');
    expect(document.activeElement).toBe(link('Yearly'));
    key(link('Yearly'), 'ArrowLeft');
    expect(document.activeElement).toBe(reports);
    key(reports, 'ArrowLeft');
    await fixture.whenStable();
    expect(fixture.componentInstance.reportsOpen()).toBe(false);
    // Enter (a click on the button) opens it too.
    reports.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.reportsOpen()).toBe(true);
  });

  it('swaps Arrow right and Arrow left in right-to-left', async () => {
    const { fixture, link } = await setup();
    fixture.componentInstance.dir.set('rtl');
    await fixture.whenStable();
    key(link('Reports'), 'ArrowLeft');
    await fixture.whenStable();
    expect(fixture.componentInstance.reportsOpen()).toBe(true);
    key(link('Reports'), 'ArrowRight');
    await fixture.whenStable();
    expect(fixture.componentInstance.reportsOpen()).toBe(false);
  });

  it('reads a badge and emits activated for a button item', async () => {
    const { fixture, link } = await setup();
    const inbox = link('Inbox');
    expect(inbox.tagName).toBe('BUTTON');
    expect(inbox.querySelector('.star-app-sidebar__badge')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(inbox.querySelector('.star-sr-only')?.textContent).toBe('4 new');
    inbox.click();
    expect(fixture.componentInstance.activated).toEqual(['inbox']);
  });

  it('shows icons only when collapsed, with the labels as tooltips', async () => {
    const { fixture, root, link } = await setup();
    fixture.componentInstance.collapsed.set(true);
    await fixture.whenStable();
    expect(root.querySelector('star-app-sidebar')?.classList).toContain(
      'star-app-sidebar--collapsed',
    );
    // The label is still the accessible name.
    expect(link('Inbox').textContent).toContain('Inbox');
    link('Inbox').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fixture.whenStable();
    const tooltip = document.querySelector('[role=tooltip]');
    expect(tooltip?.textContent).toBe('Inbox');
    expect(link('Inbox').getAttribute('aria-describedby')).toBe(tooltip?.id);
    link('Inbox').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it('moves into a drawer below the breakpoint in overlay mode', async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width: 767.98px'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    const { fixture, root, link } = await setup();
    expect(root.querySelector('star-drawer')).toBeNull();
    fixture.componentInstance.mode.set('overlay');
    fixture.componentInstance.collapsed.set(true);
    await fixture.whenStable();
    const drawer = root.querySelector('star-drawer');
    expect(drawer).not.toBeNull();
    expect(drawer?.querySelector('dialog')?.getAttribute('aria-label')).toBe('Main navigation');
    expect(drawer?.querySelector('nav')).not.toBeNull();
    // No icon-only mode in the drawer.
    expect(root.querySelector('star-app-sidebar')?.classList).not.toContain(
      'star-app-sidebar--collapsed',
    );
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    link('Inbox').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('closes the drawer state when it leaves drawer mode', async () => {
    let listener: (() => void) | null = null;
    const query = {
      matches: true,
      addEventListener: (_type: string, callback: () => void) => (listener = callback),
      removeEventListener: () => undefined,
    };
    window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
    const { fixture, root } = await setup();
    fixture.componentInstance.mode.set('overlay');
    await fixture.whenStable();
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(root.querySelector('star-drawer')).not.toBeNull();
    // The viewport grows past the breakpoint: back in the layout, and the drawer state is closed,
    // so it does not pop open when the viewport shrinks again.
    query.matches = false;
    listener!();
    await fixture.whenStable();
    expect(root.querySelector('star-drawer')).toBeNull();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('reads its texts from STAR_UI_TEXT', async () => {
    TestBed.configureTestingModule({
      providers: [provideStarUiText({ mainNavigation: 'Hauptnavigation' })],
    });
    const { root } = await setup();
    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Hauptnavigation');
  });
});
