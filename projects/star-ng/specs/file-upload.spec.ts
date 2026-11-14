import { HttpErrorResponse, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError, toArray } from 'rxjs';
import { StarFileStatus, StarFileUpload, toUploadStatus } from 'star-ng/file-upload';

const file = (name: string) => new File(['x'], name, { type: 'application/pdf' });

@Component({
  imports: [StarFileUpload],
  template: `<star-file-upload
    multiple
    reorderable
    [(value)]="files"
    [fileStatus]="status"
    [disabled]="locked()"
  />`,
})
class Host {
  readonly files = signal<readonly File[]>([file('a.pdf'), file('b.pdf'), file('c.pdf')]);
  readonly states = signal<ReadonlyMap<File, StarFileStatus>>(new Map());
  readonly status = (item: File) => this.states().get(item) ?? null;
  readonly locked = signal(false);
}

describe('StarFileUpload progress and reorder', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const names = () =>
      [...el.querySelectorAll('.star-upload__name')].map((name) => name.textContent?.trim());
    return { fixture, el, host: fixture.componentInstance, names };
  }

  it('moves a file with the buttons and disables the buttons at the ends', async () => {
    const { fixture, el, host, names } = await setup();
    const up = () => [...el.querySelectorAll<HTMLButtonElement>('[aria-label^="Move up"]')];
    const down = () => [...el.querySelectorAll<HTMLButtonElement>('[aria-label^="Move down"]')];
    expect(up()[0].disabled).toBe(true);
    expect(down()[2].disabled).toBe(true);
    expect(down()[0].getAttribute('aria-label')).toBe('Move down: a.pdf');

    down()[0].click();
    await fixture.whenStable();
    expect(names()).toEqual(['b.pdf', 'a.pdf', 'c.pdf']);
    expect(host.files().map((item) => item.name)).toEqual(['b.pdf', 'a.pdf', 'c.pdf']);

    host.locked.set(true);
    await fixture.whenStable();
    expect(up().length).toBe(0);
  });

  it('shows the upload state of each file: progress, done and error', async () => {
    const { fixture, el, host } = await setup();
    const [a, b, c] = host.files();
    host.states.set(
      new Map<File, StarFileStatus>([
        [a, { state: 'uploading', progress: 42.4 }],
        [b, { state: 'done' }],
        [c, { state: 'error', message: 'Too many pages.' }],
      ]),
    );
    await fixture.whenStable();
    const rows = [...el.querySelectorAll<HTMLElement>('.star-upload__file')];
    const bar = rows[0].querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(bar.getAttribute('aria-label')).toBe('Uploading a.pdf');
    expect(rows[0].querySelector('.star-upload__size')?.textContent).toBe('42%');
    expect(rows[1].textContent).toContain('Uploaded');
    expect(rows[2].classList).toContain('star-upload__file--error');
    expect(rows[2].querySelector('.star-upload__message')?.textContent).toBe('Too many pages.');

    host.states.set(new Map([[a, { state: 'uploading', progress: 250 }]]));
    await fixture.whenStable();
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');
  });
});

describe('StarFileUpload thumbnails and paste', () => {
  @Component({
    imports: [StarFileUpload],
    template: `<star-file-upload multiple thumbnails accept="image/*,.pdf" [(value)]="files" />`,
  })
  class PasteHost {
    readonly files = signal<readonly File[]>([]);
  }

  it('adds pasted files and shows a picture for an image file only', async () => {
    const created: File[] = [];
    const revoked: string[] = [];
    URL.createObjectURL = (file: Blob) => {
      created.push(file as File);
      return `blob:test/${created.length}`;
    };
    URL.revokeObjectURL = (url: string) => void revoked.push(url);

    const fixture = TestBed.createComponent(PasteHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const image = new File(['x'], 'shot.png', { type: 'image/png' });
    const pdf = new File(['x'], 'note.pdf', { type: 'application/pdf' });
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { files: [image, pdf] } });
    el.querySelector('input[type="file"]')!.dispatchEvent(event);
    await fixture.whenStable();

    expect(fixture.componentInstance.files()).toEqual([image, pdf]);
    expect(event.defaultPrevented).toBe(true);
    const rows = [...el.querySelectorAll('.star-upload__file')];
    expect(rows[0].querySelector('img')?.getAttribute('src')).toBe('blob:test/1');
    expect(rows[1].querySelector('img')).toBeNull();
    expect(created).toEqual([image]);

    el.querySelector<HTMLButtonElement>('[aria-label="Remove shot.png"]')!.click();
    await fixture.whenStable();
    expect(revoked).toEqual(['blob:test/1']);
  });
});

describe('toUploadStatus', () => {
  it('maps upload events to progress and then done with the response', async () => {
    const events: HttpEvent<{ id: string }>[] = [
      { type: HttpEventType.Sent },
      { type: HttpEventType.UploadProgress, loaded: 25, total: 100 },
      { type: HttpEventType.UploadProgress, loaded: 100, total: 100 },
      new HttpResponse({ body: { id: 'F-1' } }),
    ];
    const states = await firstValueFrom(of(...events).pipe(toUploadStatus(), toArray()));
    expect(states).toEqual([
      { state: 'uploading', progress: 0 },
      { state: 'uploading', progress: 25 },
      { state: 'uploading', progress: 100 },
      { state: 'done', progress: 100, response: { id: 'F-1' } },
    ]);
  });

  it('ends with an error state and does not fail', async () => {
    const failed = throwError(
      () => new HttpErrorResponse({ status: 413, statusText: 'Payload Too Large' }),
    );
    const states = await firstValueFrom(failed.pipe(toUploadStatus(), toArray()));
    expect(states).toEqual([{ state: 'error', message: '413 Payload Too Large' }]);
  });
});
