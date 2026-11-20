import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { STAR_UI_TEXT, StarAnnouncer, StarPart } from '@star-ng/ui/core';
import { StarMenu, StarMenuItem, StarMenuTrigger } from '@star-ng/ui/menu';
import {
  StarPivotAggregate,
  StarPivotConfig,
  StarPivotFilter,
  StarPivotMember,
  starPivotMembers,
} from './engine';
import { StarPivotFilterButton } from './pivot-filter';
import { StarPivotArea, starPivotAreas, StarPivotField, starPivotMoveField } from './pivot-layout';

/** A list of the configurator: the unused fields or an area. */
type ListName = 'fields' | StarPivotArea;
const LISTS: readonly ListName[] = ['fields', 'rows', 'columns', 'values', 'filters'];
const AGGREGATES: readonly StarPivotAggregate[] = [
  'sum',
  'count',
  'avg',
  'min',
  'max',
  'distinctCount',
];

/**
 * The configurator of `star-pivot-grid`: the unused fields and the Rows, Columns, Values and
 * Filters areas. Fields move by drag and drop (CDK) or with the move menu of each field (the
 * keyboard way); a move is announced. Value fields have an aggregate select, dimension and filter
 * fields a member filter. Internal part of `star-pivot-grid`.
 *
 * @internal
 */
@Component({
  selector: 'star-pivot-configurator',
  imports: [
    StarPart,
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    StarMenu,
    StarMenuTrigger,
    StarPivotFilterButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-pivot-config' },
  template: `
    <section
      starPart="panel"
      class="star-pivot-config__panel"
      [attr.aria-label]="text.pivotSettings"
      cdkDropListGroup
    >
      @for (list of lists; track list) {
        <div
          starPart="area"
          class="star-pivot-config__area"
          [class]="'star-pivot-config__area--' + list"
        >
          <span starPart="title" class="star-pivot-config__title" [id]="id + '-' + list">{{
            listLabel(list)
          }}</span>
          <ul
            starPart="list"
            class="star-pivot-config__list"
            cdkDropList
            [cdkDropListData]="list"
            [attr.aria-labelledby]="id + '-' + list"
            [attr.data-pivot-area]="list"
            (cdkDropListDropped)="onDrop($event)"
          >
            @for (name of fieldsIn(list); track name) {
              <li
                starPart="field"
                class="star-pivot-config__field"
                cdkDrag
                [cdkDragData]="name"
                [attr.data-pivot-field]="name"
              >
                <i
                  starPart="grip"
                  class="ph-bold ph-dots-six-vertical star-pivot-config__grip"
                  aria-hidden="true"
                ></i>
                <span starPart="label" class="star-pivot-config__label">{{ labelOf(name) }}</span>
                @if (list === 'values' && aggregateOf(name)) {
                  <select
                    starPart="aggregate"
                    class="star-pivot-config__aggregate"
                    [attr.aria-label]="text.pivotAggregate(labelOf(name))"
                    (change)="setAggregate(name, $any($event.target).value)"
                  >
                    @for (aggregate of aggregates; track aggregate) {
                      <option
                        starPart="option"
                        [value]="aggregate"
                        [selected]="aggregateOf(name) === aggregate"
                      >
                        {{ aggregateLabel(aggregate) }}
                      </option>
                    }
                  </select>
                }
                @if (list === 'rows' || list === 'columns' || list === 'filters') {
                  <star-pivot-filter
                    [field]="name"
                    [label]="labelOf(name)"
                    [members]="membersOf(name)"
                    [filter]="filterOf(name)"
                    [locale]="locale()"
                    (filterChange)="setFilter(name, $event)"
                  />
                }
                <button
                  starPart="iconButton"
                  type="button"
                  class="star-pivot__icon-button"
                  [starMenuTrigger]="menu"
                  [attr.aria-label]="text.pivotMoveField(labelOf(name))"
                  [attr.data-pivot-move]="name"
                >
                  <i starPart="icon" class="ph-bold ph-dots-three" aria-hidden="true"></i>
                </button>
                <star-menu
                  #menu
                  [ariaLabel]="text.pivotMoveField(labelOf(name))"
                  [items]="moveMenus().get(name) ?? []"
                />
              </li>
            } @empty {
              <li starPart="empty" class="star-pivot-config__empty">{{ text.pivotDropHere }}</li>
            }
          </ul>
        </div>
      }
    </section>
  `,
})
export class StarPivotConfigurator<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly announcer = inject(StarAnnouncer);
  protected readonly id = inject(_IdGenerator).getId('star-pivot-config-');
  protected readonly lists = LISTS;
  protected readonly aggregates = AGGREGATES;

  readonly config = input.required<StarPivotConfig<T>>();
  readonly fields = input.required<readonly StarPivotField<T>[]>();
  readonly data = input.required<readonly T[]>();
  readonly locale = input<string | undefined>(undefined);
  readonly configChange = output<StarPivotConfig<T>>();

  private readonly areas = computed(() => starPivotAreas(this.config()));
  private readonly byName = computed(
    () => new Map(this.fields().map((field) => [field.field, field] as const)),
  );
  /**
   * Members per field. The map is new when the data, the locale or the fields change; a field's
   * list is built the first time a filter needs it (a memo, not state).
   */
  private readonly members = computed(() => {
    this.data();
    this.locale();
    this.fields();
    // Accessors of the dimensions and values change the lists too.
    this.config();
    return new Map<string, readonly StarPivotMember[]>();
  });

  /** The move menu items of each field, rebuilt only when the areas or the fields change. */
  protected readonly moveMenus = computed(() => {
    const menus = new Map<string, StarMenuItem[]>();
    for (const list of LISTS) {
      const names = this.fieldsIn(list);
      names.forEach((name, index) =>
        menus.set(name, this.moveItems(name, list, index, names.length)),
      );
    }
    return menus;
  });

  /** The value accessor of a field: from `fields`, else from a dimension or value of the config. */
  private valueOf(name: string): ((record: T) => unknown) | undefined {
    const config = this.config();
    return (
      this.byName().get(name)?.value ??
      [...config.rows, ...config.columns, ...config.values].find(
        (item) => item.field === name && item.value,
      )?.value
    );
  }

  protected fieldsIn(list: ListName): readonly string[] {
    if (list !== 'fields') return this.areas()[list];
    const areas = this.areas();
    const used = new Set([...areas.rows, ...areas.columns, ...areas.values, ...areas.filters]);
    return this.fields()
      .map((field) => field.field)
      .filter((field) => !used.has(field));
  }

  protected listLabel(list: ListName): string {
    switch (list) {
      case 'fields':
        return this.text.pivotFields;
      case 'rows':
        return this.text.pivotRows;
      case 'columns':
        return this.text.columns;
      case 'values':
        return this.text.pivotValues;
      default:
        return this.text.pivotFilters;
    }
  }

  protected labelOf(name: string): string {
    return this.byName().get(name)?.label ?? name;
  }

  protected aggregateOf(name: string): StarPivotAggregate | null {
    const aggregate = this.config().values.find((value) => value.field === name)?.aggregate;
    return typeof aggregate === 'function' ? null : (aggregate ?? 'sum');
  }

  protected aggregateLabel(aggregate: StarPivotAggregate): string {
    const text = this.text;
    return {
      sum: text.summarySum,
      count: text.summaryCount,
      avg: text.summaryAverage,
      min: text.summaryMinimum,
      max: text.summaryMaximum,
      distinctCount: text.pivotDistinctCount,
    }[aggregate];
  }

  protected membersOf(name: string): readonly StarPivotMember[] {
    const cache = this.members();
    let found = cache.get(name);
    if (!found) {
      const field = this.byName().get(name);
      found = starPivotMembers(
        this.data(),
        { field: name, format: field?.format, value: this.valueOf(name) },
        { locale: this.locale(), blankLabel: this.text.pivotBlank },
      );
      cache.set(name, found);
    }
    return found;
  }

  protected filterOf(name: string): StarPivotFilter | undefined {
    return this.config().filters?.find((filter) => filter.field === name) as
      StarPivotFilter | undefined;
  }

  private moveItems(name: string, list: ListName, index: number, count: number): StarMenuItem[] {
    const items: StarMenuItem[] = [];
    if (list !== 'fields') {
      items.push(
        {
          label: this.text.moveUp,
          icon: 'ph-bold ph-arrow-up',
          disabled: index === 0,
          command: () => this.move(name, list, index - 1),
        },
        {
          label: this.text.moveDown,
          icon: 'ph-bold ph-arrow-down',
          disabled: index >= count - 1,
          command: () => this.move(name, list, index + 1),
        },
        { separator: true },
      );
    }
    for (const target of LISTS) {
      if (target === list) continue;
      items.push({
        label: this.text.pivotMoveTo(this.listLabel(target)),
        command: () => this.move(name, target),
      });
    }
    return items;
  }

  /** Moves a field to a list (at `index`) and announces it. */
  move(name: string, list: ListName, index?: number): void {
    const field = this.byName().get(name) ?? { field: name };
    const next = starPivotMoveField(this.config(), field, list === 'fields' ? null : list, index);
    this.configChange.emit(next);
    this.announcer.announce(this.text.pivotMoved(this.labelOf(name), this.listLabel(list)));
  }

  protected onDrop(event: CdkDragDrop<ListName, ListName, string>): void {
    const name = event.item.data;
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }
    this.move(name, event.container.data, event.currentIndex);
  }

  protected setAggregate(name: string, aggregate: StarPivotAggregate): void {
    const config = this.config();
    this.configChange.emit({
      ...config,
      values: config.values.map((value) =>
        value.field === name ? { ...value, aggregate } : value,
      ),
    });
  }

  protected setFilter(name: string, filter: StarPivotFilter | null): void {
    const config = this.config();
    const filters = config.filters ?? [];
    const area = this.areas().filters.includes(name);
    const others = filters.filter((item) => item.field !== name);
    const index = filters.findIndex((item) => item.field === name);
    // The filter reads the field as the member list does (its value accessor).
    const value = this.valueOf(name);
    // A field of the Filters area keeps its chip (an entry without members).
    const base: StarPivotFilter<T> | null = filter
      ? { ...(filter as StarPivotFilter<T>) }
      : area
        ? { field: name }
        : null;
    const entry = base && value ? { ...base, value } : base;
    const next = [...others];
    if (entry) next.splice(index < 0 ? next.length : index, 0, entry);
    this.configChange.emit({ ...config, filters: next });
  }
}
