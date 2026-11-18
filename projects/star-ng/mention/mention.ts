import { _IdGenerator } from '@angular/cdk/a11y';
import { Directionality } from '@angular/cdk/bidi';
import {
  ConnectedPosition,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
  FlexibleConnectedPositionStrategy,
  OverlayRef,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  numberAttribute,
  output,
  signal,
  TemplateRef,
  untracked,
  ViewContainerRef,
} from '@angular/core';
import {
  optionText,
  STAR_UI_TEXT,
  StarDirectionService,
  starFilterMatch,
  StarFilterMatchMode,
  StarOptionKey,
} from '@star-ng/ui/core';

/** Event of `mentionSearch`: the trigger and the text typed after it. */
export interface StarMentionSearchEvent {
  readonly trigger: string;
  readonly query: string;
}

/** Event of `mentionSelect`: the trigger and the chosen suggestion. */
export interface StarMentionSelectEvent<T> {
  readonly trigger: string;
  readonly item: T;
}

/** A mention found in the text: `trigger + label` from `start` (the trigger) to `end` (exclusive). */
export interface StarMentionMatch<T> {
  readonly trigger: string;
  readonly label: string;
  readonly item: T;
  readonly start: number;
  readonly end: number;
}

/** A mention that `starMentionsIn` looks for. */
export interface StarMentionCandidate<T> {
  readonly trigger: string;
  readonly label: string;
  readonly item: T;
}

/** A function that returns the suggestions for a query, at once or later. */
export type StarMentionSource<T> = (
  query: string,
  trigger: string,
) => readonly T[] | Promise<readonly T[]>;

/** Context of the `ng-template[starMentionItem]` slot. */
export interface StarMentionItemContext<T> {
  /** The suggestion (`let-item`). */
  readonly $implicit: T;
  /** `true` for the active suggestion. */
  readonly active: boolean;
  /** The text typed after the trigger. */
  readonly query: string;
}

/** The trigger that the caret is in: its position and the text typed after it. */
interface MentionContext {
  readonly trigger: string;
  readonly start: number;
  readonly query: string;
}

/** Longest text after a trigger that still counts as a query. */
const MAX_QUERY = 50;
/** Characters before a trigger that start a mention (besides the start of the text). */
const BEFORE_TRIGGER = /[\s([{"'“‘«]/u;
/** A mention ends where no letter, digit or underscore follows. */
const WORD_CHAR = /[\p{L}\p{N}_]/u;

const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

/** Styles that change where text wraps: the mirror element copies them. */
const MIRROR_STYLES = [
  'direction',
  'box-sizing',
  'width',
  'height',
  'overflow-x',
  'overflow-y',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-style',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'font-style',
  'font-variant',
  'font-weight',
  'font-stretch',
  'font-size',
  'font-size-adjust',
  'line-height',
  'font-family',
  'text-align',
  'text-transform',
  'text-indent',
  'text-decoration',
  'letter-spacing',
  'word-spacing',
  'tab-size',
];

/**
 * Position of the caret at `position` inside a `textarea` or `input`, relative to the border box
 * of the element (before its scroll offset), and the line height. A hidden mirror `div` with the
 * same text styles holds the text up to the caret and a marker; the marker's offset is the caret.
 * Browser only: it needs layout.
 */
export function starCaretCoordinates(
  element: HTMLTextAreaElement | HTMLInputElement,
  position: number,
): { top: number; left: number; height: number } {
  const doc = element.ownerDocument;
  const style = doc.defaultView!.getComputedStyle(element);
  const isInput = element.nodeName === 'INPUT';
  const mirror = doc.createElement('div');
  mirror.className = 'star-mention-mirror';
  for (const name of MIRROR_STYLES) {
    mirror.style.setProperty(name, style.getPropertyValue(name));
  }
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.whiteSpace = isInput ? 'pre' : 'pre-wrap';
  mirror.style.overflowWrap = isInput ? 'normal' : 'break-word';
  mirror.textContent = element.value.slice(0, position);
  const marker = doc.createElement('span');
  // The rest of the text keeps the wrap of the last line as it is in the field.
  marker.textContent = element.value.slice(position) || '.';
  mirror.append(marker);
  doc.body.append(mirror);
  const fontSize = parseFloat(style.fontSize) || 16;
  const height = parseFloat(style.lineHeight) || Math.round(fontSize * 1.25);
  const result = {
    top: marker.offsetTop + (parseFloat(style.borderTopWidth) || 0),
    left: marker.offsetLeft + (parseFloat(style.borderLeftWidth) || 0),
    height,
  };
  mirror.remove();
  return result;
}

/**
 * Every whole mention of a candidate in `text`: `trigger + label` at the start of the text or after
 * a space or an opening bracket or quote, and not followed by a letter or a digit. Sorted by start.
 */
export function starMentionsIn<T>(
  text: string,
  candidates: readonly StarMentionCandidate<T>[],
): StarMentionMatch<T>[] {
  const found: StarMentionMatch<T>[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const token = candidate.trigger + candidate.label;
    if (!candidate.label || seen.has(token)) continue;
    seen.add(token);
    let at = text.indexOf(token);
    while (at >= 0) {
      const end = at + token.length;
      const startsWord = at === 0 || BEFORE_TRIGGER.test(text[at - 1]);
      const endsWord = end === text.length || !WORD_CHAR.test(text[end]);
      if (startsWord && endsWord) {
        found.push({ ...candidate, start: at, end });
      }
      at = text.indexOf(token, at + 1);
    }
  }
  return found.sort((a, b) => a.start - b.start || b.end - a.end);
}

/** The trigger that the caret is in, or `null`. */
function findTrigger(
  value: string,
  caret: number,
  triggers: readonly string[],
): MentionContext | null {
  const from = Math.max(0, caret - MAX_QUERY - 1);
  for (let i = caret - 1; i >= from; i--) {
    const char = value[i];
    if (/\s/.test(char)) return null;
    const trigger = triggers.find((t) => t && value.startsWith(t, i));
    if (trigger && (i === 0 || BEFORE_TRIGGER.test(value[i - 1]))) {
      const query = value.slice(i + trigger.length, caret);
      return query.length <= MAX_QUERY ? { trigger, start: i, query } : null;
    }
  }
  return null;
}

/** Label text that is safe to insert: one line, no control characters. */
function plainLabel(label: string): string {
  return (
    label
      .replace(/[\r\n\t\u2028\u2029]+/g, ' ')
      .replace(/\p{Cc}/gu, '')
      // Bidi embedding, override and isolate marks can flip how the text around the mention reads.
      .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
      .trim()
  );
}

/**
 * Mentions in a text field (Syncfusion `ejs-mention`; PrimeNG has the mention pattern in its
 * autocomplete examples, Kendo UI and Ignite UI have none): type a trigger such as `@` or `#` at the start of a word, and a list of suggestions
 * opens at the caret. Enter, Tab or a click inserts `trigger + label + ' '` as plain text.
 *
 * Put it on a `textarea` or an `input`. It does not support `contenteditable` (for example
 * `star-editor`). The value stays in the field, so `[formField]`, `[(ngModel)]` and
 * `formControlName` work as without it: an insertion fires an `input` event.
 *
 * Accessibility: the field keeps its role. While the list shows, it gets `aria-controls` and
 * `aria-activedescendant` (the active option of the `listbox`); `aria-autocomplete="list"` is set
 * always. Arrow down and Arrow up move, Enter or Tab inserts, Escape closes.
 *
 * ```html
 * <textarea aria-label="Comment" starMention [suggestions]="people" optionLabel="name"
 *   [triggers]="['@', '#']" (mentionSelect)="mentioned($event)"></textarea>
 * ```
 */
@Directive({
  selector: 'textarea[starMention], input[starMention]',
  exportAs: 'starMention',
  host: {
    class: 'star-mention',
    'aria-autocomplete': 'list',
    '[attr.aria-controls]': 'activeId() ? listId : null',
    '[attr.aria-activedescendant]': 'activeId()',
    '(input)': 'onInput()',
    '(keydown)': 'onKeydown($event)',
    '(keyup)': 'onKeyup($event)',
    '(click)': 'evaluate()',
    '(focus)': 'refresh()',
    '(blur)': 'onBlur()',
  },
})
export class StarMention<T = unknown> {
  private readonly host = inject<ElementRef<HTMLTextAreaElement | HTMLInputElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly directionality = inject(Directionality);

  /** Characters that start a mention. Default `['@']`, for example `['@', '#']`. */
  readonly triggers = input<readonly string[]>(['@']);
  /**
   * The suggestions: an array that the typed text filters (by the label, `filterMatchMode`), or a
   * function `(query, trigger) => T[] | Promise<T[]>` that returns them (for a server search).
   */
  readonly suggestions = input<readonly T[] | StarMentionSource<T>>([]);
  /** Property or function that gives the text of a suggestion. Default: the suggestion itself. */
  readonly optionLabel = input<StarOptionKey<T> | null>(null);
  /** How the typed text filters an array of suggestions (accent and case insensitive). */
  readonly filterMatchMode = input<StarFilterMatchMode>('contains');
  /** Most suggestions shown at once. */
  readonly maxSuggestions = input(10, { transform: numberAttribute });

  /** Emits when the user types after a trigger: the trigger and the text typed after it. */
  readonly mentionSearch = output<StarMentionSearchEvent>();
  /** Emits after a suggestion was inserted. */
  readonly mentionSelect = output<StarMentionSelectEvent<T>>();

  /** Id of the suggestion list. */
  readonly listId = inject(_IdGenerator).getId('star-mention-list-');
  /** The suggestions shown. */
  readonly items = signal<readonly T[]>([]);
  /** `true` while a function source has not answered. */
  readonly loading = signal(false);
  /** Index of the active suggestion. */
  readonly active = signal(0);
  /** The item template (`ng-template[starMentionItem]`). */
  readonly template = signal<TemplateRef<StarMentionItemContext<T>> | null>(null);

  private readonly context = signal<MentionContext | null>(null);
  /** `true` while the suggestion panel shows. */
  readonly isOpen = computed(() => this.context() !== null);
  /** The text typed after the trigger, `''` while closed. */
  readonly query = computed(() => this.context()?.query ?? '');
  /** Id of the active option, `null` while closed or empty. */
  readonly activeId = computed(() =>
    this.isOpen() && this.items().length ? this.optionId(this.active()) : null,
  );

  private readonly text = signal('');
  private readonly inserted = signal<readonly StarMentionCandidate<T>[]>([]);
  /**
   * The mentions in the text: the inserted ones, and mentions of an array of suggestions that were
   * already in the text. It follows user input; call `refresh()` after a change of the value in code.
   */
  readonly mentions = computed(() => {
    const source = this.suggestions();
    const candidates = [...this.inserted()];
    if (Array.isArray(source)) {
      for (const trigger of this.triggers()) {
        for (const item of source as readonly T[]) {
          candidates.push({ trigger, label: plainLabel(this.labelOf(item)), item });
        }
      }
    }
    return starMentionsIn(this.text(), candidates);
  });

  private overlayRef: OverlayRef | null = null;
  private scrollListening = false;
  private strategy: FlexibleConnectedPositionStrategy | null = null;
  /** Increments for every search, so a late answer for an older query is dropped. */
  private searchId = 0;
  /** The trigger position that Escape closed: it does not open again until the caret leaves it. */
  private dismissedAt: number | null = null;

  constructor() {
    inject(StarDirectionService);
    // A new array of suggestions (for example loaded on mentionSearch) refreshes the open list.
    effect(() => {
      const source = this.suggestions();
      untracked(() => {
        const context = this.context();
        if (context && Array.isArray(source)) this.applyArray(source as readonly T[], context);
      });
    });
    afterNextRender(() => this.refresh());
    inject(DestroyRef).onDestroy(() => {
      this.listenToScroll(false);
      this.overlayRef?.dispose();
    });
  }

  /** Text of a suggestion. */
  labelOf(item: T): string {
    return optionText(item, this.optionLabel());
  }

  /** Id of the option at `index`. */
  optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  /** Reads the field again (text for `mentions`). */
  refresh(): void {
    this.text.set(this.host.nativeElement.value);
  }

  /** Inserts the suggestion at the trigger and closes the list. */
  select(item: T): void {
    const context = this.context();
    if (!context) return;
    const field = this.host.nativeElement;
    const label = plainLabel(this.labelOf(item));
    const end = context.start + context.trigger.length + context.query.length;
    const before = field.value.slice(0, context.start);
    const insert = `${context.trigger}${label} `;
    field.value = before + insert + field.value.slice(end);
    const caret = before.length + insert.length;
    field.setSelectionRange?.(caret, caret);
    this.inserted.update((list) => [...list, { trigger: context.trigger, label, item }]);
    this.close();
    // Forms and other listeners see the new value as user input.
    field.dispatchEvent(new Event('input', { bubbles: true }));
    this.mentionSelect.emit({ trigger: context.trigger, item });
  }

  /** Closes the suggestion list. */
  close(): void {
    this.searchId++;
    this.context.set(null);
    this.items.set([]);
    this.loading.set(false);
    this.listenToScroll(false);
    this.overlayRef?.detach();
  }

  /** Pointer over an option. */
  hover(index: number): void {
    this.active.set(index);
  }

  protected onInput(): void {
    this.refresh();
    this.evaluate();
  }

  protected onBlur(): void {
    this.dismissedAt = null;
    this.close();
  }

  /** Opens, updates or closes the list for the caret position. */
  protected evaluate(): void {
    const field = this.host.nativeElement;
    const caret = field.selectionStart ?? field.value.length;
    const context =
      field.selectionEnd === caret ? findTrigger(field.value, caret, this.triggers()) : null;
    if (!context) {
      this.dismissedAt = null;
      if (this.isOpen()) this.close();
      return;
    }
    if (context.start === this.dismissedAt) return;
    this.dismissedAt = null;
    const previous = this.context();
    if (
      previous &&
      previous.start === context.start &&
      previous.trigger === context.trigger &&
      previous.query === context.query
    ) {
      return;
    }
    this.context.set(context);
    this.active.set(0);
    this.mentionSearch.emit({ trigger: context.trigger, query: context.query });
    this.search(context);
    this.show(context);
  }

  private search(context: MentionContext): void {
    const source = this.suggestions();
    if (Array.isArray(source)) {
      this.applyArray(source as readonly T[], context);
      return;
    }
    const id = ++this.searchId;
    const result = (source as StarMentionSource<T>)(context.query, context.trigger);
    if (typeof (result as { then?: unknown } | null)?.then === 'function') {
      this.loading.set(true);
      (result as Promise<readonly T[]>).then(
        (items) => {
          if (id !== this.searchId) return;
          this.loading.set(false);
          this.setItems(items ?? []);
        },
        () => {
          if (id !== this.searchId) return;
          this.loading.set(false);
          this.setItems([]);
        },
      );
    } else {
      this.loading.set(false);
      this.setItems(result as readonly T[]);
    }
  }

  private applyArray(source: readonly T[], context: MentionContext): void {
    this.loading.set(false);
    this.setItems(
      source.filter((item) =>
        starFilterMatch(this.labelOf(item), context.query, this.filterMatchMode()),
      ),
    );
  }

  private setItems(items: readonly T[]): void {
    this.items.set(items.slice(0, Math.max(1, this.maxSuggestions())));
    this.active.update((index) => Math.min(index, Math.max(0, this.items().length - 1)));
  }

  /** Attaches the panel at the caret, or moves it there. */
  /** The caret of the trigger in viewport coordinates, and whether it is inside the field box. */
  private caretOrigin(context: MentionContext) {
    const field = this.host.nativeElement;
    const caret = starCaretCoordinates(field, context.start);
    const rect = field.getBoundingClientRect();
    const origin = {
      x: rect.left + caret.left - field.scrollLeft,
      y: rect.top + caret.top - field.scrollTop,
      width: 0,
      height: caret.height,
    };
    const box = this.visibleBox(rect);
    const visible =
      origin.y + origin.height > box.top &&
      origin.y < box.bottom &&
      origin.x >= box.left &&
      origin.x <= box.right;
    return { origin, visible };
  }

  /** The part of the field box that the viewport and the scrolling ancestors do not clip. */
  private visibleBox(rect: DOMRect) {
    const field = this.host.nativeElement;
    const view = field.ownerDocument.defaultView;
    const box = { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    const clip = (other: { top: number; bottom: number; left: number; right: number }) => {
      box.top = Math.max(box.top, other.top);
      box.bottom = Math.min(box.bottom, other.bottom);
      box.left = Math.max(box.left, other.left);
      box.right = Math.min(box.right, other.right);
    };
    if (view) clip({ top: 0, left: 0, bottom: view.innerHeight, right: view.innerWidth });
    for (let parent = field.parentElement; parent && view; parent = parent.parentElement) {
      const overflow = view.getComputedStyle(parent);
      if (/(auto|scroll|hidden|clip)/.test(overflow.overflowX + overflow.overflowY)) {
        clip(parent.getBoundingClientRect());
      }
    }
    return box;
  }

  /** A scroll of the page, a container or the field: follow the caret, or close when it is hidden. */
  private readonly onScroll = (): void => {
    const context = this.context();
    if (!context || !this.overlayRef?.hasAttached()) return;
    const { origin, visible } = this.caretOrigin(context);
    if (!visible) {
      this.close();
      return;
    }
    this.strategy?.setOrigin(origin);
    this.overlayRef.updatePosition();
  };

  private listenToScroll(on: boolean): void {
    const doc = this.host.nativeElement.ownerDocument;
    if (on === this.scrollListening) return;
    this.scrollListening = on;
    // Capture: a scroll event does not bubble, so this catches every scrolling container.
    if (on) doc.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    else doc.removeEventListener('scroll', this.onScroll, { capture: true });
  }

  private show(context: MentionContext): void {
    const { origin } = this.caretOrigin(context);
    if (!this.overlayRef) {
      this.strategy = createFlexibleConnectedPositionStrategy(this.injector, origin)
        .withPositions(POSITIONS)
        .withPush(true)
        .withViewportMargin(8);
      this.overlayRef = createOverlayRef(this.injector, {
        positionStrategy: this.strategy,
        scrollStrategy: createRepositionScrollStrategy(this.injector),
        direction: this.directionality,
        usePopover: true,
      });
    } else {
      this.strategy?.setOrigin(origin);
    }
    if (!this.overlayRef.hasAttached()) {
      const panel = this.overlayRef.attach(
        new ComponentPortal(StarMentionPanel, this.viewContainer, this.injector),
      );
      panel.setInput('owner', this);
    }
    this.overlayRef.updatePosition();
    this.listenToScroll(true);
  }

  protected onKeydown(raw: Event): void {
    const event = raw as KeyboardEvent;
    if (!this.isOpen() || event.isComposing) return;
    const count = this.items().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (!count) return;
        event.preventDefault();
        this.active.update(
          (index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + count) % count,
        );
        return;
      case 'Enter':
      case 'Tab':
        if (!count || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        event.preventDefault();
        this.select(this.items()[this.active()]);
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.dismissedAt = this.context()?.start ?? null;
        this.close();
        return;
    }
  }

  protected onKeyup(raw: Event): void {
    const event = raw as KeyboardEvent;
    // Keys that move the caret may leave the mention or enter another one.
    const moves = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (moves.includes(event.key) || (!this.isOpen() && /^Arrow(Up|Down)$/.test(event.key))) {
      this.evaluate();
    }
  }

  /** Called by the slot directive. */
  registerTemplate(template: TemplateRef<StarMentionItemContext<T>> | null): void {
    this.template.set(template);
  }
}

/**
 * Content of each suggestion of `starMention`. Name the field with a template reference:
 * `<textarea starMention #m="starMention">` and `<ng-template [starMentionItem]="m" let-item>`.
 */
@Directive({ selector: 'ng-template[starMentionItem]' })
export class StarMentionItemTemplate<T = unknown> {
  /** The `starMention` field this template belongs to. */
  readonly starMentionItem = input.required<StarMention<T>>();
  private readonly template = inject<TemplateRef<StarMentionItemContext<T>>>(TemplateRef);

  constructor() {
    effect((onCleanup) => {
      const owner = this.starMentionItem();
      owner.registerTemplate(this.template);
      onCleanup(() => owner.registerTemplate(null));
    });
  }

  static ngTemplateContextGuard<T>(
    _dir: StarMentionItemTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarMentionItemContext<T> {
    return true;
  }
}

/** The suggestion panel of `starMention`. Internal: the directive attaches it at the caret. */
@Component({
  selector: 'star-mention-panel',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let mention = owner();
    <!-- The field keeps the focus: a press in the panel must not blur it. -->
    <div class="star-panel star-mention__panel" (mousedown)="$event.preventDefault()">
      @if (mention.items().length) {
        <ul
          class="star-listbox star-mention__list"
          role="listbox"
          [id]="mention.listId"
          [attr.aria-label]="text.mentionSuggestions"
        >
          @for (item of mention.items(); track $index; let i = $index) {
            @let active = i === mention.active();
            <!-- Keys are handled on the field through aria-activedescendant. -->
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
            <li
              class="star-listbox__option"
              role="option"
              [id]="mention.optionId(i)"
              [class.star-listbox__option--active]="active"
              [attr.aria-selected]="active"
              (mousemove)="mention.hover(i)"
              (click)="mention.select(item)"
            >
              @if (mention.template(); as template) {
                <ng-container
                  *ngTemplateOutlet="
                    template;
                    context: { $implicit: item, active: active, query: mention.query() }
                  "
                />
              } @else {
                <span class="star-listbox__label">{{ mention.labelOf(item) }}</span>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="star-listbox__empty star-mention__message">
          {{ mention.loading() ? text.loading : text.emptyFilterMessage }}
        </p>
      }
      <p class="star-sr-only" aria-live="polite">{{ status() }}</p>
    </div>
  `,
})
export class StarMentionPanel {
  protected readonly text = inject(STAR_UI_TEXT);
  /** The directive that owns the panel. */
  readonly owner = input.required<StarMention<unknown>>();
  protected readonly status = computed(() => {
    const mention = this.owner();
    const count = mention.items().length;
    if (mention.loading()) return '';
    return count ? this.text.resultsAvailable(count) : this.text.emptyFilterMessage;
  });
}
