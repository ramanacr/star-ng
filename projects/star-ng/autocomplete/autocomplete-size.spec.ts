import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarNg } from '@star-ng/ui/core';
import { StarAutoComplete, StarMultiAutoComplete } from './autocomplete';

@Component({
  imports: [StarAutoComplete, StarMultiAutoComplete],
  template: `
    <star-autocomplete class="single" [options]="countries" [size]="size()" ariaLabel="Country" />
    <star-multi-autocomplete
      class="multi"
      [options]="countries"
      [size]="size()"
      ariaLabel="Countries"
    />
    <star-autocomplete class="plain" [options]="countries" ariaLabel="Plain" />
    <star-multi-autocomplete class="plain-multi" [options]="countries" ariaLabel="Plain multi" />
  `,
})
class Host {
  readonly countries = ['Austria', 'Belgium', 'Canada'];
  readonly size = signal<'sm' | 'md'>('sm');
}

describe('StarAutoComplete size', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, q: (s: string) => el.querySelector(s) as HTMLElement };
  }

  it('size sm adds the small classes on both autocompletes', () => {
    const { q } = setup();
    for (const host of [q('.single'), q('.multi')]) {
      expect(host.classList).toContain('star-select--sm');
      expect(host.classList).toContain('star-ac--sm');
    }
  });

  it('the default is md: no small class', () => {
    const { q } = setup();
    for (const host of [q('.plain'), q('.plain-multi')]) {
      expect(host.classList).not.toContain('star-select--sm');
      expect(host.classList).not.toContain('star-ac--sm');
      expect(host.classList).toContain('star-ac');
    }
  });

  it('switching back to md removes the small classes', () => {
    const { fixture, q } = setup();
    fixture.componentInstance.size.set('md');
    fixture.detectChanges();
    for (const host of [q('.single'), q('.multi')]) {
      expect(host.classList).not.toContain('star-select--sm');
      expect(host.classList).not.toContain('star-ac--sm');
    }
  });

  it('size small of provideStarNg makes the autocompletes small by default', () => {
    TestBed.configureTestingModule({ providers: [provideStarNg({ size: 'small' })] });
    const { q } = setup();
    expect(q('.plain').classList).toContain('star-ac--sm');
    expect(q('.plain-multi').classList).toContain('star-ac--sm');
  });
});
