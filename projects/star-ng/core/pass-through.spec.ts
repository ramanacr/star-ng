import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarNg, StarConfigService } from './config';
import {
  StarPart,
  StarPassThrough,
  StarStyled,
  ɵSTAR_PART_HOST,
  ɵstarMergePassThrough,
  ɵstarSafePassThroughAttr,
} from './pass-through';

@Component({
  selector: 'star-demo',
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  host: { class: 'star-demo' },
  template: `<div class="star-demo__header" data-star-part="header">
      <span starPart="title">T</span>
    </div>
    <button type="button" data-star-part="close" aria-label="Close" [id]="closeId">x</button>
    @if (more()) {
      <p data-star-part="more">More</p>
    }
    <ng-content />`,
})
class Demo {
  readonly closeId = 'demo-close';
  readonly more = signal(false);
}

@Component({
  imports: [Demo],
  template: `<star-demo [pt]="pt()" [unstyled]="unstyled()" />
    <star-demo id="outer" [pt]="{ title: { class: 'outer-title' } }"
      ><star-demo id="inner" [pt]="{ title: { class: 'inner-title' } }"
    /></star-demo>`,
})
class Host {
  readonly pt = signal<StarPassThrough | null>(null);
  readonly unstyled = signal<boolean | undefined>(undefined);
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    root: el.querySelector<HTMLElement>('star-demo')!,
    header: el.querySelector<HTMLElement>('star-demo [data-star-part=header]')!,
    title: el.querySelector<HTMLElement>('star-demo [data-star-part=title]')!,
    stable: () => fixture.whenStable(),
  };
}

describe('pass-through and unstyled', () => {
  it('names the parts and the root', async () => {
    const { root, header, title } = await setup();
    expect(root.getAttribute('data-star-part')).toBe('root');
    expect(header.classList).toContain('star-demo__header');
    expect(title.getAttribute('data-star-part')).toBe('title');
    expect(root.hasAttribute('data-star-unstyled')).toBe(false);
  });

  it('applies the classes, styles and safe attributes of the instance pt', async () => {
    const { host, root, header, stable } = await setup();
    host.pt.set({
      root: { class: 'w-full' },
      header: {
        class: ['p-2', 'font-bold'],
        style: { 'max-width': '20rem' },
        attrs: { title: 'Header', 'data-test': 'h', onclick: 'alert(1)', href: 'x' },
      },
    });
    await stable();
    expect(root.classList).toContain('w-full');
    expect(root.classList).toContain('star-demo');
    expect(header.classList).toContain('p-2');
    expect(header.classList).toContain('font-bold');
    expect(header.classList).toContain('star-demo__header');
    expect(header.style.maxWidth).toBe('20rem');
    expect(header.getAttribute('title')).toBe('Header');
    expect(header.getAttribute('data-test')).toBe('h');
    expect(header.hasAttribute('onclick')).toBe(false);
    expect(header.hasAttribute('href')).toBe(false);

    host.pt.set({ header: { class: { 'p-4': true, 'p-2': false } } });
    await stable();
    expect(header.classList).toContain('p-4');
    expect(header.classList).not.toContain('p-2');
    expect(header.hasAttribute('title')).toBe(false);
    expect(root.classList).not.toContain('w-full');
  });

  it('merges the instance pt over the global pt of provideStarNg', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideStarNg({
          pt: { 'star-demo': { header: { class: 'global', attrs: { title: 'Global' } } } },
        }),
      ],
    });
    const { host, header, stable } = await setup();
    expect(header.classList).toContain('global');
    expect(header.getAttribute('title')).toBe('Global');
    host.pt.set({ header: { class: 'local', attrs: { title: 'Local' } } });
    await stable();
    expect(header.classList).toContain('global');
    expect(header.classList).toContain('local');
    expect(header.getAttribute('title')).toBe('Local');
  });

  it('marks the root and every part as unstyled, from the input or the configuration', async () => {
    const { host, root, header, title, stable } = await setup();
    TestBed.inject(StarConfigService).update({ unstyled: true });
    await stable();
    expect(root.hasAttribute('data-star-unstyled')).toBe(true);
    expect(header.hasAttribute('data-star-unstyled')).toBe(true);
    expect(title.hasAttribute('data-star-unstyled')).toBe(true);
    host.unstyled.set(false);
    await stable();
    expect(root.hasAttribute('data-star-unstyled')).toBe(false);
    expect(header.hasAttribute('data-star-unstyled')).toBe(false);
  });

  it('keeps the pass-through of each control for nested controls', async () => {
    const { fixture } = await setup();
    const el = fixture.nativeElement as HTMLElement;
    const outer = el.querySelector('#outer > div [data-star-part=title]')!;
    const inner = el.querySelector('#inner [data-star-part=title]')!;
    expect(outer.classList).toContain('outer-title');
    expect(inner.classList).toContain('inner-title');
    expect(inner.classList).not.toContain('outer-title');
  });

  it('without any pt only names the parts: no classes, styles or tracking', async () => {
    const { root, header, fixture } = await setup();
    const styled = fixture.debugElement
      .query((node) => node.nativeElement === root)
      .injector.get(StarStyled);
    expect(header.getAttribute('data-star-part')).toBe('header');
    expect(header.getAttribute('class')).toBe('star-demo__header');
    expect(header.hasAttribute('style')).toBe(false);
    expect((styled as unknown as { parts: Map<Element, unknown> }).parts.size).toBe(0);
  });

  it('applies a pt that is set later, also to parts created after it', async () => {
    const { host, root, header, fixture, stable } = await setup();
    host.pt.set({ header: { class: 'late' }, more: { class: 'late-more' } });
    await stable();
    expect(header.classList).toContain('late');
    const demo = fixture.debugElement.query((node) => node.nativeElement === root)
      .componentInstance as Demo;
    demo.more.set(true);
    await stable();
    expect(root.querySelector('[data-star-part=more]')!.classList).toContain('late-more');
  });

  it('forgets the parts that leave the page (rows, closed panels)', async () => {
    const { host, root, fixture, stable } = await setup();
    host.pt.set({ more: { class: 'late-more' } });
    await stable();
    const debug = fixture.debugElement.query((node) => node.nativeElement === root);
    const demo = debug.componentInstance as Demo;
    const parts = (debug.injector.get(StarStyled) as unknown as { parts: Map<Element, unknown> })
      .parts;
    const size = parts.size;
    for (let round = 0; round < 50; round++) {
      demo.more.set(true);
      await stable();
      demo.more.set(false);
      await stable();
    }
    await new Promise((resolve) => setTimeout(resolve));
    expect(parts.size).toBeLessThanOrEqual(size + 1);
  });

  it('restores the template value of an attribute when the pt removes its override', async () => {
    const { host, root, stable } = await setup();
    const close = root.querySelector<HTMLElement>('[data-star-part=close]')!;
    host.pt.set({ close: { attrs: { 'aria-label': 'Shut', id: 'other' } } });
    await stable();
    expect(close.getAttribute('aria-label')).toBe('Shut');
    // `id` is not allowed: ids of a template are referenced by other elements.
    expect(close.id).toBe('demo-close');
    host.pt.set(null);
    await stable();
    expect(close.getAttribute('aria-label')).toBe('Close');
  });

  it('allows only title, data-* and aria-* attributes', () => {
    expect(ɵstarSafePassThroughAttr('id')).toBe(false);
    expect(ɵstarSafePassThroughAttr('title')).toBe(true);
    expect(ɵstarSafePassThroughAttr('data-row')).toBe(true);
    expect(ɵstarSafePassThroughAttr('aria-label')).toBe(true);
    expect(ɵstarSafePassThroughAttr('onclick')).toBe(false);
    expect(ɵstarSafePassThroughAttr('style')).toBe(false);
    expect(ɵstarSafePassThroughAttr('href')).toBe(false);
    expect(ɵstarSafePassThroughAttr('data-star-part')).toBe(false);
  });

  it('merges one part: classes add up, styles and attributes merge', () => {
    expect(ɵstarMergePassThrough(undefined, undefined)).toBeNull();
    expect(
      ɵstarMergePassThrough(
        { class: 'a b', style: { color: 'red' }, attrs: { title: 'x' } },
        { class: ['c'], style: { margin: '0' } },
      ),
    ).toEqual({
      class: ['a', 'b', 'c'],
      style: { color: 'red', margin: '0' },
      attrs: { title: 'x' },
    });
  });
});

@Component({
  selector: 'star-portal-demo',
  imports: [StarPart, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  template: `
    @if (more()) {
      <p data-star-part="more">More</p>
    }
    @if (portal()) {
      <ng-container *ngTemplateOutlet="panel" />
    }
    <ng-template #panel><div starPart="panel">Panel</div></ng-template>
  `,
})
class PortalDemo {
  readonly more = signal(false);
  readonly portal = signal(true);
}

@Component({
  imports: [PortalDemo],
  template: `<star-portal-demo [pt]="{ more: { class: 'late-more' } }" />`,
})
class PortalHost {}

describe('pass-through with portals', () => {
  it('adopts the parts added in the same task in which a portal goes away', async () => {
    const fixture = TestBed.createComponent(PortalHost);
    await fixture.whenStable();
    const demo = fixture.debugElement.children[0].componentInstance as PortalDemo;
    demo.more.set(true);
    demo.portal.set(false);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    const more = (fixture.nativeElement as HTMLElement).querySelector('[data-star-part=more]')!;
    expect(more.classList).toContain('late-more');
  });
});
