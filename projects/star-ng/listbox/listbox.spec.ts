import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAutoComplete } from 'star-ng/autocomplete';
import { StarListbox } from './listbox';

interface Site {
  id: number;
  name: string;
  region: string;
}

const SITES: Site[] = [
  { id: 1, name: 'Berlin', region: 'EMEA' },
  { id: 2, name: 'Osaka', region: 'APAC' },
  { id: 3, name: 'Madrid', region: 'EMEA' },
  { id: 4, name: 'Pune', region: 'APAC' },
];

@Component({
  imports: [StarListbox, StarAutoComplete],
  template: `
    <star-listbox
      [options]="sites"
      optionLabel="name"
      optionValue="id"
      optionGroup="region"
      [(value)]="site"
      ariaLabel="Site"
    />
    <star-autocomplete
      [options]="sites"
      optionLabel="name"
      optionValue="id"
      optionGroup="region"
      [(value)]="pick"
      ariaLabel="Find site"
      dropdown
    />
    <star-autocomplete
      [options]="many"
      optionLabel="name"
      optionValue="id"
      virtualScroll
      [(value)]="batch"
      ariaLabel="Find batch"
      dropdown
    />
  `,
})
class Host {
  readonly sites = SITES;
  readonly many = Array.from({ length: 1500 }, (_, i) => ({ id: i, name: `Batch ${i}` }));
  readonly site = signal<number | null>(null);
  readonly pick = signal<number | null>(null);
  readonly batch = signal<number | null>(null);
}

describe('option groups in listbox and autocomplete, virtual scroll in autocomplete', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  }
  const lines = (root: ParentNode) =>
    [...root.querySelectorAll('.star-listbox > li')].map(
      (line) =>
        `${line.classList.contains('star-listbox__group') ? '#' : ''}${line.textContent?.trim()}`,
    );

  it('listbox shows group headings and keeps keyboard order inside the groups', async () => {
    const { fixture, el, host } = await setup();
    const box = el.querySelector('star-listbox')!;
    expect(lines(box)).toEqual(['#EMEA', 'Berlin', 'Madrid', '#APAC', 'Osaka', 'Pune']);
    const heading = box.querySelector('.star-listbox__group')!;
    const options = [...box.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(options[1].getAttribute('aria-describedby')).toBe(heading.id);

    options[2].click();
    await fixture.whenStable();
    expect(host.site()).toBe(2);
  });

  /** Opens the suggestion popup of one autocomplete and returns its list element. */
  async function openPopup(
    fixture: { whenStable: () => Promise<unknown> },
    el: HTMLElement,
    label: string,
  ): Promise<HTMLElement> {
    const input = el.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    input
      .closest('.star-ac')!
      .querySelector<HTMLButtonElement>('button[aria-label="Show options"]')!
      .click();
    await fixture.whenStable();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    return document.getElementById(input.getAttribute('aria-controls')!)!;
  }

  it('autocomplete shows suggestions under group headings', async () => {
    const { fixture, el } = await setup();
    const list = await openPopup(fixture, el, 'Find site');
    expect(
      [...list.children].map(
        (line) =>
          `${line.classList.contains('star-listbox__group') ? '#' : ''}${line.textContent?.trim()}`,
      ),
    ).toEqual(['#EMEA', 'Berlin', 'Madrid', '#APAC', 'Osaka', 'Pune']);
  });

  it('autocomplete renders a window of a long suggestion list', async () => {
    const { fixture, el } = await setup();
    const list = await openPopup(fixture, el, 'Find batch');
    const options = [...list.querySelectorAll('[role="option"]')];
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThan(40);
    expect(options[0].getAttribute('aria-setsize')).toBe('1500');
    expect(list.querySelectorAll('.star-listbox__spacer').length).toBe(1);
  });
});
