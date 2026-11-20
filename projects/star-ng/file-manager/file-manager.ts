import { _IdGenerator } from '@angular/cdk/a11y';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  OutputEmitterRef,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { StarBreadcrumb, StarBreadcrumbItem } from '@star-ng/ui/breadcrumb';
import { StarButton } from '@star-ng/ui/button';
import {
  STAR_UI_TEXT,
  StarAnnouncer,
  starFormatFileSize,
  starInlineKey,
  starIsRtl,
} from '@star-ng/ui/core';
import { StarDialog } from '@star-ng/ui/dialog';
import { StarFileUpload } from '@star-ng/ui/file-upload';
import { StarContextMenu, StarMenu, StarMenuItem, StarMenuTrigger } from '@star-ng/ui/menu';
import { StarCellTemplate, StarColumn, StarTable } from '@star-ng/ui/table';
import { StarTree } from '@star-ng/ui/tree';
import { StarFileSizePipe } from '@star-ng/ui/utility';
import { firstValueFrom, isObservable, Observable } from 'rxjs';
import {
  starCanDrop,
  starFileChildren,
  StarFileItem,
  starFilePath,
  starFileSelection,
  StarFileSelectMode,
  StarFileSortField,
  starFolderTree,
  starSearchFiles,
  starSortFiles,
  starUniqueName,
} from './file-manager-model';

/** The result of a provider call: a value, a promise or an observable (the first value counts). */
export type StarFileResult<T> = T | Promise<T> | Observable<T>;

/**
 * Data source of `star-file-manager` instead of `items` (Syncfusion `ajaxSettings`, Kendo
 * `dataSource`, DevExtreme `fileSystemProvider`). The library makes no network call: the provider
 * does. `list` is read through Angular `resource()`; after an operation that no handler canceled,
 * the file manager calls the matching method and reads the open folders again.
 */
export interface StarFileProvider {
  /** The items directly in a folder (`null`: the top folder). */
  list(folderId: string | null): StarFileResult<readonly StarFileItem[]>;
  rename(item: StarFileItem, name: string): StarFileResult<unknown>;
  delete(items: readonly StarFileItem[]): StarFileResult<unknown>;
  createFolder(parentId: string | null, name: string): StarFileResult<unknown>;
  move(items: readonly StarFileItem[], targetId: string | null): StarFileResult<unknown>;
  copy(items: readonly StarFileItem[], targetId: string | null): StarFileResult<unknown>;
  upload?(folderId: string | null, files: readonly File[]): StarFileResult<unknown>;
  download?(items: readonly StarFileItem[]): StarFileResult<unknown>;
}

/** Shared part of the file manager events: call `cancel()` in the handler to stop the operation. */
export interface StarFileCancelable {
  cancel(): void;
  readonly canceled: boolean;
}

/** `open`: a double click or Enter on an item. A folder opens unless a handler cancels. */
export interface StarFileOpenEvent extends StarFileCancelable {
  readonly item: StarFileItem;
}
/** `rename`: the new name of an item. Rename it in `items`. */
export interface StarFileRenameEvent extends StarFileCancelable {
  readonly item: StarFileItem;
  readonly name: string;
}
/** `delete`, `download`: the items, after the confirmation of a delete. */
export interface StarFileItemsEvent extends StarFileCancelable {
  readonly items: readonly StarFileItem[];
}
/** `move` and `copy`: the items and the target folder (`null`: the top folder). */
export interface StarFileTransferEvent extends StarFileCancelable {
  readonly items: readonly StarFileItem[];
  readonly targetId: string | null;
}
/** `createFolder`: the name of a new folder in `parentId`. */
export interface StarFileCreateFolderEvent extends StarFileCancelable {
  readonly parentId: string | null;
  readonly name: string;
}
/** `upload`: the files the user chose for `folderId`. */
export interface StarFileUploadEvent extends StarFileCancelable {
  readonly folderId: string | null;
  readonly files: readonly File[];
}

/** A provider call that can fail. */
export type StarFileOperation =
  'list' | 'rename' | 'delete' | 'createFolder' | 'move' | 'copy' | 'upload' | 'download';

/** `error`: a provider call failed. The file manager announces it; a failed `list` shows an error state. */
export interface StarFileErrorEvent {
  readonly operation: StarFileOperation;
  /** What the provider threw or rejected with. */
  readonly error: unknown;
  /** The folder of a failed `list`. */
  readonly folderId?: string | null;
}

/** View of the content: a sortable table or a grid of large icons. */
export type StarFileView = 'details' | 'large-icons';

/** Emits a cancelable event; `true` when no handler called `cancel()`. */
function emitCancelable<E extends StarFileCancelable>(
  emitter: OutputEmitterRef<E>,
  payload: Omit<E, 'cancel' | 'canceled'>,
): boolean {
  let canceled = false;
  emitter.emit({
    ...payload,
    cancel: () => {
      canceled = true;
    },
    get canceled() {
      return canceled;
    },
  } as unknown as E);
  return !canceled;
}

function settle<T>(result: StarFileResult<T>): Promise<T> {
  return isObservable(result) ? firstValueFrom(result) : Promise.resolve(result);
}

const SORT_FIELDS: readonly StarFileSortField[] = ['name', 'size', 'modified', 'type'];

/**
 * File manager (Kendo `FileManager`, Syncfusion `ejs-filemanager`, DevExtreme `dxFileManager`):
 * folder tree, breadcrumb, toolbar, search, a details table or large icons, and an optional
 * details pane.
 *
 * - Data: `items` (all files and folders), or a `provider` that lists one folder at a time.
 * - Every operation is an output that a handler can `cancel()`: `open`, `rename`, `delete` (after a
 *   confirmation dialog), `move`, `copy`, `createFolder`, `upload`, `download`. The file manager
 *   never changes `items`: the owner applies the change (or the provider does).
 * - Selection: click, Control+click, Shift+click, Control+A. Drag items onto a folder of the tree
 *   or the content to move them (Control: copy); the keyboard does the same with Control+X or
 *   Control+C, then Control+V in the target folder.
 * - Context menu: right click, Shift+F10 or the context menu key.
 *
 * `<star-file-manager [items]="files" [(folder)]="folder" (rename)="rename($event)" />`
 */
@Component({
  selector: 'star-file-manager',
  imports: [
    StarBreadcrumb,
    StarButton,
    StarCellTemplate,
    StarContextMenu,
    StarDialog,
    StarFileSizePipe,
    StarFileUpload,
    StarMenu,
    StarMenuTrigger,
    StarTable,
    StarTree,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-fm-host',
    '(keydown)': 'onKeydown($event)',
    '(click)': 'onClick($event)',
    '(contextmenu)': 'onContextMenu($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(dblclick)': 'onDoubleClick($event)',
    '(dragstart)': 'onDragStart($event)',
    '(dragend)': 'endDrag()',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)',
  },
  template: `
    <!-- The native copy event bubbles: it stops here, so only the copy output reaches the owner. -->
    <div class="star-fm-root" (copy)="$event.stopPropagation()">
      <div
        class="star-fm"
        role="region"
        [attr.aria-label]="ariaLabel() ?? text.fileManager"
        [style.--star-fm-height]="height()"
      >
        <div class="star-fm__bar">
          <star-breadcrumb
            class="star-fm__path"
            [items]="trail()"
            [ariaLabel]="(ariaLabel() ?? text.fileManager) + ': ' + text.breadcrumb"
          />
          <input
            type="search"
            class="star-input star-fm__search"
            [attr.aria-label]="text.search"
            [placeholder]="text.search"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        </div>

        <div class="star-fm__toolbar" role="toolbar" [attr.aria-label]="text.fileToolbar">
          @for (action of toolbar(); track action.id) {
            @if (action.id === 'sort') {
              <button
                type="button"
                class="star-fm__tool"
                data-tool="sort"
                [attr.tabindex]="toolStop() === 'sort' ? 0 : -1"
                [starMenuTrigger]="sortMenu"
                (focus)="toolStop.set('sort')"
              >
                <i class="ph-bold ph-sort-ascending" aria-hidden="true"></i>
                <span>{{ text.sortBy }}</span>
              </button>
            } @else {
              <button
                type="button"
                class="star-fm__tool"
                [attr.data-tool]="action.id"
                [attr.tabindex]="toolStop() === action.id ? 0 : -1"
                [attr.aria-disabled]="action.disabled || null"
                [attr.aria-pressed]="action.pressed ?? null"
                [attr.aria-label]="action.iconOnly ? action.label : null"
                (click)="action.disabled || action.run()"
                (focus)="toolStop.set(action.id)"
              >
                <i [class]="action.icon" aria-hidden="true"></i>
                @if (!action.iconOnly) {
                  <span>{{ action.label }}</span>
                }
              </button>
            }
          }
        </div>
        <star-menu #sortMenu [items]="sortItems()" />

        @if (uploadOpen()) {
          <div class="star-fm__upload">
            <star-file-upload multiple [(value)]="uploadFiles" (selected)="onUpload($event)" />
          </div>
        }

        <div class="star-fm__body" [class.star-fm__body--details]="detailsPane()">
          <div class="star-fm__tree">
            <star-tree
              [nodes]="tree()"
              selectionMode="single"
              [value]="[folder() ?? '']"
              (valueChange)="onTreeValue($event)"
              [(expanded)]="expanded"
              (nodeExpand)="onTreeExpand($event.node.key)"
              [ariaLabel]="text.fileFolders"
            />
          </div>

          <div
            class="star-fm__content"
            [attr.aria-describedby]="id + '-hint'"
            [starContextMenu]="contextMenu"
          >
            <p class="star-sr-only" [id]="id + '-hint'">{{ text.fileManagerHint }}</p>
            @if (listingFailed()) {
              <div class="star-fm__error" role="alert">
                <p>{{ text.fileLoadError }}</p>
                <star-button variant="secondary" size="sm" (pressed)="refresh()">{{
                  text.retry
                }}</star-button>
              </div>
            } @else if (view() === 'details') {
              <star-table
                [value]="visible()"
                [columns]="columns()"
                dataKey="id"
                size="sm"
                selectionMode="multiple"
                metaKeySelection
                [selectionKeys]="selection()"
                (selectionKeysChange)="onTableSelection($event)"
                [(sortField)]="sortField"
                [(sortOrder)]="sortOrder"
                [rowLabel]="rowLabel"
                [ariaLabel]="text.fileContent"
                [emptyMessage]="emptyText()"
              >
                <ng-template starCell="name" [starCellOf]="visible()" let-row>
                  <span
                    class="star-fm__name"
                    draggable="true"
                    [attr.data-file-name]="row.id"
                    [class.star-fm__name--drop]="dropTarget() === row.id"
                  >
                    <i [class]="iconOf(row)" aria-hidden="true"></i>
                    @if (renaming() === row.id) {
                      <input
                        class="star-input star-fm__rename"
                        [attr.aria-label]="text.rename"
                        [value]="row.name"
                        (keydown)="onRenameKey($event, row)"
                        (blur)="commitRename(row, $any($event.target).value)"
                      />
                    } @else {
                      <span>{{ row.name }}</span>
                    }
                  </span>
                </ng-template>
              </star-table>
            } @else {
              @if (visible().length) {
                <div
                  class="star-fm__icons"
                  role="listbox"
                  aria-multiselectable="true"
                  [attr.aria-label]="text.fileContent"
                >
                  @for (item of visible(); track item.id) {
                    <div
                      class="star-fm__icon"
                      draggable="true"
                      [attr.role]="renaming() === item.id ? 'group' : 'option'"
                      [attr.data-file-id]="item.id"
                      [attr.aria-selected]="renaming() === item.id ? null : isSelected(item.id)"
                      [class.star-fm__icon--selected]="isSelected(item.id)"
                      [class.star-fm__icon--cut]="isCut(item.id)"
                      [class.star-fm__icon--drop]="dropTarget() === item.id"
                      [attr.tabindex]="iconStop() === item.id ? 0 : -1"
                      (focus)="focusId.set(item.id)"
                    >
                      <i class="star-fm__icon-glyph" [class]="iconOf(item)" aria-hidden="true"></i>
                      <!-- While renaming, the item is a group: the children of an option are
                        presentational, so the field must not be inside one. -->
                      @if (renaming() === item.id) {
                        <input
                          class="star-input star-fm__rename"
                          [attr.aria-label]="text.rename"
                          [value]="item.name"
                          (click)="$event.stopPropagation()"
                          (keydown)="onRenameKey($event, item)"
                          (blur)="commitRename(item, $any($event.target).value)"
                        />
                      } @else {
                        <span class="star-fm__icon-name">{{ item.name }}</span>
                      }
                    </div>
                  }
                </div>
              } @else {
                <p class="star-fm__empty">{{ emptyText() }}</p>
              }
            }
          </div>

          @if (detailsPane()) {
            <aside class="star-fm__details" [attr.aria-label]="text.fileDetailsPane">
              @if (selectedItems(); as chosen) {
                @if (chosen.length === 1) {
                  <h3 class="star-fm__details-title">
                    <i [class]="iconOf(chosen[0])" aria-hidden="true"></i>
                    {{ chosen[0].name }}
                  </h3>
                  <dl class="star-fm__facts">
                    <dt>{{ text.fileType }}</dt>
                    <dd>{{ typeOf(chosen[0]) }}</dd>
                    @if (!chosen[0].isFolder) {
                      <dt>{{ text.fileSize }}</dt>
                      <dd>{{ chosen[0].size | starFileSize: locale() }}</dd>
                    }
                    @if (chosen[0].modified !== undefined) {
                      <dt>{{ text.fileModified }}</dt>
                      <dd>{{ dateOf(chosen[0]) }}</dd>
                    }
                  </dl>
                } @else if (chosen.length > 1) {
                  <p>{{ text.selectedItems(chosen.length) }}</p>
                } @else {
                  <p class="star-fm__muted">{{ text.fileNoSelection }}</p>
                }
              }
            </aside>
          }
        </div>
      </div>

      <star-menu #contextMenu [items]="menuItems()" />

      <star-dialog
        [(visible)]="confirmOpen"
        [header]="text.delete"
        size="sm"
        [role]="'alertdialog'"
      >
        <p>{{ text.fileDeleteConfirm(pendingDelete().length) }}</p>
        <div starDialogFooter>
          <star-button variant="ghost" (pressed)="confirmOpen.set(false)">{{
            text.cancel
          }}</star-button>
          <star-button variant="danger" (pressed)="acceptDelete()">{{ text.delete }}</star-button>
        </div>
      </star-dialog>

      <star-dialog [(visible)]="folderOpen" [header]="text.newFolder" size="sm">
        <label class="star-fm__field">
          <span>{{ text.folderName }}</span>
          <input
            class="star-input"
            data-autofocus
            [value]="folderName()"
            (input)="folderName.set($any($event.target).value)"
            (keydown.enter)="submitFolder()"
          />
        </label>
        <div starDialogFooter>
          <star-button variant="ghost" (pressed)="folderOpen.set(false)">{{
            text.cancel
          }}</star-button>
          <star-button (pressed)="submitFolder()">{{ text.create }}</star-button>
        </div>
      </star-dialog>
    </div>
  `,
})
export class StarFileManager {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly announcer = inject(StarAnnouncer);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly id = inject(_IdGenerator).getId('star-fm-');

  /** All files and folders. Not used when `provider` is set. */
  readonly items = input<readonly StarFileItem[]>([]);
  /** Lists folders on demand and runs the operations. See `StarFileProvider`. */
  readonly provider = input<StarFileProvider | null>(null);
  /** The open folder (`null`: the top folder). */
  readonly folder = model<string | null>(null);
  /** Ids of the selected items of the open folder. */
  readonly selection = model<readonly string[]>([]);
  /** `details` (table) or `large-icons` (grid). */
  readonly view = model<StarFileView>('details');
  readonly sortField = model<StarFileSortField>('name');
  readonly sortOrder = model<1 | -1>(1);
  /** Shows a pane with the details of the selection. */
  readonly detailsPane = input(false, { transform: booleanAttribute });
  /** Asks before `delete` is emitted. Default on. */
  readonly confirmDelete = input(true, { transform: booleanAttribute });
  /** Locale of sizes and dates. Default: the application locale. */
  readonly locale = input<string | null>(null);
  /** Name of the top folder. Default: the `fileRoot` text. */
  readonly rootLabel = input<string | null>(null);
  /** Height of the file manager (a CSS length). */
  readonly height = input('28rem');
  readonly ariaLabel = input<string | null>(null);

  readonly open = output<StarFileOpenEvent>();
  readonly rename = output<StarFileRenameEvent>();
  readonly delete = output<StarFileItemsEvent>();
  readonly move = output<StarFileTransferEvent>();
  // The names are the public API. The native `copy` event of the content stops at the root element.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly copy = output<StarFileTransferEvent>();
  readonly createFolder = output<StarFileCreateFolderEvent>();
  readonly upload = output<StarFileUploadEvent>();
  readonly download = output<StarFileItemsEvent>();
  /**
   * A provider call failed (Kendo `error`, DevExtreme `onErrorOccurred`). The file manager
   * announces it, and a failed listing shows an error state with a retry button.
   */
  // The name is the public API; a native `error` event of an inner element does not bubble.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly error = output<StarFileErrorEvent>();

  protected readonly query = signal('');
  protected readonly expanded = signal<readonly string[]>(['']);
  protected readonly renaming = signal<string | null>(null);
  protected readonly clipboard = signal<{ mode: 'cut' | 'copy'; ids: readonly string[] } | null>(
    null,
  );
  protected readonly dropTarget = signal<string | null | undefined>(undefined);
  protected readonly focusId = signal<string | null>(null);
  protected readonly toolStop = signal('new-folder');
  protected readonly uploadOpen = signal(false);
  protected readonly uploadFiles = signal<readonly File[]>([]);
  protected readonly confirmOpen = signal(false);
  protected readonly pendingDelete = signal<readonly StarFileItem[]>([]);
  protected readonly folderOpen = signal(false);
  protected readonly folderName = signal('');
  private anchor: string | null = null;
  private dragIds: readonly string[] = [];

  // ---------------------------------------------------------------- data

  /** Folders that the provider listed, by folder id (`''` for the top folder). */
  private readonly cache = signal<ReadonlyMap<string, readonly StarFileItem[]>>(new Map());
  private readonly version = signal(0);
  private readonly listing = resource({
    params: () => {
      const provider = this.provider();
      return provider ? { provider, folder: this.folder(), version: this.version() } : undefined;
    },
    loader: ({ params }) => settle(params.provider.list(params.folder)),
  });

  /** Every item known now: `items`, or the folders the provider listed. */
  protected readonly known = computed<readonly StarFileItem[]>(() => {
    if (!this.provider()) return this.items();
    const all = new Map<string, StarFileItem>();
    for (const list of this.cache().values()) for (const item of list) all.set(item.id, item);
    return [...all.values()];
  });

  protected readonly visible = computed(() =>
    starSortFiles(
      this.query().trim()
        ? starSearchFiles(this.known(), this.folder(), this.query())
        : starFileChildren(this.known(), this.folder()),
      this.sortField(),
      this.sortOrder(),
    ),
  );
  private readonly visibleIds = computed(() => this.visible().map((item) => item.id));

  protected readonly tree = computed(() => {
    const cache = this.provider() ? this.cache() : null;
    return starFolderTree(this.known(), this.rootLabel() ?? this.text.fileRoot, (id) =>
      cache ? cache.has(id) : true,
    );
  });

  protected readonly trail = computed<StarBreadcrumbItem[]>(() => {
    const root = this.rootLabel() ?? this.text.fileRoot;
    const path = starFilePath(this.known(), this.folder());
    return [
      { label: root, icon: 'ph-bold ph-hard-drives', command: () => this.navigate(null) },
      ...path.map((item) => ({ label: item.name, command: () => this.navigate(item.id) })),
    ];
  });

  protected readonly selectedItems = computed(() => {
    const ids = new Set(this.selection());
    return this.visible().filter((item) => ids.has(item.id));
  });

  protected readonly emptyText = computed(() =>
    this.query().trim() ? this.text.fileNoResults : this.text.fileEmptyFolder,
  );

  protected readonly columns = computed<StarColumn<StarFileItem>[]>(() => {
    const locale = this.locale() ?? undefined;
    const folderRank = (item: StarFileItem) => (item.isFolder ? '0' : '1');
    return [
      {
        field: 'name',
        header: this.text.name,
        sortable: true,
        value: (item) => folderRank(item) + item.name.toLocaleLowerCase(),
        format: (item) => item.name,
      },
      {
        field: 'modified',
        header: this.text.fileModified,
        sortable: true,
        value: (item) => {
          const ms = item.modified === undefined ? 0 : new Date(item.modified).getTime() || 0;
          return item.isFolder ? ms - 1e14 : ms;
        },
        format: (item) => this.dateOf(item),
      },
      {
        field: 'type',
        header: this.text.fileType,
        sortable: true,
        value: (item) => folderRank(item) + this.typeOf(item),
        format: (item) => this.typeOf(item),
      },
      {
        field: 'size',
        header: this.text.fileSize,
        sortable: true,
        align: 'end',
        value: (item) => (item.isFolder ? -1 : (item.size ?? 0)),
        format: (item) => (item.isFolder ? '' : starFormatFileSize(item.size ?? 0, locale)),
      },
    ];
  });

  /** The provider could not list the open folder. */
  protected readonly listingFailed = computed(
    () => !!this.provider() && this.listing.status() === 'error',
  );

  protected readonly rowLabel = (item: StarFileItem) => item.name;

  constructor() {
    // The provider listing of the open folder goes into the cache.
    effect(() => {
      // `value()` throws in the error state: read it only when there is one.
      const value = this.listing.hasValue() ? this.listing.value() : undefined;
      const provider = this.provider();
      if (!provider || !value) return;
      const key = untracked(this.folder) ?? '';
      untracked(() => this.cache.update((cache) => new Map(cache).set(key, value)));
    });
    // A failed listing: announce it and tell the owner once per failure.
    effect(() => {
      const failure = this.listing.error();
      if (!failure) return;
      untracked(() => this.fail('list', failure, this.folder()));
    });
    // The path of the open folder stays open in the tree; the selection belongs to one folder.
    effect(() => {
      const path = starFilePath(this.known(), this.folder()).map((item) => item.id);
      untracked(() => {
        const open = new Set(this.expanded());
        const missing = ['', ...path].filter((key) => !open.has(key));
        if (missing.length) this.expanded.set([...this.expanded(), ...missing]);
      });
    });
  }

  // ---------------------------------------------------------------- helpers

  protected iconOf(item: StarFileItem): string {
    return item.icon ?? (item.isFolder ? 'ph-bold ph-folder' : 'ph-bold ph-file');
  }

  protected typeOf(item: StarFileItem): string {
    return item.isFolder ? this.text.fileFolderType : (item.type ?? '');
  }

  protected dateOf(item: StarFileItem): string {
    if (item.modified === undefined) return '';
    const date = new Date(item.modified);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(this.locale() ?? undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  protected isSelected(id: string): boolean {
    return this.selection().includes(id);
  }

  protected isCut(id: string): boolean {
    const clip = this.clipboard();
    return clip?.mode === 'cut' && clip.ids.includes(id);
  }

  protected iconStop(): string | null {
    const ids = this.visibleIds();
    const focus = this.focusId();
    return focus && ids.includes(focus) ? focus : (ids[0] ?? null);
  }

  private byIds(ids: readonly string[]): StarFileItem[] {
    const byId = new Map(this.known().map((item) => [item.id, item]));
    return ids.map((id) => byId.get(id)).filter((item): item is StarFileItem => !!item);
  }

  private folderLabel(id: string | null): string {
    return id === null
      ? (this.rootLabel() ?? this.text.fileRoot)
      : (this.byIds([id])[0]?.name ?? '');
  }

  /** The item under an event target, in either view. */
  private itemAt(target: EventTarget | null): StarFileItem | null {
    const element = (target as Element | null)?.closest?.(
      '[data-file-id], [data-file-name], [data-select-key]',
    );
    const id =
      element?.getAttribute('data-file-id') ??
      element?.getAttribute('data-file-name') ??
      element?.getAttribute('data-select-key');
    return id ? (this.byIds([id])[0] ?? null) : null;
  }

  private announce(message: string): void {
    void this.announcer.announce(message);
  }

  /** Announces a failed provider call and emits `error`. */
  private fail(operation: StarFileOperation, error: unknown, folderId?: string | null): void {
    this.announcer.announce(
      operation === 'list' ? this.text.fileLoadError : this.text.fileOperationError,
      'assertive',
    );
    this.error.emit(folderId === undefined ? { operation, error } : { operation, error, folderId });
  }

  /** Runs a provider method, then reads the folders again (also after a failure). */
  private async apply(
    operation: StarFileOperation,
    call: ((provider: StarFileProvider) => unknown) | null,
    removed: readonly StarFileItem[] = [],
  ): Promise<void> {
    const provider = this.provider();
    if (!provider || !call) return;
    try {
      await settle(call(provider) as StarFileResult<unknown>);
      this.forget(removed);
    } catch (error) {
      this.fail(operation, error);
    }
    this.refresh();
  }

  /** Drops deleted folders (and their subfolders) from the open folders and the cache. */
  private forget(removed: readonly StarFileItem[]): void {
    if (!removed.length) return;
    const known = this.known();
    const gone = new Set(removed.map((item) => item.id));
    for (let size = -1; size !== gone.size;) {
      size = gone.size;
      for (const item of known) if (item.parentId && gone.has(item.parentId)) gone.add(item.id);
    }
    const open = this.folder();
    if (open !== null && gone.has(open)) {
      // The open folder went away: go to the nearest folder that is left.
      const path = starFilePath(known, open);
      const first = path.findIndex((item) => gone.has(item.id));
      this.navigate(first > 0 ? path[first - 1].id : null);
    }
    this.expanded.update((keys) => keys.filter((key) => !gone.has(key)));
    this.cache.update((cache) => new Map([...cache].filter(([key]) => !gone.has(key))));
  }

  /** Reads the open folder and the open tree folders from the provider again. */
  refresh(): void {
    const provider = this.provider();
    if (!provider) return;
    // Only the open folder and the expanded tree folders load again. Their cache entries are
    // replaced one by one when the new lists arrive, so the items (and the focus on them) stay
    // meanwhile; the other entries are dropped and load again when they are opened.
    const open = this.folder() ?? '';
    const keys = new Set([open, ...this.expanded()]);
    this.cache.update((cache) => new Map([...cache].filter(([key]) => keys.has(key))));
    this.version.update((v) => v + 1);
    for (const key of keys) {
      if (key !== (this.folder() ?? '')) void this.loadFolder(key === '' ? null : key);
    }
  }

  private async loadFolder(folderId: string | null): Promise<void> {
    const provider = this.provider();
    if (!provider) return;
    try {
      const list = await settle(provider.list(folderId));
      this.cache.update((cache) => new Map(cache).set(folderId ?? '', list));
    } catch (error) {
      this.fail('list', error, folderId);
    }
  }

  // ---------------------------------------------------------------- navigation

  /** Opens a folder (`null`: the top folder). */
  navigate(folderId: string | null): void {
    this.folder.set(folderId);
    this.selection.set([]);
    this.query.set('');
    this.renaming.set(null);
    this.anchor = null;
  }

  protected onTreeValue(value: readonly string[]): void {
    const key = value[0];
    if (key === undefined) return;
    this.navigate(key === '' ? null : key);
  }

  protected onTreeExpand(key: string): void {
    if (this.provider() && key !== '' && !this.cache().has(key)) void this.loadFolder(key);
  }

  private openItem(item: StarFileItem): void {
    if (!emitCancelable<StarFileOpenEvent>(this.open, { item })) return;
    if (item.isFolder) {
      this.navigate(item.id);
      this.focusContent();
    }
  }

  private focusContent(): void {
    if (!this.browser) return;
    afterNextRender(
      () => {
        const content = this.host.nativeElement.querySelector('.star-fm__content');
        content
          ?.querySelector<HTMLElement>('[role="option"][tabindex="0"], tbody tr[tabindex="0"]')
          ?.focus();
      },
      { injector: this.injector },
    );
  }

  // ---------------------------------------------------------------- selection

  protected onTableSelection(keys: readonly unknown[] | null): void {
    this.selection.set((keys ?? []).map(String));
  }

  private select(id: string, mode: StarFileSelectMode): void {
    const next = starFileSelection(this.visibleIds(), this.selection(), this.anchor, id, mode);
    this.anchor = next.anchor;
    this.selection.set(next.selected);
  }

  /** Selects every item of the open folder (or search result). */
  selectAll(): void {
    this.selection.set(this.visibleIds());
  }

  private onIconClick(event: MouseEvent, item: StarFileItem): void {
    this.focusId.set(item.id);
    this.select(
      item.id,
      event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'single',
    );
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 2 || this.areaOf(event) !== 'content') return;
    const item = this.itemAt(event.target);
    if (item && !this.isSelected(item.id)) this.select(item.id, 'single');
    if (!item) this.selection.set([]);
  }

  protected onDoubleClick(event: MouseEvent): void {
    if (this.areaOf(event) !== 'content') return;
    const item = this.itemAt(event.target);
    if (item && !(event.target as Element).closest('input')) this.openItem(item);
  }

  // ---------------------------------------------------------------- keyboard

  /** The part of the file manager that an event comes from. */
  private areaOf(event: Event): 'toolbar' | 'tree' | 'content' | null {
    const target = event.target as Element | null;
    const area = target?.closest?.('.star-fm__toolbar, .star-fm__tree, .star-fm__content');
    if (!area || !this.host.nativeElement.contains(area)) return null;
    return area.classList.contains('star-fm__toolbar')
      ? 'toolbar'
      : area.classList.contains('star-fm__tree')
        ? 'tree'
        : 'content';
  }

  protected onKeydown(event: KeyboardEvent): void {
    const area = this.areaOf(event);
    if (area === 'toolbar') this.onToolbarKeydown(event);
    else if (area === 'content') this.onContentKeydown(event);
  }

  protected onClick(event: MouseEvent): void {
    if (this.areaOf(event) !== 'content') return;
    const option = (event.target as Element).closest('[role="option"][data-file-id]');
    const item = option ? this.itemAt(option) : null;
    if (item) this.onIconClick(event, item);
  }

  private onContentKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input, star-dialog')) return;
    const item = this.itemAt(target);
    const ctrl = event.ctrlKey || event.metaKey;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if ((event.shiftKey && key === 'F10') || key === 'ContextMenu') {
      event.preventDefault();
      if (item && !this.isSelected(item.id)) this.select(item.id, 'single');
      // CDK reads the menu items when the menu opens: open it after the selection is rendered.
      const anchor = target.closest<HTMLElement>('[data-file-id], tr') ?? target;
      afterNextRender(() => this.openMenuAt(anchor), { injector: this.injector });
      return;
    }
    if (ctrl && key === 'a') {
      event.preventDefault();
      this.selectAll();
      return;
    }
    if (ctrl && (key === 'x' || key === 'c')) {
      event.preventDefault();
      this.toClipboard(key === 'x' ? 'cut' : 'copy');
      return;
    }
    if (ctrl && key === 'v') {
      event.preventDefault();
      this.paste();
      return;
    }
    if (key === 'Delete') {
      event.preventDefault();
      this.requestDelete();
      return;
    }
    if (key === 'F2') {
      event.preventDefault();
      this.startRename(item);
      return;
    }
    if (key === 'Enter' && item) {
      event.preventDefault();
      this.openItem(item);
      return;
    }
    if (key === 'Backspace' || (event.altKey && key === 'ArrowUp')) {
      event.preventDefault();
      this.goUp();
      return;
    }
    if (this.view() === 'large-icons' && item) this.onIconKeydown(event, item);
  }

  private goUp(): void {
    const current = this.folder();
    if (current === null) return;
    const parent = this.byIds([current])[0]?.parentId ?? null;
    this.navigate(parent);
    this.focusContent();
  }

  /** Arrow keys, Home, End and Space in the large icons grid. */
  private onIconKeydown(event: KeyboardEvent, item: StarFileItem): void {
    const ids = this.visibleIds();
    const index = ids.indexOf(item.id);
    const grid = this.host.nativeElement.querySelector<HTMLElement>('.star-fm__icons');
    const options = grid ? [...grid.querySelectorAll<HTMLElement>('[role="option"]')] : [];
    const top = options[0]?.offsetTop ?? 0;
    const perRow = Math.max(1, options.filter((o) => o.offsetTop === top).length);
    const columns = perRow === options.length && options.length > 1 && top === 0 ? 1 : perRow;
    const key = starInlineKey(event, this.host.nativeElement);
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index + columns,
      ArrowUp: index - columns,
      Home: 0,
      End: ids.length - 1,
    };
    if (key === ' ') {
      event.preventDefault();
      this.select(
        item.id,
        event.ctrlKey || event.metaKey ? 'toggle' : event.shiftKey ? 'range' : 'single',
      );
      return;
    }
    const next = moves[key];
    if (next === undefined) return;
    event.preventDefault();
    const target = ids[Math.max(0, Math.min(ids.length - 1, next))];
    if (target === undefined) return;
    this.focusId.set(target);
    if (event.shiftKey) this.select(target, 'range');
    else if (!(event.ctrlKey || event.metaKey)) this.select(target, 'single');
    options[ids.indexOf(target)]?.focus();
  }

  private onToolbarKeydown(event: KeyboardEvent): void {
    const bar = (event.target as Element).closest<HTMLElement>('.star-fm__toolbar')!;
    const tools = [...bar.querySelectorAll<HTMLElement>('[data-tool]')];
    const index = tools.indexOf(
      (event.target as HTMLElement).closest('[data-tool]') as HTMLElement,
    );
    if (index < 0) return;
    const last = tools.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = moves[starInlineKey(event, bar)];
    if (next === undefined) return;
    event.preventDefault();
    this.toolStop.set(tools[next].getAttribute('data-tool')!);
    tools[next].focus();
  }

  // ---------------------------------------------------------------- operations

  protected readonly toolbar = computed(() => {
    const chosen = this.selectedItems();
    const none = chosen.length === 0;
    const files = chosen.filter((item) => !item.isFolder);
    return [
      {
        id: 'new-folder',
        label: this.text.newFolder,
        icon: 'ph-bold ph-folder-plus',
        run: () => this.askFolderName(),
      },
      {
        id: 'upload',
        label: this.text.upload,
        icon: 'ph-bold ph-upload-simple',
        pressed: this.uploadOpen(),
        run: () => this.uploadOpen.update((open) => !open),
      },
      {
        id: 'rename',
        label: this.text.rename,
        icon: 'ph-bold ph-pencil-simple',
        disabled: chosen.length !== 1,
        run: () => this.startRename(chosen[0] ?? null),
      },
      {
        id: 'delete',
        label: this.text.delete,
        icon: 'ph-bold ph-trash',
        disabled: none,
        run: () => this.requestDelete(),
      },
      {
        id: 'cut',
        label: this.text.cut,
        icon: 'ph-bold ph-scissors',
        iconOnly: true,
        disabled: none,
        run: () => this.toClipboard('cut'),
      },
      {
        id: 'copy',
        label: this.text.copy,
        icon: 'ph-bold ph-copy',
        iconOnly: true,
        disabled: none,
        run: () => this.toClipboard('copy'),
      },
      {
        id: 'paste',
        label: this.text.paste,
        icon: 'ph-bold ph-clipboard-text',
        iconOnly: true,
        disabled: !this.clipboard(),
        run: () => this.paste(),
      },
      {
        id: 'download',
        label: this.text.download,
        icon: 'ph-bold ph-download-simple',
        iconOnly: true,
        disabled: !files.length,
        run: () => this.requestDownload(),
      },
      { id: 'sort', label: this.text.sortBy, icon: '', run: () => undefined },
      {
        id: 'view-details',
        label: this.text.fileViewDetails,
        icon: 'ph-bold ph-list',
        iconOnly: true,
        pressed: this.view() === 'details',
        run: () => this.view.set('details'),
      },
      {
        id: 'view-icons',
        label: this.text.fileViewIcons,
        icon: 'ph-bold ph-squares-four',
        iconOnly: true,
        pressed: this.view() === 'large-icons',
        run: () => this.view.set('large-icons'),
      },
    ] as {
      id: string;
      label: string;
      icon: string;
      iconOnly?: boolean;
      disabled?: boolean;
      pressed?: boolean;
      run: () => void;
    }[];
  });

  protected readonly sortItems = computed<StarMenuItem[]>(() => {
    const labels: Record<StarFileSortField, string> = {
      name: this.text.name,
      size: this.text.fileSize,
      modified: this.text.fileModified,
      type: this.text.fileType,
    };
    const mark = (on: boolean) => (on ? 'ph-bold ph-check' : 'ph-bold ph-dot-outline');
    return [
      ...SORT_FIELDS.map((field) => ({
        label: labels[field],
        icon: mark(this.sortField() === field),
        command: () => this.sortField.set(field),
      })),
      { separator: true },
      {
        label: this.text.sortAscending,
        icon: mark(this.sortOrder() === 1),
        command: () => this.sortOrder.set(1),
      },
      {
        label: this.text.sortDescending,
        icon: mark(this.sortOrder() === -1),
        command: () => this.sortOrder.set(-1),
      },
    ];
  });

  protected readonly menuItems = computed<StarMenuItem[]>(() => {
    const chosen = this.selectedItems();
    const none = chosen.length === 0;
    const single = chosen.length === 1 ? chosen[0] : null;
    const files = chosen.filter((item) => !item.isFolder);
    return [
      {
        label: this.text.open,
        icon: 'ph-bold ph-arrow-square-out',
        disabled: !single,
        command: () => {
          const now = this.selectedItems();
          if (now.length === 1) this.openItem(now[0]);
        },
      },
      {
        label: this.text.download,
        icon: 'ph-bold ph-download-simple',
        disabled: !files.length,
        command: () => this.requestDownload(),
      },
      { separator: true },
      {
        label: this.text.cut,
        icon: 'ph-bold ph-scissors',
        shortcut: 'Ctrl+X',
        disabled: none,
        command: () => this.toClipboard('cut'),
      },
      {
        label: this.text.copy,
        icon: 'ph-bold ph-copy',
        shortcut: 'Ctrl+C',
        disabled: none,
        command: () => this.toClipboard('copy'),
      },
      {
        label: this.text.paste,
        icon: 'ph-bold ph-clipboard-text',
        shortcut: 'Ctrl+V',
        disabled: !this.clipboard(),
        command: () => this.paste(),
      },
      { separator: true },
      {
        label: this.text.rename,
        icon: 'ph-bold ph-pencil-simple',
        shortcut: 'F2',
        disabled: !single,
        command: () => this.startRename(null),
      },
      {
        label: this.text.delete,
        icon: 'ph-bold ph-trash',
        shortcut: 'Del',
        danger: true,
        disabled: none,
        command: () => this.requestDelete(),
      },
      { separator: true },
      {
        label: this.text.newFolder,
        icon: 'ph-bold ph-folder-plus',
        command: () => this.askFolderName(),
      },
    ];
  });

  protected onContextMenu(event: MouseEvent): void {
    if (this.areaOf(event) !== 'content') return;
    const item = this.itemAt(event.target);
    if (item && !this.isSelected(item.id)) this.select(item.id, 'single');
  }

  private openMenuAt(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: starIsRtl(element) ? rect.right - 16 : rect.left + 16,
        clientY: rect.bottom,
      }),
    );
  }

  /** Puts the selection on the file manager clipboard (cut or copy). */
  toClipboard(mode: 'cut' | 'copy'): void {
    const ids = this.selection();
    if (!ids.length) return;
    this.clipboard.set({ mode, ids });
    this.announce(
      mode === 'cut' ? this.text.fileItemsCut(ids.length) : this.text.fileItemsCopied(ids.length),
    );
  }

  /** Moves or copies the clipboard items into the open folder. */
  paste(): void {
    const clip = this.clipboard();
    if (!clip) return;
    if (this.transfer(clip.mode === 'cut' ? 'move' : 'copy', clip.ids, this.folder())) {
      if (clip.mode === 'cut') this.clipboard.set(null);
    }
  }

  /** Emits `move` or `copy`; `true` when it was not refused or canceled. */
  private transfer(
    kind: 'move' | 'copy',
    ids: readonly string[],
    targetId: string | null,
  ): boolean {
    const items = this.byIds(ids);
    const allowed =
      kind === 'move'
        ? starCanDrop(this.known(), ids, targetId)
        : !starFilePath(this.known(), targetId).some((folder) => ids.includes(folder.id));
    if (!items.length || !allowed) {
      if (items.length) this.announce(this.text.fileMoveNotAllowed);
      return false;
    }
    const emitter = kind === 'move' ? this.move : this.copy;
    if (!emitCancelable<StarFileTransferEvent>(emitter, { items, targetId })) return false;
    const name = this.folderLabel(targetId);
    this.announce(
      kind === 'move'
        ? this.text.fileItemsMoved(items.length, name)
        : this.text.fileItemsCopiedTo(items.length, name),
    );
    if (kind === 'move') this.selection.set([]);
    void this.apply(kind, (provider) =>
      kind === 'move' ? provider.move(items, targetId) : provider.copy(items, targetId),
    );
    return true;
  }

  private startRename(item: StarFileItem | null): void {
    const target = item ?? (this.selectedItems().length === 1 ? this.selectedItems()[0] : null);
    if (!target) return;
    this.renaming.set(target.id);
    if (!this.browser) return;
    afterNextRender(
      () => {
        const field = this.host.nativeElement.querySelector<HTMLInputElement>('.star-fm__rename');
        field?.focus();
        field?.select();
      },
      { injector: this.injector },
    );
  }

  protected onRenameKey(event: KeyboardEvent, item: StarFileItem): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitRename(item, (event.target as HTMLInputElement).value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.renaming.set(null);
      this.refocus(item.id);
    }
  }

  protected commitRename(item: StarFileItem, value: string): void {
    if (this.renaming() !== item.id) return;
    this.renaming.set(null);
    const name = value.trim();
    if (
      name &&
      name !== item.name &&
      emitCancelable<StarFileRenameEvent>(this.rename, { item, name })
    ) {
      void this.apply('rename', (provider) => provider.rename(item, name));
    }
    this.refocus(item.id);
  }

  private refocus(id: string): void {
    if (!this.browser) return;
    afterNextRender(
      () => {
        const host = this.host.nativeElement;
        const target =
          host.querySelector<HTMLElement>(`[data-file-id="${CSS.escape(id)}"]`) ??
          host.querySelector<HTMLElement>(`[data-file-name="${CSS.escape(id)}"]`)?.closest('tr');
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  /** Asks to delete the selection (with the confirmation dialog when `confirmDelete` is on). */
  requestDelete(): void {
    const items = this.selectedItems();
    if (!items.length) return;
    this.pendingDelete.set(items);
    if (this.confirmDelete()) this.confirmOpen.set(true);
    else this.confirmDeleteNow();
  }

  protected acceptDelete(): void {
    this.confirmOpen.set(false);
    this.confirmDeleteNow();
  }

  private confirmDeleteNow(): void {
    const items = this.pendingDelete();
    this.pendingDelete.set([]);
    if (!emitCancelable<StarFileItemsEvent>(this.delete, { items })) return;
    this.selection.set([]);
    void this.apply('delete', (provider) => provider.delete(items), items);
  }

  private requestDownload(): void {
    const items = this.selectedItems().filter((item) => !item.isFolder);
    if (!items.length || !emitCancelable<StarFileItemsEvent>(this.download, { items })) return;
    void this.apply('download', (provider) => provider.download?.(items) ?? null);
  }

  private askFolderName(): void {
    const names = starFileChildren(this.known(), this.folder()).map((item) => item.name);
    this.folderName.set(starUniqueName(names, this.text.newFolder));
    this.folderOpen.set(true);
  }

  protected submitFolder(): void {
    const name = this.folderName().trim();
    if (!name) return;
    this.folderOpen.set(false);
    const parentId = this.folder();
    if (emitCancelable<StarFileCreateFolderEvent>(this.createFolder, { parentId, name })) {
      void this.apply('createFolder', (provider) => provider.createFolder(parentId, name));
    }
  }

  protected onUpload(files: readonly File[]): void {
    if (!files.length) return;
    const folderId = this.folder();
    if (emitCancelable<StarFileUploadEvent>(this.upload, { folderId, files })) {
      void this.apply('upload', (provider) => provider.upload?.(folderId, files) ?? null);
    }
    this.uploadFiles.set([]);
    this.uploadOpen.set(false);
  }

  // ---------------------------------------------------------------- drag and drop

  protected onDragStart(event: DragEvent): void {
    if (this.areaOf(event) !== 'content') return;
    const item = this.itemAt(event.target);
    if (!item) return;
    this.dragIds = this.isSelected(item.id) ? this.selection() : [item.id];
    event.dataTransfer?.setData(
      'text/plain',
      this.byIds(this.dragIds)
        .map((i) => i.name)
        .join('\n'),
    );
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copyMove';
  }

  protected endDrag(): void {
    this.dragIds = [];
    this.dropTarget.set(undefined);
  }

  /** The folder under the pointer: `undefined` for none, `null` for the top folder. */
  private dropFolder(event: DragEvent, area: 'tree' | 'content'): string | null | undefined {
    if (area === 'tree') {
      const key = (event.target as Element).closest('[data-key]')?.getAttribute('data-key');
      return key === undefined || key === null ? undefined : key === '' ? null : key;
    }
    const item = this.itemAt(event.target);
    return item?.isFolder ? item.id : undefined;
  }

  protected onDragLeave(event: DragEvent): void {
    if (this.areaOf(event) === 'tree') this.dropTarget.set(undefined);
  }

  protected onDragOver(event: DragEvent): void {
    const area = this.areaOf(event);
    if (!this.dragIds.length || (area !== 'tree' && area !== 'content')) return;
    const target = this.dropFolder(event, area);
    const copy = event.ctrlKey || event.metaKey;
    const allowed =
      target !== undefined &&
      (copy
        ? !starFilePath(this.known(), target).some((f) => this.dragIds.includes(f.id))
        : starCanDrop(this.known(), this.dragIds, target));
    if (!allowed) {
      this.dropTarget.set(undefined);
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = copy ? 'copy' : 'move';
    this.dropTarget.set(target);
  }

  protected onDrop(event: DragEvent): void {
    const area = this.areaOf(event);
    if (area !== 'tree' && area !== 'content') return;
    const target = this.dropFolder(event, area);
    const ids = this.dragIds;
    this.endDrag();
    if (target === undefined || !ids.length) return;
    event.preventDefault();
    this.transfer(event.ctrlKey || event.metaKey ? 'copy' : 'move', ids, target);
  }
}
