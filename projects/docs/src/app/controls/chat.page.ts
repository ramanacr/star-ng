import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  StarAiPrompt,
  StarAiPromptOutput,
  StarChat,
  StarChatAuthor,
  StarChatMessage,
} from '@star-ng/ui/chat';
import { DOCS, DocsRow } from '../shared/docs';

const ME: StarChatAuthor = { id: 'me', name: 'You' };
const ANA: StarChatAuthor = { id: 'ana', name: 'Ana Silva' };
const HELPER: StarChatAuthor = { id: 'helper', name: 'Order helper' };

/** Fixed dates, so the page renders the same on the server and in the browser. */
const DAY_ONE = Date.UTC(2026, 10, 17, 9, 0);
const DAY_TWO = Date.UTC(2026, 10, 18, 10, 0);
const MINUTE = 60_000;

const REPLY =
  'Order **1042** shipped today. You can follow it here: [tracking page](https://example.com/track/1042).\n\n' +
  'The parcel has *two* boxes:\n```\nBox 1: desk lamp\nBox 2: office chair\n```';

const ANSWERS: Record<string, string> = {
  'Summarize the order notes':
    '- The customer wants delivery **after 2 pm**.\n- Box 2 needs a *signature*.\n- Use the side entrance.',
  'Write a friendly reply':
    'Thank you for your order! It is on its way and should arrive **Friday**.',
  'List the next steps':
    'First, confirm the address.\nThen, book the courier.\nLast, send the `tracking` link.',
};

@Component({
  selector: 'docs-chat-page',
  imports: [DOCS, StarAiPrompt, StarChat],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Chat and AI prompt"
      lead="A message list with a composer, and a prompt panel for AI responses. The library makes no network or model call: these examples fake the replies with timers. The Kendo UI equivalents are Chat and AIPrompt."
      importFrom="import { StarAiPrompt, StarChat } from '@star-ng/ui/chat';"
    >
      <docs-example
        heading="Support chat"
        source="chat/basic"
        [script]="chatScript"
        note="Send a message with Enter (Shift+Enter adds a line). The helper shows a typing indicator and streams its answer: the message grows in place, and the live region reads it once, when it is complete. Scroll to the top to load older messages."
      >
        <star-chat
          [messages]="messages()"
          user="me"
          [typing]="typing()"
          [loading]="loadingOlder()"
          [hasMore]="hasMore()"
          locale="en-US"
          ariaLabel="Support conversation"
          (send)="post($event.text)"
          (loadMore)="loadOlder()"
        />
      </docs-example>

      <docs-example
        heading="AI prompt"
        source="chat/ai-prompt"
        [script]="promptScript"
        note="Pick a suggestion or type a prompt, then Generate (or Control+Enter). The response streams in; Stop ends it. Copy puts the text on the clipboard, Retry asks again."
      >
        <star-ai-prompt
          [outputs]="outputs()"
          [suggestions]="suggestions"
          (promptRequest)="ask($event.prompt)"
          (retry)="ask($event.prompt)"
          (stop)="stopStream($event.id)"
        />
      </docs-example>

      <h2>Message text</h2>
      <p>
        Messages and responses use a Markdown subset: paragraphs, line breaks,
        <code>**bold**</code>, <code>*italic*</code>, inline <code>\`code\`</code>, fenced code
        blocks and <code>[links](https://…)</code>. Raw HTML shows as text. Only <code>http:</code>,
        <code>https:</code> and <code>mailto:</code> addresses become links, and they open in a new
        tab with <code>rel="noopener noreferrer"</code>. <code>star-markdown-lite</code> renders the
        same subset anywhere.
      </p>

      <docs-api
        [of]="['StarChat', 'StarAiPrompt', 'StarMarkdownLite']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class ChatPage {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  protected readonly messages = signal<StarChatMessage[]>([
    { id: 'm1', author: ANA, text: 'Hi! I placed order 1042 yesterday.', timestamp: DAY_ONE },
    {
      id: 'm2',
      author: ANA,
      text: 'Can you tell me when it ships?',
      timestamp: DAY_ONE + MINUTE,
    },
    {
      id: 'm3',
      author: ME,
      text: 'Sure, I will ask the *order helper*.',
      timestamp: DAY_TWO,
      status: 'sent',
    },
    { id: 'm4', author: HELPER, text: REPLY, timestamp: DAY_TWO + MINUTE, status: 'sent' },
  ]);
  protected readonly typing = signal<StarChatAuthor[]>([]);
  protected readonly loadingOlder = signal(false);
  protected readonly hasMore = signal(true);
  private next = 5;

  protected readonly suggestions = Object.keys(ANSWERS);
  protected readonly outputs = signal<StarAiPromptOutput[]>([]);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach((timer) => clearTimeout(timer)));
  }

  private later(delay: number, run: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      run();
    }, delay);
    this.timers.add(timer);
  }

  protected post(text: string): void {
    const now = DAY_TWO + this.next * MINUTE;
    this.messages.update((list) => [
      ...list,
      { id: `m${this.next++}`, author: ME, text, timestamp: now, status: 'sent' },
    ]);
    this.typing.set([HELPER]);
    this.later(900, () => {
      this.typing.set([]);
      this.streamReply(`You wrote: *${text}*. A person from our team answers within the hour.`);
    });
  }

  /** Fakes a streamed reply: the text grows word by word, then the status becomes 'sent'. */
  private streamReply(full: string): void {
    const id = `m${this.next++}`;
    const words = full.split(' ');
    let shown = 0;
    this.messages.update((list) => [
      ...list,
      { id, author: HELPER, text: '', timestamp: DAY_TWO + this.next * MINUTE, status: 'sending' },
    ]);
    const step = () => {
      shown++;
      const done = shown >= words.length;
      this.messages.update((list) =>
        list.map((m) =>
          m.id === id
            ? {
                ...m,
                text: words.slice(0, shown).join(' '),
                status: done ? ('sent' as const) : ('sending' as const),
              }
            : m,
        ),
      );
      if (!done) this.later(70, step);
    };
    this.later(70, step);
  }

  protected loadOlder(): void {
    if (this.loadingOlder() || !this.hasMore()) return;
    this.loadingOlder.set(true);
    this.later(600, () => {
      this.messages.update((list) => [
        {
          id: 'old1',
          author: ANA,
          text: 'Hello, I have a question about delivery times.',
          timestamp: DAY_ONE - 3 * 24 * 60 * MINUTE,
        },
        {
          id: 'old2',
          author: ME,
          text: 'Of course, ask away.',
          timestamp: DAY_ONE - 3 * 24 * 60 * MINUTE + MINUTE,
          status: 'sent',
        },
        ...list,
      ]);
      this.loadingOlder.set(false);
      this.hasMore.set(false);
    });
  }

  private streams = new Map<string, () => void>();

  protected ask(prompt: string): void {
    const id = `o${Date.now()}`;
    const words = (ANSWERS[prompt] ?? `Here is a draft for “${prompt}”. Edit it to fit.`).split(
      ' ',
    );
    let shown = 0;
    let stopped = false;
    this.outputs.update((list) => [{ id, prompt, text: '', status: 'streaming' }, ...list]);
    this.streams.set(id, () => (stopped = true));
    const step = () => {
      if (stopped) {
        this.outputs.update((list) =>
          list.map((o) => (o.id === id ? { ...o, status: 'done' as const } : o)),
        );
        return;
      }
      shown++;
      const done = shown >= words.length;
      this.outputs.update((list) =>
        list.map((o) =>
          o.id === id
            ? {
                ...o,
                text: words.slice(0, shown).join(' '),
                status: done ? ('done' as const) : ('streaming' as const),
              }
            : o,
        ),
      );
      if (!done) this.later(80, step);
    };
    this.later(200, step);
  }

  protected stopStream(id: string): void {
    this.streams.get(id)?.();
    this.streams.delete(id);
  }

  protected readonly chatScript = `readonly messages = signal<StarChatMessage[]>([...]);
readonly typing = signal<StarChatAuthor[]>([]);

post(text: string) {
  this.messages.update((list) => [...list, { id: newId(), author: ME, text, timestamp: Date.now(), status: 'sent' }]);
  this.typing.set([HELPER]);
  // Your service answers. Stream it: add the message with status 'sending',
  // replace it with longer text (same id), then set status 'sent'.
}`;
  protected readonly promptScript = `readonly outputs = signal<StarAiPromptOutput[]>([]);

ask(prompt: string) {
  const id = newId();
  this.outputs.update((list) => [{ id, prompt, text: '', status: 'streaming' }, ...list]);
  // Grow the text of output "id" as tokens arrive, then set status 'done' (or 'error').
}`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starChatMessage]',
      description:
        'star-chat: content of each bubble. Context: the message ($implicit), own and first (first message of a group).',
    },
    { name: 'ng-template[starEmpty]', description: 'star-chat: shown while there is no message.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-chat-height', description: 'Height of star-chat (28rem).' },
    { name: '--star-primary-soft', description: 'Bubble of your own messages.' },
    { name: '--star-surface-muted', description: 'Bubble of other messages, code background.' },
    { name: '--star-accent', description: 'Links and the avatar initials.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter (composer)', description: 'Sends the message.' },
    { name: 'Shift+Enter (composer)', description: 'Adds a line.' },
    {
      name: 'Tab',
      description: 'Moves to the message area (scroll with the arrows), then the composer.',
    },
    { name: 'Control+Enter / Command+Enter (prompt)', description: 'Sends the prompt.' },
  ];
}
