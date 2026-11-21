import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarEmptyTemplate,
  StarFooterTemplate,
  StarHeaderTemplate,
  StarIconTemplate,
} from '@star-ng/ui/core';
import { StarTree, StarTreeNode, StarTreeSelect } from './tree';
import { StarNodeTemplate } from './tree-slots';

interface Project {
  owner: string;
}

const PROJECTS: StarTreeNode<Project>[] = [
  {
    key: 'web',
    label: 'Website',
    data: { owner: 'Asha' },
    children: [
      { key: 'web-ui', label: 'UI kit', data: { owner: 'Ben' } },
      { key: 'web-api', label: 'API', data: { owner: 'Chen' } },
    ],
  },
  { key: 'app', label: 'Mobile app', data: { owner: 'Dara' } },
];

@Component({
  imports: [
    StarTree,
    StarTreeSelect,
    StarNodeTemplate,
    StarEmptyTemplate,
    StarHeaderTemplate,
    StarFooterTemplate,
    StarIconTemplate,
  ],
  template: `
    <star-tree
      class="plain"
      [nodes]="projects"
      selectionMode="single"
      [(value)]="value"
      [(expanded)]="expanded"
      ariaLabel="Plain"
    >
      <ng-template
        starNode
        [starNodeOf]="projects"
        let-node
        let-level="level"
        let-open="expanded"
        let-on="selected"
      >
        <b class="mine">{{ node.data?.owner }}:{{ node.label }}:{{ level }}:{{ open }}:{{ on }}</b>
      </ng-template>
      <ng-template starHeader><i class="head">Head</i></ng-template>
      <ng-template starFooter><i class="foot">Foot</i></ng-template>
    </star-tree>
    <star-tree
      class="checks"
      [nodes]="projects"
      selectionMode="checkbox"
      [(value)]="checked"
      [expanded]="['web']"
      ariaLabel="Checks"
    >
      <ng-template starNode let-node>
        <b class="mine">{{ node.label }}</b>
      </ng-template>
    </star-tree>
    <star-tree class="filtered" [nodes]="projects" filter ariaLabel="Filtered">
      <ng-template starEmpty let-text>Nothing for {{ text }}</ng-template>
    </star-tree>
    <star-tree class="icons" [nodes]="projects" [expanded]="['web']" ariaLabel="Icons">
      <ng-template starIcon="toggle" let-open
        ><b class="my-toggle">{{ open }}</b></ng-template
      >
    </star-tree>
    <star-tree-select
      class="select"
      [nodes]="projects"
      [expanded]="['web']"
      ariaLabel="Select"
      filter
    >
      <ng-template starNode let-node
        ><b class="mine">{{ node.label }}!</b></ng-template
      >
      <ng-template starHeader><i class="head">Pick</i></ng-template>
      <ng-template starFooter><i class="foot">Done</i></ng-template>
      <ng-template starEmpty let-text
        ><i class="none">No {{ text }}</i></ng-template
      >
      <ng-template starIcon="toggle"><b class="my-toggle">+</b></ng-template>
    </star-tree-select>
  `,
})
class Host {
  readonly projects = PROJECTS;
  readonly value = signal<readonly string[]>(['app']);
  readonly expanded = signal<readonly string[]>(['web']);
  readonly checked = signal<readonly string[]>([]);
}

@Component({
  imports: [StarTree, StarNodeTemplate],
  template: `
    @for (mode of modes; track mode) {
      <star-tree [class]="mode" [nodes]="projects" [selectionMode]="mode" [ariaLabel]="mode">
        <ng-template starNode let-node
          ><b class="mine">{{ node.label }}</b></ng-template
        >
      </star-tree>
    }
  `,
})
class ModeHost {
  readonly projects = PROJECTS;
  readonly modes = ['single', 'multiple'] as const;
}

function key(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('tree slots', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('node slot gets node, level, expanded and selected', async () => {
    const { el } = await setup();
    const texts = [...el.querySelectorAll('.plain .mine')].map((n) => n.textContent);
    expect(texts).toEqual([
      'Asha:Website:1:true:false',
      'Ben:UI kit:2:false:false',
      'Chen:API:2:false:false',
      'Dara:Mobile app:1:false:true',
    ]);
    expect(el.querySelector('.plain .star-tree__label .mine')).not.toBeNull();
  });

  it('arrow keys still move focus with starNode', async () => {
    const { fixture, el } = await setup();
    const rows = () => [...el.querySelectorAll<HTMLElement>('.plain [role=treeitem]')];
    rows()[0].focus();
    key(rows()[0], 'ArrowDown');
    await fixture.whenStable();
    expect(document.activeElement).toBe(rows()[1]);
    key(rows()[1], 'ArrowLeft');
    await fixture.whenStable();
    expect(document.activeElement).toBe(rows()[0]);
  });

  it('checkbox mode keeps aria-checked with starNode', async () => {
    const { fixture, el } = await setup();
    const rows = () => [...el.querySelectorAll<HTMLElement>('.checks [role=treeitem]')];
    expect(rows()[0].getAttribute('aria-checked')).toBe('false');
    rows()[1].click();
    await fixture.whenStable();
    expect(rows()[1].getAttribute('aria-checked')).toBe('true');
    expect(rows()[0].getAttribute('aria-checked')).toBe('mixed');
    expect(rows()[0].querySelector('.star-tree__check')).not.toBeNull();
  });

  it('header and footer render in the tree', async () => {
    const { el } = await setup();
    expect(el.querySelector('.plain .head')?.textContent).toBe('Head');
    expect(el.querySelector('.plain .foot')?.textContent).toBe('Foot');
    expect(
      el.querySelector('.plain [data-star-part="panelHeader"].star-panel__header .head'),
    ).not.toBeNull();
    expect(
      el.querySelector('.plain [data-star-part="panelFooter"].star-panel__footer .foot'),
    ).not.toBeNull();
    expect(el.querySelector('.plain [role="tree"] .foot')).toBeNull();
  });

  it('empty slot receives the filter text', async () => {
    const { fixture, el } = await setup();
    const input = el.querySelector<HTMLInputElement>('.filtered input')!;
    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('.filtered .star-listbox__empty')?.textContent?.trim()).toBe(
      'Nothing for zzz',
    );
  });

  it('toggle icon slot replaces the caret', async () => {
    const { el } = await setup();
    const toggle = el.querySelector('.icons .star-tree__toggle:not(.star-tree__toggle--leaf)')!;
    expect(toggle.querySelector('.my-toggle')).not.toBeNull();
    expect(toggle.querySelector('.ph-caret-right')).toBeNull();
    expect(toggle.getAttribute('aria-hidden')).toBe('true');
    // The custom element is a direct child of the toggle, so the rotation rules reach it.
    expect(toggle.querySelector('.my-toggle')?.parentElement).toBe(toggle);
    expect(toggle.querySelector('.my-toggle')?.textContent).toBe('true');
  });

  it('toggle icon context flips when the branch opens', async () => {
    const { fixture, el } = await setup();
    const tree = el.querySelector('.icons')!;
    const mark = () => tree.querySelector('.my-toggle')!.textContent;
    expect(mark()).toBe('true');
    tree.querySelector<HTMLElement>('.star-tree__toggle')!.click();
    await fixture.whenStable();
    expect(mark()).toBe('false');
  });

  it('tree-select passes starNode to its panel tree', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLElement>('.select button')!.click();
    await fixture.whenStable();
    const panel = document.querySelector('.star-tree-select__panel')!;
    expect([...panel.querySelectorAll('.mine')].map((n) => n.textContent)).toEqual([
      'Website!',
      'UI kit!',
      'API!',
      'Mobile app!',
    ]);
    expect(panel.querySelector('.head')?.textContent).toBe('Pick');
    expect(panel.querySelector('.foot')?.textContent).toBe('Done');
    // The slot regions of the panel itself, not of the inner tree.
    expect(panel.querySelector(':scope > .star-panel__header .head')).not.toBeNull();
    expect(panel.querySelector(':scope > .star-panel__footer .foot')).not.toBeNull();
    expect(panel.querySelector('.my-toggle')).not.toBeNull();
    const input = panel.querySelector<HTMLInputElement>('input')!;
    input.value = 'qq';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(panel.querySelector('.none')?.textContent).toBe('No qq');
  });

  it('rows keep the fixed height with starNode in a windowed tree', async () => {
    @Component({
      imports: [StarTree, StarNodeTemplate],
      template: `
        <star-tree
          [nodes]="projects"
          virtualScroll
          scrollHeight="10rem"
          [virtualItemSize]="40"
          ariaLabel="Windowed"
        >
          <ng-template starNode let-node
            ><b class="mine">{{ node.label }}</b></ng-template
          >
        </star-tree>
      `,
    })
    class Windowed {
      readonly projects = PROJECTS;
    }
    const fixture = TestBed.createComponent(Windowed);
    await fixture.whenStable();
    const rows = fixture.nativeElement.querySelectorAll('[role=treeitem]');
    expect(rows.length).toBeGreaterThan(0);
    expect((rows[0] as HTMLElement).style.height).toBe('40px');
    expect(rows[0].querySelector('.mine')).not.toBeNull();
  });

  for (const mode of ['single', 'multiple'] as const) {
    it(`${mode} selection: aria-expanded and aria-selected follow the keyboard with starNode`, async () => {
      const fixture = TestBed.createComponent(ModeHost);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const rows = () => [...el.querySelectorAll<HTMLElement>(`.${mode} [role=treeitem]`)];
      const flags = () => rows().map((r) => r.getAttribute('aria-selected'));
      expect(rows().length).toBe(2);
      expect(rows()[0].getAttribute('aria-expanded')).toBe('false');
      expect(rows()[1].getAttribute('aria-expanded')).toBeNull();
      expect(flags()).toEqual(['false', 'false']);

      rows()[0].focus();
      key(rows()[0], 'ArrowRight');
      await fixture.whenStable();
      expect(rows().length).toBe(4);
      expect(rows()[0].getAttribute('aria-expanded')).toBe('true');
      expect(rows()[1].querySelector('.mine')?.textContent).toBe('UI kit');

      key(rows()[0], 'Enter');
      await fixture.whenStable();
      expect(flags()).toEqual(['true', 'false', 'false', 'false']);

      // Move to the next row and select it with Space.
      key(rows()[0], 'ArrowDown');
      await fixture.whenStable();
      key(rows()[1], ' ');
      await fixture.whenStable();
      expect(flags()).toEqual(
        mode === 'single'
          ? ['false', 'true', 'false', 'false']
          : ['true', 'true', 'false', 'false'],
      );

      // Enter on a selected row in multiple mode clears it. In single mode it stays selected.
      key(rows()[1], 'Enter');
      await fixture.whenStable();
      expect(flags()).toEqual(
        mode === 'single'
          ? ['false', 'true', 'false', 'false']
          : ['true', 'false', 'false', 'false'],
      );
      expect(rows()[0].getAttribute('aria-expanded')).toBe('true');

      key(rows()[1], 'ArrowLeft'); // leaf row: focus goes to the parent
      await fixture.whenStable();
      key(rows()[0], 'ArrowLeft');
      await fixture.whenStable();
      expect(rows().length).toBe(2);
      expect(rows()[0].getAttribute('aria-expanded')).toBe('false');
    });
  }
});
