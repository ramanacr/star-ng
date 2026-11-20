// The server has no MutationObserver: the control adopts the parts that a render created after
// the render, so the server HTML carries the pass-through and the unstyled mode of every part.
// `PLATFORM_ID` 'server' makes the control take that path in the test DOM (a real server render
// in this test run would replace the DOM globals of the other specs).
import { ChangeDetectionStrategy, Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarStyled, ɵSTAR_PART_HOST } from './pass-through';

@Component({
  selector: 'star-ssr-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  template: `<div data-star-part="header"><span data-star-part="title">T</span></div>
    @for (item of items(); track item) {
      <p data-star-part="item">{{ item }}</p>
    }`,
})
class Demo {
  readonly items = signal(['a', 'b']);
}

@Component({
  imports: [Demo],
  template: `<star-ssr-demo
    unstyled
    [pt]="{ item: { class: 'x-item', attrs: { 'data-test': 'i' } } }"
  />`,
})
class Root {}

describe('pass-through on the server', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] }),
  );

  it('applies pt and unstyled to every part, also to parts of a later render', async () => {
    const fixture = TestBed.createComponent(Root);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const check = () => {
      const items = [...el.querySelectorAll('[data-star-part=item]')];
      for (const item of items) {
        expect(item.classList).toContain('x-item');
        expect(item.getAttribute('data-test')).toBe('i');
        expect(item.hasAttribute('data-star-unstyled')).toBe(true);
      }
      expect(el.querySelector('[data-star-part=title]')!.hasAttribute('data-star-unstyled')).toBe(
        true,
      );
      return items.length;
    };
    expect(check()).toBe(2);
    // The control renders again on its own (a signal of the control) before the application is
    // stable, as a server render that loads data does.
    const demo = fixture.debugElement.children[0].componentInstance as Demo;
    demo.items.set(['a', 'b', 'c']);
    await fixture.whenStable();
    expect(check()).toBe(3);
  });
});
