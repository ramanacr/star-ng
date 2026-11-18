import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
