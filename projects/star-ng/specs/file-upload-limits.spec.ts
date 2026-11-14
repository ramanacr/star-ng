import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fileMatchesAccept, formatFileSize, StarFileUpload } from 'star-ng/file-upload';

@Component({
  imports: [StarFileUpload],
  template: `<star-file-upload
    [(value)]="files"
    accept=".pdf,image/*"
    [maxFileSize]="1000"
    [fileLimit]="2"
    multiple
  />`,
})
class UploadHost {
  readonly files = signal<readonly File[]>([]);
}

describe('StarFileUpload', () => {
  it('helpers format sizes and match accept rules', () => {
    expect(formatFileSize(512, 'en-US')).toBe('512 byte');
    expect(formatFileSize(1536, 'en-US')).toBe('1.5 kB');
    const pdf = new File(['x'], 'a.PDF', { type: 'application/pdf' });
    const png = new File(['x'], 'b.png', { type: 'image/png' });
    const doc = new File(['x'], 'c.docx', { type: 'application/msword' });
    expect(fileMatchesAccept(pdf, '.pdf,image/*')).toBe(true);
    expect(fileMatchesAccept(png, '.pdf,image/*')).toBe(true);
    expect(fileMatchesAccept(doc, '.pdf,image/*')).toBe(false);
  });

  it('adds valid files and reports type, size and count rejections', async () => {
    const fixture = TestBed.createComponent(UploadHost);
    await fixture.whenStable();
    const upload = fixture.debugElement.children[0].componentInstance as StarFileUpload;
    upload.add([
      new File(['x'], 'ok.pdf', { type: 'application/pdf' }),
      new File(['x'], 'bad.exe', { type: 'application/x-msdownload' }),
      new File(['x'.repeat(2000)], 'big.pdf', { type: 'application/pdf' }),
      new File(['x'], 'ok2.png', { type: 'image/png' }),
      new File(['x'], 'third.png', { type: 'image/png' }),
    ]);
    await fixture.whenStable();
    expect(fixture.componentInstance.files().map((f) => f.name)).toEqual(['ok.pdf', 'ok2.png']);
    const errors = (fixture.nativeElement as HTMLElement).querySelector(
      '.star-upload__errors',
    )!.textContent!;
    expect(errors).toContain('bad.exe');
    expect(errors).toContain('big.pdf');
    expect(errors).toContain('up to 2 files');
  });
});
