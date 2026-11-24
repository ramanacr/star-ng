import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarUiText } from '@star-ng/ui/core';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';
import {
  StarDescriptionEntry,
  StarDescriptionItem,
  StarDescriptionList,
  StarDescriptionListLayout,
} from './description-list';

@Component({
  imports: [StarDescriptionList, StarDescriptionItem],
  template: `
    <star-description-list
      class="data"
      [items]="items()"
      [layout]="layout()"
      [columns]="columns()"
      [labelWidth]="labelWidth()"
      [size]="size()"
      [placeholder]="placeholder()"
      [truncate]="truncate()"
    />
    <star-description-list class="content">
      <star-description-item label="Status" hint="Set by the warehouse">
        <span class="tag">Shipped</span>
      </star-description-item>
      <star-description-item label="Contact">
        <a href="mailto:orders@example.com">orders&#64;example.com</a>
      </star-description-item>
      <star-description-item label="Note" />
      @if (showExtra()) {
        <star-description-item label="Carrier">Rail</star-description-item>
      }
    </star-description-list>
  `,
})
class Host {
  readonly items = signal<readonly StarDescriptionEntry[] | null>([
    { label: 'Organization', value: 'Example Trading' },
    { label: 'Site', value: 'Site 01', hint: 'Main warehouse' },
    { label: 'Received', value: '24-Aug-2026 12:58' },
    { label: 'Pending reason', value: null },
    { label: 'Quantity', value: 0 },
  ]);
  readonly layout = signal<StarDescriptionListLayout>('stacked');
  readonly columns = signal(2);
  readonly labelWidth = signal<string | null>(null);
  readonly size = signal<'sm' | 'md'>('md');
  readonly placeholder = signal<string | null>(null);
  readonly truncate = signal(false);
  readonly showExtra = signal(false);
}

describe('StarDescriptionList', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const data = el.querySelector<HTMLElement>('star-description-list.data')!;
    const content = el.querySelector<HTMLElement>('star-description-list.content')!;
    return { fixture, host: fixture.componentInstance, el, data, content };
  }

  const labels = (list: HTMLElement) =>
    [...list.querySelectorAll('dt')].map((node) => node.textContent?.trim());
  const values = (list: HTMLElement) =>
    [...list.querySelectorAll('dd .star-description-list__text')].map((node) =>
      node.textContent?.trim(),
    );

  it('renders a dl with one div, dt and dd per pair', async () => {
    const { data } = await setup();
    const dl = data.querySelector('dl')!;
    expect(dl.children.length).toBe(5);
    for (const group of Array.from(dl.children)) {
      expect(group.tagName).toBe('DIV');
      expect([...group.children].map((node) => node.tagName)).toEqual(['DT', 'DD']);
    }
    expect(labels(data)).toEqual([
      'Organization',
      'Site',
      'Received',
      'Pending reason',
      'Quantity',
    ]);
    expect(values(data)).toEqual(['Example Trading', 'Site 01', '24-Aug-2026 12:58', '', '0']);
  });

  it('shows the hint under the value', async () => {
    const { data } = await setup();
    const site = data.querySelectorAll('dd')[1];
    expect(site.querySelector('.star-description-list__hint')?.textContent?.trim()).toBe(
      'Main warehouse',
    );
    expect(data.querySelectorAll('.star-description-list__hint').length).toBe(1);
  });

  it('shows the dash for an empty value, with a text for screen readers', async () => {
    const { data } = await setup();
    const pending = data.querySelectorAll('dd')[3];
    const placeholder = pending.querySelector('.star-description-list__placeholder')!;
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
    expect(placeholder.textContent).toBe('—');
    expect(pending.querySelector('.star-sr-only')?.textContent).toBe('No value');
    // 0 is a value, not an empty one.
    expect(data.querySelectorAll('.star-description-list__placeholder').length).toBe(1);
  });

  it('takes a custom placeholder', async () => {
    const { fixture, host, data } = await setup();
    host.placeholder.set('Not set');
    host.items.set([
      { label: 'A', value: '' },
      { label: 'B', value: undefined },
    ]);
    await fixture.whenStable();
    const texts = [...data.querySelectorAll('.star-description-list__placeholder')].map(
      (node) => node.textContent,
    );
    expect(texts).toEqual(['Not set', 'Not set']);
    expect(data.querySelector('.star-sr-only')).toBeNull();
  });

  it('reads the placeholder texts from STAR_UI_TEXT', async () => {
    TestBed.configureTestingModule({ providers: [provideStarUiText(STAR_UI_TEXT_DE)] });
    const { data } = await setup();
    expect(data.querySelector('dd .star-sr-only')?.textContent).toBe('Kein Wert');
  });

  it('sets the layout, size, columns and label width', async () => {
    const { fixture, host, data } = await setup();
    expect(data.classList).toContain('star-description-list--stacked');
    expect(data.classList).toContain('star-description-list--md');
    host.layout.set('inline');
    host.labelWidth.set('12rem');
    host.size.set('sm');
    await fixture.whenStable();
    expect(data.classList).toContain('star-description-list--inline');
    expect(data.classList).toContain('star-description-list--sm');
    expect(data.style.getPropertyValue('--star-description-list-label-width')).toBe('12rem');
    host.layout.set('columns');
    host.columns.set(3);
    await fixture.whenStable();
    expect(data.classList).toContain('star-description-list--columns');
    expect(data.style.getPropertyValue('--star-description-list-columns')).toBe('3');
  });

  it('renders projected items with their content as the value', async () => {
    const { fixture, host, content } = await setup();
    expect(labels(content)).toEqual(['Status', 'Contact', 'Note']);
    const dds = content.querySelectorAll('dd');
    expect(dds[0].querySelector('.tag')?.textContent).toBe('Shipped');
    expect(dds[0].querySelector('.star-description-list__hint')?.textContent?.trim()).toBe(
      'Set by the warehouse',
    );
    expect(dds[1].querySelector('a')?.getAttribute('href')).toBe('mailto:orders@example.com');
    // The item element itself is not rendered: the dl holds only div, dt and dd.
    expect(content.querySelector('star-description-item')).toBeNull();
    // A projected item without content shows the placeholder (measured after render).
    expect(dds[2].querySelector('.star-description-list__placeholder')).not.toBeNull();
    expect(dds[0].querySelector('.star-description-list__placeholder')).toBeNull();
    host.showExtra.set(true);
    await fixture.whenStable();
    expect(labels(content)).toEqual(['Status', 'Contact', 'Note', 'Carrier']);
    expect(values(content).at(-1)).toBe('Rail');
  });

  it('puts the items of the input before the projected items', async () => {
    @Component({
      imports: [StarDescriptionList, StarDescriptionItem],
      template: `
        <star-description-list [items]="[{ label: 'First', value: 1 }]">
          <star-description-item label="Second">2</star-description-item>
        </star-description-list>
      `,
    })
    class Mixed {}
    const fixture = TestBed.createComponent(Mixed);
    await fixture.whenStable();
    expect(labels(fixture.nativeElement)).toEqual(['First', 'Second']);
  });

  describe('truncate', () => {
    let wide = false;
    beforeEach(() => {
      wide = false;
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return wide && this.textContent?.includes('Example Trading') ? 400 : 100;
      });
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
    });
    afterEach(() => vi.restoreAllMocks());

    it('gives a cut value the tooltip and the focus, and leaves the others', async () => {
      const { fixture, host, data } = await setup();
      wide = true;
      host.truncate.set(true);
      await fixture.whenStable();
      await fixture.whenStable();
      expect(data.classList).toContain('star-description-list--truncate');
      const [first, second] = [
        ...data.querySelectorAll<HTMLElement>('.star-description-list__text'),
      ];
      expect(first.getAttribute('tabindex')).toBe('0');
      expect(second.hasAttribute('tabindex')).toBe(false);
      first.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 350));
      await fixture.whenStable();
      const tooltip = document.querySelector('.star-tooltip');
      expect(tooltip?.textContent).toBe('Example Trading');
      expect(first.getAttribute('aria-describedby')).toBe(tooltip?.id);
      first.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('has no tooltip and no tab stop without truncate', async () => {
      const { data } = await setup();
      wide = true;
      expect(data.querySelector('[tabindex]')).toBeNull();
    });
  });
});
