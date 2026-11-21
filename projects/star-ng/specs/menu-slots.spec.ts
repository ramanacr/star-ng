import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarBreadcrumb, StarBreadcrumbItem, StarBreadcrumbTemplate } from '@star-ng/ui/breadcrumb';
import { StarIconTemplate } from '@star-ng/ui/core';
import {
  StarMegaMenu,
  StarMenu,
  StarMenubar,
  StarMenuItem,
  StarMenuTemplate,
  StarMenuTrigger,
  StarPanelMenu,
} from '@star-ng/ui/menu';

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

const items: StarMenuItem[] = [
  { label: 'Edit', icon: 'ph-bold ph-pencil-simple' },
  { label: 'Share', items: [{ label: 'Mail' }, { label: 'Link' }] },
  { label: 'Files', group: true, items: [{ label: 'Open' }, { label: 'Save' }] },
];

@Component({
  imports: [StarMenu, StarMenuTemplate, StarIconTemplate],
  template: `
    <star-menu inline ariaLabel="Actions" [items]="items">
      @if (slots()) {
        <ng-template starMenuTemplate="start"><b class="own-start">Start</b></ng-template>
        <ng-template starMenuTemplate="end"><b class="own-end">End</b></ng-template>
        <ng-template starMenuTemplate="item" let-item let-level="level"
          ><b class="own-item">{{ item.label }}@{{ level }}</b></ng-template
        >
        <ng-template starMenuTemplate="itemIcon" let-item><b class="own-icon">*</b></ng-template>
        <ng-template starMenuTemplate="submenuHeader" let-item
          ><b class="own-header">{{ item.label }}!</b></ng-template
        >
        <ng-template starIcon="submenu"><b class="own-sub">></b></ng-template>
      }
    </star-menu>
  `,
})
class InlineHost {
  readonly items = items;
  readonly slots = signal(true);
}

describe('StarMenu slots', () => {
  it('renders start, end, item, item icon, group header and submenu icon slots', async () => {
    const fixture = TestBed.createComponent(InlineHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.own-start')).not.toBeNull();
    expect(el.querySelector('.own-end')).not.toBeNull();
    // start and end are outside role=menu
    expect(el.querySelector('.own-start')!.closest('[role=menu]')).toBeNull();
    const menuItems = [...el.querySelectorAll('[role=menuitem]')];
    expect(menuItems.map((i) => i.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'Edit@0',
      'Share@0>',
      'Open@0',
      'Save@0',
    ]);
    expect(el.querySelector('.own-icon')).toBeNull();
    expect(el.querySelector('.own-sub')!.closest('[aria-hidden=true]')).not.toBeNull();
    const group = el.querySelector('[role=group]')!;
    expect(group.querySelector('.own-header')!.textContent).toBe('Files!');
    const heading = group.querySelector('[data-star-part=submenuHeader]')!;
    expect(group.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('keeps the default content without slots and shows the item icon slot', async () => {
    const fixture = TestBed.createComponent(InlineHost);
    fixture.componentInstance.slots.set(false);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const labels = [...el.querySelectorAll('[role=menuitem]')].map((i) =>
      i.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(labels).toEqual(['Edit', 'Share', 'Open', 'Save']);
    expect(
      el.querySelector('[role=group] [data-star-part=submenuHeader]')!.textContent!.trim(),
    ).toBe('Files');
  });
});

@Component({
  imports: [StarMenu, StarMenuTemplate, StarMenuTrigger],
  template: `
    <button type="button" id="trigger" [starMenuTrigger]="menu">Actions</button>
    <star-menu
      #menu
      [items]="items"
      (show)="log.push('show')"
      (hide)="log.push('hide')"
      (submenuShow)="log.push('sub:' + $event.label)"
      (submenuHide)="log.push('subhide:' + $event.label)"
    >
      <ng-template starMenuTemplate="itemIcon" let-item><b class="own-icon">*</b></ng-template>
    </star-menu>
  `,
})
class PopupHost {
  readonly items = items;
  readonly log: string[] = [];
}

describe('StarMenu popup events', () => {
  it('emits show, hide and the submenu events', async () => {
    const fixture = TestBed.createComponent(PopupHost);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '#trigger',
    )!;
    trigger.click();
    await fixture.whenStable();
    expect(host.log).toEqual(['show']);
    expect(document.querySelectorAll('.own-icon').length).toBe(1);
    const share = [...document.querySelectorAll<HTMLElement>('[role=menuitem]')].find((i) =>
      i.textContent!.includes('Share'),
    )!;
    share.click();
    await fixture.whenStable();
    expect(host.log).toEqual(['show', 'sub:Share']);
    trigger.click();
    await fixture.whenStable();
    expect(host.log).toEqual(['show', 'sub:Share', 'subhide:Share', 'hide']);
  });
});

@Component({
  imports: [StarMenubar, StarMegaMenu, StarMenuTemplate, StarIconTemplate],
  template: `
    <star-menubar ariaLabel="Main" [items]="bar" [autoDisplay]="auto()">
      <ng-template starMenuTemplate="start"><b class="bar-start">S</b></ng-template>
      <ng-template starMenuTemplate="item" let-item let-level="level"
        ><b class="bar-item">{{ item.label }}@{{ level }}</b></ng-template
      >
      <ng-template starIcon="submenu"><b class="bar-sub">v</b></ng-template>
    </star-menubar>
    <star-mega-menu ariaLabel="Catalogue" [items]="mega">
      <ng-template starMenuTemplate="end"><b class="mega-end">E</b></ng-template>
      <ng-template starMenuTemplate="submenuHeader" let-item
        ><b class="mega-head">{{ item.label }}!</b></ng-template
      >
      <ng-template starMenuTemplate="item" let-item
        ><b class="mega-item">{{ item.label }}</b></ng-template
      >
    </star-mega-menu>
  `,
})
class BarHost {
  readonly auto = signal(false);
  readonly bar: StarMenuItem[] = [{ label: 'File', items: [{ label: 'New' }] }, { label: 'Help' }];
  readonly mega: StarMenuItem[] = [
    { label: 'Shop', items: [{ label: 'Chairs', items: [{ label: 'Office' }] }] },
  ];
}

describe('Menu bar and mega menu slots', () => {
  it('renders the slots in the bar and passes them to the submenu', async () => {
    const fixture = TestBed.createComponent(BarHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('star-menubar .bar-start')).not.toBeNull();
    const top = [...el.querySelectorAll<HTMLElement>('star-menubar [role=menuitem]')];
    expect(top.map((i) => i.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'File@0v',
      'Help@0',
    ]);
    top[0].click();
    await fixture.whenStable();
    expect(document.querySelector('.cdk-overlay-container .bar-item')!.textContent).toBe('New@1');
    expect(el.querySelector('star-mega-menu .mega-end')).not.toBeNull();
    const shop = el.querySelector<HTMLElement>('star-mega-menu [role=menuitem]')!;
    expect(shop.querySelector('.mega-item')!.textContent).toBe('Shop');
    shop.click();
    await fixture.whenStable();
    expect(document.querySelector('.mega-head')!.textContent).toBe('Chairs!');
    expect(
      [...document.querySelectorAll('.cdk-overlay-container .mega-item')].map((n) => n.textContent),
    ).toEqual(['Office']);
  });

  it('opens a submenu on hover with autoDisplay', async () => {
    const fixture = TestBed.createComponent(BarHost);
    fixture.componentInstance.auto.set(true);
    await fixture.whenStable();
    const file = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'star-menubar [role=menuitem]',
    )!;
    file.dispatchEvent(new MouseEvent('mouseenter'));
    await fixture.whenStable();
    expect(file.getAttribute('aria-expanded')).toBe('true');
  });
});

@Component({
  imports: [StarPanelMenu, StarMenuTemplate, StarIconTemplate],
  template: `
    <star-panel-menu ariaLabel="Settings" [items]="items" [expandedKeys]="['0']">
      <ng-template starMenuTemplate="item" let-item let-level="level"
        ><b class="pm-item">{{ item.label }}@{{ level }}</b></ng-template
      >
      <ng-template starIcon="submenu" let-expanded
        ><b class="pm-sub">{{ expanded ? '-' : '+' }}</b></ng-template
      >
    </star-panel-menu>
  `,
})
class PanelHost {
  readonly items: StarMenuItem[] = [{ label: 'Account', items: [{ label: 'Profile' }] }];
}

describe('Panel menu slots', () => {
  it('renders the item template and the open state in the submenu icon', async () => {
    const fixture = TestBed.createComponent(PanelHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('.pm-item')].map((n) => n.textContent)).toEqual([
      'Account@0',
      'Profile@1',
    ]);
    expect(el.querySelector('.pm-sub')!.textContent).toBe('-');
  });
});

@Component({
  imports: [StarBreadcrumb, StarBreadcrumbTemplate],
  template: `
    <star-breadcrumb [items]="trail" (itemClick)="clicked.push($event.label)">
      <ng-template starBreadcrumbTemplate="item" let-item let-current="current"
        ><b class="bc-item">{{ item.label }}{{ current ? '!' : '' }}</b></ng-template
      >
      <ng-template starBreadcrumbTemplate="separator"><b class="bc-sep">/</b></ng-template>
    </star-breadcrumb>
  `,
})
class CrumbHost {
  readonly clicked: string[] = [];
  readonly trail: StarBreadcrumbItem[] = [
    { label: 'Orders', url: '#orders' },
    { label: 'Order 7', command: () => undefined },
    { label: 'Invoice' },
  ];
}

describe('Breadcrumb slots and itemClick', () => {
  it('renders the item and separator slots and emits itemClick', async () => {
    const fixture = TestBed.createComponent(CrumbHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('.bc-item')].map((n) => n.textContent)).toEqual([
      'Orders',
      'Order 7',
      'Invoice!',
    ]);
    expect(el.querySelectorAll('.bc-sep').length).toBe(2);
    expect(el.querySelector('.bc-sep')!.closest('[aria-hidden=true]')).not.toBeNull();
    el.querySelector<HTMLElement>('button')!.click();
    expect(fixture.componentInstance.clicked).toEqual(['Order 7']);
  });
});
