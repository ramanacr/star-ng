import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarIconTemplate } from '@star-ng/ui/core';
import {
  StarSelectButton,
  StarToggleButton,
  StarToggleButtonContentTemplate,
} from '@star-ng/ui/select-button';
import { DOCS, DocsRow } from '../shared/docs';

interface View {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
}

@Component({
  selector: 'docs-select-button-page',
  imports: [
    DOCS,
    StarSelectButton,
    StarToggleButton,
    StarToggleButtonContentTemplate,
    StarIconTemplate,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Select button and toggle button"
      lead="star-select-button is a segmented choice: a radio group in single mode, a group of toggles in multiple mode. star-toggle-button is one pressed / not pressed button."
      importFrom="import { StarSelectButton, StarToggleButton } from '@star-ng/ui/select-button';"
    >
      <docs-example heading="Single choice" source="select-button/single">
        <star-select-button
          [options]="['Day', 'Week', 'Month']"
          [(value)]="period"
          ariaLabel="Period"
        />
        <p class="docs-output" role="status">Period: {{ period() }}</p>
      </docs-example>

      <docs-example
        heading="Objects with icons"
        source="select-button/objects"
        [script]="objectsScript"
        note="optionLabel, optionValue and optionIcon take a property name or a function."
      >
        <star-select-button
          [options]="views"
          optionLabel="label"
          optionValue="id"
          optionIcon="icon"
          [(value)]="view"
          [allowEmpty]="false"
          ariaLabel="View"
        />
      </docs-example>

      <docs-example heading="Multiple and small" source="select-button/multiple">
        <star-select-button
          [options]="['Bold', 'Italic', 'Underline']"
          [(value)]="styles"
          multiple
          size="sm"
          ariaLabel="Text style"
        />
        <p class="docs-output" role="status">{{ stylesText() }}</p>
      </docs-example>

      <docs-example heading="Toggle button" source="select-button/toggle">
        <star-toggle-button
          [(checked)]="pinned"
          onLabel="Pinned"
          offLabel="Pin"
          onIcon="ph-fill ph-push-pin"
          offIcon="ph-bold ph-push-pin"
        />
        <star-toggle-button [checked]="true" disabled onLabel="Locked" offLabel="Lock" />
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        With <code>dir="rtl"</code> the first option is on the right. Arrow left selects the next
        option and Arrow right the previous one. See the Right-to-left guide.
      </p>

      <docs-example
        heading="Toggle button icons and content"
        source="select-button/toggle-icons"
        note="starIcon on and off replace the icons of the toggle button, and iconPos end puts them after the label. starToggleButtonContent replaces the whole content; its context is the pressed state."
      >
        <div class="docs-row">
          <star-toggle-button [(checked)]="pinToggle" onLabel="Pinned" offLabel="Pin" iconPos="end">
            <ng-template starIcon="on"><i class="ph-fill ph-push-pin"></i></ng-template>
            <ng-template starIcon="off"><i class="ph-bold ph-push-pin"></i></ng-template>
          </star-toggle-button>
          <star-toggle-button [(checked)]="muted" ariaLabel="Sound">
            <ng-template starToggleButtonContent let-checked>
              <i [class]="checked ? 'ph-bold ph-speaker-x' : 'ph-bold ph-speaker-high'"></i>
              {{ checked ? 'Muted' : 'Sound on' }}
            </ng-template>
          </star-toggle-button>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarSelectButton', 'StarToggleButton']"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class SelectButtonPage {
  protected readonly pinToggle = signal(false);
  protected readonly muted = signal(false);
  protected readonly period = signal<string | readonly string[] | null>('Week');
  protected readonly views: readonly View[] = [
    { id: 'list', label: 'List', icon: 'ph-bold ph-list' },
    { id: 'grid', label: 'Grid', icon: 'ph-bold ph-squares-four' },
    { id: 'map', label: 'Map', icon: 'ph-bold ph-map-trifold' },
  ];
  protected readonly view = signal<string | readonly string[] | null>('grid');
  protected readonly styles = signal<string | readonly string[] | null>(['Bold']);
  protected readonly pinned = signal(false);

  protected stylesText(): string {
    const value = this.styles();
    return Array.isArray(value) && value.length ? value.join(', ') : '(none)';
  }

  protected readonly objectsScript = `readonly views = [
  { id: 'list', label: 'List', icon: 'ph-bold ph-list' },
  { id: 'grid', label: 'Grid', icon: 'ph-bold ph-squares-four' },
  { id: 'map', label: 'Map', icon: 'ph-bold ph-map-trifold' },
];
readonly view = signal<string | readonly string[] | null>('grid');`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface-muted', description: 'Ground of the segmented control.' },
    { name: '--star-surface', description: 'Fill of a selected segment.' },
    { name: '--star-primary', description: 'Text color of a selected segment.' },
    { name: '--star-primary-soft', description: 'Fill of a pressed toggle button.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow keys',
      description:
        'Single mode: move to and select the next or previous option. Disabled options are skipped.',
    },
    { name: 'Tab', description: 'Multiple mode: moves between the options.' },
    { name: 'Enter / Space', description: 'Toggles the focused option or toggle button.' },
  ];
}
