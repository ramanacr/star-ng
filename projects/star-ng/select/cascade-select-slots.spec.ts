import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarCascadeSelect } from './cascade-select';
import { StarCascadeOptionTemplate } from './select-slots';

interface Place {
  name: string;
  code?: string;
  children?: Place[];
}

const PLACES: Place[] = [
  {
    name: 'Germany',
    children: [
      { name: 'Bavaria', children: [{ name: 'Munich', code: 'DE-MUC' }] },
      { name: 'Hesse', children: [{ name: 'Frankfurt', code: 'DE-FRA' }] },
    ],
  },
  { name: 'India', children: [{ name: 'Pune', code: 'IN-PNQ' }] },
  { name: 'Remote', code: 'REMOTE' },
];

@Component({
  imports: [StarCascadeSelect, StarCascadeOptionTemplate],
  template: `
    <star-cascade-select
      class="custom"
      [options]="places"
      optionLabel="name"
      optionValue="code"
      [(value)]="place"
      ariaLabel="Custom"
    >
      <ng-template
        starCascadeOption
        [starCascadeOptionOf]="places"
        let-option
        let-selected="selected"
        let-index="index"
        let-level="level"
        let-hasChildren="hasChildren"
      >
        <b
          class="my-option"
          [attr.data-level]="level"
          [attr.data-index]="index"
          [attr.data-parent]="hasChildren"
          [attr.data-selected]="selected"
          >{{ option.name }}!</b
        >
      </ng-template>
    </star-cascade-select>

    <star-cascade-select
      class="plain"
      [options]="places"
      optionLabel="name"
      optionValue="code"
      [value]="'REMOTE'"
      ariaLabel="Plain"
    />
  `,
})
class Host {
  readonly places = PLACES;
  readonly place = signal<string | null>('IN-PNQ');
}

describe('cascade select slots', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      custom: el.querySelector<HTMLButtonElement>('.custom .star-cascade__trigger')!,
      plain: el.querySelector<HTMLButtonElement>('.plain .star-cascade__trigger')!,
    };
  }

  const items = () => [...document.querySelectorAll<HTMLElement>('.star-menu__item')];
  const item = (label: string) =>
    items().find((entry) => entry.textContent?.replace('!', '').trim() === label)!;

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('starCascadeOption draws the label of parents and leaves with level and hasChildren', async () => {
    const { fixture, custom } = await setup();
    custom.click();
    await fixture.whenStable();
    const rows = [...document.querySelectorAll<HTMLElement>('.my-option')];
    expect(rows.map((row) => row.textContent)).toEqual(['Germany!', 'India!', 'Remote!']);
    expect(rows.map((row) => row.dataset['level'])).toEqual(['1', '1', '1']);
    expect(rows.map((row) => row.dataset['index'])).toEqual(['0', '1', '2']);
    expect(rows.map((row) => row.dataset['parent'])).toEqual(['true', 'true', 'false']);

    item('Germany').click();
    await fixture.whenStable();
    item('Bavaria').click();
    await fixture.whenStable();
    const deep = [...document.querySelectorAll<HTMLElement>('.my-option')].filter(
      (row) => row.dataset['level'] !== '1',
    );
    expect(
      deep.map((row) => `${row.textContent}:${row.dataset['level']}:${row.dataset['index']}`),
    ).toEqual(['Bavaria!:2:0', 'Hesse!:2:1', 'Munich!:3:0']);
  });

  it('selected is true only for the chosen leaf, and the check icon stays', async () => {
    const { fixture, custom } = await setup();
    custom.click();
    await fixture.whenStable();
    item('India').click();
    await fixture.whenStable();
    const pune = item('Pune');
    expect(pune.querySelector('.my-option')?.getAttribute('data-selected')).toBe('true');
    expect(pune.querySelector('.star-menu__icon.ph-check')).not.toBeNull();
    expect(pune.querySelector('.star-menu__icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(item('India').querySelector('.my-option')?.getAttribute('data-selected')).toBe('false');
  });

  it('keeps the submenu arrow outside the template', async () => {
    const { fixture, custom } = await setup();
    custom.click();
    await fixture.whenStable();
    const parent = item('Germany');
    const arrow = parent.querySelector('.star-menu__sub')!;
    expect(arrow.getAttribute('aria-hidden')).toBe('true');
    expect(parent.querySelector('.my-option')?.contains(arrow)).toBe(false);
    expect(item('Remote').querySelector('.star-menu__sub')).toBeNull();
  });

  it('choosing a leaf still sets the value and closes the menu', async () => {
    const { fixture, host, custom } = await setup();
    custom.click();
    await fixture.whenStable();
    item('Germany').click();
    await fixture.whenStable();
    item('Bavaria').click();
    await fixture.whenStable();
    item('Munich').click();
    await fixture.whenStable();
    expect(host.place()).toBe('DE-MUC');
    expect(custom.textContent?.trim()).toBe('Munich');
    expect(document.querySelector('.star-menu')).toBeNull();
  });

  it('keeps the default label text without a slot', async () => {
    const { fixture, plain } = await setup();
    plain.click();
    await fixture.whenStable();
    const labels = items().map((entry) => entry.querySelector('.star-menu__label')?.textContent);
    expect(labels).toEqual(['Germany', 'India', 'Remote']);
    expect(item('Remote').querySelector('.star-menu__icon.ph-check')).not.toBeNull();
    expect(document.querySelector('.my-option')).toBeNull();
  });

  it('a slot of one cascade select does not leak into another', async () => {
    const { fixture, plain } = await setup();
    plain.click();
    await fixture.whenStable();
    expect(items().length).toBe(3);
    expect(document.querySelectorAll('.my-option').length).toBe(0);
  });
});
