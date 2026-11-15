import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarTimeline, StarTimelineContent, StarTimelineEvent } from '@star-ng/ui/layout';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-timeline-page',
  imports: [DOCS, StarTimeline, StarTimelineContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Timeline"
      lead="An ordered list of events with a marker, a date and a text. It can run down the page, alternate left and right, or run across. The PrimeNG equivalent is p-timeline."
      importFrom="import { StarTimeline } from '@star-ng/ui/layout';"
    >
      <docs-example
        heading="Vertical"
        source="timeline/basic"
        [script]="eventsScript"
        note="Each event has a title and can have a date, a description, an icon and a severity. A string date shows as written. A Date object shows in the locale of the page and sets the datetime attribute."
      >
        <star-timeline [events]="events" ariaLabel="Order history" />
      </docs-example>

      <docs-example heading="Alternating" source="timeline/alternate">
        <star-timeline [events]="events" align="alternate" ariaLabel="Order history, alternating" />
      </docs-example>

      <docs-example heading="Horizontal" source="timeline/horizontal">
        <star-timeline
          [events]="events"
          layout="horizontal"
          ariaLabel="Order history, horizontal"
        />
      </docs-example>

      <docs-example
        heading="Custom content"
        source="timeline/content"
        note="A template with starTimelineContent replaces the body of each event. The event is the implicit context value."
      >
        <star-timeline [events]="events" ariaLabel="Order history, custom">
          <ng-template starTimelineContent let-event let-i="index">
            <strong>{{ i + 1 }}. {{ event.title }}</strong>
          </ng-template>
        </star-timeline>
      </docs-example>

      <docs-api
        [of]="['StarTimeline', 'StarTimelineContent']"
        [slots]="slots"
        [cssVars]="cssVars"
      />
    </docs-page>
  `,
})
export class TimelinePage {
  protected readonly events: readonly StarTimelineEvent[] = [
    {
      title: 'Ordered',
      date: '12 Mar',
      description: 'Order ORD-1042 was placed.',
      icon: 'ph-bold ph-shopping-cart',
    },
    { title: 'Packed', date: '13 Mar', severity: 'info', icon: 'ph-bold ph-package' },
    {
      title: 'Delayed',
      date: '14 Mar',
      description: 'The carrier is late.',
      severity: 'warn',
      icon: 'ph-bold ph-clock',
    },
    { title: 'Delivered', date: '16 Mar', severity: 'success', icon: 'ph-bold ph-check' },
  ];

  protected readonly eventsScript = `readonly events: readonly StarTimelineEvent[] = [
  { title: 'Ordered', date: '12 Mar', description: 'Order ORD-1042 was placed.', icon: 'ph-bold ph-shopping-cart' },
  { title: 'Packed', date: '13 Mar', severity: 'info', icon: 'ph-bold ph-package' },
  { title: 'Delayed', date: '14 Mar', description: 'The carrier is late.', severity: 'warn', icon: 'ph-bold ph-clock' },
  { title: 'Delivered', date: '16 Mar', severity: 'success', icon: 'ph-bold ph-check' },
];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template starTimelineContent',
      description: 'Body of each event. The context has the event ($implicit) and its index.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-tone', description: 'Color of the marker. Set by the severity of the event.' },
    { name: '--star-border', description: 'Color of the line between the events.' },
    { name: '--star-surface', description: 'Fill of the marker.' },
  ];
}
