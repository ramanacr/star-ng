import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { STAR_UI_TEXT, starInlineKey, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarMenu, StarMenuItem, StarMenuTrigger } from '@star-ng/ui/menu';

/**
 * Action strip (Ignite UI `igx-action-strip`): a small toolbar of icon actions on top of its
 * container, for example a list row or a card. It shows while the pointer is over the container
 * (or over its table row, `tr` / `role="row"`, or an ancestor with the class
 * `star-action-strip-host`) or the focus is in it, so keyboard users reach it with Tab. On a device without hover it always
 * shows.
 *
 * WAI-ARIA toolbar: one tab stop; the arrow keys, Home and End move the focus between the
 * actions (roving tabindex). With `max`, the actions over the limit go into a "More actions"
 * menu (`star-menu`).
 *
 * ```html
 * <div class="order-row">
 *   Order 1001
 *   <star-action-strip [actions]="rowActions" [max]="2" ariaLabel="Order 1001 actions" />
 * </div>
 * ```
 *
 * The container gets `position: relative` from the StarNG styles when it has no position of its
 * own; the strip sits at its inline end, centered on the block axis.
 */
@Component({
  selector: 'star-action-strip',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarMenu, StarMenuTrigger],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-action-strip',
    role: 'toolbar',
    '[attr.aria-label]': 'ariaLabel() ?? text.actions',
    '[class.star-action-strip--open]': 'menuOpen()',
    '[class.star-action-strip--persistent]': 'persistent()',
    '(keydown)': 'onKeydown($event)',
    '(focusin)': 'onFocusin($event)',
  },
  template: `
    @for (action of inlineActions(); track $index) {
      <button
        data-star-part="button"
        type="button"
        class="star-btn star-btn--ghost star-btn--sm star-btn--icon star-action-strip__button"
        [class.star-action-strip__button--danger]="action.danger"
        [attr.aria-label]="action.label"
        [attr.title]="action.label"
        [disabled]="!!action.disabled"
        [tabIndex]="tabStop() === $index ? 0 : -1"
        (click)="run(action)"
      >
        <i
          data-star-part="buttonIcon"
          [class]="action.icon || 'ph-bold ph-circle'"
          aria-hidden="true"
        ></i>
      </button>
    }
    @if (overflowActions().length) {
      <button
        data-star-part="button"
        type="button"
        class="star-btn star-btn--ghost star-btn--sm star-btn--icon star-action-strip__button"
        [attr.aria-label]="text.moreActions"
        [attr.title]="text.moreActions"
        [tabIndex]="tabStop() === inlineActions().length ? 0 : -1"
        [starMenuTrigger]="menu"
        (menuOpened)="menuOpen.set(true)"
        (menuClosed)="menuOpen.set(false)"
      >
        <i data-star-part="moreIcon" class="ph-bold ph-dots-three-vertical" aria-hidden="true"></i>
      </button>
      <star-menu #menu [items]="overflowActions()" (itemClick)="actionClick.emit($event)" />
    }
  `,
})
export class StarActionStrip {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /**
   * The actions. Each one needs a `label` (the name of the icon button) and an `icon`. `command`,
   * `disabled` and `danger` work as in `star-menu`. On an inline button, `items` (submenus),
   * `separator`, `routerLink`, `url` and `shortcut` are ignored; they work for the actions in the
   * "More actions" menu.
   */
  readonly actions = input<readonly StarMenuItem[]>([]);
  /** Number of actions shown as buttons. The rest go into the "More actions" menu. `null` shows all. */
  readonly max = input<number | null>(null);
  /** Name of the toolbar. Defaults to the "Actions" text of `STAR_UI_TEXT`. */
  readonly ariaLabel = input<string | null>(null);
  /** Shows the strip at all times, not only on hover and focus. */
  readonly persistent = input(false, { transform: booleanAttribute });

  /** Emits the action that the user ran, from a button or from the menu. */
  readonly actionClick = output<StarMenuItem>();

  protected readonly menuOpen = signal(false);
  protected readonly inlineActions = computed(() => {
    const max = this.max();
    const shown = max === null ? this.actions() : this.actions().slice(0, Math.max(0, max));
    // A separator has no button.
    return shown.filter((action) => !action.separator);
  });
  protected readonly overflowActions = computed(() => {
    const max = this.max();
    return max === null ? [] : this.actions().slice(Math.max(0, max));
  });
  /** Index of the last button that had the focus. */
  private readonly activeIndex = signal(0);
  /** Index of the button in the tab order: the active one, or the first enabled one. */
  protected readonly tabStop = computed(() => {
    const enabled = [
      ...this.inlineActions().map((action) => !action.disabled),
      ...(this.overflowActions().length ? [true] : []),
    ];
    const index = this.activeIndex();
    return enabled[index] ? index : enabled.indexOf(true);
  });

  protected run(action: StarMenuItem): void {
    if (action.disabled) return;
    action.command?.(action);
    this.actionClick.emit(action);
  }

  protected onFocusin(event: FocusEvent): void {
    const index = this.buttons().indexOf(event.target as HTMLButtonElement);
    if (index >= 0) this.activeIndex.set(index);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const buttons = this.buttons();
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    // Keys from the menu or from other content of the strip are not toolbar moves.
    if (current < 0) return;
    const enabled = buttons.filter((button) => !button.disabled);
    const position = enabled.indexOf(buttons[current]);
    let next: HTMLButtonElement | undefined;
    switch (starInlineKey(event, this.host)) {
      case 'ArrowRight':
        next = enabled[(position + 1) % enabled.length];
        break;
      case 'ArrowLeft':
        next = enabled[(position - 1 + enabled.length) % enabled.length];
        break;
      case 'Home':
        next = enabled[0];
        break;
      case 'End':
        next = enabled[enabled.length - 1];
        break;
      default:
        return;
    }
    if (!next) return;
    event.preventDefault();
    this.activeIndex.set(buttons.indexOf(next));
    next.focus();
  }

  private buttons(): HTMLButtonElement[] {
    return [...this.host.querySelectorAll<HTMLButtonElement>('.star-action-strip__button')];
  }
}
