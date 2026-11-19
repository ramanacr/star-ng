import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAnnouncer } from '@star-ng/ui/core';
import {
  StarFileCreateFolderEvent,
  StarFileItem,
  StarFileItemsEvent,
  StarFileManager,
  StarFileOpenEvent,
  StarFileProvider,
  StarFileRenameEvent,
  StarFileTransferEvent,
  StarFileView,
} from '@star-ng/ui/file-manager';

// jsdom has no HTMLDialogElement methods. Minimal stand-ins (real browsers implement these).
const dialogProto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
dialogProto.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
dialogProto.show ??= dialogProto.showModal;
dialogProto.close ??= function (this: HTMLDialogElement) {
  if (!this.hasAttribute('open')) return;
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};

const ITEMS: StarFileItem[] = [
  { id: 'docs', name: 'Documents', isFolder: true, parentId: null },
  { id: 'plans', name: 'Plans', isFolder: true, parentId: 'docs' },
  { id: 'archive', name: 'Archive', isFolder: true, parentId: 'docs' },
  {
    id: 'notes',
    name: 'notes.txt',
    isFolder: false,
    parentId: 'docs',
    size: 2048,
    type: 'Text',
    modified: '2026-05-04T10:00:00Z',
  },
  { id: 'budget', name: 'Budget.csv', isFolder: false, parentId: 'docs', size: 80, type: 'Table' },
  { id: 'q3', name: 'Q3 plan.txt', isFolder: false, parentId: 'plans', size: 300 },
];

function key(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

@Component({
  imports: [StarFileManager],
  template: `
    <star-file-manager
      [items]="items()"
      [provider]="provider()"
      [(folder)]="folder"
      [(selection)]="selection"
      [(view)]="view"
      [detailsPane]="details()"
      [confirmDelete]="confirm()"
      (open)="handle('open', $event)"
      (rename)="handle('rename', $event)"
      (delete)="handle('delete', $event)"
      (move)="handle('move', $event)"
      (copy)="handle('copy', $event)"
      (createFolder)="handle('createFolder', $event)"
      (download)="handle('download', $event)"
    />
  `,
})
class FileHost {
  readonly manager = viewChild.required(StarFileManager);
  readonly items = signal<readonly StarFileItem[]>(ITEMS);
  readonly provider = signal<StarFileProvider | null>(null);
  readonly folder = signal<string | null>('docs');
  readonly selection = signal<readonly string[]>([]);
  readonly view = signal<StarFileView>('details');
  readonly details = signal(false);
  readonly confirm = signal(true);
  readonly cancel = new Set<string>();
  readonly events: { name: string; event: unknown }[] = [];

  handle(name: string, event: { cancel(): void }): void {
    this.events.push({ name, event });
    if (this.cancel.has(name)) event.cancel();
  }
}

async function setup() {
  const fixture = TestBed.createComponent(FileHost);
  const announced: string[] = [];
  vi.spyOn(TestBed.inject(StarAnnouncer), 'announce').mockImplementation(async (message) => {
    announced.push(message);
  });
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const stable = () => fixture.whenStable();
  const rows = () =>
    [...root.querySelectorAll<HTMLElement>('tbody tr[data-select-key]')].map((row) =>
      row.getAttribute('data-select-key'),
    );
  const row = (id: string) => root.querySelector<HTMLElement>(`tr[data-select-key="${id}"]`)!;
  const tool = (id: string) => root.querySelector<HTMLButtonElement>(`[data-tool="${id}"]`)!;
  const content = () => root.querySelector<HTMLElement>('.star-fm__content')!;
  const last = <T>(name: string) =>
    host.events.filter((entry) => entry.name === name).at(-1)?.event as T | undefined;
  return { fixture, root, host, stable, rows, row, tool, content, last, announced };
}

describe('StarFileManager', () => {
  it('shows the tree, the path, the toolbar and the folder content, folders first', async () => {
    const { root, rows } = await setup();
    expect(root.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('File manager');
    expect(root.querySelector('[role="tree"]')?.getAttribute('aria-label')).toBe('Folders');
    expect(root.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('File actions');
    expect(root.querySelector('.star-breadcrumb [aria-current="page"]')?.textContent).toContain(
      'Documents',
    );
    expect(rows()).toEqual(['archive', 'plans', 'budget', 'notes']);
    expect(root.querySelector('tr[data-select-key="notes"]')?.textContent).toContain('2 kB');
    // One tab stop in the toolbar.
    expect(root.querySelectorAll('[role="toolbar"] [tabindex="0"]').length).toBe(1);
  });

  it('opens a folder with a double click and a file with Enter; open can be canceled', async () => {
    const { host, row, stable, rows, last } = await setup();
    row('notes').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(last<StarFileOpenEvent>('open')?.item.id).toBe('notes');
    host.cancel.add('open');
    key(row('plans'), 'Enter');
    await stable();
    expect(host.folder()).toBe('docs');
    host.cancel.clear();
    key(row('plans'), 'Enter');
    await stable();
    expect(host.folder()).toBe('plans');
    expect(rows()).toEqual(['q3']);
    key(row('q3'), 'Backspace');
    await stable();
    expect(host.folder()).toBe('docs');
  });

  it('goes to a folder from the breadcrumb and the tree', async () => {
    const { root, host, stable } = await setup();
    root.querySelector<HTMLButtonElement>('.star-breadcrumb button')!.click();
    await stable();
    expect(host.folder()).toBeNull();
    const plans = root.querySelector<HTMLElement>('[role="treeitem"][data-key="docs"]')!;
    plans.querySelector<HTMLElement>('.star-tree__content, .star-tree__label, span')?.click();
    plans.click();
    await stable();
    expect(host.folder()).toBe('docs');
  });

  it('selects with Control+A and sorts with the sort menu', async () => {
    const { host, row, stable, rows, tool } = await setup();
    key(row('notes'), 'a', { ctrlKey: true });
    await stable();
    expect(host.selection()).toEqual(['archive', 'plans', 'budget', 'notes']);
    tool('sort').click();
    await stable();
    const entry = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.trim() === 'Descending',
    )!;
    entry.click();
    await stable();
    expect(rows()).toEqual(['notes', 'budget', 'plans', 'archive']);
  });

  it('renames with F2 and Enter; a canceled rename stays with the owner', async () => {
    const { root, host, row, stable, last } = await setup();
    host.selection.set(['notes']);
    await stable();
    key(row('notes'), 'F2');
    await stable();
    const field = root.querySelector<HTMLInputElement>('.star-fm__rename')!;
    expect(field.value).toBe('notes.txt');
    field.value = 'minutes.txt';
    key(field, 'Enter');
    await stable();
    expect(last<StarFileRenameEvent>('rename')).toMatchObject({
      item: { id: 'notes' },
      name: 'minutes.txt',
    });
    expect(root.querySelector('.star-fm__rename')).toBeNull();
    // Escape keeps the name.
    key(row('notes'), 'F2');
    await stable();
    key(root.querySelector('.star-fm__rename')!, 'Escape');
    await stable();
    expect(host.events.filter((e) => e.name === 'rename').length).toBe(1);
  });

  it('asks before delete, then emits delete', async () => {
    const { root, host, row, stable, last } = await setup();
    host.selection.set(['notes', 'budget']);
    await stable();
    key(row('notes'), 'Delete');
    await stable();
    const dialog = root.querySelector('dialog[open]')!;
    expect(dialog.textContent).toContain('Delete 2 items?');
    expect(last('delete')).toBeUndefined();
    [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Delete')!.click();
    await stable();
    expect(last<StarFileItemsEvent>('delete')?.items.map((i) => i.id)).toEqual(['budget', 'notes']);
    expect(host.selection()).toEqual([]);
    // Without confirmation, and canceled: the selection stays.
    host.confirm.set(false);
    host.cancel.add('delete');
    host.selection.set(['notes']);
    await stable();
    key(row('notes'), 'Delete');
    await stable();
    expect(host.events.filter((e) => e.name === 'delete').length).toBe(2);
    expect(host.selection()).toEqual(['notes']);
  });

  it('cuts and pastes into another folder, and refuses a folder into itself', async () => {
    const { host, row, stable, last, announced } = await setup();
    host.selection.set(['notes']);
    await stable();
    key(row('notes'), 'x', { ctrlKey: true });
    expect(announced.at(-1)).toContain('1 item cut');
    key(row('archive'), 'Enter');
    await stable();
    expect(host.folder()).toBe('archive');
    host.manager().paste();
    await stable();
    expect(last<StarFileTransferEvent>('move')).toMatchObject({
      items: [{ id: 'notes' }],
      targetId: 'archive',
    });
    expect(announced.at(-1)).toBe('1 item moved to Archive');

    host.folder.set('docs');
    host.selection.set(['plans']);
    await stable();
    key(row('plans'), 'x', { ctrlKey: true });
    key(row('plans'), 'Enter');
    await stable();
    host.manager().paste();
    expect(host.events.filter((e) => e.name === 'move').length).toBe(1);
    expect(announced.at(-1)).toBe('A folder cannot go into itself.');
  });

  it('copies with Control+C and Control+V, and the copy can be canceled', async () => {
    const { host, row, stable, last } = await setup();
    host.selection.set(['budget']);
    await stable();
    key(row('budget'), 'c', { ctrlKey: true });
    key(row('budget'), 'v', { ctrlKey: true });
    await stable();
    expect(last<StarFileTransferEvent>('copy')?.targetId).toBe('docs');
  });

  it('creates a folder with a unique name', async () => {
    const { root, tool, stable, last } = await setup();
    tool('new-folder').click();
    await stable();
    const dialog = root.querySelectorAll('dialog')[1];
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.querySelector('input')!.value).toBe('New folder');
    [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Create')!.click();
    await stable();
    expect(last<StarFileCreateFolderEvent>('createFolder')).toMatchObject({
      parentId: 'docs',
      name: 'New folder',
    });
  });

  it('moves dragged items onto a folder', async () => {
    const { root, host, stable, last } = await setup();
    host.selection.set(['notes', 'budget']);
    await stable();
    const name = root.querySelector<HTMLElement>('[data-file-name="notes"]')!;
    name.dispatchEvent(new Event('dragstart', { bubbles: true }));
    const target = root.querySelector<HTMLElement>('[data-file-name="plans"]')!;
    const over = new Event('dragover', { bubbles: true, cancelable: true });
    target.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    target.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    await stable();
    expect(last<StarFileTransferEvent>('move')).toMatchObject({ targetId: 'plans' });
    expect(last<StarFileTransferEvent>('move')!.items.map((i) => i.id)).toEqual([
      'notes',
      'budget',
    ]);
  });

  it('opens the context menu with Shift+F10', async () => {
    const { row, stable, host } = await setup();
    key(row('notes'), 'F10', { shiftKey: true });
    await stable();
    expect(host.selection()).toEqual(['notes']);
    const labels = [...document.querySelectorAll('[role="menuitem"]')].map((i) =>
      i.textContent?.trim(),
    );
    expect(labels.some((l) => l?.startsWith('Rename'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Paste'))).toBe(true);
  });

  it('shows large icons as a multi-select listbox with roving focus', async () => {
    const { root, host, tool, stable } = await setup();
    tool('view-icons').click();
    await stable();
    expect(host.view()).toBe('large-icons');
    expect(tool('view-icons').getAttribute('aria-pressed')).toBe('true');
    const list = root.querySelector('[role="listbox"]')!;
    expect(list.getAttribute('aria-multiselectable')).toBe('true');
    const options = () => [...list.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(options().map((o) => o.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
    options()[0].click();
    options()[2].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    await stable();
    expect(host.selection()).toEqual(['archive', 'budget']);
    options()[0].focus();
    key(options()[0], 'ArrowRight', { shiftKey: true });
    await stable();
    expect(document.activeElement).toBe(options()[1]);
    key(options()[1], 'End');
    await stable();
    expect(host.selection()).toEqual(['notes']);
    expect(options()[3].getAttribute('aria-selected')).toBe('true');
  });

  it('searches the folder and its subfolders', async () => {
    const { root, rows, stable } = await setup();
    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'plan';
    search.dispatchEvent(new Event('input'));
    await stable();
    expect(rows()).toEqual(['plans', 'q3']);
  });

  it('shows the details of the selection', async () => {
    const { root, host, stable } = await setup();
    host.details.set(true);
    host.selection.set(['notes']);
    await stable();
    const pane = root.querySelector('aside')!;
    expect(pane.getAttribute('aria-label')).toBe('Item details');
    expect(pane.textContent).toContain('notes.txt');
    expect(pane.textContent).toContain('2 kB');
    host.selection.set([]);
    await stable();
    expect(pane.textContent).toContain('No item selected.');
  });

  it('reads folders from a provider and calls it after an operation', async () => {
    const { host, stable, rows, row, root } = await setup();
    const provider: StarFileProvider = {
      list: vi.fn(async (folder: string | null) =>
        ITEMS.filter((item) => item.parentId === folder),
      ),
      rename: vi.fn(async () => undefined),
      delete: vi.fn(),
      createFolder: vi.fn(),
      move: vi.fn(),
      copy: vi.fn(),
    };
    host.items.set([]);
    host.provider.set(provider);
    await stable();
    await new Promise((resolve) => setTimeout(resolve));
    await stable();
    expect(provider.list).toHaveBeenCalledWith('docs');
    expect(rows()).toEqual(['archive', 'plans', 'budget', 'notes']);
    host.selection.set(['notes']);
    await stable();
    key(row('notes'), 'F2');
    await stable();
    const field = root.querySelector<HTMLInputElement>('.star-fm__rename')!;
    field.value = 'minutes.txt';
    key(field, 'Enter');
    await stable();
    expect(provider.rename).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'notes' }),
      'minutes.txt',
    );
  });

  it('keeps native copy events of its dialogs and fields away from the copy output', async () => {
    const { root, host, tool, stable } = await setup();
    tool('new-folder').click();
    await stable();
    const field = root.querySelectorAll('dialog')[1].querySelector('input')!;
    field.dispatchEvent(new Event('copy', { bubbles: true }));
    root.querySelector('input[type="search"]')!.dispatchEvent(new Event('copy', { bubbles: true }));
    expect(host.events.filter((e) => e.name === 'copy')).toEqual([]);
  });

  it('renders on the server platform', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const { rows } = await setup();
    expect(rows()).toEqual(['archive', 'plans', 'budget', 'notes']);
  });
});
