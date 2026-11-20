import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarHeaderTemplate, StarIconTemplate } from '@star-ng/ui/core';
import { StarFileUpload, StarFileUploadEvent } from './file-upload';
import { StarFileUploadTemplate } from './file-upload-slots';

const pdf = (name: string) => new File(['data'], name, { type: 'application/pdf' });

@Component({
  imports: [StarFileUpload, StarFileUploadTemplate, StarHeaderTemplate, StarIconTemplate],
  template: `
    <star-file-upload
      [(value)]="files"
      multiple
      [mode]="mode()"
      [auto]="auto()"
      [showUploadButton]="uploadButton()"
      [showCancelButton]="cancelButton()"
      chooseLabel="Add invoices"
      uploadLabel="Send"
      cancelLabel="Drop all"
      name="invoices"
      (uploadHandler)="uploads.push($event)"
      (cleared)="events.push('cleared')"
      (fileRemove)="events.push('removed ' + $event.name)"
    >
      @if (slots()) {
        <ng-template starHeader><p class="own-header">Invoices</p></ng-template>
        <ng-template starFileUploadTemplate="content" let-files let-remove="remove"
          ><p class="own-content">{{ files.length }} files</p></ng-template
        >
        <ng-template starFileUploadTemplate="toolbar" let-upload="upload"
          ><button type="button" class="own-upload" (click)="upload()">Go</button></ng-template
        >
        <ng-template starIcon="choose"><b class="own-choose">+</b></ng-template>
      }
    </star-file-upload>
  `,
})
class Host {
  readonly files = signal<readonly File[]>([]);
  readonly mode = signal<'advanced' | 'basic'>('advanced');
  readonly auto = signal(false);
  readonly uploadButton = signal(false);
  readonly cancelButton = signal(false);
  readonly slots = signal(false);
  readonly uploads: StarFileUploadEvent[] = [];
  readonly events: string[] = [];
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const upload = fixture.debugElement.children[0].componentInstance as StarFileUpload;
  const button = (text: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent!.trim() === text,
    )!;
  return {
    el,
    host: fixture.componentInstance,
    upload,
    button,
    stable: () => fixture.whenStable(),
  };
}

describe('StarFileUpload depth', () => {
  it('emits uploadHandler from the Upload button and clears with Cancel', async () => {
    const t = await setup((h) => {
      h.uploadButton.set(true);
      h.cancelButton.set(true);
    });
    expect(t.button('Send').disabled).toBe(true);
    t.upload.add([pdf('a.pdf'), pdf('b.pdf')]);
    await t.stable();
    t.button('Send').click();
    expect(t.host.uploads.map((u) => u.files.map((f) => f.name))).toEqual([['a.pdf', 'b.pdf']]);
    t.button('Drop all').click();
    await t.stable();
    expect(t.host.files()).toEqual([]);
    expect(t.host.events).toEqual(['cleared']);
  });

  it('emits uploadHandler right after the choice with auto', async () => {
    const t = await setup((h) => h.auto.set(true));
    t.upload.add([pdf('a.pdf')]);
    expect(t.host.uploads.map((u) => u.files.length)).toEqual([1]);
  });

  it('emits fileRemove when the user removes a file', async () => {
    const t = await setup();
    t.upload.add([pdf('a.pdf')]);
    await t.stable();
    t.el.querySelector<HTMLButtonElement>('[aria-label="Remove a.pdf"]')!.click();
    await t.stable();
    expect(t.host.events).toEqual(['removed a.pdf']);
  });

  it('uses the choose label and the input name', async () => {
    const t = await setup();
    expect(t.el.querySelector('label.star-upload__choose')!.textContent!.trim()).toBe(
      'Add invoices',
    );
    expect(t.el.querySelector('input[type=file]')!.getAttribute('name')).toBe('invoices');
  });

  it('shows one button with the file names in basic mode', async () => {
    const t = await setup((h) => h.mode.set('basic'));
    expect(t.el.querySelector('.star-upload__zone')).toBeNull();
    const label = t.el.querySelector('label.star-upload__choose')!;
    expect(label.textContent!.trim()).toBe('Add invoices');
    t.upload.add([pdf('a.pdf'), pdf('b.pdf')]);
    await t.stable();
    expect(label.textContent!.trim()).toBe('a.pdf, b.pdf');
    expect(t.el.querySelector('.star-upload__list')).toBeNull();
  });

  it('renders the header, content, toolbar and icon slots', async () => {
    const t = await setup((h) => h.slots.set(true));
    expect(t.el.querySelector('.own-header')!.textContent).toBe('Invoices');
    expect(t.el.querySelector('.own-content')!.textContent).toBe('0 files');
    expect(t.el.querySelector('.own-choose')!.closest('[aria-hidden=true]')).not.toBeNull();
    t.upload.add([pdf('a.pdf')]);
    await t.stable();
    expect(t.el.querySelector('.own-content')!.textContent).toBe('1 files');
    t.el.querySelector<HTMLButtonElement>('.own-upload')!.click();
    expect(t.host.uploads.length).toBe(1);
  });
});
