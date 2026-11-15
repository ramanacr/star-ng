import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StarListbox } from '@star-ng/ui/listbox';
import { StarCascadeSelect } from '@star-ng/ui/select';
import { StarTree, StarTreeNode, StarTreeSelect } from '@star-ng/ui/tree';

function key(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

const NODES: StarTreeNode[] = [
  {
    key: 'a',
    label: 'Alpha',
    children: [
      { key: 'a1', label: 'Alpha one' },
      { key: 'a2', label: 'Alpha two' },
    ],
  },
  { key: 'b', label: 'Beta' },
];

@Component({
  imports: [StarTree, StarTreeSelect],
  template: `
    <star-tree
      [nodes]="nodes"
      selectionMode="checkbox"
      [(value)]="checked"
      [(expanded)]="open"
      ariaLabel="Tree"
    />
    <star-tree-select [nodes]="nodes" [(value)]="picked" ariaLabel="Pick" />
  `,
})
class TreeHost {
  readonly nodes = NODES;
  readonly checked = signal<readonly string[]>([]);
  readonly open = signal<readonly string[]>([]);
  readonly picked = signal<readonly string[]>([]);
}

describe('StarTree and StarTreeSelect', () => {
  it('expands with the keyboard, checks branches and shows mixed parents', async () => {
    const fixture = TestBed.createComponent(TreeHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const rows = () => [...el.querySelectorAll<HTMLElement>('star-tree [role=treeitem]')];
    expect(rows().map((r) => r.dataset['key'])).toEqual(['a', 'b']);
    expect(rows()[0].getAttribute('aria-expanded')).toBe('false');
    key(rows()[0], 'ArrowRight');
    await fixture.whenStable();
    expect(rows().map((r) => r.dataset['key'])).toEqual(['a', 'a1', 'a2', 'b']);
    expect(rows()[1].getAttribute('aria-level')).toBe('2');

    key(rows()[1], ' ');
    await fixture.whenStable();
    expect(fixture.componentInstance.checked()).toEqual(['a1']);
    expect(rows()[0].getAttribute('aria-checked')).toBe('mixed');
    key(rows()[0], 'Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.checked()).toEqual(['a1', 'a2']);
    expect(rows()[0].getAttribute('aria-checked')).toBe('true');

    key(rows()[1], 'ArrowLeft');
    await fixture.whenStable();
    key(rows()[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(rows().length).toBe(2);
  });

  it('tree select opens a tree panel and picks one node', async () => {
    const fixture = TestBed.createComponent(TreeHost);
    await fixture.whenStable();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'star-tree-select button',
    )!;
    trigger.click();
    await fixture.whenStable();
    const panelRows = [
      ...document.querySelectorAll<HTMLElement>('.star-tree-select__panel [role=treeitem]'),
    ];
    panelRows.find((r) => r.dataset['key'] === 'b')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.picked()).toEqual(['b']);
    expect(trigger.textContent).toContain('Beta');
  });
});

@Component({
  imports: [StarListbox],
  template: `<star-listbox
    [options]="['Alpha', 'Beta', 'Gamma']"
    [(value)]="item"
    ariaLabel="Items"
  />`,
})
class ListboxHost {
  readonly item = signal<string | readonly string[] | null>(null);
}

describe('Listbox', () => {
  it('listbox selects with arrows and typeahead', async () => {
    const fixture = TestBed.createComponent(ListboxHost);
    await fixture.whenStable();
    const list = (fixture.nativeElement as HTMLElement).querySelector('[role=listbox]')!;
    list.dispatchEvent(new Event('focus'));
    key(list, 'ArrowDown');
    await fixture.whenStable();
    expect(fixture.componentInstance.item()).toBe('Beta');
    expect(list.getAttribute('aria-activedescendant')).toBeTruthy();
    key(list, 'g');
    await fixture.whenStable();
    expect(fixture.componentInstance.item()).toBe('Gamma');
  });
});

interface Place {
  name: string;
  code?: string;
  children?: Place[];
}

@Component({
  imports: [StarCascadeSelect],
  template: `
    <star-cascade-select
      [options]="places"
      optionLabel="name"
      optionValue="code"
      [(value)]="place"
      [showPath]="path()"
      ariaLabel="City"
      showClear
    />
  `,
})
class CascadeHost {
  readonly path = signal(false);
  readonly place = signal<string | null>(null);
  readonly places: Place[] = [
    {
      name: 'Germany',
      children: [{ name: 'Bavaria', children: [{ name: 'Munich', code: 'DE-MUC' }] }],
    },
    { name: 'India', children: [{ name: 'Pune', code: 'IN-PNQ' }] },
  ];
}

describe('Cascade select', () => {
  it('stores the leaf value and shows the leaf or the whole path', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CascadeHost);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const button = (root: ParentNode, name: string) =>
      [...root.querySelectorAll<HTMLElement>('button, a')].find(
        (b) => b.textContent?.trim() === name,
      )!;
    const select = (fixture.nativeElement as HTMLElement).querySelector('star-cascade-select')!;
    const trigger = select.querySelector<HTMLButtonElement>('.star-cascade__trigger')!;
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    trigger.click();
    await fixture.whenStable();
    button(document, 'Germany').click();
    await fixture.whenStable();
    button(document, 'Bavaria').click();
    await fixture.whenStable();
    button(document, 'Munich').click();
    await fixture.whenStable();
    expect(host.place()).toBe('DE-MUC');
    expect(trigger.textContent?.trim()).toBe('Munich');

    host.path.set(true);
    host.place.set('IN-PNQ');
    await fixture.whenStable();
    expect(trigger.textContent?.trim()).toBe('India / Pune');

    select.querySelector<HTMLButtonElement>('.star-select__icon-btn')!.click();
    await fixture.whenStable();
    expect(host.place()).toBeNull();
  });
});
