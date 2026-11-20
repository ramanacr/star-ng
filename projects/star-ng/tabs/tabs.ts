import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
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
  Injector,
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
import {
  STAR_UI_TEXT,
  starInlineKey,
  starIsRtl,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import {
  STAR_TABS_NO_OVERFLOW,
  starTabsOverflow,
  starTabsReveal,
  starTabsScrollPage,
} from './tabs-scroll';

/**
 * Event of `tabClose`: a close button or the Delete key asked to close a tab. The owner removes
 * the tab from its list. Call `cancel()` to keep it (PrimeNG `onClose`, cancelable).
 */
export interface StarTabCloseEvent {
  readonly value: string;
  /** Position of the tab among all tabs. */
  readonly index: number;
  /** Keeps the tab: the selection and the focus do not move. */
  cancel(): void;
  /** True after `cancel()`. */
  readonly canceled: boolean;
}

/**
 * Event of `tabReorder`: a tab was dragged, or moved with Control+Shift and an arrow key, to a new
 * place. Both indexes are positions among all tabs, ready for `moveItemInArray` of
 * `@angular/cdk/drag-drop`. The owner reorders its list. PrimeNG has no equivalent.
 */
export interface StarTabReorderEvent {
  readonly previousIndex: number;
  readonly currentIndex: number;
}

/** Context of the `starTabHeader` template. */
export interface StarTabHeaderContext {
  /** The tab (`let-tab`): `value()`, `label()`, `icon()`, `badge()`, `disabled()`. */
  readonly $implicit: StarTab;
  readonly tab: StarTab;
  /** True for the selected tab. */
  readonly active: boolean;
  /** Position of the tab among all tabs. */
  readonly index: number;
}

/**
 * Custom tab label: `<ng-template starTabHeader let-tab let-active="active">…</ng-template>`.
 * Written in `star-tab`, it is the label of that tab; written directly in `star-tabs`, it is the
 * label of every tab that has none of its own. It renders inside the tab button, so it must not
 * hold buttons, links or fields. PrimeNG `p-tab` content, Material `mat-tab-label`.
 */
@Directive({ selector: 'ng-template[starTabHeader]' })
export class StarTabHeader {
  readonly template = inject<TemplateRef<StarTabHeaderContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: StarTabHeader, _ctx: unknown): _ctx is StarTabHeaderContext {
    return true;
  }
}

/**
 * Lazy tab body: `<ng-template starTabContent>…</ng-template>`. It renders on the first activation
 * of the tab (see `lazy` and `cache` of `star-tabs`). Material `matTabContent`.
 */
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
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
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
  /**
   * Shows a close button on the tab, and the Delete key closes it. `star-tabs` emits `tabClose`;
   * the owner removes the tab. PrimeNG `closable`.
   */
  readonly closable = input(false, { transform: booleanAttribute });

  readonly tabId = this.ids.getId('star-tab-');
  readonly panelId = this.ids.getId('star-tabpanel-');

  protected readonly lazy = contentChild(StarTabContent);
  /** The own header template of this tab. */
  readonly header = contentChild(StarTabHeader);
  readonly active = computed(() => this.tabs.selected() === this.value());
  /**
   * Whether the `starTabContent` template is rendered: always without `lazy`; else from the first
   * activation on, and with `cache` off only while the tab is active.
   */
  protected readonly rendered = linkedSignal<
    { active: boolean; lazy: boolean; cache: boolean },
    boolean
  >({
    source: () => ({ active: this.active(), lazy: this.tabs.lazy(), cache: this.tabs.cache() }),
    computation: (now, previous) =>
      !now.lazy || now.active || (now.cache && (previous?.value ?? false)),
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
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [CdkDropList, CdkDrag, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-tabs',
    '[class.star-tabs--pill]': "variant() === 'pill'",
    '[class.star-tabs--scrollable]': 'scrollable()',
    '[class.star-tabs--vertical]': 'vertical()',
    '[class.star-tabs--align-center]': "alignment() === 'center'",
    '[class.star-tabs--align-end]': "alignment() === 'end'",
    '[class.star-tabs--align-stretch]': "alignment() === 'stretch'",
  },
  template: `
    <div data-star-part="navigation" class="star-tabs__nav">
      @if (scrollable()) {
        <!-- Pointer helpers only: the keyboard reaches every tab with the arrow keys. -->
        <button
          data-star-part="scrollButton"
          type="button"
          class="star-tabs__scroll star-tabs__scroll--start"
          tabindex="-1"
          aria-hidden="true"
          [hidden]="!overflow().start"
          (click)="scrollPage(-1)"
        >
          <i
            data-star-part="scrollStartIcon"
            class="ph-bold"
            [class.ph-caret-left]="!vertical()"
            [class.ph-caret-up]="vertical()"
            aria-hidden="true"
          ></i>
        </button>
      }
      <div
        data-star-part="list"
        #list
        class="star-tabs__list"
        role="tablist"
        [attr.aria-orientation]="orientation()"
        [attr.aria-label]="ariaLabel()"
        [attr.tabindex]="hasEnabledTab() ? null : -1"
        cdkDropList
        [cdkDropListOrientation]="orientation()"
        [cdkDropListLockAxis]="vertical() ? 'y' : 'x'"
        [cdkDropListDisabled]="!reorderable()"
        (cdkDropListDropped)="onDrop($event)"
        (scroll)="measure()"
      >
        @for (tab of tabs(); track tab.value(); let i = $index) {
          <!-- A plain wrapper: the tab list owns the tab through it. It is the drag item. -->
          <span
            data-star-part="item"
            class="star-tabs__item"
            [class.star-tabs__item--closable]="tab.closable()"
            cdkDrag
            [cdkDragDisabled]="!reorderable() || tab.disabled()"
          >
            <button
              data-star-part="tabButton"
              #tabButton
              type="button"
              role="tab"
              class="star-tabs__tab"
              [id]="tab.tabId"
              [class.star-tabs__tab--active]="tab.active()"
              [attr.aria-selected]="tab.active()"
              [attr.aria-controls]="tab.panelId"
              [attr.aria-keyshortcuts]="shortcuts(tab)"
              [attr.aria-describedby]="describedBy(tab)"
              [attr.tabindex]="tab.value() === focusValue() ? 0 : -1"
              [disabled]="tab.disabled()"
              (click)="select(tab)"
              (keydown)="onKeydown($event, tab)"
            >
              @if (tab.header()?.template ?? header()?.template; as headerTemplate) {
                <ng-container
                  *ngTemplateOutlet="
                    headerTemplate;
                    context: { $implicit: tab, tab, active: tab.active(), index: i }
                  "
                />
              } @else {
                @if (tab.icon(); as icon) {
                  <i data-star-part="tabIcon" [class]="icon" aria-hidden="true"></i>
                }
                <span data-star-part="tabText">{{ tab.label() }}</span>
                @if (tab.badge() !== null) {
                  <span
                    data-star-part="badgeText"
                    class="star-badge star-badge--secondary star-badge--sm"
                    >{{ tab.badge() }}</span
                  >
                }
              }
            </button>
            @if (tab.closable()) {
              <!--
              A tab list may own only tabs, so the close button is for the pointer: the Delete key
              closes the focused tab, and the tab describes the key (aria-keyshortcuts).
            -->
              <button
                data-star-part="closeButton"
                type="button"
                class="star-tabs__close"
                tabindex="-1"
                aria-hidden="true"
                [attr.aria-label]="text.tabClose(tab.label())"
                [title]="text.tabClose(tab.label())"
                [disabled]="tab.disabled()"
                (click)="close(tab, i, false)"
              >
                <i data-star-part="closeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
              </button>
            }
          </span>
        }
      </div>
      @if (closableSelected(); as current) {
        <!--
          The close button of the selected tab for assistive technology and voice control, which
          cannot reach the hidden pointer buttons. It is outside the tab list, and visually
          hidden until it has the focus.
        -->
        <button
          data-star-part="closeSelectedButton"
          type="button"
          class="star-tabs__close-selected"
          (click)="close(current, tabs().indexOf(current), false)"
        >
          {{ text.tabClose(current.label()) }}
        </button>
      }
      @if (closeHint()) {
        <span class="star-sr-only" [id]="closeHintId">{{ text.tabCloseHint }}</span>
      }
      @if (reorderable()) {
        <span class="star-sr-only" [id]="reorderHintId">{{ text.tabReorderHint }}</span>
        <span class="star-sr-only star-tabs__live" aria-live="polite">{{ announcement() }}</span>
      }
      @if (scrollable()) {
        <button
          data-star-part="scrollButton"
          type="button"
          class="star-tabs__scroll star-tabs__scroll--end"
          tabindex="-1"
          aria-hidden="true"
          [hidden]="!overflow().end"
          (click)="scrollPage(1)"
        >
          <i
            data-star-part="scrollEndIcon"
            class="ph-bold"
            [class.ph-caret-right]="!vertical()"
            [class.ph-caret-down]="vertical()"
            aria-hidden="true"
          ></i>
        </button>
      }
    </div>
    <ng-content />
  `,
})
export class StarTabs {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly injector = inject(Injector);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly closeHintId = inject(_IdGenerator).getId('star-tabs-close-hint-');
  protected readonly reorderHintId = inject(_IdGenerator).getId('star-tabs-reorder-hint-');

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
  /**
   * `'vertical'` puts the tabs in a column at the start of the panels; Arrow Up and Arrow Down
   * move between them. PrimeNG has no equivalent, Material `mat-tab-nav` has none either.
   */
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  /**
   * Position of the tabs along the list: at the start, centered, at the end, or filling it
   * (`stretch`). Material `mat-align-tabs` / `alignTabs` (start, center, end) and
   * `mat-stretch-tabs`; PrimeNG has no equivalent.
   */
  readonly alignment = input<'start' | 'center' | 'end' | 'stretch'>('start');
  /**
   * Tabs can be dragged to a new place (CDK drag-drop), or moved with Control+Shift and an arrow
   * key. `star-tabs` emits `tabReorder`; the owner reorders its list. PrimeNG has no equivalent.
   */
  readonly reorderable = input(false, { transform: booleanAttribute });
  /**
   * Content in `ng-template starTabContent` renders on the first activation of its tab (the
   * default). `false` renders every template at once. Content placed directly in `star-tab`
   * always renders at once. PrimeNG `lazy`.
   */
  readonly lazy = input(true, { transform: booleanAttribute });
  /**
   * Keeps rendered `starTabContent` alive (hidden) when its tab is not active, so it keeps its
   * state (the default). `false` destroys it and renders it again on the next activation. Only
   * applies with `lazy`. PrimeNG `cache`, Material `preserveContent`.
   */
  readonly cache = input(true, { transform: booleanAttribute });

  readonly changed = output<string>();
  /**
   * A closable tab asked to close (close button or Delete key). Remove the tab from your list,
   * or call `cancel()`. When the closed tab was selected, the next tab is selected (the
   * previous one at the end). PrimeNG `onClose`, Material has no equivalent.
   */
  readonly tabClose = output<StarTabCloseEvent>();
  /** A tab was dragged or moved with the keyboard (`reorderable`). Reorder your list. */
  readonly tabReorder = output<StarTabReorderEvent>();

  protected readonly tabs = contentChildren(StarTab);
  /** The header template for all tabs: only one written directly in `star-tabs`. */
  protected readonly header = contentChild(StarTabHeader, { descendants: false });
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  protected readonly vertical = computed(() => this.orientation() === 'vertical');
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
  /** Live text after a move (`reorderable`). */
  protected readonly announcement = signal('');
  /** The selected tab when it can close: the close button after the tab list names it. */
  protected readonly closableSelected = computed(() => {
    const selected = this.selected();
    const tab = this.tabs().find((t) => t.value() === selected);
    return tab && tab.closable() && !tab.disabled() ? tab : null;
  });
  /** The hint of the Delete key, once for all closable tabs. */
  protected readonly closeHint = computed(() => this.tabs().some((tab) => tab.closable()));
  /** False when no tab can take the focus: the tab list itself is then focusable from code. */
  protected readonly hasEnabledTab = computed(() => this.tabs().some((tab) => !tab.disabled()));
  /** The last focusable tab, closed from the keyboard or its close button, until the owner removes it. */
  private lastClosed: StarTab | null = null;

  constructor() {
    // After the owner removed the last focusable tab (at once or in a later render), the focus
    // moves to the tab list, unless the user moved it elsewhere in the meantime.
    afterRenderEffect(() => {
      const tabs = this.tabs();
      const closed = this.lastClosed;
      if (!closed || tabs.includes(closed)) return;
      this.lastClosed = null;
      if (this.hasEnabledTab()) return;
      const list = this.list().nativeElement;
      const active = list.ownerDocument.activeElement;
      if (!active || active === list.ownerDocument.body || this.hostElement.contains(active)) {
        list.focus();
      }
    });
    let observer: ResizeObserver | null = null;
    inject(DestroyRef).onDestroy(() => observer?.disconnect());
    afterRenderEffect(() => {
      const scrollable = this.scrollable();
      const list = this.list().nativeElement;
      this.tabs();
      this.vertical();
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
      if (button) starTabsReveal(this.list().nativeElement, button, this.vertical());
      this.measure();
    });
  }

  /** Reads which ends of the list hide tabs. */
  protected measure(): void {
    if (!this.scrollable()) return;
    const next = starTabsOverflow(this.list().nativeElement, untracked(this.vertical));
    const now = untracked(this.overflow);
    if (next.start !== now.start || next.end !== now.end) this.overflow.set(next);
  }

  /** Scroll button: one page toward the start (-1) or the end (1) of the list. */
  protected scrollPage(step: 1 | -1): void {
    const list = this.list().nativeElement;
    starTabsScrollPage(list, step, this.vertical(), starIsRtl(list));
    this.measure();
  }

  protected select(tab: StarTab): void {
    if (tab.disabled()) return;
    this.focusValue.set(tab.value());
    if (tab.value() === this.selected()) return;
    this.value.set(tab.value());
    this.changed.emit(tab.value());
  }

  /**
   * Emits `tabClose`. Unless a handler cancels it, the selection moves from the closed tab to its
   * neighbour, and from the keyboard the focus follows.
   */
  protected close(tab: StarTab, index: number, fromKeyboard: boolean): void {
    if (!tab.closable() || tab.disabled()) return;
    // A close button inside the tabs had the focus: it goes away with the tab, so the focus
    // moves to the neighbour like after the Delete key.
    const active = this.hostElement.ownerDocument.activeElement;
    const fromCloseButton =
      !!active?.closest('.star-tabs__close, .star-tabs__close-selected') &&
      this.hostElement.contains(active);
    let canceled = false;
    this.tabClose.emit({
      value: tab.value(),
      index,
      cancel: () => {
        canceled = true;
      },
      get canceled() {
        return canceled;
      },
    });
    if (canceled) return;
    const enabled = this.tabs().filter((other) => other === tab || !other.disabled());
    const at = enabled.indexOf(tab);
    const neighbour = enabled[at + 1] ?? enabled[at - 1];
    const wasSelected = tab.value() === this.selected();
    const moveFocus = fromKeyboard || fromCloseButton;
    const hadFocus = moveFocus || tab.value() === this.focusValue();
    if (!neighbour || neighbour === tab) {
      // The last tab that can take the focus closed: keep the focus in the tabs (the tab list)
      // instead of losing it to the page body.
      if (moveFocus) this.lastClosed = tab;
      return;
    }
    if (wasSelected) {
      this.value.set(neighbour.value());
      this.changed.emit(neighbour.value());
    }
    if (hadFocus) this.focusValue.set(neighbour.value());
    if (moveFocus) {
      // The owner removes the tab in its handler; focus the neighbour once the list rendered.
      afterNextRender(
        () => {
          const position = this.tabs().indexOf(neighbour);
          this.buttons()[position]?.nativeElement.focus();
        },
        { injector: this.injector },
      );
    }
  }

  /** `aria-keyshortcuts` of a tab: Delete when it closes, the move keys when it moves. */
  protected shortcuts(tab: StarTab): string | null {
    const keys: string[] = [];
    if (tab.closable() && !tab.disabled()) keys.push('Delete');
    if (this.reorderable()) {
      keys.push(
        ...(this.vertical()
          ? ['Control+Shift+ArrowUp', 'Control+Shift+ArrowDown']
          : ['Control+Shift+ArrowLeft', 'Control+Shift+ArrowRight']),
      );
    }
    return keys.join(' ') || null;
  }

  protected describedBy(tab: StarTab): string | null {
    const ids: string[] = [];
    if (tab.closable() && !tab.disabled()) ids.push(this.closeHintId);
    if (this.reorderable()) ids.push(this.reorderHintId);
    return ids.join(' ') || null;
  }

  protected onDrop(event: CdkDragDrop<unknown>): void {
    this.reorder(event.previousIndex, event.currentIndex, false);
  }

  /** Emits `tabReorder`, announces the new position and, from the keyboard, keeps the focus. */
  private reorder(previousIndex: number, currentIndex: number, fromKeyboard: boolean): void {
    const tabs = this.tabs();
    const moved = tabs[previousIndex];
    if (!moved || previousIndex === currentIndex) return;
    this.tabReorder.emit({ previousIndex, currentIndex });
    this.announcement.set(this.text.itemPosition(moved.label(), currentIndex + 1, tabs.length));
    if (!fromKeyboard) return;
    // Moving a focused element in the DOM drops its focus: give it back after the render.
    afterNextRender(
      () => {
        const position = this.tabs().indexOf(moved);
        this.buttons()[position]?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected onKeydown(event: KeyboardEvent, current: StarTab): void {
    if (this.reorderable() && event.ctrlKey && event.shiftKey && !event.altKey) {
      const [forward, back] = this.vertical()
        ? ['ArrowDown', 'ArrowUp']
        : ['ArrowRight', 'ArrowLeft'];
      const key = starInlineKey(event);
      if (key === forward || key === back) {
        event.preventDefault();
        const from = this.tabs().indexOf(current);
        const to = Math.min(Math.max(from + (key === forward ? 1 : -1), 0), this.tabs().length - 1);
        this.reorder(from, to, true);
        return;
      }
    }
    if (event.key === 'Delete' && current.closable()) {
      event.preventDefault();
      this.close(current, this.tabs().indexOf(current), true);
      return;
    }
    const enabled = this.tabs().filter((tab) => !tab.disabled());
    const index = enabled.indexOf(current);
    let next: StarTab | undefined;
    // Arrow right means "next tab in reading order": the left arrow in right-to-left. A vertical
    // list uses Arrow down and Arrow up instead.
    const [forward, back] = this.vertical()
      ? ['ArrowDown', 'ArrowUp']
      : ['ArrowRight', 'ArrowLeft'];
    switch (starInlineKey(event)) {
      case forward:
        next = enabled[(index + 1) % enabled.length];
        break;
      case back:
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
