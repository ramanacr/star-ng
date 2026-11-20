import { _IdGenerator } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import {
  STAR_UI_TEXT,
  starIsRtl,
  starPrefersReducedMotion,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarMenuItem } from '@star-ng/ui/menu';
import { StarSpinner } from '@star-ng/ui/spinner';

// ---------------------------------------------------------------- Splitter

/**
 * Splitter (PrimeNG `p-splitter`): two panes with a draggable gutter. The gutter is a
 * `role="separator"` with `aria-valuenow`; Arrow keys resize by 2 %, Home / End by the limits.
 * In right-to-left the first pane is on the right: Arrow left makes it larger (the gutter moves
 * left), Arrow right makes it smaller, and a drag measures from the right edge.
 *
 * ```html
 * <star-splitter [(size)]="split" ariaLabel="Resize panes">
 *   <div starSplitterStart>…</div>
 *   <div starSplitterEnd>…</div>
 * </star-splitter>
 * ```
 */
@Component({
  selector: 'star-splitter',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-splitter star-splitter--' + layout()",
    '[style.--star-split]': "size() + '%'",
  },
  template: `
    <div data-star-part="pane" class="star-splitter__pane">
      <ng-content select="[starSplitterStart]" />
    </div>
    <div
      data-star-part="gutter"
      class="star-splitter__gutter"
      role="separator"
      tabindex="0"
      [attr.aria-orientation]="layout() === 'horizontal' ? 'vertical' : 'horizontal'"
      [attr.aria-valuenow]="size()"
      [attr.aria-valuemin]="minSize()"
      [attr.aria-valuemax]="100 - minSize()"
      [attr.aria-label]="ariaLabel() ?? text.resizePanes"
      (pointerdown)="startDrag($event)"
      (keydown)="onKeydown($event)"
    >
      <span data-star-part="handle" class="star-splitter__handle" aria-hidden="true"></span>
    </div>
    <div data-star-part="pane" class="star-splitter__pane">
      <ng-content select="[starSplitterEnd]" />
    </div>
  `,
})
export class StarSplitter {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly layout = input<'horizontal' | 'vertical'>('horizontal');
  /** Size of the first pane in percent. */
  readonly size = model(50);
  readonly minSize = input(15);
  readonly ariaLabel = input<string | null>(null);

  private clamp(value: number): number {
    return Math.round(Math.min(100 - this.minSize(), Math.max(this.minSize(), value)) * 10) / 10;
  }

  protected startDrag(event: PointerEvent): void {
    const gutter = event.currentTarget as HTMLElement;
    gutter.setPointerCapture?.(event.pointerId);
    const box = this.host.nativeElement.getBoundingClientRect();
    const rtl = starIsRtl(this.host.nativeElement);
    const move = (e: PointerEvent) => {
      const ratio =
        this.layout() === 'horizontal'
          ? (rtl ? box.right - e.clientX : e.clientX - box.left) / box.width
          : (e.clientY - box.top) / box.height;
      this.size.set(this.clamp(ratio * 100));
    };
    const stop = () => {
      gutter.removeEventListener('pointermove', move);
      gutter.removeEventListener('pointerup', stop);
    };
    gutter.addEventListener('pointermove', move);
    gutter.addEventListener('pointerup', stop);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const horizontal = this.layout() === 'horizontal';
    // The arrow keys follow the visual direction: the gutter moves left on Arrow left, and the
    // first pane is on the right in right-to-left, so the sign turns.
    const flip = starIsRtl(this.host.nativeElement) ? -1 : 1;
    const delta = {
      ArrowLeft: horizontal ? -2 * flip : 0,
      ArrowRight: horizontal ? 2 * flip : 0,
      ArrowUp: horizontal ? 0 : -2,
      ArrowDown: horizontal ? 0 : 2,
    }[event.key];
    if (delta) {
      event.preventDefault();
      this.size.set(this.clamp(this.size() + delta));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.size.set(event.key === 'Home' ? this.minSize() : 100 - this.minSize());
    }
  }
}

// ---------------------------------------------------------------- Speed dial and dock

/**
 * Speed dial (PrimeNG `p-speeddial`): floating action button that opens a short list of
 * actions (up, down, left or right). `aria-expanded`, Escape closes, focus moves to the first action.
 * `<star-speed-dial [items]="quickActions" direction="up" ariaLabel="Quick actions" />`
 *
 * `left` and `right` are the physical sides of the screen, as in CSS. `start` and `end` follow the
 * writing direction (`start` is the left side in LTR and the right side in RTL). The arrow keys
 * move along the visual direction of the list.
 */
@Component({
  selector: 'star-speed-dial',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],

  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-speed-dial star-speed-dial--' + direction()",
    '[class.star-speed-dial--open]': 'open()',
    '[class.star-speed-dial--sm]': "size() === 'sm'",
    '[class.star-speed-dial--static]': 'icon() !== defaultIcon',
    '(keydown.escape)': 'close(true)',
    '(keydown)': 'onArrow($event)',
  },
  template: `
    <button
      data-star-part="fab"
      #fab
      type="button"
      class="star-speed-dial__fab"
      aria-haspopup="true"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="listId"
      [attr.aria-label]="ariaLabel() ?? text.actions"
      (click)="toggle(list)"
    >
      <i data-star-part="fabIcon" [class]="icon()" aria-hidden="true"></i>
    </button>
    <ul
      data-star-part="list"
      #list
      class="star-speed-dial__list"
      [id]="listId"
      [attr.inert]="open() ? null : ''"
    >
      @for (item of items(); track $index; let i = $index) {
        <li data-star-part="listItem" [style.--star-i]="i">
          <button
            data-star-part="action"
            type="button"
            class="star-speed-dial__action"
            [class.star-speed-dial__action--active]="i === activeIndex()"
            [attr.aria-pressed]="activeIndex() === null ? null : i === activeIndex()"
            [attr.aria-label]="item.label"
            [attr.title]="item.label"
            [disabled]="item.disabled"
            (click)="run(item); close(true, fab)"
          >
            <i
              data-star-part="actionIcon"
              [class]="item.icon ?? 'ph-bold ph-circle'"
              aria-hidden="true"
            ></i>
          </button>
        </li>
      }
    </ul>
  `,
})
export class StarSpeedDial {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly listId = inject(_IdGenerator).getId('star-speed-dial-');
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly items = input<readonly StarMenuItem[]>([]);
  readonly direction = input<'up' | 'down' | 'left' | 'right' | 'start' | 'end'>('up');
  readonly ariaLabel = input<string | null>(null);
  /** Icon of the main button. With another icon than the default, the button does not turn. */
  readonly icon = input('ph-bold ph-plus');
  readonly size = input<'sm' | 'md'>('md');
  /** Index of the item that is the current choice (a set of options, for example a theme). */
  readonly activeIndex = input<number | null>(null);
  readonly itemClick = output<StarMenuItem>();
  protected readonly defaultIcon = 'ph-bold ph-plus';
  protected readonly open = signal(false);

  protected toggle(list: HTMLElement): void {
    this.open.update((open) => !open);
    // Focus after render: the list is inert until the view updates.
    if (this.open()) {
      afterNextRender(() => list.querySelector<HTMLButtonElement>('button')?.focus(), {
        injector: this.injector,
      });
    }
  }

  close(restoreFocus = false, fab?: HTMLElement): void {
    if (!this.open()) return;
    this.open.set(false);
    if (restoreFocus)
      (fab ?? this.host.nativeElement.querySelector<HTMLElement>('.star-speed-dial__fab'))?.focus();
  }

  /**
   * Arrow keys along the direction of the list move the focus between the actions (added
   * to the source control, which only used Tab). Home and End go to the first and last action.
   */
  protected onArrow(event: KeyboardEvent): void {
    if (!this.open()) return;
    // The list runs toward a physical side: resolve start and end first.
    const rtl = starIsRtl(this.host.nativeElement);
    const direction = this.direction();
    const side =
      direction === 'start'
        ? rtl
          ? 'right'
          : 'left'
        : direction === 'end'
          ? rtl
            ? 'left'
            : 'right'
          : direction;
    const forward = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[
      side
    ];
    const backward = { up: 'ArrowDown', down: 'ArrowUp', left: 'ArrowRight', right: 'ArrowLeft' }[
      side
    ];
    if (
      event.key !== forward &&
      event.key !== backward &&
      event.key !== 'Home' &&
      event.key !== 'End'
    )
      return;
    const actions = [
      ...this.host.nativeElement.querySelectorAll<HTMLButtonElement>(
        '.star-speed-dial__action:not(:disabled)',
      ),
    ];
    if (!actions.length) return;
    event.preventDefault();
    const last = actions.length - 1;
    const current = actions.indexOf(
      this.host.nativeElement.ownerDocument.activeElement as HTMLButtonElement,
    );
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else if (event.key === forward) next = current < 0 ? 0 : Math.min(last, current + 1);
    else next = current < 0 ? last : Math.max(0, current - 1);
    actions[next].focus();
  }

  protected run(item: StarMenuItem): void {
    item.command?.(item);
    this.itemClick.emit(item);
  }
}

/**
 * Dock (PrimeNG `p-dock`): a bar of app shortcuts that magnify on hover and focus.
 * `<star-dock [items]="apps" ariaLabel="Apps" />`
 */
@Component({
  selector: 'star-dock',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],

  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'star-dock star-dock--' + position()" },
  template: `
    <nav data-star-part="nav" [attr.aria-label]="ariaLabel() ?? text.dock">
      <ul data-star-part="list" class="star-dock__list">
        @for (item of items(); track $index) {
          <li data-star-part="listItem">
            <button
              data-star-part="item"
              type="button"
              class="star-dock__item"
              [attr.aria-label]="item.label"
              [attr.title]="item.label"
              [disabled]="item.disabled"
              (click)="item.command?.(item); itemClick.emit(item)"
            >
              <i
                data-star-part="itemIcon"
                [class]="item.icon ?? 'ph-bold ph-app-window'"
                aria-hidden="true"
              ></i>
            </button>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class StarDock {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly items = input<readonly StarMenuItem[]>([]);
  /** `left` and `right` are physical; `start` and `end` follow the writing direction. */
  readonly position = input<'bottom' | 'top' | 'left' | 'right' | 'start' | 'end'>('bottom');
  readonly ariaLabel = input<string | null>(null);
  readonly itemClick = output<StarMenuItem>();
}

// ---------------------------------------------------------------- Scroll top and block UI

/**
 * Scroll-to-top button (PrimeNG `p-scrolltop`): appears after `threshold` px of scroll on the
 * window or a `target` element; smooth scroll unless the user prefers reduced motion.
 * `<star-scroll-top [threshold]="400" />`
 */
@Component({
  selector: 'star-scroll-top',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],

  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-scroll-top', '[class.star-scroll-top--visible]': 'visible()' },
  template: `
    <button
      data-star-part="topButton"
      type="button"
      class="star-scroll-top__btn"
      [attr.aria-label]="text.scrollToTop"
      [attr.tabindex]="visible() ? 0 : -1"
      (click)="toTop()"
    >
      <i data-star-part="topIcon" class="ph-bold ph-arrow-up" aria-hidden="true"></i>
    </button>
  `,
})
export class StarScrollTop {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly threshold = input(400);
  /** Scroll container; default the window. */
  readonly target = input<HTMLElement | null>(null);
  protected readonly visible = signal(false);
  private readonly doc = inject(DOCUMENT);

  constructor() {
    // The injected document, not the global: the global does not exist when the page is prerendered.
    const doc = this.doc;
    const onScroll = (event: Event) => {
      const el = this.target();
      if (el && event.target !== el) return;
      const top = el ? el.scrollTop : (doc.scrollingElement?.scrollTop ?? 0);
      this.visible.set(top > this.threshold());
    };
    doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() =>
      doc.removeEventListener('scroll', onScroll, { capture: true }),
    );
  }

  protected toTop(): void {
    const reduce = starPrefersReducedMotion(this.doc);
    (this.target() ?? document.scrollingElement ?? document.documentElement).scrollTo?.({
      top: 0,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }
}

/**
 * Block UI (PrimeNG `p-blockui`): while `blocked`, the content is `inert` (no focus, no clicks,
 * hidden from assistive tech) and shows a busy overlay with a spinner.
 * `<star-block-ui [blocked]="saving()">…form…</star-block-ui>`
 */
@Component({
  selector: 'star-block-ui',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-block-ui', '[attr.aria-busy]': 'blocked() || null' },
  template: `
    <div
      data-star-part="content"
      class="star-block-ui__content"
      [attr.inert]="blocked() ? '' : null"
    >
      <ng-content />
    </div>
    @if (blocked()) {
      <div data-star-part="mask" class="star-block-ui__mask">
        <star-spinner size="2rem" [ariaLabel]="message()" />
        @if (message()) {
          <span data-star-part="messageText" class="star-block-ui__message">{{ message() }}</span>
        }
      </div>
    }
  `,
})
export class StarBlockUi {
  readonly blocked = input(false, { transform: booleanAttribute });
  readonly message = input('');
}

// ---------------------------------------------------------------- Meter group

export interface StarMeterItem {
  readonly label: string;
  readonly value: number;
  /** Phosphor icon class shown in the legend. */
  readonly icon?: string;
}

/**
 * Meter group (PrimeNG `p-metergroup`): one bar split into parts (fixed series colors, 2px gaps)
 * with a labelled legend. `role="meter"` per part, so each value is announced.
 * `<star-meter-group [items]="storage" [max]="100" unit="GB" ariaLabel="Storage" />`
 */
@Component({
  selector: 'star-meter-group',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],

  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-meter-group', role: 'group', '[attr.aria-label]': 'ariaLabel()' },
  template: `
    <div data-star-part="bar" class="star-meter-group__bar">
      @for (item of items(); track item.label; let i = $index) {
        <span
          data-star-part="part"
          class="star-meter-group__part"
          role="meter"
          [attr.aria-label]="item.label"
          aria-valuemin="0"
          [attr.aria-valuemax]="total()"
          [attr.aria-valuenow]="item.value"
          [attr.aria-valuetext]="
            text.meterValue(item.value + (unit() ? ' ' + unit() : ''), total())
          "
          [style.width.%]="(item.value / total()) * 100"
          [style.background]="color(i)"
        ></span>
      }
    </div>
    <ul data-star-part="legend" class="star-meter-group__legend" aria-hidden="true">
      @for (item of items(); track item.label; let i = $index) {
        <li data-star-part="legendItem">
          <span
            data-star-part="swatch"
            class="star-chart__swatch"
            [style.background]="color(i)"
          ></span>
          {{ item.label }}
          <strong data-star-part="legendText"
            >{{ item.value }}{{ unit() ? ' ' + unit() : '' }}</strong
          >
        </li>
      }
    </ul>
  `,
})
export class StarMeterGroup {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly items = input<readonly StarMeterItem[]>([]);
  /** Full scale; default: the sum of the items. */
  readonly max = input<number | null>(null);
  readonly unit = input('');
  readonly ariaLabel = input<string | null>(null);
  protected readonly total = computed(
    () => this.max() ?? (this.items().reduce((sum, item) => sum + item.value, 0) || 1),
  );
  protected color(index: number): string {
    return `var(--star-chart-${(index % 8) + 1})`;
  }
}
