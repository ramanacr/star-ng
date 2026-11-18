import { _IdGenerator } from '@angular/cdk/a11y';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  computed,
  contentChild,
  contentChildren,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import {
  optionText,
  readOption,
  STAR_UI_TEXT,
  StarDirectionService,
  StarEmptyContext,
  StarFilterBy,
  starFilterMatchAny,
  StarFilterMatchMode,
  starFilterTexts,
  StarGroupContext,
  StarIconSlotName,
  StarLazyLoadEvent,
  StarLazyRequests,
  starListKeyboardTarget,
  starListLayout,
  starListLazyRange,
  starListPageSize,
  starListRevealOffset,
  starListRevealRows,
  starListRowRendered,
  StarOptionKey,
  StarSlot,
  starSlot,
  starSlotMap,
  StarWindowRow,
} from '@star-ng/ui/core';
import { StarField, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';

/** Context of the custom option template: `<ng-template starOption let-option let-selected="selected">`. */
export interface StarOptionContext<T> {
  readonly $implicit: T;
  readonly selected: boolean;
  readonly index: number;
}

/**
 * Custom option row template for `star-select`, `star-multi-select`, `star-listbox` and
 * `star-autocomplete`. PrimeNG `#item` template.
 */
@Directive({ selector: 'ng-template[starOption]' })
export class StarOptionTemplate<T = unknown> {
  /** Optional: pass the options array to type `let-option` in strict templates. */
  readonly starOptionOf = input<readonly T[] | null>(null);
  readonly template = inject<TemplateRef<StarOptionContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _dir: StarOptionTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarOptionContext<T> {
    return true;
  }
}

/**
 * Transform of the `options` input: the array may hold `undefined` for options that a `lazy` list
 * has not loaded yet. The controls check for `undefined` where it matters.
 */
export function starLazyOptions<T>(options: readonly (T | undefined)[]): readonly T[] {
  return options as readonly T[];
}

/** One rendered line of the option list: a group heading or an option. */
export type StarListRow<T> = StarWindowRow<T>;

/** Lines rendered above and below the lines in view with `virtualScroll`. */
const VIRTUAL_BUFFER = 6;
/** List height in pixels before the first scroll event gives the real height. */
const VIRTUAL_FALLBACK_HEIGHT = 256;

/** Elements that can take focus: candidates for the Tab order of the panel header and footer. */
const PANEL_FOCUSABLE =
  'a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], ' +
  '[contenteditable]:not([contenteditable="false"])';
/** Parts of the panel that the combobox keys control: the filter row and the option list. */
const PANEL_OWN_PARTS = '.star-panel__filter, [role=listbox]';

const PANEL_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
];

/**
 * Shared state and keyboard model of the dropdown list controls (WAI-ARIA combobox +
 * listbox with `aria-activedescendant`). Subclasses add the selection model.
 *
 * Buttons, links and fields in the panel header and footer are in the tab order of the open
 * panel: Tab in the combobox moves to them, Tab after the last one leaves the control, Shift+Tab
 * from the first one returns to the combobox, and Escape closes the panel. A subclass template
 * binds `onPanelMousedown`, `onPanelKeydown`, `onPanelFocusin` and `onPanelFocusout` on the
 * `.star-panel` element.
 *
 * A subclass must provide `STAR_SLOT_HOST` (`{ provide: STAR_SLOT_HOST, useExisting:
 * forwardRef(() => MyControl) }`). Without it, slot directives find no host and the control
 * gets no slots.
 */
@Directive()
export abstract class StarOptionListBase<TOption, TValue> {
  /** Keeps the CDK direction (overlays and menus) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly parentField = inject(StarField, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  /**
   * The parent `star-field` when this control owns its label (see `linkField`), else `null`. Its
   * label, hint and error name and describe the control.
   */
  protected field: StarField | null = null;

  /**
   * The options. With `lazy`, an entry may be `undefined` while it is not loaded: the list shows a
   * loading row for it, and the keyboard skips it.
   */
  readonly options = input<readonly TOption[], readonly (TOption | undefined)[]>([], {
    transform: starLazyOptions,
  });
  readonly optionLabel = input<StarOptionKey<TOption> | null>(null);
  /** Value stored in the form. Omit to store the whole option. */
  readonly optionValue = input<StarOptionKey<TOption> | null>(null);
  readonly optionDisabled = input<StarOptionKey<TOption> | null>(null);
  /** Equality for values (default `Object.is`). Use for object values from the server. */
  readonly compareWith = input<(a: TValue, b: TValue) => boolean>(Object.is);
  /**
   * Group heading of an option (property name or function). Options with the same heading
   * show together under it, in the order in which the headings first appear.
   */
  readonly optionGroup = input<StarOptionKey<TOption> | null>(null);
  /**
   * Renders only the lines in view, for long option lists. Every line has the height
   * `virtualItemSize` and option text stays on one line. Keys and type-ahead work over all
   * options, also those that are not in the DOM. Page up and Page down move by the lines in view.
   * Each option has `aria-setsize` and `aria-posinset` for the whole list, and
   * `aria-activedescendant` only names an option that is in the DOM.
   */
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /** Line height in pixels with `virtualScroll`. */
  readonly virtualItemSize = input(40);
  /**
   * Loads the options on demand (PrimeNG `lazy` with `onLazyLoad`). Use it with `virtualScroll`
   * and an `options` array of the full length, with `undefined` for the options that are not loaded.
   * The control emits `lazyLoad` when the rows in view need such options, and when the filter text
   * changes. The filter then does not filter the options in the browser: the event has the text.
   */
  readonly lazy = input(false, { transform: booleanAttribute });
  /** Moving the pointer over an option makes it the active option (default `true`). PrimeNG `focusOnHover`. */
  readonly focusOnHover = input(true, { transform: booleanAttribute });
  /**
   * Single choice (select, autocomplete): moving the active option with the keys also chooses it,
   * and the panel stays open (default `false`). PrimeNG `selectOnFocus`.
   */
  readonly selectOnFocus = input(false, { transform: booleanAttribute });
  /**
   * When the panel opens without a chosen option, the first enabled option is active (default
   * `true`). Off: no option is active until a key moves. The autocomplete uses `autoHighlight`.
   * PrimeNG `autoOptionFocus`.
   */
  readonly autoOptionFocus = input(true, { transform: booleanAttribute });

  readonly placeholder = input<string | null>(null);
  readonly filter = input(false, { transform: booleanAttribute });
  readonly filterPlaceholder = input<string | null>(null);
  /**
   * Option fields that the filter searches: one key or a list of keys (property names or
   * functions). Default: the label. PrimeNG `filterBy`.
   */
  readonly filterBy = input<StarFilterBy<TOption>>(null);
  /** How the filter text must match: `contains` (default), `startsWith`, `endsWith`, `equals` or `notContains`. PrimeNG `filterMatchMode`. */
  readonly filterMatchMode = input<StarFilterMatchMode>('contains');
  /**
   * Locale of the filter compare, for example `de` or `tr`. The compare uses `Intl.Collator` with
   * sensitivity `base`, so case and accents do not count. Default: case and accents do not count,
   * without locale rules. PrimeNG `filterLocale`.
   */
  readonly filterLocale = input<string | null>(null);
  /**
   * Clears the filter text when the panel closes (default `true`). Set `false` to keep the text,
   * and the filtered list, for the next opening. PrimeNG `resetFilterOnHide` (there default `false`).
   */
  readonly resetFilterOnHide = input(true, { transform: booleanAttribute });
  readonly showClear = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly emptyMessage = input<string | null>(null);
  readonly scrollHeight = input('16rem');
  readonly size = input<'sm' | 'md'>('md');
  readonly ariaLabel = input<string | null>(null);
  readonly ariaLabelledBy = input<string | null>(null);
  readonly inputId = input(this.ids.getId('star-select-'));

  // Signal Forms state (bound by [formField]).
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly name = input('');

  readonly touch = output<void>();
  readonly opened = output<void>();
  readonly closed = output<void>();
  readonly filterChange = output<string>();
  /** With `lazy`: the options from `first` to `last` are needed for the filter text `filter`. PrimeNG `onLazyLoad`. */
  readonly lazyLoad = output<StarLazyLoadEvent>();

  protected readonly optionTemplate = contentChild(StarOptionTemplate);
  /** All slot directives written inside this control. The picks below filter them by host. */
  protected readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  protected readonly loadingSlot = starSlot<object>(this.slots, this, 'loading');
  protected readonly groupSlot = starSlot<StarGroupContext>(this.slots, this, 'group');
  protected readonly iconSlots = starSlotMap<object>(this.slots, this, 'icon');
  /** The loading slot, only while `loading` is on. */
  protected readonly loadingRow = computed(() => (this.loading() ? this.loadingSlot() : null));
  protected readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');
  private readonly filterInput = viewChild<ElementRef<HTMLInputElement>>('filterInput');

  protected readonly positions = PANEL_POSITIONS;
  protected readonly listId = this.ids.getId('star-listbox-');
  protected readonly open = signal(false);
  protected readonly filterValue = signal('');
  /**
   * Index of the active option in `visibleOptions`. When the options change (for example after a
   * button in the panel header loads more), the same option stays active at its new index. When it
   * is gone, the nearest enabled option at the old position becomes active.
   */
  protected readonly activeIndex = linkedSignal<readonly TOption[], number>({
    source: () => this.visibleOptions(),
    computation: (options, previous) => {
      if (!previous || previous.value < 0) return -1;
      const option = previous.source[previous.value];
      const same = option === undefined ? -1 : options.indexOf(option);
      if (same >= 0) return same;
      const from = Math.min(previous.value, options.length - 1);
      for (const step of [1, -1]) {
        for (let i = from; i >= 0 && i < options.length; i += step) {
          if (!this.isDisabled(options[i])) return i;
        }
      }
      return -1;
    },
  });
  /** Invalid after touch, or while the parent `star-field` shows an error. */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.field?.errorText(),
  );
  /** `aria-labelledby` of the trigger: `ariaLabelledBy`, else the `star-field` label. */
  protected readonly labelledBy = computed(() =>
    starFieldLabelledBy(this.field, this.ariaLabel(), this.ariaLabelledBy()),
  );
  /** `aria-describedby` of the trigger: the hint or error of the parent `star-field`. */
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));
  protected readonly interactive = computed(() => !this.disabled() && !this.readonly());

  protected readonly visibleOptions = computed(() => {
    const query = this.filterValue();
    const all = this.options();
    const options =
      !this.filterOn() || !query || this.lazy()
        ? all
        : all.filter((option) => this.matchesQuery(option, query));
    return this.groupedOrder(options);
  });

  /** True when the typed text filters the list: `filter` (the editable select also filters). */
  protected filterOn(): boolean {
    return this.filter();
  }

  /** True when the option matches the filter text (`filterBy`, `filterMatchMode`, `filterLocale`). */
  protected matchesQuery(option: TOption, query: string): boolean {
    return starFilterMatchAny(
      starFilterTexts(option, this.filterBy(), (o) => this.labelOf(o)),
      query,
      this.filterMatchMode(),
      this.filterLocale(),
    );
  }

  /** With `optionGroup`: keeps each group together, in the order the groups first appear. */
  protected groupedOrder(options: readonly TOption[]): readonly TOption[] {
    if (!this.optionGroup()) return options;
    const order = new Map<string, number>();
    for (const option of options) {
      const group = this.groupOf(option);
      if (!order.has(group)) order.set(group, order.size);
    }
    return options
      .map((option, index) => ({ option, index, rank: order.get(this.groupOf(option)) ?? 0 }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(({ option }) => option);
  }

  /** Group headings and options in display order, and the row of each option. */
  protected readonly layout = computed(() =>
    starListLayout(
      this.visibleOptions(),
      this.optionGroup() ? (option) => this.groupOf(option) : null,
      this.listId,
    ),
  );

  /** Group headings and options, in display order. */
  protected readonly rows = computed<readonly StarListRow<TOption>[]>(() => this.layout().rows);

  private readonly listScrollTop = signal(0);
  private readonly listHeight = signal(0);
  /** Measured height of the loading row, which is above the option rows (0 = not measured). */
  private readonly loadingRowHeight = signal(0);

  /**
   * Space above the first row with `virtualScroll`: the loading row, while it shows. Before it
   * is measured, it counts as one line.
   */
  private readonly leadHeight = computed(() =>
    this.virtualScroll() && this.loadingRow()
      ? this.loadingRowHeight() || Math.max(1, this.virtualItemSize())
      : 0,
  );

  /** First and last rendered line, and the heights of the lines left out. */
  protected readonly virtualWindow = computed(() => {
    const count = this.rows().length;
    if (!this.virtualScroll()) return { start: 0, end: count, before: 0, after: 0 };
    const size = Math.max(1, this.virtualItemSize());
    const visible = Math.ceil((this.listHeight() || VIRTUAL_FALLBACK_HEIGHT) / size);
    const top = Math.max(0, this.listScrollTop() - this.leadHeight());
    const first = Math.min(Math.floor(top / size), Math.max(0, count - visible));
    const start = Math.max(0, first - VIRTUAL_BUFFER);
    const end = Math.min(count, first + visible + VIRTUAL_BUFFER);
    return { start, end, before: start * size, after: (count - end) * size };
  });

  protected readonly renderedRows = computed(() => {
    const rows = this.rows();
    const { start, end } = this.virtualWindow();
    return start === 0 && end === rows.length ? rows : rows.slice(start, end);
  });

  /** True while a rendered row is an option that is not loaded yet (`aria-busy` of the list). */
  protected readonly lazyBusy = computed(() =>
    this.renderedRows().some((row) => row.kind === 'option' && row.option === undefined),
  );

  /** Filter text of a `lazyLoad` request. The autocomplete sends its typed text. */
  protected lazyFilterText(): string {
    return this.filterValue();
  }

  private readonly lazyRequests = new StarLazyRequests();

  /** Emits `lazyLoad` when the rows in view need options that are not loaded (see `lazy`). */
  private requestLazyRows(): void {
    if (!this.lazy() || !this.open()) return;
    const window = this.virtualWindow();
    const range = starListLazyRange(this.layout(), window, (option) => option === undefined);
    const filter = this.lazyFilterText();
    const size = Math.max(1, this.virtualItemSize());
    const page = Math.ceil((this.listHeight() || VIRTUAL_FALLBACK_HEIGHT) / size) + VIRTUAL_BUFFER;
    untracked(() => {
      const event = this.lazyRequests.next(range, filter, page);
      if (event) this.lazyLoad.emit(event);
    });
  }

  protected onListScroll(event: Event): void {
    if (!this.virtualScroll()) return;
    const list = event.target as HTMLElement;
    this.measureLoadingRow(list);
    this.listScrollTop.set(list.scrollTop);
    this.listHeight.set(list.clientHeight);
  }

  /** Reads the height of the loading row, which is the first line of the list while it shows. */
  private measureLoadingRow(list: HTMLElement): void {
    if (!this.virtualScroll() || !this.loadingRow()) return;
    const row = list.querySelector<HTMLElement>(':scope > .star-listbox__empty');
    if (row?.offsetHeight) this.loadingRowHeight.set(row.offsetHeight);
  }

  /** True while focus is on an element in the panel header or footer. */
  protected readonly panelFocused = signal(false);

  /**
   * `aria-activedescendant` only names an option that is in the DOM. While focus is in the panel
   * header or footer, it names nothing: the combobox does not have focus then. The active option
   * stays, and comes back when focus returns to the combobox.
   */
  protected readonly activeId = computed(() => {
    const index = this.activeIndex();
    if (!this.open() || index < 0 || this.panelFocused()) return null;
    if (this.isAddRow(index)) return this.addRowId;
    const row = this.layout().rowOfOption[index];
    return row !== undefined && starListRowRendered(row, this.virtualWindow())
      ? this.optionId(index)
      : null;
  });

  // ---- The "Add …" row (allowCustomValues) ----

  /**
   * Text of the row that adds the typed text as a new value, or `null` for no row. The row is the
   * last one of the list, after the options; its index is `visibleOptions().length`. Multi-select
   * and the multiple autocomplete show it with `allowCustomValues`.
   */
  protected customRowText(): string | null {
    return null;
  }

  /** Adds the text of the "Add …" row as a value. */
  protected addCustom(_text: string): void {
    // Controls without the row add nothing.
  }

  protected readonly customRow = computed(() => this.customRowText());
  protected readonly addRowId = `${this.listId}-add`;

  /** True when `index` is the "Add …" row. */
  protected isAddRow(index: number): boolean {
    return this.customRow() !== null && index === this.visibleOptions().length;
  }

  /** Options plus the "Add …" row: the rows the keyboard moves over. */
  private optionCount(): number {
    return this.visibleOptions().length + (this.customRow() === null ? 0 : 1);
  }

  /** The heading of the group, only while its row is in the DOM (the id must exist). */
  protected describedBy(row: Extract<StarListRow<TOption>, { kind: 'option' }>): string | null {
    return row.groupId !== null && starListRowRendered(row.groupRow, this.virtualWindow())
      ? row.groupId
      : null;
  }

  /** Number of visible options in each group, by group label. */
  private readonly groupCounts = computed(() => {
    const counts = new Map<string, number>();
    if (!this.optionGroup()) return counts;
    for (const option of this.visibleOptions()) {
      const group = this.groupOf(option);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return counts;
  });

  protected groupContext(label: string): StarGroupContext {
    return { $implicit: label, count: this.groupCounts().get(label) ?? 0 };
  }

  protected emptyContext(): StarEmptyContext {
    return { $implicit: this.filterValue() };
  }

  protected iconSlot(name: StarIconSlotName): TemplateRef<object> | null {
    return this.iconSlots().get(name) ?? null;
  }

  protected readonly emptyText = computed(() =>
    this.filterValue()
      ? this.text.emptyFilterMessage
      : (this.emptyMessage() ?? this.text.emptyMessage),
  );

  private typeahead = '';
  private typeaheadTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.typeaheadTimer));
    effect(() => this.requestLazyRows());
  }

  /**
   * Links the control to a parent `star-field` (call it in the constructor of the subclass). A
   * trigger that is not labelable passes `focus` (see `StarField.linkControl`).
   */
  protected linkField(focus?: () => void): void {
    const parent = this.parentField;
    this.field = parent?.linkControl(this.inputId, focus, this.destroyRef) ? parent : null;
  }

  /** True when the option is part of the current value. */
  protected abstract isSelected(option: TOption): boolean;
  /** Applies the user's choice of an option. */
  protected abstract choose(option: TOption): void;
  /** Index to highlight when the panel opens. */
  protected abstract initialActiveIndex(): number;
  /** Whether choosing an option closes the panel. */
  protected abstract readonly closeOnChoose: boolean;

  labelOf(option: TOption): string {
    return optionText(option, this.optionLabel() ?? null);
  }

  protected groupOf(option: TOption): string {
    const key = this.optionGroup();
    const group = key ? readOption(option, key) : null;
    return group === null || group === undefined ? '' : String(group);
  }

  protected valueOf(option: TOption): TValue {
    return readOption(option, this.optionValue()) as TValue;
  }

  /** Disabled options, and options that are not loaded yet (`lazy`), cannot be chosen. */
  protected isDisabled(option: TOption): boolean {
    if (option === undefined) return true;
    const key = this.optionDisabled();
    return key ? !!readOption(option, key) : false;
  }

  protected equals(a: TValue, b: TValue): boolean {
    return this.compareWith()(a, b);
  }

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  protected optionContext(option: TOption, index: number): StarOptionContext<TOption> {
    return { $implicit: option, selected: this.isSelected(option), index };
  }

  openPanel(): void {
    if (!this.interactive() || this.open()) return;
    this.open.set(true);
    this.activeIndex.set(this.initialActiveIndex());
    this.opened.emit();
  }

  closePanel(focusTrigger = true): void {
    if (!this.open()) return;
    this.open.set(false);
    this.activeIndex.set(-1);
    this.panelFocused.set(false);
    this.listScrollTop.set(0);
    if (this.filterValue() && this.resetFilterOnHide()) {
      this.filterValue.set('');
      this.filterChange.emit('');
    }
    if (focusTrigger) this.trigger().nativeElement.focus();
    this.closed.emit();
  }

  protected toggle(): void {
    if (this.open()) this.closePanel();
    else this.openPanel();
  }

  focus(options?: FocusOptions): void {
    this.trigger().nativeElement.focus(options);
  }

  protected onPanelAttached(): void {
    this.filterInput()?.nativeElement.focus();
    // The window needs the real list height before the first scroll event.
    const height = this.listElement()?.clientHeight;
    if (this.virtualScroll() && height) this.listHeight.set(height);
    this.scrollActiveIntoView();
    // The panel may attach before its list is drawn: the list is there after the next render.
    if (this.virtualScroll()) {
      afterNextRender(
        () => {
          const list = this.listElement();
          if (list?.clientHeight) this.listHeight.set(list.clientHeight);
          this.scrollActiveIntoView();
        },
        { injector: this.injector },
      );
    }
  }

  protected onOutsideClick(event: MouseEvent): void {
    // Clicks on the trigger are handled by its own (click) toggle.
    if (this.trigger().nativeElement.contains(event.target as Node)) return;
    // Focus that left the panel for an element outside has closed it already.
    if (!this.open()) return;
    this.dismiss();
  }

  /** Closes the panel because the user left the control. Emits `touch`. */
  protected dismiss(): void {
    this.closePanel(false);
    this.touch.emit();
  }

  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The panel element. The overlay renders it, so it is found by the id of its list. */
  private panelElement(): HTMLElement | null {
    return this.listElement()?.closest<HTMLElement>('.star-panel') ?? null;
  }

  /**
   * Elements of the panel header and footer that Tab reaches, in DOM order. The filter field,
   * the "select all" box and the options are not in the list: the combobox keys control them.
   */
  protected panelTabStops(): HTMLElement[] {
    const panel = this.panelElement();
    if (!panel) return [];
    return [...panel.querySelectorAll<HTMLElement>(PANEL_FOCUSABLE)].filter(
      (element) =>
        element.tabIndex >= 0 &&
        !(element as HTMLButtonElement).disabled &&
        !element.closest(PANEL_OWN_PARTS) &&
        !element.closest('[hidden], [inert]') &&
        element.checkVisibility?.({ visibilityProperty: true }) !== false,
    );
  }

  /** Element that has focus for the combobox keys: the filter field when it shows, else the trigger. */
  private comboboxElement(): HTMLElement {
    const filter = this.filterInput()?.nativeElement;
    return filter?.isConnected ? filter : this.trigger().nativeElement;
  }

  /**
   * Leaves the control with Tab or Shift+Tab: focus goes to the trigger and the panel closes. The
   * key is not cancelled, so the browser then moves focus from the trigger to the next (or the
   * previous) element of the page. The panel hides at once, because the browser must not move
   * focus into it while it is still in the DOM.
   */
  private leaveByTab(): void {
    this.trigger().nativeElement.focus();
    const panel = this.panelElement();
    if (panel) panel.style.display = 'none';
    this.closePanel(false);
  }

  /**
   * Keeps focus on the trigger (or filter) while the user clicks the options or empty parts of
   * the panel. A press on a focusable element in the header or footer (a button, link or field)
   * is not cancelled, so that element gets focus.
   */
  protected onPanelMousedown(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) return;
    const focusable = target instanceof Element ? target.closest(PANEL_FOCUSABLE) : null;
    if (
      focusable &&
      (event.currentTarget as Element).contains(focusable) &&
      !focusable.closest(PANEL_OWN_PARTS)
    ) {
      return;
    }
    event.preventDefault();
  }

  /** Keys on the elements of the panel header and footer (the filter field has its own). */
  protected onPanelKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (event.defaultPrevented || target === this.filterInput()?.nativeElement) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      // The overlay must not see the key: it would close the panel without focus on the trigger.
      event.stopPropagation();
      this.closePanel();
      return;
    }
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
    const stops = this.panelTabStops();
    const index = stops.indexOf(target);
    if (index < 0) return;
    if (event.shiftKey) {
      event.preventDefault();
      (index > 0 ? stops[index - 1] : this.comboboxElement()).focus();
    } else if (index < stops.length - 1) {
      event.preventDefault();
      stops[index + 1].focus();
    } else {
      this.leaveByTab();
    }
  }

  protected onPanelFocusin(event: FocusEvent): void {
    this.panelFocused.set(event.target !== this.filterInput()?.nativeElement);
  }

  /** Focus that leaves the panel and the control closes the panel, as a click outside does. */
  protected onPanelFocusout(event: FocusEvent): void {
    const next = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    const panel = event.currentTarget as HTMLElement;
    if (next && panel.contains(next) && next !== this.filterInput()?.nativeElement) return;
    this.panelFocused.set(false);
    // No next element: the window lost focus, or the user clicked an empty part of the page
    // (the outside click closes the panel then).
    if (!next || !this.open() || panel.contains(next)) return;
    if (this.hostElement.nativeElement.contains(next)) return;
    this.dismiss();
  }

  protected onTriggerBlur(): void {
    if (!this.open()) this.touch.emit();
  }

  protected onFilterInput(value: string): void {
    this.filterValue.set(value);
    this.filterChange.emit(value);
    this.resetScroll();
    this.activeIndex.set(this.firstEnabledFrom(0, 1));
  }

  /** Empties the filter text, in the signal and in the field. */
  protected clearFilterText(): void {
    this.onFilterInput('');
    const field = this.filterInput()?.nativeElement;
    if (field) field.value = '';
  }

  /**
   * Shows the list from its top. The window and the scroll position of the element change
   * together: a new list that is still long would else keep the old position of the element
   * while the window draws its first lines.
   */
  protected resetScroll(): void {
    this.listScrollTop.set(0);
    const list = this.listElement();
    if (list) list.scrollTop = 0;
  }

  /** Pointer over an option (or the "Add …" row): it becomes active with `focusOnHover`. */
  protected onOptionHover(index: number): void {
    if (!this.focusOnHover()) return;
    const option = this.visibleOptions()[index];
    if (this.isAddRow(index) || (option !== undefined && !this.isDisabled(option))) {
      this.activeIndex.set(index);
    }
  }

  /** With `selectOnFocus`: chooses the active option after a key moved it (single choice only). */
  private selectActiveOnFocus(): void {
    if (!this.selectOnFocus() || !this.closeOnChoose || !this.open()) return;
    const option = this.visibleOptions()[this.activeIndex()];
    if (option !== undefined && !this.isDisabled(option)) this.choose(option);
  }

  protected onOptionClick(option: TOption, index: number): void {
    if (this.isDisabled(option)) return;
    this.activeIndex.set(index);
    this.choose(option);
    if (this.closeOnChoose) this.closePanel();
  }

  /** Keyboard model for both the trigger and the filter input. */
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.interactive()) return;
    const open = this.open();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) {
          this.openPanel();
          return;
        }
        const step = event.key === 'ArrowDown' ? 1 : -1;
        if (event.altKey && step === -1) {
          this.chooseActive();
          this.closePanel();
          return;
        }
        this.moveActive(step);
        return;
      }
      case 'Home':
      case 'End':
        if (!open) return;
        event.preventDefault();
        this.activeIndex.set(
          event.key === 'Home'
            ? this.firstEnabledFrom(0, 1)
            : this.firstEnabledFrom(this.optionCount() - 1, -1),
        );
        this.scrollActiveIntoView();
        this.selectActiveOnFocus();
        return;
      case 'PageDown':
      case 'PageUp':
        // Without `virtualScroll` the list is short enough to scroll by arrow keys.
        if (!open || !this.virtualScroll()) return;
        event.preventDefault();
        this.movePage(event.key === 'PageDown' ? 1 : -1);
        return;
      case 'Enter':
        event.preventDefault();
        if (!open) this.openPanel();
        else this.chooseActive(this.closeOnChoose);
        return;
      case ' ':
        // Space types into the filter field.
        if (event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        // While the user types ahead, Space is part of the text ("Order 5000").
        if (this.typeahead) {
          this.runTypeahead(' ');
          return;
        }
        if (!open) this.openPanel();
        else this.chooseActive(this.closeOnChoose);
        return;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          this.closePanel();
        }
        return;
      case 'Tab': {
        if (!open) return;
        // Panel header and footer with buttons or links: Tab moves into them (PrimeNG model).
        const stops = this.panelTabStops();
        if (stops.length && !event.shiftKey) {
          event.preventDefault();
          stops[0].focus();
        } else if (stops.length && event.target !== this.trigger().nativeElement) {
          // Shift+Tab from the filter field: the header is before it in the DOM, so leave by script.
          this.leaveByTab();
        } else {
          this.closePanel(false);
        }
        return;
      }
      default:
        if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !(event.target instanceof HTMLInputElement)
        ) {
          this.runTypeahead(event.key);
        }
    }
  }

  private chooseActive(thenClose = false): void {
    const text = this.customRow();
    if (text !== null && this.isAddRow(this.activeIndex())) {
      this.addCustom(text);
      return;
    }
    const option = this.visibleOptions()[this.activeIndex()];
    if (option === undefined || this.isDisabled(option)) return;
    this.choose(option);
    if (thenClose) this.closePanel();
  }

  private moveActive(step: 1 | -1): void {
    const count = this.optionCount();
    if (!count) return;
    const start = this.activeIndex() < 0 ? (step === 1 ? 0 : count - 1) : this.activeIndex() + step;
    const next = this.firstEnabledFrom(Math.min(Math.max(start, 0), count - 1), step);
    if (next >= 0) this.activeIndex.set(next);
    this.scrollActiveIntoView();
    this.selectActiveOnFocus();
  }

  /** Page up / Page down: moves the active option by the lines in view, over all options. */
  private movePage(step: 1 | -1): void {
    const count = this.visibleOptions().length;
    const height = this.listElement()?.clientHeight || VIRTUAL_FALLBACK_HEIGHT;
    const target = starListKeyboardTarget(
      step === 1 ? 'PageDown' : 'PageUp',
      this.activeIndex(),
      count,
      starListPageSize(height, this.virtualItemSize()),
    );
    // A disabled option is skipped, in the direction of the key and then back.
    const next = this.firstEnabledFrom(target, step);
    const found = next >= 0 ? next : this.firstEnabledFrom(target, step === 1 ? -1 : 1);
    if (found >= 0) this.activeIndex.set(found);
    this.scrollActiveIntoView();
    this.selectActiveOnFocus();
  }

  protected firstEnabledFrom(start: number, step: 1 | -1): number {
    const options = this.visibleOptions();
    const count = this.optionCount();
    for (let i = start; i >= 0 && i < count; i += step) {
      if (i === options.length || !this.isDisabled(options[i])) return i;
    }
    return -1;
  }

  /** Type a letter to jump to the next option whose label starts with the typed text. */
  private runTypeahead(char: string): void {
    clearTimeout(this.typeaheadTimer);
    this.typeahead += char.toLocaleLowerCase();
    this.typeaheadTimer = setTimeout(() => (this.typeahead = ''), 500);
    const options = this.visibleOptions();
    const start = Math.max(this.activeIndex(), 0);
    const ordered = [...options.keys()].map(
      (i) => (start + (this.typeahead.length === 1 ? 1 : 0) + i) % options.length,
    );
    const match = ordered.find(
      (i) =>
        !this.isDisabled(options[i]) &&
        this.labelOf(options[i]).toLocaleLowerCase().startsWith(this.typeahead),
    );
    if (match === undefined) return;
    this.activeIndex.set(match);
    if (!this.open() && this.closeOnChoose) this.choose(options[match]);
    this.scrollActiveIntoView();
  }

  /** The list element in the panel (the panel is outside the host, in the overlay). */
  private listElement(): HTMLElement | null {
    return this.document.getElementById(this.listId);
  }

  /**
   * Moves the list element to the offset of the window. A list that has just opened may not be
   * able to take it yet: it may be too short until its window is drawn, or not laid out until
   * the popover shows. The browser then keeps the old offset and sends no scroll event, so the
   * window would draw lines that the element does not show. Try again for some frames, until the
   * element is there or the user scrolls.
   */
  private applyScroll(list: HTMLElement, offset: number, frames: number): void {
    if (!list.isConnected || this.listScrollTop() !== offset) return;
    list.scrollTop = offset;
    if (frames > 0 && Math.abs(list.scrollTop - offset) > 1) {
      this.document.defaultView?.requestAnimationFrame?.(() =>
        this.applyScroll(list, offset, frames - 1),
      );
    }
  }

  private scrollActiveIntoView(): void {
    if (!this.open() || this.activeIndex() < 0) return;
    if (this.virtualScroll() && !this.isAddRow(this.activeIndex())) {
      // The active line may not be rendered yet: move the list so its position is in view.
      const list = this.listElement();
      const layout = this.layout();
      if (!list || layout.rowOfOption[this.activeIndex()] === undefined) return;
      const height = list.clientHeight || VIRTUAL_FALLBACK_HEIGHT;
      this.measureLoadingRow(list);
      // The lines start below the padding of the list and the loading row: without them the last
      // line is cut off.
      const inset = (parseFloat(getComputedStyle(list).paddingTop) || 0) + this.leadHeight();
      const [first, last] = starListRevealRows(layout, this.activeIndex());
      const offset = starListRevealOffset(
        first,
        last,
        Math.max(1, this.virtualItemSize()),
        // The element knows where it is. The window can be ahead of it for a moment.
        list.clientHeight ? list.scrollTop : this.listScrollTop(),
        height,
        inset,
      );
      this.listHeight.set(height);
      if (offset === null) return;
      this.listScrollTop.set(offset);
      queueMicrotask(() => this.applyScroll(list, offset, 12));
      return;
    }
    const id = this.activeId();
    if (!id) return;
    queueMicrotask(() => this.document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' }));
  }
}
