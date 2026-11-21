import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAutoComplete } from './autocomplete';

interface City {
  id: number;
  name: string;
}

const CITIES: City[] = [
  { id: 1, name: 'Lisbon' },
  { id: 2, name: 'Lyon' },
  { id: 3, name: 'Oslo' },
];

@Component({
  imports: [StarAutoComplete],
  template: `
    <star-autocomplete
      [suggestionLoader]="load"
      (completeMethod)="queries.push($event.query)"
      optionLabel="name"
      [(value)]="city"
      [delay]="0"
      ariaLabel="City"
    />
  `,
})
class Host {
  readonly city = signal<City | null>(null);
  readonly queries: string[] = [];
  readonly calls: { query: string; signal: AbortSignal }[] = [];
  readonly pending: ((value: readonly City[]) => void)[] = [];
  readonly load = (query: string, abortSignal: AbortSignal): Promise<readonly City[]> => {
    this.calls.push({ query, signal: abortSignal });
    return new Promise((resolve) =>
      this.pending.push(() =>
        resolve(CITIES.filter((c) => c.name.toLowerCase().startsWith(query.toLowerCase()))),
      ),
    );
  };
}

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
/** A resource keeps the app unstable while its promise is open, so tests render without whenStable. */
async function settle(fixture: { detectChanges(): void }): Promise<void> {
  await wait();
  fixture.detectChanges();
  await wait();
}
const options = () => [...document.querySelectorAll<HTMLElement>('[role=option]')];

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

describe('StarAutoComplete suggestionLoader', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('loads through the loader, shows the loading state, then the result; completeMethod still fires', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;

    type(input, 'l');
    await settle(fixture);
    expect(host.queries).toEqual(['l']);
    expect(host.calls.map((c) => c.query)).toEqual(['l']);
    expect(fixture.nativeElement.querySelector('[data-star-part=loadingIcon]')).not.toBeNull();

    host.pending.shift()!([]);
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('[data-star-part=loadingIcon]')).toBeNull();
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Lisbon', 'Lyon']);

    options()[1].click();
    await settle(fixture);
    expect(host.city()).toEqual(CITIES[1]);
  });

  it('aborts the older load when the user types again', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;

    type(input, 'l');
    await settle(fixture);
    type(input, 'ly');
    await settle(fixture);
    expect(host.calls.map((c) => c.query)).toEqual(['l', 'ly']);
    expect(host.calls[0].signal.aborted).toBe(true);
    host.pending[1]([]);
    await settle(fixture);
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Lyon']);
  });
});
