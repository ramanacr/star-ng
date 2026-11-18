import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTreeNode, StarTreeNodeEvent, StarTreeSelect } from './tree';

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

@Component({
  imports: [StarTreeSelect],
  template: `
    <star-tree-select
      [nodes]="nodes()"
      [selectionMode]="mode()"
      [(value)]="value"
      [(expanded)]="open"
      [display]="display()"
      [propagateSelectionDown]="down()"
      filter
      filterMode="lenient"
      [filterBy]="['label', 'code']"
      showClear
      ariaLabel="Department"
      (nodeExpand)="expands.push($event)"
      (nodeSelect)="selected.push($event.key)"
      (nodeUnselect)="unselected.push($event.key)"
    />
  `,
})
class SelectHost {
  readonly nodes = signal<readonly StarTreeNode<{ code: string }>[]>([
    {
      key: 'eng',
      label: 'Engineering',
      data: { code: 'E1' },
      children: [
        { key: 'web', label: 'Web', data: { code: 'E2' } },
        { key: 'ops', label: 'Operations', data: { code: 'E3' } },
      ],
    },
    { key: 'lazy', label: 'Projects', leaf: false },
  ]);
  readonly mode = signal<'single' | 'multiple' | 'checkbox'>('checkbox');
  readonly value = signal<readonly string[]>([]);
  readonly open = signal<readonly string[]>([]);
  readonly display = signal<'comma' | 'chip'>('comma');
  readonly down = signal(true);
  readonly expands: StarTreeNodeEvent[] = [];
  readonly selected: string[] = [];
  readonly unselected: string[] = [];
}

describe('StarTreeSelect pass-through', () => {
  async function setup() {
    const fixture = TestBed.createComponent(SelectHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = el.querySelector<HTMLButtonElement>('.star-tree-select__trigger')!;
    const openPanel = async () => {
      trigger.click();
      await fixture.whenStable();
    };
    const row = (key: string) =>
      document.querySelector<HTMLElement>(`.star-tree-select__panel [data-key="${key}"]`)!;
    return { fixture, host: fixture.componentInstance, el, trigger, openPanel, row };
  }

  it('checkbox propagation, select outputs and the filter reach the panel tree', async () => {
    const { fixture, host, openPanel, row } = await setup();
    await openPanel();
    row('eng').click();
    await fixture.whenStable();
    expect(host.value()).toEqual(['web', 'ops']);
    expect(host.selected).toEqual(['eng']);
    row('eng').click();
    await fixture.whenStable();
    expect(host.unselected).toEqual(['eng']);
    host.down.set(false);
    await fixture.whenStable();
    row('eng').click();
    await fixture.whenStable();
    expect(host.value()).toEqual(['eng']);
    const input = document.querySelector<HTMLInputElement>('.star-tree-select__panel input')!;
    input.value = 'E3';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const keys = [
      ...document.querySelectorAll<HTMLElement>('.star-tree-select__panel [role=treeitem]'),
    ].map((r) => r.dataset['key']);
    expect(keys).toEqual(['eng', 'ops']);
  });

  it('lazy nodes emit nodeExpand from the panel', async () => {
    const { fixture, host, openPanel, row } = await setup();
    await openPanel();
    row('lazy').querySelector<HTMLElement>('.star-tree__toggle')!.click();
    await fixture.whenStable();
    expect(host.expands.map((e) => e.node.key)).toEqual(['lazy']);
    expect(host.open()).toEqual(['lazy']);
  });

  it('display chip shows a chip per label; comma joins them', async () => {
    const { fixture, host, el, trigger } = await setup();
    host.value.set(['web', 'ops']);
    await fixture.whenStable();
    expect(trigger.textContent?.trim()).toBe('Web, Operations');
    host.display.set('chip');
    await fixture.whenStable();
    const chips = [...el.querySelectorAll('.star-chip')].map((c) => c.textContent?.trim());
    expect(chips).toEqual(['Web', 'Operations']);
    // The name contains the visible text (WCAG 2.5.3).
    expect(trigger.getAttribute('aria-label')).toBe('Department: Web Operations');
    expect(trigger.textContent?.replace(/\s+/g, ' ').trim()).toBe('Web Operations');
    host.mode.set('single');
    await fixture.whenStable();
    expect(el.querySelector('.star-chip')).toBeNull();
  });

  it('showClear empties the value', async () => {
    const { fixture, host, el } = await setup();
    host.value.set(['web']);
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('.star-select__icon-btn')!.click();
    await fixture.whenStable();
    expect(host.value()).toEqual([]);
  });
});
