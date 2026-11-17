import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarOrderList, StarPickList } from './data-display';
import { StarItemTemplate } from './data-display-slots';

interface Task {
  readonly id: number;
  readonly name: string;
}

@Component({
  imports: [StarOrderList, StarPickList, StarItemTemplate],
  template: `
    <star-order-list class="slotted" [(value)]="tasks" optionLabel="name" ariaLabel="Slotted">
      <ng-template starItem [starItemOf]="tasks()" let-task let-i="index" let-on="selected">
        <b class="mine">{{ i }}:{{ task.name }}:{{ on }}</b>
      </ng-template>
    </star-order-list>

    <star-order-list class="plain" [value]="['a', 'b']" ariaLabel="Plain" />

    <star-order-list class="outer" [value]="['x', 'y']" ariaLabel="Outer">
      <star-pick-list [source]="['q']" [target]="[]">
        <ng-template starItem let-item
          ><b class="leak">inner:{{ item }}</b></ng-template
        >
      </star-pick-list>
      <ng-template starItem let-item
        ><b class="own">own:{{ item }}</b></ng-template
      >
    </star-order-list>
  `,
})
class Host {
  readonly tasks = signal<readonly Task[]>([
    { id: 1, name: 'Plan' },
    { id: 2, name: 'Build' },
    { id: 3, name: 'Ship' },
  ]);
}

function key(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

describe('order list slots', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const options = (el: HTMLElement, cls: string) => [
    ...el.querySelectorAll<HTMLElement>(`.${cls} [role=option]`),
  ];

  it('starItem gets item, index and selected', async () => {
    const { fixture, el } = await setup();
    const marks = () => [...el.querySelectorAll('.slotted .mine')].map((n) => n.textContent);
    expect(marks()).toEqual(['0:Plan:false', '1:Build:false', '2:Ship:false']);
    options(el, 'slotted')[1].click();
    await fixture.whenStable();
    expect(marks()).toEqual(['0:Plan:false', '1:Build:true', '2:Ship:false']);
  });

  it('keeps the grip, the option role and the keys with starItem', async () => {
    const { fixture, el } = await setup();
    const rows = () => options(el, 'slotted');
    expect(rows()[0].querySelector('.star-order-list__grip')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    rows()[1].dispatchEvent(new Event('focus'));
    key(rows()[1], 'ArrowUp', { altKey: true });
    await fixture.whenStable();
    expect(fixture.componentInstance.tasks().map((t) => t.name)).toEqual(['Build', 'Plan', 'Ship']);
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    expect(rows()[0].querySelector('.mine')?.textContent).toBe('0:Build:true');
  });

  it('keeps default text unchanged without slots', async () => {
    const { el } = await setup();
    expect(options(el, 'plain').map((n) => n.textContent)).toEqual([' a ', ' b ']);
  });

  it('does not use the slot of a control nested in the list', async () => {
    const { el } = await setup();
    expect(options(el, 'outer').map((n) => n.textContent)).toEqual(['own:x', 'own:y']);
    expect(el.querySelector('.leak')).toBeNull();
  });
});
