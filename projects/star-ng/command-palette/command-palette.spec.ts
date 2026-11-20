import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarCommand, StarCommandPalette, StarCommandTemplate } from '@star-ng/ui/command-palette';
import { provideStarUiText, StarEmptyTemplate, StarLoadingTemplate } from '@star-ng/ui/core';
import { starCommandScore } from './command-palette';

function key(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

const COMMANDS: StarCommand[] = [
  { id: 'new', label: 'New file', group: 'File', shortcut: 'Ctrl+N', icon: 'ph ph-file' },
  { id: 'save', label: 'Save all', group: 'File', keywords: ['store', 'disk'] },
  { id: 'print', label: 'Print', group: 'File', disabled: true },
  { id: 'cafe', label: 'Open café menu', group: 'Go to' },
  { id: 'settings', label: 'Settings', group: 'Go to', keywords: ['preferences'] },
  { id: 'theme', label: 'Toggle theme' },
];

@Component({
  imports: [StarCommandPalette, StarCommandTemplate, StarEmptyTemplate, StarLoadingTemplate],
  template: `
    <star-command-palette
      [commands]="commands()"
      [(visible)]="open"
      [hotkey]="hotkey()"
      [loading]="loading()"
      (commandRun)="ran.push($event.id)"
    >
      @if (custom()) {
        <ng-template starCommand let-command let-active="active">
          <b class="custom">{{ command.label }}{{ active ? ' *' : '' }}</b>
        </ng-template>
        <ng-template starEmpty let-query>Nothing for {{ query }}</ng-template>
        <ng-template starLoading>Fetching</ng-template>
      }
    </star-command-palette>
    <input class="outside" />
  `,
})
class PaletteHost {
  readonly palette = viewChild.required(StarCommandPalette);
  readonly commands = signal<StarCommand[]>(COMMANDS);
  readonly open = signal(false);
  readonly hotkey = signal<string | null>('mod+k');
  readonly loading = signal(false);
  readonly custom = signal(false);
  readonly ran: string[] = [];
}

async function setup() {
  const fixture = TestBed.createComponent(PaletteHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const input = root.querySelector<HTMLInputElement>('[role=combobox]')!;
  const listbox = root.querySelector<HTMLElement>('[role=listbox]')!;
  const options = () => [...listbox.querySelectorAll<HTMLElement>('[role=option]')];
  const labelOf = (option: Element | null) =>
    (option?.querySelector('.star-command-palette__label') ?? option)?.textContent?.trim();
  const labels = () => options().map(labelOf);
  const activeOption = () =>
    root.querySelector(`[id="${input.getAttribute('aria-activedescendant')}"]`);
  const active = () => ({ textContent: labelOf(activeOption()), element: activeOption() });
  const type = async (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  return { fixture, root, input, listbox, options, labels, active, type };
}

describe('starCommandScore', () => {
  it('ranks prefix before word start before contains, label before keywords', () => {
    const score = (label: string, query: string, keywords?: string[]) =>
      starCommandScore({ id: label, label, keywords }, query);
    expect(score('Save all', 'sa')).toBe(0);
    expect(score('Open save dialog', 'sa')).toBe(1);
    expect(score('Unsaved changes', 'sa')).toBe(2);
    expect(score('Print', 'disk', ['disk', 'paper'])).toBe(3);
    expect(score('Print', 'paper', ['old-paper'])).toBe(4);
    expect(score('Print', 'zzz')).toBeNull();
    expect(score('Print', '  ')).toBe(0);
  });

  it('ignores case and accents', () => {
    expect(starCommandScore({ id: 'a', label: 'Open Café menu' }, 'CAFE')).toBe(1);
    expect(starCommandScore({ id: 'a', label: 'Open cafe menu' }, 'café')).toBe(1);
  });
});

describe('StarCommandPalette', () => {
  it('is a dialog with a combobox that controls a listbox', async () => {
    const { root, input, listbox } = await setup();
    const dialog = root.querySelector('dialog')!;
    expect(dialog.getAttribute('aria-label')).toBe('Command palette');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(input.getAttribute('placeholder')).toBe('Type a command or search');
  });

  it('opens and closes with the global shortcut, Control or Command', async () => {
    const { fixture, input } = await setup();
    const event = key(document.body, 'k', { ctrlKey: true });
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.open()).toBe(true);
    // jsdom has no showModal(), so the focus move to the field is checked in the e2e tests.
    key(input, 'K', { metaKey: true });
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    // Other modifiers do not match.
    key(document.body, 'k', { ctrlKey: true, shiftKey: true });
    key(document.body, 'k');
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('takes another hotkey, ignores a one-key hotkey in a field, and can turn it off', async () => {
    const { fixture, root } = await setup();
    fixture.componentInstance.hotkey.set('/');
    await fixture.whenStable();
    key(root.querySelector('.outside')!, '/');
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    key(document.body, '/');
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(true);

    fixture.componentInstance.open.set(false);
    fixture.componentInstance.hotkey.set(null);
    await fixture.whenStable();
    key(document.body, 'k', { ctrlKey: true });
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('shows the groups with headings, icons and shortcuts', async () => {
    const { root, options, labels } = await setup();
    const groups = [...root.querySelectorAll('[role=listbox] > [role=group]')];
    expect(groups.length).toBe(3);
    // Commands without a group come first (they appear first in their best-rank order).
    const headings = groups.map((group) => {
      const id = group.getAttribute('aria-labelledby');
      return id ? root.querySelector(`[id="${id}"]`)?.textContent?.trim() : null;
    });
    expect(headings).toEqual(['File', 'Go to', null]);
    expect(labels()).toEqual([
      'New file',
      'Save all',
      'Print',
      'Open café menu',
      'Settings',
      'Toggle theme',
    ]);
    expect(options()[0].querySelector('kbd')?.textContent).toBe('Ctrl+N');
    expect(options()[0].querySelector('i')?.getAttribute('aria-hidden')).toBe('true');
    expect(options()[2].getAttribute('aria-disabled')).toBe('true');
  });

  it('filters and ranks, and announces the count', async () => {
    const { root, labels, type } = await setup();
    await type('se');
    expect(labels()).toEqual(['Settings']);
    // Word start ("menu") before contains ("theme"); the group of the best match comes first.
    await type('me');
    expect(labels()).toEqual(['Open café menu', 'Toggle theme']);
    // Label prefix ("Print") before keyword prefix ("preferences").
    await type('pr');
    expect(labels()).toEqual(['Print', 'Settings']);
    await type('disk');
    expect(labels()).toEqual(['Save all']);
    await type('CAFE');
    expect(labels()).toEqual(['Open café menu']);
    await type('zzz');
    expect(labels()).toEqual([]);
    // No options: no empty listbox, and the combobox is collapsed.
    expect(root.querySelector('.star-command-palette__list')?.hasAttribute('role')).toBe(false);
    expect(root.querySelector('[role=combobox]')?.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('.star-command-palette__message')?.textContent?.trim()).toBe(
      'No results found',
    );
    expect(root.querySelector('[aria-live]')?.textContent?.trim()).toBe('');
  });

  it('moves the active option with the arrow keys and skips disabled ones', async () => {
    const { fixture, input, active } = await setup();
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(active().textContent).toBe('New file');
    expect(active().element?.getAttribute('aria-selected')).toBe('true');
    key(input, 'ArrowDown');
    await fixture.whenStable();
    expect(active().textContent).toBe('Save all');
    key(input, 'ArrowDown');
    await fixture.whenStable();
    expect(active().textContent).toBe('Open café menu');
    key(input, 'ArrowUp');
    key(input, 'ArrowUp');
    key(input, 'ArrowUp');
    await fixture.whenStable();
    // Wraps to the last option.
    expect(active().textContent).toBe('Toggle theme');
    key(input, 'PageUp');
    await fixture.whenStable();
    expect(active().textContent).toBe('New file');
  });

  it('runs the active command with Enter, closes, and lists it as recent', async () => {
    const { fixture, input, labels, root, type } = await setup();
    const run: string[] = [];
    fixture.componentInstance.commands.set(
      COMMANDS.map((command) => ({ ...command, run: (c: StarCommand) => run.push(c.id) })),
    );
    fixture.componentInstance.palette().show();
    await fixture.whenStable();
    await type('sett');
    const event = key(input, 'Enter');
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(run).toEqual(['settings']);
    expect(fixture.componentInstance.ran).toEqual(['settings']);
    expect(fixture.componentInstance.open()).toBe(false);

    fixture.componentInstance.palette().show();
    await fixture.whenStable();
    expect(input.value).toBe('');
    const first = root.querySelector('[role=listbox] > [role=group]')!;
    expect(
      root.querySelector(`[id="${first.getAttribute('aria-labelledby')}"]`)?.textContent?.trim(),
    ).toBe('Recent');
    // The recent command is not listed twice.
    expect(labels().filter((label) => label === 'Settings').length).toBe(1);
    expect(labels()[0]).toBe('Settings');
  });

  it('runs a command on click, but not a disabled one', async () => {
    const { fixture, options } = await setup();
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    options()[2].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.ran).toEqual([]);
    expect(fixture.componentInstance.open()).toBe(true);
    options()[5].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.ran).toEqual(['theme']);
  });

  it('closes on Escape (cancel) without running a command', async () => {
    const { fixture, root } = await setup();
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    const cancel = new Event('cancel', { cancelable: true });
    root.querySelector('dialog')!.dispatchEvent(cancel);
    await fixture.whenStable();
    expect(cancel.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.open()).toBe(false);
    expect(fixture.componentInstance.ran).toEqual([]);
  });

  it('uses the command, empty and loading slots', async () => {
    const { fixture, root, type } = await setup();
    fixture.componentInstance.custom.set(true);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(root.querySelector('.custom')?.textContent).toBe('New file *');
    await type('zzz');
    expect(root.querySelector('.star-command-palette__message')?.textContent?.trim()).toBe(
      'Nothing for zzz',
    );
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();
    expect(root.querySelector('.star-command-palette__message')?.textContent?.trim()).toBe(
      'Fetching',
    );
    expect(root.querySelector('.star-command-palette__list')?.getAttribute('aria-busy')).toBe(
      'true',
    );
  });

  it('reads its texts from STAR_UI_TEXT', async () => {
    TestBed.configureTestingModule({
      providers: [provideStarUiText({ commandPalette: 'Befehle', commandPlaceholder: 'Suchen…' })],
    });
    const { root, input } = await setup();
    expect(root.querySelector('dialog')?.getAttribute('aria-label')).toBe('Befehle');
    expect(input.getAttribute('placeholder')).toBe('Suchen…');
  });
});
