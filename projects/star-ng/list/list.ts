import { FocusableOption, FocusKeyManager } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  STAR_SLOT_HOST,
  StarPart,
  starSlot,
  StarSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
  type StarEmptyContext,
} from '@star-ng/ui/core';

/**
 * How the items of `star-list` behave:
 * - `plain`: items are text (Material `mat-list`).
 * - `navigation`: items are links, with `href` or `routerLink` (Material `mat-nav-list`).
 * - `action`: items are buttons that emit `activated` (Material `mat-action-list`).
 */
export type StarListMode = 'plain' | 'navigation' | 'action';

/** Optional heading line between the items of `star-list`. Material `mat-subheader`. */
@Component({
  selector: 'star-list-subheader',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-list__subheader' },
  template: `<ng-content />`,
})
export class StarListSubheader {}

/**
 * One item of `star-list` (Material `mat-list-item`, Ignite `igx-list-item`). The host is the
 * `listitem`. Areas: `[starListItemStart]` (avatar or icon), the default content (title),
 * `[starListItemSubtitle]` and `[starListItemEnd]` (meta text or actions).
 *
 * With `href` or `routerLink` the item is a link. In a list with `mode="action"` it is a button.
 * The end area is outside the link or button, so buttons there are separate controls.
 */
@Component({
  selector: 'star-list-item',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-list__item',
    role: 'listitem',
    '[class.star-list__item--interactive]': "kind() !== 'plain'",
    '[class.star-list__item--disabled]': 'disabled()',
    '(focusin)': 'list.onItemFocus(this)',
  },
  template: `
    <ng-template #body>
      <ng-content select="[starListItemStart]" />
      <span starPart="text" class="star-list__text">
        <span starPart="title" class="star-list__title"><ng-content /></span>
        <ng-content select="[starListItemSubtitle]" />
      </span>
    </ng-template>
    @switch (kind()) {
      @case ('router') {
        <a
          starPart="main"
          #focusable
          class="star-list__main"
          [routerLink]="routerLink()"
          routerLinkActive="star-list__main--active"
          ariaCurrentWhenActive="page"
          [routerLinkActiveOptions]="{ exact: exact() }"
          [attr.target]="target()"
          [attr.tabindex]="tabIndex()"
          (click)="activated.emit()"
        >
          <ng-container *ngTemplateOutlet="body" />
        </a>
      }
      @case ('href') {
        <a
          starPart="main"
          #focusable
          class="star-list__main"
          [class.star-list__main--active]="active()"
          [href]="href()"
          [attr.target]="target()"
          [attr.aria-current]="active() ? 'page' : null"
          [attr.tabindex]="tabIndex()"
          (click)="activated.emit()"
        >
          <ng-container *ngTemplateOutlet="body" />
        </a>
      }
      @case ('button') {
        <button
          starPart="main"
          #focusable
          type="button"
          class="star-list__main"
          [class.star-list__main--active]="active()"
          [attr.aria-current]="active() ? 'true' : null"
          [attr.tabindex]="tabIndex()"
          [disabled]="disabled()"
          (click)="activated.emit()"
        >
          <ng-container *ngTemplateOutlet="body" />
        </button>
      }
      @default {
        <div starPart="main" class="star-list__main" [attr.aria-disabled]="disabled() || null">
          <ng-container *ngTemplateOutlet="body" />
        </div>
      }
    }
    <ng-content select="[starListItemEnd]" />
  `,
})
export class StarListItem {
  protected readonly list = inject(forwardRef(() => StarList));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Link address. The item becomes a link. */
  readonly href = input<string | null>(null);
  /** Router link. The item becomes a link with `aria-current="page"` while its route is active. */
  readonly routerLink = input<string | readonly unknown[] | null>(null);
  /** Target of the link, for example `_blank`. */
  readonly target = input<string | null>(null);
  /** With `routerLink`: the item is active only on an exact URL match. */
  readonly exact = input(false, { transform: booleanAttribute });
  /** Marks the current item (`aria-current`) for `href` and button items. Router links set it themselves. */
  readonly active = input(false, { transform: booleanAttribute });
  /** A disabled item is not a link or button, and the arrow keys skip it. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Emits when the link or button of the item is activated (click, Enter, Space on a button). */
  readonly activated = output<void>();

  private readonly focusable = viewChild<ElementRef<HTMLElement>>('focusable');

  /** What the item renders: a router link, a link, a button or plain content. */
  protected readonly kind = computed<'router' | 'href' | 'button' | 'plain'>(() => {
    if (this.disabled()) return 'plain';
    if (this.routerLink() !== null) return 'router';
    if (this.href() !== null) return 'href';
    return this.list.mode() === 'action' ? 'button' : 'plain';
  });

  /** Roving tabindex: only the active item of an interactive list is in the Tab order. */
  protected readonly tabIndex = computed(() => {
    if (!this.list.interactive()) return null;
    return this.list.tabStop() === this ? 0 : -1;
  });

  /** @internal An item without a link or button cannot take focus: the arrow keys skip it. */
  get disabledForKeys(): boolean {
    return this.kind() === 'plain';
  }

  /** Moves the focus to the link or button of the item. */
  focus(): void {
    this.focusable()?.nativeElement.focus();
  }

  /** @internal The item as the CDK key manager sees it. */
  readonly keyOption: FocusableOption & { readonly item: StarListItem } = {
    item: this,
    focus: () => this.focus(),
    getLabel: () =>
      this.host.nativeElement.querySelector('.star-list__title')?.textContent?.trim() ?? '',
  };
}

/**
 * List (Material `mat-list` / `mat-nav-list` / `mat-action-list`, Ignite `igx-list`): a list of
 * items with an optional avatar or icon, a title, a subtitle and meta text or actions.
 *
 * ```html
 * <star-list mode="navigation" ariaLabel="Projects">
 *   <star-list-item routerLink="/projects/apollo">
 *     <i starListItemStart class="ph-bold ph-folder" aria-hidden="true"></i>
 *     Apollo
 *     <span starListItemSubtitle>12 open tasks</span>
 *   </star-list-item>
 * </star-list>
 * ```
 *
 * In `navigation` and `action` mode, the list is one Tab stop: the arrow keys, Home, End and
 * type-ahead move the focus between the items (roving tabindex, CDK `FocusKeyManager`).
 * For a list where the user selects options, use `star-listbox`.
 */
@Component({
  selector: 'star-list',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarList) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-list',
    '[class.star-list--dense]': 'dense()',
    '[class.star-list--divider]': 'divider()',
    '[class.star-list--interactive]': 'interactive()',
    '[attr.role]': "hasItems() ? 'list' : null",
    '[attr.aria-label]': 'hasItems() ? ariaLabel() : null',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <ng-content />
    @if (!hasItems()) {
      @if (emptySlot(); as custom) {
        <div starPart="empty" class="star-list__empty">
          <ng-container *ngTemplateOutlet="custom; context: { $implicit: '' }" />
        </div>
      }
    }
  `,
})
export class StarList {
  private readonly injector = inject(Injector);

  /** How the items behave: plain text, links or buttons. */
  readonly mode = input<StarListMode>('plain');
  /** Smaller item height and padding. */
  readonly dense = input(false, { transform: booleanAttribute });
  /** A line between the items. */
  readonly divider = input(false, { transform: booleanAttribute });
  /** Accessible name of the list. */
  readonly ariaLabel = input<string | null>(null);

  private readonly items = contentChildren(StarListItem, { descendants: true });
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');

  protected readonly hasItems = computed(() => this.items().length > 0);
  /** The arrow keys move the focus only between links and buttons. */
  readonly interactive = computed(() => this.mode() !== 'plain');

  private readonly active = signal<StarListItem | null>(null);
  /** The item in the Tab order: the last focused one, else the first that can take focus. */
  readonly tabStop = computed(() => {
    const items = this.items();
    const active = this.active();
    if (active && items.includes(active) && !active.disabledForKeys) return active;
    return items.find((item) => !item.disabledForKeys) ?? null;
  });

  private readonly keyOptions = computed(() => this.items().map((item) => item.keyOption));
  private readonly keys = new FocusKeyManager<StarListItem['keyOption']>(
    this.keyOptions,
    this.injector,
  )
    .withVerticalOrientation()
    .withHomeAndEnd()
    .withTypeAhead()
    .skipPredicate((option) => option.item.disabledForKeys);

  constructor() {
    const change = this.keys.change.subscribe(() =>
      this.active.set(this.keys.activeItem?.item ?? null),
    );
    inject(DestroyRef).onDestroy(() => {
      change.unsubscribe();
      this.keys.destroy();
    });
  }

  /** @internal Keeps the key manager on the item that took focus by click or Tab. */
  onItemFocus(item: StarListItem): void {
    if (!this.interactive() || item.disabledForKeys) return;
    this.keys.updateActiveItem(item.keyOption);
    this.active.set(item);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.interactive()) return;
    // Keys typed in a control of the end area (for example a field) stay with that control.
    const target = event.target as HTMLElement | null;
    if (!target?.classList.contains('star-list__main')) return;
    if (this.keys.activeItem === null) {
      const current = this.tabStop();
      if (current) this.keys.updateActiveItem(current.keyOption);
    }
    this.keys.onKeydown(event);
  }
}

/** The list, its items and the subheader, for one-line imports. */
export const STAR_LIST = [StarList, StarListItem, StarListSubheader] as const;
