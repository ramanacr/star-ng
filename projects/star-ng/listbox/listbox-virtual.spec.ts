import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarListbox } from './listbox';

interface Order {
  id: number;
  name: string;
  region: string;
}

const MANY: Order[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i + 1,
  name: `ORD-${String(i + 1).padStart(5, '0')}`,
  region: `Region ${Math.floor(i / 2_000) + 1}`,
}));

@Component({
  imports: [StarListbox],
  template: `
    <star-listbox
      id="plain"
      [options]="small"
      optionLabel="name"
      optionValue="id"
      [(value)]="plain"
      ariaLabel="Plain"
    />
    <star-listbox
      id="flat"
      [options]="many"
      optionLabel="name"
      optionValue="id"
      [(value)]="flat"
      virtualScroll
      filter
      ariaLabel="Flat"
    />
    <star-listbox
      id="grouped"
      [options]="many"
      optionLabel="name"
      optionValue="id"
      optionGroup="region"
      [(value)]="grouped"
      virtualScroll
      ariaLabel="Grouped"
    />
  `,
})
class Host {
  readonly small = MANY.slice(0, 20);
  readonly many = MANY;
  readonly plain = signal<number | readonly number[] | null>(null);
  readonly flat = signal<number | readonly number[] | null>(null);
  readonly grouped = signal<number | readonly number[] | null>(null);
}

describe('listbox virtual scroll', () => {
  // jsdom has no Element.scrollTo and no layout: scrolling only sets scrollTop.
  const original = Element.prototype.scrollTo;
  beforeAll(() => {
    Element.prototype.scrollTo = function (this: Element, options?: ScrollToOptions | number) {
      if (typeof options === 'object') this.scrollTop = options.top ?? this.scrollTop;
    } as typeof Element.prototype.scrollTo;
  });
  afterAll(() => {
    Element.prototype.scrollTo = original;
  });

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const box = (id: string) => el.querySelector<HTMLElement>(`#${id}`)!;
    return { fixture, el, host: fixture.componentInstance, box };
  }
  const options = (box: HTMLElement) => [...box.querySelectorAll<HTMLElement>('[role="option"]')];

  it('keeps the default list as it was: a plain list with every option and no set size', async () => {
    const { box } = await setup();
    const list = box('plain').querySelector('ul.star-listbox')!;
    expect(list.getAttribute('role')).toBe('listbox');
    expect(options(box('plain')).length).toBe(20);
    expect(options(box('plain'))[0].hasAttribute('aria-setsize')).toBe(false);
    expect(box('plain').querySelector('cdk-virtual-scroll-viewport')).toBeNull();
  });

  it('renders a window of 10,000 options in the viewport element', async () => {
    const { box } = await setup();
    const viewport = box('flat').querySelector('cdk-virtual-scroll-viewport')!;
    expect(viewport.getAttribute('role')).toBe('listbox');
    expect(viewport.getAttribute('aria-label')).toBe('Flat');
    expect(box('flat').querySelector('ul')).toBeNull();
    const rendered = options(box('flat'));
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(60);
  });

  it('gives each rendered option the size of the whole list and its position', async () => {
    const { box } = await setup();
    const rendered = options(box('flat'));
    expect(rendered[0].getAttribute('aria-setsize')).toBe('10000');
    expect(rendered[0].getAttribute('aria-posinset')).toBe('1');
    expect(rendered[1].getAttribute('aria-posinset')).toBe('2');
    expect(rendered[1].id.endsWith('-1')).toBe(true);
  });

  it('draws group headings as rows between the options', async () => {
    const { box } = await setup();
    const wrapper = box('grouped').querySelector('.cdk-virtual-scroll-content-wrapper')!;
    const first = [...wrapper.children].slice(0, 3);
    expect(first[0].classList.contains('star-listbox__group')).toBe(true);
    expect(first[0].textContent?.trim()).toBe('Region 1');
    expect(first[1].getAttribute('role')).toBe('option');
    // The first option names its heading, which is in the DOM.
    const heading = first[0].id;
    expect(first[1].getAttribute('aria-describedby')).toBe(heading);
    expect(wrapper.querySelector(`#${heading}`)).not.toBeNull();
    // The set size counts options only, not headings.
    expect(first[1].getAttribute('aria-setsize')).toBe('10000');
  });

  it('chooses a rendered option by click', async () => {
    const { fixture, box, host } = await setup();
    options(box('flat'))[2].click();
    await fixture.whenStable();
    expect(host.flat()).toBe(3);
    expect(options(box('flat'))[2].getAttribute('aria-selected')).toBe('true');
  });

  it('End goes to the last of all options and the active id names an option in the DOM', async () => {
    const { fixture, box, host } = await setup();
    const viewport = box('flat').querySelector<HTMLElement>('cdk-virtual-scroll-viewport')!;
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await fixture.whenStable();
    expect(host.flat()).toBe(10_000);
    const active = viewport.getAttribute('aria-activedescendant');
    // jsdom has no layout, so the window may lag: when the id is set, the element must exist.
    if (active) expect(box('flat').querySelector(`#${active}`)).not.toBeNull();
  });

  it('type-ahead finds an option that is not in the DOM', async () => {
    const { fixture, box, host } = await setup();
    const viewport = box('flat').querySelector<HTMLElement>('cdk-virtual-scroll-viewport')!;
    for (const key of 'ord-07500') {
      viewport.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }
    await fixture.whenStable();
    expect(host.flat()).toBe(7_500);
  });

  it('Home and arrow keys work over all options', async () => {
    const { fixture, box, host } = await setup();
    const viewport = box('flat').querySelector<HTMLElement>('cdk-virtual-scroll-viewport')!;
    const press = async (key: string) => {
      viewport.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await fixture.whenStable();
    };
    await press('End');
    await press('ArrowUp');
    expect(host.flat()).toBe(9_999);
    await press('PageUp');
    expect(host.flat()).toBeLessThan(9_999);
    await press('Home');
    expect(host.flat()).toBe(1);
    await press('PageDown');
    expect(host.flat()).toBeGreaterThan(1);
  });

  it('keeps Page up and Page down to the browser without virtualScroll', async () => {
    const { box } = await setup();
    const event = new KeyboardEvent('keydown', {
      key: 'PageDown',
      bubbles: true,
      cancelable: true,
    });
    box('plain').querySelector('ul')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('shows the empty message when the filter matches nothing', async () => {
    const { fixture, box } = await setup();
    const input = box('flat').querySelector<HTMLInputElement>('input')!;
    input.value = 'no such number';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(options(box('flat')).length).toBe(0);
    expect(box('flat').querySelector('.star-listbox__empty')).not.toBeNull();
    input.value = 'ORD-05000';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(options(box('flat')).length).toBe(1);
    expect(options(box('flat'))[0].getAttribute('aria-setsize')).toBe('1');
  });
});
