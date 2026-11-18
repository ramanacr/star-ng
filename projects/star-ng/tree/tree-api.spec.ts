import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTree, StarTreeNode } from './tree';
import { ancestorKeys, branchKeys, parentsOf } from './tree-model';

const NODES: StarTreeNode[] = [
  {
    key: 'eng',
    label: 'Engineering',
    children: [
      {
        key: 'web',
        label: 'Web',
        children: [{ key: 'ui', label: 'UI kit' }],
      },
      { key: 'ops', label: 'Operations' },
    ],
  },
  { key: 'lazy', label: 'Lazy', leaf: false },
  { key: 'fin', label: 'Finance', children: [{ key: 'pay', label: 'Payroll' }] },
];

describe('tree path helpers', () => {
  it('lists the ancestors from the top and the branch keys', () => {
    expect(ancestorKeys(parentsOf(NODES), 'ui')).toEqual(['eng', 'web']);
    expect(ancestorKeys(parentsOf(NODES), 'eng')).toEqual([]);
    expect(branchKeys(NODES)).toEqual(['eng', 'web', 'fin']);
  });
});

@Component({
  imports: [StarTree],
  template: `<star-tree [nodes]="nodes" [(expanded)]="open" ariaLabel="Departments" />`,
})
class ApiHost {
  readonly nodes = NODES;
  readonly open = signal<readonly string[]>(['fin']);
  readonly tree = viewChild.required(StarTree);
}

describe('StarTree API methods', () => {
  async function setup() {
    const fixture = TestBed.createComponent(ApiHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const keys = () =>
      [...el.querySelectorAll<HTMLElement>('[role=treeitem]')].map((r) => r.dataset['key']);
    return { fixture, host: fixture.componentInstance, el, keys };
  }

  it('expandAll opens every branch with children; collapseAll closes all', async () => {
    const { fixture, host, keys } = await setup();
    host.tree().expandAll();
    await fixture.whenStable();
    expect(host.open()).toEqual(['fin', 'eng', 'web']);
    expect(keys()).toEqual(['eng', 'web', 'ui', 'ops', 'lazy', 'fin', 'pay']);
    host.tree().collapseAll();
    await fixture.whenStable();
    expect(host.open()).toEqual([]);
    expect(keys()).toEqual(['eng', 'lazy', 'fin']);
  });

  it('expandPath opens the ancestors of a node', async () => {
    const { fixture, host, keys } = await setup();
    host.tree().expandPath('ui');
    await fixture.whenStable();
    expect(host.open()).toEqual(['fin', 'eng', 'web']);
    expect(keys()).toContain('ui');
  });

  it('scrollToNode opens the path, scrolls the row in and makes it the Tab stop', async () => {
    const { fixture, host, el } = await setup();
    const scrolled: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolled.push(this.dataset['key'] ?? '');
    };
    try {
      host.tree().scrollToNode('ui');
      await fixture.whenStable();
      await fixture.whenStable();
      expect(scrolled).toEqual(['ui']);
      expect(el.querySelector('[data-key="ui"]')?.getAttribute('tabindex')).toBe('0');
      host.tree().scrollToNode('missing');
      await fixture.whenStable();
      expect(scrolled).toEqual(['ui']);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
