import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarImage, StarImageTemplate } from './image';

@Component({
  imports: [StarImage, StarImageTemplate, StarIconTemplate],
  template: `
    <star-image
      src="shelf.png"
      alt="Shelf photo"
      [preview]="preview()"
      srcSet="shelf-2x.png 2x"
      sizes="10rem"
      height="90"
      loading="eager"
      previewImageSrc="shelf-large.png"
      previewImageSrcSet="shelf-large-2x.png 2x"
      (show)="events.push('show')"
      (hide)="events.push('hide')"
      (imageError)="events.push('error')"
    >
      @if (slots()) {
        <ng-template starImageTemplate="preview" let-src let-transform="transform"
          ><b class="own-preview">{{ src }}|{{ transform }}</b></ng-template
        >
        <ng-template starIcon="preview"><b class="own-hint">+</b></ng-template>
        <ng-template starIcon="rotateRight"><b class="own-rotate">R</b></ng-template>
      }
    </star-image>
  `,
})
class Host {
  readonly preview = signal(true);
  readonly slots = signal(false);
  readonly events: string[] = [];
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  return {
    fixture,
    el,
    host: fixture.componentInstance,
    button,
    stable: () => fixture.whenStable(),
  };
}

describe('StarImage depth', () => {
  it('sets srcset, sizes, height and loading on the thumbnail and emits imageError', async () => {
    const t = await setup((h) => h.preview.set(false));
    const img = t.el.querySelector('img')!;
    expect(img.getAttribute('srcset')).toBe('shelf-2x.png 2x');
    expect(img.getAttribute('sizes')).toBe('10rem');
    expect(img.getAttribute('height')).toBe('90');
    expect(img.getAttribute('loading')).toBe('eager');
    img.dispatchEvent(new Event('error'));
    expect(t.host.events).toEqual(['error']);
  });

  it('opens the preview image with show, rotates and zooms, and emits hide', async () => {
    const t = await setup();
    t.button('Preview: Shelf photo').click();
    await t.stable();
    expect(t.host.events).toEqual(['show']);
    const big = t.el.querySelector<HTMLImageElement>('.star-image__stage img')!;
    expect(big.getAttribute('src')).toBe('shelf-large.png');
    expect(big.getAttribute('srcset')).toBe('shelf-large-2x.png 2x');
    t.button('Rotate right').click();
    t.button('Zoom in').click();
    await t.stable();
    expect(big.style.transform).toBe('scale(1.25) rotate(90deg)');
    t.button('Rotate left').click();
    t.button('Rotate left').click();
    await t.stable();
    expect(big.style.transform).toBe('scale(1.25) rotate(270deg)');
    const close = t.el.querySelector<HTMLButtonElement>('[aria-label="Close"]')!;
    close.click();
    await t.stable();
    expect(t.host.events).toEqual(['show', 'hide']);
  });

  it('renders the preview template and the icon slots', async () => {
    const t = await setup((h) => h.slots.set(true));
    expect(t.el.querySelector('.own-hint')!.closest('[aria-hidden=true]')).not.toBeNull();
    t.button('Preview: Shelf photo').click();
    await t.stable();
    expect(t.el.querySelector('.own-preview')!.textContent).toBe(
      'shelf-large.png|scale(1) rotate(0deg)',
    );
    expect(t.el.querySelector('.own-rotate')).not.toBeNull();
  });
});
