import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  TemplateRef,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { starInlineKey, starIsRtl } from '@star-ng/ui/core';
import {
  STAR_TABS_NO_OVERFLOW,
  starTabsOverflow,
  starTabsReveal,
  starTabsScrollPage,
} from './tabs-scroll';

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
 * Tabs (PrimeNG `p-tabs`, Material `mat-tab-group`): `[(value)]`, disabled tabs, icons, badges,
 * lazy panels and the WAI-ARIA tabs keyboard model (Arrow keys, Home, End; automatic or manual
 * activation). `scrollable` adds scroll buttons when the tabs do not fit (PrimeNG `scrollable`,
 * Material pagination).
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
  host: {
    class: 'star-tabs',
    '[class.star-tabs--pill]': "variant() === 'pill'",
    '[class.star-tabs--scrollable]': 'scrollable()',
  },
  template: `
    <div class="star-tabs__nav">
      @if (scrollable()) {
        <!-- Pointer helpers only: the keyboard reaches every tab with the arrow keys. -->
        <button
          type="button"
          class="star-tabs__scroll star-tabs__scroll--start"
          tabindex="-1"
          aria-hidden="true"
          [hidden]="!overflow().start"
          (click)="scrollPage(-1)"
        >
          <i class="ph-bold ph-caret-left" aria-hidden="true"></i>
        </button>
      }
      <div
        #list
        class="star-tabs__list"
        role="tablist"
        [attr.aria-label]="ariaLabel()"
        (scroll)="measure()"
      >
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
      @if (scrollable()) {
        <button
          type="button"
          class="star-tabs__scroll star-tabs__scroll--end"
          tabindex="-1"
          aria-hidden="true"
          [hidden]="!overflow().end"
          (click)="scrollPage(1)"
        >
          <i class="ph-bold ph-caret-right" aria-hidden="true"></i>
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
  /**
   * Keeps the tabs on one line and shows previous and next scroll buttons when they do not fit.
   * The selected tab scrolls into view. PrimeNG `scrollable`, Material `disablePagination` off.
   */
  readonly scrollable = input(false, { transform: booleanAttribute });

  readonly changed = output<string>();

  protected readonly tabs = contentChildren(StarTab);
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  /** Hidden content at either end of the tab list (`scrollable`). */
  protected readonly overflow = signal(STAR_TABS_NO_OVERFLOW);

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

  constructor() {
    let observer: ResizeObserver | null = null;
    inject(DestroyRef).onDestroy(() => observer?.disconnect());
    afterRenderEffect(() => {
      const scrollable = this.scrollable();
      const list = this.list().nativeElement;
      this.tabs();
      if (!scrollable) {
        observer?.disconnect();
        observer = null;
        this.overflow.set(STAR_TABS_NO_OVERFLOW);
        return;
      }
      // Browser only: the effect does not run on the server, and jsdom has no ResizeObserver.
      if (!observer && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => this.measure());
        observer.observe(list);
      }
      this.measure();
    });
    // The selected tab scrolls into the visible part of the list.
    afterRenderEffect(() => {
      const selected = this.selected();
      if (!this.scrollable()) return;
      const index = this.tabs().findIndex((tab) => tab.value() === selected);
      const button = this.buttons()[index]?.nativeElement;
      if (button) starTabsReveal(this.list().nativeElement, button, false);
      this.measure();
    });
  }

  /** Reads which ends of the list hide tabs. */
  protected measure(): void {
    if (!this.scrollable()) return;
    const next = starTabsOverflow(this.list().nativeElement, false);
    const now = untracked(this.overflow);
    if (next.start !== now.start || next.end !== now.end) this.overflow.set(next);
  }

  /** Scroll button: one page toward the start (-1) or the end (1) of the list. */
  protected scrollPage(step: 1 | -1): void {
    const list = this.list().nativeElement;
    starTabsScrollPage(list, step, false, starIsRtl(list));
    this.measure();
  }

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
