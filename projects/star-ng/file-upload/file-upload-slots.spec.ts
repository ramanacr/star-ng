import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEmptyTemplate } from '@star-ng/ui/core';
import { StarFileStatus, StarFileUpload } from './file-upload';
import { StarFileTemplate } from './file-upload-slots';

const file = (name: string) => new File(['x'], name, { type: 'application/pdf' });

@Component({
  imports: [StarFileUpload, StarFileTemplate, StarEmptyTemplate],
  template: `
    <star-file-upload
      class="custom"
      multiple
      reorderable
      [(value)]="files"
      [fileStatus]="status"
      [disabled]="locked()"
    >
      <ng-template
        starFile
        let-item
        let-status="status"
        let-remove="remove"
        let-index="index"
        let-interactive="interactive"
      >
        <span class="my-name" [attr.data-index]="index">{{ item.name }}</span>
        <span class="my-state">{{ status?.state ?? 'none' }}</span>
        <button
          type="button"
          class="my-remove"
          [attr.aria-label]="'Remove ' + item.name"
          [attr.data-interactive]="interactive"
          (click)="remove()"
        >
          x
        </button>
      </ng-template>
      <ng-template starEmpty let-text>
        <p class="my-empty">Nothing yet. Filter: "{{ text }}"</p>
      </ng-template>
    </star-file-upload>

    <star-file-upload class="plain" multiple [value]="plainFiles" />
    <star-file-upload class="plain-empty" multiple />
  `,
})
class Host {
  readonly files = signal<readonly File[]>([file('a.pdf'), file('b.pdf')]);
  readonly plainFiles: readonly File[] = [file('p.pdf')];
  readonly states = signal<ReadonlyMap<File, StarFileStatus>>(new Map());
  readonly status = (item: File) => this.states().get(item) ?? null;
  readonly locked = signal(false);
}

describe('file upload slots', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      el,
      custom: el.querySelector<HTMLElement>('.custom')!,
      plain: el.querySelector<HTMLElement>('.plain')!,
      plainEmpty: el.querySelector<HTMLElement>('.plain-empty')!,
    };
  }

  it('starFile replaces the content of each row and keeps the li', async () => {
    const { custom } = await setup();
    const rows = [...custom.querySelectorAll('li.star-upload__file')];
    expect(rows.length).toBe(2);
    expect(rows.map((row) => row.querySelector('.my-name')?.textContent)).toEqual([
      'a.pdf',
      'b.pdf',
    ]);
    expect(rows.map((row) => row.querySelector('.my-name')?.getAttribute('data-index'))).toEqual([
      '0',
      '1',
    ]);
    // The built-in parts of the row are replaced, including the move and remove buttons.
    expect(custom.querySelector('.star-upload__name')).toBeNull();
    expect(custom.querySelector('.star-select__icon-btn')).toBeNull();
    expect(custom.querySelector('ul')?.getAttribute('aria-label')).toBe('Choose files');
  });

  it('status is null without a state and follows the fileStatus input', async () => {
    const { fixture, host, custom } = await setup();
    const states = () => [...custom.querySelectorAll('.my-state')].map((n) => n.textContent);
    expect(states()).toEqual(['none', 'none']);
    host.states.set(new Map([[host.files()[1], { state: 'uploading', progress: 40 }]]));
    await fixture.whenStable();
    expect(states()).toEqual(['none', 'uploading']);
  });

  it('remove() removes the file like the built-in button', async () => {
    const { fixture, host, custom } = await setup();
    custom.querySelectorAll<HTMLButtonElement>('.my-remove')[0].click();
    await fixture.whenStable();
    expect(host.files().map((item) => item.name)).toEqual(['b.pdf']);
    expect([...custom.querySelectorAll('.my-name')].map((n) => n.textContent)).toEqual(['b.pdf']);
  });

  it('remove() does nothing when the control is disabled', async () => {
    const { fixture, host, custom } = await setup();
    host.locked.set(true);
    await fixture.whenStable();
    const button = custom.querySelector<HTMLButtonElement>('.my-remove')!;
    expect(button.getAttribute('data-interactive')).toBe('false');
    button.click();
    await fixture.whenStable();
    expect(host.files().length).toBe(2);
  });

  it('starEmpty shows while the list is empty, with an empty string as context', async () => {
    const { fixture, host, custom } = await setup();
    expect(custom.querySelector('.my-empty')).toBeNull();
    host.files.set([]);
    await fixture.whenStable();
    expect(custom.querySelector('ul')).toBeNull();
    expect(custom.querySelector('.my-empty')?.textContent?.trim()).toBe('Nothing yet. Filter: ""');
  });

  it('keeps the default row without a slot', async () => {
    const { plain } = await setup();
    const row = plain.querySelector('li.star-upload__file')!;
    expect(row.querySelector('.star-upload__name')?.textContent).toBe('p.pdf');
    expect(row.querySelector('[aria-label="Remove p.pdf"]')).not.toBeNull();
    expect(plain.querySelector('.my-name')).toBeNull();
  });

  it('renders nothing for the empty list without a slot', async () => {
    const { plainEmpty } = await setup();
    expect(plainEmpty.querySelector('ul')).toBeNull();
    expect(plainEmpty.querySelector('.my-empty')).toBeNull();
    expect(plainEmpty.querySelector('.star-upload__zone')).not.toBeNull();
    // Only the drop zone is in the host.
    expect(plainEmpty.children.length).toBe(1);
  });

  it('a slot of one control does not leak into another control', async () => {
    const { plain, plainEmpty } = await setup();
    expect(plain.querySelectorAll('.my-name').length).toBe(0);
    expect(plainEmpty.querySelectorAll('.my-empty').length).toBe(0);
  });
});
