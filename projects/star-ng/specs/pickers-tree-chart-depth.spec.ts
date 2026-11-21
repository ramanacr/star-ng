import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarChart, StarChartPlugin } from '@star-ng/ui/chart';
import { StarFooterTemplate, StarHeaderTemplate } from '@star-ng/ui/core';
import {
  StarButtonBarTemplate,
  StarCalendar,
  StarDatePicker,
  StarDecadeTemplate,
  StarTimeCellTemplate,
  StarTimePicker,
} from '@star-ng/ui/date-picker';
import { StarNodeTemplate, StarTree, StarTreeNode } from '@star-ng/ui/tree';

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

@Component({
  imports: [StarCalendar, StarDecadeTemplate, StarDatePicker, StarButtonBarTemplate],
  template: `
    <star-calendar id="cal" granularity="year">
      <ng-template starDecade let-years let-first="first" let-last="last"
        ><b class="own-decade">{{ first }}..{{ last }} ({{ years.length }})</b></ng-template
      >
    </star-calendar>
    <star-date-picker ariaLabel="Due date" showButtonBar [(value)]="due">
      <ng-template starButtonBar let-today="today" let-clear="clear">
        <button type="button" class="own-today" (click)="today()">Now</button>
        <button type="button" class="own-clear" (click)="clear()">Empty</button>
      </ng-template>
    </star-date-picker>
  `,
})
class DateHost {
  readonly due = signal<Date | null>(new Date(2026, 0, 5));
}

describe('Date picker decade and button bar slots', () => {
  it('replaces the decade title and the button bar', async () => {
    const fixture = TestBed.createComponent(DateHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const decade = el.querySelector('#cal .own-decade')!;
    expect(text(decade)).toMatch(/^\d{4}\.\.\d{4} \(12\)$/);
    el.querySelector<HTMLButtonElement>('star-date-picker .star-date__toggle')!.click();
    await fixture.whenStable();
    expect(document.querySelector('[data-star-part=todayButton]')).toBeNull();
    document.querySelector<HTMLButtonElement>('.own-clear')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.due()).toBeNull();
  });
});

@Component({
  imports: [StarTimePicker, StarTimeCellTemplate, StarHeaderTemplate, StarFooterTemplate],
  template: `
    <star-time-picker ariaLabel="Call at" [(value)]="time" [stepMinute]="30">
      <ng-template starHeader><b class="own-header">Office hours</b></ng-template>
      <ng-template starFooter><b class="own-footer">Local time</b></ng-template>
      <ng-template starTimeCell let-label let-part="part" let-selected="selected"
        ><b class="own-cell">{{ part }}:{{ label }}{{ selected ? '*' : '' }}</b></ng-template
      >
    </star-time-picker>
  `,
})
class TimeHost {
  readonly time = signal<string | null>('09:30');
}

@Component({
  imports: [StarDatePicker, StarTimeCellTemplate],
  template: `
    <star-date-picker ariaLabel="Meeting" showTime [(value)]="when">
      <ng-template starTimeCell let-label let-part="part"
        ><b class="own-date-cell">{{ part }}:{{ label }}</b></ng-template
      >
    </star-date-picker>
  `,
})
class DateTimeHost {
  readonly when = signal<Date | null>(new Date(2026, 0, 5, 9, 30));
}

describe('Date picker with showTime and starTimeCell', () => {
  it('passes the time cell slot to the time columns', async () => {
    const fixture = TestBed.createComponent(DateTimeHost);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.star-date__toggle')!
      .click();
    await fixture.whenStable();
    const cells = [...document.querySelectorAll('.own-date-cell')].map((c) => c.textContent);
    expect(cells.some((c) => c!.startsWith('hour:'))).toBe(true);
    expect(cells).toContain('minute:30');
    expect(document.querySelector('.own-date-cell')!.closest('[role=option]')).not.toBeNull();
  });
});

describe('Time picker slots', () => {
  it('renders the header, footer and cell slots in the panel', async () => {
    const fixture = TestBed.createComponent(TimeHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.star-date__toggle')!.click();
    await fixture.whenStable();
    expect(text(document.querySelector('.own-header'))).toBe('Office hours');
    expect(text(document.querySelector('.own-footer'))).toBe('Local time');
    const cells = [...document.querySelectorAll('.own-cell')].map((c) => c.textContent);
    expect(cells).toContain('minute:30*');
    expect(cells).toContain('minute:00');
    // The cell keeps its option role.
    expect(document.querySelector('.own-cell')!.closest('[role=option]')).not.toBeNull();
  });
});

@Component({
  imports: [StarTree, StarNodeTemplate],
  template: `
    <star-tree ariaLabel="Files" [nodes]="nodes" [expanded]="['docs']">
      <ng-template starNode let-node
        ><b class="own-default">{{ node.label }}</b></ng-template
      >
      <ng-template starNode="folder" let-node
        ><b class="own-folder">[{{ node.label }}]</b></ng-template
      >
    </star-tree>
  `,
})
class TreeHost {
  readonly nodes: StarTreeNode[] = [
    { key: 'docs', label: 'Docs', type: 'folder', children: [{ key: 'a', label: 'a.txt' }] },
    { key: 'b', label: 'b.txt', type: 'unknown' },
  ];
}

describe('Tree node templates per type', () => {
  it('picks the template of the node type, else the default one', async () => {
    const fixture = TestBed.createComponent(TreeHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('.own-folder')].map((n) => n.textContent)).toEqual(['[Docs]']);
    expect([...el.querySelectorAll('.own-default')].map((n) => n.textContent)).toEqual([
      'a.txt',
      'b.txt',
    ]);
  });
});

@Component({
  imports: [StarChart],
  template: `
    <star-chart
      title="Orders"
      type="bar"
      [labels]="['Jan', 'Feb']"
      [series]="[{ label: 'Orders', data: [3, 5] }]"
      [plugins]="plugins()"
    />
  `,
})
class ChartHost {
  readonly chart = viewChild.required(StarChart);
  readonly calls: string[] = [];
  readonly plugins = signal<readonly StarChartPlugin[]>([
    {
      id: 'band',
      beforeDraw: ({ layer, type }) => {
        this.calls.push(`before:${type}`);
        const rect = layer.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'own-band');
        layer.appendChild(rect);
      },
      afterDraw: ({ layer }) => {
        this.calls.push('after');
        const line = layer.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'own-line');
        layer.appendChild(line);
      },
    },
  ]);
}

describe('Chart plugins and refresh', () => {
  it('runs beforeDraw under and afterDraw over the plot, again on refresh', async () => {
    const fixture = TestBed.createComponent(ChartHost);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const svg = (fixture.nativeElement as HTMLElement).querySelector('.star-chart__plot svg')!;
    expect(host.calls).toEqual(['before:bar', 'after']);
    const layers = [...svg.querySelectorAll(':scope > [data-star-plugin]')];
    expect(layers.map((l) => l.getAttribute('data-star-plugin'))).toEqual([
      'band:before',
      'band:after',
    ]);
    expect(svg.firstElementChild!.getAttribute('data-star-plugin')).toBe('band:before');
    expect(svg.lastElementChild!.getAttribute('data-star-plugin')).toBe('band:after');
    expect(layers[0].getAttribute('aria-hidden')).toBe('true');
    host.chart().refresh();
    await fixture.whenStable();
    expect(host.calls).toEqual(['before:bar', 'after', 'before:bar', 'after']);
    expect(svg.querySelectorAll('.own-band').length).toBe(1);
  });
});
