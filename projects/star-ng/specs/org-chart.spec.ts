import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarOrgChart, StarOrgNode } from '@star-ng/ui/data-display';

@Component({
  imports: [StarOrgChart],
  template: `
    <star-org-chart
      ariaLabel="Team"
      selectable
      [value]="team"
      [(collapsedKeys)]="closed"
      [(selectedKey)]="selected"
    />
  `,
})
class Host {
  readonly closed = signal<readonly string[]>([]);
  readonly selected = signal<string | null>(null);
  readonly team: StarOrgNode = {
    key: 'lead',
    label: 'A. Rao',
    subtitle: 'Operations lead',
    children: [
      { key: 'eu', label: 'L. Chen', children: [{ key: 'eu-1', label: 'S. Martin' }] },
      { key: 'us', label: 'J. Owens' },
    ],
  };
}

describe('StarOrgChart', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  }

  it('draws the hierarchy as nested lists and hides a branch', async () => {
    const { fixture, el, host } = await setup();
    const chart = el.querySelector('star-org-chart')!;
    const labels = () =>
      [...chart.querySelectorAll('.star-org__label')].map((label) => label.textContent?.trim());
    expect(labels()).toEqual(['A. Rao', 'L. Chen', 'S. Martin', 'J. Owens']);
    expect(chart.querySelector('ul')?.getAttribute('aria-label')).toBe('Team');
    expect(chart.querySelectorAll('ul ul ul li').length).toBe(1);

    const toggle = chart.querySelector<HTMLButtonElement>('[aria-label="Collapse row: L. Chen"]')!;
    toggle.click();
    await fixture.whenStable();
    expect(host.closed()).toEqual(['eu']);
    expect(labels()).toEqual(['A. Rao', 'L. Chen', 'J. Owens']);
    expect(chart.querySelector('[aria-label="Expand row: L. Chen"]')).not.toBeNull();
  });

  it('selects one node', async () => {
    const { fixture, el, host } = await setup();
    const cards = [...el.querySelectorAll<HTMLButtonElement>('.star-org__card--button')];
    cards[3].click();
    await fixture.whenStable();
    expect(host.selected()).toBe('us');
    expect(cards[3].getAttribute('aria-pressed')).toBe('true');
    expect(cards[0].getAttribute('aria-pressed')).toBe('false');
  });
});
