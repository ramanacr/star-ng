import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  StarFileCreateFolderEvent,
  StarFileItem,
  StarFileItemsEvent,
  StarFileManager,
  StarFileOpenEvent,
  StarFileProvider,
  StarFileRenameEvent,
  StarFileTransferEvent,
  StarFileUploadEvent,
} from '@star-ng/ui/file-manager';
import { DOCS, DocsRow } from '../shared/docs';

const PROJECT: readonly StarFileItem[] = [
  { id: 'project', name: 'Project Atlas', isFolder: true, parentId: null },
  { id: 'design', name: 'Design', isFolder: true, parentId: 'project' },
  { id: 'reports', name: 'Reports', isFolder: true, parentId: 'project' },
  { id: 'archive', name: 'Archive', isFolder: true, parentId: 'project' },
  {
    id: 'plan',
    name: 'Project plan.pdf',
    isFolder: false,
    parentId: 'project',
    size: 482_133,
    type: 'PDF document',
    modified: '2026-10-02T09:30:00Z',
    icon: 'ph-bold ph-file-pdf',
  },
  {
    id: 'budget',
    name: 'Budget.csv',
    isFolder: false,
    parentId: 'project',
    size: 12_904,
    type: 'CSV table',
    modified: '2026-10-14T15:10:00Z',
    icon: 'ph-bold ph-file-csv',
  },
  {
    id: 'notes',
    name: 'Meeting notes.txt',
    isFolder: false,
    parentId: 'project',
    size: 3_120,
    type: 'Text',
    modified: '2026-11-03T11:45:00Z',
    icon: 'ph-bold ph-file-text',
  },
  {
    id: 'mockup',
    name: 'Order form.png',
    isFolder: false,
    parentId: 'design',
    size: 1_204_331,
    type: 'PNG image',
    modified: '2026-09-21T08:00:00Z',
    icon: 'ph-bold ph-file-image',
  },
  {
    id: 'q3',
    name: 'Q3 invoices.csv',
    isFolder: false,
    parentId: 'reports',
    size: 48_210,
    type: 'CSV table',
    modified: '2026-10-01T07:20:00Z',
    icon: 'ph-bold ph-file-csv',
  },
];

@Component({
  selector: 'docs-file-manager-page',
  imports: [DOCS, StarFileManager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="File manager"
      lead="A folder tree, a path, a toolbar and the folder content as a sortable table or large icons. Every operation is an event that the owner applies: the file manager never changes the items. The Kendo UI and Syncfusion equivalent is FileManager; the DevExtreme equivalent is dxFileManager."
      importFrom="import { StarFileManager } from '@star-ng/ui/file-manager';"
    >
      <docs-example
        heading="Project folder"
        source="file-manager/project"
        [script]="projectScript"
        note="Drag files onto a folder to move them (hold Control to copy), or use Control+X and Control+V. Right click or Shift+F10 opens the context menu. Delete asks for a confirmation first."
      >
        <div class="docs-stack">
          <star-file-manager
            [items]="files()"
            [(folder)]="folder"
            detailsPane
            (open)="onOpen($event)"
            (rename)="onRename($event)"
            (delete)="onDelete($event)"
            (move)="onMove($event)"
            (copy)="onCopy($event)"
            (createFolder)="onCreateFolder($event)"
            (upload)="onUpload($event)"
            (download)="onDownload($event)"
          />
          <p class="docs-output" role="status">{{ log() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Large icons and a provider"
        source="file-manager/provider"
        [script]="providerScript"
        note="A provider lists one folder at a time; the file manager reads it through resource() and calls the provider after each operation. The library makes no network call: here the provider reads an array."
      >
        <star-file-manager
          [provider]="provider"
          view="large-icons"
          height="22rem"
          ariaLabel="Shared files"
        />
      </docs-example>

      <docs-api [of]="['StarFileManager']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class FileManagerPage {
  protected readonly files = signal<readonly StarFileItem[]>(PROJECT);
  protected readonly folder = signal<string | null>('project');
  protected readonly log = signal('No operation yet.');
  private next = 1;

  protected onOpen(event: StarFileOpenEvent): void {
    if (!event.item.isFolder) this.log.set(`Open ${event.item.name}`);
  }

  protected onRename({ item, name }: StarFileRenameEvent): void {
    this.update((file) => (file.id === item.id ? { ...file, name } : file));
    this.log.set(`Renamed ${item.name} to ${name}`);
  }

  protected onDelete({ items }: StarFileItemsEvent): void {
    const gone = new Set(items.map((item) => item.id));
    // A deleted folder takes its content with it.
    let size = -1;
    while (size !== gone.size) {
      size = gone.size;
      for (const file of this.files())
        if (file.parentId && gone.has(file.parentId)) gone.add(file.id);
    }
    this.files.update((files) => files.filter((file) => !gone.has(file.id)));
    this.log.set(`Deleted ${items.length} item(s)`);
  }

  protected onMove({ items, targetId }: StarFileTransferEvent): void {
    const ids = new Set(items.map((item) => item.id));
    this.update((file) => (ids.has(file.id) ? { ...file, parentId: targetId } : file));
    this.log.set(`Moved ${items.length} item(s)`);
  }

  protected onCopy({ items, targetId }: StarFileTransferEvent): void {
    const copies = items.map((item) => ({
      ...item,
      id: `copy-${this.next++}`,
      parentId: targetId,
    }));
    this.files.update((files) => [...files, ...copies]);
    this.log.set(`Copied ${items.length} item(s)`);
  }

  protected onCreateFolder({ parentId, name }: StarFileCreateFolderEvent): void {
    const folder = { id: `folder-${this.next++}`, name, isFolder: true, parentId };
    this.files.update((files) => [...files, folder]);
    this.log.set(`Created ${name}`);
  }

  protected onUpload({ folderId, files }: StarFileUploadEvent): void {
    const added = files.map((file) => ({
      id: `file-${this.next++}`,
      name: file.name,
      isFolder: false,
      parentId: folderId,
      size: file.size,
      type: file.type || 'File',
      modified: new Date().toISOString(),
    }));
    this.files.update((list) => [...list, ...added]);
    this.log.set(`Uploaded ${files.length} file(s)`);
  }

  protected onDownload({ items }: StarFileItemsEvent): void {
    this.log.set(`Download ${items.map((item) => item.name).join(', ')}`);
  }

  private update(change: (file: StarFileItem) => StarFileItem): void {
    this.files.update((files) => files.map(change));
  }

  /** A provider over an array: a real one calls a server. */
  protected readonly provider: StarFileProvider = (() => {
    let store: StarFileItem[] = PROJECT.map((item) => ({ ...item }));
    let id = 1;
    return {
      list: async (folderId) => store.filter((item) => item.parentId === folderId),
      rename: (item, name) => {
        store = store.map((file) => (file.id === item.id ? { ...file, name } : file));
      },
      delete: (items) => {
        const gone = new Set(items.map((item) => item.id));
        store = store.filter((file) => !gone.has(file.id));
      },
      createFolder: (parentId, name) => {
        store = [...store, { id: `shared-${id++}`, name, isFolder: true, parentId }];
      },
      move: (items, targetId) => {
        const ids = new Set(items.map((item) => item.id));
        store = store.map((file) => (ids.has(file.id) ? { ...file, parentId: targetId } : file));
      },
      copy: (items, targetId) => {
        store = [
          ...store,
          ...items.map((item) => ({ ...item, id: `shared-${id++}`, parentId: targetId })),
        ];
      },
    };
  })();

  protected readonly projectScript = `readonly files = signal<readonly StarFileItem[]>([
  { id: 'project', name: 'Project Atlas', isFolder: true, parentId: null },
  { id: 'design', name: 'Design', isFolder: true, parentId: 'project' },
  { id: 'plan', name: 'Project plan.pdf', isFolder: false, parentId: 'project', size: 482133, type: 'PDF document' },
  // …
]);
readonly folder = signal<string | null>('project');

// The file manager never changes the items: each handler applies the change.
onRename({ item, name }: StarFileRenameEvent): void {
  this.files.update((files) => files.map((f) => (f.id === item.id ? { ...f, name } : f)));
}
onMove({ items, targetId }: StarFileTransferEvent): void {
  const ids = new Set(items.map((item) => item.id));
  this.files.update((files) => files.map((f) => (ids.has(f.id) ? { ...f, parentId: targetId } : f)));
}
// Call event.cancel() in a handler to stop an operation.`;

  protected readonly providerScript = `readonly provider: StarFileProvider = {
  list: (folderId) => this.http.get<StarFileItem[]>('/api/files', { params: { folder: folderId ?? '' } }),
  rename: (item, name) => this.http.patch(\`/api/files/\${item.id}\`, { name }),
  delete: (items) => this.http.post('/api/files/delete', items.map((i) => i.id)),
  createFolder: (parentId, name) => this.http.post('/api/folders', { parentId, name }),
  move: (items, targetId) => this.http.post('/api/files/move', { ids: items.map((i) => i.id), targetId }),
  copy: (items, targetId) => this.http.post('/api/files/copy', { ids: items.map((i) => i.id), targetId }),
};`;

  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-fm-height',
      description: 'Height of the file manager (the height input sets it).',
    },
    { name: '--star-surface-muted', description: 'Background of the toolbar.' },
    { name: '--star-primary-soft', description: 'Background of selected icons and pressed tools.' },
    { name: '--star-accent', description: 'Focus ring and drop target outline.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow keys',
      description: 'Move between items (rows, or icons in the grid). Shift extends the selection.',
    },
    { name: 'Space', description: 'Selects the focused item (Control: adds or removes it).' },
    { name: 'Enter', description: 'Opens the focused folder or file.' },
    { name: 'Backspace or Alt + Arrow up', description: 'Goes to the parent folder.' },
    { name: 'Control + A', description: 'Selects every item of the folder.' },
    {
      name: 'Control + X / C / V',
      description: 'Cuts or copies the selection, then pastes it into the open folder.',
    },
    { name: 'F2', description: 'Renames the focused item. Enter saves, Escape cancels.' },
    { name: 'Delete', description: 'Deletes the selection after a confirmation.' },
    { name: 'Shift + F10 or the context menu key', description: 'Opens the context menu.' },
  ];
}
