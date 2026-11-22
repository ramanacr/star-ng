import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { StarInputTags } from './input-tags';

@Component({
  imports: [StarInputTags, FormField],
  template: `
    <star-input-tags id="tags" [(value)]="tags" [validate]="isEmail" [maxTags]="3" ariaLabel="CC" />
    <star-input-tags id="bound" [formField]="f.terms" ariaLabel="Terms" />
  `,
})
class Host {
  readonly tags = signal<readonly string[]>(['a@x.io']);
  readonly isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  readonly model = signal({ terms: [] as readonly string[] });
  readonly f = form(this.model);
}

function key(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

describe('StarInputTags', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      el,
      input: el.querySelector<HTMLInputElement>('#tags input')!,
      bound: el.querySelector<HTMLInputElement>('#bound input')!,
    };
  }

  it('adds with Enter, rejects invalid and duplicate text with an error, and announces', async () => {
    const { fixture, host, el, input } = await setup();
    type(input, 'b@x.io');
    key(input, 'Enter');
    await fixture.whenStable();
    expect(host.tags()).toEqual(['a@x.io', 'b@x.io']);
    expect(input.value).toBe('');
    expect(el.querySelector('#tags [aria-live]')?.textContent).toContain('b@x.io added');

    type(input, 'not-an-email');
    key(input, 'Enter');
    await fixture.whenStable();
    expect(host.tags().length).toBe(2);
    expect(input.value).toBe('not-an-email');
    expect(el.querySelector('#tags [role=alert]')?.textContent).toContain(
      'not-an-email is not valid.',
    );

    type(input, 'A@X.IO');
    key(input, 'Enter');
    await fixture.whenStable();
    expect(el.querySelector('#tags [role=alert]')?.textContent).toContain('already added');
  });

  it('splits typed and pasted separators, honours max, and Backspace removes the last tag', async () => {
    const { fixture, host, input } = await setup();
    const paste = new Event('paste', { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, 'clipboardData', {
      value: { getData: () => 'c@x.io; d@x.io, e@x.io' },
    });
    input.dispatchEvent(paste);
    await fixture.whenStable();
    expect(host.tags()).toEqual(['a@x.io', 'c@x.io', 'd@x.io']);
    expect(input.value).toBe('e@x.io'); // over the limit of 3: left in the field
    expect(input.readOnly).toBe(true);

    type(input, '');
    key(input, 'Backspace');
    await fixture.whenStable();
    expect(host.tags()).toEqual(['a@x.io', 'c@x.io']);
  });

  it('works with Signal Forms: adds on comma and on blur, marks touched', async () => {
    const { fixture, host, bound } = await setup();
    type(bound, 'billing,');
    await fixture.whenStable();
    expect(host.model().terms).toEqual(['billing']);
    type(bound, 'shipping');
    bound.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(host.model().terms).toEqual(['billing', 'shipping']);
    expect(host.f.terms().touched()).toBe(true);
  });
});

@Component({
  imports: [StarInputTags],
  template: `<star-input-tags [(value)]="tags" allowDuplicates ariaLabel="Labels" />`,
})
class DuplicatesHost {
  readonly tags = signal<readonly string[]>(['red', 'blue', 'red']);
}

describe('StarInputTags with allowDuplicates', () => {
  it('renders repeated tags without a duplicate key warning and removes the right one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(DuplicatesHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const chips = () => [...el.querySelectorAll('li')].map((li) => li.textContent?.trim());
    expect(chips()).toEqual(['red', 'blue', 'red']);

    const input = el.querySelector<HTMLInputElement>('input')!;
    type(input, 'red');
    key(input, 'Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.tags()).toEqual(['red', 'blue', 'red', 'red']);
    expect(chips()).toEqual(['red', 'blue', 'red', 'red']);
    const blue = el.querySelectorAll('li')[1];

    el.querySelectorAll<HTMLButtonElement>('li button')[0].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.tags()).toEqual(['blue', 'red', 'red']);
    expect(chips()).toEqual(['blue', 'red', 'red']);
    // The row of "blue" is the same element: the keys follow the items, not the positions.
    expect(el.querySelectorAll('li')[0]).toBe(blue);

    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.filter((message) => message.includes('NG0955'))).toEqual([]);
    warn.mockRestore();
  });
});
