import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, validate } from '@angular/forms/signals';
import { StarInputTags, StarInputTagsActionTemplate } from './input-tags';

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

@Component({
  imports: [StarInputTags, StarInputTagsActionTemplate],
  template: `
    <star-input-tags
      #tags
      [(value)]="to"
      [validate]="isEmail"
      keepInvalid
      [disabled]="off()"
      ariaLabel="To"
      (rejected)="rejected.push($event.reason)"
    >
      <ng-template starInputTagsAction let-disabled="disabled">
        <button type="button" [disabled]="disabled" (click)="opened = opened + 1">Book</button>
      </ng-template>
    </star-input-tags>
  `,
})
class KeepInvalidHost {
  readonly to = signal<readonly string[]>(['dana.lee@example.com']);
  readonly off = signal(false);
  readonly isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  readonly rejected: string[] = [];
  opened = 0;
  readonly tags = viewChild.required<StarInputTags>('tags');
}

describe('StarInputTags with keepInvalid and a trailing action', () => {
  async function setup() {
    const fixture = TestBed.createComponent(KeepInvalidHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, el, input: el.querySelector('input')! };
  }

  it('adds invalid text as an invalid chip in the value, lists it and announces it', async () => {
    const { fixture, host, el, input } = await setup();
    type(input, 'not-an-email');
    key(input, 'Enter');
    await fixture.whenStable();
    expect(host.to()).toEqual(['dana.lee@example.com', 'not-an-email']);
    expect(host.tags().invalidTags()).toEqual(['not-an-email']);
    expect(input.value).toBe('');
    expect(host.rejected).toEqual([]);
    const chips = el.querySelectorAll('li');
    expect(chips[0].getAttribute('aria-invalid')).toBeNull();
    expect(chips[0].classList).not.toContain('star-chip--invalid');
    expect(chips[1].getAttribute('aria-invalid')).toBe('true');
    expect(chips[1].classList).toContain('star-chip--invalid');
    expect(chips[1].querySelector('[data-star-part=invalidIcon]')).not.toBeNull();
    expect(chips[1].textContent).toContain('not valid');
    expect(el.querySelector('[aria-live]')?.textContent).toContain('not-an-email added, not valid');
    expect(el.querySelector('[role=alert]')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('star-input-tags')!.classList).toContain('star-select--invalid');

    // A duplicate of an invalid chip is still rejected.
    type(input, 'NOT-AN-EMAIL');
    key(input, 'Enter');
    await fixture.whenStable();
    expect(host.rejected).toEqual(['duplicate']);
    expect(host.to().length).toBe(2);
  });

  it('pasted text keeps valid and invalid parts as chips', async () => {
    const { fixture, host, input } = await setup();
    const paste = new Event('paste', { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, 'clipboardData', {
      value: { getData: () => 'kim@example.com, oops; lee@example.com' },
    });
    input.dispatchEvent(paste);
    await fixture.whenStable();
    expect(host.to()).toEqual([
      'dana.lee@example.com',
      'kim@example.com',
      'oops',
      'lee@example.com',
    ]);
    expect(host.tags().invalidTags()).toEqual(['oops']);
    expect(input.value).toBe('');
  });

  it('Backspace puts a last invalid chip back into the field; removing clears the state', async () => {
    const { fixture, host, el, input } = await setup();
    type(input, 'bad');
    key(input, 'Enter');
    await fixture.whenStable();
    type(input, '');
    key(input, 'Backspace');
    await fixture.whenStable();
    expect(host.to()).toEqual(['dana.lee@example.com']);
    expect(input.value).toBe('bad');
    expect(host.tags().invalidTags()).toEqual([]);
    expect(el.querySelector('[aria-live]')?.textContent).toContain('bad moved to the field');
    expect(input.getAttribute('aria-invalid')).toBeNull();

    // A valid last chip is removed as before.
    type(input, '');
    key(input, 'Backspace');
    await fixture.whenStable();
    expect(host.to()).toEqual([]);
    expect(input.value).toBe('');
  });

  it('renders the trailing action with its context; a click on it does not focus the input', async () => {
    const { fixture, host, el, input } = await setup();
    const panel = el.querySelector<HTMLElement>('[data-star-part=actionPanel]')!;
    expect(panel.classList).toContain('star-tags__action');
    // The panel is the last child of the box, after the main panel.
    expect(panel.parentElement!.lastElementChild).toBe(panel);
    const button = panel.querySelector('button')!;
    button.click();
    expect(host.opened).toBe(1);
    expect(document.activeElement).not.toBe(input);

    host.off.set(true);
    await fixture.whenStable();
    expect(button.disabled).toBe(true);
  });

  it('marks nothing invalid without keepInvalid', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.star-chip--invalid')).toBeNull();
    expect(el.querySelector('[data-star-part=actionPanel]')).toBeNull();
  });
});

const isEmailTag = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

@Component({
  imports: [StarInputTags, FormField],
  template: `<star-input-tags
    [formField]="f.to"
    [validate]="isEmail"
    keepInvalid
    ariaLabel="To"
  />`,
})
class KeepInvalidFormHost {
  readonly isEmail = isEmailTag;
  readonly model = signal({ to: ['dana.lee@example.com'] as readonly string[] });
  readonly f = form(this.model, (p) => {
    validate(p.to, ({ value }) => (value().every(isEmailTag) ? undefined : { kind: 'email' }));
  });
}

describe('StarInputTags with keepInvalid in a Signal Form', () => {
  it('the form validator with the same check blocks submit while an invalid chip is there', async () => {
    const fixture = TestBed.createComponent(KeepInvalidFormHost);
    await fixture.whenStable();
    const { f, model } = fixture.componentInstance;
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expect(f().valid()).toBe(true);
    type(input, 'not-an-email,');
    await fixture.whenStable();
    expect(model().to).toEqual(['dana.lee@example.com', 'not-an-email']);
    expect(f().valid()).toBe(false);
    expect(
      f
        .to()
        .errors()
        .map((e) => e.kind),
    ).toEqual(['email']);

    type(input, '');
    key(input, 'Backspace');
    await fixture.whenStable();
    expect(f().valid()).toBe(true);
  });
});
