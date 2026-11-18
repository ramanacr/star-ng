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
