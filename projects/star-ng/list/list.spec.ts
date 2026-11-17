import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { StarEmptyTemplate } from '@star-ng/ui/core';
import { StarList, StarListItem, StarListMode, StarListSubheader } from './list';

@Component({ template: '' })
class Blank {}

@Component({
  imports: [StarList, StarListItem, StarListSubheader, StarEmptyTemplate],
  template: `
    <star-list id="plain" ariaLabel="Cities" dense divider>
      <star-list-subheader>Portugal</star-list-subheader>
      <star-list-item>
        <i starListItemStart class="ph ph-map-pin" aria-hidden="true"></i>
        Lisbon
        <span starListItemSubtitle>Capital</span>
        <span starListItemEnd class="meta">545,000</span>
      </star-list-item>
      <star-list-item>Porto</star-list-item>
    </star-list>

    <star-list id="nav" mode="navigation" ariaLabel="Projects">
      <star-list-item routerLink="/projects/apollo">Apollo</star-list-item>
      <star-list-item routerLink="/projects/borealis" disabled>Borealis</star-list-item>
      <star-list-item href="https://example.com/cassini" [active]="true">Cassini</star-list-item>
      <star-list-item routerLink="/projects/delta">Delta</star-list-item>
    </star-list>

    <star-list id="action" [mode]="mode()" ariaLabel="Orders">
      @for (order of orders(); track order) {
        <star-list-item (activated)="opened.set(order)">
          {{ order }}
          <button starListItemEnd type="button" class="end-action">Archive</button>
        </star-list-item>
      }
      <ng-template starEmpty>No orders yet</ng-template>
    </star-list>
  `,
})
class Host {
  readonly mode = signal<StarListMode>('action');
  readonly orders = signal(['ORD-1001', 'ORD-1002', 'ORD-1003']);
  readonly opened = signal<string | null>(null);
}

const KEY_CODES: Record<string, number> = {
  ArrowUp: 38,
  ArrowDown: 40,
  Home: 36,
  End: 35,
};

describe('StarList', () => {
  async function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'projects/:id', component: Blank },
          { path: '**', component: Blank },
        ]),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const list = (id: string) => el.querySelector<HTMLElement>(`#${id}`)!;
    const mains = (id: string) => [...list(id).querySelectorAll<HTMLElement>('.star-list__main')];
    const press = async (target: HTMLElement, key: string) => {
      // The CDK key manager reads keyCode.
      const keyCode = KEY_CODES[key] ?? 0;
      const event = new KeyboardEvent('keydown', { key, keyCode, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      await fixture.whenStable();
      return event;
    };
    return { fixture, el, host: fixture.componentInstance, list, mains, press };
  }

  it('renders a labelled list of list items with the content areas', async () => {
    const { list } = await setup();
    const plain = list('plain');
    expect(plain.getAttribute('role')).toBe('list');
    expect(plain.getAttribute('aria-label')).toBe('Cities');
    expect(plain.classList).toContain('star-list--dense');
    expect(plain.classList).toContain('star-list--divider');
    const items = plain.querySelectorAll('star-list-item');
    expect(items[0].getAttribute('role')).toBe('listitem');
    expect(items[0].querySelector('.star-list__main > [starListItemStart]')).not.toBeNull();
    expect(items[0].querySelector('.star-list__title')?.textContent?.trim()).toBe('Lisbon');
    expect(items[0].querySelector('.star-list__text [starListItemSubtitle]')?.textContent).toBe(
      'Capital',
    );
    // The end area is outside the main part.
    expect(items[0].querySelector(':scope > .meta')).not.toBeNull();
    expect(plain.querySelector('star-list-subheader')?.textContent?.trim()).toBe('Portugal');
  });

  it('plain items are not links, buttons or Tab stops', async () => {
    const { mains } = await setup();
    for (const main of mains('plain')) {
      expect(main.tagName).toBe('DIV');
      expect(main.hasAttribute('tabindex')).toBe(false);
    }
  });

  it('navigation items are links; a router link gets aria-current while its route is active', async () => {
    const { fixture, mains } = await setup();
    const [apollo, borealis, cassini, delta] = mains('nav');
    expect(apollo.tagName).toBe('A');
    expect(apollo.getAttribute('href')).toBe('/projects/apollo');
    expect(cassini.getAttribute('href')).toBe('https://example.com/cassini');
    expect(cassini.getAttribute('aria-current')).toBe('page');
    // A disabled item is no link.
    expect(borealis.tagName).toBe('DIV');
    expect(borealis.getAttribute('aria-disabled')).toBe('true');

    await TestBed.inject(Router).navigateByUrl('/projects/delta');
    await fixture.whenStable();
    expect(delta.getAttribute('aria-current')).toBe('page');
    expect(apollo.hasAttribute('aria-current')).toBe(false);
  });

  it('action items are buttons that emit activated', async () => {
    const { fixture, host, mains } = await setup();
    const buttons = mains('action');
    expect(buttons.map((b) => b.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON']);
    buttons[1].click();
    await fixture.whenStable();
    expect(host.opened()).toBe('ORD-1002');
  });

  it('uses a roving tabindex: one Tab stop per interactive list', async () => {
    const { mains } = await setup();
    expect(mains('action').map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    // The disabled item is skipped as the first Tab stop candidate only when it is first.
    expect(mains('nav').map((b) => b.getAttribute('tabindex'))).toEqual(['0', null, '-1', '-1']);
  });

  it('arrow keys, Home and End move the focus and the Tab stop', async () => {
    const { mains, press } = await setup();
    const buttons = mains('action');
    buttons[0].focus();
    await press(buttons[0], 'ArrowDown');
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    await press(buttons[1], 'End');
    expect(document.activeElement).toBe(buttons[2]);
    await press(buttons[2], 'ArrowUp');
    expect(document.activeElement).toBe(buttons[1]);
    const home = await press(buttons[1], 'Home');
    expect(document.activeElement).toBe(buttons[0]);
    expect(home.defaultPrevented).toBe(true);
  });

  it('skips disabled items with the arrow keys', async () => {
    const { mains, press } = await setup();
    const links = mains('nav');
    links[0].focus();
    await press(links[0], 'ArrowDown');
    expect(document.activeElement).toBe(links[2]);
  });

  it('moves the Tab stop to an item focused by click', async () => {
    const { fixture, mains } = await setup();
    const buttons = mains('action');
    buttons[2].focus();
    await fixture.whenStable();
    expect(buttons.map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
  });

  it('leaves keys in the end area to that control', async () => {
    const { el, mains, press } = await setup();
    const archive = el.querySelector<HTMLElement>('#action .end-action')!;
    archive.focus();
    const event = await press(archive, 'ArrowDown');
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(archive);
    expect(mains('action')[0].getAttribute('tabindex')).toBe('0');
  });

  it('has no roving tabindex in plain mode', async () => {
    const { fixture, host, mains, press } = await setup();
    host.mode.set('plain');
    await fixture.whenStable();
    const items = mains('action');
    expect(items[0].tagName).toBe('DIV');
    const event = await press(items[0], 'ArrowDown');
    expect(event.defaultPrevented).toBe(false);
  });

  it('shows the empty slot and drops the list role when there are no items', async () => {
    const { fixture, host, list } = await setup();
    host.orders.set([]);
    await fixture.whenStable();
    expect(list('action').hasAttribute('role')).toBe(false);
    expect(list('action').hasAttribute('aria-label')).toBe(false);
    expect(list('action').querySelector('.star-list__empty')?.textContent?.trim()).toBe(
      'No orders yet',
    );
  });
});
