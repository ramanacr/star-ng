import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarUiText } from '@star-ng/ui/core';
import { StarSparkline, StarSparklineHighlight, StarSparklineType } from '@star-ng/ui/sparkline';

@Component({
  imports: [StarSparkline],
  template: `<star-sparkline
    [type]="type()"
    [data]="data()"
    [highlight]="highlight()"
    [referenceLine]="reference()"
    [color]="color()"
    [ariaLabel]="label()"
    locale="en-US"
  />`,
})
class Host {
  readonly type = signal<StarSparklineType>('line');
  readonly data = signal<readonly number[]>([12, 9, 15, 21.5]);
  readonly highlight = signal<readonly StarSparklineHighlight[]>(['last']);
  readonly reference = signal<number | undefined>(undefined);
  readonly color = signal(1);
  readonly label = signal<string | null>(null);
}

async function setup(platform?: string) {
  if (platform) {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
  }
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const host = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('star-sparkline')!;
  return { fixture, host, svg: host.querySelector('svg')! };
}

describe('StarSparkline', () => {
  it('is an image with a summary label and no focus stop', async () => {
    const { host, svg } = await setup();
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe(
      'Trend up: first 12, last 21.5, lowest 9, highest 21.5',
    );
    expect(host.hasAttribute('tabindex')).toBe(false);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
  });

  it('takes the label from ariaLabel when it is set', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.label.set('Weekly sales');
    await fixture.whenStable();
    expect(host.getAttribute('aria-label')).toBe('Weekly sales');
  });

  it('builds the summary from STAR_UI_TEXT', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideStarUiText({
          sparklineSummary: (first, last, min, max, trend) =>
            `${trend}|${first}|${last}|${min}|${max}`,
          sparklineTrendUp: 'UP',
        }),
      ],
    });
    const { host } = await setup();
    expect(host.getAttribute('aria-label')).toBe('UP|12|21.5|9|21.5');
  });

  it('says that there is no data', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.data.set([]);
    await fixture.whenStable();
    expect(host.getAttribute('aria-label')).toBe('No data');
    expect(host.querySelector('.star-sparkline__line')).toBeNull();
  });

  it('draws a line with a marker on the last value', async () => {
    const { host } = await setup();
    expect(host.querySelector('.star-sparkline__line')?.getAttribute('d')).toMatch(/^M /);
    const markers = host.querySelectorAll('.star-sparkline__marker');
    expect(markers.length).toBe(1);
    expect(markers[0].classList).toContain('star-sparkline__marker--last');
  });

  it('marks the lowest and the highest value', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.highlight.set(['min', 'max']);
    await fixture.whenStable();
    expect(
      [...host.querySelectorAll('.star-sparkline__marker')].map((m) => m.getAttribute('class')),
    ).toEqual([
      'star-sparkline__marker star-sparkline__marker--min',
      'star-sparkline__marker star-sparkline__marker--max',
    ]);
    fixture.componentInstance.highlight.set(['none']);
    await fixture.whenStable();
    expect(host.querySelectorAll('.star-sparkline__marker').length).toBe(0);
  });

  it('draws an area under the line', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.type.set('area');
    await fixture.whenStable();
    expect(host.querySelector('.star-sparkline__area')?.getAttribute('d')).toContain('Z');
    expect(host.querySelector('.star-sparkline__line')).not.toBeNull();
  });

  it('draws one bar per value and win-loss bars', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.type.set('bar');
    await fixture.whenStable();
    expect(host.querySelectorAll('.star-sparkline__bar').length).toBe(4);
    fixture.componentInstance.type.set('win-loss');
    fixture.componentInstance.data.set([1, -2, 3]);
    await fixture.whenStable();
    expect(host.querySelectorAll('.star-sparkline__bar--negative').length).toBe(1);
    expect(host.getAttribute('aria-label')).toBe('2 wins, 1 loss');
  });

  it('draws a reference line', async () => {
    const { fixture, host } = await setup();
    expect(host.querySelector('.star-sparkline__reference')).toBeNull();
    fixture.componentInstance.reference.set(15);
    await fixture.whenStable();
    expect(host.querySelector('.star-sparkline__reference')).not.toBeNull();
  });

  it('uses a slot of the chart palette', async () => {
    const { fixture, host } = await setup();
    expect(host.style.getPropertyValue('--star-sparkline-color')).toBe('var(--star-chart-1)');
    fixture.componentInstance.color.set(3);
    await fixture.whenStable();
    expect(host.style.getPropertyValue('--star-sparkline-color')).toBe('var(--star-chart-3)');
    fixture.componentInstance.color.set(12);
    await fixture.whenStable();
    expect(host.style.getPropertyValue('--star-sparkline-color')).toBe('var(--star-chart-1)');
  });

  it('mirrors the x axis in right-to-left', async () => {
    document.documentElement.dir = 'rtl';
    try {
      const { host } = await setup();
      const d = host.querySelector('.star-sparkline__line')!.getAttribute('d')!;
      expect(d.startsWith('M 100.00 ')).toBe(true);
    } finally {
      document.documentElement.dir = '';
    }
  });

  it('renders on the server', async () => {
    const { host } = await setup('server');
    expect(host.querySelector('.star-sparkline__line')).not.toBeNull();
    expect(host.getAttribute('aria-label')).toContain('Trend up');
  });
});
