import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEditor } from 'star-ng/editor';
import { StarGalleria } from 'star-ng/media';

@Component({
  imports: [StarEditor, StarGalleria],
  template: `
    <star-editor [(value)]="html" ariaLabel="Body" />
    <star-galleria
      [images]="[
        { src: 'a.png', alt: 'A' },
        { src: 'b.png', alt: 'B' },
      ]"
    />
  `,
})
class MediaHost {
  readonly html = signal('<p>Hello <script>alert(1)</script><b>world</b></p>');
}

describe('Editor and galleria', () => {
  it('editor renders sanitized HTML and stores edits', async () => {
    const fixture = TestBed.createComponent(MediaHost);
    await fixture.whenStable();
    const area = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.star-editor__area',
    )!;
    expect(area.innerHTML).toContain('<b>world</b>');
    expect(area.innerHTML).not.toContain('script');
    area.innerHTML = '<p>Edited</p>';
    area.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.html()).toBe('<p>Edited</p>');
  });

  it('galleria shows the next image', async () => {
    const fixture = TestBed.createComponent(MediaHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('[aria-label="Next image"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.star-galleria__stage img')?.getAttribute('alt')).toBe('B');
  });
});
