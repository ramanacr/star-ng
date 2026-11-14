import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarChart, StarChartPointSeries, StarChartSeries } from 'star-ng/chart';

@Component({
  imports: [StarChart],
  template: `
    <star-chart id="bar" type="bar" title="Volume" [labels]="['Jan', 'Feb']" [series]="two" />
    <star-chart
      id="donut"
      type="doughnut"
      title="Channels"
      [labels]="['A', 'B', 'C', 'D', 'E']"
      [series]="mix"
    />
  `,
})
class ChartHost {
  readonly two: StarChartSeries[] = [
    { label: 'Received', data: [10, 20] },
    { label: 'Closed', data: [8, 18] },
  ];
  readonly mix: StarChartSeries[] = [{ label: 'Count', data: [50, 30, 10, 6, 4] }];
}

describe('StarChart', () => {
  it('draws grouped bars with a legend and an accessible data table', async () => {
    const fixture = TestBed.createComponent(ChartHost);
    await fixture.whenStable();
    const bar = (fixture.nativeElement as HTMLElement).querySelector('#bar')!;
    expect(bar.querySelectorAll('.star-chart__bar').length).toBe(4);
    expect(
      [...bar.querySelectorAll('.star-chart__legend li')].map((l) => l.textContent?.trim()),
    ).toEqual(['Received', 'Closed']);
    const table = bar.querySelector('table')!;
    expect(table.classList).toContain('star-sr-only');
    expect(
      [...table.querySelectorAll('tbody tr')].map((r) =>
        [...r.children].map((c) => c.textContent?.trim()).join(' '),
      ),
    ).toEqual(['Jan 10 8', 'Feb 20 18']);
    bar.querySelector<HTMLButtonElement>('.star-chart__head button')!.click();
    await fixture.whenStable();
    expect(table.classList).not.toContain('star-sr-only');
  });

  it('doughnut folds categories beyond the 4 validated slots into Other', async () => {
    const fixture = TestBed.createComponent(ChartHost);
    await fixture.whenStable();
    const donut = (fixture.nativeElement as HTMLElement).querySelector('#donut')!;
    const rows = [...donut.querySelectorAll('tbody tr')].map((r) =>
      r.querySelector('th')?.textContent?.trim(),
    );
    expect(rows).toEqual(['A', 'B', 'C', 'Other']);
    expect(donut.querySelector('tbody tr:last-child td:last-child')?.textContent?.trim()).toBe(
      '10%',
    );
  });
});

@Component({
  imports: [StarChart],
  template: `
    <star-chart
      id="stacked"
      type="stacked-bar"
      title="Orders by channel"
      categoryLabel="Month"
      [labels]="['Jan', 'Feb', 'Mar']"
      [series]="channels"
    />
    <star-chart
      id="signed"
      type="stacked-bar"
      title="Balance"
      [labels]="['A', 'B']"
      [series]="signed"
    />
    <star-chart
      id="percent"
      type="stacked-bar"
      title="Shares"
      percent
      [labels]="['Jan', 'Feb']"
      [series]="channels"
    />
    <star-chart
      id="radar"
      type="radar"
      title="Ratings"
      [labels]="['Battery life under heavy load', 'Display', 'Sound']"
      [series]="ratings"
    />
    <star-chart
      id="polar"
      type="polar-area"
      title="Visits by weekday"
      categoryLabel="Weekday"
      [labels]="['Mon', 'Tue', 'Wed', 'Thu']"
      [series]="visits"
    />
    <star-chart
      id="scatter"
      type="scatter"
      title="Price against weight"
      categoryLabel="Weight"
      valueLabel="Price"
      [series]="points"
    />
  `,
})
class NewTypesHost {
  readonly channels: StarChartSeries[] = [
    { label: 'Web', data: [10, 20, 0] },
    { label: 'Phone', data: [5, 0, 0] },
    { label: 'Partner', data: [5, 20, 0] },
  ];
  readonly signed: StarChartSeries[] = [
    { label: 'Income', data: [30, 10] },
    { label: 'Costs', data: [-20, -5] },
  ];
  readonly ratings: StarChartSeries[] = [
    { label: 'Model A', data: [8, 6, 7] },
    { label: 'Model B', data: [6, 9, 8] },
  ];
  readonly visits: StarChartSeries[] = [{ label: 'Visits', data: [820, 0, 910, -5] }];
  readonly points: StarChartPointSeries[] = [
    {
      label: 'Backpacks',
      data: [
        { x: 0.6, y: 35 },
        { x: NaN, y: 40 },
        { x: 1.4, y: 79 },
      ],
    },
    { label: 'Suitcases', data: [{ x: 3.1, y: 135 }] },
  ];
}

describe('StarChart new types', () => {
  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(NewTypesHost);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }
  const rows = (chart: Element) =>
    [...chart.querySelectorAll('tbody tr')].map((r) =>
      [...r.children].map((c) => c.textContent?.trim()).join(' '),
    );
  const headers = (chart: Element) =>
    [...chart.querySelectorAll('thead th')].map((th) => th.textContent?.trim());

  it('stacked bar draws one segment per value that is not 0 and adds a total column', async () => {
    const chart = (await render()).querySelector('#stacked')!;
    // Jan 10, 5, 5; Feb 20, 0, 20; Mar all 0.
    expect(chart.querySelectorAll('.star-chart__segment').length).toBe(5);
    expect(headers(chart)).toEqual(['Month', 'Web', 'Phone', 'Partner', 'Total']);
    expect(rows(chart)).toEqual(['Jan 10 5 5 20', 'Feb 20 0 20 40', 'Mar 0 0 0 0']);
  });

  it('stacked bar puts negative values below the baseline and draws the zero line', async () => {
    const chart = (await render()).querySelector('#signed')!;
    const segments = [...chart.querySelectorAll('.star-chart__segment')].map((s) => ({
      y: Number(s.getAttribute('y')),
      height: Number(s.getAttribute('height')),
    }));
    expect(segments).toHaveLength(4);
    const baseline = Number(chart.querySelector('.star-chart__baseline')!.getAttribute('y1'));
    // Income segments end at the baseline, cost segments start at it.
    expect(segments[0].y + segments[0].height).toBeCloseTo(baseline, 3);
    expect(segments[1].y).toBeCloseTo(baseline, 3);
    expect(rows(chart)).toEqual(['A 30 -20 10', 'B 10 -5 5']);
  });

  it('stacked bar in percent mode labels the axis in percent and keeps the real values', async () => {
    const chart = (await render()).querySelector('#percent')!;
    const ticks = [...chart.querySelectorAll('.star-chart__axis')]
      .map((t) => t.textContent?.trim())
      .filter((t) => t?.endsWith('%'));
    expect(ticks).toEqual(['0%', '25%', '50%', '75%', '100%']);
    expect(rows(chart)).toEqual(['Jan 10 5 5 20', 'Feb 20 0 20 40']);
  });

  it('radar draws a polygon and a marker per series and category, with ring values', async () => {
    const chart = (await render()).querySelector('#radar')!;
    expect(chart.querySelectorAll('.star-chart__polygon').length).toBe(2);
    expect(chart.querySelectorAll('.star-chart__vertex').length).toBe(6);
    expect(chart.querySelectorAll('line.star-chart__grid').length).toBe(3);
    expect(
      [...chart.querySelectorAll('.star-chart__ring-label')].map((t) => t.textContent?.trim()),
    ).toEqual(['2.5', '5', '7.5', '10']);
    // The two series use different marker shapes, in the plot and in the legend.
    const shapes = [...chart.querySelectorAll('.star-chart__vertex')].map((v) =>
      v.getAttribute('d')!.replace(/[\d.,-]+/g, ''),
    );
    expect(new Set(shapes).size).toBe(2);
    expect(chart.querySelectorAll('.star-chart__legend svg').length).toBe(2);
  });

  it('radar cuts a long category label and keeps the full text as a title', async () => {
    const chart = (await render()).querySelector('#radar')!;
    const label = [...chart.querySelectorAll('text.star-chart__axis')].find((t) =>
      t.textContent?.includes('Battery'),
    )!;
    expect(label.firstChild?.textContent?.trim().endsWith('…')).toBe(true);
    expect(label.querySelector('title')?.textContent).toBe('Battery life under heavy load');
    expect(rows(chart)[0]).toBe('Battery life under heavy load 8 6');
  });

  it('polar area draws a sector for each positive value and reads negative values as 0', async () => {
    const chart = (await render()).querySelector('#polar')!;
    // Values 820, 0, 910, -5: two sectors have an area. The table keeps the real values.
    expect(chart.querySelectorAll('.star-chart__sector').length).toBe(2);
    expect(chart.querySelectorAll('.star-chart__hit').length).toBe(4);
    expect(chart.querySelector('.star-chart__legend')).toBeNull();
    expect(headers(chart)).toEqual(['Weekday', 'Visits']);
    expect(rows(chart)).toEqual(['Mon 820', 'Tue 0', 'Wed 910', 'Thu -5']);
  });

  it('scatter leaves out points with a missing coordinate and lists x and y in the table', async () => {
    const chart = (await render()).querySelector('#scatter')!;
    expect(chart.querySelectorAll('.star-chart__point').length).toBe(3);
    expect(chart.querySelectorAll('.star-chart__hit').length).toBe(3);
    expect(headers(chart)).toEqual(['Series', 'Weight', 'Price']);
    expect(rows(chart)).toEqual(['Backpacks 0.6 35', 'Backpacks 1.4 79', 'Suitcases 3.1 135']);
    const shapes = [...chart.querySelectorAll('.star-chart__point')].map((p) =>
      p.getAttribute('d')!.replace(/[\d.,-]+/g, ''),
    );
    expect(shapes[0]).toBe(shapes[1]);
    expect(shapes[0]).not.toBe(shapes[2]);
  });

  it('every new type names the chart and describes it for assistive technology', async () => {
    const host = await render();
    const expected: Record<string, string> = {
      stacked: 'Stacked bar chart with 3 series and 3 items, values from 0 to 20.',
      radar: 'Radar chart with 2 series and 3 items, values from 6 to 9.',
      polar: 'Polar area chart with 1 series and 4 items, values from -5 to 910.',
      scatter: 'Scatter chart with 2 series and 3 items, values from 35 to 135.',
    };
    for (const [id, start] of Object.entries(expected)) {
      const figure = host.querySelector(`#${id} figure`)!;
      const name = host.querySelector(`#${figure.getAttribute('aria-labelledby')}`)!;
      expect(name.textContent?.trim()).toBeTruthy();
      const description = host.querySelector(`#${figure.getAttribute('aria-describedby')}`)!;
      expect(description.textContent).toContain(start);
      expect(description.classList).toContain('star-sr-only');
      expect(host.querySelector(`#${id} .star-chart__plot`)!.getAttribute('aria-hidden')).toBe(
        'true',
      );
    }
  });
});

describe('StarChart new types, edge cases', () => {
  @Component({
    imports: [StarChart],
    template: `
      <star-chart type="stacked-bar" title="Empty" />
      <star-chart type="radar" title="One category" [labels]="['Only']" [series]="one" />
      <star-chart type="polar-area" title="One category" [labels]="['Only']" [series]="one" />
      <star-chart type="polar-area" title="Zeros" [labels]="['A', 'B']" [series]="zeros" />
      <star-chart type="scatter" title="One point" [series]="onePoint" />
      <star-chart type="scatter" title="Empty" />
      <star-chart type="scatter" title="Plain numbers" [series]="one" />
      <star-chart type="radar" title="Bad numbers" [labels]="['A', 'B', 'C']" [series]="bad" />
    `,
  })
  class EdgeHost {
    readonly one: StarChartSeries[] = [{ label: 'Value', data: [4] }];
    readonly zeros: StarChartSeries[] = [{ label: 'Value', data: [0, 0] }];
    readonly onePoint: StarChartPointSeries[] = [{ label: 'P', data: [{ x: 2, y: 3 }] }];
    readonly bad: StarChartSeries[] = [
      { label: 'S', data: [NaN, null as unknown as number, Infinity] },
    ];
  }

  it('renders without errors and without NaN in any path', async () => {
    const fixture = TestBed.createComponent(EdgeHost);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('star-chart').length).toBe(8);
    for (const element of host.querySelectorAll('svg *')) {
      for (const name of ['d', 'x', 'y', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2', 'width', 'height']) {
        expect(element.getAttribute(name) ?? '').not.toContain('NaN');
      }
    }
    // One category gives one full sector, and all zeros give none.
    expect(host.querySelectorAll('.star-chart__sector').length).toBe(1);
    // The scatter chart with plain numbers uses the position as x.
    const plain = host.querySelectorAll('star-chart')[6];
    expect(plain.querySelectorAll('.star-chart__point').length).toBe(1);
    expect(
      [...plain.querySelectorAll('tbody tr:first-child > *')].map((c) => c.textContent?.trim()),
    ).toEqual(['Value', '0', '4']);
  });
});
