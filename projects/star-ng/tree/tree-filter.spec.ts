import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTree, StarTreeNode } from './tree';
import { filterTree, nodeFieldText } from './tree-model';

const NODES: StarTreeNode<{ code: string }>[] = [
  {
    key: 'eng',
    label: 'Engineering',
    data: { code: 'E-100' },
    children: [
      { key: 'web', label: 'Web platform', data: { code: 'E-110' } },
      { key: 'ops', label: 'Operations', data: { code: 'E-120' } },
    ],
  },
  {
    key: 'fin',
    label: 'Finance',
    data: { code: 'F-200' },
    children: [{ key: 'pay', label: 'Payroll', data: { code: 'F-210' } }],
  },
  { key: 'res', label: 'Résumé review', data: { code: 'H-300' } },
];

describe('tree filter helpers', () => {
  it('reads the label, a node property or a data field', () => {
    expect(nodeFieldText(NODES[0], 'label')).toBe('Engineering');
    expect(nodeFieldText(NODES[0], 'code')).toBe('E-100');
    expect(nodeFieldText(NODES[0], 'missing')).toBeUndefined();
  });

  it('keeps a match with its subtree in lenient mode and only matching paths in strict mode', () => {
    const match = (node: StarTreeNode) => node.label.startsWith('Eng');
    const lenient = filterTree(NODES, match, 'lenient');
    expect(lenient.nodes.map((n) => n.key)).toEqual(['eng']);
    expect(lenient.nodes[0].children?.map((n) => n.key)).toEqual(['web', 'ops']);
    const strict = filterTree(NODES, match, 'strict');
    expect(strict.nodes[0].children).toEqual([]);
  });
});

@Component({
  imports: [StarTree],
  template: `
    <star-tree
      [nodes]="nodes"
      filter
      [filterMode]="mode()"
      [filterBy]="by()"
      [filterLocale]="locale()"
      [(expanded)]="open"
      ariaLabel="Departments"
    />
  `,
})
class FilterHost {
  readonly nodes = NODES;
  readonly mode = signal<'lenient' | 'strict'>('strict');
  readonly by = signal<string | readonly string[]>('label');
  readonly locale = signal<string | null>(null);
  readonly open = signal<readonly string[]>([]);
}

describe('StarTree filter modes', () => {
  async function setup() {
    const fixture = TestBed.createComponent(FilterHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('input[type=search]')!;
    const type = async (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const keys = () =>
      [...el.querySelectorAll<HTMLElement>('[role=treeitem]')].map((r) => r.dataset['key']);
    return { fixture, host: fixture.componentInstance, type, keys };
  }

  it('strict (the default) shows only the matching paths, open', async () => {
    const { type, keys } = await setup();
    await type('web');
    expect(keys()).toEqual(['eng', 'web']);
    await type('engineering');
    expect(keys()).toEqual(['eng']);
  });

  it('lenient shows a match with its descendants, which follow the expanded keys', async () => {
    const { fixture, host, type, keys } = await setup();
    host.mode.set('lenient');
    await fixture.whenStable();
    await type('engineering');
    expect(keys()).toEqual(['eng']);
    host.open.set(['eng']);
    await fixture.whenStable();
    expect(keys()).toEqual(['eng', 'web', 'ops']);
    await type('pay');
    expect(keys()).toEqual(['fin', 'pay']);
  });

  it('filterBy searches other fields, also in data', async () => {
    const { fixture, host, type, keys } = await setup();
    host.by.set(['label', 'code']);
    await fixture.whenStable();
    await type('F-21');
    expect(keys()).toEqual(['fin', 'pay']);
    await type('resume');
    expect(keys()).toEqual(['res']);
  });

  it('matches with starFilterMatch: no case or accents, and filterLocale', async () => {
    const { fixture, host, type, keys } = await setup();
    await type('RESUME');
    expect(keys()).toEqual(['res']);
    host.locale.set('de');
    await fixture.whenStable();
    await type('résumé');
    expect(keys()).toEqual(['res']);
  });
});
