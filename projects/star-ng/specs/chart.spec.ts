import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarChart, StarChartSeries } from 'star-ng/chart';

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
