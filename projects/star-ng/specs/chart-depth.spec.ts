import { Component, DebugElement, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  StarChart,
  StarChartPointSelectEvent,
  StarChartSeries,
  StarChartTooltip,
  StarChartType,
} from '@star-ng/ui/chart';

const key = (target: Element, init: KeyboardEventInit) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

@Component({
  imports: [StarChart, StarChartTooltip],
  template: `
    <star-chart
      [type]="type()"
      title="Orders"
      [labels]="['Jan', 'Feb', 'Mar']"
      [series]="series"
      (pointSelect)="selected.push($event)"
    >
      @if (custom()) {
        <ng-template starChartTooltip let-points let-label="label">
          <span class="own">{{ label }} / {{ points.length }} / {{ points[0]?.value }}</span>
        </ng-template>
      }
    </star-chart>
  `,
})
class InteractionHost {
  readonly type = signal<StarChartType>('line');
  readonly custom = signal(false);
  readonly series: StarChartSeries[] = [
    { label: 'Received', data: [10, 20, 30] },
    { label: 'Shipped', data: [5, 15, 25] },
  ];
  readonly selected: StarChartPointSelectEvent[] = [];
}

describe('StarChart interaction', () => {
  async function setup(change?: (host: InteractionHost) => void) {
    const fixture = TestBed.createComponent(InteractionHost);
    change?.(fixture.componentInstance);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const targets = () => [...el.querySelectorAll<HTMLElement>('.star-chart__target')];
    return { fixture, el, targets, host: fixture.componentInstance };
  }

  it('has one focus target per point, outside the hidden plot, with one tab stop', async () => {
    const { el, targets } = await setup();
    const group = el.querySelector('.star-chart__points')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Orders: data points');
    expect(group.closest('[aria-hidden=true]')).toBeNull();
    expect(targets().length).toBe(6);
    expect(targets().map((t) => t.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
    expect(targets()[0].getAttribute('aria-label')).toBe('Received, Jan: 10');
    expect(targets()[4].getAttribute('aria-label')).toBe('Shipped, Feb: 15');
  });

  it('moves with the arrow keys along a series and between series, and shows the tooltip', async () => {
    const { el, targets, fixture } = await setup();
    targets()[0].focus();
    await fixture.whenStable();
    expect(el.querySelector('.star-chart__tip')?.textContent).toContain('Jan');
    key(targets()[0], { key: 'ArrowRight' });
    await fixture.whenStable();
    expect(document.activeElement).toBe(targets()[1]);
    expect(targets()[1].tabIndex).toBe(0);
    expect(el.querySelector('.star-chart__tip')?.textContent).toContain('Feb');
    key(targets()[1], { key: 'ArrowDown' });
    await fixture.whenStable();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Shipped, Feb: 15');
    key(document.activeElement!, { key: 'End' });
    await fixture.whenStable();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Shipped, Mar: 25');
    key(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Received, Mar: 30');
    (document.activeElement as HTMLElement).blur();
    await fixture.whenStable();
    expect(el.querySelector('.star-chart__tip')).toBeNull();
  });

  it('emits pointSelect on Enter and on a click', async () => {
    const { targets, host } = await setup((h) => h.type.set('bar'));
    targets()[2].focus();
    key(targets()[2], { key: 'Enter' });
    targets()[3].click();
    expect(host.selected).toEqual([
      { seriesIndex: 0, index: 2, value: 30 },
      { seriesIndex: 1, index: 0, value: 5 },
    ]);
  });

  it('selects the point nearest to a click on the plot', async () => {
    const { el, host, fixture } = await setup();
    const hit = el.querySelectorAll('.star-chart__hit')[1];
    hit.dispatchEvent(new MouseEvent('mouseenter'));
    await fixture.whenStable();
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.selected.length).toBe(1);
    expect(host.selected[0].index).toBe(1);
  });

  it('renders the tooltip template with the points at the hover index', async () => {
    const { el, targets, fixture } = await setup((h) => h.custom.set(true));
    targets()[1].focus();
    await fixture.whenStable();
    expect(el.querySelector('.star-chart__tip .own')?.textContent?.trim()).toBe('Feb / 2 / 20');
  });

  it('has targets for a doughnut, a radar and a scatter chart', async () => {
    const { targets, fixture, host } = await setup((h) => h.type.set('doughnut'));
    expect(targets().length).toBe(3);
    expect(targets()[0].getAttribute('aria-label')).toBe('Received, Jan: 10');
    host.type.set('radar');
    await fixture.whenStable();
    expect(targets().length).toBe(6);
    host.type.set('scatter');
    await fixture.whenStable();
    expect(targets().length).toBe(6);
    expect(targets()[1].getAttribute('aria-label')).toBe('Received, 1: 20');
  });
});

@Component({
  imports: [StarChart],
  template: `
    <star-chart
      [type]="type()"
      title="Orders"
      [labels]="['Jan', 'Feb']"
      [series]="series"
      [(hiddenSeries)]="hidden"
      [legendPosition]="position()"
    />
  `,
})
class LegendHost {
  readonly type = signal<StarChartType>('bar');
  readonly position = signal<'top' | 'bottom' | 'start' | 'end'>('top');
  readonly hidden = signal<readonly number[]>([]);
  readonly series: StarChartSeries[] = [
    { label: 'Received', data: [10, 20] },
    { label: 'Shipped', data: [8, 18] },
    { label: 'Returned', data: [1, 2] },
  ];
}

describe('StarChart legend', () => {
  it('toggles a series with its legend button and keeps the colors in place', async () => {
    const fixture = TestBed.createComponent(LegendHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const legend = el.querySelector('.star-chart__legend')!;
    expect(legend.getAttribute('aria-hidden')).toBeNull();
    expect(legend.getAttribute('aria-label')).toBe('Legend: show or hide a series');
    const buttons = [...legend.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.map((b) => [b.textContent?.trim(), b.getAttribute('aria-pressed')])).toEqual([
      ['Received', 'true'],
      ['Shipped', 'true'],
      ['Returned', 'true'],
    ]);
    expect(el.querySelectorAll('.star-chart__bar').length).toBe(6);
    buttons[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.hidden()).toEqual([1]);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    const bars = [...el.querySelectorAll<SVGPathElement>('.star-chart__bar')];
    expect(bars.length).toBe(4);
    // "Returned" keeps the third color.
    expect(bars.map((b) => b.style.fill)).toContain('var(--star-chart-3)');
    expect(bars.map((b) => b.style.fill)).not.toContain('var(--star-chart-2)');
    // The table keeps every series; the focus targets follow the drawn ones.
    expect(el.querySelectorAll('thead th').length).toBe(4);
    expect(el.querySelectorAll('.star-chart__target').length).toBe(4);
    expect(el.querySelectorAll('.star-chart__target')[2].getAttribute('aria-label')).toBe(
      'Returned, Jan: 1',
    );
    buttons[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.hidden()).toEqual([]);
  });

  it('places the legend and keeps a doughnut legend static', async () => {
    const fixture = TestBed.createComponent(LegendHost);
    fixture.componentInstance.position.set('end');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('star-chart')!.classList).toContain('star-chart--legend-end');
    fixture.componentInstance.type.set('doughnut');
    await fixture.whenStable();
    expect(el.querySelector('.star-chart__legend')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.star-chart__legend button')).toBeNull();
  });
});

@Component({
  imports: [StarChart],
  template: `
    <star-chart
      [type]="type()"
      title="Revenue"
      locale="en-US"
      [labels]="['North', 'South', 'East']"
      [series]="series()"
      [valueFormat]="valueFormat()"
      [min]="min()"
      [max]="max()"
      [stepSize]="stepSize()"
      [horizontal]="horizontal()"
    />
  `,
})
class AxisHost {
  readonly type = signal<StarChartType>('bar');
  readonly series = signal<StarChartSeries[]>([{ label: 'Revenue', data: [1200, 2400, 3600] }]);
  readonly valueFormat = signal<Intl.NumberFormatOptions | null>(null);
  readonly min = signal<number | null>(null);
  readonly max = signal<number | null>(null);
  readonly stepSize = signal<number | null>(null);
  readonly horizontal = signal(false);
}

describe('StarChart axes and formatting', () => {
  async function setup(change: (host: AxisHost) => void) {
    const fixture = TestBed.createComponent(AxisHost);
    change(fixture.componentInstance);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const ticks = () =>
      [...el.querySelectorAll('.star-chart__svg text.star-chart__axis')].map((t) =>
        t.textContent?.trim(),
      );
    return { el, ticks, fixture };
  }

  it('formats values with valueFormat in the axis, the table and the points', async () => {
    const { el, ticks } = await setup((h) =>
      h.valueFormat.set({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    );
    expect(ticks()).toContain('€4,000');
    expect(el.querySelector('tbody td')?.textContent?.trim()).toBe('€1,200');
    expect(el.querySelector('.star-chart__target')?.getAttribute('aria-label')).toBe(
      'Revenue, North: €1,200',
    );
  });

  it('uses min, max and stepSize for the value axis', async () => {
    const { ticks } = await setup((h) => {
      h.min.set(1000);
      h.max.set(5000);
      h.stepSize.set(1000);
    });
    expect(ticks().slice(0, 5)).toEqual(['1,000', '2,000', '3,000', '4,000', '5,000']);
  });

  it('keeps round ticks between fixed ends without a step', async () => {
    const { ticks } = await setup((h) => h.max.set(4500));
    expect(ticks().slice(0, 4)).toEqual(['0', '2,000', '4,000', '4,500']);
  });

  it('draws horizontal bars with the categories down the side', async () => {
    const { el } = await setup((h) => h.horizontal.set(true));
    const labels = [...el.querySelectorAll<SVGTextElement>('.star-chart__svg text')].filter(
      (t) => t.textContent?.trim() === 'North',
    );
    expect(labels.length).toBe(1);
    expect(labels[0].getAttribute('text-anchor')).toBe('end');
    const bar = el.querySelector('.star-chart__bar')!.getAttribute('d')!;
    // A horizontal bar starts at the value 0 on the left and runs right.
    expect(bar.startsWith('M104,')).toBe(true);
    expect(el.querySelectorAll('.star-chart__bar').length).toBe(3);
  });

  it('draws a combo of bars and a line on a second value axis', async () => {
    const { el, ticks } = await setup((h) =>
      h.series.set([
        { label: 'Revenue', data: [1200, 2400, 3600] },
        { label: 'Margin', data: [5, 12, 9], type: 'line', axis: 'secondary' },
      ]),
    );
    expect(el.querySelectorAll('.star-chart__bar').length).toBe(3);
    expect(el.querySelectorAll('.star-chart__line').length).toBe(1);
    // The second axis has its own ticks at the end of the plot.
    const secondary = [...el.querySelectorAll<SVGTextElement>('.star-chart__svg text')].filter(
      (t) => t.getAttribute('x') === '592',
    );
    expect(secondary.map((t) => t.textContent?.trim())).toEqual(['0', '5', '10', '15']);
    expect(ticks()).toContain('4,000');
  });
});

@Component({
  imports: [StarChart],
  template: `<star-chart type="bar" title="Orders" [labels]="['Jan', 'Feb']" [series]="series" />`,
})
class ExportHost {
  readonly series: StarChartSeries[] = [{ label: 'Received', data: [10, 20] }];
}

describe('StarChart export', () => {
  function chartOf(fixture: { debugElement: DebugElement }): StarChart {
    return fixture.debugElement.query(By.directive(StarChart)).componentInstance as StarChart;
  }

  it('exports the plot as an SVG document with a title and without hover targets', async () => {
    const fixture = TestBed.createComponent(ExportHost);
    await fixture.whenStable();
    const svg = chartOf(fixture).exportSvg();
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<title>Orders</title>');
    expect(svg).toContain('width="640"');
    expect(svg.match(/<path/g)?.length).toBe(2);
    expect(svg).not.toContain('class=');
    expect(svg).not.toContain('data-export');
  });

  it('exports a PNG through a canvas', async () => {
    const fixture = TestBed.createComponent(ExportHost);
    await fixture.whenStable();
    const png = new Blob(['png'], { type: 'image/png' });
    const drawn: number[][] = [];
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: (_: unknown, ...size: number[]) => drawn.push(size),
    } as unknown as CanvasRenderingContext2D);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((done: BlobCallback) => done(png));
    const OriginalImage = window.Image;
    window.Image = class {
      onload: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onload?.());
      }
    } as unknown as typeof Image;
    try {
      expect(await chartOf(fixture).exportPng(3)).toBe(png);
      expect(drawn).toEqual([[0, 0, 1920, 840]]);
    } finally {
      window.Image = OriginalImage;
      getContext.mockRestore();
      toBlob.mockRestore();
    }
  });

  it('does nothing on the server', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const fixture = TestBed.createComponent(ExportHost);
    await fixture.whenStable();
    expect(chartOf(fixture).exportSvg()).toBe('');
    expect(await chartOf(fixture).exportPng()).toBeNull();
  });
});

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

@Component({
  imports: [StarChart],
  template: `<star-chart type="line" title="Visits" [labels]="months" [series]="series" />`,
})
class ResponsiveHost {
  readonly months = MONTHS;
  readonly series: StarChartSeries[] = [{ label: 'Visits', data: MONTHS.map((_, i) => i * 10) }];
}

describe('StarChart responsive labels', () => {
  it('keeps the view box, grows the axis text back and thins the labels when narrow', async () => {
    let report: ((entries: { contentRect: { width: number } }[]) => void) | null = null;
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback: typeof report) {
        report = callback;
      }
      observe(): void {
        // The test reports sizes itself.
      }
      disconnect(): void {
        report = null;
      }
    } as unknown as typeof ResizeObserver;
    try {
      const fixture = TestBed.createComponent(ResponsiveHost);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const svg = el.querySelector<SVGSVGElement>('.star-chart__svg')!;
      const labels = () =>
        [...svg.querySelectorAll('text')]
          .map((t) => t.textContent?.trim() ?? '')
          .filter((t) => /^[A-Z]/.test(t));
      expect(labels().length).toBe(12);
      expect(svg.classList).not.toContain('star-chart__svg--zoom');

      report!([{ contentRect: { width: 320 } }]);
      await fixture.whenStable();
      expect(svg.getAttribute('viewBox')).toBe('0 0 640 280');
      expect(svg.classList).toContain('star-chart__svg--zoom');
      expect(svg.style.getPropertyValue('--star-chart-zoom')).toBe('2');
      expect(labels().length).toBe(6);
      expect(labels()[0]).toBe('January');
      // The data stays complete: every month keeps its focus target and table row.
      expect(el.querySelectorAll('.star-chart__target').length).toBe(12);
      expect(el.querySelectorAll('tbody tr').length).toBe(12);

      report!([{ contentRect: { width: 640 } }]);
      await fixture.whenStable();
      expect(labels().length).toBe(12);
    } finally {
      globalThis.ResizeObserver = original;
    }
  });
});
