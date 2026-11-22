import { _IdGenerator } from '@angular/cdk/a11y';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  DOCUMENT,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  model,
  numberAttribute,
  output,
  PLATFORM_ID,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarIconContext,
  starIsRtl,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarMenuItem } from '@star-ng/ui/menu';

/** Where the actions of `star-speed-dial` go. The `up-left` … `down-right` values are for `quarter-circle`. */
export type StarSpeedDialDirection =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'start'
  | 'end'
  | 'up-left'
  | 'up-right'
  | 'down-left'
  | 'down-right';

/** Layout of the actions: a row or column, or on a circle, a half circle or a quarter circle. */
export type StarSpeedDialType = 'linear' | 'circle' | 'semi-circle' | 'quarter-circle';

/** Context of the `starSpeedDialTemplate` slots. */
export interface StarSpeedDialContext {
  /** `item` slot: the action. `button` slot: `undefined`. */
  readonly $implicit?: StarMenuItem;
  /** `item` slot: the index of the action. */
  readonly index?: number;
  /** The actions are shown. */
  readonly visible: boolean;
}

/**
 * Replaces content of `star-speed-dial`: `button` (the content of the main button) or `item` (the
 * content of an action button). PrimeNG `#button` and `#item` templates. The buttons stay, with
 * their names: put no focusable elements in the templates.
 */
@Directive({
  selector: 'ng-template[starSpeedDialTemplate]',
  providers: [{ provide: StarSlot, useExisting: StarSpeedDialTemplate }],
})
export class StarSpeedDialTemplate extends StarSlot<StarSpeedDialContext> {
  readonly name = 'speedDial';
  readonly starSpeedDialTemplate = input.required<'button' | 'item'>();

  override slotKey(): string {
    return this.starSpeedDialTemplate();
  }

  static ngTemplateContextGuard(
    _dir: StarSpeedDialTemplate,
    _ctx: unknown,
  ): _ctx is StarSpeedDialContext {
    return true;
  }
}

const DEFAULT_ICON = 'ph-bold ph-plus';
/** Radius of a circular layout when `radius` is 0, in pixels. */
const DEFAULT_RADIUS = 80;

/**
 * Offsets in pixels of `count` actions on a circle of `radius` around the main button.
 * `circle` spreads them over the full turn from the top; `semi-circle` and `quarter-circle`
 * spread them over half or a quarter of a turn toward `side`. @internal
 */
export function ɵstarSpeedDialOffsets(
  count: number,
  type: Exclude<StarSpeedDialType, 'linear'>,
  side: string,
  radius: number,
): { x: number; y: number }[] {
  const PI = Math.PI;
  // Start angle and span, in screen coordinates (y grows downward, 0 is to the right).
  const spans: Record<string, [number, number]> = {
    up: [PI, PI],
    down: [0, PI],
    left: [PI / 2, PI],
    right: [-PI / 2, PI],
    'up-left': [PI, PI / 2],
    'up-right': [(3 * PI) / 2, PI / 2],
    'down-left': [PI / 2, PI / 2],
    'down-right': [0, PI / 2],
  };
  let [start, span] = spans[side] ?? spans['up'];
  if (type === 'circle') [start, span] = [-PI / 2, 2 * PI];
  const steps = type === 'circle' ? count : Math.max(count - 1, 1);
  return Array.from({ length: count }, (_, i) => {
    const angle = start + (span / steps) * (count === 1 && type !== 'circle' ? 0.5 * steps : i);
    const round = (value: number) => Math.round(value * 100) / 100 || 0;
    return { x: round(radius * Math.cos(angle)), y: round(radius * Math.sin(angle)) };
  });
}

/**
 * Speed dial (PrimeNG `p-speeddial`): floating action button that opens a short list of actions:
 * in a line (up, down, left, right, start, end) or on a circle, a half circle or a quarter circle.
 * `aria-expanded`, Escape closes, focus moves to the first action.
 * `<star-speed-dial [items]="quickActions" direction="up" ariaLabel="Quick actions" />`
 *
 * `left` and `right` are the physical sides of the screen, as in CSS. `start` and `end` follow the
 * writing direction (`start` is the left side in LTR and the right side in RTL). The arrow keys
 * move along the visual direction of the list (on a circle: Arrow down and Arrow right go to the
 * next action, Arrow up and Arrow left to the previous one).
 *
 * Slots (content children): `starSpeedDialTemplate` with `button` and `item`; `starIcon="icon"`
 * replaces the icon of the main button.
 *
 * PrimeNG names that star-ng covers in another way: `model` = `items`, `onVisibleChange` =
 * `visibleChange` of the `visible` model, `onClick` = `pressed`, `id` = the `id` attribute of the
 * host, `style`, `className`, `buttonStyle`, `buttonClassName`, `maskStyle`, `maskClassName` and
 * `buttonProps` = `pt` (parts `triggerButton`, `maskPanel`) and the `class` and `style` of the
 * host, `tooltipOptions` = each action shows its label as a native tooltip (`title`).
 */
@Component({
  selector: 'star-speed-dial',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarSpeedDial) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-speed-dial star-speed-dial--' + direction()",
    '[class.star-speed-dial--open]': 'visible()',
    '[class.star-speed-dial--sm]': "size() === 'sm'",
    '[class.star-speed-dial--static]': '!turns()',
    '[class.star-speed-dial--circular]': "type() !== 'linear'",
    '[class.star-speed-dial--masked]': 'mask() && visible()',
    '[style.--star-speed-dial-delay]': "transitionDelay() + 'ms'",
    '(keydown.escape)': 'close(true)',
    '(keydown)': 'onArrow($event)',
  },
  template: `
    @if (mask() && visible()) {
      <div data-star-part="maskPanel" class="star-speed-dial__mask"></div>
    }
    <button
      data-star-part="triggerButton"
      #fab
      type="button"
      class="star-speed-dial__fab"
      aria-haspopup="true"
      [disabled]="disabled()"
      [attr.aria-expanded]="visible()"
      [attr.aria-controls]="listId"
      [attr.aria-label]="ariaLabelledBy() ? null : (ariaLabel() ?? text.actions)"
      [attr.aria-labelledby]="ariaLabelledBy()"
      (click)="pressed.emit($event); toggle(list)"
    >
      @if (templates().get('button'); as custom) {
        <ng-container *ngTemplateOutlet="custom; context: { visible: visible() }" />
      } @else if (icons().get('icon'); as custom) {
        <span data-star-part="triggerIcon" class="star-speed-dial__icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: iconContext" />
        </span>
      } @else {
        <i data-star-part="triggerIcon" [class]="currentIcon()" aria-hidden="true"></i>
      }
    </button>
    <ul
      data-star-part="list"
      #list
      class="star-speed-dial__list"
      [id]="listId"
      [attr.inert]="visible() ? null : ''"
    >
      @for (item of items(); track $index; let i = $index) {
        <li
          data-star-part="listItem"
          [style.--star-i]="i"
          [style.translate]="offsets()[i] ? offsets()[i].x + 'px ' + offsets()[i].y + 'px' : null"
        >
          <button
            data-star-part="actionButton"
            type="button"
            class="star-speed-dial__action"
            [class.star-speed-dial__action--active]="i === activeIndex()"
            [attr.aria-pressed]="activeIndex() === null ? null : i === activeIndex()"
            [attr.aria-label]="item.label"
            [attr.title]="item.label"
            [disabled]="item.disabled"
            (click)="run(item); close(true, fab)"
          >
            @if (templates().get('item'); as custom) {
              <ng-container
                *ngTemplateOutlet="
                  custom;
                  context: { $implicit: item, index: i, visible: visible() }
                "
              />
            } @else {
              <i
                data-star-part="actionIcon"
                [class]="item.icon ?? 'ph-bold ph-circle'"
                aria-hidden="true"
              ></i>
            }
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
  private readonly doc = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly items = input<readonly StarMenuItem[]>([]);
  /** Where the actions go. `up-left`, `up-right`, `down-left`, `down-right`: for `quarter-circle`. */
  readonly direction = input<StarSpeedDialDirection>('up');
  readonly ariaLabel = input<string | null>(null);
  /** Id of an element that names the main button (instead of `ariaLabel`). */
  readonly ariaLabelledBy = input<string | null>(null);
  /** Icon of the main button. With another icon than the default, the button does not turn. PrimeNG `showIcon`. */
  readonly icon = input(DEFAULT_ICON);
  /** Icon of the main button while the actions show (then the button does not turn). PrimeNG `hideIcon`. */
  readonly hideIcon = input<string | null>(null);
  /** The default icon turns while the actions show (default `true`). PrimeNG `rotateAnimation`. */
  readonly rotateAnimation = input(true, { transform: booleanAttribute });
  readonly size = input<'sm' | 'md'>('md');
  /** Index of the item that is the current choice (a set of options, for example a theme). */
  readonly activeIndex = input<number | null>(null);
  /** The actions show. Two-way: `[(visible)]`. PrimeNG `visible` and `onVisibleChange`. */
  readonly visible = model(false);
  /** Layout of the actions (default `'linear'`). PrimeNG `type`. */
  readonly type = input<StarSpeedDialType>('linear');
  /** Radius in pixels of a circular layout (default: 80). PrimeNG `radius`. */
  readonly radius = input(0, { transform: numberAttribute });
  /** Delay in milliseconds between the actions when they appear (default 30). */
  readonly transitionDelay = input(30, { transform: numberAttribute });
  /** A scrim behind the open actions; a click on it closes them. PrimeNG `mask`. */
  readonly mask = input(false, { transform: booleanAttribute });
  /** A click outside the speed dial closes it (default `true`). PrimeNG `hideOnClickOutside`. */
  readonly hideOnClickOutside = input(true, { transform: booleanAttribute });
  /** Turns off the main button. */
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly itemClick = output<StarMenuItem>();
  /** Emits a click on the main button. PrimeNG `onClick`. */
  readonly pressed = output<MouseEvent>();
  /**
   * Emits when the actions show after a user action (the main button). A change of `visible` by
   * the owner emits `visibleChange` only, and does not move the focus. PrimeNG `onShow`.
   */
  readonly show = output<void>();
  /**
   * Emits when the actions hide after a user action (main button, action, Escape, click outside,
   * mask). PrimeNG `onHide`.
   */
  readonly hide = output<void>();

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly templates = starSlotMap<StarSpeedDialContext>(this.slots, this, 'speedDial');
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};
  protected readonly turns = computed(
    () => this.rotateAnimation() && this.icon() === DEFAULT_ICON && !this.hideIcon(),
  );
  protected readonly currentIcon = computed(() =>
    this.visible() && this.hideIcon() ? this.hideIcon()! : this.icon(),
  );
  /** Pixel offsets of the actions in a circular layout; empty for `linear`. */
  protected readonly offsets = computed(() => {
    const type = this.type();
    if (type === 'linear') return [];
    return ɵstarSpeedDialOffsets(
      this.items().length,
      type,
      this.side(),
      this.radius() || DEFAULT_RADIUS,
    );
  });

  constructor() {
    // A pointer press outside (`hideOnClickOutside`) or on the mask closes the actions. The
    // listener exists only while they show. Escape closes them from the keyboard.
    effect((onCleanup) => {
      const outside = this.hideOnClickOutside();
      if (!this.browser || !this.visible() || (!outside && !this.mask())) return;
      const listener = (event: Event) => {
        const target = event.target as Element | null;
        if (target?.classList?.contains('star-speed-dial__mask')) this.close();
        else if (outside && !this.host.nativeElement.contains(target)) this.close();
      };
      this.doc.addEventListener('pointerdown', listener, true);
      onCleanup(() => this.doc.removeEventListener('pointerdown', listener, true));
    });
  }

  /** The physical side of `direction`: `start` and `end` resolve with the writing direction. */
  private side(): string {
    const direction = this.direction();
    if (direction !== 'start' && direction !== 'end') return direction;
    const rtl = starIsRtl(this.host.nativeElement);
    return (direction === 'start') !== rtl ? 'left' : 'right';
  }

  protected toggle(list: HTMLElement): void {
    if (this.visible()) {
      this.close();
      return;
    }
    this.visible.set(true);
    this.show.emit();
    // Focus after render: the list is inert until the view updates.
    afterNextRender(() => list.querySelector<HTMLButtonElement>('button')?.focus(), {
      injector: this.injector,
    });
  }

  close(restoreFocus = false, fab?: HTMLElement): void {
    if (!this.visible()) return;
    this.visible.set(false);
    this.hide.emit();
    if (restoreFocus)
      (fab ?? this.host.nativeElement.querySelector<HTMLElement>('.star-speed-dial__fab'))?.focus();
  }

  /**
   * Arrow keys along the direction of the list move the focus between the actions (added
   * to the source control, which only used Tab). Home and End go to the first and last action.
   */
  protected onArrow(event: KeyboardEvent): void {
    if (!this.visible()) return;
    const side = this.type() === 'linear' ? this.side() : 'circle';
    const keys: Record<string, [string[], string[]]> = {
      up: [['ArrowUp'], ['ArrowDown']],
      down: [['ArrowDown'], ['ArrowUp']],
      left: [['ArrowLeft'], ['ArrowRight']],
      right: [['ArrowRight'], ['ArrowLeft']],
    };
    const [forward, backward] = keys[side] ?? [
      ['ArrowDown', 'ArrowRight'],
      ['ArrowUp', 'ArrowLeft'],
    ];
    const isForward = forward.includes(event.key);
    const isBackward = backward.includes(event.key);
    if (!isForward && !isBackward && event.key !== 'Home' && event.key !== 'End') return;
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
    else if (isForward) next = current < 0 ? 0 : Math.min(last, current + 1);
    else next = current < 0 ? last : Math.max(0, current - 1);
    actions[next].focus();
  }

  protected run(item: StarMenuItem): void {
    item.command?.(item);
    this.itemClick.emit(item);
  }
}
