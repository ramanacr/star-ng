import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarChart } from '@star-ng/ui/chart';
import {
  StarAnimateOnScroll,
  StarFloatLabel,
  StarFocusTrap,
  StarImageCompare,
  StarInplace,
  StarInplaceContent,
  StarInplaceDisplay,
  StarRipple,
  StarScrollPanel,
} from '@star-ng/ui/utility';

@Component({
  imports: [
    StarInplace,
    StarInplaceDisplay,
    StarInplaceContent,
    StarScrollPanel,
    StarFocusTrap,
    StarFloatLabel,
    StarImageCompare,
  ],
  template: `
    <star-inplace ariaLabel="Edit name" closable [(active)]="editing">
      <ng-template starInplaceDisplay>{{ name() }}</ng-template>
      <ng-template starInplaceContent>
        <input class="name" [value]="name()" (input)="name.set($any($event.target).value)" />
      </ng-template>
    </star-inplace>
    <star-scroll-panel height="6rem" ariaLabel="Narrative">Long text</star-scroll-panel>
    <div class="trap" [starFocusTrap]="true"><button type="button">Inside</button></div>
    <star-float-label label="Reporter name"><input class="reporter" /></star-float-label>
    <star-image-compare
      leftSrc="before.png"
      rightSrc="after.png"
      leftAlt="Before"
      rightAlt="After"
      [(value)]="split"
    />
  `,
})
class Host {
  readonly editing = signal(false);
  readonly name = signal('A. Rivera');
  readonly split = signal(50);
}

describe('inplace, scroll panel, focus trap, float label, image compare', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  }

  it('inplace swaps the value for the edit content and goes back on Escape', async () => {
    const { fixture, el, host } = await setup();
    const display = el.querySelector<HTMLButtonElement>('.star-inplace__display')!;
    // The name comes from the content (label and value), so it holds the visible text.
    expect(display.hasAttribute('aria-label')).toBe(false);
    expect(display.textContent!.replace(/\s+/g, ' ').trim()).toBe('Edit name: A. Rivera');
    expect(el.querySelector('.name')).toBeNull();

    display.click();
    await fixture.whenStable();
    const input = el.querySelector<HTMLInputElement>('.name')!;
    expect(host.editing()).toBe(true);
    expect(document.activeElement).toBe(input);

    input.value = 'L. Chen';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(host.editing()).toBe(false);
    expect(el.querySelector('.star-inplace__display')?.textContent).toContain('L. Chen');
    expect(document.activeElement).toBe(el.querySelector('.star-inplace__display'));
  });

  it('scroll panel is a named region that takes keyboard focus', async () => {
    const { el } = await setup();
    const panel = el.querySelector<HTMLElement>('star-scroll-panel')!;
    expect(panel.getAttribute('role')).toBe('region');
    expect(panel.getAttribute('aria-label')).toBe('Narrative');
    expect(panel.tabIndex).toBe(0);
    expect(panel.style.height).toBe('6rem');
  });

  it('focus trap adds the CDK focus anchors around the element', async () => {
    const { el } = await setup();
    // CDK puts one focus anchor before the element and one after it.
    const trap = el.querySelector('.trap')!;
    expect(trap.previousElementSibling?.classList).toContain('cdk-focus-trap-anchor');
    expect(trap.nextElementSibling?.classList).toContain('cdk-focus-trap-anchor');
  });

  it('float label wraps the control in its label', async () => {
    const { el } = await setup();
    const input = el.querySelector<HTMLInputElement>('.reporter')!;
    expect(input.labels?.[0]?.textContent?.trim()).toBe('Reporter name');
  });

  it('image compare moves the divider with the range input', async () => {
    const { fixture, el, host } = await setup();
    const compare = el.querySelector<HTMLElement>('star-image-compare')!;
    const range = compare.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(range.getAttribute('aria-label')).toBe('Compare images');
    expect([...compare.querySelectorAll('img')].map((image) => image.alt)).toEqual([
      'After',
      'Before',
    ]);
    range.value = '80';
    range.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.split()).toBe(80);
    expect(compare.style.getPropertyValue('--star-compare')).toBe('80%');
    expect(range.getAttribute('aria-valuetext')).toBe('80%');
  });
});

@Component({
  imports: [StarChart, StarFloatLabel, StarRipple, StarAnimateOnScroll],
  template: `
    <star-chart [type]="type()" title="Cases" [labels]="labels" [series]="series" />
    <star-float-label label="Name"><input class="plain" /></star-float-label>
    <star-float-label label="Note"
      ><input class="own" placeholder="Type a note"
    /></star-float-label>
    <button type="button" class="ink" starRipple>Save</button>
    <p class="reveal" starAnimateOnScroll>Text</p>
  `,
})
class MoreHost {
  readonly type = signal<'pie' | 'area' | 'doughnut' | 'line'>('pie');
  readonly labels = ['Jan', 'Feb', 'Mar'];
  readonly series = [{ label: 'Cases', data: [10, 30, 60] }];
}

describe('pie and area charts, ripple, animate on scroll, float label placeholder', () => {
  async function setup() {
    const fixture = TestBed.createComponent(MoreHost);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  }

  it('draws a pie as wedges from the centre, without the total, and keeps the data table', async () => {
    const { fixture, el, host } = await setup();
    const paths = () =>
      [...el.querySelectorAll('.star-chart__slice')].map((p) => p.getAttribute('d'));
    expect(paths().length).toBe(3);
    expect(paths().every((d) => d?.startsWith('M0,0L'))).toBe(true);
    expect(el.querySelector('.star-chart__total')).toBeNull();
    expect(el.querySelectorAll('.star-chart__table tbody tr').length).toBe(3);

    host.type.set('doughnut');
    await fixture.whenStable();
    expect(paths().every((d) => !d?.startsWith('M0,0L'))).toBe(true);
    expect(el.querySelector('.star-chart__total')?.textContent?.trim()).toBe('100');
  });

  it('draws an area chart as a line with a closed fill under it', async () => {
    const { fixture, el, host } = await setup();
    host.type.set('area');
    await fixture.whenStable();
    expect(el.querySelectorAll('.star-chart__line').length).toBe(1);
    expect(el.querySelector('.star-chart__area')?.getAttribute('d')).toMatch(/Z$/);

    host.type.set('line');
    await fixture.whenStable();
    expect(el.querySelector('.star-chart__area')).toBeNull();
  });

  it('gives a float label control an empty placeholder only when it has none', async () => {
    const { el } = await setup();
    expect(el.querySelector('.plain')?.getAttribute('placeholder')).toBe(' ');
    expect(el.querySelector('.own')?.getAttribute('placeholder')).toBe('Type a note');
  });

  it('adds a ripple on press and removes it when its animation ends', async () => {
    const { el } = await setup();
    const button = el.querySelector<HTMLElement>('.ink')!;
    button.dispatchEvent(new MouseEvent('pointerdown', { clientX: 5, clientY: 5, bubbles: true }));
    const ink = button.querySelector('.star-ripple__ink')!;
    expect(ink.getAttribute('aria-hidden')).toBe('true');
    ink.dispatchEvent(new Event('animationend'));
    expect(button.querySelector('.star-ripple__ink')).toBeNull();
  });

  it('shows animate-on-scroll content at once where no observer exists', async () => {
    const { fixture, el } = await setup();
    await fixture.whenStable();
    // jsdom has no IntersectionObserver: the content must not stay hidden.
    expect(typeof IntersectionObserver).toBe('undefined');
    expect(el.querySelector('.reveal')?.classList).toContain('star-reveal--in');
  });
});
