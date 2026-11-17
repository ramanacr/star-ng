import { _IdGenerator, ActiveDescendantKeyManager, Highlightable } from '@angular/cdk/a11y';
import { Directionality } from '@angular/cdk/bidi';
import {
  ConnectedPosition,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
  OverlayRef,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  PLATFORM_ID,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { StarDirectionService } from '@star-ng/ui/core';
import { Subscription } from 'rxjs';

/** Payload of `selectionChange` of `star-dropdown`. */
export interface StarDropdownSelection {
  /** The `value` of the chosen item. */
  readonly value: unknown;
  /** The text of the chosen item. */
  readonly label: string;
}

// `start` and `end` are turned around by the CDK in right-to-left: the list aligns with the start
// edge of its trigger in both directions.
const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

/** The element of a trigger that takes the focus: the host, or the button inside a wrapper. */
function focusTarget(host: HTMLElement): HTMLElement {
  if (host.matches('button, a, input, [tabindex]')) return host;
  return host.querySelector<HTMLElement>('button, a, input') ?? host;
}

/** An option of the list, as the CDK key manager sees it. */
class DropdownOption implements Highlightable {
  constructor(readonly item: StarDropdownItem) {}
  get disabled(): boolean {
    return this.item.disabled();
  }
  getLabel(): string {
    return this.item.getLabel();
  }
  setActiveStyles(): void {
    this.item.setActive(true);
  }
  setInactiveStyles(): void {
    this.item.setActive(false);
  }
}

/**
 * One entry of `star-dropdown` (Ignite UI `igx-drop-down-item`). The content is the label.
 * `header` makes a group heading and `divider` a line; neither can be chosen.
 *
 * `<star-dropdown-item value="csv">CSV</star-dropdown-item>`
 */
@Component({
  selector: 'star-dropdown-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[id]': 'id',
    '[class]': 'classes()',
    '[attr.role]': "header() ? 'presentation' : divider() ? 'none' : 'option'",
    '[attr.aria-hidden]': "divider() ? 'true' : null",
    '[attr.aria-selected]': 'isOption() ? selected() : null',
    '[attr.aria-disabled]': 'isOption() && disabled() ? true : null',
    '[attr.aria-describedby]': 'isOption() ? dropdown.headerIdOf(this) : null',
    '(click)': 'dropdown.choose(this)',
    '(pointermove)': 'dropdown.activate(this)',
  },
  template: `
    @if (!divider()) {
      <span class="star-listbox__label"><ng-content /></span>
      @if (selected()) {
        <i class="ph-bold ph-check star-listbox__check" aria-hidden="true"></i>
      }
    }
  `,
})
export class StarDropdownItem {
  // The item is always inside a star-dropdown (declared below in this file).
  protected readonly dropdown = inject(StarDropdown);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly id = inject(_IdGenerator).getId('star-dropdown-item-');

  /** Value that `selectionChange` and `value` of the drop-down get for this item. */
  readonly value = input<unknown>(undefined);
  /** The item shows but cannot be chosen. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Renders a group heading. It is not an option. */
  readonly header = input(false, { transform: booleanAttribute });
  /** Renders a divider line. It is not an option. */
  readonly divider = input(false, { transform: booleanAttribute });

  /** Set by the key manager of the drop-down. */
  protected readonly active = signal(false);
  readonly isOption = computed(() => !this.header() && !this.divider());
  protected readonly selected = computed(() => {
    const value = this.dropdown.value();
    return this.isOption() && value !== undefined && Object.is(value, this.value());
  });
  protected readonly classes = computed(() => {
    if (this.divider()) return 'star-dropdown__divider';
    if (this.header()) return 'star-listbox__group star-dropdown__header';
    return [
      'star-listbox__option star-dropdown__item',
      this.active() ? 'star-listbox__option--active' : '',
      this.selected() ? 'star-listbox__option--selected' : '',
    ]
      .filter(Boolean)
      .join(' ');
  });

  /** Text of the item, for typeahead and for `selectionChange`. */
  getLabel(): string {
    return (this.host.textContent ?? '').trim();
  }

  /**
   * Shows the item as the active option (set by the drop-down).
   *
   * @internal
   */
  setActive(active: boolean): void {
    this.active.set(active);
    if (active) this.host.scrollIntoView?.({ block: 'nearest' });
  }
}

/**
 * Drop-down list (Ignite UI `igx-drop-down`): a list of items that opens from any trigger and
 * reports the chosen item. It is not bound to a form value; for a form field use `star-select`.
 * For a list of commands (menu semantics) use `star-menu`.
 *
 * WAI-ARIA listbox: the list takes the focus and shows the active option with
 * `aria-activedescendant`. Arrow keys, Home / End and typeahead move it; Enter or Space chooses;
 * Escape closes and returns the focus to the trigger. The list is a native popover placed by the
 * CDK, like the other StarNG panels.
 *
 * ```html
 * <star-button [starDropdownTrigger]="formats" trailingIcon="ph-bold ph-caret-down">Export</star-button>
 * <star-dropdown #formats ariaLabel="Export format" (selectionChange)="export($event.value)">
 *   <star-dropdown-item value="csv">CSV</star-dropdown-item>
 *   <star-dropdown-item value="pdf">PDF</star-dropdown-item>
 * </star-dropdown>
 * ```
 */
@Component({
  selector: 'star-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #panel>
      <div class="star-panel star-dropdown">
        <div
          class="star-listbox"
          role="listbox"
          tabindex="0"
          [id]="listId"
          [style.max-height]="maxHeight()"
          [attr.aria-label]="ariaLabel()"
          [attr.aria-labelledby]="ariaLabelledBy()"
          [attr.aria-activedescendant]="activeId()"
          (keydown)="onKeydown($event)"
        >
          <ng-content />
        </div>
      </div>
    </ng-template>
  `,
})
export class StarDropdown {
  private readonly injector = inject(Injector);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly directionality = inject(Directionality);
  readonly listId = inject(_IdGenerator).getId('star-dropdown-');

  /** The chosen value. The item with this value is shown as selected. */
  readonly value = model<unknown>(undefined);
  /** Name of the list for screen readers. */
  readonly ariaLabel = input<string | null>(null);
  /** Id of an element that names the list. */
  readonly ariaLabelledBy = input<string | null>(null);
  /** Closes the list after an item is chosen. */
  readonly closeOnSelect = input(true, { transform: booleanAttribute });
  /** CSS max height of the list; it scrolls when it is taller. */
  readonly maxHeight = input('20rem');

  /** Emits when the user chooses an item. */
  readonly selectionChange = output<StarDropdownSelection>();
  readonly opened = output<void>();
  readonly closed = output<void>();

  readonly visible = signal(false);
  private readonly items = contentChildren(StarDropdownItem, { descendants: true });
  private readonly options = computed(() => this.items().filter((item) => item.isOption()));
  private readonly activeItem = signal<StarDropdownItem | null>(null);
  protected readonly activeId = computed(() => (this.visible() ? this.activeItem()?.id : null));
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  private overlayRef: OverlayRef | null = null;
  private keyManager: ActiveDescendantKeyManager<DropdownOption> | null = null;
  private trigger: HTMLElement | null = null;
  private subscriptions: Subscription[] = [];

  constructor() {
    // Keeps the CDK direction in step with the page, so a list opened after a switch is flipped.
    inject(StarDirectionService);
    inject(DestroyRef).onDestroy(() => {
      this.unsubscribe();
      this.keyManager?.destroy();
      this.overlayRef?.dispose();
    });
  }

  /** Opens from the trigger, or closes when open. */
  toggle(trigger: HTMLElement): void {
    if (this.visible()) this.hide();
    else this.show(trigger);
  }

  /**
   * Opens the list below the trigger and moves the focus into it. The active option is the
   * selected one, else the first (`'first'`) or the last (`'last'`) enabled one.
   */
  show(trigger: HTMLElement, start: 'first' | 'last' = 'first'): void {
    if (this.visible()) this.hide(false);
    this.trigger = trigger;
    const strategy = createFlexibleConnectedPositionStrategy(this.injector, trigger)
      .withPositions(POSITIONS)
      .withPush(true)
      .withViewportMargin(8);
    this.overlayRef ??= createOverlayRef(this.injector, {
      positionStrategy: strategy,
      scrollStrategy: createRepositionScrollStrategy(this.injector),
      direction: this.directionality,
      usePopover: true,
    });
    this.overlayRef.updatePositionStrategy(strategy);
    this.overlayRef.attach(new TemplatePortal(this.panel(), this.viewContainer));
    this.subscriptions.push(
      this.overlayRef.outsidePointerEvents().subscribe((event) => {
        if (!trigger.contains(event.target as Node)) this.hide(false);
      }),
    );

    this.keyManager?.destroy();
    const options = this.options().map((item) => new DropdownOption(item));
    const manager = new ActiveDescendantKeyManager(options)
      .withTypeAhead()
      .skipPredicate((option) => option.disabled);
    this.keyManager = manager;
    this.subscriptions.push(
      manager.change.subscribe(() => this.activeItem.set(manager.activeItem?.item ?? null)),
    );
    const selected = options.find((option) => !option.disabled && this.isSelected(option.item));
    if (selected) manager.setActiveItem(selected);
    else if (start === 'last') manager.setLastItemActive();
    else manager.setFirstItemActive();

    const target = focusTarget(trigger);
    target.setAttribute('aria-expanded', 'true');
    target.setAttribute('aria-controls', this.listId);
    this.visible.set(true);
    this.opened.emit();
    afterNextRender(
      () => this.overlayRef?.overlayElement.querySelector<HTMLElement>('[role=listbox]')?.focus(),
      { injector: this.injector },
    );
  }

  /** Closes; returns the focus to the trigger when the focus was in the list. */
  hide(restoreFocus = true): void {
    if (!this.visible() || !this.overlayRef) return;
    const hadFocus = this.overlayRef.overlayElement.contains(document.activeElement);
    this.overlayRef.detach();
    this.unsubscribe();
    this.keyManager?.setActiveItem(-1);
    this.activeItem.set(null);
    const target = this.trigger ? focusTarget(this.trigger) : null;
    target?.setAttribute('aria-expanded', 'false');
    target?.removeAttribute('aria-controls');
    this.visible.set(false);
    if (restoreFocus && hadFocus) target?.focus();
    this.closed.emit();
  }

  /** Re-positions after a size change of the content. */
  align(): void {
    this.overlayRef?.updatePosition();
  }

  /** Chooses an item (click, Enter, Space). Headers, dividers and disabled items are ignored. */
  choose(item: StarDropdownItem): void {
    if (!item.isOption() || item.disabled()) return;
    this.value.set(item.value());
    this.selectionChange.emit({ value: item.value(), label: item.getLabel() });
    if (this.closeOnSelect()) this.hide();
    else this.activate(item);
  }

  /** Makes an option active (pointer move). */
  activate(item: StarDropdownItem): void {
    const manager = this.keyManager;
    if (!manager || !this.visible() || !item.isOption() || item.disabled()) return;
    if (manager.activeItem?.item === item) return;
    const index = this.options().indexOf(item);
    if (index >= 0) manager.setActiveItem(index);
  }

  /** Id of the header of the group that the item is in, or `null`. */
  headerIdOf(item: StarDropdownItem): string | null {
    let header: StarDropdownItem | null = null;
    for (const entry of this.items()) {
      if (entry === item) return header?.id ?? null;
      if (entry.header()) header = entry;
      else if (entry.divider()) header = null;
    }
    return null;
  }

  protected onKeydown(event: KeyboardEvent): void {
    const manager = this.keyManager;
    if (!manager) return;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.hide();
        return;
      case 'Tab':
        // The focus goes back to the trigger, and the browser then moves it on from there.
        this.hide();
        return;
      case 'Enter':
      case ' ':
        if (event.key === ' ' && manager.isTyping()) break;
        event.preventDefault();
        if (manager.activeItem) this.choose(manager.activeItem.item);
        return;
      // The moves read `event.key`; the key manager reads the older `keyCode`.
      case 'ArrowDown':
        event.preventDefault();
        manager.setNextItemActive();
        return;
      case 'ArrowUp':
        event.preventDefault();
        manager.setPreviousItemActive();
        return;
      case 'Home':
        event.preventDefault();
        manager.setFirstItemActive();
        return;
      case 'End':
        event.preventDefault();
        manager.setLastItemActive();
        return;
    }
    // Typeahead.
    manager.onKeydown(event);
  }

  private isSelected(item: StarDropdownItem): boolean {
    const value = this.value();
    return value !== undefined && Object.is(value, item.value());
  }

  private unsubscribe(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
  }
}

/**
 * Opens a `star-dropdown` from any element: a button, a `star-button` or a link. A click toggles
 * the list; Arrow down opens it on the first option and Arrow up on the last. The element that
 * takes the focus (the inner button of a `star-button`) gets `aria-haspopup="listbox"`,
 * `aria-expanded` and, while open, `aria-controls`.
 */
@Directive({
  selector: '[starDropdownTrigger]',
  host: { '(click)': 'onClick()', '(keydown)': 'onKeydown($event)' },
})
export class StarDropdownTrigger {
  readonly starDropdownTrigger = input.required<StarDropdown>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    // Only a browser has a user; the attributes are set once the inner button exists.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    afterNextRender(() => {
      const target = focusTarget(this.host);
      target.setAttribute('aria-haspopup', 'listbox');
      if (!target.hasAttribute('aria-expanded')) target.setAttribute('aria-expanded', 'false');
    });
  }

  protected onClick(): void {
    const target = focusTarget(this.host);
    if (target.matches(':disabled')) return;
    this.starDropdownTrigger().toggle(this.host);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (focusTarget(this.host).matches(':disabled')) return;
    event.preventDefault();
    this.starDropdownTrigger().show(this.host, event.key === 'ArrowUp' ? 'last' : 'first');
  }
}
