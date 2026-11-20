import { _IdGenerator } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
} from '@angular/core';
import { STAR_UI_TEXT, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/**
 * Panel (PrimeNG `p-panel`): titled box with header actions and an optional collapse toggle.
 * `<star-panel header="Order notes" toggleable [(collapsed)]="notesHidden">…</star-panel>`
 */
@Component({
  selector: 'star-panel',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-panel-box',
    '[class.star-panel-box--collapsed]': 'collapsed()',
  },
  template: `
    <header data-star-part="header" class="star-panel-box__header">
      <h3 data-star-part="titleText" class="star-panel-box__title" [id]="titleId">
        {{ header() }}
      </h3>
      <div data-star-part="actionList" class="star-panel-box__actions">
        <ng-content select="[starPanelActions]" />
        @if (toggleable()) {
          <button
            data-star-part="toggle"
            type="button"
            class="star-btn star-btn--ghost star-btn--icon star-panel-box__toggle"
            [attr.aria-expanded]="!collapsed()"
            [attr.aria-controls]="contentId"
            [attr.aria-label]="
              collapsed() ? text.expandItem(header()) : text.collapseItem(header())
            "
            (click)="collapsed.set(!collapsed())"
          >
            <i data-star-part="toggleIcon" class="ph-bold ph-caret-down" aria-hidden="true"></i>
          </button>
        }
      </div>
    </header>
    <div
      data-star-part="region"
      class="star-accordion__region"
      role="region"
      [id]="contentId"
      [attr.aria-labelledby]="titleId"
      [attr.inert]="collapsed() ? '' : null"
    >
      <div data-star-part="inner" class="star-accordion__inner">
        <div data-star-part="body" class="star-panel-box__body"><ng-content /></div>
      </div>
    </div>
    <ng-content select="[starPanelFooter]" />
  `,
})
export class StarPanel {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  readonly header = input('');
  readonly toggleable = input(false, { transform: booleanAttribute });
  readonly collapsed = model(false);

  protected readonly titleId = this.ids.getId('star-panel-title-');
  protected readonly contentId = this.ids.getId('star-panel-content-');
}

/**
 * Fieldset (PrimeNG `p-fieldset`) on the native `<fieldset>` / `<legend>`, so groups of form
 * controls keep their accessible name. Optional collapse toggle in the legend.
 * `<star-fieldset legend="Requester" toggleable>…controls…</star-fieldset>`
 */
@Component({
  selector: 'star-fieldset',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],

  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-fieldset-host' },
  template: `
    <fieldset
      data-star-part="frame"
      class="star-fieldset"
      [class.star-fieldset--collapsed]="collapsed()"
    >
      <legend data-star-part="legend" class="star-fieldset__legend">
        @if (toggleable()) {
          <button
            data-star-part="toggle"
            type="button"
            class="star-fieldset__toggle"
            [attr.aria-expanded]="!collapsed()"
            [attr.aria-controls]="contentId"
            (click)="collapsed.set(!collapsed())"
          >
            <i
              data-star-part="expandIcon"
              class="ph-bold ph-caret-down star-accordion__caret"
              aria-hidden="true"
            ></i>
            {{ legend() }}
          </button>
        } @else {
          {{ legend() }}
        }
      </legend>
      <div
        data-star-part="region"
        class="star-accordion__region"
        [id]="contentId"
        [attr.inert]="collapsed() ? '' : null"
      >
        <div data-star-part="inner" class="star-accordion__inner">
          <div data-star-part="body" class="star-fieldset__body"><ng-content /></div>
        </div>
      </div>
    </fieldset>
  `,
})
export class StarFieldset {
  readonly legend = input('');
  readonly toggleable = input(false, { transform: booleanAttribute });
  readonly collapsed = model(false);
  protected readonly contentId = inject(_IdGenerator).getId('star-fieldset-');
}
