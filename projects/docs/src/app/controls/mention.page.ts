import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarMention, StarMentionItemTemplate, StarMentionSearchEvent } from '@star-ng/ui/mention';
import { DOCS, DocsRow } from '../shared/docs';

interface Person {
  readonly handle: string;
  readonly name: string;
  readonly team: string;
}

interface Topic {
  readonly tag: string;
}

const PEOPLE: readonly Person[] = [
  { handle: 'ana.silva', name: 'Ana Silva', team: 'Sales' },
  { handle: 'andres.ruiz', name: 'Andrés Ruiz', team: 'Support' },
  { handle: 'jonas.berg', name: 'Jonas Berg', team: 'Finance' },
  { handle: 'lucia.ortega', name: 'Lucía Ortega', team: 'Design' },
  { handle: 'marco.bianchi', name: 'Marco Bianchi', team: 'Sales' },
];

const TOPICS: readonly Topic[] = [
  { tag: 'release' },
  { tag: 'review' },
  { tag: 'roadmap' },
  { tag: 'billing' },
  { tag: 'onboarding' },
];

@Component({
  selector: 'docs-mention-page-content',
  imports: [DOCS, FormField, StarField, StarInput, StarMention, StarMentionItemTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    textarea {
      min-block-size: 6rem;
      resize: vertical;
    }
    .person {
      display: grid;
    }
    .person small {
      color: var(--star-text-muted);
    }
  `,
  template: `
    <docs-page
      heading="Mention"
      lead="Type @ at the start of a word in a text field, and a list of people opens at the caret. Enter, Tab or a click inserts the name. The Syncfusion equivalent is Mention."
      importFrom="import { StarMention } from '@star-ng/ui/mention';"
    >
      <docs-example
        heading="Mention people"
        source="mention/basic"
        note="The list filters as you type, without case or accents. The field keeps its value as plain text; mentions lists the mentions in it."
      >
        <div class="docs-stack">
          <textarea
            class="star-input"
            aria-label="Comment"
            placeholder="Write a comment, type @ to mention someone"
            starMention
            #comment="starMention"
            [suggestions]="people"
            optionLabel="name"
            (mentionSelect)="last.set($any($event.item).name)"
          ></textarea>
          <p class="docs-output" role="status">
            Last mention: {{ last() }}. In the text: {{ names(comment.mentions()) }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Two triggers, async search and an item template"
        source="mention/triggers"
        [script]="triggersScript"
        note="@ mentions people and # mentions topics. The suggestions are a function (query, trigger) that returns a promise, as a server search would; mentionSearch reports each query. ng-template [starMentionItem] (bound to the field by its template reference) shows each suggestion."
      >
        <div class="docs-stack">
          <textarea
            class="star-input"
            aria-label="Message"
            placeholder="Type @ for people or # for topics"
            starMention
            #message="starMention"
            [triggers]="['@', '#']"
            [suggestions]="search"
            [optionLabel]="label"
            (mentionSearch)="query.set($event)"
          ></textarea>
          <ng-template [starMentionItem]="message" let-item>
            @if ($any(item).tag) {
              <span>#{{ $any(item).tag }}</span>
            } @else {
              <span class="person">
                <span>{{ $any(item).name }}</span>
                <small>{{ $any(item).team }}</small>
              </span>
            }
          </ng-template>
          <p class="docs-output" role="status">
            Search: {{ query() ? query()!.trigger + query()!.query : 'none' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="On an input, in a form"
        source="mention/form"
        note="An insertion fires an input event, so Signal Forms, ngModel and reactive forms see it."
      >
        <div class="docs-stack">
          <star-field label="Assign to" hint="Type @ and a name">
            <input
              starInput
              [formField]="f.assignee"
              starMention
              [suggestions]="people"
              optionLabel="name"
            />
          </star-field>
          <p class="docs-output" role="status">Model: {{ model().assignee || '(empty)' }}</p>
        </div>
      </docs-example>

      <h2>Limits</h2>
      <p>
        The directive works on <code>textarea</code> and <code>input</code> elements. It does not
        support <code>contenteditable</code> content such as <code>star-editor</code>. The caret
        position comes from a hidden mirror element with the same text styles; it is measured in the
        browser only.
      </p>

      <docs-api [of]="['StarMention']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class MentionPageContent {
  protected readonly people = PEOPLE;
  protected readonly last = signal('none');
  protected readonly query = signal<StarMentionSearchEvent | null>(null);

  protected readonly model = signal({ assignee: '' });
  protected readonly f = form(this.model);

  protected readonly label = (item: Person | Topic) => ('tag' in item ? item.tag : item.name);

  /** A fake server search: answers after a short delay. */
  protected readonly search = (query: string, trigger: string): Promise<(Person | Topic)[]> => {
    const q = query.toLowerCase();
    const items =
      trigger === '#'
        ? TOPICS.filter((topic) => topic.tag.startsWith(q))
        : PEOPLE.filter((person) => person.name.toLowerCase().includes(q));
    return new Promise((resolve) => setTimeout(() => resolve(items), 150));
  };

  protected names(mentions: readonly { label: string }[]): string {
    return mentions.length ? mentions.map((m) => m.label).join(', ') : 'none';
  }

  protected readonly triggersScript = `readonly query = signal<StarMentionSearchEvent | null>(null);
readonly label = (item: Person | Topic) => ('tag' in item ? item.tag : item.name);
// A fake server search: answers after a short delay.
readonly search = (query: string, trigger: string): Promise<(Person | Topic)[]> => {
  const q = query.toLowerCase();
  const items = trigger === '#'
    ? TOPICS.filter((topic) => topic.tag.startsWith(q))
    : PEOPLE.filter((person) => person.name.toLowerCase().includes(q));
  return new Promise((resolve) => setTimeout(() => resolve(items), 150));
};`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starMentionItem]',
      description:
        'Content of each suggestion. Bind it to the field: [starMentionItem]="ref". Context: the item ($implicit), active and query.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the suggestion panel.' },
    { name: '--star-surface-muted', description: 'Background of the active suggestion.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: '@ (or another trigger)', description: 'At the start of a word: opens the list.' },
    { name: 'Arrow down / Arrow up', description: 'Moves to the next or previous suggestion.' },
    { name: 'Enter / Tab', description: 'Inserts the trigger, the label and a space.' },
    { name: 'Escape', description: 'Closes the list. It stays closed for this mention.' },
  ];
}

/**
 * Route component of the page. It loads the route styles (`mention.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-mention-page',
  imports: [MentionPageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './mention.page.scss',
  template: '<docs-mention-page-content />',
})
export class MentionPage {}
