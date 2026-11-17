import { HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StarEmptyTemplate } from '@star-ng/ui/core';
import {
  StarFileTemplate,
  StarFileUpload,
  StarRejectedFile,
  StarUploadResult,
  toUploadStatus,
} from '@star-ng/ui/file-upload';
import { concat, interval, map, mergeMap, Observable, of, take, throwError, timer } from 'rxjs';
import { DOCS, DocsRow } from '../shared/docs';

interface Receipt {
  readonly id: string;
}

/**
 * A fake upload that sends the same events as `HttpClient` with
 * `{ reportProgress: true, observe: 'events' }`. A file name with "fail" ends in an error.
 */
function fakeUpload(file: File): Observable<HttpEvent<Receipt>> {
  if (file.name.includes('fail')) {
    return concat(
      of<HttpEvent<Receipt>>({ type: HttpEventType.Sent }),
      timer(700).pipe(mergeMap(() => throwError(() => new Error('rejected')))),
    );
  }
  return concat(
    of<HttpEvent<Receipt>>({ type: HttpEventType.Sent }),
    interval(400).pipe(
      take(3),
      map((step): HttpEvent<Receipt> => ({
        type: HttpEventType.UploadProgress,
        loaded: (step + 1) * 25,
        total: 100,
      })),
    ),
    timer(1500).pipe(
      map((): HttpEvent<Receipt> => new HttpResponse({ body: { id: `ATT-${file.size}` } })),
    ),
  );
}

@Component({
  selector: 'docs-file-upload-page',
  imports: [DOCS, StarFileUpload, StarFileTemplate, StarEmptyTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="File upload"
      lead="A file picker with drag and drop. The control checks the files, lists them and shows their upload state. It does not send anything: your code sends the files."
      importFrom="import { StarFileUpload, toUploadStatus } from '@star-ng/ui/file-upload';"
    >
      <docs-example
        heading="Single and multiple"
        source="file-upload/modes"
        [script]="modesScript"
        note="The value is the list of chosen File objects. In the default single mode a new file replaces the old one, and when the user drops several files only the first is taken. With multiple, new files are added to the list. The remove button of a file takes it out of the list."
      >
        <div class="docs-stack">
          <star-file-upload [(value)]="single" />
          <star-file-upload [(value)]="several" multiple />
          <p class="docs-output" role="status">
            Single: {{ single().length }} file. Multiple: {{ several().length }} files.
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Accepted types, size and count"
        source="file-upload/limits"
        [script]="limitsScript"
        note="accept lists extensions and MIME types, as the accept attribute of an input does (.pdf, image/*, application/zip). maxFileSize is in bytes and fileLimit is the largest number of files. The hint under the button shows the limits. A file that fails a check is not added: the list under the control gives the reason (type, size or limit), and rejectedChange emits the rejected files."
      >
        <div class="docs-stack">
          <star-file-upload
            [(value)]="limited"
            accept=".pdf,image/*"
            [maxFileSize]="1000000"
            [fileLimit]="3"
            multiple
            (rejectedChange)="rejected.set($event)"
          />
          <p class="docs-output" role="status">
            Added: {{ limited().length }}. Rejected in the last try: {{ rejected().length }}.
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Drag and drop"
        source="file-upload/drop"
        [script]="dropScript"
        note="The dashed zone takes dropped files. The zone gets a highlight while files are over it. Dropped files go through the same checks as chosen files. A user who cannot drag uses the Choose files button, which opens the file dialog of the browser. A file that the user pastes while the focus is in the control is added too (a screenshot or a copied file)."
      >
        <div class="docs-stack">
          <star-file-upload [(value)]="dropped" accept="image/*,.pdf" multiple />
        </div>
      </docs-example>

      <docs-example
        heading="Order and thumbnails"
        source="file-upload/reorder"
        [script]="reorderScript"
        note="reorderable adds move up and move down buttons to each file, and the user can also drag a file in the list. thumbnails shows a small picture for each image file. The picture is a local object URL that the control releases when the file leaves the list."
      >
        <div class="docs-stack">
          <star-file-upload
            [(value)]="ordered"
            accept="image/*,.pdf"
            multiple
            reorderable
            thumbnails
          />
        </div>
      </docs-example>

      <docs-example
        heading="Progress and status"
        source="file-upload/status"
        [script]="statusScript"
        note="fileStatus is a function from a file to its state: progress (0 to 100), state (uploading, done or error) and message. The page owns that state, so read your own signal inside the function and the list follows the upload. toUploadStatus turns the events of one HttpClient upload into these states. This example uses a fake upload with the same events. A file with fail in its name ends in an error."
      >
        <div class="docs-stack">
          <star-file-upload
            [(value)]="uploads"
            accept=".pdf"
            multiple
            [fileStatus]="statusOf"
            (selected)="send($event)"
          />
        </div>
      </docs-example>

      <docs-example
        heading="Disabled and read-only"
        source="file-upload/states"
        [script]="statesScript"
        note="disabled and readonly turn off the file input, drop and paste. A read-only list shows the files without the remove buttons. A disabled control also shows the dimmed zone."
      >
        <div class="docs-stack">
          <star-file-upload [value]="existing" readonly />
          <star-file-upload disabled />
        </div>
      </docs-example>

      <docs-example
        heading="File row and empty state"
        source="file-upload/slots"
        [script]="slotsScript"
        note="starFile replaces everything inside one row of the list: icon, name, progress, size and the buttons. The context has the file, status (the state from fileStatus, or null), remove(), index and interactive. Your row must show the name and a way to remove the file. A button needs an accessible name with the file name. starEmpty shows while the list is empty. It gets an empty string, because the control has no filter."
      >
        <div class="docs-stack">
          <star-file-upload [(value)]="templated" multiple>
            <ng-template starEmpty>
              <p class="docs-output">No file yet. Add an invoice or a packing list.</p>
            </ng-template>
            <ng-template
              starFile
              let-file
              let-remove="remove"
              let-index="index"
              let-interactive="interactive"
            >
              <i class="ph-bold ph-file-pdf star-upload__file-icon" aria-hidden="true"></i>
              <span class="star-upload__main">
                <span class="star-upload__name">{{ index + 1 }}. {{ file.name }}</span>
              </span>
              <span class="star-upload__size">{{ file.size }} bytes</span>
              @if (interactive) {
                <button
                  type="button"
                  class="star-select__icon-btn"
                  [attr.aria-label]="'Remove ' + file.name"
                  (click)="remove()"
                >
                  <i class="ph-bold ph-trash" aria-hidden="true"></i>
                </button>
              }
            </ng-template>
          </star-file-upload>
        </div>
      </docs-example>

      <h2>Send the files</h2>
      <p>
        The control only collects files. Use the <code>selected</code> output (it emits only the
        files that passed the checks) or read <code>value</code> when the user presses your own Send
        button. Then send each file in a request body of type <code>FormData</code>.
        <code>toUploadStatus()</code> pipes the progress and the result back to the control:
      </p>
      <docs-code [code]="sendCode" label="Send files with HttpClient" />
      <p>
        The default error text of <code>toUploadStatus</code> is the HTTP status and status text
        (for example "413 Payload Too Large"). Pass a function to give your own text. The observable
        that it returns does not fail, so a failed upload never stops the subscription of other
        files.
      </p>

      <docs-api
        [of]="['StarFileUpload', 'StarFileTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Helpers</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Exports of @star-ng/ui/file-upload
          </caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            @for (row of helpers; track row.name) {
              <tr>
                <th scope="row">
                  <code>{{ row.name }}</code>
                </th>
                <td>{{ row.description }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h2>Technical notes</h2>
      <p>
        <strong>The checks run in the browser only.</strong> They help the user, and they do not
        protect the server. <code>accept</code> compares the file name extension and the MIME type
        that the browser reports. The browser takes that type from the extension, and a user can
        rename any file. The control never reads the content of a file. Check the type, the size and
        the content again on the server.
      </p>
      <p>
        The file names are shown as text, so a name with HTML characters is not interpreted. The
        thumbnail of an image file is an <code>img</code> element with an object URL, which does not
        run scripts, also for SVG files.
      </p>
      <p>
        <code>fileLimit</code> counts the files that are already in the list. In single mode the
        limit is always 1 and the new file replaces the old one. The list of rejected files belongs
        to the last add: the next add or a removed file clears it.
      </p>
    </docs-page>
  `,
})
export class FileUploadPage {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly single = signal<readonly File[]>([]);
  protected readonly several = signal<readonly File[]>([]);
  protected readonly limited = signal<readonly File[]>([]);
  protected readonly rejected = signal<readonly StarRejectedFile[]>([]);
  protected readonly dropped = signal<readonly File[]>([]);
  protected readonly ordered = signal<readonly File[]>([]);
  protected readonly templated = signal<readonly File[]>([
    new File(['x'], 'invoice-1042.pdf', { type: 'application/pdf' }),
    new File(['xx'], 'packing-list.pdf', { type: 'application/pdf' }),
  ]);
  protected readonly uploads = signal<readonly File[]>([]);
  protected readonly existing: readonly File[] = [
    new File(['x'], 'invoice-1042.pdf', { type: 'application/pdf' }),
    new File(['x'], 'packing-list.pdf', { type: 'application/pdf' }),
  ];

  private readonly states = signal(new Map<File, StarUploadResult<Receipt>>());
  protected readonly statusOf = (file: File) => this.states().get(file) ?? null;

  protected send(files: readonly File[]): void {
    for (const file of files) {
      fakeUpload(file)
        .pipe(
          toUploadStatus<Receipt>(() => 'The server did not accept the file.'),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((status) => this.states.update((map) => new Map(map).set(file, status)));
    }
  }

  protected readonly modesScript = `readonly single = signal<readonly File[]>([]);
readonly several = signal<readonly File[]>([]);`;
  protected readonly limitsScript = `readonly limited = signal<readonly File[]>([]);
readonly rejected = signal<readonly StarRejectedFile[]>([]);`;
  protected readonly dropScript = `readonly dropped = signal<readonly File[]>([]);`;
  protected readonly reorderScript = `readonly ordered = signal<readonly File[]>([]);`;
  protected readonly statusScript = `readonly uploads = signal<readonly File[]>([]);
private readonly states = signal(new Map<File, StarUploadResult<Receipt>>());

// The control calls this function for each file. It reads a signal, so the list follows it.
readonly statusOf = (file: File) => this.states().get(file) ?? null;

send(files: readonly File[]): void {
  for (const file of files) {
    fakeUpload(file) // the docs use a fake with the events of HttpClient
      .pipe(toUploadStatus<Receipt>(() => 'The server did not accept the file.'))
      .subscribe((status) => this.states.update((map) => new Map(map).set(file, status)));
  }
}`;
  protected readonly slotsScript = `// Import StarFileTemplate and StarEmptyTemplate in the component imports.
readonly templated = signal<readonly File[]>([
  new File(['x'], 'invoice-1042.pdf', { type: 'application/pdf' }),
  new File(['xx'], 'packing-list.pdf', { type: 'application/pdf' }),
]);`;
  protected readonly statesScript = `readonly existing: readonly File[] = [
  new File(['x'], 'invoice-1042.pdf', { type: 'application/pdf' }),
  new File(['x'], 'packing-list.pdf', { type: 'application/pdf' }),
];`;

  protected readonly sendCode = `private readonly http = inject(HttpClient);
readonly files = signal<readonly File[]>([]);
private readonly states = signal(new Map<File, StarUploadResult<Receipt>>());
readonly statusOf = (file: File) => this.states().get(file) ?? null;

send(files: readonly File[]): void {
  for (const file of files) {
    const body = new FormData();
    body.append('file', file, file.name);
    this.http
      .post<Receipt>('/api/attachments', body, { reportProgress: true, observe: 'events' })
      .pipe(toUploadStatus<Receipt>())
      .subscribe((status) => this.states.update((map) => new Map(map).set(file, status)));
  }
}

// <star-file-upload [(value)]="files" multiple [fileStatus]="statusOf" (selected)="send($event)" />`;

  protected readonly helpers: readonly DocsRow[] = [
    {
      name: 'toUploadStatus(errorMessage?)',
      description:
        'RxJS operator: HttpClient upload events to StarUploadResult values (uploading with progress, done with the response body, error with a message).',
    },
    {
      name: 'formatFileSize(bytes, locale?)',
      description: 'Text such as "512 byte" or "1.5 kB" from a number of bytes.',
    },
    {
      name: 'fileMatchesAccept(file, accept)',
      description: 'True when the file fits an accept list such as ".pdf,image/*".',
    },
    {
      name: 'StarFileStatus',
      description: 'Type of the state of one file: progress, state and message.',
    },
    {
      name: 'StarRejectedFile',
      description: 'Type of a rejected file: the file and the reason (type, size or limit).',
    },
    {
      name: 'add(files) / remove(file) / move(from, to) / focus()',
      description: 'Public methods of StarFileUpload for code that works on the list.',
    },
  ];

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starFile]',
      description:
        'Content child. Replaces everything inside one row of the file list, including the move and remove buttons (PrimeNG #file template). The context has $implicit (the File), status, remove(), index and interactive. Buttons are allowed: the list is a plain list in the normal tab order.',
    },
    {
      name: 'ng-template[starEmpty]',
      description:
        'Content child. Shown in place of the file list while no file is chosen. $implicit is an empty string, because this control has no filter.',
    },
  ];

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border-strong', description: 'Dashed border of the drop zone.' },
    {
      name: '--star-primary',
      description: 'Zone border while files are dragged over it, and the progress bar.',
    },
    {
      name: '--star-primary-soft',
      description: 'Zone background while files are dragged over it.',
    },
    { name: '--star-danger', description: 'Error border, error messages and the error icon.' },
    { name: '--star-success', description: 'Icon of a finished upload.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab / Shift+Tab',
      description:
        'Moves to the file input (the Choose files button), then to the buttons of each file.',
    },
    {
      name: 'Enter / Space',
      description:
        'On the file input or the Choose files button: opens the file dialog. On a file button: moves or removes the file.',
    },
    {
      name: 'Ctrl+V',
      description: 'With the focus in the control: adds files from the clipboard.',
    },
  ];
}
