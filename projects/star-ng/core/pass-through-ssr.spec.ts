import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { StarStyled, ɵSTAR_PART_HOST } from './pass-through';

@Component({
  selector: 'star-ssr-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  template: `<div data-star-part="header"><span data-star-part="title">T</span></div>
    @for (item of items; track item) {
      <p data-star-part="item">{{ item }}</p>
    }`,
})
class Demo {
  readonly items = ['a', 'b'];
}

@Component({
  selector: 'star-ssr-root',
  imports: [Demo],
  template: `<star-ssr-demo
    unstyled
    [pt]="{ item: { class: 'x-item', attrs: { 'data-test': 'i' } } }"
  />`,
})
class Root {}

describe('pass-through on the server', () => {
  it('applies pt and unstyled to every part in the server HTML', async () => {
    const html = await renderApplication(
      (context) =>
        bootstrapApplication(Root, { providers: [provideZonelessChangeDetection()] }, context),
      { document: '<html><body><star-ssr-root></star-ssr-root></body></html>', url: '/' },
    );
    const items = html.match(/<p[^>]*data-star-part="item"[^>]*>/g) ?? [];
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item).toContain('x-item');
      expect(item).toContain('data-test="i"');
      expect(item).toContain('data-star-unstyled');
    }
    expect(html).toMatch(
      /<span[^>]*data-star-part="title"[^>]*data-star-unstyled|<span[^>]*data-star-unstyled[^>]*data-star-part="title"/,
    );
  });
});
