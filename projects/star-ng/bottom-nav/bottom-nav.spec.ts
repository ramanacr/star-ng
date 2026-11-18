import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { StarBottomNav, StarBottomNavItem } from './bottom-nav';

@Component({ template: '' })
class Blank {}

@Component({
  imports: [StarBottomNav, StarBottomNavItem],
  template: `
    <star-bottom-nav id="tabs" [(value)]="section" ariaLabel="Sections" [fixed]="fixed()">
      <star-bottom-nav-item value="orders" label="Orders" icon="ph ph-package" badge="3" />
      <star-bottom-nav-item value="cities" label="Cities" icon="ph ph-map-pin" />
      <star-bottom-nav-item value="archive" label="Archive" disabled />
      <star-bottom-nav-item value="projects" label="Projects" />
    </star-bottom-nav>

    <star-bottom-nav id="links" ariaLabel="Pages">
      <star-bottom-nav-item routerLink="/home" label="Home" exact />
      <star-bottom-nav-item routerLink="/orders" label="Orders" />
      <star-bottom-nav-item href="https://example.com/help" value="help" label="Help" />
    </star-bottom-nav>
  `,
})
class Host {
  readonly section = signal<string | null>('cities');
  readonly fixed = signal(false);
}

describe('StarBottomNav', () => {
  async function setup(url = '/orders') {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: Blank }])],
    });
    const fixture = TestBed.createComponent(Host);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const bar = (id: string) => el.querySelector<HTMLElement>(`#${id}`)!;
    const items = (id: string) => [
      ...bar(id).querySelectorAll<HTMLElement>('.star-bottom-nav__item'),
    ];
    const press = async (target: HTMLElement, key: string) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      await fixture.whenStable();
      return event;
    };
    return { fixture, host: fixture.componentInstance, bar, items, press };
  }

  it('is a labelled nav landmark with a list of items', async () => {
    const { bar } = await setup();
    const nav = bar('tabs').querySelector('nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Sections');
    expect(nav.querySelector('[role="list"]')).not.toBeNull();
    expect(bar('tabs').querySelectorAll('[role="listitem"]').length).toBe(4);
  });

  it('renders the icon, the label and the badge after the label', async () => {
    const { items } = await setup();
    const orders = items('tabs')[0];
    expect(orders.querySelector('i')?.getAttribute('aria-hidden')).toBe('true');
    expect(orders.textContent?.replace(/\s+/g, ' ').trim()).toBe('Orders 3');
  });

  it('marks the item of the value with aria-current and sets the value on click', async () => {
    const { fixture, host, items } = await setup();
    const [orders, cities] = items('tabs');
    expect(orders.tagName).toBe('BUTTON');
    expect(cities.getAttribute('aria-current')).toBe('true');
    expect(orders.hasAttribute('aria-current')).toBe(false);
    orders.click();
    await fixture.whenStable();
    expect(host.section()).toBe('orders');
    expect(orders.getAttribute('aria-current')).toBe('true');
    expect(cities.hasAttribute('aria-current')).toBe(false);
  });

  it('puts only the active item in the Tab order', async () => {
    const { items } = await setup();
    expect(items('tabs').map((item) => item.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      null,
      '-1',
    ]);
  });

  it('arrow keys move the focus, wrap and skip disabled items; Home and End', async () => {
    const { items, press } = await setup();
    const [orders, cities, archive, projects] = items('tabs');
    expect(archive.hasAttribute('disabled')).toBe(true);
    cities.focus();
    const right = await press(cities, 'ArrowRight');
    expect(right.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(projects);
    expect(projects.getAttribute('tabindex')).toBe('0');
    await press(projects, 'ArrowRight');
    expect(document.activeElement).toBe(orders);
    await press(orders, 'ArrowLeft');
    expect(document.activeElement).toBe(projects);
    await press(projects, 'Home');
    expect(document.activeElement).toBe(orders);
    await press(orders, 'End');
    expect(document.activeElement).toBe(projects);
  });

  it('reverses the arrow keys in right-to-left', async () => {
    const { bar, items, press } = await setup();
    bar('tabs').setAttribute('dir', 'rtl');
    const [orders, cities] = items('tabs');
    cities.focus();
    await press(cities, 'ArrowLeft');
    expect(document.activeElement).not.toBe(orders);
    await press(document.activeElement as HTMLElement, 'ArrowRight');
    expect(document.activeElement).toBe(cities);
  });

  it('router links get aria-current="page" from the active route', async () => {
    const { fixture, items } = await setup('/orders');
    const [home, orders, help] = items('links');
    expect(home.tagName).toBe('A');
    expect(home.getAttribute('href')).toBe('/home');
    expect(orders.getAttribute('aria-current')).toBe('page');
    expect(home.hasAttribute('aria-current')).toBe(false);
    expect(help.getAttribute('href')).toBe('https://example.com/help');
    // The Tab stop is the active link.
    expect(orders.getAttribute('tabindex')).toBe('0');

    await TestBed.inject(Router).navigateByUrl('/home');
    await fixture.whenStable();
    expect(home.getAttribute('aria-current')).toBe('page');
    expect(orders.hasAttribute('aria-current')).toBe(false);
  });

  it('Space activates a link', async () => {
    const { items, press } = await setup();
    const home = items('links')[0];
    let clicked = 0;
    home.addEventListener('click', (event) => {
      clicked++;
      event.preventDefault();
    });
    const event = await press(home, ' ');
    expect(event.defaultPrevented).toBe(true);
    expect(clicked).toBe(1);
  });

  it('sets the fixed class', async () => {
    const { fixture, host, bar } = await setup();
    expect(bar('tabs').classList).not.toContain('star-bottom-nav--fixed');
    host.fixed.set(true);
    await fixture.whenStable();
    expect(bar('tabs').classList).toContain('star-bottom-nav--fixed');
  });
});
