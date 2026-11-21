import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  forwardRef,
  inject,
  Injector,
  input,
  model,
  output,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarIconContext,
  starSlot,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

/** Payload of the toggle outputs of `star-panel`. */
export interface StarPanelToggleEvent {
  /** `beforeToggle`: the state before the toggle. `afterToggle`: the new state. */
  readonly collapsed: boolean;
}

/**
 * Panel (PrimeNG `p-panel`): titled box with header actions and an optional collapse toggle.
 * `<star-panel header="Order notes" toggleable [(collapsed)]="notesHidden">…</star-panel>`
 *
 * Content: the default content is the body, `[starPanelActions]` goes into the header next to the
 * toggle (PrimeNG `#headericons`), `[starPanelFooter]` under the body (PrimeNG `#footer`).
 * Slots (content children): `starHeader` replaces the title content (PrimeNG `#header`);
 * `starIcon="toggle"` replaces the toggle icon (`let-expanded`, PrimeNG `#icon`).
 *
 * PrimeNG names that star-ng covers in another way: the `content` template = the default content;
 * `toggleButtonProps` = `pt` (part `toggleButton`). Not applicable: `motionOptions` (the motion
 * comes from the theme tokens and stops with reduced motion).
 */
@Component({
  selector: 'star-panel',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarPanel) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-panel-box',
    '[class.star-panel-box--collapsed]': 'collapsed()',
    '[class.star-panel-box--toggle-start]': "iconPos() === 'start'",
  },
  template: `
    <ng-template #toggleIcon>
      @if (icons().get('toggle'); as custom) {
        <span data-star-part="toggleIcon" class="star-panel-box__icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: { $implicit: !collapsed() }" />
        </span>
      } @else {
        <i data-star-part="toggleIcon" class="ph-bold ph-caret-down" aria-hidden="true"></i>
      }
    </ng-template>
    <ng-template #title>
      @if (headerSlot(); as custom) {
        <ng-container *ngTemplateOutlet="custom" />
      } @else {
        {{ header() }}
      }
    </ng-template>
    @if (showHeader()) {
      <header data-star-part="header" class="star-panel-box__header">
        <h3 data-star-part="titleText" class="star-panel-box__title" [id]="titleId">
          @if (toggleable() && toggler() === 'header') {
            <button
              data-star-part="headerButton"
              type="button"
              class="star-panel-box__header-toggle"
              [attr.aria-expanded]="!collapsed()"
              [attr.aria-controls]="contentId"
              (click)="toggle()"
            >
              <ng-container *ngTemplateOutlet="toggleIcon" />
              <ng-container *ngTemplateOutlet="title" />
            </button>
          } @else {
            <ng-container *ngTemplateOutlet="title" />
          }
        </h3>
        <div data-star-part="actionList" class="star-panel-box__actions">
          <ng-content select="[starPanelActions]" />
          @if (toggleable() && toggler() === 'icon') {
            <button
              data-star-part="toggleButton"
              type="button"
              class="star-btn star-btn--ghost star-btn--icon star-panel-box__toggle"
              [attr.aria-expanded]="!collapsed()"
              [attr.aria-controls]="contentId"
              [attr.aria-label]="
                collapsed() ? text.expandItem(header()) : text.collapseItem(header())
              "
              (click)="toggle()"
            >
              <ng-container *ngTemplateOutlet="toggleIcon" />
            </button>
          }
        </div>
      </header>
    }
    <div
      data-star-part="regionPanel"
      class="star-accordion__region"
      role="region"
      [id]="contentId"
      [attr.aria-labelledby]="showHeader() ? titleId : null"
      [attr.aria-label]="showHeader() ? null : header() || null"
      [attr.inert]="collapsed() ? '' : null"
    >
      <div data-star-part="innerPanel" class="star-accordion__inner">
        <div data-star-part="body" class="star-panel-box__body"><ng-content /></div>
      </div>
    </div>
    <ng-content select="[starPanelFooter]" />
  `,
})
export class StarPanel {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  private readonly injector = inject(Injector);
  readonly header = input('');
  readonly toggleable = input(false, { transform: booleanAttribute });
  readonly collapsed = model(false);
  /** Shows the header (default `true`). Without it the region is named by `header`. */
  readonly showHeader = input(true, { transform: booleanAttribute });
  /**
   * What toggles: `'icon'` (default, a button next to the actions) or `'header'` (the title is the
   * button, with the icon before the text). PrimeNG `toggler`.
   */
  readonly toggler = input<'icon' | 'header'>('icon');
  /** Side of the toggle button in the header: `'end'` (default) or `'start'`. PrimeNG `iconPos`. */
  readonly iconPos = input<'start' | 'end'>('end');
  /** Emits before the panel opens or closes, with the state before the toggle. PrimeNG `onBeforeToggle`. */
  readonly beforeToggle = output<StarPanelToggleEvent>();
  /** Emits after the panel opened or closed (after the render), with the new state. PrimeNG `onAfterToggle`. */
  readonly afterToggle = output<StarPanelToggleEvent>();

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');

  protected readonly titleId = this.ids.getId('star-panel-title-');
  protected readonly contentId = this.ids.getId('star-panel-content-');

  /** Opens a collapsed panel or collapses an open one, with the toggle outputs. */
  toggle(): void {
    const before = this.collapsed();
    this.beforeToggle.emit({ collapsed: before });
    this.collapsed.set(!before);
    afterNextRender(() => this.afterToggle.emit({ collapsed: !before }), {
      injector: this.injector,
    });
  }
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
            data-star-part="toggleButton"
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
        data-star-part="regionPanel"
        class="star-accordion__region"
        [id]="contentId"
        [attr.inert]="collapsed() ? '' : null"
      >
        <div data-star-part="innerPanel" class="star-accordion__inner">
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
