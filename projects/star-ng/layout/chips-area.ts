import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import {
  optionText,
  STAR_UI_TEXT,
  StarAnnouncer,
  starInlineKey,
  StarOptionKey,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

/** Payload of `reorder` of `star-chips-area`. */
export interface StarChipsAreaReorderEvent<T> {
  readonly item: T;
  readonly previousIndex: number;
  readonly currentIndex: number;
}

/** Context of the `starChipsAreaItem` slot. */
export interface StarChipsAreaItemContext<T> {
  readonly $implicit: T;
  readonly index: number;
}

/**
 * Content of each chip of `star-chips-area`: `<ng-template starChipsAreaItem let-item>`. The chip
 * button keeps its name; keep the item text in the template and add no focusable elements.
 */
@Directive({ selector: 'ng-template[starChipsAreaItem]' })
export class StarChipsAreaItem<T = unknown> {
  /** Optional: pass the items array to type `let-item` in strict templates. */
  readonly starChipsAreaItemOf = input<readonly T[] | null>(null);
  readonly template = inject<TemplateRef<StarChipsAreaItemContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _dir: StarChipsAreaItem<T>,
    _ctx: unknown,
  ): _ctx is StarChipsAreaItemContext<T> {
    return true;
  }
}

/**
 * Chips area (Ignite UI `igx-chips-area`): a list of chips that the user reorders by drag and drop
 * or with the keyboard, and removes.
 *
 * ```html
 * <star-chips-area ariaLabel="Sort order" [(items)]="columns" removable />
 * ```
 *
 * Keyboard: the chips are one tab stop; Arrow left / right (and Home, End) move between them,
 * Control+Shift and an arrow key moves the focused chip, Delete or Backspace removes it (with
 * `removable`). Each move and removal is announced. The list is a `list` named by `ariaLabel`.
 */
@Component({
  selector: 'star-chips-area',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [CdkDropList, CdkDrag, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-chips-area' },
  template: `
    <ul
      data-star-part="list"
      class="star-chips-area__list"
      role="list"
      [attr.aria-label]="ariaLabel()"
      cdkDropList
      cdkDropListOrientation="mixed"
      [cdkDropListDisabled]="disabled()"
      (cdkDropListDropped)="onDrop($event)"
    >
      @for (item of items(); track $index; let i = $index) {
        <li data-star-part="listItem" class="star-chips-area__item" cdkDrag [cdkDragData]="item">
          <button
            data-star-part="chipButton"
            type="button"
            class="star-chip star-chips-area__chip"
            [attr.tabindex]="i === focusIndex() ? 0 : -1"
            [attr.aria-describedby]="disabled() ? null : hintId"
            [attr.aria-keyshortcuts]="
              disabled()
                ? null
                : removable()
                  ? 'Control+Shift+ArrowLeft Control+Shift+ArrowRight Delete'
                  : 'Control+Shift+ArrowLeft Control+Shift+ArrowRight'
            "
            [disabled]="disabled()"
            (focus)="focusIndex.set(i)"
            (keydown)="onKeydown($event, i)"
          >
            @if (itemTemplate(); as custom) {
              <ng-container
                *ngTemplateOutlet="custom.template; context: { $implicit: item, index: i }"
              />
            } @else {
              {{ labelOf(item) }}
            }
          </button>
          @if (removable() && !disabled()) {
            <!-- The pointer way to remove; the keyboard uses Delete on the chip. -->
            <button
              data-star-part="removeButton"
              type="button"
              class="star-chip__remove"
              tabindex="-1"
              aria-hidden="true"
              [title]="text.removeItem(labelOf(item))"
              (click)="remove(i)"
            >
              <i data-star-part="removeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
            </button>
          }
        </li>
      }
    </ul>
    <span class="star-sr-only" [id]="hintId">{{
      removable() ? text.chipsMoveRemoveHint : text.chipsMoveHint
    }}</span>
  `,
})
export class StarChipsArea<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly announcer = inject(StarAnnouncer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly hintId = inject(_IdGenerator).getId('star-chips-area-hint-');

  /** The chips, in order. Two-way: a move or a removal sets a new array. */
  readonly items = model<readonly T[]>([]);
  /** Property (or function) with the text of an item. Default: the item as text. */
  readonly optionLabel = input<StarOptionKey<T> | null>(null);
  /** Accessible name of the list. */
  readonly ariaLabel = input<string | null>(null);
  /** Shows a remove button on each chip; Delete and Backspace remove the focused chip. */
  readonly removable = input(false, { transform: booleanAttribute });
  /** No moves, no removal, and the chips cannot take focus. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** A chip moved (drag and drop or keyboard). */
  readonly reorder = output<StarChipsAreaReorderEvent<T>>();
  /** A chip was removed. */
  readonly removed = output<T>();

  protected readonly itemTemplate = contentChild(StarChipsAreaItem);
  protected readonly focusIndex = signal(0);

  protected labelOf(item: T): string {
    return optionText(item, this.optionLabel());
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.items().length;
    const key = starInlineKey(event);
    const move = event.ctrlKey && event.shiftKey;
    if (move && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      event.preventDefault();
      this.move(index, key === 'ArrowLeft' ? index - 1 : index + 1);
      return;
    }
    if (this.removable() && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      this.remove(index);
      return;
    }
    const target = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: count - 1,
    }[key];
    if (target === undefined || target < 0 || target >= count) return;
    event.preventDefault();
    this.focusChip(target);
  }

  /** Moves the item at `from` to `to` (clamped), emits `reorder` and announces the new position. */
  move(from: number, to: number): void {
    const items = [...this.items()];
    const target = Math.max(0, Math.min(items.length - 1, to));
    if (from === target || from < 0 || from >= items.length) return;
    const [item] = items.splice(from, 1);
    items.splice(target, 0, item);
    this.items.set(items);
    this.reorder.emit({ item, previousIndex: from, currentIndex: target });
    this.announcer.announce(this.text.itemPosition(this.labelOf(item), target + 1, items.length));
    this.focusChip(target);
  }

  /** Removes the item at `index`, emits `removed` and announces it. */
  remove(index: number): void {
    const items = [...this.items()];
    if (index < 0 || index >= items.length) return;
    const [item] = items.splice(index, 1);
    this.items.set(items);
    this.removed.emit(item);
    this.announcer.announce(this.text.tagRemoved(this.labelOf(item)));
    if (items.length) this.focusChip(Math.min(index, items.length - 1));
  }

  protected onDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.move(event.previousIndex, event.currentIndex);
  }

  /** Focuses the chip at `index` after the render. */
  private focusChip(index: number): void {
    this.focusIndex.set(index);
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelectorAll<HTMLElement>('.star-chips-area__chip')
          [index]?.focus(),
      { injector: this.injector },
    );
  }
}
