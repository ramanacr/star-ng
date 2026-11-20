import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  numberAttribute,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarEmptyContext,
  StarPart,
  starSlot,
  StarSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarMarkdownLite } from './markdown-lite.component';

/** Author of a chat message. */
export interface StarChatAuthor {
  /** Unique id. Messages whose author id is `user` are the user's own. */
  readonly id: string;
  readonly name: string;
  /** Image URL of the avatar. Without it, the initials show. */
  readonly avatar?: string;
}

/** Delivery state of a message. A message from someone else that is `sending` is still streaming. */
export type StarChatMessageStatus = 'sending' | 'sent' | 'error';

/** One message of `star-chat`. */
export interface StarChatMessage {
  /** Unique id. Keep it while the text grows (streaming): the message updates in place. */
  readonly id: string;
  readonly author: StarChatAuthor;
  /** Text in a Markdown subset: paragraphs, line breaks, bold, italic, code, code blocks, links. */
  readonly text: string;
  readonly timestamp: Date | string | number;
  readonly status?: StarChatMessageStatus;
}

/** Context of the `ng-template[starChatMessage]` slot. */
export interface StarChatMessageContext {
  /** The message (`let-message`). */
  readonly $implicit: StarChatMessage;
  /** `true` for a message of the current user (`let-own="own"`). */
  readonly own: boolean;
  /** `true` for the first message of a group of one author (`let-first="first"`). */
  readonly first: boolean;
}

/** Content of each message bubble of `star-chat`: `<ng-template starChatMessage let-message>`. */
@Directive({
  selector: 'ng-template[starChatMessage]',
  providers: [{ provide: StarSlot, useExisting: StarChatMessageTemplate }],
})
export class StarChatMessageTemplate extends StarSlot<StarChatMessageContext> {
  readonly name = 'chatMessage';

  static ngTemplateContextGuard(
    _dir: StarChatMessageTemplate,
    _ctx: unknown,
  ): _ctx is StarChatMessageContext {
    return true;
  }
}

type ChatRow =
  | { readonly kind: 'day'; readonly key: string; readonly label: string }
  | {
      readonly kind: 'message';
      readonly key: string;
      readonly message: StarChatMessage;
      readonly own: boolean;
      readonly first: boolean;
      last: boolean;
      readonly time: string;
      readonly iso: string;
    };

/** Distance in pixels from the bottom that still counts as "at the bottom". */
const BOTTOM_SLACK = 48;
/** Distance in pixels from the top that asks for older messages. */
const TOP_TRIGGER = 8;
/** Longest text read in the announcement of a new message. */
const ANNOUNCE_MAX = 200;

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? '')
    .join('');
}

/** Text of a message without Markdown marks, for the live announcement. */
function plainText(text: string): string {
  const plain = text
    .replace(/```[\w+#.-]*\n?/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > ANNOUNCE_MAX ? `${plain.slice(0, ANNOUNCE_MAX)}…` : plain;
}

/**
 * Chat (Kendo UI `Chat`; PrimeNG, Ignite UI and Syncfusion Angular have no chat control): a message
 * list with a composer. Messages of the current `user` align to the end (to the left in a
 * right-to-left page), consecutive messages of one author form a group, and a separator starts each
 * day. The text supports a Markdown subset; raw HTML stays text and links open safely.
 *
 * Streaming: replace a message with a copy whose text is longer (same `id`), with
 * `status: 'sending'`. It updates in place; the list stays at the bottom only when it was there.
 * A polite live region announces a message from someone else once, when its status is `sent` (or
 * it has none), not each streamed part.
 *
 * Older messages: scrolling to the top emits `loadMore` (while `hasMore` and not `loading`). Put the
 * older messages before the others: the view keeps its place.
 *
 * Composer: Enter sends (`send`), Shift+Enter adds a line. Attachments are not supported.
 *
 * ```html
 * <star-chat [messages]="messages()" user="me" [typing]="typing()" (send)="post($event.text)" />
 * ```
 */
@Component({
  selector: 'star-chat',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet, StarMarkdownLite],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: StarChat }],
  host: { class: 'star-chat' },
  template: `
    <div
      starPart="scroll"
      #scroller
      class="star-chat__scroll"
      role="region"
      tabindex="0"
      [attr.aria-label]="ariaLabel() ?? text.chatMessages"
      [attr.aria-busy]="loading() || null"
      (scroll)="onScroll()"
    >
      @if (loading()) {
        <div starPart="loading" class="star-chat__loading">
          <i starPart="icon" class="ph-bold ph-spinner-gap star-spin" aria-hidden="true"></i
          >{{ text.loading }}
        </div>
      }
      @for (row of rows(); track row.key) {
        @if (row.kind === 'day') {
          <div starPart="day" class="star-chat__day" role="separator" [attr.aria-label]="row.label">
            <span starPart="text" aria-hidden="true">{{ row.label }}</span>
          </div>
        } @else {
          @let message = row.message;
          <div
            starPart="message"
            class="star-chat__message"
            [class.star-chat__message--own]="row.own"
            [class.star-chat__message--first]="row.first"
            [class.star-chat__message--last]="row.last"
            [class.star-chat__message--error]="message.status === 'error'"
          >
            @if (!row.own) {
              <span starPart="avatar" class="star-chat__avatar" aria-hidden="true">
                @if (row.first) {
                  @if (message.author.avatar) {
                    <img starPart="image" [src]="message.author.avatar" alt="" />
                  } @else {
                    {{ initialsOf(message.author.name) }}
                  }
                }
              </span>
            }
            <div starPart="body" class="star-chat__body">
              @if (row.first && !row.own) {
                <span starPart="author" class="star-chat__author" aria-hidden="true">{{
                  message.author.name
                }}</span>
              }
              <div starPart="bubble" class="star-chat__bubble">
                <span starPart="srText" class="star-sr-only">{{
                  row.time
                    ? text.messageFrom(message.author.name, row.time)
                    : message.author.name + ':'
                }}</span>
                @if (messageTemplate(); as template) {
                  <ng-container
                    *ngTemplateOutlet="
                      template;
                      context: { $implicit: message, own: row.own, first: row.first }
                    "
                  />
                } @else {
                  <star-markdown-lite class="star-chat__text" [text]="message.text" />
                }
              </div>
              @if (row.last || message.status) {
                <div starPart="meta" class="star-chat__meta">
                  @if (row.last && row.time) {
                    <time starPart="time" aria-hidden="true" [attr.datetime]="row.iso">{{
                      row.time
                    }}</time>
                  }
                  @if (message.status) {
                    <i
                      starPart="status"
                      class="star-chat__status ph"
                      role="img"
                      [class.ph-clock]="message.status === 'sending'"
                      [class.ph-check]="message.status === 'sent'"
                      [class.ph-warning-circle]="message.status === 'error'"
                      [attr.aria-label]="statusLabel(message.status)"
                    ></i>
                  }
                </div>
              }
            </div>
          </div>
        }
      } @empty {
        @if (!loading()) {
          <div starPart="empty" class="star-chat__empty">
            @if (emptyTemplate(); as template) {
              <ng-container *ngTemplateOutlet="template; context: { $implicit: '' }" />
            } @else {
              {{ text.chatEmpty }}
            }
          </div>
        }
      }
    </div>
    @if (typingText(); as typingLine) {
      <div starPart="typing" class="star-chat__typing">
        <span starPart="dots" class="star-chat__dots" aria-hidden="true"
          ><span starPart="text"></span><span starPart="text"></span><span starPart="text"></span
        ></span>
        {{ typingLine }}
      </div>
    }
    <form
      starPart="composer"
      class="star-chat__composer"
      (submit)="$event.preventDefault(); sendDraft()"
    >
      <textarea
        starPart="input"
        #composer
        class="star-input star-chat__input"
        rows="1"
        [attr.aria-label]="text.message"
        [attr.placeholder]="placeholder() ?? text.message"
        [disabled]="disabled()"
        [value]="draft()"
        (input)="draft.set(composer.value)"
        (keydown)="onComposerKeydown($event)"
      ></textarea>
      <button
        starPart="send"
        type="submit"
        class="star-btn star-btn--primary star-btn--icon star-chat__send"
        [attr.aria-label]="text.send"
        [disabled]="disabled() || !draft().trim()"
      >
        <i starPart="icon" class="ph-bold ph-paper-plane-right" aria-hidden="true"></i>
      </button>
    </form>
    <p starPart="live" class="star-sr-only star-chat__live" aria-live="polite">
      {{ announcement() }}
    </p>
  `,
})
export class StarChat {
  protected readonly text = inject(STAR_UI_TEXT);

  /** The messages, oldest first. */
  readonly messages = input<readonly StarChatMessage[]>([]);
  /** Author id of the current user: those messages align to the end. */
  readonly user = input<string | null>(null);
  /** Authors who are typing now. */
  readonly typing = input<readonly StarChatAuthor[]>([]);
  /** Shows a loading row at the top (older messages are loading). */
  readonly loading = input(false, { transform: booleanAttribute });
  /** `false` when there are no older messages: scrolling to the top emits nothing. */
  readonly hasMore = input(true, { transform: booleanAttribute });
  /** Disables the composer. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Placeholder of the composer. Defaults to the `message` text. */
  readonly placeholder = input<string | null>(null);
  /** Accessible name of the message area. Defaults to the `chatMessages` text. */
  readonly ariaLabel = input<string | null>(null);
  /** Locale of the times and day separators. Default: the browser's. */
  readonly locale = input<string | null>(null);
  /** Longest pause in milliseconds between two messages of one author in one group. */
  readonly groupWindow = input(5 * 60 * 1000, { transform: numberAttribute });

  /** Emits the text of the composer when the user sends it. */
  readonly send = output<{ text: string }>();
  /** Emits when the user scrolled to the top: load older messages. */
  readonly loadMore = output<void>();

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly messageTemplate = starSlot<StarChatMessageContext>(
    this.slots,
    this,
    'chatMessage',
  );
  protected readonly emptyTemplate = starSlot<StarEmptyContext>(this.slots, this, 'empty');

  /** The composer text. */
  readonly draft = signal('');
  protected readonly announcement = signal('');

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild.required<ElementRef<HTMLTextAreaElement>>('composer');

  private readonly timeFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.locale() ?? undefined, { hour: 'numeric', minute: '2-digit' }),
  );
  private readonly dayFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.locale() ?? undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
  );

  /** Day separators and messages, with the group of each message. */
  protected readonly rows = computed<readonly ChatRow[]>(() => {
    const user = this.user();
    const time = this.timeFormat();
    const day = this.dayFormat();
    const window = this.groupWindow();
    const rows: ChatRow[] = [];
    let previous = null as { author: string; day: string; at: number } | null;
    let lastMessage = null as Extract<ChatRow, { kind: 'message' }> | null;
    for (const message of this.messages()) {
      const date = toDate(message.timestamp);
      const valid = !Number.isNaN(date.getTime());
      // A message without a valid time stays in the day of the message before it.
      const key = valid ? dayKey(date) : (previous?.day ?? '');
      if (valid && previous?.day !== key) {
        // The same day can come back when messages are out of order: the row index keeps keys unique.
        rows.push({ kind: 'day', key: `day-${key}-${rows.length}`, label: day.format(date) });
      }
      const first =
        !previous ||
        previous.author !== message.author.id ||
        previous.day !== key ||
        (valid && date.getTime() - previous.at > window);
      if (first && lastMessage) lastMessage.last = true;
      lastMessage = {
        kind: 'message',
        key: message.id,
        message,
        own: user !== null && message.author.id === user,
        first,
        last: false,
        time: valid ? time.format(date) : '',
        iso: valid ? date.toISOString() : '',
      };
      rows.push(lastMessage);
      previous = {
        author: message.author.id,
        day: key,
        at: valid ? date.getTime() : (previous?.at ?? 0),
      };
    }
    if (lastMessage) lastMessage.last = true;
    return rows;
  });

  protected readonly typingText = computed(() => {
    const names = this.typing().map((author) => author.name);
    if (!names.length) return '';
    if (names.length === 1) return this.text.isTyping(names[0]);
    const list = new Intl.ListFormat(this.locale() ?? undefined, { type: 'conjunction' });
    return this.text.areTyping(list.format(names));
  });

  /** Ids of messages that are announced or were there before (not announced). */
  private readonly seen = new Set<string>();
  private ready = false;
  private previousFirst: string | null = null;
  private lastTop = 0;
  private lastHeight = 0;
  private lastClient = 0;
  private stickNext = true;
  private loadAsked = false;

  constructor() {
    // Announce new messages of others once they are complete.
    effect(() => {
      const list = this.messages();
      const user = this.user();
      untracked(() => {
        const oldFirst = this.ready ? list.findIndex((m) => m.id === this.firstSeen) : -1;
        // A list that shares no message with the one before is another conversation: history.
        const replaced = this.ready && this.seen.size > 0 && !list.some((m) => this.seen.has(m.id));
        const fresh: StarChatMessage[] = [];
        list.forEach((message, index) => {
          const complete = message.status === undefined || message.status === 'sent';
          if (this.seen.has(message.id) || !complete) return;
          this.seen.add(message.id);
          // Messages at the first render and older messages put before them are history.
          if (!this.ready || replaced || index < oldFirst || message.author.id === user) return;
          fresh.push(message);
        });
        // Messages that complete in one change make one announcement.
        if (fresh.length === 1) {
          this.announce(this.text.newMessage(fresh[0].author.name, plainText(fresh[0].text)));
        } else if (fresh.length > 1) {
          this.announce(this.text.newMessages(fresh.length));
        }
        this.firstSeen = list[0]?.id ?? null;
        this.ready = true;
      });
    });
    // Keep the place: at the bottom when it was there, still when older messages come before.
    afterRenderEffect(() => {
      const list = this.messages();
      this.typing();
      this.loading();
      const element = this.scroller().nativeElement;
      untracked(() => {
        const first = list[0]?.id ?? null;
        const prepended =
          this.previousFirst !== null &&
          first !== this.previousFirst &&
          list.some((message) => message.id === this.previousFirst);
        if (prepended) {
          element.scrollTop = element.scrollHeight - this.lastHeight + this.lastTop;
          this.loadAsked = false;
        } else if (
          this.stickNext ||
          this.lastTop + this.lastClient >= this.lastHeight - BOTTOM_SLACK
        ) {
          element.scrollTop = element.scrollHeight;
        }
        this.stickNext = false;
        this.previousFirst = first;
        this.record(element);
      });
    });
  }

  private firstSeen: string | null = null;

  protected initialsOf(name: string): string {
    return initials(name);
  }

  protected statusLabel(status: StarChatMessageStatus): string {
    if (status === 'sending') return this.text.messageSending;
    if (status === 'error') return this.text.messageNotSent;
    return this.text.messageSent;
  }

  /** Sends the composer text, then empties the composer. */
  sendDraft(): void {
    const text = this.draft().trim();
    if (!text || this.disabled()) return;
    this.send.emit({ text });
    this.draft.set('');
    this.composer().nativeElement.value = '';
    this.stickNext = true;
  }

  /** Moves the focus to the composer. */
  focus(): void {
    this.composer().nativeElement.focus();
  }

  protected onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.sendDraft();
  }

  protected onScroll(): void {
    const element = this.scroller().nativeElement;
    this.record(element);
    if (element.scrollTop > TOP_TRIGGER * 8) this.loadAsked = false;
    if (
      element.scrollTop <= TOP_TRIGGER &&
      !this.loading() &&
      this.hasMore() &&
      this.messages().length &&
      !this.loadAsked
    ) {
      this.loadAsked = true;
      this.loadMore.emit();
    }
  }

  private record(element: HTMLElement): void {
    this.lastTop = element.scrollTop;
    this.lastHeight = element.scrollHeight;
    this.lastClient = element.clientHeight;
  }

  private toggle = false;
  private announce(message: string): void {
    // A trailing no-break space makes a repeated message a change, so it is read again.
    this.toggle = !this.toggle;
    this.announcement.set(message + (this.toggle ? '' : ' '));
  }
}
