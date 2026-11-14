import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAutoComplete, StarAutoCompleteSearch, StarMultiAutoComplete } from './autocomplete';

interface Person {
  id: number;
  name: string;
}

const PEOPLE: Person[] = [
  { id: 1, name: 'Anita Rao' },
  { id: 2, name: 'Markus Keller' },
  { id: 3, name: 'Li Chen' },
  { id: 4, name: 'Anna Berg' },
];

@Component({
  imports: [StarAutoComplete, StarMultiAutoComplete],
  template: `
    <star-autocomplete
      [options]="people"
      optionLabel="name"
      optionValue="id"
      [(value)]="person"
      ariaLabel="Person"
      [delay]="0"
    />
    <star-autocomplete
      [suggestions]="results()"
      (completeMethod)="onSearch($event)"
      optionLabel="name"
      [(value)]="remote"
      [minQueryLength]="2"
      [delay]="0"
      ariaLabel="Remote"
    />
    <star-multi-autocomplete [options]="tags" [(value)]="chosen" ariaLabel="Tags" [delay]="0" />
  `,
})
class Host {
  readonly people = PEOPLE;
  readonly tags = ['Dosage', 'Safety', 'Storage'];
  readonly person = signal<number | null>(null);
  readonly remote = signal<Person | null>(null);
  readonly chosen = signal<readonly string[]>([]);
  readonly results = signal<readonly Person[]>([]);
  readonly queries: string[] = [];
  onSearch(event: StarAutoCompleteSearch): void {
    this.queries.push(event.query);
    this.results.set(
      PEOPLE.filter((p) => p.name.toLowerCase().includes(event.query.toLowerCase())),
    );
  }
}

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

function key(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

const options = () => [...document.querySelectorAll<HTMLElement>('[role=option]')];

describe('StarAutoComplete', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      'input',
    );
    return {
      fixture,
      host: fixture.componentInstance,
      local: inputs[0],
      remote: inputs[1],
      multi: inputs[2],
    };
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('filters local options, highlights the match and selects with the keyboard', async () => {
    const { fixture, host, local } = await setup();
    type(local, 'an');
    await fixture.whenStable();
    expect(local.getAttribute('role')).toBe('combobox');
    expect(local.getAttribute('aria-expanded')).toBe('true');
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Anita Rao', 'Anna Berg']);
    expect(document.querySelector('mark')?.textContent).toBe('An');
    key(local, 'ArrowDown');
    key(local, 'ArrowDown');
    await fixture.whenStable();
    key(local, 'Enter');
    await fixture.whenStable();
    expect(host.person()).toBe(4);
    expect(local.value).toBe('Anna Berg');
  });

  it('forces selection on blur: exact label match is taken, other text reverts', async () => {
    const { fixture, host, local } = await setup();
    type(local, 'li chen');
    key(local, 'Escape');
    local.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(host.person()).toBe(3);
    type(local, 'nobody');
    key(local, 'Escape');
    local.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(local.value).toBe('Li Chen');
    expect(host.person()).toBe(3);
  });

  it('server mode: waits for minQueryLength, emits search and shows suggestions', async () => {
    const { fixture, host, remote } = await setup();
    type(remote, 'm');
    await wait();
    expect(host.queries).toEqual([]);
    type(remote, 'ma');
    await wait();
    await fixture.whenStable();
    expect(host.queries).toEqual(['ma']);
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Markus Keller']);
    const live = fixture.nativeElement
      .querySelectorAll('star-autocomplete')[1]
      .querySelector('[aria-live=polite]');
    expect(live?.textContent).toContain('1 result available');
    options()[0].click();
    await fixture.whenStable();
    expect(host.remote()).toEqual(PEOPLE[1]);
  });

  it('multiple: adds chips, hides chosen options, Backspace removes the last chip', async () => {
    const { fixture, host, multi } = await setup();
    type(multi, 's');
    await fixture.whenStable();
    options()[0].click();
    await fixture.whenStable();
    expect(host.chosen()).toEqual(['Dosage']);
    expect(multi.value).toBe('');
    type(multi, 's');
    await fixture.whenStable();
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Safety', 'Storage']);
    key(multi, 'Escape');
    type(multi, '');
    key(multi, 'Backspace');
    await fixture.whenStable();
    expect(host.chosen()).toEqual([]);
  });
});
