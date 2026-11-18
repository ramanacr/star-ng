import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import {
  starCaretCoordinates,
  StarMention,
  StarMentionItemTemplate,
  StarMentionSearchEvent,
  StarMentionSelectEvent,
  starMentionsIn,
} from '@star-ng/ui/mention';

interface User {
  id: number;
  name: string;
}

const USERS: User[] = [
  { id: 1, name: 'Ana Silva' },
  { id: 2, name: 'Andrés Ruiz' },
  { id: 3, name: 'Jonas Berg' },
];

function key(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

const options = () => [...document.querySelectorAll<HTMLElement>('[role=option]')];
const labels = () => options().map((o) => o.textContent?.trim());

@Component({
  imports: [StarMention, StarMentionItemTemplate],
  template: `
    <textarea
      aria-label="Comment"
      starMention
      #m="starMention"
      [suggestions]="suggestions()"
      [triggers]="triggers()"
      optionLabel="name"
      (mentionSearch)="searches.push($event)"
      (mentionSelect)="selects.push($event)"
    ></textarea>
    @if (custom()) {
      <ng-template [starMentionItem]="m" let-item>
        <b class="custom">{{ $any(item).name }}!</b>
      </ng-template>
    }
  `,
})
class Host {
  readonly mention = viewChild.required(StarMention);
  readonly suggestions = signal<
    readonly User[] | ((query: string, trigger: string) => readonly User[] | Promise<User[]>)
  >(USERS);
  readonly triggers = signal<readonly string[]>(['@']);
  readonly custom = signal(false);
  readonly searches: StarMentionSearchEvent[] = [];
  readonly selects: StarMentionSelectEvent<unknown>[] = [];
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const field = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
  const type = async (text: string, caret = text.length) => {
    field.focus();
    field.value = text;
    field.setSelectionRange(caret, caret);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    // A promise of the suggestions resolves in a microtask.
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const press = async (name: string) => {
    const event = key(field, name);
    await fixture.whenStable();
    return event;
  };
  return { fixture, host: fixture.componentInstance, field, type, press };
}

describe('StarMention', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('opens a listbox of matching suggestions after the trigger, linked to the field', async () => {
    const { host, field, type } = await setup();
    expect(field.getAttribute('aria-autocomplete')).toBe('list');
    expect(field.getAttribute('aria-controls')).toBeNull();
    await type('Hello @an');
    expect(host.searches).toEqual([{ trigger: '@', query: 'an' }]);
    expect(labels()).toEqual(['Ana Silva', 'Andrés Ruiz']);
    const listbox = document.querySelector('[role=listbox]')!;
    expect(listbox.getAttribute('aria-label')).toBe('Suggestions');
    expect(field.getAttribute('aria-controls')).toBe(listbox.id);
    expect(field.getAttribute('aria-activedescendant')).toBe(options()[0].id);
    expect(options()[0].getAttribute('aria-selected')).toBe('true');
    // No combobox semantics on a text field: aria-expanded is not allowed there.
    expect(field.hasAttribute('aria-expanded')).toBe(false);
  });

  it('needs the trigger at the start of a word', async () => {
    const { type } = await setup();
    await type('mail@an');
    expect(options().length).toBe(0);
    expect(document.querySelector('[role=listbox]')).toBeNull();
  });

  it('moves with the arrows and inserts trigger, label and a space with Enter', async () => {
    const { host, field, type, press } = await setup();
    await type('Hi @an and more', 6);
    await press('ArrowDown');
    expect(field.getAttribute('aria-activedescendant')).toBe(options()[1].id);
    await press('ArrowDown');
    expect(field.getAttribute('aria-activedescendant')).toBe(options()[0].id);
    await press('ArrowUp');
    expect(field.getAttribute('aria-activedescendant')).toBe(options()[1].id);
    const event = await press('Enter');
    expect(event.defaultPrevented).toBe(true);
    expect(field.value).toBe('Hi @Andrés Ruiz  and more');
    expect(field.selectionStart).toBe('Hi @Andrés Ruiz '.length);
    expect(host.selects).toEqual([{ trigger: '@', item: USERS[1] }]);
    expect(document.querySelector('[role=listbox]')).toBeNull();
    expect(field.getAttribute('aria-activedescendant')).toBeNull();
    expect(host.mention().mentions()).toEqual([
      { trigger: '@', label: 'Andrés Ruiz', item: USERS[1], start: 3, end: 15 },
    ]);
  });

  it('inserts with Tab and closes with Escape', async () => {
    const { field, type, press } = await setup();
    await type('@jo');
    await press('Tab');
    expect(field.value).toBe('@Jonas Berg ');
    await type('@jo @a');
    const escape = await press('Escape');
    expect(escape.defaultPrevented).toBe(true);
    expect(document.querySelector('[role=listbox]')).toBeNull();
    const enter = await press('Enter');
    expect(enter.defaultPrevented).toBe(false);
  });

  it('inserts on click', async () => {
    const { fixture, field, type } = await setup();
    await type('@');
    expect(labels()).toEqual(['Ana Silva', 'Andrés Ruiz', 'Jonas Berg']);
    options()[2].click();
    await fixture.whenStable();
    expect(field.value).toBe('@Jonas Berg ');
  });

  it('supports several triggers and async suggestions, dropping stale answers', async () => {
    const { host, fixture, type } = await setup();
    const tags = [
      { id: 10, name: 'release' },
      { id: 11, name: 'review' },
    ];
    host.triggers.set(['@', '#']);
    host.suggestions.set((query, trigger) =>
      Promise.resolve(
        trigger === '#' ? tags.filter((t) => t.name.startsWith(query)) : USERS.slice(0, 1),
      ),
    );
    await fixture.whenStable();
    await type('#re');
    expect(labels()).toEqual(['release', 'review']);
    await type('#rel');
    expect(labels()).toEqual(['release']);
    expect(host.searches.at(-1)).toEqual({ trigger: '#', query: 'rel' });
  });

  it('shows "No results found" without a listbox role when nothing matches', async () => {
    const { type } = await setup();
    await type('@zz');
    expect(document.querySelector('[role=listbox]')).toBeNull();
    expect(document.querySelector('.star-mention__message')?.textContent?.trim()).toBe(
      'No results found',
    );
  });

  it('inserts a label as plain text: no markup, no line breaks', async () => {
    const { host, fixture, field, type, press } = await setup();
    host.suggestions.set([{ id: 9, name: 'Eve <img src=x onerror=alert(1)>\nAdmin' }]);
    await fixture.whenStable();
    await type('@eve');
    await press('Enter');
    expect(field.value).toBe('@Eve <img src=x onerror=alert(1)> Admin ');
    expect(document.querySelector('img')).toBeNull();
  });

  it('strips bidi control characters from an inserted label (m9)', async () => {
    const { host, fixture, field, type, press } = await setup();
    host.suggestions.set([{ id: 8, name: 'Eve\u202Egnp.exe\u202C \u2066x\u2069' }]);
    await fixture.whenStable();
    await type('@eve');
    await press('Enter');
    expect(field.value).toBe('@Evegnp.exe x ');
  });

  it('renders the starMentionItem slot', async () => {
    const { host, fixture, type } = await setup();
    host.custom.set(true);
    await fixture.whenStable();
    await type('@jo');
    expect(document.querySelector('[role=option] .custom')?.textContent).toBe('Jonas Berg!');
  });

  it('follows the caret when the page scrolls, and closes when the caret scrolls out (I4)', async () => {
    const { fixture, field, type } = await setup();
    let box = { top: 100, bottom: 160, left: 10, right: 310 };
    const rect = vi.spyOn(field, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          ...box,
          x: box.left,
          y: box.top,
          width: box.right - box.left,
          height: box.bottom - box.top,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    await type('@an');
    expect(options().length).toBe(2);
    const reads = rect.mock.calls.length;
    document.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(rect.mock.calls.length).toBeGreaterThan(reads);
    expect(options().length).toBe(2);
    box = { top: -300, bottom: -240, left: 10, right: 310 };
    document.body.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(options().length).toBe(0);
    expect(field.getAttribute('aria-activedescendant')).toBeNull();
    rect.mockRestore();
  });

  it('closes when the caret leaves the mention or the field loses focus', async () => {
    const { fixture, field, type } = await setup();
    await type('@an');
    expect(options().length).toBe(2);
    field.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(options().length).toBe(0);
  });
});

describe('StarMention with Signal Forms', () => {
  @Component({
    imports: [StarMention, FormField],
    template: `<textarea
      aria-label="Note"
      [formField]="f.note"
      starMention
      [suggestions]="users"
      optionLabel="name"
    ></textarea>`,
  })
  class FormHost {
    readonly users = USERS;
    readonly model = signal({ note: '' });
    readonly f = form(this.model);
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('writes the inserted mention to the form model', async () => {
    const fixture = TestBed.createComponent(FormHost);
    await fixture.whenStable();
    const field = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
    field.focus();
    field.value = 'cc @jon';
    field.setSelectionRange(7, 7);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    key(field, 'Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.model().note).toBe('cc @Jonas Berg ');
  });
});

describe('mention helpers', () => {
  it('finds whole mentions of known labels', () => {
    const found = starMentionsIn('Hi @Ana Silva and @Ana Silvana, #x @Ana Silva.', [
      { trigger: '@', label: 'Ana Silva', item: 1 },
    ]);
    expect(found.map((m) => [m.start, m.end])).toEqual([
      [3, 13],
      [35, 45],
    ]);
  });

  it('measures the caret with a mirror element', () => {
    const field = document.createElement('textarea');
    field.value = 'one\ntwo';
    document.body.append(field);
    const point = starCaretCoordinates(field, 5);
    expect(typeof point.top).toBe('number');
    expect(typeof point.left).toBe('number');
    expect(point.height).toBeGreaterThan(0);
    expect(document.querySelectorAll('.star-mention-mirror').length).toBe(0);
    field.remove();
  });
});

// Type check: StarMention is generic over the suggestion type.
export type MentionOfUser = StarMention<User>;
