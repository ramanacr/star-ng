import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarRibbon,
  StarRibbonBackstage,
  StarRibbonCommand,
  StarRibbonGroup,
  StarRibbonItem,
  StarRibbonItemTemplate,
  StarRibbonTab,
} from '@star-ng/ui/ribbon';

function key(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function keyUp(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}

/** An item id with a quote and a backslash, which a CSS attribute selector must escape. */
const ODD_ID = 'say "hi" \\ now';

const CLIPBOARD: StarRibbonItem[] = [
  {
    id: 'paste',
    label: 'Paste',
    type: 'split',
    icon: 'ph-bold ph-clipboard',
    size: 'large',
    keyTip: 'V',
    menu: [
      { id: 'paste-text', label: 'Paste text only' },
      { id: 'paste-format', label: 'Paste formatting' },
    ],
  },
  { id: 'cut', label: 'Cut', icon: 'ph-bold ph-scissors' },
  { id: 'copy', label: 'Copy', icon: 'ph-bold ph-copy', disabled: true },
];

@Component({
  imports: [
    StarRibbon,
    StarRibbonTab,
    StarRibbonGroup,
    StarRibbonBackstage,
    StarRibbonItemTemplate,
  ],
  template: `
    <div [attr.dir]="dir()">
      <star-ribbon
        [(selectedTab)]="tab"
        [(collapsed)]="collapsed"
        (command)="commands.push($event)"
        [globalKeyTips]="global()"
      >
        <star-ribbon-backstage>
          <p>Recent documents</p>
        </star-ribbon-backstage>
        <star-ribbon-tab key="home" label="Home" keyTip="H">
          <star-ribbon-group
            label="Clipboard"
            [items]="clipboard"
            dialogLauncher="clipboard-dialog"
          />
          <star-ribbon-group label="Font" [items]="font()">
            <ng-template starRibbonItem="size" let-item>
              <input class="custom" [attr.aria-label]="item.label" />
            </ng-template>
          </star-ribbon-group>
        </star-ribbon-tab>
        <star-ribbon-tab key="insert" label="Insert">
          <star-ribbon-group label="Tables" [items]="tables" />
        </star-ribbon-tab>
      </star-ribbon>
    </div>
  `,
})
class RibbonHost {
  readonly ribbon = viewChild.required(StarRibbon);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly global = signal(false);
  readonly tab = signal<string | null>(null);
  readonly collapsed = signal(false);
  readonly clipboard = CLIPBOARD;
  readonly font = signal<StarRibbonItem[]>([
    { id: 'bold', label: 'Bold', type: 'toggle', icon: 'ph-bold ph-text-b', pressed: true },
    { id: 'italic', label: 'Italic', type: 'toggle', icon: 'ph-bold ph-text-italic' },
    {
      id: 'align',
      label: 'Alignment',
      type: 'group',
      items: [
        { id: 'align-start', label: 'Align start', icon: 'ph-bold ph-text-align-left' },
        { id: 'align-end', label: 'Align end', icon: 'ph-bold ph-text-align-right' },
      ],
    },
    { id: 'size', label: 'Font size', type: 'custom' },
  ]);
  readonly tables: StarRibbonItem[] = [
    {
      id: 'table',
      label: 'Table',
      type: 'dropdown',
      size: 'large',
      menu: [{ id: 'table-3', label: 'Three columns' }],
    },
  ];
  readonly commands: StarRibbonCommand[] = [];
}

async function setup() {
  const fixture = TestBed.createComponent(RibbonHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const stable = () => fixture.whenStable();
  const tabs = () => [...root.querySelectorAll<HTMLElement>('[role="tab"]')];
  const button = (name: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent)?.trim() === name,
    )!;
  const toolbars = () => [...root.querySelectorAll<HTMLElement>('[role="toolbar"]')];
  const tips = () =>
    [...root.querySelectorAll('.star-ribbon__keytip')].map((tip) => tip.textContent?.trim());
  const ribbonEl = root.querySelector<HTMLElement>('.star-ribbon')!;
  return { fixture, root, host, stable, tabs, button, toolbars, tips, ribbonEl };
}

describe('StarRibbon', () => {
  it('renders a tab list, a tab panel and one toolbar per group', async () => {
    const { root, tabs, toolbars } = await setup();
    const list = root.querySelector('[role="tablist"]')!;
    expect(list.getAttribute('aria-label')).toBe('Ribbon');
    expect(list.getAttribute('aria-describedby')).toBeTruthy();
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(['Home', 'Insert']);
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs()[1].getAttribute('tabindex')).toBe('-1');
    const panel = root.querySelector('[role="tabpanel"]')!;
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs()[0].id);
    expect(toolbars().map((bar) => bar.getAttribute('aria-label'))).toEqual(['Clipboard', 'Font']);
  });

  it('gives each item its role and state', async () => {
    const { root, button } = await setup();
    expect(button('Bold').getAttribute('aria-pressed')).toBe('true');
    expect(button('Italic').getAttribute('aria-pressed')).toBe('false');
    expect(button('Copy').disabled).toBe(true);
    expect(button('More Paste options').getAttribute('aria-haspopup')).toBe('menu');
    expect(root.querySelector('[role="group"][aria-label="Alignment"]')).not.toBeNull();
    expect(root.querySelector('input.custom')?.getAttribute('aria-label')).toBe('Font size');
    expect(button('Clipboard options')).toBeTruthy();
  });

  it('emits command from buttons, toggles, split buttons and launchers', async () => {
    const { host, button, stable } = await setup();
    button('Cut').click();
    button('Bold').click();
    button('Italic').click();
    button('Paste').click();
    button('Clipboard options').click();
    button('Align end').click();
    await stable();
    expect(host.commands).toEqual([
      { id: 'cut' },
      { id: 'bold', value: false },
      { id: 'italic', value: true },
      { id: 'paste' },
      { id: 'clipboard-dialog' },
      { id: 'align-end' },
    ]);
    // The ribbon never changes the items: `pressed` stays with the owner.
    expect(button('Bold').getAttribute('aria-pressed')).toBe('true');
  });

  it('emits command with the menu entry of a split button', async () => {
    const { host, button, stable } = await setup();
    button('More Paste options').click();
    await stable();
    const entry = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.trim() === 'Paste text only',
    )!;
    entry.click();
    await stable();
    expect(host.commands).toEqual([{ id: 'paste', value: 'paste-text' }]);
  });

  it('moves between tabs with the arrow keys, Home and End, and selects them', async () => {
    const { host, tabs, stable } = await setup();
    tabs()[0].focus();
    key(tabs()[0], 'ArrowRight');
    await stable();
    expect(host.tab()).toBe('insert');
    expect(document.activeElement).toBe(tabs()[1]);
    key(tabs()[1], 'Home');
    await stable();
    expect(host.tab()).toBe('home');
    key(tabs()[0], 'End');
    await stable();
    expect(host.tab()).toBe('insert');
  });

  it('mirrors the tab arrows in right-to-left', async () => {
    const { host, tabs, stable } = await setup();
    host.dir.set('rtl');
    await stable();
    key(tabs()[0], 'ArrowLeft');
    await stable();
    expect(host.tab()).toBe('insert');
  });

  it('is a toolbar per group: one tab stop, arrows move, disabled items are skipped', async () => {
    const { button, stable } = await setup();
    const stops = () =>
      [...document.querySelectorAll<HTMLElement>('[role="toolbar"] [tabindex="0"]')].map((el) =>
        (el.getAttribute('aria-label') ?? el.textContent)?.trim(),
      );
    expect(stops()).toEqual(['Paste', 'Bold']);
    button('Paste').focus();
    key(button('Paste'), 'ArrowRight');
    await stable();
    expect(document.activeElement).toBe(button('More Paste options'));
    key(document.activeElement!, 'ArrowRight');
    key(document.activeElement!, 'ArrowRight');
    await stable();
    // Copy is disabled: the focus wraps to the first item.
    expect(document.activeElement).toBe(button('Paste'));
    key(document.activeElement!, 'End');
    await stable();
    expect(document.activeElement).toBe(button('Cut'));
    expect(stops()).toEqual(['Cut', 'Bold']);
    key(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(button('Paste'));
  });

  it('shows KeyTips with Alt, activates a tab by letter and steps back with Escape', async () => {
    const { host, ribbonEl, tips, tabs, stable } = await setup();
    tabs()[0].focus();
    key(ribbonEl, 'Alt', { altKey: true });
    keyUp(ribbonEl, 'Alt');
    await stable();
    expect(tips()).toEqual(['F', 'H', 'I']);
    key(document.activeElement!, 'i');
    await stable();
    expect(host.tab()).toBe('insert');
    expect(tips()).toEqual(['T']);
    key(document.activeElement!, 'Escape');
    await stable();
    expect(tips()).toEqual(['F', 'H', 'I']);
    key(document.activeElement!, 'Escape');
    await stable();
    expect(tips()).toEqual([]);
  });

  it('activates an item by its KeyTip with F10', async () => {
    const { host, ribbonEl, tips, tabs, stable } = await setup();
    tabs()[0].focus();
    key(ribbonEl, 'F10');
    await stable();
    key(document.activeElement!, 'h');
    await stable();
    // Paste has its own tip "V"; the others are assigned from the labels.
    expect(tips()).toContain('V');
    expect(tips()).toContain('C');
    key(document.activeElement!, 'v');
    await stable();
    expect(host.commands).toEqual([{ id: 'paste' }]);
    expect(tips()).toEqual([]);
  });

  it('listens on the document with globalKeyTips', async () => {
    const { host, tips, stable } = await setup();
    host.global.set(true);
    await stable();
    key(document.body, 'F10');
    await stable();
    expect(tips()).toEqual(['F', 'H', 'I']);
    key(document.activeElement!, 'Escape');
    await stable();
    expect(tips()).toEqual([]);
  });

  it('ignores the page-wide keys while a modal dialog is open outside the ribbon', async () => {
    const { host, tips, stable } = await setup();
    host.global.set(true);
    await stable();
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);
    try {
      key(dialog, 'F10');
      await stable();
      expect(tips()).toEqual([]);
    } finally {
      dialog.remove();
    }
  });

  it('hides the KeyTips on a pointer down outside and when the focus leaves the page', async () => {
    const { host, tips, stable, tabs } = await setup();
    host.global.set(true);
    await stable();
    key(document.body, 'F10');
    await stable();
    expect(tips().length).toBe(3);
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await stable();
    expect(tips()).toEqual([]);
    tabs()[0].focus();
    key(tabs()[0], 'F10');
    await stable();
    expect(tips().length).toBe(3);
    tabs()[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await stable();
    expect(tips()).toEqual([]);
  });

  it('forgets a lone Alt after a window blur or a pointer down', async () => {
    const { ribbonEl, tips, stable, tabs } = await setup();
    tabs()[0].focus();
    key(ribbonEl, 'Alt', { altKey: true });
    window.dispatchEvent(new Event('blur'));
    keyUp(ribbonEl, 'Alt');
    await stable();
    expect(tips()).toEqual([]);
    key(ribbonEl, 'Alt', { altKey: true });
    ribbonEl.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    keyUp(ribbonEl, 'Alt');
    await stable();
    expect(tips()).toEqual([]);
  });

  it('skips letters typed with Alt while the KeyTips show', async () => {
    const { host, tips, tabs, stable } = await setup();
    tabs()[0].focus();
    key(tabs()[0], 'F10');
    await stable();
    key(document.activeElement!, 'i', { altKey: true });
    await stable();
    expect(host.tab()).toBeNull();
    expect(tips()).toEqual(['F', 'H', 'I']);
  });

  it('activates items whose ids need escaping in a selector', async () => {
    const { host, tabs, stable } = await setup();
    host.font.update((items) => [...items, { id: ODD_ID, label: 'Quote', keyTip: 'Q' }]);
    await stable();
    tabs()[0].focus();
    key(tabs()[0], 'F10');
    key(tabs()[0], 'h');
    await stable();
    key(document.activeElement!, 'q');
    await stable();
    expect(host.commands).toEqual([{ id: ODD_ID }]);
  });

  it('collapses to the tab headers and shows the panel on demand', async () => {
    const { host, root, button, tabs, stable } = await setup();
    const panel = root.querySelector<HTMLElement>('[role="tabpanel"]')!;
    button('Collapse the ribbon').click();
    await stable();
    expect(host.collapsed()).toBe(true);
    expect(panel.hidden).toBe(true);
    expect(button('Expand the ribbon').getAttribute('aria-expanded')).toBe('false');
    tabs()[1].click();
    await stable();
    expect(panel.hidden).toBe(false);
    key(panel, 'Escape');
    await stable();
    expect(panel.hidden).toBe(true);
    tabs()[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await stable();
    expect(host.collapsed()).toBe(false);
  });

  it('opens and closes the backstage', async () => {
    const { root, button, stable } = await setup();
    const file = button('File');
    file.click();
    await stable();
    const region = root.querySelector<HTMLElement>('.star-ribbon__backstage')!;
    expect(region.getAttribute('role')).toBe('region');
    expect(region.textContent).toContain('Recent documents');
    expect(file.getAttribute('aria-expanded')).toBe('true');
    key(region, 'Escape');
    await stable();
    expect(root.querySelector('.star-ribbon__backstage')).toBeNull();
    expect(document.activeElement).toBe(file);
  });

  it('collapses groups from the last when the ribbon is narrow', async () => {
    const { fixture, root, host, button, stable } = await setup();
    const panel = root.querySelector<HTMLElement>('[role="tabpanel"]')!;
    Object.defineProperty(panel, 'clientWidth', { configurable: true, value: 170 });
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const width = this.classList.contains('star-ribbon-group--collapsed')
          ? 60
          : this.classList.contains('star-ribbon-group--small')
            ? 100
            : 160;
        return { width, height: 80, top: 0, left: 0, right: width, bottom: 80 } as DOMRect;
      });
    host.ribbon().refit();
    await stable();
    const groups = [...root.querySelectorAll<HTMLElement>('.star-ribbon-group')];
    expect(groups.map((g) => g.className.match(/--(small|collapsed)/)?.[1] ?? 'full')).toEqual([
      'small',
      'collapsed',
    ]);
    const overflow = button('Font');
    expect(overflow.getAttribute('aria-expanded')).toBe('false');
    expect(overflow.getAttribute('tabindex')).toBe('0');
    overflow.click();
    await stable();
    expect(overflow.getAttribute('aria-expanded')).toBe('true');
    expect(groups[1].classList).toContain('star-ribbon-group--open');
    key(button('Bold'), 'Escape');
    await stable();
    expect(overflow.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(overflow);
    rect.mockRestore();
    fixture.destroy();
  });

  it('renders on the server platform', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const { tabs, toolbars } = await setup();
    expect(tabs().length).toBe(2);
    expect(toolbars().length).toBe(2);
  });
});
