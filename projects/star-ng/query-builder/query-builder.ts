import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  numberAttribute,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { StarButton } from '@star-ng/ui/button';
import { STAR_UI_TEXT, StarFilterService, StarRangeFilter } from '@star-ng/ui/core';
import { StarDatePicker } from '@star-ng/ui/date-picker';
import { StarInput } from '@star-ng/ui/field';
import { StarInputNumber } from '@star-ng/ui/input-number';
import { StarMultiSelect, StarSelect } from '@star-ng/ui/select';
import { StarSelectButton } from '@star-ng/ui/select-button';
import { StarToggleSwitch } from '@star-ng/ui/toggle-switch';
import {
  starIsQueryGroup,
  starQueryEmptyValue,
  StarQueryField,
  StarQueryGroup,
  starQueryModeLabel,
  starQueryModesOf,
  starQueryNewRule,
  StarQueryOption,
  starQueryOptions,
  StarQueryRule,
  starQueryRuleComplete,
  StarQueryRuleValue,
} from './query-model';

/** Context of a custom value editor (`ng-template[starQueryValue]`). */
export interface StarQueryValueContext {
  /** The rule. */
  readonly $implicit: StarQueryRule;
  readonly rule: StarQueryRule;
  readonly field: StarQueryField<never>;
  /** Writes a new value into the rule. */
  readonly setValue: (value: StarQueryRuleValue) => void;
}

/**
 * Custom value editor of `star-query-builder`. Give field keys to use it for those fields only;
 * without a value it serves every field.
 *
 * ```html
 * <ng-template starQueryValue="region" let-rule let-setValue="setValue">…</ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[starQueryValue]' })
export class StarQueryValue {
  readonly template = inject<TemplateRef<StarQueryValueContext>>(TemplateRef);
  /** Field keys that this editor serves; empty for every field. */
  readonly starQueryValue = input<string | readonly string[]>('');

  /** @internal */
  serves(field: string): boolean {
    const keys = this.starQueryValue();
    if (!keys || !keys.length) return true;
    return typeof keys === 'string' ? keys === field : keys.includes(field);
  }

  static ngTemplateContextGuard(
    _dir: StarQueryValue,
    _ctx: unknown,
  ): _ctx is StarQueryValueContext {
    return true;
  }
}

type Editor = 'custom' | 'text' | 'number' | 'date' | 'select' | 'multi' | 'boolean' | 'range';

interface Removed {
  readonly group: string;
  readonly index: number;
  readonly item: StarQueryRule | StarQueryGroup;
  readonly name: string;
}

/** Path of a group: indexes from the root, joined with dots (`''` is the root). */
const childPath = (path: string, index: number) => (path ? `${path}.${index}` : String(index));
const parsePath = (path: string): number[] => (path ? path.split('.').map(Number) : []);

/** A new group with the given rules replaced; other groups keep their identity. */
function updateGroup(
  root: StarQueryGroup,
  path: string,
  change: (group: StarQueryGroup) => StarQueryGroup,
): StarQueryGroup {
  const walk = (group: StarQueryGroup, steps: number[]): StarQueryGroup => {
    if (!steps.length) return change(group);
    const [index, ...rest] = steps;
    const child = group.rules[index];
    if (!child || !starIsQueryGroup(child)) return group;
    const rules = [...group.rules];
    rules[index] = walk(child, rest);
    return { ...group, rules };
  };
  return walk(root, parsePath(path));
}

function groupAt(root: StarQueryGroup, path: string): StarQueryGroup | null {
  let group: StarQueryGroup = root;
  for (const index of parsePath(path)) {
    const child = group.rules[index];
    if (!child || !starIsQueryGroup(child)) return null;
    group = child;
  }
  return group;
}

/**
 * Query builder: nested groups of filter rules joined with "and" or "or" (Ignite UI
 * `igx-query-builder`, Syncfusion `ejs-querybuilder`, Kendo UI `kendo-filter`). Each rule has a
 * field, a match mode (the modes of the `star-table` filter) and a value editor by field type.
 *
 * - `[(value)]` is a `StarQueryGroup`; the builder never changes it in place.
 * - Turn it into a row test with `starQueryToPredicate(value, fields, filterService)`, or into a
 *   sentence with `starQueryToText`.
 * - Forms: it is a `FormValueControl`; `starQueryComplete(path, fields)` makes a form invalid
 *   while a rule has no value. The builder marks such rules after the user leaves it.
 * - Keyboard: every control is in the Tab order. On a focused rule row, Delete removes the rule
 *   (Control+Z restores it) and Alt+Arrow up / Arrow down moves it in its group.
 *
 * ```html
 * <star-query-builder [fields]="fields" [(value)]="query" />
 * ```
 */
@Component({
  selector: 'star-query-builder',
  imports: [
    NgTemplateOutlet,
    StarButton,
    StarDatePicker,
    StarInput,
    StarInputNumber,
    StarMultiSelect,
    StarSelect,
    StarSelectButton,
    StarToggleSwitch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-query',
    '[class.star-query--disabled]': 'disabled()',
    '[class.star-query--invalid]': 'showInvalid()',
    '(keydown)': 'onHostKeydown($event)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    <ng-container
      [ngTemplateOutlet]="groupTpl"
      [ngTemplateOutletContext]="{ $implicit: value(), path: '', depth: 1 }"
    />
    <p class="star-sr-only" [id]="hintId">{{ text.queryRuleHint }}</p>
    <p class="star-sr-only" aria-live="polite">{{ announcement() }}</p>

    <ng-template #groupTpl let-group let-path="path" let-depth="depth">
      <div
        class="star-query__group"
        role="group"
        [attr.data-path]="path"
        [attr.aria-label]="group.operator === 'or' ? text.queryGroupAny : text.queryGroupAll"
      >
        <div class="star-query__header">
          <star-select-button
            size="sm"
            [options]="operators()"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            [disabled]="disabled()"
            [ariaLabel]="text.filterOperator"
            [value]="group.operator"
            (valueChange)="setOperator(path, $any($event))"
          />
          <star-button
            class="star-query__add-rule"
            size="sm"
            variant="ghost"
            leadingIcon="ph-bold ph-plus"
            [disabled]="disabled()"
            (pressed)="addRule(path)"
          >
            {{ text.addRule }}
          </star-button>
          @if (depth < maxDepth()) {
            <star-button
              class="star-query__add-group"
              size="sm"
              variant="ghost"
              leadingIcon="ph-bold ph-brackets-round"
              [disabled]="disabled()"
              (pressed)="addGroup(path)"
            >
              {{ text.addGroup }}
            </star-button>
          }
          @if (path !== '') {
            <star-button
              class="star-query__remove-group"
              size="sm"
              variant="ghost"
              iconOnly
              leadingIcon="ph-bold ph-trash"
              [disabled]="disabled()"
              [ariaLabel]="text.removeGroup"
              (pressed)="removeGroup(path)"
            />
          }
        </div>
        <div class="star-query__rules">
          @for (item of group.rules; track $index; let i = $index) {
            @if (isGroup(item)) {
              <ng-container
                [ngTemplateOutlet]="groupTpl"
                [ngTemplateOutletContext]="{
                  $implicit: item,
                  path: child(path, i),
                  depth: depth + 1,
                }"
              />
            } @else {
              @let field = fieldOf(item.field);
              <div
                class="star-query__rule"
                role="group"
                [attr.tabindex]="disabled() ? null : 0"
                [attr.data-path]="child(path, i)"
                [attr.aria-label]="text.filterRule(i + 1)"
                [attr.aria-describedby]="hintId"
                [class.star-query__rule--invalid]="ruleInvalid(item)"
                (keydown)="onRuleKeydown($event, path, i)"
              >
                <star-select
                  class="star-query__field"
                  size="sm"
                  [options]="fields()"
                  optionLabel="label"
                  optionValue="field"
                  [disabled]="disabled()"
                  [ariaLabel]="text.queryField"
                  [value]="item.field || null"
                  (valueChange)="setField(path, i, $any($event))"
                />
                @if (modesOf(field).length > 1) {
                  <star-select
                    class="star-query__mode"
                    size="sm"
                    [options]="modesOf(field)"
                    optionLabel="label"
                    optionValue="value"
                    [disabled]="disabled()"
                    [ariaLabel]="text.matchMode"
                    [value]="item.matchMode"
                    (valueChange)="setMode(path, i, $any($event))"
                  />
                }
                <div class="star-query__value">
                  @switch (editorOf(item, field)) {
                    @case ('custom') {
                      <ng-container
                        [ngTemplateOutlet]="customFor(item.field)!.template"
                        [ngTemplateOutletContext]="customContext(path, i, item, field!)"
                      />
                    }
                    @case ('number') {
                      <star-input-number
                        [disabled]="disabled()"
                        [ariaLabel]="valueLabel(field)"
                        [value]="numberOf(item.value)"
                        (valueChange)="setValue(path, i, $event)"
                      />
                    }
                    @case ('date') {
                      <star-date-picker
                        size="sm"
                        dataType="string"
                        [disabled]="disabled()"
                        [ariaLabel]="valueLabel(field)"
                        [value]="textOf(item.value) || null"
                        (valueChange)="setValue(path, i, $any($event))"
                      />
                    }
                    @case ('select') {
                      <star-select
                        size="sm"
                        [options]="choicesOf(field)"
                        optionLabel="label"
                        optionValue="value"
                        [disabled]="disabled()"
                        [ariaLabel]="valueLabel(field)"
                        [value]="textOf(item.value) || null"
                        (valueChange)="setValue(path, i, $any($event))"
                      />
                    }
                    @case ('multi') {
                      <star-multi-select
                        size="sm"
                        [options]="choicesOf(field)"
                        optionLabel="label"
                        optionValue="value"
                        [disabled]="disabled()"
                        [ariaLabel]="valueLabel(field)"
                        [value]="listOf(item.value)"
                        (valueChange)="setValue(path, i, $any($event))"
                      />
                    }
                    @case ('boolean') {
                      <star-toggle-switch
                        size="sm"
                        [disabled]="disabled()"
                        [ariaLabel]="valueLabel(field)"
                        [checked]="item.value === true"
                        (checkedChange)="setValue(path, i, $event)"
                        >{{
                          item.value === true ? text.queryTrue : text.queryFalse
                        }}</star-toggle-switch
                      >
                    }
                    @case ('range') {
                      @if (field?.type === 'date') {
                        <star-date-picker
                          size="sm"
                          dataType="string"
                          [disabled]="disabled()"
                          [ariaLabel]="text.filterMin(field!.label)"
                          [value]="boundText(item.value, 'min')"
                          (valueChange)="setBound(path, i, 'min', $any($event))"
                        />
                        <star-date-picker
                          size="sm"
                          dataType="string"
                          [disabled]="disabled()"
                          [ariaLabel]="text.filterMax(field!.label)"
                          [value]="boundText(item.value, 'max')"
                          (valueChange)="setBound(path, i, 'max', $any($event))"
                        />
                      } @else {
                        <star-input-number
                          [disabled]="disabled()"
                          [ariaLabel]="text.filterMin(field?.label ?? '')"
                          [value]="boundNumber(item.value, 'min')"
                          (valueChange)="setBound(path, i, 'min', $event)"
                        />
                        <star-input-number
                          [disabled]="disabled()"
                          [ariaLabel]="text.filterMax(field?.label ?? '')"
                          [value]="boundNumber(item.value, 'max')"
                          (valueChange)="setBound(path, i, 'max', $event)"
                        />
                      }
                    }
                    @default {
                      <input
                        starInput
                        size="sm"
                        [disabled]="disabled()"
                        [attr.aria-label]="valueLabel(field)"
                        [invalid]="ruleInvalid(item)"
                        [value]="textOf(item.value)"
                        (input)="setValue(path, i, $any($event.target).value)"
                      />
                    }
                  }
                </div>
                <star-button
                  class="star-query__remove"
                  size="sm"
                  variant="ghost"
                  iconOnly
                  leadingIcon="ph-bold ph-x"
                  [disabled]="disabled()"
                  [ariaLabel]="text.removeRule(i + 1)"
                  (pressed)="removeAt(path, i)"
                />
              </div>
            }
          }
        </div>
      </div>
    </ng-template>
  `,
})
export class StarQueryBuilder implements FormValueControl<StarQueryGroup> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly service = inject(StarFilterService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  /** The query. The builder writes a new object on every change. */
  readonly value = model<StarQueryGroup>({ operator: 'and', rules: [] });
  /** Fields that a rule can test. */
  readonly fields = input<readonly StarQueryField<never>[]>([]);
  /** Most levels of groups, the root group included. */
  readonly maxDepth = input(3, { transform: numberAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Set by Signal Forms (`[formField]`) or by hand. */
  readonly invalid = input(false, { transform: booleanAttribute });
  /** Set by Signal Forms (`[formField]`); the builder also counts as touched once the focus left it. */
  readonly touched = input(false, { transform: booleanAttribute });
  /** Emits when the focus leaves the builder (Signal Forms marks the field touched). */
  readonly touch = output<void>();

  /** @internal */
  readonly hintId = inject(_IdGenerator).getId('star-query-hint-');
  protected readonly announcement = signal('');
  private readonly customEditors = contentChildren(StarQueryValue);
  private lastRemoved: Removed | null = null;

  protected readonly operators = computed(() => [
    { label: this.text.matchAll, value: 'and' },
    { label: this.text.matchAny, value: 'or' },
  ]);
  /** Mode options of each field, built once per field list. */
  private readonly modeOptions = computed(() => {
    const map = new Map<string, readonly { label: string; value: string }[]>();
    for (const field of this.fields()) {
      map.set(
        field.field,
        starQueryModesOf(field).map((mode) => ({
          label: starQueryModeLabel(mode, this.text, this.service),
          value: mode,
        })),
      );
    }
    return map;
  });
  private readonly choiceOptions = computed(() => {
    const map = new Map<string, readonly StarQueryOption[]>();
    for (const field of this.fields()) map.set(field.field, starQueryOptions(field));
    return map;
  });
  private readonly noModes: readonly { label: string; value: string }[] = [];
  /** The focus has left the builder once. */
  private readonly left = signal(false);
  private readonly wasTouched = computed(() => this.touched() || this.left());
  protected readonly showInvalid = computed(() => this.invalid() && this.wasTouched());

  protected isGroup = starIsQueryGroup;
  protected child = childPath;

  protected fieldOf(key: string): StarQueryField<never> | undefined {
    return this.fields().find((field) => field.field === key);
  }
  protected modesOf(field: StarQueryField<never> | undefined) {
    return (field && this.modeOptions().get(field.field)) || this.noModes;
  }
  protected choicesOf(field: StarQueryField<never> | undefined): readonly StarQueryOption[] {
    return (field && this.choiceOptions().get(field.field)) || [];
  }
  protected valueLabel(field: StarQueryField<never> | undefined): string {
    return field ? `${field.label}: ${this.text.queryValue}` : this.text.queryValue;
  }
  protected customFor(key: string): StarQueryValue | undefined {
    return this.customEditors().find((editor) => editor.serves(key));
  }
  protected editorOf(rule: StarQueryRule, field: StarQueryField<never> | undefined): Editor {
    if (field && this.customFor(field.field)) return 'custom';
    if (rule.matchMode === 'between') return 'range';
    switch (field?.type) {
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      case 'boolean':
        return 'boolean';
      case 'select':
        return rule.matchMode === 'in' ? 'multi' : 'select';
      default:
        return 'text';
    }
  }
  protected customContext(
    path: string,
    index: number,
    rule: StarQueryRule,
    field: StarQueryField<never>,
  ): StarQueryValueContext {
    return {
      $implicit: rule,
      rule,
      field,
      setValue: (value) => this.setValue(path, index, value),
    };
  }

  /** A rule shows as invalid when it is incomplete and the builder was touched. */
  protected ruleInvalid(rule: StarQueryRule): boolean {
    return this.wasTouched() && !starQueryRuleComplete(rule, this.fieldOf(rule.field));
  }

  protected textOf(value: StarQueryRuleValue): string {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  }
  protected numberOf(value: StarQueryRuleValue): number | null {
    return typeof value === 'number' && !Number.isNaN(value) ? value : null;
  }
  protected listOf(value: StarQueryRuleValue): readonly string[] {
    return Array.isArray(value) ? value : [];
  }
  private rangeOf(value: StarQueryRuleValue): StarRangeFilter {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as StarRangeFilter)
      : {};
  }
  protected boundText(value: StarQueryRuleValue, bound: 'min' | 'max'): string | null {
    const part = this.rangeOf(value)[bound];
    return part === null || part === undefined || part === '' ? null : String(part);
  }
  protected boundNumber(value: StarQueryRuleValue, bound: 'min' | 'max'): number | null {
    const part = this.rangeOf(value)[bound];
    return typeof part === 'number' ? part : null;
  }

  // ---- Changes (each writes a new value) ----

  private commit(next: StarQueryGroup): void {
    this.value.set(next);
  }

  private updateRule(path: string, index: number, change: (rule: StarQueryRule) => StarQueryRule) {
    this.commit(
      updateGroup(this.value(), path, (group) => {
        const item = group.rules[index];
        if (!item || starIsQueryGroup(item)) return group;
        const rules = [...group.rules];
        rules[index] = change(item);
        return { ...group, rules };
      }),
    );
  }

  /** Sets the operator of the group at `path` (`''` is the root). */
  setOperator(path: string, operator: 'and' | 'or'): void {
    if (operator !== 'and' && operator !== 'or') return;
    this.commit(updateGroup(this.value(), path, (group) => ({ ...group, operator })));
  }

  /** Adds a rule for the first field at the end of the group at `path`. */
  addRule(path = ''): void {
    const rule = starQueryNewRule(this.fields()[0]);
    const group = groupAt(this.value(), path);
    if (!group) return;
    const index = group.rules.length;
    this.commit(updateGroup(this.value(), path, (g) => ({ ...g, rules: [...g.rules, rule] })));
    this.focusItem(path, index);
  }

  /** Adds a group with one rule to the group at `path`, when `maxDepth` allows it. */
  addGroup(path = ''): void {
    if (parsePath(path).length + 1 >= this.maxDepth()) return;
    const group = groupAt(this.value(), path);
    if (!group) return;
    const index = group.rules.length;
    const child: StarQueryGroup = { operator: 'and', rules: [starQueryNewRule(this.fields()[0])] };
    this.commit(updateGroup(this.value(), path, (g) => ({ ...g, rules: [...g.rules, child] })));
    this.focusItem(childPath(path, index), 0);
  }

  /** Removes the group at `path` (not the root). */
  removeGroup(path: string): void {
    const steps = parsePath(path);
    if (!steps.length) return;
    const index = steps[steps.length - 1];
    this.removeAt(steps.slice(0, -1).join('.'), index);
  }

  /** Removes the rule or group at `index` of the group at `path`; Control+Z restores it. */
  removeAt(path: string, index: number): void {
    const group = groupAt(this.value(), path);
    const item = group?.rules[index];
    if (!group || !item) return;
    const name = starIsQueryGroup(item)
      ? item.operator === 'or'
        ? this.text.queryGroupAny
        : this.text.queryGroupAll
      : this.text.filterRule(index + 1);
    this.lastRemoved = { group: path, index, item, name };
    this.commit(
      updateGroup(this.value(), path, (g) => ({
        ...g,
        rules: g.rules.filter((_, i) => i !== index),
      })),
    );
    this.announcement.set(this.text.queryRuleRemoved(name));
    const left = group.rules.length - 1;
    if (left > 0) this.focusItem(path, Math.min(index, left - 1));
    else this.focusAfterRender(this.addRuleSelector(path));
  }

  /** Puts the last removed rule or group back. Returns `false` when there is nothing to undo. */
  undo(): boolean {
    const removed = this.lastRemoved;
    if (!removed) return false;
    const group = groupAt(this.value(), removed.group);
    if (!group) return false;
    this.lastRemoved = null;
    const index = Math.min(removed.index, group.rules.length);
    this.commit(
      updateGroup(this.value(), removed.group, (g) => {
        const rules = [...g.rules];
        rules.splice(index, 0, removed.item);
        return { ...g, rules };
      }),
    );
    this.announcement.set(this.text.queryRuleRestored(removed.name));
    this.focusItem(removed.group, index);
    return true;
  }

  /** Moves the item at `index` of the group at `path` by `delta` places. */
  move(path: string, index: number, delta: number): void {
    const group = groupAt(this.value(), path);
    if (!group) return;
    const to = index + delta;
    if (to < 0 || to >= group.rules.length || to === index) return;
    this.commit(
      updateGroup(this.value(), path, (g) => {
        const rules = [...g.rules];
        const [item] = rules.splice(index, 1);
        rules.splice(to, 0, item);
        return { ...g, rules };
      }),
    );
    this.announcement.set(
      this.text.itemPosition(this.text.filterRule(index + 1), to + 1, group.rules.length),
    );
    this.focusItem(path, to);
  }

  protected setField(path: string, index: number, key: string): void {
    const field = this.fieldOf(key);
    if (!field) return;
    this.updateRule(path, index, (rule) => (rule.field === key ? rule : starQueryNewRule(field)));
  }

  protected setMode(path: string, index: number, mode: string): void {
    this.updateRule(path, index, (rule) => {
      if (rule.matchMode === mode) return rule;
      // A list, a range and a single value do not convert into each other.
      const shape = (m: string) => (m === 'between' ? 'range' : m === 'in' ? 'list' : 'one');
      const keep = shape(rule.matchMode) === shape(mode);
      return {
        ...rule,
        matchMode: mode,
        value: keep ? rule.value : starQueryEmptyValue(this.fieldOf(rule.field)),
      };
    });
  }

  /** Writes the value of the rule at `index` of the group at `path`. */
  setValue(path: string, index: number, value: StarQueryRuleValue): void {
    this.updateRule(path, index, (rule) => ({ ...rule, value }));
  }

  protected setBound(
    path: string,
    index: number,
    bound: 'min' | 'max',
    value: number | string | null,
  ): void {
    this.updateRule(path, index, (rule) => ({
      ...rule,
      value: { ...this.rangeOf(rule.value), [bound]: value },
    }));
  }

  // ---- Keyboard and focus ----

  protected onRuleKeydown(event: KeyboardEvent, path: string, index: number): void {
    // Keys of a control inside the row belong to that control.
    if (event.target !== event.currentTarget || this.disabled()) return;
    if (event.key === 'Delete' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.removeAt(path, index);
    } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.move(path, index, event.key === 'ArrowUp' ? -1 : 1);
    }
  }

  protected onHostKeydown(event: KeyboardEvent): void {
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'z' &&
      !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) &&
      this.lastRemoved
    ) {
      event.preventDefault();
      this.undo();
    }
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && this.host.contains(next)) return;
    // A popup of a select or date picker is outside the host; it keeps the focus in the builder.
    if (next instanceof Element && next.closest('.cdk-overlay-container')) return;
    this.left.set(true);
    this.touch.emit();
  }

  private addRuleSelector(path: string): string {
    return `.star-query__group[data-path="${path}"] .star-query__add-rule button`;
  }

  /** Focuses the rule row at `index` of a group, or the "Add rule" button of a group there. */
  private focusItem(path: string, index: number): void {
    const item = groupAt(this.value(), path)?.rules[index];
    const target = childPath(path, index);
    this.focusAfterRender(
      item && starIsQueryGroup(item)
        ? this.addRuleSelector(target)
        : `.star-query__rule[data-path="${target}"]`,
    );
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
