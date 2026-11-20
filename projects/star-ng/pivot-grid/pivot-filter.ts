import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import { STAR_UI_TEXT, StarPart } from '@star-ng/ui/core';
import { StarPopover } from '@star-ng/ui/popover';
import { StarPivotFilter, StarPivotMember, starPivotMemberKey as keyOf } from './engine';

/**
 * Member filter of one pivot field: a funnel button that opens a dialog with a search field and a
 * check box per member (all members checked: no filter). A change applies at once. Internal part
 * of `star-pivot-grid`.
 *
 * @internal
 */
@Component({
  selector: 'star-pivot-filter',
  imports: [StarPart, StarButton, StarCheckbox, StarPopover, CdkTrapFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-pivot-filter' },
  template: `
    <button
      starPart="iconButton"
      type="button"
      class="star-pivot__icon-button"
      [class.star-pivot__icon-button--active]="active()"
      aria-haspopup="dialog"
      [attr.aria-expanded]="panel.visible()"
      [attr.aria-label]="active() ? text.filterMenuActive(label()) : text.filterMenu(label())"
      [attr.data-pivot-filter]="field()"
      (click)="open($event)"
    >
      <i
        starPart="iconButtonIcon"
        [class]="active() ? 'ph-fill ph-funnel' : 'ph-bold ph-funnel'"
        aria-hidden="true"
      ></i>
    </button>
    <star-popover #panel [ariaLabel]="text.filterMenu(label())">
      <div starPart="panel" class="star-pivot-filter__panel" cdkTrapFocus>
        <input
          starPart="input"
          class="star-input star-input--sm"
          type="search"
          data-autofocus
          [attr.aria-label]="text.search"
          [placeholder]="text.search"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
        <star-checkbox
          class="star-pivot-filter__all"
          [checked]="allChecked()"
          [indeterminate]="someChecked()"
          (checkedChange)="setAll($event)"
          >{{ text.selectAll }}</star-checkbox
        >
        <div
          starPart="list"
          class="star-pivot-filter__list"
          role="group"
          [attr.aria-label]="label()"
        >
          @for (member of shown(); track member.key) {
            <star-checkbox
              [checked]="!excluded().has(member.key)"
              (checkedChange)="setMember(member, $event)"
              >{{ member.label }}</star-checkbox
            >
          } @empty {
            <p starPart="empty" class="star-pivot-filter__empty">{{ text.fileNoResults }}</p>
          }
        </div>
        <div starPart="buttons" class="star-pivot-filter__buttons">
          <star-button size="sm" variant="secondary" (pressed)="clear()">
            {{ text.clear }}
          </star-button>
          <star-button size="sm" (pressed)="panel.hide()">{{ text.close }}</star-button>
        </div>
      </div>
    </star-popover>
  `,
})
export class StarPivotFilterButton {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly field = input.required<string>();
  readonly label = input.required<string>();
  readonly members = input.required<readonly StarPivotMember[]>();
  readonly filter = input<StarPivotFilter | undefined>(undefined);
  readonly locale = input<string | undefined>(undefined);
  /** The new filter of the field; `null`: no filter. */
  readonly filterChange = output<StarPivotFilter | null>();

  protected readonly panel = viewChild.required<StarPopover>('panel');
  protected readonly query = signal('');

  /** Keys of the members that the filter leaves out. */
  protected readonly excluded = computed(() => {
    const filter = this.filter();
    const members = this.members();
    const out = new Set<string>();
    if (!filter) return out;
    const include = filter.include ? new Set(filter.include.map(keyOf)) : null;
    const exclude = new Set((filter.exclude ?? []).map(keyOf));
    for (const member of members) {
      if ((include && !include.has(member.key)) || exclude.has(member.key)) out.add(member.key);
    }
    return out;
  });
  protected readonly active = computed(() => this.excluded().size > 0);
  protected readonly allChecked = computed(() => this.excluded().size === 0);
  protected readonly someChecked = computed(
    () => this.excluded().size > 0 && this.excluded().size < this.members().length,
  );
  protected readonly shown = computed(() => {
    const query = this.query().trim();
    if (!query) return this.members();
    const sensitive = new Intl.Collator(this.locale(), { sensitivity: 'base' });
    return this.members().filter((member) => includesText(member.label, query, sensitive));
  });

  protected open(event: Event): void {
    if (!this.panel().visible()) this.query.set('');
    this.panel().toggle(event);
  }

  protected setMember(member: StarPivotMember, checked: boolean): void {
    const out = new Set(this.excluded());
    if (checked) out.delete(member.key);
    else out.add(member.key);
    this.emit(out);
  }

  /** Select all acts on the members in the list: the search results when there is a search. */
  protected setAll(checked: boolean): void {
    const out = new Set(this.excluded());
    for (const member of this.shown()) {
      if (checked) out.delete(member.key);
      else out.add(member.key);
    }
    this.emit(out);
  }

  protected clear(): void {
    this.emit(new Set());
  }

  private emit(out: ReadonlySet<string>): void {
    if (!out.size) {
      this.filterChange.emit(null);
      return;
    }
    const exclude = this.members()
      .filter((member) => out.has(member.key))
      .map((member) => member.value);
    this.filterChange.emit({ field: this.field(), exclude });
  }
}

/** The label contains the query, ignoring case and accents. */
function includesText(label: string, query: string, collator: Intl.Collator): boolean {
  const size = query.length;
  for (let start = 0; start + size <= label.length; start++) {
    if (collator.compare(label.slice(start, start + size), query) === 0) return true;
  }
  return false;
}
