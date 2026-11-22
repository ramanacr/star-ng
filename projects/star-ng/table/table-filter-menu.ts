import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import {
  STAR_UI_TEXT,
  starFilterMatch,
  StarFilterService,
  StarStyled,
  StarUiText,
  ɵSTAR_PART_HOST,
  ɵStarItemKeys,
} from '@star-ng/ui/core';
import { StarPopover } from '@star-ng/ui/popover';
import {
  hasBound,
  isRange,
  STAR_TABLE_MATCH_MODES,
  StarColumnFilterType,
  StarFilterRule,
  StarFilterRuleValue,
  StarFilterValue,
  starIsActiveFilter,
  starIsFilterConstraint,
  StarTableMatchMode,
} from './table-filter';

/** Most choices that a check list draws (a column with more values needs the search). */
const MAX_CHOICES = 1000;

/** UI text of each built-in match mode. */
const MODE_TEXT: Readonly<Record<string, keyof StarUiText>> = {
  contains: 'matchContains',
  startsWith: 'matchStartsWith',
  endsWith: 'matchEndsWith',
  equals: 'matchEquals',
  notContains: 'matchNotContains',
  notEquals: 'matchNotEquals',
  lt: 'matchLt',
  lte: 'matchLte',
  gt: 'matchGt',
  gte: 'matchGte',
  between: 'matchBetween',
  dateIs: 'matchDateIs',
  dateIsNot: 'matchDateIsNot',
  dateBefore: 'matchDateBefore',
  dateAfter: 'matchDateAfter',
  in: 'matchIn',
};

/**
 * Filter menu of a `star-table` column (PrimeNG `p-columnFilter` with `display="menu"`). The
 * table renders it in the header cell when `filterDisplay` is `'menu'`. A button with
 * `aria-haspopup="dialog"` opens a labelled dialog (focus trap, focus goes back to the button)
 * with the match mode, the value field(s) of the filter type, "Match all" / "Match any", "Add
 * rule", Clear and Apply.
 */
@Component({
  selector: 'star-table-filter-menu',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarButton, StarPopover, CdkTrapFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-table-filter-menu' },
  template: `
    <button
      data-star-part="filterButton"
      type="button"
      class="star-table__filter-button"
      [class.star-table__filter-button--active]="active()"
      aria-haspopup="dialog"
      [attr.aria-expanded]="panel.visible()"
      [attr.aria-label]="active() ? text.filterMenuActive(header()) : text.filterMenu(header())"
      (click)="toggle($event)"
    >
      <i
        data-star-part="filterIcon"
        [class]="active() ? 'ph-fill ph-funnel' : 'ph-bold ph-funnel'"
        aria-hidden="true"
      ></i>
    </button>
    <star-popover #panel [ariaLabel]="text.filterMenu(header())">
      <div data-star-part="filterPanel" class="star-table-filter" cdkTrapFocus>
        @if (draft().length > 1) {
          <select
            data-star-part="operatorInput"
            class="star-input star-input--sm star-table-filter__operator"
            [attr.aria-label]="text.filterOperator"
            (change)="setOperator($any($event.target).value)"
          >
            <option data-star-part="matchAllOption" value="and" [selected]="operator() === 'and'">
              {{ text.matchAll }}
            </option>
            <option data-star-part="matchAnyOption" value="or" [selected]="operator() === 'or'">
              {{ text.matchAny }}
            </option>
          </select>
        }
        @for (rule of draft(); track ruleKeys.keyOf(rule); let i = $index) {
          <fieldset data-star-part="rulePanel" class="star-table-filter__rule">
            <legend class="star-sr-only">{{ text.filterRule(i + 1) }}</legend>
            @if (showModes()) {
              <select
                data-star-part="input"
                class="star-input star-input--sm"
                [attr.aria-label]="text.matchMode"
                (change)="setMode(i, $any($event.target).value)"
              >
                @for (mode of modes(); track mode) {
                  <option
                    data-star-part="valueOption"
                    [value]="mode"
                    [selected]="mode === rule.matchMode"
                  >
                    {{ modeLabel(mode) }}
                  </option>
                }
              </select>
            }
            @if (type() === 'select') {
              <select
                data-star-part="input"
                class="star-input star-input--sm"
                [attr.aria-label]="text.filterBy(header())"
                (change)="setValue(i, $any($event.target).value)"
              >
                <option data-star-part="filterAllOption" value="" [selected]="!rule.value">
                  {{ text.filterAll }}
                </option>
                @for (choice of choices(); track choice) {
                  <option
                    data-star-part="valueOption"
                    [value]="choice"
                    [selected]="choice === rule.value"
                  >
                    {{ choice }}
                  </option>
                }
              </select>
            } @else if (type() === 'multiselect') {
              @if (checklist()) {
                <input
                  data-star-part="valueSearchInput"
                  type="search"
                  class="star-input star-input--sm"
                  [attr.aria-label]="text.filterPlaceholder"
                  [attr.placeholder]="text.filterPlaceholder"
                  [value]="search()"
                  (input)="search.set($any($event.target).value)"
                />
                <div data-star-part="checklistButtonsPanel" class="star-table-filter__list-buttons">
                  <star-button
                    data-star-part="selectAllButton"
                    size="sm"
                    variant="ghost"
                    (pressed)="setShownChoices(i, true)"
                  >
                    {{ text.selectAll }}
                  </star-button>
                  <star-button
                    data-star-part="clearAllButton"
                    size="sm"
                    variant="ghost"
                    (pressed)="setShownChoices(i, false)"
                  >
                    {{ text.clear }}
                  </star-button>
                </div>
              }
              <div
                data-star-part="choicesPanel"
                class="star-table-filter__choices"
                role="group"
                [attr.aria-label]="text.filterBy(header())"
              >
                @for (choice of renderedChoices(); track choice) {
                  <label data-star-part="choiceLabel" class="star-table-filter__choice">
                    <input
                      data-star-part="choiceInput"
                      type="checkbox"
                      [checked]="listOf(rule).includes(choice)"
                      (change)="toggleChoice(i, choice, $any($event.target).checked)"
                    />
                    {{ choice }}
                  </label>
                }
              </div>
              @if (shownChoices().length > renderedChoices().length) {
                <p data-star-part="moreText" class="star-table-filter__more" aria-live="polite">
                  {{ text.moreChoices(renderedChoices().length, shownChoices().length) }}
                </p>
              }
            } @else if (rule.matchMode === 'between') {
              <span data-star-part="rangePanel" class="star-table-filter__range">
                <input
                  data-star-part="input"
                  class="star-input star-input--sm"
                  [type]="inputType()"
                  [attr.aria-label]="text.filterMin(header())"
                  [value]="boundOf(rule, 'min')"
                  (input)="setBound(i, 'min', $any($event.target).value)"
                />
                <input
                  data-star-part="input"
                  class="star-input star-input--sm"
                  [type]="inputType()"
                  [attr.aria-label]="text.filterMax(header())"
                  [value]="boundOf(rule, 'max')"
                  (input)="setBound(i, 'max', $any($event.target).value)"
                />
              </span>
            } @else {
              <input
                data-star-part="input"
                class="star-input star-input--sm"
                [type]="inputType()"
                [attr.aria-label]="text.filterBy(header())"
                [value]="textOf(rule)"
                (input)="setValue(i, $any($event.target).value)"
                (keydown.enter)="apply($event)"
              />
            }
            @if (draft().length > 1) {
              <button
                data-star-part="removeButton"
                type="button"
                class="star-table__toggle"
                [attr.aria-label]="text.removeRule(i + 1)"
                (click)="removeRule(i)"
              >
                <i data-star-part="removeIcon" class="ph-bold ph-trash" aria-hidden="true"></i>
              </button>
            }
          </fieldset>
        }
        @if (canAdd()) {
          <star-button
            class="star-table-filter__add"
            size="sm"
            variant="ghost"
            leadingIcon="ph-bold ph-plus"
            (pressed)="addRule()"
          >
            {{ text.addRule }}
          </star-button>
        }
        <div data-star-part="buttonsPanel" class="star-table-filter__buttons">
          <star-button size="sm" variant="secondary" (pressed)="clear()">
            {{ text.clear }}
          </star-button>
          @if (showApply()) {
            <star-button size="sm" (pressed)="apply()">{{ text.apply }}</star-button>
          }
        </div>
      </div>
    </star-popover>
  `,
})
export class StarTableFilterMenu {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly service = inject(StarFilterService);

  /** Column header text, for the names of the button and the dialog. */
  readonly header = input.required<string>();
  readonly type = input.required<StarColumnFilterType>();
  /** The current filter value of the column. */
  readonly value = input<StarFilterValue | undefined>(undefined);
  /** Match modes to offer (default: the modes of the type). */
  readonly matchModes = input<readonly StarTableMatchMode[]>([]);
  /** Mode of a new rule (default: the first of `modes`). */
  readonly defaultMode = input<StarTableMatchMode | null>(null);
  /** Choices of a `'select'` or `'multiselect'` filter. */
  readonly choices = input<readonly string[]>([]);
  /** Most rules that "Add rule" allows (PrimeNG `maxConstraints`). */
  readonly maxRules = input(2);
  /**
   * Excel-style list of a `'multiselect'` filter: a search box that narrows the choices (case- and
   * accent-insensitive `contains`, or a `contains` mode of `StarFilterService`), Select all and
   * Clear (of the shown choices).
   */
  readonly checklist = input(false, { transform: booleanAttribute });
  /** Apply button; without it every change applies at once (PrimeNG `showApplyButton`). */
  readonly showApply = input(true, { transform: booleanAttribute });

  /** The new filter value; `null` removes the filter. */
  readonly filterChange = output<StarFilterValue | null>();

  protected readonly panel = viewChild.required<StarPopover>('panel');
  protected readonly draft = signal<readonly StarFilterRule[]>([]);
  /** `@for` keys of the rules: an edited rule keeps its row (and the focus in it). */
  protected readonly ruleKeys = new ɵStarItemKeys();
  protected readonly operator = signal<'and' | 'or'>('and');

  protected readonly active = computed(() => starIsActiveFilter(this.value()));
  /** Search text of the check list. */
  protected readonly search = signal('');
  /** The choices that match the search text. */
  protected readonly shownChoices = computed(() => {
    const query = this.search().trim();
    const choices = this.choices();
    if (!this.checklist() || !query) return choices;
    // A `contains` mode registered with `StarFilterService` wins over the built-in match.
    const own = this.service.get('contains')?.fn;
    return choices.filter((choice) =>
      own ? own(choice, query, null) : starFilterMatch(choice, query, 'contains'),
    );
  });
  protected readonly inputType = computed(() =>
    this.type() === 'number' ? 'number' : this.type() === 'date' ? 'date' : 'text',
  );
  protected readonly canAdd = computed(() => {
    const type = this.type();
    return type !== 'select' && type !== 'multiselect' && this.draft().length < this.maxRules();
  });
  protected readonly modes = computed(() => {
    const modes = this.matchModes().length
      ? this.matchModes()
      : STAR_TABLE_MATCH_MODES[this.type()];
    // A range value (old shape, or set by the owner) needs `between` in the list.
    const range = this.draft().some((rule) => rule.matchMode === 'between');
    return range && !modes.includes('between') ? [...modes, 'between'] : modes;
  });
  /** Choice columns match by `in` only: no match mode select. */
  protected readonly showModes = computed(() => {
    const type = this.type();
    return type !== 'select' && type !== 'multiselect' && this.modes().length > 1;
  });
  private readonly firstMode = computed(() => this.defaultMode() ?? this.modes()[0]);

  constructor() {
    // A rule added or removed changes the height: place the menu again, so it stays in view.
    afterRenderEffect(() => {
      const rules = this.draft().length;
      untracked(() => {
        if (rules && this.panel().visible()) this.panel().align();
      });
    });
  }

  protected toggle(event: Event): void {
    if (!this.panel().visible()) this.load();
    this.panel().toggle(event);
  }

  /** Copies the current value into the draft rules of the menu. */
  /** The choices that the list draws: at most `MAX_CHOICES`; the search finds the others. */
  protected readonly renderedChoices = computed(() => {
    const shown = this.shownChoices();
    return shown.length > MAX_CHOICES ? shown.slice(0, MAX_CHOICES) : shown;
  });

  private load(): void {
    this.search.set('');
    const value = this.value();
    const mode = this.firstMode();
    this.operator.set('and');
    if (starIsFilterConstraint(value)) {
      this.operator.set(value.operator);
      this.draft.set(value.rules.length ? value.rules : [{ matchMode: mode, value: null }]);
    } else if (Array.isArray(value)) {
      this.draft.set([{ matchMode: 'in', value }]);
    } else if (isRange(value)) {
      this.draft.set([{ matchMode: 'between', value }]);
    } else {
      this.draft.set([{ matchMode: mode, value: (value as string | undefined) || null }]);
    }
  }

  protected modeLabel(mode: StarTableMatchMode): string {
    const key = MODE_TEXT[mode];
    if (key) return this.text[key] as string;
    return this.service.get(mode)?.label ?? mode;
  }

  protected textOf(rule: StarFilterRule): string {
    const value = rule.value;
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  }

  protected listOf(rule: StarFilterRule): readonly string[] {
    return Array.isArray(rule.value) ? rule.value : [];
  }

  protected boundOf(rule: StarFilterRule, bound: 'min' | 'max'): string {
    const side = isRange(rule.value) ? rule.value[bound] : null;
    return hasBound(side) ? String(side) : '';
  }

  private update(index: number, change: (rule: StarFilterRule) => StarFilterRule): void {
    this.draft.update((rules) =>
      rules.map((rule, i) => (i === index ? this.ruleKeys.carry(rule, change(rule)) : rule)),
    );
    if (!this.showApply()) this.emit();
  }

  protected setOperator(operator: 'and' | 'or'): void {
    this.operator.set(operator);
    if (!this.showApply()) this.emit();
  }

  protected setMode(index: number, matchMode: StarTableMatchMode): void {
    // A range and a single value do not convert: the value starts empty.
    this.update(index, (rule) => ({
      matchMode,
      value: (matchMode === 'between') === isRange(rule.value) ? rule.value : null,
    }));
  }

  protected setValue(index: number, text: string): void {
    const value: StarFilterRuleValue =
      text === '' ? null : this.type() === 'number' ? Number(text) : text;
    this.update(index, (rule) => ({ ...rule, value }));
  }

  protected setBound(index: number, bound: 'min' | 'max', text: string): void {
    const side = text === '' ? null : this.type() === 'number' ? Number(text) : text;
    this.update(index, (rule) => ({
      ...rule,
      value: { ...(isRange(rule.value) ? rule.value : {}), [bound]: side },
    }));
  }

  protected toggleChoice(index: number, choice: string, checked: boolean): void {
    this.update(index, (rule) => {
      const list = this.listOf(rule).filter((item) => item !== choice);
      return { ...rule, value: checked ? [...list, choice] : list };
    });
  }

  /** Select all (`true`) or Clear (`false`) for the choices that the search shows. */
  protected setShownChoices(index: number, checked: boolean): void {
    const shown = this.shownChoices();
    this.update(index, (rule) => {
      const list = this.listOf(rule).filter((item) => !shown.includes(item));
      return { ...rule, value: checked ? [...list, ...shown] : list };
    });
  }

  protected addRule(): void {
    this.draft.update((rules) => [...rules, { matchMode: this.firstMode(), value: null }]);
  }

  protected removeRule(index: number): void {
    this.draft.update((rules) => rules.filter((_, i) => i !== index));
    if (!this.showApply()) this.emit();
  }

  /** The draft as a filter value: the old shapes for choice lists, else rules. */
  private result(): StarFilterValue | null {
    const rules = this.draft();
    const type = this.type();
    if (type === 'select') return (rules[0]?.value as string | null) || null;
    if (type === 'multiselect') return this.listOf(rules[0] ?? { matchMode: 'in', value: [] });
    const value = { operator: this.operator(), rules };
    return starIsActiveFilter(value) ? value : null;
  }

  private emit(): void {
    this.filterChange.emit(this.result());
  }

  /** Applies the rules and closes the menu (focus goes back to the button). */
  protected apply(event?: Event): void {
    // Enter: the focus moves to the filter button now, and the key must not press that button.
    event?.preventDefault();
    this.emit();
    this.panel().hide();
  }

  /** Removes the filter and closes the menu. */
  protected clear(): void {
    this.draft.set([{ matchMode: this.firstMode(), value: null }]);
    this.operator.set('and');
    this.filterChange.emit(null);
    this.panel().hide();
  }
}
