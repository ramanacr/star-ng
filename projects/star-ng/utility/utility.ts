import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarIconContext,
  starIsRtl,
  starPrefersReducedMotion,
  StarSlot,
  starSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarMenuItem } from '@star-ng/ui/menu';
import { StarSpinner } from '@star-ng/ui/spinner';

// ---------------------------------------------------------------- Splitter

/** Payload of `resizeEnd` of `star-splitter`. */
export interface StarSplitterResizeEvent {
  /** Size of the first pane in percent after the resize. */
  readonly size: number;
}

/**
 * Content of the gutter of `star-splitter` in place of the default handle (PrimeNG has a
 * `gutterSize` only). It is decorative (`aria-hidden`); the gutter keeps the `separator` role and
 * the keyboard.
 */
@Directive({
  selector: 'ng-template[starSplitterGutter]',
  providers: [{ provide: StarSlot, useExisting: StarSplitterGutter }],
})
export class StarSplitterGutter extends StarSlot<object> {
  readonly name = 'splitterGutter';
}

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
 *
 * Slots (content children): `starSplitterGutter` replaces the handle in the gutter.
 *
 * PrimeNG names that star-ng covers in another way: `panelSizes` = `size` (two panes), `minSizes`
 * = `minSize`, `onResizeStart` / `onResizeEnd` = `resizeStart` / `resizeEnd`, `onResize` =
 * `sizeChange`, `gutterSize` = the CSS of the `gutterPanel` part (`pt`), `panelStyle`,
 * `panelStyleClass` and `styleClass` = `pt`.
 */
@Component({
  selector: 'star-splitter',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarSplitter) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-splitter star-splitter--' + layout()",
    '[class.star-splitter--disabled]': 'disabled()',
    '[style.--star-split]': "size() + '%'",
  },
  template: `
    <div data-star-part="panePanel" class="star-splitter__pane">
      <ng-content select="[starSplitterStart]" />
    </div>
    <div
      data-star-part="gutterPanel"
      class="star-splitter__gutter"
      role="separator"
      [attr.tabindex]="disabled() ? -1 : 0"
      [attr.aria-disabled]="disabled() || null"
      [attr.aria-orientation]="layout() === 'horizontal' ? 'vertical' : 'horizontal'"
      [attr.aria-valuenow]="size()"
      [attr.aria-valuemin]="minSize()"
      [attr.aria-valuemax]="100 - minSize()"
      [attr.aria-label]="ariaLabel() ?? text.resizePanes"
      (pointerdown)="startDrag($event)"
      (keydown)="onKeydown($event)"
      (keyup)="onKeyup($event)"
    >
      @if (gutterSlot(); as custom) {
        <span data-star-part="handle" class="star-splitter__custom" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom" />
        </span>
      } @else {
        <span data-star-part="handle" class="star-splitter__handle" aria-hidden="true"></span>
      }
    </div>
    <div data-star-part="panePanel" class="star-splitter__pane">
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
  /** The gutter does not move (pointer and keyboard). PrimeNG `disabled`. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Percent that one arrow key moves the gutter (default `2`). PrimeNG `step`. */
  readonly step = input(2);
  /**
   * Key under which the size is kept in the storage, so it survives a reload. `null` (default)
   * keeps nothing. PrimeNG `stateKey`.
   */
  readonly stateKey = input<string | null>(null);
  /** Storage of `stateKey`: `'local'` (default) or `'session'`. PrimeNG `stateStorage`. */
  readonly stateStorage = input<'local' | 'session'>('local');
  /** Emits when a drag or a key starts to resize. PrimeNG `onResizeStart`. */
  readonly resizeStart = output<void>();
  /** Emits the new size when a drag ends or a resize key is released. PrimeNG `onResizeEnd`. */
  readonly resizeEnd = output<StarSplitterResizeEvent>();

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly gutterSlot = starSlot<object>(this.slots, this, 'splitterGutter');
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private keyResizing = false;

  constructor() {
    // Restores the kept size after the first render (no storage while the page is prerendered).
    afterNextRender(() => {
      const kept = Number(this.storage()?.getItem(this.stateKey() ?? '') ?? NaN);
      if (this.stateKey() && Number.isFinite(kept) && kept > 0) this.size.set(this.clamp(kept));
    });
  }

  private storage(): Storage | null {
    if (!this.browser || !this.stateKey()) return null;
    try {
      return this.stateStorage() === 'session' ? sessionStorage : localStorage;
    } catch {
      return null;
    }
  }

  private endResize(): void {
    const size = this.size();
    try {
      this.storage()?.setItem(this.stateKey()!, String(size));
    } catch {
      // A full or blocked storage keeps nothing.
    }
    this.resizeEnd.emit({ size });
  }

  private clamp(value: number): number {
    return Math.round(Math.min(100 - this.minSize(), Math.max(this.minSize(), value)) * 10) / 10;
  }

  protected startDrag(event: PointerEvent): void {
    if (this.disabled()) return;
    const gutter = event.currentTarget as HTMLElement;
    gutter.setPointerCapture?.(event.pointerId);
    this.resizeStart.emit();
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
      this.endResize();
    };
    gutter.addEventListener('pointermove', move);
    gutter.addEventListener('pointerup', stop);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const horizontal = this.layout() === 'horizontal';
    // The arrow keys follow the visual direction: the gutter moves left on Arrow left, and the
    // first pane is on the right in right-to-left, so the sign turns.
    const flip = starIsRtl(this.host.nativeElement) ? -1 : 1;
    const step = this.step();
    const delta = {
      ArrowLeft: horizontal ? -step * flip : 0,
      ArrowRight: horizontal ? step * flip : 0,
      ArrowUp: horizontal ? 0 : -step,
      ArrowDown: horizontal ? 0 : step,
    }[event.key];
    const edge = event.key === 'Home' || event.key === 'End';
    if (!delta && !edge) return;
    event.preventDefault();
    if (!this.keyResizing) {
      this.keyResizing = true;
      this.resizeStart.emit();
    }
    if (delta) this.size.set(this.clamp(this.size() + delta));
    else this.size.set(event.key === 'Home' ? this.minSize() : 100 - this.minSize());
  }

  protected onKeyup(event: KeyboardEvent): void {
    if (!this.keyResizing) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      return;
    }
    this.keyResizing = false;
    this.endResize();
  }
}

// ---------------------------------------------------------------- Speed dial and dock

export * from './speed-dial';

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
    <nav data-star-part="navigation" [attr.aria-label]="ariaLabel() ?? text.dock">
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
 *
 * Slots (content children): `starIcon="icon"` replaces the arrow (PrimeNG `#icon`, `icon`).
 *
 * PrimeNG names that star-ng covers in another way: `buttonAriaLabel` = `ariaLabel`,
 * `buttonProps`, `style` and `styleClass` = `pt`. Not applicable: `motionOptions` (theme motion).
 */
@Component({
  selector: 'star-scroll-top',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarScrollTop) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-scroll-top', '[class.star-scroll-top--visible]': 'visible()' },
  template: `
    <button
      data-star-part="topButton"
      type="button"
      class="star-scroll-top__btn"
      [attr.aria-label]="ariaLabel() ?? text.scrollToTop"
      [attr.tabindex]="visible() ? 0 : -1"
      (click)="toTop()"
    >
      @if (icons().get('icon'); as custom) {
        <span data-star-part="topIcon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: iconContext" />
        </span>
      } @else {
        <i data-star-part="topIcon" class="ph-bold ph-arrow-up" aria-hidden="true"></i>
      }
    </button>
  `,
})
export class StarScrollTop {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly threshold = input(400);
  /**
   * Scroll container: an element, `'parent'` (the parent element of the button) or `'window'`.
   * Default the window. PrimeNG `target` (`window` or `parent`).
   */
  readonly target = input<HTMLElement | 'window' | 'parent' | null>(null);
  /** Accessible name of the button (default `STAR_UI_TEXT.scrollToTop`). PrimeNG `buttonAriaLabel`. */
  readonly ariaLabel = input<string | null>(null);
  /** `'smooth'` (default) or `'auto'`; reduced motion always uses `'auto'`. PrimeNG `behavior`. */
  readonly behavior = input<'smooth' | 'auto'>('smooth');
  protected readonly visible = signal(false);
  private readonly doc = inject(DOCUMENT);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};

  /** The scroll container, or `null` for the window. */
  private container(): HTMLElement | null {
    const target = this.target();
    if (target === 'parent') return this.hostElement.parentElement;
    return target === 'window' ? null : target;
  }

  constructor() {
    // The injected document, not the global: the global does not exist when the page is prerendered.
    const doc = this.doc;
    const onScroll = (event: Event) => {
      const el = this.container();
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
    (this.container() ?? this.doc.scrollingElement ?? this.doc.documentElement).scrollTo?.({
      top: 0,
      behavior: reduce ? 'auto' : this.behavior(),
    });
  }
}

/**
 * Block UI (PrimeNG `p-blockui`): while `blocked`, the content is `inert` (no focus, no clicks,
 * hidden from assistive tech) and shows a busy overlay with a spinner.
 * `<star-block-ui [blocked]="saving()">…form…</star-block-ui>`
 *
 * Slots (content children): `starLoading` replaces the spinner and the message on the mask
 * (PrimeNG `#content`). Not applicable: `target` (wrap the blocked content), `autoZIndex` and
 * `baseZIndex` (the mask covers its own box).
 */
@Component({
  selector: 'star-block-ui',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarSpinner, NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarBlockUi) }],
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
      <div data-star-part="maskPanel" class="star-block-ui__mask">
        @if (loadingSlot(); as custom) {
          <ng-container *ngTemplateOutlet="custom" />
        } @else {
          <star-spinner size="2rem" [ariaLabel]="message()" />
          @if (message()) {
            <span data-star-part="messageText" class="star-block-ui__message">{{ message() }}</span>
          }
        }
      </div>
    }
  `,
})
export class StarBlockUi {
  readonly blocked = input(false, { transform: booleanAttribute });
  readonly message = input('');
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly loadingSlot = starSlot<object>(this.slots, this, 'loading');
}

// ---------------------------------------------------------------- Meter group

export interface StarMeterItem {
  readonly label: string;
  readonly value: number;
  /** Phosphor icon class shown in the legend. */
  readonly icon?: string;
}

/** Context of the `label`, `start` and `end` slots of `star-meter-group`. */
export interface StarMeterGroupContext {
  /** The items. */
  readonly $implicit: readonly StarMeterItem[];
  /** Share of each item in percent of the full scale, in item order. */
  readonly percentages: readonly number[];
  /** Sum of the shares in percent. */
  readonly totalPercent: number;
}

/** Context of the `meter` and `icon` slots of `star-meter-group`. */
export interface StarMeterGroupItemContext {
  /** The item. */
  readonly $implicit: StarMeterItem;
  /** Position of the item, from `0`. */
  readonly index: number;
  /** Share of the item in percent of the full scale. */
  readonly percent: number;
  /** Series color of the item (a CSS value). */
  readonly color: string;
}

/**
 * Template slot of `star-meter-group`:
 * - `label`: replaces the legend (PrimeNG `#label`); context `StarMeterGroupContext`.
 * - `start` and `end`: content before and after the bar and the legend (PrimeNG `#start`, `#end`).
 * - `meter`: content inside each part of the bar (PrimeNG `#meter`); context
 *   `StarMeterGroupItemContext`. The part keeps `role="meter"` and its values.
 * - `icon`: the icon of each legend item (PrimeNG `#icon`).
 */
@Directive({
  selector: 'ng-template[starMeterGroupTemplate]',
  providers: [{ provide: StarSlot, useExisting: StarMeterGroupTemplate }],
})
export class StarMeterGroupTemplate extends StarSlot<
  StarMeterGroupContext & StarMeterGroupItemContext
> {
  readonly name = 'meterGroup';
  readonly starMeterGroupTemplate = input.required<'label' | 'meter' | 'start' | 'end' | 'icon'>();

  override slotKey(): string {
    return this.starMeterGroupTemplate();
  }

  static ngTemplateContextGuard(
    _dir: StarMeterGroupTemplate,
    _ctx: unknown,
  ): _ctx is StarMeterGroupContext & StarMeterGroupItemContext {
    return true;
  }
}

/**
 * Meter group (PrimeNG `p-metergroup`): one bar split into parts (fixed series colors, 2px gaps)
 * with a labelled legend. `role="meter"` per part, so each value is announced.
 * `<star-meter-group [items]="storage" [max]="100" unit="GB" ariaLabel="Storage" />`
 *
 * Slots (content children): `starMeterGroupTemplate` with `label`, `meter`, `start`, `end` and
 * `icon`.
 *
 * PrimeNG names that star-ng covers in another way: `value` = `items`. The legend is
 * `aria-hidden`: the meters carry the values.
 */
@Component({
  selector: 'star-meter-group',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarMeterGroup) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-meter-group',
    role: 'group',
    '[attr.aria-label]': 'ariaLabel()',
    '[class.star-meter-group--vertical]': "orientation() === 'vertical'",
    '[class.star-meter-group--label-start]': "labelPosition() === 'start'",
    '[class.star-meter-group--labels-vertical]': "labelOrientation() === 'vertical'",
  },
  template: `
    @if (slots().get('start'); as custom) {
      <div data-star-part="startPanel" class="star-meter-group__start">
        <ng-container *ngTemplateOutlet="custom; context: groupContext()" />
      </div>
    }
    @if (labelPosition() === 'start') {
      <ng-container *ngTemplateOutlet="legend" />
    }
    <div data-star-part="barPanel" class="star-meter-group__bar">
      @for (item of items(); track item.label; let i = $index) {
        <span
          data-star-part="partText"
          class="star-meter-group__part"
          role="meter"
          [attr.aria-label]="item.label"
          [attr.aria-valuemin]="min()"
          [attr.aria-valuemax]="total()"
          [attr.aria-valuenow]="item.value"
          [attr.aria-valuetext]="
            text.meterValue(item.value + (unit() ? ' ' + unit() : ''), total())
          "
          [style.width.%]="orientation() === 'vertical' ? null : percent(item)"
          [style.height.%]="orientation() === 'vertical' ? percent(item) : null"
          [style.background]="color(i)"
        >
          @if (slots().get('meter'); as custom) {
            <ng-container *ngTemplateOutlet="custom; context: itemContext(item, i)" />
          }
        </span>
      }
    </div>
    @if (labelPosition() !== 'start') {
      <ng-container *ngTemplateOutlet="legend" />
    }
    @if (slots().get('end'); as custom) {
      <div data-star-part="endPanel" class="star-meter-group__end">
        <ng-container *ngTemplateOutlet="custom; context: groupContext()" />
      </div>
    }
    <ng-template #legend>
      @if (slots().get('label'); as custom) {
        <div data-star-part="labelPanel" class="star-meter-group__label" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: groupContext()" />
        </div>
      } @else {
        <ul data-star-part="legend" class="star-meter-group__legend" aria-hidden="true">
          @for (item of items(); track item.label; let i = $index) {
            <li data-star-part="legendItem">
              @if (slots().get('icon'); as custom) {
                <span data-star-part="legendIcon" class="star-meter-group__icon">
                  <ng-container *ngTemplateOutlet="custom; context: itemContext(item, i)" />
                </span>
              } @else if (item.icon) {
                <i data-star-part="legendIcon" [class]="item.icon" [style.color]="color(i)"></i>
              } @else {
                <span
                  data-star-part="swatchText"
                  class="star-chart__swatch"
                  [style.background]="color(i)"
                ></span>
              }
              {{ item.label }}
              <strong data-star-part="legendText"
                >{{ item.value }}{{ unit() ? ' ' + unit() : '' }}</strong
              >
            </li>
          }
        </ul>
      }
    </ng-template>
  `,
})
export class StarMeterGroup {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly items = input<readonly StarMeterItem[]>([]);
  /** Full scale; default: the sum of the items. */
  readonly max = input<number | null>(null);
  /** Start of the scale (default `0`). PrimeNG `min`. */
  readonly min = input(0);
  readonly unit = input('');
  readonly ariaLabel = input<string | null>(null);
  /** Direction of the bar: `'horizontal'` (default) or `'vertical'`. PrimeNG `orientation`. */
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  /** Side of the legend: `'end'` (default, after the bar) or `'start'`. PrimeNG `labelPosition`. */
  readonly labelPosition = input<'start' | 'end'>('end');
  /** Flow of the legend items: `'horizontal'` (default) or `'vertical'`. PrimeNG `labelOrientation`. */
  readonly labelOrientation = input<'horizontal' | 'vertical'>('horizontal');

  private readonly contentSlots = contentChildren(StarSlot, { descendants: true });
  protected readonly slots = starSlotMap<unknown>(this.contentSlots, this, 'meterGroup');

  protected readonly total = computed(
    () => this.max() ?? (this.items().reduce((sum, item) => sum + item.value, 0) || 1),
  );
  protected percent(item: StarMeterItem): number {
    const range = this.total() - this.min() || 1;
    return Math.max(0, Math.min(100, ((item.value - this.min()) / range) * 100));
  }
  protected readonly groupContext = computed<StarMeterGroupContext>(() => {
    const percentages = this.items().map((item) => Math.round(this.percent(item) * 100) / 100);
    return {
      $implicit: this.items(),
      percentages,
      totalPercent: Math.round(percentages.reduce((sum, value) => sum + value, 0) * 100) / 100,
    };
  });
  protected itemContext(item: StarMeterItem, index: number): StarMeterGroupItemContext {
    return {
      $implicit: item,
      index,
      percent: Math.round(this.percent(item) * 100) / 100,
      color: this.color(index),
    };
  }
  protected color(index: number): string {
    return `var(--star-chart-${(index % 8) + 1})`;
  }
}
