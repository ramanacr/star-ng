import { ApplicationRef, Component, CUSTOM_ELEMENTS_SCHEMA, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarButton } from '@star-ng/ui/button';
import {
  StarContextMenu,
  StarMenu,
  StarMenubar,
  StarMenuItem,
  StarMenuTrigger,
} from '@star-ng/ui/menu';

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

@Component({
  imports: [StarMenu, StarMenuTrigger],
  template: `
    <button type="button" id="trigger" [starMenuTrigger]="menu">Actions</button>
    <star-menu #menu [items]="items" (itemClick)="clicked.push($event.label ?? '')" />
  `,
})
class MenuHost {
  readonly clicked: string[] = [];
  readonly ran: string[] = [];
  readonly items: StarMenuItem[] = [
    { label: 'Edit', command: () => this.ran.push('edit') },
    { separator: true },
    { label: 'Delete', danger: true, disabled: true },
  ];
}

describe('StarMenu', () => {
  it('opens from the trigger, runs commands and emits itemClick', async () => {
    const fixture = TestBed.createComponent(MenuHost);
    await fixture.whenStable();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '#trigger',
    )!;
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    trigger.click();
    await fixture.whenStable();
    const items = [...document.querySelectorAll<HTMLElement>('[role=menuitem]')];
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Edit', 'Delete']);
    expect(items[1].getAttribute('aria-disabled')).toBe('true');
    expect(document.querySelector('[role=separator]')).not.toBeNull();
    items[0].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.ran).toEqual(['edit']);
    expect(fixture.componentInstance.clicked).toEqual(['Edit']);
  });
});

@Component({
  imports: [StarButton, StarMenu, StarMenuTrigger],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <star-button id="wrapper" [starMenuTrigger]="menu">View</star-button>
    <button type="button" id="native" [starMenuTrigger]="menu">Native</button>
    <div id="div" tabindex="0" [starMenuTrigger]="menu">Div</div>
    <x-tile id="empty" tabindex="0" [starMenuTrigger]="menu">Tile</x-tile>
    <star-menu #menu [items]="[{ label: 'Zoom' }]" />
  `,
})
class WrapperHost {}

describe('StarMenuTrigger on a wrapper host', () => {
  it('has one button role in the first render, also on the server', async () => {
    // On the server no after-render hook runs: the host role must be right from the start.
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const fixture = TestBed.createComponent(WrapperHost);
    // Change detection of the view only: no after-render hook runs, as on the server.
    fixture.componentRef.changeDetectorRef.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const wrapper = root.querySelector('#wrapper')!;
    expect(wrapper.getAttribute('role')).toBe('none');
    expect(wrapper.querySelector('button')).not.toBeNull();
    // A native button and a plain element keep the role that CDK gives them.
    expect(root.querySelector('#native')!.getAttribute('role')).toBe('button');
    expect(root.querySelector('#div')!.getAttribute('role')).toBe('button');
    // The popup state is not on a presentational host.
    expect(wrapper.hasAttribute('aria-haspopup')).toBe(false);
    expect(wrapper.hasAttribute('aria-expanded')).toBe(false);
  });

  it('puts the popup state on the inner button after the render', async () => {
    const fixture = TestBed.createComponent(WrapperHost);
    await fixture.whenStable();
    const wrapper = (fixture.nativeElement as HTMLElement).querySelector('#wrapper')!;
    const inner = wrapper.querySelector('button')!;
    expect(wrapper.getAttribute('role')).toBe('none');
    expect(inner.getAttribute('aria-haspopup')).toBe('menu');
    expect(inner.getAttribute('aria-expanded')).toBe('false');
    expect(wrapper.hasAttribute('aria-haspopup')).toBe(false);
    expect(wrapper.hasAttribute('aria-expanded')).toBe(false);

    inner.click();
    await fixture.whenStable();
    expect(inner.getAttribute('aria-expanded')).toBe('true');
    expect(wrapper.hasAttribute('aria-expanded')).toBe(false);
  });

  it('can be destroyed while its menu is open or closing', async () => {
    const fixture = TestBed.createComponent(WrapperHost);
    await fixture.whenStable();
    const inner = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '#wrapper button',
    )!;
    inner.click();
    await fixture.whenStable();
    expect(inner.getAttribute('aria-expanded')).toBe('true');
    // The destroy closes the menu: its close must not register a hook on the destroyed view.
    expect(() => fixture.destroy()).not.toThrow();
    await TestBed.inject(ApplicationRef).whenStable();
  });

  it('keeps the button role of a host without an inner button', async () => {
    const fixture = TestBed.createComponent(WrapperHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const div = root.querySelector('#div')!;
    expect(div.getAttribute('role')).toBe('button');
    expect(div.getAttribute('aria-haspopup')).toBe('menu');
    // A custom element without a button inside gets its button role back after the render.
    const empty = root.querySelector('#empty')!;
    expect(empty.getAttribute('role')).toBe('button');
    expect(empty.getAttribute('aria-haspopup')).toBe('menu');
    expect(empty.getAttribute('aria-expanded')).toBe('false');
  });
});

@Component({
  imports: [StarMenubar, StarMenu, StarContextMenu],
  template: `
    <star-menubar ariaLabel="Main" [items]="nav" (itemClick)="clicked.push($event.label ?? '')" />
    <div id="area" [starContextMenu]="ctx">Right-click me</div>
    <star-menu #ctx [items]="[{ label: 'Copy' }]" />
  `,
})
class NavHost {
  readonly clicked: string[] = [];
  readonly nav: StarMenuItem[] = [
    { label: 'Orders', items: [{ label: 'Mine' }] },
    { label: 'Settings' },
  ];
}

describe('Menubar and context menu', () => {
  it('menubar opens submenus and emits leaf clicks', async () => {
    const fixture = TestBed.createComponent(NavHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=menubar]')).not.toBeNull();
    const [orders, settings] = el.querySelectorAll<HTMLElement>('.star-menubar__item');
    settings.click();
    expect(fixture.componentInstance.clicked).toEqual(['Settings']);
    orders.click();
    await fixture.whenStable();
    const sub = [
      ...document.querySelectorAll<HTMLElement>('.cdk-overlay-container [role=menuitem]'),
    ];
    expect(sub.map((i) => i.textContent?.trim())).toEqual(['Mine']);
    sub[0].click();
    expect(fixture.componentInstance.clicked).toEqual(['Settings', 'Mine']);
  });

  it('context menu opens on contextmenu event', async () => {
    const fixture = TestBed.createComponent(NavHost);
    await fixture.whenStable();
    const area = document.getElementById('area')!;
    area.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );
    await fixture.whenStable();
    expect(
      document.querySelector('.cdk-overlay-container [role=menuitem]')?.textContent?.trim(),
    ).toBe('Copy');
  });
});
