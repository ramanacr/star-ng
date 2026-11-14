import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarContextMenu,
  StarMenu,
  StarMenubar,
  StarMenuItem,
  StarMenuTrigger,
} from 'star-ng/menu';

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
