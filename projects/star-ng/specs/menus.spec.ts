import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StarButton } from '@star-ng/ui/button';
import {
  StarMegaMenu,
  StarMenu,
  StarMenuItem,
  StarMenuTrigger,
  StarPanelMenu,
} from '@star-ng/ui/menu';

@Component({
  imports: [StarPanelMenu, StarMegaMenu],
  template: `
    <star-panel-menu
      ariaLabel="Settings"
      [single]="single()"
      [items]="sections"
      [(expandedKeys)]="open"
      (itemClick)="clicked.push($event.label ?? '')"
    />
    <star-mega-menu
      ariaLabel="Catalogue"
      [items]="catalogue"
      (itemClick)="clicked.push($event.label ?? '')"
    />
  `,
})
class Host {
  readonly single = signal(false);
  readonly open = signal<readonly string[]>([]);
  readonly clicked: string[] = [];
  readonly sections: StarMenuItem[] = [
    { label: 'Account', items: [{ label: 'Profile' }, { label: 'Password', disabled: true }] },
    {
      label: 'Projects',
      items: [{ label: 'Templates', items: [{ label: 'Letters' }] }, { label: 'Defaults' }],
    },
    { label: 'Sign out' },
  ];
  readonly catalogue: StarMenuItem[] = [
    {
      label: 'Products',
      items: [
        { label: 'Hardware', items: [{ label: 'Laptop Pro' }] },
        { label: 'Software', items: [{ label: 'Editor Plus' }] },
      ],
    },
    { label: 'Reports' },
  ];
}

describe('panel menu and mega menu', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (root: ParentNode, label: string) =>
      [...root.querySelectorAll<HTMLElement>('button, a')].find(
        (item) => item.textContent?.trim() === label,
      )!;
    return { fixture, el, host: fixture.componentInstance, button };
  }

  it('panel menu opens sections in place, to any depth, and runs a leaf', async () => {
    const { fixture, el, host, button } = await setup();
    const menu = el.querySelector('star-panel-menu')!;
    expect(button(menu, 'Account').getAttribute('aria-expanded')).toBe('false');
    expect(button(menu, 'Profile')).toBeUndefined();

    button(menu, 'Account').click();
    button(menu, 'Projects').click();
    await fixture.whenStable();
    button(menu, 'Templates').click();
    await fixture.whenStable();
    expect(host.open()).toEqual(['0', '1', '1.0']);
    expect(button(menu, 'Account').getAttribute('aria-expanded')).toBe('true');
    expect((button(menu, 'Password') as HTMLButtonElement).disabled).toBe(true);

    button(menu, 'Letters').click();
    button(menu, 'Sign out').click();
    expect(host.clicked).toEqual(['Letters', 'Sign out']);

    // Closing a section also closes the sections inside it.
    button(menu, 'Projects').click();
    await fixture.whenStable();
    expect(host.open()).toEqual(['0']);
  });

  it('panel menu keeps one sibling section open in single mode', async () => {
    const { fixture, el, host, button } = await setup();
    const menu = el.querySelector('star-panel-menu')!;
    host.single.set(true);
    await fixture.whenStable();
    button(menu, 'Projects').click();
    await fixture.whenStable();
    button(menu, 'Templates').click();
    await fixture.whenStable();
    button(menu, 'Account').click();
    await fixture.whenStable();
    expect(host.open()).toEqual(['0']);
  });

  it('mega menu opens one panel with a labelled group per column', async () => {
    const { fixture, el, host, button } = await setup();
    const bar = el.querySelector('star-mega-menu')!;
    expect(bar.querySelector('[role="menubar"]')?.getAttribute('aria-label')).toBe('Catalogue');
    button(bar, 'Products').click();
    await fixture.whenStable();
    const panel = document.querySelector('.star-mega-menu__panel')!;
    const groups = [...panel.querySelectorAll('[role="group"]')];
    expect(groups.length).toBe(2);
    const heading = panel.querySelector('.star-mega-menu__heading')!;
    expect(heading.textContent?.trim()).toBe('Hardware');
    expect(groups[0].getAttribute('aria-labelledby')).toBe(heading.id);

    button(panel, 'Editor Plus').click();
    button(bar, 'Reports').click();
    expect(host.clicked).toEqual(['Editor Plus', 'Reports']);
  });
});

@Component({
  imports: [StarButton, StarMenu, StarMenuTrigger],
  template: `
    <star-button [starMenuTrigger]="menu">Actions</star-button>
    <star-menu #menu [items]="items" />
  `,
})
class TriggerHost {
  readonly items: StarMenuItem[] = [{ label: 'Assign' }];
}

describe('starMenuTrigger on star-button', () => {
  it('leaves one button for assistive technology and puts the popup state on it', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(TriggerHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as HTMLElement).querySelector('star-button')!;
    const button = host.querySelector('button')!;
    expect(host.getAttribute('role')).toBe('none');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role="menuitem"]')?.textContent).toContain('Assign');
  });

  it('forwards the focus call of CDK to the inner button, and leaves Enter and Space to its click', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(TriggerHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('star-button')!;
    const button = host.querySelector('button')!;
    host.focus();
    expect(document.activeElement).toBe(button);

    // CDK would toggle on this key and the native click would toggle again.
    let reached = false;
    host.addEventListener('keydown', () => (reached = true));
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(reached).toBe(false);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(reached).toBe(true);
  });

  it('does not change the host while the page is prerendered (server platform)', async () => {
    // The server DOM does not allow a new `focus` on an element, and no key is pressed there.
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }],
    });
    const fixture = TestBed.createComponent(TriggerHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('star-button')!;
    expect(Object.hasOwn(host, 'focus')).toBe(false);
  });
});
