import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarOrderList, StarPickList } from './data-display';
import { StarItemTemplate } from './data-display-slots';

interface Member {
  readonly id: number;
  readonly name: string;
}

@Component({
  imports: [StarPickList, StarOrderList, StarItemTemplate],
  template: `
    <star-pick-list class="slotted" [(source)]="people" [(target)]="team" optionLabel="name">
      <ng-template
        starItem
        [starItemOf]="people()"
        let-member
        let-i="index"
        let-on="selected"
        let-list="list"
      >
        <b class="mine">{{ list }}:{{ i }}:{{ member.name }}:{{ on }}</b>
      </ng-template>
    </star-pick-list>

    <star-pick-list class="plain" [source]="['x', 'y']" [target]="['z']" />

    <star-pick-list class="outer" [source]="['x']" [target]="['y']">
      <star-order-list [value]="['q']" ariaLabel="Inner">
        <ng-template starItem let-item
          ><b class="leak">inner:{{ item }}</b></ng-template
        >
      </star-order-list>
      <ng-template starItem let-item let-list="list"
        ><b class="own">{{ list }}:{{ item }}</b></ng-template
      >
    </star-pick-list>
  `,
})
class Host {
  readonly people = signal<readonly Member[]>([
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Ben' },
  ]);
  readonly team = signal<readonly Member[]>([{ id: 3, name: 'Cora' }]);
}

function key(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('pick list slots', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const marks = (el: HTMLElement, cls: string) =>
    [...el.querySelectorAll(`.${cls} .mine`)].map((n) => n.textContent);

  it('starItem gets item, index, selected and list in both lists', async () => {
    const { fixture, el } = await setup();
    expect(marks(el, 'slotted')).toEqual([
      'source:0:Ada:false',
      'source:1:Ben:false',
      'target:0:Cora:false',
    ]);
    el.querySelectorAll<HTMLElement>('.slotted [role=option]')[1].click();
    await fixture.whenStable();
    expect(marks(el, 'slotted')).toEqual([
      'source:0:Ada:false',
      'source:1:Ben:true',
      'target:0:Cora:false',
    ]);
  });

  it('keeps the option role, selection and Enter transfer with starItem', async () => {
    const { fixture, el } = await setup();
    const first = el.querySelector<HTMLElement>('.slotted [role=option]')!;
    first.click();
    await fixture.whenStable();
    expect(first.getAttribute('aria-selected')).toBe('true');
    key(first, 'Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.team().map((m) => m.name)).toEqual(['Cora', 'Ada']);
    expect(marks(el, 'slotted')).toEqual([
      'source:0:Ben:false',
      'target:0:Cora:false',
      'target:1:Ada:false',
    ]);
  });

  it('keeps default text unchanged without slots', async () => {
    const { el } = await setup();
    const texts = [...el.querySelectorAll('.plain [role=option]')].map((n) => n.textContent);
    expect(texts).toEqual([' x ', ' y ', ' z ']);
  });

  it('does not use the slot of a control nested in the list', async () => {
    const { el } = await setup();
    const texts = [...el.querySelectorAll('.outer .own')].map((n) => n.textContent);
    expect(texts).toEqual(['source:x', 'target:y']);
    expect(el.querySelector('.leak')).toBeNull();
  });
});
