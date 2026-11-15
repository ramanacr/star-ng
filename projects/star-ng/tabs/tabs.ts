import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  TemplateRef,
  viewChildren,
} from '@angular/core';
import { starInlineKey } from '@star-ng/ui/core';

/** Lazy tab body: `<ng-template starTabContent>…</ng-template>` renders on first activation only. */
@Directive({ selector: 'ng-template[starTabContent]' })
export class StarTabContent {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * One tab and its panel. The host element is the `tabpanel`.
 * Eager content goes directly inside; wrap heavy content in `ng-template starTabContent`.
 */
@Component({
  selector: 'star-tab',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-tabs__panel',
    role: 'tabpanel',
    tabindex: '0',
    '[id]': 'panelId',
    '[attr.aria-labelledby]': 'tabId',
    '[hidden]': '!active()',
  },
  template: `
    @if (lazy(); as lazyContent) {
      @if (rendered()) {
        <ng-container *ngTemplateOutlet="lazyContent.template" />
      }
    }
    <ng-content />
  `,
})
export class StarTab {
  private readonly tabs = inject(forwardRef(() => StarTabs));
  private readonly ids = inject(_IdGenerator);

  readonly value = input.required<string>();
  readonly label = input.required<string>();
  /** Phosphor icon class, for example `ph-bold ph-files`. */
  readonly icon = input<string | null>(null);
  readonly badge = input<string | number | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });

  readonly tabId = this.ids.getId('star-tab-');
  readonly panelId = this.ids.getId('star-tabpanel-');

  protected readonly lazy = contentChild(StarTabContent);
  readonly active = computed(() => this.tabs.selected() === this.value());
  /** Stays true after the first activation, so lazy content keeps its state. */
  protected readonly rendered = linkedSignal<boolean, boolean>({
    source: this.active,
    computation: (active, previous) => active || (previous?.value ?? false),
  });
}

/**
 * Tabs (PrimeNG `p-tabs`): `[(value)]`, disabled tabs, icons, badges, lazy panels and the
 * WAI-ARIA tabs keyboard model (Arrow keys, Home, End; automatic or manual activation).
 *
 * ```html
 * <star-tabs [(value)]="tab" ariaLabel="Order sections">
 *   <star-tab value="details" label="Details">…</star-tab>
 *   <star-tab value="history" label="History"><ng-template starTabContent>…</ng-template></star-tab>
 * </star-tabs>
 * ```
 */
@Component({
  selector: 'star-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-tabs', '[class.star-tabs--pill]': "variant() === 'pill'" },
  template: `
    <div class="star-tabs__list" role="tablist" [attr.aria-label]="ariaLabel()">
      @for (tab of tabs(); track tab.value()) {
        <button
          #tabButton
          type="button"
          role="tab"
          class="star-tabs__tab"
          [id]="tab.tabId"
          [class.star-tabs__tab--active]="tab.active()"
          [attr.aria-selected]="tab.active()"
          [attr.aria-controls]="tab.panelId"
          [attr.tabindex]="tab.value() === focusValue() ? 0 : -1"
          [disabled]="tab.disabled()"
          (click)="select(tab)"
          (keydown)="onKeydown($event, tab)"
        >
          @if (tab.icon(); as icon) {
            <i [class]="icon" aria-hidden="true"></i>
          }
          <span>{{ tab.label() }}</span>
          @if (tab.badge() !== null) {
            <span class="star-badge star-badge--secondary star-badge--sm">{{ tab.badge() }}</span>
          }
        </button>
      }
    </div>
    <ng-content />
  `,
})
export class StarTabs {
  readonly value = model<string | null>(null);
  readonly variant = input<'line' | 'pill'>('line');
  /** `false`: arrow keys move focus only; Enter / Space activate (manual activation). */
  readonly selectOnFocus = input(true, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);

  readonly changed = output<string>();

  protected readonly tabs = contentChildren(StarTab);
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  /** Selected value; falls back to the first enabled tab while `value` is unset. */
  readonly selected = computed(
    () =>
      this.value() ??
      this.tabs()
        .find((tab) => !tab.disabled())
        ?.value() ??
      null,
  );
  /** Roving tabindex target; follows the selection, moves with arrows in manual mode. */
  protected readonly focusValue = linkedSignal(() => this.selected());

  protected select(tab: StarTab): void {
    if (tab.disabled()) return;
    this.focusValue.set(tab.value());
    if (tab.value() === this.selected()) return;
    this.value.set(tab.value());
    this.changed.emit(tab.value());
  }

  protected onKeydown(event: KeyboardEvent, current: StarTab): void {
    const enabled = this.tabs().filter((tab) => !tab.disabled());
    const index = enabled.indexOf(current);
    let next: StarTab | undefined;
    // Arrow right means "next tab in reading order": the left arrow in right-to-left.
    switch (starInlineKey(event)) {
      case 'ArrowRight':
        next = enabled[(index + 1) % enabled.length];
        break;
      case 'ArrowLeft':
        next = enabled[(index - 1 + enabled.length) % enabled.length];
        break;
      case 'Home':
        next = enabled[0];
        break;
      case 'End':
        next = enabled.at(-1);
        break;
      default:
        return;
    }
    if (!next) return;
    event.preventDefault();
    this.focusValue.set(next.value());
    const position = this.tabs().indexOf(next);
    this.buttons()[position]?.nativeElement.focus();
    if (this.selectOnFocus()) this.select(next);
  }
}
