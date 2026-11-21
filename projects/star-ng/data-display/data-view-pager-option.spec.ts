import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarPaginatorOption } from '@star-ng/ui/paginator';
import { StarDataView, StarDataViewItem } from './data-view';

@Component({
  imports: [StarDataView, StarDataViewItem, StarPaginatorOption],
  template: `
    <star-data-view [items]="items" paginator [rows]="2" [rowsPerPageOptions]="[2, 4]">
      <ng-template starDataViewItem let-p>{{ p }}</ng-template>
      <ng-template starPaginatorOption="rows" let-rows let-selected="selected"
        ><b class="own-rows">{{ rows }}{{ selected ? '*' : '' }}</b></ng-template
      >
    </star-data-view>
  `,
})
class Host {
  readonly items = ['a', 'b', 'c', 'd', 'e'];
}

describe('StarDataView paginator option slot', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => c.remove()));

  it('passes starPaginatorOption to the rows select of the paginator', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const combo = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[role=combobox]',
    )!;
    combo.click();
    await fixture.whenStable();
    const rows = [...document.querySelectorAll('.own-rows')].map((n) => n.textContent);
    expect(rows).toEqual(['2*', '4']);
  });
});
