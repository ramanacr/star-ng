import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEmptyTemplate, StarFooterTemplate, StarHeaderTemplate } from '@star-ng/ui/core';
import { StarDataView, StarDataViewItem } from './data-display';
import { StarTreeTable } from './tree-table';

@Component({
  imports: [
    StarDataView,
    StarDataViewItem,
    StarTreeTable,
    StarHeaderTemplate,
    StarFooterTemplate,
    StarEmptyTemplate,
  ],
  template: `
    <star-data-view class="full" [items]="items" paginator [rows]="2">
      <ng-template starDataViewItem let-item>{{ item }}</ng-template>
      <ng-template starHeader><i class="head">Head</i></ng-template>
      <ng-template starFooter><i class="foot">Foot</i></ng-template>
    </star-data-view>

    <star-data-view class="empty" [items]="none">
      <ng-template starDataViewItem let-item>{{ item }}</ng-template>
      <ng-template starEmpty let-text
        ><b class="nothing">Nothing [{{ text }}]</b></ng-template
      >
    </star-data-view>

    <star-data-view class="empty-message" [items]="none" emptyMessage="No products.">
      <ng-template starDataViewItem let-item>{{ item }}</ng-template>
      <ng-template starEmpty><b class="nothing">Slot wins</b></ng-template>
    </star-data-view>

    <star-data-view class="plain" [items]="items.slice(0, 1)">
      <ng-template starDataViewItem let-item>{{ item }}</ng-template>
    </star-data-view>

    <star-data-view class="plain-empty" [items]="none">
      <ng-template starDataViewItem let-item>{{ item }}</ng-template>
    </star-data-view>

    <star-data-view class="outer" [items]="items.slice(0, 1)" [(layout)]="layout">
      <ng-template starDataViewItem let-item>
        <star-tree-table class="inner" [nodes]="[]" [columns]="[{ field: 'a', header: 'A' }]">
          <ng-template starHeader><i class="inner-head">Inner head</i></ng-template>
          <ng-template starFooter><i class="inner-foot">Inner foot</i></ng-template>
          <ng-template starEmpty><i class="inner-empty">Inner empty</i></ng-template>
        </star-tree-table>
      </ng-template>
      <ng-template starHeader><i class="outer-head">Outer head</i></ng-template>
    </star-data-view>
  `,
})
class Host {
  readonly items = ['a', 'b', 'c'];
  readonly none: string[] = [];
  readonly layout = signal<'list' | 'grid'>('list');
}

describe('data view slots', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('header renders above the layout switch', async () => {
    const { el } = await setup();
    const view = el.querySelector('.full')!;
    expect(view.querySelector('.head')?.textContent).toBe('Head');
    expect(view.firstElementChild).toBe(view.querySelector('.head'));
    expect(
      view.querySelector('.star-data-view__header')?.contains(view.querySelector('.head')),
    ).toBe(false);
  });

  it('footer renders after the items and the paginator', async () => {
    const { el } = await setup();
    const view = el.querySelector('.full')!;
    expect(view.querySelector('.foot')?.textContent).toBe('Foot');
    expect(view.lastElementChild).toBe(view.querySelector('.foot'));
    expect(view.querySelector('star-paginator')).not.toBeNull();
  });

  it('empty slot replaces the message and gets an empty text', async () => {
    const { el } = await setup();
    const li = el.querySelector('.empty .star-table__empty')!;
    expect(li.querySelector('.nothing')?.textContent).toBe('Nothing []');
    expect(li.textContent).not.toContain('No records found');
    expect(li.querySelector('.ph-tray')).not.toBeNull();
  });

  it('empty slot wins over emptyMessage', async () => {
    const { el } = await setup();
    const li = el.querySelector('.empty-message .star-table__empty')!;
    expect(li.querySelector('.nothing')?.textContent).toBe('Slot wins');
    expect(li.textContent).not.toContain('No products.');
  });

  it('the item template and the layout switch still work with slots', async () => {
    const { el } = await setup();
    const items = [...el.querySelectorAll('.full .star-data-view__item')].map((n) => n.textContent);
    expect(items).toEqual(['a', 'b']);
    expect(el.querySelectorAll('.full [role=radio]').length).toBe(2);
  });

  it('keeps default text unchanged without slots', async () => {
    const { el } = await setup();
    expect(el.querySelector('.plain-empty .star-table__empty')?.textContent).toBe(
      ' No records found ',
    );
    const plain = el.querySelector('.plain')!;
    expect(plain.querySelector('.star-data-view__item')?.textContent).toBe('a');
    expect(plain.querySelector('.star-data-view__header')?.textContent?.trim()).toBe('');
    expect(plain.firstElementChild).toBe(plain.querySelector('.star-data-view__header'));
  });

  it('does not use the slots of a control nested in an item', async () => {
    const { el } = await setup();
    const view = el.querySelector('.outer')!;
    // The data view shows its own header once, and the nested table keeps its own slots.
    expect(view.querySelectorAll('.outer-head').length).toBe(1);
    expect(view.querySelectorAll('.inner-head').length).toBe(1);
    expect(view.querySelectorAll('.inner-foot').length).toBe(1);
    expect(view.firstElementChild).toBe(view.querySelector('.outer-head'));
    expect(view.lastElementChild?.classList.contains('star-data-view__items')).toBe(true);
    expect(view.querySelector('.star-data-view__items > .star-table__empty')).toBeNull();
  });
});
